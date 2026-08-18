import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { FullLogo } from '../components/Logo'
import { personName } from '../components/bits'
import { useDb } from '../services/db'
import { assignableTeachers } from '../services/staff'
import { useSession, useT } from '../store/session'

export default function Login() {
  const t = useT()
  const db = useDb()
  const login = useSession((s) => s.login)
  const lang = useSession((s) => s.lang)
  const setLang = useSession((s) => s.setLang)
  const navigate = useNavigate()
  const [role, setRole] = useState<'admin' | 'teacher' | null>(null)
  // departed staff can no longer sign in
  const signInList = assignableTeachers(db)
  const [teacherId, setTeacherId] = useState(signInList[0]?.id ?? '')

  const go = () => {
    if (!role) return
    login(role, role === 'teacher' ? teacherId : undefined)
    navigate(role === 'admin' ? '/admin' : '/teacher')
  }

  const optCls = (sel: boolean) =>
    `w-full flex items-center gap-3.5 p-4 rounded-xl border text-left transition-colors min-h-[72px] ${
      sel ? 'border-gold bg-honey/10' : 'border-line bg-surface2/60 hover:border-gold'
    }`

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-between mb-5">
          <FullLogo height={84} />
          <div className="seg" role="group" aria-label={t('language')}>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>{t('langEn')}</button>
            <button className={lang === 'am' ? 'on' : ''} onClick={() => setLang('am')}>{t('langAm')}</button>
          </div>
        </div>
        <h1 className="text-[24px] font-bold mb-1">{t('appName')}</h1>
        <p className="text-soft text-[13.5px] mb-6">{t('tagline')} — {db.settings.schoolName}</p>

        <p className="sec-h !mt-0">{t('chooseRole')}</p>
        <div className="flex flex-col gap-2.5 mb-4">
          <button className={optCls(role === 'admin')} onClick={() => setRole('admin')} aria-pressed={role === 'admin'}>
            <span className="w-11 h-11 rounded-xl bg-honey/15 text-gold grid place-items-center shrink-0"><Icon name="badge" /></span>
            <span className="flex-1">
              <b className="font-display font-semibold text-[15px] block">{t('roleAdmin')}</b>
              <small className="text-dim text-[12px]">{t('roleAdminSub')}</small>
            </span>
            {role === 'admin' && <Icon name="check" size={20} className="text-gold" />}
          </button>
          <button className={optCls(role === 'teacher')} onClick={() => setRole('teacher')} aria-pressed={role === 'teacher'}>
            <span className="w-11 h-11 rounded-xl bg-honey/15 text-gold grid place-items-center shrink-0"><Icon name="book" /></span>
            <span className="flex-1">
              <b className="font-display font-semibold text-[15px] block">{t('roleTeacher')}</b>
              <small className="text-dim text-[12px]">{t('roleTeacherSub')}</small>
            </span>
            {role === 'teacher' && <Icon name="check" size={20} className="text-gold" />}
          </button>
        </div>

        {role === 'teacher' && (
          <div className="field">
            <label htmlFor="pickTeacher">{t('pickTeacher')}</label>
            <select id="pickTeacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              {signInList.map((x) => (
                <option key={x.id} value={x.id}>{personName(x)}</option>
              ))}
            </select>
          </div>
        )}

        <button className="btn-gold w-full" disabled={!role} onClick={go} style={{ opacity: role ? 1 : 0.5 }}>
          {t('continueAs')}
          <Icon name="chevR" size={17} />
        </button>

        <p className="text-dim text-[12px] text-center mt-5 leading-relaxed">{t('demoNote')}</p>
      </div>
    </div>
  )
}
