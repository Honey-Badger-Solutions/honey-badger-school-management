/**
 * Work compliance — not clock-in. It asks the data already in the system a
 * simple question: what is missing right now?
 *
 * Kept in the service layer (and free of UI imports) so it can become a
 * server-side query later without touching the dashboard. Returns teacher IDs
 * rather than names; the screen resolves them.
 */
import type { Db } from '../types'
import { todayISO } from '../lib/dates'
import { rosterOf } from '../lib/derive'
import { registerState, type RegisterState } from './attendance'

export interface AttendanceGap {
  sectionId: string
  /** homeroom teacher, or the previous holder if the section is between
   *  teachers — null when nobody is responsible yet */
  teacherId: string | null
  /** 'not_started' = no register at all; 'in_progress' = marks entered but the
   *  teacher hasn't declared it complete. Both are outstanding work, but a head
   *  teacher chases them differently. */
  state: Exclude<RegisterState, 'submitted'>
}

export interface MarksGap {
  sectionId: string
  subjectId: string
  /** teacher assigned to this section+subject, null if unassigned */
  teacherId: string | null
}

export interface Compliance {
  examId: string | null
  attendance: AttendanceGap[]
  marks: MarksGap[]
  clear: boolean
}

/** The exam period marks are currently being entered for. */
export function currentExamId(db: Db): string | null {
  return db.examPeriods[db.examPeriods.length - 1]?.id ?? null
}

export function getCompliance(db: Db, dateISO: string = todayISO()): Compliance {
  const examId = currentExamId(db)

  const attendance: AttendanceGap[] = db.sections
    .map((sec) => ({ sec, state: registerState(db, sec.id, dateISO) }))
    .filter((x): x is { sec: typeof x.sec; state: Exclude<RegisterState, 'submitted'> } => x.state !== 'submitted')
    .map(({ sec, state }) => ({
      sectionId: sec.id,
      teacherId: sec.homeroomTeacherId ?? sec.previousHomeroomTeacherId ?? null,
      state,
    }))

  const marks: MarksGap[] = []
  if (examId) {
    for (const sec of db.sections) {
      const roster = rosterOf(db, sec.id)
      if (roster.length === 0) continue
      for (const sub of db.subjects) {
        const anyEntered = roster.some((st) => db.marks[`${examId}|${sub.id}|${st.id}`] !== undefined)
        if (anyEntered) continue
        const owner = db.teachers.find(
          (x) => x.status !== 'departed' && x.assignments.some((a) => a.sectionId === sec.id && a.subjectId === sub.id),
        )
        marks.push({ sectionId: sec.id, subjectId: sub.id, teacherId: owner?.id ?? null })
      }
    }
  }

  return { examId, attendance, marks, clear: attendance.length === 0 && marks.length === 0 }
}
