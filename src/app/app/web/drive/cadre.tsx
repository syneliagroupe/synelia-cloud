'use client'

import { DRIVES, drivesDeLOrg } from '@/lib/mock'
import type { Tone } from '@/components/ui/badge'
import { CadreSection } from '@/components/app/cadre-section'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'
import type { DriveDomaine } from '@/lib/mock'

/** Panneau de la section — liste les drives de l'organisation. */
export function CadreDrive({ children }: { children: React.ReactNode }) {
  const collection = useCollection<DriveDomaine>('drives', DRIVES)
  const source = estActif() ? collection.items : drivesDeLOrg()
  const entrees = source.map((d) => ({
    id: d.id,
    nom: d.domaine,
    sousTitre: d.actif
      ? `${d.sieges.attribues}/${d.sieges.souscrits} sièges · ${d.palier}`
      : 'Drive non activé',
    etat: d.actif ? 'Actif' : 'À activer',
    ton: (d.actif ? 'ok' : 'neutral') as Tone,
    href: `/app/web/drive/${d.id}`,
    motsCles: [d.solutionOSS, d.hote],
  }))

  return (
    <CadreSection
      titre="Drives"
      base="/app/web/drive"
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
