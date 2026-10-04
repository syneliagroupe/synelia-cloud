'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import {
  ArrowRight,
  Box,
  Cloud,
  Database,
  HardDrive,
  Layers,
  Plus,
  Server,
  Shield,
} from 'lucide-react'
import { num, toHumain } from '@/lib/format'
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
import { DegradedState, EmptyState } from '@/components/composition/states'
import { useApp, useEspace } from '@/components/app/contexte'
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
  const { setEspaceId, autorise, refus } = useApp()
  const espaceCourant = useEspace()
  const router = useRouter()
  const parcRef = useRef<HTMLDivElement>(null)
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
  const usageStockageTo = Math.round(espaces.reduce((a, e) => a + e.usage.stockageTo, 0) * 1000) / 1000

  // `useCollection` retombe silencieusement sur la graine pour tout échec —
  // sauf le `424` (intégration amont muette), qu'il faut nommer plutôt que de
  // laisser les quotas mentir avec des chiffres
  // qu'on ne sait plus dater. Le même motif que sur le tableau de bord client.
  const erreurEspaces = espacesCol.erreur
  const espacesDegrade =
    erreurEspaces instanceof ApiError && erreurEspaces.statut === 424
      ? { integration: erreurEspaces.integration, dateDonnees: erreurEspaces.dateDonnees }
      : null

  // `espaceId` du contexte peut être l'Espace par défaut de la maquette au premier
  // passage en mode API : `espaceCourant` est celui que les sections utiliseront.
  const espaceValide = espaces.some((e) => e.id === espaceCourant.id)

  const ouvrir = (id: string) => {
    setEspaceId(id)
    router.push(`/app/espaces/${id}`)
  }

  const defilerParc = () => parcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const commander = [
    {
      libelle: 'Machine virtuelle',
      href: '/app/vms/new',
      icone: Server,
      permission: 'vm.create_delete' as const,
    },
    {
      libelle: 'Cluster Kubernetes',
      href: '/app/kubernetes/new',
      icone: Layers,
      permission: 'espace.create' as const,
    },
    {
      libelle: 'Volume bloc',
      href: '/app/stockage',
      icone: HardDrive,
      permission: 'network.manage' as const,
    },
    {
      libelle: 'Bucket S3',
      href: '/app/objet',
      icone: Box,
      permission: 'network.manage' as const,
    },
    {
      libelle: 'Base managée',
      href: '/app/bases',
      icone: Database,
      permission: 'network.manage' as const,
    },
    {
      libelle: 'Load balancer',
      href: '/app/reseau/lb',
      icone: Cloud,
      permission: 'lb.create' as const,
    },
    {
      libelle: 'Plan de sauvegarde',
      href: '/app/sauvegarde',
      icone: Shield,
      permission: 'backup.plan.write' as const,
    },
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

      {espaces.length === 0 ? (
        <EmptyState
          titre="Aucun Espace Cloud"
          phrase="Toute ressource d’infrastructure vit dans un Espace Cloud : quotas, réseau, site. Commencez par en créer un, puis les sections Machines, Réseau et Stockage s’activent dans son contexte."
          action={{ libelle: 'Créer un Espace Cloud', href: '/app/espaces/new' }}
        />
      ) : (
        <>
          <Callout ton="info" titre="Contexte pour les commandes">
            Les créations ci-dessous s’appliquent à l’Espace{' '}
            <Link href={`/app/espaces/${espaceCourant.id}`} className="font-semibold underline">
              {espaceCourant.code}
            </Link>
            {espaceValide ? (
              <>
                {' '}
                — le même que vous retrouverez dans le panneau de gauche dès que vous ouvrez une
                section (Machines, Réseau…).
              </>
            ) : (
              <>
                {' '}
                (sélection mémorisée) ne figure plus dans votre parc.{' '}
                <button type="button" onClick={defilerParc} className="font-semibold underline">
                  Choisissez un Espace ci-dessous
                </button>{' '}
                avant de commander.
              </>
            )}
          </Callout>

          <Card>
            <CardHeader
              titre="Commander"
              sousTitre={
                espaceValide
                  ? `Raccourcis de création dans ${espaceCourant.code}. Les listes détaillées restent dans chaque section.`
                  : 'Choisissez d’abord un Espace dans le parc ci-dessous — les commandes sont désactivées tant que le contexte n’est pas valide.'
              }
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {commander.map(({ libelle, href, icone: Icone, permission }) => (
                <GatedAction key={href} autorise={autorise(permission)} message={refus(permission)}>
                  {espaceValide ? (
                    <ButtonLink
                      href={href}
                      variant="secondary"
                      fullWidth
                      iconBefore={<Icone size={14} />}
                      className="justify-start"
                    >
                      {libelle}
                    </ButtonLink>
                  ) : (
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled
                      iconBefore={<Icone size={14} />}
                      className="justify-start"
                    >
                      {libelle}
                    </Button>
                  )}
                </GatedAction>
              ))}
            </div>
          </Card>
        </>
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
          detail={`${lb.length} load balancer(s)`}
        />
        <StatTile
          libelle="Stockage consommé"
          valeur={toHumain(usageStockageTo)}
          ton={quotaStockageTo > 0 && usageStockageTo / quotaStockageTo >= 0.85 ? 'warn' : 'ok'}
          detail={`sur ${toHumain(quotaStockageTo)} souscrits`}
        />
      </div>

      <div ref={parcRef} id="parc-espaces" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {espaces.map((e) => {
          const machines = vms.filter((v) => v.espaceId === e.id)
          const clustersEspace = clusters.filter((c) => c.espaceId === e.id)
          const repartiteurs = lb.filter((l) => l.espaceId === e.id)
          const volumesEspace = volumes.filter((v) => v.espaceId === e.id)
          const basesEspace = bases.filter((b) => b.espaceId === e.id)
          const courant = e.id === espaceCourant.id

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
                  ['Load balancers', repartiteurs.length],
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
          Une machine, un cluster, un load balancer, un volume appartiennent à un Espace Cloud : son
          quota, sa plage réseau, son site. Cet accueil est la seule vue qui les traverse tous.
        </Callout>
      </div>
    </div>
  )
}
