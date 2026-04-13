-- Drop the incomplete policy
DROP POLICY IF EXISTS "Participants can manage own chat messages" ON public.chat_messages;

-- Create proper policy with both USING (for SELECT/UPDATE/DELETE) and WITH CHECK (for INSERT)
CREATE POLICY "Participants can manage own chat messages" 
ON public.chat_messages 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE chat_sessions.id = chat_messages.session_id 
    AND chat_sessions.participant_id IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE chat_sessions.id = chat_messages.session_id 
    AND chat_sessions.participant_id IS NOT NULL
  )
);