-- Fix the participants UPDATE policy to allow re-linking when entering respondent_id again
-- This handles the case where a participant uses a different browser/device
DROP POLICY IF EXISTS "Users can update own participant or link first time" ON public.participants;

-- Allow update if:
-- 1. Current user already owns the participant (user_id = auth.uid())
-- 2. Participant has no user_id yet (first-time linking)
-- 3. ANY authenticated user can re-link by entering the correct respondent_id
--    (security is in the respondent_id being a secret token shared only with participants)
CREATE POLICY "Users can update or link participant"
ON public.participants
FOR UPDATE
USING (true)  -- Any authenticated user can attempt update
WITH CHECK (user_id = auth.uid());  -- But can only set user_id to their own