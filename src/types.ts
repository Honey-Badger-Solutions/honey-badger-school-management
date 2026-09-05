export type Role =
  | "saas-admin"
  | "school-admin"
  | "finance-officer"
  | "staff-admin"
  | "teacher"
  | "print-only-staff";

/**
 * Every role the app defines, for iterating and validating.
 *
 * These values are stored verbatim in `user_roles.role` — the schema's CHECK
 * constraint is being widened to this same list, so there is no translation
 * layer between the app's vocabulary and the database's. Keep the two in step:
 * adding a role here means widening that constraint in the same change.
 */
export const ROLES: Role[] = [
  "saas-admin",
  "school-admin",
  "finance-officer",
  "staff-admin",
  "teacher",
  "print-only-staff",
];

/** `users.status` — staff are never deleted, so this is how they leave. */
export type UserStatus = "active" | "on_leave" | "departed";

/**
 * A person who can sign in — the single identity every action is attributed to.
 *
 * Mirrors `public.users`, whose `id` IS the `auth.users` id: one row per person,
 * carrying both their identity and their staff record. That is why the staff
 * fields (position, employmentType, hireDate…) live on `Teacher` rather than
 * here — locally they are split for the app's benefit, but both halves resolve
 * to the same database row and the same UUID.
 *
 * Never identify a user by name, email or role: all three change, and history
 * that resolved on any of them would silently re-attribute itself.
 */
export interface User {
  /** uuid — `users.id`, which is also `auth.users.id` */
  id: string;
  /** `users.school_id` — the tenant boundary RLS enforces */
  schoolId: string;
  firstName: string; // users.first_name
  fatherName: string; // users.father_name
  sex: "M" | "F" | null;
  email: string;
  phone: string;
  /**
   * The app's role for this user. The database keeps roles in a separate
   * `user_roles` table keyed (user_id, role), so a user can hold several; the
   * prototype carries exactly one and picks it at login.
   */
  role: Role;
  status: UserStatus;
  createdAt: string; // ISO
}

/**
 * The tenant. Mirrors `public.schools`.
 *
 * Every other record carries `schoolId` back to this, because that is the
 * column every RLS policy in the schema filters on. The prototype has exactly
 * one school; the shape is here so that stops being an assumption.
 */
export interface School {
  id: string;
  name: string; // schools.name
  nameAm: string; // schools.name_amh
  phone: string;
  timezone: string;
  studentNoPrefix: string; // schools.student_no_prefix
  receiptPrefix: string; // schools.receipt_prefix
  status: "active" | "suspended";
  createdAt: string;
}

export interface Grade {
  id: string; // 'g5'
  level: number; // 5
  name: string; // 'Grade 5'
}

export interface Section {
  id: string; // 'g5a'
  gradeId: string;
  name: string; // 'A'
  homeroomTeacherId: string | null;
  /** Who held homeroom before it was cleared or reassigned. Departure clears
   *  `homeroomTeacherId`, but a report card printed for the term they taught
   *  must still carry their name — the signature line falls back to this. */
  previousHomeroomTeacherId: string | null;
}

export interface Subject {
  id: string; // 'amh'
  name: string;
}

export interface Student {
  /** internal key — never shown to users */
  id: string;
  /** the number this system issues and guarantees unique, e.g. '2018/0042' */
  studentNo: string;
  /** the school's own reference — paper ledgers, a previous school's number.
   *  Free text, not unique, may be empty. */
  schoolRefNo: string;
  firstName: string;
  fatherName: string; // Ethiopian convention: father's name follows given name
  sex: "M" | "F";
  gradeId: string;
  sectionId: string;
  guardianName: string;
  guardianPhone: string;
  joinedYear: string; // academic year label
  status: "active" | "promoted" | "left";
}

/** Fixed list — schools pick a title, they don't invent one. */
export type TeacherPosition =
  | "teacher"
  | "senior_teacher"
  | "head_of_department"
  | "vice_principal";
export type EmploymentType = "full_time" | "part_time" | "contract";
/** Teachers are never deleted — history keeps pointing at them. */
export type TeacherStatus = "active" | "on_leave" | "departed";

/**
 * A member of teaching staff.
 *
 * In the database this is not its own table: `public.users` carries both the
 * identity and every staff field below, so a teacher and their user account are
 * one row. Locally the two are kept apart because the app reasons about them
 * separately — but `id` and `userId` are deliberately the SAME uuid, exactly as
 * `users.id` is the same uuid as `auth.users.id`. That equality is what makes
 * the eventual mapping a projection rather than a migration.
 *
 * Not every user is a teacher: an administrator or cashier has a `User` and no
 * `Teacher`. Resolve one from the other through `services/users.ts`.
 */
export interface Teacher {
  /** uuid — equal to `userId`; both address the same `users` row */
  id: string;
  /** the `User` this staff record belongs to */
  userId: string;
  /** `users.school_id` */
  schoolId: string;
  firstName: string;
  fatherName: string;
  sex: "M" | "F";
  position: TeacherPosition;
  employmentType: EmploymentType;
  hireDate: string; // ISO
  /** Contact details are admin-only. Read them through `services/staff`
   *  (`visibleTeacher`/`canSeeContact`), never straight off this record —
   *  a teacher may see only their own. */
  phone: string;
  email: string;
  status: TeacherStatus;
  /** ISO date, set when status becomes 'departed' */
  departedOn: string | null;
  /** section+subject pairs this teacher teaches */
  assignments: { sectionId: string; subjectId: string }[];
}

