import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText, resolveLlmSettings } from "../_shared/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_REPEAT_COUNT = 5;
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const TEMPERATURE = 0.3;

const SYSTEM_PROMPT = `You are a careful zero-shot classifier of adult attachment patterns from a single conversational interview transcript.

Rate only what is supported by the transcript. Participants may have fabricated responses because this is a system evaluation.

Return strict JSON only:
{
  "anxiety": { "score": <number 1..7>, "confidence": "low"|"medium"|"high", "key_evidence": [<short quote>, ...], "reasoning": <string> },
  "avoidance": { "score": <number 1..7>, "confidence": "low"|"medium"|"high", "key_evidence": [<short quote>, ...], "reasoning": <string> },
  "prototype": "secure"|"preoccupied"|"dismissive"|"fearful",
  "narrative": <100-200 word explanation grounded in the transcript>
}

Anxiety: fear of rejection/abandonment, reassurance seeking, distress when disconnected, self-doubt in close relationships.
Avoidance: discomfort with closeness/dependence, emotional distancing under stress, strong preference for self-reliance, discomfort with vulnerability.

Prototype mapping:
- secure: low anxiety, low avoidance
- preoccupied: high anxiety, low avoidance
- dismissive: low anxiety, high avoidance
- fearful: high anxiety, high avoidance

If evidence is thin, use the scale midpoint and low confidence. Do not diagnose.`;

type AttachmentPrototype = "secure" | "preoccupied" | "dismissive" | "fearful";

interface ClassificationResult {
  anxiety: number;
  avoidance: number;
  prototype: AttachmentPrototype;
  narrative: string;
  provider: string;
  model: string;
  key_evidence: {
    anxiety: unknown[];
    avoidance: unknown[];
  };
  confidence: {
    anxiety: string | null;
    avoidance: string | null;
  };
  raw_response: Record<string, unknown>;
}

interface ChatMessageRow {
  role: string;
  content: string;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding === 2) return atob(base64 + "==");
  if (padding === 3) return atob(base64 + "=");
  if (padding === 0) return atob(base64);
  throw new Error("Invalid base64url string");
}

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload.sub || null;
  } catch (e) {
    console.error("JWT decode error:", e);
    return null;
  }
}

