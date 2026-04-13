-- Add feedback column to survey_results table
ALTER TABLE public.survey_results 
ADD COLUMN feedback TEXT;