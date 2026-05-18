BEGIN;

-- Study configuration tables. Study versions are immutable once published;
-- changes should create a new version and be assigned only to future participants.
CREATE TABLE public.studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.study_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  version_number INT NOT NULL CHECK (version_number >= 1),
  config JSONB NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (study_id, version_number)
);

CREATE TABLE public.participant_study_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE RESTRICT,
  study_version_id UUID NOT NULL REFERENCES public.study_versions(id) ON DELETE RESTRICT,
  assigned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX participant_study_assignments_one_active
  ON public.participant_study_assignments(participant_id)
  WHERE status = 'active';

CREATE TABLE public.study_block_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.participant_study_assignments(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  block_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (assignment_id, block_id)
);

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS participants_email_unique
  ON public.participants (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE public.attachment_classification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  chat_session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  run_number INT NOT NULL CHECK (run_number >= 1),
  run_batch INT NOT NULL DEFAULT 1 CHECK (run_batch >= 1),
  model TEXT NOT NULL,
  temperature NUMERIC(4, 2),
  anxiety NUMERIC(3, 2) CHECK (anxiety BETWEEN 1 AND 7),
  avoidance NUMERIC(3, 2) CHECK (avoidance BETWEEN 1 AND 7),
  prototype TEXT CHECK (prototype IN ('secure', 'preoccupied', 'dismissive', 'fearful')),
  narrative TEXT,
  key_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_response JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, chat_session_id, run_batch, run_number)
);

CREATE TABLE public.attachment_classification_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  chat_session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  run_batch INT NOT NULL DEFAULT 1 CHECK (run_batch >= 1),
  mean_anxiety NUMERIC(4, 2) NOT NULL CHECK (mean_anxiety BETWEEN 1 AND 7),
  sd_anxiety NUMERIC(4, 2) NOT NULL DEFAULT 0,
  mean_avoidance NUMERIC(4, 2) NOT NULL CHECK (mean_avoidance BETWEEN 1 AND 7),
  sd_avoidance NUMERIC(4, 2) NOT NULL DEFAULT 0,
  modal_prototype TEXT NOT NULL CHECK (modal_prototype IN ('secure', 'preoccupied', 'dismissive', 'fearful')),
  displayed_narrative TEXT,
  completed_runs INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, chat_session_id, run_batch)
);

CREATE TABLE public.usability_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_text TEXT,
  response_value INT CHECK (response_value BETWEEN 1 AND 7),
  response_text TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, instrument, item_key)
);

CREATE INDEX study_versions_study_id_idx ON public.study_versions(study_id);
CREATE INDEX participant_study_assignments_participant_idx ON public.participant_study_assignments(participant_id);
CREATE INDEX study_block_progress_assignment_idx ON public.study_block_progress(assignment_id);
CREATE INDEX attachment_classification_runs_participant_idx ON public.attachment_classification_runs(participant_id);
CREATE INDEX attachment_classification_summaries_participant_idx ON public.attachment_classification_summaries(participant_id);
CREATE INDEX usability_responses_participant_idx ON public.usability_responses(participant_id);

ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_study_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_block_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_classification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_classification_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usability_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view active studies"
  ON public.studies
  FOR SELECT
  TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage studies"
  ON public.studies
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated users view published study versions"
  ON public.study_versions
  FOR SELECT
  TO authenticated
  USING (is_published OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage study versions"
  ON public.study_versions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Participants view own study assignments"
  ON public.participant_study_assignments
  FOR SELECT
  TO authenticated
  USING (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Admins manage study assignments"
  ON public.participant_study_assignments
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Participants manage own block progress"
  ON public.study_block_progress
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.participant_study_assignments psa
      WHERE psa.id = study_block_progress.assignment_id
        AND psa.participant_id = public.get_participant_id_for_user()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.participant_study_assignments psa
      WHERE psa.id = study_block_progress.assignment_id
        AND psa.participant_id = public.get_participant_id_for_user()
    )
  );

