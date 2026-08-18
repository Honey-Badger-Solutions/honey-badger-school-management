import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar, EmptyState, PageTitle, personName } from '../../components/bits'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { PrintArea, PrintFoot, PrintHead, printNow } from '../../components/Print'
import { useDb } from '../../services/db'
import { addExamPeriod, saveComment } from '../../services/exams'
import { classAverage, sectionLabel, sectionReport, studentAttendance, type ReportRow } from '../../lib/derive'
import { fmtDate, todayISO } from '../../lib/dates'
import { useT } from '../../store/session'
import type { ExamPeriod } from '../../types'

export default function Exams() {
  const t = useT()
  const db = useDb()
  const [examId, setExamId] = useState(db.examPeriods[0]?.id ?? '')
  const [sectionId, setSectionId] = useState('')
  const [adding, setAdding] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null) // studentId
  const [printAll, setPrintAll] = useState(false)

  const exam = db.examPeriods.find((e) => e.id === examId)
  const rows = exam && sectionId ? sectionReport(db, examId, sectionId) : []
  const avg = classAverage(rows)

  return (
    <>
      <PageTitle title={t('examsTitle')}>
        <button className="btn-ghost btn-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />{t('addExam')}
        </button>
        {rows.length > 0 && (
          <button className="btn-gold btn-sm" onClick={() => { setPrintAll(true); printNow(() => setPrintAll(false)) }}>
            <Icon name="printer" size={16} />{t('printAllReports')}
          </button>
        )}
      </PageTitle>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="bg-surface border border-line rounded-full px-4 min-h-[46px] text-[13.5px] font-medium" value={examId} onChange={(e) => setExamId(e.target.value)} aria-label={t('pickExam')}>
          {db.examPeriods.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.term}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-full px-4 min-h-[46px] text-[13.5px] font-medium" value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label={t('section')}>
          <option value="">{t('chooseClass')}</option>
          {db.sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(db, s.id)}</option>)}
        </select>
        {avg !== null && <span className="pill-gold self-center">{t('classAverage')}: {avg.toFixed(1)}</span>}
      </div>

      {!sectionId ? (
        <div className="card"><EmptyState icon="exam" title={t('reportCards')} sub={t('chooseClassForReports')} /></div>
      ) : (
        <div className="card">
          {rows.map((r) => (
            <button key={r.student.id} className="lrow" onClick={() => setOpenRow(r.student.id)}>
              <span className="w-8 text-center font-display font-bold text-[13px] text-dim shrink-0">
                {r.average !== null ? r.rank : '—'}
              </span>
              <Avatar name={r.student.firstName} size={36} />
              <span className="flex-1 min-w-0 text-left">
                <b className="text-[13.5px] block truncate">{personName(r.student)}</b>
                <small className="text-dim text-[11.5px]">
                  {r.average !== null ? `${t('average')} ${r.average.toFixed(1)}` : t('noMarksYet')}
                </small>
              </span>
              <Icon name="printer" size={17} className="text-dim shrink-0" />
            </button>
          ))}
        </div>
      )}

      {adding && <AddExamModal onClose={() => setAdding(false)} />}
      {openRow && exam && (
        <ReportCardModal
          exam={exam}
          sectionId={sectionId}
          studentId={openRow}
          onClose={() => setOpenRow(null)}
        />
      )}
      {printAll && exam && (
        <PrintArea>
          {rows.filter((r) => r.average !== null).map((r) => (
            <div key={r.student.id} className="print-page">
              <ReportCardPaper exam={exam} row={r} rows={rows} />
            </div>
          ))}
        </PrintArea>
      )}
    </>
  )
}

function AddExamModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const db = useDb()
  const [name, setName] = useState('')
  const [max, setMax] = useState('100')
  const submit = async () => {
    const m = parseInt(max, 10)
    if (!name.trim() || !m) return
    await addExamPeriod(name.trim(), db.settings.term, m)
    toast(t('settingsSaved'))
    onClose()
  }
  return (
    <Modal title={t('addExam')} onClose={onClose}>
      <div className="field">
        <label htmlFor="ax-name">{t('examName')}</label>
        <input id="ax-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Final Exam" />
      </div>
      <div className="field">
        <label htmlFor="ax-max">{t('maxMark')}</label>
        <input id="ax-max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="flex gap-2.5 mt-4">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-gold flex-1" onClick={submit}>{t('save')}</button>
      </div>
    </Modal>
  )
}

/* ---------------- single report card: modal + print ---------------- */

