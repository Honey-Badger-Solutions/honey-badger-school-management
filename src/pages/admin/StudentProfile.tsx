import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Avatar, EmptyState, personName } from '../../components/bits'
import { useDb } from '../../services/db'
import { balanceFor } from '../../services/fees'
import { sectionLabel, sectionReport, studentAttendance, studentExceptions } from '../../lib/derive'
import { fmtDate, fmtDateShort } from '../../lib/dates'
import { fmtETB } from '../../lib/money'
import { useT } from '../../store/session'

type Tab = 'info' | 'att' | 'marks' | 'fees'

export default function StudentProfile() {
  const t = useT()
  const db = useDb()
  const { id } = useParams()
  const [tab, setTab] = useState<Tab>('info')

  const student = db.students.find((s) => s.id === id)
  if (!student) return <EmptyState title={t('noResults')} />

  const att = studentAttendance(db, student.id)
  const rate = att.total ? Math.round(((att.present + att.late) / att.total) * 100) : null

  return (
    <>
      <Link to="/school-admin/students" className="no-print inline-flex items-center gap-1.5 text-soft font-display font-medium text-[13.5px] mb-4 hover:text-gold">
        <Icon name="chevL" size={16} />{t('back')}
      </Link>

      <div className="card-pad flex items-center gap-3 sm:gap-4 mb-4">
        <Avatar name={student.firstName} size={52} />
        <div className="flex-1 min-w-0">
          {/* no truncate: at 360px a two-line name beats "Abeba Ab…" */}
          <h1 className="text-[18px] sm:text-[20px] font-bold leading-tight">{personName(student)}</h1>
          <p className="text-soft text-[12.5px] mt-0.5">{sectionLabel(db, student.sectionId)} · {student.sex === 'M' ? t('male') : t('female')}</p>
          <p className="text-dim text-[11.5px]">{t('joined')} {student.joinedYear}</p>
        </div>
        {rate !== null && (
          <div className="text-right shrink-0">
            <div className="font-display font-bold text-[20px] sm:text-[22px] text-gold">{rate}%</div>
            <small className="text-dim text-[10.5px] leading-tight block max-w-[62px]">{t('attendanceRate')}</small>
          </div>
        )}
      </div>

      <div className="tabbar" role="tablist">
        {(
          [['info', 'personalInfo'], ['att', 'attendanceHistory'], ['marks', 'marksTab'], ['fees', 'feeHistory']] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t(label)}
          </button>
        ))}
      </div>

      {tab === 'info' && <InfoTab id={student.id} />}
      {tab === 'att' && <AttTab id={student.id} />}
      {tab === 'marks' && <MarksTab id={student.id} />}
      {tab === 'fees' && <FeesTab id={student.id} />}
    </>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 border-b border-line-soft last:border-b-0 text-[13.5px]">
      <span className="text-dim">{k}</span>
      <b className="text-right">{v}</b>
    </div>
  )
}

function InfoTab({ id }: { id: string }) {
  const t = useT()
  const db = useDb()
  const s = db.students.find((x) => x.id === id)!
  return (
    <div className="card-pad max-w-[520px]">
      <Row k={t('studentNo')} v={s.studentNo} />
      <Row k={t('schoolRefNo')} v={s.schoolRefNo || '—'} />
      <Row k={t('fullName')} v={personName(s)} />
      <Row k={t('sex')} v={s.sex === 'M' ? t('male') : t('female')} />
      <Row k={t('section')} v={sectionLabel(db, s.sectionId)} />
      <Row k={t('guardianName')} v={s.guardianName} />
      <Row k={t('guardianPhone')} v={s.guardianPhone || '—'} />
      <Row k={t('joined')} v={s.joinedYear} />
    </div>
  )
}

function AttTab({ id }: { id: string }) {
  const t = useT()
  const db = useDb()
  const att = studentAttendance(db, id)
  const days = studentExceptions(db, id)
  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4 max-w-[520px]">
        <div className="kpi"><div className="k">{t('present')}</div><div className="v text-good">{att.present}</div></div>
        <div className="kpi"><div className="k">{t('absent')}</div><div className="v text-warn">{att.absent}</div></div>
        <div className="kpi"><div className="k">{t('late')}</div><div className="v text-gold">{att.late}</div></div>
      </div>
      {days.length > 0 && (
        <div className="card max-w-[520px]">
          {days.map((d) => (
            <div key={`${d.sectionId}|${d.date}`} className="lrow !min-h-[46px]">
              <span className="flex-1 text-[13px]">{fmtDateShort(d.date)}</span>
              <span className={d.mark === 'A' ? 'pill-warn' : 'pill-gold'}>
                {t(d.mark === 'A' ? 'absent' : 'late')}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function MarksTab({ id }: { id: string }) {
  const t = useT()
  const db = useDb()
  const s = db.students.find((x) => x.id === id)!
  return (
    <>
      {db.examPeriods.map((ex) => {
        const rows = sectionReport(db, ex.id, s.sectionId)
        const mine = rows.find((r) => r.student.id === id)
        if (!mine || mine.average === null) {
          return <p key={ex.id} className="text-dim text-[13px]">{t('noMarksYet')}</p>
        }
        return (
          <div key={ex.id} className="card-pad max-w-[520px] mb-4">
            <div className="flex items-center justify-between mb-2">
              <b className="font-display text-[14px]">{ex.name}</b>
              <span className="pill-gold">{t('rank')} {mine.rank} {t('ofStudents')} {rows.length}</span>
            </div>
            {db.subjects.map((sub, i) => (
              <div key={sub.id} className="flex items-center justify-between py-2.5 border-b border-line-soft text-[13.5px]">
                <span>{sub.name}</span>
                <b className="font-display">{mine.scores[i] ?? '—'}</b>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 font-display font-bold text-[14.5px]">
              <span>{t('average')}</span>
              <span className="text-gold">{mine.average.toFixed(1)}</span>
            </div>
          </div>
        )
      })}
    </>
  )
}

function FeesTab({ id }: { id: string }) {
  const t = useT()
  const db = useDb()
  const bal = balanceFor(db, id)
  // newest first by commit order, not by business date — several payments
  // routinely share a date and their order must still be deterministic
  const payments = db.payments.filter((p) => p.studentId === id).sort((a, b) => b.serverSeq - a.serverSeq)
  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4 max-w-[520px]">
        <div className="kpi"><div className="k">{t('due')}</div><div className="v">{fmtETB(bal.due)}</div></div>
        <div className="kpi"><div className="k">{t('paidToDate')}</div><div className="v text-good">{fmtETB(bal.paid)}</div></div>
        <div className="kpi"><div className="k">{t('balance')}</div><div className={`v ${bal.balance > 0 ? 'text-warn' : 'text-good'}`}>{fmtETB(Math.max(0, bal.balance))}</div></div>
      </div>
      <h2 className="sec-h">{t('paymentHistory')}</h2>
      {payments.length === 0 ? (
        <p className="text-dim text-[13px]">{t('noPayments')}</p>
      ) : (
        <div className="card max-w-[520px]">
          {payments.map((p) => (
            <div key={p.id} className="lrow">
              <span className="w-9 h-9 rounded-[10px] bg-good/10 text-good grid place-items-center shrink-0"><Icon name="receipt" size={17} /></span>
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] block">{p.receiptNo}</b>
                <small className="text-dim text-[11.5px]">{fmtDate(p.date)} · {t(p.method)}</small>
              </span>
              <b className="font-display text-[14px]">{fmtETB(p.total)}</b>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
