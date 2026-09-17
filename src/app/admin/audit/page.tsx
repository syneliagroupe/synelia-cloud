'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, FileCheck2, KeyRound, ShieldAlert } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { MAINTENANT, dateHeure, num, pct, relatif } from '@/lib/format'
import { telechargerCsv, telechargerTexte } from '@/lib/export'
import { EQUIPE_SYNELIA, ORGANISATIONS } from '@/lib/mock'
import type { MembreEquipe } from '@/lib/mock'
import { ROLE_LABEL, type Role } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Drawer } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useLectureDegradable } from '@/lib/api/degradable'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { BoutonAction, useOperation } from '@/components/app/actions'
import type { AuditEvent } from '@/lib/types'

/** `GET /audit/integrite` : rejoue la chaîne de hachage et confirme qu'elle est intacte, ou
 * signale la première ligne en rupture. Pas de forme mock équivalente — l'atelier ne modifie
 * jamais le hash d'une entrée, donc la démonstration reste toujours intacte hors API réelle. */
interface IntegriteAudit {
  intacte: boolean
  entreesVerifiees: number
  totalEntrees: number
  ruptureId?: string | null
  ruptureDate?: string | null
  raison?: string | null
  empreinteFinale?: string
}

const INTEGRITE_DEMO: IntegriteAudit = {
  intacte: true,
  entreesVerifiees: 1_284_912,
  totalEntrees: 1_284_912,
}

const ONGLETS = [
  { id: 'journal', label: 'Journal complet' },
  { id: 'elevations', label: 'Élévations de privilège' },
  { id: 'refus', label: 'Actions refusées' },
  { id: 'integrite', label: 'Intégrité et export' },
]

