'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Download, FileText, Smartphone, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  dateCourte,
  money,
  moneyPerMonth,
  num,
  pct,
  prorata,
  relatif,
  ventilationTva,
} from '@/lib/format'
import {
  CONSOMMATION_JOURS,
  DEVIS,
  FACTURES,
  OFFRES,
  ORG_COURANTE,
  SHOWBACK_APPLICATIONS,
  SHOWBACK_ESPACES,
  SOUSCRIPTIONS,
  SYNTHESE_CLIENT,
  VENTILATION_DEPENSE,
} from '@/lib/mock'
import { MOYEN_LABEL } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Drawer } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StackedBar, StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { CostPreview } from '@/components/composition/flow'
import { BoutonPaiementPaystack } from '@/components/composition/paystack'
import {
  ApiError,
  creerRessource,
  estActif,
  lireSession,
  modifierRessource,
  requete,
  supprimerRessource,
} from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'
import { telechargerCsv } from '@/lib/export'
import type { Devis, Invoice, MoyenPaiement, Offer, Subscription } from '@/lib/types'

const ONGLETS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'factures', label: 'Factures' },
  { id: 'souscriptions', label: 'Souscriptions' },
  { id: 'repartition', label: 'Répartition interne' },
  { id: 'paiement', label: 'Moyens de paiement' },
  { id: 'devis', label: 'Devis' },
]

const COULEURS = [
  'var(--color-p-600)',
  'var(--color-m-600)',
  'var(--color-info)',
  'var(--color-ok)',
  'var(--color-warn)',
  'var(--color-p-300)',
]

const LIBELLE_STATUT: Record<Invoice['statut'], string> = {
  brouillon: 'Brouillon',
  emise: 'Émise',
  payee: 'Payée',
  impayee: 'Impayée',
  annulee: 'Annulée',
}

const TON_STATUT: Record<Invoice['statut'], 'ok' | 'err' | 'info' | 'neutral'> = {
  brouillon: 'info',
  emise: 'neutral',
  payee: 'ok',
  impayee: 'err',
  annulee: 'neutral',
}

interface MoyenEnregistre {
  id: string
  moyen: MoyenPaiement
  detail: string
  principal: boolean
  /** Backend (`GET /facturation/moyens-paiement`) : mêmes sens, autres noms. */
  type?: MoyenPaiement
  defaut?: boolean
  libelle?: string
}

const MOYENS: MoyenEnregistre[] = [
  { id: 'moy-1', moyen: 'orange_money', detail: '+225 07 •• •• •• 42', principal: true },
  { id: 'moy-2', moyen: 'virement', detail: 'SGCI · IBAN CI•• •••• •••• •••• •••• 8814', principal: false },
  { id: 'moy-3', moyen: 'carte', detail: 'Visa •••• 4821 · expire 09/28', principal: false },
]

/** `GET /facturation/consommation` — même forme que `CONSOMMATION_JOURS`, plus les totaux. */
interface ConsommationDistante {
  periode: string
  jours: Array<{ date: string; montant: number; vcpuHeures?: number }>
  total: number
  prevision?: number
  totalMoisPrecedent?: number
}

/** `GET /facturation/ventilation?axe=` — la forme des barres de répartition. */
interface VentilationDistante {
  axe: string
  lignes: Array<{ label: string; montant: number; pct: number }>
  total: number
}

/**
 * `GET /facturation/factures/{id}/pdf` : le contrat annonce `{ url, expire }`,
 * le backend local renvoie le PDF lui-même. On accepte les deux — un lien
 * s’ouvre, un binaire se télécharge — pour que le bouton fasse ce qu’il dit.
 * Passe par `fetch` directement : `requete()` ne lit que du JSON.
 */
async function telechargerPdfFacture(id: string, nomFichier: string): Promise<void> {
  const session = lireSession()
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
  const reponse = await fetch(`${base}/facturation/factures/${encodeURIComponent(id)}/pdf`, {
    headers: {
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session?.organisationActive ? { 'X-Organisation-Id': session.organisationActive } : {}),
    },
  })
  if (!reponse.ok) throw new ApiError(reponse.status, await reponse.json().catch(() => ({})))
  if ((reponse.headers.get('content-type') ?? '').includes('application/json')) {
    const { url } = (await reponse.json()) as { url?: string }
    if (url) window.open(url, '_blank', 'noopener')
    return
  }
  const url = URL.createObjectURL(await reponse.blob())
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  lien.click()
  URL.revokeObjectURL(url)
}

