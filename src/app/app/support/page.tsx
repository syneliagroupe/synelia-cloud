'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, MessageSquarePlus, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateCourte, dureeMin, money, pct, relatif } from '@/lib/format'
import {
  ARTICLES_KB,
  CREDITS_SLA,
  ENGAGEMENTS_SLA,
  ORG_COURANTE,
  TICKETS,
  UTILISATEUR_COURANT,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { GaugeCircle, StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'
import type { Ticket } from '@/lib/types'

interface EngagementSlaApi {
  composant: string
  dispo: number
  constate: number
  reponseCritique: number
  resolutionCritique: number
}

interface CreditSlaApi {
  periode: string
  composant: string
  dispoConstatee: number
  engagement: number
  credit: number
  statut: string
}

const LIBELLE_COMPOSANT_SLA: Record<string, string> = {
  compute: 'Espace Cloud (calcul)',
  stockage: 'Stockage',
  reseau: 'Réseau & IP',
}

const ONGLETS = [
  { id: 'tickets', label: 'Mes tickets' },
  { id: 'sla', label: 'Engagements de service' },
  { id: 'connaissances', label: 'Base de connaissances' },
  { id: 'contact', label: 'Nous joindre' },
]

const LIBELLE_STATUT: Record<Ticket['statut'], string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
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

export default function Support() {
  const maintenant = useMaintenant()
  const { autorise, refus, pousser, organisations, organisationId } = useApp()
  const orgActive = organisations.find((o) => o.id === organisationId) ?? organisations[0]
  const nomOrg = orgActive?.nom ?? ORG_COURANTE.nom
  const [onglet, setOnglet] = useState('tickets')
  const [nouveau, setNouveau] = useState(false)
  const [sujet, setSujet] = useState('')
  const [gravite, setGravite] = useState<Ticket['gravite']>('majeure')
  const [ressource, setRessource] = useState('')
  const [description, setDescription] = useState('')
  const [theme, setTheme] = useState('tous')

  const executer = useOperation()
  const collection = useCollection<Ticket>('tickets', TICKETS)
  // Le backend filtre déjà par organisation ; ORG_COURANTE.id est un
  // identifiant de la graine fictive, inconnu de l'API réelle — filtrer avec
  // en mode API viderait la liste au lieu de la restreindre.
  const tickets = estActif()
    ? collection.items
    : collection.items.filter((t) => t.orgId === ORG_COURANTE.id)
  const ouverts = tickets.filter((t) => !['resolu', 'ferme'].includes(t.statut))
  const enAttente = tickets.filter((t) => t.statut === 'attente_client')
  const critique = ouverts.find((t) => t.gravite === 'critique')

  const themes = ['tous', ...new Set(ARTICLES_KB.map((a) => a.theme))]
  const articles = theme === 'tous' ? ARTICLES_KB : ARTICLES_KB.filter((a) => a.theme === theme)

  // Premières réponses réelles : premier message d'un agent Synelia après
  // l'ouverture du ticket, médiane sur les tickets qui en ont déjà une.
  const reponses = tickets
    .map((t) => {
      const premiere = t.messages.find((m) => m.role === 'synelia')
      if (!premiere) return undefined
      return (new Date(premiere.date).getTime() - new Date(t.createdAt).getTime()) / 60000
    })
    .filter((v): v is number => v !== undefined && v >= 0)
    .sort((a, b) => a - b)
  const reponseMedianeMin = reponses.length ? reponses[Math.floor((reponses.length - 1) / 2)] : undefined

  const { donnees: slaDistant } = useLectureDegradable<{
    engagements: EngagementSlaApi[]
    credits: CreditSlaApi[]
  }>('/facturation/sla')
  const engagementsSla = estActif() ? (slaDistant?.engagements ?? []) : ENGAGEMENTS_SLA
  const creditsSla = estActif() ? (slaDistant?.credits ?? []) : CREDITS_SLA
  const disponibiliteConstatee = engagementsSla.length
    ? engagementsSla.reduce((a, e) => a + e.constate, 0) / engagementsSla.length
    : undefined

  const creditsEnAttente = creditsSla.filter((c) => c.statut !== 'appliqué')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Support' }]}
        titre="Support"
        sousTitre="Des humains à Abidjan, sur le même fuseau horaire que vous, qui connaissent votre infrastructure parce qu’ils l’exploitent. Le ticket porte les ressources concernées : nul besoin d’expliquer votre architecture à chaque fois."
        actions={
          <Button iconBefore={<MessageSquarePlus size={14} />} onClick={() => setNouveau(true)}>
            Ouvrir un ticket
          </Button>
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {nomOrg}
            </Badge>
            <Badge tone="ok" dot size="sm">
              Support ouvert · 8 h – 19 h GMT
            </Badge>
            <Badge tone="neutral" size="sm">
              Astreinte 24/7 sur incident critique
            </Badge>
          </>
        }
      />

      {critique && (
        <Callout ton="err" titre={`Un ticket critique est en cours : ${critique.sujet}`}>
          Assigné à {critique.assigneA ?? 'notre équipe d’astreinte'}
          {critique.slaRestantMin !== undefined
            ? ` · ${dureeMin(critique.slaRestantMin)} restantes sur l’engagement de résolution`
            : ''}
          . Si la situation évolue de votre côté, ajoutez-le au ticket plutôt que d’en ouvrir un
          second : le contexte reste au même endroit.
        </Callout>
      )}

      {enAttente.length > 0 && (
        <Callout ton="warn" titre={`${enAttente.length} ticket attend une réponse de votre part`}>
          Nous avons posé une question et nous attendons votre retour pour avancer. Un ticket en
          attente de votre réponse n’avance pas, et son horloge d’engagement est suspendue.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Tickets ouverts"
          valeur={ouverts.length}
          ton={ouverts.length > 0 ? 'info' : 'ok'}
          detail={critique ? '1 critique en cours' : 'Aucun critique'}
        />
        <StatTile
          libelle="Première réponse médiane"
          valeur={reponseMedianeMin !== undefined ? dureeMin(Math.round(reponseMedianeMin)) : '—'}
          ton="ok"
          detail="Engagement : 30 min sur critique"
        />
        <StatTile
          libelle="Disponibilité constatée 30 j"
          valeur={disponibiliteConstatee !== undefined ? pct(disponibiliteConstatee, 2) : '—'}
          ton="ok"
          detail="Engagement contractuel 99,9 %"
        />
        <StatTile
          libelle="Avoirs de service"
          valeur={money(creditsSla.reduce((a, c) => a + c.credit, 0))}
          ton={creditsEnAttente.length > 0 ? 'warn' : 'neutral'}
          detail={
            creditsEnAttente.length > 0
              ? `${creditsEnAttente.length} en cours de calcul`
              : 'Tous appliqués'
          }
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'tickets' && (
        <Card padding={false}>
          <div className="p-4">
            <DataTable<Ticket>
              lignes={tickets}
              exportable
              placeholderRecherche="Rechercher un ticket…"
              filtres={[
                {
                  id: 'statut',
                  libelle: 'Statut',
                  options: [
                    { value: 'tous', label: 'Tous les statuts' },
                    { value: 'ouvert', label: 'Ouvert' },
                    { value: 'en_cours', label: 'En cours' },
                    { value: 'attente_client', label: 'Attente de votre réponse' },
                    { value: 'resolu', label: 'Résolu' },
                    { value: 'ferme', label: 'Fermé' },
                  ],
                },
                {
                  id: 'gravite',
                  libelle: 'Gravité',
                  options: [
                    { value: 'tous', label: 'Toutes les gravités' },
                    { value: 'critique', label: 'Critique' },
                    { value: 'majeure', label: 'Majeure' },
                    { value: 'mineure', label: 'Mineure' },
                    { value: 'question', label: 'Question' },
                  ],
                },
              ]}
              selection={(l, fid, val) =>
                fid === 'statut' ? l.statut === val : fid === 'gravite' ? l.gravite === val : true
              }
              href={(t) => `/app/support/${t.id}`}
              colonnes={[
                {
                  id: 'numero',
                  entete: 'Ticket',
                  cle: (t) => `${t.numero} ${t.sujet}`,
                  rendu: (t) => (
                    <span className="block min-w-0">
                      <span className="block font-mono text-[11px] text-g-500">{t.numero}</span>
                      <span className="block truncate text-[12.5px] font-semibold text-ink">
                        {t.sujet}
                      </span>
                    </span>
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
                  id: 'ressources',
                  entete: 'Ressources liées',
                  cle: (t) => t.ressourcesLiees.join(' '),
                  masquable: true,
                  rendu: (t) =>
                    t.ressourcesLiees.length === 0 ? (
                      <span className="text-[11.5px] text-g-500">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {t.ressourcesLiees.slice(0, 2).map((r) => (
                          <Badge key={r} tone="neutral" size="sm">
                            {r}
                          </Badge>
                        ))}
                        {t.ressourcesLiees.length > 2 && (
                          <Badge tone="neutral" size="sm">
                            +{t.ressourcesLiees.length - 2}
                          </Badge>
                        )}
                      </span>
                    ),
                },
                {
                  id: 'sla',
                  entete: 'Engagement',
                  aligne: 'right',
                  cle: (t) => t.slaRestantMin ?? 99999,
                  rendu: (t) =>
                    t.slaRestantMin === undefined ? (
                      <span className="text-[11.5px] text-g-500">—</span>
                    ) : (
                      <span
                        className={cn(
                          'tnum text-[12px] font-semibold',
                          t.slaRestantMin < 60 ? 'text-err' : t.slaRestantMin < 240 ? 'text-warn' : 'text-g-700',
                        )}
                      >
                        {dureeMin(t.slaRestantMin)}
                        <span className="block text-[10px] font-normal text-g-500">restantes</span>
                      </span>
                    ),
                },
                {
                  id: 'assigne',
                  entete: 'Assigné à',
                  cle: (t) => t.assigneA ?? '',
                  masquable: true,
                  rendu: (t) => (
                    <span className="text-[11.5px] text-g-700">{t.assigneA ?? 'Non assigné'}</span>
                  ),
                },
                {
                  id: 'messages',
                  entete: 'Échanges',
                  aligne: 'center',
                  cle: (t) => t.messages.length,
                  rendu: (t) => (
                    <span className="tnum text-[12px] text-g-700">{t.messages.length}</span>
                  ),
                },
                {
                  id: 'cree',
                  entete: 'Ouvert',
                  aligne: 'right',
                  cle: (t) => t.createdAt,
                  rendu: (t) => (
                    <span className="text-[11.5px] text-g-500">{relatif(t.createdAt, maintenant)}</span>
                  ),
                },
              ]}
              vide={{
                titre: 'Aucun ticket',
                phrase:
                  'Vous n’avez ouvert aucun ticket. C’est plutôt bon signe — mais si quelque chose vous bloque, un ticket est toujours plus efficace qu’un doute silencieux.',
              }}
            />
          </div>
        </Card>
      )}

      {onglet === 'sla' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader titre="Disponibilité globale" sousTitre="Trente derniers jours, toutes ressources." />
              <div className="flex justify-center py-2">
                <GaugeCircle
                  valeur={disponibiliteConstatee ?? 100}
                  min={99}
                  max={100}
                  cible={99.9}
                  libelle="Constatée"
                />
              </div>
              <p className="mt-2 text-center text-[11.5px] leading-relaxed text-g-500">
                Mesurée depuis l’extérieur, sur trois points de contrôle indépendants. Nous ne
                mesurons pas notre disponibilité depuis notre propre réseau.
              </p>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                titre="Engagements par composant"
                sousTitre="Ce que nous garantissons, et ce que nous avons réellement fait sur la période."
              />
              <div className="overflow-x-auto rounded-[8px] border border-g-300">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Composant', 'Engagé', 'Constaté', 'Réponse critique', 'Résolution critique'].map(
                        (h) => (
                          <th
                            key={h}
                            className="type-micro px-3 py-2 text-left font-semibold text-g-500"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {engagementsSla.map((e) => {
                      const tenu = e.constate >= e.dispo
                      return (
                        <tr key={e.composant} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2 text-[12px] font-semibold text-ink">
                            {LIBELLE_COMPOSANT_SLA[e.composant] ?? e.composant}
                          </td>
                          <td className="tnum px-3 py-2 text-[12px] text-g-700">
                            {pct(e.dispo, 2)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={tenu ? 'ok' : 'err'} size="sm">
                              {pct(e.constate, 2)}
                            </Badge>
                          </td>
                          <td className="tnum px-3 py-2 text-[11.5px] text-g-700">
                            {dureeMin(e.reponseCritique)}
                          </td>
                          <td className="tnum px-3 py-2 text-[11.5px] text-g-700">
                            {dureeMin(e.resolutionCritique)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {engagementsSla.some((e) => e.constate < e.dispo) && (
                <Callout ton="warn" className="mt-4" titre="Un engagement n’a pas été tenu">
                  {engagementsSla
                    .filter((e) => e.constate < e.dispo)
                    .map((e) => LIBELLE_COMPOSANT_SLA[e.composant] ?? e.composant)
                    .join(', ')}{' '}
                  {engagementsSla.filter((e) => e.constate < e.dispo).length > 1
                    ? 'sont passés'
                    : 'est passé'}{' '}
                  sous engagement sur la période. Nous n’attendons pas que vous le remarquiez :
                  l’avoir correspondant est calculé automatiquement et apparaît sur votre prochaine
                  facture.
                </Callout>
              )}
            </Card>
          </div>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Avoirs de service"
                sousTitre="Calculés automatiquement quand un engagement n’est pas tenu. Vous n’avez rien à réclamer."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Période', 'Composant', 'Disponibilité constatée', 'Engagement', 'Avoir', 'Statut'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {creditsSla.map((c) => (
                    <tr key={`${c.periode}-${c.composant}`} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2 text-[12px] text-ink">{c.periode}</td>
                      <td className="px-3 py-2 text-[12px] text-g-700">
                        {LIBELLE_COMPOSANT_SLA[c.composant] ?? c.composant}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone="err" size="sm">
                          {pct(c.dispoConstatee, 2)}
                        </Badge>
                      </td>
                      <td className="tnum px-3 py-2 text-[11.5px] text-g-700">
                        {pct(c.engagement, 2)}
                      </td>
                      <td className="tnum px-3 py-2 text-[12.5px] font-bold text-ok">
                        {money(c.credit)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={c.statut === 'appliqué' ? 'ok' : 'info'} dot size="sm">
                          {c.statut}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-g-100 px-4 py-3">
              <p className="text-[11.5px] leading-relaxed text-g-500">
                L’avoir est proportionnel à l’écart entre l’engagement et le constaté, appliqué sur la
                part d’abonnement du composant concerné. Il vient en déduction de votre facture
                suivante, sans démarche de votre part.
              </p>
            </div>
          </Card>

          <Callout ton="violet" titre="Pourquoi nous calculons les avoirs nous-mêmes">
            Beaucoup de fournisseurs exigent une réclamation écrite dans un délai court, en sachant
            très bien que la plupart des clients ne la feront pas. Nous trouvons cette pratique
            malhonnête : si nous ne tenons pas notre engagement, c’est à nous de le constater et de le
            créditer.
          </Callout>
        </div>
      )}

      {onglet === 'connaissances' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                  theme === t
                    ? 'border-p-700 bg-p-700 text-white'
                    : 'border-g-300 text-g-700 hover:border-p-400',
                )}
              >
                {t === 'tous' ? 'Tous les thèmes' : t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Card key={a.id} hover className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <BookOpen size={15} className="shrink-0 text-p-700" />
                  <Badge tone="neutral" size="sm">
                    {a.duree}
                  </Badge>
                </div>
                <p className="mt-2.5 text-[13px] font-bold leading-snug text-ink">{a.titre}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-g-700">{a.extrait}</p>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-g-100 pt-3">
                  <Badge tone="violet" size="sm">
                    {a.theme}
                  </Badge>
                  <ButtonLink size="sm" variant="ghost" href="/app/docs">
                    Lire
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>

          <Callout ton="info" titre="Un article manque ?">
            Dites-le nous dans un ticket. Les questions récurrentes du support finissent en article :
            c’est notre indicateur le plus fiable de ce qui n’est pas assez clair dans le produit ou
            dans la documentation.
          </Callout>
        </div>
      )}

      {onglet === 'contact' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Nous joindre"
              sousTitre="Nos équipes sont à Abidjan. Pas de centre d’appels délocalisé, pas de premier niveau qui vous lit un script."
            />
            <KeyValueList
              colonnes={1}
              items={[
                { cle: 'Ticket depuis le portail', valeur: 'Le canal à privilégier — le contexte technique est joint automatiquement' },
                { cle: 'Téléphone', valeur: '+225 27 22 00 00 00 · du lundi au vendredi, 8 h – 19 h GMT' },
                { cle: 'Astreinte incident critique', valeur: '+225 07 00 00 00 01 · 24 h/24, 7 j/7' },
                { cle: 'Courriel', valeur: 'support@synelia.cloud' },
                { cle: 'Sur place', valeur: 'Plateau, Abidjan — sur rendez-vous' },
                { cle: 'Langues', valeur: 'Français, anglais' },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-g-100 pt-4">
              <BoutonAction
                libelle="Demander à être rappelé"
                size="md"
                icone={<Phone size={13} />}
                operation={{
                  titre: 'Rappel demandé',
                  detail:
                    'Un technicien vous rappelle sur le numéro du contact technique, dans les heures ouvrées ou immédiatement si l’astreinte est mobilisée.',
                }}
              />
              <Button variant="ghost" onClick={() => setNouveau(true)}>
                Ouvrir un ticket
              </Button>
            </div>
            <Callout ton="violet" className="mt-4" titre="Le même fuseau horaire que vous">
              Un incident à 9 h à Abidjan trouve une équipe éveillée à Abidjan. Ce n’est pas un
              argument marketing : c’est la différence entre une prise en charge en quinze minutes et
              une attente jusqu’à l’ouverture d’un bureau en Europe ou en Amérique.
            </Callout>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Ce qu’un bon ticket contient"
                sousTitre="Pour que la première réponse soit utile plutôt qu’une demande de précisions."
              />
              <ol className="space-y-2.5">
                {[
                  {
                    t: 'La ressource concernée',
                    d: 'Sélectionnez-la dans le formulaire : nous récupérons alors son emplacement, ses métriques et ses journaux récents automatiquement.',
                  },
                  {
                    t: 'Ce que vous attendiez, ce que vous avez obtenu',
                    d: 'La formulation la plus utile en dépannage. « Ça ne marche pas » demande trois allers-retours ; « je m’attendais à un 200, j’ai un 502 depuis 14 h 10 » démarre le diagnostic immédiatement.',
                  },
                  {
                    t: 'Le moment où ça a commencé',
                    d: 'Même approximatif. Cela nous permet de corréler avec les déploiements, les maintenances et les incidents de la plateforme.',
                  },
                  {
                    t: 'Ce que vous avez déjà essayé',
                    d: 'Pour ne pas vous faire refaire ce que vous avez déjà fait.',
                  },
                ].map((x, i) => (
                  <li key={x.t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-p-050 text-[11px] font-bold text-p-700">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">{x.t}</span>
                      <span className="block text-[11.5px] leading-relaxed text-g-500">{x.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card>
              <CardHeader
                titre="Comment nous qualifions la gravité"
                sousTitre="La gravité détermine l’engagement de réponse, et donc la mobilisation."
              />
              <div className="space-y-2">
                {[
                  {
                    g: 'critique' as const,
                    d: 'Production totalement indisponible, ou perte de données en cours. Astreinte mobilisée, réponse sous 30 minutes, 24 h/24.',
                  },
                  {
                    g: 'majeure' as const,
                    d: 'Production dégradée mais fonctionnelle, ou fonctionnalité importante indisponible. Réponse sous 2 heures en heures ouvrées.',
                  },
                  {
                    g: 'mineure' as const,
                    d: 'Gêne sans impact sur l’activité, environnement hors production. Réponse sous 8 heures ouvrées.',
                  },
                  {
                    g: 'question' as const,
                    d: 'Demande de conseil, d’explication ou d’accompagnement. Réponse sous 1 jour ouvré.',
                  },
                ].map((x) => (
                  <div key={x.g} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <Badge tone={TON_GRAVITE[x.g]} dot size="sm">
                      {LIBELLE_GRAVITE[x.g]}
                    </Badge>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-g-700">{x.d}</p>
                  </div>
                ))}
              </div>
              <Callout ton="info" className="mt-4" titre="Nous ne rétrogradons pas votre gravité en silence">
                Si nous estimons qu’un ticket déclaré critique ne l’est pas, nous vous le disons et
                nous en discutons. Requalifier discrètement pour desserrer l’engagement serait une
                façon de tricher avec notre propre contrat.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={nouveau}
        onClose={() => setNouveau(false)}
        title="Ouvrir un ticket"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNouveau(false)}>
              Annuler
            </Button>
            <Button
              disabled={!sujet.trim() || !description.trim()}
              onClick={() => {
                const cibles = {
                  critique: { premiereReponseMin: 15, resolutionMin: 240 },
                  majeure: { premiereReponseMin: 60, resolutionMin: 480 },
                  mineure: { premiereReponseMin: 240, resolutionMin: 2880 },
                  question: { premiereReponseMin: 480, resolutionMin: 4320 },
                }[gravite]
                executer({
                  titre: 'Ticket ouvert',
                  detail:
                    'Les métriques, journaux et l’emplacement des ressources sélectionnées ont été joints automatiquement.',
                  appel: () =>
                    creerRessource('/support/tickets', {
                      sujet,
                      gravite,
                      contenu: description,
                      ressourcesLiees: ressource ? [ressource] : [],
                    }),
                  effet: () =>
                    collection.creer({
                      id: collection.identifiant('tck'),
                      orgId: ORG_COURANTE.id,
                      numero: `TCK-${4500 + collection.items.length}`,
                      sujet,
                      gravite,
                      statut: 'ouvert',
                      slaCible: cibles,
                      slaRestantMin: cibles.premiereReponseMin,
                      ressourcesLiees: ressource ? [ressource] : [],
                      createdAt: MAINTENANT,
                      messages: [
                        {
                          auteur: UTILISATEUR_COURANT.nom,
                          role: 'client',
                          date: MAINTENANT,
                          contenu: description,
                        },
                      ],
                    }),
                  effetFinal: () => collection.recharger(),
                })
                setSujet('')
                setDescription('')
                setNouveau(false)
              }}
            >
              Ouvrir le ticket
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Sujet" hint="une phrase qui décrit le problème, pas la solution supposée">
            <Input
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Latence élevée sur l’API de facturation depuis 14 h 10"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Gravité" hint="détermine l’engagement de réponse">
              <Select
                value={gravite}
                onChange={(e) => setGravite(e.target.value as Ticket['gravite'])}
              >
                <option value="critique">Critique — production indisponible</option>
                <option value="majeure">Majeure — production dégradée</option>
                <option value="mineure">Mineure — gêne sans impact</option>
                <option value="question">Question — conseil ou explication</option>
              </Select>
            </Field>
            <Field label="Ressource concernée" hint="son contexte technique sera joint automatiquement">
              <Select value={ressource} onChange={(e) => setRessource(e.target.value)}>
                <option value="">Aucune ressource précise</option>
                <option value="ec-dba-01">Espace EC-DBA-01</option>
                <option value="app-metier">Application app-metier</option>
                <option value="drive-pro">Service managé Drive Pro</option>
                <option value="boutique">Hébergement boutique.dba.africa</option>
                <option value="pra-dba-prod">Plan de reprise pra-dba-prod</option>
              </Select>
            </Field>
          </div>
          <Field
            label="Description"
            hint="ce que vous attendiez, ce que vous avez obtenu, depuis quand, et ce que vous avez déjà essayé"
          >
            <Textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Depuis 14 h 10 GMT, les appels à /v1/factures répondent en 4 à 6 secondes au lieu de 200 ms. Aucun déploiement de notre côté aujourd’hui. Le redémarrage du composant api n’a rien changé." />
          </Field>
          <Field label="Pièces jointes" hint="captures, extraits de journaux, traces">
            <Input type="file" />
          </Field>
          <Callout ton="info" titre="Ce que nous joignons automatiquement">
            Pour la ressource sélectionnée : son emplacement réel d’exécution, ses métriques des deux
            dernières heures, ses vingt dernières lignes de journal, ses derniers déploiements et les
            événements de supervision associés. Vous n’avez pas à les copier-coller.
          </Callout>
        </div>
      </Modal>
    </div>
  )
}
