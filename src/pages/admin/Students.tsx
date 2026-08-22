import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Avatar, EmptyState, PageTitle, personName } from '../../components/bits'
import { Modal } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { PaginatedReport, PrintArea, printNow } from '../../components/Print'
import { useDb } from '../../services/db'
import { registerStudent, promoteSection, suggestStudentNo, studentNoHolder } from '../../services/students'
import { rosterOf, sectionLabel } from '../../lib/derive'
import { useT } from '../../store/session'

export default function Students() {
  const t = useT()
  const db = useDb()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [printSec, setPrintSec] = useState<string | null>(null)

  const registering = params.get('register') === '1'
  const openRegister = (open: boolean) => {
    if (open) params.set('register', '1')
    else params.delete('register')
    setParams(params, { replace: true })
  }

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return db.students
      .filter((s) => s.status === 'active')
      .filter((s) => !gradeId || s.gradeId === gradeId)
      .filter((s) => !sectionId || s.sectionId === sectionId)
      // matches name, guardian, the issued ID and the school's own reference —
      // a secretary given only a number off a receipt should find the student
      .filter((s) => !needle
        || personName(s).toLowerCase().includes(needle)
        || s.guardianName.toLowerCase().includes(needle)
        || s.studentNo.toLowerCase().includes(needle)
        || s.schoolRefNo.toLowerCase().includes(needle))
      .sort((a, b) => personName(a).localeCompare(personName(b)))
  }, [db, q, gradeId, sectionId])

  const sections = db.sections.filter((s) => !gradeId || s.gradeId === gradeId)

  return (
    <>
      <PageTitle title={t('studentsTitle')}>
        {sectionId && (
          <button className="btn-ghost btn-sm" onClick={() => { setPrintSec(sectionId); printNow(() => setPrintSec(null)) }}>
            <Icon name="printer" size={16} />{t('printRoster')}
          </button>
        )}
        <button className="btn-ghost btn-sm" onClick={() => setPromoting(true)}>
          <Icon name="up" size={16} />{t('promoteClass')}
        </button>
        <button className="btn-gold btn-sm" onClick={() => openRegister(true)}>
          <Icon name="plus" size={16} />{t('registerStudent')}
        </button>
      </PageTitle>

      {/* filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-line rounded-full px-4 min-h-[46px] flex-1 min-w-[200px]">
          <Icon name="search" size={17} className="text-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchStudents')}
            className="flex-1 bg-transparent outline-none text-[14px] min-w-0"
            aria-label={t('search')}
          />
        </div>
        <select className="bg-surface border border-line rounded-full px-4 min-h-[46px] text-[13.5px] font-medium" value={gradeId} onChange={(e) => { setGradeId(e.target.value); setSectionId('') }} aria-label={t('grade')}>
          <option value="">{t('allGrades')}</option>
          {db.grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="bg-surface border border-line rounded-full px-4 min-h-[46px] text-[13.5px] font-medium" value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label={t('section')}>
          <option value="">{t('allSections')}</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(db, s.id)}</option>)}
        </select>
      </div>

      <p className="text-dim text-[12.5px] mb-2">{list.length} {t('students')}</p>

      {list.length === 0 ? (
        <div className="card"><EmptyState title={t('noResults')} sub={t('noResultsSub')} /></div>
      ) : (
        <div className="card">
          {/* desktop column headers */}
          <div className="hidden md:flex items-center gap-3 px-3 py-2 border-b border-line text-dim font-display font-bold text-[11px] uppercase tracking-[0.5px]">
            <span className="w-[38px]" />
            <span className="flex-1">{t('fullName')}</span>
            <span className="w-[92px]">{t('section')}</span>
            <span className="w-[170px]">{t('guardian')}</span>
            <span className="w-[120px]">{t('guardianPhone')}</span>
            <span className="w-[90px]">{t('joined')}</span>
            <span className="w-[17px]" />
          </div>
          {list.slice(0, 200).map((s) => (
            <Link key={s.id} to={`/school-admin/students/${s.id}`} className="lrow">
              <Avatar name={s.firstName} />
              <span className="flex-1 min-w-0">
                <b className="text-[14px] block truncate">{personName(s)}</b>
                <small className="text-dim text-[12px] md:hidden">{sectionLabel(db, s.sectionId)} · {s.sex === 'M' ? t('male') : t('female')}</small>
              </span>
              <span className="hidden md:block w-[92px] text-[13px]">{sectionLabel(db, s.sectionId)}</span>
              <span className="hidden md:block w-[170px] text-[13px] truncate">{s.guardianName}</span>
              <span className="hidden md:block w-[120px] text-[13px] text-soft">{s.guardianPhone}</span>
              <span className="hidden md:block w-[90px] text-[13px] text-soft">{s.joinedYear}</span>
              <Icon name="chevR" size={17} className="text-dim shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {registering && <RegisterModal onClose={() => openRegister(false)} />}
      {promoting && <PromoteModal onClose={() => setPromoting(false)} />}
      {printSec && <RosterPrint sectionId={printSec} />}
    </>
  )
}

/* ---------------- register student ---------------- */

function RegisterModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const db = useDb()
  const [busy, setBusy] = useState(false)
  // The ID starts filled with the next number in sequence. An admin who does
  // not care never makes a decision; one who needs a specific number types over
  // it and can restore the suggestion.
  const suggested = suggestStudentNo(db)
  const [form, setForm] = useState({
    firstName: '', fatherName: '', sex: 'M' as 'M' | 'F', sectionId: db.sections[0].id,
    guardianName: '', guardianPhone: '', studentNo: suggested, schoolRefNo: '',
  })
  const [errs, setErrs] = useState<Record<string, boolean>>({})

  const clash = form.studentNo.trim() ? studentNoHolder(db, form.studentNo) : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const bad: Record<string, boolean> = {}
    if (!form.firstName.trim()) bad.firstName = true
    if (!form.fatherName.trim()) bad.fatherName = true
    if (!form.guardianName.trim()) bad.guardianName = true
    if (!form.studentNo.trim()) bad.studentNo = true
    setErrs(bad)
    if (Object.keys(bad).length || clash) return
    setBusy(true)
    await registerStudent(form)
    toast(t('registered'))
    onClose()
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal title={t('registerStudent')} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3">
          <div className="field">
            <label htmlFor="rs-first">{t('firstName')}</label>
            <input id="rs-first" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus />
            {errs.firstName && <p className="err">{t('required')}</p>}
          </div>
          <div className="field">
            <label htmlFor="rs-father">{t('fatherName')}</label>
            <input id="rs-father" value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} />
            {errs.fatherName && <p className="err">{t('required')}</p>}
          </div>
        </div>
        <div className="field">
          <label>{t('sex')}</label>
          <div className="seg">
            <button type="button" className={form.sex === 'M' ? 'on' : ''} onClick={() => set('sex', 'M')}>{t('male')}</button>
            <button type="button" className={form.sex === 'F' ? 'on' : ''} onClick={() => set('sex', 'F')}>{t('female')}</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="rs-section">{t('section')}</label>
          <select id="rs-section" value={form.sectionId} onChange={(e) => set('sectionId', e.target.value)}>
            {db.sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(db, s.id)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rs-gname">{t('guardianName')}</label>
          <input id="rs-gname" value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} />
          {errs.guardianName && <p className="err">{t('required')}</p>}
        </div>
        <div className="field">
          <label htmlFor="rs-gphone">{t('guardianPhone')} <span className="text-dim font-normal">({t('optional')})</span></label>
          <input id="rs-gphone" inputMode="tel" placeholder="09.. ... ..." value={form.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} />
        </div>

        <div className="field">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="rs-idno" className="!mb-0">{t('studentNo')}</label>
            {form.studentNo !== suggested && (
              <button type="button" className="text-gold font-display font-semibold text-[12px] hover:underline" onClick={() => set('studentNo', suggested)}>
                {t('useSuggested')}
              </button>
            )}
          </div>
          <input
            id="rs-idno"
            className={`mt-1.5 ${clash ? '!border-warn' : ''}`}
            value={form.studentNo}
            onChange={(e) => set('studentNo', e.target.value)}
            aria-invalid={!!clash}
          />
          {errs.studentNo && <p className="err">{t('required')}</p>}
          {clash && <p className="err">{t('idTaken')} {personName(clash)} ({sectionLabel(db, clash.sectionId)})</p>}
          {!clash && !errs.studentNo && <p className="hint">{t('idHint')}</p>}
        </div>

        <div className="field">
          <label htmlFor="rs-refno">{t('schoolRefNo')} <span className="text-dim font-normal">({t('optional')})</span></label>
          <input id="rs-refno" value={form.schoolRefNo} onChange={(e) => set('schoolRefNo', e.target.value)} />
          <p className="hint">{t('schoolRefHint')}</p>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn-gold flex-1" disabled={busy}>{busy ? t('saving') : t('save')}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------- promote class ---------------- */

function PromoteModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const db = useDb()
  const [sectionId, setSectionId] = useState(db.sections[0].id)
  const [holdBack, setHoldBack] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const sec = db.sections.find((s) => s.id === sectionId)!
  const grade = db.grades.find((g) => g.id === sec.gradeId)!
  const nextGrade = db.grades.find((g) => g.level === grade.level + 1)
  const roster = rosterOf(db, sectionId)

  const toggle = (id: string) =>
    setHoldBack((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))

  const run = async () => {
    setBusy(true)
    const res = await promoteSection(sectionId, holdBack)
    toast(`${res.promoted} ${t('promoted')}, ${res.kept} ${t('keptBack')}`)
    onClose()
  }

  return (
    <Modal title={t('promoteTitle')} lead={t('promoteLead')} onClose={onClose}>
      <div className="field">
        <label htmlFor="pm-sec">{t('section')}</label>
        <select id="pm-sec" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setHoldBack([]) }}>
          {db.sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(db, s.id)}</option>)}
        </select>
        <p className="hint">
          {sectionLabel(db, sectionId)} {t('promoteTo')} {nextGrade ? `${nextGrade.name}${sec.name}` : '—'}
          {!nextGrade && ` · ${t('graduates')}`}
        </p>
      </div>
      <div className="border border-line rounded-xl max-h-[340px] overflow-y-auto mb-4">
        {roster.map((s) => {
          const kept = holdBack.includes(s.id)
          return (
            <label key={s.id} className="lrow cursor-pointer !py-2.5 !min-h-[48px]">
              <input type="checkbox" className="w-5 h-5 accent-[#A87800]" checked={!kept} onChange={() => toggle(s.id)} />
              <span className={`flex-1 text-[13.5px] ${kept ? 'text-dim line-through' : ''}`}>{personName(s)}</span>
              {kept && <span className="pill-warn">{t('keptBack')}</span>}
            </label>
          )
        })}
      </div>
      <div className="flex gap-2.5">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-gold flex-1" onClick={run} disabled={busy}>
          {busy ? t('saving') : `${t('promoteBtn')} ${roster.length - holdBack.length}`}
        </button>
      </div>
    </Modal>
  )
}

