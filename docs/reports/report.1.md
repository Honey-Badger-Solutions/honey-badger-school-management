# Prompt

- prompts.md.prompts [4]

# Response

Phase 1 — Identity: complete
Build/type-check: tsc --noEmit clean, vite build passes, zero console errors in the browser.

Files changed
New (8): services/auth.ts, services/profile.ts, services/onboarding.ts, pages/profile/Profile.tsx, pages/onboarding/Onboarding.tsx, lib/digest.ts, lib/enums.ts, config/routes.ts
Modified (16): types.ts, data/seed.ts, services/{db,users,staff,students,settings}.ts, App.tsx, components/Shell.tsx, pages/Login.tsx, i18n.ts, plus 6 pages for the sex alignment, and docs/CONVENTIONS.md.

Features implemented
Authentication — real email+password sign-in against a local credential store. Wrong password rejected with a deliberately non-enumerating message; departed and not-yet-activated accounts refused separately. Demo-account picker retained (there's no mail server).
Profile Settings — own-account page: name, sex, phone, profile picture (data URL, 256 KB cap), password change requiring the current one. Email is read-only — it identifies the Auth account.
Onboarding — a derived checklist, not a wizard. Steps are questions asked of the user's record, so completing one anywhere advances it. Non-blocking, with a "do this later" and a persistent Shell banner.
Multi-role — user.roles is now an array matching user_roles; the session holds one active role and permission checks run against that, never the union.
Data-model changes
User gained roles[], accountStatus, avatarUrl, onboardingCompletedAt, lastSignInAt; role removed. New Sex, AccountStatus, Credential types; Db.credentials added. SCHEMA_VERSION 17→18.

Mismatch resolved: sex now stores 'male'|'female' everywhere (User, Teacher, Student), matching the CHECK constraint. The 'M'/'F' short form moved to lib/enums.ts as a render-time concern — storage format shouldn't be a presentation decision.

Permissions
No new permission keys. Profile and onboarding are gated by ownership (actingUserId() === userId, re-checked in services/profile.ts), not by role — consistent with your rule 6. Phase 2's staff-invitation permissions will be added when they're actually used.

Verified end-to-end
Bad password rejected → correct password signs in → rename propagates live to the sidebar → password changed and re-used to sign in → new hire routed to onboarding at 2/3 → outstanding step links to profile → filling it reaches 3/3 → "Finish setup" enables → lands on role home with the banner gone and onboardingCompletedAt persisted.

Remaining limitations
Passwords are not secure and cannot be made secure here. The store is localStorage; lib/digest.ts is obfuscation. The sign-in screen says so and warns against typing a real password. This is the single biggest thing Supabase Auth replaces.
Avatars are data URLs inside the same localStorage budget as the database.
Adding a teacher now creates an invited account with no password — it can't sign in until Phase 2's OTP flow exists.
Onboarding has no document upload yet (your spec mentions "required files"); currently profile fields + picture.
Supabase Changes Required (Phase 1)
Definitely required

user_roles.role — widen CHECK to the six app roles (saas-admin, school-admin, finance-officer, staff-admin, teacher, print-only-staff); existing admin/registrar/cashier rows need a data migration.
public.users — add avatar_url text, onboarding_completed_at timestamptz, last_sign_in_at timestamptz, and account_status text CHECK (account_status IN ('invited','active')).
Storage — create an avatars bucket, one object per user id, with RLS allowing a user to write only their own.
RLS — policies for users (read own school, update only own row for profile fields) and user_roles (only users.assign_roles holders may write).
Auth config — enable email/password; decide whether email change is permitted (the UI currently forbids it).
Verify only
6. users.sex already accepts 'male'|'female' — confirm no legacy rows hold 'M'/'F'.
7. Confirm a trigger creates the public.users row on auth.users insert, and which side sets school_id.
8. students.sex — same value check.

Explicitly NOT needed: Db.credentials must never become a table — it is deleted when Auth lands.

Phase 1 is done and working. Say the word and I'll start Phase 2 (staff invitations, OTP flow, account management, staff attendance) — note that Phase 2 will need the teacher assignments and teacher_attendance mismatches resolved, since teacher_attendance already exists in your schema and I should match it rather than invent a shape.

