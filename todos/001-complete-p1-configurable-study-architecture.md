---
status: complete
priority: p1
issue_id: "001"
tags: [supabase, auth, studies, frontend]
dependencies: []
---

# Configurable Study Architecture

## Problem Statement

Execute the configurable study architecture plan in `docs/plans/2026-05-16-001-refactor-email-authenticated-attachment-experiment-plan.md`.

## Findings

- Current participant entry uses respondent IDs plus anonymous auth.
- Current flow branches on `assessment_type = big5 | ecr`.
- The plan requires database-backed study configs, email-authenticated participant start, seeded Big Five and relationship-pattern studies, reusable feedback/survey blocks, repeated attachment classification, and admin study assignment.

## Proposed Solutions

1. Implement the plan directly in the current branch.
2. Keep legacy Big Five/ECR behavior available while adding assignment-backed study routing.

## Recommended Action

Proceed with the current branch implementation, keeping changes scoped to the plan and preserving existing participant flows where possible.

## Acceptance Criteria

- [x] Study schema, seeds, and RLS are added.
- [x] Participant email auth/bootstrap and study assignment loading are implemented.
- [x] Relationship-pattern study flow can collect interview, classification, CUQ/SUS/plausibility, and completion data.
- [x] Admin can assign studies to authenticated participants or email placeholders.
- [x] Plan checkboxes are updated.
- [x] Build and Supabase CLI migration checks are run.

## Work Log

### 2026-05-17 - Start Implementation

**By:** Codex

**Actions:**
- Created execution todo for the current `ce-work` request.
- Confirmed current branch is `architecture-refactor`.

**Learnings:**
- No existing file-based todos were present in the repo.

### 2026-05-17 - Implementation Completed

**By:** Codex

**Actions:**
- Added study/version/assignment/progress, classification, usability, and participant email schema in Supabase migration.
- Implemented email OTP participant start, auth callback/bootstrap, active study loading, no-study state, relationship profile display, usability survey, and study-aware routing.
- Added repeated attachment classification orchestration and fixed Anthropic system prompt/message duplication issues.
- Updated admin study assignment, email placeholders, reset cleanup, and CSV export fields for relationship-pattern RQ metrics.
- Ran `pnpm build` successfully.
- Ran `pnpm lint`; remaining failures are documented in the plan as existing project lint debt.
- Ran `pnpm exec supabase db reset`; Supabase CLI could not apply migrations locally because Docker is unavailable.

**Learnings:**
- The migration still needs a local Supabase run with Docker available before the Supabase apply checkbox can be closed.
- The ECR seed remains included as legacy support, but it still needs a live smoke test before it should be treated as fully verified.
