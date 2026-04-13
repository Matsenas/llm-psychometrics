-- Add unique constraints for participant_id upserts
CREATE UNIQUE INDEX IF NOT EXISTS ipip_responses_participant_item_unique 
ON public.ipip_responses (participant_id, item_number) 
WHERE participant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS survey_results_participant_unique 
ON public.survey_results (participant_id) 
WHERE participant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS personality_scores_participant_method_unique 
ON public.personality_scores (participant_id, method) 
WHERE participant_id IS NOT NULL;