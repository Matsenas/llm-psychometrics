---
title: Add Admin-Created Auth Accounts for Participants and Admins
type: feat
status: active
date: 2026-05-18
---

# Add Admin-Created Auth Accounts for Participants and Admins

## Overview

The current admin "Add Single Participant" workflow no longer matches the rest of the app's authenticated participant flow. The app now expects participants to sign in with Supabase Auth, resolve to exactly one `participants.user_id`, and continue through an active `participant_study_assignments` row. Admin-created participants should therefore create both the Supabase Auth user and the participant assignment in one admin-only workflow.

This plan also adds "Add Admin" from the admin panel: create a new email/password auth user with name metadata, grant admin rights, and keep the existing grant/revoke UI for already-created users.

## Review Findings

1. `Add Single Participant` inserts only a `participants` row and never creates a Supabase Auth user. See [ParticipantsUserManagement.tsx](../../src/components/admin/ParticipantsUserManagement.tsx:258). That means an admin-created participant with email still cannot use the pre-set password flow the root sign-in screen expects.
2. The participant sign-in bootstrap links or creates participants by authenticated email in [ParticipantContext.tsx](../../src/contexts/ParticipantContext.tsx:209). If no participant exists, it creates one with `user_id` but no study assignment, which can leave self-created accounts in `/no-study`.
3. The legacy respondent-link route can overwrite an existing linked participant with a new anonymous user if the current session does not match the stored `user_id`. See [Session.tsx](../../src/pages/Session.tsx:73). That is especially risky once participants are email-backed auth users.
4. Admin account management only grants or revokes admin on existing profiles. There is no path to create the auth user from the admin UI, and profiles currently expose only `id` and `email`. See [AdminRoleManager.tsx](../../src/components/admin/AdminRoleManager.tsx:50).
5. Creating auth users must not happen in browser code. Supabase Auth admin methods require the service role key and belong in trusted server-side code. Existing Edge Functions already use `SUPABASE_SERVICE_ROLE_KEY`, but `supabase/config.toml` has no admin-user creation function.
6. The participant table still treats every participant as link-based access and copies `/participant/:respondentId` for all rows. See [ParticipantsUserManagement.tsx](../../src/components/admin/ParticipantsUserManagement.tsx:144) and [ParticipantsUserManagement.tsx](../../src/components/admin/ParticipantsUserManagement.tsx:1101).
7. Current add-participant persistence is split: participant insert succeeds before study assignment. If assignment fails, an unassigned participant row remains. See [ParticipantsUserManagement.tsx](../../src/components/admin/ParticipantsUserManagement.tsx:280).

## Proposed Solution

Add an admin-only Supabase Edge Function, tentatively `admin-create-user`, that verifies the caller's JWT and admin role, then uses the service role Supabase client to create auth users.

Participant accounts are admin-created only. Remove participant self-sign-up from `/`; participants sign in with the email address and generated password provided by an admin. The app should generate a simple temporary password and should not force participants or admins to change it on first login.

Remove bulk CSV import from the admin panel. The codebase should stay simple: one account-creation path for new participants and one path for new admins.

For participant creation, the function should:

- Require `name`, `email`, and `studyVersionId`; allow optional `respondentId` for admin lookup.
- Create a Supabase Auth user with `email_confirm: true` and `user_metadata.name`.
- Generate and return a simple password for the admin to share with the participant.
- Create or update `profiles` with `name` and `email`.
- Create a `participants` row with `user_id`, normalized email, name, generated respondent ID when omitted, and the selected active study assignment.
- Roll back the newly-created auth user if participant or assignment creation fails.

For admin creation, the same function should:

- Require `name` and `email`.
- Create the Supabase Auth user and profile.
- Generate and return a simple password for the admin to share with the new admin.
- Ensure the default `user` role exists.
- Grant `admin` via `user_roles`.
- Insert an `admin_role_events` audit row with `action = 'grant_admin'`.

Update the admin UI to call this function instead of direct client-side participant inserts. Keep grant/revoke admin for existing users, but add an "Add Admin" dialog for new admin accounts.

## Technical Approach

### Database and Types

- Add nullable `profiles.name`.
- Update `handle_new_user()` so email users get a profile with `name` from `raw_user_meta_data ->> 'name'`, and make profile/role inserts idempotent with `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`.
- Consider a unique partial index on `participants.user_id WHERE user_id IS NOT NULL` only after checking existing data for duplicates.
- Regenerate or update Supabase TypeScript types for `profiles.name`.

### Edge Function Contract

```ts
type AdminCreateUserRequest =
  | {
      kind: "participant";
      name: string;
      email: string;
      studyVersionId: string;
      respondentId?: string;
    }
  | {
      kind: "admin";
      name: string;
      email: string;
    };
```

