'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Plus } from 'lucide-react'
import { num, pct, toHumain } from '@/lib/format'
import { ApiError, estActif } from '@/lib/api/client'
import type {
  Bucket,
  DRPlan,
  EspaceCloud,
  K8sCluster,
  LoadBalancer,
  ManagedDatabase,
  VM,
  Volume,
} from '@/lib/types'
import { SITE_COURT } from '@/lib/types'
import {
  BASES_MANAGEES,
  BUCKETS,
  DR_PLANS,
  ESPACES,
  K8S_CLUSTERS,
  LOAD_BALANCERS,
  ORG_COURANTE,
  VMS,
  VOLUMES,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { QuotaBar, StatTile } from '@/components/composition/metrics'
import { DegradedState } from '@/components/composition/states'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

/**
 * Accueil de l'univers Infrastructure.
 *
 * C'est la seule section sans le sélecteur d'Espace du panneau de gauche, et
 * c'est volontaire : elle regarde tout le parc à la fois, et sert précisément à
 * choisir dans quel Espace on va travailler ensuite. Toutes les autres sections
 * partent de ce choix.
 */
export default function AccueilInfrastructure() {
  const { espaceId, setEspaceId, autorise, refus } = useApp()
  const router = useRouter()
  // Espaces Cloud, machines, clusters, répartiteurs, volumes, bases et plans de
  // reprise ont chacun un vrai backend (`/espaces`, `/vms`, `/kubernetes`,
  // `/load-balancers`, `/volumes`, `/bases`, `/pra`) : `useCollection` en sert
  // les données réelles quand l'API est active, et retombe sur la graine sinon
  // — même mécanisme que `tableau-de-bord.tsx`.
  const espacesCol = useCollection<EspaceCloud>('espaces', ESPACES)
  const vmsCol = useCollection<VM>('vms', VMS)
  const clustersCol = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  const lbCol = useCollection<LoadBalancer>('load-balancers', LOAD_BALANCERS)
  const volumesCol = useCollection<Volume>('volumes', VOLUMES)
  const basesCol = useCollection<ManagedDatabase>('bases-managees', BASES_MANAGEES)
  const bucketsCol = useCollection<Bucket>('buckets', BUCKETS)
  const drPlansCol = useCollection<DRPlan>('plans-pra', DR_PLANS)

  // En mode API, le backend filtre déjà par organisation (et ses identifiants
  // sont inconnus du jeu local) : la maquette seule restreint au périmètre
  // fictif de la démonstration.
  const espaces = estActif()
    ? espacesCol.items
    : espacesCol.items.filter((e) => e.orgId === ORG_COURANTE.id)
  const vms = vmsCol.items
  const clusters = clustersCol.items
  const lb = lbCol.items
  const volumes = volumesCol.items
  const bases = basesCol.items
  const buckets = bucketsCol.items
  const drPlans = drPlansCol.items

  // Somme des quotas/usages réels des Espaces, pour la tuile de stockage :
  // `SYNTHESE_CLIENT` était un agrégat figé, faux dès la première création.
  const quotaStockageTo = Math.round(espaces.reduce((a, e) => a + e.quota.stockageTo, 0) * 10) / 10
  const usageStockageTo = Math.round(espaces.reduce((a, e) => a + e.usage.stockageTo, 0) * 10) / 10

  // `useCollection` retombe silencieusement sur la graine pour tout échec —
  // sauf le `424` (intégration amont muette), qu'il faut nommer plutôt que de
  // laisser les quotas et la liste « à surveiller » mentir avec des chiffres
  // qu'on ne sait plus dater. Le même motif que sur le tableau de bord client.
  const erreurEspaces = espacesCol.erreur
  const espacesDegrade =
    erreurEspaces instanceof ApiError && erreurEspaces.statut === 424
      ? { integration: erreurEspaces.integration, dateDonnees: erreurEspaces.dateDonnees }
      : null

  const ouvrir = (id: string) => {
    setEspaceId(id)
    router.push(`/app/espaces/${id}`)
  }

  // Ce qui demande une décision, rassemblé une fois : un quota qu'on va buter,
  // une machine qu'aucun plan ne sauvegarde, un plan de reprise jamais joué.
  const aSurveiller = [
    ...espaces
      .map((e) => ({
        e,
        ratio: Math.max(
          e.usage.vcpu / e.quota.vcpu,
          e.usage.ramGo / e.quota.ramGo,
          e.usage.stockageTo / e.quota.stockageTo,
        ),
      }))
      .filter(({ ratio }) => ratio >= 0.85)
      .map(({ e, ratio }) => ({
        quoi: `${e.code} — quota à ${pct(ratio * 100)}`,
        detail:
          'À ce niveau, une création de machine peut être refusée. L’extension s’applique à chaud.',
        href: `/app/espaces/${e.id}`,
      })),
    ...vms.filter((v) => !v.backupPlanId).map((v) => ({
      quoi: `${v.nom} — aucun plan de sauvegarde`,
      detail: 'La machine tourne, mais rien n’en garde de copie restaurable.',
      href: `/app/vms/${v.id}`,
    })),
    ...drPlans.filter((p) => p.exercices.length === 0).map((p) => ({
      quoi: `${p.nom} — jamais testé`,
      detail: 'Un plan de reprise qu’on n’a jamais joué est une intention, pas une garantie.',
      href: `/app/pra/${p.id}`,
    })),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Infrastructure' }]}
        titre="Infrastructure"
        sousTitre="Le parc entier, tous Espaces Cloud confondus. Les autres sections travaillent, elles, dans un seul Espace : celui que vous choisissez dans le panneau de gauche. C’est ici qu’on décide lequel."
        actions={
          <GatedAction autorise={autorise('espace.create')} message={refus('espace.create')}>
            <ButtonLink href="/app/espaces/new" iconBefore={<Plus size={14} />}>
              Créer un Espace Cloud
            </ButtonLink>
          </GatedAction>
        }
      />

      <Card>
        <CardHeader titre="Accès rapide" sousTitre="Créer une ressource dans l’Espace Cloud courant." />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/app/vms/new" iconBefore={<Plus size={13} />}>
            Nouvelle machine
          </ButtonLink>
          <ButtonLink href="/app/kubernetes/new" variant="secondary">
            Nouveau cluster
          </ButtonLink>
          <ButtonLink href="/app/stockage" variant="secondary">
            Nouveau volume
          </ButtonLink>
        </div>
      </Card>

      {aSurveiller.length > 0 && (
        <Callout
          ton="warn"
          titre={`${aSurveiller.length} point${aSurveiller.length > 1 ? 's' : ''} à surveiller`}
        >
          <ul className="mt-1 space-y-1.5">
            {aSurveiller.map((a) => (
              <li key={a.quoi} className="flex items-start gap-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />
                <span>
                  <Link href={a.href} className="font-semibold underline">
                    {a.quoi}
                  </Link>{' '}
                  — {a.detail}
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {espacesDegrade && (
        <DegradedState
          source="infrastructure"
          integration={espacesDegrade.integration}
          dateDonnees={espacesDegrade.dateDonnees}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Espaces Cloud"
          valeur={espaces.length}
          detail={`${new Set(espaces.map((e) => e.site)).size} site(s) physique(s)`}
        />
        <StatTile
          libelle="Machines virtuelles"
          valeur={vms.length}
          detail={`${vms.filter((v) => v.statut === 'running').length} en marche`}
        />
        <StatTile
          libelle="Clusters Kubernetes"
          valeur={clusters.length}
          detail={`${lb.length} répartiteur(s) de charge`}
        />
        <StatTile
          libelle="Stockage consommé"
          valeur={`${usageStockageTo}/${quotaStockageTo}`}
          unite="To"
          ton="warn"
          detail="Premier facteur limitant"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {espaces.map((e) => {
          const machines = vms.filter((v) => v.espaceId === e.id)
          const clustersEspace = clusters.filter((c) => c.espaceId === e.id)
          const repartiteurs = lb.filter((l) => l.espaceId === e.id)
          const volumesEspace = volumes.filter((v) => v.espaceId === e.id)
          const basesEspace = bases.filter((b) => b.espaceId === e.id)
          const courant = e.id === espaceId

          return (
            <Card key={e.id}>
              <CardHeader
                titre={e.code}
                sousTitre={`${e.offreNom} · ${SITE_COURT[e.site]} · ${e.cidr}`}
                actions={
                  courant ? (
                    <Badge tone="violet" size="sm">
                      Espace courant
                    </Badge>
                  ) : undefined
                }
              />

              <div className="mt-3 space-y-2">
                <QuotaBar libelle="vCPU" utilise={e.usage.vcpu} total={e.quota.vcpu} compact />
                <QuotaBar
                  libelle="Mémoire"
                  utilise={e.usage.ramGo}
                  total={e.quota.ramGo}
                  unite="Go"
                  formateur={(v) => num(v)}
                  compact
                />
                <QuotaBar
                  libelle="Stockage"
                  utilise={e.usage.stockageTo}
                  total={e.quota.stockageTo}
                  formateur={toHumain}
                  compact
                />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-g-100 pt-3 text-[12px]">
                {[
                  ['Machines', machines.length],
                  ['Clusters', clustersEspace.length],
                  ['Répartiteurs', repartiteurs.length],
                  ['Volumes', volumesEspace.length],
                  ['Bases managées', basesEspace.length],
                  ['Projets', e.projets],
                ].map(([libelle, valeur]) => (
                  <div key={libelle} className="flex items-baseline justify-between gap-2">
                    <dt className="text-g-500">{libelle}</dt>
                    <dd className="tnum font-semibold text-ink">{valeur}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3">
                <Button
                  variant={courant ? 'secondary' : 'primary'}
                  onClick={() => ouvrir(e.id)}
                  iconAfter={<ArrowRight size={14} />}
                  fullWidth
                >
                  {courant ? 'Ouvrir la fiche' : 'Travailler dans cet Espace'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre="Protection des données"
            sousTitre="Ce que la section Sauvegardes & PRA détaille plan par plan."
          />
          <dl className="mt-3 space-y-1.5 text-[13px]">
            {[
              ['Machines sans plan de sauvegarde', vms.filter((v) => !v.backupPlanId).length],
              ['Plans de reprise', drPlans.length],
              ['Plans jamais testés', drPlans.filter((p) => p.exercices.length === 0).length],
              ['Compartiments S3 verrouillés (WORM)', buckets.filter((b) => b.objectLock?.actif).length],
            ].map(([libelle, valeur]) => (
              <div key={libelle} className="flex items-baseline justify-between gap-2">
                <dt className="text-g-500">{libelle}</dt>
                <dd className="tnum font-semibold text-ink">{valeur}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/app/sauvegarde"
            className="mt-3 inline-block text-[13px] font-semibold text-p-700 hover:underline"
          >
            Sauvegardes &amp; PRA →
          </Link>
        </Card>

        <Callout ton="violet" titre="Le choix d’Espace vaut pour toutes les sections">
          Une machine, un cluster, un répartiteur, un volume appartiennent à un Espace Cloud : son
          quota, sa plage réseau, son site. Cet accueil est la seule vue qui les traverse tous.
        </Callout>
      </div>
    </div>
  )
}
