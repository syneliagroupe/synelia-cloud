'use client'

import { useEffect, useState } from 'react'
import { Download, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { dateCourte, goHumain, num, pct } from '@/lib/format'
import { SITE_LABEL, ROLE_LABEL, type Role } from '@/lib/types'
import { K8S_CLUSTERS, espaceById } from '@/lib/mock'
import type { K8sCluster } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { HealthBadge, QuotaBar, StatTile } from '@/components/composition/metrics'
import { GrilleSparkCharts } from '@/components/business/observabilite'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, requete, supprimerRessource } from '@/lib/api/client'

/** `GET /kubernetes/{id}/metriques` — même mécanique que `SerieMetriqueVm` côté fiche VM : un
 * instantané réel (diagnostics Nova/libvirt des VM masters/workers), pas un historique. */
interface SerieMetriqueK8s {
  metrique: string
  unite: string
  points: { valeur: number }[]
}

/** Une VM Nova réelle derrière le cluster (master ou worker) — `cpu`/`ram` absents si la VM
 * n'est pas `ACTIVE` ou si l'hyperviseur n'a pas répondu. */
interface NoeudMetriqueK8s {
  id: string
  statut: string
  vcpu?: number
  cpu?: number
  ram?: number
}

/** Même distinction qu'en fiche VM (`detailLectureVm`) : « cluster non provisionné, rien à lire »
 * (fait durable) contre « l'appel n'a pas encore répondu, ou l'amont ne répond pas »
 * (transitoire). */
function detailLectureK8s(noeuds: NoeudMetriqueK8s[] | null, statutCluster: string): string {
  if (noeuds === null) return 'Lecture en cours…'
  if (noeuds.length === 0) {
    return statutCluster === 'running'
      ? 'Aucune VM Nova identifiée pour ce cluster pour le moment'
      : 'Cluster non actif — rien à lire côté hyperviseur'
  }
  return 'Lecture hyperviseur indisponible pour le moment'
}

/** Versions proposées à la mise à jour — une mineure d'écart au plus. */
const VERSIONS = ['1.29.6', '1.30.4', '1.31.2']

const MODULES_DISPONIBLES = [
  { id: 'ingress-nginx 4.11.2', label: 'ingress-nginx · contrôleur d’entrée HTTP/HTTPS' },
  { id: 'cert-manager 1.15.3', label: 'cert-manager · certificats automatiques' },
  { id: 'argocd 2.12.3', label: 'argocd · livraison continue en GitOps' },
  { id: 'external-dns 0.14.2', label: 'external-dns · synchronisation DNS' },
  { id: 'rook-ceph 1.15.1', label: 'rook-ceph · stockage persistant distribué' },
  { id: 'velero 1.14.1', label: 'velero · sauvegarde du cluster' },
]

const ONGLETS = [
  { id: 'apercu', label: 'Vue d’ensemble' },
  { id: 'noeuds', label: 'Nœuds' },
  { id: 'pools', label: 'Pools' },
  { id: 'modules', label: 'Modules installés' },
  { id: 'registre', label: 'Registre d’images' },
  { id: 'acces', label: 'Accès' },
]

const IMAGES_REGISTRE = [
  { depot: 'dba/app-metier', etiquettes: 24, taille: 1840, cveElevees: 0, cveMoyennes: 3, derniere: '2026-08-19' },
  { depot: 'dba/analytics', etiquettes: 18, taille: 2610, cveElevees: 1, cveMoyennes: 7, derniere: '2026-08-18' },
  { depot: 'dba/batch-worker', etiquettes: 11, taille: 940, cveElevees: 2, cveMoyennes: 9, derniere: '2026-08-19' },
  { depot: 'dba/site-vitrine', etiquettes: 32, taille: 210, cveElevees: 0, cveMoyennes: 1, derniere: '2026-08-17' },
]

const MAPPING_ROLES: Array<{ role: Role; k8s: string; namespaces: string }> = [
  { role: 'org_admin', k8s: 'cluster-admin', namespaces: 'tous' },
  { role: 'espace_admin', k8s: 'admin', namespaces: 'tous' },
  { role: 'project_owner', k8s: 'edit', namespaces: 'ceux de son application' },
  { role: 'operator', k8s: 'view + exec sur les pods', namespaces: 'ceux de son application' },
  { role: 'read_only', k8s: 'view', namespaces: 'tous' },
]

