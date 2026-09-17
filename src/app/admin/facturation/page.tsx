'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Download, Phone, Receipt, Send } from 'lucide-react'
import { cn, trendSeries } from '@/lib/utils'
import { dateCourte, MAINTENANT, money, pct } from '@/lib/format'
import { telechargerCsv } from '@/lib/export'
import type { Impaye } from '@/lib/mock'
import {
  IMPAYES,
  libellePlan,
  MARGE_BACKENDS,
  ORGANISATIONS,
  SYNTHESE_PLATEFORME,
  VENTILATION_DEPENSE,
} from '@/lib/mock'
import { MOYEN_LABEL } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StackedBar, StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, requete } from '@/lib/api/client'

const ONGLETS = [
  { id: 'revenus', label: 'Revenus' },
  { id: 'cycle', label: 'Cycle de facturation' },
  { id: 'recouvrement', label: 'Recouvrement' },
  { id: 'rentabilite', label: 'Rentabilité' },
]

const COULEURS = [
  'var(--color-p-600)',
  'var(--color-m-600)',
  'var(--color-info)',
  'var(--color-ok)',
  'var(--color-warn)',
  'var(--color-p-300)',
]

const ACTIONS_RECOUVREMENT = [
  { value: 'appel', label: 'Appel téléphonique effectué' },
  { value: 'relance', label: 'Relance écrite envoyée' },
  { value: 'echelonnement', label: 'Proposition d’échelonnement' },
  { value: 'avoir', label: 'Avoir commercial accordé' },
  { value: 'promesse', label: 'Promesse de règlement enregistrée' },
  { value: 'regle', label: 'Règlement reçu — dossier clos' },
]

