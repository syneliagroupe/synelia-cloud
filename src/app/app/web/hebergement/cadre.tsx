'use client'

import { HEBERGEMENTS, ORG_COURANTE, nomServi } from '@/lib/mock'
import type { WebHosting } from '@/lib/types'
import type { Tone } from '@/components/ui/badge'
import { CadreSection } from '@/components/app/cadre-section'
import { useCollection } from '@/components/app/atelier'

/**
 * Panneau de la section — liste les hébergements de l'organisation, depuis
 * l'atelier : un passage en maintenance ou un changement de palier fait pendant
 * la session doit se lire ici aussi.
 */
export function CadreHebergement({ children }: { children: React.ReactNode }) {
  const hebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)

  const entrees = hebergements.items
    .filter((h) => h.orgId === ORG_COURANTE.id)
    .map((h) => ({
      id: h.id,
      nom: nomServi(h),
      sousTitre: `${h.palier} · ${h.serveur.nom}`,
      etat:
        h.statut === 'en_ligne' ? 'Actif' : h.statut === 'maintenance' ? 'Maintenance' : 'Suspendu',
      ton: (h.statut === 'en_ligne' ? 'ok' : 'warn') as Tone,
      href: `/app/web/hebergement/${h.id}`,
      motsCles: [h.serveur.nom, h.serveur.ip, `PHP ${h.php.versionDefaut}`],
    }))

  return (
    <CadreSection
      titre="Hébergements"
      base="/app/web/hebergement"
      entrees={entrees}
      placeholderRecherche="Rechercher un hébergement…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} hébergement${total > 1 ? 's' : ''}` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
