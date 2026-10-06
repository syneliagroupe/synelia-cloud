'use client'

import { useState } from 'react'
import {
  Boxes,
  Copy,
  Database,
  GripVertical,
  Layers,
  Network,
  Server,
  Shield,
  Terminal,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num } from '@/lib/format'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Slider, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { QuotaBar } from '@/components/composition/metrics'
import { prixMachine } from '@/lib/tarifs'

/**
 * Rôle de serveur : un gabarit de départ, pas une contrainte.
 *
 * Le rôle sert à deux choses — proposer un dimensionnement crédible, et savoir
 * quoi installer. Il reste modifiable une fois le lot posé : c'est un point de
 * départ raisonnable, non un moule.
 */
export interface RoleServeur {
  id: string
  nom: string
  categorie: 'Calcul' | 'Données' | 'Réseau' | 'Outillage'
  icone: 'server' | 'database' | 'network' | 'terminal' | 'shield' | 'boxes'
  phrase: string
  gabarit: { cpu: number; ramGo: number; diskGo: number; nics: number }
  logiciels: Array<{ nom: string; parDefaut: boolean }>
  antiAffiniteRecommandee: boolean
}

export const ROLES_SERVEUR: RoleServeur[] = [
  {
    id: 'web',
    nom: 'Serveur web',
    categorie: 'Calcul',
    icone: 'server',
    phrase: 'Sert des pages et des API derrière un répartiteur.',
    gabarit: { cpu: 4, ramGo: 8, diskGo: 80, nics: 1 },
    logiciels: [
      { nom: 'Nginx', parDefaut: true },
      { nom: 'PHP-FPM 8.3', parDefaut: true },
      { nom: 'Node 22', parDefaut: false },
      { nom: 'Agent de supervision', parDefaut: true },
    ],
    antiAffiniteRecommandee: true,
  },
  {
    id: 'app',
    nom: 'Serveur applicatif',
    categorie: 'Calcul',
    icone: 'boxes',
    phrase: 'Exécute vos traitements métier, sans exposition publique.',
    gabarit: { cpu: 8, ramGo: 16, diskGo: 120, nics: 2 },
    logiciels: [
      { nom: 'Docker Engine', parDefaut: true },
      { nom: 'Agent de supervision', parDefaut: true },
      { nom: 'Agent de sauvegarde', parDefaut: true },
    ],
    antiAffiniteRecommandee: true,
  },
  {
    id: 'base',
    nom: 'Base de données',
    categorie: 'Données',
    icone: 'database',
    phrase: 'PostgreSQL ou MariaDB installé et réglé pour la charge.',
    gabarit: { cpu: 8, ramGo: 32, diskGo: 500, nics: 1 },
    logiciels: [
      { nom: 'PostgreSQL 16', parDefaut: true },
      { nom: 'MariaDB 11.4', parDefaut: false },
      { nom: 'pgBackRest', parDefaut: true },
      { nom: 'Agent de supervision', parDefaut: true },
    ],
    antiAffiniteRecommandee: true,
  },
  {
    id: 'cache',
    nom: 'Cache et files',
    categorie: 'Données',
    icone: 'boxes',
    phrase: 'Redis pour les sessions, les verrous et les files légères.',
    gabarit: { cpu: 2, ramGo: 8, diskGo: 40, nics: 1 },
    logiciels: [
      { nom: 'Redis 7.4', parDefaut: true },
      { nom: 'Agent de supervision', parDefaut: true },
    ],
    antiAffiniteRecommandee: false,
  },
  {
    id: 'fichiers',
    nom: 'Serveur de fichiers',
    categorie: 'Données',
    icone: 'server',
    phrase: 'Partages SMB ou NFS pour les postes et les applications.',
    gabarit: { cpu: 2, ramGo: 8, diskGo: 1000, nics: 1 },
    logiciels: [
      { nom: 'Samba', parDefaut: true },
      { nom: 'NFS Ganesha', parDefaut: false },
      { nom: 'Agent de sauvegarde', parDefaut: true },
    ],
    antiAffiniteRecommandee: false,
  },
  {
    id: 'passerelle',
    nom: 'Passerelle VPN',
    categorie: 'Réseau',
    icone: 'shield',
    phrase: 'Terminaison OpenVPN vers vos équipes. IPsec et WireGuard : bientôt.',
    gabarit: { cpu: 2, ramGo: 4, diskGo: 40, nics: 2 },
    logiciels: [
      { nom: 'OpenVPN', parDefaut: true },
      { nom: 'strongSwan (IPsec)', parDefaut: false },
      { nom: 'Agent de supervision', parDefaut: true },
    ],
    antiAffiniteRecommandee: true,
  },
  {
    id: 'reverse',
    nom: 'Répartiteur de charge',
    categorie: 'Réseau',
    icone: 'network',
    phrase: 'HAProxy en frontal, si vous préférez le gérer vous-même.',
    gabarit: { cpu: 2, ramGo: 4, diskGo: 40, nics: 2 },
    logiciels: [
      { nom: 'HAProxy', parDefaut: true },
      { nom: 'Keepalived', parDefaut: true },
      { nom: 'Agent de supervision', parDefaut: true },
    ],
    antiAffiniteRecommandee: true,
  },
  {
    id: 'runner',
    nom: 'Exécutant CI',
    categorie: 'Outillage',
    icone: 'terminal',
    phrase: 'Machines de construction, jetables et remplaçables.',
    gabarit: { cpu: 8, ramGo: 16, diskGo: 200, nics: 1 },
    logiciels: [
      { nom: 'Docker Engine', parDefaut: true },
      { nom: 'GitLab Runner', parDefaut: true },
      { nom: 'Agent de supervision', parDefaut: false },
    ],
    antiAffiniteRecommandee: false,
  },
  {
    id: 'noeud-k8s',
    nom: 'Nœud Kubernetes',
    categorie: 'Calcul',
    icone: 'boxes',
    phrase: 'Nœud de travail à joindre à un cluster existant.',
    gabarit: { cpu: 8, ramGo: 32, diskGo: 200, nics: 1 },
    logiciels: [
      { nom: 'containerd', parDefaut: true },
      { nom: 'kubelet', parDefaut: true },
      { nom: 'Agent de supervision', parDefaut: true },
    ],
    antiAffiniteRecommandee: true,
  },
  {
    id: 'annuaire',
    nom: 'Contrôleur d’annuaire',
    categorie: 'Outillage',
    icone: 'shield',
    phrase: 'Samba AD ou OpenLDAP pour l’authentification interne.',
    gabarit: { cpu: 2, ramGo: 4, diskGo: 60, nics: 1 },
    logiciels: [
      { nom: 'Samba AD DC', parDefaut: true },
      { nom: 'OpenLDAP', parDefaut: false },
      { nom: 'Agent de sauvegarde', parDefaut: true },
    ],
    antiAffiniteRecommandee: true,
  },
]

