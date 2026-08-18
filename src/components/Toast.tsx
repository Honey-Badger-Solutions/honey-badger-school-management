import { create } from 'zustand'
import { Icon } from './Icon'

interface ToastState {
  msg: string | null
  show: (msg: string) => void
}

let timer: ReturnType<typeof setTimeout> | undefined

const useToast = create<ToastState>((set) => ({
  msg: null,
  show: (msg) => {
    clearTimeout(timer)
    set({ msg })
    timer = setTimeout(() => set({ msg: null }), 2600)
  },
}))

export function toast(msg: string) {
  useToast.getState().show(msg)
}

export function ToastHost() {
  const msg = useToast((s) => s.msg)
  if (!msg) return null
  return (
    <div
      role="status"
      className="no-print fixed left-1/2 -translate-x-1/2 bottom-[86px] md:bottom-6 z-[120] flex items-center gap-2 bg-ink text-paper text-[13px] font-medium px-4 py-3 rounded-xl shadow-lift"
    >
      <Icon name="check" size={16} className="text-honey" />
      {msg}
    </div>
  )
}
