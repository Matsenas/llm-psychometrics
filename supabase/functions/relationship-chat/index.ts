import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function getAnthropicText(response: any): string {
  if (!response) throw new Error("Missing Anthropic response body");
  if (typeof response?.content?.[0]?.text === "string" && response.content[0].text.trim()) {
    return response.content[0].text;
  }
  if (typeof response?.completion === "string" && response.completion.trim()) {
    return response.completion;
  }
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text;
  }
  console.error("Unexpected Anthropic response shape:", response);
  throw new Error("Unexpected Anthropic response format");
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
    console.log("relationship-chat: Received request");
    const { sessionId, userMessage } = await req.json();
    console.log("relationship-chat: Parsed body", { sessionId, userMessageLength: userMessage?.length });

    const authHeader = req.headers.get("Authorization");
    console.log("relationship-chat: Auth header present:", !!authHeader);
    const jwtUserId = getUserIdFromJwt(authHeader);
    console.log("relationship-chat: JWT user ID:", jwtUserId);
    if (!jwtUserId) {
      console.log("relationship-chat: Unauthorized - no JWT user ID");
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
      console.log("relationship-chat: Session error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log("relationship-chat: Found session for participant:", session.participant_id);

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("user_id, assessment_type")
      .eq("id", session.participant_id)
      .single();

    if (participantError || !participant) {
      console.log("relationship-chat: Participant error:", participantError);
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log("relationship-chat: Found participant:", { user_id: participant.user_id, assessment_type: participant.assessment_type });

    if (participant.user_id !== jwtUserId) {
      console.log("relationship-chat: User ID mismatch:", { participantUserId: participant.user_id, jwtUserId });
      return new Response(
        JSON.stringify({ error: "Unauthorized: You do not own this session" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Defence in depth: only ECR participants may use this endpoint.
    if (participant.assessment_type !== "ecr") {
      console.log("relationship-chat: Wrong assessment type:", participant.assessment_type);
      return new Response(
        JSON.stringify({ error: "Wrong assessment track for this endpoint" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log("relationship-chat: Assessment type check passed");

    console.log("relationship-chat: Querying chat_messages for session:", sessionId);
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    console.log("relationship-chat: Retrieved messages from DB:", messages?.length || 0);

    const conversationHistory = (messages ?? []).map((m) => ({ role: m.role, content: m.content }));
    conversationHistory.push({ role: "user", content: userMessage });
    console.log("relationship-chat: Conversation history length:", conversationHistory.length);

    console.log("relationship-chat: Calling Anthropic API");
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    console.log("relationship-chat: API key present:", !!apiKey);
    if (!apiKey) {
      console.log("relationship-chat: No ANTHROPIC_API_KEY set");
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured in Supabase environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    try {
      const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          temperature: 0.3,
          system: SYSTEM_PROMPT,
          messages: conversationHistory,
        }),
      });

      console.log("relationship-chat: Anthropic API response status:", aiResponse.status);
      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("relationship-chat: Anthropic API error response:", errorText);
        return new Response(
          JSON.stringify({ error: `Anthropic API error: ${aiResponse.status} - ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const aiData = await aiResponse.json();
      console.log("relationship-chat: Anthropic response received, parsing...");
      const assistantMessage = getAnthropicText(aiData);
      console.log("relationship-chat: Assistant message length:", assistantMessage.length);

      const hasCompletionTag = assistantMessage.includes("[CONVERSATION_COMPLETE]");
      const cleanMessage = assistantMessage.replace("[CONVERSATION_COMPLETE]", "").trim();
      console.log("relationship-chat: Completion tag found:", hasCompletionTag);

      console.log("relationship-chat: Returning success response");
      return new Response(
        JSON.stringify({ response: cleanMessage, shouldEnd: hasCompletionTag }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (anthropicError) {
      console.error("relationship-chat: Error in Anthropic API section:", anthropicError);
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${anthropicError instanceof Error ? anthropicError.message : 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (error) {
    console.error("relationship-chat: Error in function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
