/**
 * Onboarding — what a new account still owes before it is fully set up.
 *
 * Derived, never stored: each step is a question asked of the user's current
 * record, so completing a step anywhere in the app (editing your profile,
 * uploading a picture) advances onboarding without onboarding having to be
 * told. Only the finish line is persisted, as `user.onboardingCompletedAt`.
 *
 * Deliberately not a wizard. It never blocks sign-in and it never traps
 * anybody: a new user can leave at any point and the remaining steps stay
 * visible from their profile. The whole thing is a checklist with links.
 */
import type { Db, User } from '../types'
import { update, delay } from './db'
import type { TKey } from '../i18n'

export interface OnboardingStep {
  id: 'name' | 'contact' | 'avatar' | 'password'
  title: TKey
  description: TKey
  done: boolean
  /** Steps that must be finished before onboarding can be marked complete.
   *  Optional ones are shown but never hold the user up. */
  required: boolean
  /** Where to go to do it. */
  to: string
}

export function onboardingSteps(db: Db, user: User): OnboardingStep[] {
  const hasPassword = !!db.credentials[user.id]?.passwordHash
  return [
    {
      id: 'name',
      title: 'obStepName',
      description: 'obStepNameSub',
      done: user.firstName.trim().length > 0 && user.fatherName.trim().length > 0,
      required: true,
      to: '/profile',
    },
    {
      id: 'contact',
      title: 'obStepContact',
      description: 'obStepContactSub',
      done: user.phone.trim().length > 0,
      required: true,
      to: '/profile',
    },
    {
      id: 'password',
      title: 'obStepPassword',
      description: 'obStepPasswordSub',
      done: hasPassword,
      required: true,
      to: '/profile',
    },
    {
      id: 'avatar',
      title: 'obStepAvatar',
      description: 'obStepAvatarSub',
      done: !!user.avatarUrl,
      required: false,
      to: '/profile',
    },
  ]
}

export interface OnboardingState {
  steps: OnboardingStep[]
  /** Steps finished, over steps that count — optional ones are excluded so the
   *  bar can actually reach 100%. */
  done: number
  total: number
  /** True when every REQUIRED step is done, whether or not it has been
   *  acknowledged with `completeOnboarding`. */
  ready: boolean
  /** True once the user has finished and the account is fully set up. */
  complete: boolean
  /** The next thing to do, or null when there is nothing left. */
  next: OnboardingStep | null
}

export function onboardingState(db: Db, user: User): OnboardingState {
  const steps = onboardingSteps(db, user)
  const required = steps.filter((s) => s.required)
  const done = required.filter((s) => s.done).length
  const ready = done === required.length
  return {
    steps,
    done,
    total: required.length,
    ready,
    complete: user.onboardingCompletedAt !== null,
    next: steps.find((s) => !s.done) ?? null,
  }
}

/** Whether this user should be shown the onboarding screen at all. */
export function needsOnboarding(user: User | null | undefined): boolean {
  return !!user && user.onboardingCompletedAt === null
}

/**
 * Mark onboarding finished.
 *
 * Refuses while a required step is outstanding — otherwise "complete" would
 * stop meaning anything, and the checklist would be the only place the truth
 * lived.
 */
export async function completeOnboarding(userId: string): Promise<void> {
  await delay(200)
  update((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (!user) return
    if (!onboardingState(d, user).ready) return
    user.onboardingCompletedAt = new Date().toISOString()
  })
}
