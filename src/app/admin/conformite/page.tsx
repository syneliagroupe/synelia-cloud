'use client'

import { useState } from 'react'
import { CalendarClock, Download, FileCheck2, ShieldAlert, TestTubeDiagonal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, dureeMin, MAINTENANT, num, pct } from '@/lib/format'
import { telechargerCsv } from '@/lib/export'
import { CONFORMITE_PLATEFORME, EQUIPE_SYNELIA, ORGANISATIONS } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, requete } from '@/lib/api/client'

const ONGLETS = [
  { id: 'restauration', label: 'Tests de restauration' },
  { id: 'pra', label: 'Exercices de reprise' },
  { id: 'vulnerabilites', label: 'Vulnérabilités' },
  { id: 'audits', label: 'Audits' },
  { id: 'attestations', label: 'Attestations' },
]

/** Attestation produite à la demande — journalisée, avec son destinataire. */
interface AttestationGeneree {
  id: string
  date: string
  attestation: string
  org: string
  qui: string
  motif: string
}

const ATTESTATIONS_GENEREES: AttestationGeneree[] = [
  {
    id: 'gen-4',
    date: '2026-08-14',
    attestation: 'Résidence des données',
    org: 'ONECI',
    qui: 'Jean-Vincent Kassi',
    motif: 'Demande du régulateur — dossier de conformité',
  },
  {
    id: 'gen-3',
    date: '2026-08-02',
    attestation: 'Politique de sauvegarde',
    org: 'Cofina Digital',
    qui: 'Aïcha Bamba',
    motif: 'Commissaire aux comptes du client',
  },
  {
    id: 'gen-2',
    date: '2026-07-18',
    attestation: 'Résidence des données',
    org: 'Digital Business Africa',
    qui: 'Jean-Vincent Kassi',
    motif: 'Appel d’offres public',
  },
  {
    id: 'gen-1',
    date: '2026-07-04',
    attestation: 'Tests de restauration',
    org: 'AMUGA',
    qui: 'Marina Gbagbo',
    motif: 'Suite à l’échec de restauration de juin, à la demande du client',
  },
]

/** Ce que chaque attestation affirme, mot pour mot. Le « modèle » le montre. */
const MODELES_ATTESTATION: Record<string, { affirme: string[]; naffirme: string[] }> = {
  'Résidence des données': {
    affirme: [
      'Les données de l’organisation sont stockées sur les sites d’Abidjan et de Grand-Bassam, en Côte d’Ivoire.',
      'Aucune réplication n’est effectuée vers un site hors du territoire national.',
      'Les sauvegardes hors site restent sur le second site national.',
    ],
    naffirme: [
      'Aucune certification de souveraineté délivrée par un tiers — nous n’en avons pas.',
      'Aucun engagement sur la localisation des équipes d’un éditeur tiers dont la solution est exploitée.',
    ],
  },
  'Politique de sauvegarde': {
    affirme: [
      'La fréquence, la rétention, l’immuabilité et les destinations réellement appliquées à chaque ressource.',
      'La date et le résultat du dernier test de restauration exécuté sur un échantillon de ces ressources.',
    ],
    naffirme: [
      'Aucune garantie de restaurabilité des ressources non testées : l’attestation nomme celles qui l’ont été.',
    ],
  },
  'Disponibilité constatée': {
    affirme: [
      'La disponibilité mensuelle mesurée par composant, comparée à l’engagement contractuel.',
      'Les incidents ayant entraîné une indisponibilité, avec leur durée constatée.',
    ],
    naffirme: [
      'Aucune projection sur les mois à venir.',
      'Aucune exclusion des fenêtres de maintenance planifiée : elles sont comptées et affichées comme telles.',
    ],
  },
  'Conformité 3-2-1': {
    affirme: [
      'L’état de la règle trois copies, deux supports, une hors site, ressource par ressource.',
      'La liste nominative des ressources qui ne la respectent pas, et pourquoi.',
    ],
    naffirme: [
      'Aucune conformité globale déclarée quand une seule ressource est en écart : le tableau montre les écarts.',
    ],
  },
}

const PLANIFICATION = [
  {
    id: 'tirage',
    label: 'Tirage au sort de l’échantillon',
    description:
      'Non désactivable. Choisir les ressources à tester revient à ne tester que celles dont on est sûr.',
    defaut: true,
    fige: true,
  },
  {
    id: 'chaque-client',
    label: 'Inclure au moins une ressource de chaque client',
    description:
      'Sur un cycle de trois mois. Un client dont rien n’a jamais été testé n’a aucune garantie.',
    defaut: true,
    fige: false,
  },
  {
    id: 'notifier',
    label: 'Notifier le client du résultat',
    description:
      'Y compris en cas d’échec. Un client a le droit de savoir que sa sauvegarde n’était pas restaurable, même si nous l’avons corrigé depuis.',
    defaut: true,
    fige: false,
  },
  {
    id: 'ticket',
    label: 'Ouvrir un ticket interne sur chaque échec',
    description:
      'Avec analyse de cause et correction documentée. Un échec non analysé se reproduira.',
    defaut: true,
    fige: false,
  },
]

