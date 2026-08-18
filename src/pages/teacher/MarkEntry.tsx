import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageTitle, personName, SaveChip, type SaveState } from '../../components/bits'
import { saveMark } from '../../services/exams'
import { markOf, rosterOf, sectionLabel } from '../../lib/derive'
import { useT } from '../../store/session'
import { useTeacher } from './useTeacher'
import { NoClasses } from './NoClasses'

/**
 * Keyboard-first mark entry: type a mark, press Enter (or Tab) to jump to the
 * next student. Values save optimistically per keystroke-commit; out-of-range
 * values are flagged inline and not saved.
 */

/** Strips letters, keeps digits + one decimal point + a leading minus. */
export function normalizeMarkInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.-]/g, '')
  const sign = cleaned.startsWith('-') ? '-' : ''
  const body = cleaned.replace(/-/g, '').replace(/(\..*)\./g, '$1')
  return (sign + body).slice(0, 6)
}
export default function MarkEntry() {
  const t = useT()
  const { db, teacher, sectionIds, subjectsFor } = useTeacher()
  const [params, setParams] = useSearchParams()
  const sectionId = params.get('section') && sectionIds.includes(params.get('section')!)
    ? params.get('section')!
    : sectionIds[0]
  const subjects = subjectsFor(sectionId)
  const [subjectId, setSubjectId] = useState(subjects[0])
  const [examId, setExamId] = useState(db.examPeriods[0]?.id ?? '')
  const [save, setSave] = useState<SaveState>('idle')
  // local draft text per student (so partial typing isn't clobbered by db round-trips)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const inputs = useRef<Record<number, HTMLInputElement | null>>({})

  const exam = db.examPeriods.find((e) => e.id === examId)
  const max = exam?.maxMark ?? 100
  const roster = useMemo(() => rosterOf(db, sectionId), [db, sectionId])
  const activeSubject = subjects.includes(subjectId) ? subjectId : subjects[0]

  const valueFor = (studentId: string): string => {
    if (draft[studentId] !== undefined) return draft[studentId]
    const m = markOf(db, examId, activeSubject, studentId)
    return m === null ? '' : String(m)
  }

  const isInvalid = (v: string) => {
    if (v === '') return false
    const n = Number(v)
    return !Number.isFinite(n) || n < 0 || n > max
  }

  const commit = async (studentId: string, v: string) => {
    if (isInvalid(v)) return
    setSave('saving')
    await saveMark(examId, activeSubject, studentId, v === '' ? null : Number(v))
    setSave('synced')
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number, studentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(studentId, valueFor(studentId))
      const next = inputs.current[idx + 1]
      if (next) { next.focus(); next.select() }
    }
  }

  const entered = roster.filter((s) => valueFor(s.id) !== '' && !isInvalid(valueFor(s.id)))
  const avg = entered.length
    ? entered.reduce((a, s) => a + Number(valueFor(s.id)), 0) / entered.length
    : null

  const pickSection = (id: string) => {
    params.set('section', id)
    setParams(params, { replace: true })
    setDraft({})
    const subs = subjectsFor(id)
    if (!subs.includes(subjectId)) setSubjectId(subs[0])
  }

  if (!teacher) return null // Guard is ending this session
  if (sectionIds.length === 0) {
    return (
      <>
        <PageTitle title={t('marksTitle')} />
        <NoClasses />
      </>
    )
  }

  return (
    <>
      <PageTitle title={t('marksTitle')}>
        <SaveChip state={save} />
      </PageTitle>

      <div className="flex flex-wrap gap-2 mb-3">
        <select className="bg-surface border border-line rounded-full px-4 min-h-[44px] text-[13.5px] font-medium" value={sectionId} onChange={(e) => pickSection(e.target.value)} aria-label={t('section')}>
          {sectionIds.map((id) => <option key={id} value={id}>{sectionLabel(db, id)}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-full px-4 min-h-[44px] text-[13.5px] font-medium" value={activeSubject} onChange={(e) => { setSubjectId(e.target.value); setDraft({}) }} aria-label={t('subject')}>
          {subjects.map((sid) => <option key={sid} value={sid}>{db.subjects.find((s) => s.id === sid)?.name}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-full px-4 min-h-[44px] text-[13.5px] font-medium" value={examId} onChange={(e) => { setExamId(e.target.value); setDraft({}) }} aria-label={t('pickExam')}>
          {db.examPeriods.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="card-pad flex flex-wrap items-center gap-3 mb-4 text-[13px]">
        <span className="pill-gold">{entered.length}/{roster.length} {t('entered')}</span>
        <span className="pill-dim">{t('classAverage')}: {avg !== null ? avg.toFixed(1) : '—'}</span>
        <span className="text-dim text-[12px] ml-auto">{t('markRange').replace('{max}', String(max))}</span>
      </div>

      <div className="card">
        {roster.map((s, i) => {
          const v = valueFor(s.id)
          const bad = isInvalid(v)
          return (
            <div key={s.id} className="lrow !py-1.5 !min-h-[52px]">
              <span className="w-6 text-center text-dim text-[12px] font-display shrink-0">{i + 1}</span>
              <label htmlFor={`mk-${s.id}`} className="flex-1 min-w-0 text-[13.5px] font-medium truncate cursor-pointer">
                {personName(s)}
              </label>
              {bad && <span className="pill-warn">{t('invalidMark')}</span>}
              <input
                id={`mk-${s.id}`}
                ref={(el) => { inputs.current[i] = el }}
                inputMode="decimal"
                autoComplete="off"
                value={v}
                onChange={(e) => setDraft((d) => ({
                  ...d,
                  // letters never register; a typed minus is KEPT so it can be
                  // flagged as invalid rather than silently becoming a positive
                  [s.id]: normalizeMarkInput(e.target.value),
                }))}
                onKeyDown={(e) => onKey(e, i, s.id)}
                onBlur={() => commit(s.id, valueFor(s.id))}
                onFocus={(e) => e.target.select()}
                className={`w-[76px] min-h-[46px] text-center font-display font-bold text-[16px] bg-white border rounded-xl transition-colors ${
                  bad ? 'border-warn text-warn' : 'border-line focus:border-gold'
                }`}
                aria-invalid={bad}
                aria-label={`${personName(s)} — ${t('marksTab')}`}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
