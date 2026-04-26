# Phase 1 — Roles foundation

Backend-only, non-breaking. No UI, copy, or client routing changed. After this
phase the app behaves identically to before for every user.

## What changed

### New schema
- Enum `public.team_member_role` with values `admin`, `member`.
- Column `public.team_members.role team_member_role NOT NULL DEFAULT 'member'`.
  - Index `idx_team_members_team_role` on `(team_id, role)`.
  - Backfill: every `team_members` row whose `user_id` matches the team's
    `teams.admin_id` was set to `role='admin'`. All others remain `member`.
- Table `public.app_roles (user_id, role, granted_at, granted_by)`
  - `role` is a text column constrained to `'super_admin'` (extensible later
    without an enum migration).
- Table `public.super_admin_actions` (audit log) with indexes on
  `(target_team_id, created_at desc)` and `(actor_user_id, created_at desc)`.

### New helpers (SECURITY DEFINER, STABLE, search_path = public, pg_temp)
- `is_super_admin() returns boolean` — true iff the caller has
  `app_roles.role = 'super_admin'`.
- `is_team_admin(team_uuid uuid) returns boolean` — true iff the caller is a
  team admin (via `team_members.role='admin'` or legacy `teams.admin_id`) or
  a super admin. EXECUTE granted to `authenticated`.

### Helper widened (signature kept for backward compatibility)
- `is_team_admin(_team_id uuid, _user_id uuid)` — body widened to also accept
  `team_members.role='admin'` (multi-admin support) and to recognise the
  calling user as super admin (only when `_user_id = auth.uid()`).
  Original predicate preserved as a comment in the migration for traceability.

### Trigger updated
- `handle_new_team()` now inserts the team creator as `role='admin'` (was a
  default `member` row implicitly).

### RLS policies touched
| Table | Policy | Change |
|---|---|---|
| `teams` | Admin can update their team | `auth.uid() = admin_id` → `is_team_admin(id, auth.uid())` |
| `teams` | Admin can delete their team | `auth.uid() = admin_id` → `is_team_admin(id, auth.uid())` |
| `team_members` | Admin self-insert on team creation | now also allows existing team admin / super admin to insert |
| `app_roles` | (new) | super admins manage all rows; user can read their own rows |
| `super_admin_actions` | (new) | super admins read; rows are written only inside SECURITY DEFINER RPCs (no INSERT/UPDATE/DELETE policies) |

All other admin-scoped policies already used `is_team_admin(team_id, auth.uid())`,
so they automatically inherit multi-admin and super-admin support via the widened
helper:
- `champions`: Admin insert/update/delete
- `team_courses`: Admin update; admin-or-adder delete
- `team_rules`: Admin insert/update

No member-scoped policy was loosened. Member-scoped tables left untouched
(`rounds`, `notable_shots`, `profiles`, `team_courses` SELECT/INSERT,
`team_rules` SELECT, `team_members` SELECT/DELETE).

### RPCs updated
All keep their inputs/outputs and existing error messages. Each now also
permits a super admin and writes a row to `super_admin_actions` when the call
proceeds via super-admin (and not via team-admin).

| RPC | Notes |
|---|---|
| `join_team_by_code(_code)` | Inserts new member with explicit `role='member'`. |
| `list_team_members(_team_id)` | Allows super admin. `is_admin` now reflects `team_members.role='admin' OR teams.admin_id`. Read-only — not audited. |
| `get_team_join_code(_team_id)` | Allows super admin. Read-only — not audited. |
| `admin_remove_team_member(_team_id, _user_id)` | Audited as `remove_member` when invoked by super admin. |
| `transfer_team_admin(_team_id, _new_admin_id)` | Updates `teams.admin_id`, sets new admin's `team_members.role='admin'`, drops previous admin's role to `'member'`. Audited as `transfer_admin` when invoked by super admin. |
| `admin_update_member_nickname(_team_id, _user_id, _nickname)` | Audited as `rename_member` when invoked by super admin. |

### Other hygiene
- `is_team_member(_team_id, _user_id)` re-declared with explicit
  `SET search_path = public, pg_temp` for warning hygiene. Body unchanged.

## Out-of-scope RPCs encountered
None. The only RPCs in `public` that referenced `teams.admin_id` were the five
above (`get_team_join_code`, `list_team_members`, `transfer_team_admin`,
`admin_remove_team_member`, `admin_update_member_nickname`) plus the helper
`is_team_admin/2`. All were in-scope and updated.

## What was intentionally NOT changed
- `teams.admin_id` column kept as the team creator/owner pointer.
- `teams` INSERT policy unchanged (creating a team still requires
  `auth.uid() = admin_id`).
- No UI, no routes, no copy.
- No changes to the offline round queue, service worker, connectivity,
  realtime subscriptions, Hall of Fame, storage buckets, or auth flow.
- Pre-existing `pg_graphql` anon-introspection warnings — these are not
  caused by this phase and are out of scope.

## Manual seed: grant the first super admin

Run this once in the SQL editor. Replace the email with your account.

```sql
INSERT INTO public.app_roles (user_id, role, granted_by)
SELECT id, 'super_admin', id
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Verification

Database-layer checks performed after migration on the dev database:

- 2/2 teams have exactly one `team_members` row with `role='admin'` matching
  the previous `teams.admin_id` (criterion 8). 0 missing.
- All four helper functions present: `is_super_admin/0`, `is_team_admin/1`,
  `is_team_admin/2`, `is_team_member/2`.
- New tables `app_roles` and `super_admin_actions` exist with RLS enabled.

UI-level criteria 1–7 are unchanged at the data and policy layer — every
admin-scoped policy/RPC preserves its prior happy path for the existing
single team admin.