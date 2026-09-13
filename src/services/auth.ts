/**
 * Sign-in, passwords and one-time codes — the local stand-in for Supabase Auth.
 *
 * **Nothing here is security.** The credential store lives in localStorage next
 * to the data it guards, so any script on the page can read it and the "hash"
 * below is obfuscation at best. It exists only so the sign-in, invitation and
 * password screens can be built and exercised before a backend exists. The
 * sign-in screen says so on its face; no real password should ever be typed
 * into this build.
 *
 * ── When Supabase Auth lands ──────────────────────────────────────────────
 * Every function in this file is replaced by one API call, and `Db.credentials`
 * is deleted outright:
 *   signIn            → supabase.auth.signInWithPassword()
 *   setPassword       → supabase.auth.updateUser({ password })
 *   changePassword    → reauthenticate, then updateUser()
 *   issueOtp / verifyOtp → inviteUserByEmail() + verifyOtp({ type: 'invite' })
 * The SESSION shape does not change, so nothing downstream of `useSession` has
 * to move. That is the point of keeping all of this in one file.
 */
import type { Credential, Db, User } from '../types'
import { getDb, update, delay } from './db'
import { useSession } from '../store/session'
import { fullName } from './users'
import { digest } from '../lib/digest'

/** Minimum the prototype enforces. Supabase's own policy governs later. */
export const MIN_PASSWORD_LENGTH = 8

export function passwordProblem(password: string): 'tooShort' | null {
  return password.length < MIN_PASSWORD_LENGTH ? 'tooShort' : null
}

/* ------------------------------------------------------------------ *
 * Errors — distinct types so screens can phrase each case correctly
 * ------------------------------------------------------------------ */

export type AuthFailure =
  | 'invalidCredentials'
  | 'accountInactive'
  | 'accountInvited'
  | 'otpInvalid'
  | 'otpExpired'
  | 'passwordTooShort'

export class AuthError extends Error {
  constructor(readonly failure: AuthFailure) {
    super(failure)
    this.name = 'AuthError'
  }
}

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

/** Email is the login handle, so it is matched case-insensitively. */
export function userByEmail(db: Db, email: string): User | undefined {
  const wanted = email.trim().toLowerCase()
  return db.users.find((u) => u.email.toLowerCase() === wanted)
}

function credentialFor(db: Db, userId: string): Credential | undefined {
  return db.credentials[userId]
}

/** Whether this account has a password set — i.e. has finished its invitation. */
export function hasPassword(db: Db, userId: string): boolean {
  return !!credentialFor(db, userId)?.passwordHash
}

/* ------------------------------------------------------------------ *
 * Sign in / out
 * ------------------------------------------------------------------ */

/**
 * Sign in with email and password, and start a session.
 *
 * The active role is the user's first role unless one is named. A user holding
 * several roles signs in AS one of them; permission checks run against that
 * single role, so holding two never grants their union silently.
 */
export async function signIn(email: string, password: string, asRole?: string): Promise<User> {
  await delay(300)
  const db = getDb()
  const user = userByEmail(db, email)
  const cred = user ? credentialFor(db, user.id) : undefined

  // Same error whether the address is unknown or the password is wrong: saying
  // which would let anyone enumerate who has an account here.
  if (!user || !cred?.passwordHash || cred.passwordHash !== digest(password)) {
    throw new AuthError('invalidCredentials')
  }
  if (user.accountStatus === 'invited') throw new AuthError('accountInvited')
  if (user.status === 'departed') throw new AuthError('accountInactive')

  const role = (asRole && user.roles.includes(asRole as User['roles'][number]) ? asRole : user.roles[0]) as User['roles'][number]
  startSession(user, role)
  return user
}

/**
 * Put a user into the session without a password check.
 *
 * The demo shortcut on the sign-in screen, and the hand-off after an invitation
 * is redeemed. Kept beside `signIn` so both write the session identically —
 * a second place that assembles a session is a second place to get it wrong.
 */
export function startSession(user: User, role: User['roles'][number]): void {
  update((d) => {
    const u = d.users.find((x) => x.id === user.id)
    if (u) u.lastSignInAt = new Date().toISOString()
  })
  useSession.getState().login({
    userId: user.id,
    schoolId: user.schoolId,
    role,
    // a teacher's staff record and account are one row, so the ids match
    teacherId: role === 'teacher' ? user.id : null,
  })
}

/** Switch which of your roles is active, without signing out. */
export function switchRole(role: User['roles'][number]): void {
  const session = useSession.getState()
  const user = session.userId ? getDb().users.find((u) => u.id === session.userId) : undefined
  if (!user || !user.roles.includes(role)) return
  startSession(user, role)
}

/* ------------------------------------------------------------------ *
 * Passwords
 * ------------------------------------------------------------------ */

/** Set a password for an account that has none yet (invitation redemption). */
export async function setPassword(userId: string, password: string): Promise<void> {
  if (passwordProblem(password)) throw new AuthError('passwordTooShort')
  await delay(250)
  update((d) => {
    const cred = d.credentials[userId] ?? { userId, passwordHash: null, otpHash: null, otpExpiresAt: null }
    cred.passwordHash = digest(password)
    // redeeming the invitation spends the code
    cred.otpHash = null
    cred.otpExpiresAt = null
    d.credentials[userId] = cred
    const user = d.users.find((u) => u.id === userId)
    if (user) user.accountStatus = 'active'
  })
}

/** Change your own password. Requires the current one — this is a re-auth. */
export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const cred = credentialFor(getDb(), userId)
  if (!cred?.passwordHash || cred.passwordHash !== digest(current)) {
    throw new AuthError('invalidCredentials')
  }
  if (passwordProblem(next)) throw new AuthError('passwordTooShort')
  await delay(250)
  update((d) => {
    d.credentials[userId].passwordHash = digest(next)
  })
}

/* ------------------------------------------------------------------ *
 * One-time codes — invitations (Phase 2 uses these to onboard staff)
 * ------------------------------------------------------------------ */

const OTP_TTL_MINUTES = 60 * 24 * 7 // an invitation is not a login code; a week is reasonable

/** Six digits, which is what an emailed invitation code looks like. */
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export interface IssuedOtp {
  code: string
  expiresAt: string
  /** Who it is for, so the caller can show "sent to …" without a second lookup. */
  email: string
  name: string
}

/**
 * Mint an invitation code for a user.
 *
 * Returns the plaintext code because there is no mail server here — the screen
 * shows it so the flow can be walked end to end. **That return value is the
 * whole reason this is prototype-only**: a real implementation emails the code
 * and never hands it back to the caller.
 */
export async function issueOtp(userId: string): Promise<IssuedOtp> {
  await delay(200)
  const code = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString()
  update((d) => {
    d.credentials[userId] = {
      userId,
      passwordHash: d.credentials[userId]?.passwordHash ?? null,
      otpHash: digest(code),
      otpExpiresAt: expiresAt,
    }
  })
  const user = getDb().users.find((u) => u.id === userId)
  return { code, expiresAt, email: user?.email ?? '', name: user ? fullName(user) : '' }
}

/** Check an emailed code. Returns the user it belongs to. */
export async function verifyOtp(email: string, code: string): Promise<User> {
  await delay(300)
  const db = getDb()
  const user = userByEmail(db, email)
  const cred = user ? credentialFor(db, user.id) : undefined
  if (!user || !cred?.otpHash || cred.otpHash !== digest(code.trim())) {
    throw new AuthError('otpInvalid')
  }
  if (cred.otpExpiresAt && cred.otpExpiresAt < new Date().toISOString()) {
    throw new AuthError('otpExpired')
  }
  return user
}
