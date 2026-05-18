-- Remove the legacy assessment track schema.
-- This app has no production participant data to preserve, so clean all
-- participant-scoped rows before dropping participants.assessment_type.

BEGIN;

TRUNCATE TABLE
  public.chat_messages,
  public.chat_sessions,
  public.consent_responses,
  public.ipip_responses,
  public.ecr_responses,
  public.personality_scores,
  public.attachment_scores,
  public.survey_results,
  public.usability_responses,
  public.attachment_classification_runs,
  public.attachment_classification_summaries,
  public.study_block_progress,
  public.participant_study_assignments,
  public.participants
RESTART IDENTITY CASCADE;

ALTER TABLE public.participants
  DROP COLUMN IF EXISTS assessment_type;

COMMIT;
