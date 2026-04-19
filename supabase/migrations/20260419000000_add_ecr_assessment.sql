-- ECR-R attachment assessment: per-participant switch, new tables, loosened CHECKs.
-- See docs/plans/2026-04-19-feat-ecr-attachment-assessment-plan.md for the full spec.

BEGIN;

-- 1. participants.assessment_type: nullable -> backfill -> NOT NULL + DEFAULT.
-- Three-step add so we never leave an existing participant silently defaulted to 'ecr'
-- (e.g. mid-consent participants with no chat_sessions or ipip_responses yet).
ALTER TABLE public.participants
  ADD COLUMN assessment_type TEXT
  CHECK (assessment_type IN ('big5', 'ecr'));

UPDATE public.participants SET assessment_type = 'big5';

ALTER TABLE public.participants
  ALTER COLUMN assessment_type SET NOT NULL,
  ALTER COLUMN assessment_type SET DEFAULT 'ecr';

-- 2. Relax chat_sessions.session_number CHECK so ECR (single session) can reuse
-- session_number=1 without bumping into the old 1..20 upper bound. Big Five continues
-- to use 1..20 by convention (the frontend guards this).
ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_session_number_check;

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_session_number_check
  CHECK (session_number >= 1);

-- 3. ECR-R self-report responses (parallel to ipip_responses).
-- No `subscale` or `is_reverse_keyed` columns: those are pure functions of item_number,
-- kept in one place (src/lib/ecrItems.ts) to avoid drift.
CREATE TABLE public.ecr_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  item_number INT NOT NULL CHECK (item_number BETWEEN 1 AND 36),
  response_value INT NOT NULL CHECK (response_value BETWEEN 1 AND 7),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, item_number)
);

ALTER TABLE public.ecr_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants manage own ECR responses"
  ON public.ecr_responses
  FOR ALL
  USING (participant_id = public.get_participant_id_for_user())
  WITH CHECK (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Admins view ECR responses"
  ON public.ecr_responses
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete ECR responses"
  ON public.ecr_responses
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Attachment scores (parallel to personality_scores).
-- `anxiety` / `avoidance` promoted to real NUMERIC columns for trivial queries.
-- `llm_metadata` JSONB holds confidence/evidence/reasoning for the LLM method only.
-- No `attachment_style` column: classification is derived in TS from the two scores.
CREATE TABLE public.attachment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('llm', 'self')),
  anxiety NUMERIC(3, 2) NOT NULL CHECK (anxiety BETWEEN 1 AND 7),
  avoidance NUMERIC(3, 2) NOT NULL CHECK (avoidance BETWEEN 1 AND 7),
  llm_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, method)
);

ALTER TABLE public.attachment_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view own attachment scores"
  ON public.attachment_scores
  FOR SELECT
  USING (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Participants insert own attachment scores"
  ON public.attachment_scores
  FOR INSERT
  WITH CHECK (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Participants update own attachment scores"
  ON public.attachment_scores
  FOR UPDATE
  USING (participant_id = public.get_participant_id_for_user())
  WITH CHECK (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Admins view attachment scores"
  ON public.attachment_scores
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete attachment scores"
  ON public.attachment_scores
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Accuracy rating columns for ECR (2 dimensions x 2 methods).
-- Existing Big Five columns on survey_results are untouched.
ALTER TABLE public.survey_results
  ADD COLUMN anxiety_chat_accuracy INT CHECK (anxiety_chat_accuracy BETWEEN 1 AND 5),
  ADD COLUMN anxiety_self_accuracy INT CHECK (anxiety_self_accuracy BETWEEN 1 AND 5),
  ADD COLUMN avoidance_chat_accuracy INT CHECK (avoidance_chat_accuracy BETWEEN 1 AND 5),
  ADD COLUMN avoidance_self_accuracy INT CHECK (avoidance_self_accuracy BETWEEN 1 AND 5);

COMMIT;
