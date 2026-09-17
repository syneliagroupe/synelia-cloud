'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { relatif } from '@/lib/format'
import type { Projet, ServiceProjet } from '@/lib/types'
import {
  ANOMALIES,
  EVENEMENTS_SUPERVISION,
  LOGS_BUILD,
  LOGS_EXECUTION,
  PROJETS,
  SERVICES_PROJET,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import {
  EventList,
  GrilleSparkCharts,
  LiensSortie,
  LogPeek,
} from '@/components/business/observabilite'
import { AnomalieCard } from '@/components/business/paas'
import { useCollection } from '@/components/app/atelier'
import { useServicesProjet } from '@/lib/api/services-projet'
import { EnteteProjet, StatutServiceBadge, couleurStatut, ProjetIntrouvable } from '@/components/business/projets'
import { useMaintenant } from '@/components/app/contexte'

/**
 * Observabilité d'un projet — les quatre formats autorisés, et rien de plus.
 *
 * Pas de constructeur de requêtes, pas d'explorateur de traces, pas de tableau
 * de bord à composer : ces écrans existent déjà dans Grafana, Centreon et
 * VictoriaLogs, et les refaire ici donnerait une copie tiède de chacun. Le
 * portail répond à « est-ce que ça va, et depuis quand ? » puis ouvre la porte.
 */
export function VueObservabilite({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)

  const projet = lesProjets.items.find((p) => p.id === id)
  // Avec l’API, la liste vient de `GET /projets/{id}/services` (route nichée,
  // hors registre) ; en maquette, du filtre local.
  const { distants: servicesDistants } = useServicesProjet(id)
  const services = useMemo(
    () => servicesDistants ?? lesServices.items.filter((x) => x.projetId === id),
    [servicesDistants, lesServices.items, id],
  )

  const [env, setEnv] = useState(projet?.environnements[0] ?? '')

  if (!projet) return <ProjetIntrouvable section="Observabilité" />

  const servicesEnv = services.filter((s) => s.environnement === env)
  const enEchec = servicesEnv.filter((s) => s.statut === 'failed')
  const degrades = servicesEnv.filter((s) => s.statut === 'degraded')
  const enMarche = servicesEnv.filter((s) => s.statut === 'running')

  // Les événements et les anomalies de la plateforme désignent les services par
  // leur nom : on ne garde que ceux qui parlent de ce projet.
  const noms = new Set(servicesEnv.map((s) => s.nom))
  const evenements = EVENEMENTS_SUPERVISION.filter((e) =>
    [...noms].some((n) => e.ressource.includes(n)),
  )
  const anomalies = ANOMALIES.filter((a) =>
    servicesEnv.some((s) => s.appId === a.appId && s.environnement === a.envNom),
  )

  // Un service en échec de construction n'a pas de journal d'exécution : c'est
  // son journal de build qui porte la cause.
  const journalDeBuild = enEchec.length > 0

  return (
    <div className="space-y-5">
      <EnteteProjet
        projet={projet}
        section="Observabilité"
        titre="Observabilité"
        sousTitre="L’état de ce projet en un écran : ce qui tourne, ce qui sort de ses seuils, et les vingt dernières lignes de journal. L’analyse fine reste dans les outils qui la font bien."
        meta={
          <>
            <Badge tone={enEchec.length > 0 ? 'err' : degrades.length > 0 ? 'warn' : 'ok'} dot>
              {enEchec.length > 0
                ? `${enEchec.length} en échec`
                : degrades.length > 0
                  ? `${degrades.length} dégradé${degrades.length > 1 ? 's' : ''}`
                  : 'Tout est dans ses seuils'}
            </Badge>
            <Badge tone="neutral">
              {enMarche.length} sur {servicesEnv.length} en marche
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {projet.environnements.map((e) => {
            const compte = services.filter((s) => s.environnement === e).length
            return (
              <button
                key={e}
                type="button"
                onClick={() => setEnv(e)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                  e === env
                    ? 'border-p-700 bg-p-700 text-white'
                    : 'border-g-300 text-g-700 hover:border-p-400 hover:bg-p-050',
                )}
              >
                {e}
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 text-[11px]',
                    e === env ? 'bg-white/20' : 'bg-g-100 text-g-700',
                  )}
                >
                  {compte}
                </span>
              </button>
            )
          })}
        </div>
        <span className="text-[12px] text-g-500">
          Les seuils et les canaux d’alerte se règlent dans{' '}
          <Link href="/app/observabilite" className="font-semibold text-p-700 hover:underline">
            Supervision
          </Link>
          , pour toute l’organisation.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Services en marche"
          valeur={enMarche.length}
          detail={`sur ${servicesEnv.length} en ${env.toLowerCase()}`}
          ton={enEchec.length > 0 ? 'err' : degrades.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Processeur réservé"
          valeur={servicesEnv.reduce((a, s) => a + s.ressources.cpu, 0)}
          unite="vCPU"
          detail="somme des services"
        />
        <StatTile
          libelle="Mémoire réservée"
          valeur={(servicesEnv.reduce((a, s) => a + s.ressources.ramMo, 0) / 1024).toFixed(0)}
          unite="Gio"
          detail="somme des services"
        />
        <StatTile
          libelle="Événements ouverts"
          valeur={evenements.length}
          ton={evenements.some((e) => e.gravite === 'critique') ? 'err' : 'neutral'}
          detail="sur ce projet"
        />
      </div>

      {anomalies.length > 0 && (
        <div className="space-y-3">
          <p className="type-micro text-g-500">Ce que la plateforme a déjà diagnostiqué</p>
          {anomalies.map((a) => (
            <AnomalieCard key={a.id} anomalie={a} />
          ))}
        </div>
      )}

      <GrilleSparkCharts
        seed={`${projet.id}-${env}`}
        metriques={[
          { titre: 'Processeur', unite: '%', min: 14, max: 68, seuil: 85 },
          { titre: 'Mémoire', unite: '%', min: 38, max: 82, seuil: 90 },
          {
            titre: 'Requêtes',
            unite: 'req/s',
            min: 40,
            max: 340,
            couleur: 'var(--color-m-600)',
          },
          { titre: 'Latence P95', unite: 'ms', min: 48, max: 210, seuil: 200 },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            titre="Services de cet environnement"
            sousTitre="L’emplacement réel est affiché : on ne demande pas de faire confiance à vide."
          />
          {servicesEnv.length === 0 ? (
            <p className="text-[13px] text-g-700">
              Aucun service en {env.toLowerCase()}. Un environnement vide ne facture rien et n’émet
              aucune métrique.
            </p>
          ) : (
            <ul className="divide-y divide-g-100">
              {servicesEnv.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                  <span className="min-w-0">
                    <Link
                      href={`/app/applications/projets/${projet.id}/${s.id}`}
                      className={cn(
                        'block truncate font-mono text-[13px] font-semibold hover:text-p-700',
                        couleurStatut(s.statut),
                      )}
                    >
                      {s.nom}
                    </Link>
                    <span className="block truncate text-[11px] text-g-500">
                      {s.emplacement.site} · {s.emplacement.backend}
                      {s.emplacement.namespace && ` · ${s.emplacement.namespace}`} · maj{' '}
                      {relatif(s.derniereMaj, maintenant)}
                    </span>
                  </span>
                  <StatutServiceBadge statut={s.statut} />
                </li>
              ))}
            </ul>
          )}
          <LiensSortie className="mt-4" logs={false} />
        </Card>

        <Card>
          <CardHeader
            titre="Événements"
            sousTitre="Les huit derniers signaux qui concernent ce projet. L’historique complet est dans Centreon."
          />
          {evenements.length === 0 ? (
            <p className="text-[13px] text-g-700">
              Aucun événement sur ce projet. Une supervision silencieuse est le résultat attendu,
              pas une panne de la supervision — la dernière collecte date de moins d’une minute.
            </p>
          ) : (
            <EventList evenements={evenements} />
          )}
        </Card>
      </div>

      <Card>
        <LogPeek
          titre={journalDeBuild ? 'Journal de construction' : 'Journal d’exécution'}
          lignes={journalDeBuild ? LOGS_BUILD : LOGS_EXECUTION}
        />
        <Callout ton="info" className="mt-4" titre="Vingt lignes, pas un explorateur">
          Cet aperçu sert à confirmer une intuition, pas à mener l’enquête : ni recherche par
          champ, ni corrélation, ni fenêtre glissante. Dès que la question devient sérieuse, elle
          se pose dans VictoriaLogs, qui garde l’intégralité du flux.
        </Callout>
      </Card>
    </div>
  )
}
