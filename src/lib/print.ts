/**
 * Pure helpers for the paper documents.
 *
 * The accent maps exist so a school's colour choice resolves to palette tokens
 * in ONE place. A component picking its own hex would both break the locked
 * palette and make "ink" mean something different on a receipt than on a
 * report card.
 */
import type { PrintAccent } from '../types'

/** The rule under the letterhead. */
export const ACCENT_BAND: Record<PrintAccent, string> = {
  honey: 'bg-gradient-to-r from-honey via-honey-dark to-honey',
  ink: 'bg-ink/75',
}

/** Totals, document label — the one figure the eye should land on. */
export const ACCENT_TEXT: Record<PrintAccent, string> = {
  honey: 'text-gold',
  ink: 'text-ink',
}

/**
 * Letter grade from a percentage, for the `detailed` report card only.
 *
 * A fixed scale the application owns, deliberately not configurable: a school
 * that can redefine an A has made its report cards incomparable with every
 * other school's, which is the one thing a printed grade is for. If a school
 * needs a different scale it becomes a school setting with a migration, not a
 * number a screen can type over.
 */
export function gradeLetter(pct: number | null): string {
  if (pct === null) return '—'
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'B'
  if (pct >= 70) return 'C'
  if (pct >= 60) return 'D'
  return 'F'
}
