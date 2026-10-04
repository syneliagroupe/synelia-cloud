'use client'

import { useMemo } from 'react'
import { DOMAINES, HEBERGEMENTS, ZONES_DNS, assemblerEntrees, entreeWebCloudById, entreesWebCloud } from '@/lib/mock'
import type { DnsZone, Domaine, WebHosting } from '@/lib/types'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'

export type EntreeWeb = ReturnType<typeof assemblerEntrees>[number]

/** Entrées « site » (nom servi + hébergement + zone) pour le panneau Sites. */
export function useEntreesWeb(): EntreeWeb[] {
  const domaines = useCollection<Domaine>('domaines', DOMAINES)
  const hebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const zones = useCollection<DnsZone>('zones-dns', ZONES_DNS)

  return useMemo(
    () =>
      estActif()
        ? assemblerEntrees(domaines.items, hebergements.items, zones.items)
        : entreesWebCloud(),
    [domaines.items, hebergements.items, zones.items],
  )
}

export function useEntreeSite(id: string): EntreeWeb | undefined {
  const entrees = useEntreesWeb()
  return useMemo(() => {
    if (estActif()) return entrees.find((e) => e.id === id)
    return entreeWebCloudById(id)
  }, [entrees, id])
}

export function hrefSite(id: string, suffix = ''): string {
  return `/app/web/sites/${encodeURIComponent(id)}${suffix}`
}