export default function Conformite() {
  const { autorise, refus } = useApp()
  const generees = useCollection<AttestationGeneree>('attestations-generees', ATTESTATIONS_GENEREES)
  const executer = useOperation()
  const [onglet, setOnglet] = useState('restauration')
  const [attestation, setAttestation] = useState<string | null>(null)
  const [modele, setModele] = useState<string | null>(null)
  const [partParc, setPartParc] = useState(10)
  const [profondeur, setProfondeur] = useState('complet')
  const [reglages, setReglages] = useState<Record<string, boolean>>(
    Object.fromEntries(PLANIFICATION.map((r) => [r.id, r.defaut])),
  )
  const [orgAttestation, setOrgAttestation] = useState('')
  const [duAttestation, setDuAttestation] = useState('2026-01-01')
  const [auAttestation, setAuAttestation] = useState('2026-08-19')
  const [destinataire, setDestinataire] = useState('')
  const [motif, setMotif] = useState('')
  const [signature, setSignature] = useState(true)
  const [notifierOrg, setNotifierOrg] = useState(true)

  const genererAttestation = () => {
    if (!attestation) return
    // Pas d’appel : `POST /attestations/{modele}` génère un modèle du
    // backend (identifiants inconnus d’ici), pas une ligne de ce journal —
    // et `GET /attestations` ne rend pas cette forme. La génération reste
    // locale, comme la planification des tests et le rapport CSV — mais
    // seulement en mode maquette : en mode API, `generees.creer()` postait
    // réellement sur `POST /attestations` (bare), une route qui n’existe pas
    // (seul `POST /attestations/{attestationId}` existe) — un `405` silencieux
    // (`.then(recharger, recharger)` avale l’échec) derrière un toast de succès.
    executer({
      action: 'compliance.export',
      titre: `Attestation « ${attestation} » générée`,
      detail: signature
        ? 'Le document signé est disponible au téléchargement. La génération est journalisée dans l’audit.'
        : 'Document produit sans signature électronique : le destinataire devra nous contacter pour en vérifier l’authenticité.',
      effet: () => {
        if (estActif()) return
        generees.creer({
          id: generees.identifiant('gen'),
          date: MAINTENANT.slice(0, 10),
          attestation,
          org: orgAttestation
            ? (ORGANISATIONS.find((o) => o.id === orgAttestation)?.nom ?? orgAttestation)
            : 'Toute la plateforme',
          qui: EQUIPE_SYNELIA[0].nom,
          motif: motif.trim() || destinataire.trim() || 'Motif non renseigné',
        })
      },
    })
    setDestinataire('')
    setMotif('')
    setAttestation(null)
  }

  const c = CONFORMITE_PLATEFORME
  const testsCourants = c.testsRestauration[0]
  const tauxSucces = Math.round((testsCourants.succes / Math.max(1, testsCourants.executes)) * 1000) / 10
  const praEchoues = c.exercicesPra.filter((e) => !e.succes)
  const cveOuvertes = c.cve.reduce((a, x) => a + x.ouvertes, 0)
  const cveCritiques = c.cve.find((x) => x.gravite === 'critique')?.ouvertes ?? 0
  const constatsOuverts = c.audits.reduce((a, x) => a + x.ouverts, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Conformité' }]}
        titre="Conformité"
        sousTitre="Tests de restauration réellement exécutés, exercices de reprise avec leurs échecs, vulnérabilités ouvertes, constats d’audit non clos. Un tableau de conformité qui n’affiche que du vert n’a aucune valeur : celui-ci montre aussi ce qui ne va pas."
        actions={
          <BoutonAction
            libelle="Rapport de conformité"
            size="md"
            icone={<Download size={14} />}
            operation={{
              action: 'compliance.export',
              titre: 'Rapport de conformité téléchargé',
              detail:
                'Les écarts y figurent au même titre que les indicateurs verts : un rapport qui ne montre que le vert ne vaut rien devant un auditeur.',
              effet: () =>
                telechargerCsv(
                  'conformite-plateforme-2026-08',
                  ['Domaine', 'Indicateur', 'Valeur', 'Écart'],
                  [
                    ...c.testsRestauration.map((t) => [
                      'Tests de restauration',
                      t.periode,
                      `${t.succes}/${t.executes} réussis`,
                      String(t.executes - t.succes),
                    ]),
                    ...c.exercicesPra.map((e) => [
                      'Exercices de reprise',
                      `${e.plan} — ${e.org}`,
                      `${dureeMin(e.rtoConstate)} constatées pour ${dureeMin(e.rtoCible)} visées`,
                      e.succes ? '0' : '1',
                    ]),
                    ...c.cve.map((v) => [
                      'Vulnérabilités',
                      v.gravite,
                      `${v.ouvertes} ouvertes`,
                      String(v.ouvertes),
                    ]),
                    ...c.audits.map((a) => [
                      'Audits',
                      `${a.type} — ${a.perimetre}`,
                      `${a.constats} constats`,
                      String(a.ouverts),
                    ]),
                  ],
                ),
            }}
          />
        }
        meta={
          <>
            <Badge tone={cveCritiques === 0 ? 'ok' : 'err'} dot size="sm">
              {cveCritiques === 0 ? 'Aucune vulnérabilité critique ouverte' : `${cveCritiques} critique ouverte`}
            </Badge>
            <Badge tone={praEchoues.length === 0 ? 'ok' : 'warn'} size="sm">
              {praEchoues.length === 0
                ? 'Tous les exercices réussis'
                : `${praEchoues.length} exercice sous l’objectif`}
            </Badge>
            <Badge tone={constatsOuverts === 0 ? 'ok' : 'warn'} size="sm">
              {constatsOuverts} constat{constatsOuverts > 1 ? 's' : ''} d’audit ouvert
              {constatsOuverts > 1 ? 's' : ''}
            </Badge>
          </>
        }
      />

      {praEchoues.length > 0 && (
        <Callout ton="warn" titre={`${praEchoues.length} exercice de reprise a dépassé son objectif`}>
          {praEchoues
            .map(
              (e) =>
                `${e.org} (${e.plan}) — ${dureeMin(e.rtoConstate)} constatées pour ${dureeMin(e.rtoCible)} engagées`,
            )
            .join(' · ')}
          . Nous le publions plutôt que de le taire : un objectif de reprise dépassé lors d’un exercice
          est une information précieuse, et bien préférable à le découvrir lors d’un vrai sinistre.
          L’écart a été analysé et un plan de correction est en cours.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          libelle="Tests de restauration du mois"
          valeur={`${testsCourants.executes}/${testsCourants.planifies}`}
          ton={testsCourants.executes === testsCourants.planifies ? 'ok' : 'info'}
          detail={testsCourants.statut}
        />
        <StatTile
          libelle="Taux de réussite"
          valeur={pct(tauxSucces, 1)}
          ton={tauxSucces > 95 ? 'ok' : 'warn'}
          detail={`${testsCourants.echecs} échec${testsCourants.echecs > 1 ? 's' : ''} analysé${testsCourants.echecs > 1 ? 's' : ''}`}
        />
        <StatTile
          libelle="Exercices de reprise"
          valeur={c.exercicesPra.length}
          detail={`${c.exercicesPra.filter((e) => e.succes).length} sous l’objectif de temps`}
        />
        <StatTile
          libelle="Vulnérabilités ouvertes"
          valeur={num(cveOuvertes)}
          ton={cveCritiques > 0 ? 'err' : 'warn'}
          detail={`dont ${cveCritiques} critique${cveCritiques > 1 ? 's' : ''}`}
        />
        <StatTile
          libelle="Constats d’audit ouverts"
          valeur={constatsOuverts}
          ton={constatsOuverts > 0 ? 'warn' : 'ok'}
          detail={`sur ${c.audits.reduce((a, x) => a + x.constats, 0)} constats émis`}
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'restauration' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Une sauvegarde jamais restaurée est une hypothèse">
            Chaque mois, nous tirons au sort 10 % du parc et nous restaurons réellement. Pas une
            vérification d’intégrité de l’archive : une restauration complète, avec démarrage du
            système et vérification que les données sont là. C’est le seul test qui prouve quelque
            chose, et c’est aussi celui qui trouve des problèmes.
          </Callout>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Campagnes de test"
                sousTitre="Échantillon tiré au sort, pas choisi. Choisir les ressources à tester revient à ne tester que ce qui marche."
                className="mb-0"
                actions={<TestTubeDiagonal size={15} className="text-p-700" />}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Période', 'Périmètre', 'Planifiés', 'Exécutés', 'Réussis', 'Échecs', 'Taux', 'Statut'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {c.testsRestauration.map((t) => {
                    const taux = Math.round((t.succes / Math.max(1, t.executes)) * 1000) / 10
                    return (
                      <tr key={t.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 text-[12.5px] font-semibold text-ink">
                          {t.periode}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">{t.perimetre}</td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{t.planifies}</td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{t.executes}</td>
                        <td className="tnum px-3 py-2.5 text-[12px] font-semibold text-ok">
                          {t.succes}
                        </td>
                        <td className="px-3 py-2.5">
                          {t.echecs > 0 ? (
                            <Badge tone="err" size="sm">
                              {t.echecs}
                            </Badge>
                          ) : (
                            <span className="text-[11.5px] text-g-500">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="relative block h-2 w-16 overflow-hidden rounded-full bg-g-100">
                              <span
                                className={cn(
                                  'absolute inset-y-0 left-0 rounded-full',
                                  taux > 97 ? 'bg-ok' : taux > 90 ? 'bg-p-600' : 'bg-warn',
                                )}
                                style={{ width: `${taux}%` }}
                              />
                            </span>
                            <span className="tnum text-[12px] font-bold text-ink">
                              {pct(taux, 1)}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={t.statut === 'clôturée' ? 'ok' : 'info'} dot size="sm">
                            {t.statut}
                          </Badge>
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
                titre="Échecs de restauration analysés"
                sousTitre="Un échec en test est un problème trouvé avant qu’il ne compte."
              />
              <div className="space-y-2">
                {[
                  {
                    r: 'Volume chiffré, clé absente du coffre',
                    org: 'AMUGA',
                    d: 'Le volume avait été chiffré avec une clé gérée par le client, supprimée depuis. La sauvegarde était intacte mais illisible.',
                    c: 'Nous vérifions désormais la présence de la clé au moment de la sauvegarde, et nous alertons si elle disparaît.',
                  },
                  {
                    r: 'Base restaurée incohérente',
                    org: 'Ivoire Agro Négoce',
                    d: 'La sauvegarde de la base et celle des fichiers n’étaient pas prises au même instant. La restauration a produit un état incohérent.',
                    c: 'Le plan de sauvegarde de cette application groupe désormais base et fichiers dans une même transaction.',
                  },
                ].map((x) => (
                  <div key={x.r} className="rounded-[6px] border border-err/40 bg-err-bg px-3 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="min-w-0 text-[12.5px] font-semibold text-ink">{x.r}</span>
                      <Badge tone="neutral" size="sm">
                        {x.org}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">{x.d}</p>
                    <p className="mt-1.5 rounded-[5px] bg-white px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink">
                      Correction apportée : {x.c}
                    </p>
                  </div>
                ))}
              </div>
              <Callout ton="ok" className="mt-4" titre="C’est exactement pour cela que nous testons">
                Ces deux échecs auraient été découverts au pire moment : pendant un sinistre réel, chez
                un client qui pensait ses données protégées. Les avoir trouvés en test a coûté deux
                journées d’ingénieur et corrigé un défaut de conception.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Planification des tests"
                sousTitre="Comment l’échantillon est constitué, et ce qui est testé."
              />
              <div className="space-y-4">
                <Field label="Part du parc testée par mois" hint="tirage au sort, pas de sélection manuelle">
                  <Input
                    type="number"
                    value={partParc}
                    min={1}
                    max={100}
                    suffix="%"
                    onChange={(e) => setPartParc(Number(e.target.value))}
                  />
                </Field>
                <Field label="Profondeur du test">
                  <Select value={profondeur} onChange={(e) => setProfondeur(e.target.value)}>
                    <option value="integrite">Vérification d’intégrité de l’archive seulement</option>
                    <option value="restauration">Restauration dans un environnement isolé</option>
                    <option value="complet">
                      Restauration, démarrage et vérification des données (recommandé)
                    </option>
                  </Select>
                </Field>
                <div className="space-y-3">
                  {PLANIFICATION.map((r) => (
                    <Switch
                      key={r.id}
                      checked={reglages[r.id]}
                      onChange={(v) => setReglages((prev) => ({ ...prev, [r.id]: v }))}
                      disabled={r.fige}
                      label={r.label}
                      description={r.description}
                    />
                  ))}
                </div>
                {profondeur === 'integrite' && (
                  <Callout ton="warn" titre="Vérifier l’intégrité n’est pas restaurer">
                    Une archive dont la somme de contrôle est bonne peut très bien ne pas redémarrer :
                    les deux échecs de ce mois-ci sont exactement de ce type. Ce niveau de test ne les
                    aurait pas trouvés.
                  </Callout>
                )}
              </div>
              <BoutonAction
                libelle="Enregistrer"
                size="md"
                className="mt-4"
                operation={{
                  action: 'compliance.export',
                  titre: 'Planification des tests enregistrée',
                  // `POST /admin/conformite/tests-restauration` → `202` : la
                  // campagne du mois part sur l’échantillon réglé ici et se
                  // suit dans le centre de tâches.
                  appel: () =>
                    requete('/admin/conformite/tests-restauration', {
                      methode: 'POST',
                      corps: { perimetre: 'toutes', echantillonPct: partParc },
                    }),
                  detail: `${partParc} % du parc tiré au sort chaque mois, ${
                    profondeur === 'complet'
                      ? 'en restauration complète avec vérification des données'
                      : profondeur === 'restauration'
                        ? 'en restauration isolée'
                        : 'en vérification d’intégrité seule'
                  }.`,
                }}
              />
            </Card>
          </div>
        </div>
      )}

      {onglet === 'pra' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Exercices de reprise d’activité"
                sousTitre="Bascule réelle en réseau isolé, chronométrée. Nous publions le temps constaté, y compris quand il dépasse l’objectif."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Organisation', 'Plan', 'Date', 'Objectif de temps', 'Temps constaté', 'Écart', 'Résultat'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {c.exercicesPra.map((e) => {
                    const ecart = e.rtoConstate - e.rtoCible
                    return (
                      <tr key={`${e.org}-${e.date}`} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 text-[12.5px] font-semibold text-ink">{e.org}</td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">{e.plan}</td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                          {dateCourte(e.date)}
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                          {dureeMin(e.rtoCible)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={e.succes ? 'ok' : 'err'} size="sm">
                            {dureeMin(e.rtoConstate)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              'tnum text-[12px] font-semibold',
                              ecart <= 0 ? 'text-ok' : 'text-err',
                            )}
                          >
                            {ecart <= 0 ? '−' : '+'} {dureeMin(Math.abs(ecart))}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={e.succes ? 'ok' : 'err'} dot size="sm">
                            {e.succes ? 'Objectif tenu' : 'Objectif dépassé'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {praEchoues.map((e) => (
            <Card key={e.plan} className="border-err/30">
              <CardHeader
                titre={`Analyse de l’écart — ${e.org}`}
                sousTitre={`Exercice du ${dateCourte(e.date)} · ${dureeMin(e.rtoConstate)} constatées pour ${dureeMin(e.rtoCible)} engagées`}
                actions={
                  <Badge tone="err" dot size="sm">
                    Objectif dépassé de {dureeMin(e.rtoConstate - e.rtoCible)}
                  </Badge>
                }
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <MicroLabel className="mb-2">Décomposition du temps de reprise</MicroLabel>
                  <div className="space-y-2">
                    {[
                      { e: 'Détection et décision de bascule', m: 18, cible: 15 },
                      { e: 'Démarrage des machines sur le site de repli', m: 42, cible: 40 },
                      { e: 'Restauration du dernier point de reprise', m: 54, cible: 35 },
                      { e: 'Bascule DNS et vérification', m: 22, cible: 20 },
                      { e: 'Validation applicative par le client', m: 10, cible: 10 },
                    ].map((x) => (
                      <div key={x.e}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 text-[11.5px] text-ink">{x.e}</span>
                          <span className="tnum shrink-0 text-[11.5px]">
                            <span
                              className={cn(
                                'font-semibold',
                                x.m > x.cible ? 'text-err' : 'text-ink',
                              )}
                            >
                              {x.m} min
                            </span>
                            <span className="ml-1.5 text-g-500">cible {x.cible}</span>
                          </span>
                        </div>
                        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-g-100">
                          <span
                            className={cn(
                              'block h-full rounded-full',
                              x.m > x.cible ? 'bg-err' : 'bg-ok',
                            )}
                            style={{ width: `${(x.m / 60) * 100}%` }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <MicroLabel className="mb-2">Cause et correction</MicroLabel>
                  <div className="space-y-2">
                    <div className="rounded-[6px] border border-err/40 bg-err-bg px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-ink">
                        Cause : restauration séquentielle des volumes
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">
                        Les huit volumes du plan ont été restaurés l’un après l’autre au lieu d’être
                        traités en parallèle. Dix-neuf minutes perdues, uniquement d’attente.
                      </p>
                    </div>
                    <div className="rounded-[6px] border border-ok/40 bg-ok-bg px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-ink">
                        Correction : parallélisation de la restauration
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">
                        Déployée le 14 juin. Sur un test à blanc mené depuis, la même étape prend 21
                        minutes au lieu de 54. Le prochain exercice réel est prévu en septembre pour
                        confirmer.
                      </p>
                    </div>
                    <div className="rounded-[6px] border border-g-300 px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-ink">Client informé</p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">
                        Le rapport d’exercice, avec le dépassement et son analyse, a été remis au client
                        sous cinq jours ouvrés. Nous n’avons pas attendu qu’il le demande.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Callout ton="violet" titre="Pourquoi publier un exercice raté">
            Un fournisseur qui n’affiche que des exercices réussis n’en fait probablement pas beaucoup,
            ou ne les chronomètre pas honnêtement. Un objectif de reprise dépassé de 26 minutes lors
            d’un exercice, analysé et corrigé, vaut infiniment mieux qu’un tableau tout vert qui
            s’effondre le jour d’un vrai sinistre.
          </Callout>
        </div>
      )}

      {onglet === 'vulnerabilites' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Vulnérabilités par gravité"
                sousTitre="Ouvertes, corrigées sur 30 jours, et délai moyen de correction. Nous affichons le nombre de vulnérabilités faibles ouvertes, même s’il est élevé : les masquer donnerait une image fausse."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Gravité', 'Ouvertes', 'Corrigées sur 30 j', 'Délai moyen', 'Engagement', 'Respect'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {c.cve.map((x) => {
                    const engagement =
                      x.gravite === 'critique'
                        ? 3
                        : x.gravite === 'élevée'
                          ? 14
                          : x.gravite === 'moyenne'
                            ? 30
                            : 90
                    const tenu = x.delaiMoyenJours <= engagement
                    return (
                      <tr key={x.gravite} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <Badge
                            tone={
                              x.gravite === 'critique'
                                ? 'err'
                                : x.gravite === 'élevée'
                                  ? 'warn'
                                  : x.gravite === 'moyenne'
                                    ? 'info'
                                    : 'neutral'
                            }
                            dot
                            size="sm"
                          >
                            {x.gravite}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              'tnum text-[13px] font-bold',
                              x.gravite === 'critique' && x.ouvertes > 0
                                ? 'text-err'
                                : x.ouvertes === 0
                                  ? 'text-ok'
                                  : 'text-ink',
                            )}
                          >
                            {num(x.ouvertes)}
                          </span>
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                          {num(x.corrigees30j)}
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                          {x.delaiMoyenJours} jours
                        </td>
                        <td className="tnum px-3 py-2.5 text-[11.5px] text-g-500">
                          {engagement} jours
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={tenu ? 'ok' : 'warn'} size="sm">
                            {tenu ? 'Engagement tenu' : 'Au-delà de l’engagement'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {cveCritiques === 0 && (
              <div className="border-t border-g-100 px-4 py-3">
                <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-g-700">
                  <ShieldAlert size={13} className="mt-0.5 shrink-0 text-ok" />
                  Aucune vulnérabilité critique ouverte. Les trois corrigées ce mois-ci l’ont été en
                  deux jours en moyenne, hors fenêtre de maintenance habituelle : une vulnérabilité
                  critique activement exploitée ne s’accommode pas d’attendre le dimanche suivant.
                </p>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Fenêtres de correctifs"
                sousTitre="Les correctifs non critiques sont regroupés dans des fenêtres annoncées à l’avance."
                actions={<CalendarClock size={15} className="text-p-700" />}
              />
              <div className="space-y-2">
                {c.fenetresPatching.map((f) => (
                  <div
                    key={f.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 rounded-[6px] border px-3 py-2.5',
                      f.statut === 'terminée' ? 'border-g-300' : 'border-info/40 bg-info-bg',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        {f.perimetre}
                      </span>
                      <span className="block font-mono text-[11px] text-g-700">{f.fenetre}</span>
                    </span>
                    <Badge tone={f.statut === 'terminée' ? 'ok' : 'info'} dot size="sm">
                      {f.statut}
                    </Badge>
                  </div>
                ))}
              </div>
              <Callout ton="warn" className="mt-4" titre="L’exception des vulnérabilités critiques">
                Une vulnérabilité critique activement exploitée est corrigée dès que possible, sans
                attendre la fenêtre. Nous prévenons les clients concernés, mais nous n’attendons pas
                leur accord : le risque d’exploitation dépasse celui d’une interruption brève.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Politique de correctifs"
                sousTitre="Les délais que nous nous engageons à tenir, par gravité."
              />
              <div className="space-y-2">
                {[
                  {
                    g: 'Critique',
                    d: '72 heures',
                    t: 'err' as const,
                    q: 'Hors fenêtre si nécessaire. Notification des clients concernés, sans attendre leur accord.',
                  },
                  {
                    g: 'Élevée',
                    d: '14 jours',
                    t: 'warn' as const,
                    q: 'Dans la prochaine fenêtre de maintenance, avancée si l’exposition est publique.',
                  },
                  {
                    g: 'Moyenne',
                    d: '30 jours',
                    t: 'info' as const,
                    q: 'Regroupée avec d’autres correctifs dans une fenêtre mensuelle.',
                  },
                  {
                    g: 'Faible',
                    d: '90 jours',
                    t: 'neutral' as const,
                    q: 'Traitée lors des montées de version régulières. Certaines ne sont jamais corrigées si elles ne sont pas exploitables dans notre configuration — et nous le documentons.',
                  },
                ].map((x) => (
                  <div key={x.g} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={x.t} dot size="sm">
                        {x.g}
                      </Badge>
                      <span className="tnum text-[12.5px] font-bold text-ink">{x.d}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">{x.q}</p>
                  </div>
                ))}
              </div>
              <Callout ton="violet" className="mt-4" titre="112 vulnérabilités faibles ouvertes">
                Nous l’affichons parce que c’est la vérité. La plupart ne sont pas exploitables dans
                notre configuration — service non exposé, fonctionnalité désactivée, prérequis absent —
                et nous le documentons vulnérabilité par vulnérabilité. Afficher zéro en les masquant
                serait plus confortable et complètement malhonnête.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'audits' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Audits menés"
                sousTitre="Internes et externes. Le nombre de constats ouverts est celui qui compte : un audit dont tous les constats sont clos six mois après n’a servi à rien."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Type', 'Périmètre', 'Date', 'Auditeur', 'Constats', 'Ouverts', 'Avancement'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {c.audits.map((a) => {
                    const clos = a.constats - a.ouverts
                    const taux = Math.round((clos / a.constats) * 100)
                    return (
                      <tr key={a.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <Badge tone={a.type === 'Externe' ? 'violet' : 'neutral'} size="sm">
                            {a.type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-[12.5px] font-semibold text-ink">
                          {a.perimetre}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                          {dateCourte(a.date)}
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">{a.auditeur}</td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{a.constats}</td>
                        <td className="px-3 py-2.5">
                          {a.ouverts > 0 ? (
                            <Badge tone="warn" size="sm">
                              {a.ouverts}
                            </Badge>
                          ) : (
                            <Badge tone="ok" size="sm">
                              0
                            </Badge>
                          )}
                        </td>
                        <td className="w-40 px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="relative block h-2 flex-1 overflow-hidden rounded-full bg-g-100">
                              <span
                                className={cn(
                                  'absolute inset-y-0 left-0 rounded-full',
                                  taux === 100 ? 'bg-ok' : 'bg-p-600',
                                )}
                                style={{ width: `${taux}%` }}
                              />
                            </span>
                            <span className="tnum shrink-0 text-[11.5px] font-semibold text-ink">
                              {pct(taux)}
                            </span>
                          </span>
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
                titre="Constats encore ouverts"
                sousTitre="Avec leur échéance de correction et ce qui bloque."
              />
              <div className="space-y-2">
                {[
                  {
                    c: 'Rotation des clés d’accès au stockage objet non automatisée',
                    a: 'Contrôle d’accès et RBAC · juin 2026',
                    g: 'Moyen',
                    e: '2026-09-30',
                    b: 'La rotation automatique casserait les intégrations clientes qui codent la clé en dur. Nous développons un mécanisme de recouvrement à deux clés.',
                  },
                  {
                    c: 'Journalisation des accès physiques au site de Grand-Bassam incomplète',
                    a: 'Sécurité de l’infrastructure · mars 2026',
                    g: 'Faible',
                    e: '2026-10-31',
                    b: 'Le lecteur de badge du site secondaire ne remonte pas dans le journal central. Remplacement matériel commandé.',
                  },
                  {
                    c: 'Absence de test d’intrusion sur l’interface programmatique',
                    a: 'Sécurité de l’infrastructure · mars 2026',
                    g: 'Moyen',
                    e: '2026-11-30',
                    b: 'Le test de janvier portait sur le portail, pas sur l’API. Un test dédié est planifié au quatrième trimestre.',
                  },
                ].map((x) => (
                  <div key={x.c} className="rounded-[6px] border border-warn/40 bg-warn-bg px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0 text-[12.5px] font-semibold text-ink">{x.c}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge tone="neutral" size="sm">
                          {x.g}
                        </Badge>
                        <Badge tone="warn" size="sm">
                          {dateCourte(x.e)}
                        </Badge>
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-g-500">{x.a}</p>
                    <p className="mt-1 rounded-[5px] bg-white px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink">
                      {x.b}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Ce que nous ne certifions pas"
                sousTitre="Aussi important que la liste des certifications obtenues."
              />
              <div className="space-y-2">
                {[
                  {
                    t: 'ISO 27001',
                    e: 'En cours',
                    d: 'Démarche engagée, audit de certification prévu au premier semestre 2027. Nous ne prétendons pas être certifiés aujourd’hui.',
                    ton: 'info' as const,
                  },
                  {
                    t: 'PCI-DSS',
                    e: 'Non applicable',
                    d: 'Nous ne stockons aucune donnée de carte bancaire : le paiement passe par un prestataire agréé. Réclamer cette certification serait un argument creux.',
                    ton: 'neutral' as const,
                  },
                  {
                    t: 'HDS (données de santé)',
                    e: 'Non certifié',
                    d: 'Nous refusons les charges de données de santé nominatives tant que nous ne le sommes pas. Un client de ce secteur doit le savoir avant de signer, pas après.',
                    ton: 'warn' as const,
                  },
                  {
                    t: 'SOC 2 Type II',
                    e: 'Non engagé',
                    d: 'Peu demandé sur notre marché à ce jour. Nous l’engagerons quand un client en aura réellement besoin, pas pour l’afficher.',
                    ton: 'neutral' as const,
                  },
                ].map((x) => (
                  <div
                    key={x.t}
                    className={cn(
                      'rounded-[6px] border px-3 py-2.5',
                      x.ton === 'warn'
                        ? 'border-warn/40 bg-warn-bg'
                        : x.ton === 'info'
                          ? 'border-info/40 bg-info-bg'
                          : 'border-g-300',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-ink">{x.t}</span>
                      <Badge tone={x.ton} size="sm">
                        {x.e}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">{x.d}</p>
                  </div>
                ))}
              </div>
              <Callout ton="violet" className="mt-4" titre="Une certification annoncée à tort se paie cher">
                Le premier audit sérieux d’un grand compte la démasque, et la crédibilité perdue ne se
                récupère pas. Nous préférons dire où nous en sommes, y compris quand la réponse est
                « pas encore ».
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'attestations' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Des attestations générées à la demande, pas des promesses">
            Chaque attestation est produite à partir de l’état réel de la plateforme au moment de sa
            génération, pas d’un modèle rédigé une fois pour toutes. Elle porte une date, un périmètre
            et une signature vérifiable — un client peut la remettre à son commissaire aux comptes ou à
            un régulateur.
          </Callout>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {c.attestations.map((a) => (
              <Card key={a.id} className="flex flex-col" hover>
                <CardHeader
                  titre={a.nom}
                  actions={<FileCheck2 size={15} className="text-p-700" />}
                />
                <p className="text-[12px] leading-relaxed text-g-700">{a.description}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-g-100 pt-3.5">
                  <GatedAction
                    autorise={autorise('compliance.export')}
                    message={refus('compliance.export')}
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setAttestation(a.nom)}
                    >
                      Générer
                    </Button>
                  </GatedAction>
                  <Button size="sm" variant="ghost" onClick={() => setModele(a.nom)}>
                    Modèle
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              titre="Attestations générées récemment"
              sousTitre="Chaque génération est journalisée dans l’audit, avec le demandeur et le périmètre."
            />
            <div className="space-y-1.5">
              {generees.items
                // En mode API, `GET /attestations` renvoie des modèles à
                // générer, pas des lignes de journal : on ne garde que les
                // lignes qui en sont (attestation + date), les autres
                // n’ont rien à faire dans cet historique.
                .filter((x) => typeof x.attestation === 'string' && typeof x.date === 'string')
                .map((x) => (
                <div
                  key={x.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-g-100 pb-1.5 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="text-[12px] font-semibold text-ink">{x.attestation}</span>
                    <span className="ml-2 text-[11px] text-g-700">— {x.org}</span>
                    <span className="block text-[10.5px] text-g-500">{x.motif}</span>
                  </span>
                  <span className="shrink-0 text-[10.5px] text-g-500">
                    {x.qui} · {dateCourte(x.date)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={attestation !== null}
        onClose={() => setAttestation(null)}
        title={`Générer une attestation — ${attestation ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAttestation(null)}>
              Annuler
            </Button>
            <Button
              iconBefore={<FileCheck2 size={13} />}
              disabled={duAttestation > auAttestation}
              onClick={genererAttestation}
            >
              Générer et signer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Organisation concernée">
            <Select value={orgAttestation} onChange={(e) => setOrgAttestation(e.target.value)}>
              <option value="">Toute la plateforme</option>
              {ORGANISATIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Période couverte — du">
              <Input
                type="date"
                value={duAttestation}
                onChange={(e) => setDuAttestation(e.target.value)}
              />
            </Field>
            <Field label="au">
              <Input
                type="date"
                value={auAttestation}
                onChange={(e) => setAuAttestation(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Destinataire déclaré" hint="figure sur l’attestation">
            <Input
              placeholder="Commissaire aux comptes, régulateur, direction du client…"
              value={destinataire}
              onChange={(e) => setDestinataire(e.target.value)}
            />
          </Field>
          <Field label="Motif" hint="journalisé dans l’audit, visible du client">
            <Input
              placeholder="Dossier de conformité réglementaire"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
            />
          </Field>
          <div className="space-y-3">
            <Switch
              checked
              disabled
              label="Générer à partir de l’état réel de la plateforme"
              description="Non désactivable. Les chiffres sont extraits au moment de la génération, pas repris d’un modèle."
            />
            <Switch
              checked={signature}
              onChange={setSignature}
              label="Signature électronique"
              description="Permet au destinataire de vérifier l’authenticité du document sans nous contacter."
            />
            <Switch
              checked={notifierOrg}
              onChange={setNotifierOrg}
              label="Notifier l’organisation concernée"
              description="Le client est informé qu’une attestation le concernant a été produite, et pour qui."
            />
          </div>
          {!notifierOrg && (
            <Callout ton="warn" titre="Une attestation produite dans le dos du client">
              Le client ne saura pas qu’un document le concernant a été remis à un tiers. La
              génération reste journalisée dans son propre journal d’audit — il le découvrira là, plus
              tard, et la question sera plus difficile à expliquer.
            </Callout>
          )}
          <Callout ton="info" titre="Ce que l’attestation contient et ne contient pas">
            Elle atteste de faits vérifiables : localisation des données, politique de sauvegarde
            appliquée, tests réellement exécutés, résultats obtenus. Elle n’atteste pas d’une
            certification que nous n’avons pas, et n’extrapole aucun engagement au-delà de ce que le
            contrat prévoit.
          </Callout>
        </div>
      </Modal>

      <Modal
        open={modele !== null}
        onClose={() => setModele(null)}
        title={`Modèle d’attestation — ${modele ?? ''}`}
        description="Le texte que le document affirme, et ce qu’il se refuse à affirmer. Les valeurs sont extraites de l’état réel de la plateforme au moment de la génération."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModele(null)}>
              Fermer
            </Button>
            <Button
              iconBefore={<FileCheck2 size={13} />}
              onClick={() => {
                const nom = modele
                setModele(null)
                setAttestation(nom)
              }}
            >
              Générer à partir de ce modèle
            </Button>
          </>
        }
      >
        {modele && (
          <div className="space-y-4">
            <div>
              <MicroLabel className="mb-2">Ce que le document affirme</MicroLabel>
              <ul className="space-y-1.5">
                {(MODELES_ATTESTATION[modele]?.affirme ?? []).map((x) => (
                  <li
                    key={x}
                    className="rounded-[6px] border border-ok/40 bg-ok-bg px-3 py-2 text-[12px] leading-relaxed text-ink"
                  >
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <MicroLabel className="mb-2">Ce qu’il n’affirme pas</MicroLabel>
              <ul className="space-y-1.5">
                {(MODELES_ATTESTATION[modele]?.naffirme ?? []).map((x) => (
                  <li
                    key={x}
                    className="rounded-[6px] border border-g-300 px-3 py-2 text-[12px] leading-relaxed text-g-700"
                  >
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <Callout ton="violet" titre="Le modèle ne se modifie pas depuis le portail">
              Le texte d’une attestation engage l’entreprise : il est révisé par la conformité, pas
              par l’opérateur qui la génère. Ce qui change d’une génération à l’autre, ce sont les
              faits mesurés, jamais les affirmations.
            </Callout>
          </div>
        )}
      </Modal>
    </div>
  )
}
