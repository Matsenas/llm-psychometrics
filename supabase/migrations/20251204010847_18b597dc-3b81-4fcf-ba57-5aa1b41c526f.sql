-- Add admin policies for managing survey_results
CREATE POLICY "Admins can manage all survey results" 
ON public.survey_results 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));