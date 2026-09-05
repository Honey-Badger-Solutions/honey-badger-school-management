import type { AuditAction, AuditEntry, Db, Teacher, User } from '../types'
import { getDb, update, delay, takeSeq } from './db'
import { sectionLabel } from '../lib/derive'
import { newId } from '../lib/id'
import { actingUserId, assertPermission, can } from './users'

export interface TeacherInput {
  firstName: string
  fatherName: string
  sex: 'M' | 'F'
  position: Teacher['position']
  employmentType: Teacher['employmentType']
  hireDate: string
  phone: string
  email: string
}

/* ------------------------------------------------------------------ *
 * Access policy
 *
 * Contact details (phone, email) are ADMIN-ONLY. A teacher may read
 * their own and may not edit them. This is enforced here rather than by
 * hiding UI: every read goes through `visibleTeacher`/`visibleTeachers`,
 * which strip the fields, and every write goes through `assertAdmin`.
 * When this moves server-side the same two checks become the API guard.
 * ------------------------------------------------------------------ */

/**
 * True when the current user may read this teacher's phone/email.
 *
 * Two independent grounds: the `staff.view_contact` capability, or ownership —
 * everyone may read their own details. Ownership is compared on user id, not on
 * role, so it keeps working for any role that also holds a staff record.
 */
export function canSeeContact(teacherId: string): boolean {
  if (can('staff.view_contact')) return true
  const self = actingUserId()
  return self !== null && self === teacherId
}

const CONTACT_HIDDEN = ''

/* ------------------------------------------------------------------ *
 * Audit log — every staff change is recorded with actor + before/after
 * ------------------------------------------------------------------ */

/**
 * Append an entry. Called inside an update() draft so it commits atomically.
 *
 * Records the actor as a user id and nothing else. The display name is resolved
 * when the log is rendered, so renaming somebody re-labels their past actions
 * instead of leaving the log asserting a name they no longer have.
 */
function log(d: Db, subjectId: string, action: AuditAction, before: string | null, after: string | null): void {
  d.auditLog.unshift({
    serverSeq: takeSeq(d),
    id: newId(),
    at: new Date().toISOString(),
    actorUserId: actingUserId(),
    subjectTable: 'users',
    subjectId,
    action,
    before,
    after,
  })
}

/** Human-readable label for an assignment, for the log. */
function pairLabel(d: Db, sectionId: string, subjectId: string): string {
  return `${sectionLabel(d, sectionId)} — ${d.subjects.find((s) => s.id === subjectId)?.name ?? subjectId}`
}

/**
 * Everything recorded about one teacher, newest first.
 *
 * Ordered by commit sequence, not by `at` and not by array position. Insertion
 * order happens to match today because there is one writer; it stops matching
 * the moment entries arrive from a second device, and `at` is a device clock
 * that may be days out.
 */
export function auditFor(db: Db, teacherId: string): AuditEntry[] {
  return db.auditLog
    .filter((e) => e.subjectTable === 'users' && e.subjectId === teacherId)
    .sort((a, b) => b.serverSeq - a.serverSeq)
}

/** A teacher record with contact details stripped unless the caller may see them. */
export function visibleTeacher(teacher: Teacher): Teacher
export function visibleTeacher(teacher: Teacher | undefined): Teacher | undefined
export function visibleTeacher(teacher: Teacher | undefined): Teacher | undefined {
  if (!teacher) return undefined
  if (canSeeContact(teacher.id)) return teacher
  return { ...teacher, phone: CONTACT_HIDDEN, email: CONTACT_HIDDEN }
}

/** Every teacher, contact details stripped per caller. */
export function visibleTeachers(db: Db): Teacher[] {
  return db.teachers.map((x) => visibleTeacher(x))
}

/* ------------------------------------------------------------------ *
 * Writes — admin only
 * ------------------------------------------------------------------ */

/**
 * Add a teacher — and the account they sign in with.
 *
 * The two records are created together, sharing one id, because a staff member
 * without a user cannot be attributed to anything they do. Server-side this is
 * a single `users` row; the split exists only on this side.
 */
