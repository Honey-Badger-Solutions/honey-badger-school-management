import type { Db, Student } from '../types'
import { getDb, update, delay } from './db'
import { newId } from '../lib/id'

export interface RegisterStudentInput {
  firstName: string
  fatherName: string
  sex: 'M' | 'F'
  sectionId: string
  guardianName: string
  guardianPhone: string
  /** admin may accept the suggested number or type their own */
  studentNo: string
  /** the school's own reference — optional, not unique */
  schoolRefNo: string
}

/**
 * Next registration number for the current academic year: `<year>/<sequence>`.
 *
 * Continues from the highest sequence already ISSUED for that year, not from
 * the roll size and not from the last one in order. So if an admin types
 * 2018/0500 by hand, the next suggestion is 2018/0501 — a later automatic
 * number can never collide with a manual one, and a number is never reused
 * after a student leaves.
 *
 * The sequence is read as the final '/'-separated segment, which keeps working
 * if the prefix ever becomes configurable (e.g. 'PS/2018/045').
 */
export function suggestStudentNo(db: Pick<Db, 'students' | 'settings'>): string {
  const year = (db.settings.academicYear.match(/\d{4}/) ?? ['0000'])[0]
  const highest = db.students.reduce((max, s) => {
    const parts = s.studentNo.split('/')
    if (parts[parts.length - 2] !== year) return max // different year (or no year)
    const seq = Number(parts[parts.length - 1])
    return Number.isFinite(seq) ? Math.max(max, seq) : max
  }, 0)
  return `${year}/${String(highest + 1).padStart(4, '0')}`
}

/** The student already holding this number, if any. */
export function studentNoHolder(db: Pick<Db, 'students'>, studentNo: string, exceptId?: string) {
  const wanted = studentNo.trim().toLowerCase()
  return db.students.find((s) => s.id !== exceptId && s.studentNo.trim().toLowerCase() === wanted)
}

export async function registerStudent(input: RegisterStudentInput): Promise<Student> {
  await delay()
  const db = getDb()
  const section = db.sections.find((s) => s.id === input.sectionId)!
  // The form blocks duplicates too, but uniqueness is enforced here so it
  // holds for any caller.
  const studentNo = input.studentNo.trim() || suggestStudentNo(db)
  const clash = studentNoHolder(db, studentNo)
  if (clash) {
    throw new Error(`ID number ${studentNo} is already used by ${clash.firstName} ${clash.fatherName}.`)
  }
  const student: Student = {
    id: newId(),
    studentNo,
    schoolRefNo: input.schoolRefNo.trim(),
    firstName: input.firstName.trim(),
    fatherName: input.fatherName.trim(),
    sex: input.sex,
    gradeId: section.gradeId,
    sectionId: section.id,
    guardianName: input.guardianName.trim(),
    guardianPhone: input.guardianPhone.trim(),
    joinedYear: db.settings.academicYear,
    status: 'active',
  }
  update((d) => { d.students.push(student) })
  return student
}

/** Promote every student in `sectionId` except `holdBack` ids. Top grade → status 'promoted' (left roll). */
export async function promoteSection(sectionId: string, holdBack: string[]): Promise<{ promoted: number; kept: number }> {
  await delay(300)
  const db = getDb()
  const section = db.sections.find((s) => s.id === sectionId)!
  const grade = db.grades.find((g) => g.id === section.gradeId)!
  const nextGrade = db.grades.find((g) => g.level === grade.level + 1)
  const nextSection = nextGrade
    ? db.sections.find((s) => s.gradeId === nextGrade.id && s.name === section.name) ?? db.sections.find((s) => s.gradeId === nextGrade.id)
    : null
  let promoted = 0
  let kept = 0
  update((d) => {
    for (const st of d.students) {
      if (st.sectionId !== sectionId || st.status !== 'active') continue
      if (holdBack.includes(st.id)) { kept++; continue }
      if (nextGrade && nextSection) {
        st.gradeId = nextGrade.id
        st.sectionId = nextSection.id
      } else {
        st.status = 'promoted' // graduated out of the school's top grade
      }
      promoted++
    }
  })
  return { promoted, kept }
}
