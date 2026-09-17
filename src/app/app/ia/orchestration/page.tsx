'use client'

import { money, num, pct } from '@/lib/format'
import { estActif } from '@/lib/api/client'
import { FLUX_ORCHESTRATION } from '@/lib/mock'
import type { FluxOrchestration } from '@/lib/types'
import { Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

export default function Orchestration() {
  const espace = useEspace()
  const fluxCol = useCollection<FluxOrchestration>('flux-ia', FLUX_ORCHESTRATION)
  // Le backend ne rattache pas encore un flux à un Espace Cloud à la création
  // (`FluxOrchestrationCreation.espaceId` optionnel, `""` par défaut — même
  // repli que les agents) : en mode API, la liste n'est pas filtrée par
  // Espace, sous peine de masquer tous les flux réels.
  //
  // L'exécuteur natif est réel (FONC-02), mais un flux créé via l'API ne porte
  // pas encore de métriques agrégées (`executions7j`…) : le backend les laisse
  // à `null`, absentes de la réponse JSON. On les ramène à 0 une bonne fois
  // ici plutôt que de garder `?? 0` à chaque lecture plus bas.
  const flux = fluxCol.items
    .filter((f) => (estActif() ? true : f.espaceId === espace.id))
    .map((f) => ({
      ...f,
      executions7j: f.executions7j ?? 0,
      dureeMedianeS: f.dureeMedianeS ?? 0,
      tauxSuccesPct: f.tauxSuccesPct ?? 0,
      coutParExecution: f.coutParExecution ?? 0,
    }))
  const publies = flux.filter((f) => f.statut === 'publie')
  const executions = flux.reduce((a, f) => a + f.executions7j, 0)
  const cout = flux.reduce((a, f) => a + f.coutParExecution * f.executions7j, 0)
  const succes =
    publies.reduce((a, f) => a + f.tauxSuccesPct, 0) / Math.max(publies.length, 1)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Orchestration' },
        ]}
        titre="Orchestration"
        sousTitre="Un agent seul traite une intention. Un flux en enchaîne plusieurs : il anonymise, classe, aiguille, boucle, reprend ce qui a échoué et s’arrête devant un humain quand l’enjeu le demande. Choisissez un flux dans le panneau pour ouvrir son studio."
      />

      {flux.length === 0 ? (
        <EmptyState
          titre="Aucun flux sur cet espace"
          phrase="Un flux coordonne plusieurs agents autour d’un parcours : classer, instruire, synthétiser, faire valider. Tant qu’il n’en existe pas, chaque agent travaille seul et rien ne se passe le relais."
          actionSecondaire={{ libelle: 'Voir les agents', href: '/app/ia/agents' }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              libelle="Flux publiés"
              valeur={publies.length}
              detail={`${flux.length - publies.length} en brouillon`}
              ton="ok"
            />
            <StatTile libelle="Exécutions 7 jours" valeur={num(executions)} />
            <StatTile
              libelle="Taux de succès moyen"
              valeur={pct(succes, 1)}
              ton={succes > 90 ? 'ok' : 'warn'}
              detail="Flux publiés seulement"
            />
            <StatTile
              libelle="Coût sur 7 jours"
              valeur={money(cout)}
              detail="Toutes exécutions confondues"
            />
          </div>

          <EmptyState
            titre="Choisissez un flux"
            phrase="Le panneau de gauche liste les flux de cet Espace. Le studio les montre de haut en bas, avec sur chaque étape ce qu’elle dure, ce qu’elle coûte et ce qu’elle rate."
          />

          <Callout ton="violet" titre="Deux étapes figurent dans tous les flux">
            L’anonymisation, en coupure avant tout appel modèle, et le filtrage par habilitation,
            appliqué avant tout calcul de similarité. Elles sont posées par la plateforme : ni
            déplaçables, ni supprimables. Faire dépendre l’étanchéité d’un réglage reviendrait à ne
            pas l’avoir.
          </Callout>
        </>
      )}
    </div>
  )
}
