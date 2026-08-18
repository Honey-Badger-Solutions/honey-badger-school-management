import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { useT } from '../store/session'
import { useOnline } from '../store/online'
import type { Student, Teacher } from '../types'

export function personName(p: Pick<Student | Teacher, 'firstName' | 'fatherName'>): string {
  return `${p.firstName} ${p.fatherName}`
}

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <span className="av" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {name.charAt(0)}
    </span>
  )
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <h1 className="text-[21px] md:text-[24px] font-bold mr-auto">{title}</h1>
      {children}
    </div>
  )
}

export function EmptyState({ icon = 'search', title, sub }: { icon?: IconName; title: string; sub?: string }) {
  return (
    <div className="text-center py-12 px-5 text-dim">
      <div className="w-[58px] h-[58px] rounded-2xl bg-surface border border-line grid place-items-center mx-auto mb-4 text-soft">
        <Icon name={icon} />
      </div>
      <h3 className="text-ink text-[16px] font-bold mb-1.5">{title}</h3>
      {sub && <p className="text-[13px] max-w-[300px] mx-auto leading-relaxed">{sub}</p>}
    </div>
  )
}

/** Subtle connection pill — offline-friendly affordance, not an alarm. */
export function OnlineDot() {
  const online = useOnline()
  const t = useT()
  return (
    <span
      className={`pill ${online ? 'bg-good/10 text-good' : 'bg-surface3 text-soft'}`}
      title={online ? t('online') : t('workOffline')}
    >
      <Icon name={online ? 'wifi' : 'wifiOff'} size={13} />
      <span className="hidden sm:inline">{online ? t('online') : t('offline')}</span>
    </span>
  )
}

export type SaveState = 'idle' | 'saving' | 'local' | 'synced'

/** "Saved locally → synced" chip shown next to bulk-entry screens. */
export function SaveChip({ state }: { state: SaveState }) {
  const t = useT()
  const online = useOnline()
  if (state === 'idle') return null
  if (state === 'saving') return <span className="pill-dim">{t('saving')}</span>
  if (state === 'local' || !online) return (
    <span className="pill-gold"><Icon name="check" size={13} />{t('savedLocally')}</span>
  )
  return <span className="pill-good"><Icon name="check" size={13} />{t('synced')}</span>
}
