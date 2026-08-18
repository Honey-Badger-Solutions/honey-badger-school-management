import type { AttendanceMark, Db } from '../types'
import { update, delay, takeSeq } from './db'
import { useSession } from '../store/session'
import { todayISO } from '../lib/dates'
import { attKey, regKey, recordsForDay } from '../lib/derive'

/**
 * Write exactly the students named in `changes` — **a patch, never a snapshot
 * of the whole register.**
 *
 * This signature is the point of the per-student storage, and storage alone
 * does not achieve it. If a device passed its whole view of the register, a
 * stale device would still overwrite another's edit: its "unchanged" value for
 * a student differs from what the other device just stored, so there is no way
 * to tell an unchanged cell from a deliberate one. Comparing against the
 * stored value cannot recover that intent — it is only knowable at the tap.
 *
 * So a caller may only name what the user actually touched. Silence about a
 * student is not an opinion about that student, and cannot become one.
 *
 * Optimistic: recorded immediately as 'local', flips to 'synced' after the
 * (mock) network round-trip.
 */
export async function saveMarks(sectionId: string, date: string, changes: Record<string, AttendanceMark>): Promise<void> {
  // stamped with whoever marked THIS student, so history still names them
  // after they leave the school
  const markedBy = useSession.getState().teacherId
  const touched: string[] = []

  update((d) => {
    ensureRegister(d, sectionId, date)
    for (const studentId in changes) {
      const key = attKey(sectionId, date, studentId)
      d.attendance[key] = {
        date, // business date — user intent, never derived from the clock below
        sectionId,
        studentId,
        mark: changes[studentId],
        markedBy: markedBy ?? d.attendance[key]?.markedBy ?? null,
        clientRecordedAt: new Date().toISOString(), // display only
        serverSeq: takeSeq(d),
        sync: 'local',
      }
      touched.push(key)
    }
  })

  if (touched.length === 0) return
  await delay(600)
  update((d) => {
    // settle only the records this call wrote; another device's edit landing in
    // between is not ours to mark synced
    for (const key of touched) {
      const rec = d.attendance[key]
      if (rec && rec.sync === 'local') rec.sync = 'synced'
    }
  })
}

/** The register row exists as soon as anything is marked; that is what makes
 *  "in progress" distinguishable from "nobody started". */
function ensureRegister(d: Db, sectionId: string, date: string): void {
  const key = regKey(sectionId, date)
  if (!d.registers[key]) d.registers[key] = { date, sectionId, submittedAt: null }
}

/* ------------------------------------------------------------------ *
 * Register state
 *
 * Three states, and the difference matters to a head teacher chasing
 * work: no register row at all (not started), row present but not
 * declared complete (in progress), and submitted.
 * ------------------------------------------------------------------ */

export type RegisterState = 'not_started' | 'in_progress' | 'submitted'

export function registerState(db: Db, sectionId: string, date: string): RegisterState {
  const reg = db.registers[regKey(sectionId, date)]
  if (!reg) return 'not_started'
  return reg.submittedAt ? 'submitted' : 'in_progress'
}

/** Who took this register — the teacher on most of its records. Records can
 *  legitimately differ (a substitute marking the students the homeroom teacher
 *  missed), so this is the majority, not a claim about every row. */
export function registerMarkedBy(db: Db, sectionId: string, date: string): string | null {
  const tally = new Map<string, number>()
  for (const rec of recordsForDay(db, sectionId, date)) {
    if (!rec.markedBy) continue
    tally.set(rec.markedBy, (tally.get(rec.markedBy) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [id, n] of tally) if (n > bestN) { best = id; bestN = n }
  return best
}

/**
 * Only today's register is editable by a teacher. Correcting a past day is an
 * administrator action — it needs a reason and an audit entry, because a
 * changed attendance record can affect a fee waiver or a truancy report.
 *
 * TODO(admin correction): add `correctAttendance(sectionId, date, studentId,
 * mark, reason)` here, guarded by assertAdmin() and writing to db.auditLog.
 * Note the per-student signature — a correction is about one student, which is
 * exactly why records are stored per student. The teacher screens must keep
 * calling saveAttendance and stay locked out.
 */
export function isEditable(date: string): boolean {
  return date === todayISO()
}

/** Declare the register complete. Per-tap autosave has already stored the
 *  marks; this only records that the teacher considers the day done. */
export async function submitRegister(sectionId: string, date: string): Promise<void> {
  await delay(250)
  update((d) => {
    ensureRegister(d, sectionId, date)
    d.registers[regKey(sectionId, date)].submittedAt = new Date().toISOString()
  })
}
