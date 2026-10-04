'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DOMAINES, HEBERGEMENTS, ZONES_DNS, assemblerEntrees, nomServi } from '@/lib/mock'
import type { DnsZone, Domaine, WebHosting } from '@/lib/types'
import { EmptyState } from '@/components/composition/states'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'
import { hrefSite } from '@/lib/web/entrees'

export function RedirigeHebergementVersSite({ hebergementId }: { hebergementId: string }) {
  const router = useRouter()
  const hebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const domaines = useCollection<Domaine>('domaines', DOMAINES)
  const zones = useCollection<DnsZone>('zones-dns', ZONES_DNS)
  const h =
    hebergements.items.find((x) => x.id === hebergementId) ??
    HEBERGEMENTS.find((x) => x.id === hebergementId)

  const entree = assemblerEntrees(domaines.items, hebergements.items, zones.items).find(
    (e) => e.hebergement?.id === hebergementId,
  )

  const cible = entree?.id ?? h?.domaine ?? h?.domaineProvisoire ?? null

  useEffect(() => {
    if (!hebergements.chargement && cible) {
      router.replace(hrefSite(cible, '/serveur'))
    }
  }, [hebergements.chargement, cible, router])

  if (hebergements.chargement) return null

  if (cible) return null

  return (
    <EmptyState
      titre="Hébergement introuvable"
      phrase={
        h
          ? `Serveur ${nomServi(h)} — impossible de déterminer le site associé.`
          : 'Ce hébergement n’existe pas ou plus dans votre organisation.'
      }
      action={{ libelle: 'Sites', href: '/app/web/sites' }}
    />
  )
}
