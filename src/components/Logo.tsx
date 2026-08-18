import { useT } from '../store/session'
import markUrl from '../assets/logo-mark.png'
import fullUrl from '../assets/logo.png'

/**
 * Two cuts of the same badger, because one image cannot serve both sizes.
 *
 * `Mark` is a head-and-cap crop, used only where the logo is genuinely tiny
 * (the mobile top bar, 28px). The full-body artwork at that size collapses
 * into a gold smudge — the cap, glasses and tassel are all sub-pixel.
 *
 * `FullLogo` is the whole badger, for places with room to show it: the login
 * screen and printed letterheads. The sidebar `Brand` uses it too — see there.
 */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <img
      src={markUrl}
      alt=""
      width={size}
      height={size}
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

export function FullLogo({ height = 96 }: { height?: number }) {
  return <img src={fullUrl} alt="" style={{ height }} className="object-contain shrink-0" />
}

/**
 * The sidebar lockup: whole badger, short wordmark, product line beneath.
 *
 * It shows `FullLogo` rather than the head crop because the sidebar has the
 * room, and the artwork is portrait (421×542) — at 46px tall it is only ~36px
 * wide, so the badger reads in full without crowding the text. The wordmark is
 * deliberately short ("Honey Badger") so the whole name fits one line; the
 * full product name sits underneath instead of wrapping across three.
 */
export function Brand() {
  const t = useT()
  return (
    <span className="flex items-center gap-2">
      {/* 40px, not larger: the product line below needs ~149px to stay on one
          line, and the sidebar is a fixed 236px. A taller badger orphans
          "System" onto a line of its own. */}
      <FullLogo height={40} />
      <span className="leading-tight min-w-0">
        <b className="font-display font-bold text-[15px] block">{t('brandName')}</b>
        {/* -0.01em buys ~2.6px — imperceptible, but it is the difference
            between one line and an orphaned "System" at this fixed width */}
        <small className="text-dim text-[11px] block tracking-[-0.01em]">{t('brandSub')}</small>
      </span>
    </span>
  )
}
