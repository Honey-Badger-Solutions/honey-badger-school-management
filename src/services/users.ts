/**
 * Users — identity lookups and the authorization gate for the service layer.
 *
 * Every write in `services/` that records who did something goes through
 * `actingUserId()`, and every write that is restricted goes through
 * `assertPermission()`. Keeping both here means there is one definition of
 * "who am I" and one of "may I", rather than each service reaching into the
 * session and comparing role strings.
 *
 * Names are always resolved from an id at read time (`userName`), never stored
 * alongside the record. That is the difference between a trail that survives a
 * rename and one that quietly rewrites itself.
 */
import type { Db, Role, Teacher, User } from '../types'
import { getDb } from './db'
import { useSession } from '../store/session'
import { hasPermission, type Permission } from '../config/permissions'

/** Display name for a user record. Ethiopian convention: given name first. */
export function fullName(u: Pick<User, 'firstName' | 'fatherName'>): string {
  return `${u.firstName} ${u.fatherName}`
}

export function userById(db: Db, userId: string | null | undefined): User | undefined {
  if (!userId) return undefined
  return db.users.find((u) => u.id === userId)
}

/**
 * The name to print for a user id.
 *
 * Falls back to a marker rather than an empty string: a receipt or audit row
 * that silently loses its attribution reads as though nobody did it, which is
 * worse than showing that the record points somewhere unresolvable.
 */
export function userName(db: Db, userId: string | null | undefined): string {
  const user = userById(db, userId)
  return user ? fullName(user) : '—'
}

export function usersByRole(db: Db, role: Role): User[] {
  return db.users.filter((u) => u.role === role)
}

/** The staff record for a user, if they have one. Not every user is a teacher. */
export function teacherForUser(db: Db, userId: string | null | undefined): Teacher | undefined {
  if (!userId) return undefined
  return db.teachers.find((t) => t.userId === userId)
}

/** The user account behind a staff record. */
export function userForTeacher(db: Db, teacherId: string): User | undefined {
  const teacher = db.teachers.find((t) => t.id === teacherId)
  return userById(db, teacher?.userId)
}

/* ------------------------------------------------------------------ *
 * The signed-in user
 * ------------------------------------------------------------------ */

/** The signed-in user id, or null when signed out. */
export function actingUserId(): string | null {
  return useSession.getState().userId
}

/** The signed-in user's full record, resolved against the given snapshot. */
export function currentUser(db: Db): User | null {
  return userById(db, actingUserId()) ?? null
}

/** The signed-in user, resolved against the live snapshot. For non-React callers. */
export function actingUser(): User | null {
  return currentUser(getDb())
}

/* ------------------------------------------------------------------ *
 * Authorization
 * ------------------------------------------------------------------ */

/** True when the signed-in role holds this permission. */
export function can(permission: Permission): boolean {
  return hasPermission(useSession.getState().role, permission)
}

/**
 * Refuse an unpermitted write.
 *
 * Throws rather than returning false so a caller cannot proceed by ignoring the
 * result. This is the local stand-in for the server-side check and the RLS
 * policy that must both exist before it means anything — it stops the UI
 * offering an action, it does not secure it.
 */
export function assertPermission(permission: Permission, action: string): void {
  if (!can(permission)) {
    throw new Error(`Not permitted: ${action} requires ${permission}.`)
  }
}