/* ---------------- printable roster ---------------- */

function RosterPrint({ sectionId }: { sectionId: string }) {
  const t = useT()
  const db = useDb()
  const roster = rosterOf(db, sectionId)
  return (
    <PrintArea>
      <PaginatedReport
        doc={t('classRoster')}
        summary={
          <div className="flex justify-between text-[13px] mb-3">
            <b className="font-display">{sectionLabel(db, sectionId)}</b>
            <span>{roster.length} {t('students')} · {roster.filter((s) => s.sex === 'M').length} {t('boys')} · {roster.filter((s) => s.sex === 'F').length} {t('girls')}</span>
          </div>
        }
        headRow={
          <tr><th>#</th><th>{t('studentNo')}</th><th>{t('fullName')}</th><th>{t('sex')}</th><th>{t('guardian')}</th><th>{t('guardianPhone')}</th></tr>
        }
        rows={roster.map((s, i) => (
          <tr key={s.id}>
            <td className="text-dim">{i + 1}</td>
            <td className="whitespace-nowrap">{s.studentNo}</td>
            <td>{personName(s)}</td>
            <td>{s.sex}</td>
            <td>{s.guardianName}</td>
            <td>{s.guardianPhone}</td>
          </tr>
        ))}
      />
    </PrintArea>
  )
}
