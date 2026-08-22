import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Avatar, personName } from '../../components/bits'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { useDb } from '../../services/db'
import { auditFor, departureImpact, homeroomHolder, homeroomOf, setAssignments, setHomeroom, setTeacherStatus, updateTeacher, visibleTeacher } from '../../services/staff'
import { sectionLabel } from '../../lib/derive'
import { fmtDate, fmtDateTime, todayISO } from '../../lib/dates'
import { useT } from '../../store/session'
import type { AuditEntry, Teacher } from '../../types'

export const POSITION_KEYS = {
  teacher: 'posTeacher',
  senior_teacher: 'posSenior',
  head_of_department: 'posHead',
  vice_principal: 'posVice',
} as const

export const EMPLOYMENT_KEYS = {
  full_time: 'empFull',
  part_time: 'empPart',
  contract: 'empContract',
} as const

export const STATUS_KEYS = {
  active: 'statusActive',
  on_leave: 'statusOnLeave',
  departed: 'statusDeparted',
} as const

export default function StaffProfile() {
  const t = useT()
  const db = useDb()
  const { id } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const raw = db.teachers.find((x) => x.id === id)
  if (!raw) return <p className="text-dim">—</p>
  // contact details come back stripped unless this user is allowed to see them
  const teacher = visibleTeacher(raw)

  return (
    <>
      <Link to="/staff-admin/staff" className="no-print inline-flex items-center gap-1.5 text-soft font-display font-medium text-[13.5px] mb-4 hover:text-gold">
        <Icon name="chevL" size={16} />{t('back')}
      </Link>

      <div className="card-pad flex items-center gap-3 sm:gap-4 mb-4">
        <Avatar name={teacher.firstName} size={52} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] sm:text-[20px] font-bold leading-tight">{personName(teacher)}</h1>
          <p className="text-soft text-[12.5px] mt-1 flex flex-wrap gap-1.5">
            <span className="pill-gold">{t(POSITION_KEYS[teacher.position])}</span>
            <span className="pill-neutral">{t(EMPLOYMENT_KEYS[teacher.employmentType])}</span>
            {teacher.status !== 'active' && (
              <span className={teacher.status === 'departed' ? 'pill-warn' : 'pill-neutral'}>
                {t(STATUS_KEYS[teacher.status])}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="sec-h !mt-0 !mb-0">{t('employment')}</p>
        <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
          <Icon name="edit" size={15} />{t('edit')}
        </button>
      </div>
      <div className="card mb-4">
        <Row k={t('position')} v={t(POSITION_KEYS[teacher.position])} />
        <Row k={t('employmentType')} v={t(EMPLOYMENT_KEYS[teacher.employmentType])} />
        <Row k={t('hireDate')} v={fmtDate(teacher.hireDate)} />
        <Row k={t('sex')} v={teacher.sex === 'M' ? t('male') : t('female')} />
      </div>

      <p className="sec-h">{t('contactDetails')}</p>
      <div className="card mb-1">
        <Row k={t('phone')} v={teacher.phone || t('contactHidden')} />
        <Row k={t('email')} v={teacher.email || t('contactHidden')} />
      </div>
      <p className="text-dim text-[11.5px] mb-4">{t('contactAdminOnly')}</p>

      <HomeroomCard teacher={raw} />
      <AssignmentsCard teacher={raw} />
      <StatusCard teacher={raw} />
      <AuditCard teacherId={raw.id} />

      {editing && <EditDetailsModal teacher={raw} onClose={() => setEditing(false)} onDeleted={() => navigate('/staff-admin/staff')} />}
    </>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-line-soft last:border-b-0">
      <span className="text-soft text-[13px]">{k}</span>
      <b className="text-[13.5px] text-right">{v}</b>
    </div>
  )
}

/** Homeroom lives on the section; a teacher holds at most one. */
function HomeroomCard({ teacher }: { teacher: Teacher }) {
  const t = useT()
  const db = useDb()
  const [pending, setPending] = useState<string | null>(null) // section awaiting confirmation
  const [busy, setBusy] = useState(false)

  const current = homeroomOf(db, teacher.id)
  const departed = teacher.status === 'departed'

  const apply = async (sectionId: string | null) => {
    setBusy(true)
    await setHomeroom(teacher.id, sectionId)
    setBusy(false)
    setPending(null)
    toast(t('homeroomSaved'))
  }

  const choose = (value: string) => {
    const sectionId = value || null
    // reassigning a section that someone else already holds needs a warning
    const holder = sectionId ? homeroomHolder(db, sectionId) : undefined
    if (holder && holder.id !== teacher.id) setPending(sectionId)
    else apply(sectionId)
  }

  const holder = pending ? homeroomHolder(db, pending) : undefined

  return (
    <>
      <p className="sec-h">{t('homeroom')}</p>
      <div className="card-pad">
        <select
          className="w-full bg-white border border-line rounded-xl px-3 min-h-[46px] text-[14px] disabled:opacity-60"
          value={current ?? ''}
          disabled={busy || departed}
          onChange={(e) => choose(e.target.value)}
          aria-label={t('homeroomSection')}
        >
          <option value="">{t('homeroomNone')}</option>
          {db.sections.map((s) => (
            <option key={s.id} value={s.id}>{sectionLabel(db, s.id)}</option>
          ))}
        </select>

        <DriftWarning teacher={teacher} />
      </div>

      {pending && holder && (
        <Modal title={t('reassignHomeroom')} onClose={() => setPending(null)}>
          <p className="text-[13.5px] leading-relaxed mb-4">
            <b>{personName(holder)}</b> {t('alreadyHomeroom')} <b>{sectionLabel(db, pending)}</b>. {t('reassignEffect')}
          </p>
          <div className="flex gap-2.5">
            <button className="btn-ghost flex-1" onClick={() => setPending(null)}>{t('cancel')}</button>
            <button className="btn-gold flex-1" disabled={busy} onClick={() => apply(pending)}>
              {busy ? t('saving') : t('confirmReassign')}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

/** Non-blocking: homeroom of a section they teach nothing in. */
function DriftWarning({ teacher }: { teacher: Teacher }) {
  const t = useT()
  const db = useDb()
  const section = homeroomOf(db, teacher.id)
  if (!section) return null
  const teachesHere = teacher.assignments.some((a) => a.sectionId === section)
  if (teachesHere) return null
  return (
    <div className="flex gap-2.5 mt-3 p-3 rounded-xl bg-honey/10 border border-honey/30">
      <Icon name="alert" size={17} className="text-gold shrink-0 mt-px" />
      <div>
        <b className="text-[13px] block">{t('driftWarning')}</b>
        <p className="text-soft text-[12.5px] leading-relaxed mt-0.5">{t('driftExplain')}</p>
      </div>
    </div>
  )
}

/** Section+subject assignments. */
function AssignmentsCard({ teacher }: { teacher: Teacher }) {
  const t = useT()
  const db = useDb()
  const [assigns, setAssigns] = useState(teacher.assignments)
  const [removed, setRemoved] = useState<Record<string, boolean>>({})
  const [newSec, setNewSec] = useState(db.sections[0].id)
  const [newSub, setNewSub] = useState(db.subjects[0].id)
  const [busy, setBusy] = useState(false)

  const kept = assigns.filter((a) => !removed[`${a.sectionId}|${a.subjectId}`])
  const dirty = JSON.stringify(kept) !== JSON.stringify(teacher.assignments)

  const addAssign = () => {
    if (assigns.some((a) => a.sectionId === newSec && a.subjectId === newSub)) return
    setAssigns([...assigns, { sectionId: newSec, subjectId: newSub }])
  }

  const save = async () => {
    setBusy(true)
    await setAssignments(teacher.id, kept)
    setAssigns(kept)
    setRemoved({})
    setBusy(false)
    toast(t('teacherSaved'))
  }

  return (
    <>
      <p className="sec-h">{t('assignments')}</p>
      <div className="card-pad">
        {assigns.length === 0 && <p className="text-dim text-[12.5px]">—</p>}
        {assigns.map((a) => {
          const k = `${a.sectionId}|${a.subjectId}`
          const gone = removed[k]
          return (
            <div key={k} className="flex items-center gap-2 py-2 border-b border-line-soft last:border-b-0 text-[13.5px]">
              <span className={`flex-1 ${gone ? 'line-through text-dim' : ''}`}>
                {sectionLabel(db, a.sectionId)} — {db.subjects.find((s) => s.id === a.subjectId)?.name}
              </span>
              {/* removal is staged, not silent: it can be undone until saved */}
              {gone ? (
                <button className="btn-ghost btn-sm" onClick={() => setRemoved((r) => ({ ...r, [k]: false }))}>
                  {t('undo')}
                </button>
              ) : (
                <button
                  className="w-9 h-9 grid place-items-center rounded-lg text-warn hover:bg-warn/10"
                  onClick={() => setRemoved((r) => ({ ...r, [k]: true }))}
                  aria-label={`${t('remove')} ${sectionLabel(db, a.sectionId)}`}
                >
                  <Icon name="x" size={15} />
                </button>
              )}
            </div>
          )
        })}

        <div className="flex gap-2 mt-3">
          <select className="flex-1 min-w-0 bg-white border border-line rounded-xl px-2 min-h-[44px] text-[13px]" value={newSec} onChange={(e) => setNewSec(e.target.value)} aria-label={t('section')}>
            {db.sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(db, s.id)}</option>)}
          </select>
          <select className="flex-1 min-w-0 bg-white border border-line rounded-xl px-2 min-h-[44px] text-[13px]" value={newSub} onChange={(e) => setNewSub(e.target.value)} aria-label={t('subject')}>
            {db.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn-ghost btn-sm shrink-0" onClick={addAssign} aria-label={t('add')}><Icon name="plus" size={16} /></button>
        </div>

        {dirty && (
          <button className="btn-gold w-full mt-3" onClick={save} disabled={busy}>
            {busy ? t('saving') : t('save')}
          </button>
        )}
      </div>
    </>
  )
}

/** Status changes. There is no delete — departure is the terminal state. */
function StatusCard({ teacher }: { teacher: Teacher }) {
  const t = useT()
  const db = useDb()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const change = async (status: Teacher['status']) => {
    setBusy(true)
    await setTeacherStatus(teacher.id, status, todayISO())
    setBusy(false)
    toast(t('statusChanged'))
  }

  const impact = departureImpact(db, teacher.id)

  return (
    <>
      <p className="sec-h">{t('status')}</p>
      <div className="card-pad">
        <div className="flex items-center justify-between gap-3 mb-3">
          <b className="text-[14px]">{t(STATUS_KEYS[teacher.status])}</b>
          {teacher.departedOn && <span className="text-dim text-[12px]">{t('departedOn')}: {fmtDate(teacher.departedOn)}</span>}
        </div>
        {teacher.status === 'on_leave' && <p className="text-soft text-[12.5px] mb-3">{t('onLeaveNote')}</p>}
        {teacher.status === 'departed' && <p className="text-soft text-[12.5px] mb-3">{t('formerStaffNote')}</p>}

        <div className="flex flex-wrap gap-2">
          {teacher.status !== 'active' && (
            <button className="btn-ghost btn-sm" onClick={() => change('active')} disabled={busy}>{t('markActive')}</button>
          )}
          {teacher.status === 'active' && (
            <button className="btn-ghost btn-sm" onClick={() => change('on_leave')} disabled={busy}>{t('markOnLeave')}</button>
          )}
          {teacher.status !== 'departed' && (
            <button className="btn-ghost btn-sm !text-warn !border-warn/30" onClick={() => setConfirming(true)} disabled={busy}>
              {t('markDeparted')}
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <Modal title={t('confirmDeparture')} onClose={() => setConfirming(false)}>
          <p className="text-[14px] font-semibold mb-3">{personName(teacher)}</p>
          <ul className="text-[13px] text-soft leading-relaxed list-disc pl-5 space-y-1.5 mb-4">
            {impact.assignments > 0 && <li>{impact.assignments} {t('departureReleases')}</li>}
            {impact.homeroomSectionId && (
              <li><b>{sectionLabel(db, impact.homeroomSectionId)}</b> {t('departureClearsHomeroom')}</li>
            )}
            <li>{t('departureHidesThem')}</li>
            <li>{t('departureKeepsHistory')}</li>
          </ul>
          {impact.assignments > 0 && (
            <p className="text-[12.5px] text-gold bg-honey/10 border border-honey/30 rounded-xl p-3 mb-3">
              {t('replaceBeforeDeparting')}
            </p>
          )}
          <p className="text-dim text-[12.5px] mb-4">{t('departureDateIs')}: {fmtDate(todayISO())}</p>
          <div className="flex gap-2.5">
            <button className="btn-ghost flex-1" onClick={() => setConfirming(false)}>{t('cancel')}</button>
            <button
              className="btn-gold flex-1 !bg-warn !text-white"
              disabled={busy}
              onClick={async () => { await change('departed'); setConfirming(false) }}
            >
              {busy ? t('saving') : t('confirmDepart')}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

const AUDIT_KEYS = {
  created: 'auCreated',
  assignment_added: 'auAssignmentAdded',
  assignment_removed: 'auAssignmentRemoved',
  homeroom_set: 'auHomeroomSet',
  homeroom_cleared: 'auHomeroomCleared',
  status_changed: 'auStatusChanged',
  position_changed: 'auPositionChanged',
  employment_changed: 'auEmploymentChanged',
  contact_changed: 'auContactChanged',
  workload_transferred: 'auWorkloadTransferred',
  workload_received: 'auWorkloadReceived',
} as const

/** Reverse-chronological record of every change to this teacher. */
function AuditCard({ teacherId }: { teacherId: string }) {
  const t = useT()
  const db = useDb()
  const entries = auditFor(db, teacherId)

  /** Stored values are enum keys/ISO dates so they stay language-neutral. */
  const readable = (action: AuditEntry['action'], value: string | null): string | null => {
    if (!value) return null
    if (action === 'position_changed') return t(POSITION_KEYS[value as Teacher['position']])
    if (action === 'status_changed') return t(STATUS_KEYS[value as Teacher['status']])
    if (action === 'employment_changed') {
      const [type, date] = value.split('|')
      return `${t(EMPLOYMENT_KEYS[type as Teacher['employmentType']])} · ${fmtDate(date)}`
    }
    return value
  }

  return (
    <>
      <p className="sec-h">{t('changeHistory')}</p>
      <div className="card-pad">
        {entries.length === 0 && <p className="text-dim text-[12.5px]">{t('noChangesYet')}</p>}
        {entries.map((e) => (
          <div key={e.id} className="py-2.5 border-b border-line-soft last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <b className="text-[13px]">{t(AUDIT_KEYS[e.action])}</b>
              <span className="text-dim text-[11px] shrink-0">{fmtDateTime(e.at)}</span>
            </div>
            <p className="text-soft text-[12.5px] mt-0.5 break-words">
              {e.before && e.after && <>{readable(e.action, e.before)} → {readable(e.action, e.after)}</>}
              {e.before && !e.after && readable(e.action, e.before)}
              {!e.before && e.after && readable(e.action, e.after)}
            </p>
            <p className="text-dim text-[11.5px]">{t('auBy')} {e.actor}</p>
          </div>
        ))}
      </div>
    </>
  )
}

function EditDetailsModal({ teacher, onClose }: { teacher: Teacher; onClose: () => void; onDeleted: () => void }) {
  const t = useT()
  const [form, setForm] = useState({
    firstName: teacher.firstName,
    fatherName: teacher.fatherName,
    sex: teacher.sex,
    position: teacher.position,
    employmentType: teacher.employmentType,
    hireDate: teacher.hireDate,
    phone: teacher.phone,
    email: teacher.email,
  })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!form.firstName.trim() || !form.fatherName.trim()) return
    setBusy(true)
    await updateTeacher(teacher.id, form)
    toast(t('teacherSaved'))
    onClose()
  }

  return (
    <Modal title={t('staffProfile')} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
        <div className="field">
          <label htmlFor="sp-first">{t('firstName')}</label>
          <input id="sp-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sp-father">{t('fatherName')}</label>
          <input id="sp-father" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="sp-pos">{t('position')}</label>
        <select id="sp-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as Teacher['position'] })}>
          {(Object.keys(POSITION_KEYS) as (keyof typeof POSITION_KEYS)[]).map((p) => (
            <option key={p} value={p}>{t(POSITION_KEYS[p])}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
        <div className="field">
          <label htmlFor="sp-emp">{t('employmentType')}</label>
          <select id="sp-emp" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as Teacher['employmentType'] })}>
            {(Object.keys(EMPLOYMENT_KEYS) as (keyof typeof EMPLOYMENT_KEYS)[]).map((p) => (
              <option key={p} value={p}>{t(EMPLOYMENT_KEYS[p])}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sp-hire">{t('hireDate')}</label>
          <input id="sp-hire" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
        </div>
      </div>

      <p className="sec-h">{t('contactDetails')}</p>
      <div className="field">
        <label htmlFor="sp-phone">{t('phone')}</label>
        <input id="sp-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="sp-email">{t('email')}</label>
        <input id="sp-email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>

      <div className="flex gap-2.5">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-gold flex-1" onClick={submit} disabled={busy}>{busy ? t('saving') : t('save')}</button>
      </div>
    </Modal>
  )
}
