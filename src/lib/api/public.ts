'use client'

import { useEffect, useState } from 'react'
import { estActif, requete } from './client'

/**
 * Lecture publique (`GET /v1/public/…`) avec repli maquette.
 *
 * Quand `NEXT_PUBLIC_API_URL` est absente, `donnees` reste `undefined` et
 * l’écran garde son jeu local — la construction statique ne part jamais en
 * requête. En mode API, un échec (réseau, `404`, `424`) laisse aussi
 * `undefined` : c’est le repli local qui s’affiche, pas une page en erreur.
 */
export function usePublic<T>(chemin: string, query?: Record<string, string>) {
  const [donnees, setDonnees] = useState<T | undefined>(undefined)
  // Vrai quand la lecture a abouti ou échoué (ou quand il n'y a pas d'API) : permet d'éviter d'afficher le repli local en attendant.
  const [termine, setTermine] = useState(!estActif())

  useEffect(() => {
    if (!estActif()) return
    let annule = false
    requete<T>(chemin, { query }).then(
      (v) => {
        if (!annule) {
          setDonnees(v)
          setTermine(true)
        }
      },
      () => {
        // Repli maquette : l’écran garde ses données locales.
        if (!annule) setTermine(true)
      },
    )
    return () => {
      annule = true
    }
  }, [chemin, JSON.stringify(query ?? {})])

  return { donnees, termine }
}
