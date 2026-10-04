'use client'

import type { ReactNode } from 'react'
import { BoutonAction, type SpecOperation } from '@/components/app/actions'

/**
 * Résiliation destructive — ouvre toujours la modale de confirmation (saisie du
 * nom exact de la ressource), comme pour une suppression d’infrastructure.
 */
export function BoutonResilier({
  ressource,
  pertes,
  operation,
  libelle = 'Résilier',
  titre,
  className,
}: {
  ressource: string
  pertes: string[]
  operation: SpecOperation
  libelle?: ReactNode
  titre?: string
  className?: string
}) {
  return (
    <BoutonAction
      libelle={libelle}
      variant="ghost"
      size="sm"
      className={className}
      confirmation={{
        ressource,
        titre: titre ?? `Résilier ${ressource} ?`,
        pertes,
        libelleAction: 'Résilier',
      }}
      operation={operation}
    />
  )
}
