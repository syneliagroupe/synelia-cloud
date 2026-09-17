'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, Paperclip, Send, Shield } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { MAINTENANT, dateHeure, dureeMin, relatif } from '@/lib/format'
import {
  EVENEMENTS_SUPERVISION,
  LOGS_EXECUTION,
  TICKETS,
  UTILISATEUR_COURANT,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Avatar, Tabs } from '@/components/ui/display'
import { Field, MonoTextarea, Select, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { StatTile } from '@/components/composition/metrics'
import { Timeline } from '@/components/composition/flow'
import { EventList, GrilleSparkCharts, LogPeek } from '@/components/business/observabilite'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, useOperation } from '@/components/app/actions'
import { creerRessource, modifierRessource } from '@/lib/api/client'
import type { Ticket } from '@/lib/types'
import { useMaintenant } from '@/components/app/contexte'

const LIBELLE_STATUT: Record<Ticket['statut'], string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours de traitement',
  attente_client: 'Attente de votre réponse',
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

const ONGLETS = [
  { id: 'echanges', label: 'Échanges' },
  { id: 'contexte', label: 'Contexte technique joint' },
  { id: 'chronologie', label: 'Chronologie' },
]

export function VueTicket({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const executer = useOperation()
  const tickets = useCollection<Ticket>('tickets', TICKETS)
  const [onglet, setOnglet] = useState('echanges')
  const [reponse, setReponse] = useState('')
  const [lectureContexte, setLectureContexte] = useState(true)
  const [interventionAutorisee, setInterventionAutorisee] = useState(false)

  const t = tickets.items.find((x) => x.id === id)

  if (!t) {
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Support', href: '/app/support' },
            { label: 'Introuvable' },
          ]}
          titre="Ticket introuvable"
        />
        <EmptyState
          titre="Ce ticket n’existe pas ou plus"
          phrase="Il a peut-être été fermé depuis plus de trente-six mois, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: 'Retour au support', href: '/app/support' }}
        />
      </div>
    )
  }

  const ouvert = !['resolu', 'ferme'].includes(t.statut)

  const premiereReponse = t.messages.find((m) => m.role === 'synelia')
  const delaiPremiereReponse = premiereReponse
    ? Math.round(
        (new Date(premiereReponse.date).getTime() - new Date(t.createdAt).getTime()) / 60000,
      )
    : undefined

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Support', href: '/app/support' },
          { label: t.numero },
        ]}
        titre={t.sujet}
        sousTitre={`Ticket ${t.numero} ouvert le ${dateHeure(t.createdAt)}${t.assigneA ? ` · pris en charge par ${t.assigneA}` : ''}`}
        meta={
          <>
            <Badge tone={TON_GRAVITE[t.gravite]} dot size="sm">
              {LIBELLE_GRAVITE[t.gravite]}
            </Badge>
            <Badge tone={TON_STATUT[t.statut]} dot size="sm">
              {LIBELLE_STATUT[t.statut]}
            </Badge>
            {t.service && (
              <Badge tone="neutral" size="sm">
                {t.service}
              </Badge>
            )}
          </>
        }
        actions={
          ouvert ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  executer({
                    titre: 'Ticket marqué comme résolu',
                    detail: 'Il reste consultable et peut être réouvert pendant sept jours.',
                    appel: () => modifierRessource('/support/tickets', t.id, { statut: 'resolu' }),
                    effet: () => tickets.modifier(t.id, { statut: 'resolu', slaRestantMin: undefined }),
                    effetFinal: () => tickets.recharger(),
                  })
                }
              >
                Marquer comme résolu
              </Button>
              <BoutonAction
                libelle="Demander une escalade"
                variant="ghost"
                size="md"
                operation={{
                  ton: 'warn',
                  titre: 'Escalade demandée',
                  detail:
                    'Le responsable d’astreinte est notifié et reprend le ticket. L’engagement de résolution ne change pas : c’est le niveau d’attention qui change.',
                  appel: () =>
                    creerRessource(`/support/tickets/${encodeURIComponent(t.id)}/escalade`, {
                      motif: 'Escalade demandée depuis le portail',
                    }),
                  effet: () => tickets.modifier(t.id, { statut: 'en_cours' }),
                  effetFinal: () => tickets.recharger(),
                }}
              />
            </>
          ) : (
            <BoutonAction
              libelle="Réouvrir le ticket"
              size="md"
              operation={{
                ton: 'info',
                titre: `Ticket ${t.numero} réouvert`,
                detail: 'L’équipe qui l’avait traité est notifiée en priorité.',
                appel: () => modifierRessource('/support/tickets', t.id, { statut: 'ouvert' }),
                effet: () => tickets.modifier(t.id, { statut: 'ouvert' }),
                effetFinal: () => tickets.recharger(),
              }}
            />
          )
        }
      />

      {t.gravite === 'critique' && ouvert && (
        <Callout ton="err" titre="Ticket critique — astreinte mobilisée">
          Un ticket critique déclenche notre astreinte, quelle que soit l’heure. L’engagement de
          première réponse est de 30 minutes et celui de résolution de{' '}
          {dureeMin(t.slaCible.resolutionMin)}.{' '}
          {t.slaRestantMin !== undefined
            ? `Il reste ${dureeMin(t.slaRestantMin)} sur l’engagement de résolution.`
            : ''}
        </Callout>
      )}

      {t.statut === 'attente_client' && (
        <Callout ton="warn" titre="Nous attendons votre réponse">
          L’horloge de l’engagement est suspendue tant que nous attendons une information de votre
          part. Répondez ci-dessous, même partiellement : une réponse incomplète nous permet souvent
          d’avancer, alors qu’un silence nous bloque.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Première réponse"
          valeur={delaiPremiereReponse !== undefined ? dureeMin(delaiPremiereReponse) : '—'}
          ton={
            delaiPremiereReponse !== undefined &&
            delaiPremiereReponse <= t.slaCible.premiereReponseMin
              ? 'ok'
              : 'warn'
          }
          detail={`Engagement : ${dureeMin(t.slaCible.premiereReponseMin)}`}
        />
        <StatTile
          libelle="Engagement de résolution"
          valeur={dureeMin(t.slaCible.resolutionMin)}
          detail={
            t.slaRestantMin !== undefined
              ? `${dureeMin(t.slaRestantMin)} restantes`
              : 'Engagement tenu'
          }
          ton={
            t.slaRestantMin === undefined
              ? 'ok'
              : t.slaRestantMin < 60
                ? 'err'
                : t.slaRestantMin < 240
                  ? 'warn'
                  : 'violet'
          }
        />
        <StatTile libelle="Échanges" valeur={t.messages.length} detail="Messages sur ce ticket" />
        <StatTile
          libelle="Ressources liées"
          valeur={t.ressourcesLiees.length}
          detail={
            t.ressourcesLiees.length > 0
              ? 'Contexte technique joint automatiquement'
              : 'Aucune ressource rattachée'
          }
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'echanges' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {t.messages.map((m, i) => (
              <Card
                key={i}
                className={cn(m.role === 'synelia' ? 'border-p-300 bg-p-050' : '')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar nom={m.auteur} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-bold text-ink">{m.auteur}</span>
                      <span className="block text-[11px] text-g-500">
                        {m.role === 'synelia' ? 'Équipe Synelia Cloud' : ORG_LABEL}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] text-g-700">{dateHeure(m.date)}</span>
                    <span className="block text-[10px] text-g-500">{relatif(m.date, maintenant)}</span>
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                  {m.contenu}
                </p>
                {m.pieces && m.pieces.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-g-100 pt-3">
                    {m.pieces.map((p) => (
                      <span
                        key={p}
                        className="flex items-center gap-1.5 rounded-[5px] border border-g-300 bg-white px-2 py-1 font-mono text-[10.5px] text-ink"
                      >
                        <Paperclip size={10} className="text-g-500" />
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}

            {ouvert && (
              <Card>
                <CardHeader
                  titre="Répondre"
                  sousTitre="Votre réponse relance l’horloge de l’engagement si le ticket était en attente."
                />
                <MonoTextarea
                  rows={5}
                  value={reponse}
                  onChange={(e) => setReponse(e.target.value)}
                  placeholder="Décrivez ce que vous observez, ou répondez à la question posée…"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <BoutonAction
                      libelle="Joindre un fichier"
                      variant="ghost"
                      icone={<Paperclip size={12} />}
                      operation={{
                        ton: 'info',
                        titre: 'Pièce jointe ajoutée à la réponse',
                        detail: 'Captures, extraits de journaux et traces sont acceptés jusqu’à 25 Mo.',
                      }}
                    />
                    <BoutonAction
                      libelle="Joindre les journaux récents"
                      variant="ghost"
                      operation={{
                        ton: 'info',
                        titre: 'Journaux joints',
                        detail: `Vingt dernières lignes des ressources liées${t.ressourcesLiees.length ? ` (${t.ressourcesLiees.join(', ')})` : ''}, plus les métriques des deux dernières heures.`,
                      }}
                    />
                  </div>
                  <Button
                    iconBefore={<Send size={13} />}
                    disabled={reponse.trim().length === 0}
                    onClick={() => {
                      executer({
                        titre: 'Réponse envoyée',
                        detail: `L’équipe est notifiée. Engagement de réponse : ${dureeMin(t.slaCible.premiereReponseMin)}.`,
                        appel: () =>
                          creerRessource(`/support/tickets/${encodeURIComponent(t.id)}/messages`, {
                            contenu: reponse,
                          }),
                        effet: () =>
                          tickets.modifier(t.id, (x) => ({
                            statut: 'en_cours',
                            messages: [
                              ...x.messages,
                              {
                                auteur: UTILISATEUR_COURANT.nom,
                                role: 'client' as const,
                                date: MAINTENANT,
                                contenu: reponse,
                              },
                            ],
                          })),
                        effetFinal: () => tickets.recharger(),
                      })
                      setReponse('')
                    }}
                  >
                    Envoyer
                  </Button>
                </div>
              </Card>
            )}

            {!ouvert && (
              <Card>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 text-ok" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">
                      Ce ticket est {t.statut === 'resolu' ? 'résolu' : 'fermé'}
                    </p>
                    <p className="text-[11.5px] text-g-500">
                      Il reste consultable indéfiniment. Une réouverture est possible pendant sept
                      jours ; au-delà, ouvrez un nouveau ticket en le référençant.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader titre="Informations" />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Numéro', valeur: t.numero },
                  { cle: 'Gravité', valeur: LIBELLE_GRAVITE[t.gravite] },
                  { cle: 'Statut', valeur: LIBELLE_STATUT[t.statut] },
                  { cle: 'Ouvert le', valeur: dateHeure(t.createdAt) },
                  { cle: 'Assigné à', valeur: t.assigneA ?? 'En attente d’assignation' },
                  { cle: 'Service concerné', valeur: t.service ?? '—' },
                  {
                    cle: 'Engagement de réponse',
                    valeur: dureeMin(t.slaCible.premiereReponseMin),
                  },
                  {
                    cle: 'Engagement de résolution',
                    valeur: dureeMin(t.slaCible.resolutionMin),
                  },
                ]}
              />
            </Card>

            {t.ressourcesLiees.length > 0 && (
              <Card>
                <CardHeader
                  titre="Ressources liées"
                  sousTitre="Leur contexte technique est joint au ticket."
                />
                <div className="space-y-1.5">
                  {t.ressourcesLiees.map((r) => (
                    <div
                      key={r}
                      className="flex items-center justify-between gap-2 rounded-[5px] border border-g-300 px-2.5 py-1.5"
                    >
                      <span className="min-w-0 truncate font-mono text-[11.5px] text-ink">{r}</span>
                      <Button size="sm" variant="ghost" onClick={() => setOnglet('contexte')}>
                        Voir
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader titre="Accès de nos équipes" sousTitre="Ce que le support peut voir et faire." />
              <div className="space-y-3">
                <Switch
                  checked={lectureContexte}
                  onChange={(v) =>
                    executer({
                      ton: v ? 'ok' : 'warn',
                      titre: v
                        ? 'Lecture du contexte technique autorisée'
                        : 'Lecture du contexte technique retirée',
                      detail: v
                        ? undefined
                        : 'Sans ce contexte, le diagnostic prendra plus longtemps : il faudra vous demander chaque élément.',
                      effet: () => setLectureContexte(v),
                    })
                  }
                  label="Lecture du contexte technique"
                  description="Métriques, journaux, emplacement d’exécution, historique des déploiements des ressources liées à ce ticket."
                />
                <Switch
                  checked={interventionAutorisee}
                  onChange={(v) =>
                    executer({
                      ton: v ? 'warn' : 'info',
                      titre: v
                        ? 'Intervention autorisée pour 4 heures'
                        : 'Autorisation d’intervention retirée',
                      detail: v
                        ? 'Accès nominatif, limité à 4 heures, chaque action journalisée dans votre audit.'
                        : undefined,
                      effet: () => setInterventionAutorisee(v),
                    })
                  }
                  label="Autoriser une intervention sur mes ressources"
                  description="À n’accorder que si nous vous le demandons. L’accès est nominatif, limité à 4 heures, et chaque action est journalisée dans votre audit."
                />
              </div>
              <Callout ton="violet" className="mt-4" titre="Élévation visible et bornée">
                <span className="inline-flex items-start gap-1.5">
                  <Shield size={13} className="mt-0.5 shrink-0" />
                  Aucun membre de nos équipes n’a d’accès permanent à vos ressources. Quand une
                  intervention est nécessaire, elle est demandée, autorisée par vous, limitée dans le
                  temps, et visible dans votre journal d’audit avec le nom de l’intervenant.
                </span>
              </Callout>
              <ButtonLink size="sm" variant="ghost" className="mt-3" href="/app/securite">
                Voir le journal d’audit
              </ButtonLink>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'contexte' && (
        <div className="space-y-4">
          <Callout ton="info" titre="Joint automatiquement à l’ouverture du ticket">
            Vous n’avez rien copié-collé : dès qu’une ressource est rattachée à un ticket, nous
            joignons son emplacement réel d’exécution, ses métriques des deux dernières heures, ses
            derniers journaux, ses déploiements récents et les événements de supervision associés.
            C’est ce qui permet à la première réponse d’être un diagnostic plutôt qu’une demande de
            précisions.
          </Callout>

          <Card>
            <CardHeader
              titre="Métriques au moment de l’ouverture"
              sousTitre={`Fenêtre de deux heures autour du ${dateHeure(t.createdAt)}`}
            />
            <GrilleSparkCharts
              seed={`ticket-${t.id}`}
              metriques={[
                { titre: 'Charge processeur', unite: '%', min: 42, max: 96, seuil: 85 },
                { titre: 'Mémoire utilisée', unite: '%', min: 58, max: 92, seuil: 90 },
                {
                  titre: 'Latence 95e centile',
                  unite: 'ms',
                  min: 180,
                  max: 6200,
                  seuil: 500,
                  couleur: 'var(--color-err)',
                },
                { titre: 'Requêtes par seconde', unite: 'req/s', min: 120, max: 640 },
              ]}
            />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Journaux joints"
                sousTitre="Vingt lignes autour de l’instant signalé."
              />
              <LogPeek
                lignes={LOGS_EXECUTION}
                max={20}
                titre={t.ressourcesLiees[0] ?? 'Ressource concernée'}
                hrefSortie="https://logs.synelia.cloud/select/vmui"
              />
            </Card>

            <Card>
              <CardHeader
                titre="Événements de supervision corrélés"
                sousTitre="Sur les ressources liées, dans la fenêtre du ticket."
              />
              <EventList
                evenements={EVENEMENTS_SUPERVISION}
                max={6}
                lienSortie="Ouvrir dans Centreon"
                hrefSortie="https://centreon.synelia.cloud/monitoring/resources"
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Emplacement réel d’exécution"
              sousTitre="Là où tournent les ressources concernées, au moment de l’ouverture."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Ressource', 'Socle technique', 'Hôte / namespace', 'Site physique', 'État'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {t.ressourcesLiees.map((r, i) => (
                    <tr key={r} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-[11.5px] font-semibold text-ink">{r}</td>
                      <td className="px-3 py-2 text-[11.5px] text-g-700">
                        {i % 2 === 0 ? 'OpenStack · OS-ABJ-01' : 'Kubernetes · k8s-dba-prod'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-g-500">
                        {i % 2 === 0 ? `hv-abj-0${(i % 4) + 1}` : `ns/org-dba-prod`}
                      </td>
                      <td className="px-3 py-2 text-[11.5px] text-g-700">Abidjan · ABJ-1</td>
                      <td className="px-3 py-2">
                        <Badge tone={i === 0 ? 'warn' : 'ok'} dot size="sm">
                          {i === 0 ? 'Dégradé' : 'Sain'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {t.ressourcesLiees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-g-500">
                        Aucune ressource rattachée à ce ticket.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {onglet === 'chronologie' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Chronologie du ticket"
              sousTitre="Chaque changement d’état, chaque message, chaque assignation."
            />
            <Timeline
              evenements={[
                {
                  id: 'open',
                  titre: `Ticket ouvert — gravité ${LIBELLE_GRAVITE[t.gravite].toLowerCase()}`,
                  detail: `Par ${t.messages[0]?.auteur ?? 'un membre de votre organisation'} · contexte technique joint automatiquement`,
                  horodatage: dateHeure(t.createdAt),
                  ton: 'info',
                },
                ...(t.assigneA
                  ? [
                      {
                        id: 'assign',
                        titre: `Assigné à ${t.assigneA}`,
                        detail:
                          t.gravite === 'critique'
                            ? 'Astreinte mobilisée hors heures ouvrées'
                            : 'Prise en charge en heures ouvrées',
                        horodatage: dateHeure(t.createdAt),
                        ton: 'neutral' as const,
                      },
                    ]
                  : []),
                ...t.messages.slice(1).map((m, i) => ({
                  id: `msg-${i}`,
                  titre:
                    m.role === 'synelia'
                      ? `Réponse de ${m.auteur}`
                      : `Message de ${m.auteur}`,
                  detail: m.contenu.slice(0, 120) + (m.contenu.length > 120 ? '…' : ''),
                  horodatage: dateHeure(m.date),
                  ton: (m.role === 'synelia' ? 'ok' : 'neutral') as 'ok' | 'neutral',
                })),
                ...(t.statut === 'resolu' || t.statut === 'ferme'
                  ? [
                      {
                        id: 'close',
                        titre: t.statut === 'resolu' ? 'Marqué comme résolu' : 'Ticket fermé',
                        detail: 'Réouverture possible pendant sept jours',
                        horodatage: dateHeure(t.messages[t.messages.length - 1]?.date ?? t.createdAt),
                        ton: 'ok' as const,
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Respect des engagements"
                sousTitre="Mesuré sur ce ticket, pas en moyenne."
              />
              <div className="space-y-2">
                <div
                  className={cn(
                    'rounded-[6px] border px-3 py-2.5',
                    delaiPremiereReponse !== undefined &&
                      delaiPremiereReponse <= t.slaCible.premiereReponseMin
                      ? 'border-ok/40 bg-ok-bg'
                      : 'border-warn/40 bg-warn-bg',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-ink">Première réponse</span>
                    <Badge
                      tone={
                        delaiPremiereReponse !== undefined &&
                        delaiPremiereReponse <= t.slaCible.premiereReponseMin
                          ? 'ok'
                          : 'warn'
                      }
                      size="sm"
                    >
                      {delaiPremiereReponse !== undefined
                        ? `${dureeMin(delaiPremiereReponse)} / ${dureeMin(t.slaCible.premiereReponseMin)}`
                        : 'En attente'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-g-700">
                    Le délai est mesuré entre l’ouverture du ticket et le premier message de nos
                    équipes qui n’est pas un accusé de réception automatique.
                  </p>
                </div>

                <div className="rounded-[6px] border border-g-300 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                      <Clock size={12} className="text-g-500" />
                      Résolution
                    </span>
                    <Badge tone={t.slaRestantMin === undefined ? 'ok' : 'info'} size="sm">
                      {t.slaRestantMin !== undefined
                        ? `${dureeMin(t.slaRestantMin)} restantes`
                        : 'Tenue'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-g-700">
                    L’horloge est suspendue pendant les périodes d’attente de votre réponse. Elle
                    reprend dès que vous répondez.
                  </p>
                </div>
              </div>
              <Callout ton="info" className="mt-4" titre="Si l’engagement n’est pas tenu">
                Un dépassement sur un ticket critique ouvre droit à un avoir, calculé automatiquement
                et visible dans l’onglet Engagements de service. Vous n’avez pas à le réclamer.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Tickets voisins"
                sousTitre="Sur les mêmes ressources, ou avec un symptôme proche."
              />
              <div className="space-y-1.5">
                {tickets.items
                  .filter(
                    (x) =>
                      x.id !== t.id &&
                      (x.service === t.service ||
                        x.ressourcesLiees.some((r) => t.ressourcesLiees.includes(r))),
                  )
                  .slice(0, 4)
                  .map((x) => (
                    <Link
                      key={x.id}
                      href={`/app/support/${x.id}`}
                      className="block rounded-[6px] border border-g-300 px-3 py-2 transition-colors hover:border-p-400"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] font-semibold text-ink">
                          {x.sujet}
                        </span>
                        <Badge tone={TON_STATUT[x.statut]} size="sm">
                          {LIBELLE_STATUT[x.statut]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[10.5px] text-g-500">
                        {x.numero} · {relatif(x.createdAt, maintenant)}
                      </p>
                    </Link>
                  ))}
              </div>
              {tickets.items.filter(
                (x) =>
                  x.id !== t.id &&
                  (x.service === t.service ||
                    x.ressourcesLiees.some((r) => t.ressourcesLiees.includes(r))),
              ).length === 0 && (
                <p className="rounded-[6px] border border-dashed border-g-300 px-3 py-4 text-center text-[12px] text-g-500">
                  Aucun ticket voisin. Ce symptôme est isolé.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

const ORG_LABEL = 'Votre organisation'
