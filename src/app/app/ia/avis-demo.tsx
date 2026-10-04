'use client'

import { estActif } from '@/lib/api/client'
import { Callout } from '@/components/composition/card'

/** Écran sans contrepartie côté API : en mode API, on le dit au lieu de le laisser passer pour réel. */
export function AvisDemoApi({ children }: { children: React.ReactNode }) {
  if (!estActif()) return null
  return (
    <Callout ton="info" titre="Démonstration">
      {children}
    </Callout>
  )
}
