'use client'


import { useEffect, useMemo, useState } from 'react'
import {
  Clock,
  Download,
  FileCode,
  History,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateHeure, duree, num } from '@/lib/format'
import { MODELES_DNS, ZONES_DNS } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, MonoTextarea, Select, Switch } from '@/components/ui/field'
import { ConfirmDialog, Drawer, Modal, Tooltip } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, requete } from '@/lib/api/client'
import type { DnsZone } from '@/lib/types'

type Enregistrement = DnsZone['enregistrements'][number]

/** Modèle tel que l’écran le montre — `GET /web/dns/modeles` est ramené à cette forme. */
interface ModeleDns {
  id: string
  nom: string
  description: string
  enregistrements: string[]
}

interface ModeleDnsDistant {
  id: string
  nom: string
  description?: string
  enregistrements: Array<{ type: string; nom: string; valeur: string; ttl?: number; priorite?: number }>
}

/** Corps d’un enregistrement pour `PUT /web/dns/{zone}/enregistrements` (sans identifiant). */
const versContrat = (r: Enregistrement) => ({
  type: r.type,
  nom: r.nom,
  valeur: r.valeur,
  ttl: r.ttl,
  ...(r.priorite === undefined ? {} : { priorite: r.priorite }),
})

/** Valeurs créées par un modèle rapide, une fois les jokers résolus. */
const ENREGISTREMENTS_MODELE: Record<string, Enregistrement[]> = {
  'mod-espace': [
    { id: '', type: 'A', nom: '@', valeur: '102.176.20.13', ttl: 3600 },
    { id: '', type: 'A', nom: 'www', valeur: '102.176.20.13', ttl: 3600 },
  ],
  'mod-mail': [
    { id: '', type: 'MX', nom: '@', valeur: 'mx1.synelia.cloud.', ttl: 3600, priorite: 10 },
    { id: '', type: 'MX', nom: '@', valeur: 'mx2.synelia.cloud.', ttl: 3600, priorite: 20 },
    { id: '', type: 'TXT', nom: '@', valeur: 'v=spf1 include:spf.synelia.cloud -all', ttl: 3600 },
    { id: '', type: 'TXT', nom: '_dmarc', valeur: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@%DOMAINE%', ttl: 3600 },
  ],
}

const ONGLETS = [
  { id: 'enregistrements', label: 'Enregistrements' },
  { id: 'modeles', label: 'Modèles rapides' },
  { id: 'dnssec', label: 'DNSSEC' },
  { id: 'serveurs', label: 'Serveurs de noms' },
  { id: 'brut', label: 'Fichier de zone' },
]

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS'] as const

const EXPLICATIONS: Record<string, string> = {
  A: 'Pointe un nom vers une adresse IPv4. C’est l’enregistrement le plus courant.',
  AAAA: 'Même rôle que A, mais pour une adresse IPv6.',
  CNAME: 'Alias vers un autre nom. Interdit sur l’apex du domaine (@) par la norme.',
  MX: 'Désigne les serveurs qui reçoivent le courrier. La priorité la plus basse est essayée d’abord.',
  TXT: 'Texte libre. Utilisé pour SPF, DKIM, DMARC et les vérifications de propriété.',
  SRV: 'Localise un service en indiquant son hôte et son port. Utilisé par la téléphonie et la messagerie instantanée.',
  CAA: 'Restreint les autorités autorisées à émettre un certificat pour ce domaine.',
  NS: 'Délègue un sous-domaine à d’autres serveurs de noms.',
}

export function EditeurZone({ zoneId }: { zoneId: string }) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const zones = useCollection<DnsZone>('zones-dns', ZONES_DNS)
  const [onglet, setOnglet] = useState('enregistrements')
  const [filtre, setFiltre] = useState<string>('tous')
  const [q, setQ] = useState('')
  const [edition, setEdition] = useState<string | null>(null)
  const [ajout, setAjout] = useState(false)
  const [modele, setModele] = useState<string | null>(null)
  const [suppression, setSuppression] = useState<Enregistrement | null>(null)
  /** Modèles du backend (mode API) ; ceux de la maquette sinon. */
  const [modelesDistants, setModelesDistants] = useState<ModeleDns[] | null>(null)
  useEffect(() => {
    if (!estActif()) return
    requete<ModeleDnsDistant[]>('/web/dns/modeles').then(
      (liste) =>
        setModelesDistants(
          liste.map((m) => ({
            id: m.id,
            nom: m.nom,
            description: m.description ?? '',
            enregistrements: m.enregistrements.map(
              (e) => `${e.type} ${e.nom} → ${e.valeur}${e.priorite !== undefined ? ` (${e.priorite})` : ''}`,
            ),
          })),
        ),
      () => setModelesDistants([]),
    )
  }, [])
  const modeles: ModeleDns[] = estActif() ? (modelesDistants ?? []) : MODELES_DNS

  const zone = zones.items.find((z) => z.id === zoneId) as DnsZone
  const domaines = zones.items.map((z) => z.domaine)

  /** Brouillon du tiroir d'enregistrement — l'ouvrir renseigne les valeurs. */
  const [f, setF] = useState<{
    type: Enregistrement['type']
    nom: string
    valeur: string
    ttl: number
    priorite: string
  }>({ type: 'A', nom: '', valeur: '', ttl: 3600, priorite: '' })

  const ouvrirAjout = () => {
    setF({ type: 'A', nom: '', valeur: '', ttl: 3600, priorite: '' })
    setAjout(true)
  }

  const ouvrirEdition = (r: Enregistrement) => {
    setF({
      type: r.type,
      nom: r.nom,
      valeur: r.valeur,
      ttl: r.ttl,
      priorite: r.priorite === undefined ? '' : String(r.priorite),
    })
    setEdition(r.id)
  }

  const enregistrerLigne = () => {
    const patch: Enregistrement = {
      id: edition ?? zones.identifiant('rr'),
      type: f.type,
      nom: f.nom || '@',
      valeur: f.valeur,
      ttl: f.ttl,
      priorite: f.priorite === '' ? undefined : Number(f.priorite),
    }
    executer({
      action: 'network.manage',
      titre: edition ? 'Enregistrement modifié' : 'Enregistrement créé',
      detail:
        'Publié sur les trois serveurs de noms. Visible partout après expiration du TTL.',
      appel: () =>
        edition
          ? requete(
              `/web/dns/${encodeURIComponent(zone.id)}/enregistrements/${encodeURIComponent(edition)}`,
              {
                methode: 'PATCH',
                corps: {
                  type: f.type,
                  nom: f.nom || '@',
                  valeur: f.valeur,
                  ttl: f.ttl,
                  ...(f.priorite === '' ? {} : { priorite: Number(f.priorite) }),
                },
              },
            )
          : creerRessource(`/web/dns/${encodeURIComponent(zone.id)}/enregistrements`, {
              type: f.type,
              nom: f.nom || '@',
              valeur: f.valeur,
              ttl: f.ttl,
              ...(f.priorite === '' ? {} : { priorite: Number(f.priorite) }),
            }),
      effet: () =>
        zones.modifier(zone.id, (z) => ({
          enregistrements: edition
            ? z.enregistrements.map((x) => (x.id === edition ? patch : x))
            : [...z.enregistrements, patch],
        })),
      effetFinal: () => zones.recharger(),
    })
    setAjout(false)
    setEdition(null)
  }

  const lignes = useMemo(() => {
    let out = zone.enregistrements
    if (filtre !== 'tous') out = out.filter((r) => r.type === filtre)
    if (q.trim()) {
      const n = q.trim().toLowerCase()
      out = out.filter(
        (r) => r.nom.toLowerCase().includes(n) || r.valeur.toLowerCase().includes(n),
      )
    }
    return out
  }, [zone.enregistrements, filtre, q])

  const enEdition = zone.enregistrements.find((r) => r.id === edition)

  const fichierZone = [
    `$ORIGIN ${zone.domaine}.`,
    `$TTL 3600`,
    '',
    ...zone.ns.map((n) => `@\t3600\tIN\tNS\t${n}.`),
    '',
    ...zone.enregistrements.map(
      (r) =>
        `${r.nom === '@' ? '@' : r.nom}\t${r.ttl}\tIN\t${r.type}\t${r.priorite !== undefined ? `${r.priorite} ` : ''}${r.type === 'TXT' ? `"${r.valeur}"` : r.valeur}`,
    ),
  ].join('\n')

  return (
    <div className="space-y-5">

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Enregistrements"
          valeur={zone.enregistrements.length}
          detail={`${new Set(zone.enregistrements.map((r) => r.type)).size} types différents`}
        />
        <StatTile
          libelle="TTL le plus court"
          valeur={duree(Math.min(...zone.enregistrements.map((r) => r.ttl)))}
          detail="Délai de propagation d’un changement"
        />
        <StatTile
          libelle="Requêtes 24 h"
          valeur={num(184_920)}
          detail="Sur les trois serveurs de noms"
        />
        <StatTile
          libelle="DNSSEC"
          valeur={zone.dnssec ? 'Actif' : 'Inactif'}
          ton={zone.dnssec ? 'ok' : 'warn'}
          detail={zone.dnssec ? 'Chaîne de confiance validée' : 'Zone falsifiable en chemin'}
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'enregistrements' && (
        <Card padding={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-g-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrer par nom ou valeur…"
                className="w-56"
              />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setFiltre('tous')}
                  className={cn(
                    'rounded-[5px] px-2 py-1 text-[11.5px] font-semibold transition-colors',
                    filtre === 'tous' ? 'bg-p-700 text-white' : 'bg-g-050 text-g-700 hover:bg-g-100',
                  )}
                >
                  Tous
                </button>
                {[...new Set(zone.enregistrements.map((r) => r.type))].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFiltre(t)}
                    className={cn(
                      'rounded-[5px] px-2 py-1 font-mono text-[11.5px] font-semibold transition-colors',
                      filtre === t ? 'bg-p-700 text-white' : 'bg-g-050 text-g-700 hover:bg-g-100',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/*
              Les quatre issues de secours d'un opérateur de zone : régler le TTL
              par défaut plutôt que ligne par ligne, coller un fichier de zone
              entier, relire ce qui a changé, et revenir en arrière. Sans elles,
              corriger dix-neuf enregistrements se fait à la souris.
            */}
            <div className="flex flex-wrap items-center gap-1.5">
              <BoutonFormulaire
                libelle="TTL par défaut"
                variant="ghost"
                icone={<Clock size={12} />}
                action="network.manage"
                titre="Régler le TTL de toute la zone"
                description="Vingt-quatre heures avant une bascule d’adresse, descendez à 300 secondes ; remontez ensuite, un TTL court multiplie les requêtes."
                champs={[
                  {
                    id: 'ttl',
                    label: 'TTL appliqué à tous les enregistrements',
                    type: 'select',
                    options: [
                      { value: '60', label: '60 s — bascule imminente' },
                      { value: '300', label: '300 s — 5 minutes' },
                      { value: '3600', label: '3 600 s — 1 heure (recommandé)' },
                      { value: '86400', label: '86 400 s — 1 jour' },
                    ],
                  },
                ]}
                valeursDepart={{ ttl: '3600' }}
                libelleValider="Appliquer à toute la zone"
                operation={(v) => ({
                  titre: `TTL de la zone porté à ${v.ttl} s`,
                  detail: `${zone.enregistrements.length} enregistrements modifiés.`,
                  // `PUT …/enregistrements` remplace la zone entière : on la
                  // renvoie telle quelle, TTL changé.
                  appel: () =>
                    requete(`/web/dns/${encodeURIComponent(zone.id)}/enregistrements`, {
                      methode: 'PUT',
                      corps: {
                        enregistrements: zone.enregistrements.map((r) =>
                          versContrat({ ...r, ttl: Number(v.ttl) }),
                        ),
                      },
                    }),
                  effet: () =>
                    zones.modifier(zone.id, (z) => ({
                      enregistrements: z.enregistrements.map((r) => ({ ...r, ttl: Number(v.ttl) })),
                    })),
                  effetFinal: () => zones.recharger(),
                })}
              />
              <BoutonAction
                libelle="Mode textuel"
                variant="ghost"
                icone={<FileCode size={12} />}
                operation={{
                  ton: 'info',
                  titre: 'Fichier de zone ouvert',
                  detail: 'Le fichier complet est éditable dans l’onglet Fichier de zone.',
                  effet: () => setOnglet('brut'),
                }}
              />
              <BoutonAction
                libelle="Historique"
                variant="ghost"
                icone={<History size={12} />}
                operation={{
                  ton: 'info',
                  titre: 'Historique de la zone',
                  detail: `${zone.enregistrements.length} enregistrements au dernier point de reprise. Les sept derniers jours sont conservés.`,
                }}
              />
              <BoutonAction
                libelle="Exporter"
                variant="ghost"
                icone={<Download size={12} />}
                operation={{
                  ton: 'info',
                  titre: `Zone ${zone.domaine} exportée`,
                  detail: 'Format BIND, réimportable tel quel chez n’importe quel opérateur.',
                }}
              />
              <BoutonFormulaire
                libelle="Importer"
                variant="ghost"
                icone={<Upload size={12} />}
                action="network.manage"
                titre="Importer un fichier de zone"
                description="Collez un fichier BIND. Les enregistrements existants de même type et même nom sont remplacés ; les autres sont conservés."
                taille="lg"
                champs={[
                  {
                    id: 'contenu',
                    label: 'Fichier de zone',
                    type: 'mono',
                    placeholder: 'www 3600 IN A 203.0.113.10',
                  },
                ]}
                libelleValider="Analyser et importer"
                operation={(v) => {
                  const lignesImport = String(v.contenu)
                    .split('\n')
                    .map((l) => l.trim())
                    .filter((l) => l && !l.startsWith(';') && !l.startsWith('$'))
                  const importes = lignesImport.flatMap((ligne) => {
                    const parts = ligne.split(/\s+/)
                    const iType = parts.findIndex((x) => (TYPES as readonly string[]).includes(x))
                    if (iType < 0) return []
                    return [
                      {
                        id: zones.identifiant('rr'),
                        type: parts[iType] as Enregistrement['type'],
                        nom: parts[0] || '@',
                        valeur: parts.slice(iType + 1).join(' '),
                        ttl: Number(parts[1]) || 3600,
                      } as Enregistrement,
                    ]
                  })
                  // Même nom et même type : l’import remplace ; le reste est conservé.
                  const fusion = [
                    ...zone.enregistrements.filter(
                      (r) => !importes.some((i) => i.type === r.type && i.nom === r.nom),
                    ),
                    ...importes,
                  ]
                  return {
                    titre: `${lignesImport.length} ligne(s) importée(s)`,
                    detail: 'Les enregistrements non reconnus sont ignorés plutôt que devinés.',
                    appel: () =>
                      requete(`/web/dns/${encodeURIComponent(zone.id)}/enregistrements`, {
                        methode: 'PUT',
                        corps: { enregistrements: fusion.map(versContrat) },
                      }),
                    effet: () =>
                      zones.modifier(zone.id, () => ({ enregistrements: fusion })),
                    effetFinal: () => zones.recharger(),
                  }
                }}
              />
              {/* Aucun endpoint backend n'a de notion de « point de reprise » sur une zone
                  Designate réelle — `zones.modifier` sans `appel` déclenchait un `PATCH
                  /web/dns/{id}` inexistant (405, avalé par `.then(recharger, recharger)`)
                  tout en affichant un succès : un faux succès en mode API. Réservé à la
                  maquette, où ce point de reprise existe vraiment (la graine importée). */}
              {!estActif() && (
                <BoutonAction
                  libelle="Réinitialiser"
                  variant="ghost"
                  icone={<RotateCcw size={12} />}
                  operation={{
                    action: 'network.manage',
                    ton: 'warn',
                    titre: `Zone ${zone.domaine} réinitialisée`,
                    detail: 'La zone revient au dernier point de reprise publié.',
                    effet: () =>
                      zones.modifier(zone.id, () => ({
                        enregistrements:
                          ZONES_DNS.find((z) => z.id === zone.id)?.enregistrements ?? [],
                      })),
                  }}
                  confirmation={{
                    ressource: zone.domaine,
                    titre: 'Réinitialiser la zone ?',
                    pertes: [
                      'Toutes les modifications non publiées seront perdues',
                      'La zone revient à son dernier point de reprise',
                    ],
                    libelleAction: 'Réinitialiser la zone',
                  }}
                />
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Type', 'Nom', 'Valeur', 'TTL', 'Priorité', ''].map((h) => (
                    <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((r) => (
                  <tr key={`${r.type}-${r.nom}-${r.valeur}`} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2">
                      <Tooltip content={EXPLICATIONS[r.type] ?? r.type}>
                        <Badge tone="violet" size="sm">
                          {r.type}
                        </Badge>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px] font-semibold text-ink">
                      {r.nom}
                    </td>
                    <td className="max-w-[42ch] truncate px-3 py-2 font-mono text-[11.5px] text-g-700">
                      {r.valeur}
                    </td>
                    <td className="tnum px-3 py-2 text-[11.5px] text-g-500">{r.ttl}</td>
                    <td className="tnum px-3 py-2 text-[11.5px] text-g-500">
                      {r.priorite ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <GatedAction
                          autorise={autorise('network.manage')}
                          message={refus('network.manage')}
                        >
                          <IconButton
                            label="Modifier"
                            size="sm"
                            variant="ghost"
                            onClick={() => ouvrirEdition(r)}
                          >
                            <Pencil size={12} />
                          </IconButton>
                        </GatedAction>
                        <GatedAction
                          autorise={autorise('network.manage')}
                          message={refus('network.manage')}
                        >
                          <IconButton
                            label="Supprimer"
                            size="sm"
                            variant="ghost"
                            onClick={() => setSuppression(r)}
                          >
                            <Trash2 size={12} />
                          </IconButton>
                        </GatedAction>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lignes.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-[12.5px] text-g-500">
                Aucun enregistrement ne correspond à ce filtre.
              </p>
            </div>
          )}

          <div className="border-t border-g-100 px-4 py-3">
            <p className="text-[11.5px] leading-relaxed text-g-500">
              Un changement est publié sur les trois serveurs de noms en moins de dix secondes. Le
              temps qu’il devienne visible partout dépend du TTL de l’enregistrement modifié — un TTL
              de 3 600 secondes signifie qu’un résolveur peut encore servir l’ancienne valeur pendant
              une heure.
            </p>
          </div>
        </Card>
      )}

      {onglet === 'modeles' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {modeles.map((m) => (
            <Card key={m.id} hover className="flex flex-col">
              <CardHeader
                titre={m.nom}
                sousTitre={m.description}
                actions={<Wand2 size={15} className="text-m-600" />}
              />
              <MicroLabel className="mb-1.5">Enregistrements créés</MicroLabel>
              <ul className="space-y-1">
                {m.enregistrements.map((e) => (
                  <li
                    key={e}
                    className="rounded-[5px] bg-g-050 px-2.5 py-1.5 font-mono text-[11px] text-ink"
                  >
                    {e}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-3.5">
                <GatedAction
                  autorise={autorise('network.manage')}
                  message={refus('network.manage')}
                >
                  <Button size="sm" variant="secondary" onClick={() => setModele(m.id)}>
                    Appliquer ce modèle
                  </Button>
                </GatedAction>
              </div>
            </Card>
          ))}
        </div>
      )}

      {onglet === 'dnssec' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Signature de la zone"
              sousTitre="DNSSEC signe cryptographiquement vos réponses DNS : un résolveur peut vérifier qu’elles n’ont pas été falsifiées en chemin."
            />
            <Switch
              checked={zone.dnssec}
              onChange={(v) =>
                executer({
                  action: 'network.manage',
                  ton: v ? 'ok' : 'warn',
                  titre: v ? 'DNSSEC activé' : 'DNSSEC désactivé',
                  detail: v
                    ? 'La publication de l’enregistrement DS au registre prend quelques heures.'
                    : 'Le retrait du DS au registre doit précéder la dépublication des signatures, sinon la zone devient invalidable.',
                  appel: () =>
                    requete(`/web/dns/${encodeURIComponent(zone.id)}/dnssec`, {
                      methode: 'PUT',
                      corps: { actif: v },
                    }),
                  job: {
                    type: 'dns.dnssec',
                    label: `${v ? 'Activation' : 'Désactivation'} DNSSEC · ${zone.domaine}`,
                    etapes: v
                      ? ['Générer les clés', 'Signer la zone', 'Publier le DS au registre']
                      : ['Retirer le DS au registre', 'Attendre l’expiration des caches', 'Dépublier les signatures'],
                    dureeEtapeMs: 1100,
                  },
                  effetFinal: () => {
                    // PUT /web/dns/{id}/dnssec a déjà persisté : en maquette on
                    // rejoue la bascule en local, avec l’API on relit la zone.
                    if (!estActif()) zones.modifier(zone.id, { dnssec: v })
                    zones.recharger()
                  },
                })
              }
              label="DNSSEC"
              description="Nous gérons les clés, leur rotation et la publication de l’enregistrement DS auprès du registre. Aucune manipulation de clé de votre côté."
            />
            {zone.dnssec ? (
              <>
                <div className="mt-4 space-y-3 border-t border-g-100 pt-4">
                  <CopyField
                    label="Enregistrement DS publié au registre"
                    value="34291 13 2 8f2a91c4d7b0e5443a17c96e2f0d8b4144ba1e9f029e3c8d1a751b74e0aa93c0"
                  />
                  <KeyValueList
                    colonnes={1}
                    items={[
                      { cle: 'Algorithme', valeur: 'ECDSA P-256 avec SHA-256 (13)' },
                      { cle: 'Clé de signature de clé', valeur: 'Rotation annuelle, prochaine le 4 mars 2027' },
                      { cle: 'Clé de signature de zone', valeur: 'Rotation trimestrielle, automatique' },
                      { cle: 'Chaîne de confiance', valeur: 'Validée depuis la racine' },
                      { cle: 'Dernière vérification', valeur: dateHeure('2026-08-19T15:04:00Z') },
                    ]}
                  />
                </div>
                <Callout ton="ok" className="mt-4" titre="Chaîne de confiance complète">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    Le registre publie bien votre enregistrement DS, et la signature est valide depuis
                    la racine. Un attaquant ne peut pas faire répondre une fausse adresse pour ce
                    domaine à un résolveur validant.
                  </span>
                </Callout>
              </>
            ) : (
              <Callout ton="warn" className="mt-4" titre="Sans DNSSEC, la réponse DNS est falsifiable">
                Un attaquant en position d’intercepter le trafic — un réseau Wi-Fi public, un
                résolveur compromis — peut faire répondre une autre adresse pour votre domaine.
                L’activation prend quelques minutes et n’exige rien de votre part : nous gérons les
                clés et leur publication au registre.
              </Callout>
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Vérifications d’intégrité"
              sousTitre="Ce que nous contrôlons en continu sur cette zone."
            />
            <div className="space-y-2">
              {[
                { t: 'Cohérence des serveurs de noms', ok: true, d: 'Les trois serveurs servent la même série de zone.' },
                { t: 'Enregistrement SPF unique', ok: zone.enregistrements.filter((r) => r.type === 'TXT' && r.valeur.startsWith('v=spf1')).length <= 1, d: 'Deux SPF sur un même domaine invalident les deux — c’est une cause fréquente de courriels rejetés.' },
                { t: 'Aucun CNAME sur l’apex', ok: !zone.enregistrements.some((r) => r.type === 'CNAME' && r.nom === '@'), d: 'La norme interdit un CNAME sur @. Certains résolveurs le tolèrent, d’autres refusent toute la zone.' },
                { t: 'DMARC publié', ok: zone.enregistrements.some((r) => r.nom === '_dmarc'), d: 'Sans DMARC, n’importe qui peut envoyer des courriels en usurpant votre domaine.' },
                { t: 'CAA présent', ok: zone.enregistrements.some((r) => r.type === 'CAA'), d: 'Limite l’émission de certificats aux autorités que vous désignez.' },
                { t: 'MX joignables', ok: true, d: 'Les serveurs de courrier déclarés répondent sur le port 25.' },
              ].map((v) => (
                <div
                  key={v.t}
                  className={cn(
                    'rounded-[6px] border px-3 py-2.5',
                    v.ok ? 'border-g-300' : 'border-warn/40 bg-warn-bg',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-semibold text-ink">{v.t}</span>
                    <Badge tone={v.ok ? 'ok' : 'warn'} size="sm">
                      {v.ok ? 'Conforme' : 'À corriger'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-500">{v.d}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {onglet === 'serveurs' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Serveurs de noms de cette zone"
              sousTitre="À renseigner chez votre bureau d’enregistrement si le domaine n’est pas géré chez nous."
            />
            <div className="space-y-2">
              {zone.ns.map((n, i) => (
                <div
                  key={n}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[12.5px] font-semibold text-ink">{n}</span>
                    <span className="block text-[11px] text-g-500">
                      {i === 0
                        ? 'Abidjan · ABJ-1 · primaire'
                        : i === 1
                          ? 'Grand-Bassam · GBM-1 · secondaire'
                          : 'Anycast régional · secondaire'}
                    </span>
                  </span>
                  <Badge tone="ok" dot size="sm">
                    Répond
                  </Badge>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="Pourquoi trois serveurs sur deux sites">
              Un seul serveur de noms, c’est un point de défaillance unique : s’il tombe, votre
              domaine devient injoignable même si vos serveurs web fonctionnent. Deux sites physiques
              distincts protègent d’une panne électrique ou réseau localisée.
            </Callout>
          </Card>

          <Card>
            <CardHeader
              titre="Délégation d’un sous-domaine"
              sousTitre="Confier un sous-domaine à d’autres serveurs de noms — par exemple pour un service tiers ou une filiale."
            />
            {/* Pas de champs affichés ici : le formulaire (mêmes deux champs) est dans la
                modale ouverte par le bouton — deux jeux de champs pour une seule action
                aurait laissé le premier saisi puis ignoré au clic. */}
            <GatedAction autorise={autorise('network.manage')} message={refus('network.manage')}>
              <BoutonFormulaire
                libelle="Créer la délégation"
                size="md"
                className="mt-3.5"
                action="network.manage"
                titre="Déléguer un sous-domaine"
                description="Une fois délégué, le sous-domaine n’est plus géré ici mais chez l’opérateur des serveurs de noms indiqués."
                champs={[
                  { id: 'sous', label: 'Sous-domaine', placeholder: 'labo', obligatoire: true },
                  { id: 'ns1', label: 'Serveur de noms 1', placeholder: 'ns1.exemple.net', obligatoire: true },
                  { id: 'ns2', label: 'Serveur de noms 2', placeholder: 'ns2.exemple.net' },
                ]}
                libelleValider="Créer la délégation"
                operation={(v) => ({
                  ton: 'warn',
                  titre: `${v.sous}.${zone.domaine} délégué`,
                  detail: 'Ses enregistrements ne sont plus gérés depuis ce portail.',
                  appel: async () => {
                    for (const ns of [v.ns1, v.ns2].filter(Boolean)) {
                      await creerRessource(
                        `/web/dns/${encodeURIComponent(zone.id)}/enregistrements`,
                        {
                          type: 'NS',
                          nom: String(v.sous),
                          valeur: `${String(ns).replace(/\.$/, '')}.`,
                          ttl: 3600,
                        },
                      )
                    }
                  },
                  effet: () =>
                    zones.modifier(zone.id, (z) => ({
                      enregistrements: [
                        ...z.enregistrements,
                        ...[v.ns1, v.ns2]
                          .filter(Boolean)
                          .map((ns) => ({
                            id: zones.identifiant('rr'),
                            type: 'NS' as const,
                            nom: String(v.sous),
                            valeur: `${String(ns).replace(/\.$/, '')}.`,
                            ttl: 3600,
                          })),
                      ],
                    })),
                  effetFinal: () => zones.recharger(),
                })}
              />
            </GatedAction>
            <Callout ton="warn" className="mt-4" titre="Une délégation vous retire la main">
              Une fois le sous-domaine délégué, ses enregistrements ne sont plus gérés ici mais chez
              le tiers. Vous ne pourrez plus corriger une erreur de leur côté depuis ce portail.
            </Callout>
          </Card>
        </div>
      )}

      {onglet === 'brut' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Fichier de zone"
              sousTitre="Format BIND standard. Utile pour un audit, une sauvegarde, ou une migration vers un autre fournisseur."
              actions={
                <BoutonAction
                  libelle="Télécharger"
                  variant="ghost"
                  icone={<Download size={12} />}
                  operation={{
                    ton: 'info',
                    titre: `${zone.domaine}.zone téléchargé`,
                    detail: `${zone.enregistrements.length} enregistrements au format BIND.`,
                  }}
                />
              }
            />
            <CodeBlock langue="dns" code={fichierZone} />
          </Card>

          <Card>
            <CardHeader
              titre="Import de zone"
              sousTitre="Collez un fichier de zone BIND. Nous vous montrons les différences avant d’appliquer quoi que ce soit."
            />
            <MonoTextarea rows={8} placeholder="@	3600	IN	A	203.0.113.10" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <BoutonAction
                libelle="Analyser les différences"
                size="md"
                operation={{
                  ton: 'info',
                  titre: 'Comparatif prêt',
                  detail:
                    'Aucun enregistrement n’a été modifié : le comparatif liste ce qui serait ajouté, remplacé et laissé en place.',
                }}
              />
              <span className="text-[11.5px] text-g-500">
                Aucun enregistrement n’est modifié avant votre validation du comparatif.
              </span>
            </div>
          </Card>
        </div>
      )}

      <Drawer
        open={ajout || enEdition !== undefined}
        onClose={() => {
          setAjout(false)
          setEdition(null)
        }}
        title={enEdition ? `Modifier ${enEdition.type} ${enEdition.nom}` : 'Nouvel enregistrement'}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setAjout(false)
                setEdition(null)
              }}
            >
              Annuler
            </Button>
            <Button disabled={!f.valeur.trim()} onClick={enregistrerLigne}>
              {enEdition ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Type" hint={EXPLICATIONS[f.type]}>
            <Select
              value={f.type}
              onChange={(e) =>
                setF((p) => ({ ...p, type: e.target.value as Enregistrement['type'] }))
              }
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Nom"
            hint={`@ pour ${zone.domaine} lui-même, ou un sous-domaine comme www`}
          >
            <Input
              value={f.nom}
              onChange={(e) => setF((p) => ({ ...p, nom: e.target.value }))}
              placeholder="@"
              suffix={`.${zone.domaine}`}
            />
          </Field>
          <Field label="Valeur" hint="adresse IP, nom de domaine cible, ou contenu textuel">
            <Input
              value={f.valeur}
              onChange={(e) => setF((p) => ({ ...p, valeur: e.target.value }))}
              placeholder="203.0.113.10"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="TTL" hint="secondes — 300 pendant une migration, 3 600 en régime stable">
              <Select
                value={String(f.ttl)}
                onChange={(e) => setF((p) => ({ ...p, ttl: Number(e.target.value) }))}
              >
                <option value="60">60 s — bascule imminente</option>
                <option value="300">300 s — 5 minutes</option>
                <option value="3600">3 600 s — 1 heure (recommandé)</option>
                <option value="86400">86 400 s — 1 jour</option>
              </Select>
            </Field>
            <Field label="Priorité" hint="MX et SRV uniquement — la plus basse est essayée d’abord">
              <Input
                type="number"
                value={f.priorite}
                onChange={(e) => setF((p) => ({ ...p, priorite: e.target.value }))}
                placeholder="10"
                disabled={f.type !== 'MX' && f.type !== 'SRV'}
              />
            </Field>
          </div>
          <Callout ton="info" titre="Avant de valider">
            Un CNAME ne peut pas coexister avec un autre enregistrement sur le même nom, et il est
            interdit sur l’apex (@). Si vous voulez pointer{' '}
            <span className="font-mono text-[12px]">{zone.domaine}</span> vers un service externe,
            utilisez un A vers son adresse IP, ou un ALIAS si le service en fournit un.
          </Callout>
        </div>
      </Drawer>

      <Modal
        open={modele !== null}
        onClose={() => setModele(null)}
        title="Appliquer un modèle"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModele(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                const ajouts = (ENREGISTREMENTS_MODELE[modele ?? ''] ?? []).map((r) => ({
                  ...r,
                  id: zones.identifiant('rr'),
                  valeur: r.valeur.replace('%DOMAINE%', zone.domaine),
                }))
                executer({
                  action: 'network.manage',
                  titre: 'Modèle appliqué',
                  detail: estActif()
                    ? 'Les enregistrements du modèle sont publiés sur la zone.'
                    : ajouts.length
                      ? `${ajouts.length} enregistrements créés. Les existants n’ont pas été touchés.`
                      : 'Ce modèle demande des valeurs propres à votre infrastructure : les enregistrements ont été préparés, à compléter un par un.',
                  // `POST /web/dns/{zone}/modeles/{modele}` — les identifiants de
                  // modèle sont ceux de `GET /web/dns/modeles`.
                  appel: modele
                    ? () =>
                        requete(
                          `/web/dns/${encodeURIComponent(zone.id)}/modeles/${encodeURIComponent(modele)}`,
                          { methode: 'POST', corps: {} },
                        )
                    : undefined,
                  effet: () =>
                    ajouts.length
                      ? zones.modifier(zone.id, (z) => ({
                          enregistrements: [...z.enregistrements, ...ajouts],
                        }))
                      : undefined,
                  effetFinal: () => zones.recharger(),
                })
                setModele(null)
              }}
            >
              Appliquer
            </Button>
          </>
        }
      >
        {modele && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-g-700">
              {modeles.find((m) => m.id === modele)?.description}
            </p>
            <div>
              <MicroLabel className="mb-1.5">Ce qui sera créé</MicroLabel>
              <ul className="space-y-1">
                {modeles.find((m) => m.id === modele)?.enregistrements.map((e) => (
                  <li
                    key={e}
                    className="rounded-[5px] bg-g-050 px-2.5 py-1.5 font-mono text-[11px] text-ink"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            <Field label="Valeur à substituer" hint="remplace les paramètres entre chevrons ci-dessus">
              <Input placeholder="102.176.20.13" />
            </Field>
            <Callout ton="warn" titre="Les enregistrements existants ne sont pas écrasés">
              Si un enregistrement du même nom et du même type existe déjà, nous vous le signalons et
              vous choisissez : conserver, remplacer, ou ajouter en parallèle.
            </Callout>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={suppression !== null}
        onClose={() => setSuppression(null)}
        titre="Supprimer un enregistrement DNS"
        ressource={suppression ? `${suppression.type} ${suppression.nom}` : ''}
        libelleAction="Supprimer l’enregistrement"
        pertes={[
          'Les résolveurs cesseront de répondre pour ce nom à l’expiration du TTL',
          suppression?.type === 'MX'
            ? 'Les courriels à destination de ce domaine seront rejetés'
            : 'Le service pointé par cet enregistrement deviendra injoignable par ce nom',
          'La suppression est journalisée dans l’audit, avec votre nom',
        ]}
        onConfirm={() => {
          const cible = suppression
          if (cible) {
            executer({
              action: 'network.manage',
              ton: 'err',
              titre: 'Enregistrement supprimé',
              detail: 'Vous pouvez le recréer depuis l’historique de la zone dans les sept jours.',
              appel: () =>
                requete(
                  `/web/dns/${encodeURIComponent(zone.id)}/enregistrements/${encodeURIComponent(cible.id)}`,
                  { methode: 'DELETE' },
                ),
              effet: () =>
                zones.modifier(zone.id, (z) => ({
                  enregistrements: z.enregistrements.filter((x) => x.id !== cible.id),
                })),
              effetFinal: () => zones.recharger(),
            })
          }
          setSuppression(null)
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="violet" titre="Baisser le TTL avant une migration">
          Vingt-quatre heures avant de changer une adresse, passez le TTL de l’enregistrement
          concerné à 300 secondes. Le jour de la bascule, la propagation prendra cinq minutes plutôt
          qu’une heure. Remontez-le ensuite : un TTL court multiplie les requêtes et ralentit
          légèrement la résolution.
        </Callout>
        <Card>
          <CardHeader titre="Historique de la zone" sousTitre="Sept derniers jours." />
          <div className="space-y-1.5">
            {[
              { q: '2026-08-19T11:04:00Z', a: 'Léa Konan', t: 'A staging modifié — 102.176.34.7' },
              { q: '2026-08-17T09:22:00Z', a: 'Kouassi Touré', t: 'TXT _dmarc modifié — p=none → p=quarantine' },
              { q: '2026-08-14T16:41:00Z', a: 'Léa Konan', t: 'CNAME erp créé — erp-dba.synelia.cloud.' },
              { q: '2026-08-12T08:12:00Z', a: 'ci-bot', t: 'A analytics créé — 102.176.20.13' },
            ].map((h) => (
              <div
                key={h.q}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-g-100 pb-1.5 last:border-0"
              >
                <span className="min-w-0 text-[12px] text-ink">{h.t}</span>
                <span className="shrink-0 text-[10.5px] text-g-500">
                  {h.a} · {dateHeure(h.q)}
                </span>
              </div>
            ))}
          </div>
          <ButtonLink size="sm" variant="ghost" className="mt-3" href="/app/securite">
            Voir le journal d’audit complet
          </ButtonLink>
        </Card>
      </div>
    </div>
  )
}
