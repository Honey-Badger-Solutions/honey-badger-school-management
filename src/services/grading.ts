import type { Assessment, AssessmentTypeId, Db, GradingWeights } from '../types'
import { ASSESSMENT_TYPE_IDS } from '../types'
import { getDb, update, delay, takeSeq } from './db'
import { useSession } from '../store/session'
import { newId } from '../lib/id'

/* ------------------------------------------------------------------ *
 * Grading weights — how much each kind of work counts
 * ------------------------------------------------------------------ */

export const WEIGHT_TOTAL = 100

export function weightsTotal(w: GradingWeights): number {
  return ASSESSMENT_TYPE_IDS.reduce((sum, id) => sum + (Number(w[id]) || 0), 0)
}

/**
 * Why weights must total exactly 100: a subject mark is the weighted sum of
 * type averages. At 90 the best possible mark is 90; at 110 a student can pass
 * 100. Either way the report card lies, so the save is blocked rather than
 * silently normalised.
 */
export function weightsProblem(w: GradingWeights): { total: number; diff: number } | null {
  const total = weightsTotal(w)
  return total === WEIGHT_TOTAL ? null : { total, diff: total - WEIGHT_TOTAL }
}

export async function saveGrading(w: GradingWeights): Promise<void> {
  const problem = weightsProblem(w)
  if (problem) {
    throw new Error(`Weights total ${problem.total}%, not 100%.`)
  }
  await delay()
  update((d) => { d.grading = { ...w } })
}

/* ------------------------------------------------------------------ *
 * Assessments — the individual pieces of marked work
 * ------------------------------------------------------------------ */

export function assessmentsFor(db: Db, sectionId: string, subjectId: string): Assessment[] {
  return db.assessments
    .filter((a) => a.sectionId === sectionId && a.subjectId === subjectId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
}

export async function addAssessment(input: {
  sectionId: string
  subjectId: string
  type: AssessmentTypeId
  name: string
  maxMark: number
  date: string
}): Promise<Assessment> {
  await delay()
  const createdBy = useSession.getState().teacherId
  const assessment: Assessment = {
    id: newId(),
    sectionId: input.sectionId,
    subjectId: input.subjectId,
    type: input.type,
    name: input.name.trim(),
    maxMark: input.maxMark,
    date: input.date,
    createdBy,
  }
  update((d) => { d.assessments.push(assessment) })
  return assessment
}

export async function deleteAssessment(id: string): Promise<void> {
  await delay()
  update((d) => {
    d.assessments = d.assessments.filter((a) => a.id !== id)
    for (const key of Object.keys(d.assessmentScores)) {
      if (key.startsWith(`${id}|`)) delete d.assessmentScores[key]
    }
  })
}

/**
 * Save one score. Out-of-range is rejected by the caller; null clears.
 * Scores are raw marks out of the assessment's own maxMark — the conversion to
 * a percentage happens in derive.ts, so changing a maximum never rewrites data.
 */
export async function saveScore(assessmentId: string, studentId: string, score: number | null): Promise<void> {
  const enteredBy = useSession.getState().teacherId
  update((d) => {
    const key = `${assessmentId}|${studentId}`
    if (score === null) {
      delete d.assessmentScores[key]
      delete d.markAudit[key]
      return
    }
    d.assessmentScores[key] = score
    const teacher = enteredBy ? d.teachers.find((x) => x.id === enteredBy) : undefined
    d.markAudit[key] = {
      serverSeq: takeSeq(d),
      teacherId: teacher?.id ?? null,
      actor: teacher ? `${teacher.firstName} ${teacher.fatherName}` : d.settings.currentUser,
      at: new Date().toISOString(),
    }
  })
  await delay(80)
}

/** The db snapshot, for callers that need it outside React. */
export const currentDb = getDb
