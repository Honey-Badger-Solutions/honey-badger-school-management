import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Avatar, EmptyState, PageTitle, personName } from '../../components/bits'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { useDb } from '../../services/db'
import { addTeacher, assignableTeachers, homeroomOf, teachersWithWorkload, transferWorkload, workloadOf } from '../../services/staff'
import { sectionLabel } from '../../lib/derive'
import { useT } from '../../store/session'
import { EMPLOYMENT_KEYS, POSITION_KEYS, STATUS_KEYS } from './StaffProfile'
import { todayISO } from '../../lib/dates'
import type { Teacher } from '../../types'

const FILTERS = [
  { id: 'active', key: 'statusActive' },
  { id: 'on_leave', key: 'statusOnLeave' },
  { id: 'departed', key: 'statusDeparted' },
] as const

export default function Staff() {
  const t = useT()
  const db = useDb()
  const [adding, setAdding] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [params, setParams] = useSearchParams()
  const filter = (params.get('f') ?? 'active') as Teacher['status']

  const list = db.teachers.filter((x) => x.status === filter)

  return (
    <>
      <PageTitle title={t('staffTitle')}>
        <button className="btn-ghost btn-sm" onClick={() => setReplacing(true)}>
          <Icon name="swap" size={16} />{t('replaceTeacher')}
        </button>
        <button className="btn-gold btn-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />{t('addTeacher')}
        </button>
      </PageTitle>

      <div className="seg mb-4 max-w-full overflow-x-auto" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? 'on' : ''}
            onClick={() => setParams(f.id === 'active' ? {} : { f: f.id }, { replace: true })}
          >
            {t(f.key)} · {db.teachers.filter((x) => x.status === f.id).length}
          </button>
        ))}
      </div>

      {list.length === 0 && <EmptyState icon="staff" title={t('noStaffHere')} />}

      <div className="card">
        {list.map((x) => {
          const subjects = [...new Set(x.assignments.map((a) => a.subjectId))]
            .map((sid) => db.subjects.find((s) => s.id === sid)?.name)
            .filter(Boolean)
          const homeroom = db.sections.find((s) => s.homeroomTeacherId === x.id)
          return (
            <Link key={x.id} to={`/admin/staff/${x.id}`} className="lrow">
              <Avatar name={x.firstName} />
              <span className="flex-1 min-w-0 text-left">
                <b className="text-[14px] block truncate">{personName(x)}</b>
                <small className="text-dim text-[12px] truncate block">
                  {t(POSITION_KEYS[x.position])} · {subjects.join(', ') || '—'}
                  {homeroom && ` · ${t('homeroomOf')} ${sectionLabel(db, homeroom.id)}`}
                </small>
              </span>
              <Icon name="chevR" size={17} className="text-dim shrink-0" />
            </Link>
          )
        })}
      </div>

      {adding && <AddTeacherModal onClose={() => setAdding(false)} />}
      {replacing && <ReplaceTeacherModal onClose={() => setReplacing(false)} />}
    </>
  )
}

