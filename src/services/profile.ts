/**
 * A user's own account details.
 *
 * Separate from `services/staff.ts` on purpose: that file is an ADMIN editing
 * somebody else's staff record and is permission-gated; this is a person
 * editing their own profile and is gated by ownership. The two write some of
 * the same columns, so both keep the `User` and `Teacher` halves in step.
 *
 * Email is not editable here. It identifies the Auth account, so changing it is
 * an Auth operation (re-verification, a confirmation mail) rather than a
 * profile edit — the screen shows it read-only.
 */
import type { Sex, User } from '../types'
import { getDb, update, delay } from './db'
import { actingUserId } from './users'

export interface ProfileInput {
  firstName: string
  fatherName: string
  sex: Sex | null
  phone: string
}

/** Largest avatar we will hold. Data URLs live in the same localStorage budget
 *  as the whole database, so an unbounded image would evict the school. */
export const MAX_AVATAR_BYTES = 256 * 1024

export class NotOwnProfile extends Error {
  constructor() {
    super('A profile may only be edited by the person it belongs to.')
    this.name = 'NotOwnProfile'
  }
}

/** Ownership check — the profile screens never edit anyone else's account. */
function assertSelf(userId: string): void {
  if (actingUserId() !== userId) throw new NotOwnProfile()
}

export async function saveProfile(userId: string, input: ProfileInput): Promise<void> {
  assertSelf(userId)
  await delay()
  const firstName = input.firstName.trim()
  const fatherName = input.fatherName.trim()
  const phone = input.phone.trim()
  update((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (!user) return
    user.firstName = firstName
    user.fatherName = fatherName
    user.sex = input.sex
    user.phone = phone
    // a teacher's staff record is the same row server-side; keep the shared
    // columns identical so the two can never disagree
    const teacher = d.teachers.find((t) => t.userId === userId)
    if (teacher) {
      teacher.firstName = firstName
      teacher.fatherName = fatherName
      if (input.sex) teacher.sex = input.sex
      teacher.phone = phone
    }
  })
}

/**
 * Set or clear the profile picture.
 *
 * Held as a data URL because there is no object store yet. It becomes a
 * Supabase Storage path (bucket `avatars`, one object per user id), at which
 * point this writes a URL instead of bytes and the size cap can relax.
 */
export async function saveAvatar(userId: string, dataUrl: string | null): Promise<void> {
  assertSelf(userId)
  if (dataUrl && dataUrl.length > MAX_AVATAR_BYTES) {
    throw new Error('That image is too large.')
  }
  await delay(150)
  update((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (user) user.avatarUrl = dataUrl
  })
}

/** The signed-in user's own record, or null. */
export function ownProfile(): User | null {
  const id = actingUserId()
  return id ? (getDb().users.find((u) => u.id === id) ?? null) : null
}
