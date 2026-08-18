/** Pure read-model helpers shared by screens and print views. */
import type { AttendanceMark, AttendanceRecord, Db, Student } from '../types'

export function sectionLabel(db: Db, sectionId: string): string {
  const sec = db.sections.find((s) => s.id === sectionId)
  if (!sec) return '—'
  const grade = db.grades.find((g) => g.id === sec.gradeId)
  return `${grade?.name ?? ''}${sec.name}` // 'Grade 5A'
}

export function rosterOf(db: Db, sectionId: string): Student[] {
  return db.students
    .filter((s) => s.sectionId === sectionId && s.status === 'active')
    .sort((a, b) => (a.firstName + a.fatherName).localeCompare(b.firstName + b.fatherName))
}

export interface AttendanceCount { present: number; absent: number; late: number; total: number }

export function countMarks(marks: Record<string, 'P' | 'A' | 'L'>): AttendanceCount {
  let present = 0, absent = 0, late = 0
  for (const m of Object.values(marks)) {
    if (m === 'P') present++
    else if (m === 'A') absent++
    else late++
  }
  return { present, absent, late, total: present + absent + late }
}

/* ---- attendance keys ----------------------------------------------- *
 * Both books are keyed maps rather than arrays, matching how `marks` and
 * `assessmentScores` are already stored. Build keys through these helpers so
 * the separator never has to be remembered at a call site.
 * -------------------------------------------------------------------- */

export const attKey = (sectionId: string, date: string, studentId: string) =>
  `${sectionId}|${date}|${studentId}`

export const regKey = (sectionId: string, date: string) => `${sectionId}|${date}`

/** every stored record for one class-day */
export function recordsForDay(db: Db, sectionId: string, date: string): AttendanceRecord[] {
  const prefix = `${sectionId}|${date}|`
  const out: AttendanceRecord[] = []
  for (const key in db.attendance) if (key.startsWith(prefix)) out.push(db.attendance[key])
  return out
}

/** one class-day as studentId -> mark, the shape the register UI works in */
export function marksForDay(db: Db, sectionId: string, date: string): Record<string, AttendanceMark> {
  const out: Record<string, AttendanceMark> = {}
  for (const rec of recordsForDay(db, sectionId, date)) out[rec.studentId] = rec.mark
  return out
}

/** every section's marks for one date, in a single pass — the dashboard reads
 *  all six classes at once and should not scan the book six times */
export function marksBySectionOn(db: Db, date: string): Map<string, Record<string, AttendanceMark>> {
  const out = new Map<string, Record<string, AttendanceMark>>()
  for (const key in db.attendance) {
    const rec = db.attendance[key]
    if (rec.date !== date) continue
    let bucket = out.get(rec.sectionId)
    if (!bucket) { bucket = {}; out.set(rec.sectionId, bucket) }
    bucket[rec.studentId] = rec.mark
  }
  return out
}

/** attendance stats for one student across the stored term */
export function studentAttendance(db: Db, studentId: string): AttendanceCount {
  let present = 0, absent = 0, late = 0
  for (const key in db.attendance) {
    const rec = db.attendance[key]
    if (rec.studentId !== studentId) continue
    if (rec.mark === 'P') present++
    else if (rec.mark === 'A') absent++
    else late++
  }
  return { present, absent, late, total: present + absent + late }
}

/** a student's non-present days, newest first — the profile's attendance tab */
export function studentExceptions(db: Db, studentId: string): AttendanceRecord[] {
  const out: AttendanceRecord[] = []
  for (const key in db.attendance) {
    const rec = db.attendance[key]
    if (rec.studentId === studentId && rec.mark !== 'P') out.push(rec)
  }
  return out.sort((a, b) => (a.date > b.date ? -1 : 1))
}

export function markOf(db: Db, examId: string, subjectId: string, studentId: string): number | null {
  return db.marks[`${examId}|${subjectId}|${studentId}`] ?? null
}

export interface ReportRow {
  student: Student
  scores: (number | null)[] // aligned with db.subjects
  total: number
  /** Rounded to the 1 decimal place that gets PRINTED — ranking uses this same
   *  number, so a report card can never show two equal averages at different
   *  ranks (or two different averages sharing one). */
  average: number | null
  rank: number
}

/** One decimal place — the precision every screen and report card displays. */
const roundAvg = (n: number) => Math.round(n * 10) / 10

/** Per-section report table with averages + rank (ties share a rank). */
export function sectionReport(db: Db, examId: string, sectionId: string): ReportRow[] {
  const roster = rosterOf(db, sectionId)
  const rows = roster.map((student) => {
    const scores = db.subjects.map((sub) => markOf(db, examId, sub.id, student.id))
    const present = scores.filter((s): s is number => s !== null)
    const total = present.reduce((a, b) => a + b, 0)
    const average = present.length ? roundAvg(total / present.length) : null
    return { student, scores, total, average, rank: 0 }
  })
  const ranked = [...rows].filter((r) => r.average !== null).sort((a, b) => b.average! - a.average!)
  ranked.forEach((r, i) => {
    r.rank = i > 0 && ranked[i - 1].average === r.average ? ranked[i - 1].rank : i + 1
  })
  return rows
}

export function classAverage(rows: ReportRow[]): number | null {
  const vals = rows.map((r) => r.average).filter((a): a is number => a !== null)
  if (!vals.length) return null
  return roundAvg(vals.reduce((a, b) => a + b, 0) / vals.length)
}
