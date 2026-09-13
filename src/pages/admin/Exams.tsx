import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar, EmptyState, PageTitle, personName } from '../../components/bits'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { PrintArea, printNow } from '../../components/Print'
import { ReportCardPaper } from '../../components/print/ReportCard'
import { PrintByStaffButton } from '../../components/print/PrintByStaff'
import { useDb } from '../../services/db'
import { addExamPeriod, saveComment } from '../../services/exams'
import { classAverage, sectionLabel, sectionReport } from '../../lib/derive'
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
        <div className="flex flex-wrap gap-2.5">
          <button
            className="btn-ghost flex-1"
            onClick={async () => { await saveComment(exam.id, studentId, comment); toast(t('commentSaved')); onClose() }}
          >
            {t('save')}
          </button>
          {/* Queue it for the print desk instead. The comment is saved first,
              because the desk prints from live data — an unsaved comment would
              simply be missing from the sheet they hand over. */}
          <PrintByStaffButton
            what={{ kind: 'report_card', subjectId: studentId, examId: exam.id }}
            onBeforeRequest={() => saveComment(exam.id, studentId, comment)}
          />
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

