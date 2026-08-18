/** Inline stroke icons, same visual style as HoneyBadger Courses (.ico). */
const PATHS: Record<string, JSX.Element> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.6-3.4 3.1-5.4 6.2-5.4s5.6 2 6.2 5.4" /><path d="M15.5 5.1a3.4 3.4 0 1 1 1.2 6.6" /><path d="M17.6 14.9c2.2.5 3.7 2.2 4.1 5.1" /></>,
  cash: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5h.01M18 14.5h.01" /></>,
  exam: <><path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" /><path d="M9 8h6M9 12h6M9 16h3.5" /></>,
  staff: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3 12.5h18" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.4 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.4-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></>,
  printer: <><path d="M7 8V3.5h10V8" /><rect x="3" y="8" width="18" height="9" rx="2" /><path d="M7 14h10v6.5H7Z" /></>,
  check: <path d="m4.5 12.5 5 5L19.5 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevL: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  chevR: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  logout: <><path d="M14 4h4a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  wifi: <><path d="M2.5 9a14.5 14.5 0 0 1 19 0" /><path d="M5.6 12.5a10 10 0 0 1 12.8 0" /><path d="M8.8 16a5.5 5.5 0 0 1 6.4 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /></>,
  wifiOff: <><path d="M2.5 9a14.5 14.5 0 0 1 6.6-3.5M14 5.3A14.5 14.5 0 0 1 21.5 9" /><path d="M5.6 12.5a10 10 0 0 1 3.3-2.1M13.6 10a10 10 0 0 1 4.8 2.4" /><path d="M8.8 16a5.5 5.5 0 0 1 6.4 0" /><circle cx="12" cy="19" r="1" fill="currentColor" /><path d="M3 3l18 18" /></>,
  phone: <path d="M5 4h3.5l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" />,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></>,
  edit: <><path d="M4 20h4l11-11a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m13.5 7.5 3 3" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" /></>,
  alert: <><path d="M12 3.5 22 20H2Z" /><path d="M12 10v4M12 17h.01" /></>,
  more: <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
  swap: <><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></>,
  receipt: <><path d="M5.5 3h13v18l-2.2-1.5L14 21l-2-1.5L10 21l-2.3-1.5L5.5 21Z" /><path d="M9 8h6M9 12h6" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a3 3 0 0 1 6 0" /><path d="m8.5 13 2.5 2.5 4.5-5" /></>,
  badge: <><circle cx="12" cy="9" r="5.5" /><path d="m8.8 13.5-1.3 7 4.5-2.6 4.5 2.6-1.3-7" /></>,
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 21, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
