-- Drop the existing update policy
DROP POLICY IF EXISTS "Users can update own participant" ON public.participants;

-- Create new policy that allows:
-- 1. Users to update their own participant (user_id = auth.uid())
-- 2. First-time linking when user_id is NULL
CREATE POLICY "Users can update own participant or link first time"
ON public.participants
FOR UPDATE
USING (
  user_id = auth.uid() OR user_id IS NULL
)
WITH CHECK (
  user_id = auth.uid()
);