export default function AuditAdmin() {
  const maintenant = useMaintenant()
  // Journal réel plateforme (`GET /admin/audit`, toutes organisations) quand le backend est
  // joignable ; sinon l'atelier — les actions faites pendant la session s'y ajoutent, refus
  // compris, et sans atelier touché il retombe sur la graine.
  const { journal: journalLocal } = useAtelier()
  const { donnees: journalDistant } = useLectureDegradable<{ donnees: AuditEvent[] }>(
    '/admin/audit',
    { parPage: '200' },
  )
  const AUDIT = journalDistant?.donnees ?? journalLocal
  const { donnees: integriteDistante } = useLectureDegradable<IntegriteAudit>('/audit/integrite')
  const integrite = integriteDistante ?? INTEGRITE_DEMO

  const { autorise, refus, pousser } = useApp()
  const equipe = useCollection<MembreEquipe>('equipe-synelia', EQUIPE_SYNELIA)
  const executer = useOperation()
  const [onglet, setOnglet] = useState('journal')
  const [detail, setDetail] = useState<AuditEvent | null>(null)
  const [du, setDu] = useState('2026-07-19')
  const [au, setAu] = useState('2026-08-19')
  const [perimetre, setPerimetre] = useState('tout')
  const [format, setFormat] = useState('pdf')
  const [empreinte, setEmpreinte] = useState(true)
  const [pseudonymiser, setPseudonymiser] = useState(false)

  const refuses = AUDIT.filter((a) => a.result === 'refuse')
  const erreurs = AUDIT.filter((a) => a.result === 'erreur')
  const parEquipe = AUDIT.filter((a) => equipe.items.some((m) => m.nom === a.actor.nom))
  const elevationsActives = equipe.items.filter((m) => m.elevation?.active)

  const orgNom = (id?: string) =>
    id ? (ORGANISATIONS.find((o) => o.id === id)?.nom ?? id) : 'Plateforme'

  /** Les lignes que l'export retiendra, avec les mêmes règles que l'écran. */
  const lignesExport = () =>
    AUDIT.filter((a) => a.ts.slice(0, 10) >= du && a.ts.slice(0, 10) <= au).filter((a) =>
      perimetre === 'equipe'
        ? equipe.items.some((m) => m.nom === a.actor.nom)
        : perimetre === 'refus'
          ? a.result === 'refuse'
          : perimetre === 'elevations'
            ? a.action.includes('elevation')
            : perimetre === 'org'
              ? Boolean(a.orgId)
              : true,
    )

  const acteur = (a: AuditEvent) => (pseudonymiser ? `acteur-${a.actor.id}` : a.actor.nom)

  const genererExport = () => {
    const lignes = lignesExport()
    if (format === 'csv') {
      telechargerCsv(
        `audit-${du}-${au}`,
        ['Horodatage', 'Acteur', 'Rôle', 'Organisation', 'Périmètre', 'Action', 'Cible', 'Résultat', 'IP'],
        lignes.map((a) => [
          a.ts,
          acteur(a),
          ROLE_LABEL[a.role] ?? a.role,
          a.orgNom ?? orgNom(a.orgId),
          a.scope.label,
          a.action,
          a.target,
          a.result,
          a.ip ?? '',
        ]),
      )
      pousser({
        ton: 'ok',
        titre: `${lignes.length} entrées exportées en CSV`,
        detail: empreinte
          ? 'L’empreinte de chaînage est en dernière colonne du fichier d’accompagnement.'
          : 'Export sans empreinte de chaînage : un tiers ne pourra pas vérifier qu’il n’a pas été modifié.',
      })
      return
    }
    if (format === 'json') {
      telechargerTexte(
        `audit-${du}-${au}.json`,
        JSON.stringify(
          {
            periode: { du, au },
            perimetre,
            entrees: lignes.map((a) => ({ ...a, actor: { ...a.actor, nom: acteur(a) } })),
            ...(empreinte ? { empreinteChainage: 'sha256:9f2c…c41e' } : {}),
          },
          null,
          2,
        ),
        'application/json',
      )
      pousser({
        ton: 'ok',
        titre: `${lignes.length} entrées exportées en JSON`,
        detail: 'Structure stable, adaptée à un collecteur ou à un traitement automatisé.',
      })
      return
    }
    // PDF signé et syslog ne se fabriquent pas dans le navigateur : la
    // maquette dit ce qui se passerait, elle ne prétend pas le faire.
    pousser({
      ton: 'info',
      titre: format === 'pdf' ? 'Export PDF signé en préparation' : 'Flux syslog en préparation',
      detail: `${lignes.length} entrées du ${du} au ${au}. Le lien de téléchargement arrive par courriel dans quelques minutes, valable 24 heures.`,
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Audit' }]}
        titre="Journal d’audit de la plateforme"
        sousTitre="Toutes les actions, y compris celles de nos propres équipes et celles qui ont été refusées. Les lignes concernant une organisation apparaissent aussi dans son journal à elle : nous ne tenons pas un registre séparé que le client ne verrait pas."
        actions={
          <BoutonAction
            libelle="Exporter le journal"
            size="md"
            icone={<Download size={14} />}
            operation={{
              action: 'compliance.export',
              titre: `${AUDIT.length} entrées exportées en CSV`,
              detail:
                'Export brut du journal affiché. L’onglet Intégrité et export permet de borner la période, de choisir le format et de pseudonymiser les acteurs.',
              effet: () =>
                telechargerCsv(
                  'audit-plateforme',
                  ['Horodatage', 'Acteur', 'Rôle', 'Organisation', 'Périmètre', 'Action', 'Cible', 'Résultat', 'IP'],
                  AUDIT.map((a) => [
                    a.ts,
                    a.actor.nom,
                    ROLE_LABEL[a.role] ?? a.role,
                    a.orgNom ?? orgNom(a.orgId),
                    a.scope.label,
                    a.action,
                    a.target,
                    a.result,
                    a.ip ?? '',
                  ]),
                ),
            }}
          />
        }
        meta={
          <>
            <Badge tone="ok" size="sm">
              Journal inaltérable
            </Badge>
            <Badge tone="neutral" size="sm">
              Rétention 24 mois en ligne
            </Badge>
            {elevationsActives.length > 0 && (
              <Badge tone="warn" dot size="sm">
                {elevationsActives.length} élévation active
              </Badge>
            )}
          </>
        }
      />

      {elevationsActives.length > 0 && (
        <Callout ton="warn" titre={`${elevationsActives.length} élévation de privilège active`}>
          {elevationsActives
            .map(
              (m) =>
                `${m.nom} jusqu’à ${m.elevation?.jusqua ? dateHeure(m.elevation.jusqua) : '—'} — ${m.elevation?.justification ?? ''}`,
            )
            .join(' · ')}
          . Chaque élévation active est visible ici et dans le journal de l’organisation concernée. Elle
          expire d’elle-même : personne n’a d’accès permanent aux ressources d’un client.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          libelle="Événements 30 jours"
          valeur={num(AUDIT.length * 312)}
          detail="Toutes organisations, toutes actions"
        />
        <StatTile
          libelle="Actions de nos équipes"
          valeur={num(parEquipe.length * 84)}
          detail="Sur les ressources des clients"
        />
        <StatTile
          libelle="Actions refusées"
          valeur={refuses.length}
          ton={refuses.length > 0 ? 'warn' : 'ok'}
          detail="Rôle insuffisant ou compte désactivé"
        />
        <StatTile
          libelle="Erreurs techniques"
          valeur={erreurs.length}
          ton={erreurs.length > 0 ? 'err' : 'ok'}
        />
        <StatTile
          libelle="Élévations actives"
          valeur={elevationsActives.length}
          ton={elevationsActives.length > 0 ? 'warn' : 'ok'}
          detail="Bornées dans le temps"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'journal' && (
        <Card padding={false}>
          <div className="p-4">
            <DataTable<AuditEvent>
              lignes={AUDIT}
              exportable
              parPage={14}
              densiteInitiale="compacte"
              placeholderRecherche="Rechercher une action, un acteur, une organisation, une ressource…"
              filtres={[
                {
                  id: 'resultat',
                  libelle: 'Résultat',
                  options: [
                    { value: 'tous', label: 'Tous les résultats' },
                    { value: 'ok', label: 'Succès' },
                    { value: 'refuse', label: 'Refusé' },
                    { value: 'erreur', label: 'Erreur' },
                  ],
                },
                {
                  id: 'portee',
                  libelle: 'Portée',
                  options: [
                    { value: 'tous', label: 'Toutes les portées' },
                    { value: 'plateforme', label: 'Plateforme' },
                    { value: 'org', label: 'Organisation' },
                    { value: 'espace', label: 'Espace Cloud' },
                    { value: 'application', label: 'Application' },
                    { value: 'service', label: 'Service managé' },
                  ],
                },
                {
                  id: 'acteur',
                  libelle: 'Type d’acteur',
                  options: [
                    { value: 'tous', label: 'Tous' },
                    { value: 'user', label: 'Utilisateur' },
                    { value: 'systeme', label: 'Système' },
                    { value: 'api', label: 'Jeton d’API' },
                  ],
                },
              ]}
              selection={(l, fid, val) =>
                fid === 'resultat'
                  ? l.result === val
                  : fid === 'portee'
                    ? l.scope.type === val
                    : fid === 'acteur'
                      ? l.actor.type === val
                      : true
              }
              colonnes={[
                {
                  id: 'ts',
                  entete: 'Horodatage',
                  cle: (a) => a.ts,
                  rendu: (a) => (
                    <span className="block">
                      <span className="block text-[11px] text-ink">{dateHeure(a.ts)}</span>
                      <span className="block text-[10px] text-g-500">{relatif(a.ts, maintenant)}</span>
                    </span>
                  ),
                },
                {
                  id: 'acteur',
                  entete: 'Acteur',
                  cle: (a) => `${a.actor.nom} ${a.actor.email}`,
                  rendu: (a) => (
                    <span className="block min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[11.5px] font-semibold text-ink">
                          {a.actor.nom}
                        </span>
                        {equipe.items.some((m) => m.nom === a.actor.nom) && (
                          <Badge tone="violet" size="sm">
                            Synelia
                          </Badge>
                        )}
                      </span>
                      <span className="block text-[10px] text-g-500">
                        {ROLE_LABEL[a.role] ?? a.role}
                      </span>
                    </span>
                  ),
                },
                {
                  id: 'org',
                  entete: 'Organisation',
                  cle: (a) => a.orgNom ?? orgNom(a.orgId),
                  rendu: (a) =>
                    a.orgId ? (
                      <Link
                        href={`/admin/organisations/${a.orgId}`}
                        className="text-[11.5px] text-ink hover:text-p-700"
                      >
                        {a.orgNom ?? orgNom(a.orgId)}
                      </Link>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        Plateforme
                      </Badge>
                    ),
                },
                {
                  id: 'action',
                  entete: 'Action',
                  cle: (a) => a.action,
                  rendu: (a) => (
                    <span className="font-mono text-[11px] text-p-700">{a.action}</span>
                  ),
                },
                {
                  id: 'cible',
                  entete: 'Ressource',
                  cle: (a) => a.target,
                  rendu: (a) => (
                    <span className="block max-w-[22ch] truncate font-mono text-[11px] text-ink">
                      {a.target}
                    </span>
                  ),
                },
                {
                  id: 'portee',
                  entete: 'Portée',
                  cle: (a) => a.scope.label,
                  masquable: true,
                  rendu: (a) => (
                    <span className="text-[10.5px] text-g-500">{a.scope.label}</span>
                  ),
                },
                {
                  id: 'resultat',
                  entete: 'Résultat',
                  cle: (a) => a.result,
                  rendu: (a) => (
                    <Badge
                      tone={a.result === 'ok' ? 'ok' : a.result === 'refuse' ? 'warn' : 'err'}
                      dot
                      size="sm"
                    >
                      {a.result === 'ok' ? 'Succès' : a.result === 'refuse' ? 'Refusé' : 'Erreur'}
                    </Badge>
                  ),
                },
                {
                  id: 'ip',
                  entete: 'Adresse',
                  cle: (a) => a.ip ?? '',
                  masquable: true,
                  masqueeParDefaut: true,
                  rendu: (a) => (
                    <span className="font-mono text-[10px] text-g-500">{a.ip ?? '—'}</span>
                  ),
                },
                {
                  id: 'detail',
                  entete: '',
                  aligne: 'right',
                  rendu: (a) => (
                    <Button size="sm" variant="ghost" onClick={() => setDetail(a)}>
                      Détail
                    </Button>
                  ),
                },
              ]}
              vide={{
                titre: 'Aucun événement',
                phrase: 'Aucun événement ne correspond à ces filtres.',
              }}
            />
          </div>
        </Card>
      )}

      {onglet === 'elevations' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Aucun accès permanent aux données d’un client">
            Un membre de nos équipes ne voit pas le contenu des données d’une organisation sans une
            élévation nominative, motivée, bornée dans le temps, et visible dans le journal d’audit du
            client. Ce n’est pas une politique interne que nous demandons de croire : c’est le
            mécanisme technique, et le client le constate lui-même.
          </Callout>

          <Card>
            <CardHeader
              titre="Élévations actives"
              sousTitre="Elles expirent automatiquement. Une révocation immédiate est possible à tout moment."
            />
            {elevationsActives.length === 0 ? (
              <p className="rounded-[6px] border border-dashed border-g-300 px-4 py-8 text-center text-[12.5px] text-g-500">
                Aucune élévation active en ce moment.
              </p>
            ) : (
              <div className="space-y-2">
                {elevationsActives.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-[8px] border border-warn/40 bg-warn-bg px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                          <KeyRound size={13} className="shrink-0 text-warn" />
                          {m.nom}
                        </span>
                        <span className="block text-[11px] text-g-700">
                          {m.equipe} · {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone="warn" dot size="sm">
                          Expire à {m.elevation?.jusqua ? dateHeure(m.elevation.jusqua).slice(-5) : '—'}
                        </Badge>
                        <GatedAction
                          autorise={autorise('org.manage')}
                          message={refus('org.manage')}
                        >
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              executer({
                                action: 'org.manage',
                                ton: 'info',
                                titre: `Élévation de ${m.nom} révoquée`,
                                detail:
                                  'L’accès est coupé immédiatement. La révocation est journalisée dans le journal du client comme dans le nôtre.',
                                effet: () => equipe.modifier(m.id, { elevation: { active: false } }),
                              })
                            }
                          >
                            Révoquer maintenant
                          </Button>
                        </GatedAction>
                      </span>
                    </div>
                    <p className="mt-2 rounded-[5px] bg-white px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink">
                      Motif : {m.elevation!.justification}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Historique des élévations"
                sousTitre="Trente derniers jours, toutes équipes."
              />
              <div className="space-y-2">
                {[
                  {
                    qui: 'Jean-Vincent Kassi',
                    org: 'Digital Business Africa',
                    q: '2026-08-19T13:00:00Z',
                    d: '4 h',
                    m: 'Ticket SYN-8814 — diagnostic de latence sur app-metier',
                    p: 'Lecture, journaux inclus',
                  },
                  {
                    qui: 'Marina Gbagbo',
                    org: 'ONECI',
                    q: '2026-08-16T22:14:00Z',
                    d: '2 h',
                    m: 'Ticket SYN-8752 — sauvegarde en échec, intervention accompagnée',
                    p: 'Intervention',
                  },
                  {
                    qui: 'Cheick Coulibaly',
                    org: 'Cofina Digital',
                    q: '2026-08-12T09:20:00Z',
                    d: '2 h',
                    m: 'Ticket SYN-8710 — restauration accompagnée',
                    p: 'Intervention',
                  },
                  {
                    qui: 'Marina Gbagbo',
                    org: 'SOTRA Mobilité',
                    q: '2026-08-04T14:41:00Z',
                    d: '1 h',
                    m: 'Ticket SYN-8641 — vérification de configuration réseau',
                    p: 'Lecture seule',
                  },
                ].map((e) => (
                  <div key={e.q} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="min-w-0 text-[12.5px] font-semibold text-ink">{e.qui}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge
                          tone={e.p === 'Intervention' ? 'warn' : 'neutral'}
                          size="sm"
                        >
                          {e.p}
                        </Badge>
                        <span className="text-[10.5px] text-g-500">{e.d}</span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-g-700">{e.m}</p>
                    <p className="mt-0.5 text-[10.5px] text-g-500">
                      {e.org} · {dateHeure(e.q)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Règles d’élévation"
                sousTitre="Ce qui est exigé, et ce qui est refusé."
              />
              <div className="space-y-2">
                {[
                  {
                    r: 'Un motif écrit, visible du client',
                    d: 'Pas de code interne, pas d’abréviation : une phrase que le client peut lire et comprendre dans son propre journal.',
                  },
                  {
                    r: 'Une durée maximale de huit heures',
                    d: 'Au-delà, il faut une nouvelle demande. Une élévation qui dure une semaine n’est plus une élévation, c’est un accès permanent déguisé.',
                  },
                  {
                    r: 'Un ticket associé pour toute intervention',
                    d: 'Une intervention sans ticket n’a pas de trace côté client, ce qui la rend indéfendable en cas de contestation.',
                  },
                  {
                    r: 'Notification de l’administrateur du client',
                    d: 'Non désactivable pour une intervention. Un accès dont le client n’est pas averti n’est pas un accès légitime.',
                  },
                  {
                    r: 'Chaque action pendant l’élévation est journalisée',
                    d: 'Individuellement, pas globalement. Le client voit ce qui a été fait, pas seulement qu’un accès a eu lieu.',
                  },
                  {
                    r: 'Aucune élévation sans expiration',
                    d: 'Le système refuse une élévation sans date de fin. Il n’existe pas d’exception, pas même pour la direction.',
                  },
                ].map((x) => (
                  <div key={x.r} className="rounded-[6px] border border-p-300 bg-p-050 px-3 py-2.5">
                    <p className="text-[12.5px] font-semibold text-ink">{x.r}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">{x.d}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'refus' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Un refus est une information, pas un incident">
            Le contrôle d’accès a fait son travail : l’action n’a eu aucun effet. Ce qui compte, c’est
            ce que le refus révèle — un rôle mal calibré, un compte oublié après un départ, ou une
            tentative réelle. Les trois demandent une action différente, et c’est pour cela que nous les
            regardons un par un.
          </Callout>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                titre="Actions refusées"
                sousTitre="Chaque ligne porte l’action visée, le rôle de l’acteur et le rôle qui aurait été requis."
              />
              {refuses.length === 0 ? (
                <p className="rounded-[6px] border border-dashed border-g-300 px-4 py-8 text-center text-[12.5px] text-g-500">
                  Aucune action refusée sur la période.
                </p>
              ) : (
                <div className="space-y-2">
                  {refuses.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-[6px] border border-warn/40 bg-warn-bg px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                            <ShieldAlert size={12} className="shrink-0 text-warn" />
                            {a.actor.nom}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-p-700">
                            {a.action}
                          </span>
                          <span className="block text-[10.5px] text-g-700">
                            sur <span className="font-mono">{a.target}</span> · {a.scope.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[10.5px] text-g-500">{dateHeure(a.ts)}</span>
                          <Badge tone="neutral" size="sm">
                            {ROLE_LABEL[a.role] ?? a.role}
                          </Badge>
                        </span>
                      </div>
                      {a.detail && (
                        <p className="mt-1.5 rounded-[5px] bg-white px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink">
                          {a.detail}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(a)}>
                          Voir l’entrée complète
                        </Button>
                        {a.orgId && (
                          <ButtonLink
                            size="sm"
                            variant="ghost"
                            href={`/admin/organisations/${a.orgId}`}
                          >
                            Ouvrir l’organisation
                          </ButtonLink>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader
                  titre="Volume de refus sur 30 jours"
                  sousTitre="Un pic signale souvent un changement de rôle mal accompagné."
                />
                <div className="flex items-end gap-1">
                  {seededSeries('refus-30j', 30, 0, 6).map((v, i) => (
                    <span
                      key={i}
                      className={cn('flex-1 rounded-t-sm', v > 4 ? 'bg-warn' : 'bg-p-300')}
                      style={{ height: `${6 + v * 12}px` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10.5px] text-g-500">
                  <span>Il y a 30 jours</span>
                  <span>Aujourd’hui</span>
                </div>
              </Card>

              <Card>
                <CardHeader
                  titre="Ce qu’un refus révèle"
                  sousTitre="Trois causes, trois actions différentes."
                />
                <div className="space-y-2">
                  {[
                    {
                      c: 'Rôle mal calibré',
                      s: 'Le même refus revient sur la même personne',
                      a: 'Ajuster son rôle, ou lui expliquer par quel chemin passer',
                      t: 'warn' as const,
                    },
                    {
                      c: 'Compte oublié après un départ',
                      s: 'Un compte désactivé tente de se connecter',
                      a: 'Appeler l’organisation — soit la personne l’ignore, soit ses identifiants circulent',
                      t: 'err' as const,
                    },
                    {
                      c: 'Automatisation obsolète',
                      s: 'Un jeton d’API échoue en boucle sur la même action',
                      a: 'Prévenir le client : son script casse silencieusement depuis un changement de rôle',
                      t: 'info' as const,
                    },
                  ].map((x) => (
                    <div
                      key={x.c}
                      className={cn(
                        'rounded-[6px] border px-3 py-2.5',
                        x.t === 'err'
                          ? 'border-err/40 bg-err-bg'
                          : x.t === 'warn'
                            ? 'border-warn/40 bg-warn-bg'
                            : 'border-info/40 bg-info-bg',
                      )}
                    >
                      <p className="text-[12px] font-bold text-ink">{x.c}</p>
                      <p className="mt-0.5 text-[11px] text-g-700">Signe : {x.s}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-ink">À faire : {x.a}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {onglet === 'integrite' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Intégrité du journal"
              sousTitre="Chaque entrée porte une empreinte cryptographique chaînée à la précédente. Modifier ou supprimer une ligne casserait la chaîne, et serait immédiatement détectable."
              actions={
                <Badge tone={integrite.intacte ? 'ok' : 'err'} dot size="sm">
                  {integrite.intacte ? 'Chaîne intacte' : 'Rupture détectée'}
                </Badge>
              }
            />
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Algorithme', valeur: 'SHA-256, chaînage séquentiel' },
                {
                  cle: 'Dernière vérification complète',
                  valeur: integriteDistante ? dateHeure(MAINTENANT) : dateHeure('2026-08-19T06:00:00Z'),
                },
                { cle: 'Entrées vérifiées', valeur: `${num(integrite.entreesVerifiees)} / ${num(integrite.totalEntrees)}` },
                {
                  cle: 'Ruptures détectées',
                  valeur: integrite.intacte ? '0' : `1 — ${integrite.raison ?? 'voir détail'}`,
                },
                { cle: 'Rétention en ligne', valeur: '24 mois' },
                { cle: 'Archivage froid', valeur: '5 ans supplémentaires' },
                { cle: 'Suppression possible', valeur: 'Non — y compris par nous' },
                { cle: 'Réplication', valeur: 'Abidjan et Grand-Bassam, en écriture synchrone' },
              ]}
            />
            {integrite.intacte ? (
              <Callout ton="violet" className="mt-4" titre="Personne ne peut réécrire l’histoire">
                Ni un administrateur de la plateforme, ni la direction, ni un attaquant qui aurait obtenu
                nos accès les plus élevés. C’est la seule façon de rendre un journal d’audit utile pour
                une certification, un litige, ou simplement pour répondre honnêtement à la question
                « qu’est-ce qui s’est passé le 12 mars à 14 h ? ».
              </Callout>
            ) : (
              <Callout ton="err" className="mt-4" titre="La chaîne est rompue">
                Première entrée en rupture : <span className="font-mono">{integrite.ruptureId}</span>
                {integrite.ruptureDate ? ` (${dateHeure(integrite.ruptureDate)})` : ''}. {integrite.raison}
                . À traiter en priorité — c’est le signe qu’une ligne a été insérée, modifiée ou
                supprimée hors du chemin normal d’écriture.
              </Callout>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Export du journal"
                sousTitre="Pour un audit, une certification, ou une réquisition judiciaire."
              />
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Du">
                    <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
                  </Field>
                  <Field label="Au">
                    <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
                  </Field>
                </div>
                <Field label="Périmètre">
                  <Select value={perimetre} onChange={(e) => setPerimetre(e.target.value)}>
                    <option value="tout">Toute la plateforme</option>
                    <option value="org">Une organisation précise</option>
                    <option value="equipe">Actions de nos équipes uniquement</option>
                    <option value="refus">Refus uniquement</option>
                    <option value="elevations">Élévations de privilège uniquement</option>
                  </Select>
                </Field>
                <Field
                  label="Format"
                  hint="CSV et JSON sont produits ici même ; le PDF signé et le flux syslog sont fabriqués côté serveur"
                >
                  <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="csv">CSV — pour un tableur</option>
                    <option value="json">JSON — pour un traitement automatisé</option>
                    <option value="pdf">PDF signé — pour une remise formelle</option>
                    <option value="syslog">Syslog RFC 5424 — pour un collecteur</option>
                  </Select>
                </Field>
                <div className="space-y-3">
                  <Switch
                    checked={empreinte}
                    onChange={setEmpreinte}
                    label="Inclure l’empreinte de chaînage"
                    description="Permet à un tiers de vérifier que l’export n’a pas été modifié après extraction."
                  />
                  <Switch
                    checked={pseudonymiser}
                    onChange={setPseudonymiser}
                    label="Pseudonymiser les acteurs"
                    description="Remplace les noms par des identifiants stables. Utile pour une remise à un tiers qui n’a pas besoin de l’identité des personnes."
                  />
                </div>
                <p className="text-[11.5px] text-g-500">
                  {lignesExport().length} entrée{lignesExport().length > 1 ? 's' : ''} dans la
                  sélection, sur {AUDIT.length} au journal.
                </p>
              </div>
              <GatedAction autorise={autorise('compliance.export')} message={refus('compliance.export')}>
                <Button
                  className="mt-4"
                  iconBefore={<FileCheck2 size={14} />}
                  disabled={du > au}
                  onClick={genererExport}
                >
                  Générer l’export
                </Button>
              </GatedAction>
            </Card>

            <Card>
              <CardHeader
                titre="Vérifier un export hors de la plateforme"
                sousTitre="L’outil est libre et son code est publié : l’auditeur n’a pas à nous croire."
              />
              <CodeBlock
                langue="bash"
                code={`# Vérifier la chaîne d'empreintes d'un export
synelia-audit verify audit-plateforme-2026-07-19_2026-08-19.csv \\
  --empreinte-attendue 8f2a91c4d7b0e5443a17c96e2f0d8b41

# Sortie attendue
# 42 918 entrées vérifiées
# chaîne intacte du 2026-07-19T00:00:00Z au 2026-08-19T15:20:00Z
# aucune insertion, modification ni suppression détectée
# empreinte finale : 8f2a91c4d7b0e5443a17c96e2f0d8b41`}
              />
              <Callout ton="info" className="mt-4" titre="Pourquoi publier l’outil de vérification">
                Un journal d’audit dont seul le fournisseur peut vérifier l’intégrité ne prouve rien.
                En publiant l’outil et le format, nous rendons la vérification possible sans nous, ce
                qui est la seule façon de rendre la garantie crédible.
              </Callout>
              <MicroLabel className="mt-4 mb-1.5">Ce que nous ne pouvons pas faire</MicroLabel>
              <ul className="space-y-1">
                {[
                  'Supprimer une entrée du journal',
                  'Modifier le contenu d’une entrée existante',
                  'Antidater une entrée',
                  'Masquer une action de nos propres équipes',
                  'Empêcher un client de voir les lignes qui le concernent',
                ].map((x) => (
                  <li key={x} className="text-[11.5px] leading-relaxed text-g-700">
                    · {x}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <Drawer
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Entrée du journal d’audit"
        size="md"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={detail.result === 'ok' ? 'ok' : detail.result === 'refuse' ? 'warn' : 'err'}
                dot
              >
                {detail.result === 'ok'
                  ? 'Succès'
                  : detail.result === 'refuse'
                    ? 'Refusé'
                    : 'Erreur'}
              </Badge>
              <Badge tone="neutral" size="sm">
                {detail.id}
              </Badge>
              {equipe.items.some((m) => m.nom === detail.actor.nom) && (
                <Badge tone="violet" size="sm">
                  Action d’une équipe Synelia
                </Badge>
              )}
            </div>

            <KeyValueList
              colonnes={1}
              items={[
                { cle: 'Horodatage', valeur: `${dateHeure(detail.ts)} (${relatif(detail.ts, maintenant)})` },
                {
                  cle: 'Acteur',
                  valeur: `${detail.actor.nom} — ${detail.actor.email} (${detail.actor.type})`,
                },
                { cle: 'Rôle au moment de l’action', valeur: ROLE_LABEL[detail.role] ?? detail.role },
                { cle: 'Organisation', valeur: detail.orgNom ?? orgNom(detail.orgId) },
                { cle: 'Portée', valeur: `${detail.scope.type} — ${detail.scope.label}` },
                { cle: 'Action', valeur: detail.action },
                { cle: 'Ressource visée', valeur: detail.target },
                { cle: 'Adresse source', valeur: detail.ip ?? '—' },
                { cle: 'Motif ou détail', valeur: detail.detail ?? '—' },
              ]}
            />

            {detail.result === 'refuse' && (
              <Callout ton="warn" titre="Pourquoi cette action a été refusée">
                Le rôle de l’acteur n’autorisait pas cette action. Le portail affichait le bouton
                désactivé, avec une infobulle nommant le rôle requis. L’action n’a eu aucun effet, et
                cette ligne apparaît également dans le journal de l’organisation concernée.
              </Callout>
            )}

            {detail.orgId && (
              <Callout ton="info" titre="Cette entrée est aussi visible du client">
                Elle figure dans le journal d’audit de {detail.orgNom ?? orgNom(detail.orgId)}, à
                l’identique. Nous ne tenons pas un registre parallèle que le client ne verrait pas.
              </Callout>
            )}

            <div>
              <MicroLabel className="mb-2">Entrée brute</MicroLabel>
              <CodeBlock
                langue="json"
                code={JSON.stringify(
                  {
                    id: detail.id,
                    ts: detail.ts,
                    org: detail.orgId ?? null,
                    acteur: detail.actor,
                    role: detail.role,
                    portee: detail.scope,
                    action: detail.action,
                    cible: detail.target,
                    resultat: detail.result,
                    ip: detail.ip ?? null,
                    detail: detail.detail ?? null,
                    empreinte_precedente: '8f2a91c4d7b0e544',
                    empreinte: '1b74e0aa93c04d2f',
                  },
                  null,
                  2,
                )}
              />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
