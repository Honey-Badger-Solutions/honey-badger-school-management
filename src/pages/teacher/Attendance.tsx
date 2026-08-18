import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { toast } from '../../components/Toast'
import { Avatar, PageTitle, personName, SaveChip, type SaveState } from '../../components/bits'
import { isEditable, registerState, saveMarks, submitRegister } from '../../services/attendance'
import { countMarks, recordsForDay, rosterOf, sectionLabel } from '../../lib/derive'
import { fmtDateShort, schoolDays, todayISO } from '../../lib/dates'
import { useT } from '../../store/session'
import type { AttendanceMark } from '../../types'
import { useTeacher } from './useTeacher'
import { NoClasses } from './NoClasses'

export default function Attendance() {
  const t = useT()
  const { db, teacher, sectionIds } = useTeacher()
  const [params, setParams] = useSearchParams()
  const sectionId = params.get('section') && sectionIds.includes(params.get('section')!)
    ? params.get('section')!
    : sectionIds[0]
  const [date, setDate] = useState(todayISO())
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>({})
  const [save, setSave] = useState<SaveState>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  /** changes tapped but not yet sent — the delta this device is claiming */
  const pending = useRef<Record<string, AttendanceMark>>({})

  const [submitting, setSubmitting] = useState(false)
  const roster = useMemo(() => rosterOf(db, sectionId), [db, sectionId])
  // Only today is editable here. Correcting a past day is an admin action —
  // see TODO(admin correction) in services/attendance.ts.
  const editable = isEditable(date)
  const state = registerState(db, sectionId, date)
  // A past day with no record must not borrow the all-present default — that
  // would show a full register for a day nobody took one.
  const missingPastRegister = !editable && state === 'not_started'
  const recentDays = useMemo(() => schoolDays(6, todayISO()).reverse(), [])

  // load existing record — or start everyone Present so only exceptions need taps
  useEffect(() => {
    const recs = recordsForDay(db, sectionId, date)
    if (recs.length > 0) {
      const loaded: Record<string, AttendanceMark> = {}
      for (const r of recs) loaded[r.studentId] = r.mark
      setMarks(loaded)
      // the chip reflects the whole register: one unsettled record is enough
      setSave(recs.some((r) => r.sync === 'local') ? 'local' : 'synced')
    } else {
      const all: Record<string, AttendanceMark> = {}
      for (const s of roster) all[s.id] = 'P'
      setMarks(all)
      setSave('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, date])

  /**
   * Queue a change for the debounced save. Only what the teacher touched goes
   * to the service — never the whole register — so a save from this device can
   * never express an opinion about a student it did not mark.
   */
  const queue = (changes: Record<string, AttendanceMark>) => {
    if (!editable) return
    const next = { ...marks, ...changes }
    setMarks(next)

    // An untouched register has nothing stored: the screen is showing the
    // all-present default. Persist that whole default on the FIRST write, so a
    // teacher who taps only the three absentees still records the other 47 as
    // present. Every write after that carries the delta alone.
    const firstWrite = registerState(db, sectionId, date) === 'not_started'
    pending.current = firstWrite ? next : { ...pending.current, ...changes }

    setSave('saving')
    clearTimeout(saveTimer.current)
    // optimistic: recorded locally at once, then "synced" when the mock network returns
    saveTimer.current = setTimeout(() => { void flush() }, 250)
  }

  /** Send the queued changes and clear the queue. */
  const flush = async () => {
    const batch = pending.current
    pending.current = {}
    if (Object.keys(batch).length === 0) return
    setSave('local')
    await saveMarks(sectionId, date, batch)
    setSave('synced')
  }

  const setMark = (studentId: string, m: AttendanceMark) => queue({ [studentId]: m })

  /** A deliberate bulk assertion — "everyone here is present" — so this one
   *  legitimately does name every student. */
  const markAll = () => {
    const all: Record<string, AttendanceMark> = {}
    for (const s of roster) all[s.id] = 'P'
    queue(all)
  }

  const c = countMarks(marks)

  const pickSection = (id: string) => { params.set('section', id); setParams(params, { replace: true }) }

  const submit = async () => {
    setSubmitting(true)
    // per-tap autosave has already stored the marks; flush anything still in
    // the debounce window, then only declare the day complete. A dropped
    // connection here loses nothing.
    clearTimeout(saveTimer.current)
    await flush()
    await submitRegister(sectionId, date)
    setSubmitting(false)
    setSave('synced')
    toast(t('registerSubmitted'))
  }

  const btnCls = (on: boolean, kind: AttendanceMark) => {
    if (!on) return 'att-btn bg-surface2 border-line text-dim'
    if (kind === 'P') return 'att-btn bg-good text-white border-good'
    if (kind === 'A') return 'att-btn bg-warn text-white border-warn'
    return 'att-btn bg-honey text-[#221900] border-honey'
  }

  if (!teacher) return null // Guard is ending this session
  if (sectionIds.length === 0) {
    return (
      <>
        <PageTitle title={t('attendanceTitle')} />
        <NoClasses />
      </>
    )
  }

  return (
    <>
      <PageTitle title={t('attendanceTitle')}>
        <SaveChip state={save} />
      </PageTitle>

      {/* section chips + date */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-2 overflow-x-auto py-0.5" role="group" aria-label={t('chooseClass')}>
          {sectionIds.map((id) => (
            <button
              key={id}
              onClick={() => pickSection(id)}
              className={`shrink-0 px-4 min-h-[42px] rounded-full border text-[13px] font-display font-semibold transition-colors ${
                id === sectionId ? 'bg-honey text-[#221900] border-honey' : 'bg-surface text-soft border-line'
              }`}
            >
              {sectionLabel(db, id)}
            </button>
          ))}
        </div>
        <label className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 text-[12.5px] text-soft">
          <span className="hidden sm:inline">{fmtDateShort(date)}</span>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-auto bg-surface border border-line rounded-xl px-3 min-h-[44px] text-[13px]"
            aria-label={t('today')}
          />
        </label>
      </div>

      {/* recent days — tap to review a past register (read-only) */}
      <div className="flex gap-2 overflow-x-auto py-0.5 mb-3" role="group" aria-label={t('recentDays')}>
        {recentDays.map((d) => {
          const st = registerState(db, sectionId, d)
          const on = d === date
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`shrink-0 px-3 min-h-[38px] rounded-full border text-[12px] font-display font-semibold transition-colors flex items-center gap-1.5 ${
                on ? 'bg-ink text-white border-ink' : 'bg-surface text-soft border-line'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${st === 'submitted' ? 'bg-good' : st === 'in_progress' ? 'bg-honey' : 'bg-line'}`} />
              {d === todayISO() ? t('today') : fmtDateShort(d)}
            </button>
          )
        })}
      </div>

      {!editable && !missingPastRegister && (
        <div className="card-pad !py-2.5 mb-3 flex items-center gap-2.5 text-[12.5px] text-soft">
          <Icon name="alert" size={16} className="text-dim shrink-0" />
          <span>{t('pastDayReadOnly')}</span>
        </div>
      )}

      {missingPastRegister ? (
        <div className="card-pad text-center py-8">
          <Icon name="clipboard" size={26} className="text-dim mx-auto mb-2" />
          <b className="text-[14px] block">{t('noRegisterTaken')}</b>
          <small className="text-dim text-[12.5px] block mt-1">{t('noRegisterTakenSub')}</small>
        </div>
      ) : (
      <>

      {/* summary + mark-all */}
      <div className="card-pad flex flex-wrap items-center gap-2.5 mb-4">
        <span className="pill-good">{c.present} {t('present')}</span>
        <span className="pill-warn">{c.absent} {t('absent')}</span>
        <span className="pill-gold">{c.late} {t('late')}</span>
        {/* primary bulk action — full width on a phone, not a floated chip */}
        {editable && (
          <button className="btn-ghost btn-sm w-full sm:w-auto sm:ml-auto" onClick={markAll}>
            <Icon name="check" size={16} className="text-good" />{t('markAllPresent')}
          </button>
        )}
      </div>
      {editable && <p className="text-dim text-[12px] mb-2">{t('allPresentDone')}</p>}

      <div className="card">
        {roster.map((s, i) => {
          const m = marks[s.id]
          return (
            <div key={s.id} className="lrow !py-2">
              <span className="w-6 text-center text-dim text-[12px] font-display shrink-0 hidden sm:block">{i + 1}</span>
              <Avatar name={s.firstName} size={34} />
              <span className="flex-1 min-w-0 text-[13.5px] font-medium truncate">{personName(s)}</span>
              <div className="flex gap-1.5 shrink-0" role="group" aria-label={personName(s)}>
                <button className={btnCls(m === 'P', 'P')} onClick={() => setMark(s.id, 'P')} aria-pressed={m === 'P'} title={t('present')} disabled={!editable}>P</button>
                <button className={btnCls(m === 'A', 'A')} onClick={() => setMark(s.id, 'A')} aria-pressed={m === 'A'} title={t('absent')} disabled={!editable}>A</button>
                <button className={btnCls(m === 'L', 'L')} onClick={() => setMark(s.id, 'L')} aria-pressed={m === 'L'} title={t('late')} disabled={!editable}>L</button>
              </div>
            </div>
          )
        })}
      </div>

      </>
      )}

      {/* declaring the day done — separate from saving, which already happened */}
      {editable && (
        <div className="mt-4 mb-2">
          {state === 'submitted' ? (
            <div className="card-pad !py-3 flex items-center gap-2.5 text-[13px] text-good">
              <Icon name="check" size={17} className="shrink-0" />
              <span>{t('registerSubmittedNote')}</span>
            </div>
          ) : (
            <>
              <button className="btn-gold w-full" onClick={submit} disabled={submitting}>
                {submitting ? t('saving') : t('submitRegister')}
              </button>
              <p className="text-dim text-[11.5px] mt-2 text-center">{t('submitRegisterHint')}</p>
            </>
          )}
        </div>
      )}
    </>
  )
}
