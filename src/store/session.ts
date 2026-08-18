import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '../types'
import { translate, type Lang, type TKey } from '../i18n'

interface SessionState {
  role: Role | null
  teacherId: string | null // set when role === 'teacher'
  lang: Lang
  login: (role: Role, teacherId?: string) => void
  logout: () => void
  setLang: (lang: Lang) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      teacherId: null,
      lang: 'en',
      login: (role, teacherId) => set({ role, teacherId: teacherId ?? null }),
      logout: () => set({ role: null, teacherId: null }),
      setLang: (lang) => set({ lang }),
    }),
    { name: 'hbs_session_v1' },
  ),
)

/** t('key') bound to the current language. */
export function useT() {
  const lang = useSession((s) => s.lang)
  return (key: TKey) => translate(lang, key)
}
