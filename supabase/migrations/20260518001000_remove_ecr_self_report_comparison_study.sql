BEGIN;

DO $$
DECLARE
  ecr_assignment_count integer;
BEGIN
  SELECT COUNT(*)
  INTO ecr_assignment_count
  FROM public.participant_study_assignments psa
  WHERE psa.study_id IN (
      SELECT id
      FROM public.studies
      WHERE slug = 'ecr_self_report_comparison'
    )
    OR psa.study_version_id IN (
      SELECT sv.id
      FROM public.study_versions sv
      JOIN public.studies s ON s.id = sv.study_id
      WHERE s.slug = 'ecr_self_report_comparison'
    );

  IF ecr_assignment_count > 0 THEN
    RAISE EXCEPTION 'Cannot remove ecr_self_report_comparison while % participant assignments still reference it', ecr_assignment_count;
  END IF;
END;
$$;

DELETE FROM public.study_versions
WHERE study_id IN (
  SELECT id
  FROM public.studies
  WHERE slug = 'ecr_self_report_comparison'
);

DELETE FROM public.studies
WHERE slug = 'ecr_self_report_comparison';

COMMIT;
