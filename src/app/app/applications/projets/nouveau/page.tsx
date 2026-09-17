'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MAINTENANT, money } from '@/lib/format'
import { ESPACES, K8S_CLUSTERS, LOAD_BALANCERS, PROJETS, ZONE_APPLICATIVE } from '@/lib/mock'
import type { K8sCluster, LoadBalancer, Projet } from '@/lib/types'
import { MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea, TagsInput } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { CostPreview, WizardShell } from '@/components/composition/flow'
import { useApp, useEspace } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'

const ETAPES = [
  { numero: 1, titre: 'Projet' },
  { numero: 2, titre: 'Infrastructure' },
  { numero: 3, titre: 'Récapitulatif' },
]

/** Trois tailles suffisent au départ — ajustables ensuite depuis Kubernetes. */
const TAILLES_CLUSTER = [
  { id: 'petit', label: 'Petit', detail: '3 nœuds · 4 vCPU · 8 Go', flavor: '4 vCPU · 8 Go', nodes: 3, prixNoeud: 7800 },
  { id: 'moyen', label: 'Moyen', detail: '3 nœuds · 8 vCPU · 16 Go', flavor: '8 vCPU · 16 Go', nodes: 3, prixNoeud: 15600 },
  { id: 'grand', label: 'Grand', detail: '5 nœuds · 8 vCPU · 32 Go', flavor: '8 vCPU · 32 Go', nodes: 5, prixNoeud: 24800 },
] as const

