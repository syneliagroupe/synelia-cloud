'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { num } from '@/lib/format'
import { SITE_COURT, type K8sCluster } from '@/lib/types'
import { K8S_CLUSTERS } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Callout } from '@/components/composition/card'
import { HealthBadge, StatTile } from '@/components/composition/metrics'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

export default function ListeClusters() {
  const espace = useEspace()
  const { autorise, refus } = useApp()
  const grappes = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  const clusters = grappes.items.filter((c) => c.espaceId === espace.id)
  const tous = grappes.items

  const colonnes: Array<Colonne<K8sCluster>> = [
    {
      id: 'nom',
      entete: 'Cluster',
      cle: (c) => c.nom,
      rendu: (c) => (
        <span className="block">
          <span className="block font-mono text-[13px] font-semibold text-ink">{c.nom}</span>
          <span className="block text-[11px] text-g-500">
            {c.applicationId ? `rattaché à ${c.applicationId}` : 'autonome'}
          </span>
        </span>
      ),
    },
    {
      id: 'version',
      entete: 'Version',
      cle: (c) => c.version,
      rendu: (c) => <span className="font-mono text-[12px]">{c.version}</span>,
    },
    {
      id: 'controlplane',
      entete: 'Control plane',
      cle: (c) => c.controlPlane.mode,
      rendu: (c) => (
        <Badge tone={c.controlPlane.mode === 'ha' ? 'ok' : 'neutral'} size="sm">
          {c.controlPlane.mode === 'ha'
            ? `HA · ${c.controlPlane.nodes} masters`
            : 'Mono-master'}
        </Badge>
      ),
    },
    {
      id: 'noeuds',
      entete: 'Nœuds',
      aligne: 'right',
      cle: (c) => c.pools.reduce((a, p) => a + p.nodes, 0),
      rendu: (c) => c.pools.reduce((a, p) => a + p.nodes, 0),
    },
    {
      id: 'pools',
      entete: 'Pools',
      cle: (c) => c.pools.length,
      rendu: (c) => (
        <span className="flex flex-wrap gap-1">
          {c.pools.map((p) => (
            <Badge
              key={p.nom}
              tone={
                p.type === 'gpu'
                  ? 'accent'
                  : p.type === 'preemptible'
                    ? 'warn'
                    : p.type === 'memory'
                      ? 'violet'
                      : 'neutral'
              }
              size="sm"
            >
              {p.nom} · {p.nodes}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: 'modules',
      entete: 'Modules',
      aligne: 'right',
      cle: (c) => c.modules.length,
      rendu: (c) => c.modules.length,
      masquable: true,
    },
    {
      id: 'site',
      entete: 'Site',
      cle: (c) => c.site,
      rendu: (c) => (
        <span className="text-[12px]">
          <span className="font-semibold text-ink">{c.site}</span>
          <span className="block text-[11px] text-g-500">{SITE_COURT[c.site]}</span>
        </span>
      ),
    },
    {
      id: 'statut',
      entete: 'État',
      cle: (c) => c.statut,
      rendu: (c) => <HealthBadge etat={c.statut} size="sm" />,
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (c) => (
        <Link
          href={`/app/kubernetes/${c.id}`}
          className="text-[12px] font-semibold text-p-700 hover:underline"
        >
          Ouvrir →
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace.code, href: `/app/espaces/${espace.id}` },
          { label: 'Kubernetes' },
        ]}
        titre="Kubernetes managé"
        sousTitre="Nous exploitons le control plane et pilotons les montées de version. Vous gardez l’accès complet à l’API Kubernetes, vos manifestes et vos charts Helm — nous ne dictons pas ce que vous déployez."
        actions={
          <GatedAction autorise={autorise('espace.create')} message={refus('espace.create')}>
            <ButtonLink href="/app/kubernetes/new" iconBefore={<Plus size={14} />}>
              Créer un cluster
            </ButtonLink>
          </GatedAction>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile libelle="Clusters" valeur={tous.length} detail={`${clusters.length} dans ${espace.code}`} />
        <StatTile
          libelle="Nœuds workers"
          valeur={tous.reduce((a, c) => a + c.pools.reduce((b, p) => b + p.nodes, 0), 0)}
        />
        <StatTile
          libelle="Control planes HA"
          valeur={tous.filter((c) => c.controlPlane.mode === 'ha').length}
          ton="ok"
          detail={`${tous.filter((c) => c.controlPlane.mode === 'single').length} mono-master`}
        />
        <StatTile
          libelle="Pools avec autoscaling"
          valeur={tous.reduce((a, c) => a + c.pools.filter((p) => p.autoscale).length, 0)}
        />
      </div>

      <DataTable
        lignes={tous}
        colonnes={colonnes}
        placeholderRecherche="Rechercher un cluster…"
        filtres={[
          {
            id: 'site',
            libelle: 'Site',
            options: [
              { value: 'ABJ', label: 'Abidjan' },
              { value: 'GBM', label: 'Grand-Bassam' },
            ],
          },
          {
            id: 'mode',
            libelle: 'Control plane',
            options: [
              { value: 'ha', label: 'Haute disponibilité' },
              { value: 'single', label: 'Mono-master' },
            ],
          },
        ]}
        selection={(c, id, v) => (id === 'site' ? c.site === v : c.controlPlane.mode === v)}
        href={(c) => `/app/kubernetes/${c.id}`}
        vide={{
          titre: 'Aucun cluster Kubernetes',
          phrase:
            'Un cluster managé consomme le quota vCPU et mémoire de votre Espace Cloud pour ses nœuds workers ; le control plane est facturé à part et exploité par nos équipes.',
          action: { libelle: 'Créer un cluster', href: '/app/kubernetes/new' },
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="violet" titre="Mono-master ou haute disponibilité">
          Un control plane mono-master coûte trois fois moins cher, et une indisponibilité de l’API
          pendant une maintenance n’arrête pas les pods déjà en cours d’exécution. En production, la
          haute
          disponibilité devient nécessaire dès lors que vous dépendez de l’API pour l’autoscaling,
          les déploiements automatiques ou les sondes d’un opérateur.
        </Callout>
        <Callout ton="info" titre="Nœuds préemptibles : 60 % moins cher, 30 secondes de préavis">
          Un nœud préemptible peut être récupéré par la plateforme avec un préavis de trente
          secondes. C’est parfaitement adapté aux traitements par lots, aux jobs CI et aux workers de
          file — et à éviter pour un service synchrone. Le pool <span className="font-mono text-[12px]">pool-spot</span>{' '}
          du cluster de production illustre cet usage, avec un autoscaling de 0 à 8 nœuds.
        </Callout>
      </div>
    </div>
  )
}