function extractJsonText(text: string): string {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/\s*```$/g, "").trim();
  const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
  return jsonMatch ? jsonMatch[1] : cleaned;
}

function isPrototype(value: unknown): value is AttachmentPrototype {
  return value === "secure" || value === "preoccupied" || value === "dismissive" || value === "fearful";
}

function validateScore(value: unknown): number {
  if (typeof value !== "number" || value < 1 || value > 7) {
    throw new Error("Classifier score out of range");
  }
  return Number(value.toFixed(2));
}

function confidenceValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function classifyTranscript(transcript: string): Promise<ClassificationResult> {
  const completion = await generateText({
    taskName: "run-attachment-classification",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Classify this transcript.\n\n=== TRANSCRIPT ===\n${transcript}`,
      },
    ],
    maxTokens: 4096,
    temperature: TEMPERATURE,
    models: { anthropic: DEFAULT_ANTHROPIC_MODEL },
  });
  const raw = completion.text;
  const parsed = JSON.parse(extractJsonText(raw)) as Record<string, unknown>;
  const anxietyData = parsed.anxiety as Record<string, unknown> | undefined;
  const avoidanceData = parsed.avoidance as Record<string, unknown> | undefined;
  const anxiety = validateScore(anxietyData?.score);
  const avoidance = validateScore(avoidanceData?.score);
  const prototype = parsed.prototype;
  if (!isPrototype(prototype)) throw new Error("Classifier prototype invalid");
  if (typeof parsed.narrative !== "string" || !parsed.narrative.trim()) {
    throw new Error("Classifier narrative missing");
  }

  return {
    anxiety,
    avoidance,
    prototype,
    narrative: parsed.narrative.trim(),
    provider: completion.provider,
    model: completion.model,
    key_evidence: {
      anxiety: Array.isArray(anxietyData?.key_evidence) ? anxietyData.key_evidence : [],
      avoidance: Array.isArray(avoidanceData?.key_evidence) ? avoidanceData.key_evidence : [],
    },
    confidence: {
      anxiety: confidenceValue(anxietyData?.confidence),
      avoidance: confidenceValue(avoidanceData?.confidence),
    },
    raw_response: parsed,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function modal(values: string[]): string {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "secure";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { participantId, repeatCount = DEFAULT_REPEAT_COUNT } = await req.json();

    const authHeader = req.headers.get("Authorization");
    const jwtUserId = getUserIdFromJwt(authHeader);
    if (!jwtUserId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, user_id")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      return new Response(JSON.stringify({ error: "Participant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authorized = participant.user_id === jwtUserId;
    if (!authorized) {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", jwtUserId)
        .eq("role", "admin")
        .maybeSingle();
      authorized = !!adminRole;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: chatSession } = await supabase
      .from("chat_sessions")
      .select("id, is_complete")
      .eq("participant_id", participantId)
      .eq("session_number", 1)
      .maybeSingle();

    if (!chatSession?.id || !chatSession.is_complete) {
      return new Response(JSON.stringify({ error: "Completed relationship interview not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingSummary } = await supabase
      .from("attachment_classification_summaries")
      .select("*")
      .eq("participant_id", participantId)
      .eq("chat_session_id", chatSession.id)
      .eq("run_batch", 1)
      .maybeSingle();

    if (existingSummary) {
      return new Response(JSON.stringify({ success: true, summary: existingSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", chatSession.id)
      .order("created_at", { ascending: true });

    const transcript = ((messages ?? []) as ChatMessageRow[])
      .map((m) => `${String(m.role).toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const completedRuns: ClassificationResult[] = [];
    const llmSettings = resolveLlmSettings({
      models: { anthropic: DEFAULT_ANTHROPIC_MODEL },
    });

    for (let i = 1; i <= Number(repeatCount); i++) {
      try {
        const result = await classifyTranscript(transcript);
        completedRuns.push(result);
        await supabase.from("attachment_classification_runs").upsert(
          {
            participant_id: participantId,
            chat_session_id: chatSession.id,
            run_number: i,
            run_batch: 1,
            model: result.model,
            temperature: TEMPERATURE,
            anxiety: result.anxiety,
            avoidance: result.avoidance,
            prototype: result.prototype,
            narrative: result.narrative,
            key_evidence: result.key_evidence,
            confidence: result.confidence,
            raw_response: result.raw_response,
            status: "complete",
            error_message: null,
          },
          { onConflict: "participant_id,chat_session_id,run_batch,run_number" },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown classifier error";
        await supabase.from("attachment_classification_runs").upsert(
          {
            participant_id: participantId,
            chat_session_id: chatSession.id,
            run_number: i,
            run_batch: 1,
            model: llmSettings.model,
            temperature: TEMPERATURE,
            status: "failed",
            error_message: message,
          },
          { onConflict: "participant_id,chat_session_id,run_batch,run_number" },
        );
      }
    }

    if (completedRuns.length === 0) {
      throw new Error("All classifier runs failed");
    }

    const anxietyValues = completedRuns.map((run) => run.anxiety);
    const avoidanceValues = completedRuns.map((run) => run.avoidance);
    const prototypes = completedRuns.map((run) => run.prototype);
    const summary = {
      participant_id: participantId,
      chat_session_id: chatSession.id,
      run_batch: 1,
      mean_anxiety: Number(mean(anxietyValues).toFixed(2)),
      sd_anxiety: Number(sampleSd(anxietyValues).toFixed(2)),
      mean_avoidance: Number(mean(avoidanceValues).toFixed(2)),
      sd_avoidance: Number(sampleSd(avoidanceValues).toFixed(2)),
      modal_prototype: modal(prototypes),
      displayed_narrative: completedRuns[0].narrative,
      completed_runs: completedRuns.length,
    };

    const { data: storedSummary, error: summaryError } = await supabase
      .from("attachment_classification_summaries")
      .upsert(summary, { onConflict: "participant_id,chat_session_id,run_batch" })
      .select()
      .single();

    if (summaryError) throw summaryError;

    await supabase.from("attachment_scores").upsert(
      {
        participant_id: participantId,
        method: "llm",
        anxiety: summary.mean_anxiety,
        avoidance: summary.mean_avoidance,
        llm_metadata: {
          modal_prototype: summary.modal_prototype,
          provider: completedRuns[0].provider,
          model: completedRuns[0].model,
          completed_runs: summary.completed_runs,
          sd_anxiety: summary.sd_anxiety,
          sd_avoidance: summary.sd_avoidance,
        },
      },
      { onConflict: "participant_id,method" },
    );

    return new Response(JSON.stringify({ success: true, summary: storedSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in run-attachment-classification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
