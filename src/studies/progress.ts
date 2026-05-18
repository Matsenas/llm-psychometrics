import { supabase } from "@/integrations/supabase/client";
import {
  RELATIONSHIP_USABILITY_REQUIRED_ITEMS,
  countRelationshipUsabilityRequiredResponses,
} from "@/lib/usabilityInstruments";
import type { ActiveStudy } from "@/studies/registry";
import { isBigFiveStudy, isRelationshipPatternsStudy } from "@/studies/registry";

const BIG5_SESSION_COUNT = 20;
const BIG5_ITEM_COUNT = 50;
export { RELATIONSHIP_USABILITY_REQUIRED_ITEMS };

export interface ProgressParticipant {
  id: string;
}

export async function getNextRouteForParticipant(
  participant: ProgressParticipant,
  activeStudy: ActiveStudy | null,
): Promise<string> {
  if (!activeStudy) return "/no-study";

  const consentComplete = await hasConsent(participant.id);
  if (!consentComplete) return "/consent";

  if (isRelationshipPatternsStudy(activeStudy.slug)) {
    return getRelationshipNextRoute(participant.id);
  }

  if (isBigFiveStudy(activeStudy.slug)) {
    return getBigFiveNextRoute(participant.id);
  }

  return "/start";
}

async function hasConsent(participantId: string): Promise<boolean> {
  const { data } = await supabase
    .from("consent_responses")
    .select("id")
    .eq("participant_id", participantId)
    .eq("consented", true)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function getRelationshipNextRoute(participantId: string): Promise<string> {
  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, is_complete")
    .eq("participant_id", participantId)
    .eq("session_number", 1);

  const firstSession = sessions?.[0];
  if (!firstSession) return "/start";
  if (!firstSession.is_complete) return "/chat";

  const { data: summary } = await supabase
    .from("attachment_classification_summaries")
    .select("id")
    .eq("participant_id", participantId)
    .eq("chat_session_id", firstSession.id)
    .maybeSingle();

  if (!summary) return "/transition";

  const { data: usability } = await supabase
    .from("usability_responses")
    .select("item_key, response_value")
    .eq("participant_id", participantId);

  if (countRelationshipUsabilityRequiredResponses(usability ?? []) < RELATIONSHIP_USABILITY_REQUIRED_ITEMS) {
    return "/attachment-profile";
  }

  return "/results";
}

async function getBigFiveNextRoute(participantId: string): Promise<string> {
  const completedSessions = await completedChatCount(participantId);
  if (completedSessions < BIG5_SESSION_COUNT) return "/chat";

  const { data: ipipResponses } = await supabase
    .from("ipip_responses")
    .select("id")
    .eq("participant_id", participantId);

  const ipipCount = ipipResponses?.length ?? 0;
  if (ipipCount === 0) return "/transition";
  if (ipipCount < BIG5_ITEM_COUNT) return "/questionnaire";

  const { data: result } = await supabase
    .from("survey_results")
    .select("submitted")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!result?.submitted) return "/accuracy";
  return "/results";
}

async function completedChatCount(participantId: string): Promise<number> {
  const { data } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("participant_id", participantId)
    .eq("is_complete", true);

  return data?.length ?? 0;
}
