import type { Db, SchoolSettings } from '../types'
import { getDb, update, delay, resetDb } from './db'
import { newId } from '../lib/id'

export async function saveSettings(patch: Partial<SchoolSettings>): Promise<void> {
  await delay()
  update((d) => { Object.assign(d.settings, patch) })
}

/* ------------------------------------------------------------------ *
 * School structure — grades and the classes inside them
 *
 * Structure changes are year-start work, so these only ever ADD. Removing a
 * grade or class would orphan students, attendance and marks; that needs a
 * merge-or-move flow, which is deliberately not built.
 * ------------------------------------------------------------------ */

/** Next grade level the school could add (one above its highest). */
export function suggestNextGrade(db: Pick<Db, 'grades'>): number {
  return db.grades.reduce((max, g) => Math.max(max, g.level), 0) + 1
}

/** Next unused class letter within a grade: A, B, C … */
export function suggestNextClassName(db: Pick<Db, 'sections'>, gradeId: string): string {
  const taken = new Set(db.sections.filter((s) => s.gradeId === gradeId).map((s) => s.name.toUpperCase()))
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!taken.has(letter)) return letter
  }
  return String(taken.size + 1)
}

export async function addGrade(level: number, name: string): Promise<void> {
  await delay()
  const db = getDb()
  if (db.grades.some((g) => g.level === level)) {
    throw new Error(`Grade ${level} already exists.`)
  }
  update((d) => {
    d.grades.push({ id: newId(), level, name: name.trim() || `Grade ${level}` })
    d.grades.sort((a, b) => a.level - b.level)
  })
}

export async function addSection(gradeId: string, name: string): Promise<void> {
  await delay()
  const db = getDb()
  const clean = name.trim().toUpperCase()
  if (db.sections.some((s) => s.gradeId === gradeId && s.name.toUpperCase() === clean)) {
    throw new Error(`That class already exists in this grade.`)
  }
  update((d) => {
    d.sections.push({
      id: newId(),
      gradeId,
      name: clean,
      homeroomTeacherId: null,
      previousHomeroomTeacherId: null,
    })
  })
}

export async function resetDemoData(): Promise<void> {
  await delay(300)
  resetDb()
}