export type AttendanceMark = "P" | "A" | "L"; // present / absent / late

/**
 * One student's status on one day — and the unit that syncs.
 *
 * This is deliberately not a map per (section, date). Two devices holding the
 * same register must not overwrite each other wholesale: a substitute covering
 * a sick homeroom teacher, the same teacher on a phone and a laptop, or an
 * office correction landing while a device is offline all write the same
 * class-day legitimately. One record per student means a conflict can only
 * ever be about the one student both sides actually touched.
 */
export interface AttendanceRecord {
  /** business date '2026-08-10' — the school day this register is for */
  date: string;
  sectionId: string;
  studentId: string;
  mark: AttendanceMark;
  /** `attendance_records.marked_by` — the USER who marked THIS student, kept so
   *  history still resolves to a person who has since left. Two records in one
   *  register can differ (a substitute finishing another's register). */
  markedByUserId: string | null;
  /** device clock, **display only** — "saved on this phone at…". Never read by
   *  ordering or conflict resolution; a phone three days fast would otherwise
   *  win every conflict forever. */
  clientRecordedAt: string;
  /** server commit order. The ONLY thing any resolution may compare.
   *  Mocked locally until there is a server to allocate it. */
  serverSeq: number;
  /** offline-friendly UI state */
  sync: "local" | "synced";
}

/** key: `${sectionId}|${date}|${studentId}` — see attKey() in lib/derive.ts */
export type AttendanceBook = Record<string, AttendanceRecord>;

/**
 * The class-day itself. Submission is a property of the register as a whole —
 * a teacher declares "this class is done for today", not "this student is
 * done" — so it lives here rather than on every record.
 *
 * The row exists as soon as anything is marked; `submittedAt` stays null until
 * the teacher declares it complete. No row at all = nobody started.
 */
export interface RegisterDay {
  date: string;
  sectionId: string;
  submittedAt: string | null;
}

/** key: `${sectionId}|${date}` — see regKey() in lib/derive.ts */
export type RegisterBook = Record<string, RegisterDay>;

/**
 * The kinds of work a school marks. Fixed list — a school tunes the weights,
 * not the vocabulary, so report cards stay comparable between schools.
 */
export type AssessmentTypeId =
  | "homework"
  | "classwork"
  | "exercise_book"
  | "worksheets"
  | "assignments"
  | "tests"
  | "exams"
  | "final_exam";

export const ASSESSMENT_TYPE_IDS: AssessmentTypeId[] = [
  "homework",
  "classwork",
  "exercise_book",
  "worksheets",
  "assignments",
  "tests",
  "exams",
  "final_exam",
];

/** Percentage each kind contributes to a subject mark. Must total exactly 100. */
export type GradingWeights = Record<AssessmentTypeId, number>;

/**
 * One piece of marked work for a class+subject — "Unit 2 test", "Homework 4".
 * Students are scored out of `maxMark`; the subject average is the weighted
 * combination of type averages (see lib/derive.ts).
 */
export interface Assessment {
  id: string;
  sectionId: string;
  subjectId: string;
  type: AssessmentTypeId;
  name: string;
  maxMark: number;
  date: string; // ISO
  /** `assessments.created_by` — NOT NULL in the schema, so this must always be
   *  set once writes go to the server. */
  createdByUserId: string | null;
}

/** key: `${assessmentId}|${studentId}` -> raw score out of that assessment's maxMark */
export type AssessmentScores = Record<string, number>;

export interface ExamPeriod {
  id: string;
  name: string;
  term: string;
  maxMark: number;
}

/** key: `${examId}|${subjectId}|${studentId}` -> score */
export type MarkBook = Record<string, number>;

/**
 * Who entered a mark and when.
 *
 * `enteredByUserId` (`assessment_scores.entered_by`) is the identity: every
 * person who can enter a mark now has a user account, so an administrator's
 * edit resolves the same way a teacher's does — no display name is captured at
 * write time any more, which is what made a rename rewrite history.
 *
 * `teacherId` is kept alongside it, set only when a teacher entered the mark.
 * It is redundant for identity (it equals the user id) but not for meaning: it
 * records that the mark came from the person who teaches the class rather than
 * from the office, which is the distinction a grade dispute turns on.
 */
export interface MarkEntryMeta {
  enteredByUserId: string | null;
  teacherId: string | null;
  /** device clock, **display only** — "entered 3 Aug, 14:20" */
  at: string;
  /** server commit order — what any resolution compares */
  serverSeq: number;
}

/**
 * Provenance for each mark, keyed identically to MarkBook.
 *
 * Kept as a parallel map rather than nested inside MarkBook so that ranking,
 * report cards and the compliance query keep reading plain numbers. Every
 * saved mark gets an entry — a hole in the trail is worse than a correctly
 * identified admin edit.
 */
