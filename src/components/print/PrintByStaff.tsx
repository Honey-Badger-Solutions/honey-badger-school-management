/**
 * "Print by staff" — the button and the little form behind it.
 *
 * Shared by every screen that produces a printable document, so the request a
 * receipt makes and the request a report card makes are the same shape and land
 * in the same queue. The button hides itself when the signed-in role may not
 * queue work, rather than each screen remembering to ask.
 */
import { useState } from 'react'
import { Icon } from '../Icon'
import { Modal } from '../Modal'
import { toast } from '../Toast'
import { MAX_COPIES, requestStaffPrint, type PrintRequestInput } from '../../services/printRequests'
import { useCan, useT } from '../../store/session'

export function PrintByStaffButton({ what, onBeforeRequest, className = 'btn-ghost flex-1' }: {
  /** the document to queue — see services/printRequests.ts */
  what: PrintRequestInput
  /**
   * Run before the request is written — for a screen holding an unsaved edit.
   * The desk prints from live data, so anything still in a text field would
   * simply be absent from the sheet they hand over.
   */
  onBeforeRequest?: () => Promise<unknown>
  className?: string
}) {
  const t = useT()
  const can = useCan()
  const [open, setOpen] = useState(false)
  if (!can('print_requests.create')) return null
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <Icon name="printer" size={17} />{t('printByStaff')}
      </button>
      {open && <PrintByStaffModal what={what} onBeforeRequest={onBeforeRequest} onClose={() => setOpen(false)} />}
    </>
  )
}

function PrintByStaffModal({ what, onBeforeRequest, onClose }: {
  what: PrintRequestInput
  onBeforeRequest?: () => Promise<unknown>
  onClose: () => void
}) {
  const t = useT()
  const [copies, setCopies] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      await onBeforeRequest?.()
      await requestStaffPrint({ ...what, copies: Number(copies) || 1, note })
      toast(t('printRequestSent'))
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('printByStaff')} onClose={onClose}>
      <p className="text-soft text-[13px] mb-4">{t('printByStaffSub')}</p>
      <div className="field">
        <label htmlFor="pbs-copies">{t('printRequestCopies')}</label>
        <input
          id="pbs-copies"
          inputMode="numeric"
          value={copies}
          onChange={(e) => {
            const n = e.target.value.replace(/\D/g, '').slice(0, 2)
            setCopies(n === '' ? '' : String(Math.min(MAX_COPIES, Number(n))))
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="pbs-note">{t('printRequestNote')}</label>
        <textarea
          id="pbs-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('printRequestNotePlaceholder')}
        />
      </div>
      {err && <p className="text-warn text-[12.5px] font-medium mb-3">{err}</p>}
      <div className="flex gap-2.5">
        <button className="btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-gold flex-1" onClick={submit} disabled={busy}>
          {busy ? t('saving') : t('sendToPrintDesk')}
        </button>
      </div>
    </Modal>
  )
}
