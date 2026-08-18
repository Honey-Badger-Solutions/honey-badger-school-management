import { useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { PageTitle } from '../../components/bits'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { useDb } from '../../services/db'
import { addGrade, addSection, resetDemoData, saveSettings, suggestNextClassName, suggestNextGrade } from '../../services/settings'
import { saveGrading, weightsProblem, weightsTotal } from '../../services/grading'
import { rosterOf, sectionLabel } from '../../lib/derive'
import { useSession, useT } from '../../store/session'
import { ASSESSMENT_TYPE_IDS, type AssessmentTypeId, type GradingWeights } from '../../types'
import type { TKey } from '../../i18n'

/** Label key per assessment type — the fixed vocabulary schools tune weights for. */
export const TYPE_KEYS: Record<AssessmentTypeId, TKey> = {
  homework: 'tyHomework',
  classwork: 'tyClasswork',
  exercise_book: 'tyExerciseBook',
  worksheets: 'tyWorksheets',
  assignments: 'tyAssignments',
  tests: 'tyTests',
  exams: 'tyExams',
  final_exam: 'tyFinalExam',
}

export default function Settings() {
  const t = useT()
  const db = useDb()
  const lang = useSession((s) => s.lang)
  const setLang = useSession((s) => s.setLang)
  const [form, setForm] = useState({ ...db.settings })
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    await saveSettings(form)
    setBusy(false)
    toast(t('settingsSaved'))
  }

  const reset = async () => {
    if (!window.confirm(t('resetConfirm'))) return
    await resetDemoData()
    toast(t('resetDone'))
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <>
      <PageTitle title={t('settingsTitle')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start max-w-[900px]">
        <div className="card-pad">
          <h2 className="font-display font-bold text-[15px] mb-4">{t('schoolInfo')}</h2>
          <div className="field">
            <label htmlFor="st-name">{t('schoolName')}</label>
            <input id="st-name" value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-nameAm">{t('schoolNameAm')}</label>
            <input id="st-nameAm" value={form.schoolNameAm} onChange={(e) => set('schoolNameAm', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
            <div className="field">
              <label htmlFor="st-city">{t('city')}</label>
              <input id="st-city" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="st-phone">{t('phone')}</label>
              <input id="st-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
            <div className="field">
              <label htmlFor="st-year">{t('academicYear')}</label>
              <input id="st-year" value={form.academicYear} onChange={(e) => set('academicYear', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="st-term">{t('term')}</label>
              <input id="st-term" value={form.term} onChange={(e) => set('term', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="st-user">{t('yourName')}</label>
            <input id="st-user" value={form.currentUser} onChange={(e) => set('currentUser', e.target.value)} />
          </div>
          <button className="btn-gold w-full" onClick={save} disabled={busy}>{busy ? t('saving') : t('save')}</button>
        </div>

        <div className="flex flex-col gap-5">
          <StructureCard />

          <GradingCard />

          <div className="card-pad">
            <h2 className="font-display font-bold text-[15px] mb-3">{t('language')}</h2>
            <div className="seg">
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>{t('langEn')}</button>
              <button className={lang === 'am' ? 'on' : ''} onClick={() => setLang('am')}>{t('langAm')}</button>
            </div>
          </div>

          <div className="card-pad border-warn/30">
            <h2 className="font-display font-bold text-[15px] mb-1.5">{t('demoData')}</h2>
            <p className="text-dim text-[12.5px] mb-3">{t('resetDemoSub')}</p>
            <button className="btn-danger" onClick={reset}>
              <Icon name="alert" size={16} />{t('resetDemo')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- grades & classes ---------------- */

function StructureCard() {
  const t = useT()
  const db = useDb()
  const [adding, setAdding] = useState(false)
  return (
    <div className="card-pad">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h2 className="font-display font-bold text-[15px]">{t('structure')}</h2>
        <button className="btn-ghost btn-sm shrink-0" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />{t('addClass')}
        </button>
      </div>
      <p className="text-dim text-[12.5px] mb-3">{t('structureLead')}</p>
      {db.grades.map((g) => (
        <div key={g.id} className="py-2.5 border-b border-line-soft last:border-b-0">
          <b className="font-display text-[13.5px]">{g.name}</b>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {db.sections.filter((s) => s.gradeId === g.id).map((s) => (
              <span key={s.id} className="pill-dim">{sectionLabel(db, s.id)} · {rosterOf(db, s.id).length}</span>
            ))}
          </div>
        </div>
      ))}
      <p className="text-dim text-[12px] mt-3">{db.subjects.map((s) => s.name).join(' · ')}</p>
      {adding && <AddStructureModal onClose={() => setAdding(false)} />}
    </div>
  )
}

/** One button, then a choice — most of the time it's a class, so that's the default. */
function AddStructureModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const db = useDb()
  const [kind, setKind] = useState<'class' | 'grade'>('class')
  const [gradeId, setGradeId] = useState(db.grades[0]?.id ?? '')
  const [className, setClassName] = useState(() => suggestNextClassName(db, db.grades[0]?.id ?? ''))
  const [level, setLevel] = useState(() => String(suggestNextGrade(db)))
  const [gradeName, setGradeName] = useState(() => `Grade ${suggestNextGrade(db)}`)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const pickGrade = (id: string) => { setGradeId(id); setClassName(suggestNextClassName(db, id)); setErr('') }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (kind === 'class') {
        await addSection(gradeId, className)
        toast(t('classAdded'))
      } else {
        await addGrade(Number(level), gradeName)
        toast(t('gradeAdded'))
      }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('addClass')} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>{t('whatToAdd')}</label>
          <div className="seg">
            <button type="button" className={kind === 'class' ? 'on' : ''} onClick={() => { setKind('class'); setErr('') }}>{t('aClass')}</button>
            <button type="button" className={kind === 'grade' ? 'on' : ''} onClick={() => { setKind('grade'); setErr('') }}>{t('aGrade')}</button>
          </div>
          <p className="hint">{kind === 'class' ? t('aClassSub') : t('aGradeSub')}</p>
        </div>

        {kind === 'class' ? (
          <>
            <div className="field">
              <label htmlFor="ac-grade">{t('inGrade')}</label>
              <select id="ac-grade" value={gradeId} onChange={(e) => pickGrade(e.target.value)}>
                {db.grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ac-name">{t('className')}</label>
              <input id="ac-name" value={className} onChange={(e) => { setClassName(e.target.value.toUpperCase().slice(0, 3)); setErr('') }} />
              <p className="hint">{t('classNameHint')}</p>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
            <div className="field">
              <label htmlFor="ag-level">{t('gradeLevel')}</label>
              <input id="ag-level" inputMode="numeric" value={level}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setLevel(v); setGradeName(`Grade ${v}`); setErr('') }} />
            </div>
            <div className="field">
              <label htmlFor="ag-name">{t('gradeName')}</label>
              <input id="ag-name" value={gradeName} onChange={(e) => setGradeName(e.target.value)} />
            </div>
          </div>
        )}

        {err && <p className="text-warn text-[12.5px] font-medium mb-3">{err}</p>}
        <p className="text-dim text-[11.5px] leading-snug mb-4">{t('structureAddOnly')}</p>

        <div className="flex gap-2.5">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn-gold flex-1" disabled={busy}>{busy ? t('saving') : t('save')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------- grading weights ---------------- */

function GradingCard() {
  const t = useT()
  const db = useDb()
  const [w, setW] = useState<GradingWeights>({ ...db.grading })
  const [busy, setBusy] = useState(false)

  const total = weightsTotal(w)
  const problem = weightsProblem(w)

  const save = async () => {
    if (problem) return
    setBusy(true)
    await saveGrading(w)
    setBusy(false)
    toast(t('gradingSaved'))
  }

  return (
    <div className="card-pad">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <h2 className="font-display font-bold text-[15px]">{t('gradingTitle')}</h2>
        <span className="pill-dim shrink-0">{t('gradingNotLive')}</span>
      </div>
      <p className="text-dim text-[12.5px] mb-2">{t('gradingLead')}</p>
      {/* Gated until assessment entry lands: configuring something with no
          visible consequence is worse than not showing it at all. Remove the
          `disabled` props and this note once teachers can enter assessments. */}
      <p className="text-[12px] leading-snug mb-3 p-2.5 rounded-xl bg-surface2 text-soft">{t('gradingPending')}</p>

      {ASSESSMENT_TYPE_IDS.map((id) => (
        <div key={id} className="flex items-center gap-3 py-2 border-b border-line-soft">
          <label htmlFor={`gw-${id}`} className="flex-1 text-[13.5px] text-soft">{t(TYPE_KEYS[id])}</label>
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              id={`gw-${id}`}
              inputMode="numeric"
              value={String(w[id])}
              onChange={(e) => setW({ ...w, [id]: Number(e.target.value.replace(/\D/g, '').slice(0, 3) || 0) })}
              disabled
              className="w-[68px] min-h-[44px] text-center font-display font-bold text-[15px] bg-surface2 border border-line rounded-xl text-dim cursor-not-allowed"
            />
            <span className="text-dim text-[13px] w-3">%</span>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-3">
        <b className="flex-1 font-display text-[13.5px]">{t('weightTotal')}</b>
        <span className={`font-display font-bold text-[16px] ${problem ? 'text-warn' : 'text-good'}`}>{total}%</span>
      </div>

      {problem && (
        <p className="text-warn text-[12.5px] font-medium mt-2">
          {t('weightsMustBe100')}{' '}
          {problem.diff < 0
            ? t('weightsShortBy').replace('{n}', String(-problem.diff))
            : t('weightsOverBy').replace('{n}', String(problem.diff))}
        </p>
      )}

      <button className="btn-gold w-full mt-4" onClick={save} disabled>
        {busy ? t('saving') : t('save')}
      </button>
    </div>
  )
}