function ReportCardModal({ exam, sectionId, studentId, onClose }: {
  exam: ExamPeriod
  sectionId: string
  studentId: string
  onClose: () => void
}) {
  const t = useT()
  const db = useDb()
  const rows = sectionReport(db, exam.id, sectionId)
  const row = rows.find((r) => r.student.id === studentId)!
  const commentKey = `${exam.id}|${studentId}`
  const [comment, setComment] = useState(db.comments[commentKey] ?? '')

  const saveAndPrint = async () => {
    await saveComment(exam.id, studentId, comment)
    printNow()
  }

  return (
    <>
      <Modal title={`${t('reportCard')} — ${personName(row.student)}`} onClose={onClose}>
        <div className="mb-3">
          {db.subjects.map((sub, i) => (
            <div key={sub.id} className="flex justify-between py-2 border-b border-line-soft text-[13.5px]">
              <span>{sub.name}</span>
              <b className="font-display">{row.scores[i] ?? '—'}</b>
            </div>
          ))}
          <div className="flex justify-between pt-2.5 font-display font-bold text-[14.5px]">
            <span>{t('average')}</span>
            <span className="text-gold">{row.average?.toFixed(1) ?? '—'} · {t('rank')} {row.rank}/{rows.filter((r) => r.average !== null).length}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="rc-comment">{t('teacherComment')}</label>
          <textarea id="rc-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('commentPlaceholder')} />
        </div>
        <div className="flex gap-2.5">
          <button
            className="btn-ghost flex-1"
            onClick={async () => { await saveComment(exam.id, studentId, comment); toast(t('commentSaved')); onClose() }}
          >
            {t('save')}
          </button>
          <button className="btn-gold flex-1" onClick={saveAndPrint}>
            <Icon name="printer" size={17} />{t('printReport')}
          </button>
        </div>
      </Modal>
      <PrintArea>
        <ReportCardPaper exam={exam} row={{ ...row }} rows={rows} commentOverride={comment} />
      </PrintArea>
    </>
  )
}

/** The paper report card — HoneyBadger's signature print design. */
export function ReportCardPaper({ exam, row, rows, commentOverride }: {
  exam: ExamPeriod
  row: ReportRow
  rows: ReportRow[]
  commentOverride?: string
}) {
  const t = useT()
  const db = useDb()
  const s = row.student
  const att = studentAttendance(db, s.id)
  const ranked = rows.filter((r) => r.average !== null).length
  const comment = commentOverride ?? db.comments[`${exam.id}|${s.id}`] ?? ''
  const avg = classAverage(rows)
  // Falls back to the previous holder so a report card printed after the
  // homeroom teacher departs still carries the name of who actually taught.
  const section = db.sections.find((sec) => sec.id === s.sectionId)
  const homeroom = db.teachers.find((x) => x.id === (section?.homeroomTeacherId ?? section?.previousHomeroomTeacherId))

  return (
    <div className="max-w-[680px] mx-auto">
      <PrintHead doc={t('reportCard')} />
      <div className="flex justify-between gap-4 text-[13px] mb-4">
        <div>
          <b className="font-display text-[16px] block">{personName(s)}</b>
          <span className="text-soft">{sectionLabel(db, s.sectionId)} · {s.sex === 'M' ? t('male') : t('female')} · {exam.name}</span>
        </div>
        <div className="text-right text-soft">
          {fmtDate(todayISO())}
        </div>
      </div>

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

      {/* summary band */}
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {[
          [t('average'), row.average !== null ? row.average.toFixed(1) : '—'],
          [t('rank'), row.average !== null ? `${row.rank} / ${ranked}` : '—'],
          [t('classAverage'), avg !== null ? avg.toFixed(1) : '—'],
          [t('attendanceRate'), att.total ? `${Math.round(((att.present + att.late) / att.total) * 100)}%` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="border border-line rounded-xl p-2.5 text-center bg-surface2/50">
            <div className="text-[10px] font-display font-bold uppercase tracking-[0.4px] text-dim">{k}</div>
            <div className="font-display font-bold text-[17px] mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="border border-line rounded-xl p-3 min-h-[64px] mb-6">
        <div className="text-[10px] font-display font-bold uppercase tracking-[0.4px] text-dim mb-1">{t('teacherComment')}</div>
        <p className="text-[13px] leading-relaxed">{comment || ' '}</p>
      </div>

      <div className="grid grid-cols-2 gap-8 text-[12px] text-soft">
        <div>
          <div className="border-b border-ink/60 h-9" />
          <p className="mt-1">{t('roleTeacher')} — {homeroom ? personName(homeroom) : ''}</p>
        </div>
        <div>
          <div className="border-b border-ink/60 h-9" />
          <p className="mt-1">{t('guardian')} — {s.guardianName}</p>
        </div>
      </div>
      <PrintFoot />
    </div>
  )
}