export async function addTeacher(input: TeacherInput): Promise<Teacher> {
  assertPermission('staff.create', 'adding a teacher')
  await delay()
  const id = newId()
  const schoolId = getDb().schoolId
  const firstName = input.firstName.trim()
  const fatherName = input.fatherName.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()

  const teacher: Teacher = {
    id,
    userId: id,
    schoolId,
    firstName,
    fatherName,
    sex: input.sex,
    position: input.position,
    employmentType: input.employmentType,
    hireDate: input.hireDate,
    phone,
    email,
    status: 'active',
    departedOn: null,
    assignments: [],
  }
  const user: User = {
    id,
    schoolId,
    firstName,
    fatherName,
    sex: input.sex,
    email,
    phone,
    role: 'teacher',
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  update((d) => {
    d.teachers.push(teacher)
    d.users.push(user)
    log(d, id, 'created', null, `${firstName} ${fatherName}`)
  })
  return teacher
}

export async function updateTeacher(id: string, patch: Partial<Teacher>): Promise<void> {
  assertPermission('staff.update', 'editing a teacher')
  await delay()
  update((d) => {
    const t = d.teachers.find((x) => x.id === id)
    if (!t) return
    // record each kind of change separately so the log reads plainly
    if (patch.position && patch.position !== t.position) {
      log(d, id, 'position_changed', t.position, patch.position)
    }
    if ((patch.employmentType && patch.employmentType !== t.employmentType) || (patch.hireDate && patch.hireDate !== t.hireDate)) {
      // '|' separated so the screen can translate the type and format the date
      log(d, id, 'employment_changed',
        `${t.employmentType}|${t.hireDate}`,
        `${patch.employmentType ?? t.employmentType}|${patch.hireDate ?? t.hireDate}`)
    }
    if ((patch.phone !== undefined && patch.phone !== t.phone) || (patch.email !== undefined && patch.email !== t.email)) {
      log(d, id, 'contact_changed', `${t.phone} · ${t.email}`, `${patch.phone ?? t.phone} · ${patch.email ?? t.email}`)
    }
    Object.assign(t, patch)
    // One person, one row server-side: the fields the two records share must
    // not be allowed to disagree.
    const user = d.users.find((u) => u.id === t.userId)
    if (user) {
      user.firstName = t.firstName
      user.fatherName = t.fatherName
      user.sex = t.sex
      user.phone = t.phone
      user.email = t.email
    }
  })
}

export async function setAssignments(id: string, assignments: Teacher['assignments']): Promise<void> {
  assertPermission('staff.assign', 'changing assignments')
  await delay()
  update((d) => {
    const t = d.teachers.find((x) => x.id === id)
    if (!t) return
    const has = (list: Teacher['assignments'], a: { sectionId: string; subjectId: string }) =>
      list.some((x) => x.sectionId === a.sectionId && x.subjectId === a.subjectId)
    for (const a of assignments) {
      if (!has(t.assignments, a)) log(d, id, 'assignment_added', null, pairLabel(d, a.sectionId, a.subjectId))
    }
    for (const a of t.assignments) {
      if (!has(assignments, a)) log(d, id, 'assignment_removed', pairLabel(d, a.sectionId, a.subjectId), null)
    }
    t.assignments = assignments
  })
}

/* ------------------------------------------------------------------ *
 * Status
 *
 * There is no hard delete. A departed teacher keeps their record so that
 * everything pointing at them historically still resolves to a name; they
 * are simply filtered out of the lists that hand out new work.
 * ------------------------------------------------------------------ */

/** Teachers eligible for new work — excludes departed staff. */
export function assignableTeachers(db: Db): Teacher[] {
  return db.teachers.filter((x) => x.status !== 'departed')
}

/* ------------------------------------------------------------------ *
 * Homeroom — lives on the section, edited from the teacher's profile
 * ------------------------------------------------------------------ */

/** The section this teacher is homeroom of, if any. */
export function homeroomOf(db: Db, teacherId: string): string | null {
  return db.sections.find((s) => s.homeroomTeacherId === teacherId)?.id ?? null
}

/** Who currently holds homeroom of this section (for the reassign warning). */
export function homeroomHolder(db: Db, sectionId: string): Teacher | undefined {
  const held = db.sections.find((s) => s.id === sectionId)?.homeroomTeacherId
  return held ? db.teachers.find((x) => x.id === held) : undefined
}

/**
 * Set (or clear, with null) a teacher's homeroom section.
 * A section has exactly one homeroom teacher, and a teacher holds at most one
 * section, so this both releases their old section and displaces any current
 * holder of the new one. Displaced holders are remembered on the section.
 */
export async function setHomeroom(teacherId: string, sectionId: string | null): Promise<void> {
  assertPermission('academic.assign_teachers', 'changing homeroom')
  await delay()
  update((d) => {
    // release whatever this teacher held
    for (const sec of d.sections) {
      if (sec.homeroomTeacherId === teacherId) {
        sec.previousHomeroomTeacherId = teacherId
        sec.homeroomTeacherId = null
        log(d, teacherId, 'homeroom_cleared', sectionLabel(d, sec.id), null)
      }
    }
    if (!sectionId) return
    const target = d.sections.find((s) => s.id === sectionId)
    if (!target) return
    if (target.homeroomTeacherId && target.homeroomTeacherId !== teacherId) {
      target.previousHomeroomTeacherId = target.homeroomTeacherId
      // the displaced teacher's own record should show they lost it
      log(d, target.homeroomTeacherId, 'homeroom_cleared', sectionLabel(d, target.id), null)
    }
    target.homeroomTeacherId = teacherId
    log(d, teacherId, 'homeroom_set', null, sectionLabel(d, target.id))
  })
}

/* ------------------------------------------------------------------ *
 * Replace teacher — hand a whole workload over in one step
 * ------------------------------------------------------------------ */

export interface TransferSelection {
  assignments: { sectionId: string; subjectId: string }[]
  /** section whose homeroom moves too, or null */
  homeroomSectionId: string | null
}

/** Everything a teacher currently holds, for the transfer preview. */
export function workloadOf(db: Db, teacherId: string): TransferSelection {
  const teacher = db.teachers.find((x) => x.id === teacherId)
  return {
    assignments: teacher ? [...teacher.assignments] : [],
    homeroomSectionId: homeroomOf(db, teacherId),
  }
}

/** Teachers who actually have something to hand over. */
export function teachersWithWorkload(db: Db): Teacher[] {
  return db.teachers.filter((x) => x.assignments.length > 0 || homeroomOf(db, x.id) !== null)
}

/**
 * Move the selected assignments (and optionally homeroom) from one teacher to
 * another. Applied as a single update so the two records never disagree.
 */
export async function transferWorkload(fromId: string, toId: string, sel: TransferSelection): Promise<void> {
  assertPermission('staff.transfer_workload', 'transferring a workload')
  await delay()
  update((d) => {
    const from = d.teachers.find((x) => x.id === fromId)
    const to = d.teachers.find((x) => x.id === toId)
    if (!from || !to) return

    const moving = sel.assignments
    const isMoving = (a: { sectionId: string; subjectId: string }) =>
      moving.some((m) => m.sectionId === a.sectionId && m.subjectId === a.subjectId)

    from.assignments = from.assignments.filter((a) => !isMoving(a))
    for (const m of moving) {
      const already = to.assignments.some((a) => a.sectionId === m.sectionId && a.subjectId === m.subjectId)
      if (!already) to.assignments.push({ sectionId: m.sectionId, subjectId: m.subjectId })
    }
    for (const m of moving) {
      const label = pairLabel(d, m.sectionId, m.subjectId)
      log(d, fromId, 'workload_transferred', label, `${to.firstName} ${to.fatherName}`)
      log(d, toId, 'workload_received', `${from.firstName} ${from.fatherName}`, label)
    }

    if (sel.homeroomSectionId) {
      // a teacher holds at most one homeroom, so release whatever the incoming
      // teacher already had before handing them this one
      for (const sec of d.sections) {
        if (sec.homeroomTeacherId === toId) {
          sec.previousHomeroomTeacherId = toId
          sec.homeroomTeacherId = null
          log(d, toId, 'homeroom_cleared', sectionLabel(d, sec.id), null)
        }
      }
      const target = d.sections.find((s) => s.id === sel.homeroomSectionId)
      if (target) {
        target.previousHomeroomTeacherId = target.homeroomTeacherId ?? target.previousHomeroomTeacherId
        if (target.homeroomTeacherId) log(d, target.homeroomTeacherId, 'homeroom_cleared', sectionLabel(d, target.id), null)
        target.homeroomTeacherId = toId
        log(d, toId, 'homeroom_set', null, sectionLabel(d, target.id))
      }
    }
  })
}

/** What a departure will actually do, so the confirm dialog can state it. */
export function departureImpact(db: Db, id: string): { assignments: number; homeroomSectionId: string | null } {
  const teacher = db.teachers.find((x) => x.id === id)
  return {
    assignments: teacher?.assignments.length ?? 0,
    homeroomSectionId: db.sections.find((s) => s.homeroomTeacherId === id)?.id ?? null,
  }
}

export async function setTeacherStatus(id: string, status: Teacher['status'], onISO: string): Promise<void> {
  assertPermission('staff.manage_status', 'changing a teacher’s status')
  await delay()
  update((d) => {
    const t = d.teachers.find((x) => x.id === id)
    if (!t) return
    log(d, id, 'status_changed', t.status, status)
    t.status = status
    // The account follows the staff record — a departed teacher must stop
    // being able to sign in, while their record and its history remain.
    const user = d.users.find((u) => u.id === t.userId)
    if (user) user.status = status
    if (status === 'departed') {
      t.departedOn = onISO
      for (const a of t.assignments) {
        log(d, id, 'assignment_removed', pairLabel(d, a.sectionId, a.subjectId), null)
      }
      t.assignments = []
      // Homeroom is released, but remembered: report cards for the term they
      // taught must still print their name (see Section.previousHomeroomTeacherId).
      for (const sec of d.sections) {
        if (sec.homeroomTeacherId === id) {
          sec.previousHomeroomTeacherId = id
          sec.homeroomTeacherId = null
          log(d, id, 'homeroom_cleared', sectionLabel(d, sec.id), null)
        }
      }
    } else {
      t.departedOn = null
    }
  })
}