export default function NouveauProjet() {
  const router = useRouter()
  const { pousser } = useApp()
  const espaceCourant = useEspace()
  const projets = useCollection<Projet>('projets', PROJETS)
  const grappes = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  const lesLb = useCollection<LoadBalancer>('load-balancers', LOAD_BALANCERS)
  const { lancerJob } = useAtelier()

  const [etape, setEtape] = useState(1)
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [espaceId, setEspaceId] = useState(espaceCourant.id)
  const [modeCluster, setModeCluster] = useState<'nouveau' | 'existant'>('nouveau')
  const [tailleId, setTailleId] = useState<(typeof TAILLES_CLUSTER)[number]['id']>('moyen')
  const [clusterExistantId, setClusterExistantId] = useState('')
  const [conditions, setConditions] = useState(false)

  const espace = ESPACES.find((e) => e.id === espaceId) ?? espaceCourant
  const clustersDisponibles = grappes.items.filter((c) => c.espaceId === espace.id)
  const modeClusterEffectif = clustersDisponibles.length === 0 ? 'nouveau' : modeCluster
  const clusterExistantEffectif =
    clusterExistantId && clustersDisponibles.some((c) => c.id === clusterExistantId)
      ? clusterExistantId
      : (clustersDisponibles[0]?.id ?? '')
  const taille = TAILLES_CLUSTER.find((t) => t.id === tailleId)!

  const lignesCout = [
    ...(modeClusterEffectif === 'nouveau'
      ? [
          {
            libelle: 'Control plane haute disponibilité',
            detail: '3 masters répartis · SLA 99,95 %',
            montant: 42000,
          },
          {
            libelle: `Nœuds workers · ${taille.nodes} nœuds`,
            detail: taille.detail,
            montant: taille.nodes * taille.prixNoeud,
          },
        ]
      : [{ libelle: 'Cluster existant', detail: 'Aucun coût additionnel de cluster', montant: 0 }]),
    {
      libelle: 'Load balancer L7 dédié',
      detail: 'Provisionné automatiquement — porte d’entrée du projet',
      montant: 18000,
    },
  ]

  const peutContinuer =
    etape === 1 ? nom.trim().length > 0 : etape === 3 ? conditions : true

  const creerLeProjet = () => {
    const idProjet = projets.identifiant('prj')
    let clusterId = clusterExistantEffectif

    if (modeClusterEffectif === 'nouveau') {
      const cluster: K8sCluster = {
        id: grappes.identifiant('k8s'),
        espaceId: espace.id,
        nom: `${nom.trim()}-k8s`,
        version: '1.31.2',
        controlPlane: { mode: 'ha', nodes: 3 },
        pools: [
          { nom: 'pool-defaut', nodes: taille.nodes, flavor: taille.flavor, diskGo: 100, type: 'standard' },
        ],
        modules: ['ingress-nginx 4.11.2', 'cert-manager 1.15.3', 'velero 1.14.1'],
        statut: 'provisioning',
        site: espace.site,
      }
      grappes.creer(cluster)
      clusterId = cluster.id
      lancerJob({
        workflow: 'k8s.create',
        cible: `${cluster.nom} · ${espace.site}`,
        alFin: () => grappes.modifier(cluster.id, { statut: 'running' }),
      })
    }

    const lb: LoadBalancer = {
      id: lesLb.identifiant('lb'),
      espaceId: espace.id,
      nom: `${nom.trim()}-lb`,
      layer: 'l7',
      exposure: 'public',
      vip: `102.176.${espace.site === 'ABJ' ? 20 : 44}.${190 + lesLb.items.length}`,
      algo: 'round_robin',
      listeners: [
        { protocole: 'HTTPS', port: 443, certId: 'cert-auto', tlsMin: 'TLS 1.2' },
        { protocole: 'HTTP', port: 80 },
      ],
      pool: [{ targetId: `${clusterId}/ingress`, targetLabel: 'k8s · ingress-nginx', poids: 100, sante: 'drain' }],
      healthCheck: { protocole: 'HTTP', chemin: '/healthz', codeAttendu: 200, intervalleS: 10, seuilKo: 3, seuilOk: 2 },
      metriques: { rps: 0, p50: 0, p95: 0, p99: 0, taux4xx: 0, taux5xx: 0, connexions: 0 },
    }
    lesLb.creer(lb)
    lancerJob({
      workflow: 'lb.create',
      cible: lb.nom,
      alFin: () =>
        lesLb.modifier(lb.id, (l) => ({ pool: l.pool.map((p) => ({ ...p, sante: 'ok' as const })) })),
    })

    projets.creer({
      id: idProjet,
      nom: nom.trim(),
      description: description.trim(),
      espaceId: espace.id,
      clusterId,
      lbId: lb.id,
      cree: MAINTENANT.slice(0, 10),
      environnements: ['Production'],
      variables: [],
      etiquettes: tags,
    })

    pousser({
      ton: 'info',
      titre: `Projet « ${nom.trim()} » créé`,
      detail:
        modeClusterEffectif === 'nouveau'
          ? 'Cluster Kubernetes et load balancer dédiés en cours de provisionnement. Aucun service : la facturation commence au premier déploiement.'
          : 'Load balancer dédié en cours de provisionnement, rattaché à un cluster existant. Aucun service : la facturation commence au premier déploiement.',
    })
    lancerJob({ workflow: 'projet.create', cible: nom.trim() })

    router.push(`/app/applications/projets/${idProjet}`)
  }

  return (
    <WizardShell
      etapes={ETAPES}
      courante={etape}
      onChange={setEtape}
      titre={ETAPES[etape - 1].titre}
      panneau={
        <>
          <Card>
            <MicroLabel>Projet</MicroLabel>
            <dl className="mt-2.5 space-y-1.5">
              <Petit cle="Nom" valeur={nom || '—'} mono />
              <Petit cle="Étiquettes" valeur={tags.length ? String(tags.length) : 'Aucune'} />
              <Petit cle="Espace Cloud" valeur={espace.code} mono />
              <Petit
                cle="Cluster"
                valeur={modeClusterEffectif === 'nouveau' ? `Nouveau · ${taille.label}` : 'Existant'}
              />
              <Petit cle="Load balancer" valeur="Automatique" />
              <Petit cle="Environnement" valeur="Production" />
            </dl>
          </Card>
          <CostPreview lignes={lignesCout} />
        </>
      }
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => (etape === 1 ? router.push('/app/applications/projets') : setEtape(etape - 1))}
          >
            {etape === 1 ? 'Annuler' : 'Précédent'}
          </Button>
          {etape < 3 ? (
            <Button disabled={!peutContinuer} onClick={() => setEtape(etape + 1)}>
              Continuer
            </Button>
          ) : (
            <Button disabled={!peutContinuer} onClick={creerLeProjet}>
              Créer le projet
            </Button>
          )}
        </>
      }
    >
      {/* Étape 1 — Projet */}
      {etape === 1 && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Un projet ne consomme rien par lui-même">
            Créer un projet ne facture rien pour ses services : c’est un contenant. La facturation des
            services commence au premier déploiement, au prorata journalier. Le cluster et le load
            balancer dédiés, eux, sont provisionnés — et facturés — dès la création.
          </Callout>
          <Field
            label="Nom du projet"
            required
            hint="Visible par tous les membres qui ont accès au projet."
          >
            <Input
              placeholder="Plateforme de facturation"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </Field>
          <Field
            label="Description"
            hint="Une phrase suffit. Elle répond à « à quoi sert ce système ? » pour la personne qui prendra l’astreinte."
          >
            <Textarea
              rows={3}
              placeholder="API de facturation, sa base et ses relances par lot."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field
            label="Étiquettes"
            hint="Entrée ou virgule pour ajouter, Retour arrière pour retirer la dernière. Servent à ventiler la dépense et à retrouver le projet dans la recherche."
          >
            <TagsInput value={tags} onChange={setTags} placeholder="facturation, critique…" />
          </Field>
        </div>
      )}

      {/* Étape 2 — Infrastructure */}
      {etape === 2 && (
        <div className="space-y-4">
          <Field label="Espace Cloud">
            <Select value={espaceId} onChange={(e) => setEspaceId(e.target.value)}>
              {ESPACES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {e.site} · {e.quota.vcpu - e.usage.vcpu} vCPU libres
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <MicroLabel className="mb-2">Cluster Kubernetes</MicroLabel>
            <p className="mb-2 text-[11.5px] leading-relaxed text-g-500">
              Un projet est toujours servi par un cluster Kubernetes dédié — jamais par des machines
              virtuelles choisies à la main.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setModeCluster('nouveau')}
                className={cn(
                  'rounded-[8px] border-2 bg-white p-3 text-left transition-colors',
                  modeClusterEffectif === 'nouveau' ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                )}
              >
                <span className="block text-[12.5px] font-semibold text-ink">Nouveau cluster</span>
                <span className="mt-1 block text-[11.5px] text-g-500">
                  Provisionné à la création, rien que pour ce projet.
                </span>
              </button>
              <button
                type="button"
                disabled={clustersDisponibles.length === 0}
                onClick={() => setModeCluster('existant')}
                className={cn(
                  'rounded-[8px] border-2 bg-white p-3 text-left transition-colors',
                  clustersDisponibles.length === 0
                    ? 'cursor-not-allowed opacity-50'
                    : modeClusterEffectif === 'existant'
                      ? 'border-p-700'
                      : 'border-g-300 hover:border-p-400',
                )}
              >
                <span className="block text-[12.5px] font-semibold text-ink">Cluster existant</span>
                <span className="mt-1 block text-[11.5px] text-g-500">
                  {clustersDisponibles.length === 0
                    ? `Aucun cluster dans ${espace.code}`
                    : 'Partagé avec d’autres projets de cet Espace.'}
                </span>
              </button>
            </div>
          </div>

          {modeClusterEffectif === 'nouveau' ? (
            <Field label="Taille du cluster" hint="Ajustable ensuite — pools, autoscaling — depuis Kubernetes.">
              <Select
                value={tailleId}
                onChange={(e) => setTailleId(e.target.value as (typeof TAILLES_CLUSTER)[number]['id'])}
              >
                {TAILLES_CLUSTER.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} · {t.detail}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Cluster">
              <Select value={clusterExistantEffectif} onChange={(e) => setClusterExistantId(e.target.value)}>
                {clustersDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} · v{c.version}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Callout ton="info" titre="Load balancer L7 dédié — automatique">
            Un load balancer public, avec certificat automatique, est provisionné en même temps que le
            projet et pointé sur l’ingress du cluster. C’est la porte d’entrée par laquelle tous les
            services du projet seront joignables — rien à configurer.
          </Callout>
        </div>
      )}

      {/* Étape 3 — Récapitulatif */}
      {etape === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader titre="Ce qui va être créé" />
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Nom', valeur: <span className="font-mono">{nom}</span> },
                { cle: 'Description', valeur: description || '—' },
                { cle: 'Étiquettes', valeur: tags.length ? tags.join(', ') : 'Aucune' },
                { cle: 'Espace Cloud', valeur: espace.code },
                {
                  cle: 'Cluster Kubernetes',
                  valeur:
                    modeClusterEffectif === 'nouveau'
                      ? `Nouveau · ${taille.label} (${taille.detail})`
                      : (clustersDisponibles.find((c) => c.id === clusterExistantEffectif)?.nom ?? 'Existant'),
                },
                { cle: 'Load balancer', valeur: 'L7 public, dédié, certificat automatique' },
                { cle: 'Environnement de départ', valeur: 'Production' },
                { cle: 'Zone applicative', valeur: <span className="font-mono">*.{ZONE_APPLICATIVE.zone}</span> },
              ]}
            />
          </Card>

          <CostPreview lignes={lignesCout} />

          <Card>
            <Checkbox
              checked={conditions}
              onChange={(e) => setConditions(e.target.checked)}
              label="Je confirme la création de ce projet"
              description="Le cluster et le load balancer démarrent leur provisionnement immédiatement. Montants hors taxes, TVA 18 % appliquée à la facturation."
            />
          </Card>
        </div>
      )}
    </WizardShell>
  )
}

function Petit({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[11.5px] text-g-500">{cle}</dt>
      <dd
        className={cn('truncate text-right text-[11.5px] font-semibold text-ink', mono && 'font-mono')}
      >
        {valeur}
      </dd>
    </div>
  )
}
