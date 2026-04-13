-- Drop existing constraint first
ALTER TABLE public.personality_scores 
DROP CONSTRAINT IF EXISTS personality_scores_method_check;

-- Update existing data
UPDATE public.personality_scores 
SET method = 'llm' 
WHERE method = 'unified';

-- Add new constraint
ALTER TABLE public.personality_scores 
ADD CONSTRAINT personality_scores_method_check 
CHECK (method IN ('llm', 'ipip'));

-- Add unique constraint for participant_id + method
ALTER TABLE public.personality_scores
DROP CONSTRAINT IF EXISTS personality_scores_participant_method_unique;

ALTER TABLE public.personality_scores
ADD CONSTRAINT personality_scores_participant_method_unique 
UNIQUE (participant_id, method);