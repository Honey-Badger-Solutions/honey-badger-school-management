import { useDb } from '../../services/db'
import { useSession } from '../../store/session'
import type { Db, Teacher } from '../../types'

export interface TeacherCtx {
  db: Db
  /** null when the session's teacher id does not resolve — the route Guard
   *  ends the session in that case, so screens render nothing for one frame.
   *  Never substitute another teacher here: a mark saved under a borrowed
   *  identity is recorded against the wrong person. */
  teacher: Teacher | null
  sectionIds: string[]
  subjectsFor: (sectionId: string) => string[]
}

export function useTeacher(): TeacherCtx {
  const db = useDb()
  const teacherId = useSession((s) => s.teacherId)
  const teacher = db.teachers.find((x) => x.id === teacherId) ?? null
  const sectionIds = teacher ? [...new Set(teacher.assignments.map((a) => a.sectionId))] : []
  const subjectsFor = (sectionId: string) =>
    teacher ? teacher.assignments.filter((a) => a.sectionId === sectionId).map((a) => a.subjectId) : []
  return { db, teacher, sectionIds, subjectsFor }
}
