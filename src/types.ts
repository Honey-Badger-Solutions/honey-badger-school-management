export type Role = 'admin' | 'teacher'

export interface Grade {
  id: string // 'g5'
  level: number // 5
  name: string // 'Grade 5'
}

export interface Section {
  id: string // 'g5a'
  gradeId: string
  name: string // 'A'
  homeroomTeacherId: string | null
  /** Who held homeroom before it was cleared or reassigned. Departure clears
   *  `homeroomTeacherId`, but a report card printed for the term they taught
   *  must still carry their name — the signature line falls back to this. */
  previousHomeroomTeacherId: string | null
}

export interface Subject {
  id: string // 'amh'
  name: string
}

export interface Student {
  /** internal key — never shown to users */
  id: string
  /** the number this system issues and guarantees unique, e.g. '2018/0042' */
  studentNo: string
  /** the school's own reference — paper ledgers, a previous school's number.
   *  Free text, not unique, may be empty. */
  schoolRefNo: string
  firstName: string
  fatherName: string // Ethiopian convention: father's name follows given name
  sex: 'M' | 'F'
  gradeId: string
  sectionId: string
  guardianName: string
  guardianPhone: string
  joinedYear: string // academic year label
  status: 'active' | 'promoted' | 'left'
}

/** Fixed list — schools pick a title, they don't invent one. */
export type TeacherPosition = 'teacher' | 'senior_teacher' | 'head_of_department' | 'vice_principal'
export type EmploymentType = 'full_time' | 'part_time' | 'contract'
/** Teachers are never deleted — history keeps pointing at them. */
export type TeacherStatus = 'active' | 'on_leave' | 'departed'

export interface Teacher {
  id: string
  firstName: string
  fatherName: string
  sex: 'M' | 'F'
  position: TeacherPosition
  employmentType: EmploymentType
  hireDate: string // ISO
  /** Contact details are admin-only. Read them through `services/staff`
   *  (`visibleTeacher`/`canSeeContact`), never straight off this record —
   *  a teacher may see only their own. */
  phone: string
  email: string
  status: TeacherStatus
  /** ISO date, set when status becomes 'departed' */
  departedOn: string | null
  /** section+subject pairs this teacher teaches */
  assignments: { sectionId: string; subjectId: string }[]
}

export type AttendanceMark = 'P' | 'A' | 'L' // present / absent / late

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
  date: string
  sectionId: string
  studentId: string
  mark: AttendanceMark
  /** teacher who marked THIS student — kept so history still names a teacher
   *  who has since departed. Two records in one register can differ. */
  markedBy: string | null
  /** device clock, **display only** — "saved on this phone at…". Never read by
   *  ordering or conflict resolution; a phone three days fast would otherwise
   *  win every conflict forever. */
  clientRecordedAt: string
  /** server commit order. The ONLY thing any resolution may compare.
   *  Mocked locally until there is a server to allocate it. */
  serverSeq: number
  /** offline-friendly UI state */
  sync: 'local' | 'synced'
}

/** key: `${sectionId}|${date}|${studentId}` — see attKey() in lib/derive.ts */
export type AttendanceBook = Record<string, AttendanceRecord>

/**
 * The class-day itself. Submission is a property of the register as a whole —
 * a teacher declares "this class is done for today", not "this student is
 * done" — so it lives here rather than on every record.
 *
 * The row exists as soon as anything is marked; `submittedAt` stays null until
 * the teacher declares it complete. No row at all = nobody started.
 */
export interface RegisterDay {
  date: string
  sectionId: string
  submittedAt: string | null
}

/** key: `${sectionId}|${date}` — see regKey() in lib/derive.ts */
export type RegisterBook = Record<string, RegisterDay>

/**
 * The kinds of work a school marks. Fixed list — a school tunes the weights,
 * not the vocabulary, so report cards stay comparable between schools.
 */
export type AssessmentTypeId =
  | 'homework' | 'classwork' | 'exercise_book' | 'worksheets'
  | 'assignments' | 'tests' | 'exams' | 'final_exam'

export const ASSESSMENT_TYPE_IDS: AssessmentTypeId[] = [
  'homework', 'classwork', 'exercise_book', 'worksheets',
  'assignments', 'tests', 'exams', 'final_exam',
]

/** Percentage each kind contributes to a subject mark. Must total exactly 100. */
export type GradingWeights = Record<AssessmentTypeId, number>

/**
 * One piece of marked work for a class+subject — "Unit 2 test", "Homework 4".
 * Students are scored out of `maxMark`; the subject average is the weighted
 * combination of type averages (see lib/derive.ts).
 */
