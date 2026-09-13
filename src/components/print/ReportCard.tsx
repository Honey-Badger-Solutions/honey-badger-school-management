/**
 * The report card — two layouts, one set of numbers.
 *
 * Moved out of `pages/admin/Exams.tsx` because the Print-Only Staff queue now
 * prints it too. One record, one sheet: this takes `PrintHead`/`PrintFoot`
 * directly rather than `PaginatedReport`, and batching 50 of them means
 * repeating it inside `.print-page` (see CONVENTIONS "Printing").
 *
 * Which layout prints is `db.printSettings.reportCardLayout`; `layout`
 * overrides it only for the settings preview, which has to show a layout
 * before it is saved.
 */
import { personName } from '../bits'
import { PrintFoot, PrintHead } from '../Print'
import { useDb } from '../../services/db'
import { classAverage, sectionLabel, studentAttendance, subjectAverages, type ReportRow } from '../../lib/derive'
import { sexKey } from '../../lib/enums'
import { ACCENT_TEXT, gradeLetter } from '../../lib/print'
import { fmtDate, todayISO } from '../../lib/dates'
import { useT } from '../../store/session'
import type { ExamPeriod, ReportCardLayout } from '../../types'

export interface ReportCardProps {
  exam: ExamPeriod
  row: ReportRow
  /** the whole class — rank, class average and per-subject averages come from it */
  rows: ReportRow[]
  /** unsaved comment being typed in the modal, so the preview matches the field */
  commentOverride?: string
  layout?: ReportCardLayout
}

export function ReportCardPaper(props: ReportCardProps) {
  const db = useDb()
  const chosen = props.layout ?? db.printSettings.reportCardLayout
  return chosen === 'detailed' ? <ReportCardDetailed {...props} /> : <ReportCardStandard {...props} />
}

/** One stat in the summary band. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line rounded-xl p-2.5 text-center bg-surface2/50">
      <div className="text-[10px] font-display font-bold uppercase tracking-[0.4px] text-dim">{label}</div>
      <div className="font-display font-bold text-[17px] mt-0.5">{value}</div>
    </div>
  )
}

/** Name, class, exam and date — identical on both layouts. */
function ReportCardHead({ exam, row }: { exam: ExamPeriod; row: ReportRow }) {
  const t = useT()
  const db = useDb()
  const s = row.student
  return (
    <>
      <PrintHead doc={t('reportCard')} />
      <div className="flex justify-between gap-4 text-[13px] mb-4">
        <div>
          <b className="font-display text-[16px] block">{personName(s)}</b>
          <span className="text-soft">{sectionLabel(db, s.sectionId)} · {t(sexKey(s.sex))} · {exam.name}</span>
        </div>
        <div className="text-right text-soft">{fmtDate(todayISO())}</div>
      </div>
    </>
  )
}

/**
 * Everything both layouts share below the subject table: the summary band, the
 * comment box and the signature lines — each of which the school can hide.
 */
function ReportCardTail({ exam, row, rows, commentOverride }: ReportCardProps) {
  const t = useT()
  const db = useDb()
  const p = db.printSettings
  const s = row.student
  const att = studentAttendance(db, s.id)
  const ranked = rows.filter((r) => r.average !== null).length
  const comment = commentOverride ?? db.comments[`${exam.id}|${s.id}`] ?? ''
  const avg = classAverage(rows)
  // Falls back to the previous holder so a report card printed after the
  // homeroom teacher departs still carries the name of who actually taught.
  const section = db.sections.find((sec) => sec.id === s.sectionId)
  const homeroom = db.teachers.find((x) => x.id === (section?.homeroomTeacherId ?? section?.previousHomeroomTeacherId))

  // Built as a list, not a fixed four-column grid: hiding rank must close the
  // gap rather than leave an empty box on the sheet.
  const stats: [string, string][] = [[t('average'), row.average !== null ? row.average.toFixed(1) : '—']]
  if (p.reportShowRank) stats.push([t('rank'), row.average !== null ? `${row.rank} / ${ranked}` : '—'])
  if (p.reportShowClassAverage) stats.push([t('classAverage'), avg !== null ? avg.toFixed(1) : '—'])
  if (p.reportShowAttendance) {
    stats.push([t('attendanceRate'), att.total ? `${Math.round(((att.present + att.late) / att.total) * 100)}%` : '—'])
  }

  return (
    <>
      <div
        className="grid gap-2.5 mb-4"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map(([label, value]) => <Stat key={label} label={label} value={value} />)}
      </div>

      {p.reportShowComment && (
        <div className="border border-line rounded-xl p-3 min-h-[64px] mb-6">
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.4px] text-dim mb-1">{t('teacherComment')}</div>
          <p className="text-[13px] leading-relaxed">{comment || ' '}</p>
        </div>
      )}

      {p.reportShowSignatures && (
        <div className="grid grid-cols-3 gap-6 text-[12px] text-soft">
          <div>
            <div className="border-b border-ink/60 h-9" />
            <p className="mt-1">{t('roleTeacher')} — {homeroom ? personName(homeroom) : ''}</p>
          </div>
          <div>
            <div className="border-b border-ink/60 h-9" />
            <p className="mt-1">{t('principal')}{p.principalName ? ` — ${p.principalName}` : ''}</p>
          </div>
          <div>
            <div className="border-b border-ink/60 h-9" />
            <p className="mt-1">{t('guardian')} — {s.guardianName}</p>
          </div>
        </div>
      )}
      <PrintFoot />
    </>
  )
}

