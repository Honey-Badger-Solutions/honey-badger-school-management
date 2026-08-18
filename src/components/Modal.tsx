import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useT } from '../store/session'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ title, lead, onClose, children }: {
  title: string
  lead?: string
  onClose: () => void
  children: ReactNode
}) {
  const t = useT()
  const sheet = useRef<HTMLDivElement>(null)
  // Only a press that BEGAN on the backdrop may dismiss: otherwise selecting
  // text inside a form and releasing outside would throw the entry away.
  const pressedScrim = useRef(false)
  const opener = useRef<HTMLElement | null>(null)
  const open = useRef(false)

  // Captured during RENDER, not in the effect: React applies a child's
  // autoFocus during commit, so by effect time the "previously focused"
  // element would already be this dialog's own first field.
  if (opener.current === null) opener.current = document.activeElement as HTMLElement | null

  // Focus restore: return focus to whatever opened the dialog.
  useEffect(() => {
    open.current = true
    // Data-entry dialogs should land on their first field, not the close button;
    // dialogs with no fields fall back to their first focusable control.
    const field = sheet.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
    const first = field ?? sheet.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? sheet.current)?.focus()

    return () => {
      open.current = false
      // Deferred: removing the focused node resets focus to <body>, which would
      // clobber a restore performed synchronously here. The open-flag check
      // skips the restore when this is StrictMode's remount, not a real close.
      setTimeout(() => {
        if (!open.current && opener.current?.isConnected) opener.current.focus()
      }, 0)
    }
  }, [])

  // Escape closes; Tab is trapped inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !sheet.current) return
      const items = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!sheet.current.contains(active)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="scrim no-print"
      onMouseDown={(e) => { pressedScrim.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && pressedScrim.current) onClose() }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={sheet} tabIndex={-1}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-[19px] font-bold">{title}</h2>
          <button className="w-9 h-9 grid place-items-center rounded-[10px] text-soft hover:bg-surface2 shrink-0" onClick={onClose} aria-label={t('close')}>
            <Icon name="x" size={18} />
          </button>
        </div>
        {lead && <p className="text-soft text-[13.5px] leading-relaxed mb-4">{lead}</p>}
        {!lead && <div className="mb-3" />}
        {children}
      </div>
    </div>
  )
}
