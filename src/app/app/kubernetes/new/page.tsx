'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, money, num } from '@/lib/format'
import { SITE_LABEL, type EspaceCloud, type K8sCluster, type Site } from '@/lib/types'
import { ESPACES, K8S_CLUSTERS } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Checkbox, Field, Input, SegmentedControl, Select, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { CostPreview, WizardShell } from '@/components/composition/flow'
import { useApp, useEspace } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

const ETAPES = [
  { numero: 1, titre: 'Version et site' },
  { numero: 2, titre: 'Control plane' },
  { numero: 3, titre: 'Pools de workers' },
  { numero: 4, titre: 'Modules' },
  { numero: 5, titre: 'Récapitulatif' },
]

const VERSIONS = [
  { id: '1.31.2', nom: '1.31.2', detail: 'Dernière version qualifiée · support jusqu’en octobre 2027' },
  { id: '1.30.4', nom: '1.30.4', detail: 'Version précédente · support jusqu’en juin 2027' },
  { id: '1.29.6', nom: '1.29.6', detail: 'Fin de support en février 2027 · migration à prévoir' },
]

const GABARITS = [
  { id: '4 vCPU · 8 Go', vcpu: 4, ram: 8, prix: 7800 },
  { id: '8 vCPU · 16 Go', vcpu: 8, ram: 16, prix: 15600 },
  { id: '8 vCPU · 32 Go', vcpu: 8, ram: 32, prix: 24800 },
  { id: '16 vCPU · 64 Go', vcpu: 16, ram: 64, prix: 46000 },
]

const MODULES = [
  {
    id: 'ingress-nginx 4.11.2',
    nom: 'ingress-nginx',
    role: 'Contrôleur d’entrée HTTP/HTTPS',
    prix: 0,
    conseille: true,
  },
  {
    id: 'cert-manager 1.15.3',
    nom: 'cert-manager',
    role: 'Émission et renouvellement automatiques des certificats',
    prix: 0,
    conseille: true,
  },
  {
    id: 'external-dns 0.14.2',
    nom: 'external-dns',
    role: 'Synchronise les enregistrements DNS depuis vos Ingress',
    prix: 0,
    conseille: false,
  },
  {
    id: 'argocd 2.12.3',
    nom: 'argocd',
    role: 'Livraison continue en GitOps',
    prix: 0,
    conseille: false,
  },
  {
    id: 'rook-ceph 1.15.1',
    nom: 'rook-ceph',
    role: 'Stockage persistant distribué dans le cluster',
    prix: 18000,
    conseille: false,
  },
  {
    id: 'velero 1.14.1',
    nom: 'velero',
    role: 'Sauvegarde et restauration des objets du cluster',
    prix: 12000,
    conseille: true,
  },
]

interface PoolBrouillon {
  id: string
  nom: string
  type: 'standard' | 'gpu' | 'memory' | 'preemptible'
  flavor: string
  nodes: number
  diskGo: number
  autoscale: boolean
  min: number
  max: number
}

const POOLS_DEPART: PoolBrouillon[] = [
  {
    id: 'p1',
    nom: 'pool-standard',
    type: 'standard',
    flavor: '8 vCPU · 16 Go',
    nodes: 3,
    diskGo: 100,
    autoscale: true,
    min: 3,
    max: 8,
  },
]

