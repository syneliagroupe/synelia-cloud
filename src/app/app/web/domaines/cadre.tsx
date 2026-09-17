'use client'

import { DOMAINES, HEBERGEMENTS, ZONES_DNS, assemblerEntrees, entreesWebCloud } from '@/lib/mock'
import type { DnsZone, Domaine, WebHosting } from '@/lib/types'
import { CadreSection } from '@/components/app/cadre-section'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'

/** Panneau de la section — liste les domaines de l'organisation. */
export function CadreDomaines({ children }: { children: React.ReactNode }) {
  const domaines = useCollection<Domaine>('domaines', DOMAINES)
  const hebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const zones = useCollection<DnsZone>('zones-dns', ZONES_DNS)
  // Avec l’API, les entrées sont assemblées depuis les collections distantes
  // (mêmes champs, mêmes URL par nom servi) ; en maquette, depuis les graines.
  const entrees = estActif()
    ? assemblerEntrees(domaines.items, hebergements.items, zones.items)
    : entreesWebCloud()
  const liste = entrees.map((e) => ({
    id: e.id,
    nom: e.nom,
    sousTitre: e.sousTitre,
    etat: e.etat,
    ton: e.ton,
    href: `/app/web/domaines/${encodeURIComponent(e.id)}`,
    motsCles: [e.hebergement?.serveur.nom ?? '', e.hebergement?.palier ?? ''],
  }))

  return (
    <CadreSection
      titre="Domaines"
      base="/app/web/domaines"
      entrees={liste}
      placeholderRecherche="Rechercher un domaine…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} domaine${total > 1 ? 's' : ''}` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
