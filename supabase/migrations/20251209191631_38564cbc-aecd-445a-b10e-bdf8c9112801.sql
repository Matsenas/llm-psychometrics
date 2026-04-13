-- Add disabled column to participants table for access control
ALTER TABLE public.participants 
ADD COLUMN disabled boolean NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.participants.disabled IS 'When true, participant cannot access the survey environment';