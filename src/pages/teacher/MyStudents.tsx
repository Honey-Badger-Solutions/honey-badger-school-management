import { useState } from 'react'
import { Avatar, PageTitle, personName } from '../../components/bits'
import { rosterOf, sectionLabel, studentAttendance } from '../../lib/derive'
import { useT } from '../../store/session'
import { useTeacher } from './useTeacher'
import { NoClasses } from './NoClasses'

export default function MyStudents() {
  const t = useT()
  const { db, teacher, sectionIds } = useTeacher()
  const [sectionId, setSectionId] = useState(sectionIds[0])
  const roster = rosterOf(db, sectionId)

  if (!teacher) return null // Guard is ending this session
  if (sectionIds.length === 0) {
    return (
      <>
        <PageTitle title={t('myStudentsTitle')} />
        <NoClasses />
      </>
    )
  }

  return (
    <>
      <PageTitle title={t('myStudentsTitle')}>
        <span className="pill-dim">{t('readOnly')}</span>
      </PageTitle>

      <div className="flex gap-2 overflow-x-auto py-0.5 mb-4" role="group" aria-label={t('chooseClass')}>
        {sectionIds.map((id) => (
          <button
            key={id}
            onClick={() => setSectionId(id)}
            className={`shrink-0 px-4 min-h-[42px] rounded-full border text-[13px] font-display font-semibold transition-colors ${
              id === sectionId ? 'bg-honey text-[#221900] border-honey' : 'bg-surface text-soft border-line'
            }`}
          >
            {sectionLabel(db, id)}
          </button>
        ))}
      </div>

      <p className="text-dim text-[12.5px] mb-2">{roster.length} {t('students')}</p>
      <div className="card">
        {roster.map((s) => {
          const att = studentAttendance(db, s.id)
          const rate = att.total ? Math.round(((att.present + att.late) / att.total) * 100) : null
          return (
            <div key={s.id} className="lrow">
              <Avatar name={s.firstName} size={36} />
              <span className="flex-1 min-w-0">
                <b className="text-[13.5px] block truncate">{personName(s)}</b>
                <small className="text-dim text-[11.5px]">{s.sex === 'M' ? t('male') : t('female')} · {t('guardian')}: {s.guardianName}</small>
              </span>
              {rate !== null && (
                <span className={rate >= 90 ? 'pill-good' : rate >= 75 ? 'pill-gold' : 'pill-warn'}>
                  {rate}%
                </span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
