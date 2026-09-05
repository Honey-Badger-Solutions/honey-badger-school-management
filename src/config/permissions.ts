/**
 * What each role is allowed to do — the single place authorization is decided.
 *
 * Permissions are named capabilities, not role checks. A screen asks "may this
 * person record a payment?", never "is this person a finance officer?", so that
 * granting an existing capability to a new role is one edit here rather than a
 * hunt through components. The vocabulary is the one specified in
 * `docs/ROLES_AND_RBAC.md`.
 *
 * **This is not security.** It decides what the UI offers and what the service
 * layer refuses locally; the same map has to exist as RLS policies and
 * server-side checks before any of it is enforceable (ROLES_AND_RBAC.md §3–4).
 * Treat it as the client's copy of a rule the server owns.
 *
 * Pure module — no React, no store imports. Components read it through
 * `useCan()` in `store/session.ts`; services read it through
 * `assertPermission()` in `services/users.ts`.
 */
import type { Role } from "../types";

export const PERMISSIONS = [
  // students
  "students.view",
  "students.create",
  "students.update",
  "students.enroll",
  "students.promote",
  "students.manage_guardians",
  "students.manage_ids",
  // staff
  "staff.view",
  "staff.create",
  "staff.update",
  "staff.assign",
  "staff.manage_status",
  "staff.transfer_workload",
  /** Read phone/email on a staff record. Everyone may always read their OWN —
   *  that is an ownership rule, not a permission, and lives in services/staff. */
  "staff.view_contact",
  // academic structure
  "academic.view",
  "academic.manage_years",
  "academic.manage_terms",
  "academic.manage_grades",
  "academic.manage_sections",
  "academic.manage_subjects",
  "academic.assign_teachers",
  // attendance
  "attendance.view",
  "attendance.record",
  "attendance.update",
  "attendance.submit",
  /** Change a PAST register. Deliberately separate from `update`: a correction
   *  after the day is closed can move a fee waiver or a truancy report. */
  "attendance.correct",
  // assessments
  "assessments.view",
  "assessments.create",
  "assessments.update",
  "assessments.enter_marks",
  "assessments.correct_marks",
  // exams
  "exams.view",
  "exams.create",
  "exams.update",
  "exams.manage_marks",
  "exams.publish",
  // finance
  "fees.view",
  "fees.configure",
  "fees.record_payment",
  "fees.correct_payment",
  "fees.view_reports",
  "fees.generate_receipts",
  // reports
  "reports.view",
  "reports.generate",
  "reports.print",
  // users & security
  "users.view",
  "users.create",
  "users.update",
  "users.disable",
  "users.assign_roles",
  "audit.view",
  // school configuration
  "school.view",
  "school.update",
  "school.manage_settings",
  // platform (SaaS admin only — above the school boundary)
  "platform.manage_schools",
  "platform.view_usage",
  "platform.manage_settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Everything a read-only role gets: look, print, change nothing. */
const READ_ONLY: readonly Permission[] = [
  "students.view",
  "staff.view",
  "academic.view",
  "attendance.view",
  "assessments.view",
  "exams.view",
  "fees.view",
  "reports.view",
  "reports.generate",
  "reports.print",
  "school.view",
];

/**
 * Role → capabilities.
 *
 * Least privilege: a role gets a permission because its job needs it, not
 * because it is senior. Note what the admin roles do NOT have — a school admin
 * cannot record attendance or enter marks, because those are claims about a
 * classroom they were not in; they get `attendance.correct` and
 * `exams.manage_marks` instead, which are audited corrections.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Platform operator. Deliberately thin on school data: ROLES_AND_RBAC.md
  // says access to a school's records should be controlled and audited, so
  // running a school is not something this role can quietly do.
  "saas-admin": [
    "platform.manage_schools",
    "platform.view_usage",
    "platform.manage_settings",
    "school.view",
    "users.view",
    "users.create",
    "users.assign_roles",
    "audit.view",
  ],

  "school-admin": [
    "students.view",
    "students.create",
    "students.update",
    "students.enroll",
    "students.promote",
    "students.manage_guardians",
    "students.manage_ids",
    "staff.view",
    "staff.create",
    "staff.update",
    "staff.assign",
    "staff.manage_status",
    "staff.transfer_workload",
    "staff.view_contact",
    "academic.view",
    "academic.manage_years",
    "academic.manage_terms",
    "academic.manage_grades",
    "academic.manage_sections",
    "academic.manage_subjects",
    "academic.assign_teachers",
    "attendance.view",
    "attendance.correct",
    "assessments.view",
    "assessments.correct_marks",
    "exams.view",
    "exams.create",
    "exams.update",
    "exams.manage_marks",
    "exams.publish",
    "fees.view",
    "fees.configure",
    "fees.view_reports",
    "reports.view",
    "reports.generate",
    "reports.print",
    "users.view",
    "users.create",
    "users.update",
    "users.disable",
    "users.assign_roles",
    "audit.view",
    "school.view",
    "school.update",
    "school.manage_settings",
  ],

  // Staff records and workload only — no students, no money, no marks.
  "staff-admin": [
    "staff.view",
    "staff.create",
    "staff.update",
    "staff.assign",
    "staff.manage_status",
    "staff.transfer_workload",
    "staff.view_contact",
    "academic.view",
    "academic.assign_teachers",
    "attendance.view",
    "users.view",
    "audit.view",
    "reports.view",
    "reports.generate",
    "reports.print",
    "school.view",
  ],

  // Money only. Reads students because a payment is against a named child;
  // holds no academic write permission at all (ROLES_AND_RBAC.md §7).
  "finance-officer": [
    "students.view",
    "fees.view",
    "fees.configure",
    "fees.record_payment",
    "fees.correct_payment",
    "fees.view_reports",
    "fees.generate_receipts",
    "reports.view",
    "reports.generate",
    "reports.print",
    "audit.view",
    "school.view",
  ],

  // Scope is narrowed further by assignment: these permissions apply only to
  // the classes and subjects this teacher holds. That narrowing is ownership,
  // enforced in services/pages against `teacher.assignments`, not here.
  teacher: [
    "students.view",
    "staff.view",
    "academic.view",
    "attendance.view",
    "attendance.record",
    "attendance.update",
    "attendance.submit",
    "assessments.view",
    "assessments.create",
    "assessments.update",
    "assessments.enter_marks",
    "exams.view",
    "reports.view",
    "school.view",
  ],

  "print-only-staff": READ_ONLY,
};

/** Prebuilt sets — permission checks run on every render of every guarded UI. */
const SETS = new Map<Role, ReadonlySet<Permission>>(
  (Object.keys(ROLE_PERMISSIONS) as Role[]).map((role) => [role, new Set(ROLE_PERMISSIONS[role])]),
);

/** Everything this role may do. Empty for a signed-out session. */
export function permissionsFor(role: Role | null): readonly Permission[] {
  return role ? ROLE_PERMISSIONS[role] : [];
}

/**
 * May this role do this?
 *
 * A null role is a signed-out session and is always denied — callers can pass
 * `session.role` straight in without a null check of their own.
 */
export function hasPermission(role: Role | null, permission: Permission): boolean {
  return role ? (SETS.get(role)?.has(permission) ?? false) : false;
}

/** True when the role holds at least one of these — for "can see this screen at all". */
export function hasAnyPermission(role: Role | null, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** True only when the role holds every one — for actions that need a combination. */
export function hasAllPermissions(role: Role | null, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}
