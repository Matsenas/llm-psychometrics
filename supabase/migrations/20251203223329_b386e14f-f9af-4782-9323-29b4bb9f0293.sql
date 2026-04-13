-- Drop the partial index and create a proper unique constraint
DROP INDEX IF EXISTS public.ipip_responses_participant_item_unique;

-- Create a proper unique constraint (not a partial index)
ALTER TABLE public.ipip_responses 
ADD CONSTRAINT ipip_responses_participant_item_unique 
UNIQUE (participant_id, item_number);