export interface Assessment {
  id: string
  sectionId: string
  subjectId: string
  type: AssessmentTypeId
  name: string
  maxMark: number
  date: string // ISO
  createdBy: string | null
}

/** key: `${assessmentId}|${studentId}` -> raw score out of that assessment's maxMark */
export type AssessmentScores = Record<string, number>

export interface ExamPeriod {
  id: string
  name: string
  term: string
  maxMark: number
}

/** key: `${examId}|${subjectId}|${studentId}` -> score */
export type MarkBook = Record<string, number>

/**
 * Who entered a mark and when.
 *
 * `actor` is the display name captured at write time — the only way an
 * administrator's edit resolves, since admins have no staff record here.
 * `teacherId` is set when a teacher entered it, so their current name can be
 * looked up live (and survives a rename); null means an administrator.
 */
export interface MarkEntryMeta {
  teacherId: string | null
  actor: string
  /** device clock, **display only** — "entered 3 Aug, 14:20" */
  at: string
  /** server commit order — what any resolution compares */
  serverSeq: number
}

/**
 * Provenance for each mark, keyed identically to MarkBook.
 *
 * Kept as a parallel map rather than nested inside MarkBook so that ranking,
 * report cards and the compliance query keep reading plain numbers. Every
 * saved mark gets an entry — a hole in the trail is worse than a correctly
 * identified admin edit.
 */
export type MarkAudit = Record<string, MarkEntryMeta>

export interface ReportComment {
  /** key `${examId}|${studentId}` */
  [key: string]: string
}

export interface FeeItem {
  id: string
  gradeId: string
  name: string
  amount: number // whole ETB
  kind: 'term' | 'annual'
}

export interface PaymentLine {
  feeItemId: string
  label: string
  amount: number
}

export interface Payment {
  id: string
  receiptNo: string // 'HB-0001'
  studentId: string
  lines: PaymentLine[]
  total: number
  /** business date — the day the money changed hands, client-set user intent */
  date: string
  method: 'cash' | 'bank' | 'telebirr'
  receivedBy: string
  /** device clock, **display only** */
  clientRecordedAt: string
  /** server commit order — orders the ledger, not `date` */
  serverSeq: number
}

/**
 * A device's claim on a range of receipt numbers.
 *
 * `next` walks from blockStart to blockEnd and stops. Held per device rather
 * than per user: a lease is about which machine is printing.
 */
export interface ReceiptLease {
  deviceId: string
  blockStart: number
  blockEnd: number
  /** the next number this device will issue */
  next: number
}

export interface SchoolSettings {
  schoolName: string
  schoolNameAm: string
  city: string
  phone: string
  academicYear: string // '2018 E.C. (2025/26)'
  term: string // 'Term 1'
  currentUser: string // name printed on receipts
}

export type AuditAction =
  | 'created'
  | 'assignment_added'
  | 'assignment_removed'
  | 'homeroom_set'
  | 'homeroom_cleared'
  | 'status_changed'
  | 'position_changed'
  | 'employment_changed'
  | 'contact_changed'
  | 'workload_transferred'
  | 'workload_received'

/** One staff change: who did it, what moved, and when. */
export interface AuditEntry {
  id: string
  /** device clock, **display only** */
  at: string
  /** server commit order — what orders the log, not `at` */
  serverSeq: number
  actor: string // display name of whoever made the change
  teacherId: string // whose record changed
  action: AuditAction
  before: string | null
  after: string | null
}

export interface Db {
  /** Schema version of this cached snapshot — see SCHEMA_VERSION in services/db.ts */
  version: number
  grades: Grade[]
  sections: Section[]
  subjects: Subject[]
  students: Student[]
  teachers: Teacher[]
  attendance: AttendanceBook
  /** submission state per class-day, parallel to `attendance` */
  registers: RegisterBook
  examPeriods: ExamPeriod[]
  /** how much each kind of work counts toward a subject mark */
  grading: GradingWeights
  assessments: Assessment[]
  assessmentScores: AssessmentScores
  marks: MarkBook
  /** parallel to `marks`: who entered each score, and when */
  markAudit: MarkAudit
  comments: ReportComment
  feeItems: FeeItem[]
  payments: Payment[]
  settings: SchoolSettings
  /** leases by deviceId — see services/receipts.ts */
  receiptLeases: Record<string, ReceiptLease>
  /** where the next block starts. The SERVER owns this; it lives here only
   *  because the prototype has no server to own it. */
  nextReceiptBlock: number
  /**
   * Mock of the server's per-school commit sequence (SYNC-DESIGN.md §2).
   * Allocated inside update() so it matches commit order, which is the whole
   * reason a timestamp cannot do this job.
   */
  nextServerSeq: number
  auditLog: AuditEntry[]
}