export default function Facturation() {
  const maintenant = useMaintenant()
  const { autorise, refus, perm, organisations, organisationId } = useApp()
  const orgActive = organisations.find((o) => o.id === organisationId) ?? organisations[0]
  const nomOrg = orgActive?.nom ?? ORG_COURANTE.nom
  const executer = useOperation()
  const lesFactures = useCollection<Invoice>('factures', FACTURES)
  const souscriptions = useCollection<Subscription>('souscriptions', SOUSCRIPTIONS)
  const lesDevis = useCollection<Devis>('devis', DEVIS)
  const moyens = useCollection<MoyenEnregistre>('moyens-paiement', MOYENS)
  // Catalogue réel : un tarif changé côté /admin/catalogue doit se refléter
  // dans les suggestions faites au client, pas seulement dans l'admin.
  const offresReelles = useCollection<Offer>('offres', OFFRES)
  // Le backend nomme les mêmes champs autrement (`type`, `defaut`) : on
  // normalise une fois pour que l’onglet lise une seule forme.
  const moyensNorm = moyens.items.map((m) => ({
    ...m,
    moyen: m.moyen ?? m.type ?? ('virement' as MoyenPaiement),
    principal: m.principal ?? m.defaut ?? false,
  }))
  const [onglet, setOnglet] = useState('apercu')
  const [facture, setFacture] = useState<string | null>(null)
  // En mode API, la consommation du mois et les ventilations viennent du
  // backend ; un `424` (comptage amont muet) se dit dans un bandeau daté au
  // lieu d’afficher des graines dont on ne sait plus de quand elles datent.
  const { donnees: consommationDistante, degrade: degradeConsommation } =
    useLectureDegradable<ConsommationDistante>('/facturation/consommation')
  const { donnees: ventilationFamilles } = useLectureDegradable<VentilationDistante>(
    '/facturation/ventilation',
    { axe: 'famille' },
  )
  const { donnees: ventilationEspaces } = useLectureDegradable<VentilationDistante>(
    '/facturation/ventilation',
    { axe: 'espace' },
  )
  const { donnees: ventilationApplications } = useLectureDegradable<VentilationDistante>(
    '/facturation/ventilation',
    { axe: 'application' },
  )
  const joursConso = consommationDistante?.jours ?? CONSOMMATION_JOURS
  const periodeConso = consommationDistante?.periode ?? '2026-08'
  const ventilation =
    ventilationFamilles?.lignes.map((l) => ({ famille: l.label, montant: l.montant, pct: l.pct })) ??
    VENTILATION_DEPENSE
  const [envoiMensuel, setEnvoiMensuel] = useState(true)
  const [inclureNonAffecte, setInclureNonAffecte] = useState(true)

  const peutVoir = perm('invoice.view') !== 'none'
  // En mode API le backend filtre déjà par organisation (et ses identifiants
  // sont inconnus du jeu local) : on lit la collection telle quelle.
  const enApi = estActif()
  const factures = enApi ? lesFactures.items : lesFactures.items.filter((f) => f.orgId === ORG_COURANTE.id)
  const abonnements = enApi ? souscriptions.items : SOUSCRIPTIONS
  const devisVisibles = enApi ? lesDevis.items : DEVIS
  const impayees = factures.filter((f) => f.statut === 'impayee')
  const enCours = factures.find((f) => f.statut === 'brouillon')
  const detail = factures.find((f) => f.id === facture)

  const consommeMois =
    consommationDistante?.total ?? joursConso.reduce((a, j) => a + j.montant, 0)
  const projete =
    consommationDistante?.prevision ??
    Math.round((consommeMois / Math.max(1, joursConso.length)) * 31)
  const somme = (s: Subscription) => s.quantite * s.prixApplique

  /** Règlement d'une facture : le job simule l'encaissement du prestataire. */
  const regler = (f: Invoice) =>
    executer({
      action: 'payment.update',
      titre: `Règlement de ${f.numero} lancé`,
      detail: `${money(f.total)} · moyen principal : ${MOYEN_LABEL[moyensNorm.find((m) => m.principal)?.moyen ?? 'virement']}`,
      appel: () =>
        requete(`/facturation/factures/${encodeURIComponent(f.id)}/paiement`, {
          methode: 'POST',
          corps: { moyenId: moyensNorm.find((m) => m.principal)?.id },
        }),
      job: {
        type: 'facture.paiement',
        label: `Règlement ${f.numero}`,
        etapes: ['Initier le paiement', 'Attendre la confirmation du prestataire', 'Rapprocher la facture'],
        dureeEtapeMs: 1100,
      },
      effetFinal: () => {
        lesFactures.modifier(f.id, { statut: 'payee' })
        lesFactures.recharger()
      },
    })

  const masque = (v: string) => (peutVoir ? v : '•••')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Facturation' }]}
        titre="Facturation"
        sousTitre="Ce que vous consommez, ce que ça coûte, et où ça part dans votre organisation. Les montants sont en francs CFA, la TVA de 18 % détaillée séparément, et l’usage du mois en cours calculé au prorata jour par jour."
        actions={
          <GatedAction autorise={autorise('invoice.view')} message={refus('invoice.view')}>
            <BoutonAction
              libelle="Exporter la période"
              size="md"
              icone={<Download size={14} />}
              operation={{
                action: 'invoice.view',
                titre: 'Export de la période préparé',
                detail: 'Consommation jour par jour, au format CSV, pour votre tableur.',
                // `POST /facturation/consommation/export` journalise l’export côté
                // audit (`202`), mais l’URL qu’il renvoie (`/travaux/{id}/export`)
                // ne correspond à aucune route réelle — `travaux/router.py` ne sert
                // que lecture/relance/annulation d’un travail, jamais un fichier.
                // Un clic ouvrait donc systématiquement un 404. Le navigateur sait
                // déjà produire ce CSV lui-même à partir des données chargées :
                // même patron que `DataTable`/`telechargerCsv` ailleurs dans
                // l’appli, pas de fichier fantôme à faire fabriquer par le serveur.
                appel: () =>
                  requete('/facturation/consommation/export', {
                    methode: 'POST',
                    corps: { periode: periodeConso, format: 'csv', axe: 'famille' },
                  }).then(() => {
                    telechargerCsv(
                      `consommation-${periodeConso}`,
                      ['Date', 'Montant (FCFA)', 'vCPU-heures'],
                      joursConso.map((j) => [j.date, j.montant, j.vcpuHeures ?? 0]),
                    )
                  }),
              }}
            />
          </GatedAction>
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {nomOrg}
            </Badge>
            <Badge tone="neutral" size="sm">
              {consommationDistante
                ? `Période ${periodeConso} · ${joursConso.length} jour${joursConso.length > 1 ? 's' : ''} relevés`
                : 'Période du 1er au 19 août 2026'}
            </Badge>
            {impayees.length > 0 && (
              <Badge tone="err" dot size="sm">
                {impayees.length} facture impayée
              </Badge>
            )}
          </>
        }
      />

      {!peutVoir && (
        <Callout ton="warn" titre="Votre rôle ne donne pas accès aux montants">
          La facturation est réservée aux rôles Administrateur d’organisation et Responsable
          facturation. Votre consommation technique reste visible depuis l’observabilité, sans les
          montants.
        </Callout>
      )}

      {degradeConsommation && (
        <Callout ton="warn" titre="Le comptage de consommation ne répond pas">
          L’intégration {degradeConsommation.integration ?? 'de comptage'} est indisponible : les
          montants affichés sont ceux du dernier relevé connu
          {degradeConsommation.dateDonnees ? `, du ${dateCourte(degradeConsommation.dateDonnees)}` : ''}.
          Rien n’est perdu, la facture sera établie sur la mesure réelle.
        </Callout>
      )}

      {impayees.length > 0 && peutVoir && (
        <Callout ton="err" titre={`Une facture de ${money(impayees[0].total)} est en retard`}>
          La facture {impayees[0].numero}
          {impayees[0].echeance ? `, échue le ${dateCourte(impayees[0].echeance)},` : ''} n’est pas
          réglée. Nous ne suspendons rien avant un rappel écrit et un délai de quinze jours : vos
          ressources tournent normalement. Si le règlement pose un problème, dites-le nous — un
          échelonnement vaut mieux qu’une suspension pour tout le monde.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Consommé ce mois"
          valeur={masque(money(consommeMois))}
          detail={
            consommationDistante
              ? `Du ${dateCourte(joursConso[0]?.date ?? periodeConso)} au ${dateCourte(joursConso[joursConso.length - 1]?.date ?? periodeConso)}, au prorata`
              : 'Du 1er au 19 août, au prorata'
          }
          serie={joursConso.map((j) => j.montant)}
        />
        <StatTile
          libelle="Projection fin de mois"
          valeur={masque(money(projete))}
          ton="violet"
          detail="À rythme constant"
        />
        <StatTile
          libelle="Engagement mensuel"
          // `abonnements` vient déjà du backend en mode API (`useCollection`
          // plus haut) : sommer les souscriptions réelles plutôt que relire
          // `SYNTHESE_CLIENT.depenseMois` (mock) évite l’incohérence vue en
          // direct sur dev01 — « 214 500 FCFA » affiché à côté de « 0
          // souscriptions actives » pour une organisation qui n’en a aucune.
          valeur={masque(money(abonnements.reduce((a, s) => a + somme(s), 0)))}
          detail={`${abonnements.length} souscriptions actives`}
        />
        <StatTile
          libelle="Variation sur 30 jours"
          // Le backend ne renvoie pas encore de total du mois précédent
          // (`totalMoisPrecedent` reste à `0` dans `metrologie.consommation`) :
          // afficher une variation calculée sur le mock en mode API la
          // ferait passer pour un fait. Masqué plutôt que fabriqué, même
          // discipline que les autres champs sans contrepartie backend.
          valeur={
            consommationDistante
              ? '—'
              : masque(
                  `+ ${pct(
                    Math.round(
                      ((SYNTHESE_CLIENT.depenseMois - SYNTHESE_CLIENT.depenseMoisPrecedent) /
                        SYNTHESE_CLIENT.depenseMoisPrecedent) *
                        1000,
                    ) / 10,
                    1,
                  )}`,
                )
          }
          ton={consommationDistante ? 'neutral' : 'warn'}
          detail={
            consommationDistante
              ? 'Non disponible : le mois précédent n’est pas encore comparé.'
              : 'Croissance du stockage objet et d’un nouveau service'
          }
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'apercu' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                titre="Consommation quotidienne"
                sousTitre="Chaque barre représente une journée. Un pic isolé s’explique généralement par une opération ponctuelle — une restauration, un transfert massif."
              />
              <div className="flex items-end gap-1">
                {joursConso.map((j) => {
                  const max = Math.max(1, ...joursConso.map((x) => x.montant))
                  return (
                    <span
                      key={j.date}
                      className="group relative flex-1"
                      title={`${dateCourte(j.date)} · ${money(j.montant)} · ${num(j.vcpuHeures ?? 0)} vCPU-heures`}
                    >
                      <span
                        className={cn(
                          'block rounded-t-sm transition-colors',
                          j.montant > max * 0.98 ? 'bg-p-800' : 'bg-p-600 group-hover:bg-p-700',
                        )}
                        style={{ height: `${20 + (j.montant / max) * 120}px` }}
                      />
                    </span>
                  )
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10.5px] text-g-500">
                <span>{joursConso[0] ? dateCourte(joursConso[0].date) : '1er août'}</span>
                <span>
                  {joursConso[joursConso.length - 1]
                    ? dateCourte(joursConso[joursConso.length - 1].date)
                    : '19 août'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-g-100 pt-4 sm:grid-cols-4">
                <div>
                  <MicroLabel className="text-g-500">Moyenne journalière</MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ink">
                    {masque(money(Math.round(consommeMois / Math.max(1, joursConso.length))))}
                  </p>
                </div>
                <div>
                  <MicroLabel className="text-g-500">Jour le plus coûteux</MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ink">
                    {masque(money(Math.max(0, ...joursConso.map((j) => j.montant))))}
                  </p>
                  {/* Anecdote propre au jeu de données maquette : n'a aucun sens une fois
                      les vraies journées de consommation chargées. */}
                  {!consommationDistante && (
                    <p className="text-[10.5px] text-g-500">Restauration de test du 19 août</p>
                  )}
                </div>
                <div>
                  <MicroLabel className="text-g-500">vCPU-heures cumulées</MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ink">
                    {num(joursConso.reduce((a, j) => a + (j.vcpuHeures ?? 0), 0))}
                  </p>
                </div>
                <div>
                  <MicroLabel className="text-g-500">
                    {consommationDistante ? 'Consommé à date' : 'Prorata au 19 août'}
                  </MicroLabel>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-ink">
                    {masque(
                      money(consommationDistante ? consommeMois : prorata(SYNTHESE_CLIENT.depenseMois, 19)),
                    )}
                  </p>
                  <p className="text-[10.5px] text-g-500">
                    {consommationDistante
                      ? `Sur ${joursConso.length} jour${joursConso.length > 1 ? 's' : ''} relevés`
                      : 'Sur 31 jours'}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader titre="Ventilation par famille" sousTitre="Mois en cours." />
              <StackedBar
                segments={ventilation.map((v, i) => ({
                  label: v.famille,
                  valeur: v.montant,
                  couleur: COULEURS[i % COULEURS.length],
                }))}
              />
              <div className="mt-4 space-y-1.5 border-t border-g-100 pt-3.5">
                {ventilation.map((v, i) => (
                  <div key={v.famille} className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: COULEURS[i % COULEURS.length] }}
                      />
                      <span className="truncate text-[12px] text-g-700">{v.famille}</span>
                    </span>
                    <span className="tnum shrink-0 text-[12px]">
                      <span className="font-semibold text-ink">{masque(money(v.montant))}</span>
                      <span className="ml-1.5 text-g-500">{pct(v.pct, 1)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {enCours && (
            <Card>
              <CardHeader
                titre="Facture en préparation"
                sousTitre={`${enCours.periode} — émise le 1er septembre`}
                actions={<Badge tone="info" size="sm">Brouillon</Badge>}
              />
              <TableLignes facture={enCours} peutVoir={peutVoir} />
              <Callout ton="info" className="mt-4" titre="Une facture en brouillon peut encore bouger">
                Les lignes à l’usage — stockage, transfert sortant, sauvegardes — continuent
                d’augmenter jusqu’au dernier jour du mois. Les lignes d’abonnement, elles, sont déjà
                définitives.
              </Callout>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Callout ton="violet" titre="Nous facturons ce que vous consommez, pas ce que vous réservez">
              Une machine arrêtée ne consomme ni processeur ni mémoire : vous ne payez que son disque.
              Un compartiment vidé cesse d’être facturé le jour même. Un siège de service managé
              libéré est décompté au prorata. Il n’y a pas de facturation à la réservation dissimulée
              dans nos grilles.
            </Callout>
            <Callout ton="info" titre="Le transfert sortant est plafonné">
              Au-delà du forfait inclus dans votre offre, le transfert sortant est facturé, mais son
              montant mensuel est plafonné à 15 % de votre abonnement. Un pic de trafic ne peut donc
              pas produire une facture surprise disproportionnée — c’est écrit au contrat, pas
              seulement une intention.
            </Callout>
          </div>
        </div>
      )}

      {onglet === 'factures' && (
        <Card padding={false}>
          <div className="p-4">
            <DataTable<Invoice>
              lignes={peutVoir ? factures : []}
              exportable
              placeholderRecherche="Rechercher une facture…"
              filtres={[
                {
                  id: 'statut',
                  libelle: 'Statut',
                  options: [
                    { value: 'tous', label: 'Tous les statuts' },
                    { value: 'payee', label: 'Payée' },
                    { value: 'impayee', label: 'Impayée' },
                    { value: 'brouillon', label: 'Brouillon' },
                    { value: 'emise', label: 'Émise' },
                  ],
                },
              ]}
              selection={(l, fid, val) => (fid === 'statut' ? l.statut === val : true)}
              colonnes={[
                {
                  id: 'numero',
                  entete: 'Numéro',
                  cle: (f) => f.numero,
                  rendu: (f) => (
                    <span className="flex items-center gap-2">
                      <FileText size={13} className="shrink-0 text-p-700" />
                      <span className="font-mono text-[12.5px] font-semibold text-ink">
                        {f.numero}
                      </span>
                    </span>
                  ),
                },
                {
                  id: 'periode',
                  entete: 'Période',
                  cle: (f) => f.periode,
                  rendu: (f) => <span className="text-[12px] text-g-700">{f.periode}</span>,
                },
                {
                  id: 'lignes',
                  entete: 'Lignes',
                  aligne: 'center',
                  cle: (f) => f.lignes.length,
                  masquable: true,
                  rendu: (f) => (
                    <span className="tnum text-[12px] text-g-700">{f.lignes.length}</span>
                  ),
                },
                {
                  id: 'echeance',
                  entete: 'Échéance',
                  cle: (f) => f.echeance ?? '',
                  rendu: (f) =>
                    f.echeance ? (
                      <span
                        className={cn(
                          'text-[11.5px]',
                          f.statut === 'impayee' ? 'font-semibold text-err' : 'text-g-700',
                        )}
                      >
                        {dateCourte(f.echeance)}
                        {f.statut === 'impayee' && (
                          <span className="block text-[10px]">{relatif(f.echeance, maintenant)}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-g-500">—</span>
                    ),
                },
                {
                  id: 'ht',
                  entete: 'Hors taxes',
                  aligne: 'right',
                  cle: (f) => f.sousTotal,
                  masquable: true,
                  rendu: (f) => (
                    <span className="tnum text-[12px] text-g-700">{money(f.sousTotal)}</span>
                  ),
                },
                {
                  id: 'total',
                  entete: 'Total TTC',
                  aligne: 'right',
                  cle: (f) => f.total,
                  rendu: (f) => (
                    <span className="tnum text-[12.5px] font-bold text-ink">
                      {money(f.total, f.devise)}
                    </span>
                  ),
                },
                {
                  id: 'statut',
                  entete: 'Statut',
                  cle: (f) => f.statut,
                  rendu: (f) => (
                    <Badge tone={TON_STATUT[f.statut]} dot size="sm">
                      {LIBELLE_STATUT[f.statut]}
                    </Badge>
                  ),
                },
                {
                  id: 'moyen',
                  entete: 'Règlement',
                  cle: (f) => f.moyen ?? '',
                  masquable: true,
                  rendu: (f) => (
                    <span className="text-[11.5px] text-g-700">
                      {f.moyen ? MOYEN_LABEL[f.moyen] : '—'}
                    </span>
                  ),
                },
                {
                  id: 'actions',
                  entete: '',
                  aligne: 'right',
                  rendu: (f) => (
                    <span className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setFacture(f.id)}>
                        Détail
                      </Button>
                      <BoutonAction
                        libelle="PDF"
                        variant="ghost"
                        icone={<Download size={12} />}
                        operation={{
                          action: 'invoice.view',
                          ton: 'info',
                          titre: `Facture ${f.numero} téléchargée`,
                          detail: `${money(f.total)} · TVA détaillée séparément`,
                          appel: () => telechargerPdfFacture(f.id, `${f.numero}.pdf`),
                        }}
                      />
                      {f.statut === 'impayee' && (
                        <GatedAction
                          autorise={autorise('payment.update')}
                          message={refus('payment.update')}
                        >
                          <span className="flex items-center gap-1.5">
                            {estActif() && (
                              <BoutonPaiementPaystack
                                factureId={f.id}
                                onSuccess={() => lesFactures.recharger()}
                              />
                            )}
                            <Button size="sm" variant="secondary" onClick={() => regler(f)}>
                              Régler
                            </Button>
                          </span>
                        </GatedAction>
                      )}
                    </span>
                  ),
                },
              ]}
              vide={
                peutVoir
                  ? {
                      titre: 'Aucune facture',
                      phrase: 'Votre première facture sera émise le 1er du mois prochain.',
                    }
                  : {
                      titre: 'Rôle insuffisant',
                      phrase:
                        'La consultation des factures est réservée aux rôles Administrateur d’organisation et Responsable facturation.',
                      action: { libelle: 'Voir les membres', href: '/app/membres' },
                    }
              }
            />
          </div>
        </Card>
      )}

      {onglet === 'souscriptions' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Souscriptions actives"
                sousTitre="Une souscription est un engagement mensuel ou annuel. L’usage au-delà du forfait s’ajoute séparément, à la consommation."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Souscription', 'Type', 'Quantité', 'Prix appliqué', 'Montant', 'Depuis', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {abonnements.map((s) => (
                    <tr key={s.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="block text-[12.5px] font-semibold text-ink">
                          {s.cible.label}
                        </span>
                        <span className="block font-mono text-[10.5px] text-g-500">
                          {s.cible.ref}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap items-center gap-1">
                          <Badge tone={s.cible.type === 'offer' ? 'violet' : 'accent'} size="sm">
                            {s.cible.type === 'offer' ? 'Offre' : 'Service managé'}
                          </Badge>
                          <Badge tone={s.periodicite === 'annuelle' ? 'ok' : 'neutral'} size="sm">
                            {s.periodicite === 'annuelle' ? 'Annuelle · −15 %' : 'Mensuelle'}
                          </Badge>
                        </span>
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{s.quantite}</td>
                      <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                        {masque(money(s.prixApplique))}
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] font-bold text-ink">
                        {masque(money(somme(s)))}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                        {dateCourte(s.debut)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                        <BoutonFormulaire
                          libelle="Modifier"
                          variant="ghost"
                          action="payment.update"
                          titre={`Modifier la souscription ${s.cible.label}`}
                          description="La modification prend effet au prorata du mois en cours. Une réduction de quantité s’applique à la prochaine échéance."
                          champs={[
                            { id: 'quantite', label: 'Quantité', type: 'nombre', demi: true, min: 1 },
                            {
                              id: 'periodicite',
                              label: 'Périodicité',
                              type: 'select',
                              demi: true,
                              options: [
                                { value: 'mensuelle', label: 'Mensuelle' },
                                { value: 'annuelle', label: 'Annuelle · deux mois offerts' },
                              ],
                            },
                          ]}
                          valeursDepart={{ quantite: s.quantite, periodicite: s.periodicite }}
                          complement={(v) => (
                            <EstimationModification
                              cible={s.cible}
                              prixApplique={s.prixApplique}
                              quantite={Number(v.quantite) || s.quantite}
                              periodicite={
                                String(v.periodicite) === 'annuelle' ? 'annuelle' : 'mensuelle'
                              }
                            />
                          )}
                          operation={(v) => ({
                            titre: `Souscription ${s.cible.label} modifiée`,
                            detail: `${v.quantite} × ${money(s.prixApplique)} · ${v.periodicite === 'annuelle' ? 'annuelle' : 'mensuelle'}`,
                            appel: () =>
                              modifierRessource('/facturation/souscriptions', s.id, {
                                quantite: Number(v.quantite),
                                periodicite: v.periodicite,
                              }),
                            effet: () =>
                              souscriptions.modifier(s.id, {
                                quantite: Number(v.quantite),
                                periodicite: v.periodicite as Subscription['periodicite'],
                              }),
                            effetFinal: () => souscriptions.recharger(),
                          })}
                        />
                        <BoutonAction
                          libelle="Résilier"
                          variant="ghost"
                          confirmation={{
                            ressource: s.cible.label,
                            titre: `Résilier ${s.cible.label} ?`,
                            pertes: [
                              'La facturation cesse à la fin du mois en cours',
                              'Les ressources liées sont libérées à l’échéance',
                              'L’historique de consommation reste consultable',
                            ],
                            libelleAction: 'Résilier',
                          }}
                          operation={{
                            action: 'payment.update',
                            ton: 'warn',
                            titre: `Souscription ${s.cible.label} résiliée`,
                            detail: 'Fin d’effet à la prochaine échéance.',
                            appel: () =>
                              supprimerRessource(
                                '/facturation/souscriptions',
                                s.id,
                                s.cible.label,
                              ),
                            effet: () => souscriptions.supprimer(s.id),
                            effetFinal: () => souscriptions.recharger(),
                          }}
                        />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-g-300 bg-p-050">
                    <td colSpan={4} className="px-3 py-2.5 text-right text-[13px] font-bold text-ink">
                      Engagement mensuel total
                    </td>
                    <td className="tnum px-3 py-2.5 text-[14px] font-bold text-p-700">
                      {masque(money(abonnements.reduce((a, s) => a + somme(s), 0)))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Économie possible en passant à l’annuel"
                sousTitre="15 % de remise sur les lignes d’abonnement, à périmètre identique."
              />
              <div className="space-y-2">
                {abonnements.filter((s) => s.periodicite === 'mensuelle').map((s) => {
                  const economie = Math.round(somme(s) * 12 * 0.15)
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-ink">
                          {s.cible.label}
                        </span>
                        <span className="block text-[11px] text-g-500">
                          {masque(moneyPerMonth(somme(s)))} actuellement
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tnum text-[12.5px] font-bold text-ok">
                          − {masque(money(economie))}/an
                        </span>
                        <BoutonAction
                          libelle="Passer à l’annuel"
                          variant="ghost"
                          operation={{
                            action: 'payment.update',
                            titre: `${s.cible.label} passe à l’engagement annuel`,
                            detail: `${masque(money(economie))} économisés sur douze mois. Une réduction de périmètre en cours d’année est ajustée à la baisse.`,
                            appel: () =>
                              modifierRessource('/facturation/souscriptions', s.id, {
                                periodicite: 'annuelle',
                              }),
                            effet: () => souscriptions.modifier(s.id, { periodicite: 'annuelle' }),
                            effetFinal: () => souscriptions.recharger(),
                          }}
                        />
                      </span>
                    </div>
                  )
                })}
              </div>
              <Callout ton="info" className="mt-4" titre="L’engagement annuel n’enferme pas">
                Si vous réduisez votre périmètre en cours d’année, nous ajustons à la baisse au
                prorata plutôt que de vous faire payer une capacité que vous n’utilisez plus. La
                remise reste acquise sur ce qui subsiste.
              </Callout>
            </Card>

            <Card>
              <CardHeader titre="Offres du catalogue" sousTitre="Ce qui pourrait compléter votre périmètre." />
              <div className="space-y-2">
                {offresReelles.items.filter(
                  (o) =>
                    o.statut === 'publiee' &&
                    !abonnements.some((s) => s.cible.ref === o.id) &&
                    !o.surDevis,
                )
                  .slice(0, 6)
                  .map((o) => (
                    <div
                      key={o.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-ink">{o.nom}</span>
                        <span className="block text-[11px] text-g-500">{o.specs}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tnum text-[12px] font-semibold text-ink">
                          {moneyPerMonth(o.prix)}
                        </span>
                        <ButtonLink size="sm" variant="ghost" href={`/offres/${o.code.toLowerCase()}`}>
                          Voir
                        </ButtonLink>
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'repartition' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Refacturer en interne, sans y passer une journée">
            La répartition suit vos étiquettes : centre de coût, projet, environnement. Chaque
            ressource porte les siennes, la ventilation se calcule seule. C’est la différence entre
            une refacturation interne réelle et un tableau reconstitué à la main tous les trimestres.
          </Callout>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Par Espace Cloud"
                sousTitre="Calcul, stockage et sauvegardes de chaque espace."
              />
              <BarresShowback
                lignes={ventilationEspaces?.lignes ?? SHOWBACK_ESPACES}
                couleur="bg-p-600"
                peutVoir={peutVoir}
              />
            </Card>

            <Card>
              <CardHeader
                titre="Par application"
                sousTitre="Environnements, composants, registre et transfert sortant."
              />
              <BarresShowback
                lignes={ventilationApplications?.lignes ?? SHOWBACK_APPLICATIONS}
                couleur="bg-p-400"
                peutVoir={peutVoir}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Rapport de refacturation"
              sousTitre="Généré chaque mois, envoyé aux responsables de centre de coût."
              actions={
                <BoutonAction
                  libelle="Générer maintenant"
                  icone={<TrendingUp size={13} />}
                  operation={{
                    action: 'invoice.view',
                    titre: 'Rapport de refacturation généré',
                    detail: 'Envoyé aux responsables de centre de coût, avec la ventilation par étiquette.',
                    job: {
                      type: 'showback.report',
                      label: 'Rapport de refacturation du mois',
                      etapes: [
                        'Agréger la consommation par étiquette',
                        'Composer le rapport',
                        'Notifier les responsables',
                      ],
                      dureeEtapeMs: 900,
                    },
                  }}
                />
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Grouper par">
                <Select defaultValue="centre-de-cout">
                  <option value="centre-de-cout">Centre de coût</option>
                  <option value="projet">Projet</option>
                  <option value="environnement">Environnement</option>
                  <option value="responsable">Responsable</option>
                </Select>
              </Field>
              <Field label="Format">
                <Select defaultValue="xlsx">
                  <option value="xlsx">Tableur</option>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </Select>
              </Field>
              <Field label="Marge de refacturation" hint="pourcentage ajouté au coût réel">
                <Input type="number" defaultValue={0} suffix="%" />
              </Field>
            </div>
            <div className="mt-3.5 space-y-3">
              <Switch
                checked={envoiMensuel}
                onChange={(v) =>
                  executer({
                    action: 'invoice.view',
                    titre: v ? 'Envoi mensuel activé' : 'Envoi mensuel coupé',
                    detail: v
                      ? 'Chaque responsable reçoit uniquement les lignes de son périmètre.'
                      : undefined,
                    effet: () => setEnvoiMensuel(v),
                  })
                }
                label="Envoyer automatiquement le 3 de chaque mois"
                description="Chaque responsable reçoit uniquement les lignes de son périmètre."
              />
              <Switch
                checked={inclureNonAffecte}
                onChange={(v) =>
                  executer({
                    action: 'invoice.view',
                    ton: v ? 'ok' : 'warn',
                    titre: v
                      ? 'Ligne « non affecté » incluse'
                      : 'Ligne « non affecté » masquée',
                    detail: v
                      ? undefined
                      : 'Ce qui n’est pas affecté disparaît du rapport — et cesse donc de diminuer.',
                    effet: () => setInclureNonAffecte(v),
                  })
                }
                label="Inclure les ressources sans étiquette dans une ligne « non affecté »"
                description="Rendre visible ce qui n’est pas affecté est le seul moyen de le faire diminuer."
              />
            </div>
            <Callout ton="warn" className="mt-4" titre="4,2 % de la dépense n’est pas affectée">
              Onze ressources ne portent pas d’étiquette de centre de coût. Rendre l’étiquette
              obligatoire depuis les paramètres empêcherait la création de nouvelles ressources non
              affectées, sans toucher aux existantes.
            </Callout>
          </Card>
        </div>
      )}

      {onglet === 'paiement' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Moyens de paiement"
              sousTitre="Nous acceptons les moyens réellement utilisés en Afrique de l’Ouest, pas seulement la carte internationale."
            />
            <div className="space-y-2">
              {moyensNorm.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 rounded-[6px] border px-3 py-2.5',
                    m.principal ? 'border-p-700 bg-p-050' : 'border-g-300',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-white text-p-700">
                      {m.moyen === 'carte' || m.moyen === 'virement' ? (
                        <CreditCard size={14} />
                      ) : (
                        <Smartphone size={14} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        {MOYEN_LABEL[m.moyen]}
                      </span>
                      <span className="block font-mono text-[11px] text-g-500">{m.detail}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {m.principal ? (
                      <Badge tone="violet" size="sm">
                        Principal
                      </Badge>
                    ) : (
                      <BoutonAction
                        libelle="Définir comme principal"
                        variant="ghost"
                        operation={{
                          action: 'payment.update',
                          titre: `${MOYEN_LABEL[m.moyen]} devient le moyen principal`,
                          detail: 'Les prochains prélèvements passeront par ce moyen.',
                          appel: () =>
                            modifierRessource('/facturation/moyens-paiement', m.id, { defaut: true }),
                          effet: () =>
                            moyens.modifierPlusieurs(
                              moyensNorm.map((x) => x.id),
                              (x) => ({ principal: x.id === m.id }),
                            ),
                          effetFinal: () => moyens.recharger(),
                        }}
                      />
                    )}
                      <BoutonAction
                        libelle="Retirer"
                        variant="ghost"
                        desactive={m.principal && moyensNorm.length > 1}
                        operation={{
                          action: 'payment.update',
                          ton: 'warn',
                          titre: `${MOYEN_LABEL[m.moyen]} retiré`,
                          detail: m.principal
                            ? 'Aucun moyen principal : les factures devront être réglées manuellement.'
                            : undefined,
                          // `DELETE /facturation/moyens-paiement/{id}` → `204`,
                          // sans confirmation : l’identifiant suffit.
                          appel: () => supprimerRessource('/facturation/moyens-paiement', m.id),
                          effet: () => moyens.supprimer(m.id),
                          effetFinal: () => moyens.recharger(),
                        }}
                      />
                  </span>
                </div>
              ))}
            </div>
            <BoutonFormulaire
              libelle="Ajouter un moyen de paiement"
              className="mt-3"
              action="payment.update"
              titre="Ajouter un moyen de paiement"
              description="Nous ne stockons ni numéro de carte complet ni code : le prestataire de paiement conserve les données, nous n’en gardons qu’un jeton."
              champs={[
                {
                  id: 'moyen',
                  label: 'Moyen',
                  type: 'select',
                  options: [
                    { value: 'orange_money', label: 'Orange Money' },
                    { value: 'wave', label: 'Wave' },
                    { value: 'mtn_momo', label: 'MTN MoMo' },
                    { value: 'prepaye', label: 'Porte-monnaie prépayé' },
                    { value: 'virement', label: 'Virement bancaire' },
                    { value: 'carte', label: 'Carte bancaire' },
                  ],
                },
                { id: 'reference', label: 'Référence', placeholder: 'numéro de téléphone, IBAN ou carte', obligatoire: true },
                { id: 'principal', label: 'En faire le moyen principal', type: 'switch', placeholder: 'Oui' },
              ]}
              valeursDepart={{ moyen: 'orange_money' }}
              libelleValider="Ajouter"
              operation={(v) => ({
                titre: `${MOYEN_LABEL[v.moyen as MoyenPaiement]} ajouté`,
                detail: v.principal ? 'Défini comme moyen principal.' : undefined,
                appel: () =>
                  creerRessource('/facturation/moyens-paiement', {
                    type: v.moyen,
                    numero: String(v.reference),
                    defaut: Boolean(v.principal),
                  }),
                effet: () => {
                  if (v.principal)
                    moyens.modifierPlusieurs(
                      moyensNorm.map((x) => x.id),
                      { principal: false },
                    )
                  moyens.creer({
                    id: moyens.identifiant('moy'),
                    moyen: v.moyen as MoyenPaiement,
                    detail: String(v.reference),
                    principal: Boolean(v.principal),
                  })
                },
                effetFinal: () => moyens.recharger(),
              })}
            />
            <Callout ton="info" className="mt-4" titre="Ce que nous ne stockons pas">
              Aucun numéro de carte complet, aucun cryptogramme, aucun code de confirmation mobile ne
              transite ni ne réside chez nous. Le paiement passe par notre prestataire agréé ; nous ne
              conservons qu’un jeton inutilisable ailleurs et les quatre derniers chiffres.
            </Callout>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader titre="Conditions de règlement" />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Devise contractuelle', valeur: 'Franc CFA (XOF)' },
                  { cle: 'TVA applicable', valeur: '18 % — Côte d’Ivoire' },
                  { cle: 'Délai de paiement', valeur: '30 jours date de facture' },
                  { cle: 'Émission des factures', valeur: 'Le 1er de chaque mois' },
                  { cle: 'Prélèvement automatique', valeur: 'Actif sur Orange Money, le 5' },
                  { cle: 'Pénalités de retard', valeur: 'Aucune avant 15 jours de retard' },
                  { cle: 'Suspension de service', valeur: 'Jamais avant rappel écrit et 15 jours' },
                ]}
              />
              <Callout ton="violet" className="mt-4" titre="Notre politique de suspension">
                Couper un service pour un retard de paiement de trois jours cause un dommage
                disproportionné à un client dont la trésorerie est simplement tendue. Nous
                n’intervenons qu’après un rappel écrit et un délai de quinze jours, et nous préférons
                toujours discuter d’un échelonnement.
              </Callout>
            </Card>

            <Card>
              <CardHeader titre="Historique des règlements" sousTitre="Douze derniers mois." />
              <div className="space-y-1.5">
                {factures
                  .filter((f) => f.statut === 'payee')
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-g-100 pb-1.5 last:border-0"
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-[12px] text-ink">{f.numero}</span>
                        <span className="ml-2 text-[10.5px] text-g-500">
                          {f.moyen ? MOYEN_LABEL[f.moyen] : '—'} · {f.periode}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[12px] font-semibold text-ink">
                        {masque(money(f.total, f.devise))}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'devis' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Devis"
                sousTitre="Un devis vaut engagement de prix jusqu’à sa date de validité. Son acceptation crée les souscriptions correspondantes."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Devis', 'Objet', 'Montant', 'Établi le', 'Valable jusqu’au', 'Statut', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {devisVisibles.map((d) => (
                    <tr key={d.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-ink">
                        {d.numero}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink">{d.objet}</td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] font-bold text-ink">
                        {masque(money(d.montant))}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                        {dateCourte(d.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                        {dateCourte(d.validite)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          tone={
                            d.statut === 'accepte'
                              ? 'ok'
                              : d.statut === 'refuse'
                                ? 'err'
                                : d.statut === 'expire'
                                  ? 'neutral'
                                  : 'info'
                          }
                          dot
                          size="sm"
                        >
                          {d.statut === 'accepte'
                            ? 'Accepté'
                            : d.statut === 'refuse'
                              ? 'Refusé'
                              : d.statut === 'expire'
                                ? 'Expiré'
                                : 'En attente'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <BoutonAction
                            libelle="PDF"
                            variant="ghost"
                            icone={<Download size={12} />}
                            operation={{
                              action: 'invoice.view',
                              ton: 'info',
                              titre: 'Devis téléchargé',
                              detail: `${d.numero} · valable jusqu’au ${dateCourte(d.validite)}`,
                              // Le backend porte `pdfUrl` sur le devis ; sans lui,
                              // le chemin maquette (notification) reste.
                              appel: (d as Devis & { pdfUrl?: string }).pdfUrl
                                ? () => {
                                    window.open(
                                      (d as Devis & { pdfUrl?: string }).pdfUrl,
                                      '_blank',
                                      'noopener',
                                    )
                                    return Promise.resolve()
                                  }
                                : undefined,
                            }}
                          />
                          {d.statut === 'envoye' && (
                            <GatedAction
                              autorise={autorise('payment.update')}
                              message={refus('payment.update')}
                            >
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  executer({
                                    action: 'payment.update',
                                    titre: `Devis ${d.numero} accepté`,
                                    detail:
                                      'Les souscriptions correspondantes sont créées et le provisionnement démarre.',
                                    appel: () =>
                                      requete(
                                        `/facturation/devis/${encodeURIComponent(d.id)}/acceptation`,
                                        { methode: 'POST', corps: {} },
                                      ),
                                    effet: () =>
                                      lesDevis.modifier(d.id, { statut: 'accepte' }),
                                    effetFinal: () => {
                                      lesDevis.recharger()
                                      souscriptions.recharger()
                                    },
                                    job: { workflow: 'devis.accept', cible: d.numero },
                                  })
                                }
                              >
                                Accepter
                              </Button>
                            </GatedAction>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Callout ton="info" titre="Demander un devis">
            Pour un périmètre important, un engagement pluriannuel, une architecture spécifique ou une
            reprise d’infrastructure existante, un devis nominatif est établi par nos équipes
            commerciales. Le simulateur public donne un ordre de grandeur ; le devis engage.
          </Callout>
        </div>
      )}

      <Drawer
        open={detail !== undefined}
        onClose={() => setFacture(null)}
        title={detail ? `Facture ${detail.numero}` : ''}
        size="lg"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TON_STATUT[detail.statut]} dot>
                {LIBELLE_STATUT[detail.statut]}
              </Badge>
              <Badge tone="neutral" size="sm">
                {detail.periode}
              </Badge>
              {detail.moyen && (
                <Badge tone="neutral" size="sm">
                  {MOYEN_LABEL[detail.moyen]}
                </Badge>
              )}
            </div>

            <TableLignes facture={detail} peutVoir={peutVoir} />

            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Total hors taxes', valeur: money(detail.sousTotal, detail.devise) },
                {
                  cle: `TVA ${detail.tvaPct} %`,
                  valeur: money(ventilationTva(detail.sousTotal, detail.tvaPct).tva, detail.devise),
                },
                { cle: 'Total TTC', valeur: money(detail.total, detail.devise) },
                { cle: 'Période', valeur: detail.periode },
                {
                  cle: 'Échéance',
                  valeur: detail.echeance ? dateCourte(detail.echeance) : 'Non applicable',
                },
                {
                  cle: 'Règlement',
                  valeur: detail.moyen ? MOYEN_LABEL[detail.moyen] : 'En attente',
                },
              ]}
            />

            <div className="flex flex-wrap gap-1.5">
              <BoutonAction
                libelle="Télécharger le PDF"
                size="md"
                icone={<Download size={13} />}
                operation={{
                  action: 'invoice.view',
                  ton: 'info',
                  titre: `Facture ${detail.numero} téléchargée`,
                  detail: `${money(detail.total)} · exemplaire opposable, horodaté`,
                  appel: () => telechargerPdfFacture(detail.id, `${detail.numero}.pdf`),
                }}
              />
              <BoutonAction
                libelle="Détail des lignes en CSV"
                variant="ghost"
                size="md"
                icone={<Download size={13} />}
                operation={{
                  action: 'invoice.view',
                  ton: 'info',
                  titre: 'Détail des lignes exporté',
                  detail: `${detail.lignes.length} ligne(s), avec l’étiquette de répartition de chacune.`,
                }}
              />
              {detail.statut === 'impayee' && (
                <GatedAction autorise={autorise('payment.update')} message={refus('payment.update')}>
                  <Button onClick={() => regler(detail)}>Régler maintenant</Button>
                </GatedAction>
              )}
            </div>

            <Callout ton="info" titre="Ce que la ventilation de la TVA signifie">
              La TVA de {detail.tvaPct} % s’applique aux prestations rendues en Côte d’Ivoire. Elle est
              intégralement reversée à l’administration fiscale ivoirienne, et récupérable si votre
              entreprise est assujettie. Le montant hors taxes ci-dessus est celui à retenir pour vos
              comparaisons de coûts.
            </Callout>
          </div>
        )}
      </Drawer>
    </div>
  )
}

function TableLignes({ facture, peutVoir }: { facture: Invoice; peutVoir: boolean }) {
  const { tva } = ventilationTva(facture.sousTotal, facture.tvaPct)
  const masque = (v: string) => (peutVoir ? v : '•••')
  return (
    <div className="overflow-x-auto rounded-[8px] border border-g-300">
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr className="border-b border-g-300 bg-g-050">
            {['Ligne', 'Référence', 'Quantité', 'Prix unitaire', 'Montant HT'].map((h) => (
              <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {facture.lignes.map((l, i) => (
            <tr key={`${l.ref}-${i}`} className="border-b border-g-100 last:border-0">
              <td className="px-3 py-2 text-[12px] text-ink">{l.libelle}</td>
              <td className="px-3 py-2 font-mono text-[10.5px] text-g-500">{l.ref}</td>
              <td className="tnum px-3 py-2 text-[12px] text-g-700">{num(l.quantite)}</td>
              <td className="tnum px-3 py-2 text-[12px] text-g-700">
                {masque(money(l.pu, facture.devise))}
              </td>
              <td className="tnum px-3 py-2 text-[12px] font-semibold text-ink">
                {masque(money(l.total, facture.devise))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-g-300 bg-g-050">
            <td colSpan={4} className="px-3 py-2 text-right text-[12px] text-g-700">
              Total hors taxes
            </td>
            <td className="tnum px-3 py-2 text-[12px] font-bold text-ink">
              {masque(money(facture.sousTotal, facture.devise))}
            </td>
          </tr>
          <tr className="bg-g-050">
            <td colSpan={4} className="px-3 py-2 text-right text-[12px] text-g-700">
              TVA {facture.tvaPct} %
            </td>
            <td className="tnum px-3 py-2 text-[12px] text-g-700">
              {masque(money(tva, facture.devise))}
            </td>
          </tr>
          <tr className="bg-p-050">
            <td colSpan={4} className="px-3 py-2 text-right text-[13px] font-bold text-ink">
              Total TTC
            </td>
            <td className="tnum px-3 py-2 text-[14px] font-bold text-p-700">
              {masque(money(facture.total, facture.devise))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * Aperçu de coût d’une modification de souscription, exigé avant validation.
 * En mode API, les sièges de service managé sont chiffrés par le backend
 * (`POST /facturation/estimation`, barème de sièges) ; le reste — offres dont
 * le backend ne connaît pas le prix — garde le calcul local (quantité × prix
 * appliqué, −15 % en annuel). Toute erreur distante retombe sur le local, sans
 * bruit : l’estimation ne doit jamais bloquer la saisie.
 */
function EstimationModification({
  cible,
  prixApplique,
  quantite,
  periodicite,
}: {
  cible: Subscription['cible']
  prixApplique: number
  quantite: number
  periodicite: 'mensuelle' | 'annuelle'
}) {
  const [totalDistant, setTotalDistant] = useState<number | null>(null)
  useEffect(() => {
    if (!estActif() || cible.type !== 'service') {
      setTotalDistant(null)
      return
    }
    let annule = false
    const minuteur = setTimeout(() => {
      requete<{ totalMensuel: number }>('/facturation/estimation', {
        methode: 'POST',
        corps: {
          type: 'siege',
          quantite,
          periodicite,
          specification: { nom: cible.label },
        },
      }).then(
        (r) => {
          if (!annule) setTotalDistant(r.totalMensuel)
        },
        () => {
          if (!annule) setTotalDistant(null)
        },
      )
    }, 400)
    return () => {
      annule = true
      clearTimeout(minuteur)
    }
  }, [cible.label, cible.type, quantite, periodicite])

  const mensuelLocal = quantite * prixApplique
  // Le total distant est déjà TTC (barème plateforme) : il ne repasse pas par
  // `CostPreview`, qui raisonne hors taxes et ajouterait la TVA une seconde fois.
  if (totalDistant !== null) {
    return (
      <div className="rounded-[8px] border border-p-300 bg-p-050 px-4 py-3">
        <p className="type-micro text-p-700">Impact estimé par la plateforme</p>
        <p className="tnum mt-1 text-[15px] font-bold text-ink">
          {money(totalDistant)}
          <span className="ml-1.5 text-[11px] font-normal text-g-500">
            / mois · {cible.label} × {quantite}
          </span>
        </p>
      </div>
    )
  }
  return (
    <CostPreview
      lignes={[
        {
          libelle: cible.label,
          detail: 'Quantité × prix appliqué, −15 % en annuel',
          montant: mensuelLocal,
          quantite,
        },
      ]}
      periodicite={periodicite}
    />
  )
}

function BarresShowback({  lignes,
  couleur,
  peutVoir,
}: {
  lignes: Array<{ label: string; montant: number; pct: number }>
  couleur: string
  peutVoir: boolean
}) {
  const max = Math.max(...lignes.map((l) => l.montant))
  return (
    <div className="space-y-2.5">
      {lignes.map((l) => (
        <div key={l.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-ink">
              {l.label}
            </span>
            <span className="tnum shrink-0 text-[12.5px]">
              <span className="font-bold text-ink">{peutVoir ? money(l.montant) : '•••'}</span>
              <span className="ml-1.5 text-g-500">{pct(l.pct, 1)}</span>
            </span>
          </div>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-g-100">
            <span
              className={cn('block h-full rounded-full', couleur)}
              style={{ width: `${(l.montant / max) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}
