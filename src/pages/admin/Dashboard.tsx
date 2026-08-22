import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageTitle, personName } from '../../components/bits'
import { useDb } from '../../services/db'
import { allBalances } from '../../services/fees'
import { getCompliance } from '../../services/compliance'
import { registerState } from '../../services/attendance'
import { countMarks, marksBySectionOn, sectionLabel } from '../../lib/derive'
import { fmtDate, todayISO } from '../../lib/dates'
import { fmtETB } from '../../lib/money'
import { useT } from '../../store/session'

/**
 * What is missing right now — sections that have not marked attendance today
 * and subjects with no marks for the current exam. Each row leads to the
 * person responsible, which is what an administrator actually acts on.
 */
function CompliancePanel() {
  const t = useT()
  const db = useDb()
  const { attendance, marks, clear } = getCompliance(db)

  const nameOf = (teacherId: string | null) => {
    const teacher = teacherId ? db.teachers.find((x) => x.id === teacherId) : undefined
    return teacher ? personName(teacher) : t('unassignedTeacher')
  }
  const linkFor = (teacherId: string | null) => (teacherId ? `/school-admin/staff/${teacherId}` : '/school-admin/staff')

  return (
    <>
      <h2 className="sec-h">{t('workCompliance')}</h2>
      {clear ? (
        <div className="card-pad flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-good/15 text-good grid place-items-center shrink-0">
            <Icon name="check" size={20} />
          </span>
          <span>
            <b className="text-[14px] block">{t('allCaughtUp')}</b>
            <small className="text-dim text-[12px]">{t('allCaughtUpSub')}</small>
          </span>
        </div>
      ) : (
        <div className="card">
          {attendance.map((gap) => (
            <Link key={`a-${gap.sectionId}`} to={linkFor(gap.teacherId)} className="lrow">
              {/* half-done reads differently from untouched: one needs finishing,
                  the other needs starting */}
              <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                gap.state === 'in_progress' ? 'bg-honey/20 text-amber' : 'bg-warn/15 text-warn'
              }`}>
                <Icon name="clipboard" size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] block">{sectionLabel(db, gap.sectionId)}</b>
                <small className="text-dim text-[12px]">
                  {gap.state === 'in_progress' ? t('regInProgress') : t('regNotStarted')} · {nameOf(gap.teacherId)}
                </small>
              </span>
              <Icon name="chevR" size={17} className="text-dim shrink-0" />
            </Link>
          ))}
          {marks.map((gap) => (
            <Link key={`m-${gap.sectionId}-${gap.subjectId}`} to={linkFor(gap.teacherId)} className="lrow">
              <span className="w-9 h-9 rounded-xl bg-honey/15 text-gold grid place-items-center shrink-0">
                <Icon name="edit" size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] block">
                  {sectionLabel(db, gap.sectionId)} — {db.subjects.find((s) => s.id === gap.subjectId)?.name}
                </b>
                <small className="text-dim text-[12px]">{t('noMarksEntered')} · {nameOf(gap.teacherId)}</small>
              </span>
              <Icon name="chevR" size={17} className="text-dim shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

/** Money in a KPI tile: the amount stays big, the currency shrinks — at 360px
 *  "ETB 333,400" at full size wraps onto two lines and breaks the tile. */
function Birr({ amount }: { amount: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[12px] font-semibold text-dim align-middle mr-1">ETB</span>
      {amount.toLocaleString('en-US')}
    </span>
  )
}

export default function Dashboard() {
  const t = useT()
  const db = useDb()
  const today = todayISO()

  // one pass over the book, bucketed by class — not six scans
  const todayBySection = marksBySectionOn(db, today)
  const agg = [...todayBySection.values()].reduce(
    (acc, marks) => {
      const c = countMarks(marks)
      acc.present += c.present; acc.absent += c.absent; acc.late += c.late
      return acc
    },
    { present: 0, absent: 0, late: 0 },
  )
  const balances = allBalances(db)
  const collected = balances.reduce((a, b) => a + b.paid, 0)
  const outstanding = balances.reduce((a, b) => a + Math.max(0, b.balance), 0)
  const defaulters = balances.filter((b) => b.balance > 0).length
  const activeStudents = db.students.filter((s) => s.status === 'active').length

  return (
    <>
      <PageTitle title={`${t('goodMorning')}, ${db.settings.currentUser.split(' ')[0]}`}>
        <span className="pill-dim"><Icon name="calendar" size={13} />{fmtDate(today)}</span>
      </PageTitle>

      {/* quick actions first — the two things the office does all day */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <Link to="/school-admin/students?register=1" className="btn-gold !justify-start !min-h-[58px]">
          <Icon name="plus" size={20} />
          {t('qaRegister')}
        </Link>
        <Link to="/school-admin/fees?pay=1" className="btn-ghost !justify-start !min-h-[58px]">
          <Icon name="receipt" size={20} className="text-gold" />
          {t('qaPayment')}
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="kpi">
          <div className="k">{t('totalStudents')}</div>
          <div className="v">{activeStudents.toLocaleString()}</div>
          <div className="text-[11.5px] text-dim mt-1">
            {t('structureLine').replace('{g}', String(db.grades.length)).replace('{s}', String(db.sections.length))}
          </div>
        </div>
        <div className="kpi">
          <div className="k">{t('todayAttendance')}</div>
          <div className="v">{agg.present ? `${Math.round((agg.present / Math.max(1, agg.present + agg.absent + agg.late)) * 100)}%` : '—'}</div>
          <div className="text-[11.5px] text-dim mt-1">{todayBySection.size}/{db.sections.length} {t('sectionsMarked')}</div>
        </div>
        <div className="kpi">
          <div className="k">{t('collected')}</div>
          <div className="v text-good"><Birr amount={collected} /></div>
          <div className="text-[11.5px] text-dim mt-1">{db.settings.term}</div>
        </div>
        <div className="kpi">
          <div className="k">{t('outstanding')}</div>
          <div className="v text-warn"><Birr amount={outstanding} /></div>
          <div className="text-[11.5px] text-dim mt-1">{defaulters} {t('defaultersShort')}</div>
        </div>
      </div>

      <CompliancePanel />

      <h2 className="sec-h">{t('qaAttendanceToday')}</h2>
      <div className="card">
        {db.sections.map((sec) => {
          const dayMarks = todayBySection.get(sec.id)
          const c = dayMarks ? countMarks(dayMarks) : null
          return (
            <div key={sec.id} className="lrow flex-wrap !gap-2">
              <b className="font-display text-[13px] sm:text-[13.5px] w-[70px] sm:w-[72px] shrink-0 whitespace-nowrap">{sectionLabel(db, sec.id)}</b>
              {c ? (
                <>
                  <div className="flex-1 h-[8px] rounded-full bg-surface3 overflow-hidden min-w-[60px] basis-full sm:basis-auto order-last sm:order-none">
                    <i className="block h-full rounded-full bg-gradient-to-r from-honey-dark to-honey" style={{ width: `${(c.present / c.total) * 100}%` }} />
                  </div>
                  <span className="pill-good !px-2">{c.present} {t('present')}</span>
                  {c.absent > 0 && <span className="pill-warn !px-2">{c.absent} {t('absent')}</span>}
                  {c.late > 0 && <span className="pill-gold !px-2">{c.late} {t('late')}</span>}
                  {registerState(db, sec.id, todayISO()) === 'in_progress' && (
                    <span className="pill-dim !px-2">{t('regInProgress')}</span>
                  )}
                </>
              ) : (
                <span className="flex-1 text-right text-dim text-[12.5px]">{t('regNotStarted')}</span>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="sec-h">{t('feesThisTerm')}</h2>
      {/* stacks on a phone: side-by-side squeezed the bar to half a screen */}
      <div className="card-pad flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1">
          <div className="flex justify-between gap-3 text-[12.5px] mb-1.5">
            <span className="text-good font-semibold">{t('collected')} {fmtETB(collected)}</span>
            <span className="text-warn font-semibold">{t('outstanding')} {fmtETB(outstanding)}</span>
          </div>
          <div className="h-[10px] rounded-full bg-warn/15 overflow-hidden">
            <i className="block h-full rounded-full bg-gradient-to-r from-honey-dark to-honey" style={{ width: `${(collected / Math.max(1, collected + outstanding)) * 100}%` }} />
          </div>
        </div>
        <Link to="/school-admin/fees?tab=out" className="btn-ghost btn-sm shrink-0 w-full sm:w-auto">{t('viewAll')}</Link>
      </div>
    </>
  )
}
