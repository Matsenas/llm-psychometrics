-- Add DELETE policy for admins on consent_responses
CREATE POLICY "Admins can delete consents"
ON public.consent_responses
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));