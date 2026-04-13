import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper to decode JWT and extract user_id
function getUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch (e) {
    console.error("JWT decode error:", e);
    return null;
  }
}

const SYSTEM_PROMPT = `You are a psychological assessment expert specializing in Big Five personality profiling. Your task is to analyze conversation transcripts and generate accurate Big Five personality scores based on the IPIP (International Personality Item Pool) framework.

## INPUT
You will receive a combined text containing 20 conversation transcripts from a single user. These conversations cover various topics designed to reveal personality traits across the Big Five dimensions.

## YOUR TASK
Analyze the entire conversation text and assign scores for each of the Big Five personality traits on a scale of 0-120, where:
- 0-40 = Low (trait is weakly expressed)
- 41-80 = Moderate (trait is moderately expressed)
- 81-120 = High (trait is strongly expressed)

## BIG FIVE TRAITS AND FACETS TO ASSESS

### 1. OPENNESS TO EXPERIENCE (0-120)
Assess intellectual curiosity, aesthetic appreciation, imagination, and willingness to try new experiences.

**Key Facets:**
- Imagination: Fantasy-prone, daydreaming, creative thinking
- Artistic Interests: Appreciation for art, music, poetry
- Emotionality: Depth of emotional experience
- Adventurousness: Willingness to try new activities, travel preferences
- Intellect: Engagement with abstract ideas, philosophical discussions
- Liberalism: Readiness to challenge authority and convention

**Look for:** Travel preferences (novelty vs. familiarity), intellectual curiosity, engagement with abstract ideas, passion for hobbies, cultural interests, philosophical inclinations.

### 2. CONSCIENTIOUSNESS (0-120)
Assess organization, dependability, work ethic, and goal-directed behavior.

**Key Facets:**
- Self-Efficacy: Belief in one's ability to accomplish tasks
- Orderliness: Preference for organization and structure
- Dutifulness: Sense of obligation and responsibility
- Achievement-Striving: Ambition and goal-setting
- Self-Discipline: Ability to follow through on tasks
- Cautiousness: Deliberation before acting

**Look for:** Task completion patterns, organizational systems, living space maintenance, planning behaviors, follow-through on commitments, morning routines, project completion rates.

### 3. EXTRAVERSION (0-120)
Assess sociability, assertiveness, energy level, and preference for social interaction.

**Key Facets:**
- Friendliness: Warmth and approachability with others
- Gregariousness: Preference for company vs. solitude
- Assertiveness: Social dominance and leadership
- Activity Level: Pace and energy of activities
- Excitement-Seeking: Need for stimulation
- Cheerfulness: Tendency toward positive emotions

**Look for:** Ideal evening activities, social recharging preferences, comfort with strangers, group dynamics, social event preferences, energy sources, weekend activities.

### 4. AGREEABLENESS (0-120)
Assess compassion, cooperation, trust, and concern for others.

**Key Facets:**
- Trust: Belief in others' good intentions
- Morality: Straightforwardness and sincerity
- Altruism: Concern for others' welfare
- Cooperation: Preference for harmony vs. competition
- Modesty: Humility vs. self-promotion
- Sympathy: Compassion and empathy

**Look for:** Relationship values, conflict handling style, helpfulness when asked for favors, trust orientation, friendship qualities valued, responses to criticism, affection expression.

### 5. NEUROTICISM (0-120)
Assess emotional stability, anxiety, stress reactivity, and vulnerability.

**Key Facets:**
- Anxiety: Tendency to worry and feel tense
- Anger: Tendency to experience frustration
- Depression: Tendency toward sadness and discouragement
- Self-Consciousness: Sensitivity to social evaluation
- Immoderation: Difficulty resisting urges
- Vulnerability: Susceptibility to stress

**Look for:** Recent stressors and reactions, adaptability to plan changes, self-criticism after mistakes, anticipatory anxiety, test/exam stress, compliments that stuck, self-improvement efforts, current life priorities.

## SCORING GUIDELINES

1. **Read the entire conversation text carefully** before assigning scores
2. **Look for patterns** across multiple conversations rather than isolated statements
3. **Consider intensity and consistency** of trait expressions
4. **Use specific behavioral examples** as evidence (not just self-descriptions)
5. **Account for context** - some behaviors may be situational rather than trait-based
6. **Be objective** - score what the person demonstrates, not stereotypes or assumptions
7. **Balance positive and negative indicators** - absence of high trait expression ≠ low score necessarily
8. **Weight behavioral evidence more heavily than self-descriptions**

## SCORING ANCHORS

**High Scores (81-120):**
- Strong, consistent evidence across multiple conversations
- Spontaneous mentions of trait-relevant behaviors
- Clear behavioral patterns aligned with trait
- Examples demonstrate trait even in challenging situations

**Moderate Scores (41-80):**
- Mixed evidence or moderate expression
- Some trait-relevant behaviors but not dominant
- Contextual variation in trait expression
- Balance of trait-consistent and trait-inconsistent behaviors

**Low Scores (0-40):**
- Minimal evidence of trait
- Counter-trait behaviors dominate
- Explicit statements or clear patterns opposing trait
- Consistent avoidance of trait-relevant situations

## OUTPUT FORMAT

Provide your assessment in the following JSON structure. DO NOT include markdown code blocks or any text outside the JSON:

{
  "openness": {
    "score": [0-120 integer],
    "confidence": "low" | "moderate" | "high",
    "key_evidence": ["Brief behavioral indicator 1", "Brief behavioral indicator 2", "Brief behavioral indicator 3"],
    "reasoning": "2-3 sentence explanation of score based on patterns observed"
  },
  "conscientiousness": {
    "score": [0-120 integer],
    "confidence": "low" | "moderate" | "high",
    "key_evidence": ["Brief behavioral indicator 1", "Brief behavioral indicator 2", "Brief behavioral indicator 3"],
    "reasoning": "2-3 sentence explanation of score based on patterns observed"
  },
  "extraversion": {
    "score": [0-120 integer],
    "confidence": "low" | "moderate" | "high",
    "key_evidence": ["Brief behavioral indicator 1", "Brief behavioral indicator 2", "Brief behavioral indicator 3"],
    "reasoning": "2-3 sentence explanation of score based on patterns observed"
  },
  "agreeableness": {
    "score": [0-120 integer],
    "confidence": "low" | "moderate" | "high",
    "key_evidence": ["Brief behavioral indicator 1", "Brief behavioral indicator 2", "Brief behavioral indicator 3"],
    "reasoning": "2-3 sentence explanation of score based on patterns observed"
  },
  "neuroticism": {
    "score": [0-120 integer],
    "confidence": "low" | "moderate" | "high",
    "key_evidence": ["Brief behavioral indicator 1", "Brief behavioral indicator 2", "Brief behavioral indicator 3"],
    "reasoning": "2-3 sentence explanation of score based on patterns observed"
  },
  "overall_assessment": "2-3 sentence summary of the person's overall personality profile and key characteristics"
}

## IMPORTANT NOTES

- **DO NOT** simply average responses - weight behavioral evidence more heavily than self-descriptions
- **DO NOT** be overly influenced by socially desirable responses
- **DO** consider that people may have limited self-awareness in some areas
- **DO** look for implicit indicators (what they show) vs explicit claims (what they say)
- **BE CONSISTENT** in your scoring approach across all five traits
- If information is insufficient for a particular trait, indicate "low" confidence and score conservatively toward the middle range (50-70)
- **CRITICAL**: Your response must be ONLY valid JSON with no additional text, markdown formatting, or code blocks

Now, please analyze the following conversation transcripts and provide Big Five personality scores:`

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { participantId, userId } = await req.json()
    const id = participantId || userId // Support both for backwards compatibility
    
    // Extract user_id from JWT
    const authHeader = req.headers.get('Authorization');
    const jwtUserId = getUserIdFromJwt(authHeader);
    
    if (!jwtUserId) {
      console.error("Missing or invalid authorization");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Missing or invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the participant belongs to the authenticated user
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("user_id")
      .eq("id", id)
      .single();

    if (participantError || !participant) {
      console.error("Participant not found:", participantError);
      return new Response(
        JSON.stringify({ success: false, error: "Participant not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (participant.user_id !== jwtUserId) {
      console.error("Authorization failed: user_id mismatch", { jwtUserId, participantUserId: participant.user_id });
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: You do not own this participant" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Authorization verified for participant", id);

    // Fetch all 20 completed chat sessions with messages
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        chat_messages (
          role,
          content,
          created_at
        )
      `)
      .eq('participant_id', id)
      .eq('is_complete', true)
      .order('session_number')

    if (sessionsError) throw sessionsError
    
    if (!sessions || sessions.length < 20) {
      throw new Error(`User has only completed ${sessions?.length || 0} conversations. Need all 20.`)
    }

    // Format conversations for the LLM
    const conversationText = sessions.map((session: any, idx: number) => {
      const messages = session.chat_messages
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')
      
      return `
=== CONVERSATION ${idx + 1} ===
Trait Being Assessed: ${session.big5_aspect}
Question: ${session.initial_question}

${messages}
`
    }).join('\n\n---\n\n')

    console.log(`Scoring conversations for participant ${id}`)

    // Call Lovable AI Gateway (same setup as chat-conversation)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: conversationText }
        ],
        temperature: 0.3,
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error("AI Gateway error:", aiResponse.status, errorText)
      throw new Error(`AI Gateway error: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    let responseText = aiData.choices[0].message.content

    console.log("Raw AI response:", responseText.substring(0, 200))

    // Clean any markdown formatting
    responseText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Parse and validate JSON
    let scores
    try {
      scores = JSON.parse(responseText)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      console.error("Response text:", responseText)
      throw new Error("Failed to parse AI response as JSON")
    }
    
    // Validate all required fields
    const requiredTraits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']
    for (const trait of requiredTraits) {
      if (!scores[trait]) {
        throw new Error(`Missing trait: ${trait}`)
      }
      if (typeof scores[trait].score !== 'number' || 
          scores[trait].score < 0 || scores[trait].score > 120) {
        throw new Error(`Invalid score for ${trait}: ${scores[trait].score}`)
      }
    }

    console.log("Scores validated successfully")

    // Save to database
    const { error: insertError } = await supabase
      .from('personality_scores')
      .upsert({
        participant_id: id,
        method: 'llm',
        openness: scores.openness,
        conscientiousness: scores.conscientiousness,
        extraversion: scores.extraversion,
        agreeableness: scores.agreeableness,
        neuroticism: scores.neuroticism,
        overall_assessment: scores.overall_assessment || ''
      }, { onConflict: 'participant_id,method' })

    if (insertError) throw insertError

    console.log("Scores saved to database")

    return new Response(JSON.stringify({ 
      success: true,
      scores: scores
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Scoring error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
