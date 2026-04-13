-- Add trait-by-trait accuracy rating columns to survey_results
ALTER TABLE public.survey_results
ADD COLUMN openness_chat_accuracy integer,
ADD COLUMN openness_ipip_accuracy integer,
ADD COLUMN conscientiousness_chat_accuracy integer,
ADD COLUMN conscientiousness_ipip_accuracy integer,
ADD COLUMN extraversion_chat_accuracy integer,
ADD COLUMN extraversion_ipip_accuracy integer,
ADD COLUMN agreeableness_chat_accuracy integer,
ADD COLUMN agreeableness_ipip_accuracy integer,
ADD COLUMN neuroticism_chat_accuracy integer,
ADD COLUMN neuroticism_ipip_accuracy integer,
ADD COLUMN overall_method_preference integer;

-- Add check constraints for valid rating values (1-5)
ALTER TABLE public.survey_results
ADD CONSTRAINT chk_openness_chat_accuracy CHECK (openness_chat_accuracy IS NULL OR (openness_chat_accuracy >= 1 AND openness_chat_accuracy <= 5)),
ADD CONSTRAINT chk_openness_ipip_accuracy CHECK (openness_ipip_accuracy IS NULL OR (openness_ipip_accuracy >= 1 AND openness_ipip_accuracy <= 5)),
ADD CONSTRAINT chk_conscientiousness_chat_accuracy CHECK (conscientiousness_chat_accuracy IS NULL OR (conscientiousness_chat_accuracy >= 1 AND conscientiousness_chat_accuracy <= 5)),
ADD CONSTRAINT chk_conscientiousness_ipip_accuracy CHECK (conscientiousness_ipip_accuracy IS NULL OR (conscientiousness_ipip_accuracy >= 1 AND conscientiousness_ipip_accuracy <= 5)),
ADD CONSTRAINT chk_extraversion_chat_accuracy CHECK (extraversion_chat_accuracy IS NULL OR (extraversion_chat_accuracy >= 1 AND extraversion_chat_accuracy <= 5)),
ADD CONSTRAINT chk_extraversion_ipip_accuracy CHECK (extraversion_ipip_accuracy IS NULL OR (extraversion_ipip_accuracy >= 1 AND extraversion_ipip_accuracy <= 5)),
ADD CONSTRAINT chk_agreeableness_chat_accuracy CHECK (agreeableness_chat_accuracy IS NULL OR (agreeableness_chat_accuracy >= 1 AND agreeableness_chat_accuracy <= 5)),
ADD CONSTRAINT chk_agreeableness_ipip_accuracy CHECK (agreeableness_ipip_accuracy IS NULL OR (agreeableness_ipip_accuracy >= 1 AND agreeableness_ipip_accuracy <= 5)),
ADD CONSTRAINT chk_neuroticism_chat_accuracy CHECK (neuroticism_chat_accuracy IS NULL OR (neuroticism_chat_accuracy >= 1 AND neuroticism_chat_accuracy <= 5)),
ADD CONSTRAINT chk_neuroticism_ipip_accuracy CHECK (neuroticism_ipip_accuracy IS NULL OR (neuroticism_ipip_accuracy >= 1 AND neuroticism_ipip_accuracy <= 5)),
ADD CONSTRAINT chk_overall_method_preference CHECK (overall_method_preference IS NULL OR (overall_method_preference >= 1 AND overall_method_preference <= 5));