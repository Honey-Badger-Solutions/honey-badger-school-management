import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { PageTitle, personName } from '../../components/bits'
import { rosterOf, sectionLabel } from '../../lib/derive'
import { fmtDate } from '../../lib/dates'
import { visibleTeacher } from '../../services/staff'
import { useT } from '../../store/session'
import { useTeacher } from './useTeacher'
import { NoClasses } from './NoClasses'
import type { Teacher } from '../../types'
import { EMPLOYMENT_KEYS, POSITION_KEYS } from '../admin/StaffProfile'

export default function MyClasses() {
  const t = useT()
  const { db, teacher, sectionIds, subjectsFor } = useTeacher()
  if (!teacher) return null // Guard is ending this session

  return (
    <>
      <PageTitle title={`${t('myClassesTitle')} — ${personName(teacher)}`} />
      {sectionIds.length === 0 && <NoClasses />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sectionIds.map((secId) => {
          const roster = rosterOf(db, secId)
          const subjects = subjectsFor(secId).map((sid) => db.subjects.find((s) => s.id === sid)?.name).filter(Boolean)
          const isHomeroom = db.sections.find((s) => s.id === secId)?.homeroomTeacherId === teacher.id
          return (
            <div key={secId} className="card-pad">
              <div className="flex items-center justify-between mb-1">
                <b className="font-display text-[17px]">{sectionLabel(db, secId)}</b>
                {isHomeroom && <span className="pill-gold"><Icon name="badge" size={12} />{t('homeroom')}</span>}
              </div>
              <p className="text-soft text-[12.5px] mb-4">
                {roster.length} {t('students')} · {subjects.join(', ')}
              </p>
              <div className="flex gap-2">
                <Link to={`/teacher/attendance?section=${secId}`} className="btn-gold btn-sm flex-1">
                  <Icon name="clipboard" size={16} />{t('takeAttendance')}
                </Link>
                <Link to={`/teacher/marks?section=${secId}`} className="btn-ghost btn-sm flex-1">
                  <Icon name="edit" size={16} />{t('enterMarks')}
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <MyDetails teacher={teacher} />
    </>
  )
}

/** A teacher's own record: their contact details are the only ones they can
 *  see anywhere in the app, and they are read-only (admin edits them). */
function MyDetails({ teacher }: { teacher: Teacher }) {
  const t = useT()
  const me = visibleTeacher(teacher)
  return (
    <>
      <p className="sec-h">{t('myDetails')}</p>
      <div className="card">
        <Row k={t('position')} v={t(POSITION_KEYS[me.position])} />
        <Row k={t('employmentType')} v={t(EMPLOYMENT_KEYS[me.employmentType])} />
        <Row k={t('hireDate')} v={fmtDate(me.hireDate)} />
        <Row k={t('phone')} v={me.phone || t('contactHidden')} />
        <Row k={t('email')} v={me.email || t('contactHidden')} />
      </div>
      <p className="text-dim text-[11.5px] mt-2">{t('yourContactReadOnly')}</p>
    </>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-line-soft last:border-b-0">
      <span className="text-soft text-[13px]">{k}</span>
      <b className="text-[13.5px] text-right break-all">{v}</b>
    </div>
  )
}
