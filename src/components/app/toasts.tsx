'use client'

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from './contexte'

export function ToastHost() {
  const { toasts, retirer } = useApp()
  if (toasts.length === 0) return null

  const icones = {
    ok: <CircleCheck size={15} className="text-ok" />,
    info: <Info size={15} className="text-info" />,
    warn: <TriangleAlert size={15} className="text-warn" />,
    err: <CircleAlert size={15} className="text-err" />,
  }

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[70] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex animate-fade-in items-start gap-2.5 rounded-[10px] border bg-white px-3.5 py-3 shadow-[0_8px_28px_rgba(43,27,77,.16)]',
            {
              ok: 'border-ok/25',
              info: 'border-info/25',
              warn: 'border-warn/25',
              err: 'border-err/25',
            }[t.ton],
          )}
        >
          <span className="mt-0.5 shrink-0">{icones[t.ton]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">{t.titre}</p>
            {t.detail && <p className="mt-0.5 text-[12px] leading-snug text-g-500">{t.detail}</p>}
          </div>
          <button
            type="button"
            onClick={() => retirer(t.id)}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-g-500 hover:bg-g-100"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
