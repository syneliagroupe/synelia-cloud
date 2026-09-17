'use client'

import { Plus } from 'lucide-react'
import { money, num, pct } from '@/lib/format'
import { estActif } from '@/lib/api/client'
import type { AgentIA } from '@/lib/types'
import { AGENTS_IA } from '@/lib/mock'
import { ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

export default function Agents() {
  const espace = useEspace()
  const { autorise, refus } = useApp()
  const agentsCol = useCollection<AgentIA>('agents-ia', AGENTS_IA)
  // Le backend ne rattache pas encore un agent à un Espace Cloud (MVP LiteLLM,
  // organisation seule) — même repli que l'accueil IA : en mode API, la liste
  // n'est filtrée que par statut.
  const agents = estActif()
    ? agentsCol.items
    : agentsCol.items.filter((a) => a.espaceId === espace.id)
  const publies = agents.filter((a) => a.statut === 'publie')
  // Conversations, coût quotidien et jeu d'épreuves n'existent que côté
  // maquette (`AgentIA` réel n'a que dix champs) : ces tuiles ne s'affichent
  // que tant que la démonstration fournit ces données.
  const demo = agents.some((a) => a.metriques)
  const conversations = agents.reduce((a, x) => a + (x.metriques?.conversations7j ?? 0), 0)
  const coutJour = agents.reduce((a, x) => a + (x.metriques?.coutJour ?? 0), 0)
  const sousLeSeuil = agents.filter((a) => a.epreuves && a.epreuves.reussis / a.epreuves.cas < 0.8)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Agents' },
        ]}
        titre="Agents"
        sousTitre="Un agent, c’est un rôle, une consigne, un modèle, des outils et des limites. Tout le reste — la mémoire, les reprises, la trace — est le travail de la plateforme. Choisissez-en un dans le panneau pour ouvrir sa fiche."
        actions={
          <GatedAction autorise={autorise('ia.agent.write')} message={refus('ia.agent.write')}>
            <ButtonLink href="/app/ia/nouveau">
              <Plus size={14} />
              Créer un agent
            </ButtonLink>
          </GatedAction>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          titre="Aucun agent sur cet espace"
          phrase="Un agent transforme un modèle générique en collaborateur borné : il connaît son périmètre, cite ses sources, appelle vos API et sait quand passer la main. Sans agent, il ne reste que la passerelle brute et un modèle qui ignore tout de votre métier."
          action={{ libelle: 'Créer un agent', href: '/app/ia/nouveau' }}
          actionSecondaire={{ libelle: 'Voir les intégrations disponibles', href: '/app/ia/integrations' }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              libelle="Agents publiés"
              valeur={publies.length}
              detail={`${agents.length - publies.length} en brouillon`}
              ton="ok"
            />
            {demo ? (
              <>
                <StatTile libelle="Échanges 7 jours" valeur={num(conversations)} />
                <StatTile
                  libelle="Coût quotidien"
                  valeur={money(coutJour)}
                  detail={`${money(coutJour * 30)} projetés sur 30 jours`}
                />
                <StatTile
                  libelle="Résolution sans humain"
                  valeur={pct(
                    publies.reduce((a, x) => a + (x.metriques?.tauxResolutionPct ?? 0), 0) /
                      Math.max(publies.length, 1),
                  )}
                  detail="Moyenne des agents publiés"
                  ton="ok"
                />
              </>
            ) : (
              <StatTile
                libelle="Modèles utilisés"
                valeur={new Set(agents.map((a) => a.modele)).size}
                detail="Distincts, tous statuts confondus"
              />
            )}
          </div>

          <EmptyState
            titre="Choisissez un agent"
            phrase="Le panneau de gauche liste les agents de cet Espace, les publiés d’abord. Sa fiche donne la consigne, les outils attribués, les garde-fous, l’historique des versions et la trace d’une exécution réelle."
          />

          {sousLeSeuil.length > 0 && (
            <Callout
              ton="warn"
              titre={`${sousLeSeuil.length} agent${sousLeSeuil.length > 1 ? 's' : ''} sous le seuil de publication`}
            >
              {sousLeSeuil.map((a) => a.nom).join(', ')} — moins de 80 % de réussite sur le jeu
              d’épreuves. La plateforme bloque la publication tant que ce seuil n’est pas franchi :
              ce n’est pas un avis, c’est une règle appliquée.
            </Callout>
          )}
        </>
      )}
    </div>
  )
}
