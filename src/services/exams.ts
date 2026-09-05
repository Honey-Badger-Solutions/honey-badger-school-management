import { update, delay, takeSeq } from './db'
import { newId } from '../lib/id'
import { actingUserId } from './users'

/**
 * Optimistic single-cell save used by the keyboard mark-entry grid.
 *
 * Every score is stamped with who entered it and when (d.markAudit), so a
 * grade dispute can be traced to a person and a time. An administrator
 * correcting a score is recorded as that administrator — never left blank,
 * since a hole in the trail is worse than a correctly identified admin edit.
 */
export async function saveMark(examId: string, subjectId: string, studentId: string, score: number | null): Promise<void> {
  const enteredByUserId = actingUserId()
  update((d) => {
    const key = `${examId}|${subjectId}|${studentId}`
    if (score === null) {
      delete d.marks[key]
      delete d.markAudit[key]
      return
    }
    d.marks[key] = score
    // An office correction resolves through enteredByUserId like any other
    // edit; teacherId is left null to mark that it did not come from the class.
    const teacher = d.teachers.find((x) => x.userId === enteredByUserId)
    d.markAudit[key] = {
      serverSeq: takeSeq(d),
      enteredByUserId,
      teacherId: teacher?.id ?? null,
      at: new Date().toISOString(),
    }
  })
  await delay(80)
}

export async function saveComment(examId: string, studentId: string, text: string): Promise<void> {
  await delay()
  update((d) => {
    const key = `${examId}|${studentId}`
    if (text.trim()) d.comments[key] = text.trim()
    else delete d.comments[key]
  })
}

export async function addExamPeriod(name: string, term: string, maxMark: number): Promise<void> {
  await delay()
  update((d) => {
    d.examPeriods.push({ id: newId(), name, term, maxMark })
  })
}
