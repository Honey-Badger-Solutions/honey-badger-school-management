import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Avatar, EmptyState, PageTitle, personName } from '../../components/bits'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { PaginatedReport, PrintArea, PrintFoot, PrintHead, printNow } from '../../components/Print'
import { useDb } from '../../services/db'
import { userName } from '../../services/users'
import { addFeeItem, balanceFor, defaulterRows, paidRows, recordPayment } from '../../services/fees'
import { ReceiptsExhausted } from '../../services/receipts'
import { sectionLabel } from '../../lib/derive'
import { fmtDate, fmtDateShort, todayISO } from '../../lib/dates'
import { fmtAmount, fmtETB } from '../../lib/money'
import { useT } from '../../store/session'
import type { Payment, PaymentLine } from '../../types'

type Tab = 'structure' | 'out'

export default function Fees() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'out' ? 'out' : 'structure'
  const paying = params.get('pay') === '1'
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [printDefaulters, setPrintDefaulters] = useState(false)
  const [printPaid, setPrintPaid] = useState(false)

  const setTab = (x: Tab) => { params.set('tab', x); params.delete('pay'); setParams(params, { replace: true }) }
  const openPay = (open: boolean) => {
    if (open) params.set('pay', '1'); else params.delete('pay')
    setParams(params, { replace: true })
  }

  return (
    <>
      <PageTitle title={t('feesTitle')}>
        <button className="btn-gold btn-sm" onClick={() => openPay(true)}>
          <Icon name="plus" size={16} />{t('recordPayment')}
        </button>
      </PageTitle>

      <div className="tabbar" role="tablist">
        <button role="tab" aria-selected={tab === 'structure'} className={tab === 'structure' ? 'on' : ''} onClick={() => setTab('structure')}>{t('feeStructure')}</button>
        <button role="tab" aria-selected={tab === 'out'} className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>{t('payments')}</button>
      </div>

      {tab === 'structure' && <StructureTab />}
      {tab === 'out' && (
        <BalancesTab
          onPrintDefaulters={() => { setPrintDefaulters(true); printNow(() => setPrintDefaulters(false)) }}
          onPrintPaid={() => { setPrintPaid(true); printNow(() => setPrintPaid(false)) }}
        />
      )}

      {paying && (
        <PayModal
          onClose={() => openPay(false)}
          onDone={(p) => { openPay(false); setReceipt(p); toast(t('paymentSaved')) }}
        />
      )}
      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
      {printDefaulters && <DefaultersPrint />}
      {printPaid && <PaidPrint />}
    </>
  )
}

/* ---------------- fee structure per grade ---------------- */

function StructureTab() {
  const t = useT()
  const db = useDb()
  const [adding, setAdding] = useState<string | null>(null)

  return (
    <>
      <p className="text-soft text-[13px] mb-4">{t('feeStructureLead')}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {db.grades.map((g) => {
          const items = db.feeItems.filter((f) => f.gradeId === g.id)
          const total = items.reduce((a, f) => a + f.amount, 0)
          return (
            <div key={g.id} className="card-pad">
              <div className="flex items-center justify-between mb-2">
                <b className="font-display text-[15px]">{g.name}</b>
                <span className="pill-gold">{fmtETB(total)}</span>
              </div>
              {items.map((f) => (
                <div key={f.id} className="flex justify-between items-center py-2.5 border-b border-line-soft text-[13.5px]">
                  <span>
                    {f.name}
                    <small className="text-dim block text-[11px]">{f.kind === 'term' ? t('perTerm') : t('perYear')}</small>
                  </span>
                  <b className="font-display">{fmtETB(f.amount)}</b>
                </div>
              ))}
              <button className="btn-ghost btn-sm w-full mt-3" onClick={() => setAdding(g.id)}>
                <Icon name="plus" size={15} />{t('addFeeItem')}
              </button>
            </div>
          )
        })}
      </div>
      {adding && <AddFeeModal gradeId={adding} onClose={() => setAdding(null)} />}
    </>
  )
}