export default function NouveauCluster() {
  const router = useRouter()
  const { pousser } = useApp()
  const espaceCourant = useEspace()
  const grappes = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  const espacesCol = useCollection<EspaceCloud>('espaces', ESPACES)
  const { lancerJob } = useAtelier()
  const executer = useOperation()

  const [etape, setEtape] = useState(1)
  const [nom, setNom] = useState('k8s-prod-02')
  const [version, setVersion] = useState('1.31.2')
  const [espaceId, setEspaceId] = useState(espaceCourant.id)
  const [site, setSite] = useState<Site>(espaceCourant.site)
  const [modeCp, setModeCp] = useState<'single' | 'ha'>('ha')
  const [apiPrivee, setApiPrivee] = useState(true)
  const [pools, setPools] = useState<PoolBrouillon[]>(POOLS_DEPART)
  const [modules, setModules] = useState<string[]>(MODULES.filter((m) => m.conseille).map((m) => m.id))
  const [conditions, setConditions] = useState(false)

  const espace = espacesCol.items.find((e) => e.id === espaceId) ?? espaceCourant

  const noeuds = pools.reduce((a, p) => a + p.nodes, 0)
  const vcpu = pools.reduce((a, p) => {
    const g = GABARITS.find((x) => x.id === p.flavor)
    return a + (g?.vcpu ?? 8) * p.nodes
  }, 0)
  const ram = pools.reduce((a, p) => {
    const g = GABARITS.find((x) => x.id === p.flavor)
    return a + (g?.ram ?? 16) * p.nodes
  }, 0)

  const coutWorkers = pools.reduce((a, p) => {
    const g = GABARITS.find((x) => x.id === p.flavor)
    const prix = g?.prix ?? 15600
    // Un nœud préemptible est facturé 40 % du prix d'un nœud garanti.
    return a + Math.round(prix * p.nodes * (p.type === 'preemptible' ? 0.4 : 1))
  }, 0)
  const coutControlPlane = modeCp === 'ha' ? 42000 : 14000
  const coutModules = modules.reduce(
    (a, id) => a + (MODULES.find((m) => m.id === id)?.prix ?? 0),
    0,
  )

  const lignesCout = [
    {
      libelle: `Control plane ${modeCp === 'ha' ? 'haute disponibilité' : 'mono-master'}`,
      detail: modeCp === 'ha' ? '3 masters répartis · SLA 99,95 %' : '1 master · SLA 99,5 %',
      montant: coutControlPlane,
    },
    {
      libelle: `Nœuds workers · ${noeuds} nœuds`,
      detail: `${vcpu} vCPU · ${num(ram)} Go de mémoire`,
      montant: coutWorkers,
    },
    ...(coutModules > 0
      ? [
          {
            libelle: 'Modules facturés',
            detail: modules
              .filter((id) => (MODULES.find((m) => m.id === id)?.prix ?? 0) > 0)
              .map((id) => MODULES.find((m) => m.id === id)?.nom)
              .join(', '),
            montant: coutModules,
          },
        ]
      : []),
  ]

  const quotaSuffisant =
    espace.usage.vcpu + vcpu <= espace.quota.vcpu && espace.usage.ramGo + ram <= espace.quota.ramGo

  const nomsUniques = new Set(pools.map((p) => p.nom)).size === pools.length
  const peutContinuer =
    etape === 3
      ? pools.length > 0 && nomsUniques
      : etape === 5
        ? conditions && quotaSuffisant
        : true

  const modifierPool = (id: string, patch: Partial<PoolBrouillon>) =>
    setPools((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const creerLeCluster = () => {
    // En mode API la création part au backend (`202` + travail suivi) ; sinon
    // la maquette simule, comme avant.
    if (estActif()) {
      executer({
        action: 'vm.create_delete',
        titre: `Création de ${nom} lancée`,
        detail: 'Le control plane est provisionné avant les pools. Suivi dans le centre de tâches.',
        appel: () =>
          creerRessource('/kubernetes', {
            espaceId: espace.id,
            nom,
            version,
            site,
            controlPlane: { mode: modeCp, nodes: modeCp === 'ha' ? 3 : 1 },
            pools: pools.map((p) => ({
              nom: p.nom,
              nodes: p.nodes,
              flavor: p.flavor,
              diskGo: p.diskGo,
              type: p.type,
              autoscale: p.autoscale ? { min: p.min, max: p.max } : undefined,
            })),
          }),
        effetFinal: () => grappes.recharger(),
      })
      return
    }
    const cluster: K8sCluster = {
      id: grappes.identifiant('k8s'),
      espaceId: espace.id,
      nom,
      version,
      controlPlane: { mode: modeCp, nodes: modeCp === 'ha' ? 3 : 1 },
      pools: pools.map((p) => ({
        nom: p.nom,
        nodes: p.nodes,
        flavor: p.flavor,
        diskGo: p.diskGo,
        type: p.type,
        autoscale: p.autoscale ? { min: p.min, max: p.max } : undefined,
        taints: p.type === 'preemptible' ? ['preemptible=true:NoSchedule'] : undefined,
        labels: p.type === 'gpu' ? ['accelerator=nvidia'] : undefined,
      })),
      modules,
      statut: 'provisioning',
      site,
    }

    grappes.creer(cluster)
    pousser({
      ton: 'info',
      titre: `Création de ${nom} lancée`,
      detail: 'Le control plane est provisionné avant les pools. Suivi dans le centre de tâches.',
    })
    lancerJob({
      workflow: 'k8s.create',
      cible: `${nom} · ${site}`,
      alFin: () => {
        grappes.modifier(cluster.id, { statut: 'running' })
        pousser({
          ton: 'ok',
          titre: `${nom} est prêt`,
          detail: 'Le kubeconfig est téléchargeable depuis la fiche du cluster.',
        })
      },
    })
    router.push('/app/kubernetes')
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
            <MicroLabel>Configuration</MicroLabel>
            <dl className="mt-2.5 space-y-1.5">
              <Petit cle="Nom" valeur={nom} mono />
              <Petit cle="Version" valeur={`Kubernetes ${version}`} />
              <Petit cle="Espace Cloud" valeur={espace.code} mono />
              <Petit cle="Site" valeur={SITE_LABEL[site]} />
              <Petit cle="Control plane" valeur={modeCp === 'ha' ? '3 masters' : '1 master'} />
              <Petit cle="Pools" valeur={String(pools.length)} />
              <Petit cle="Nœuds" valeur={String(noeuds)} />
              <Petit cle="Modules" valeur={String(modules.length)} />
            </dl>
            <div className="mt-3 border-t border-g-100 pt-3">
              <MicroLabel className="mb-1.5">Impact sur le quota</MicroLabel>
              <p className="tnum text-[12px] text-g-700">
                vCPU : {espace.usage.vcpu} → {espace.usage.vcpu + vcpu} sur {espace.quota.vcpu}
              </p>
              <p className="tnum text-[12px] text-g-700">
                Mémoire : {num(espace.usage.ramGo)} → {num(espace.usage.ramGo + ram)} sur{' '}
                {num(espace.quota.ramGo)} Go
              </p>
              {!quotaSuffisant && (
                <p className="mt-1.5 text-[12px] font-semibold text-err">
                  Quota insuffisant. Réduisez les pools ou étendez la capacité de l’espace.
                </p>
              )}
            </div>
          </Card>
          <CostPreview lignes={lignesCout} />
        </>
      }
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => (etape === 1 ? router.push('/app/kubernetes') : setEtape(etape - 1))}
          >
            {etape === 1 ? 'Annuler' : 'Précédent'}
          </Button>
          {etape < 5 ? (
            <Button disabled={!peutContinuer} onClick={() => setEtape(etape + 1)}>
              Continuer
            </Button>
          ) : (
            <Button disabled={!peutContinuer} onClick={creerLeCluster}>
              Créer le cluster
            </Button>
          )}
        </>
      }
    >
      {/* Étape 1 — Version et site */}
      {etape === 1 && (
        <div className="space-y-4">
          <Field label="Nom du cluster" required hint="visible dans le kubeconfig et les journaux">
            <Input value={nom} onChange={(e) => setNom(e.target.value)} className="font-mono" />
          </Field>

          <Field label="Espace Cloud de destination">
            <Select
              value={espaceId}
              onChange={(e) => {
                const cible = espacesCol.items.find((x) => x.id === e.target.value)
                setEspaceId(e.target.value)
                if (cible) setSite(cible.site)
              }}
            >
              {espacesCol.items.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {SITE_LABEL[e.site]} · {e.quota.vcpu - e.usage.vcpu} vCPU disponibles
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <MicroLabel className="mb-2">Version de Kubernetes</MicroLabel>
            <div className="space-y-2">
              {VERSIONS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVersion(v.id)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-[8px] border px-3.5 py-3 text-left transition-colors',
                    version === v.id
                      ? 'border-p-600 bg-p-050'
                      : 'border-g-300 hover:border-p-400 hover:bg-g-050',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[13px] font-semibold text-ink">
                      Kubernetes {v.nom}
                    </span>
                    <span className="block text-[12px] text-g-500">{v.detail}</span>
                  </span>
                  {version === v.id && (
                    <Badge tone="violet" size="sm">
                      Choisie
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Callout ton="violet" titre="Ce que nous exploitons, ce que vous gardez">
            Nous opérons le control plane, l’etcd et ses sauvegardes, et nous pilotons les montées de
            version mineure avec vous. Vous gardez l’API complète, vos manifestes, vos charts : le
            portail ne dicte pas ce que vous déployez et n’ajoute aucun opérateur non annoncé.
          </Callout>
        </div>
      )}

      {/* Étape 2 — Control plane */}
      {etape === 2 && (
        <div className="space-y-4">
          <div>
            <MicroLabel className="mb-2">Mode du control plane</MicroLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    mode: 'single' as const,
                    titre: 'Mono-master',
                    prix: 14000,
                    sla: 'SLA 99,5 %',
                    pour: 'Développement, recette, charges non critiques',
                    contre:
                      'Une maintenance du master rend l’API indisponible quelques minutes. Les charges déjà démarrées continuent de tourner.',
                  },
                  {
                    mode: 'ha' as const,
                    titre: 'Haute disponibilité',
                    prix: 42000,
                    sla: 'SLA 99,95 %',
                    pour: 'Production',
                    contre:
                      'Trois masters répartis sur des hôtes distincts du site. L’API reste joignable pendant une maintenance.',
                  },
                ] as const
              ).map((o) => (
                <button
                  key={o.mode}
                  type="button"
                  onClick={() => setModeCp(o.mode)}
                  className={cn(
                    'rounded-[10px] border px-4 py-3.5 text-left transition-colors',
                    modeCp === o.mode
                      ? 'border-p-600 bg-p-050'
                      : 'border-g-300 hover:border-p-400 hover:bg-g-050',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-ink">{o.titre}</span>
                    <Badge tone={o.mode === 'ha' ? 'ok' : 'neutral'} size="sm">
                      {o.sla}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-[12px] font-semibold text-p-700">
                    {money(o.prix)} / mois
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-relaxed text-g-700">
                    Pour : {o.pour}
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-g-500">
                    {o.contre}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader
              titre="Exposition de l’API"
              sousTitre="Le serveur d’API est joignable soit depuis vos réseaux privés uniquement, soit depuis Internet avec filtrage."
            />
            <Switch
              checked={apiPrivee}
              onChange={setApiPrivee}
              label="API accessible uniquement depuis les réseaux privés de l’espace"
              description="Recommandé. L’accès depuis un poste passe alors par le VPN de l’espace. Sinon, l’API est exposée avec une liste d’adresses autorisées."
            />
          </Card>

          <KeyValueList
            colonnes={2}
            items={[
              { cle: 'Sauvegarde etcd', valeur: 'Toutes les 6 heures, rétention 14 jours' },
              { cle: 'Authentification', valeur: 'OIDC fédéré sur votre identité Synelia' },
              { cle: 'Chiffrement des secrets', valeur: 'Au repos, clé gérée par Synelia' },
              { cle: 'Audit', valeur: 'Journal d’audit Kubernetes vers VictoriaLogs' },
            ]}
          />
        </div>
      )}

      {/* Étape 3 — Pools de workers */}
      {etape === 3 && (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-g-700">
            Un pool regroupe des nœuds de même gabarit. En séparer plusieurs permet de placer les
            charges par étiquette, de réserver les nœuds GPU, et d’isoler les nœuds préemptibles
            derrière un taint.
          </p>

          {pools.map((p, i) => (
            <Card key={p.id}>
              <CardHeader
                titre={`Pool ${i + 1}`}
                actions={
                  <IconButton
                    label={`Supprimer le pool ${p.nom}`}
                    size="sm"
                    disabled={pools.length === 1}
                    onClick={() => setPools((prev) => prev.filter((x) => x.id !== p.id))}
                  >
                    <Trash2 size={13} className="text-err" />
                  </IconButton>
                }
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nom du pool" required>
                  <Input
                    value={p.nom}
                    onChange={(e) => modifierPool(p.id, { nom: e.target.value })}
                    className="font-mono"
                  />
                </Field>
                <Field label="Type de nœuds">
                  <Select
                    value={p.type}
                    onChange={(e) =>
                      modifierPool(p.id, { type: e.target.value as PoolBrouillon['type'] })
                    }
                  >
                    <option value="standard">Standard</option>
                    <option value="memory">Optimisé mémoire</option>
                    <option value="gpu">GPU / vGPU</option>
                    <option value="preemptible">Préemptible — 40 % du prix</option>
                  </Select>
                </Field>
                <Field label="Gabarit">
                  <Select
                    value={p.flavor}
                    onChange={(e) => modifierPool(p.id, { flavor: e.target.value })}
                  >
                    {GABARITS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.id} · {money(g.prix)} / mois / nœud
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Disque par nœud">
                  <Input
                    type="number"
                    value={p.diskGo}
                    min={40}
                    max={2000}
                    suffix="Go"
                    onChange={(e) => modifierPool(p.id, { diskGo: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Nombre de nœuds">
                  <Input
                    type="number"
                    value={p.nodes}
                    min={1}
                    max={40}
                    onChange={(e) => modifierPool(p.id, { nodes: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Autoscaling">
                  <Switch
                    checked={p.autoscale}
                    onChange={(v) => modifierPool(p.id, { autoscale: v })}
                    label="Ajuster le nombre de nœuds automatiquement"
                  />
                </Field>
                {p.autoscale && (
                  <>
                    <Field label="Minimum de nœuds">
                      <Input
                        type="number"
                        value={p.min}
                        min={0}
                        max={p.max}
                        onChange={(e) => modifierPool(p.id, { min: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Maximum de nœuds">
                      <Input
                        type="number"
                        value={p.max}
                        min={p.min}
                        max={40}
                        onChange={(e) => modifierPool(p.id, { max: Number(e.target.value) })}
                      />
                    </Field>
                  </>
                )}
              </div>
              {p.type === 'preemptible' && (
                <Callout ton="warn" className="mt-3.5" titre="Nœuds préemptibles">
                  Ces nœuds peuvent être récupérés avec un préavis de trente secondes. Un taint{' '}
                  <span className="font-mono text-[12px]">preemptible=true:NoSchedule</span> est posé
                  automatiquement pour qu’aucun service synchrone n’y arrive par erreur.
                </Callout>
              )}
            </Card>
          ))}

          {!nomsUniques && (
            <Callout ton="err" titre="Deux pools portent le même nom">
              Les noms de pool servent de sélecteur de placement : ils doivent être distincts.
            </Callout>
          )}

          <Button
            variant="secondary"
            iconBefore={<Plus size={14} />}
            onClick={() =>
              setPools((prev) => [
                ...prev,
                {
                  id: `p${prev.length + 1}`,
                  nom: `pool-${prev.length + 1}`,
                  type: 'standard',
                  flavor: '8 vCPU · 16 Go',
                  nodes: 2,
                  diskGo: 100,
                  autoscale: false,
                  min: 2,
                  max: 6,
                },
              ])
            }
          >
            Ajouter un pool
          </Button>
        </div>
      )}

      {/* Étape 4 — Modules */}
      {etape === 4 && (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-g-700">
            Ces charts Helm sont préqualifiés : nous testons chaque version sur un cluster de
            référence avant de la proposer et nous nous engageons sur leur fonctionnement. Vous
            restez libre d’installer vos propres charts en parallèle — sans engagement de service
            dessus.
          </p>

          <div className="space-y-2">
            {MODULES.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-[8px] border border-g-300 px-3.5 py-3"
              >
                <Checkbox
                  checked={modules.includes(m.id)}
                  onChange={(e) =>
                    setModules((prev) =>
                      e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                    )
                  }
                  label={m.nom}
                  description={m.role}
                />
                <span className="flex shrink-0 items-center gap-2">
                  {m.conseille && (
                    <Badge tone="violet" size="sm">
                      Conseillé
                    </Badge>
                  )}
                  <Badge tone={m.prix > 0 ? 'warn' : 'neutral'} size="sm">
                    {m.prix > 0 ? `${money(m.prix)} / mois` : 'Inclus'}
                  </Badge>
                </span>
              </div>
            ))}
          </div>

          <Callout ton="info" titre="Sans ingress-nginx ni cert-manager">
            Vous devrez exposer vos services et gérer vos certificats vous-même. C’est un choix
            légitime si vous apportez votre propre contrôleur d’entrée ; sinon, gardez ces deux
            modules cochés.
          </Callout>
        </div>
      )}

      {/* Étape 5 — Récapitulatif */}
      {etape === 5 && (
        <div className="space-y-4">
          <Card>
            <CardHeader titre="Ce qui va être créé" />
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Nom', valeur: <span className="font-mono">{nom}</span> },
                { cle: 'Version', valeur: `Kubernetes ${version}` },
                { cle: 'Espace Cloud', valeur: espace.code },
                { cle: 'Site', valeur: SITE_LABEL[site] },
                {
                  cle: 'Control plane',
                  valeur:
                    modeCp === 'ha'
                      ? 'Haute disponibilité · 3 masters'
                      : 'Mono-master · 1 master',
                },
                {
                  cle: 'API',
                  valeur: apiPrivee ? 'Réseaux privés uniquement' : 'Exposée avec filtrage',
                },
                { cle: 'Nœuds workers', valeur: `${noeuds} nœuds · ${vcpu} vCPU · ${num(ram)} Go` },
                { cle: 'Modules', valeur: modules.length ? `${modules.length} modules` : 'Aucun' },
              ]}
            />
          </Card>

          <Card>
            <CardHeader titre="Pools" />
            <div className="space-y-2">
              {pools.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2"
                >
                  <span className="font-mono text-[13px] font-semibold text-ink">{p.nom}</span>
                  <span className="text-[12px] text-g-700">
                    {p.nodes} × {p.flavor} · {p.diskGo} Go
                    {p.autoscale ? ` · autoscaling ${p.min}→${p.max}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {!quotaSuffisant && (
            <Callout ton="err" titre="Quota insuffisant dans l’espace">
              Il manque{' '}
              {Math.max(0, espace.usage.vcpu + vcpu - espace.quota.vcpu)} vCPU et{' '}
              {Math.max(0, espace.usage.ramGo + ram - espace.quota.ramGo)} Go de mémoire. Étendez la
              capacité de {espace.code} ou réduisez les pools.
            </Callout>
          )}

          <Checkbox
            checked={conditions}
            onChange={(e) => setConditions(e.target.checked)}
            label="J’accepte la mise en facturation immédiate, au prorata du mois en cours"
            description={`Première échéance au 1er du mois suivant, calculée à partir du ${MAINTENANT.slice(8, 10)} du mois.`}
          />
        </div>
      )}
    </WizardShell>
  )
}

function Petit({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[12px] text-g-500">{cle}</dt>
      <dd
        className={cn('truncate text-right text-[12px] font-semibold text-ink', mono && 'font-mono')}
      >
        {valeur}
      </dd>
    </div>
  )
}
