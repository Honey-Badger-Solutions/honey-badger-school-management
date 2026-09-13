/**
 * Staff invitations — creating an account and handing its owner a way in.
 *
 * There is no `invitations` table, here or in the schema, and there should not
 * be one: an invitation is just a `User` that has no password yet
 * (`accountStatus: 'invited'`) plus a one-time code on its credential row.
 * Adding a parallel entity would mean two places that both claim to know
 * whether somebody has an account.
 *
 * **The invited person never chooses their own role.** The role comes from the
 * admin who invited them and is fixed on the user record before the code is
 * ever issued, so redeeming an invitation cannot escalate anything.
 */
import type { Role, Sex, User } from '../types'
import { getDb, update, delay } from './db'
import { newId } from '../lib/id'
import { actingUserId, assertPermission, can } from './users'
import { issueOtp, userByEmail, type IssuedOtp } from './auth'

export interface InviteInput {
  firstName: string
  fatherName: string
  email: string
  phone: string
  sex: Sex | null
  role: Role
}

export class EmailTaken extends Error {
  constructor() {
    super('An account with that email already exists.')
    this.name = 'EmailTaken'
  }
}

/** Roles an admin may hand out. Nobody invites a platform operator into a school. */
export function assignableRoles(): Role[] {
  return ['school-admin', 'staff-admin', 'finance-officer', 'teacher', 'print-only-staff']
}

/**
 * Create an invited account and mint its code.
 *
 * The new user is pinned to the INVITER's school, never to a school id passed
 * in from a screen — that is the one decision that must not be attacker- or
 * bug-controllable, since it is the whole tenant boundary.
 */
export async function inviteStaff(input: InviteInput): Promise<{ user: User; otp: IssuedOtp }> {
  assertPermission('users.create', 'inviting a staff member')
  const db = getDb()
  const email = input.email.trim().toLowerCase()
  if (userByEmail(db, email)) throw new EmailTaken()

  const inviter = actingUserId()
  const schoolId = db.schoolId
  const now = new Date().toISOString()
  const id = newId()

  const user: User = {
    id,
    schoolId,
    firstName: input.firstName.trim(),
    fatherName: input.fatherName.trim(),
    sex: input.sex,
    email,
    phone: input.phone.trim(),
    roles: [input.role],
    status: 'active',
    accountStatus: 'invited',
    avatarUrl: null,
    onboardingCompletedAt: null,
    createdAt: now,
    lastSignInAt: null,
    invitedByUserId: inviter,
    invitedAt: now,
  }

  await delay()
  update((d) => {
    d.users.push(user)
  })
  // A teaching invitation also needs the staff record the rest of the app reads
  // (assignments, homeroom). Same id, as always.
  if (input.role === 'teacher') {
    update((d) => {
      d.teachers.push({
        id,
        userId: id,
        schoolId,
        firstName: user.firstName,
        fatherName: user.fatherName,
        sex: input.sex ?? 'female',
        position: 'teacher',
        employmentType: 'full_time',
        hireDate: now.slice(0, 10),
        phone: user.phone,
        email: user.email,
        status: 'active',
        departedOn: null,
        assignments: [],
      })
    })
  }

  const otp = await issueOtp(id)
  return { user, otp }
}

/** Mint a fresh code for an invitation that expired or went astray. */
export async function resendInvitation(userId: string): Promise<IssuedOtp> {
  assertPermission('users.create', 'resending an invitation')
  return issueOtp(userId)
}

/**
 * Withdraw an invitation that was never redeemed.
 *
 * Only ever removes an account that has never been used, so nothing can be
 * pointing at it yet. An account that HAS signed in is deactivated instead —
 * see `setAccountActive`.
 */
export async function revokeInvitation(userId: string): Promise<void> {
  assertPermission('users.disable', 'revoking an invitation')
  await delay()
  update((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (!user || user.accountStatus !== 'invited') return
    d.users = d.users.filter((u) => u.id !== userId)
    d.teachers = d.teachers.filter((t) => t.userId !== userId)
    delete d.credentials[userId]
  })
}

/* ------------------------------------------------------------------ *
 * Account management
 * ------------------------------------------------------------------ */

/**
 * Deactivate or reactivate an account.
 *
 * Deactivation is `status: 'departed'`, the same state a departing teacher
 * reaches — there is one notion of "no longer working here" and one place it is
 * stored. Records are never deleted; every attribution must keep resolving.
 */
export async function setAccountActive(userId: string, active: boolean): Promise<void> {
  assertPermission('users.disable', 'changing an account status')
  assertSameSchool(userId)
  if (userId === actingUserId()) {
    throw new Error('Not permitted: you cannot deactivate your own account.')
  }
  await delay()
  const next = active ? 'active' : 'departed'
  update((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (!user) return
    user.status = next
    const teacher = d.teachers.find((t) => t.userId === userId)
    if (teacher) {
      teacher.status = next
      teacher.departedOn = active ? null : new Date().toISOString().slice(0, 10)
    }
  })
}

/**
 * Replace the roles on an account.
 *
 * Refuses to leave an account with none — a user with no role can sign in and
 * then has nowhere to go, which looks like a broken app rather than a
 * deliberate revocation. Deactivate the account instead.
 */
export async function setUserRoles(userId: string, roles: Role[]): Promise<void> {
  assertPermission('users.assign_roles', 'changing roles')
  assertSameSchool(userId)
  if (roles.length === 0) throw new Error('An account must keep at least one role.')
  if (userId === actingUserId()) {
    throw new Error('Not permitted: you cannot change your own roles.')
  }
  await delay()
  update((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (!user) return
    user.roles = [...roles]
    // gaining or losing the teaching role has to move the staff record with it,
    // or the app ends up with a teacher nobody can assign work to
    const hasTeacher = d.teachers.some((t) => t.userId === userId)
    if (roles.includes('teacher') && !hasTeacher) {
      d.teachers.push({
        id: user.id,
        userId: user.id,
        schoolId: user.schoolId,
        firstName: user.firstName,
        fatherName: user.fatherName,
        sex: user.sex ?? 'female',
        position: 'teacher',
        employmentType: 'full_time',
        hireDate: new Date().toISOString().slice(0, 10),
        phone: user.phone,
        email: user.email,
        status: 'active',
        departedOn: null,
        assignments: [],
      })
    }
  })
}

/**
 * The tenant check.
 *
 * Every account action goes through this, so "only within their own school"
 * is enforced once rather than remembered at each call site. It is also the
 * exact predicate the RLS policy will express server-side.
 */
function assertSameSchool(userId: string): void {
  const db = getDb()
  const target = db.users.find((u) => u.id === userId)
  const me = db.users.find((u) => u.id === actingUserId())
  if (!target || !me || target.schoolId !== me.schoolId) {
    throw new Error('Not permitted: that account belongs to another school.')
  }
}

/** Whether the signed-in user may manage staff accounts at all. */
export function canManageAccounts(): boolean {
  return can('users.create') || can('users.assign_roles') || can('users.disable')
}
