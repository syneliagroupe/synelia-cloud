'use client'

import { MESSAGERIES, messageriesDeLOrg, type MessagerieDomaine } from '@/lib/mock'
import type { Tone } from '@/components/ui/badge'
import { CadreSection } from '@/components/app/cadre-section'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'

/** Panneau de la section — liste les messageries de l'organisation. */
export function CadreEmails({ children }: { children: React.ReactNode }) {
  const collection = useCollection<MessagerieDomaine>('messageries', MESSAGERIES)
  const source = estActif() ? collection.items : messageriesDeLOrg()
  const entrees = source.map((m) => ({
    id: m.id,
    nom: m.domaine,
    sousTitre: m.actif
      ? `${m.boites.length}/${m.boitesIncluses} boîtes · ${m.palier}`
      : 'Messagerie non activée',
    etat: m.actif ? 'Active' : 'À activer',
    ton: (m.actif ? 'ok' : 'neutral') as Tone,
    href: `/app/web/emails/${m.id}`,
    motsCles: [m.solutionOSS, m.hoteWebmail],
  }))

  return (
    <CadreSection
      titre="Messageries"
      base="/app/web/emails"
      entrees={entrees}
      placeholderRecherche="Rechercher un domaine…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} domaine${total > 1 ? 's' : ''}` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
