'use client'

import { useEffect, useState } from 'react'
import { ApiError, estActif, requete } from './client'

export interface Degradation {
  integration?: string
  dateDonnees?: string
}

/**
 * Lecture distante qui distingue le `424` : quand l’intégration amont ne
 * répond pas, l’écran affiche un état dégradé nommé (`integration`,
 * `dateDonnees`) au lieu d’un toast d’erreur générique. Les autres échecs
 * laissent `donnees` à `undefined` — l’écran garde alors sa graine locale.
 * Inactif sans `NEXT_PUBLIC_API_URL`.
 */
export function useLectureDegradable<T>(chemin: string, query?: Record<string, string>) {
  const [donnees, setDonnees] = useState<T | undefined>(undefined)
  const [degrade, setDegrade] = useState<Degradation | null>(null)

  const cleQuery = JSON.stringify(query ?? {})

  useEffect(() => {
    if (!estActif()) return
    let annule = false
    requete<T>(chemin, { query }).then(
      (v) => {
        if (!annule) {
          setDonnees(v)
          setDegrade(null)
        }
      },
      (e: unknown) => {
        if (annule) return
        if (e instanceof ApiError && e.statut === 424)
          setDegrade({ integration: e.integration, dateDonnees: e.dateDonnees })
      },
    )
    return () => {
      annule = true
    }
    // `cleQuery` (sérialisé) remplace `query` à dessein : une dépendance sur
    // l'objet lui-même reboucle à l'infini dès qu'un appelant passe un littéral inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemin, cleQuery])

  return { donnees, degrade }
}
