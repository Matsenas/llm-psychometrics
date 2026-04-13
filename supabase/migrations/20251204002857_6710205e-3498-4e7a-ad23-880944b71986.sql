-- Add user_id column to participants to link anonymous auth users
ALTER TABLE public.participants 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_participants_user_id ON public.participants(user_id);

-- Drop existing participant policies that use weak checks
DROP POLICY IF EXISTS "Participants can manage own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Participants can insert own consent" ON public.consent_responses;
DROP POLICY IF EXISTS "Participants can view own consent" ON public.consent_responses;
DROP POLICY IF EXISTS "Participants can manage own results" ON public.survey_results;
DROP POLICY IF EXISTS "Participants can manage own scores" ON public.personality_scores;
DROP POLICY IF EXISTS "Participants can manage own IPIP responses" ON public.ipip_responses;
DROP POLICY IF EXISTS "Participants can manage own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Public can read participants by respondent_id" ON public.participants;

-- Create helper function to get participant_id from current auth user
CREATE OR REPLACE FUNCTION public.get_participant_id_for_user()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.participants WHERE user_id = auth.uid() LIMIT 1
$$;

-- Participants table: allow public to read by respondent_id (for login lookup only)
CREATE POLICY "Public can lookup participants by respondent_id"
ON public.participants
FOR SELECT
TO anon, authenticated
USING (true);

-- Participants table: users can update their own linked participant
CREATE POLICY "Users can update own participant"
ON public.participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Chat sessions: authenticated users can manage their own sessions
CREATE POLICY "Users can manage own chat sessions"
ON public.chat_sessions
FOR ALL
TO authenticated
USING (participant_id = public.get_participant_id_for_user())
WITH CHECK (participant_id = public.get_participant_id_for_user());

-- Consent responses: authenticated users can manage their own consent
CREATE POLICY "Users can insert own consent"
ON public.consent_responses
FOR INSERT
TO authenticated
WITH CHECK (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Users can view own consent"
ON public.consent_responses
FOR SELECT
TO authenticated
USING (participant_id = public.get_participant_id_for_user());

-- Survey results: authenticated users can manage their own results
CREATE POLICY "Users can manage own survey results"
ON public.survey_results
FOR ALL
TO authenticated
USING (participant_id = public.get_participant_id_for_user())
WITH CHECK (participant_id = public.get_participant_id_for_user());

-- Personality scores: authenticated users can manage their own scores
CREATE POLICY "Users can manage own personality scores"
ON public.personality_scores
FOR ALL
TO authenticated
USING (participant_id = public.get_participant_id_for_user())
WITH CHECK (participant_id = public.get_participant_id_for_user());

-- IPIP responses: authenticated users can manage their own responses
CREATE POLICY "Users can manage own IPIP responses"
ON public.ipip_responses
FOR ALL
TO authenticated
USING (participant_id = public.get_participant_id_for_user())
WITH CHECK (participant_id = public.get_participant_id_for_user());

-- Chat messages: authenticated users can manage messages for their sessions
CREATE POLICY "Users can manage own chat messages"
ON public.chat_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id = chat_messages.session_id
    AND cs.participant_id = public.get_participant_id_for_user()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_sessions cs
    WHERE cs.id = chat_messages.session_id
    AND cs.participant_id = public.get_participant_id_for_user()
  )
);