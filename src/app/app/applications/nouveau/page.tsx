'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, TVA_PCT } from '@/lib/format'
import { ESPACES, K8S_CLUSTERS, PROJETS, ZONE_APPLICATIVE } from '@/lib/mock'
import { SITE_LABEL, type EspaceCloud, type K8sCluster, type Projet } from '@/lib/types'
import { MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { CostPreview, WizardShell } from '@/components/composition/flow'
import { useApp, useEspace } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { creerRessource, estActif, estTravail, suivreTravail } from '@/lib/api/client'

const ETAPES = [
  { numero: 1, titre: 'Projet' },
  { numero: 2, titre: 'Infrastructure' },
  { numero: 3, titre: 'Récapitulatif' },
]

/**
 * Tailles prédéfinies du cluster dédié — le pendant simplifié des pools de
 * `/app/kubernetes/new` : au moment de créer un projet, on choisit un gabarit,
 * pas un plan de pools. Ce niveau de détail reste accessible plus tard depuis
 * la fiche du cluster.
 */
const TAILLES_CLUSTER = [
  {
    id: 'petit',
    nom: 'Petit',
    modeCp: 'single' as const,
    noeuds: 1,
    flavor: '4 vCPU · 8 Go',
    vcpu: 4,
    ramGo: 8,
    diskGo: 60,
    prixNoeud: 7800,
  },
  {
    id: 'moyen',
    nom: 'Moyen',
    modeCp: 'ha' as const,
    noeuds: 3,
    flavor: '8 vCPU · 16 Go',
    vcpu: 8,
    ramGo: 16,
    diskGo: 100,
    prixNoeud: 15600,
  },
  {
    id: 'grand',
    nom: 'Grand',
    modeCp: 'ha' as const,
    noeuds: 5,
    flavor: '16 vCPU · 32 Go',
    vcpu: 16,
    ramGo: 32,
    diskGo: 150,
    prixNoeud: 27000,
  },
]

const COUT_LB = 18000

export default function NouveauProjet() {
  const router = useRouter()
  const { pousser } = useApp()
  const espaceCourant = useEspace()
  const projets = useCollection<Projet>('projets', PROJETS)
  const grappes = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  const espacesCol = useCollection<EspaceCloud>('espaces', ESPACES)
  const { lancerJob, integrerTravail } = useAtelier()

  const [etape, setEtape] = useState(1)
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [etiquettes, setEtiquettes] = useState<string[]>([])

  const [espaceId, setEspaceId] = useState(espaceCourant.id)
  const [clusterMode, setClusterMode] = useState<'nouveau' | 'existant'>('nouveau')
  const [tailleClusterId, setTailleClusterId] = useState('moyen')
  const clustersDisponiblesInitial = grappes.items.filter((c) => c.espaceId === espaceCourant.id)
  const [clusterExistantId, setClusterExistantId] = useState(clustersDisponiblesInitial[0]?.id ?? '')

  const [conditions, setConditions] = useState(false)

  const espace = espacesCol.items.find((e) => e.id === espaceId) ?? espaceCourant
  const clustersDisponibles = grappes.items.filter((c) => c.espaceId === espaceId)
  const clusterExistantChoisi = clustersDisponibles.find((c) => c.id === clusterExistantId)
  const tailleChoisie = TAILLES_CLUSTER.find((t) => t.id === tailleClusterId)!

  const lignesCout =
    clusterMode === 'nouveau'
      ? [
          {
            libelle: `Control plane ${tailleChoisie.modeCp === 'ha' ? 'haute disponibilité' : 'mono-master'}`,
            detail:
              tailleChoisie.modeCp === 'ha'
                ? '3 masters répartis · SLA 99,95 %'
                : '1 master · SLA 99,5 %',
            montant: tailleChoisie.modeCp === 'ha' ? 42000 : 14000,
          },
          {
            libelle: `Nœuds workers · ${tailleChoisie.noeuds} nœuds`,
            detail: `${tailleChoisie.noeuds} nœuds · ${tailleChoisie.vcpu} vCPU · ${tailleChoisie.ramGo} Go`,
            montant: tailleChoisie.noeuds * tailleChoisie.prixNoeud,
          },
          {
            libelle: 'Load balancer L7 dédié',
            detail: 'Provisionné automatiquement — porte d’entrée du projet',
            montant: COUT_LB,
          },
        ]
      : [
          {
            libelle: 'Load balancer L7 dédié',
            detail: `Provisionné automatiquement sur ${clusterExistantChoisi?.nom ?? 'le cluster partagé'} — porte d’entrée du projet`,
            montant: COUT_LB,
          },
        ]

  const peutContinuer =
    etape === 1
      ? nom.trim().length > 0
      : etape === 2
        ? clusterMode === 'nouveau' || Boolean(clusterExistantChoisi)
        : conditions

  const creerLeProjet = () => {
    const idProjetMock = projets.identifiant('prj')
    const nomCluster = `k8s-${nom.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`

    if (estActif()) {
      // Le cluster part en premier quand il est nouveau : la création du
      // projet le référence, que son provisioning soit déjà terminé ou
      // encore suivi à part (`202`).
      const rattacherProjet = (clusterId: string) => {
        creerRessource('/projets', {
          nom,
          description,
          etiquettes,
          espaceId: espace.id,
          clusterId,
          environnements: ['Production'],
        }).then((r) => {
          if (estTravail(r)) {
            const suivi = integrerTravail(r)
            suivreTravail(suivi, (t) => integrerTravail(t))
          }
          projets.recharger()
        })
      }

      if (clusterMode === 'nouveau') {
        creerRessource('/kubernetes', {
          espaceId: espace.id,
          nom: nomCluster,
          version: '1.31.2',
          site: espace.site,
          controlPlane: {
            mode: tailleChoisie.modeCp,
            nodes: tailleChoisie.modeCp === 'ha' ? 3 : 1,
          },
          pools: [
            {
              nom: 'pool-standard',
              nodes: tailleChoisie.noeuds,
              flavor: tailleChoisie.flavor,
              diskGo: tailleChoisie.diskGo,
            },
          ],
        }).then((c) => {
          grappes.recharger()
          rattacherProjet((c as { id: string }).id)
        })
      } else {
        rattacherProjet(clusterExistantChoisi!.id)
      }

      pousser({
        ton: 'info',
        titre: `Création de ${nom} lancée`,
        detail:
          clusterMode === 'nouveau'
            ? 'Le cluster est provisionné, puis le load balancer et la zone applicative. Suivi dans le centre de tâches.'
            : 'Le load balancer et la zone applicative sont en cours de provisionnement. Suivi dans le centre de tâches.',
      })
      router.push('/app/applications/projets')
      return
    }

    let clusterId = clusterExistantChoisi?.id ?? ''
    if (clusterMode === 'nouveau') {
      const idCluster = grappes.identifiant('k8s')
      grappes.creer({
        id: idCluster,
        espaceId: espace.id,
        nom: nomCluster,
        version: '1.31.2',
        controlPlane: { mode: tailleChoisie.modeCp, nodes: tailleChoisie.modeCp === 'ha' ? 3 : 1 },
        pools: [
          {
            nom: 'pool-standard',
            nodes: tailleChoisie.noeuds,
            flavor: tailleChoisie.flavor,
            diskGo: tailleChoisie.diskGo,
            type: 'standard',
          },
        ],
        modules: ['ingress-nginx 1.11.2', 'cert-manager 1.15.3'],
        statut: 'provisioning',
        site: espace.site,
      })
      lancerJob({
        workflow: 'k8s.create',
        cible: `${nomCluster} · ${SITE_LABEL[espace.site]}`,
        alFin: () => grappes.modifier(idCluster, { statut: 'running' }),
      })
      clusterId = idCluster
    }

    projets.creer({
      id: idProjetMock,
      nom,
      description,
      espaceId: espace.id,
      cree: MAINTENANT.slice(0, 10),
      etiquettes,
      clusterId,
      environnements: ['Production'],
      variables: [],
    })
    pousser({
      ton: 'info',
      titre: `Création de ${nom} lancée`,
      detail:
        clusterMode === 'nouveau'
          ? 'Le cluster est provisionné, puis le load balancer et la zone applicative.'
          : 'Le load balancer et la zone applicative sont en cours de provisionnement.',
    })
    lancerJob({
      workflow: 'projet.create',
      cible: nom,
      alFin: () => {
        pousser({
          ton: 'ok',
          titre: `${nom} est prêt`,
          detail: 'Vous pouvez déployer votre premier service.',
        })
      },
    })
    router.push(`/app/applications/projets/${idProjetMock}`)
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
              <Petit cle="Étiquettes" valeur={String(etiquettes.length)} />
              <Petit cle="Espace Cloud" valeur={espace.code} mono />
              <Petit
                cle="Cluster"
                valeur={
                  clusterMode === 'nouveau' ? `Nouveau · ${tailleChoisie.nom}` : 'Existant'
                }
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
            onClick={() =>
              etape === 1 ? router.push('/app/applications/projets') : setEtape(etape - 1)
            }
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
            Créer un projet ne facture rien pour ses services : c’est un contenant. La
            facturation des services commence au premier déploiement, au prorata journalier. Le
            cluster et le load balancer dédiés, eux, sont provisionnés — et facturés — dès la
            création.
          </Callout>

          <Field
            label="Nom du projet"
            required
            hint="Visible par tous les membres qui ont accès au projet."
          >
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="font-mono"
              placeholder="portail-client"
            />
          </Field>

          <Field
            label="Description"
            hint="Une phrase suffit. Elle répond à « à quoi sert ce système ? » pour la personne qui prendra l’astreinte."
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>

          <Field
            label="Étiquettes"
            hint="Entrée ou virgule pour ajouter, Retour arrière pour retirer la dernière. Servent à ventiler la dépense et à retrouver le projet dans la recherche."
          >
            <ChampEtiquettes valeurs={etiquettes} onChange={setEtiquettes} />
          </Field>
        </div>
      )}

      {/* Étape 2 — Infrastructure */}
      {etape === 2 && (
        <div className="space-y-4">
          <Field label="Espace Cloud">
            <Select
              value={espaceId}
              onChange={(e) => {
                const id = e.target.value
                setEspaceId(id)
                const dispo = grappes.items.filter((c) => c.espaceId === id)
                setClusterExistantId(dispo[0]?.id ?? '')
                if (dispo.length === 0) setClusterMode('nouveau')
              }}
            >
              {espacesCol.items.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {SITE_LABEL[e.site]} · {e.quota.vcpu - e.usage.vcpu} vCPU libres
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <MicroLabel className="mb-1.5">Cluster Kubernetes</MicroLabel>
            <p className="mb-2.5 text-[12.5px] leading-relaxed text-g-700">
              Un projet est toujours servi par un cluster Kubernetes dédié — jamais par des
              machines virtuelles choisies à la main.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setClusterMode('nouveau')}
                className={cn(
                  'flex flex-col rounded-[10px] border-2 bg-white p-4 text-left transition-colors',
                  clusterMode === 'nouveau' ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                )}
              >
                <span className="type-h3">Nouveau cluster</span>
                <span className="mt-2 text-[12.5px] leading-relaxed text-g-700">
                  Provisionné à la création, rien que pour ce projet.
                </span>
              </button>
              <button
                type="button"
                disabled={clustersDisponibles.length === 0}
                onClick={() => setClusterMode('existant')}
                className={cn(
                  'flex flex-col rounded-[10px] border-2 bg-white p-4 text-left transition-colors',
                  clusterMode === 'existant' ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                  clustersDisponibles.length === 0 && 'cursor-not-allowed opacity-55 hover:border-g-300',
                )}
              >
                <span className="type-h3">Cluster existant</span>
                <span className="mt-2 text-[12.5px] leading-relaxed text-g-700">
                  {clustersDisponibles.length === 0
                    ? 'Aucun cluster dans cet Espace.'
                    : 'Partagé avec d’autres projets de cet Espace.'}
                </span>
              </button>
            </div>
          </div>

          {clusterMode === 'nouveau' ? (
            <Field
              label="Taille du cluster"
              hint="Ajustable ensuite — pools, autoscaling — depuis Kubernetes."
            >
              <Select value={tailleClusterId} onChange={(e) => setTailleClusterId(e.target.value)}>
                {TAILLES_CLUSTER.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom} · {t.noeuds} nœuds · {t.vcpu} vCPU · {t.ramGo} Go
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Cluster à rejoindre">
              <Select
                value={clusterExistantId}
                onChange={(e) => setClusterExistantId(e.target.value)}
              >
                {clustersDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} · v{c.version}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Card>
            <CardHeader titre="Load balancer L7 dédié — automatique" />
            <p className="text-[12.5px] leading-relaxed text-g-700">
              Un load balancer public, avec certificat automatique, est provisionné en même temps
              que le projet et pointé sur l’ingress du cluster. C’est la porte d’entrée par
              laquelle tous les services du projet seront joignables — rien à configurer.
            </p>
          </Card>
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
                { cle: 'Étiquettes', valeur: etiquettes.join(', ') || 'Aucune' },
                { cle: 'Espace Cloud', valeur: espace.code },
                {
                  cle: 'Cluster Kubernetes',
                  valeur:
                    clusterMode === 'nouveau'
                      ? `Nouveau (${tailleChoisie.nom} · ${tailleChoisie.noeuds} nœuds · ${tailleChoisie.vcpu} vCPU · ${tailleChoisie.ramGo} Go)`
                      : `${clusterExistantChoisi?.nom ?? '—'} · v${clusterExistantChoisi?.version ?? ''}`,
                },
                { cle: 'Load balancer', valeur: 'L7 public, dédié, certificat automatique' },
                { cle: 'Environnement de départ', valeur: 'Production' },
                {
                  cle: 'Zone applicative',
                  valeur: <span className="font-mono">{ZONE_APPLICATIVE.wildcard}</span>,
                },
              ]}
            />
          </Card>

          <CostPreview lignes={lignesCout} />

          <Card>
            <Checkbox
              checked={conditions}
              onChange={(e) => setConditions(e.target.checked)}
              label="Je confirme la création de ce projet"
              description={`${
                clusterMode === 'nouveau'
                  ? 'Le cluster et le load balancer démarrent leur provisionnement immédiatement.'
                  : 'Le load balancer démarre son provisionnement immédiatement.'
              } Montants hors taxes, TVA ${TVA_PCT} % appliquée à la facturation.`}
            />
          </Card>
        </div>
      )}
    </WizardShell>
  )
}

function ChampEtiquettes({
  valeurs,
  onChange,
}: {
  valeurs: string[]
  onChange: (v: string[]) => void
}) {
  const [saisie, setSaisie] = useState('')

  const ajouter = (brut: string) => {
    const v = brut.trim()
    if (!v || valeurs.includes(v)) return
    onChange([...valeurs, v])
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-[6px] border border-g-300 bg-white px-2 py-1.5 focus-within:border-p-600 focus-within:ring-2 focus-within:ring-p-100">
      {valeurs.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 rounded-full bg-g-100 px-2 py-0.5 text-[12px] font-semibold text-g-700"
        >
          {v}
          <button
            type="button"
            aria-label={`Retirer l’étiquette ${v}`}
            onClick={() => onChange(valeurs.filter((x) => x !== v))}
            className="text-g-500 hover:text-ink"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            ajouter(saisie)
            setSaisie('')
          } else if (e.key === 'Backspace' && saisie === '' && valeurs.length > 0) {
            onChange(valeurs.slice(0, -1))
          }
        }}
        className="h-6 min-w-[100px] flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-g-500"
        placeholder={valeurs.length === 0 ? 'production, interne…' : undefined}
      />
    </div>
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
