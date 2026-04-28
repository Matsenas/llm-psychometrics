import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to decode JWT and extract user_id
function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding === 2) return atob(base64 + "==");
  if (padding === 3) return atob(base64 + "=");
  if (padding === 0) return atob(base64);
  throw new Error("Invalid base64url string");
}

function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, userMessage, sessionNumber, big5Aspect } = await req.json();
    
    // Extract user_id from JWT
    const authHeader = req.headers.get('Authorization');
    const jwtUserId = getUserIdFromJwt(authHeader);
    
    if (!jwtUserId) {
      console.error("Missing or invalid authorization");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify session ownership: get session -> get participant -> check user_id matches
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("participant_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("Session not found:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the participant belongs to the authenticated user
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("user_id")
      .eq("id", session.participant_id)
      .single();

    if (participantError || !participant) {
      console.error("Participant not found:", participantError);
      return new Response(
        JSON.stringify({ error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (participant.user_id !== jwtUserId) {
      console.error("Authorization failed: user_id mismatch", { jwtUserId, participantUserId: participant.user_id });
      return new Response(
        JSON.stringify({ error: "Unauthorized: You do not own this session" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authorization verified for session", sessionId);

    // Get conversation history
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const conversationHistory = messages?.map(m => ({
      role: m.role,
      content: m.content
    })) || [];

    // Add current user message
    conversationHistory.push({
      role: "user",
      content: userMessage
    });

    // Question mapping based on session number - grouped by trait (4 each)
    const questions: Record<number, { trait: string; question: string; guidance: string; criteria: string }> = {
      // Agreeableness (1-4)
      1: {
        trait: "Agreeableness",
        question: "Tell me about the last time someone asked you for help or a favor.",
        guidance: "Extract: Whether they helped (and why/why not), their emotional response (burden vs. joy), consideration of cost to themselves vs. benefit to other\nProbe: If vague, ask about specific details of the situation; if they declined, explore their reasoning\nMaintain: Curious and non-judgmental tone\nAvoid: Don't push if they mention declining help—explore their reasoning instead",
        criteria: "Primary: Clear pattern of helpfulness (helped/declined + reasoning + emotional tone)\nFollow-up: If answer lacks emotion/reasoning, get one concrete detail about their mindset\nExit: User expresses discomfort discussing the situation"
      },
      2: {
        trait: "Agreeableness",
        question: "Tell me about the last time you disagreed with someone. What happened?",
        guidance: "Extract: Approach to conflict (direct/avoidant/compromising), tone during disagreement (calm/heated), concern for relationship vs. being right\nProbe: If answer is theoretical, ask for specific recent example; if they say they avoid conflict, explore what they do instead\nMaintain: Non-judgmental about conflict styles\nAvoid: Don't frame any approach as \"better\"—different styles are valid",
        criteria: "Primary: Specific disagreement + their approach + concern for other's perspective\nFollow-up: If only describes outcome, probe their internal experience during conflict\nExit: User avoids giving concrete example after two attempts"
      },
      3: {
        trait: "Agreeableness",
        question: "How do you usually respond when someone is upset or going through a tough time?",
        guidance: "Extract: Empathy expression style (emotional/practical), proactive vs. reactive helping, comfort with others' distress\nProbe: If answer is aspirational, ask about recent specific situation; if they mention avoiding emotional situations, explore gently\nMaintain: Warm, non-judgmental tone\nAvoid: Don't imply emotional support is \"better\" than practical support",
        criteria: "Primary: Response pattern (emotional/practical/both) + specific example + comfort level with distress\nFollow-up: If theoretical, ask about last time someone close to them was upset\nExit: User expresses discomfort with emotional topics"
      },
      4: {
        trait: "Agreeableness",
        question: "Tell me about a time when you had to choose between your own interests and someone else's. What did you do?",
        guidance: "Extract: Decision pattern (self/other-oriented), reasoning process, emotional impact of choice\nProbe: If answer is too easy (\"no conflict\"), explore more; if they mention guilt, probe briefly\nMaintain: Balanced—both choices are valid depending on context\nAvoid: Don't moralize about selfishness vs. selflessness",
        criteria: "Primary: Specific situation + choice made + reasoning + any guilt/peace with decision\nFollow-up: If answer lacks internal conflict, verify if choice was actually difficult\nExit: User indicates significant current guilt about past decision"
      },
      // Conscientiousness (5-8)
      5: {
        trait: "Conscientiousness",
        question: "What's one important thing you had to get done this week? How did it go?",
        guidance: "Extract: Timeline (started early/last-minute), follow-through (completed/ongoing/abandoned), planning approach (structured vs. spontaneous)\nProbe: If they only describe outcome, ask about their process; if task failed, explore what happened\nMaintain: Neutral curiosity—don't judge procrastination or over-planning\nAvoid: Don't let them give aspirational answers (\"I should have...\")—focus on what actually happened",
        criteria: "Primary: Clear timeline and approach pattern (when started + how organized + outcome)\nFollow-up: If only surface details, ask one follow-up about their process\nExit: User says something vague like \"it depends\" twice without concrete example"
      },
      6: {
        trait: "Conscientiousness",
        question: "How do you keep track of your commitments and responsibilities?",
        guidance: "Extract: System type (digital/analog/memory-based), consistency of use, what happens when system fails\nProbe: If answer is generic (\"I just remember\"), ask about a time they forgot something; if they use tools, ask how strictly they follow them\nMaintain: Interested in their practical system, not testing them\nAvoid: Don't suggest better systems or imply judgment about disorganization",
        criteria: "Primary: Clear organizational pattern (system type + reliability + one example of it working/failing)\nFollow-up: If only describes ideal system, probe for reality check\nExit: User repeatedly gives only aspirational answers (\"I should use...\") without describing reality"
      },
      7: {
        trait: "Conscientiousness",
        question: "Walk me through how you prepared for something important recently—maybe an exam, presentation, or event.",
        guidance: "Extract: Preparation timeline (advance/last-minute), detail level (thorough/bare minimum), stress during prep\nProbe: If answer is vague, ask about specific steps they took; if last-minute, explore if that's typical\nMaintain: Interested in their process, not judging efficiency\nAvoid: Don't suggest they \"should\" prepare differently",
        criteria: "Primary: Preparation timeline + thoroughness + typical or exceptional\nFollow-up: If only describes outcome, ask about preparation process\nExit: User only gives aspirational \"should have\" answers"
      },
      8: {
        trait: "Conscientiousness",
        question: "How do you decide what to work on when you have multiple things competing for your attention?",
        guidance: "Extract: Prioritization method (deadline/importance/interest-based), decision confidence, task-switching pattern\nProbe: If answer is theoretical, ask about today or this week specifically; if they say \"whatever's urgent\", explore further\nMaintain: Curious about their decision-making\nAvoid: Don't suggest productivity methods or imply their way is wrong",
        criteria: "Primary: Prioritization approach + specific example + how well it works for them\nFollow-up: If abstract, ask about actual situation from past week\nExit: User expresses overwhelm about current task load"
      },
      // Extraversion (9-12)
      9: {
        trait: "Extraversion",
        question: "What does your ideal evening look like?",
        guidance: "Extract: Social vs. solitary preference, energy level (active/passive), group size if social (intimate/large)\nProbe: If mentions people, ask about how many and what type of interaction; if mentions alone time, probe what they do\nMaintain: Friendly curiosity about their preferences\nAvoid: Don't imply either social or solitary is \"better\"",
        criteria: "Primary: Clear evening preference pattern (social/solitary + activity type + energy level)\nFollow-up: If answer is ambiguous (\"depends\"), ask about most common scenario\nExit: User keeps saying \"it depends\" without giving typical pattern"
      },
      10: {
        trait: "Extraversion",
        question: "After a long, exhausting day, would you rather spend time alone or call a friend? Why?",
        guidance: "Extract: Recharging method (solitary/social), consistency of pattern, what happens if preferred option unavailable\nProbe: If they give middle-ground answer, ask which they naturally lean toward; if very certain, ask if ever changes\nMaintain: Neutral on introversion/extraversion—both are valid\nAvoid: Don't probe extensively about \"what if opposite happens\"—keep focused on their preference",
        criteria: "Primary: Clear recharge preference (alone/social + why + strength of preference)\nFollow-up: If only theoretical, ask about what they actually did after a recent exhausting day\nExit: User demonstrates frustration with either/or framing"
      },
      11: {
        trait: "Extraversion",
        question: "When you meet new people at a social event, what's your typical approach?",
        guidance: "Extract: Initiation style (approach others/wait to be approached), energy during interaction, group vs. individual preference\nProbe: If answer is contextual (\"depends on event\"), ask about most recent social event; if they mention anxiety, note but don't probe deeply\nMaintain: Neutral on different social styles\nAvoid: Don't frame outgoing behavior as \"better\"",
        criteria: "Primary: Social initiation pattern + comfort level + typical behavior at last event\nFollow-up: If theoretical, ask about specific recent social situation\nExit: User expresses social anxiety discomfort"
      },
      12: {
        trait: "Extraversion",
        question: "How do you feel about being the center of attention?",
        guidance: "Extract: Comfort level with visibility, performance vs. interaction preference, group size where comfortable\nProbe: If answer is ambiguous, ask about specific situation like giving presentation or birthday celebration; if negative, explore why\nMaintain: Accepting of both attention-seeking and attention-avoiding\nAvoid: Don't probe about trauma related to attention",
        criteria: "Primary: Comfort level (enjoy/tolerate/avoid) + specific context example + reasoning\nFollow-up: If only surface answer, ask about recent situation involving attention\nExit: User mentions trauma or significant distress"
      },
      // Neuroticism (13-16)
      13: {
        trait: "Neuroticism",
        question: "What's something that has annoyed or stressed you out in the past few days?",
        guidance: "Extract: Stressor type (major/minor), emotional intensity, duration of upset, recovery strategy\nProbe: If they minimize (\"nothing really\"), ask about small annoyances; if major stressor, explore how they handled it\nMaintain: Empathetic but neutral—don't amplify or dismiss their stress\nAvoid: Don't turn into therapy session; keep focus on their response pattern",
        criteria: "Primary: Specific stressor + emotional response intensity + how they dealt with it\nFollow-up: If answer lacks emotional data, probe one follow-up about how they felt\nExit: User becomes distressed discussing the stressor"
      },
      14: {
        trait: "Neuroticism",
        question: "Tell me about a recent mistake you made. How did you handle it?",
        guidance: "Extract: Mistake severity (their perception), emotional response (shame/guilt/resilience), rumination duration, self-talk pattern\nProbe: If they minimize (\"can't think of one\"), suggest everyday mistakes; if they mention harsh self-talk, explore briefly\nMaintain: Compassionate, non-judgmental tone\nAvoid: Don't validate negative self-talk or suggest they \"shouldn't feel bad\"",
        criteria: "Primary: Specific mistake + emotional intensity + how long it bothered them + recovery approach\nFollow-up: If answer is vague about feelings, ask one question about emotional response\nExit: User shows signs of significant shame or distress"
      },
      15: {
        trait: "Neuroticism",
        question: "When you're facing something uncertain or unpredictable, how do you usually feel?",
        guidance: "Extract: Tolerance for uncertainty, anxiety vs. excitement, need for control, rumination patterns\nProbe: If answer is generic, ask about specific recent uncertain situation; if high anxiety, note but don't amplify\nMaintain: Normalizing different responses to uncertainty\nAvoid: Don't suggest they \"should\" be more comfortable with uncertainty",
        criteria: "Primary: Typical emotional response + specific example + coping strategy if anxious\nFollow-up: If theoretical, ask about recent unpredictable situation\nExit: User describes overwhelming anxiety symptoms"
      },
      16: {
        trait: "Neuroticism",
        question: "How do you typically feel at the end of a busy day?",
        guidance: "Extract: Energy depletion pattern, emotional state (satisfied/drained/irritable), worry vs. peace, sleep impact\nProbe: If answer is surface (\"tired\"), explore emotional dimension; if mentions trouble unwinding, probe briefly\nMaintain: Empathetic about modern stress levels\nAvoid: Don't turn into sleep hygiene discussion",
        criteria: "Primary: End-of-day emotional pattern + physical state + ability to transition to rest\nFollow-up: If only physical description, ask about emotional state\nExit: User mentions concerning sleep or mental health issues"
      },
      // Openness (17-20)
      17: {
        trait: "Openness",
        question: "What kind of conversations do you find most engaging?",
        guidance: "Extract: Abstract vs. concrete preference, intellectual curiosity level, comfort with ambiguity, topic breadth\nProbe: If answer is generic (\"interesting ones\"), ask for specific examples; if mentions specific topics, explore why those appeal\nMaintain: Curious about their intellectual interests\nAvoid: Don't imply philosophical conversations are \"smarter\"",
        criteria: "Primary: Clear preference (abstract/concrete/both) + specific examples + reasoning\nFollow-up: If answer lacks examples, ask about recent conversation they enjoyed\nExit: User gives only socially desirable answers (\"I like all conversations\")"
      },
      18: {
        trait: "Openness",
        question: "Where would you like to travel to? Why that place?",
        guidance: "Extract: Novelty-seeking (exotic/familiar), trip style (structured/spontaneous), adventure vs. relaxation preference\nProbe: If they give generic answer (\"somewhere warm\"), ask what specifically draws them; if say \"don't like travel\", explore why\nMaintain: Interested in their travel philosophy\nAvoid: Don't probe extensively about logistics—focus on motivation and preferences",
        criteria: "Primary: Destination + what draws them (novelty/culture/adventure/relaxation) + trip style\nFollow-up: If answer is surface-level, ask one question about what they'd do there\nExit: User indicates financial stress about travel"
      },
      19: {
        trait: "Openness",
        question: "Tell me about something new you tried recently. What drew you to it?",
        guidance: "Extract: Novelty-seeking frequency, comfort with unfamiliar, motivation (curiosity/external push), follow-through\nProbe: If can't think of anything, suggest everyday newness (food/route/activity); if mentions something, explore what made them try it\nMaintain: Enthusiastic about trying new things without pressuring\nAvoid: Don't imply trying new things is \"better\" than consistency",
        criteria: "Primary: Specific new thing + motivation + experience + whether continuing\nFollow-up: If can't recall anything recent, verify if that's typical pattern\nExit: User becomes defensive about routine/comfort zones"
      },
      20: {
        trait: "Openness",
        question: "When you encounter an idea that challenges your current views, how do you usually react?",
        guidance: "Extract: Intellectual flexibility, curiosity vs. defensiveness, comfort with cognitive dissonance, reflection depth\nProbe: If answer is theoretical (\"I'm open-minded\"), ask about specific recent example; if defensive, explore gently\nMaintain: Non-judgmental about different epistemic styles\nAvoid: Don't create feeling that they need to prove open-mindedness",
        criteria: "Primary: Initial reaction (curious/defensive/mixed) + specific example + whether view changed\nFollow-up: If only describes ideal response, ask about actual recent challenge to beliefs\nExit: User mentions political/religious sensitivity that makes them uncomfortable"
      }
    };

    const questionData = questions[sessionNumber];
    if (!questionData) {
      throw new Error(`Invalid session number: ${sessionNumber}`);
    }

    // Build structured system prompt
    const systemPrompt = `You are having a genuine, curious conversation with someone. Your goal is to understand how they think and behave regarding ${questionData.trait} through natural, flowing dialogue.

## YOUR OPENING QUESTION
"${questionData.question}"

## WHAT YOU'RE CURIOUS ABOUT
${questionData.guidance}

## HOW TO HAVE THIS CONVERSATION

Think of this as a real conversation with a friend over coffee. The key is to **stay on ONE thread** and know when you have your answer:

### Step 1: Ask and Listen
- Ask your opening question
- Really listen to what they share
- Recognize if they've already given you what you need

### Step 2: Go Deeper (Only If Needed)
If their answer was vague or surface-level, ask ONE follow-up that explores the same story/example deeper:
- "What was that like for you?" (exploring feeling)
- "Tell me more about that situation" (getting details)
- "How did you feel about that?" (understanding reaction)

### Step 3: Know When to Stop
**CRITICAL - Avoid repetitive questioning:**
- If they've given you a concrete example with details → STOP, you have enough
- If they've already explained their reasoning or feelings → DON'T ask again in different words
- If they've shared a specific story → DON'T ask for another example
- If you find yourself wanting to ask essentially the same question → It's time to wrap up

**Red flags that you're being repetitive:**
- "Can you elaborate more on..." (when they already elaborated)
- "What about when..." (introducing a new scenario they didn't mention)
- "How do you typically..." (when they already described their typical pattern)
- Any question that feels like rephrasing what you just asked

**Example of good stopping:**
User: "I helped my friend move last weekend. It was exhausting but I felt good about it, like I was really there for them when they needed me."
✅ Good: Wrap up now—they've given you behavior, feeling, and reasoning
❌ Bad: "And how do you usually feel when people ask for your help?" (repetitive)

${questionData.criteria}

## TIMING
Brief—about 2-2.5 minutes total. Opening question, then at most ONE follow-up. If they give you a solid answer right away, wrap it up.

    ## WRAPPING UP
    When you have a clear understanding (usually after 1-2 user responses), thank them naturally and add [CONVERSATION_COMPLETE].

    CRITICAL: Only include [CONVERSATION_COMPLETE] when you're wrapping up WITHOUT asking another question.
    - Do NOT ask any question in the same message where you include [CONVERSATION_COMPLETE]
    - Avoid using the character "?" anywhere in that final response
    - If user has already responded, follow the guidance to probe deeper only if you truly need clarification
    - Don't explain the assessment or mention Big Five traits
    - Stay focused on the current question topic
    - Exit gracefully if user shows discomfort per exit criteria

    Begin the conversation now.`;

    // Call Anthropic Messages API
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errorText);
      throw new Error(`Anthropic API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = getAnthropicText(aiData);

    // Check if conversation should end
    const hasCompletionTag = assistantMessage.includes("[CONVERSATION_COMPLETE]");
    const cleanMessage = assistantMessage.replace("[CONVERSATION_COMPLETE]", "").trim();
    const containsQuestionMark = cleanMessage.includes("?");
    const shouldEnd = hasCompletionTag && !containsQuestionMark;

    return new Response(
      JSON.stringify({
        response: cleanMessage,
        shouldEnd,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in chat-conversation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
