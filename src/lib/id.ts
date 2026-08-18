/**
 * Internal database keys — random UUIDs, minted on the device that creates the
 * record.
 *
 * A counter cannot work offline. `t${teachers.length + 1}` mints the same id on
 * two devices holding the same local state, for two different people, and once
 * they sync there is nothing left to tell them apart. A `Date.now()` suffix
 * narrows the window; it does not close it, and two teachers registered in the
 * same second at two branches is exactly the case that matters. Randomness is
 * the only scheme that needs no coordination — which is the whole point when
 * the devices cannot reach each other.
 *
 * **Never use this for anything a human reads.** The student registration
 * number and the receipt number are human-facing sequences with their own
 * rules — see `suggestStudentNo` and `services/receipts.ts`.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // crypto.randomUUID needs a secure context. A school serving this from a
  // laptop over plain http on the staffroom LAN would not have one, and
  // getRandomValues still does.
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
