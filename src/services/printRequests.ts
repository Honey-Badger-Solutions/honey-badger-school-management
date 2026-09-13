/**
 * "Print by staff" — the queue the Print-Only Staff member works from.
 *
 * A request stores a REFERENCE to a record, never a rendered document: the
 * paper is re-derived from live data at the moment it prints. Snapshotting the
 * document instead would mean a corrected mark, an edited fee or a renamed
 * cashier printing wrong hours later, with nothing on the sheet to say which
 * version you are holding.
 *
 * The queue is deliberately small — request, complete, cancel. Anything more
 * (assignment, priorities, an "in progress" flag) is process for a job that
 * takes half a minute at a printer in the same building.
 */
import type { Db, PrintDocKind, PrintRequest, PrintRequestStatus } from '../types'
import { getDb, update, delay, takeSeq } from './db'
import { newId } from '../lib/id'
import { actingUserId, assertPermission } from './users'

export interface PrintRequestInput {
  kind: PrintDocKind
  /** payment id for a receipt, student id for a report card */
  subjectId: string
  /** required for a report card — which exam it is for */
  examId?: string | null
  copies?: number
  note?: string
}

/** At most this many copies per request — a typo of 500 costs a paper tray. */
export const MAX_COPIES = 20

export async function requestStaffPrint(input: PrintRequestInput): Promise<PrintRequest> {
  assertPermission('print_requests.create', 'requesting a print')
  const requestedByUserId = actingUserId()
  // A queue entry nobody can be asked about is not a request. Refuse rather
  // than write a null the print staff would have to guess at.
  if (!requestedByUserId) throw new Error('Not permitted: requesting a print requires a signed-in user.')
  if (input.kind === 'report_card' && !input.examId) {
    throw new Error('A report card print request needs an exam.')
  }
  await delay(200)
  const request: PrintRequest = {
    id: newId(),
    schoolId: getDb().schoolId,
    kind: input.kind,
    subjectId: input.subjectId,
    examId: input.examId ?? null,
    copies: Math.min(MAX_COPIES, Math.max(1, Math.round(input.copies ?? 1))),
    note: (input.note ?? '').trim(),
    status: 'pending',
    requestedByUserId,
    requestedAt: new Date().toISOString(), // display only
    processedByUserId: null,
    processedAt: null,
    serverSeq: 0, // replaced inside update(), where commit order is known
  }
  update((d) => {
    request.serverSeq = takeSeq(d)
    d.printRequests.push(request)
  })
  return request
}

/** Close a request. `completed` when the paper is handed over, `cancelled` when
 *  it turned out not to be needed. Either way it records who closed it. */
async function close(id: string, status: Extract<PrintRequestStatus, 'completed' | 'cancelled'>): Promise<void> {
  assertPermission('print_requests.process', 'processing a print request')
  const db = getDb()
  const existing = db.printRequests.find((r) => r.id === id)
  if (!existing) throw new Error('That print request no longer exists.')
  // Same tenant check every other service does: server-side this is the RLS
  // predicate, and it must not be the UI's only copy of the rule.
  if (existing.schoolId !== db.schoolId) throw new Error('Not permitted: that request belongs to another school.')
  if (existing.status !== 'pending') return // already closed — nothing to redo
  const actor = actingUserId()
  await delay()
  update((d) => {
    const r = d.printRequests.find((x) => x.id === id)
    if (!r) return
    r.status = status
    r.processedByUserId = actor
    r.processedAt = new Date().toISOString()
    r.serverSeq = takeSeq(d)
  })
}

export const completePrintRequest = (id: string) => close(id, 'completed')
export const cancelPrintRequest = (id: string) => close(id, 'cancelled')

/* ---- derived helpers (pure, shared by the queue screen and the nav) ---- */

/** Requests in one status, newest first. Ordered by commit sequence, not the
 *  request clock — two devices queueing at once is exactly the case a
 *  timestamp gets wrong. */
export function printRequestsIn(db: Db, status: PrintRequestStatus): PrintRequest[] {
  return db.printRequests
    .filter((r) => r.schoolId === db.schoolId && r.status === status)
    .sort((a, b) => b.serverSeq - a.serverSeq)
}

export function pendingPrintCount(db: Db): number {
  return db.printRequests.filter((r) => r.schoolId === db.schoolId && r.status === 'pending').length
}
