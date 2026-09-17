'use client'

import { MODELES_IA } from '@/lib/mock'
import type { Tone } from '@/components/ui/badge'
import { FAMILLE_MODELE_LABEL, type ModeleIA } from '@/lib/types'
import { CadreSection } from '@/components/app/cadre-section'
import { useCollection } from '@/components/app/atelier'

const TON: Record<string, Tone> = {
  disponible: 'ok',
  apercu: 'info',
  degrade: 'warn',
  retire: 'neutral',
}

const ETAT: Record<string, string> = {
  disponible: 'Disponible',
  apercu: 'Aperçu',
  degrade: 'Dégradé',
  retire: 'Retiré',
}

/**
 * Panneau de la section — les modèles du catalogue, souverains d'abord.
 * L'ordre n'est pas neutre : c'est celui qu'on veut voir choisi par défaut.
 */
export function CadreModeles({ children }: { children: React.ReactNode }) {
  const modelesCol = useCollection<ModeleIA>('modeles-ia', MODELES_IA)
  const entrees = [...modelesCol.items]
    .sort((a, b) => Number(b.hebergement === 'souverain') - Number(a.hebergement === 'souverain'))
    .map((m) => ({
      id: m.id,
      nom: m.nom,
      sousTitre: `${m.editeur} · ${FAMILLE_MODELE_LABEL[m.famille]}`,
      etat: ETAT[m.statut],
      ton: TON[m.statut],
      href: `/app/ia/modeles/${m.id}`,
      motsCles: [m.slug, m.residence, m.hebergement === 'souverain' ? 'territoire' : 'externe'],
    }))

  return (
    <CadreSection
      titre="Modèles"
      base="/app/ia/modeles"
      entrees={entrees}
      placeholderRecherche="Rechercher un modèle, un éditeur…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} modèles` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
