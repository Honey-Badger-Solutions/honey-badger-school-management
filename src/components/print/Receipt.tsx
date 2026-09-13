/**
 * The receipt — two layouts, one set of numbers.
 *
 * It lives here rather than in a page because three screens need the same
 * paper: the school admin's Fees screen, the finance officer's, and the
 * Print-Only Staff queue. A copy per screen is how a total ends up formatted
 * one way on one desk and another way on the next.
 *
 * Which layout prints is `db.printSettings.receiptLayout`; `layout` overrides
 * it only for the settings preview, which must show a layout before it is saved.
 */
import { personName } from '../bits'
import { PrintFoot, PrintHead } from '../Print'
import { useDb } from '../../services/db'
import { balanceFor } from '../../services/fees'
import { userName } from '../../services/users'
import { sectionLabel } from '../../lib/derive'
import { fmtDate } from '../../lib/dates'
import { fmtAmount } from '../../lib/money'
import { ACCENT_TEXT } from '../../lib/print'
import { useT } from '../../store/session'
import type { Payment, ReceiptLayout } from '../../types'

/** Line items and the total — shared by the on-screen modal and the A4 sheet. */
export function ReceiptLines({ payment }: { payment: Payment }) {
  const t = useT()
  const accent = ACCENT_TEXT[useDb().printSettings.accent]
  return (
    <div>
      {payment.lines.map((l) => (
        <div key={l.feeItemId} className="flex justify-between py-2 border-b border-line-soft text-[13.5px]">
          <span>{l.label}</span>
          <span className="font-display">{fmtAmount(l.amountSantim)}</span>
        </div>
      ))}
      <div className="flex justify-between pt-3 font-display font-bold text-[15.5px]">
        <span>{t('total')}</span>
        <span className={accent}>ETB {fmtAmount(payment.totalSantim)}</span>
      </div>
    </div>
  )
}

/** The paper receipt. Renders whichever layout the school has chosen. */
export function ReceiptPaper({ payment, layout }: { payment: Payment; layout?: ReceiptLayout }) {
  const db = useDb()
  const chosen = layout ?? db.printSettings.receiptLayout
  return chosen === 'thermal' ? <ReceiptThermal payment={payment} /> : <ReceiptStandard payment={payment} />
}

/* ---------------- standard: A4, the filing copy ---------------- */

function ReceiptStandard({ payment }: { payment: Payment }) {
  const t = useT()
  const db = useDb()
  const p = db.printSettings
  const student = db.students.find((s) => s.id === payment.studentId)
  const balance = student ? balanceFor(db, student.id).balance : 0

  return (
    <div className="max-w-[520px]">
      <PrintHead doc={t('receipt')} />
      <div className="flex justify-between text-[13px] mb-1">
        <span>{t('receiptNo')} <b className="font-display">{payment.receiptNo}</b></span>
        <span>{fmtDate(payment.date)}</span>
      </div>
      {student && (
        <p className="text-[13px] mb-3">
          {t('receivedFrom')}: <b>{personName(student)}</b> ({sectionLabel(db, student.sectionId)})
        </p>
      )}
      <ReceiptLines payment={payment} />
      {p.receiptShowBalance && (
        <div className="flex justify-between pt-1.5 text-[12.5px] text-soft">
          <span>{t('balance')}</span>
          <span className="font-display">ETB {fmtAmount(Math.max(0, balance))}</span>
        </div>
      )}
      {(p.receiptShowCashier || p.receiptShowMethod) && (
        <p className="text-[12px] mt-4">
          {p.receiptShowCashier && <>{t('receivedBy')}: {userName(db, payment.receivedByUserId)}</>}
          {p.receiptShowCashier && p.receiptShowMethod && ' — '}
          {p.receiptShowMethod && t(payment.method)}
        </p>
      )}
      <p className="text-[12px] italic text-soft mt-1">{t('thankYou')}</p>
      {p.receiptShowSignature && (
        <div className="mt-8 w-[210px] text-[11.5px] text-soft">
          <div className="border-b border-ink/60 h-8" />
          <p className="mt-1">{t('receiptSignature')}</p>
        </div>
      )}
      <div className="border-t border-dashed border-line mt-4" />
      <PrintFoot />
    </div>
  )
}

/* ---------------- thermal: 80mm roll, counter printer ---------------- */

/**
 * No letterhead and no accent band: a thermal printer has one colour and
 * ~72mm of usable width, so the graphics that make the A4 sheet ours would
 * print as a grey smear. Width and page size come from `.print-thermal` in
 * index.css.
 */
function ReceiptThermal({ payment }: { payment: Payment }) {
  const t = useT()
  const db = useDb()
  const p = db.printSettings
  const student = db.students.find((s) => s.id === payment.studentId)
  const balance = student ? balanceFor(db, student.id).balance : 0

  return (
    <div className="print-thermal mx-auto text-ink">
      <div className="text-center leading-tight pb-1.5">
        <div className="font-display font-bold text-[13px]">{db.school.name}</div>
        {p.showNameAm && db.school.nameAm && <div className="text-[10px]">{db.school.nameAm}</div>}
        {(p.showCity || p.showPhone) && (
          <div className="text-[10px]">
            {[p.showCity && db.settings.city, p.showPhone && db.school.phone].filter(Boolean).join(' · ')}
          </div>
        )}
        {p.headerNote && <div className="text-[9.5px] mt-0.5">{p.headerNote}</div>}
      </div>
      <div className="border-t border-dashed border-ink/50 my-1" />
      <div className="text-[10.5px] flex justify-between">
        <span>{t('receiptNo')} {payment.receiptNo}</span>
        <span>{fmtDate(payment.date)}</span>
      </div>
      {student && <div className="text-[10.5px]">{personName(student)} · {sectionLabel(db, student.sectionId)}</div>}
      <div className="border-t border-dashed border-ink/50 my-1" />
      {payment.lines.map((l) => (
        <div key={l.feeItemId} className="flex justify-between text-[10.5px] py-[1px] gap-2">
          <span className="min-w-0 break-words">{l.label}</span>
          <span className="font-display shrink-0">{fmtAmount(l.amountSantim)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-ink/50 my-1" />
      <div className="flex justify-between font-display font-bold text-[12px]">
        <span>{t('total')}</span>
        <span>ETB {fmtAmount(payment.totalSantim)}</span>
      </div>
      {p.receiptShowBalance && (
        <div className="flex justify-between text-[10px]">
          <span>{t('balance')}</span>
          <span className="font-display">{fmtAmount(Math.max(0, balance))}</span>
        </div>
      )}
      {p.receiptShowMethod && <div className="text-[10px] mt-1">{t('method')}: {t(payment.method)}</div>}
      {p.receiptShowCashier && <div className="text-[10px]">{t('receivedBy')}: {userName(db, payment.receivedByUserId)}</div>}
      <div className="text-center text-[10px] mt-1.5">{t('thankYou')}</div>
      {p.footerNote && <div className="text-center text-[9.5px] mt-0.5">{p.footerNote}</div>}
      <div className="text-center text-[9px] mt-1">{t('brandName')}</div>
    </div>
  )
}
