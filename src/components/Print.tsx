import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDb } from '../services/db'
import { ACCENT_BAND, ACCENT_TEXT } from '../lib/print'
import { FullLogo } from './Logo'

/**
 * Wrap printable documents in <PrintArea>. Rendered through a portal directly
 * under <body> (a sibling of #root) so that on print the app root can be
 * display:none'd entirely — page count then comes from the document alone,
 * never from the hidden app layout. See @media print rules in index.css.
 */
export function PrintArea({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('printing')
    return () => document.body.classList.remove('printing')
  }, [])
  return createPortal(<div className="print-area">{children}</div>, document.body)
}

/**
 * Print, then run `after` once the dialog closes — callers use it to unmount
 * the document they just printed. Without that, a flag-driven <PrintArea>
 * stays mounted and the NEXT print emits both documents.
 */
export function printNow(after?: () => void) {
  if (after) {
    const done = () => { window.removeEventListener('afterprint', done); after() }
    window.addEventListener('afterprint', done)
  }
  // let the print DOM paint first
  setTimeout(() => window.print(), 60)
}

/**
 * Letterhead used on every paper document — the signature HoneyBadger touch.
 *
 * What it shows is the school's choice (`db.printSettings`); how it is laid out
 * is not. The logo, the Amharic name, the city, the phone and the note are all
 * optional, and the accent band resolves through `lib/print.ts` so a colour is
 * a palette token and never a hex in a component.
 */
export function PrintHead({ doc }: { doc: string }) {
  const db = useDb()
  const s = db.settings
  const p = db.printSettings
  // Joined rather than three fixed slots: hiding the middle one must not leave
  // a stray separator on the page.
  const sub = [p.showNameAm && db.school.nameAm, p.showCity && s.city, p.showPhone && db.school.phone]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 pb-3">
        {p.showLogo &&
          (p.logoUrl
            ? <img src={p.logoUrl} alt="" style={{ height: 54 }} className="object-contain shrink-0" />
            : <FullLogo height={54} />)}
        <div className="flex-1 leading-tight">
          <div className="font-display font-bold text-[19px] text-ink">{db.school.name}</div>
          {sub && <div className="text-[12px] text-soft">{sub}</div>}
        </div>
        <div className="text-right leading-tight">
          <div className={`font-display font-bold text-[13px] uppercase tracking-[1px] ${ACCENT_TEXT[p.accent]}`}>{doc}</div>
          <div className="text-[11.5px] text-soft">{s.academicYear} · {s.term}</div>
        </div>
      </div>
      {p.headerNote && <p className="text-[11.5px] text-soft pb-2 leading-snug">{p.headerNote}</p>}
      <div className={`h-[5px] rounded-full ${ACCENT_BAND[p.accent]}`} />
    </div>
  )
}

export function PrintFoot({ page, of }: { page?: number; of?: number }) {
  const db = useDb()
  const note = db.printSettings.footerNote
  return (
    <div className="mt-5 pt-2 border-t border-line text-[10.5px] text-dim flex justify-between gap-3">
      <span>{db.school.name} — {db.settings.academicYear}{note ? ` · ${note}` : ''}</span>
      {page && of ? <span>Page {page} of {of}</span> : null}
      <span>Printed with HoneyBadger School</span>
    </div>
  )
}

/**
 * A multi-page table report. Rows are split into fixed-size pages so that the
 * full letterhead and a real "Page N of M" appear on EVERY sheet — schools file
 * these per page, and CSS alone cannot number pages in Chrome.
 */
export function PaginatedReport({ doc, summary, headRow, rows, rowsPerPage = 18 }: {
  doc: string
  summary?: ReactNode
  headRow: ReactNode
  rows: ReactNode[]
  rowsPerPage?: number
}) {
  const pages: ReactNode[][] = []
  for (let i = 0; i < rows.length; i += rowsPerPage) pages.push(rows.slice(i, i + rowsPerPage))
  if (pages.length === 0) pages.push([])

  return (
    <>
      {pages.map((chunk, i) => (
        <div key={i} className="print-page">
          <PrintHead doc={doc} />
          {i === 0 && summary}
          <table className="tbl w-full">
            <thead>{headRow}</thead>
            <tbody>{chunk}</tbody>
          </table>
          <PrintFoot page={i + 1} of={pages.length} />
        </div>
      ))}
    </>
  )
}
