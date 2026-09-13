/**
 * Display forms for values stored as database enums.
 *
 * The rule: store what the database CHECK constraint spells, render whatever
 * the screen needs. `sex` used to be stored as 'M'/'F' because a printed roster
 * column wants one letter — which quietly made the storage format a
 * presentation decision, and put the local data out of step with
 * `users.sex`/`students.sex`. The letter is produced here instead.
 */
import type { Sex } from '../types'
import type { TKey } from '../i18n'

/** i18n key for the full word — profiles, forms, report cards. */
export function sexKey(sex: Sex): TKey {
  return sex === 'male' ? 'male' : 'female'
}

/** One-letter form for dense table cells and printed rosters. */
export function sexShort(sex: Sex | null): string {
  if (!sex) return ''
  return sex === 'male' ? 'M' : 'F'
}