function AddFeeModal({ gradeId, onClose }: { gradeId: string; onClose: () => void }) {
  const t = useT()
  const db = useDb()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'term' | 'annual'>('term')
  const grade = db.grades.find((g) => g.id === gradeId)!

  const submit = async () => {
    const amt = parseInt(amount, 10)
    if (!name.trim() || !amt || amt <= 0) return
    await addFeeItem(gradeId, name.trim(), amt, kind)
    toast(t('settingsSaved'))
    onClose()
  }

  return (
    <Modal title={`${t('addFeeItem')} — ${grade.name}`} onClose={onClose}>
      <div className="field">
        <label htmlFor="af-name">{t('feeName')}</label>
        <input id="af-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Sports fee" />
      </div>
      <div className="field">
        <label htmlFor="af-amt">{t('amountETB')}</label>
        <input id="af-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="field">
        <label>{t('term')}</label>
        <div className="seg">
          <button type="button" className={kind === 'term' ? 'on' : ''} onClick={() => setKind('term')}>{t('perTerm')}</button>
          <button type="button" className={kind === 'annual' ? 'on' : ''} onClick={() => setKind('annual')}>{t('perYear')}</button>
        </div>
      </div>
      <div className="flex gap-2.5 mt-4">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-gold flex-1" onClick={submit}>{t('save')}</button>
      </div>
    </Modal>
  )
}

/* ---------------- record payment ---------------- */

