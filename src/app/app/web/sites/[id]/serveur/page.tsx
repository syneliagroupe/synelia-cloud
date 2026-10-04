'use client'

import { use } from 'react'
import { EmptyState } from '@/components/composition/states'
import { useEntreeSite, hrefSite } from '@/lib/web/entrees'
import { VueHebergement } from '../../../hebergement/[id]/vue'

export default function PageSiteServeur({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const siteId = decodeURIComponent(id)
  const entree = useEntreeSite(siteId)
  const h = entree?.hebergement

  if (!entree) {
    return (
      <EmptyState
        titre="Site introuvable"
        phrase="Ce nom n’existe pas dans votre organisation."
        action={{ libelle: 'Retour aux sites', href: '/app/web/sites' }}
      />
    )
  }

  if (!h) {
    return (
      <EmptyState
        titre="Aucun serveur attaché"
        phrase="Attachez un hébergement depuis la vue d’ensemble de ce site."
        action={{ libelle: 'Vue d’ensemble', href: hrefSite(siteId) }}
      />
    )
  }

  return <VueHebergement id={h.id} navigation="sites" siteCle={siteId} />
}