export interface LotServeurs {
  id: string
  roleId: string
  prefixe: string
  quantite: number
  cpu: number
  ramGo: number
  diskGo: number
  nics: number
  reseau: string
  logiciels: string[]
  antiAffinite: boolean
  sauvegarde: boolean
}

const ICONES = {
  server: Server,
  database: Database,
  network: Network,
  terminal: Terminal,
  shield: Shield,
  boxes: Boxes,
}

/** Prix indicatif d'un lot, à la ressource. Les mêmes règles que le simulateur. */
export function coutLot(l: LotServeurs): number {
  const parMachine = prixMachine(l.cpu, l.ramGo, l.diskGo) + (l.nics - 1) * 1500
  return parMachine * l.quantite + (l.sauvegarde ? Math.round(parMachine * 0.12) * l.quantite : 0)
}

/**
 * Composition d'un lot de machines par glisser-déposer.
 *
 * Créer quinze machines une par une est un travail d'ouvrier ; ce qu'on veut
 * décrire, c'est une architecture — deux frontaux, une base, un cache. On tire
 * donc des rôles depuis la palette vers le plan, puis on ajuste. Le clavier
 * fait la même chose par le bouton « Ajouter », parce qu'un plan
 * d'infrastructure ne doit pas dépendre d'une souris.
 */
