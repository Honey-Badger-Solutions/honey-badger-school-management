/**
 * A deterministic digest for the prototype's credential store.
 *
 * **This is obfuscation, not protection**, and it is not a password hash in any
 * meaningful sense — see the note at the top of `services/auth.ts`. It lives in
 * `lib/` only because both the seed and the auth service need it, and the seed
 * cannot import a service without a cycle.
 *
 * Real password hashing happens on a server that never gives the digest to the
 * client. Supabase Auth does that; this disappears with it.
 */
export function digest(plain: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < plain.length; i++) {
    const c = plain.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

/**
 * The password every seeded demo account shares.
 *
 * Public on purpose — it is printed on the sign-in screen. Seeded accounts hold
 * no real data, and a demo whose password is a secret is a demo nobody can use.
 */
export const DEMO_PASSWORD = 'honeybadger'

/**
 * The code on the seeded pending invitation.
 *
 * Fixed, and printed on the invitation screen, because there is no mail server
 * to deliver a random one. Real invitations mint a random code per user and
 * email it — see `issueOtp`, which only returns the plaintext because nothing
 * here can send it.
 */
export const DEMO_OTP = '424242'
