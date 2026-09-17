'use client'

import { AGENTS_IA } from '@/lib/mock'
import type { Tone } from '@/components/ui/badge'
import { TYPE_AGENT_LABEL, type AgentIA } from '@/lib/types'
import { estActif } from '@/lib/api/client'
import { CadreSection } from '@/components/app/cadre-section'
import { useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

/** Panneau de la section — les agents de l'Espace, publiés d'abord. */
export function CadreAgents({ children }: { children: React.ReactNode }) {
  const espace = useEspace()
  const agentsCol = useCollection<AgentIA>('agents-ia', AGENTS_IA)
  // Même repli que la liste et l'accueil IA : le backend ne rattache pas
  // encore un agent à un Espace Cloud.
  const agents = estActif()
    ? agentsCol.items
    : agentsCol.items.filter((a) => a.espaceId === espace.id)
  const entrees = agents
    // Les brouillons descendent en bas : on ouvre bien plus souvent un agent en
    // production qu'un agent dont les épreuves ne passent pas encore.
    .sort((a, b) => Number(b.statut === 'publie') - Number(a.statut === 'publie'))
    .map((a) => ({
      id: a.id,
      nom: a.nom,
      // `type`, `slug` et `role` n'existent que côté maquette : un agent réel
      // n'affiche que son modèle sous-jacent, sans faute de type au repli.
      sousTitre: a.type ? TYPE_AGENT_LABEL[a.type] : a.modele,
      etat: a.statut === 'publie' ? 'Publié' : a.statut === 'suspendu' ? 'Suspendu' : 'Brouillon',
      ton: (a.statut === 'publie' ? 'ok' : a.statut === 'suspendu' ? 'warn' : 'neutral') as Tone,
      href: `/app/ia/agents/${a.id}`,
      motsCles: [a.slug, a.role].filter((x): x is string => Boolean(x)),
    }))

  return (
    <CadreSection
      titre="Agents"
      base="/app/ia/agents"
      entrees={entrees}
      actionPrincipale={{ libelle: 'Créer un agent', href: '/app/ia/nouveau' }}
      placeholderRecherche="Rechercher un agent, un rôle…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} agent${total > 1 ? 's' : ''}` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