function PayModal({ onClose, onDone }: { onClose: () => void; onDone: (p: Payment) => void }) {
  const t = useT()
  const db = useDb()
  const [q, setQ] = useState('')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [method, setMethod] = useState<Payment['method']>('cash')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return db.students
      .filter((s) => s.status === 'active' && personName(s).toLowerCase().includes(needle))
      .slice(0, 6)
  }, [db, q])

  const student = db.students.find((s) => s.id === studentId)
  const items = student ? db.feeItems.filter((f) => f.gradeId === student.gradeId) : []
  const paidPerItem = useMemo(() => {
    const map: Record<string, number> = {}
    if (!student) return map
    for (const p of db.payments.filter((x) => x.studentId === student.id)) {
      for (const l of p.lines) map[l.feeItemId] = (map[l.feeItemId] ?? 0) + l.amount
    }
    return map
  }, [db, student])

  const unpaid = items.filter((f) => (paidPerItem[f.id] ?? 0) < f.amount)
  const lines: PaymentLine[] = unpaid
    .filter((f) => selected.includes(f.id))
    .map((f) => ({ feeItemId: f.id, label: f.name, amount: f.amount - (paidPerItem[f.id] ?? 0) }))
  const total = lines.reduce((a, l) => a + l.amount, 0)

  const submit = async () => {
    if (!student || lines.length === 0) return
    setBusy(true)
    setErr('')
    try {
      const p = await recordPayment(student.id, lines, method)
      onDone(p)
    } catch (e) {
      // The device is out of receipt numbers and offline. Nothing is recorded:
      // issuing a payment we cannot number would put two parents on the same
      // receipt, which is not recoverable once the paper is handed over.
      setBusy(false)
      setErr(e instanceof ReceiptsExhausted ? t('receiptsExhausted') : t('saveFailed'))
    }
  }

  return (
    <Modal title={t('recordPayment')} onClose={onClose}>
      {!student && (
        <>
          <div className="field">
            <label htmlFor="pay-q">{t('student')}</label>
            <input id="pay-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchStudents')} autoFocus />
          </div>
          <div className="flex flex-col">
            {matches.map((s) => (
              <button key={s.id} className="lrow" onClick={() => { setStudentId(s.id); setSelected([]) }}>
                <Avatar name={s.firstName} size={34} />
                <span className="flex-1 text-left min-w-0">
                  <b className="text-[13.5px] block truncate">{personName(s)}</b>
                  <small className="text-dim text-[11.5px]">{sectionLabel(db, s.sectionId)}</small>
                </span>
                <span className={balanceFor(db, s.id).balance > 0 ? 'pill-warn' : 'pill-good'}>
                  {balanceFor(db, s.id).balance > 0 ? `${t('owes')} ${fmtETB(balanceFor(db, s.id).balance)}` : t('fullyPaid')}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {student && (
        <>
          <button className="lrow !border !border-line rounded-xl mb-4" onClick={() => setStudentId(null)}>
            <Avatar name={student.firstName} size={34} />
            <span className="flex-1 text-left">
              <b className="text-[13.5px] block">{personName(student)}</b>
              <small className="text-dim text-[11.5px]">{sectionLabel(db, student.sectionId)}</small>
            </span>
            <Icon name="edit" size={16} className="text-dim" />
          </button>

          <p className="sec-h !mt-0">{t('payFor')}</p>
          {unpaid.length === 0 && <p className="text-good text-[13.5px] mb-4 font-medium">{t('fullyPaid')} ✓</p>}
          {unpaid.map((f) => {
            const remaining = f.amount - (paidPerItem[f.id] ?? 0)
            const on = selected.includes(f.id)
            return (
              <label key={f.id} className="lrow cursor-pointer !px-0">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-[#A87800]"
                  checked={on}
                  onChange={() => setSelected((sel) => (on ? sel.filter((x) => x !== f.id) : [...sel, f.id]))}
                />
                <span className="flex-1 text-[13.5px]">
                  {f.name}
                  {remaining < f.amount && <small className="text-dim block text-[11px]">{t('paid')}: {fmtETB(paidPerItem[f.id] ?? 0)}</small>}
                </span>
                <b className="font-display">{fmtETB(remaining)}</b>
              </label>
            )
          })}

          {unpaid.length > 0 && (
            <>
              <div className="field mt-4">
                <label>{t('method')}</label>
                <div className="seg">
                  {(['cash', 'telebirr', 'bank'] as const).map((m) => (
                    <button key={m} type="button" className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{t(m)}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-line font-display font-bold text-[16px]">
                <span>{t('total')}</span>
                <span className="text-gold">{fmtETB(total)}</span>
              </div>
              {err && <p className="text-warn text-[12px] mb-2 font-medium">{err}</p>}
              <button className="btn-gold w-full" onClick={submit} disabled={busy || total === 0}>
                {busy ? t('saving') : `${t('recordPayment')} · ${fmtETB(total)}`}
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

/* ---------------- receipt (modal + print) ---------------- */

function ReceiptModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const t = useT()
  const db = useDb()
  const student = db.students.find((s) => s.id === payment.studentId)!
  return (
    <>
      <Modal title={`${t('receipt')} ${payment.receiptNo}`} onClose={onClose}>
        <ReceiptBody payment={payment} />
        <div className="flex gap-2.5 mt-5">
          <button className="btn-ghost flex-1" onClick={onClose}>{t('done')}</button>
          <button className="btn-gold flex-1" onClick={() => printNow()}>
            <Icon name="printer" size={17} />{t('printReceipt')}
          </button>
        </div>
      </Modal>
      <PrintArea>
        <div className="max-w-[520px]">
          <PrintHead doc={t('receipt')} />
          <div className="flex justify-between text-[13px] mb-1">
            <span>{t('receiptNo')} <b className="font-display">{payment.receiptNo}</b></span>
            <span>{fmtDate(payment.date)}</span>
          </div>
          <p className="text-[13px] mb-3">{t('receivedFrom')}: <b>{personName(student)}</b> ({sectionLabel(db, student.sectionId)})</p>
          <ReceiptBody payment={payment} />
          <p className="text-[12px] mt-4">{t('receivedBy')}: {userName(db, payment.receivedByUserId)} — {t(payment.method)}</p>
          <p className="text-[12px] italic text-soft mt-1">{t('thankYou')}</p>
          <div className="border-t border-dashed border-line mt-4" />
          <PrintFoot />
        </div>
      </PrintArea>
    </>
  )
}

function ReceiptBody({ payment }: { payment: Payment }) {
  const t = useT()
  return (
    <div>
      {payment.lines.map((l) => (
        <div key={l.feeItemId} className="flex justify-between py-2 border-b border-line-soft text-[13.5px]">
          <span>{l.label}</span>
          <span className="font-display">{fmtAmount(l.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between pt-3 font-display font-bold text-[15.5px]">
        <span>{t('total')}</span>
        <span className="text-gold">ETB {fmtAmount(payment.total)}</span>
      </div>
    </div>
  )
}

/* ---------------- balances: outstanding + paid ---------------- */

/** Outstanding is the default view — chasing money is the daily job; Paid is
 *  the reconciliation view. */
function BalancesTab({ onPrintDefaulters, onPrintPaid }: { onPrintDefaulters: () => void; onPrintPaid: () => void }) {
  const t = useT()
  const [view, setView] = useState<'out' | 'paid'>('out')
  return (
    <>
      <div className="seg max-w-[320px] mb-4">
        <button className={view === 'out' ? 'on' : ''} onClick={() => setView('out')}>{t('outstandingTitle')}</button>
        <button className={view === 'paid' ? 'on' : ''} onClick={() => setView('paid')}>{t('paidTitle')}</button>
      </div>
      {view === 'out' ? <OutstandingList onPrint={onPrintDefaulters} /> : <PaidList onPrint={onPrintPaid} />}
    </>
  )
}

function OutstandingList({ onPrint }: { onPrint: () => void }) {
  const t = useT()
  const db = useDb()
  const [gradeId, setGradeId] = useState('')
  const [sectionId, setSectionId] = useState('')

  const rows = defaulterRows(db)
    .filter((r) => !gradeId || r.student.gradeId === gradeId)
    .filter((r) => !sectionId || r.student.sectionId === sectionId)

  const totalOwed = rows.reduce((a, r) => a + r.balance, 0)

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select className="bg-surface border border-line rounded-full px-4 min-h-[44px] text-[13.5px] font-medium" value={gradeId} onChange={(e) => { setGradeId(e.target.value); setSectionId('') }} aria-label={t('grade')}>
          <option value="">{t('allGrades')}</option>
          {db.grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-full px-4 min-h-[44px] text-[13.5px] font-medium" value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label={t('section')}>
          <option value="">{t('allSections')}</option>
          {db.sections.filter((s) => !gradeId || s.gradeId === gradeId).map((s) => (
            <option key={s.id} value={s.id}>{sectionLabel(db, s.id)}</option>
          ))}
        </select>
        <span className="pill-warn ml-auto">{rows.length} · {fmtETB(totalOwed)}</span>
        <button className="btn-ghost btn-sm" onClick={onPrint}>
          <Icon name="printer" size={16} />{t('printDefaulters')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card"><EmptyState icon="check" title={t('fullyPaid')} /></div>
      ) : (
        <div className="card">
          {/* desktop column headers */}
          <div className="hidden md:flex items-center gap-3 px-3 py-2 border-b border-line text-dim font-display font-bold text-[11px] uppercase tracking-[0.5px]">
            <span className="w-9" />
            <span className="flex-1">{t('fullName')}</span>
            <span className="w-[92px]">{t('section')}</span>
            <span className="w-[160px]">{t('guardian')}</span>
            <span className="w-[120px]">{t('guardianPhone')}</span>
            <span className="w-[150px] text-right">{t('paidToDate')}</span>
            <span className="w-[110px] text-right">{t('balance')}</span>
          </div>
          {rows.map((r) => (
            <div key={r.studentId} className="lrow">
              <Avatar name={r.student.firstName} size={36} />
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] block truncate">{personName(r.student)}</b>
                <small className="text-dim text-[11.5px] md:hidden block truncate">{sectionLabel(db, r.student.sectionId)} · {r.student.guardianPhone}</small>
              </span>
              <span className="hidden md:block w-[92px] text-[13px]">{sectionLabel(db, r.student.sectionId)}</span>
              <span className="hidden md:block w-[160px] text-[13px] truncate">{r.student.guardianName}</span>
              <span className="hidden md:block w-[120px] text-[13px] text-soft">{r.student.guardianPhone}</span>
              <span className="hidden md:block w-[150px] text-[13px] text-right text-soft">
                {fmtETB(r.paid)} / {fmtETB(r.due)}
              </span>
              {/* on a phone the paid/due detail is dropped: it squeezed the
                  guardian phone onto a third line. Balance is what's actionable. */}
              <span className="text-right shrink-0 md:w-[110px]">
                <b className="font-display text-warn text-[14px] block whitespace-nowrap">{fmtETB(r.balance)}</b>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------------- paid ---------------- */

type PaidSort = 'recent' | 'name' | 'amount'

function PaidList({ onPrint }: { onPrint: () => void }) {
  const t = useT()
  const db = useDb()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<PaidSort>('recent')

  const needle = q.trim().toLowerCase()
  const rows = paidRows(db)
    .filter((r) => !needle || personName(r.student).toLowerCase().includes(needle) || r.student.studentNo.toLowerCase().includes(needle))
    .sort((a, b) => (
      sort === 'name' ? personName(a.student).localeCompare(personName(b.student))
        : sort === 'amount' ? b.paid - a.paid
          : b.lastPaymentSeq - a.lastPaymentSeq
    ))
  const totalPaid = rows.reduce((a, r) => a + r.paid, 0)

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          className="flex-1 min-w-[180px] bg-surface border border-line rounded-full px-4 min-h-[44px] text-[13.5px]"
          placeholder={t('searchStudents')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('search')}
        />
        <select className="bg-surface border border-line rounded-full px-4 min-h-[44px] text-[13.5px] font-medium" value={sort} onChange={(e) => setSort(e.target.value as PaidSort)} aria-label={t('sortBy')}>
          <option value="recent">{t('sortRecent')}</option>
          <option value="name">{t('sortName')}</option>
          <option value="amount">{t('sortAmount')}</option>
        </select>
        <span className="pill-good">{rows.length} · {fmtETB(totalPaid)}</span>
        <button className="btn-ghost btn-sm" onClick={onPrint}>
          <Icon name="printer" size={16} />{t('printPaid')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card"><EmptyState icon="search" title={t('noPayments')} /></div>
      ) : (
        <div className="card">
          <div className="hidden md:flex items-center gap-3 px-3 py-2 border-b border-line text-dim font-display font-bold text-[11px] uppercase tracking-[0.5px]">
            <span className="w-9" />
            <span className="flex-1">{t('fullName')}</span>
            <span className="w-[92px]">{t('section')}</span>
            <span className="w-[130px]">{t('lastPayment')}</span>
            <span className="w-[150px] text-right">{t('paidToDate')}</span>
            <span className="w-[110px] text-right">{t('balance')}</span>
          </div>
          {rows.map((r) => (
            <div key={r.studentId} className="lrow">
              <Avatar name={r.student.firstName} size={36} />
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] block truncate">{personName(r.student)}</b>
                <small className="text-dim text-[11.5px] md:hidden block truncate">
                  {sectionLabel(db, r.student.sectionId)} · {fmtDateShort(r.lastPaymentDate)}
                </small>
              </span>
              <span className="hidden md:block w-[92px] text-[13px]">{sectionLabel(db, r.student.sectionId)}</span>
              <span className="hidden md:block w-[130px] text-[13px] text-soft">{fmtDateShort(r.lastPaymentDate)}</span>
              <span className="hidden md:block w-[150px] text-[13px] text-right text-soft">
                {fmtETB(r.paid)} / {fmtETB(r.due)}
              </span>
              <span className="text-right shrink-0 md:w-[110px]">
                <b className={`font-display text-[14px] block whitespace-nowrap ${r.balance > 0 ? 'text-warn' : 'text-good'}`}>
                  {r.balance > 0 ? fmtETB(r.balance) : t('fullyPaid')}
                </b>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function PaidPrint() {
  const t = useT()
  const db = useDb()
  // same derivation as the screen; ordered by class for filing
  const rows = [...paidRows(db)]
    .sort((a, b) => sectionLabel(db, a.student.sectionId).localeCompare(sectionLabel(db, b.student.sectionId)) || personName(a.student).localeCompare(personName(b.student)))
  const total = rows.reduce((a, r) => a + r.paid, 0)
  return (
    <PrintArea>
      <PaginatedReport
        doc={t('paidReport')}
        summary={
          <div className="flex justify-between text-[13px] mb-3">
            <span>{fmtDate(todayISO())}</span>
            <b className="font-display">{rows.length} {t('students')} — {fmtETB(total)}</b>
          </div>
        }
        headRow={
          <tr><th>#</th><th>{t('studentNo')}</th><th>{t('fullName')}</th><th>{t('section')}</th><th>{t('lastPayment')}</th><th className="!text-right">{t('paidToDate')}</th><th className="!text-right">{t('balance')}</th></tr>
        }
        rows={rows.map((r, i) => (
          <tr key={r.studentId}>
            <td className="text-dim">{i + 1}</td>
            <td className="whitespace-nowrap">{r.student.studentNo}</td>
            <td>{personName(r.student)}</td>
            <td>{sectionLabel(db, r.student.sectionId)}</td>
            <td className="whitespace-nowrap">{fmtDateShort(r.lastPaymentDate)}</td>
            <td className="text-right font-display font-bold">{fmtAmount(r.paid)}</td>
            <td className="text-right">{r.balance > 0 ? fmtAmount(r.balance) : '—'}</td>
          </tr>
        ))}
      />
    </PrintArea>
  )
}

function DefaultersPrint() {
  const t = useT()
  const db = useDb()
  // same derivation as the screen; only the ordering differs (by class, for filing)
  const rows = [...defaulterRows(db)]
    .sort((a, b) => sectionLabel(db, a.student.sectionId).localeCompare(sectionLabel(db, b.student.sectionId)) || b.balance - a.balance)
  const total = rows.reduce((a, r) => a + r.balance, 0)
  return (
    <PrintArea>
      <PaginatedReport
        doc={t('defaultersReport')}
        summary={
          <div className="flex justify-between text-[13px] mb-3">
            <span>{fmtDate(todayISO())}</span>
            <b className="font-display">{rows.length} {t('students')} — {fmtETB(total)}</b>
          </div>
        }
        headRow={
          <tr><th>#</th><th>{t('fullName')}</th><th>{t('section')}</th><th>{t('guardian')}</th><th>{t('guardianPhone')}</th><th className="!text-right">{t('balance')}</th></tr>
        }
        rows={rows.map((r, i) => (
          <tr key={r.studentId}>
            <td className="text-dim">{i + 1}</td>
            <td>{personName(r.student)}</td>
            <td>{sectionLabel(db, r.student.sectionId)}</td>
            <td>{r.student.guardianName}</td>
            <td>{r.student.guardianPhone}</td>
            <td className="text-right font-display font-bold">{fmtAmount(r.balance)}</td>
          </tr>
        ))}
      />
    </PrintArea>
  )
}
