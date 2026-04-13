-- Add admin DELETE policies for tables missing them

-- chat_sessions: admins can delete
CREATE POLICY "Admins can delete chat sessions"
ON public.chat_sessions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- chat_messages: admins can delete  
CREATE POLICY "Admins can delete chat messages"
ON public.chat_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ipip_responses: admins can delete
CREATE POLICY "Admins can delete ipip responses"
ON public.ipip_responses
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- personality_scores: admins can delete
CREATE POLICY "Admins can delete personality scores"
ON public.personality_scores
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));