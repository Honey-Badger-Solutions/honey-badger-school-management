/**
 * Print settings — pick one of the app's layouts, then decide what appears
 * inside it.
 *
 * There is no designer, and that is the design. A school that can drag the
 * total off a receipt has produced a piece of paper that is not a receipt, and
 * a report card whose columns move is no longer comparable with the one the
 * same school printed last term. So the structure is the application's; the
 * choices here are a layout, a set of show/hide options, a logo, a colour and
 * three lines of text.
 *
 * Changes save as you make them (`<SaveChip>`, the documented optimistic
 * pattern) rather than behind a Save button, because the preview beside them is
 * the feedback: a toggle you have to save before you can see is a toggle nobody
 * trusts.
 */
import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { PageTitle, SaveChip, type SaveState } from '../../components/bits'
import { toast } from '../../components/Toast'
import { ReceiptPaper } from '../../components/print/Receipt'
import { ReportCardPaper } from '../../components/print/ReportCard'
import { useDb } from '../../services/db'
import { MAX_LOGO_BYTES, saveLogo, savePrintSettings } from '../../services/print'
import { sectionReport } from '../../lib/derive'
import { useT } from '../../store/session'
import type { TKey } from '../../i18n'
import type { PrintAccent, PrintSettings as Settings, ReceiptLayout, ReportCardLayout } from '../../types'

export default function PrintSettings() {
  const t = useT()
  const db = useDb()
  const p = db.printSettings
  const [state, setState] = useState<SaveState>('idle')

  /** One patch path for every control on the screen. */
  const set = async (patch: Partial<Settings>) => {
    setState('saving')
    await savePrintSettings(patch)
    setState('synced')
  }

  return (
    <>
      <PageTitle title={t('printSettingsTitle')}>
        <SaveChip state={state} />
      </PageTitle>
      <p className="text-soft text-[13px] mb-4 max-w-[640px]">{t('printSettingsLead')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="flex flex-col gap-5">
          {/* ---- layouts ---- */}
          <Card title={t('receiptLayout')}>
            <Choice<ReceiptLayout>
              name="receipt-layout"
              value={p.receiptLayout}
              onChange={(v) => set({ receiptLayout: v })}
              options={[
                { value: 'standard', label: 'layoutStandard', sub: 'layoutStandardReceiptSub' },
                { value: 'thermal', label: 'layoutThermal', sub: 'layoutThermalSub' },
              ]}
            />
          </Card>

          <Card title={t('reportCardLayout')}>
            <Choice<ReportCardLayout>
              name="report-layout"
              value={p.reportCardLayout}
              onChange={(v) => set({ reportCardLayout: v })}
              options={[
                { value: 'standard', label: 'layoutStandard', sub: 'layoutStandardReportSub' },
                { value: 'detailed', label: 'layoutDetailed', sub: 'layoutDetailedSub' },
              ]}
            />
          </Card>

          {/* ---- letterhead ---- */}
          <Card title={t('letterhead')}>
            <LogoField />
            <Check label="showLogo" on={p.showLogo} onChange={(v) => set({ showLogo: v })} />
            <Check label="showNameAm" on={p.showNameAm} onChange={(v) => set({ showNameAm: v })} />
            <Check label="showCity" on={p.showCity} onChange={(v) => set({ showCity: v })} />
            <Check label="showPhone" on={p.showPhone} onChange={(v) => set({ showPhone: v })} />

            <div className="field mt-4">
              <label>{t('accentColour')}</label>
              <div className="seg">
                {(['honey', 'ink'] as PrintAccent[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={p.accent === a ? 'on' : ''}
                    onClick={() => set({ accent: a })}
                  >
                    {t(a === 'honey' ? 'accentHoney' : 'accentInk')}
                  </button>
                ))}
              </div>
              {p.accent === 'ink' && <p className="hint">{t('accentInkSub')}</p>}
            </div>

            <TextField
              id="ps-header"
              label="headerNote"
              placeholder="headerNotePlaceholder"
              value={p.headerNote}
              onSave={(v) => set({ headerNote: v })}
            />
            <TextField
              id="ps-footer"
              label="footerNote"
              placeholder="footerNotePlaceholder"
              value={p.footerNote}
              onSave={(v) => set({ footerNote: v })}
            />
          </Card>

          {/* ---- per-document fields ---- */}
          <Card title={t('receiptFields')}>
            <Check label="receiptShowCashier" on={p.receiptShowCashier} onChange={(v) => set({ receiptShowCashier: v })} />
            <Check label="receiptShowMethod" on={p.receiptShowMethod} onChange={(v) => set({ receiptShowMethod: v })} />
            <Check label="receiptShowBalance" on={p.receiptShowBalance} onChange={(v) => set({ receiptShowBalance: v })} />
            <Check label="receiptShowSignature" on={p.receiptShowSignature} onChange={(v) => set({ receiptShowSignature: v })} />
          </Card>

          <Card title={t('reportFields')}>
            <Check label="reportShowRank" on={p.reportShowRank} onChange={(v) => set({ reportShowRank: v })} />
            <Check label="reportShowClassAverage" on={p.reportShowClassAverage} onChange={(v) => set({ reportShowClassAverage: v })} />
            <Check label="reportShowAttendance" on={p.reportShowAttendance} onChange={(v) => set({ reportShowAttendance: v })} />
            <Check label="reportShowComment" on={p.reportShowComment} onChange={(v) => set({ reportShowComment: v })} />
            <Check label="reportShowSignatures" on={p.reportShowSignatures} onChange={(v) => set({ reportShowSignatures: v })} />
            <TextField
              id="ps-principal"
              label="principalName"
              placeholder="principalNamePlaceholder"
              value={p.principalName}
              onSave={(v) => set({ principalName: v })}
            />
          </Card>
        </div>

        <Previews />
      </div>
    </>
  )
}

/* ---------------- small building blocks ---------------- */

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card-pad">
      <h2 className="font-display font-bold text-[15px] mb-3">{title}</h2>
      {children}
    </div>
  )
}

