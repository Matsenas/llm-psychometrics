import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch (e) {
    console.error("JWT decode error:", e);
    return null;
  }
}

function extractJsonText(text: string): string {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/\s*```$/g, '').trim();
  const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
  return jsonMatch ? jsonMatch[1] : cleaned;
}

// TODO(research-team): final rubric anchors and scoring guidance should be reviewed
// by the research team. These are MVP defaults aligned with the ECR-R 1-7 Likert scale.
const SCORING_PROMPT = `You are a careful scorer of adult attachment in close relationships. You will read a single-session conversation where someone reflects on a recent relationship difficulty. Produce anxiety and avoidance scores on the ECR-R 1-7 scale based only on what the participant explicitly said or showed.

## OUTPUT FORMAT (return STRICT JSON, no markdown, no prose)

{
  "anxiety":   { "score": <number 1..7>, "confidence": "low"|"medium"|"high", "key_evidence": [<string>, ...], "reasoning": <string> },
  "avoidance": { "score": <number 1..7>, "confidence": "low"|"medium"|"high", "key_evidence": [<string>, ...], "reasoning": <string> },
  "overall_assessment": <string>
}

## ANXIETY SCALE (1..7)
1 = No evidence of fear of abandonment, rejection sensitivity, or reassurance-seeking. Participant describes relationships with security and stable self-worth.
4 = Some worry or rumination about partner's feelings; occasional reassurance-seeking, but also capacity to self-soothe.
7 = Pervasive fear of rejection or abandonment; strong need for closeness and reassurance; distress when disconnected; persistent self-doubt in the relationship.

## AVOIDANCE SCALE (1..7)
1 = No evidence of discomfort with closeness or emotional dependence. Participant describes ease with intimacy and interdependence.
4 = Some hesitation with vulnerability; prefers some distance under stress.
7 = Pronounced discomfort with closeness or dependence; withdrawal under stress; preference for emotional self-reliance; difficulty opening up.

## KEY EVIDENCE
For each dimension, include 1-3 short direct quotes (<=20 words each) that most support the score. Do not invent quotes.

## CONFIDENCE
- "high" when the participant gave specific, detailed, and affect-laden accounts clearly revealing their pattern.
- "medium" when the evidence is present but thinner or mixed.
- "low" when the conversation was short, vague, or avoidant of the topic (e.g., early exit).

## IMPORTANT
- Return only the JSON object. No prose before or after. No markdown fences.
- If evidence for a dimension is missing, score 4 (neutral midpoint) with confidence "low".`;

interface ScoredDimension {
  score: number;
  confidence: "low" | "medium" | "high";
  key_evidence: string[];
  reasoning: string;
}

interface ScoredOutput {
  anxiety: ScoredDimension;
  avoidance: ScoredDimension;
  overall_assessment: string;
}

function isScoredDimension(x: unknown): x is ScoredDimension {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  if (typeof obj.score !== "number" || obj.score < 1 || obj.score > 7) return false;
  if (!["low", "medium", "high"].includes(obj.confidence as string)) return false;
  if (!Array.isArray(obj.key_evidence) || !obj.key_evidence.every((q) => typeof q === "string")) return false;
  if (typeof obj.reasoning !== "string") return false;
  return true;
}

function isScoredOutput(x: unknown): x is ScoredOutput {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  return (
    isScoredDimension(obj.anxiety) &&
    isScoredDimension(obj.avoidance) &&
    typeof obj.overall_assessment === "string"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { participantId } = await req.json();

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
      .select("id, user_id, assessment_type")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Allow the participant themselves, or an admin, to trigger scoring.
    let isAuthorized = participant.user_id === jwtUserId;
    if (!isAuthorized) {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", jwtUserId)
        .eq("role", "admin")
        .maybeSingle();
      isAuthorized = !!adminRole;
    }
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (participant.assessment_type !== "ecr") {
      return new Response(
        JSON.stringify({ error: "Participant is not on the ECR track" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the single ECR chat_session + messages. ECR is always session_number=1
    // for a given participant.
    const { data: chatSession, error: chatSessionError } = await supabase
      .from("chat_sessions")
      .select("id, is_complete, completion_criteria_met")
      .eq("participant_id", participant.id)
      .eq("session_number", 1)
      .maybeSingle();

    if (chatSessionError || !chatSession) {
      return new Response(
        JSON.stringify({ error: "ECR chat session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!chatSession.is_complete) {
      return new Response(
        JSON.stringify({ error: "Chat session is not yet complete" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", chatSession.id)
      .order("created_at", { ascending: true });

    const transcript = (messages ?? [])
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const scoreResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens_to_sample: 4096,
        temperature: 0.3,
        messages: [
          { role: "system", content: SCORING_PROMPT },
          {
            role: "user",
            content:
              `Score the following ECR relationship conversation.\n\nNote: completion_criteria_met=${chatSession.completion_criteria_met ?? false}. If false, the participant ended the conversation early — lower your confidence accordingly.\n\n=== TRANSCRIPT ===\n${transcript}`,
          },
        ],
      }),
    });

    if (!scoreResponse.ok) {
      const errorText = await scoreResponse.text();
      console.error("Anthropic API error:", scoreResponse.status, errorText);
      throw new Error(`Anthropic API error: ${scoreResponse.status}`);
    }

    const scoreData = await scoreResponse.json();
    const raw = scoreData.content[0].text as string;
    const cleaned = extractJsonText(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse scoring response JSON:", cleaned);
      throw new Error("Scoring model returned invalid JSON");
    }

    if (!isScoredOutput(parsed)) {
      console.error("Scoring response failed validation:", parsed);
      throw new Error("Scoring model returned invalid shape");
    }

    const output = parsed as ScoredOutput;

    const llmMetadata = {
      confidence:
        output.anxiety.confidence === output.avoidance.confidence
          ? output.anxiety.confidence
          : "medium",
      key_evidence: {
        anxiety: output.anxiety.key_evidence,
        avoidance: output.avoidance.key_evidence,
      },
      reasoning: {
        anxiety: output.anxiety.reasoning,
        avoidance: output.avoidance.reasoning,
      },
      overall_assessment: output.overall_assessment,
    };

    const { error: upsertError } = await supabase
      .from("attachment_scores")
      .upsert(
        {
          participant_id: participant.id,
          method: "llm",
          anxiety: Number(output.anxiety.score.toFixed(2)),
          avoidance: Number(output.avoidance.score.toFixed(2)),
          llm_metadata: llmMetadata,
        },
        { onConflict: "participant_id,method" },
      );

    if (upsertError) {
      console.error("Failed to upsert attachment_scores:", upsertError);
      throw new Error("Failed to store attachment scores");
    }

    return new Response(
      JSON.stringify({ success: true, anxiety: output.anxiety.score, avoidance: output.avoidance.score }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in score-attachment-llm:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