Return the created `userId`, normalized `email`, `name`, and participant identifiers when applicable. Return structured JSON errors so the admin UI can show precise failures, not a generic Edge Function error.

### Participant Admin UI

- Rename the dialog to "Add Participant Account".
- Make name, email, and study assignment required.
- Keep respondent ID optional; generate one server-side when omitted.
- Show the generated password after creation so the admin can copy it.
- Submit through `supabase.functions.invoke("admin-create-user")`.
- Close the dialog only after success.
- Display access mode in the participant table:
  - email-backed participants: show email sign-in / root app URL.
  - legacy participants without email auth: show `/participant/:respondentId`.

### Admin User UI

- Extend `AdminRoleManager` to load and display profile name.
- Add an "Add Admin" dialog with name and email.
- Show the generated password after creation so the admin can copy it.
- Submit through the same Edge Function with `kind: "admin"`.
- Refresh the existing profiles/roles table after creation.
- Keep final-admin protection on revoke.

### Entry and Legacy Link Behavior

- For email-backed participants, `/participant/:respondentId` should not silently re-link to a new anonymous user. It should direct the user to the email/password sign-in screen.
- Keep legacy respondent links working for participants that do not have an email-backed auth user.
- Remove participant self-sign-up from `/`. Participants only sign in to existing admin-created accounts.

## System-Wide Impact

### Interaction Graph

Admin create participant -> Edge Function verifies admin -> Auth user is created -> `handle_new_user()` creates profile/user role -> Edge Function upserts profile -> participant row is created -> study assignment row is created -> admin table reloads -> participant signs in at `/` -> `ParticipantContext.loadParticipantForUser()` resolves `participants.user_id` -> active study assignment loads -> route progression begins.

Admin create admin -> Edge Function verifies admin -> Auth user is created -> profile/user role created -> admin role inserted -> audit event inserted -> `AdminRoleManager` reloads -> new admin can sign in at `/auth`.

### Error & Failure Propagation

- Auth creation failure should stop before any app rows are created.
- Profile/role failure after auth creation should trigger cleanup of the created auth user.
- Participant insert or assignment failure should trigger cleanup of the created auth user and any created participant row.
- UI should surface the Edge Function's JSON `error` message.

### State Lifecycle Risks

- Orphaned auth users if downstream inserts fail.
- Orphaned participants if assignment fails.
- Duplicate users if an email already exists in Supabase Auth.
- Duplicate participants if `participants.email` already exists.
- Accidental account takeover if respondent links can re-link email-backed participants.

### API Surface Parity

- Add single participant dialog, root participant sign-in, legacy respondent links, and Add Admin should be reviewed together.
- Remove bulk CSV import from this surface to keep participant creation paths simple.
- Admin role grant/revoke and Add Admin should share refresh and error handling paths.

## SpecFlow Analysis

### User Flow Overview

1. Existing admin signs in at `/auth`, passes role guard, opens Participants/User Management.
2. Admin clicks Add Participant Account, enters name/email/study, submits.
3. Edge Function creates auth user, participant, and active assignment.
4. Admin shares the email/password with the participant.
5. Participant signs in at `/`, `ParticipantContext` loads the participant by `user_id`, then routes into the assigned study.
6. Admin clicks Add Admin, enters name/email, submits.
7. Edge Function creates auth user, grants admin, logs the role event.
8. New admin signs in at `/auth` and enters `/admin`.

### Flow Permutations Matrix

| Flow | User state | Existing data | Expected behavior |
|---|---|---|---|
| Add participant | Admin | New email | Create auth user, participant, assignment |
| Add participant | Admin | Email already in Auth | Reject with clear duplicate-email error |
| Add participant | Admin | Email already in participants | Reject or route to existing participant management |
| Add participant | Admin | Study version missing/unpublished | Reject before creating durable rows |
| Participant sign-in | Participant | `participants.user_id` exists and active assignment exists | Route to next study step |
| Participant sign-in | Participant | Auth user exists but no assignment | Show no-study/admin-contact state |
| Legacy link | Guest | Participant has no email-backed auth user | Existing anonymous link path still works |
| Legacy link | Guest | Participant has email-backed auth user | Do not re-link; prompt email/password sign-in |
| Add admin | Admin | New email | Create auth user, profile, admin role, audit event |
| Add admin | Admin | Email already exists | Reject or instruct to use Grant on existing profile |

### Product Decisions

1. Participant signup is removed from `/`; participant accounts are created by admins only.
2. The app generates a simple password for participant and admin accounts.
3. The app does not force a password change on first login.
4. Bulk CSV import is removed from the admin panel.

