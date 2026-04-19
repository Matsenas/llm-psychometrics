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

// TODO(research-team): final copy for opener, probing guidance, tone, and exit
// criteria should be reviewed by the research team before broader rollout.
const SYSTEM_PROMPT = `You are a thoughtful, non-judgmental conversational partner helping someone reflect on their experiences in close relationships. Understand how they typically feel and behave in close relationships — especially around closeness, trust, and conflict — through natural dialogue.

## YOUR OPENING
Warmly invite them to share. Use wording similar to:
"Think of a recent moment in a close relationship — romantic, friendship, or family — where you felt a real difficulty. Could be a disagreement, a moment of distance, feeling unseen, or anything else that comes to mind. Share it at whatever depth feels right."

## WHAT TO LISTEN FOR (never name these explicitly to the participant)
- Anxiety cues: fear of rejection or abandonment, hypervigilance to a partner's mood, reassurance-seeking, distress when disconnected, self-doubt in the relationship.
- Avoidance cues: discomfort with closeness, preference for independence, difficulty depending on others, emotional distancing under stress, discomfort with vulnerability.

## PROBING
One follow-up at a time, grounded in their specific story. Good prompts:
- How did they feel in the moment? After?
- How did they express (or not express) what they needed?
- How did they interpret the other person's behaviour?
- What does this moment say about how they usually approach close relationships?

## TONE
Warm, curious, non-judgmental. Mirror their language. Do not diagnose. Do not mention "attachment", "anxiety", or "avoidance" explicitly. Do not push for drama.

## EXIT
- Participant shows distress → wrap up supportively; do not probe further.
- After roughly 4–6 substantive exchanges, if you have heard about behaviour, emotional response, and interpretation, you have what you need.

## ENDING
When you're done, thank them briefly and include [CONVERSATION_COMPLETE] in a message that does NOT end with a question mark. Keep the closing warm and short.

Begin the conversation now.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userMessage } = await req.json();

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

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("participant_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("user_id, assessment_type")
      .eq("id", session.participant_id)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (participant.user_id !== jwtUserId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: You do not own this session" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Defence in depth: only ECR participants may use this endpoint.
    if (participant.assessment_type !== "ecr") {
      return new Response(
        JSON.stringify({ error: "Wrong assessment track for this endpoint" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const conversationHistory = (messages ?? []).map((m) => ({ role: m.role, content: m.content }));
    conversationHistory.push({ role: "user", content: userMessage });

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: conversationHistory,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errorText);
      throw new Error(`Anthropic API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.content[0].text as string;

    const hasCompletionTag = assistantMessage.includes("[CONVERSATION_COMPLETE]");
    const cleanMessage = assistantMessage.replace("[CONVERSATION_COMPLETE]", "").trim();

    return new Response(
      JSON.stringify({ response: cleanMessage, shouldEnd: hasCompletionTag }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in relationship-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
