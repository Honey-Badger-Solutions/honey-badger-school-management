/**
 * Where each role lands after signing in.
 *
 * Kept out of both `App.tsx` and the sign-in screen because both need it and
 * importing one from the other would make a cycle. Adding a role means adding
 * a line here and a nav list in `Shell.tsx`.
 */
import type { Role } from '../types'

export const ROLE_HOME: Record<Role, string> = {
  'saas-admin': '/saas-admin',
  'school-admin': '/school-admin',
  'staff-admin': '/staff-admin',
  teacher: '/teacher',
  'finance-officer': '/finance',
  'print-only-staff': '/print',
}
