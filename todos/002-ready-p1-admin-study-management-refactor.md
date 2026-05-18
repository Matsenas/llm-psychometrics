---
status: done
priority: p1
issue_id: "002"
tags: [admin, studies, auth, supabase, ui]
dependencies: []
---

# Admin Study Management Refactor

## Problem Statement

The admin panel needs to be refactored into two primary surfaces: Participants/User Management and Assessment/Study Overview. The current `src/pages/Admin.tsx` mixes participant operations, exports, study assignment, prompt previews, and admin account display in one large component. The app also needs GUI admin-role management, clickable/editable study blocks, safer study versioning, missing-data guardrails, and env-backed app URLs.

## Findings

- Plan source: `docs/plans/2026-05-18-001-refactor-admin-study-management-plan.md`
- Current branch: `architecture-refactor`
- Existing study schema: `studies`, `study_versions`, `participant_study_assignments`, and `study_block_progress`
- Existing role schema: `user_roles` and `has_role(auth.uid(), 'admin')`
- Existing admin page already supports participant listing, assignment, export, and static prompt/question previews
- Hard-coded discontinued Lovable participant-link domain remains in `src/pages/Admin.tsx`

## Proposed Solutions

### Option 1: Incremental Component Extraction and Additive Admin Features

**Approach:** Preserve current admin behavior while extracting participant management into components/services, add study management and role management, and wire domain/missing-data guards.

**Pros:**
- Lowest risk with the dirty working tree
- Keeps existing admin workflows available while adding the new ones
- Easier to test incrementally

**Cons:**
- Some legacy route/page assumptions may remain until later cleanup

**Effort:** Large

**Risk:** Medium

## Recommended Action

Implement incrementally on `architecture-refactor`, preserving existing participant workflows first. Use Edge Functions/server-side verification where privileged auth-user operations require service role access. Update the plan checkboxes as tasks complete.

## Technical Details

**Affected files:**
- `src/pages/Admin.tsx`
- `src/pages/ParticipantDetails.tsx`
- `src/pages/Accuracy.tsx`
- `src/pages/AttachmentProfile.tsx`
- `src/pages/Results.tsx`
- `src/pages/UsabilitySurvey.tsx`
- `src/App.tsx`
- `src/contexts/ParticipantContext.tsx`
- `src/studies/registry.ts`
- `src/studies/progress.ts`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/*`
- `.env.example`
- `README.md`

## Resources

- Plan: `docs/plans/2026-05-18-001-refactor-admin-study-management-plan.md`
- Prior architecture plan: `docs/plans/2026-05-16-001-refactor-email-authenticated-attachment-experiment-plan.md`

## Acceptance Criteria

- [x] Admin panel has Participants/User Management and Assessment/Study Overview surfaces
- [x] Participant management preserves create/import/search/filter/export/access/study workflows
- [x] GUI admin role grant/revoke works for existing users and protects against non-admin callers
- [x] Study overview shows the three supported studies separately
- [x] Every study block is clickable/openable only after admin auth
- [x] Draft study versions can be edited; published versions clone to draft
- [x] Publishing a draft does not change existing participant assignments
- [x] Missing LLM/classifier data does not produce misleading feedback/result forms
- [x] Discontinued Lovable participant-link domain is removed from source/runtime files
- [x] Links use `VITE_APP_BASE_URL` with local fallback
- [x] Build and lint are run or blockers documented
- [x] Original plan checklist is updated

## Work Log

### 2026-05-18 - Started Implementation

**By:** Codex

**Actions:**
- Read the ce-work plan and confirmed work should continue on `architecture-refactor`.
- Created this ready todo for tracking the implementation.

**Learnings:**
- The plan has clear defaults for the open choices, so implementation can proceed without extra clarification.

### 2026-05-18 - Completed Implementation Pass

**By:** Codex

**Actions:**
- Added an admin route guard, two-surface admin shell, participant/user management component, admin-role management UI, study management UI, study config validation, and env-backed app URL helper.
- Added a Supabase migration for study-version metadata, published-version immutability, admin role audit events, admin-only role mutation policies, and final-admin protection.
- Added a confirmed "Delete Setup" action for unassigned study versions.
- Deleted `ecr_self_report_comparison` from the linked Supabase project and added a migration to keep future rebuilds aligned.
- Renamed the remaining studies in the linked Supabase project, UI label map, and migration history.
- Added missing-data escape states for Big Five, ECR, relationship profile, usability, and final results flows.
- Updated README, `.env.example`, generated Supabase types, this todo, and the original plan checklist.

**Verification:**
- `pnpm build` passes with only Vite's large chunk warning.
- `pnpm lint` was run and still fails on pre-existing lint debt outside the refactor scope.
- `rg "ut-ani\\.lovable\\.app" . -g '!node_modules' -g '!dist'` returns no matches.
- `pnpm exec supabase migration list --local` is blocked because local Postgres is not listening on `127.0.0.1:54322`.
