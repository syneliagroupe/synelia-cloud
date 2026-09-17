'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  Camera,
  Copy,
  Maximize2,
  MonitorPlay,
  MoveRight,
  Power,
  RotateCw,
  Ruler,
  Trash2,
} from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { MAINTENANT, dateCourte, dateHeure, goHumain, num, pct, relatif } from '@/lib/format'
import {
  SITE_LABEL,
  type BackupPlan,
  type EspaceCloud,
  type PublicIP,
  type RestorePoint,
  type VM,
  type Volume,
} from '@/lib/types'
import {
  BACKUP_PLANS,
  ESPACES,
  EVENEMENTS_SUPERVISION,
  PUBLIC_IPS,
  RESTORE_POINTS,
  SECURITY_GROUPS,
  VMS,
  VOLUMES,
  hrefDuService,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { CopyField, GatedAction, Skeleton, Tabs } from '@/components/ui/display'
import { Field, Input, SegmentedControl, Select, Switch } from '@/components/ui/field'
import { ConfirmDialog, Drawer, Popover } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { HealthBadge, QuotaBar, StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { EventList, GrilleSparkCharts } from '@/components/business/observabilite'
import { useApp } from '@/components/app/contexte'
import { useCollection, useEntite } from '@/components/app/atelier'
import { ApiError, creerRessource, estActif, requete, supprimerRessource } from '@/lib/api/client'
import {
  BoutonAction,
  BoutonFormulaire,
  ModaleFormulaire,
  useOperation,
} from '@/components/app/actions'

interface Snapshot {
  id: string
  nom: string
  /** Maquette. Le backend renvoie `cree` — les deux sont lus. */
  date?: string
  cree?: string
  /** Maquette. Le backend renvoie `tailleGo`. */
  taille?: number
  tailleGo?: number
  type?: string
}

/** `GET /vms/{id}/metriques` — une série par métrique (`cpu`, `ram`, `disque`,
 * `reseau_entrant`), au plus un point : c'est un instantané réel, pas un historique. */
interface SerieMetriqueVm {
  metrique: string
  unite: string
  points: { valeur: number }[]
}

/** `POST /vms/{id}/console` — URL de console à usage unique (~2 h de validité). */
interface ConsoleVm {
  url: string
  protocole: 'vnc' | 'spice' | 'serie'
  expire: string
}

/** Les snapshots ne sont pas dans le jeu de données : graine locale. */
const SNAPSHOTS_GRAINE: Snapshot[] = [
  { id: 'snap-1', nom: 'avant-maj-noyau', date: '2026-08-18T21:40:00Z', taille: 42, type: 'à chaud' },
  { id: 'snap-2', nom: 'pre-deploiement-v2.7.1', date: '2026-08-19T15:04:00Z', taille: 44, type: 'à chaud' },
  { id: 'snap-3', nom: 'reference-installation', date: '2026-03-11T09:12:00Z', taille: 28, type: 'à froid' },
]

/** Pourquoi une tuile CPU/Mémoire/Réseau n'a pas de lecture réelle — distingue « la machine
 * est arrêtée, rien à lire côté hyperviseur » (fait durable) de « l'appel n'a pas encore
 * répondu ou l'hyperviseur ne répond pas » (transitoire), plutôt que la même mention
 * « Démonstration » dans les deux cas, qui ne serait vraie ni dans l'un ni dans l'autre. */
function detailLectureVm(series: SerieMetriqueVm[] | null, statut: VM['statut']): string {
  if (series === null) return 'Lecture en cours…'
  if (statut !== 'running') return 'Machine arrêtée — rien à lire côté hyperviseur'
  return 'Lecture hyperviseur indisponible pour le moment'
}

const ONGLETS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'materiel', label: 'Matériel virtuel' },
  { id: 'reseau', label: 'Réseau' },
  { id: 'stockage', label: 'Stockage' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'sauvegardes', label: 'Sauvegardes' },
]

