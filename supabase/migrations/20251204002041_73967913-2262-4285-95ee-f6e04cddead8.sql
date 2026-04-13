-- Drop redundant score columns from survey_results (now stored in personality_scores)
ALTER TABLE public.survey_results
DROP COLUMN IF EXISTS openness_chat,
DROP COLUMN IF EXISTS conscientiousness_chat,
DROP COLUMN IF EXISTS extraversion_chat,
DROP COLUMN IF EXISTS agreeableness_chat,
DROP COLUMN IF EXISTS neuroticism_chat,
DROP COLUMN IF EXISTS openness_ipip,
DROP COLUMN IF EXISTS conscientiousness_ipip,
DROP COLUMN IF EXISTS extraversion_ipip,
DROP COLUMN IF EXISTS agreeableness_ipip,
DROP COLUMN IF EXISTS neuroticism_ipip;