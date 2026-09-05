import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '../types'
import { translate, type Lang, type TKey } from '../i18n'
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  type Permission,
} from '../config/permissions'

/** Who signed in. Everything else about them is looked up from `db.users`. */
export interface SessionIdentity {
  /** the signed-in user — the identity every write is attributed to */
  userId: string
  /** their school; the tenant every query will be scoped to */
  schoolId: string
  role: Role
  /** staff record, set only when this user is a teacher */
  teacherId?: string | null
}

interface SessionState {
  userId: string | null
  schoolId: string | null
  role: Role | null
  teacherId: string | null
  lang: Lang
  login: (who: SessionIdentity) => void
  logout: () => void
  setLang: (lang: Lang) => void
}

/**
 * The signed-in session.
 *
 * Holds IDENTITY (`userId`), not a name and not a role alone. Role is an
 * attribute of the user, so it can change without the session becoming a
 * different person, and nothing written while signed in has to capture a
 * display name to be attributable later.
 *
 * `teacherId` is a convenience: it equals `userId` for a teacher, because a
 * staff record and a user account are the same row. It is kept because most of
 * the app asks "which teacher am I?" and reading that intent off a field named
 * `userId` would obscure it.
 *
 * Persisted under a v2 key — a v1 session held `{ role, teacherId }` with no
 * user, which cannot be upgraded into an identity. Those sessions are dropped
 * and the person signs in again.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      schoolId: null,
      role: null,
      teacherId: null,
      lang: 'en',
      login: (who) =>
        set({
          userId: who.userId,
          schoolId: who.schoolId,
          role: who.role,
          teacherId: who.teacherId ?? null,
        }),
      logout: () => set({ userId: null, schoolId: null, role: null, teacherId: null }),
      setLang: (lang) => set({ lang }),
    }),
    { name: 'hbs_session_v2' },
  ),
)

/** t('key') bound to the current language. */
export function useT() {
  const lang = useSession((s) => s.lang)
  return (key: TKey) => translate(lang, key)
}

/**
 * Permission checks bound to the signed-in role.
 *
 * `const can = useCan()` then `can('fees.record_payment')` — the component
 * never names a role, so re-granting a capability is an edit to
 * `config/permissions.ts` alone.
 */
export function useCan() {
  const role = useSession((s) => s.role)
  const can = (permission: Permission) => hasPermission(role, permission)
  can.any = (permissions: readonly Permission[]) => hasAnyPermission(role, permissions)
  can.all = (permissions: readonly Permission[]) => hasAllPermissions(role, permissions)
  return can
}
