-- Add DELETE policy for admins on participants table
CREATE POLICY "Admins can delete participants"
ON public.participants
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));