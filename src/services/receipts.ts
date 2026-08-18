/**
 * Receipt numbers — leased in blocks, allocated on the device.
 *
 * A receipt number is printed and handed to a parent. It cannot be corrected
 * afterwards: you cannot recall paper. So it must be decided at the moment the
 * receipt is issued, which offline means on the device, which means a plain
 * counter is unusable — two offline devices would both issue HB-0042 and both
 * numbers would already be in parents' hands.
 *
 * A device therefore leases a block up front (HB-4000…4099) and allocates
 * inside it. Two devices can never collide because they never hold overlapping
 * blocks. Gaps appear when a device stops mid-block; that is a visible,
 * explainable gap in a ledger, which is far better than a duplicate.
 *
 * ── If fee collection turns out to be desk-and-internet only ──────────────
 * This whole file becomes unnecessary. The server allocates the number at the
 * point of sale and hands it back before the receipt prints. To remove:
 *
 *   1. delete this file and `receiptLeases` / `nextReceiptBlock` from Db
 *   2. in services/fees.ts, replace the allocateReceiptNo() call with the
 *      number returned by the server
 *   3. drop the RECEIPTS_EXHAUSTED handling in the payment modal
 *
 * Nothing else reads a lease. That is deliberate — the question is still open
 * with the schools, so the leasing is kept in one removable piece.
 */
import type { Db, ReceiptLease } from '../types'
import { getDb, update, delay } from './db'

/** How many numbers a device takes at a time. Large enough that a school does
 *  not re-lease during a collection day, small enough that an abandoned block
 *  leaves a gap someone can still eyeball in a ledger. */
export const BLOCK_SIZE = 100

const DEVICE_KEY = 'hbs_device_id'

/**
 * Stable per-browser identity. A lease belongs to a device, not a user — two
 * teachers sharing one phone share its block, and one teacher with a phone and
 * a laptop holds two.
 */
export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function leaseOf(db: Db, device = deviceId()): ReceiptLease | null {
  return db.receiptLeases[device] ?? null
}

export function remainingInLease(db: Db, device = deviceId()): number {
  const lease = leaseOf(db, device)
  return lease ? lease.blockEnd - lease.next + 1 : 0
}

/**
 * Ask the server for a block. **This is the only step that needs a connection**
 * — everything after it works offline until the block runs out.
 *
 * Mocked here by bumping a counter the real server would own.
 */
export async function leaseBlock(device = deviceId()): Promise<ReceiptLease> {
  await delay(200)
  let leased!: ReceiptLease
  update((d) => {
    const blockStart = d.nextReceiptBlock
    d.nextReceiptBlock = blockStart + BLOCK_SIZE
    leased = { deviceId: device, blockStart, blockEnd: blockStart + BLOCK_SIZE - 1, next: blockStart }
    d.receiptLeases[device] = leased
  })
  return leased
}

/** Thrown when the block is spent and no new one can be leased. */
export class ReceiptsExhausted extends Error {
  constructor() {
    super('This device has used all its receipt numbers. Connect to the internet to get more.')
    this.name = 'ReceiptsExhausted'
  }
}

export const formatReceiptNo = (n: number) => `HB-${String(n).padStart(4, '0')}`

/**
 * Take the next number from this device's block.
 *
 * Refuses loudly when the block is spent and the device is offline. That
 * refusal is the point: guessing a number, or falling back to a shared
 * counter, is how two parents end up holding the same receipt. A blocked
 * cashier is recoverable; a duplicate receipt is not.
 */
export async function allocateReceiptNo(device = deviceId()): Promise<string> {
  let lease = leaseOf(getDb(), device)

  if (!lease || lease.next > lease.blockEnd) {
    if (!navigator.onLine) throw new ReceiptsExhausted()
    lease = await leaseBlock(device)
  }

  const n = lease.next
  update((d) => { d.receiptLeases[device].next = n + 1 })
  return formatReceiptNo(n)
}
