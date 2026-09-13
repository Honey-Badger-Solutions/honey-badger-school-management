/**
 * Money is stored in **santim** — integer hundredths of an Ethiopian Birr.
 *
 * The database already decided this: `fee_items.amount_santim`,
 * `payments.total_santim` and `payment_lines.amount_santim` are all `bigint`.
 * The prototype used to hold whole Birr, which is the same number divided by
 * 100 — a mismatch that reads as "correct" on every screen right up until a
 * receipt prints 1,250 where the ledger says 125,000. Receipts are exactly
 * where that becomes unrecoverable, so the unit is aligned now.
 *
 * Rules:
 *  - **store santim, integers only.** Never a float Birr amount: 0.1 + 0.2
 *    cents apart is a balance that never reaches zero.
 *  - **name the unit.** Every field and parameter carrying money is called
 *    `…Santim`. An `amount` with no unit is what caused this.
 *  - **convert at the edges only** — `parseBirrToSantim` on the way in from a
 *    form, `fmtETB`/`fmtAmount` on the way out to a screen or a page.
 */

export const SANTIM_PER_BIRR = 100

/** Birr (possibly fractional, straight off a form) → integer santim. */
export function birrToSantim(birr: number): number {
  return Math.round(birr * SANTIM_PER_BIRR)
}

/** Santim → Birr as a number. For display only — do not store the result. */
export function santimToBirr(santim: number): number {
  return santim / SANTIM_PER_BIRR
}

/**
 * Screen form: `ETB 1,250` when the amount is whole Birr, `ETB 1,250.50` when
 * it is not. Schools quote whole Birr, so decimals appear only when they mean
 * something.
 */
export function fmtETB(santim: number): string {
  const whole = santim % SANTIM_PER_BIRR === 0
  return `ETB ${santimToBirr(santim).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** Paper form: always two decimals, so a column of figures lines up. */
export function fmtAmount(santim: number): string {
  return santimToBirr(santim).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * A Birr amount typed by a user → santim, or null when it is not a usable
 * amount. Rejects rather than coercing: a silently-truncated fee is worse than
 * a form that will not submit.
 */
export function parseBirrToSantim(input: string): number | null {
  const clean = input.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const santim = birrToSantim(Number(clean))
  return Number.isFinite(santim) ? santim : null
}

/** Keystroke filter for a Birr input: digits and at most one decimal point. */
export function birrInputFilter(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const [head, ...rest] = cleaned.split('.')
  return rest.length ? `${head}.${rest.join('').slice(0, 2)}` : head
}

/**
 * The figure alone, no `ETB` prefix — for the dashboard KPI tiles, which
 * render the currency label at its own smaller size.
 */
export function fmtBirr(santim: number): string {
  const whole = santim % SANTIM_PER_BIRR === 0
  return santimToBirr(santim).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
