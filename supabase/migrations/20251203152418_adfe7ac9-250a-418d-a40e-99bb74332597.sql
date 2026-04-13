-- Add RLS policy for participants to manage chat messages through their sessions
CREATE POLICY "Participants can manage own chat messages" 
ON public.chat_messages 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions 
    WHERE chat_sessions.id = chat_messages.session_id 
    AND chat_sessions.participant_id IS NOT NULL
  )
);