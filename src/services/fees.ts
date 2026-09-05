import type { Db, Payment, PaymentLine, Student } from '../types'
import { update, delay, takeSeq } from './db'
import { todayISO } from '../lib/dates'
import { allocateReceiptNo } from './receipts'
import { newId } from '../lib/id'
import { actingUserId, assertPermission } from './users'

export async function recordPayment(studentId: string, lines: PaymentLine[], method: Payment['method']): Promise<Payment> {
  assertPermission('fees.record_payment', 'recording a payment')
  // `received_by` is NOT NULL in the schema, and a receipt that cannot say who
  // took the money is not a receipt — so refuse rather than write a null.
  const receivedByUserId = actingUserId()
  if (!receivedByUserId) throw new Error('Not permitted: recording a payment requires a signed-in user.')
  await delay(250)
  const total = lines.reduce((a, l) => a + l.amount, 0)
  // Allocated from this device's leased block, so a second device collecting
  // fees at the same time cannot print the same number. Throws
  // ReceiptsExhausted rather than guessing — see services/receipts.ts.
  const receiptNo = await allocateReceiptNo()
  const payment: Payment = {
    id: newId(),
    receiptNo,
    studentId,
    lines,
    total,
    // business date: the school day the money changed hands, in the school's
    // timezone — not a UTC slice of a timestamp
    date: todayISO(),
    method,
    receivedByUserId,
    clientRecordedAt: new Date().toISOString(), // display only
    serverSeq: 0, // replaced inside update(), where commit order is known
  }
  update((d) => {
    payment.serverSeq = takeSeq(d)
    d.payments.push(payment)
  })
  return payment
}

export async function addFeeItem(gradeId: string, name: string, amount: number, kind: 'term' | 'annual'): Promise<void> {
  await delay()
  update((d) => {
    d.feeItems.push({ id: newId(), gradeId, name, amount, kind })
  })
}

/* ---- derived helpers (pure, shared by screens + print views) ---- */

export interface BalanceRow {
  studentId: string
  due: number
  paid: number
  balance: number
}

export function balanceFor(db: Db, studentId: string): BalanceRow {
  const st = db.students.find((s) => s.id === studentId)!
  const due = db.feeItems.filter((f) => f.gradeId === st.gradeId).reduce((a, f) => a + f.amount, 0)
  const paid = db.payments.filter((p) => p.studentId === studentId).reduce((a, p) => a + p.total, 0)
  return { studentId, due, paid, balance: due - paid }
}

export function allBalances(db: Db): BalanceRow[] {
  return db.students.filter((s) => s.status === 'active').map((s) => balanceFor(db, s.id))
}

/** A balance row with its student attached — what both the screens and the
 *  printed reports need. Derived once here so a list and its printout can
 *  never drift apart. */
export interface BalanceRowWithStudent extends BalanceRow {
  student: Student
}

/** Everyone who still owes something, heaviest debt first. */
export function defaulterRows(db: Db): BalanceRowWithStudent[] {
  return allBalances(db)
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b, student: db.students.find((s) => s.id === b.studentId)! }))
    .sort((a, b) => b.balance - a.balance)
}

export interface PaidRow extends BalanceRowWithStudent {
  lastPaymentDate: string
  /** commit order of that payment — what 'most recent' actually sorts on */
  lastPaymentSeq: number
  payments: number
}

/** Everyone who has paid something, most recent payment first. */
export function paidRows(db: Db): PaidRow[] {
  return allBalances(db)
    .filter((b) => b.paid > 0)
    .map((b) => {
      const mine = db.payments.filter((p) => p.studentId === b.studentId)
      // "most recent" means the last one recorded, which is commit order —
      // two payments share a business date all the time
      const latest = mine.reduce<Payment | null>((best, p) => (!best || p.serverSeq > best.serverSeq ? p : best), null)
      const last = latest?.date ?? ''
      return {
        ...b,
        student: db.students.find((s) => s.id === b.studentId)!,
        lastPaymentDate: last,
        lastPaymentSeq: latest?.serverSeq ?? -1,
        payments: mine.length,
      }
    })
    .sort((a, b) => b.lastPaymentSeq - a.lastPaymentSeq)
}