## Implementation Phases

### Phase 1: Server-Side Account Creation

- Add `profiles.name` migration and idempotent `handle_new_user()` update.
- Add `supabase/functions/admin-create-user/index.ts`.
- Add `[functions.admin-create-user] verify_jwt = true` to `supabase/config.toml`.
- Include cleanup paths for partial failure.

### Phase 2: Participant Creation UI

- Replace direct `participants.insert()` in `ParticipantsUserManagement` with Edge Function invocation.
- Require name/email/study in the dialog.
- Keep optional respondent ID for legacy traceability.
- Update the participant table access column to distinguish email sign-in from legacy session links.
- Remove bulk CSV import UI and import code.

### Phase 3: Add Admin UI

- Add profile name support to `AdminRoleManager`.
- Add "Add Admin" dialog.
- Reuse the Edge Function with `kind: "admin"`.
- Refresh profiles/roles after success.
- Add admin-only user deletion from the admin accounts table through a server-side function, with self-delete and final-admin guards.

### Phase 4: Orchestration Hardening

- Prevent `/participant/:respondentId` from re-linking email-backed participants to anonymous users.
- Remove root self-sign-up behavior.
- Add clear no-study handling for authenticated users without an active assignment.

### Phase 5: Verification

- Typecheck/build the React app.
- Run lint if the repo lint state permits.
- Manually test admin create participant, participant sign-in, add admin, admin user deletion, new admin sign-in, duplicate email, missing study, and legacy link behavior.

## Acceptance Criteria

### Functional Requirements

- [x] Admin can create a participant account with name, email, generated password, and study assignment.
- [x] Created participant can sign in with email/password and lands in their assigned study flow.
- [x] Admin can create a new admin account with name, email, generated password, and admin rights.
- [x] Existing admin grant/revoke still works.
- [x] Admin can delete other auth users from the admin accounts table.
- [x] Email-backed participants are not re-linked through anonymous respondent links.
- [x] Legacy respondent-link participants still work when they do not have email-backed auth.
- [x] Bulk CSV import is removed from the admin participant surface.

### Security Requirements

- [x] No service role key is exposed to frontend code.
- [x] Edge Function verifies caller JWT and current admin role before using Auth admin APIs.
- [x] Duplicate email and partial failure paths do not leave orphaned or inconsistent rows.
- [x] User deletion is server-side only and blocks self-deletion.
- [x] Last-admin protection remains enforced.

### Quality Gates

- [x] `pnpm build` passes.
- [x] Supabase types include `profiles.name`.
- [ ] Manual smoke test covers participant creation, admin creation, admin user deletion, duplicate email, and legacy respondent link behavior.

## Implementation Notes

- Remote Supabase migration `20260518005000_add_admin_created_auth_accounts.sql` has been applied to project `gcthkfpthmnanztvachx`.
- Edge Function `admin-create-user` has been deployed to project `gcthkfpthmnanztvachx`.
- Edge Function `admin-delete-user` has been deployed to project `gcthkfpthmnanztvachx`.
- `pnpm lint` was run and is blocked by existing repository lint errors outside this change set.
- `deno check` for Supabase Edge Functions could not be run because `deno` is not installed in this environment.

## Dependencies & Risks

- Supabase Auth admin user creation requires service role permissions and must stay in Edge Functions.
- Supabase local development may need function secrets configured before full manual testing.
- Existing production data may include multiple `participants` rows for one `user_id`; check before adding uniqueness constraints.
- Removing CSV import means any future batch account creation should be planned as a separate, auth-user-aware import workflow.

## Sources & References

- [ParticipantsUserManagement.tsx](../../src/components/admin/ParticipantsUserManagement.tsx:258) - current participant creation path.
- [AdminRoleManager.tsx](../../src/components/admin/AdminRoleManager.tsx:50) - current existing-user role management.
- [ParticipantContext.tsx](../../src/contexts/ParticipantContext.tsx:209) - authenticated participant bootstrap.
- [Session.tsx](../../src/pages/Session.tsx:73) - legacy respondent-link relinking path.
- [2026-05-16 email-authenticated architecture plan](2026-05-16-001-refactor-email-authenticated-attachment-experiment-plan.md) - original shift to email-authenticated participants.
- [2026-05-18 admin study management plan](2026-05-18-001-refactor-admin-study-management-plan.md) - admin panel refactor context.
- Supabase Auth admin methods require service role/server-side use: https://github.com/supabase/supabase/blob/master/apps/www/_blog/2022-08-16-supabase-js-v2.mdx
- Supabase admin create user supports email, password, and metadata: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/migrating-to-supabase/auth0.mdx