export default function FacturationAdmin() {
  const { autorise, refus } = useApp()
  const impayes = useCollection<Impaye>('impayes', IMPAYES)
  const executer = useOperation()
  const [onglet, setOnglet] = useState('revenus')
  const [relanceId, setRelanceId] = useState<string | null>(null)
  const [historiqueId, setHistoriqueId] = useState<string | null>(null)
  const [action, setAction] = useState('appel')
  const [compteRendu, setCompteRendu] = useState('')
  const [prochaine, setProchaine] = useState('2026-09-05')
  const [echelonner, setEchelonner] = useState(false)
  const [suspendre, setSuspendre] = useState(false)
  // La revue d'anomalie du cycle : trois issues possibles, aucune automatique.
  const [anomalie, setAnomalie] = useState<'ouverte' | 'verifiee' | 'confirmee'>('ouverte')

  // Le tiroir doit relire la ligne dans la collection, pas la capturer à
  // l'ouverture : sinon il affiche l'état d'avant l'action qu'on vient d'y saisir.
  const relance = impayes.items.find((i) => i.id === relanceId) ?? null
  const historique = impayes.items.find((i) => i.id === historiqueId) ?? null

  const ouvrirRelance = (i: Impaye) => {
    setAction(i.retardJours > 60 ? 'echelonnement' : i.retardJours > 30 ? 'appel' : 'relance')
    setCompteRendu('')
    setProchaine(i.prochaineRelance ?? '2026-09-05')
    setEchelonner(Boolean(i.echelonnement))
    setSuspendre(Boolean(i.suspendu))
    setRelanceId(i.id)
  }

  const enregistrerRelance = () => {
    if (!relance) return
    const libelle = ACTIONS_RECOUVREMENT.find((a) => a.value === action)?.label ?? action
    const clos = action === 'regle'
    executer({
      action: 'invoice.view',
      ton: clos ? 'ok' : suspendre ? 'warn' : 'ok',
      titre: clos
        ? `Dossier ${relance.facture} clos`
        : `Action de recouvrement enregistrée — ${relance.org}`,
      detail: clos
        ? 'Le règlement est encaissé, la facture sort des impayés.'
        : suspendre
          ? 'La suspension est consignée avec votre nom : elle arrête l’activité du client.'
          : 'Le dossier est mis à jour et l’action est consignée dans son historique.',
      // Seule la relance écrite a un équivalent distant (vague de
      // relances) ; le reste — appel, échelonnement, avoir, promesse,
      // clôture — vit dans le journal local du dossier.
      appel:
        action === 'relance'
          ? () =>
              requete('/admin/facturation/impayes/relances', {
                methode: 'POST',
                corps: { factures: [relance.facture], niveau: 'rappel' },
              })
          : undefined,
      effet: () =>
        clos
          ? impayes.supprimer(relance.id)
          : impayes.modifier(relance.id, (i) => ({
              relances: i.relances + 1,
              echelonnement: echelonner,
              suspendu: suspendre,
              prochaineRelance: prochaine || undefined,
              journal: [
                ...(i.journal ?? []),
                {
                  date: MAINTENANT.slice(0, 10),
                  action: libelle,
                  note:
                    compteRendu.trim() ||
                    'Aucun compte rendu saisi — l’action est consignée sans détail.',
                },
              ],
            })),
      effetFinal: () => impayes.recharger(),
    })
    setRelanceId(null)
  }

  const api = estActif()
  const caMensuel = SYNTHESE_PLATEFORME.caMensuel
  const impayesTotal = impayes.items.reduce((a, i) => a + i.montant, 0)
  const coutInfra = MARGE_BACKENDS.reduce((a, m) => a + m.coutInfra, 0)
  const revenuInfra = MARGE_BACKENDS.reduce((a, m) => a + m.revenu, 0)
  const margeBrute = Math.round(((revenuInfra - coutInfra) / revenuInfra) * 1000) / 10

  // Toutes les organisations sont clientes en direct : la question utile n'est
  // plus « par quel canal » mais « sur quels secteurs repose le revenu », qui
  // dit à quoi la plateforme est exposée si l'un d'eux se contracte.
  const parSecteur = Array.from(
    ORGANISATIONS.reduce((acc, o) => {
      const cle = o.secteur ?? 'Autres'
      acc.set(cle, (acc.get(cle) ?? 0) + (o.caMensuel ?? 0))
      return acc
    }, new Map<string, number>()),
  )
    .map(([secteur, montant]) => ({ secteur, montant }))
    .filter((x) => x.montant > 0)
    .sort((a, b) => b.montant - a.montant)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Facturation & marge' }]}
        titre="Facturation & marge"
        sousTitre="Revenus par canal, cycle d’émission, recouvrement et rentabilité par socle. Le recouvrement se fait par appel et échelonnement avant de parler de suspension : une entreprise dont la trésorerie est tendue reste un client, pas un problème."
        actions={
          <BoutonFormulaire
            libelle="Exporter la période"
            size="md"
            icone={<Download size={14} />}
            action="invoice.view"
            titre="Exporter la période du 1er au 19 août 2026"
            description="Le fichier produit est un CSV séparé par des points-virgules, lisible tel quel par un tableur configuré en français. Ce n’est pas un export comptable : il ne remplace pas le journal de ventes."
            libelleValider="Télécharger"
            champs={[
              {
                id: 'jeu',
                label: 'Jeu de données',
                type: 'select',
                options: [
                  { value: 'organisations', label: 'Revenu par organisation' },
                  { value: 'impayes', label: 'Impayés en cours' },
                  { value: 'socles', label: 'Rentabilité par socle' },
                ],
              },
            ]}
            operation={(v) => ({
              titre: 'Export téléchargé',
              detail: 'Le fichier est dans vos téléchargements.',
              effet: () => {
                if (v.jeu === 'impayes') {
                  telechargerCsv(
                    'impayes-2026-08',
                    ['Organisation', 'Facture', 'Montant FCFA', 'Échéance', 'Retard (jours)', 'Relances'],
                    impayes.items.map((i) => [
                      i.org,
                      i.facture,
                      i.montant,
                      i.echeance,
                      i.retardJours,
                      i.relances,
                    ]),
                  )
                } else if (v.jeu === 'socles') {
                  telechargerCsv(
                    'rentabilite-socles-2026-08',
                    ['Socle', 'Technologie', 'Coût FCFA', 'Revenu FCFA', 'Marge FCFA', 'Taux %'],
                    MARGE_BACKENDS.map((m) => [
                      m.backend,
                      m.type,
                      m.coutInfra,
                      m.revenu,
                      m.revenu - m.coutInfra,
                      m.marge,
                    ]),
                  )
                } else {
                  telechargerCsv(
                    'revenu-organisations-2026-08',
                    ['Organisation', 'Secteur', 'Plan', 'Espaces', 'CA mensuel FCFA', 'Statut'],
                    ORGANISATIONS.filter((o) => (o.caMensuel ?? 0) > 0).map((o) => [
                      o.nom,
                      o.secteur ?? '',
                      o.tenantPlan ?? '',
                      o.espaces ?? 0,
                      o.caMensuel ?? 0,
                      o.statut,
                    ]),
                  )
                }
              },
            })}
          />
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              Période du 1er au 19 août 2026
            </Badge>
            <Badge tone="ok" size="sm">
              Marge brute {pct(margeBrute, 1)}
            </Badge>
            {impayesTotal > 0 && (
              <Badge tone="err" dot size="sm">
                {money(impayesTotal)} d’impayés
              </Badge>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          libelle="CA mensuel récurrent"
          valeur={money(caMensuel)}
          ton="ok"
          detail={api ? 'Démonstration — pas encore une lecture réelle' : undefined}
          serie={trendSeries('admin-ca', 12, caMensuel * 0.68, caMensuel)}
        />
        <StatTile
          libelle="Croissance mensuelle"
          valeur="+ 6,8 %"
          ton="ok"
          detail="Moyenne sur 6 mois"
        />
        <StatTile
          libelle="Coût d’infrastructure"
          valeur={money(coutInfra)}
          detail="Matériel, licences, énergie, hébergement"
        />
        <StatTile
          libelle="Marge brute"
          valeur={pct(margeBrute, 1)}
          ton={margeBrute > 40 ? 'ok' : 'warn'}
        />
        <StatTile
          libelle="Impayés"
          valeur={money(impayesTotal)}
          ton={impayesTotal > 0 ? 'err' : 'ok'}
          detail={`${IMPAYES.length} factures`}
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'revenus' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                titre="Revenu mensuel récurrent"
                sousTitre="Douze derniers mois. Le revenu récurrent exclut les prestations ponctuelles et les frais de mise en service."
              />
              <div className="flex items-end gap-1.5">
                {trendSeries('admin-mrr', 12, caMensuel * 0.62, caMensuel).map((v, i) => (
                  <span
                    key={i}
                    className="group relative flex-1"
                    title={money(Math.round(v))}
                  >
                    <span
                      className="block rounded-t-sm bg-p-600 transition-colors group-hover:bg-p-700"
                      style={{ height: `${40 + (v / caMensuel) * 110}px` }}
                    />
                  </span>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10.5px] text-g-500">
                <span>Sept. 2025</span>
                <span>Août 2026</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-g-100 pt-4 sm:grid-cols-4">
                <div>
                  <MicroLabel className="text-g-500">Revenu récurrent</MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ink">{money(caMensuel)}</p>
                </div>
                <div>
                  <MicroLabel className="text-g-500">Panier moyen</MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ink">
                    {money(Math.round(caMensuel / SYNTHESE_PLATEFORME.tenantsActifs))}
                  </p>
                </div>
                <div>
                  <MicroLabel className="text-g-500">Organisations facturées</MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ink">
                    {SYNTHESE_PLATEFORME.tenantsActifs}
                  </p>
                </div>
                <div>
                  <MicroLabel className="text-g-500">Attrition annuelle</MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ok">3,2 %</p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader titre="Répartition par secteur" sousTitre="Revenu mensuel récurrent." />
              <StackedBar
                segments={parSecteur.map((c, i) => ({
                  label: c.secteur,
                  valeur: c.montant,
                  couleur: COULEURS[i % COULEURS.length],
                }))}
              />
              <div className="mt-4 space-y-1.5 border-t border-g-100 pt-3.5">
                {parSecteur.map((c, i) => (
                  <div key={c.secteur} className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: COULEURS[i % COULEURS.length] }}
                      />
                      <span className="truncate text-[12px] text-g-700">{c.secteur}</span>
                    </span>
                    <span className="tnum shrink-0 text-[12px] font-semibold text-ink">
                      {money(c.montant)}
                    </span>
                  </div>
                ))}
              </div>
              <Callout ton="info" className="mt-4" titre="Nous vendons en direct, donc nous portons seuls le risque de concentration">
                Aucun intermédiaire ne s’intercale entre nous et le client : c’est ce qui rend le
                revenu lisible, et c’est aussi ce qui fait qu’un secteur qui se contracte se voit
                immédiatement ici. Le premier secteur pèse{' '}
                {pct(Math.round((parSecteur[0].montant / caMensuel) * 1000) / 10, 1)} du revenu.
              </Callout>
            </Card>
          </div>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Revenu par organisation"
                sousTitre="Toutes organisations facturées, du plus gros contributeur au plus petit."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Organisation', 'Secteur', 'Plan', 'Espaces', 'CA mensuel', 'Part du revenu', 'Statut', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...ORGANISATIONS]
                    .filter((o) => (o.caMensuel ?? 0) > 0)
                    .sort((a, b) => (b.caMensuel ?? 0) - (a.caMensuel ?? 0))
                    .map((o) => {
                      const part = Math.round(((o.caMensuel ?? 0) / caMensuel) * 1000) / 10
                      return (
                        <tr key={o.id} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/admin/organisations/${o.id}`}
                              className="text-[12.5px] font-semibold text-ink hover:text-p-700"
                            >
                              {o.nom}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                            {o.secteur ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                            {libellePlan(o.tenantPlan)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                            {o.espaces ?? 0}
                          </td>
                          <td className="tnum px-3 py-2.5 text-[12.5px] font-bold text-ink">
                            {money(o.caMensuel ?? 0)}
                          </td>
                          <td className="w-40 px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="relative block h-2 flex-1 overflow-hidden rounded-full bg-g-100">
                                <span
                                  className={cn(
                                    'absolute inset-y-0 left-0 rounded-full',
                                    part > 25 ? 'bg-warn' : 'bg-p-600',
                                  )}
                                  style={{ width: `${Math.min(100, part * 3)}%` }}
                                />
                              </span>
                              <span className="tnum shrink-0 text-[11.5px] text-g-700">
                                {pct(part, 1)}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              tone={
                                o.statut === 'active'
                                  ? 'ok'
                                  : o.statut === 'suspendue'
                                    ? 'warn'
                                    : 'neutral'
                              }
                              dot
                              size="sm"
                            >
                              {o.statut}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <ButtonLink
                              size="sm"
                              variant="ghost"
                              href={`/admin/organisations/${o.id}`}
                            >
                              Ouvrir
                            </ButtonLink>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </Card>

          <Callout ton="warn" titre="Une organisation représente plus d’un quart du revenu">
            C’est un risque de concentration qu’il faut regarder en face : son départ, ou une simple
            renégociation à la baisse, se verrait immédiatement dans les comptes. Diversifier passe par
            le canal indirect, qui apporte des clients plus petits mais plus nombreux.
          </Callout>
        </div>
      )}

      {onglet === 'cycle' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Cycle de facturation"
              sousTitre="Ce qui se passe chaque mois, automatiquement, et les points où une intervention humaine reste requise."
            />
            <div className="space-y-2">
              {[
                {
                  j: 'Le 28 du mois',
                  t: 'Consolidation de la consommation',
                  d: 'Les compteurs de vCPU-heures, de stockage, de transfert sortant et de sièges sont figés. Les lignes d’abonnement sont calculées.',
                  auto: true,
                },
                {
                  j: 'Le 29',
                  t: 'Génération des brouillons',
                  d: 'Une facture brouillon par organisation, visible du client dans son espace. Il peut la contester avant émission.',
                  auto: true,
                },
                {
                  j: 'Le 30',
                  t: 'Revue des anomalies',
                  d: 'Toute facture qui varie de plus de 30 % par rapport au mois précédent est mise de côté pour vérification humaine. Une erreur de compteur est plus facile à corriger avant émission qu’après.',
                  auto: false,
                },
                {
                  j: 'Le 1er',
                  t: 'Émission et envoi',
                  d: 'Les factures sont émises, numérotées, archivées et envoyées au contact de facturation de chaque organisation.',
                  auto: true,
                },
                {
                  j: 'Le 5',
                  t: 'Prélèvement automatique',
                  d: 'Pour les organisations ayant mandaté un prélèvement Orange Money ou un virement récurrent.',
                  auto: true,
                },
                {
                  j: 'Le 3 du mois suivant',
                  t: 'Relance automatique',
                  d: 'Premier rappel par courriel sur les factures non réglées, sans pénalité.',
                  auto: true,
                },
                {
                  j: 'Le 15 du mois suivant',
                  t: 'Deuxième relance et appel',
                  d: 'Relance écrite, puis appel téléphonique. À partir de ce stade, un humain reprend le dossier.',
                  auto: false,
                },
              ].map((x) => (
                <div
                  key={x.j}
                  className={cn(
                    'flex flex-wrap items-start gap-3 rounded-[6px] border px-3 py-2.5',
                    x.auto ? 'border-g-300' : 'border-warn/40 bg-warn-bg',
                  )}
                >
                  <span className="w-32 shrink-0 text-[11.5px] font-semibold text-p-700">{x.j}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-ink">{x.t}</span>
                    <span className="block text-[11.5px] leading-relaxed text-g-700">{x.d}</span>
                  </span>
                  <Badge tone={x.auto ? 'ok' : 'warn'} size="sm">
                    {x.auto ? 'Automatique' : 'Intervention humaine'}
                  </Badge>
                </div>
              ))}
            </div>
            <Callout ton="violet" className="mt-4" titre="La revue des anomalies n’est pas automatisable">
              Une facture qui triple d’un mois sur l’autre peut être légitime — le client a lancé un
              gros traitement — ou refléter un compteur défaillant de notre côté. Envoyer la facture
              sans vérifier, c’est risquer de facturer une erreur à un client, ce qui coûte bien plus
              cher en confiance qu’en trésorerie.
            </Callout>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Factures du cycle en cours"
                sousTitre="État à J−9 de l’émission."
              />
              <div className="space-y-2">
                {[
                  { l: 'Brouillons générés', v: 8, t: 'info' as const },
                  {
                    l: 'Anomalies à vérifier',
                    v: anomalie === 'ouverte' ? 1 : 0,
                    t: anomalie === 'ouverte' ? ('warn' as const) : ('ok' as const),
                  },
                  { l: 'Contestations client', v: 0, t: 'ok' as const },
                  { l: 'Prêtes à émettre', v: anomalie === 'ouverte' ? 7 : 8, t: 'ok' as const },
                ].map((x) => (
                  <div
                    key={x.l}
                    className="flex items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                  >
                    <span className="text-[12.5px] text-ink">{x.l}</span>
                    <Badge tone={x.t} size="sm">
                      {x.v}
                    </Badge>
                  </div>
                ))}
              </div>
              <div
                className={cn(
                  'mt-3.5 rounded-[6px] border px-3 py-2.5',
                  anomalie === 'ouverte'
                    ? 'border-warn/40 bg-warn-bg'
                    : anomalie === 'verifiee'
                      ? 'border-ok/40 bg-ok-bg'
                      : 'border-info/40 bg-info-bg',
                )}
              >
                <p className="text-[12.5px] font-semibold text-ink">
                  Anomalie : AMUGA, + 214 % sur le transfert sortant
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">
                  {anomalie === 'ouverte'
                    ? '1,8 To de transfert sortant contre 580 Go le mois dernier. À vérifier avant émission : soit le client a mis en ligne un catalogue média, soit un compteur double-compte.'
                    : anomalie === 'verifiee'
                      ? 'Recomptage terminé : les 1,8 To sont confirmés par les journaux du répartiteur de charge, sans double comptage. La facture peut être émise telle quelle.'
                      : 'Le client a été appelé : mise en ligne d’un catalogue vidéo le 2 août, la consommation est assumée. La facture est débloquée pour émission.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {anomalie === 'ouverte' ? (
                    <>
                      <BoutonAction
                        libelle="Vérifier les compteurs"
                        operation={{
                          action: 'invoice.view',
                          titre: 'Recomptage lancé sur AMUGA',
                          detail:
                            'Le transfert sortant est recalculé depuis les journaux du répartiteur de charge, sur les trente derniers jours.',
                          job: {
                            type: 'metering.recount',
                            label: 'Recomptage du transfert sortant · AMUGA',
                            etapes: [
                              'Extraction des journaux du répartiteur',
                              'Agrégation par heure',
                              'Comparaison avec le compteur de facturation',
                              'Publication du rapport d’écart',
                            ],
                          },
                          effetFinal: () => setAnomalie('verifiee'),
                        }}
                      />
                      <BoutonFormulaire
                        libelle="Appeler le client"
                        variant="ghost"
                        action="invoice.view"
                        titre="Appeler AMUGA avant émission"
                        description="Un appel avant émission coûte cinq minutes ; une facture contestée après émission coûte un avoir, un retard de règlement et une conversation bien moins agréable."
                        libelleValider="Consigner l’appel"
                        champs={[
                          {
                            id: 'issue',
                            label: 'Issue de l’appel',
                            type: 'select',
                            options: [
                              { value: 'assume', label: 'Consommation assumée par le client' },
                              { value: 'conteste', label: 'Le client conteste, vérification demandée' },
                              { value: 'injoignable', label: 'Injoignable, message laissé' },
                            ],
                          },
                          {
                            id: 'note',
                            label: 'Compte rendu',
                            type: 'zone',
                            placeholder:
                              'Mise en ligne d’un catalogue vidéo le 2 août. Le responsable technique confirme le volume et demande une estimation pour le mois prochain.',
                          },
                        ]}
                        operation={(v) => ({
                          ton: v.issue === 'assume' ? 'ok' : 'info',
                          titre: 'Appel consigné au dossier AMUGA',
                          detail:
                            v.issue === 'assume'
                              ? 'La facture est débloquée pour émission le 1er du mois.'
                              : v.issue === 'conteste'
                                ? 'La facture reste en attente : un recomptage est requis avant émission.'
                                : 'La facture reste en attente. Nouvelle tentative demain.',
                          effet: () => {
                            if (v.issue === 'assume') setAnomalie('confirmee')
                          },
                        })}
                      />
                    </>
                  ) : (
                    <BoutonAction
                      libelle="Rouvrir l’anomalie"
                      variant="ghost"
                      operation={{
                        ton: 'warn',
                        titre: 'Anomalie rouverte',
                        detail: 'La facture repasse en attente de vérification avant émission.',
                        effet: () => setAnomalie('ouverte'),
                      }}
                    />
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Ventilation du revenu par famille"
                sousTitre="Ce que nous vendons réellement, indépendamment de ce que nous mettons en avant."
              />
              <div className="space-y-2.5">
                {VENTILATION_DEPENSE.map((v, i) => {
                  const max = Math.max(...VENTILATION_DEPENSE.map((x) => x.montant))
                  return (
                    <div key={v.famille}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[12px] text-ink">{v.famille}</span>
                        <span className="tnum shrink-0 text-[12px]">
                          <span className="font-semibold text-ink">{money(v.montant)}</span>
                          <span className="ml-1.5 text-g-500">{pct(v.pct, 1)}</span>
                        </span>
                      </div>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-g-100">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${(v.montant / max) * 100}%`,
                            background: COULEURS[i % COULEURS.length],
                          }}
                        />
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'recouvrement' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Notre politique de recouvrement, écrite noir sur blanc">
            Relance automatique à trois jours, relance écrite à quinze, appel téléphonique à trente,
            proposition d’échelonnement systématique. La suspension n’intervient qu’après un rappel
            écrit et un délai de quinze jours supplémentaires, et c’est une décision humaine consignée.
            Couper le service d’une entreprise, c’est arrêter son activité : nous ne le faisons pas par
            traitement automatique nocturne.
          </Callout>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Impayés en cours"
                sousTitre="Triés par ancienneté. Le nombre de relances indique où en est le dossier."
                className="mb-0"
                actions={
                  <Badge tone={impayesTotal > 0 ? 'err' : 'ok'} size="sm">
                    {money(impayesTotal)}
                  </Badge>
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Organisation', 'Facture', 'Montant', 'Échéance', 'Retard', 'Relances', 'Prochaine action', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...impayes.items]
                    .sort((a, b) => b.retardJours - a.retardJours)
                    .map((i) => (
                      <tr key={i.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <span className="block text-[12.5px] font-semibold text-ink">{i.org}</span>
                          {(i.echelonnement || i.suspendu) && (
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {i.echelonnement && (
                                <Badge tone="info" size="sm">
                                  Échelonné
                                </Badge>
                              )}
                              {i.suspendu && (
                                <Badge tone="err" size="sm">
                                  Suspendue
                                </Badge>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-g-700">{i.facture}</td>
                        <td className="tnum px-3 py-2.5 text-[12.5px] font-bold text-ink">
                          {money(i.montant)}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                          {dateCourte(i.echeance)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            tone={
                              i.retardJours > 60 ? 'err' : i.retardJours > 30 ? 'warn' : 'info'
                            }
                            size="sm"
                          >
                            {i.retardJours} jours
                          </Badge>
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{i.relances}</td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                          {i.echelonnement
                            ? 'Échelonnement en cours, relances suspendues'
                            : i.retardJours > 60
                              ? 'Appel de la direction, proposition d’échelonnement'
                              : i.retardJours > 30
                                ? 'Appel téléphonique'
                                : 'Relance écrite'}
                          {i.prochaineRelance && (
                            <span className="block text-[10.5px] text-g-500">
                              Prévue le {dateCourte(i.prochaineRelance)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="flex items-center justify-end gap-1.5">
                            <GatedAction
                              autorise={autorise('invoice.view')}
                              message={refus('invoice.view')}
                            >
                              <Button
                                size="sm"
                                variant="secondary"
                                iconBefore={<Phone size={12} />}
                                onClick={() => ouvrirRelance(i)}
                              >
                                Traiter
                              </Button>
                            </GatedAction>
                            <Button
                              size="sm"
                              variant="ghost"
                              iconBefore={<Clock size={12} />}
                              onClick={() => setHistoriqueId(i.id)}
                            >
                              Historique
                            </Button>
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader titre="Efficacité du recouvrement" sousTitre="Douze derniers mois." />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Taux de recouvrement', valeur: '97,8 %' },
                  { cle: 'Délai moyen de règlement', valeur: '34 jours' },
                  { cle: 'Échelonnements accordés', valeur: '6' },
                  { cle: 'Échelonnements respectés', valeur: '6 sur 6' },
                  { cle: 'Suspensions prononcées', valeur: '1' },
                  { cle: 'Créances passées en perte', valeur: money(0) },
                ]}
              />
              <Callout ton="ok" className="mt-4" titre="L’échelonnement marche mieux que la menace">
                Six échelonnements accordés, six respectés. Un client à qui l’on propose une solution
                paie ; un client menacé de coupure cherche un autre fournisseur et laisse sa dette.
              </Callout>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                titre="Moyens de paiement utilisés"
                sousTitre="La répartition réelle, qui justifie de ne pas se limiter à la carte bancaire."
              />
              <div className="space-y-2.5">
                {[
                  { m: 'orange_money' as const, pct: 42, n: 'Le plus utilisé, de loin' },
                  { m: 'virement' as const, pct: 34, n: 'Grands comptes et secteur public' },
                  { m: 'mtn_momo' as const, pct: 12, n: 'Second opérateur mobile' },
                  { m: 'carte' as const, pct: 9, n: 'Minoritaire, surtout international' },
                  { m: 'wave' as const, pct: 3, n: 'En progression' },
                ].map((x) => (
                  <div key={x.m}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-[12.5px] font-semibold text-ink">
                        {MOYEN_LABEL[x.m]}
                      </span>
                      <span className="tnum shrink-0 text-[12.5px] font-bold text-ink">
                        {pct(x.pct)}
                      </span>
                    </div>
                    <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-g-100">
                      <span
                        className="block h-full rounded-full bg-p-600"
                        style={{ width: `${x.pct}%` }}
                      />
                    </span>
                    <p className="mt-0.5 text-[10.5px] text-g-500">{x.n}</p>
                  </div>
                ))}
              </div>
              <Callout ton="violet" className="mt-4" titre="Un fournisseur qui n’accepte que la carte se coupe de 88 % du marché">
                C’est le genre de détail qui décide d’une vente en Afrique de l’Ouest. Accepter Orange
                Money et MTN MoMo n’est pas une commodité : c’est la condition d’accès au marché.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'rentabilite' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatTile libelle="Revenu porté" valeur={money(revenuInfra)} ton="ok" />
            <StatTile libelle="Coût d’infrastructure" valeur={money(coutInfra)} />
            <StatTile
              libelle="Marge brute"
              valeur={money(revenuInfra - coutInfra)}
              ton="ok"
              detail={pct(margeBrute, 1)}
            />
            <StatTile
              libelle="Licences propriétaires"
              valeur={money(28_800_000)}
              ton="warn"
              detail="Par an — supprimées à la fin de la trajectoire"
            />
          </div>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Rentabilité par socle"
                sousTitre="La lecture qui justifie économiquement la sortie des socles propriétaires."
                className="mb-0"
                actions={
                  <ButtonLink size="sm" variant="ghost" href="/admin/capacite">
                    Détail de la capacité
                  </ButtonLink>
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Socle', 'Technologie', 'Coût', 'Revenu', 'Marge brute', 'Taux', 'Nature'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...MARGE_BACKENDS]
                    .sort((a, b) => b.marge - a.marge)
                    .map((m) => (
                      <tr key={m.backend} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-ink">
                          {m.backend}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">{m.type}</td>
                        <td className="tnum px-3 py-2.5 text-[11.5px] text-g-700">
                          {money(m.coutInfra)}
                        </td>
                        <td className="tnum px-3 py-2.5 text-[11.5px] text-g-700">
                          {money(m.revenu)}
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] font-bold text-ink">
                          {money(m.revenu - m.coutInfra)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="relative block h-2 w-20 overflow-hidden rounded-full bg-g-100">
                              <span
                                className={cn(
                                  'absolute inset-y-0 left-0 rounded-full',
                                  m.marge > 50 ? 'bg-ok' : m.marge > 30 ? 'bg-p-600' : 'bg-warn',
                                )}
                                style={{ width: `${m.marge}%` }}
                              />
                            </span>
                            <span
                              className={cn(
                                'tnum text-[12px] font-bold',
                                m.marge > 50 ? 'text-ok' : m.marge > 30 ? 'text-ink' : 'text-warn',
                              )}
                            >
                              {pct(m.marge, 1)}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            tone={
                              m.type.includes('OpenStack') ||
                              m.type.includes('Proxmox') ||
                              m.type.includes('CloudStack')
                                ? 'ok'
                                : 'warn'
                            }
                            size="sm"
                          >
                            {m.type.includes('OpenStack') ||
                            m.type.includes('Proxmox') ||
                            m.type.includes('CloudStack')
                              ? 'Libre'
                              : 'Propriétaire'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Callout ton="violet" titre="Le chiffre qui décide de la trajectoire">
              Socles libres : 49 à 57 % de marge. Socles propriétaires : 24 à 31 %. L’écart, ce sont les
              licences. Sortir du propriétaire améliore la marge de vingt points sur la capacité
              concernée, tout en réduisant notre dépendance à un éditeur. Il n’y a pas d’arbitrage à
              faire entre le principe et l’intérêt économique : ils vont dans le même sens.
            </Callout>

            <Card>
              <CardHeader
                titre="Structure de coûts"
                sousTitre="Ce qui compose le coût d’infrastructure mensuel."
                actions={<Receipt size={15} className="text-p-700" />}
              />
              <div className="space-y-2.5">
                {[
                  { l: 'Amortissement du matériel', v: 38 },
                  { l: 'Licences propriétaires', v: 24 },
                  { l: 'Énergie et refroidissement', v: 16 },
                  { l: 'Hébergement et baies', v: 11 },
                  { l: 'Connectivité et transit', v: 8 },
                  { l: 'Maintenance et pièces', v: 3 },
                ].map((x, i) => (
                  <div key={x.l}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[12px] text-ink">{x.l}</span>
                      <span className="tnum shrink-0 text-[12px] font-semibold text-ink">
                        {pct(x.v)}
                      </span>
                    </div>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-g-100">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          x.l.includes('Licences') ? 'bg-warn' : 'bg-p-600',
                        )}
                        style={{ width: `${x.v * 2.4}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <Callout ton="warn" className="mt-4" titre="Les licences pèsent presque autant que le matériel">
                24 % du coût d’infrastructure part en licences pour la couche de virtualisation, sans
                que le client en retire quoi que ce soit qu’un socle libre ne fournirait pas. C’est la
                dépense la plus facile à supprimer, et c’est ce que fait la trajectoire de sortie.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={relance !== null}
        onClose={() => setRelanceId(null)}
        title={`Traiter l’impayé — ${relance?.org ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRelanceId(null)}>
              Annuler
            </Button>
            <Button iconBefore={<Send size={13} />} onClick={enregistrerRelance}>
              Enregistrer l’action
            </Button>
          </>
        }
      >
        {relance && (
          <div className="space-y-4">
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Organisation', valeur: relance.org },
                { cle: 'Facture', valeur: relance.facture },
                { cle: 'Montant', valeur: money(relance.montant) },
                { cle: 'Échéance', valeur: dateCourte(relance.echeance) },
                { cle: 'Retard', valeur: `${relance.retardJours} jours` },
                { cle: 'Relances envoyées', valeur: String(relance.relances) },
              ]}
            />
            <Field label="Action">
              <Select value={action} onChange={(e) => setAction(e.target.value)}>
                {ACTIONS_RECOUVREMENT.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compte rendu" hint="ce que le client a dit, et ce qui a été convenu">
              <Textarea
                rows={4}
                value={compteRendu}
                onChange={(e) => setCompteRendu(e.target.value)}
                placeholder="Appel au directeur financier. Difficulté de trésorerie liée à un retard de paiement de leur propre client public. Échelonnement en trois mensualités proposé et accepté, première échéance au 5 septembre."
              />
            </Field>
            <Field label="Prochaine relance" hint="laisser vide si le dossier est résolu">
              <Input
                type="date"
                value={prochaine}
                onChange={(e) => setProchaine(e.target.value)}
                disabled={action === 'regle'}
              />
            </Field>
            <div className="space-y-3">
              <Switch
                checked={echelonner}
                onChange={setEchelonner}
                disabled={action === 'regle'}
                label="Proposer un échelonnement"
                description="Trois mensualités par défaut, sans pénalité. C’est le levier qui recouvre le mieux."
              />
              <Switch
                checked={suspendre}
                onChange={setSuspendre}
                disabled={action === 'regle'}
                label="Suspendre l’organisation"
                description="Décision humaine, à ne prendre qu’après rappel écrit et quinze jours supplémentaires. Elle arrête l’activité du client et sera consignée avec votre nom."
              />
            </div>
            {action === 'regle' ? (
              <Callout ton="ok" titre="Le dossier sort des impayés">
                Enregistrer un règlement clôt le dossier : la facture quitte cette liste et
                l’historique du compte conserve la séquence des relances qui y ont mené.
              </Callout>
            ) : suspendre ? (
              <Callout ton="err" titre="Une suspension arrête l’activité du client">
                Elle sera consignée avec votre nom et la date, et le client en est prévenu par écrit
                avant qu’elle prenne effet. Vérifiez qu’un appel a bien eu lieu et qu’un
                échelonnement a été proposé : sans ces deux étapes, la suspension est prématurée.
              </Callout>
            ) : (
              <Callout ton="violet" titre="Avant de suspendre, appelez">
                Sur les six dossiers d’impayé traités cette année, cinq se sont résolus par un simple
                appel et un échelonnement. Le sixième était une entreprise en cessation de paiement,
                où la suspension n’aurait rien changé. La coupure n’a jamais fait rentrer d’argent
                plus vite qu’une conversation.
              </Callout>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={historique !== null}
        onClose={() => setHistoriqueId(null)}
        title={`Historique du dossier — ${historique?.facture ?? ''}`}
        description="Toutes les actions consignées sur cet impayé, de la relance automatique au dernier appel. Le journal est en lecture seule : on n’efface pas une relance qui a eu lieu."
        size="md"
        footer={
          <Button variant="ghost" onClick={() => setHistoriqueId(null)}>
            Fermer
          </Button>
        }
      >
        {historique && (
          <div className="space-y-4">
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Organisation', valeur: historique.org },
                { cle: 'Montant', valeur: money(historique.montant) },
                { cle: 'Retard', valeur: `${historique.retardJours} jours` },
                {
                  cle: 'Prochaine relance',
                  valeur: historique.prochaineRelance
                    ? dateCourte(historique.prochaineRelance)
                    : 'Aucune',
                },
              ]}
            />
            <ol className="space-y-2">
              {(historique.journal ?? []).map((e, i) => (
                <li
                  key={`${e.date}-${i}`}
                  className="rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-ink">{e.action}</span>
                    <span className="tnum text-[11px] text-g-500">{dateCourte(e.date)}</span>
                  </span>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">{e.note}</p>
                </li>
              ))}
            </ol>
            {(historique.journal ?? []).length === 0 && (
              <p className="text-[12px] text-g-500">
                Aucune action consignée sur ce dossier : la relance automatique n’a pas encore été
                déclenchée.
              </p>
            )}
          </div>
        )}
      </Modal>

    </div>
  )
}