CREATE POLICY "Admins manage block progress"
  ON public.study_block_progress
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Participants view own classification runs"
  ON public.attachment_classification_runs
  FOR SELECT
  TO authenticated
  USING (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Admins view classification runs"
  ON public.attachment_classification_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete classification runs"
  ON public.attachment_classification_runs
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Participants view own classification summaries"
  ON public.attachment_classification_summaries
  FOR SELECT
  TO authenticated
  USING (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Admins view classification summaries"
  ON public.attachment_classification_summaries
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete classification summaries"
  ON public.attachment_classification_summaries
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Participants manage own usability responses"
  ON public.usability_responses
  FOR ALL
  TO authenticated
  USING (participant_id = public.get_participant_id_for_user())
  WITH CHECK (participant_id = public.get_participant_id_for_user());

CREATE POLICY "Admins view usability responses"
  ON public.usability_responses
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete usability responses"
  ON public.usability_responses
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated users can create own participant"
  ON public.participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Seed the supported studies and published version 1 configs.
INSERT INTO public.studies (slug, name, description, is_active)
VALUES
  ('big5_original', 'Big Five Original', 'Original 20-chat Big Five plus IPIP feedback flow.', true),
  ('relationship_patterns_cuq_sus_plausibility', 'Relationship Patterns Interview', 'Single relationship-pattern interview with CUQ, SUS, and perceived plausibility.', true),
  ('ecr_self_report_comparison', 'ECR Self-Report Comparison', 'Legacy ECR interview plus ECR-R self-report comparison flow.', true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

INSERT INTO public.study_versions (study_id, version_number, config, is_published)
SELECT s.id, 1, cfg.config, true
FROM public.studies s
JOIN (
  VALUES
    (
      'big5_original',
      $json$
      {
        "slug": "big5_original",
        "version": 1,
        "blocks": [
          { "type": "consent", "id": "consent", "config": { "copyKey": "big5_default" } },
          { "type": "transition", "id": "start", "config": { "copyKey": "big5_start", "estimatedMinutes": 75 } },
          { "type": "llm_interview", "id": "big5_chats", "config": { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "systemPromptKey": "big5_interviewer_v1", "sessionCount": 20, "edgeFunction": "chat-conversation" } },
          { "type": "transition", "id": "pre_survey", "config": { "copyKey": "big5_pre_ipip" } },
          { "type": "survey", "id": "ipip_50", "config": { "instrument": "big5_ipip_50" } },
          { "type": "feedback", "id": "big5_feedback", "config": { "items": ["big5_trait_accuracy", "big5_method_preference", "free_text_feedback"] } },
          { "type": "completion", "id": "complete" }
        ]
      }
      $json$::jsonb
    ),
    (
      'relationship_patterns_cuq_sus_plausibility',
      $json$
      {
        "slug": "relationship_patterns_cuq_sus_plausibility",
        "version": 1,
        "blocks": [
          { "type": "consent", "id": "consent", "config": { "copyKey": "relationship_patterns_default" } },
          { "type": "transition", "id": "briefing", "config": { "copyKey": "relationship_patterns_briefing", "estimatedMinutes": 25, "fabricationAllowed": true } },
          { "type": "llm_interview", "id": "relationship_interview", "config": { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "temperature": 0.3, "systemPromptKey": "relationship_interviewer_v1", "sessionCount": 1, "targetMinutes": [10, 15], "edgeFunction": "relationship-chat" } },
          { "type": "classifier", "id": "attachment_classifier", "config": { "provider": "anthropic", "systemPromptKey": "attachment_classifier_v1", "repeatCount": 5, "edgeFunction": "run-attachment-classification" } },
          { "type": "profile_display", "id": "attachment_profile", "config": { "source": "attachment_classification_summary" } },
          { "type": "survey", "id": "cuq", "config": { "instrument": "cuq_16" } },
          { "type": "survey", "id": "sus", "config": { "instrument": "sus_10" } },
          { "type": "feedback", "id": "plausibility_feedback", "config": { "items": ["attachment_output_plausibility", "free_text_feedback"] } },
          { "type": "completion", "id": "complete" }
        ]
      }
      $json$::jsonb
    ),
    (
      'ecr_self_report_comparison',
      $json$
      {
        "slug": "ecr_self_report_comparison",
        "version": 1,
        "blocks": [
          { "type": "consent", "id": "consent", "config": { "copyKey": "ecr_default" } },
          { "type": "transition", "id": "start", "config": { "copyKey": "ecr_start" } },
          { "type": "llm_interview", "id": "relationship_interview", "config": { "provider": "anthropic", "systemPromptKey": "relationship_interviewer_v1", "sessionCount": 1, "edgeFunction": "relationship-chat" } },
          { "type": "survey", "id": "ecr_36", "config": { "instrument": "ecr_r_36" } },
          { "type": "feedback", "id": "ecr_feedback", "config": { "items": ["ecr_dimension_accuracy", "ecr_method_preference", "free_text_feedback"] } },
          { "type": "completion", "id": "complete" }
        ]
      }
      $json$::jsonb
    )
) AS cfg(slug, config) ON cfg.slug = s.slug
ON CONFLICT (study_id, version_number) DO UPDATE
SET config = EXCLUDED.config,
    is_published = EXCLUDED.is_published;

WITH active_versions AS (
  SELECT s.slug, s.id AS study_id, sv.id AS study_version_id
  FROM public.studies s
  JOIN public.study_versions sv ON sv.study_id = s.id AND sv.version_number = 1
),
legacy_participants AS (
  SELECT
    p.id AS participant_id,
    CASE
      WHEN p.assessment_type = 'ecr' THEN 'ecr_self_report_comparison'
      ELSE 'big5_original'
    END AS study_slug
  FROM public.participants p
)
INSERT INTO public.participant_study_assignments (participant_id, study_id, study_version_id, status)
SELECT lp.participant_id, av.study_id, av.study_version_id, 'active'
FROM legacy_participants lp
JOIN active_versions av ON av.slug = lp.study_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.participant_study_assignments existing
  WHERE existing.participant_id = lp.participant_id
    AND existing.status = 'active'
);

COMMIT;