/** Radio group — the "simple select" the layouts are chosen with. */
function Choice<T extends string>({ name, value, onChange, options }: {
  name: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: TKey; sub: TKey }[]
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            value === o.value ? 'border-gold bg-honey/10' : 'border-line hover:border-soft'
          }`}
        >
          <input
            type="radio"
            name={name}
            className="w-5 h-5 mt-0.5 accent-[#A87800] shrink-0"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span className="min-w-0">
            <b className="font-display text-[13.5px] block">{t(o.label)}</b>
            <small className="text-dim text-[12px] leading-snug block">{t(o.sub)}</small>
          </span>
        </label>
      ))}
    </div>
  )
}

/** A show/hide option. `.lrow` keeps the 56px touch target. */
function Check({ label, on, onChange }: { label: TKey; on: boolean; onChange: (v: boolean) => void }) {
  const t = useT()
  return (
    <label className="lrow cursor-pointer !px-0">
      <input
        type="checkbox"
        className="w-5 h-5 accent-[#A87800]"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex-1 text-[13.5px]">{t(label)}</span>
    </label>
  )
}

/**
 * Free text that saves when you leave the field.
 *
 * Per-keystroke saving would write a partial motto onto every document in the
 * school between one letter and the next.
 */
function TextField({ id, label, placeholder, value, onSave }: {
  id: string
  label: TKey
  placeholder: TKey
  value: string
  onSave: (v: string) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState(value)
  return (
    <div className="field mt-3">
      <label htmlFor={id}>{t(label)}</label>
      <input
        id={id}
        value={draft}
        placeholder={t(placeholder)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onSave(draft.trim()) }}
      />
    </div>
  )
}

function LogoField() {
  const t = useT()
  const db = useDb()
  const logo = db.printSettings.logoUrl
  const [busy, setBusy] = useState(false)

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be chosen again after a failure
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) { toast(t('logoTooLarge')); return }
    setBusy(true)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }).catch(() => null)
    if (dataUrl) {
      await saveLogo(dataUrl)
      toast(t('printSettingsSaved'))
    }
    setBusy(false)
  }

  return (
    <div className="mb-2">
      <p className="sec-h !mt-0">{t('schoolLogo')}</p>
      <p className="text-dim text-[12px] mb-3">{t('schoolLogoSub')}</p>
      <div className="flex items-center gap-4">
        <span className="w-[64px] h-[64px] rounded-xl border border-line bg-surface grid place-items-center shrink-0 overflow-hidden">
          {logo
            ? <img src={logo} alt="" className="max-w-full max-h-full object-contain" />
            : <Icon name="book" size={22} className="text-dim" />}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className="btn-ghost btn-sm cursor-pointer">
            <Icon name="up" size={15} />
            {busy ? t('saving') : t('uploadLogo')}
            <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
          </label>
          {logo && (
            <button className="btn-ghost btn-sm" onClick={() => saveLogo(null)}>
              <Icon name="x" size={15} />{t('removeLogo')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- previews ---------------- */

/**
 * The real print components, rendered on screen.
 *
 * Not a mock-up: a drawing of a receipt is a second thing to keep in step with
 * the receipt, and the first time they disagree the school finds out on paper.
 * The sample is the most recent real payment and a real report row, so what is
 * shown here is what comes out of the printer.
 */
function Previews() {
  const t = useT()
  const db = useDb()

  const payment = db.payments.reduce<typeof db.payments[number] | null>(
    (best, p) => (!best || p.serverSeq > best.serverSeq ? p : best),
    null,
  )
  const exam = db.examPeriods[0]
  // First class that actually has marks — a preview of empty columns shows
  // nothing about the layout.
  const sample = exam
    ? db.sections
        .map((sec) => sectionReport(db, exam.id, sec.id))
        .find((rows) => rows.some((r) => r.average !== null))
    : undefined
  const row = sample?.find((r) => r.average !== null)

  return (
    <div className="card-pad lg:sticky lg:top-7">
      <h2 className="font-display font-bold text-[15px] mb-1">{t('preview')}</h2>
      <p className="text-dim text-[12px] mb-4">{t('previewSub')}</p>

      {!payment && !row && <p className="text-soft text-[13px]">{t('previewNoData')}</p>}

      {payment && (
        <div className="mb-5">
          <p className="sec-h !mt-0">{t('receipt')}</p>
          <PreviewSheet><ReceiptPaper payment={payment} /></PreviewSheet>
        </div>
      )}
      {exam && sample && row && (
        <div>
          <p className="sec-h">{t('reportCard')}</p>
          <PreviewSheet><ReportCardPaper exam={exam} row={row} rows={sample} /></PreviewSheet>
        </div>
      )}
    </div>
  )
}

/** White paper on screen. Wide layouts scroll inside the box, not the page. */
function PreviewSheet({ children }: { children: ReactNode }) {
  return (
    <div className="border border-line rounded-xl bg-white p-4 overflow-x-auto">
      <div className="min-w-[420px]">{children}</div>
    </div>
  )
}
