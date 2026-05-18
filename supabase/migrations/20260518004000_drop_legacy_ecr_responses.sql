-- The ECR self-report comparison flow has been removed.
-- Attachment classification for the NLP project uses attachment_scores and
-- attachment_classification_* tables, so only the legacy response table is dropped.

DROP TABLE IF EXISTS public.ecr_responses;
