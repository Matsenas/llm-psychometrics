---
title: Remove Assessment Track Concept
type: refactor
status: active
date: 2026-05-18
---

# Remove Assessment Track Concept

## Overview

Remove "track" as a product, routing, and database concept. The current study architecture already has the better source of truth: `participant_study_assignments -> study_versions -> studies`. Participant flow, admin creation, exports, and edge-function authorization should use active study assignment and study config rather than `participants.assessment_type`.

This is especially important now that `ecr_self_report_comparison` has been deleted from Supabase while `assessment_type = "ecr"` still maps to that removed study in code.

Scope assumption: this app has no production participant data to preserve. Implement this as a full clean removal with no legacy fallback or backwards-compatibility path.

## Problem

The app currently has two overlapping ways to decide participant behavior:

- Legacy: `participants.assessment_type` with values `big5 | ecr`.
- New: active `participant_study_assignments` pointing to a versioned study config.

This creates drift:

- `src/studies/registry.ts` still maps `ecr` to deleted `ecr_self_report_comparison`.
- Runtime pages still branch on `participant.assessment_type`.
- Admin creation still exposes "Assessment Track".
- README still describes participants as being assigned to tracks.
- Edge functions and exports still carry legacy ECR/Big Five assumptions.

## Proposed Solution

Make active study assignment the only runtime decision point.

Delete the track concept outright:

- Drop `participants.assessment_type`.
- Remove all code branches, helper mappings, labels, exports, and docs that rely on `assessment_type`.
- Remove unreachable ECR self-report comparison UI and functions.
- Reset/delete any local/remote participant rows or dependent participant data if needed before applying the schema cleanup.

## Implementation Plan

### Phase 1: Remove Track From UI and Routing

- Remove "Assessment Track" selector from `ParticipantsUserManagement`.
- Require/select a published study version when creating a participant.
- Update participant table labels and progress counts from `active_study_slug` or parsed `activeStudy.config.blocks`, not `assessment_type`.
- Update `Chat`, `Questionnaire`, `Transition`, `Accuracy`, `Results`, and `FeedbackIntro` to branch only on `activeStudy.slug`.
- Remove `isEcrComparisonStudy`, `studySlugForAssessmentType`, `assessmentTypeForStudySlug`, and `AssessmentType`.
- Remove `assessment_type` from participant context, admin types, exports, table badges, CSV import/create flows, and participant detail logic.

### Phase 2: Clean Legacy ECR Comparison Surface

- Remove unreachable ECR comparison pages/components:
  - `EcrQuestionnaire`
  - `EcrAccuracy`
  - `EcrResults`
  - legacy ECR prompt/question previews if no longer needed
- Keep attachment scoring/classification primitives only where the NLP project uses them.
- Replace legacy `ECR-R track` language in README and participant/admin copy.

### Phase 3: Database and Edge Functions

- Add a migration that deletes/reset participant rows and dependent participant data if any exists in the target app database.
- Drop `participants.assessment_type` in the same cleanup migration.
- Remove any migration-time assignment fallback from `assessment_type` in future migration history where practical, or supersede it with an explicit cleanup migration.
- Update generated Supabase TypeScript types.
- Update edge functions to authorize by participant ownership/admin role plus active study/block requirements, not `assessment_type`.

## System-Wide Impact

- Participant startup will depend on `activeStudy`; missing assignment goes to `/no-study`.
- Admin creation becomes simpler: create participant, assign study version, done.
- No legacy respondent-ID or track fallback remains.
- Export schemas should be study-based only; remove `assessment_type` columns unless a downstream analysis explicitly requires a separate static value.

## Acceptance Criteria

- [x] No user-facing copy says "track" for study selection.
- [x] Admin participant creation has no `Assessment Track` selector.
- [x] Participant flow routing uses active study assignment, not `participants.assessment_type`.
- [x] `participants.assessment_type` is dropped from the database and generated types.
- [x] `ecr_self_report_comparison` is not referenced by active runtime code.
- [x] New participants can be created and assigned to either remaining study.
- [x] Participants without active study assignment land on `/no-study`.
- [x] Edge functions no longer reject/allow based on `assessment_type`.
- [x] Supabase cleanup migration removes any leftover participant rows/data before dropping track schema if needed.
- [x] Generated Supabase types are updated.
- [x] README describes studies/projects, not tracks.
- [x] `pnpm build` passes.

## Risks

- A full cleanup migration can delete test participant data; confirm the target project truly has no data to preserve before applying it.
- Relationship/NLP still uses attachment scoring primitives, so remove ECR comparison UX carefully without deleting shared scoring code.
- Historical export compatibility is intentionally out of scope for this app.

## Sources

- Current study assignment loader: `src/contexts/ParticipantContext.tsx`
- Study registry and legacy mapping: `src/studies/registry.ts`
- Route progression: `src/studies/progress.ts`
- Admin creation UI: `src/components/admin/ParticipantsUserManagement.tsx`
- Legacy schema source: `supabase/migrations/20260419000000_add_ecr_assessment.sql`
- Configurable study schema: `supabase/migrations/20260517000000_add_configurable_studies.sql`
