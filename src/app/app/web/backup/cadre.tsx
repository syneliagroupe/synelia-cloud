'use client'

import { SAUVEGARDES_WEB, sauvegardesWebDeLOrg, type SauvegardeWeb } from '@/lib/mock'
import type { Tone } from '@/components/ui/badge'
import { CadreSection } from '@/components/app/cadre-section'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'

/** Panneau de la section — liste les sauvegardes de l'organisation. */
export function CadreBackup({ children }: { children: React.ReactNode }) {
  const collection = useCollection<SauvegardeWeb>('sauvegardes-web', SAUVEGARDES_WEB)
  const source = estActif() ? collection.items : sauvegardesWebDeLOrg()
  const entrees = source.map((s) => {
    const dernier = s.executions[0]
    return {
      id: s.id,
      nom: s.nomServi,
      sousTitre: `${s.serveur} · ${s.frequence} à ${s.heure}`,
      etat: dernier?.statut === 'ok' ? 'OK' : dernier?.statut === 'partielle' ? 'Partielle' : 'Échec',
      ton: (dernier?.statut === 'ok' ? 'ok' : dernier?.statut === 'partielle' ? 'warn' : 'err') as Tone,
      href: `/app/web/backup/${s.id}`,
      motsCles: [s.destination, s.serveur],
    }
  })

  return (
    <CadreSection
      titre="Sauvegardes"
      base="/app/web/backup"
      entrees={entrees}
      placeholderRecherche="Rechercher un plan…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} plan${total > 1 ? 's' : ''}` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
