/**
 * Staff attendance — who was in today.
 *
 * Deliberately the same shape as the student register (`services/attendance`):
 * one record per person per day, written as a PATCH of only the people the user
 * actually touched, stamped with a business date and a `markedByUserId` that
 * outlives the marker. The reasoning is identical, so the code is too — see the
 * long note in `services/attendance.ts` about why a whole-register snapshot
 * cannot be allowed.
 *
 * Maps to `public.teacher_attendance`. That table exists but is shaped for
 * clock-in/clock-out; `mark` is the column it still needs.
 */
import type { AttendanceMark, Db, StaffAttendanceRecord, User } from '../types'
import { getDb, update, delay, takeSeq } from './db'
import { newId } from '../lib/id'
import { actingUserId, assertPermission } from './users'
import { todayISO } from '../lib/dates'

export const staffAttKey = (date: string, userId: string) => `${date}|${userId}`

/** Everyone whose attendance is taken: active staff of this school. */
export function staffRoster(db: Db): User[] {
  return db.users
    .filter((u) => u.schoolId === db.schoolId && u.status !== 'departed' && u.accountStatus === 'active')
    .sort((a, b) => a.firstName.localeCompare(b.firstName))
}

/** The marks recorded for one day, keyed by user id. */
export function marksOn(db: Db, date: string): Record<string, AttendanceMark> {
  const out: Record<string, AttendanceMark> = {}
  for (const user of staffRoster(db)) {
    const rec = db.staffAttendance[staffAttKey(date, user.id)]
    if (rec) out[user.id] = rec.mark
  }
  return out
}

export interface StaffDayCount {
  present: number
  absent: number
  late: number
  marked: number
  total: number
}

export function countDay(db: Db, date: string): StaffDayCount {
  const marks = marksOn(db, date)
  const values = Object.values(marks)
  return {
    present: values.filter((m) => m === 'P').length,
    absent: values.filter((m) => m === 'A').length,
    late: values.filter((m) => m === 'L').length,
    marked: values.length,
    total: staffRoster(db).length,
  }
}

/** One person's recent history, newest first. */
export function historyFor(db: Db, userId: string, days: string[]): StaffAttendanceRecord[] {
  return days
    .map((d) => db.staffAttendance[staffAttKey(d, userId)])
    .filter((r): r is StaffAttendanceRecord => !!r)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

/**
 * Write only the people named in `changes`.
 *
 * A patch, never a snapshot: silence about somebody is not an opinion about
 * them and must not become one. Same rule as the student register.
 */
export async function saveStaffMarks(
  date: string,
  changes: Record<string, AttendanceMark>,
): Promise<void> {
  assertPermission('staff_attendance.record', 'recording staff attendance')
  const markedByUserId = actingUserId()
  const schoolId = getDb().schoolId
  const ids = Object.keys(changes)
  if (ids.length === 0) return

  update((d) => {
    for (const userId of ids) {
      const key = staffAttKey(date, userId)
      const existing = d.staffAttendance[key]
      d.staffAttendance[key] = {
        id: existing?.id ?? newId(),
        schoolId,
        userId,
        date, // business date — user intent, never derived from the clock
        mark: changes[userId],
        markedByUserId: markedByUserId ?? existing?.markedByUserId ?? null,
        clientRecordedAt: new Date().toISOString(), // display only
        serverSeq: takeSeq(d),
      }
    }
  })
  await delay(300)
}

/**
 * Only today is editable.
 *
 * Same rule as the class register, for the same reason: a changed past record
 * can move a payroll or a leave calculation, so correcting one should be an
 * explicit, audited action rather than a silent edit. That correction flow is
 * not built yet — past days are read-only.
 */
export function isEditable(date: string): boolean {
  return date === todayISO()
}