export function VueVm({ id }: { id: string }) {
  const router = useRouter()
  const { autorise, refus, api } = useApp()
  const executer = useOperation()
  const parc = useCollection<VM>('vms', VMS)
  const disques = useCollection<Volume>('volumes', VOLUMES)
  // Lecture unitaire quand la liste ne contient pas (encore) la machine :
  // lien direct vers une ressource créée pendant la session ou ailleurs.
  const { entite: isolee } = useEntite<VM>('vms', VMS, id)
  const snapshots = useCollection<Snapshot>(`snapshots-${id}`, SNAPSHOTS_GRAINE)
  const [onglet, setOnglet] = useState('apercu')
  const [console_, setConsole] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const [redimensionnement, setRedimensionnement] = useState(false)

  const [consoleUrl, setConsoleUrl] = useState<string | null>(null)
  const [consoleChargement, setConsoleChargement] = useState(false)
  const [consoleErreur, setConsoleErreur] = useState<{ message: string; correlationId?: string } | null>(
    null,
  )

  const ouvrirConsole = useCallback(() => {
    setConsoleChargement(true)
    setConsoleErreur(null)
    setConsoleUrl(null)
    requete<ConsoleVm>(`/vms/${encodeURIComponent(id)}/console`, { methode: 'POST', corps: {} })
      .then(
        (c) => setConsoleUrl(c.url),
        (e: unknown) =>
          setConsoleErreur(
            e instanceof ApiError
              ? { message: e.message, correlationId: e.correlationId }
              : { message: 'Le backend ne répond pas.' },
          ),
      )
      .finally(() => setConsoleChargement(false))
  }, [id])

  // Une URL de console est à usage unique et expire ~2 h : on en redemande
  // une à chaque ouverture du tiroir plutôt que de la garder en cache.
  useEffect(() => {
    if (console_ && estActif()) ouvrirConsole()
  }, [console_, ouvrirConsole])

  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  const lesIps = useCollection<PublicIP>('ips', PUBLIC_IPS)
  // Même collections que la section transverse `/app/sauvegarde` (`OngletPoints`,
  // `OngletPlans`) : avant ce correctif, l'onglet Sauvegardes de la fiche lisait
  // `RESTORE_POINTS`/`BACKUP_PLANS` (les graines) sans jamais passer par l'atelier,
  // donc en mode API il affichait des points de restauration fabriqués au lieu des
  // vrais `/sauvegarde/points` — un point de restauration inventé est pire qu'un
  // écran vide.
  const plansSauvegarde = useCollection<BackupPlan>('plans-sauvegarde', BACKUP_PLANS)
  const pointsRestauration = useCollection<RestorePoint>('points-restauration', RESTORE_POINTS)

  // `/catalogue/images` et `/catalogue/gabarits` résolvent les identifiants
  // bruts (Glance, gabarit) que le backend pose sur `vm.os`/`vm.flavor` — le
  // même contrat que consulte l'assistant de création (`vms/new/page.tsx`).
  // Sans cette résolution, la fiche affiche des UUID au lieu de noms lisibles.
  const [catalogueImages, setCatalogueImages] = useState<Record<string, string>>({})
  const [catalogueGabarits, setCatalogueGabarits] = useState<Record<string, string>>({})
  // Le redimensionnement en garde la liste complète : Nova ne sait redimensionner
  // que vers un gabarit existant du catalogue (vcpu/ramGo/diskGo exacts, jamais une
  // valeur arbitraire) — voir `_gabarit_pour_specs` côté backend. Sans cette liste,
  // la modale ne pouvait proposer que des vCPU/Go libres qui échouaient en 422 dès
  // que le disque ne suivait pas (constaté en direct : tout redimensionnement autre
  // qu'un no-op échouait).
  const [gabaritsReels, setGabaritsReels] = useState<
    Array<{ id: string; nom: string; vcpu: number; ramGo: number; diskGo: number }>
  >([])
  useEffect(() => {
    if (!estActif()) return
    requete<Array<{ id: string; nom: string }>>('/catalogue/images')
      .then((images) => setCatalogueImages(Object.fromEntries(images.map((i) => [i.id, i.nom]))))
      .catch(() => {})
    requete<Array<{ id: string; nom: string; vcpu: number; ramGo: number; diskGo: number }>>(
      '/catalogue/gabarits',
    )
      .then((gabarits) => {
        setCatalogueGabarits(Object.fromEntries(gabarits.map((g) => [g.id, g.nom])))
        setGabaritsReels(gabarits)
      })
      .catch(() => {})
  }, [])

  // `GET /vms/{id}/metriques` : un point instantané réel (diagnostics Nova/libvirt — temps
  // CPU, mémoire, E/S réseau depuis l'hyperviseur), pas une série historique. Vide pour une
  // machine arrêtée (rien à lire côté hyperviseur) ou tant que l'appel n'a pas répondu — les
  // trois tuiles concernées retombent alors sur l'état « pas de lecture », jamais une valeur
  // inventée. Le disque n'a pas d'équivalent : les diagnostics donnent des E/S, jamais
  // l'occupation, qu'aucune intégration ne remonte aujourd'hui pour une VM — cette tuile reste
  // en démonstration.
  const [metriquesVm, setMetriquesVm] = useState<SerieMetriqueVm[] | null>(null)
  useEffect(() => {
    if (!estActif()) return
    setMetriquesVm(null)
    requete<{ series: SerieMetriqueVm[] }>(`/vms/${encodeURIComponent(id)}/metriques`)
      .then((r) => setMetriquesVm(r.series ?? []))
      .catch(() => setMetriquesVm([]))
  }, [id])
  const lectureVm = (metrique: string) =>
    metriquesVm?.find((s) => s.metrique === metrique)?.points.at(-1)?.valeur
  const uniteVm = (metrique: string) => metriquesVm?.find((s) => s.metrique === metrique)?.unite

  const vm = parc.items.find((v) => v.id === id) ?? isolee

  // Chargement distant en cours (lien direct, liste pas encore là) : des
  // squelettes, pas un « supprimée » qui se contredirait une seconde après.
  if (!vm && parc.chargement) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  // La machine peut avoir été supprimée depuis cette page : le retour arrière
  // du navigateur ne doit pas casser l'écran.
  if (!vm) {
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Machines virtuelles', href: '/app/vms' },
            { label: 'Machine supprimée' },
          ]}
          titre="Cette machine n’existe plus"
        />
        <EmptyState
          titre="Machine supprimée"
          phrase="Ses volumes détachés et ses points de restauration restent accessibles depuis l’Espace Cloud et la section Sauvegardes le temps de la rétention."
          action={{ libelle: 'Retour aux machines', href: '/app/vms' }}
        />
      </div>
    )
  }

  // Cibles de redimensionnement : uniquement des gabarits réels qui améliorent
  // les trois dimensions à la fois (vcpu, ramGo, diskGo) — un disque ne se
  // réduit jamais (règle backend) et Nova rejette tout triplet qui ne
  // correspond pas exactement à un gabarit existant.
  const gabaritsCibles = gabaritsReels
    .filter((g) => g.vcpu >= vm.vcpu && g.ramGo >= vm.ramGo && g.diskGo >= vm.diskGo)
    .filter((g) => g.vcpu > vm.vcpu || g.ramGo > vm.ramGo || g.diskGo > vm.diskGo)
    .sort((a, b) => a.vcpu - b.vcpu || a.ramGo - b.ramGo || a.diskGo - b.diskGo)

  const espace = espaces.items.find((e) => e.id === vm.espaceId)
  const osAffiche = catalogueImages[vm.os] ?? vm.os
  const flavorAffiche = vm.flavor ? (catalogueGabarits[vm.flavor] ?? vm.flavor) : undefined
  const ipPrivee = vm.ips.find((i) => i.type === 'privee')?.adresse
  // Une IP attachée après coup via `/app/reseau` (ou le bouton « Attacher une IP publique »
  // ci-dessous) ne réécrit jamais `vm.ips` côté backend — seule la collection `ips`
  // (`attachedTo`) le sait vraiment. `vm.ips` reste la source pour l'IP posée à la création.
  const ipReelleAttachee = lesIps.items.find((i) => i.attachedTo === vm.id)
  const ipPublique = vm.ips.find((i) => i.type === 'publique')?.adresse ?? ipReelleAttachee?.adresse
  const volumes = disques.items.filter((v) => v.attachedTo === vm.id)
  const ipsDisponibles = lesIps.items.filter((i) => i.espaceId === vm.espaceId && !i.attachedTo)
  // Interfaces à afficher dans l'onglet Réseau : celles connues de `vm.ips` (posées à la
  // création) plus toute IP réellement attachée depuis (`lesIps`, dédupliquée par adresse).
  const interfacesReseau = [
    ...vm.ips,
    ...lesIps.items
      .filter((i) => i.attachedTo === vm.id && !vm.ips.some((v) => v.adresse === i.adresse))
      .map((i) => ({ adresse: i.adresse, type: 'publique' as const, ptr: i.ptr })),
  ]
  const points = pointsRestauration.items.filter((p) => p.resourceId === vm.id)
  // Un plan protège cette VM par portée directe (`ressource` == son id) ou par
  // Espace (`espace` == son espaceId). `tag`/`service` sont traités par le
  // backend comme couvrant toutes les ressources non-en-erreur — même règle que
  // `_ressources_protegees` (`sauvegarde/service.py`) — donc comptés ici aussi ;
  // `service` cible les services managés, jamais une VM, et reste exclu.
  const plan = plansSauvegarde.items.find(
    (p) =>
      (p.scope.type === 'ressource' && p.scope.valeur === vm.id) ||
      (p.scope.type === 'espace' && p.scope.valeur === vm.espaceId) ||
      p.scope.type === 'tag',
  )
  const pointPlusRecent = points.reduce<RestorePoint | undefined>(
    (plusRecent, p) => (!plusRecent || p.date > plusRecent.date ? p : plusRecent),
    undefined,
  )
  const derniereSauvegarde = pointPlusRecent?.date

  const prendreUnSnapshot = (nom: string) => {
    snapshots.creer({
      id: snapshots.identifiant('snap'),
      nom,
      date: MAINTENANT,
      taille: Math.round(vm.diskGo * 0.35),
      type: vm.statut === 'running' ? 'à chaud' : 'à froid',
    })
  }

  /** POST /vms/{id}/instantanes — le backend n’exige que `nom`. */
  const appelSnapshot = (nom: string) =>
    creerRessource(`/vms/${encodeURIComponent(id)}/instantanes`, { nom })

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace?.code ?? '', href: `/app/espaces/${vm.espaceId}` },
          { label: 'Machines virtuelles', href: '/app/vms' },
          { label: vm.nom },
        ]}
        titre={<span className="font-mono">{vm.nom}</span>}
        sousTitre={`${osAffiche} · ${vm.vcpu} vCPU / ${vm.ramGo} Go / ${num(vm.diskGo)} Go · ${SITE_LABEL[vm.site]}`}
        meta={
          <>
            <HealthBadge etat={vm.statut} />
            {ipPrivee && <span className="font-mono text-[12px] text-g-500">{ipPrivee}</span>}
            {ipPublique && (
              <Badge tone="violet" size="sm">
                {ipPublique}
              </Badge>
            )}
            {vm.applicationId && (
              <Link
                href={hrefDuService(vm.applicationId)}
                className="text-[12px] font-semibold text-p-700 hover:text-m-600"
              >
                {vm.applicationNom} →
              </Link>
            )}
            {(vm.tags ?? []).map((t) => (
              <Badge key={t} tone="neutral" size="sm">
                {t}
              </Badge>
            ))}
          </>
        }
        actions={
          <>
            <Button
              iconBefore={<MonitorPlay size={14} />}
              onClick={() => setConsole(true)}
              disabled={vm.statut !== 'running'}
            >
              Console
            </Button>
            <BoutonAction
              libelle="Redémarrer"
              size="md"
              icone={<RotateCw size={14} />}
              operation={{
                action: 'vm.power',
                ton: 'info',
                titre: `Redémarrage de ${vm.nom}`,
                detail: 'La machine sera de nouveau disponible dans environ 40 secondes.',
                appel: () =>
                  requete(`/vms/${encodeURIComponent(vm.id)}/redemarrage`, { methode: 'POST', corps: {} }),
                effet: () => parc.modifier(vm.id, { statut: 'creating' }),
                job: { workflow: 'vm.power.reboot', cible: vm.nom },
                effetFinal: () => {
                  parc.modifier(vm.id, { statut: 'running' })
                  parc.recharger()
                },
              }}
            />
            <BoutonFormulaire
              libelle="Snapshot"
              size="md"
              icone={<Camera size={14} />}
              action="vm.create_delete"
              titre="Prendre un snapshot"
              description="Copie instantanée de l’état de la machine. Ce n’est pas une sauvegarde : le snapshot vit sur le même stockage."
              champs={[
                {
                  id: 'nom',
                  label: 'Nom du snapshot',
                  placeholder: 'avant-mise-a-jour',
                  obligatoire: true,
                },
              ]}
              operation={(v) => ({
                titre: `Snapshot « ${v.nom} » créé`,
                detail: `Machine ${vm.nom}`,
                appel: () => appelSnapshot(String(v.nom)),
                effet: () => prendreUnSnapshot(String(v.nom)),
                effetFinal: () => snapshots.recharger(),
              })}
            />
            <Popover
              width="w-56"
              label="Autres actions sur la machine"
              trigger={() => (
                <span className="inline-flex h-9 items-center rounded-[6px] border border-g-300 px-3 text-[13px] font-semibold text-g-700 hover:bg-g-050">
                  Autres actions
                </span>
              )}
            >
              {(close) => (
                <div className="p-1.5">
                  {[
                    {
                      l: vm.statut === 'running' ? 'Arrêter' : 'Démarrer',
                      i: <Power size={13} />,
                      action: 'vm.power',
                      faire: () =>
                        executer({
                          action: 'vm.power',
                          ton: 'info',
                          titre:
                            vm.statut === 'running'
                              ? `Arrêt de ${vm.nom} demandé`
                              : `Démarrage de ${vm.nom} demandé`,
                          appel: () =>
                            requete(
                              `/vms/${encodeURIComponent(vm.id)}/${vm.statut === 'running' ? 'arret' : 'demarrage'}`,
                              { methode: 'POST', corps: {} },
                            ),
                          job: {
                            workflow: vm.statut === 'running' ? 'vm.power.stop' : 'vm.power.start',
                            cible: vm.nom,
                          },
                          effetFinal: () => {
                            parc.modifier(vm.id, {
                              statut: vm.statut === 'running' ? 'stopped' : 'running',
                            })
                            parc.recharger()
                          },
                        }),
                    },
                    {
                      l: 'Migrer vers un autre hôte',
                      i: <MoveRight size={13} />,
                      action: 'vm.hardware.update',
                      faire: () =>
                        executer({
                          action: 'vm.hardware.update',
                          ton: 'info',
                          titre: `Migration à chaud de ${vm.nom}`,
                          detail: 'Aucune interruption de service attendue.',
                          appel: () =>
                            requete(`/vms/${encodeURIComponent(vm.id)}/migration`, {
                              methode: 'POST',
                              corps: { site: vm.site },
                            }),
                          effet: () => parc.modifier(vm.id, { statut: 'migrating' }),
                          job: { workflow: 'vm.migrate', cible: vm.nom },
                          effetFinal: () => {
                            parc.modifier(vm.id, { statut: 'running' })
                            parc.recharger()
                          },
                        }),
                    },
                  ].map((a) => (
                    <GatedAction key={a.l} autorise={autorise(a.action)} message={refus(a.action)}>
                      <button
                        type="button"
                        onClick={() => {
                          close()
                          a.faire()
                        }}
                        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-p-050"
                      >
                        <span className="text-g-500">{a.i}</span>
                        {a.l}
                      </button>
                    </GatedAction>
                  ))}
                  <GatedAction
                    autorise={autorise('vm.hardware.update')}
                    message={refus('vm.hardware.update')}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        setRedimensionnement(true)
                      }}
                      className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-p-050"
                    >
                      <span className="text-g-500">
                        <Ruler size={13} />
                      </span>
                      Redimensionner
                    </button>
                  </GatedAction>
                  <div className="mt-1 border-t border-g-100 pt-1">
                    <GatedAction
                      autorise={autorise('vm.create_delete')}
                      message={refus('vm.create_delete')}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          close()
                          setSuppression(true)
                        }}
                        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-err hover:bg-err-bg"
                      >
                        <Trash2 size={13} />
                        Supprimer la machine
                      </button>
                    </GatedAction>
                  </div>
                </div>
              )}
            </Popover>
          </>
        }
      />

      {vm.statut === 'error' && (
        <Callout ton="err" titre="Cette machine est en erreur">
          Le service applicatif ne démarre plus depuis le dernier déploiement. Le journal
          d’initialisation signale un échec de résolution de dépendances Python. Consultez le
          diagnostic de build dans la console applicative de {vm.applicationNom}.
        </Callout>
      )}
      {vm.statut === 'migrating' && (
        <Callout ton="info" titre="Migration en cours">
          La machine est en cours de migration à chaud vers un autre hôte physique. Aucune
          interruption de service n’est attendue ; les performances peuvent être légèrement dégradées
          pendant le transfert de la mémoire.
        </Callout>
      )}
      {!plan && (
        <Callout ton="warn" titre="Aucun plan de sauvegarde">
          Cette machine n’est pas protégée : aucune restauration n’est possible en cas d’incident ou
          d’erreur humaine. Appliquez un plan depuis l’onglet Sauvegardes.
        </Callout>
      )}

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {/* ─── Aperçu ──────────────────────────────────────────────────── */}
      {onglet === 'apercu' && (
        <div className="space-y-4">
          {/*
            `GET /vms/{id}/metriques` renvoie un point instantané réel pour CPU/Mémoire/Réseau
            (diagnostics Nova/libvirt, `synelia.modules.vms.service.diagnostics_instantanes`) —
            vide (`metriquesVm === null` tant que l'appel n'a pas répondu, `[]` si la machine
            est arrêtée ou l'hyperviseur injoignable) plutôt qu'une valeur inventée. Le disque
            reste en démonstration : les diagnostics donnent des E/S, jamais l'occupation, et
            rien ne la remonte aujourd'hui pour une VM. Le mode maquette garde les valeurs
            illustratives déterministes.
          */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              libelle="CPU"
              valeur={
                api
                  ? lectureVm('cpu') !== undefined
                    ? Math.round(lectureVm('cpu')!)
                    : '—'
                  : vm.statut === 'running'
                    ? 34
                    : 0
              }
              unite={api ? (lectureVm('cpu') !== undefined ? '%' : undefined) : '%'}
              variation={api ? undefined : vm.statut === 'running' ? 6 : 0}
              detail={
                api && lectureVm('cpu') === undefined
                  ? detailLectureVm(metriquesVm, vm.statut)
                  : undefined
              }
              serie={api ? undefined : seededSeries(`${id}-cpu`, 24, 18, 48)}
            />
            <StatTile
              libelle="Mémoire"
              valeur={
                api
                  ? lectureVm('ram') !== undefined
                    ? Math.round(lectureVm('ram')!)
                    : '—'
                  : vm.statut === 'running'
                    ? 61
                    : 0
              }
              unite={api ? (lectureVm('ram') !== undefined ? '%' : undefined) : '%'}
              variation={api ? undefined : vm.statut === 'running' ? -2 : 0}
              detail={
                api && lectureVm('ram') === undefined
                  ? detailLectureVm(metriquesVm, vm.statut)
                  : undefined
              }
              serie={api ? undefined : seededSeries(`${id}-mem`, 24, 52, 68)}
            />
            <StatTile
              libelle="Disque"
              valeur={api ? '—' : vm.statut === 'running' ? 57 : 57}
              unite={api ? undefined : '%'}
              detail={
                api
                  ? 'Démonstration — les diagnostics de l’hyperviseur donnent des E/S disque, pas l’occupation'
                  : `${goHumain(Math.round(vm.diskGo * 0.57))} sur ${goHumain(vm.diskGo)}`
              }
              serie={api ? undefined : seededSeries(`${id}-disk`, 24, 55, 58)}
            />
            <StatTile
              libelle="Réseau"
              valeur={
                api
                  ? lectureVm('reseau_entrant') !== undefined
                    ? Number(lectureVm('reseau_entrant')!.toFixed(2))
                    : '—'
                  : vm.statut === 'running'
                    ? 148
                    : 0
              }
              unite={
                api
                  ? lectureVm('reseau_entrant') !== undefined
                    ? uniteVm('reseau_entrant')
                    : undefined
                  : 'Mbit/s'
              }
              detail={
                api && lectureVm('reseau_entrant') === undefined
                  ? detailLectureVm(metriquesVm, vm.statut)
                  : undefined
              }
              ton="violet"
              serie={api ? undefined : seededSeries(`${id}-net`, 24, 40, 280)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader titre="Caractéristiques" />
              <KeyValueList
                colonnes={2}
                items={[
                  { cle: 'Identifiant', valeur: <span className="font-mono text-[12px]">{vm.id}</span> },
                  { cle: 'Système', valeur: osAffiche },
                  { cle: 'Gabarit', valeur: <span className="font-mono">{flavorAffiche ?? '—'}</span> },
                  { cle: 'vCPU', valeur: `${vm.vcpu} vCPU` },
                  { cle: 'Mémoire', valeur: `${vm.ramGo} Go` },
                  { cle: 'Disque système', valeur: goHumain(vm.diskGo) },
                  { cle: 'Espace Cloud', valeur: espace?.code ?? '—' },
                  { cle: 'Site', valeur: SITE_LABEL[vm.site] },
                  {
                    cle: 'Application rattachée',
                    valeur: vm.applicationNom ?? 'Machine autonome',
                  },
                  {
                    cle: 'Dernière sauvegarde',
                    valeur: derniereSauvegarde ? dateHeure(derniereSauvegarde) : 'Aucune',
                  },
                ]}
              />
            </Card>

            <Card>
              <CardHeader titre="Accès" />
              <div className="space-y-3">
                {ipPrivee && <CopyField label="IP privée" value={ipPrivee} />}
                {ipPublique && <CopyField label="IP publique" value={ipPublique} />}
                <CopyField
                  label="Connexion SSH"
                  value={`ssh ops@${ipPublique ?? ipPrivee} -p 22`}
                />
              </div>
              <p className="mt-3 border-t border-g-100 pt-3 text-[11.5px] leading-relaxed text-g-500">
                {ipPublique
                  ? 'L’accès SSH depuis Internet est filtré par le groupe de sécurité. Vérifiez que votre adresse est autorisée.'
                  : 'Cette machine n’a pas d’IP publique : l’accès SSH passe par le VPN ou par le bastion.'}
              </p>
            </Card>
          </div>

          {api ? (
            <Card>
              <CardHeader titre="Historique des métriques" />
              <p className="rounded-[8px] border border-dashed border-g-300 bg-g-050 px-3.5 py-4 text-center text-[12.5px] text-g-500">
                Démonstration — le CPU, la mémoire et le réseau des tuiles ci-dessus sont une
                lecture réelle de l’hyperviseur (diagnostics Nova/libvirt), mais instantanée :
                rien ne persiste de série dans le temps côté backend, donc pas de courbe 24 h à
                afficher ici. L’occupation disque reste indisponible : les diagnostics donnent
                des E/S, jamais l’espace occupé.
              </p>
            </Card>
          ) : (
            <GrilleSparkCharts
              seed={`vm-${id}`}
              metriques={[
                { titre: 'CPU', unite: '%', min: 18, max: 48 },
                { titre: 'Mémoire', unite: '%', min: 52, max: 68, seuil: 90 },
                { titre: 'Disque', unite: '%', min: 55, max: 58, seuil: 85 },
                { titre: 'Réseau', unite: 'Mbit/s', min: 40, max: 280, couleur: 'var(--color-m-600)' },
              ]}
              degrade={vm.statut === 'stopped'}
            />
          )}

          <Card>
            <CardHeader titre="Cinq derniers événements" />
            <EventList
              evenements={EVENEMENTS_SUPERVISION.filter((e) => e.site === vm.site).slice(0, 5)}
              max={5}
            />
          </Card>
        </div>
      )}

      {/* ─── Matériel virtuel ────────────────────────────────────────── */}
      {onglet === 'materiel' && <OngletMateriel vm={vm} />}

      {/* ─── Réseau ──────────────────────────────────────────────────── */}
      {onglet === 'reseau' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Interfaces réseau"
              sousTitre={`${vm.hardware.nics} carte(s) virtuelle(s)`}
              actions={
                <BoutonFormulaire
                  libelle="Attacher une IP publique"
                  action="network.manage"
                  titre={`Attacher une IP publique à ${vm.nom}`}
                  description="Une IP publique permet d’atteindre cette machine depuis Internet. Choisissez une adresse déjà réservée et libre dans cet Espace Cloud, ou faites-en réserver une nouvelle — facturée 3 500 FCFA par mois."
                  champs={[
                    {
                      id: 'source',
                      label: 'Adresse',
                      type: 'select',
                      options: [
                        ...ipsDisponibles.map((ip) => ({
                          value: ip.id,
                          label: `${ip.adresse}${ip.ptr ? ` · ${ip.ptr}` : ''} (déjà réservée)`,
                        })),
                        { value: 'nouvelle', label: 'Réserver une nouvelle IP publique' },
                      ],
                    },
                  ]}
                  valeursDepart={{ source: ipsDisponibles[0]?.id ?? 'nouvelle' }}
                  libelleValider="Attacher"
                  operation={(v) => {
                    const nouvelle = String(v.source) === 'nouvelle'
                    const ipChoisie = nouvelle
                      ? undefined
                      : ipsDisponibles.find((ip) => ip.id === v.source)
                    return {
                      titre: nouvelle
                        ? `IP publique attachée à ${vm.nom}`
                        : `${ipChoisie?.adresse ?? ''} attachée à ${vm.nom}`,
                      detail: nouvelle ? 'Facturée au prorata du mois en cours.' : undefined,
                      appel: async () => {
                        let ipId = String(v.source)
                        if (nouvelle) {
                          const reservee = (await creerRessource<PublicIP>('/ips', {
                            espaceId: vm.espaceId,
                            site: espace?.site,
                            antiDdos: false,
                          })) as PublicIP
                          ipId = reservee.id
                        }
                        return requete(`/ips/${encodeURIComponent(ipId)}/attachement`, {
                          methode: 'PUT',
                          corps: { cibleId: vm.id },
                        })
                      },
                      effet: () => {
                        const adresse = nouvelle
                          ? `102.176.20.${200 + lesIps.items.length}`
                          : ipChoisie?.adresse
                        if (!adresse) return
                        if (nouvelle) {
                          lesIps.creer({
                            id: lesIps.identifiant('ip'),
                            espaceId: vm.espaceId,
                            adresse,
                            antiDdos: false,
                            attachedTo: vm.id,
                            attachedLabel: vm.nom,
                          })
                        } else if (ipChoisie) {
                          lesIps.modifier(ipChoisie.id, { attachedTo: vm.id, attachedLabel: vm.nom })
                        }
                        parc.modifier(vm.id, (m) => ({
                          ips: [...m.ips, { adresse, type: 'publique' as const, ptr: ipChoisie?.ptr }],
                        }))
                      },
                      job: {
                        type: 'network.ip.attach',
                        label: `IP publique · ${vm.nom}`,
                        etapes: nouvelle
                          ? ['Réserver l’adresse dans le pool', 'Annoncer la route', 'Attacher au port réseau']
                          : ['Attacher au port réseau'],
                        dureeEtapeMs: 900,
                      },
                      effetFinal: () => {
                        parc.recharger()
                        lesIps.recharger()
                      },
                    }
                  }}
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Interface', 'Adresse', 'Type', 'Reverse DNS', 'Réseau'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interfacesReseau.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[12.5px] text-g-500">
                        Aucune IP publique — attachez-en une avec le bouton ci-dessus.
                      </td>
                    </tr>
                  ) : (
                    interfacesReseau.map((ip, i) => (
                      <tr key={ip.adresse} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-[12px] text-ink">eth{i}</td>
                        <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{ip.adresse}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={ip.type === 'publique' ? 'accent' : 'neutral'} size="sm">
                            {ip.type === 'publique' ? 'Publique' : 'Privée'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">
                          {ip.ptr ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-[12.5px] text-g-700">
                          {ip.type === 'privee' ? 'prod-front · 10.0.1.0/24' : 'Internet'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Groupes de sécurité appliqués"
              actions={
                <BoutonFormulaire
                  libelle="Modifier les groupes"
                  action="network.manage"
                  titre="Groupes de sécurité de la machine"
                  description="Un groupe de sécurité s’applique à la carte réseau. Le portail ne réécrit pas les règles ici : elles se gèrent dans la section Réseau, où elles sont partagées entre machines."
                  champs={[
                    {
                      id: 'groupe',
                      label: 'Groupe de sécurité principal',
                      type: 'select',
                      options: SECURITY_GROUPS.map((g) => ({ value: g.id, label: g.nom })),
                    },
                  ]}
                  operation={(v) => ({
                    titre: 'Groupe de sécurité appliqué',
                    detail: SECURITY_GROUPS.find((g) => g.id === v.groupe)?.nom,
                    job: {
                      type: 'network.sg.apply',
                      label: `Groupe de sécurité · ${vm.nom}`,
                      etapes: ['Appliquer les règles sur la carte réseau', 'Vérifier la connectivité'],
                      dureeEtapeMs: 900,
                    },
                  })}
                />
              }
            />
            {SECURITY_GROUPS.slice(0, 2).map((sg) => (
              <div key={sg.id} className="mb-3.5 last:mb-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{sg.nom}</span>
                  <Badge tone={sg.defaultPolicy.ingress === 'deny' ? 'ok' : 'warn'} size="sm">
                    {sg.defaultPolicy.ingress === 'deny'
                      ? 'Refus par défaut en entrée, sortie autorisée'
                      : 'Autorisation par défaut en entrée'}
                  </Badge>
                </div>
                <div className="overflow-x-auto rounded-[6px] border border-g-300">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="border-b border-g-300 bg-g-050">
                        {['Direction', 'Protocole', 'Ports', 'Source / destination', 'Description'].map(
                          (h) => (
                            <th key={h} className="type-micro px-3 py-1.5 text-left text-g-500">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sg.rules.map((r) => (
                        <tr key={r.id} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-1.5">
                            <Badge tone={r.direction === 'in' ? 'info' : 'neutral'} size="sm">
                              {r.direction === 'in' ? 'Entrée' : 'Sortie'}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11.5px] uppercase text-ink">
                            {r.protocole}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11.5px] text-ink">
                            {r.ports ?? 'tous'}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11.5px] text-g-700">
                            {r.cible}
                          </td>
                          <td className="px-3 py-1.5 text-[11.5px] text-g-700">
                            {r.description ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ─── Stockage ────────────────────────────────────────────────── */}
      {onglet === 'stockage' && (
        <Card>
          <CardHeader
            titre="Volumes attachés"
            sousTitre="Le disque système est inclus dans le gabarit ; les volumes de données sont facturés séparément."
            actions={
              <BoutonFormulaire
                libelle="Attacher un volume"
                action="vm.hardware.update"
                titre="Attacher un volume de données"
                description="Un volume de données est facturé séparément du gabarit et survit à la suppression de la machine."
                champs={[
                  { id: 'nom', label: 'Nom du volume', placeholder: 'data-postgres-03', obligatoire: true },
                  { id: 'taille', label: 'Taille', type: 'nombre', demi: true, min: 10, max: 8000, suffixe: 'Go' },
                  {
                    id: 'classe',
                    label: 'Classe de stockage',
                    type: 'select',
                    demi: true,
                    options: [
                      { value: 'nvme', label: 'NVMe · 12 000 IOPS' },
                      { value: 'ssd', label: 'SSD · 6 000 IOPS' },
                      { value: 'hdd', label: 'HDD · 900 IOPS' },
                    ],
                  },
                  { id: 'montage', label: 'Point de montage', placeholder: '/srv/data' },
                  { id: 'chiffre', label: 'Chiffrement au repos', type: 'switch', placeholder: 'Activé' },
                ]}
                valeursDepart={{ taille: 100, classe: 'ssd', chiffre: true, montage: '/srv/data' }}
                libelleValider="Attacher"
                operation={(v) => ({
                  titre: `Volume « ${v.nom} » attaché`,
                  detail: `${v.taille} Go · ${String(v.classe).toUpperCase()}`,
                  appel: () =>
                    creerRessource('/volumes', {
                      espaceId: vm.espaceId,
                      nom: String(v.nom),
                      tailleGo: Number(v.taille),
                      classe: v.classe,
                      chiffre: Boolean(v.chiffre),
                      attacherA: vm.id,
                      montage: String(v.montage) || undefined,
                    }),
                  effet: () =>
                    disques.creer({
                      id: disques.identifiant('vol'),
                      espaceId: vm.espaceId,
                      nom: String(v.nom),
                      tailleGo: Number(v.taille),
                      classe: v.classe as Volume['classe'],
                      chiffre: Boolean(v.chiffre),
                      attachedTo: vm.id,
                      attachedLabel: vm.nom,
                      ephemere: false,
                      iops: v.classe === 'nvme' ? 12000 : v.classe === 'ssd' ? 6000 : 900,
                      montage: String(v.montage),
                    }),
                  effetFinal: () => disques.recharger(),
                })}
              />
            }
          />
          <div className="mb-4 rounded-[8px] border border-g-300 bg-g-050 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="block text-[12.5px] font-semibold text-ink">
                  Disque système ({goHumain(vm.diskGo)})
                </span>
                <span className="block font-mono text-[11.5px] text-g-500">/ · inclus au gabarit</span>
              </span>
              <span className="w-40">
                <QuotaBar
                  utilise={Math.round(vm.diskGo * 0.57)}
                  total={vm.diskGo}
                  compact
                  seuil={85}
                  formateur={(v) => goHumain(v)}
                />
              </span>
            </div>
          </div>
          {volumes.length === 0 ? (
            <EmptyState
              titre="Aucun volume de données"
              phrase="Un volume séparé permet d’étendre le stockage à chaud, de le déplacer vers une autre machine, et de le sauvegarder indépendamment du système."
              action={{ libelle: 'Créer un volume', href: '/app/stockage' }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Volume', 'Point de montage', 'Taille', 'Classe', 'IOPS', 'Chiffré', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {volumes.map((v) => (
                    <tr key={v.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{v.nom}</td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">
                        {v.montage ?? '—'}
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                        {goHumain(v.tailleGo)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone="neutral" size="sm">
                          {v.classe.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{num(v.iops)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={v.chiffre ? 'ok' : 'warn'} size="sm">
                          {v.chiffre ? 'Oui' : 'Non'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <BoutonFormulaire
                            libelle="Étendre"
                            variant="ghost"
                            action="vm.hardware.update"
                            titre={`Étendre ${v.nom}`}
                            description="L’extension est appliquée à chaud. Le système de fichiers de l’invité doit ensuite être étendu à son tour — un volume ne rétrécit jamais."
                            champs={[
                              {
                                id: 'taille',
                                label: 'Nouvelle taille',
                                type: 'nombre',
                                min: v.tailleGo,
                                max: 8000,
                                suffixe: 'Go',
                              },
                            ]}
                            valeursDepart={{ taille: v.tailleGo }}
                            libelleValider="Étendre"
                            operation={(f) => ({
                              titre: `${v.nom} étendu à ${num(Number(f.taille))} Go`,
                              appel: () =>
                                requete(`/volumes/${encodeURIComponent(v.id)}/extension`, {
                                  methode: 'POST',
                                  corps: { tailleGo: Number(f.taille) },
                                }),
                              effet: () =>
                                disques.modifier(v.id, { tailleGo: Number(f.taille) }),
                              effetFinal: () => disques.recharger(),
                            })}
                          />
                          <BoutonAction
                            libelle="Détacher"
                            variant="ghost"
                            operation={{
                              action: 'vm.hardware.update',
                              ton: 'warn',
                              titre: `${v.nom} détaché`,
                              detail: 'Le volume est conservé et peut être attaché à une autre machine.',
                              appel: () =>
                                requete(`/volumes/${encodeURIComponent(v.id)}/attachement`, {
                                  methode: 'DELETE',
                                }),
                              effet: () =>
                                disques.modifier(v.id, {
                                  attachedTo: undefined,
                                  attachedLabel: undefined,
                                  montage: undefined,
                                }),
                              effetFinal: () => disques.recharger(),
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── Snapshots ───────────────────────────────────────────────── */}
      {onglet === 'snapshots' && (
        <Card>
          <CardHeader
            titre="Snapshots"
            sousTitre="Copie instantanée de l’état de la machine. Utile avant une mise à jour, mais ce n’est pas une sauvegarde : le snapshot vit sur le même stockage."
            actions={
              <BoutonFormulaire
                libelle="Prendre un snapshot"
                variant="primary"
                icone={<Camera size={13} />}
                action="vm.create_delete"
                titre="Prendre un snapshot"
                champs={[
                  { id: 'nom', label: 'Nom du snapshot', placeholder: 'avant-mise-a-jour', obligatoire: true },
                ]}
                operation={(v) => ({
                  titre: `Snapshot « ${v.nom} » créé`,
                  appel: () => appelSnapshot(String(v.nom)),
                  effet: () => prendreUnSnapshot(String(v.nom)),
                  effetFinal: () => snapshots.recharger(),
                })}
              />
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Nom', 'Date', 'Taille', 'Type', 'Actions'].map((h) => (
                    <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.items.map((s) => (
                  <tr key={s.id} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{s.nom}</td>
                    <td className="px-3 py-2.5 text-[12.5px] text-g-700">{dateHeure(s.date ?? s.cree ?? MAINTENANT)}</td>
                    <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                      {goHumain(s.taille ?? s.tailleGo ?? 0)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone="neutral" size="sm">
                        {s.type ?? '—'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-1.5">
                        <BoutonAction
                          libelle="Restaurer"
                          variant="ghost"
                          operation={{
                            action: 'vm.create_delete',
                            ton: 'info',
                            titre: `Restauration du snapshot « ${s.nom} »`,
                            appel: () =>
                              requete(
                                `/vms/${encodeURIComponent(vm.id)}/instantanes/${encodeURIComponent(s.id)}`,
                                { methode: 'POST', corps: {}, query: { confirmation: s.nom } },
                              ),
                            effet: () => parc.modifier(vm.id, { statut: 'creating' }),
                            job: {
                              type: 'vm.snapshot.revert',
                              label: `Retour au snapshot ${s.nom} · ${vm.nom}`,
                              etapes: [
                                'Arrêter la machine',
                                'Réappliquer l’état des disques',
                                'Rallumer la machine',
                              ],
                            },
                            effetFinal: () => {
                              parc.modifier(vm.id, { statut: 'running' })
                              parc.recharger()
                            },
                          }}
                          confirmation={{
                            ressource: s.nom,
                            titre: `Revenir au snapshot « ${s.nom} » ?`,
                            pertes: [
                              `Toutes les écritures postérieures au ${dateHeure(s.date ?? s.cree ?? MAINTENANT)} seront perdues`,
                              'La machine sera arrêtée pendant l’opération',
                            ],
                            libelleAction: 'Revenir à ce snapshot',
                          }}
                        />
                        <BoutonAction
                          libelle="Cloner"
                          variant="ghost"
                          icone={<Copy size={12} />}
                          operation={{
                            action: 'vm.create_delete',
                            titre: `Clone de « ${s.nom} » lancé`,
                            detail: 'Une nouvelle machine est créée depuis ce snapshot.',
                            job: {
                              type: 'vm.clone',
                              label: `Clone depuis ${s.nom}`,
                              etapes: ['Copier les disques', 'Créer la machine', 'Rattacher le réseau'],
                            },
                            effetFinal: () =>
                              parc.creer({
                                ...vm,
                                id: parc.identifiant('vm'),
                                nom: `${vm.nom}-clone`,
                                statut: 'stopped',
                                applicationId: undefined,
                                applicationNom: undefined,
                                backupPlanId: undefined,
                                derniereSauvegarde: undefined,
                                ips: [{ adresse: '10.0.1.240', type: 'privee' }],
                              }),
                          }}
                        />
                        <IconButton
                          label="Supprimer le snapshot"
                          size="sm"
                          onClick={() =>
                            executer({
                              action: 'vm.create_delete',
                              ton: 'warn',
                              titre: `Snapshot « ${s.nom} » supprimé`,
                              detail: 'L’espace disque est rendu immédiatement.',
                              appel: () =>
                                supprimerRessource(
                                  `/vms/${encodeURIComponent(vm.id)}/instantanes`,
                                  s.id,
                                ),
                              effet: () => snapshots.supprimer(s.id),
                              effetFinal: () => snapshots.recharger(),
                            })
                          }
                        >
                          <Trash2 size={13} className="text-err" />
                        </IconButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout ton="warn" className="mt-4" titre="Un snapshot n’est pas une sauvegarde">
            Il partage le stockage de la machine : une défaillance du volume les emporte tous les
            deux. Pour une protection réelle, appliquez un plan de sauvegarde avec copie hors site
            immuable.
          </Callout>
        </Card>
      )}

      {/* ─── Sauvegardes ─────────────────────────────────────────────── */}
      {onglet === 'sauvegardes' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Plan appliqué"
              actions={
                plan ? (
                  <Badge tone={plan.immutable ? 'ok' : 'warn'}>
                    {plan.immutable ? 'Immuable' : 'Non immuable'}
                  </Badge>
                ) : undefined
              }
            />
            {plan ? (
              <KeyValueList
                colonnes={2}
                items={[
                  { cle: 'Plan', valeur: plan.nom },
                  { cle: 'Fréquence', valeur: plan.frequence },
                  {
                    cle: 'Mode',
                    valeur:
                      plan.mode === 'complete'
                        ? 'Complète'
                        : 'Incrémentale avec complète hebdomadaire',
                  },
                  { cle: 'Rétention', valeur: `${plan.retentionJours} jours` },
                  {
                    cle: 'Destinations',
                    valeur: plan.destinations
                      .map((d) =>
                        d.type === 'local'
                          ? 'Bucket local'
                          : d.type === 'autre_site'
                            ? 'Bucket autre site'
                            : 'Copie immuable',
                      )
                      .join(' · '),
                  },
                  { cle: 'Prochaine exécution', valeur: dateHeure(plan.prochaineExecution) },
                ]}
              />
            ) : (
              <EmptyState
                titre="Aucun plan appliqué"
                phrase="Cette machine n’est pas protégée. Appliquez un plan par étiquette pour couvrir automatiquement toutes vos machines de production, y compris celles créées plus tard."
                action={{ libelle: 'Choisir un plan', href: '/app/sauvegarde' }}
              />
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Points de restauration"
              sousTitre="La restauration granulaire descend jusqu’au fichier."
              actions={
                // `BoutonFormulaire` n'a pas de prop `disabled` : sans point réel à
                // restaurer, `pointPlusRecent` serait absent et l'`appel` retomberait
                // sur `undefined`, ce qui rejouerait le job simulé (le bug corrigé
                // ci-dessous) au lieu de rester inerte. Ne pas rendre le bouton du tout
                // tant qu'aucun point n'existe est la seule façon honnête de le
                // désactiver ici — l'`EmptyState` en dessous explique déjà pourquoi.
                points.length > 0 ? (
                <BoutonFormulaire
                  libelle="Lancer une restauration"
                  variant="primary"
                  action="backup.restore"
                  titre={`Restaurer ${vm.nom}`}
                  description="La granularité descend jusqu’au fichier. La destination peut être la machine d’origine, une nouvelle machine, ou l’autre site. Restaure le point le plus récent."
                  champs={[
                    {
                      id: 'granularite',
                      label: 'Granularité',
                      type: 'select',
                      // Valeurs alignées sur `DemandeRestauration.granularite` (backend) :
                      // pas de « volume » distinct côté contrat pour une VM, contrairement à
                      // ce que la maquette laissait croire.
                      options: [
                        { value: 'complete', label: 'Machine entière' },
                        { value: 'fichiers', label: 'Fichiers et dossiers' },
                      ],
                    },
                    {
                      id: 'destination',
                      label: 'Destination',
                      type: 'select',
                      options: [
                        { value: 'origine', label: 'La machine d’origine (écrasement)' },
                        { value: 'nouvelle', label: 'Une nouvelle machine' },
                        { value: 'autre-site', label: 'L’autre site' },
                      ],
                    },
                  ]}
                  operation={(v) => ({
                    ton: 'info',
                    titre: 'Restauration lancée',
                    detail: `${v.granularite === 'complete' ? 'Machine entière' : 'Fichiers'} · ${v.destination === 'origine' ? 'sur place' : 'vers une autre cible'}`,
                    // Avant ce correctif, ce bouton ne passait aucun `appel` : en mode
                    // API, il jouait un job simulé et un toast de succès sans jamais
                    // appeler `POST /sauvegarde/restaurations` — vérifié en direct sur
                    // dev01 (aucune requête réseau). Cible le point le plus récent,
                    // comme l'annonce la description.
                    appel: pointPlusRecent
                      ? () =>
                          creerRessource('/sauvegarde/restaurations', {
                            pointId: pointPlusRecent.id,
                            cible:
                              v.destination === 'origine'
                                ? 'origine'
                                : v.destination === 'autre-site'
                                  ? 'autre_site'
                                  : 'nouvelle_ressource',
                            granularite: v.granularite,
                          })
                      : undefined,
                    job: { workflow: 'backup.restore', cible: vm.nom },
                  })}
                />
                ) : undefined
              }
            />
            {points.length === 0 ? (
              <EmptyState
                titre="Aucun point de restauration"
                phrase="Les points apparaîtront après la première exécution réussie du plan de sauvegarde."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Date', 'Type', 'Taille', 'Destination', 'Immuable', 'Vérifié', ''].map((h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 text-[12.5px] text-ink">{dateHeure(p.date)}</td>
                        <td className="px-3 py-2.5 text-[12.5px] text-g-700">{p.type}</td>
                        <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                          {goHumain(p.tailleGo)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">
                          {p.destination}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-g-700">
                          {p.immuableJusquau ? `jusqu’au ${dateCourte(p.immuableJusquau)}` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={p.verifie ? 'ok' : 'neutral'} size="sm">
                            {p.verifie ? 'Oui' : 'Non'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <BoutonAction
                            libelle="Restaurer"
                            variant="ghost"
                            operation={{
                              action: 'backup.restore',
                              ton: 'info',
                              titre: `Restauration du ${dateHeure(p.date)}`,
                              // Même correctif que `/app/sauvegarde` (`OngletPoints`) : sans
                              // `appel`, ce bouton ne faisait jamais l'aller-retour réel —
                              // toast de succès et job simulés sans que
                              // `POST /sauvegarde/restaurations` ne parte.
                              appel: () =>
                                creerRessource('/sauvegarde/restaurations', {
                                  pointId: p.id,
                                  cible: 'origine',
                                  granularite: 'complete',
                                }),
                              job: { workflow: 'backup.restore', cible: `${vm.nom} · ${dateCourte(p.date)}` },
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 border-t border-g-100 pt-3 text-[11.5px] leading-relaxed text-g-500">
              Granularité disponible pour une machine : machine entière, volume, système de fichiers
              parcourable, fichier unique. La destination peut être le même emplacement, un autre
              Espace Cloud, l’autre site, ou un téléchargement local.
            </p>
          </Card>
        </div>
      )}

      {/* Console en panneau plein écran */}
      <Drawer
        open={console_}
        onClose={() => setConsole(false)}
        title={`Console · ${vm.nom}`}
        description="Le portail encapsule la console KVM de l’hyperviseur. Il ne réimplémente pas le protocole."
        size="full"
        footer={
          <>
            <span className="mr-auto text-[11.5px] text-g-500">
              Session console chiffrée · déconnexion automatique après 15 minutes d’inactivité
            </span>
            {/*
              Envoyer Ctrl+Alt+Suppr a été retiré plutôt que simulé : `vnc_lite.html`
              (noVNC) n'expose ni contrôle à l'écran ni API `postMessage` pour piloter
              la session depuis la page parente. Le rendre réel demanderait de modifier
              la page noVNC vendée côté backend/Apache — hors périmètre d'un correctif
              frontend. Un bouton manquant est honnête ; un bouton qui fait semblant ne
              l'est pas.
            */}
            <Button
              variant="ghost"
              iconBefore={<Maximize2 size={13} />}
              disabled={estActif() && !consoleUrl}
              title={estActif() && !consoleUrl ? 'La console se connecte encore.' : undefined}
              onClick={() => {
                if (!estActif()) {
                  executer({
                    ton: 'info',
                    titre: 'Console en plein écran',
                    detail: 'Démonstration : il n’y a pas de console réelle à ouvrir en mode maquette.',
                  })
                  return
                }
                if (consoleUrl) window.open(consoleUrl, '_blank')
              }}
            >
              Plein écran
            </Button>
            <Button variant="ghost" onClick={() => setConsole(false)}>
              Fermer
            </Button>
          </>
        }
      >
        <div className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-[8px] border border-g-300 bg-p-900">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                !estActif() || consoleUrl
                  ? 'bg-ok animate-pulse-dot'
                  : consoleErreur
                    ? 'bg-err'
                    : 'bg-warn animate-pulse-dot',
              )}
            />
            <span className="type-micro text-p-300">
              {!estActif()
                ? `Démonstration · ${vm.nom} · ${vm.os}`
                : consoleUrl
                  ? `Connecté · ${vm.nom} · ${vm.os}`
                  : consoleErreur
                    ? `Échec de connexion · ${vm.nom}`
                    : `Connexion à la console de ${vm.nom}…`}
            </span>
          </div>

          {!estActif() ? (
            <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[#C9E4CA]">
{`Ubuntu 24.04.1 LTS ${vm.nom} tty1

${vm.nom} login: ops
Password:

Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-45-generic x86_64)

 * Documentation:  https://docs.synelia.cloud
 * Support:        https://app.synelia.cloud/support

  Système d'information au ${dateHeure('2026-08-19T15:20:00Z')}

  Charge système :  0,42               Processus :            186
  Utilisation /  :  57,0 % de ${goHumain(vm.diskGo)}   Utilisateurs :         1
  Mémoire        :  61 %               IP privée :            ${ipPrivee}
  Swap           :  0 %                ${ipPublique ? `IP publique :          ${ipPublique}` : ''}

  Sauvegarde     :  ${vm.derniereSauvegarde ? `dernière ${relatif(vm.derniereSauvegarde)}` : 'aucun plan appliqué'}
  Supervision    :  sondes actives (Centreon)

0 mise à jour peut être appliquée immédiatement.

Dernière connexion : ${dateHeure('2026-08-19T09:31:00Z')} depuis 10.99.0.14

ops@${vm.nom}:~$ systemctl is-system-running
running

ops@${vm.nom}:~$ _`}
            </pre>
          ) : consoleChargement ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <span className="type-micro text-p-300">Ouverture de la console…</span>
            </div>
          ) : consoleErreur ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13px] font-semibold text-white">Impossible d’ouvrir la console</p>
              <p className="max-w-md text-[12.5px] leading-relaxed text-p-300">{consoleErreur.message}</p>
              {consoleErreur.correlationId && (
                <div className="w-full max-w-xs [color-scheme:light]">
                  <CopyField label="Identifiant de corrélation" value={consoleErreur.correlationId} />
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={ouvrirConsole}>
                Réessayer
              </Button>
            </div>
          ) : consoleUrl ? (
            <iframe
              src={consoleUrl}
              title={`Console de ${vm.nom}`}
              className="flex-1 border-0"
              allow="clipboard-read; clipboard-write"
            />
          ) : null}
        </div>
      </Drawer>

      <ModaleFormulaire
        ouvert={redimensionnement}
        onFermer={() => setRedimensionnement(false)}
        titre={`Redimensionner ${vm.nom}`}
        description={
          gabaritsCibles.length > 0
            ? 'L’ajout de vCPU et de mémoire s’applique à chaud sur cette image ; un retrait exige un redémarrage. Seuls les gabarits réels du catalogue sont proposés : Nova ne sait redimensionner que vers un gabarit existant, jamais vers un vCPU/Go choisi librement.'
            : 'Aucun gabarit du catalogue n’offre plus de vCPU, de mémoire et de disque que le gabarit actuel : cette machine est déjà sur le plus grand gabarit disponible.'
        }
        champs={
          gabaritsCibles.length > 0
            ? [
                {
                  id: 'gabaritId',
                  label: 'Nouveau gabarit',
                  type: 'select',
                  obligatoire: true,
                  options: gabaritsCibles.map((g) => ({
                    value: g.id,
                    label: `${g.nom} — ${g.vcpu} vCPU · ${g.ramGo} Go · ${g.diskGo} Go`,
                  })),
                },
              ]
            : []
        }
        valeursDepart={{ gabaritId: gabaritsCibles[0]?.id ?? '' }}
        libelleValider="Redimensionner"
        onValider={(v) => {
          const cible = gabaritsCibles.find((g) => g.id === v.gabaritId)
          if (!cible) return
          executer({
            action: 'vm.hardware.update',
            titre: `${vm.nom} redimensionnée`,
            detail: `${cible.vcpu} vCPU · ${cible.ramGo} Go · ${cible.diskGo} Go`,
            appel: () =>
              requete(`/vms/${encodeURIComponent(vm.id)}/redimensionnement`, {
                methode: 'POST',
                corps: { vcpu: cible.vcpu, ramGo: cible.ramGo, diskGo: cible.diskGo },
              }),
            effet: () =>
              parc.modifier(vm.id, {
                vcpu: cible.vcpu,
                ramGo: cible.ramGo,
                diskGo: cible.diskGo,
                flavor: cible.id,
              }),
            effetFinal: () => parc.recharger(),
          })
        }}
      />

      <ConfirmDialog
        open={suppression}
        onClose={() => setSuppression(false)}
        onConfirm={() =>
          executer({
            action: 'vm.create_delete',
            ton: 'warn',
            titre: `Suppression de ${vm.nom} lancée`,
            detail: 'Le quota sera libéré à la fin de l’opération.',
            // En mode API la suppression part avec le nom exact exigé par le
            // backend ; les volumes de données survivent côté backend aussi.
            appel: () => supprimerRessource('/vms', vm.id, vm.nom),
            effet: () => {
              // Les volumes de données survivent à la machine : on les détache.
              volumes.forEach((v) => disques.modifier(v.id, { attachedTo: undefined }))
              parc.supprimer(vm.id)
              router.push('/app/vms')
            },
            effetFinal: () => {
              parc.recharger()
              router.push('/app/vms')
            },
          })
        }
        titre="Supprimer cette machine virtuelle"
        ressource={vm.nom}
        pertes={[
          'Le disque système et son contenu seront détruits',
          `${volumes.length} volume(s) attaché(s) seront détaché(s) puis conservé(s) séparément`,
          `${snapshots.items.length} snapshot(s) seront supprimés`,
          points.length > 0
            ? `Les points de restauration restent disponibles pendant ${plan?.retentionJours ?? 30} jours`
            : 'Aucun point de restauration n’existe : la perte sera définitive',
          `${vm.vcpu} vCPU et ${vm.ramGo} Go seront rendus au quota de ${espace?.code}`,
        ]}
        libelleAction="Supprimer la machine"
      />
    </div>
  )
}

// ─── Onglet Matériel virtuel ──────────────────────────────────────────

function OngletMateriel({ vm }: { vm: VM }) {
  const { autorise, refus } = useApp()
  const parc = useCollection<VM>('vms', VMS)
  const executer = useOperation()
  const [sousOnglet, setSousOnglet] = useState<'materiel' | 'options' | 'avance'>('materiel')

  // Formulaire contrôlé : sans état local, « Appliquer les modifications »
  // n'aurait rien à appliquer.
  const [vcpu, setVcpu] = useState(vm.vcpu)
  const [ram, setRam] = useState(vm.ramGo)
  const [scsi, setScsi] = useState('paravirtual')
  const [nics, setNics] = useState(vm.hardware.nics)
  const [video, setVideo] = useState(String(vm.hardware.videoMo ?? 16))
  const [usb, setUsb] = useState(vm.hardware.usb)
  const [secureBoot, setSecureBoot] = useState(vm.hardware.secureBoot)
  const [vtpm, setVtpm] = useState(vm.hardware.vtpm ?? false)

  const [demarrageAuto, setDemarrageAuto] = useState(true)
  const [ordre, setOrdre] = useState(2)
  const [ntp, setNtp] = useState('synelia')
  const [quiescing, setQuiescing] = useState(true)

  const [reservationCpu, setReservationCpu] = useState(0)
  const [limiteCpu, setLimiteCpu] = useState(0)
  const [reservationRam, setReservationRam] = useState(Math.round(vm.ramGo / 2))
  const [antiAffinite, setAntiAffinite] = useState(vm.tags?.includes('production') ? 'prod-web' : '')
  const [migrationChaud, setMigrationChaud] = useState(true)

  const materielModifie =
    vcpu !== vm.vcpu ||
    ram !== vm.ramGo ||
    nics !== vm.hardware.nics ||
    video !== String(vm.hardware.videoMo ?? 16) ||
    usb !== vm.hardware.usb ||
    secureBoot !== vm.hardware.secureBoot ||
    vtpm !== (vm.hardware.vtpm ?? false)

  const redemarrageNecessaire =
    vcpu < vm.vcpu ||
    ram < vm.ramGo ||
    nics !== vm.hardware.nics ||
    usb !== vm.hardware.usb ||
    secureBoot !== vm.hardware.secureBoot ||
    vtpm !== (vm.hardware.vtpm ?? false)

  const appliquerMateriel = () =>
    executer({
      action: 'vm.hardware.update',
      titre: `Matériel de ${vm.nom} mis à jour`,
      detail: redemarrageNecessaire
        ? 'Un redémarrage est nécessaire pour que tout soit pris en compte.'
        : 'Modifications appliquées à chaud.',
      // Seuls vCPU et mémoire ont un équivalent API ; le reste (cartes,
      // USB, Secure Boot…) reste une préférence d’affichage locale.
      appel: () =>
        requete(`/vms/${encodeURIComponent(vm.id)}/redimensionnement`, {
          methode: 'POST',
          corps: { vcpu, ramGo: ram },
        }),
      effet: () =>
        parc.modifier(vm.id, (v) => ({
          vcpu,
          ramGo: ram,
          flavor: vcpu !== v.vcpu || ram !== v.ramGo ? 'personnalisé' : v.flavor,
          hardware: {
            ...v.hardware,
            nics,
            usb,
            secureBoot,
            vtpm,
            videoMo: Number(video),
          },
        })),
      ...(redemarrageNecessaire
        ? {
            job: { workflow: 'vm.resize', cible: vm.nom },
          }
        : {}),
      effetFinal: () => parc.recharger(),
    })

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={sousOnglet}
        onChange={setSousOnglet}
        options={[
          { value: 'materiel', label: 'Matériel virtuel' },
          { value: 'options', label: 'Options de la VM' },
          { value: 'avance', label: 'Paramètres avancés' },
        ]}
      />

      {sousOnglet === 'materiel' && (
        <Card>
          <CardHeader
            titre="Matériel virtuel"
            sousTitre="Chaque modification indique si elle exige un redémarrage de la machine."
            actions={
              <GatedAction
                autorise={autorise('vm.hardware.update')}
                message={refus('vm.hardware.update')}
              >
                <Button size="sm" disabled={!materielModifie} onClick={appliquerMateriel}>
                  Appliquer les modifications
                </Button>
              </GatedAction>
            }
          />
          <div className="space-y-4">
            <Ligne
              libelle="vCPU"
              redemarrage={false}
              note="Ajout à chaud possible sur cette image ; le retrait exige un redémarrage."
            >
              <Input
                type="number"
                value={vcpu}
                onChange={(e) => setVcpu(Number(e.target.value))}
                min={1}
                max={64}
                className="w-24"
              />
            </Ligne>
            <Ligne
              libelle="Mémoire"
              redemarrage={false}
              note="Ajout à chaud possible ; le retrait exige un redémarrage."
            >
              <Input
                type="number"
                value={ram}
                onChange={(e) => setRam(Number(e.target.value))}
                min={1}
                max={256}
                suffix="Go"
                className="w-32"
              />
            </Ligne>
            <Ligne
              libelle="Contrôleur SCSI"
              redemarrage
              note="Le changement de type de contrôleur peut nécessiter un pilote dans l’invité."
            >
              <Select value={scsi} onChange={(e) => setScsi(e.target.value)} className="w-56">
                <option value="paravirtual">VirtIO SCSI (paravirtualisé)</option>
                <option value="lsi">LSI Logic SAS</option>
                <option value="nvme">NVMe</option>
              </Select>
            </Ligne>
            <Ligne libelle="Cartes réseau" redemarrage note="Une carte ajoutée apparaît comme ethN dans l’invité.">
              <Input
                type="number"
                value={nics}
                onChange={(e) => setNics(Number(e.target.value))}
                min={1}
                max={8}
                className="w-24"
              />
            </Ligne>
            <Ligne libelle="Carte vidéo" redemarrage={false} note="Mémoire vidéo allouée à la console.">
              <Select value={video} onChange={(e) => setVideo(e.target.value)} className="w-40">
                <option value="8">8 Mo</option>
                <option value="16">16 Mo</option>
                <option value="32">32 Mo</option>
                <option value="64">64 Mo</option>
              </Select>
            </Ligne>
            <Ligne
              libelle="Périphériques USB"
              redemarrage
              note="Redirection USB depuis la console. Déconseillé en production."
            >
              <Switch checked={usb} onChange={setUsb} label="Redirection USB" />
            </Ligne>
            <Ligne
              libelle="Périphériques de sécurité"
              redemarrage
              note="Secure Boot et vTPM sont requis par Windows 11 et par le chiffrement de disque BitLocker ou LUKS scellé."
            >
              <div className="flex flex-col items-end gap-2">
                <Switch checked={secureBoot} onChange={setSecureBoot} label="Secure Boot" />
                <Switch checked={vtpm} onChange={setVtpm} label="vTPM 2.0" />
              </div>
            </Ligne>
          </div>
        </Card>
      )}

      {sousOnglet === 'options' && (
        <Card>
          <CardHeader
            titre="Options de la VM"
            actions={
              <GatedAction
                autorise={autorise('vm.hardware.update')}
                message={refus('vm.hardware.update')}
              >
                <Button
                  size="sm"
                  onClick={() =>
                    executer({
                      action: 'vm.hardware.update',
                      titre: 'Options de la machine enregistrées',
                      detail: `Démarrage automatique ${demarrageAuto ? 'activé' : 'désactivé'} · ordre ${ordre} · horloge ${ntp === 'synelia' ? 'NTP interne' : 'hyperviseur'}`,
                    })
                  }
                >
                  Enregistrer les options
                </Button>
              </GatedAction>
            }
          />
          <div className="space-y-4">
            <Ligne libelle="Démarrage automatique de l’hôte" redemarrage={false} note="Redémarre la machine après une maintenance de l’hyperviseur.">
              <Switch checked={demarrageAuto} onChange={setDemarrageAuto} label="Démarrage automatique" />
            </Ligne>
            <Ligne libelle="Ordre de démarrage" redemarrage={false} note="Priorité au sein d’un groupe de démarrage PRA.">
              <Input
                type="number"
                value={ordre}
                onChange={(e) => setOrdre(Number(e.target.value))}
                min={1}
                max={10}
                className="w-24"
              />
            </Ligne>
            <Ligne libelle="Synchronisation horaire" redemarrage={false} note="NTP interne Synelia, pas d’accès NTP public nécessaire.">
              <Select value={ntp} onChange={(e) => setNtp(e.target.value)} className="w-56">
                <option value="synelia">ntp.interne.synelia.cloud</option>
                <option value="hote">Horloge de l’hyperviseur</option>
              </Select>
            </Ligne>
            <Ligne libelle="Agent invité" redemarrage={false} note="Permet l’arrêt propre, le quiescing des sauvegardes et la remontée de métriques fines.">
              <Badge tone="ok" dot>
                Installé et actif
              </Badge>
            </Ligne>
            <Ligne libelle="Quiescing des sauvegardes" redemarrage={false} note="Suspend brièvement les écritures pour garantir la cohérence applicative du point de restauration.">
              <Switch checked={quiescing} onChange={setQuiescing} label="Quiescing" />
            </Ligne>
          </div>
        </Card>
      )}

      {sousOnglet === 'avance' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Paramètres avancés"
              actions={
                <GatedAction
                  autorise={autorise('vm.hardware.update')}
                  message={refus('vm.hardware.update')}
                >
                  <Button
                    size="sm"
                    onClick={() =>
                      executer({
                        action: 'vm.hardware.update',
                        titre: 'Paramètres avancés appliqués',
                        detail: `Réservation ${reservationCpu} MHz · limite ${limiteCpu === 0 ? 'aucune' : `${limiteCpu} MHz`} · anti-affinité ${antiAffinite || 'aucune'}`,
                        effet: () =>
                          antiAffinite
                            ? parc.modifier(vm.id, (v) => ({
                                tags: Array.from(new Set([...(v.tags ?? []), antiAffinite])),
                              }))
                            : undefined,
                      })
                    }
                  >
                    Appliquer
                  </Button>
                </GatedAction>
              }
            />
            <div className="space-y-4">
              <Ligne libelle="Réservation CPU" redemarrage={false} note="Garantit une part minimale de cycles, même en cas de contention sur l’hôte.">
                <Input
                  type="number"
                  value={reservationCpu}
                  onChange={(e) => setReservationCpu(Number(e.target.value))}
                  suffix="MHz"
                  className="w-32"
                />
              </Ligne>
              <Ligne libelle="Limite CPU" redemarrage={false} note="Plafonne la consommation. Laisser à 0 pour aucune limite.">
                <Input
                  type="number"
                  value={limiteCpu}
                  onChange={(e) => setLimiteCpu(Number(e.target.value))}
                  suffix="MHz"
                  className="w-32"
                />
              </Ligne>
              <Ligne libelle="Réservation mémoire" redemarrage={false} note="Mémoire garantie non sujette au ballooning.">
                <Input
                  type="number"
                  value={reservationRam}
                  onChange={(e) => setReservationRam(Number(e.target.value))}
                  suffix="Go"
                  className="w-32"
                />
              </Ligne>
              <Ligne libelle="Groupe d’anti-affinité" redemarrage={false} note="Les machines d’un même groupe ne sont jamais placées sur le même hôte physique.">
                <Select
                  value={antiAffinite}
                  onChange={(e) => setAntiAffinite(e.target.value)}
                  className="w-56"
                >
                  <option value="">Aucun</option>
                  <option value="prod-web">prod-web</option>
                  <option value="prod-data">prod-data</option>
                </Select>
              </Ligne>
              <Ligne libelle="Migration à chaud" redemarrage={false} note="Autorise nos équipes à déplacer la machine entre hôtes sans interruption, pour les opérations de maintenance.">
                <Switch checked={migrationChaud} onChange={setMigrationChaud} label="Migration à chaud" />
              </Ligne>
            </div>
          </Card>
          <Callout ton="violet" titre="Ce que vous ne voyez pas ici, volontairement">
            L’hôte physique et l’hyperviseur sur lequel tourne cette machine ne sont pas exposés :
            c’est une décision de placement côté fournisseur, qui nous permet de rééquilibrer la
            charge sans vous impliquer. L’emplacement que nous exposons est le site — Abidjan ou
            Grand-Bassam — parce que c’est celui qui vous engage contractuellement.
          </Callout>
        </div>
      )}
    </div>
  )
}

function Ligne({
  libelle,
  note,
  redemarrage,
  children,
}: {
  libelle: string
  note: string
  redemarrage: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-g-100 pb-3.5 last:border-0 last:pb-0">
      <div className="min-w-0 max-w-md">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
          {libelle}
          <Badge tone={redemarrage ? 'warn' : 'ok'} size="sm">
            {redemarrage ? 'Redémarrage requis' : 'Applicable à chaud'}
          </Badge>
        </p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-500">{note}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
