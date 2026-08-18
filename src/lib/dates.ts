/**
 * Date display utilities.
 *
 * All dates are stored as ISO strings ('2026-08-10'). Display formatting goes
 * through fmtDate()/fmtDateShort() ONLY — never inline — so Ethiopian calendar
 * (E.C.) support can be added later by swapping the body of these functions.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The school's timezone. Ethiopia is UTC+3 year-round — no DST. */
const SCHOOL_TZ = 'Africa/Addis_Ababa'

/**
 * The school day a moment belongs to — a **business date**, not a timestamp.
 *
 * Computed in the school's timezone, never in UTC and never from the device's
 * own zone. Both of those get it wrong in ways nobody notices for months:
 *
 *   - Derived in UTC, a register taken at 00:30 in Addis carries yesterday's
 *     date, because 00:30 EAT is 21:30 UTC the previous day. An evening
 *     register at 23:50 is the mirror case for a school east of UTC+3.
 *   - Taken from the device's clock zone, a laptop still set to Europe or a
 *     phone that lost its zone files a whole class under the wrong day.
 *
 * A business date is user intent: which school day this register is for. It is
 * set by the client and no server may recompute it from a timestamp.
 */
export function businessDate(at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the ISO shape everything here stores
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
}

/** Today's school day. */
export function todayISO(): string {
  return businessDate()
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** '10 Aug 2026' — placeholder; swap for Ethiopian calendar later */
export function fmtDate(iso: string): string {
  const d = parse(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** 'Mon, 10 Aug' */
/** Date + time, for audit trails. Same calendar swap-point as fmtDate. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${fmtDate(iso.slice(0, 10))} · ${time}`
}

export function fmtDateShort(iso: string): string {
  const d = parse(iso)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function isWeekend(iso: string): boolean {
  const day = parse(iso).getDay()
  return day === 0 || day === 6
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** last n school days (Mon–Fri) ending today, oldest first */
export function schoolDays(n: number, endISO = todayISO()): string[] {
  const out: string[] = []
  let cur = endISO
  while (out.length < n) {
    if (!isWeekend(cur)) out.unshift(cur)
    cur = addDays(cur, -1)
  }
  return out
}
