'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Clock, UserCheck } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { dateHeure, dureeMin, MAINTENANT, pct, relatif } from '@/lib/format'
import { EQUIPE_SYNELIA, ORGANISATIONS, TICKETS_PLATEFORME } from '@/lib/mock'
import { ROLE_LABEL } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Avatar, GatedAction, Tabs } from '@/components/ui/display'
import { Field, MonoTextarea, Select, Switch } from '@/components/ui/field'
import { Drawer, Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { Timeline } from '@/components/composition/flow'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, modifierRessource, requete } from '@/lib/api/client'
import type { Ticket } from '@/lib/types'
import type { MembreEquipe } from '@/lib/mock'

const ONGLETS = [
  { id: 'file', label: 'File de traitement' },
  { id: 'charge', label: 'Charge des équipes' },
  { id: 'engagements', label: 'Engagements de service' },
]

const LIBELLE_STATUT: Record<Ticket['statut'], string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  attente_client: 'Attente client',
  resolu: 'Résolu',
  ferme: 'Fermé',
}

const TON_STATUT: Record<Ticket['statut'], 'ok' | 'err' | 'warn' | 'info' | 'neutral'> = {
  ouvert: 'info',
  en_cours: 'info',
  attente_client: 'warn',
  resolu: 'ok',
  ferme: 'neutral',
}

const LIBELLE_GRAVITE: Record<Ticket['gravite'], string> = {
  critique: 'Critique',
  majeure: 'Majeure',
  mineure: 'Mineure',
  question: 'Question',
}

const TON_GRAVITE: Record<Ticket['gravite'], 'err' | 'warn' | 'info' | 'neutral'> = {
  critique: 'err',
  majeure: 'warn',
  mineure: 'info',
  question: 'neutral',
}

