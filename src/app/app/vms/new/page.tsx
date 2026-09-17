'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Copy, Layers, Plus, Server, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num } from '@/lib/format'
import { BACKUP_PLANS, ESPACES, NETWORKS, SECURITY_GROUPS, PUBLIC_IPS, LOAD_BALANCERS, VMS } from '@/lib/mock'
import type { EspaceCloud, LoadBalancer, Network, PublicIP, SecurityGroup, VM } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import {
  Checkbox,
  Field,
  Input,
  MonoTextarea,
  Select,
  SegmentedControl,
  Slider,
  Switch,
} from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { CostPreview, WizardShell } from '@/components/composition/flow'
import { useApp, useEspace } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { useOperation } from '@/components/app/actions'
import { creerRessource, estActif, requete } from '@/lib/api/client'

const ETAPES = [
  { numero: 1, titre: 'Mode' },
  { numero: 2, titre: 'Image' },
  { numero: 3, titre: 'Gabarit' },
  { numero: 4, titre: 'Réseau' },
  { numero: 5, titre: 'Options' },
  { numero: 6, titre: 'Récapitulatif' },
]

const IMAGES_SYNELIA = [
  { id: 'ubuntu-2404', nom: 'Ubuntu Server 24.04 LTS', detail: 'Noyau 6.8 · support jusqu’en 2029 · CIS niveau 1', licence: 0 },
  { id: 'debian-12', nom: 'Debian 12', detail: 'Stable · cloud-init · CIS niveau 1', licence: 0 },
  { id: 'rocky-9', nom: 'Rocky Linux 9', detail: 'Compatible RHEL 9 · SELinux activé', licence: 0 },
  { id: 'alpine-320', nom: 'Alpine Linux 3.20', detail: 'Empreinte minimale · idéal conteneurs', licence: 0 },
  { id: 'win-2022', nom: 'Windows Server 2022', detail: 'Licence Datacenter refacturée au vCPU', licence: 9500 },
]

const IMAGES_PRIVEES = [
  { id: 'priv-base-dba', nom: 'dba-base-hardened', detail: 'Ubuntu 24.04 durci · agents internes préinstallés', licence: 0 },
  { id: 'priv-legacy', nom: 'legacy-centos7-snapshot', detail: 'Capturée depuis legacy-erp-01 le 12/07/2026', licence: 0 },
]

const FLAVORS = [
  { id: 'c1.small', nom: 'c1.small', vcpu: 2, ram: 8, disk: 40, prix: 4200, famille: 'Usage général' },
  { id: 'c2.medium', nom: 'c2.medium', vcpu: 4, ram: 8, disk: 120, prix: 7800, famille: 'Usage général' },
  { id: 'c2.large', nom: 'c2.large', vcpu: 8, ram: 16, disk: 200, prix: 15600, famille: 'Usage général' },
  { id: 'r2.large', nom: 'r2.large', vcpu: 8, ram: 32, disk: 500, prix: 24800, famille: 'Optimisé mémoire' },
  { id: 'r2.xlarge', nom: 'r2.xlarge', vcpu: 16, ram: 64, disk: 500, prix: 46000, famille: 'Optimisé mémoire' },
  { id: 'g2.medium', nom: 'g2.medium', vcpu: 4, ram: 16, disk: 250, prix: 62000, famille: 'GPU / vGPU' },
]

interface LigneDifferenciee {
  id: string
  nom: string
  vcpu: number
  ram: number
  disk: number
  image: string
}

const CLOUD_INIT_DEFAUT = `#cloud-config
package_update: true
packages:
  - fail2ban
  - unattended-upgrades

users:
  - name: ops
    groups: [sudo]
    shell: /bin/bash
    sudo: ["ALL=(ALL) NOPASSWD:ALL"]
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3Nza… ops@dba.africa

write_files:
  - path: /etc/ssh/sshd_config.d/99-synelia.conf
    content: |
      PasswordAuthentication no
      PermitRootLogin no

runcmd:
  - systemctl enable --now fail2ban
`

