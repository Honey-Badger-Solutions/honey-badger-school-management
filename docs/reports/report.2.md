# Prompt

- prompts.md.prompts [5]

# Response

Phase 2 — Staff Management: complete
Build/type-check: tsc --noEmit clean, vite build passes, zero console errors.

Files changed
New (5): services/invitations.ts, services/staffAttendance.ts, pages/invite/AcceptInvite.tsx, pages/staff/Accounts.tsx, pages/staff/StaffAttendance.tsx
Modified (7): types.ts, data/seed.ts, config/permissions.ts, services/{db,staff}.ts, App.tsx, components/Shell.tsx, i18n.ts, lib/digest.ts, docs/CONVENTIONS.md

Features implemented
Staff invitations — School Admin and Staff Admin invite by name/email/phone/role. The invitee cannot choose their role; it's fixed on the user record before the code is minted.
OTP flow — public /accept-invite: verify emailed code → see the role you're accepting → set your own password → straight into onboarding. Resend and revoke supported.
Account management — searchable roster of all accounts in the school with name, email, roles, and status (Active / Invitation pending / Deactivated). Role changes and deactivate/reactivate, all school-scoped.
Staff attendance — P/A/L per person per day, following the class register (same buttons, recent-day strip, today-only editing). Differs in one place: marks are saved explicitly rather than per tap, since an office marking 17 colleagues wants to review before committing.
Architecture / data-model notes
No invitations table — an invitation is a User with accountStatus: 'invited' plus an OTP on its credential row. A parallel entity would mean two places claiming to know whether someone has an account.
Reused teacher_attendance rather than inventing staff_attendance, per your rule 7 — but that table is shaped for clock-in/clock-out, so it needs a mark column (see below).
User gained invitedByUserId / invitedAt. Db.staffAttendance added. SCHEMA_VERSION 18→19.
One screen serves both admin roles (pages/staff/), with useCan() expressing the difference — rather than the copy-per-role duplication already present in StaffProfile.
Bug found and fixed
The accounts list surfaced duplicate emails in the seed — two "Meron Tadesse", two "Selam Bekele", because teacher names are drawn from the same pools as office staff. Since email is the sign-in handle and auth.users.email is UNIQUE, that data could not exist in Supabase and the second user could never sign in. Seed emails are now uniquely suffixed; verified 18/18 unique.

Permissions added/changed
New: staff_attendance.view, staff_attendance.record — granted to school-admin and staff-admin.
Changed: staff-admin gained users.create, users.update, users.disable, users.assign_roles — inviting and deactivating colleagues is precisely that role's job.
Guard rails in the service layer, not just the UI: same-school check on every account action, and you cannot change your own roles or deactivate your own account.
Verified end-to-end
Staff-admin reaches Accounts (18 rows, pending invite shown) → invites a finance officer → code issued → redeemed at /accept-invite with the admin-assigned role displayed → password set → lands on onboarding → signs in independently with the new password → staff attendance goes 0/17 → 17/17 and persists. Integrity: 177 attendance records, 0 unresolved user or marker references, 0 cross-school rows.

Remaining limitations
No email delivery — codes are shown on screen. issueOtp returns plaintext, which is the single most prototype-only thing in Phase 2.
Past-day staff attendance is read-only; the audited correction flow isn't built.
Role editing is single-select even though roles[] supports several.
Self-protection rules (no self-deactivate, no self-role-change) are client-side only.
Supabase Changes Required (Phase 2)
Definitely required

teacher_attendance — add mark text NOT NULL CHECK (mark IN ('P','A','L')) and marked_by uuid REFERENCES public.users(id) (distinct from approved_by, which belongs to the unused approval workflow). Add UNIQUE (school_id, user_id, business_date) — one record per person per day.
public.users — add invited_by_user_id uuid REFERENCES public.users(id) and invited_at timestamptz.
Edge Function (service role) for invitations — auth.admin.inviteUserByEmail() cannot run client-side. Same for revokeInvitation, which must delete the auth.users row via auth.admin.deleteUser(), not just the profile row.
Auth config — enable invite emails, author the invitation template, set the invite-link redirect to /accept-invite, and set OTP expiry (app assumes ~7 days).
set_user_roles RPC — role changes are a delete+insert on user_roles and must be atomic; also set granted_by to the acting user.
RLS policies:
users — SELECT within own school_id; INSERT/UPDATE only for holders of users.create/users.update in that school; self-UPDATE restricted to profile columns (not roles, not status).
user_roles — write only by users.assign_roles holders in the same school, and must block self-escalation; this is currently only a client-side check.
teacher_attendance — SELECT/INSERT/UPDATE scoped to school_id with the staff_attendance.* permission.
Trigger or policy enforcing "cannot deactivate your own account" server-side.
Carried over from Phase 1 and still required: widen the user_roles.role CHECK to the six app roles.
Verify only
9. auth.users.email uniqueness — confirm no existing duplicates before import (this is what the seed bug would have violated).
10. Whether a trigger already creates public.users on auth.users insert, and which side sets school_id for an invited user — the app pins it to the inviter's school, which the trigger must preserve.
11. Indexes: teacher_attendance (school_id, business_date) and users (school_id, status) for the roster and day queries.

Phase 2 is done and working. Ready for Phase 3 (printing) when you are — that one will need the ETB vs santim mismatch resolved first, since receipt templates are exactly where money formatting becomes load-bearing.