export default function TicketsAdmin() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const tickets = useCollection<Ticket>('tickets-plateforme', TICKETS_PLATEFORME)
  // En mode API, organisations et intervenants viennent du backend : les
  // identifiants distants sont inconnus du jeu local, qui filtrerait tout.
  const orgsDistantes = useCollection('organisations', ORGANISATIONS)
  const equipeDistante = useCollection<MembreEquipe>('equipe-synelia', EQUIPE_SYNELIA)
  const ORGANISATIONS_LUES = estActif() ? orgsDistantes.items : ORGANISATIONS
  const EQUIPE_LUE = estActif() ? equipeDistante.items : EQUIPE_SYNELIA
  const executer = useOperation()
  const [onglet, setOnglet] = useState('file')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [assignationId, setAssignationId] = useState<string | null>(null)
  const [reponse, setReponse] = useState('')
  const [intervenant, setIntervenant] = useState('')
  const [notifierIntervenant, setNotifierIntervenant] = useState(true)
  const [notifierResponsable, setNotifierResponsable] = useState(false)

  // Relus dans la collection : un ticket résolu depuis le tiroir doit s'y voir.
  const detail = tickets.items.find((t) => t.id === detailId) ?? null
  const assignation = tickets.items.find((t) => t.id === assignationId) ?? null

  const ouverts = tickets.items.filter((t) => !['resolu', 'ferme'].includes(t.statut))
  const nonAssignes = ouverts.filter((t) => !t.assigneA)
  const critiques = ouverts.filter((t) => t.gravite === 'critique')
  const enRisque = ouverts.filter((t) => (t.slaRestantMin ?? 9999) < 120)
  const enAttente = tickets.items.filter((t) => t.statut === 'attente_client')

  /** Une réponse de notre côté arrête l'horloge de première réponse. */
  const repondre = (t: Ticket, statut: Ticket['statut'], titre: string, detailToast: string) => {
    const message = reponse.trim()
    executer({
      action: 'org.dashboard.view',
      ton: statut === 'resolu' ? 'ok' : 'info',
      titre,
      detail: detailToast,
      appel: async () => {
        // Le message puis le statut : deux écritures, une seule opération.
        if (message)
          await requete(`/admin/tickets/${encodeURIComponent(t.id)}/messages`, {
            methode: 'POST',
            corps: { contenu: message },
          })
        await modifierRessource('/admin/tickets', t.id, { statut })
      },
      effet: () =>
        tickets.modifier(t.id, (courant) => ({
          statut,
          slaRestantMin: undefined,
          messages: message
            ? [
                ...courant.messages,
                {
                  auteur: EQUIPE_SYNELIA[0].nom,
                  role: 'synelia' as const,
                  date: MAINTENANT,
                  contenu: message,
                },
              ]
            : courant.messages,
        })),
      effetFinal: () => tickets.recharger(),
    })
    setReponse('')
  }

  const orgNom = (id: string) => ORGANISATIONS_LUES.find((o) => o.id === id)?.nom ?? id

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Tickets' }]}
        titre="Tickets"
        sousTitre="La file de traitement, toutes organisations confondues. L’ordre par défaut est celui du risque d’engagement, pas celui de l’ancienneté : un ticket critique ouvert il y a dix minutes passe avant une question posée hier."
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {ouverts.length} tickets ouverts
            </Badge>
            {critiques.length > 0 && (
              <Badge tone="err" dot size="sm">
                {critiques.length} critique{critiques.length > 1 ? 's' : ''}
              </Badge>
            )}
            {nonAssignes.length > 0 && (
              <Badge tone="warn" size="sm">
                {nonAssignes.length} non assigné{nonAssignes.length > 1 ? 's' : ''}
              </Badge>
            )}
          </>
        }
        actions={
          <ButtonLink variant="secondary" external href="https://centreon.synelia.cloud">
            Console de supervision
          </ButtonLink>
        }
      />

      {critiques.length > 0 && (
        <Callout ton="err" titre={`${critiques.length} ticket critique en cours`}>
          {critiques
            .map(
              (t) =>
                `${t.numero} — ${orgNom(t.orgId)} : ${t.sujet}${t.slaRestantMin !== undefined ? ` (${dureeMin(t.slaRestantMin)} restantes)` : ''}`,
            )
            .join(' · ')}
          . Un ticket critique mobilise l’astreinte quelle que soit l’heure. L’engagement de première
          réponse est de trente minutes.
        </Callout>
      )}

      {nonAssignes.length > 0 && (
        <Callout ton="warn" titre={`${nonAssignes.length} ticket sans personne assignée`}>
          Un ticket non assigné n’a personne qui le porte, et l’horloge de l’engagement tourne quand
          même. L’assignation devrait être faite dans les minutes qui suivent l’ouverture, quitte à la
          changer ensuite.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile
          libelle="Tickets ouverts"
          valeur={ouverts.length}
          ton={ouverts.length > 8 ? 'warn' : 'violet'}
        />
        <StatTile
          libelle="Critiques"
          valeur={critiques.length}
          ton={critiques.length > 0 ? 'err' : 'ok'}
        />
        <StatTile
          libelle="Engagements en risque"
          valeur={enRisque.length}
          ton={enRisque.length > 0 ? 'warn' : 'ok'}
          detail="Moins de 2 h restantes"
        />
        <StatTile
          libelle="Non assignés"
          valeur={nonAssignes.length}
          ton={nonAssignes.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Attente client"
          valeur={enAttente.length}
          detail="Horloge suspendue"
        />
        <StatTile
          libelle="Première réponse médiane"
          valeur="14 min"
          ton="ok"
          detail="Engagement : 30 min sur critique"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'file' && (
        <Card padding={false}>
          <div className="p-4">
            <DataTable<Ticket>
              lignes={[...tickets.items].sort(
                (a, b) => (a.slaRestantMin ?? 99999) - (b.slaRestantMin ?? 99999),
              )}
              exportable
              parPage={12}
              densiteInitiale="compacte"
              placeholderRecherche="Rechercher un ticket, une organisation…"
              filtres={[
                {
                  id: 'statut',
                  libelle: 'Statut',
                  options: [
                    { value: 'tous', label: 'Tous les statuts' },
                    { value: 'ouvert', label: 'Ouvert' },
                    { value: 'en_cours', label: 'En cours' },
                    { value: 'attente_client', label: 'Attente client' },
                    { value: 'resolu', label: 'Résolu' },
                  ],
                },
                {
                  id: 'gravite',
                  libelle: 'Gravité',
                  options: [
                    { value: 'tous', label: 'Toutes' },
                    { value: 'critique', label: 'Critique' },
                    { value: 'majeure', label: 'Majeure' },
                    { value: 'mineure', label: 'Mineure' },
                    { value: 'question', label: 'Question' },
                  ],
                },
                {
                  id: 'assignation',
                  libelle: 'Assignation',
                  options: [
                    { value: 'tous', label: 'Tous' },
                    { value: 'non', label: 'Non assignés' },
                    ...EQUIPE_LUE.map((m) => ({ value: m.nom, label: m.nom })),
                  ],
                },
              ]}
              selection={(l, fid, val) => {
                if (fid === 'statut') return l.statut === val
                if (fid === 'gravite') return l.gravite === val
                if (fid === 'assignation')
                  return val === 'non' ? !l.assigneA : l.assigneA === val
                return true
              }}
              colonnes={[
                {
                  id: 'sla',
                  entete: 'Engagement',
                  cle: (t) => t.slaRestantMin ?? 99999,
                  rendu: (t) =>
                    t.slaRestantMin === undefined ? (
                      <span className="text-[11.5px] text-g-500">—</span>
                    ) : (
                      <span
                        className={cn(
                          'flex items-center gap-1.5 text-[12px] font-bold',
                          t.slaRestantMin < 60
                            ? 'text-err'
                            : t.slaRestantMin < 240
                              ? 'text-warn'
                              : 'text-g-700',
                        )}
                      >
                        {t.slaRestantMin < 120 && <Clock size={11} className="shrink-0" />}
                        <span className="tnum">{dureeMin(t.slaRestantMin)}</span>
                      </span>
                    ),
                },
                {
                  id: 'ticket',
                  entete: 'Ticket',
                  cle: (t) => `${t.numero} ${t.sujet}`,
                  rendu: (t) => (
                    <span className="block min-w-0">
                      <span className="block font-mono text-[10.5px] text-g-500">{t.numero}</span>
                      <span className="block truncate text-[12.5px] font-semibold text-ink">
                        {t.sujet}
                      </span>
                    </span>
                  ),
                },
                {
                  id: 'org',
                  entete: 'Organisation',
                  cle: (t) => orgNom(t.orgId),
                  rendu: (t) => (
                    <Link
                      href={`/admin/organisations/${t.orgId}`}
                      className="text-[12px] text-ink hover:text-p-700"
                    >
                      {orgNom(t.orgId)}
                    </Link>
                  ),
                },
                {
                  id: 'gravite',
                  entete: 'Gravité',
                  cle: (t) => t.gravite,
                  rendu: (t) => (
                    <Badge tone={TON_GRAVITE[t.gravite]} dot size="sm">
                      {LIBELLE_GRAVITE[t.gravite]}
                    </Badge>
                  ),
                },
                {
                  id: 'statut',
                  entete: 'Statut',
                  cle: (t) => t.statut,
                  rendu: (t) => (
                    <Badge tone={TON_STATUT[t.statut]} dot size="sm">
                      {LIBELLE_STATUT[t.statut]}
                    </Badge>
                  ),
                },
                {
                  id: 'assigne',
                  entete: 'Assigné à',
                  cle: (t) => t.assigneA ?? '',
                  rendu: (t) =>
                    t.assigneA ? (
                      <span className="flex items-center gap-2">
                        <Avatar nom={t.assigneA} size="sm" />
                        <span className="truncate text-[11.5px] text-ink">{t.assigneA}</span>
                      </span>
                    ) : (
                      <Badge tone="warn" size="sm">
                        Non assigné
                      </Badge>
                    ),
                },
                {
                  id: 'service',
                  entete: 'Périmètre',
                  cle: (t) => t.service ?? '',
                  masquable: true,
                  rendu: (t) => (
                    <span className="text-[11.5px] text-g-700">{t.service ?? '—'}</span>
                  ),
                },
                {
                  id: 'messages',
                  entete: 'Échanges',
                  aligne: 'center',
                  cle: (t) => t.messages.length,
                  masquable: true,
                  rendu: (t) => (
                    <span className="tnum text-[12px] text-g-700">{t.messages.length}</span>
                  ),
                },
                {
                  id: 'ouvert',
                  entete: 'Ouvert',
                  aligne: 'right',
                  cle: (t) => t.createdAt,
                  rendu: (t) => (
                    <span className="text-[11.5px] text-g-500">{relatif(t.createdAt, maintenant)}</span>
                  ),
                },
                {
                  id: 'actions',
                  entete: '',
                  aligne: 'right',
                  rendu: (t) => (
                    <span className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(t.id)}>
                        Ouvrir
                      </Button>
                      {!['resolu', 'ferme'].includes(t.statut) && (
                        <GatedAction
                          autorise={autorise('org.dashboard.view')}
                          message={refus('org.dashboard.view')}
                        >
                          <Button
                            size="sm"
                            variant={t.assigneA ? 'ghost' : 'secondary'}
                            iconBefore={<UserCheck size={12} />}
                            onClick={() => setAssignationId(t.id)}
                          >
                            {t.assigneA ? 'Réassigner' : 'Assigner'}
                          </Button>
                        </GatedAction>
                      )}
                    </span>
                  ),
                },
              ]}
              vide={{
                titre: 'Aucun ticket',
                phrase: 'La file est vide. C’est rare, et c’est plutôt bon signe.',
              }}
            />
          </div>
        </Card>
      )}

      {onglet === 'charge' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Charge par intervenant"
                sousTitre="Un intervenant qui porte trop de tickets critiques simultanément finit par les traiter tous mal."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Intervenant', 'Équipe', 'Rôle', 'Tickets ouverts', 'Dont critiques', 'Charge', 'Dernier accès'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {EQUIPE_LUE.map((m) => {
                    const siens = ouverts.filter((t) => t.assigneA === m.nom)
                    const sesCritiques = siens.filter((t) => t.gravite === 'critique')
                    const charge = siens.length * 20 + sesCritiques.length * 30
                    return (
                      <tr key={m.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <Avatar nom={m.nom} size="sm" />
                            <span className="min-w-0">
                              <span className="block text-[12.5px] font-semibold text-ink">
                                {m.nom}
                              </span>
                              <span className="block text-[10.5px] text-g-500">{m.email}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">{m.equipe}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={m.privilegie ? 'violet' : 'neutral'} size="sm">
                            {ROLE_LABEL[m.role] ?? m.role}
                          </Badge>
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] font-semibold text-ink">
                          {siens.length}
                        </td>
                        <td className="px-3 py-2.5">
                          {sesCritiques.length > 0 ? (
                            <Badge tone="err" size="sm">
                              {sesCritiques.length}
                            </Badge>
                          ) : (
                            <span className="text-[11.5px] text-g-500">0</span>
                          )}
                        </td>
                        <td className="w-40 px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="relative block h-2 flex-1 overflow-hidden rounded-full bg-g-100">
                              <span
                                className={cn(
                                  'absolute inset-y-0 left-0 rounded-full',
                                  charge > 70 ? 'bg-err' : charge > 40 ? 'bg-warn' : 'bg-ok',
                                )}
                                style={{ width: `${Math.min(100, charge)}%` }}
                              />
                            </span>
                            <span
                              className={cn(
                                'tnum shrink-0 text-[11px] font-semibold',
                                charge > 70 ? 'text-err' : charge > 40 ? 'text-warn' : 'text-ok',
                              )}
                            >
                              {charge > 70 ? 'Élevée' : charge > 40 ? 'Correcte' : 'Faible'}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-500">
                          {relatif(m.dernierAcces, maintenant)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Volume de tickets sur 30 jours"
                sousTitre="Un pic soudain signale généralement un incident sous-jacent mal communiqué."
              />
              <div className="flex items-end gap-1">
                {seededSeries('admin-tickets-30j', 30, 1, 14).map((v, i) => (
                  <span
                    key={i}
                    className={cn('flex-1 rounded-t-sm', v > 11 ? 'bg-warn' : 'bg-p-600')}
                    style={{ height: `${8 + v * 8}px` }}
                    title={`${v} tickets`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10.5px] text-g-500">
                <span>Il y a 30 jours</span>
                <span>Aujourd’hui</span>
              </div>
              <Callout ton="info" className="mt-4" titre="Le pic du 12 août">
                Quatorze tickets en une journée, tous sur la messagerie. Un incident réel, mais dont la
                communication publique est partie trente minutes trop tard : la moitié de ces tickets
                n’aurait pas été ouverte si la page de statut avait été à jour plus tôt.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Motifs de ticket les plus fréquents"
                sousTitre="Un motif récurrent est un défaut de produit ou de documentation, pas une fatalité du support."
              />
              <div className="space-y-2.5">
                {[
                  { m: 'Question sur la facturation à l’usage', n: 18, action: 'Documentation à clarifier' },
                  { m: 'Demande de restauration accompagnée', n: 14, action: 'Assistant à simplifier' },
                  { m: 'Configuration de la fédération d’identité', n: 11, action: 'Guide à écrire' },
                  { m: 'Latence applicative', n: 9, action: 'Incident réel' },
                  { m: 'Extension de quota', n: 8, action: 'Libre-service à ouvrir' },
                  { m: 'Sauvegarde en échec', n: 6, action: 'Incident réel' },
                ].map((x) => {
                  const max = 18
                  return (
                    <div key={x.m}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[12px] text-ink">{x.m}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge
                            tone={x.action === 'Incident réel' ? 'neutral' : 'warn'}
                            size="sm"
                          >
                            {x.action}
                          </Badge>
                          <span className="tnum text-[12px] font-semibold text-ink">{x.n}</span>
                        </span>
                      </div>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-g-100">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            x.action === 'Incident réel' ? 'bg-p-600' : 'bg-warn',
                          )}
                          style={{ width: `${(x.n / max) * 100}%` }}
                        />
                      </span>
                    </div>
                  )
                })}
              </div>
              <Callout ton="violet" className="mt-4" titre="Trente-sept tickets évitables sur soixante-six">
                Une documentation clarifiée, un assistant de restauration plus simple, un guide de
                fédération et une extension de quota en libre-service supprimeraient plus de la moitié
                de notre volume de tickets. C’est le meilleur investissement possible pour le support.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'engagements' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Engagements par gravité"
              sousTitre="Ce que nous nous engageons à tenir, et ce que nous tenons réellement."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Gravité', 'Première réponse engagée', 'Constatée', 'Résolution engagée', 'Constatée', 'Taux de respect'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { g: 'critique' as const, re: 30, rc: 14, se: 240, sc: 186, taux: 96 },
                    { g: 'majeure' as const, re: 120, rc: 62, se: 480, sc: 342, taux: 99 },
                    { g: 'mineure' as const, re: 480, rc: 188, se: 2880, sc: 1420, taux: 100 },
                    { g: 'question' as const, re: 1440, rc: 402, se: 5760, sc: 2180, taux: 100 },
                  ].map((x) => (
                    <tr key={x.g} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <Badge tone={TON_GRAVITE[x.g]} dot size="sm">
                          {LIBELLE_GRAVITE[x.g]}
                        </Badge>
                      </td>
                      <td className="tnum px-3 py-2.5 text-[11.5px] text-g-700">
                        {dureeMin(x.re)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={x.rc <= x.re ? 'ok' : 'warn'} size="sm">
                          {dureeMin(x.rc)}
                        </Badge>
                      </td>
                      <td className="tnum px-3 py-2.5 text-[11.5px] text-g-700">
                        {dureeMin(x.se)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={x.sc <= x.se ? 'ok' : 'warn'} size="sm">
                          {dureeMin(x.sc)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="relative block h-2 w-20 overflow-hidden rounded-full bg-g-100">
                            <span
                              className={cn(
                                'absolute inset-y-0 left-0 rounded-full',
                                x.taux === 100 ? 'bg-ok' : x.taux > 95 ? 'bg-p-600' : 'bg-warn',
                              )}
                              style={{ width: `${x.taux}%` }}
                            />
                          </span>
                          <span
                            className={cn(
                              'tnum text-[12px] font-bold',
                              x.taux === 100 ? 'text-ok' : 'text-ink',
                            )}
                          >
                            {pct(x.taux)}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout ton="warn" className="mt-4" titre="4 % des tickets critiques ont dépassé l’engagement">
              Deux tickets sur cinquante-deux, tous les deux ouverts un samedi soir. L’astreinte a
              répondu en trente-huit et quarante-quatre minutes au lieu de trente. Les avoirs
              correspondants ont été calculés et appliqués automatiquement — les clients n’ont rien eu
              à réclamer, et n’ont pas eu à s’apercevoir du dépassement.
            </Callout>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Règles de qualification"
                sousTitre="Ce qui détermine la gravité, et ce que nous nous interdisons."
              />
              <div className="space-y-2">
                {[
                  {
                    r: 'Le client déclare la gravité initiale',
                    d: 'Il connaît l’impact sur son activité mieux que nous. Nous partons de sa déclaration, pas de notre estimation.',
                  },
                  {
                    r: 'Nous ne rétrogradons pas en silence',
                    d: 'Si nous estimons qu’un ticket déclaré critique ne l’est pas, nous le disons au client et nous en discutons. Requalifier discrètement pour desserrer l’engagement serait tricher avec notre propre contrat.',
                  },
                  {
                    r: 'L’horloge est suspendue en attente client',
                    d: 'Et uniquement dans ce cas. Elle reprend dès que le client répond, y compris partiellement.',
                  },
                  {
                    r: 'Un dépassement déclenche un avoir automatique',
                    d: 'Calculé et appliqué sans réclamation du client. C’est à nous de constater notre propre manquement.',
                  },
                  {
                    r: 'Une escalade est toujours acceptée',
                    d: 'Un client qui demande une escalade l’obtient. Nous ne filtrons pas cette demande, même si nous pensons qu’elle n’est pas nécessaire.',
                  },
                ].map((x) => (
                  <div key={x.r} className="rounded-[6px] border border-p-300 bg-p-050 px-3 py-2.5">
                    <p className="text-[12.5px] font-semibold text-ink">{x.r}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">{x.d}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Escalades récentes"
                sousTitre="Une escalade n’est pas un échec : c’est le mécanisme prévu quand un ticket n’avance pas."
                actions={<ArrowUpRight size={15} className="text-p-700" />}
              />
              <Timeline
                evenements={[
                  {
                    id: '1',
                    titre: 'SYN-8814 escaladé au niveau 3',
                    detail: 'Latence non expliquée après 2 h de diagnostic — ingénieur plateforme mobilisé',
                    horodatage: dateHeure('2026-08-19T14:22:00Z'),
                    ton: 'warn',
                  },
                  {
                    id: '2',
                    titre: 'SYN-8791 escaladé à la demande du client',
                    detail: 'Le client a jugé la première réponse insuffisante — demande acceptée sans discussion',
                    horodatage: dateHeure('2026-08-18T09:41:00Z'),
                    ton: 'info',
                  },
                  {
                    id: '3',
                    titre: 'SYN-8752 escaladé automatiquement',
                    detail: 'Dépassement de 80 % du délai d’engagement sans première réponse',
                    horodatage: dateHeure('2026-08-16T22:14:00Z'),
                    ton: 'err',
                  },
                  {
                    id: '4',
                    titre: 'SYN-8710 résolu après escalade',
                    detail: 'Bogue confirmé dans notre orchestrateur — correctif déployé en 4 jours',
                    horodatage: dateHeure('2026-08-12T16:02:00Z'),
                    ton: 'ok',
                  },
                ]}
              />
              <Callout ton="violet" className="mt-4" titre="L’escalade automatique à 80 % du délai">
                Quand un ticket atteint 80 % de son délai d’engagement sans première réponse, il est
                escaladé automatiquement, sans intervention. C’est le garde-fou qui empêche un ticket de
                passer à travers les mailles un dimanche soir.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      <Drawer
        open={detail !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.numero} — ${detail.sujet}` : ''}
        size="lg"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TON_GRAVITE[detail.gravite]} dot>
                {LIBELLE_GRAVITE[detail.gravite]}
              </Badge>
              <Badge tone={TON_STATUT[detail.statut]} dot size="sm">
                {LIBELLE_STATUT[detail.statut]}
              </Badge>
              <Link
                href={`/admin/organisations/${detail.orgId}`}
                className="text-[12px] font-semibold text-p-700 hover:text-m-600"
              >
                {orgNom(detail.orgId)}
              </Link>
            </div>

            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Ouvert le', valeur: dateHeure(detail.createdAt) },
                { cle: 'Assigné à', valeur: detail.assigneA ?? 'Non assigné' },
                {
                  cle: 'Engagement de réponse',
                  valeur: dureeMin(detail.slaCible.premiereReponseMin),
                },
                {
                  cle: 'Engagement de résolution',
                  valeur: dureeMin(detail.slaCible.resolutionMin),
                },
                {
                  cle: 'Temps restant',
                  valeur:
                    detail.slaRestantMin !== undefined
                      ? dureeMin(detail.slaRestantMin)
                      : 'Engagement tenu',
                },
                { cle: 'Périmètre', valeur: detail.service ?? '—' },
              ]}
            />

            {detail.ressourcesLiees.length > 0 && (
              <div>
                <MicroLabel className="mb-1.5">Ressources liées</MicroLabel>
                <div className="flex flex-wrap gap-1">
                  {detail.ressourcesLiees.map((r) => (
                    <Badge key={r} tone="neutral" size="sm">
                      {r}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-g-500">
                  Leur contexte technique — métriques, journaux, emplacement d’exécution, déploiements
                  récents — est joint au ticket automatiquement. Consulter ces éléments ne demande
                  aucune élévation de privilège ; accéder au contenu des données du client, oui.
                </p>
              </div>
            )}

            <div>
              <MicroLabel className="mb-2">Échanges</MicroLabel>
              <div className="space-y-2.5">
                {detail.messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-[8px] border px-3 py-2.5',
                      m.role === 'synelia' ? 'border-p-300 bg-p-050' : 'border-g-300',
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[12px] font-bold text-ink">{m.auteur}</span>
                      <span className="text-[10.5px] text-g-500">{dateHeure(m.date)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-ink">
                      {m.contenu}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {!['resolu', 'ferme'].includes(detail.statut) && (
              <div>
                <MicroLabel className="mb-2">Répondre</MicroLabel>
                <MonoTextarea
                  rows={4}
                  placeholder="Votre réponse au client…"
                  value={reponse}
                  onChange={(e) => setReponse(e.target.value)}
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Button
                    disabled={reponse.trim().length === 0}
                    onClick={() =>
                      repondre(
                        detail,
                        'en_cours',
                        'Réponse envoyée',
                        'Le client est notifié. L’horloge de première réponse est arrêtée.',
                      )
                    }
                  >
                    Envoyer
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      repondre(
                        detail,
                        'attente_client',
                        `${detail.numero} passe en attente client`,
                        'L’horloge d’engagement est suspendue tant que le client n’a pas répondu. Elle repart à sa réponse.',
                      )
                    }
                  >
                    Marquer en attente client
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      repondre(
                        detail,
                        'resolu',
                        `${detail.numero} résolu`,
                        'Le client peut réouvrir le ticket pendant sept jours d’un simple message : la résolution est la nôtre, la clôture est la sienne.',
                      )
                    }
                  >
                    Résoudre
                  </Button>
                  <BoutonFormulaire
                    libelle="Escalader"
                    variant="ghost"
                    size="md"
                    icone={<ArrowUpRight size={12} />}
                    titre={`Escalader ${detail.numero}`}
                    description="Escalader ne fait pas avancer le ticket tout seul : cela change qui le porte et, sur un ticket critique, réveille l’astreinte. À utiliser quand la compétence manque, pas quand le temps manque."
                    libelleValider="Escalader"
                    champs={[
                      {
                        id: 'niveau',
                        label: 'Vers',
                        type: 'select',
                        options: [
                          { value: 'n2', label: 'Niveau 2 — expertise infrastructure' },
                          { value: 'n3', label: 'Niveau 3 — astreinte, réveil immédiat' },
                          { value: 'editeur', label: 'Éditeur de la solution amont' },
                        ],
                      },
                      {
                        id: 'motif',
                        label: 'Motif de l’escalade',
                        type: 'zone',
                        obligatoire: true,
                        placeholder:
                          'Comportement du répartiteur de charge non expliqué par les journaux ; la compétence réseau de niveau 2 est nécessaire pour aller plus loin.',
                      },
                    ]}
                    operation={(v) => ({
                      ton: 'warn',
                      titre: `${detail.numero} escaladé`,
                      detail:
                        v.niveau === 'n3'
                          ? 'L’astreinte est réveillée immédiatement, quelle que soit l’heure.'
                          : v.niveau === 'editeur'
                            ? 'Un dossier est ouvert chez l’éditeur amont, avec les journaux joints. Notre engagement continue de courir : le client n’a pas à subir le délai d’un tiers.'
                            : 'Le ticket entre dans la file du niveau 2, avec son historique complet.',
                      appel: async () => {
                        const niveau = String(v.niveau)
                        const note = `Escalade ${
                          niveau === 'n3'
                            ? 'niveau 3 (astreinte)'
                            : niveau === 'editeur'
                              ? 'vers l’éditeur amont'
                              : 'niveau 2'
                        } — ${String(v.motif)}`
                        await requete(`/admin/tickets/${encodeURIComponent(detail.id)}/messages`, {
                          methode: 'POST',
                          corps: { contenu: note },
                        })
                        await modifierRessource('/admin/tickets', detail.id, {
                          gravite: niveau === 'n3' ? 'critique' : undefined,
                          assigneA: niveau === 'n3' ? (EQUIPE_LUE[3]?.nom ?? detail.assigneA) : undefined,
                        })
                      },
                      effet: () =>
                        tickets.modifier(detail.id, (courant) => ({
                          gravite: v.niveau === 'n3' ? 'critique' : courant.gravite,
                          assigneA: v.niveau === 'n3' ? EQUIPE_SYNELIA[3].nom : courant.assigneA,
                          messages: [
                            ...courant.messages,
                            {
                              auteur: EQUIPE_SYNELIA[0].nom,
                              role: 'synelia' as const,
                              date: MAINTENANT,
                              contenu: `Escalade ${
                                v.niveau === 'n3'
                                  ? 'niveau 3 (astreinte)'
                                  : v.niveau === 'editeur'
                                    ? 'vers l’éditeur amont'
                                    : 'niveau 2'
                              } — ${String(v.motif)}`,
                            },
                          ],
                        })),
                      effetFinal: () => tickets.recharger(),
                    })}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={assignation !== null}
        onClose={() => setAssignationId(null)}
        title={`Assigner ${assignation?.numero ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignationId(null)}>
              Annuler
            </Button>
            <Button
              disabled={!intervenant}
              onClick={() => {
                if (!assignation) return
                executer({
                  ton: 'ok',
                  titre: `${assignation.numero} assigné à ${intervenant}`,
                  detail: notifierIntervenant
                    ? 'L’intervenant est notifié et le ticket apparaît dans sa file.'
                    : 'Le ticket apparaît dans sa file, sans notification : il faut le lui dire de vive voix.',
                  appel: () =>
                    modifierRessource('/admin/tickets', assignation.id, {
                      assigneA: intervenant,
                      statut:
                        assignation.statut === 'ouvert' ? 'en_cours' : assignation.statut,
                    }),
                  effet: () =>
                    tickets.modifier(assignation.id, {
                      assigneA: intervenant,
                      statut: assignation.statut === 'ouvert' ? 'en_cours' : assignation.statut,
                    }),
                  effetFinal: () => tickets.recharger(),
                })
                setIntervenant('')
                setAssignationId(null)
              }}
            >
              Assigner
            </Button>
          </>
        }
      >
        {assignation && (
          <div className="space-y-4">
            <div className="rounded-[6px] border border-g-300 px-3 py-2.5">
              <p className="text-[12.5px] font-semibold text-ink">{assignation.sujet}</p>
              <p className="mt-0.5 text-[11px] text-g-500">
                {orgNom(assignation.orgId)} · {LIBELLE_GRAVITE[assignation.gravite]} ·{' '}
                {assignation.slaRestantMin !== undefined
                  ? `${dureeMin(assignation.slaRestantMin)} restantes`
                  : 'sans engagement en cours'}
              </p>
            </div>
            <Field label="Intervenant" hint="la charge actuelle est indiquée pour chacun" required>
              <Select value={intervenant} onChange={(e) => setIntervenant(e.target.value)}>
                <option value="">Sélectionner…</option>
                {EQUIPE_LUE.map((m) => {
                  const siens = ouverts.filter((t) => t.assigneA === m.nom).length
                  return (
                    <option key={m.id} value={m.nom}>
                      {m.nom} — {m.equipe} · {siens} ticket{siens > 1 ? 's' : ''} en cours
                    </option>
                  )
                })}
              </Select>
            </Field>
            <div className="space-y-3">
              <Switch
                checked={notifierIntervenant}
                onChange={setNotifierIntervenant}
                label="Notifier l’intervenant"
                description="Courriel immédiat, plus un SMS si le ticket est critique."
              />
              <Switch
                checked={notifierResponsable || assignation.gravite === 'critique'}
                onChange={setNotifierResponsable}
                disabled={assignation.gravite === 'critique'}
                label="Notifier le responsable d’équipe"
                description="Systématique sur un ticket critique : il doit savoir qui porte quoi à tout moment."
              />
            </div>
            {assignation.gravite === 'critique' && (
              <Callout ton="warn" titre="Ticket critique">
                <span className="inline-flex items-start gap-1.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  L’engagement de première réponse est de trente minutes, astreinte comprise. Assignez à
                  quelqu’un qui est effectivement disponible maintenant, pas à celui dont c’est le
                  périmètre en théorie.
                </span>
              </Callout>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