export default function NouvellesVms() {
  const router = useRouter()
  const { pousser } = useApp()
  const espaceCourant = useEspace()
  const parc = useCollection<VM>('vms', VMS)
  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  // Étape « Réseau » : les quatre sélecteurs lisaient jusqu'ici des graines de
  // maquette (`SECURITY_GROUPS`/`PUBLIC_IPS`/`LOAD_BALANCERS` importés tels
  // quels, `reseau` sur une liste de valeurs en dur) même en mode API, alors
  // que `/app/reseau` prouve que ces quatre collections sont réellement
  // provisionnées sur Neutron (`reseaux`, `ips`, `groupes-securite`,
  // `load-balancers`, toutes dans le registre `collections.ts`).
  const reseauxCollection = useCollection<Network>('reseaux', NETWORKS)
  const ipsCollection = useCollection<PublicIP>('ips', PUBLIC_IPS)
  const groupesCollection = useCollection<SecurityGroup>('groupes-securite', SECURITY_GROUPS)
  const lbCollection = useCollection<LoadBalancer>('load-balancers', LOAD_BALANCERS)
  // `GET /catalogue/gabarits` est le même catalogue que `/tarifs` publie
  // (`familles_tarifs()` le dérive des mêmes `GABARITS` OpenStack côté
  // backend) : on l'utilise ici pour que le prix affiché dans l'assistant
  // ne contredise jamais celui de la vitrine.
  const [gabaritsReels, setGabaritsReels] = useState<
    Array<{ vcpu: number; ramGo: number; prixMensuel: number }>
  >([])
  useEffect(() => {
    if (!estActif()) return
    requete<Array<{ vcpu: number; ramGo: number; prixMensuel: number }>>('/catalogue/gabarits').then(
      setGabaritsReels,
      () => {},
    )
  }, [])
  const { lancerJob } = useAtelier()
  const executer = useOperation()

  const [etape, setEtape] = useState(1)
  const [mode, setMode] = useState<'identique' | 'differencie'>('identique')
  const [espaceId, setEspaceId] = useState(espaceCourant.id)
  const [image, setImage] = useState('ubuntu-2404')
  const [sourceImage, setSourceImage] = useState<'synelia' | 'privee'>('synelia')

  const [flavor, setFlavor] = useState('c2.medium')
  const [personnalise, setPersonnalise] = useState(false)
  const [vcpu, setVcpu] = useState(4)
  const [ram, setRam] = useState(8)
  const [disk, setDisk] = useState(120)
  const [gpu, setGpu] = useState(false)
  const [nombre, setNombre] = useState(2)
  const [prefixe, setPrefixe] = useState('web-prod')

  const [lignes, setLignes] = useState<LigneDifferenciee[]>([
    { id: 'l1', nom: 'app-01', vcpu: 4, ram: 8, disk: 120, image: 'ubuntu-2404' },
    { id: 'l2', nom: 'db-01', vcpu: 8, ram: 32, disk: 500, image: 'debian-12' },
  ])

  const [reseau, setReseau] = useState('')
  const [ipPublique, setIpPublique] = useState(false)
  const [sg, setSg] = useState('')
  const [lb, setLb] = useState('')

  const [cloudInit, setCloudInit] = useState(CLOUD_INIT_DEFAUT)
  const [planSauvegarde, setPlanSauvegarde] = useState('bp-prod-quotidien')
  const [antiAffinite, setAntiAffinite] = useState(true)
  const [planification, setPlanification] = useState(false)
  const [conditions, setConditions] = useState(false)

  const images = sourceImage === 'synelia' ? IMAGES_SYNELIA : IMAGES_PRIVEES
  const imageChoisie = [...IMAGES_SYNELIA, ...IMAGES_PRIVEES].find((i) => i.id === image)
  // Les gabarits (vCPU/RAM/disque) restent ceux de la maquette — le choix
  // visuel ne correspond de toute façon pas au gabarit réel provisionné
  // (voir le commentaire plus bas sur `creerLeLot`) — mais le tarif affiché
  // vient du catalogue réel (`/catalogue/gabarits`) quand il a chargé, pour
  // ne plus contredire `/tarifs`.
  const prixReel = (vcpu: number) => {
    if (gabaritsReels.length === 0) return undefined
    const proche = gabaritsReels.reduce((best, g) =>
      Math.abs(g.vcpu - vcpu) < Math.abs(best.vcpu - vcpu) ? g : best,
    )
    return proche.prixMensuel
  }
  const FLAVORS_AFFICHES = FLAVORS.map((f) => ({ ...f, prix: prixReel(f.vcpu) ?? f.prix }))
  const flavorChoisi = FLAVORS_AFFICHES.find((f) => f.id === flavor)!
  // L’espace choisi peut ne plus figurer dans la liste (supprimé pendant la
  // session, autre organisation) : on retombe sur le premier au lieu de
  // planter sur `espace.usage`.
  const espace = espaces.items.find((e) => e.id === espaceId) ?? espaces.items[0]

  // Périmètre de l'étape Réseau : les quatre collections filtrées à l'espace
  // choisi, sur le même motif que `/app/reseau` (`n.espaceId === espace.id`).
  const reseauxEspace = useMemo(
    () => reseauxCollection.items.filter((n) => n.espaceId === espace?.id),
    [reseauxCollection.items, espace?.id],
  )
  const ipsEspace = useMemo(
    () => ipsCollection.items.filter((i) => i.espaceId === espace?.id),
    [ipsCollection.items, espace?.id],
  )
  const groupesEspace = useMemo(
    () => groupesCollection.items.filter((s) => s.espaceId === espace?.id),
    [groupesCollection.items, espace?.id],
  )
  const lbEspace = useMemo(
    () => lbCollection.items.filter((l) => l.espaceId === espace?.id),
    [lbCollection.items, espace?.id],
  )
  const ipsDisponibles = ipsEspace.filter((i) => !i.attachedTo).length

  // `reseau`/`sg` par défaut pointaient sur des identifiants de maquette
  // (`prod-front`, `sg-2`) qui n'existent jamais dans le vrai dépôt — resync
  // sur la vraie liste dès qu'elle charge (mode API) ou change (changement
  // d'espace), même motif que `offerId` dans `espaces/new`. Un changement
  // d'espace invalide le choix précédent, qu'on ne veut pas garder muet.
  // Le garde `length === 0 → return` d'origine laissait une valeur de
  // maquette (`net-1`/`sg-1`, capturée pendant l'instant où `reseauxEspace`/
  // `groupesEspace` valaient encore la graine, avant la première réponse
  // réelle) survivre telle quelle quand l'Espace n'a en fait aucun réseau ou
  // groupe réel — l'écran affichait alors « Aucun réseau privé dans… » (donc
  // aucun sélecteur pour la corriger) tout en envoyant ce vieil identifiant à
  // Nova, qui le rejette (`{'uuid': 'net-1'} is not valid`) — trouvé en testant
  // une création réelle en direct sur dev01. Invalider dans tous les cas,
  // vide y compris, pas seulement quand la liste réelle est non vide.
  useEffect(() => {
    if (!reseauxEspace.some((n) => n.id === reseau)) setReseau(reseauxEspace[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reseauxEspace])
  useEffect(() => {
    if (!groupesEspace.some((s) => s.id === sg)) setSg(groupesEspace[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupesEspace])
  useEffect(() => {
    if (lb && !lbEspace.some((l) => l.id === lb)) setLb('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbEspace])

  const machinesACreer = useMemo(() => {
    if (mode === 'differencie') {
      return lignes.map((l) => ({
        nom: l.nom,
        vcpu: l.vcpu,
        ram: l.ram,
        disk: l.disk,
        image: l.image,
      }))
    }
    const v = personnalise ? vcpu : flavorChoisi.vcpu
    const r = personnalise ? ram : flavorChoisi.ram
    const d = personnalise ? disk : flavorChoisi.disk
    return Array.from({ length: nombre }, (_, i) => ({
      nom: `${prefixe}-${String(i + 1).padStart(2, '0')}`,
      vcpu: v,
      ram: r,
      disk: d,
      image,
    }))
  }, [mode, lignes, personnalise, vcpu, ram, disk, flavorChoisi, nombre, prefixe, image])

  const totalVcpu = machinesACreer.reduce((a, m) => a + m.vcpu, 0)
  const totalRam = machinesACreer.reduce((a, m) => a + m.ram, 0)
  const totalDisk = machinesACreer.reduce((a, m) => a + m.disk, 0)

  const coutCalcul = machinesACreer.reduce((a, m) => {
    const proche =
      FLAVORS_AFFICHES.find((f) => f.vcpu === m.vcpu && f.ram === m.ram) ??
      FLAVORS_AFFICHES.reduce((best, f) =>
        Math.abs(f.vcpu - m.vcpu) < Math.abs(best.vcpu - m.vcpu) ? f : best,
      )
    return a + Math.round((proche.prix * m.vcpu) / proche.vcpu)
  }, 0)

  const coutLicence = (imageChoisie?.licence ?? 0) * totalVcpu
  const coutIp = ipPublique ? machinesACreer.length * 3500 : 0

  const lignesCout = [
    {
      libelle: `Calcul · ${machinesACreer.length} machine${machinesACreer.length > 1 ? 's' : ''}`,
      detail: `${totalVcpu} vCPU · ${totalRam} Go · ${num(totalDisk)} Go de disque`,
      montant: coutCalcul,
    },
    ...(coutLicence > 0
      ? [
          {
            libelle: 'Licences Windows Server',
            detail: `Refacturées au vCPU · ${totalVcpu} vCPU`,
            montant: coutLicence,
          },
        ]
      : []),
    ...(coutIp > 0
      ? [
          {
            libelle: 'IP publiques',
            detail: `${machinesACreer.length} × 3 500 FCFA`,
            montant: coutIp,
          },
        ]
      : []),
  ]

  const quotaSuffisant =
    espace !== undefined &&
    espace.usage.vcpu + totalVcpu <= espace.quota.vcpu &&
    espace.usage.ramGo + totalRam <= espace.quota.ramGo

  const peutContinuer = etape === 6 ? conditions && quotaSuffisant : true

  if (!espace) {
    return (
      <EmptyState
        titre="Aucun Espace Cloud disponible"
        phrase="Créez d’abord un Espace Cloud : c’est l’enveloppe de quota dans laquelle naissent les machines."
        action={{ libelle: 'Créer un Espace Cloud', href: '/app/espaces/new' }}
      />
    )
  }

  /**
   * Les machines apparaissent tout de suite dans la liste, à l'état
   * « creating » : c'est ce que fait un orchestrateur, et cela donne au job
   * du centre de tâches quelque chose à faire basculer en fin de course.
   */
  const creerLeLot = () => {
    // En mode API le lot part en une passe (`202` + travail suivi) ; sinon
    // la maquette simule, comme avant.
    if (estActif()) {
      executer({
        action: 'vm.create_delete',
        titre: `Création de ${machinesACreer.length} machine${machinesACreer.length > 1 ? 's' : ''} lancée`,
        detail: 'Le quota est réservé. Suivi dans le centre de tâches.',
        // Le backend valide `imageId` contre l’identifiant Glance réel
        // (`GET /catalogue/images`) et exige un vcpu/ramGo/diskGo qui
        // correspond **exactement** à un gabarit du catalogue
        // (`GET /catalogue/gabarits`) — ni l’un ni l’autre picker de cet
        // assistant n’est branché sur le catalogue réel (`IMAGES_SYNELIA` et
        // `FLAVORS` sont des constantes de maquette, un chantier à part) :
        // sans cette résolution, le backend rejetait tout (`422 Image
        // système inconnue`, puis `422 Aucun gabarit du catalogue ne
        // correspond`) — vérifié en direct sur dev01. On résout ici l’image
        // et le gabarit réels les plus proches du choix visuel, au moment de
        // l’appel — le nombre de vCPU/Go affiché avant validation reste celui
        // de la maquette, le réel part dans la requête.
        appel: () =>
          Promise.all([
            requete<Array<{ id: string; nom: string; famille: string }>>('/catalogue/images'),
            requete<Array<{ vcpu: number; ramGo: number; diskGo: number }>>('/catalogue/gabarits'),
          ]).then(([images, gabarits]) => {
            if (images.length === 0) throw new Error('Aucune image système au catalogue.')
            if (gabarits.length === 0) throw new Error('Aucun gabarit au catalogue.')
            return creerRessource('/vms/lot', {
              espaceId: espace.id,
              site: espace.site,
              // Le champ n'existait pas encore dans la charge utile : le contenu tapé à
              // l'étape « Options » (clé SSH incluse) ne partait jamais vers le backend,
              // donc jamais vers Nova — la machine démarrait sans qu'aucune des lignes de
              // ce champ n'ait jamais été appliquée. Trouvé en vérifiant en direct
              // l'injection de clé SSH par cloud-init sur une machine réellement créée.
              cloudInit,
              // Idem pour l'étape Réseau : les quatre sélecteurs lisaient une graine de
              // maquette et rien ne partait vers le backend. `reseauId` est réellement
              // consommé par `ExecuteurVmCompose` (fallback sur le réseau par défaut de
              // l'espace si absent, cf. `service.py`). `groupesSecurite` est accepté par
              // le contrat (`VmLotCreation.groupesSecurite`) mais pas encore appliqué par
              // cet exécuteur — trouvé en lisant `service.py`, noté dans DEMO-TODO.md
              // comme gap backend plutôt que masqué. IP publique et load balancer n'ont
              // aucun champ correspondant sur `/vms/lot` : leurs sélecteurs sont désactivés
              // en mode API (voir l'étape Réseau) plutôt que d'envoyer un choix ignoré.
              reseauId: reseau || undefined,
              groupesSecurite: sg ? [sg] : undefined,
              machines: machinesACreer.map((m) => {
                const famille = m.image.startsWith('win') ? 'windows' : 'linux'
                const motCle = m.image.replace(/[0-9]/g, '').replace(/-/g, '')
                const image =
                  images.find((i) => i.nom.toLowerCase().replace(/[.\-]/g, '').includes(motCle)) ??
                  images.find((i) => i.famille === famille) ??
                  images[0]
                // Le gabarit réel le plus proche du choix visuel (vCPU
                // d'abord, puis RAM, puis disque) — plus le plus petit du
                // catalogue quel que soit ce choix. Contournement posé quand
                // comp1/comp2 n'avaient que 85 Go libres chacun (un gabarit
                // « moyen » suffisait à faire échouer Nova, seul `micro`
                // construisait) : les deux nœuds ont depuis été étendus à
                // 485 Go (2026-09-09), et le gabarit `medium` du catalogue
                // (2 vCPU/4 Go/40 Go) a construit à trois reprises sans
                // erreur en direct sur dev01 — voir DEMO-TODO.md.
                const gabarit = [...gabarits].reduce((best, g) => {
                  const ecart = (x: typeof g) =>
                    Math.abs(x.vcpu - m.vcpu) * 100 +
                    Math.abs(x.ramGo - m.ram) * 10 +
                    Math.abs(x.diskGo - m.disk)
                  return ecart(g) < ecart(best) ? g : best
                })
                return {
                  nom: m.nom,
                  imageId: image.id,
                  vcpu: gabarit.vcpu,
                  ramGo: gabarit.ramGo,
                  diskGo: gabarit.diskGo,
                }
              }),
            })
          }),
        effetFinal: () => parc.recharger(),
      })
      return
    }
    const octet = parc.items.length + 11
    const nouvelles: VM[] = machinesACreer.map((m, i) => ({
      id: parc.identifiant('vm'),
      espaceId: espace.id,
      nom: m.nom,
      os: [...IMAGES_SYNELIA, ...IMAGES_PRIVEES].find((img) => img.id === m.image)?.nom ?? m.image,
      vcpu: m.vcpu,
      ramGo: m.ram,
      diskGo: m.disk,
      flavor: personnalise ? 'personnalisé' : flavor,
      ips: [
        { adresse: `10.0.1.${octet + i}`, type: 'privee' as const },
        ...(ipPublique
          ? [{ adresse: `102.176.20.${octet + i}`, type: 'publique' as const }]
          : []),
      ],
      statut: 'creating',
      hardware: {
        scsiControllers: 1,
        nics: 1,
        usb: false,
        secureBoot: true,
        videoMo: 16,
        vtpm: true,
      },
      backupPlanId: planSauvegarde || undefined,
      site: espace.site,
      tags: [prefixe.split('-')[0]].filter(Boolean),
    }))

    parc.creer(nouvelles)
    espaces.modifier(espace.id, (e) => ({
      usage: {
        ...e.usage,
        vcpu: e.usage.vcpu + totalVcpu,
        ramGo: e.usage.ramGo + totalRam,
      },
    }))

    pousser({
      ton: 'info',
      titre: `Création de ${nouvelles.length} machine${nouvelles.length > 1 ? 's' : ''} lancée`,
      detail: 'Le quota est réservé. Suivi dans le centre de tâches.',
    })

    lancerJob({
      workflow: 'vm.create',
      cible: `${nouvelles.length} machine${nouvelles.length > 1 ? 's' : ''} · ${espace.code}`,
      alFin: () => {
        parc.modifierPlusieurs(
          nouvelles.map((v) => v.id),
          { statut: 'running', derniereSauvegarde: undefined },
        )
        pousser({
          ton: 'ok',
          titre: `${nouvelles.length} machine${nouvelles.length > 1 ? 's' : ''} en marche`,
          detail: nouvelles.map((v) => v.nom).join(', '),
        })
      },
    })
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
              <Petit cle="Espace Cloud" valeur={espace.code} mono />
              <Petit cle="Mode" valeur={mode === 'identique' ? 'Gabarit identique' : 'Différenciées'} />
              <Petit cle="Machines" valeur={String(machinesACreer.length)} />
              <Petit cle="Image" valeur={imageChoisie?.nom ?? '—'} />
              <Petit cle="Total vCPU" valeur={String(totalVcpu)} />
              <Petit cle="Total mémoire" valeur={`${totalRam} Go`} />
            </dl>
            <div className="mt-3 border-t border-g-100 pt-3">
              <MicroLabel className="mb-1.5">Impact sur le quota</MicroLabel>
              <p className="tnum text-[12px] text-g-700">
                vCPU : {espace.usage.vcpu} → {espace.usage.vcpu + totalVcpu} sur {espace.quota.vcpu}
              </p>
              <p className="tnum text-[12px] text-g-700">
                Mémoire : {num(espace.usage.ramGo)} → {num(espace.usage.ramGo + totalRam)} sur{' '}
                {num(espace.quota.ramGo)} Go
              </p>
              {!quotaSuffisant && (
                <p className="mt-1.5 text-[12px] font-semibold text-err">
                  Quota insuffisant. Réduisez le nombre de machines ou étendez la capacité de
                  l’espace.
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
            onClick={() => (etape === 1 ? router.push('/app/vms') : setEtape(etape - 1))}
          >
            {etape === 1 ? 'Annuler' : 'Précédent'}
          </Button>
          {etape < 6 ? (
            <Button onClick={() => setEtape(etape + 1)}>Continuer</Button>
          ) : (
            <Button
              disabled={!peutContinuer}
              onClick={() => {
                creerLeLot()
                router.push('/app/vms')
              }}
            >
              Créer {machinesACreer.length} machine{machinesACreer.length > 1 ? 's' : ''}
            </Button>
          )}
        </>
      }
    >
      {/* Étape 1 — Mode */}
      {etape === 1 && (
        <div className="space-y-4">
          <Field label="Espace Cloud de destination">
            <Select value={espaceId} onChange={(e) => setEspaceId(e.target.value)}>
              {(estActif() ? espaces.items : ESPACES).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {e.site} · {e.quota.vcpu - e.usage.vcpu} vCPU disponibles
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: 'identique' as const,
                  icone: <Layers size={17} />,
                  titre: 'Gabarit identique',
                  texte:
                    'Un même gabarit appliqué à N machines, nommées automatiquement avec un préfixe et un numéro. C’est le mode adapté à un pool de front web, à des runners CI, ou à un groupe de nœuds interchangeables.',
                },
                {
                  id: 'differencie' as const,
                  icone: <Server size={17} />,
                  titre: 'Machines différenciées',
                  texte:
                    'Chaque machine a ses propres caractéristiques, saisies dans un tableau éditable ligne par ligne, avec duplication. C’est le mode adapté à une architecture hétérogène — un front, une base, un cache — créée en une seule opération.',
                },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  'rounded-[10px] border-2 bg-white p-5 text-left transition-colors',
                  mode === m.id ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-p-700">{m.icone}</span>
                  <span className="type-h3">{m.titre}</span>
                </span>
                <p className="mt-2.5 text-[13px] leading-relaxed text-g-700">{m.texte}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Étape 2 — Image */}
      {etape === 2 && (
        <div className="space-y-4">
          <SegmentedControl
            value={sourceImage}
            onChange={setSourceImage}
            options={[
              { value: 'synelia', label: 'Bibliothèque Synelia' },
              { value: 'privee', label: 'Images privées et capturées' },
            ]}
          />
          <div className="space-y-2">
            {images.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setImage(i.id)}
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-[8px] border-2 bg-white px-4 py-3 text-left transition-colors',
                  image === i.id ? 'border-p-700 bg-p-050' : 'border-g-300 hover:border-p-400',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">{i.nom}</span>
                  <span className="block text-[12px] text-g-500">{i.detail}</span>
                </span>
                {i.licence > 0 && (
                  <Badge tone="warn" size="sm">
                    +{money(i.licence)}/vCPU
                  </Badge>
                )}
              </button>
            ))}
          </div>
          {sourceImage === 'privee' && (
            <Callout ton="info" titre="Importer une image">
              Les formats qcow2, vmdk et vhdx sont acceptés. L’import se fait par téléversement ou
              depuis un bucket S3 de votre organisation. Une image capturée depuis une machine
              existante conserve son partitionnement et ses agents.
            </Callout>
          )}
        </div>
      )}

      {/* Étape 3 — Gabarit */}
      {etape === 3 && (
        <div className="space-y-4">
          {mode === 'identique' ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Préfixe de nommage" hint="un numéro sera ajouté">
                  <Input
                    value={prefixe}
                    onChange={(e) => setPrefixe(e.target.value)}
                    className="font-mono"
                  />
                </Field>
                <Field label="Nombre de machines">
                  <Slider label="Nombre de machines" value={nombre} onChange={setNombre} min={1} max={20} unite="machines" />
                </Field>
              </div>

              <Switch
                checked={personnalise}
                onChange={setPersonnalise}
                label="Personnaliser les caractéristiques"
                description="Plutôt que de choisir un gabarit prédéfini, réglez vCPU, mémoire et disque librement."
              />

              {personnalise ? (
                <Card>
                  <div className="space-y-5">
                    <Slider label="vCPU" value={vcpu} onChange={setVcpu} min={1} max={64} unite="vCPU" />
                    <Slider label="Mémoire" value={ram} onChange={setRam} min={1} max={256} unite="Go" />
                    <Slider
                      label="Disque système"
                      value={disk}
                      onChange={setDisk}
                      min={20}
                      max={2000}
                      step={10}
                      unite="Go"
                    />
                    <Switch
                      checked={gpu}
                      onChange={setGpu}
                      label="Ajouter un vGPU"
                      description="Partage temporel d’une carte, 8 Go de mémoire vidéo. Disponible sur le site d’Abidjan uniquement."
                    />
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FLAVORS_AFFICHES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFlavor(f.id)}
                      className={cn(
                        'rounded-[8px] border-2 bg-white p-3.5 text-left transition-colors',
                        flavor === f.id ? 'border-p-700 bg-p-050' : 'border-g-300 hover:border-p-400',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-bold text-ink">{f.nom}</span>
                        <Badge tone="neutral" size="sm">
                          {f.famille}
                        </Badge>
                      </span>
                      <span className="tnum mt-2 block text-[12px] text-g-700">
                        {f.vcpu} vCPU · {f.ram} Go · {num(f.disk)} Go
                      </span>
                      <span className="tnum mt-2 block text-[14px] font-bold text-p-700">
                        {money(f.prix)}
                        <span className="text-[11px] font-semibold text-g-500">/mois</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardHeader
                titre="Machines à créer"
                sousTitre="Une ligne par machine. Dupliquez une ligne pour en créer une variante."
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    iconBefore={<Plus size={13} />}
                    onClick={() =>
                      setLignes((p) => [
                        ...p,
                        {
                          id: `l${p.length + 1}`,
                          nom: `machine-${String(p.length + 1).padStart(2, '0')}`,
                          vcpu: 4,
                          ram: 8,
                          disk: 120,
                          image: 'ubuntu-2404',
                        },
                      ])
                    }
                  >
                    Ajouter une ligne
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Nom', 'vCPU', 'Mémoire (Go)', 'Disque (Go)', 'Image', ''].map((h) => (
                        <th key={h} className="type-micro px-2 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => (
                      <tr key={l.id} className="border-b border-g-100 last:border-0">
                        <td className="px-2 py-2">
                          <Input
                            value={l.nom}
                            onChange={(e) =>
                              setLignes((p) =>
                                p.map((x) => (x.id === l.id ? { ...x, nom: e.target.value } : x)),
                              )
                            }
                            className="w-40 font-mono"
                            aria-label={`Nom machine ${i + 1}`}
                          />
                        </td>
                        {(['vcpu', 'ram', 'disk'] as const).map((champ) => (
                          <td key={champ} className="px-2 py-2">
                            <Input
                              type="number"
                              min={1}
                              value={l[champ]}
                              onChange={(e) =>
                                setLignes((p) =>
                                  p.map((x) =>
                                    x.id === l.id
                                      ? { ...x, [champ]: Math.max(1, Number(e.target.value) || 1) }
                                      : x,
                                  ),
                                )
                              }
                              className="w-20"
                              aria-label={champ}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <Select
                            value={l.image}
                            onChange={(e) =>
                              setLignes((p) =>
                                p.map((x) => (x.id === l.id ? { ...x, image: e.target.value } : x)),
                              )
                            }
                            className="w-48"
                            aria-label="Image"
                          >
                            {[...IMAGES_SYNELIA, ...IMAGES_PRIVEES].map((im) => (
                              <option key={im.id} value={im.id}>
                                {im.nom}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <span className="flex items-center gap-1">
                            <IconButton
                              label="Dupliquer la ligne"
                              size="sm"
                              onClick={() =>
                                setLignes((p) => [
                                  ...p,
                                  { ...l, id: `l${Date.now()}`, nom: `${l.nom}-copie` },
                                ])
                              }
                            >
                              <Copy size={13} />
                            </IconButton>
                            <IconButton
                              label="Supprimer la ligne"
                              size="sm"
                              disabled={lignes.length <= 1}
                              onClick={() => setLignes((p) => p.filter((x) => x.id !== l.id))}
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
            </Card>
          )}
        </div>
      )}

      {/* Étape 4 — Réseau */}
      {etape === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader titre="Rattachement réseau" />
            <div className="space-y-4">
              <Field label="Réseau privé">
                {reseauxEspace.length > 0 ? (
                  <Select value={reseau} onChange={(e) => setReseau(e.target.value)}>
                    {reseauxEspace.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nom} · {n.cidr}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-[12.5px] text-g-500">
                    Aucun réseau privé dans {espace.code} — la machine partira sur le réseau par
                    défaut de l’espace. Découpez-en un depuis{' '}
                    <Link href="/app/reseau" className="underline">
                      Réseau &amp; IP
                    </Link>{' '}
                    pour segmenter le trafic.
                  </p>
                )}
              </Field>
              <Switch
                checked={ipPublique}
                onChange={setIpPublique}
                disabled={estActif()}
                label="Attribuer une IP publique à chaque machine"
                description={
                  estActif()
                    ? `Pas pris en charge par la création groupée aujourd’hui — réservez puis attachez une IP par machine depuis Réseau & IP après la création. ${ipsDisponibles} IP déjà réservées dans ${espace.code} attendent d’être attachées.`
                    : `${money(3500)} par IP et par mois. ${ipsDisponibles} IP déjà réservées sont disponibles et seront utilisées en priorité.`
                }
              />
              <Field label="Groupe de sécurité">
                {groupesEspace.length > 0 ? (
                  <Select value={sg} onChange={(e) => setSg(e.target.value)}>
                    {groupesEspace.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom} · {s.rules.length} règles
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-[12.5px] text-g-500">
                    Aucun groupe de sécurité dans {espace.code} — créez-en un depuis{' '}
                    <Link href="/app/reseau" className="underline">
                      Réseau &amp; IP
                    </Link>{' '}
                    avant de créer la machine.
                  </p>
                )}
              </Field>
              <Field label="Rattacher à un load balancer" hint="facultatif">
                <Select
                  value={lb}
                  onChange={(e) => setLb(e.target.value)}
                  disabled={estActif() && lbEspace.length > 0}
                >
                  <option value="">Aucun</option>
                  {lbEspace.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nom} · {l.layer.toUpperCase()} · {l.vip}
                    </option>
                  ))}
                </Select>
                {estActif() && lbEspace.length > 0 && (
                  <p className="mt-1 text-[11.5px] text-g-500">
                    Pas pris en charge par la création groupée aujourd’hui — ajoutez la machine au
                    pool depuis Réseau &amp; IP → Load balancers après la création.
                  </p>
                )}
              </Field>
            </div>
          </Card>
          {groupesEspace.length > 0 && (
            <Callout ton="info" titre="Politique par défaut du groupe de sécurité">
              {groupesEspace.find((s) => s.id === sg)?.defaultPolicy.ingress === 'deny'
                ? 'Refus par défaut en entrée, sortie autorisée. Seules les règles explicites du groupe ouvrent des ports.'
                : 'Autorisation par défaut en entrée — configuration à vérifier avant mise en production.'}
            </Callout>
          )}
        </div>
      )}

      {/* Étape 5 — Options */}
      {etape === 5 && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Initialisation (cloud-init / user-data)"
              sousTitre="Exécuté au premier démarrage. La syntaxe est validée avant création."
            />
            <MonoTextarea
              value={cloudInit}
              onChange={(e) => setCloudInit(e.target.value)}
              rows={14}
              aria-label="cloud-init"
            />
            <p className="mt-2 text-[12px] text-g-500">
              Les clés SSH du trousseau de l’organisation sont injectées automatiquement en plus de
              celles déclarées ici. Ne placez jamais de secret en clair dans ce champ : utilisez le
              coffre de secrets et référencez-le.
            </p>
          </Card>

          <Card>
            <CardHeader titre="Exploitation" />
            <div className="space-y-3.5">
              <Field label="Plan de sauvegarde">
                <Select value={planSauvegarde} onChange={(e) => setPlanSauvegarde(e.target.value)}>
                  {BACKUP_PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} · rétention {p.retentionJours} j{p.immutable ? ' · immuable' : ''}
                    </option>
                  ))}
                  <option value="aucun">Aucun plan (déconseillé)</option>
                </Select>
              </Field>
              <Switch
                checked={antiAffinite}
                onChange={setAntiAffinite}
                label="Groupe d’anti-affinité"
                description="Garantit que les machines de ce lot sont placées sur des hôtes physiques distincts. Indispensable pour un pool de front redondant."
              />
              <Switch
                checked={planification}
                onChange={setPlanification}
                label="Planification marche/arrêt"
                description="Calendrier hebdomadaire d’extinction et de démarrage. Économie appréciable sur les environnements de test et de recette."
              />
              {planification && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Démarrage" hint="jours ouvrés">
                    <Input type="time" defaultValue="07:00" />
                  </Field>
                  <Field label="Extinction" hint="jours ouvrés">
                    <Input type="time" defaultValue="20:00" />
                  </Field>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Étape 6 — Récapitulatif */}
      {etape === 6 && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre={`${machinesACreer.length} machine${machinesACreer.length > 1 ? 's' : ''} à créer`}
              sousTitre={`Dans ${espace.code} · ${espace.site}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Nom', 'Image', 'vCPU', 'Mémoire', 'Disque'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {machinesACreer.map((m) => (
                    <tr key={m.nom} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-[13px] text-ink">{m.nom}</td>
                      <td className="px-3 py-2 text-[13px] text-g-700">
                        {[...IMAGES_SYNELIA, ...IMAGES_PRIVEES].find((i) => i.id === m.image)?.nom}
                      </td>
                      <td className="tnum px-3 py-2 text-[13px] text-g-700">{m.vcpu}</td>
                      <td className="tnum px-3 py-2 text-[13px] text-g-700">{m.ram} Go</td>
                      <td className="tnum px-3 py-2 text-[13px] text-g-700">{num(m.disk)} Go</td>
                    </tr>
                  ))}
                  <tr className="border-t border-g-300 bg-g-050">
                    <td colSpan={2} className="px-3 py-2 text-[13px] font-semibold text-g-700">
                      Total
                    </td>
                    <td className="tnum px-3 py-2 text-[13px] font-bold text-ink">{totalVcpu}</td>
                    <td className="tnum px-3 py-2 text-[13px] font-bold text-ink">{totalRam} Go</td>
                    <td className="tnum px-3 py-2 text-[13px] font-bold text-ink">
                      {num(totalDisk)} Go
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader titre="Configuration commune" />
            <KeyValueList
              colonnes={2}
              items={[
                {
                  cle: 'Réseau privé',
                  valeur: reseauxEspace.find((n) => n.id === reseau)?.nom ?? 'Réseau par défaut de l’espace',
                },
                { cle: 'IP publique', valeur: ipPublique ? 'Oui, une par machine' : 'Non' },
                {
                  cle: 'Groupe de sécurité',
                  valeur: groupesEspace.find((s) => s.id === sg)?.nom ?? '—',
                },
                {
                  cle: 'Load balancer',
                  valeur: lb ? lbEspace.find((l) => l.id === lb)?.nom ?? '—' : 'Aucun',
                },
                {
                  cle: 'Plan de sauvegarde',
                  valeur: BACKUP_PLANS.find((p) => p.id === planSauvegarde)?.nom ?? 'Aucun',
                },
                { cle: 'Anti-affinité', valeur: antiAffinite ? 'Activée' : 'Désactivée' },
                {
                  cle: 'Planification marche/arrêt',
                  valeur: planification ? '07:00 → 20:00, jours ouvrés' : 'Aucune',
                },
                { cle: 'cloud-init', valeur: `${cloudInit.split('\n').length} lignes` },
              ]}
            />
          </Card>

          {!quotaSuffisant && (
            <Callout ton="err" titre="Quota insuffisant">
              La création demande {totalVcpu} vCPU et {totalRam} Go, mais {espace.code} ne dispose que
              de {espace.quota.vcpu - espace.usage.vcpu} vCPU et{' '}
              {num(espace.quota.ramGo - espace.usage.ramGo)} Go libres. Réduisez le lot, ou étendez la
              capacité de l’espace — l’extension est applicable à chaud.
            </Callout>
          )}

          <CostPreview lignes={lignesCout} />

          <Card>
            <Checkbox
              checked={conditions}
              onChange={(e) => setConditions(e.target.checked)}
              label="Je confirme la création de ces machines"
              description="Montants hors taxes, TVA 18 % appliquée à la facturation. Prorata du mois en cours ajouté à la prochaine facture. Les machines sont facturées tant qu’elles existent, y compris arrêtées — seul le calcul cesse, le stockage reste alloué."
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
      <dt className="shrink-0 text-[12px] text-g-500">{cle}</dt>
      <dd
        className={cn('truncate text-right text-[12px] font-semibold text-ink', mono && 'font-mono')}
      >
        {valeur}
      </dd>
    </div>
  )
}
