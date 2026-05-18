---
status: complete
priority: p1
issue_id: "003"
tags: [studies, participants, supabase, refactor]
dependencies: []
---

# Remove Assessment Track

## Problem Statement

The app now uses versioned study assignments, but runtime code and admin UI still expose the old `participants.assessment_type` "track" concept. The ECR comparison study has been removed, so the old mapping is misleading and should be fully cleaned with no backwards compatibility.

## Findings

- Plan source: `docs/plans/2026-05-18-002-refactor-remove-assessment-track-plan.md`
- Current branch: `architecture-refactor`
- Runtime branches still read `participant.assessment_type`
- Admin participant creation still shows `Assessment Track`
- Supabase generated types still include `participants.assessment_type`
- Remote app has no production participant data to preserve; cleanup migration can remove test participant rows before dropping the column

## Proposed Solutions

### Option 1: Full Clean Removal

Remove `assessment_type` from UI, runtime types, routing branches, exports, edge functions, generated types, and database schema.

**Pros:** Matches the new architecture and removes stale ECR comparison assumptions.

**Cons:** Not backwards compatible with old participant rows.

**Effort:** Medium-large

**Risk:** Medium

## Recommended Action

Execute full clean removal per plan. Apply Supabase migrations through the CLI after build passes.

## Acceptance Criteria

- [x] No user-facing study selection copy says "track"
- [x] Admin participant creation has no `Assessment Track`
- [x] Runtime routing branches on active study assignment, not `assessment_type`
- [x] `participants.assessment_type` is removed from generated types and schema
- [x] Active runtime code does not reference `ecr_self_report_comparison`
- [x] Edge functions do not authorize by `assessment_type`
- [x] README describes studies/projects rather than tracks
- [x] `pnpm build` passes
- [x] Supabase migrations are applied or blocker is documented

## Work Log

### 2026-05-18 - Started

**By:** Codex

**Actions:**
- Read the track removal plan and current branch state.
- Created this todo for execution tracking.

**Learnings:**
- This can be a full removal because no production participant data needs preserving.

### 2026-05-18 - Completed

**By:** Codex

**Actions:**
- Removed `assessment_type` from participant runtime types, routing, admin creation, exports, and edge-function authorization.
- Deleted the unreachable ECR self-report comparison UI/helpers and kept shared attachment classification primitives for the NLP project.
- Added and applied `20260518003000_remove_assessment_type_track.sql` and `20260518004000_drop_legacy_ecr_responses.sql` with `pnpm exec supabase db push --linked --yes`.
- Removed the legacy `score-attachment-llm` edge function from local config/source.
- Deleted deployed Supabase function `score-attachment-llm` and deployed updated `relationship-chat` plus new `run-attachment-classification`.
- Regenerated Supabase TypeScript types from the linked remote project.
- Ran `pnpm build` successfully after codegen.
- Ran `pnpm lint`; it still fails on existing repo-wide lint issues outside this refactor's scope.

**Learnings:**
- The repo-local Supabase CLI is available through `pnpm exec supabase`; the standalone `supabase` binary is not on PATH.