/* ---------------- standard: subject, mark, summary ---------------- */

function ReportCardStandard(props: ReportCardProps) {
  const t = useT()
  const db = useDb()
  const { exam, row } = props
  return (
    <div className="max-w-[680px] mx-auto">
      <ReportCardHead exam={exam} row={row} />
      <table className="tbl w-full mb-4">
        <thead>
          <tr>
            <th>{t('subject')}</th>
            <th className="!text-right">{t('marksTab')} ({t('outOf')} {exam.maxMark})</th>
          </tr>
        </thead>
        <tbody>
          {db.subjects.map((sub, i) => (
            <tr key={sub.id}>
              <td>{sub.name}</td>
              <td className="text-right font-display font-semibold">{row.scores[i] ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReportCardTail {...props} />
    </div>
  )
}

/* ---------------- detailed: adds out-of, class average, grade ---------------- */

/**
 * The same marks with the context a parent asks for out loud — "out of what?",
 * "is that good?" — plus the attendance breakdown. Nothing is computed
 * differently here: the extra columns are `subjectAverages()` and a letter off
 * the fixed scale in `lib/print.ts`.
 */
function ReportCardDetailed(props: ReportCardProps) {
  const t = useT()
  const db = useDb()
  const { exam, row, rows } = props
  const subAvg = subjectAverages(rows)
  const att = studentAttendance(db, row.student.id)
  const accent = ACCENT_TEXT[db.printSettings.accent]

  return (
    <div className="max-w-[680px] mx-auto">
      <ReportCardHead exam={exam} row={row} />
      <div className="table-wrap mb-3">
        <table className="tbl w-full">
          <thead>
            <tr>
              <th>{t('subject')}</th>
              <th className="!text-right">{t('marksTab')}</th>
              <th className="!text-right">{t('outOf')}</th>
              <th className="!text-right">{t('classAverage')}</th>
              <th className="!text-right">{t('gradeLetter')}</th>
            </tr>
          </thead>
          <tbody>
            {db.subjects.map((sub, i) => {
              const score = row.scores[i] ?? null
              const classAvg = subAvg[i] ?? null
              return (
                <tr key={sub.id}>
                  <td>{sub.name}</td>
                  <td className="text-right font-display font-semibold">{score ?? '—'}</td>
                  <td className="text-right text-soft">{exam.maxMark}</td>
                  <td className="text-right text-soft">{classAvg !== null ? classAvg.toFixed(1) : '—'}</td>
                  <td className="text-right font-display font-semibold">
                    {gradeLetter(score === null ? null : (score / exam.maxMark) * 100)}
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className="font-display font-bold">{t('total')}</td>
              <td className={`text-right font-display font-bold ${accent}`}>{row.total}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>

      {db.printSettings.reportShowAttendance && (
        <p className="text-[12px] text-soft mb-3">
          {t('attendanceLabel')}: {t('present')} {att.present} · {t('absent')} {att.absent} · {t('late')} {att.late}
          {att.total ? ` (${t('outOf')} ${att.total})` : ''}
        </p>
      )}
      <ReportCardTail {...props} />
    </div>
  )
}