export function ComposeurServeurs({
  lots,
  onChange,
  reseaux,
  quota,
  usage,
  className,
}: {
  lots: LotServeurs[]
  onChange: (lots: LotServeurs[]) => void
  reseaux: string[]
  quota: { vcpu: number; ramGo: number; stockageTo: number }
  usage: { vcpu: number; ramGo: number; stockageTo: number }
  className?: string
}) {
  const [survole, setSurvole] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(lots[0]?.id ?? null)

  const totalCpu = lots.reduce((a, l) => a + l.cpu * l.quantite, 0)
  const totalRam = lots.reduce((a, l) => a + l.ramGo * l.quantite, 0)
  const totalDisk = lots.reduce((a, l) => a + l.diskGo * l.quantite, 0)
  const totalMachines = lots.reduce((a, l) => a + l.quantite, 0)
  const cout = lots.reduce((a, l) => a + coutLot(l), 0)

  const depasseCpu = usage.vcpu + totalCpu > quota.vcpu
  const depasseRam = usage.ramGo + totalRam > quota.ramGo
  const depasseDisk = usage.stockageTo + totalDisk / 1024 > quota.stockageTo

  function ajouter(roleId: string) {
    const role = ROLES_SERVEUR.find((r) => r.id === roleId)
    if (!role) return
    const rang = lots.filter((l) => l.roleId === roleId).length + 1
    onChange([
      ...lots,
      {
        id: `lot-${roleId}-${rang}-${lots.length}`,
        roleId,
        prefixe: rang > 1 ? `${role.id}-${rang}` : role.id,
        quantite: role.antiAffiniteRecommandee ? 2 : 1,
        cpu: role.gabarit.cpu,
        ramGo: role.gabarit.ramGo,
        diskGo: role.gabarit.diskGo,
        nics: role.gabarit.nics,
        reseau: reseaux[0] ?? 'prod-front',
        logiciels: role.logiciels.filter((l) => l.parDefaut).map((l) => l.nom),
        antiAffinite: role.antiAffiniteRecommandee,
        sauvegarde: role.categorie === 'Données',
      },
    ])
    setOuvert(`lot-${roleId}-${rang}-${lots.length}`)
  }

  function modifier(id: string, patch: Partial<LotServeurs>) {
    onChange(lots.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]', className)}>
      {/* Palette de rôles */}
      <Card className="lg:sticky lg:top-[7.5rem] lg:self-start">
        <CardHeader
          titre="Rôles"
          sousTitre="Tirez un rôle sur le plan, ou cliquez pour l’ajouter."
        />
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {(['Calcul', 'Données', 'Réseau', 'Outillage'] as const).map((cat) => (
            <div key={cat}>
              <MicroLabel>{cat}</MicroLabel>
              <ul className="mt-1.5 space-y-1.5">
                {ROLES_SERVEUR.filter((r) => r.categorie === cat).map((r) => {
                  const Icone = ICONES[r.icone]
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', r.id)
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={() => ajouter(r.id)}
                        title={r.phrase}
                        className="flex w-full cursor-grab items-start gap-2 rounded-[6px] border border-g-300 px-2 py-1.5 text-left transition-colors hover:border-p-400 hover:bg-p-050 active:cursor-grabbing"
                      >
                        <GripVertical size={12} className="mt-0.5 shrink-0 text-g-500" />
                        <Icone size={13} className="mt-0.5 shrink-0 text-p-700" />
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold text-ink">{r.nom}</span>
                          <span className="block text-[11px] leading-snug text-g-500">
                            {r.gabarit.cpu} vCPU · {r.gabarit.ramGo} Go
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Plan */}
      <div className="min-w-0 space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setSurvole(true)
          }}
          onDragLeave={() => setSurvole(false)}
          onDrop={(e) => {
            e.preventDefault()
            setSurvole(false)
            const roleId = e.dataTransfer.getData('text/plain')
            if (roleId) ajouter(roleId)
          }}
          className={cn(
            'rounded-[10px] border-2 border-dashed p-3 transition-colors',
            survole ? 'border-p-600 bg-p-050' : 'border-g-300 bg-white',
          )}
        >
          {lots.length === 0 ? (
            <div className="py-10 text-center">
              <Layers size={22} className="mx-auto text-g-500" />
              <p className="mt-2 text-[14px] font-semibold text-ink">Le plan est vide</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-g-500">
                Tirez un rôle depuis la palette. Un lot regroupe des machines identiques : deux
                frontaux, trois nœuds, une base. Vous ajustez ensuite le gabarit, le réseau et ce
                qui doit être installé.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {lots.map((l) => {
                const role = ROLES_SERVEUR.find((r) => r.id === l.roleId)
                if (!role) return null
                const Icone = ICONES[role.icone]
                const deplie = ouvert === l.id
                return (
                  <li key={l.id} className="rounded-[8px] border border-g-300 bg-white">
                    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-p-050 text-p-700">
                        <Icone size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-bold text-ink">{role.nom}</span>
                          <Badge tone="neutral" size="sm">
                            {l.quantite} machine{l.quantite > 1 ? 's' : ''}
                          </Badge>
                          {l.antiAffinite && (
                            <Badge tone="violet" size="sm">
                              Hôtes distincts
                            </Badge>
                          )}
                          {l.sauvegarde && (
                            <Badge tone="ok" size="sm">
                              Sauvegardé
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-g-500">
                          {Array.from({ length: Math.min(3, l.quantite) })
                            .map((_, i) => `${l.prefixe}-${String(i + 1).padStart(2, '0')}`)
                            .join(' · ')}
                          {l.quantite > 3 ? ` · +${l.quantite - 3}` : ''} — {l.cpu} vCPU ·{' '}
                          {l.ramGo} Go · {l.diskGo} Go · {l.nics} carte
                          {l.nics > 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-[13px] font-bold text-p-700">
                        {money(coutLot(l))}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setOuvert(deplie ? null : l.id)}>
                          {deplie ? 'Replier' : 'Régler'}
                        </Button>
                        <IconButton
                          label={`Dupliquer le lot ${role.nom}`}
                          size="sm"
                          onClick={() =>
                            onChange([...lots, { ...l, id: `${l.id}-copie${lots.length}`, prefixe: `${l.prefixe}-b` }])
                          }
                        >
                          <Copy size={13} />
                        </IconButton>
                        <IconButton
                          label={`Retirer le lot ${role.nom}`}
                          size="sm"
                          onClick={() => onChange(lots.filter((x) => x.id !== l.id))}
                        >
                          <Trash2 size={13} className="text-err" />
                        </IconButton>
                      </div>
                    </div>

                    {deplie && (
                      <div className="grid grid-cols-1 gap-4 border-t border-g-100 px-3 py-3 md:grid-cols-2">
                        <div className="space-y-3">
                          <Field label="Préfixe de nom" hint="Les machines sont numérotées à la suite.">
                            <Input
                              value={l.prefixe}
                              onChange={(e) => modifier(l.id, { prefixe: e.target.value })}
                            />
                          </Field>
                          <Slider
                            label="Nombre de machines"
                            value={l.quantite}
                            onChange={(v) => modifier(l.id, { quantite: v })}
                            min={1}
                            max={20}
                          />
                          <Slider
                            label="Processeur"
                            value={l.cpu}
                            onChange={(v) => modifier(l.id, { cpu: v })}
                            min={1}
                            max={32}
                            unite="vCPU"
                          />
                          <Slider
                            label="Mémoire"
                            value={l.ramGo}
                            onChange={(v) => modifier(l.id, { ramGo: v })}
                            min={2}
                            max={128}
                            step={2}
                            unite="Go"
                          />
                          <Slider
                            label="Disque système"
                            value={l.diskGo}
                            onChange={(v) => modifier(l.id, { diskGo: v })}
                            min={20}
                            max={2000}
                            step={20}
                            unite="Go"
                          />
                        </div>

                        <div className="space-y-3">
                          <Field label="Cartes réseau" hint="Une carte par réseau à joindre.">
                            <Select
                              value={String(l.nics)}
                              onChange={(e) => modifier(l.id, { nics: Number(e.target.value) })}
                            >
                              <option value="1">1 carte</option>
                              <option value="2">2 cartes — administration séparée</option>
                              <option value="3">3 cartes — front, back, administration</option>
                            </Select>
                          </Field>
                          <Field label="Réseau principal">
                            <Select
                              value={l.reseau}
                              onChange={(e) => modifier(l.id, { reseau: e.target.value })}
                            >
                              {reseaux.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <div>
                            <MicroLabel>À installer</MicroLabel>
                            <div className="mt-1.5 space-y-1">
                              {role.logiciels.map((lg) => (
                                <Checkbox
                                  key={lg.nom}
                                  checked={l.logiciels.includes(lg.nom)}
                                  onChange={(e) =>
                                    modifier(l.id, {
                                      logiciels: e.target.checked
                                        ? [...l.logiciels, lg.nom]
                                        : l.logiciels.filter((x) => x !== lg.nom),
                                    })
                                  }
                                  label={lg.nom}
                                />
                              ))}
                            </div>
                          </div>
                          <Switch
                            checked={l.antiAffinite}
                            onChange={(v) => modifier(l.id, { antiAffinite: v })}
                            label="Répartir sur des hôtes physiques distincts"
                            description="Indispensable dès que deux machines assurent le même rôle : sans cela, la panne d’un hôte les emporte toutes les deux."
                          />
                          <Switch
                            checked={l.sauvegarde}
                            onChange={(v) => modifier(l.id, { sauvegarde: v })}
                            label="Rattacher au plan de sauvegarde"
                            description="Sauvegarde quotidienne immuable, rétention 30 jours, copie sur l’autre site."
                          />
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <Card>
          <CardHeader
            titre="Ce que ce plan consomme"
            sousTitre="Comparé au quota restant de l’Espace Cloud sélectionné."
            actions={
              <span className="tnum text-[16px] font-bold text-p-700">
                {money(cout)}
                <span className="text-[11px] font-semibold text-g-500">/mois</span>
              </span>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuotaBar
              libelle={`Processeur — ${totalCpu} vCPU demandés`}
              utilise={usage.vcpu + totalCpu}
              total={quota.vcpu}
              unite="vCPU"
              seuil={90}
            />
            <QuotaBar
              libelle={`Mémoire — ${totalRam} Go demandés`}
              utilise={usage.ramGo + totalRam}
              total={quota.ramGo}
              unite="Go"
              seuil={90}
            />
            <QuotaBar
              libelle={`Stockage — ${num(totalDisk)} Go demandés`}
              utilise={Math.round((usage.stockageTo + totalDisk / 1024) * 10) / 10}
              total={quota.stockageTo}
              unite="To"
              seuil={90}
            />
          </div>
          <p className="mt-3 text-[12px] text-g-500">
            {totalMachines} machine{totalMachines > 1 ? 's' : ''} dans {lots.length} lot
            {lots.length > 1 ? 's' : ''}.
          </p>

          {(depasseCpu || depasseRam || depasseDisk) && (
            <Callout ton="err" className="mt-3" titre="Le quota de l’espace ne suffit pas">
              Ce plan dépasse {[depasseCpu && 'le processeur', depasseRam && 'la mémoire', depasseDisk && 'le stockage'].filter(Boolean).join(', ')}{' '}
              disponible. Réduisez le lot, ou étendez le quota de l’Espace Cloud — l’extension est
              immédiate et facturée au prorata.
            </Callout>
          )}

          {lots.some((l) => l.quantite > 1 && !l.antiAffinite) && (
            <Callout ton="warn" className="mt-3" titre="Un lot redondant sans répartition">
              Un lot de plusieurs machines dont la répartition sur des hôtes distincts est
              désactivée n’apporte pas la résilience attendue : les machines peuvent atterrir sur le
              même hôte physique.
            </Callout>
          )}
        </Card>
      </div>
    </div>
  )
}