export function VueCluster({ id }: { id: string }) {
  const { autorise, refus, pousser, api } = useApp()
  const executer = useOperation()
  const grappes = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  const [onglet, setOnglet] = useState('apercu')
  /** Brouillons d'édition des pools, par nom de pool. */
  const [brouillons, setBrouillons] = useState<
    Record<string, { nodes?: number; min?: number; max?: number; disk?: number }>
  >({})
  const [oidcObligatoire, setOidcObligatoire] = useState(true)
  const [auditApi, setAuditApi] = useState(true)
  const [apiPublique, setApiPublique] = useState(false)

  // `GET /kubernetes/{id}/metriques` : agrège les diagnostics Nova/libvirt réels des VM
  // masters/workers du cluster (retrouvées côté backend via la stack Heat Magnum), pas une
  // valeur inventée. `null` tant que l'appel n'a pas répondu, `[]` si le cluster n'a aucune VM
  // identifiable (juste soumis, ou simulation) — jamais une série fabriquée pour meubler l'écran.
  const [metriquesK8s, setMetriquesK8s] = useState<SerieMetriqueK8s[] | null>(null)
  const [noeudsK8s, setNoeudsK8s] = useState<NoeudMetriqueK8s[] | null>(null)
  useEffect(() => {
    if (!estActif()) return
    setMetriquesK8s(null)
    setNoeudsK8s(null)
    requete<{ series: SerieMetriqueK8s[]; noeuds: NoeudMetriqueK8s[] }>(
      `/kubernetes/${encodeURIComponent(id)}/metriques`,
    )
      .then((r) => {
        setMetriquesK8s(r.series ?? [])
        setNoeudsK8s(r.noeuds ?? [])
      })
      .catch(() => {
        setMetriquesK8s([])
        setNoeudsK8s([])
      })
  }, [id])
  const lectureK8s = (metrique: string) =>
    metriquesK8s?.find((s) => s.metrique === metrique)?.points.at(-1)?.valeur
  const uniteK8s = (metrique: string) => metriquesK8s?.find((s) => s.metrique === metrique)?.unite

  const cluster = grappes.items.find((c) => c.id === id)
  const espace = cluster ? espaceById(cluster.espaceId) : undefined

  if (!cluster) {
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Kubernetes', href: '/app/kubernetes' },
            { label: 'Introuvable' },
          ]}
          titre="Cluster introuvable"
        />
        <EmptyState
          titre="Ce cluster n’existe pas ou plus"
          phrase="Il a peut-être été supprimé, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: 'Retour aux clusters', href: '/app/kubernetes' }}
        />
      </div>
    )
  }

  const poserBrouillon = (pool: string, champ: 'nodes' | 'min' | 'max' | 'disk', valeur: number) =>
    setBrouillons((p) => ({ ...p, [pool]: { ...p[pool], [champ]: valeur } }))

  const noeudsTotal = cluster.pools.reduce((a, p) => a + p.nodes, 0)
  const vcpuTotal = cluster.pools.reduce((a, p) => {
    const v = Number(p.flavor.match(/(\d+) vCPU/)?.[1] ?? 4)
    return a + v * p.nodes
  }, 0)
  const ramTotal = cluster.pools.reduce((a, p) => {
    const r = Number(p.flavor.match(/(\d+) Go/)?.[1] ?? 8)
    return a + r * p.nodes
  }, 0)

  const kubeconfig = `apiVersion: v1
kind: Config
clusters:
  - name: ${cluster.nom}
    cluster:
      server: https://${cluster.nom}.k8s.${cluster.site.toLowerCase()}.synelia.cloud:6443
      certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t…
contexts:
  - name: ${cluster.nom}
    context:
      cluster: ${cluster.nom}
      user: oidc-synelia
      namespace: default
current-context: ${cluster.nom}
users:
  - name: oidc-synelia
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1
        command: kubectl-synelia-auth
        args: ["--realm", "dba-africa", "--cluster", "${cluster.nom}"]`

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace?.code ?? '', href: `/app/espaces/${cluster.espaceId}` },
          { label: 'Kubernetes', href: '/app/kubernetes' },
          { label: cluster.nom },
        ]}
        titre={<span className="font-mono">{cluster.nom}</span>}
        sousTitre={`Kubernetes ${cluster.version} · control plane ${cluster.controlPlane.mode === 'ha' ? `haute disponibilité (${cluster.controlPlane.nodes} masters)` : 'mono-master'} · ${noeudsTotal} nœuds workers · ${SITE_LABEL[cluster.site]}`}
        meta={
          <>
            <HealthBadge etat={cluster.statut} />
            <Badge tone="neutral">v{cluster.version}</Badge>
            <Badge tone={cluster.controlPlane.mode === 'ha' ? 'ok' : 'neutral'}>
              {cluster.controlPlane.mode === 'ha' ? 'HA' : 'Mono-master'}
            </Badge>
            <Badge tone="violet">{cluster.modules.length} modules</Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              iconBefore={<Download size={14} />}
              onClick={() =>
                pousser({
                  ton: 'ok',
                  titre: 'kubeconfig téléchargé',
                  detail: 'L’authentification passe par votre identité Synelia, pas par un jeton statique.',
                })
              }
            >
              Télécharger le kubeconfig
            </Button>
            <BoutonFormulaire
              libelle="Mettre à jour la version"
              variant="ghost"
              size="md"
              action="espace.quota.update"
              titre={`Mettre à jour ${cluster.nom}`}
              description="La mise à jour se fait control plane d’abord, puis les pools un nœud à la fois. Un saut de plus d’une version mineure n’est pas proposé : Kubernetes ne le supporte pas."
              champs={[
                {
                  id: 'version',
                  label: 'Version cible',
                  type: 'select',
                  options: VERSIONS.filter((v) => v > cluster.version).map((v) => ({
                    value: v,
                    label: `Kubernetes ${v}`,
                  })),
                },
              ]}
              libelleValider="Mettre à jour"
              operation={(v) => ({
                ton: 'info',
                titre: `Mise à jour vers ${v.version} lancée`,
                appel: () =>
                  requete(`/kubernetes/${encodeURIComponent(cluster.id)}/mise-a-jour`, {
                    methode: 'POST',
                    corps: { version: String(v.version) },
                  }),
                effet: () => grappes.modifier(cluster.id, { statut: 'updating' }),
                job: { workflow: 'k8s.upgrade', cible: `${cluster.nom} → ${v.version}` },
                effetFinal: () => {
                  grappes.modifier(cluster.id, {
                    statut: 'running',
                    version: String(v.version),
                  })
                  grappes.recharger()
                },
              })}
            />
          </>
        }
      />

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {/* Vue d'ensemble */}
      {onglet === 'apercu' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile libelle="Nœuds" valeur={noeudsTotal} detail={`${cluster.pools.length} pools`} />
            <StatTile
              libelle="vCPU du cluster"
              valeur={vcpuTotal}
              detail="Consommés sur le quota de l’espace"
            />
            <StatTile libelle="Mémoire" valeur={`${num(ramTotal)}`} unite="Go" />
            <StatTile
              libelle="Pods en exécution"
              valeur={api ? '—' : num(noeudsTotal * 14)}
              detail={api ? 'Démonstration — aucune intégration metrics-server aujourd’hui' : undefined}
              serie={api ? undefined : seededSeries(`${id}-pods`, 24, noeudsTotal * 11, noeudsTotal * 17)}
            />
            <StatTile
              libelle="Namespaces"
              valeur={api ? '—' : cluster.applicationId ? 4 : 2}
              detail={api ? 'Démonstration — aucune intégration API Kubernetes aujourd’hui' : 'Un par environnement'}
            />
          </div>

          {/*
            `GET /kubernetes/{id}/metriques` renvoie un instantané réel pour CPU/Mémoire/Réseau
            (diagnostics Nova/libvirt des VM Nova masters/workers du cluster, agrégées côté
            backend — `synelia.modules.kubernetes.service.metriques_instantanees`), même
            mécanique que la fiche VM. Vide (`metriquesK8s === null` tant que l'appel n'a pas
            répondu, `[]` si le cluster n'a aucune VM Nova identifiable) plutôt qu'une valeur
            inventée. Pods/Namespaces ci-dessus restent en démonstration : rien ne remonte
            aujourd'hui l'intérieur du cluster (metrics-server, API Kubernetes).
          */}
          {api && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile
                libelle="CPU (VM du cluster)"
                valeur={lectureK8s('cpu') !== undefined ? Math.round(lectureK8s('cpu')!) : '—'}
                unite={lectureK8s('cpu') !== undefined ? '%' : undefined}
                detail={
                  lectureK8s('cpu') === undefined
                    ? detailLectureK8s(noeudsK8s, cluster.statut)
                    : 'Moyenne des VM Nova actives du cluster'
                }
              />
              <StatTile
                libelle="Mémoire (VM du cluster)"
                valeur={lectureK8s('ram') !== undefined ? Math.round(lectureK8s('ram')!) : '—'}
                unite={lectureK8s('ram') !== undefined ? '%' : undefined}
                detail={
                  lectureK8s('ram') === undefined
                    ? detailLectureK8s(noeudsK8s, cluster.statut)
                    : 'Moyenne des VM Nova actives du cluster'
                }
              />
              <StatTile
                libelle="Réseau (VM du cluster)"
                valeur={
                  lectureK8s('reseau_entrant') !== undefined
                    ? Number(lectureK8s('reseau_entrant')!.toFixed(2))
                    : '—'
                }
                unite={lectureK8s('reseau_entrant') !== undefined ? uniteK8s('reseau_entrant') : undefined}
                detail={
                  lectureK8s('reseau_entrant') === undefined
                    ? detailLectureK8s(noeudsK8s, cluster.statut)
                    : 'Somme des VM Nova actives du cluster'
                }
                ton="violet"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                titre="Accès au cluster"
                sousTitre="L’authentification passe par votre identité Synelia via OIDC — aucun jeton statique à faire circuler."
              />
              <div className="space-y-3">
                <CopyField
                  label="Endpoint de l’API"
                  value={`https://${cluster.nom}.k8s.${cluster.site.toLowerCase()}.synelia.cloud:6443`}
                />
                <CopyField
                  label="Commande de connexion"
                  value={`kubectl --context ${cluster.nom} get nodes`}
                />
              </div>
              <div className="mt-4">
                <MicroLabel className="mb-2">kubeconfig</MicroLabel>
                <CodeBlock code={kubeconfig} langue="yaml" />
              </div>
            </Card>

            <Card>
              <CardHeader titre="Control plane" />
              <KeyValueList
                colonnes={1}
                items={[
                  {
                    cle: 'Mode',
                    valeur:
                      cluster.controlPlane.mode === 'ha'
                        ? `Haute disponibilité · ${cluster.controlPlane.nodes} masters`
                        : 'Mono-master',
                  },
                  { cle: 'Version', valeur: cluster.version },
                  { cle: 'Exploitation', valeur: 'Assurée par Synelia' },
                  { cle: 'Sauvegarde etcd', valeur: 'Toutes les heures, rétention 7 jours' },
                  { cle: 'Site', valeur: SITE_LABEL[cluster.site] },
                ]}
              />
              {cluster.controlPlane.mode === 'single' && (
                <Callout ton="warn" className="mt-3.5" titre="Control plane non redondant">
                  Pendant une maintenance du master, l’API Kubernetes est momentanément
                  indisponible. Les pods déjà en exécution continuent de tourner, mais l’autoscaling
                  et les déploiements sont suspendus. Acceptable en recette, à reconsidérer en
                  production.
                </Callout>
              )}
            </Card>
          </div>

          {api ? (
            <Card>
              <CardHeader titre="Historique des métriques" />
              <p className="rounded-[8px] border border-dashed border-g-300 bg-g-050 px-3.5 py-4 text-center text-[12.5px] text-g-500">
                Démonstration — le CPU, la mémoire et le réseau ci-dessus sont une lecture réelle
                de l’hyperviseur (diagnostics Nova/libvirt des VM du cluster), mais instantanée :
                rien ne persiste de série dans le temps côté backend, donc pas de courbe 24 h à
                afficher ici. Pods en exécution et latence de l’API restent indisponibles : aucune
                intégration metrics-server ni API Kubernetes ne les remonte aujourd’hui.
              </p>
            </Card>
          ) : (
            <GrilleSparkCharts
              seed={`k8s-${id}`}
              metriques={[
                { titre: 'CPU du cluster', unite: '%', min: 28, max: 64 },
                { titre: 'Mémoire du cluster', unite: '%', min: 44, max: 78, seuil: 90 },
                { titre: 'Pods en exécution', unite: '', min: noeudsTotal * 11, max: noeudsTotal * 17, couleur: 'var(--color-m-600)' },
                { titre: 'Latence de l’API', unite: 'ms', min: 8, max: 42, seuil: 200 },
              ]}
            />
          )}
        </div>
      )}

      {/* Nœuds */}
      {onglet === 'noeuds' && (
        <div className="space-y-4">
          {api && (
            <Card>
              <CardHeader
                titre="VM Nova réelles du cluster"
                sousTitre="Masters et workers retrouvés via la stack Heat du cluster Magnum — CPU/Mémoire lus en direct sur l’hyperviseur (diagnostics Nova/libvirt), pas de correspondance garantie avec les pools ci-dessous (Kubernetes ne distingue pas les masters des pools de workers dans ce contrat)."
              />
              {noeudsK8s === null ? (
                <p className="text-[12.5px] text-g-500">Lecture en cours…</p>
              ) : noeudsK8s.length === 0 ? (
                <p className="rounded-[8px] border border-dashed border-g-300 bg-g-050 px-3.5 py-4 text-center text-[12.5px] text-g-500">
                  {detailLectureK8s(noeudsK8s, cluster.statut)}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="border-b border-g-300 bg-g-050">
                        {['VM Nova', 'vCPU', 'CPU', 'Mémoire', 'État'].map((h) => (
                          <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {noeudsK8s.map((n) => (
                        <tr key={n.id} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2.5 font-mono text-[12px] text-ink">{n.id}</td>
                          <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{n.vcpu ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            {n.cpu !== undefined ? (
                              <span className="block w-24">
                                <QuotaBar
                                  utilise={Math.round(n.cpu)}
                                  total={100}
                                  compact
                                  formateur={(v) => `${v}%`}
                                />
                              </span>
                            ) : (
                              <span className="text-[12px] text-g-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {n.ram !== undefined ? (
                              <span className="block w-24">
                                <QuotaBar
                                  utilise={Math.round(n.ram)}
                                  total={100}
                                  compact
                                  seuil={85}
                                  formateur={(v) => `${v}%`}
                                />
                              </span>
                            ) : (
                              <span className="text-[12px] text-g-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={n.statut.toUpperCase() === 'ACTIVE' ? 'ok' : 'neutral'} dot size="sm">
                              {n.statut}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
          <Card>
            <CardHeader
              titre="Pools de workers"
              sousTitre="Les nœuds sont gérés par leur pool : ne les modifiez pas individuellement, ajustez le pool."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Nœud', 'Pool', 'Gabarit', 'Pods', 'État', ''].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cluster.pools.flatMap((p) =>
                    Array.from({ length: p.nodes }, (_, i) => {
                      return (
                        <tr
                          key={`${p.nom}-${i}`}
                          className="border-b border-g-100 last:border-0 hover:bg-p-050/60"
                        >
                          <td className="px-3 py-2.5 font-mono text-[12px] text-ink">
                            {cluster.nom}-{p.nom}-{String(i + 1).padStart(2, '0')}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
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
                              {p.nom}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-g-700">{p.flavor}</td>
                          <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                            {api ? '—' : 12 + ((i * 3) % 8)}
                          </td>
                          <td className="px-3 py-2.5">
                            {api ? (
                              <span className="text-[12px] text-g-500">Voir « VM Nova réelles »</span>
                            ) : (
                              <Badge tone="ok" dot size="sm">
                                Ready
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <BoutonAction
                              libelle="Drainer"
                              variant="ghost"
                              operation={{
                                action: 'component.restart',
                                ton: 'info',
                                titre: 'Drainage du nœud lancé',
                                detail:
                                  'Les pods sont évacués en respectant les budgets de perturbation. Si un budget bloque, nous ne forçons pas.',
                                job: {
                                  type: 'k8s.node.drain',
                                  label: `Drainage d’un nœud · ${cluster.nom}`,
                                  etapes: [
                                    'Marquer le nœud non planifiable',
                                    'Évacuer les pods',
                                    'Vérifier les budgets de perturbation',
                                  ],
                                  dureeEtapeMs: 1100,
                                },
                              }}
                            />
                          </td>
                        </tr>
                      )
                    }),
                  )}
                </tbody>
              </table>
            </div>
            <Callout ton="info" className="mt-4" titre="Drainer un nœud">
              Le drainage évacue proprement les pods vers les autres nœuds en respectant les budgets de
              perturbation (PodDisruptionBudget) que vous avez déclarés. C’est l’opération à faire
              avant toute intervention sur un nœud. Si un budget bloque le drainage, nous ne le forçons
              pas : c’est à vous de décider.
            </Callout>
          </Card>
        </div>
      )}

      {/* Pools */}
      {onglet === 'pools' && (
        <div className="space-y-4">
          {cluster.pools.map((p) => (
            <Card key={p.nom}>
              <CardHeader
                titre={<span className="font-mono">{p.nom}</span>}
                sousTitre={`${p.flavor} · disque ${p.diskGo ?? 100} Go`}
                actions={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={
                        p.type === 'gpu'
                          ? 'accent'
                          : p.type === 'preemptible'
                            ? 'warn'
                            : p.type === 'memory'
                              ? 'violet'
                              : 'neutral'
                      }
                    >
                      {{
                        standard: 'Usage général',
                        memory: 'Optimisé mémoire',
                        gpu: 'GPU / vGPU',
                        preemptible: 'Préemptible · −60 %',
                      }[p.type]}
                    </Badge>
                    {p.autoscale && <Badge tone="ok">Autoscaling</Badge>}
                  </div>
                }
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Nombre de nœuds">
                  <Input
                    type="number"
                    value={brouillons[p.nom]?.nodes ?? p.nodes}
                    onChange={(e) => poserBrouillon(p.nom, 'nodes', Number(e.target.value))}
                    min={0}
                    max={40}
                    aria-label={`Nombre de nœuds du pool ${p.nom}`}
                  />
                </Field>
                {p.autoscale && (
                  <>
                    <Field label="Minimum">
                      <Input
                        type="number"
                        value={brouillons[p.nom]?.min ?? p.autoscale.min}
                        onChange={(e) => poserBrouillon(p.nom, 'min', Number(e.target.value))}
                        min={0}
                        aria-label={`Minimum du pool ${p.nom}`}
                      />
                    </Field>
                    <Field label="Maximum">
                      <Input
                        type="number"
                        value={brouillons[p.nom]?.max ?? p.autoscale.max}
                        onChange={(e) => poserBrouillon(p.nom, 'max', Number(e.target.value))}
                        min={1}
                        aria-label={`Maximum du pool ${p.nom}`}
                      />
                    </Field>
                  </>
                )}
                <Field label="Disque par nœud">
                  <Input
                    type="number"
                    value={brouillons[p.nom]?.disk ?? p.diskGo ?? 100}
                    onChange={(e) => poserBrouillon(p.nom, 'disk', Number(e.target.value))}
                    suffix="Go"
                    aria-label={`Disque par nœud du pool ${p.nom}`}
                  />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-g-100 pt-4 sm:grid-cols-2">
                <div>
                  <MicroLabel className="mb-1.5">Étiquettes</MicroLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {(p.labels ?? []).length > 0 ? (
                      (p.labels ?? []).map((l) => (
                        <Badge key={l} tone="neutral" size="sm">
                          <span className="font-mono">{l}</span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[12px] text-g-500">Aucune</span>
                    )}
                  </div>
                </div>
                <div>
                  <MicroLabel className="mb-1.5">Taints</MicroLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {(p.taints ?? []).length > 0 ? (
                      (p.taints ?? []).map((t) => (
                        <Badge key={t} tone="warn" size="sm">
                          <span className="font-mono">{t}</span>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[12px] text-g-500">Aucun</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-g-100 pt-3.5">
                <GatedAction
                  autorise={autorise('espace.quota.update')}
                  message={refus('espace.quota.update')}
                >
                  <Button
                    size="sm"
                    disabled={!brouillons[p.nom]}
                    onClick={() => {
                      const b = brouillons[p.nom] ?? {}
                      executer({
                        action: 'espace.quota.update',
                        titre: `Pool ${p.nom} redimensionné`,
                        detail: `${b.nodes ?? p.nodes} nœuds · ${b.disk ?? p.diskGo ?? 100} Go par nœud`,
                        effet: () =>
                          grappes.modifier(cluster.id, (c) => ({
                            pools: c.pools.map((x) =>
                              x.nom === p.nom
                                ? {
                                    ...x,
                                    nodes: b.nodes ?? x.nodes,
                                    diskGo: b.disk ?? x.diskGo,
                                    autoscale: x.autoscale
                                      ? {
                                          min: b.min ?? x.autoscale.min,
                                          max: b.max ?? x.autoscale.max,
                                        }
                                      : undefined,
                                  }
                                : x,
                            ),
                          })),
                      })
                      setBrouillons((prev) => {
                        const suite = { ...prev }
                        delete suite[p.nom]
                        return suite
                      })
                    }}
                  >
                    Appliquer
                  </Button>
                </GatedAction>
                <BoutonAction
                  libelle="Mise à jour progressive"
                  operation={{
                    action: 'espace.quota.update',
                    ton: 'info',
                    titre: `Mise à jour progressive du pool ${p.nom}`,
                    job: { workflow: 'k8s.pool.roll', cible: `${cluster.nom} · ${p.nom}` },
                  }}
                />
                <IconButton
                  label={`Supprimer le pool ${p.nom}`}
                  size="sm"
                  disabled={cluster.pools.length === 1}
                  onClick={() =>
                    executer({
                      action: 'espace.quota.update',
                      ton: 'warn',
                      titre: `Pool ${p.nom} supprimé`,
                      detail: 'Ses nœuds sont drainés puis détruits ; les pods se replacent ailleurs.',
                      appel: () =>
                        supprimerRessource(
                          `/kubernetes/${encodeURIComponent(cluster.id)}/pools`,
                          p.nom,
                          p.nom,
                        ),
                      effet: () =>
                        grappes.modifier(cluster.id, (c) => ({
                          pools: c.pools.filter((x) => x.nom !== p.nom),
                        })),
                      effetFinal: () => grappes.recharger(),
                    })
                  }
                >
                  <Trash2 size={13} className="text-err" />
                </IconButton>
              </div>

              {p.type === 'preemptible' && (
                <Callout ton="warn" className="mt-3.5" titre="Nœuds préemptibles">
                  Ces nœuds peuvent être récupérés par la plateforme avec un préavis de trente
                  secondes. Réservez-les aux charges tolérantes à l’interruption, et déclarez un
                  taint pour éviter qu’un service synchrone n’y soit placé par erreur.
                </Callout>
              )}
            </Card>
          ))}
          <BoutonFormulaire
            libelle="Ajouter un pool"
            size="md"
            icone={<Plus size={14} />}
            action="espace.quota.update"
            titre="Ajouter un pool de workers"
            description="Un pool regroupe des nœuds de même gabarit. Séparer les pools permet de placer les charges par étiquette et de réserver les nœuds GPU ou préemptibles."
            champs={[
              { id: 'nom', label: 'Nom du pool', placeholder: 'pool-batch', obligatoire: true },
              {
                id: 'type',
                label: 'Type',
                type: 'select',
                demi: true,
                options: [
                  { value: 'standard', label: 'Standard' },
                  { value: 'memory', label: 'Optimisé mémoire' },
                  { value: 'gpu', label: 'GPU / vGPU' },
                  { value: 'preemptible', label: 'Préemptible' },
                ],
              },
              {
                id: 'flavor',
                label: 'Gabarit',
                type: 'select',
                demi: true,
                options: [
                  { value: '4 vCPU · 8 Go', label: '4 vCPU · 8 Go' },
                  { value: '8 vCPU · 16 Go', label: '8 vCPU · 16 Go' },
                  { value: '8 vCPU · 32 Go', label: '8 vCPU · 32 Go' },
                  { value: '16 vCPU · 64 Go', label: '16 vCPU · 64 Go' },
                ],
              },
              { id: 'nodes', label: 'Nœuds', type: 'nombre', demi: true, min: 1, max: 40 },
              { id: 'disque', label: 'Disque par nœud', type: 'nombre', demi: true, min: 40, suffixe: 'Go' },
              { id: 'autoscale', label: 'Autoscaling', type: 'switch', placeholder: 'Activé' },
            ]}
            valeursDepart={{ type: 'standard', flavor: '8 vCPU · 16 Go', nodes: 3, disque: 100 }}
            libelleValider="Ajouter le pool"
            operation={(v) => ({
              titre: `Pool ${v.nom} créé`,
              detail: `${v.nodes} nœuds · ${v.flavor}`,
              appel: () =>
                requete(`/kubernetes/${encodeURIComponent(cluster.id)}/pools`, {
                  methode: 'POST',
                  corps: {
                    nom: String(v.nom),
                    nodes: Number(v.nodes),
                    flavor: String(v.flavor),
                    diskGo: Number(v.disque),
                  },
                }),
              job: {
                type: 'k8s.pool.create',
                label: `Création du pool ${v.nom} · ${cluster.nom}`,
                etapes: ['Provisionner les nœuds', 'Joindre le cluster', 'Vérifier l’état Ready'],
                dureeEtapeMs: 1100,
              },
              effet: () =>
                grappes.modifier(cluster.id, (c) => ({
                  pools: [
                    ...c.pools,
                    {
                      nom: String(v.nom),
                      nodes: Number(v.nodes),
                      flavor: String(v.flavor),
                      diskGo: Number(v.disque),
                      type: v.type as 'standard' | 'gpu' | 'memory' | 'preemptible',
                      autoscale: v.autoscale
                        ? { min: Number(v.nodes), max: Number(v.nodes) * 3 }
                        : undefined,
                      taints: v.type === 'preemptible' ? ['preemptible=true:NoSchedule'] : undefined,
                    },
                  ],
                })),
              effetFinal: () => grappes.recharger(),
            })}
          />
        </div>
      )}

      {/* Modules */}
      {onglet === 'modules' && (
        <Card>
          <CardHeader
            titre="Modules installés"
            sousTitre="Charts Helm préqualifiés par nos équipes. Vous restez libre d’installer vos propres charts en parallèle."
            actions={
              <BoutonFormulaire
                libelle="Installer un module"
                icone={<Plus size={13} />}
                action="espace.quota.update"
                titre="Installer un module préqualifié"
                description="Nous testons chaque version sur un cluster de référence avant de la proposer. Un chart que vous installez vous-même reste sous votre responsabilité."
                champs={[
                  {
                    id: 'module',
                    label: 'Module',
                    type: 'select',
                    options: MODULES_DISPONIBLES.filter(
                      (m) => !cluster.modules.includes(m.id),
                    ).map((m) => ({ value: m.id, label: m.label })),
                  },
                ]}
                libelleValider="Installer"
                operation={(v) => ({
                  titre: `Module ${String(v.module).split(' ')[0]} installé`,
                  appel: () =>
                    requete(`/kubernetes/${encodeURIComponent(cluster.id)}/modules`, {
                      methode: 'PUT',
                      corps: { modules: [...cluster.modules, String(v.module)] },
                    }),
                  job: {
                    type: 'k8s.module.install',
                    label: `Installation ${v.module} · ${cluster.nom}`,
                    etapes: ['Déployer le chart Helm', 'Attendre les pods Ready'],
                    dureeEtapeMs: 1100,
                  },
                  effetFinal: () => {
                    grappes.modifier(cluster.id, (c) => ({
                      modules: [...c.modules, String(v.module)],
                    }))
                    grappes.recharger()
                  },
                })}
              />
            }
          />
          <div className="space-y-2">
            {cluster.modules.map((m) => {
              const [nom, version] = m.split(' ')
              return (
                <div
                  key={m}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[12.5px] font-semibold text-ink">
                      {nom}
                    </span>
                    <span className="block text-[11px] text-g-500">
                      {{
                        'ingress-nginx': 'Contrôleur d’entrée HTTP/HTTPS',
                        'cert-manager': 'Émission et renouvellement automatiques des certificats',
                        argocd: 'Livraison continue en GitOps',
                        'external-dns': 'Synchronisation automatique des enregistrements DNS',
                        'rook-ceph': 'Stockage persistant distribué',
                        velero: 'Sauvegarde et restauration du cluster',
                      }[nom] ?? 'Module Kubernetes'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral" size="sm">
                      <span className="font-mono">{version}</span>
                    </Badge>
                    <Badge tone="ok" dot size="sm">
                      Sain
                    </Badge>
                    <BoutonAction
                      libelle="Mettre à jour"
                      variant="ghost"
                      operation={{
                        action: 'espace.quota.update',
                        titre: `${nom} mis à jour`,
                        detail: 'Version préqualifiée la plus récente.',
                      }}
                    />
                    <BoutonAction
                      libelle="Retirer"
                      variant="ghost"
                      operation={{
                        action: 'espace.quota.update',
                        ton: 'warn',
                        titre: `${nom} retiré du cluster`,
                        effet: () =>
                          grappes.modifier(cluster.id, (c) => ({
                            modules: c.modules.filter((x) => x !== m),
                          })),
                      }}
                      confirmation={{
                        ressource: nom,
                        titre: `Retirer ${nom} ?`,
                        pertes: [
                          'Les ressources créées par ce module seront supprimées',
                          'Les charges qui en dépendent cesseront de fonctionner',
                        ],
                        libelleAction: 'Retirer le module',
                      }}
                    />
                  </span>
                </div>
              )
            })}
          </div>
          <Callout ton="violet" className="mt-4" titre="Ce que « préqualifié » signifie">
            Nous testons chaque version de ces modules sur un cluster de référence avant de la
            proposer, et nous nous engageons sur leur bon fonctionnement. Un chart que vous
            installez vous-même reste sous votre responsabilité — nous vous aiderons à diagnostiquer,
            sans engagement de service dessus.
          </Callout>
        </Card>
      )}

      {/* Registre */}
      {onglet === 'registre' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatTile libelle="Dépôts" valeur={IMAGES_REGISTRE.length} />
            <StatTile
              libelle="Étiquettes"
              valeur={IMAGES_REGISTRE.reduce((a, i) => a + i.etiquettes, 0)}
            />
            <StatTile
              libelle="Volume"
              valeur={goHumain(IMAGES_REGISTRE.reduce((a, i) => a + i.taille, 0))}
            />
            <StatTile
              libelle="CVE élevées ouvertes"
              valeur={IMAGES_REGISTRE.reduce((a, i) => a + i.cveElevees, 0)}
              ton="err"
            />
          </div>

          <Card>
            <CardHeader
              titre="Dépôts d’images"
              sousTitre="Chaque poussée déclenche un scan de vulnérabilités."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Dépôt', 'Étiquettes', 'Volume', 'CVE élevées', 'CVE moyennes', 'Dernière poussée'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {IMAGES_REGISTRE.map((i) => (
                    <tr key={i.depot} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{i.depot}</td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">{i.etiquettes}</td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                        {goHumain(i.taille)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={i.cveElevees > 0 ? 'err' : 'ok'} size="sm">
                          {i.cveElevees}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={i.cveMoyennes > 5 ? 'warn' : 'neutral'} size="sm">
                          {i.cveMoyennes}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-g-700">
                        {dateCourte(i.derniere)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 border-t border-g-100 pt-4">
              <MicroLabel className="mb-2">Rétention des étiquettes</MicroLabel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Conserver au minimum">
                  <Input type="number" defaultValue={10} suffix="étiquettes" />
                </Field>
                <Field label="Purger au-delà de">
                  <Input type="number" defaultValue={90} suffix="jours" />
                </Field>
                <Field label="Étiquettes protégées" hint="jamais purgées">
                  <Input defaultValue="v*, latest, stable" className="font-mono" />
                </Field>
              </div>
            </div>
          </Card>

          {IMAGES_REGISTRE.some((i) => i.cveElevees > 0) && (
            <Callout ton="err" titre="Des CVE de gravité élevée sont ouvertes">
              <span className="font-mono text-[12px]">dba/batch-worker</span> porte deux
              vulnérabilités élevées, et <span className="font-mono text-[12px]">dba/analytics</span>{' '}
              une. Nous n’interdisons pas leur déploiement — ce serait vous bloquer sans vous aider —
              mais l’étape d’analyse DevSecOps du pipeline les signale à chaque déploiement, avec le
              correctif à appliquer.
            </Callout>
          )}
        </div>
      )}

      {/* Accès */}
      {onglet === 'acces' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Correspondance des rôles Synelia vers les rôles Kubernetes"
              sousTitre="L’authentification passe par OIDC : vos utilisateurs se connectent avec leur identité Synelia, et leurs droits Kubernetes en découlent."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Rôle Synelia', 'ClusterRole Kubernetes', 'Namespaces accessibles'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MAPPING_ROLES.map((m) => (
                    <tr key={m.role} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <Badge tone="violet" size="sm">
                          {ROLE_LABEL[m.role]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-ink">{m.k8s}</td>
                      <td className="px-3 py-2.5 text-[12.5px] text-g-700">{m.namespaces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Namespaces par environnement"
              sousTitre="Un namespace par environnement applicatif, avec quotas et politiques réseau."
            />
            <div className="space-y-2">
              {(cluster.applicationId
                ? ['analytics-prod', 'analytics-preprod', 'analytics-dev', 'kube-system']
                : ['default', 'kube-system']
              ).map((ns) => (
                <div
                  key={ns}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[12.5px] font-semibold text-ink">
                      {ns}
                    </span>
                    <span className="block text-[11px] text-g-500">
                      {ns === 'kube-system'
                        ? 'Système — géré par Synelia, non modifiable'
                        : `Quota : 8 vCPU · 32 Go · 20 pods`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {ns === 'kube-system' ? (
                      <Badge tone="neutral" size="sm">
                        Réservé
                      </Badge>
                    ) : (
                      <>
                        <Badge tone="ok" size="sm">
                          NetworkPolicy active
                        </Badge>
                        <BoutonFormulaire
                          libelle="Quotas"
                          variant="ghost"
                          action="espace.quota.update"
                          titre={`Quotas du namespace ${ns}`}
                          description="Le quota borne ce que le namespace peut consommer sur le cluster. Il ne réserve rien : c’est un plafond, pas une garantie."
                          champs={[
                            { id: 'vcpu', label: 'vCPU', type: 'nombre', demi: true, min: 1 },
                            { id: 'ram', label: 'Mémoire', type: 'nombre', demi: true, min: 1, suffixe: 'Go' },
                            { id: 'pods', label: 'Pods', type: 'nombre', demi: true, min: 1 },
                          ]}
                          valeursDepart={{ vcpu: 8, ram: 32, pods: 20 }}
                          operation={(v) => ({
                            titre: `Quotas de ${ns} enregistrés`,
                            detail: `${v.vcpu} vCPU · ${v.ram} Go · ${v.pods} pods`,
                          })}
                        />
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="Isolation réseau entre namespaces">
              Une NetworkPolicy par défaut refuse le trafic entrant inter-namespace. Vos
              environnements sont donc isolés les uns des autres, même sur un cluster partagé — un
              pod de développement ne peut pas joindre la base de production.
            </Callout>
          </Card>

          <Card>
            <CardHeader titre="Options d’accès" />
            <div className="space-y-3.5">
              <Switch
                checked={oidcObligatoire}
                onChange={(v) =>
                  executer({
                    action: 'espace.quota.update',
                    ton: v ? 'ok' : 'warn',
                    titre: v
                      ? 'Authentification OIDC obligatoire'
                      : 'Jetons de compte de service autorisés',
                    detail: v
                      ? 'Les accès expirent avec la session Synelia.'
                      : 'Un jeton statique ne s’éteint pas au départ d’une personne : à éviter.',
                    effet: () => setOidcObligatoire(v),
                  })
                }
                label="Authentification OIDC obligatoire"
                description="Aucun jeton de compte de service statique n’est distribué. Les accès expirent avec la session Synelia."
              />
              <Switch
                checked={auditApi}
                onChange={(v) =>
                  executer({
                    action: 'espace.quota.update',
                    ton: v ? 'ok' : 'warn',
                    titre: v ? 'Accès à l’API journalisés' : 'Journalisation de l’API coupée',
                    effet: () => setAuditApi(v),
                  })
                }
                label="Journaliser les accès à l’API dans l’audit"
                description="Chaque appel modifiant une ressource apparaît dans votre journal d’audit, avec l’acteur et l’objet visé."
              />
              <Switch
                checked={apiPublique}
                onChange={(v) =>
                  executer({
                    action: 'espace.quota.update',
                    ton: v ? 'warn' : 'ok',
                    titre: v ? 'API exposée sur Internet' : 'API ramenée aux réseaux privés',
                    detail: v
                      ? 'Ajoutez une liste d’adresses autorisées : sans elle, le serveur d’API est joignable du monde entier.'
                      : 'L’accès depuis un poste passe désormais par le VPN de l’espace.',
                    effet: () => setApiPublique(v),
                  })
                }
                label="Exposer l’API sur Internet"
                description="Par défaut, l’API n’est joignable que depuis vos réseaux privés et le pool VPN. L’exposition publique élargit fortement la surface d’attaque."
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
