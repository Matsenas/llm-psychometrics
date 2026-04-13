-- Create participants table
CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id text UNIQUE NOT NULL,
  name text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Admins can view all participants
CREATE POLICY "Admins can view all participants"
ON public.participants
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert participants
CREATE POLICY "Admins can insert participants"
ON public.participants
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public can read participants by respondent_id (for session validation)
CREATE POLICY "Public can read participants by respondent_id"
ON public.participants
FOR SELECT
USING (true);

-- Add participant_id to consent_responses
ALTER TABLE public.consent_responses
ADD COLUMN participant_id uuid REFERENCES public.participants(id),
ALTER COLUMN user_id DROP NOT NULL;

-- Add participant_id to chat_sessions
ALTER TABLE public.chat_sessions
ADD COLUMN participant_id uuid REFERENCES public.participants(id),
ALTER COLUMN user_id DROP NOT NULL;

-- Add participant_id to ipip_responses
ALTER TABLE public.ipip_responses
ADD COLUMN participant_id uuid REFERENCES public.participants(id),
ALTER COLUMN user_id DROP NOT NULL;

-- Add participant_id to survey_results
ALTER TABLE public.survey_results
ADD COLUMN participant_id uuid REFERENCES public.participants(id),
ALTER COLUMN user_id DROP NOT NULL;

-- Add participant_id to personality_scores
ALTER TABLE public.personality_scores
ADD COLUMN participant_id uuid REFERENCES public.participants(id),
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies for participant access (using anon key)
-- consent_responses
CREATE POLICY "Participants can insert own consent"
ON public.consent_responses
FOR INSERT
WITH CHECK (participant_id IS NOT NULL);

CREATE POLICY "Participants can view own consent"
ON public.consent_responses
FOR SELECT
USING (participant_id IS NOT NULL);

-- chat_sessions
CREATE POLICY "Participants can manage own chat sessions"
ON public.chat_sessions
FOR ALL
USING (participant_id IS NOT NULL);

-- ipip_responses
CREATE POLICY "Participants can manage own IPIP responses"
ON public.ipip_responses
FOR ALL
USING (participant_id IS NOT NULL);

-- survey_results
CREATE POLICY "Participants can manage own results"
ON public.survey_results
FOR ALL
USING (participant_id IS NOT NULL);

-- personality_scores
CREATE POLICY "Participants can manage own scores"
ON public.personality_scores
FOR ALL
USING (participant_id IS NOT NULL);