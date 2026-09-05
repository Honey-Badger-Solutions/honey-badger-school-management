import { useState } from 'react'
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { PageTitle } from "../../components/bits";
import { useDb } from "../../services/db";
import { currentUser } from "../../services/users";
import { allBalances } from "../../services/fees";
import { fmtDate, todayISO } from "../../lib/dates";
import { fmtETB } from "../../lib/money";
import { useT } from "../../store/session";
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { addFeeItem } from '../../services/fees'

/**
 * What is missing right now — sections that have not marked attendance today
 * and subjects with no marks for the current exam. Each row leads to the
 * person responsible, which is what an administrator actually acts on.
 */

function StructureTab() {
  const t = useT()
  const db = useDb()
  const [adding, setAdding] = useState<string | null>(null)

  return (
    <>
      <p className="text-soft text-[13px] mb-4">{t('feeStructureLead')}</p>
      <div className="grid grid-cols-1 xmd:grid-cols-2 lg:grid-cols-3 gap-4">
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


/** Money in a KPI tile: the amount stays big, the currency shrinks — at 360px
 *  "ETB 333,400" at full size wraps onto two lines and breaks the tile. */
function Birr({ amount }: { amount: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[12px] font-semibold text-dim align-middle mr-1">
        ETB
      </span>
      {amount.toLocaleString("en-US")}
    </span>
  );
}

export default function FinanceDashboard() {
  const t = useT();
  const db = useDb();
  const today = todayISO();

  // one pass over the book, bucketed by class — not six scans
  const balances = allBalances(db);
  const collected = balances.reduce((a, b) => a + b.paid, 0);
  const outstanding = balances.reduce((a, b) => a + Math.max(0, b.balance), 0);
  const defaulters = balances.filter((b) => b.balance > 0).length;
  const activeStudents = db.students.filter(
    (s) => s.status === "active",
  ).length;

  return (
    <>
      <PageTitle
        title={`${t("goodMorning")}, ${currentUser(db)?.firstName ?? ""}`}
      >
        <span className="pill-dim">
          <Icon name="calendar" size={13} />
          {fmtDate(today)}
        </span>
      </PageTitle>

      {/* quick actions first — the two things the office does all day */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <Link
          to="/finance/fees?pay=1"
          className="btn-gold !justify-start !min-h-[58px]"
        >
          <Icon name="receipt" size={20} />
          {t("qaPayment")}
        </Link>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="kpi">
          <div className="k">{t("totalStudents")}</div>
          <div className="v">{activeStudents.toLocaleString()}</div>
          <div className="text-[11.5px] text-dim mt-1 hidden sm:block">
            {t("structureLine")
              .replace("{g}", String(db.grades.length))
              .replace("{s}", String(db.sections.length))}
          </div>
        </div>
        <div className="kpi">
          <div className="k">{t("collected")}</div>
          <div className="v text-good">
            <Birr amount={collected} />
          </div>
          <div className="text-[11.5px] text-dim mt-1 hidden sm:block">
            {t("familiesPaidFully")
              .replace("{f}", String(activeStudents - defaulters))
              .replace("{t}", String(db.settings.term))}
          </div>
        </div>
        <div className="kpi">
          <div className="k">{t("outstanding")}</div>
          <div className="v text-warn">
            <Birr amount={outstanding} />
          </div>
          <div className="text-[11.5px] text-dim mt-1 hidden sm:block">
            {defaulters} {t("defaultersShort")}
          </div>
        </div>
      </div>

      <h2 className="sec-h">{t("feesThisTerm")}</h2>
      {/* stacks on a phone: side-by-side squeezed the bar to half a screen */}
      <div className="card-pad flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1">
          <div className="flex justify-between gap-3 text-[12.5px] mb-1.5">
            <span className="text-good font-semibold">
              {t("collected")} {fmtETB(collected)}
            </span>
            <span className="text-warn font-semibold">
              {t("outstanding")} {fmtETB(outstanding)}
            </span>
          </div>
          <div className="h-[10px] rounded-full bg-warn/15 overflow-hidden">
            <i
              className="block h-full rounded-full bg-gradient-to-r from-honey-dark to-honey"
              style={{
                width: `${(collected / Math.max(1, collected + outstanding)) * 100}%`,
              }}
            />
          </div>
        </div>
        <Link
          to="/finance/fees?tab=out"
          className="btn-ghost btn-sm shrink-0 w-full sm:w-auto"
        >
          {t("viewAll")}
        </Link>
      </div>
      

      <h2 className="sec-h">{t("feeStructure")}</h2>
      <StructureTab/>
    </>
  );
}