export type MarkAudit = Record<string, MarkEntryMeta>;

export interface ReportComment {
  /** key `${examId}|${studentId}` */
  [key: string]: string;
}

export interface FeeItem {
  id: string;
  gradeId: string;
  name: string;
  amount: number; // whole ETB
  kind: "term" | "annual";
}

export interface PaymentLine {
  feeItemId: string;
  label: string;
  amount: number;
}

export interface Payment {
  id: string;
  receiptNo: string; // 'HB-0001'
  studentId: string;
  lines: PaymentLine[];
  total: number;
  /** business date — the day the money changed hands, client-set user intent */
  date: string;
  method: "cash" | "bank" | "telebirr";
  /** `payments.received_by` — the cashier's user id, NOT NULL in the schema.
   *  The receipt prints their current name, resolved live. */
  receivedByUserId: string;
  /** device clock, **display only** */
  clientRecordedAt: string;
  /** server commit order — orders the ledger, not `date` */
  serverSeq: number;
}

/**
 * A device's claim on a range of receipt numbers.
 *
 * `next` walks from blockStart to blockEnd and stops. Held per device rather
 * than per user: a lease is about which machine is printing.
 */
export interface ReceiptLease {
  deviceId: string;
  blockStart: number;
  blockEnd: number;
  /** the next number this device will issue */
  next: number;
}

/**
 * School-level settings the prototype keeps flat.
 *
 * The name/phone half now lives on `Db.school` (mirroring `public.schools`);
 * what remains here are the fields the schema models as their own tables —
 * `academic_years` and `terms` — plus `city`, which the schema has no column
 * for. They stay denormalised until those tables are wired up.
 *
 * There is deliberately no `currentUser`: who is signed in is a property of the
 * session, not of the school. It used to be a display name stored here, which
 * is why receipts and audit entries recorded names instead of identities.
 */
export interface SchoolSettings {
  city: string;
  academicYear: string; // '2018 E.C. (2025/26)' → academic_years.label
  term: string; // 'Term 1' → terms.name
}

export type AuditAction =
  | "created"
  | "assignment_added"
  | "assignment_removed"
  | "homeroom_set"
  | "homeroom_cleared"
  | "status_changed"
  | "position_changed"
  | "employment_changed"
  | "contact_changed"
  | "workload_transferred"
  | "workload_received";

/**
 * One recorded change: who did it, what it was done to, and when.
 *
 * Shaped after `public.audit_log`, which is generic — it addresses its subject
 * by (`subject_table`, `subject_id`) rather than having a column per entity, so
 * the same log can carry a payment void or a settings change later without a
 * schema change. Every entry the prototype writes today is about a staff
 * record, hence `subjectTable: 'users'`.
 *
 * `actorUserId` replaces the display name this used to store. A name captured
 * at write time is not an identity: rename the person and the history quietly
 * re-attributes itself. Names are resolved live from the user id at render.
 */
export interface AuditEntry {
  id: string;
  /** device clock, **display only** */
  at: string;
  /** server commit order — what orders the log, not `at` */
  serverSeq: number;
  /** `audit_log.actor_user_id` — null only if the actor is unknown */
  actorUserId: string | null;
  /** `audit_log.subject_table` — which table the changed row lives in */
  subjectTable: "users";
  /** `audit_log.subject_id` — the changed row; a teacher/user id today */
  subjectId: string;
  action: AuditAction;
  before: string | null;
  after: string | null;
}

export interface Db {
  /** Schema version of this cached snapshot — see SCHEMA_VERSION in services/db.ts */
  version: number;
  /**
   * The tenant every record in this snapshot belongs to.
   *
   * The prototype holds exactly one school, so this is also the value every
   * `schoolId` field carries. It is stored once, at the root, rather than being
   * implied: server-side this is the column RLS filters on, and code that never
   * had to name it is code that would have to be found and changed later.
   */
  schoolId: string;
  school: School;
  /** Everyone who can sign in. Never deleted — history points at them. */
  users: User[];
  grades: Grade[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  teachers: Teacher[];
  attendance: AttendanceBook;
  /** submission state per class-day, parallel to `attendance` */
  registers: RegisterBook;
  examPeriods: ExamPeriod[];
  /** how much each kind of work counts toward a subject mark */
  grading: GradingWeights;
  assessments: Assessment[];
  assessmentScores: AssessmentScores;
  marks: MarkBook;
  /** parallel to `marks`: who entered each score, and when */
  markAudit: MarkAudit;
  comments: ReportComment;
  feeItems: FeeItem[];
  payments: Payment[];
  settings: SchoolSettings;
  /** leases by deviceId — see services/receipts.ts */
  receiptLeases: Record<string, ReceiptLease>;
  /** where the next block starts. The SERVER owns this; it lives here only
   *  because the prototype has no server to own it. */
  nextReceiptBlock: number;
  /**
   * Mock of the server's per-school commit sequence (SYNC-DESIGN.md §2).
   * Allocated inside update() so it matches commit order, which is the whole
   * reason a timestamp cannot do this job.
   */
  nextServerSeq: number;
  auditLog: AuditEntry[];
}
