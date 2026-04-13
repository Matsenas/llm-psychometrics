-- Drop the partial index and create a proper unique constraint for personality_scores
DROP INDEX IF EXISTS public.personality_scores_participant_method_unique;

-- Create a proper unique constraint (not a partial index)
ALTER TABLE public.personality_scores 
ADD CONSTRAINT personality_scores_participant_method_unique 
UNIQUE (participant_id, method);