/** Hand a whole workload from one teacher to another, item by item. */
function ReplaceTeacherModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const db = useDb()
  const outgoingOptions = teachersWithWorkload(db)
  const [fromId, setFromId] = useState(outgoingOptions[0]?.id ?? '')
  const incomingOptions = assignableTeachers(db).filter((x) => x.id !== fromId)
  const [toId, setToId] = useState(incomingOptions[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  const workload = workloadOf(db, fromId)
  // every item starts ticked; the admin unticks what should stay
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const keyOf = (a: { sectionId: string; subjectId: string }) => `${a.sectionId}|${a.subjectId}`
  const isOn = (k: string) => picked[k] !== false
  const toggle = (k: string) => setPicked((p) => ({ ...p, [k]: !isOn(k) }))

  const chosenAssignments = workload.assignments.filter((a) => isOn(keyOf(a)))
  const chosenHomeroom = workload.homeroomSectionId && isOn('homeroom') ? workload.homeroomSectionId : null
  const nothingPicked = chosenAssignments.length === 0 && !chosenHomeroom

  const incomingHomeroom = toId ? homeroomOf(db, toId) : null
  const to = db.teachers.find((x) => x.id === toId)

  const submit = async () => {
    if (!fromId || !toId || nothingPicked) return
    setBusy(true)
    await transferWorkload(fromId, toId, { assignments: chosenAssignments, homeroomSectionId: chosenHomeroom })
    setBusy(false)
    const bits = [
      chosenAssignments.length > 0 ? `${chosenAssignments.length} ${t('classesMoved')}` : null,
      chosenHomeroom ? `${t('homeroomRow').toLowerCase()} ${sectionLabel(db, chosenHomeroom)}` : null,
    ].filter(Boolean).join(' + ')
    toast(`${bits} → ${personName(to!)}`)
    onClose()
  }

  return (
    <Modal title={t('replaceTeacher')} lead={t('replaceLead')} onClose={onClose}>
      <div className="field">
        <label htmlFor="rt-from">{t('outgoing')}</label>
        <select id="rt-from" value={fromId} onChange={(e) => { setFromId(e.target.value); setPicked({}) }}>
          {outgoingOptions.map((x) => (
            <option key={x.id} value={x.id}>{personName(x)}{x.status !== 'active' ? ` (${t(STATUS_KEYS[x.status])})` : ''}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rt-to">{t('incoming')}</label>
        <select id="rt-to" value={toId} onChange={(e) => setToId(e.target.value)}>
          {incomingOptions.map((x) => (
            <option key={x.id} value={x.id}>{personName(x)}{x.status !== 'active' ? ` (${t(STATUS_KEYS[x.status])})` : ''}</option>
          ))}
        </select>
      </div>

      <p className="sec-h">{t('whatMoves')}</p>
      {workload.assignments.length === 0 && !workload.homeroomSectionId && (
        <p className="text-dim text-[13px] mb-3">{t('nothingToMove')}</p>
      )}

      {workload.homeroomSectionId && (
        <label className="flex items-center gap-3 py-2.5 border-b border-line-soft cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-[#F0B400]" checked={isOn('homeroom')} onChange={() => toggle('homeroom')} />
          <span className="flex-1 text-[13.5px]">
            <b>{t('homeroomRow')}</b> — {sectionLabel(db, workload.homeroomSectionId)}
          </span>
        </label>
      )}
      {workload.assignments.map((a) => {
        const k = keyOf(a)
        return (
          <label key={k} className="flex items-center gap-3 py-2.5 border-b border-line-soft cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-[#F0B400]" checked={isOn(k)} onChange={() => toggle(k)} />
            <span className="flex-1 text-[13.5px]">
              {sectionLabel(db, a.sectionId)} — {db.subjects.find((s) => s.id === a.subjectId)?.name}
            </span>
          </label>
        )
      })}

      {incomingHomeroom && chosenHomeroom && incomingHomeroom !== chosenHomeroom && (
        <div className="flex gap-2.5 mt-3 p-3 rounded-xl bg-honey/10 border border-honey/30">
          <Icon name="alert" size={17} className="text-gold shrink-0 mt-px" />
          <p className="text-[12.5px] leading-relaxed">
            {personName(to!)} {t('incomingHasHomeroom')} <b>{sectionLabel(db, incomingHomeroom)}</b>. {t('incomingHomeroomReleased')}
          </p>
        </div>
      )}

      <div className="flex gap-2.5 mt-4">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-gold flex-1" onClick={submit} disabled={busy || nothingPicked || !toId}>
          {busy ? t('saving') : t('transferNow')}
        </button>
      </div>
    </Modal>
  )
}

function AddTeacherModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [form, setForm] = useState({
    firstName: '',
    fatherName: '',
    sex: 'F' as 'M' | 'F',
    position: 'teacher' as Teacher['position'],
    employmentType: 'full_time' as Teacher['employmentType'],
    hireDate: todayISO(),
    phone: '',
    email: '',
    status: 'active' as Teacher['status'],
    departedOn: null,
  })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!form.firstName.trim() || !form.fatherName.trim()) return
    setBusy(true)
    await addTeacher(form)
    toast(t('teacherSaved'))
    onClose()
  }

  return (
    <Modal title={t('addTeacher')} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
        <div className="field">
          <label htmlFor="at-first">{t('firstName')}</label>
          <input id="at-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="at-father">{t('fatherName')}</label>
          <input id="at-father" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="at-pos">{t('position')}</label>
        <select id="at-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as Teacher['position'] })}>
          {(Object.keys(POSITION_KEYS) as (keyof typeof POSITION_KEYS)[]).map((p) => (
            <option key={p} value={p}>{t(POSITION_KEYS[p])}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
        <div className="field">
          <label htmlFor="at-emp">{t('employmentType')}</label>
          <select id="at-emp" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as Teacher['employmentType'] })}>
            {(Object.keys(EMPLOYMENT_KEYS) as (keyof typeof EMPLOYMENT_KEYS)[]).map((p) => (
              <option key={p} value={p}>{t(EMPLOYMENT_KEYS[p])}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="at-hire">{t('hireDate')}</label>
          <input id="at-hire" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="at-phone">{t('phone')}</label>
        <input id="at-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="at-email">{t('email')}</label>
        <input id="at-email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>

      <div className="flex gap-2.5">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-gold flex-1" onClick={submit} disabled={busy}>{busy ? t('saving') : t('save')}</button>
      </div>
    </Modal>
  )
}
