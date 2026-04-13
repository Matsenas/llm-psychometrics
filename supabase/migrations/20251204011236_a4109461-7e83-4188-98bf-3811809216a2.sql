-- Add unique constraint on participant_id for survey_results to enable upsert
ALTER TABLE public.survey_results 
ADD CONSTRAINT survey_results_participant_id_key UNIQUE (participant_id);