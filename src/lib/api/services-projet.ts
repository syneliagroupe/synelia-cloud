'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ServiceProjet } from '@/lib/types'
import { estActif, requete } from './client'

/**
 * Services d’un projet (`GET /projets/{id}/services`) — la route est nichée,
 * le registre des collections ne peut pas l’exprimer. En maquette, `distants`
 * reste `null` et l’écran garde la collection locale ; avec l’API, la liste
 * distante remplace le filtre local. Le backend renvoie un tableau nu.
 */
export function useServicesProjet(projetId: string) {
  const [distants, setDistants] = useState<ServiceProjet[] | null>(null)

  const rechargerServices = useCallback(() => {
    if (!estActif() || !projetId) return
    requete<ServiceProjet[] | { donnees: ServiceProjet[] }>(
      `/projets/${encodeURIComponent(projetId)}/services`,
    ).then(
      (v) => setDistants(Array.isArray(v) ? v : v.donnees),
      () => {
        // Lecture seule : l’écran garde sa collection locale en cas d’échec.
      },
    )
  }, [projetId])

  useEffect(() => {
    setDistants(null)
    rechargerServices()
  }, [rechargerServices])

  return { distants, rechargerServices }
}
