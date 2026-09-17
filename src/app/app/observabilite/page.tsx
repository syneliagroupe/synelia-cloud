'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BellRing, FlaskConical, Plus, Trash2 } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { dateHeure, pct, relatif } from '@/lib/format'
import {
  EVENEMENTS_SUPERVISION,
  LOGS_EXECUTION,
  PROJETS,
  REGLES_ALERTES,
  SERVICES_PROJET,
  VMS,
} from '@/lib/mock'
import type {
  AlerteRegle,
  EvenementSupervision,
  LigneLog,
  Projet,
  ServiceProjet,
  VM,
} from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, SegmentedControl, Select, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { HealthBadge, StatTile } from '@/components/composition/metrics'
import { EventList, GrilleSparkCharts, LiensSortie, LogPeek } from '@/components/business/observabilite'
import { DegradedState } from '@/components/composition/states'
import { useApp, useEspace, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import {
  creerRessource,
  modifierRessource,
  requete,
  supprimerRessource,
  type PageDistante,
} from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'

/** Champs d'une règle d'alerte — mêmes champs à la création et à la reprise. */
const CHAMPS_ALERTE = [
  { id: 'metrique', label: 'Règle', placeholder: 'CPU soutenu au-delà de 85 %', obligatoire: true },
  { id: 'cible', label: 'Portée', placeholder: 'étiquette production', obligatoire: true },
  { id: 'seuil', label: 'Seuil', placeholder: '> 85 %', demi: true, obligatoire: true },
  {
    id: 'plage',
    label: 'Pendant',
    type: 'select' as const,
    demi: true,
    options: [
      { value: '5 min', label: '5 minutes' },
      { value: '15 min', label: '15 minutes' },
      { value: '30 min', label: '30 minutes' },
      { value: '1 h', label: '1 heure' },
    ],
  },
  {
    id: 'canal',
    label: 'Canal de notification',
    type: 'select' as const,
    options: [
      { value: 'email', label: 'Courriel' },
      { value: 'sms', label: 'SMS' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'webhook', label: 'Webhook' },
    ],
  },
  { id: 'actif', label: 'Active', type: 'switch' as const, placeholder: 'Règle armée' },
]
import { SITE_COURT } from '@/lib/types'

const LIBELLE_GRAVITE = {
  critique: 'Critique',
  majeure: 'Majeure',
  mineure: 'Mineure',
  info: 'Information',
} as const

const LIBELLE_TYPE_SERVICE: Record<ServiceProjet['type'], string> = {
  application: 'Service applicatif',
  base: 'Base de données',
  statique: 'Site statique',
  cron: 'Tâche planifiée',
  worker: 'Worker',
}

const ONGLETS = [
  { id: 'vue', label: 'Vue d’ensemble' },
  { id: 'ressources', label: 'Par ressource' },
  { id: 'evenements', label: 'Événements' },
  { id: 'alertes', label: 'Règles d’alerte' },
]

const PERIMETRES = [
  { value: 'espace', label: 'Espace Cloud' },
  { value: 'apps', label: 'Applications' },
  { value: 'services', label: 'Services managés' },
]

export default function Observabilite() {
  const maintenant = useMaintenant()
  const espace = useEspace()
  const { autorise, refus, pousser } = useApp()
  const alertes = useCollection<AlerteRegle>('regles-alertes', REGLES_ALERTES)
  const executer = useOperation()
  const [canalCourriel, setCanalCourriel] = useState(true)
  const [canalWebhook, setCanalWebhook] = useState(false)
  const [canalTicket, setCanalTicket] = useState(false)
  const [onglet, setOnglet] = useState('vue')
  const [perimetre, setPerimetre] = useState('espace')
  // Formulaire rapide de la carte « Nouvelle règle » : mêmes champs que la
  // modale, en version resserrée (pas de canal webhook ici, le courriel suffit).
  const [regleMetrique, setRegleMetrique] = useState('Charge processeur')
  const [regleSeuil, setRegleSeuil] = useState(85)
  const [regleDuree, setRegleDuree] = useState(10)
  const [reglePortee, setReglePortee] = useState('espace')

  // Les machines ont un vrai backend (`/vms`) : `useCollection` en sert les
  // données réelles quand l'API est active, et retombe sur la graine sinon —
  // même mécanisme que l'accueil Infrastructure. `espaceId` filtre pareil
  // dans les deux cas.
  const vms = useCollection<VM>('vms', VMS).items.filter((v) => v.espaceId === espace.id)
  const enMarche = vms.filter((v) => v.statut === 'running')
  // Les projets et leurs services ont eux aussi un vrai backend (`/projets`,
  // `/projets/{id}/services` sous la clé `services-projet`) : même mécanisme
  // que les machines, pour que cette vue transverse cesse de montrer une
  // liste d'applications figée, sans rapport avec ce que le compte possède
  // réellement (c'était l'ancien modèle « Partie 11 », resté ici alors que
  // `/app/applications` était déjà passé à `projets`/`services-projet`).
  const projetsEspace = useCollection<Projet>('projets', PROJETS).items.filter(
    (p) => p.espaceId === espace.id,
  )
  const idsProjetsEspace = new Set(projetsEspace.map((p) => p.id))
  const services = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET).items.filter(
    (s) => idsProjetsEspace.has(s.projetId),
  )
  // En mode API, les événements et les journaux viennent du backend ; un
  // `424` (intégration amont muette) affiche un état dégradé nommé au lieu
  // des graines. Les autres échecs gardent les graines, sans bruit.
  const { donnees: evenementsDistants, degrade: degradeEvenements } =
    useLectureDegradable<PageDistante<EvenementSupervision>>('/observabilite/evenements')
  const { donnees: journauxDistants, degrade: degradeJournaux } = useLectureDegradable<{
    lignes: LigneLog[]
    lienVictoriaLogs?: string
  }>('/observabilite/journaux')
  // Les courbes restent une synthèse illustrée (graines stables) : le backend
  // dit si la supervision répond. Un `424` dégrade le bloc plutôt que
  // d’afficher des courbes dont on ne sait plus de quand elles datent.
  const { donnees: metriquesDistantes, degrade: degradeMetriques } = useLectureDegradable<{
    series: unknown[]
    liens?: { grafana?: string }
  }>('/observabilite/metriques')
  const hrefGrafana = metriquesDistantes?.liens?.grafana
  const evenements = evenementsDistants?.donnees ?? EVENEMENTS_SUPERVISION
  const lignesJournal = journauxDistants?.lignes ?? LOGS_EXECUTION
  const critiques = evenements.filter(
    (e) => e.gravite === 'critique' || e.gravite === 'majeure',
  ).length
  const appsDegradees = services.filter(
    (s) => s.statut === 'degraded' || s.statut === 'failed',
  ).length

  /** Les métriques instantanées sont dérivées d'une graine stable pour rester identiques au rendu serveur. */
  const charge = (id: string, min: number, max: number) => seededSeries(id, 1, min, max)[0]
  const chargeMoy = Math.round(
    enMarche.reduce((a, v) => a + charge(`cpu-${v.id}`, 12, 88), 0) / Math.max(1, enMarche.length),
  )

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Observabilité' }]}
        titre="Observabilité"
        sousTitre="Une vue de synthèse, volontairement resserrée : l’état de santé, quelques courbes, les derniers événements, un aperçu des journaux. Pour l’analyse fine, nous vous ouvrons Centreon, Grafana et le moteur de recherche de journaux — ce sont des outils spécialisés, nous ne cherchons pas à les remplacer."
        actions={
          <BoutonFormulaire
            libelle="Nouvelle règle d’alerte"
            size="md"
            icone={<BellRing size={14} />}
            titre="Nouvelle règle d’alerte"
            description="Sans durée de dépassement, une alerte se déclenche sur le moindre pic et finit par être ignorée. C’est le réglage qui fait la différence entre une alerte utile et du bruit."
            champs={CHAMPS_ALERTE}
            valeursDepart={{ plage: '15 min', canal: 'email', actif: true }}
            libelleValider="Créer la règle"
            action="network.manage"
            operation={(v) => {
              const idAlerte = alertes.identifiant('alerte')
              return {
                titre: `Règle « ${v.metrique} » créée`,
                detail: `${v.seuil} pendant ${v.plage} · ${v.canal}`,
                appel: () =>
                  creerRessource('/observabilite/alertes', {
                    cible: String(v.cible),
                    metrique: String(v.metrique),
                    seuil: String(v.seuil),
                    canaux: [v.canal as AlerteRegle['canaux'][number]],
                    plage: String(v.plage),
                    actif: Boolean(v.actif),
                  }),
                effet: () =>
                  alertes.creer({
                    id: idAlerte,
                    cible: String(v.cible),
                    metrique: String(v.metrique),
                    seuil: String(v.seuil),
                    canaux: [v.canal as AlerteRegle['canaux'][number]],
                    plage: String(v.plage),
                    actif: Boolean(v.actif),
                  }),
                effetFinal: () => alertes.recharger(),
              }
            }}
          />
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {espace.code}
            </Badge>
            <Badge tone="neutral" size="sm">
              Données à {dateHeure('2026-08-19T15:20:00Z')}
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Ressources supervisées"
          valeur={vms.length + services.length}
          detail={`${vms.length} machines · ${services.length} services applicatifs`}
        />
        <StatTile
          libelle="Charge processeur moyenne"
          valeur={pct(chargeMoy)}
          ton={chargeMoy > 75 ? 'warn' : 'ok'}
          serie={seededSeries(`obs-cpu-${espace.id}`, 24, Math.max(5, chargeMoy - 18), chargeMoy + 14)}
        />
        <StatTile
          libelle="Événements ouverts"
          valeur={critiques}
          ton={critiques > 0 ? 'warn' : 'ok'}
          detail={critiques > 0 ? 'Critiques ou majeurs' : 'Aucun événement ouvert'}
        />
        <StatTile
          libelle="Applications en alerte"
          valeur={appsDegradees}
          ton={appsDegradees > 0 ? 'err' : 'ok'}
          detail={
            appsDegradees > 0
              ? `${appsDegradees} service${appsDegradees > 1 ? 's' : ''} dégradé${appsDegradees > 1 ? 's' : ''} ou en échec`
              : 'Tous sains'
          }
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'vue' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl options={PERIMETRES} value={perimetre} onChange={setPerimetre} />
            <LiensSortie centreon grafana logs hrefGrafana={hrefGrafana} />
          </div>

          <GrilleSparkCharts
            seed={`obs-${perimetre}-${espace.id}`}
            degrade={!!degradeMetriques}
            metriques={
              perimetre === 'espace'
                ? [
                    { titre: 'Processeur agrégé', unite: '%', min: 24, max: 82, seuil: 85 },
                    { titre: 'Mémoire utilisée', unite: '%', min: 48, max: 79, seuil: 90 },
                    { titre: 'Débit disque', unite: 'Mo/s', min: 40, max: 320, couleur: 'var(--color-m-600)' },
                    { titre: 'Trafic réseau sortant', unite: 'Mb/s', min: 60, max: 420 },
                  ]
                : perimetre === 'apps'
                  ? [
                      { titre: 'Requêtes par seconde', unite: 'req/s', min: 180, max: 940 },
                      { titre: 'Latence 95e centile', unite: 'ms', min: 60, max: 240, seuil: 200 },
                      { titre: 'Taux d’erreur', unite: '%', min: 0, max: 2.4, seuil: 1, couleur: 'var(--color-err)' },
                      { titre: 'Redémarrages de conteneurs', unite: '', min: 0, max: 4 },
                    ]
                  : [
                      { titre: 'Sessions actives', unite: '', min: 90, max: 480 },
                      { titre: 'Temps de réponse', unite: 'ms', min: 110, max: 380, seuil: 500 },
                      { titre: 'Volume stocké', unite: 'Go', min: 1180, max: 1240 },
                      { titre: 'Disponibilité', unite: '%', min: 99.6, max: 100, seuil: 99.9 },
                    ]
            }
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
            <CardHeader
              titre="Derniers événements"
              sousTitre="Les huit derniers événements de supervision, toutes ressources confondues."
            />
            {degradeEvenements ? (
              <DegradedState
                source="supervision"
                integration={degradeEvenements.integration}
                dateDonnees={degradeEvenements.dateDonnees}
              />
            ) : (
              <EventList
                evenements={evenements}
                max={8}
                lienSortie="Ouvrir la console Centreon"
                hrefSortie="https://centreon.synelia.cloud/monitoring/resources"
              />
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Aperçu des journaux"
              sousTitre="Vingt lignes, brutes, pour vérifier qu’une hypothèse tient. Au-delà, le moteur de recherche est bien meilleur que nous."
            />
            {degradeJournaux ? (
              <DegradedState
                source="journaux"
                integration={degradeJournaux.integration}
                dateDonnees={degradeJournaux.dateDonnees}
              />
            ) : (
              <LogPeek
                lignes={lignesJournal}
                max={20}
                titre="facturation-api · Production"
                hrefSortie={
                  journauxDistants?.lienVictoriaLogs ?? 'https://logs.synelia.cloud/select/vmui'
                }
              />
            )}
          </Card>
          </div>

          <Callout ton="violet" titre="Pourquoi nous n’avons pas construit de constructeur de requêtes">
            Écrire une requête de journaux se fait dans un outil qui sait tout faire : autocomplétion
            des champs, agrégations, sauvegarde des recherches, corrélation. Le reconstruire à moitié
            dans un portail ne rend service à personne. Nous vous amenons jusqu’au bon écran, déjà
            filtré sur votre organisation et sur la fenêtre de temps que vous regardiez.
          </Callout>
        </div>
      )}

      {onglet === 'ressources' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="État par ressource"
                sousTitre="Machines de l’espace et environnements applicatifs, avec leur emplacement réel d’exécution."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Ressource', 'Type', 'Emplacement', 'Processeur', 'Mémoire', 'État', ''].map(
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
                  {vms.map((v) => (
                    <tr key={v.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/app/vms/${v.id}`}
                          className="font-mono text-[12px] font-semibold text-ink hover:text-p-700"
                        >
                          {v.nom}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">Machine virtuelle</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-g-500">
                        {SITE_COURT[v.site]} · {v.flavor ?? `${v.vcpu} vCPU / ${v.ramGo} Go`}
                      </td>
                      <td className="px-3 py-2.5">
                        <Jauge valeur={charge(`cpu-${v.id}`, 12, 88)} seuil={85} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Jauge valeur={charge(`ram-${v.id}`, 30, 92)} seuil={90} />
                      </td>
                      <td className="px-3 py-2.5">
                        <HealthBadge etat={v.statut} size="sm" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <ButtonLink
                          size="sm"
                          variant="ghost"
                          external
                          href={`https://grafana.synelia.dev01.ovh.smile.ci/d/vm/${v.id}`}
                        >
                          Grafana
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                  {services.slice(0, 8).map((s) => {
                    const projet = projetsEspace.find((p) => p.id === s.projetId)
                    return (
                      <tr key={s.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/app/applications/projets/${s.projetId}/${s.id}`}
                            className="font-mono text-[12px] font-semibold text-ink hover:text-p-700"
                          >
                            {projet?.nom} / {s.nom}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                          {LIBELLE_TYPE_SERVICE[s.type]}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-g-500">
                          {SITE_COURT[s.emplacement.site]} ·{' '}
                          {s.emplacement.namespace ?? s.emplacement.vms?.slice(0, 2).join(', ') ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Jauge valeur={charge(`cpu-${s.id}`, 12, 88)} seuil={85} />
                        </td>
                        <td className="px-3 py-2.5">
                          <Jauge valeur={charge(`ram-${s.id}`, 30, 92)} seuil={90} />
                        </td>
                        <td className="px-3 py-2.5">
                          <HealthBadge etat={s.statut} size="sm" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <ButtonLink
                            size="sm"
                            variant="ghost"
                            external
                            href={`https://grafana.synelia.dev01.ovh.smile.ci/d/app/${s.id}`}
                          >
                            Grafana
                          </ButtonLink>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Callout ton="info" titre="Ce que « emplacement » veut dire ici">
            Pour une machine, c’est le socle technique et l’hôte physique qui l’exécute. Pour un
            environnement applicatif, c’est le namespace Kubernetes ou le groupe de machines. Nous
            l’affichons parce que c’est la première question posée pendant un incident, et qu’une
            plateforme qui la masque vous fait perdre dix minutes à chaque fois.
          </Callout>
        </div>
      )}

      {onglet === 'evenements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatTile
              libelle="Critiques"
              valeur={evenements.filter((e) => e.gravite === 'critique').length}
              ton="err"
            />
            <StatTile
              libelle="Majeurs"
              valeur={evenements.filter((e) => e.gravite === 'majeure').length}
              ton="warn"
            />
            <StatTile
              libelle="Mineurs"
              valeur={evenements.filter((e) => e.gravite === 'mineure').length}
              ton="info"
            />
            <StatTile
              libelle="Informations"
              valeur={evenements.filter((e) => e.gravite === 'info').length}
              ton="neutral"
            />
          </div>

          <Card>
            <CardHeader
              titre="Journal des événements"
              sousTitre="Un événement reste ouvert jusqu’à sa résolution ou son acquittement. L’acquittement est nominatif."
            />
            {degradeEvenements ? (
              <DegradedState
                source="supervision"
                integration={degradeEvenements.integration}
                dateDonnees={degradeEvenements.dateDonnees}
              />
            ) : (
            <div className="space-y-2">
              {evenements.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    'flex flex-wrap items-start justify-between gap-3 rounded-[6px] border px-3 py-2.5',
                    e.gravite === 'critique'
                      ? 'border-err/40 bg-err-bg'
                      : e.gravite === 'majeure'
                        ? 'border-warn/40 bg-warn-bg'
                        : 'border-g-300',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-ink">{e.message}</span>
                    <span className="block text-[11px] text-g-500">
                      {e.ressource} · {dateHeure(e.ts)} · {relatif(e.ts, maintenant)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge
                      tone={
                        e.gravite === 'critique'
                          ? 'err'
                          : e.gravite === 'majeure'
                            ? 'warn'
                            : e.gravite === 'mineure'
                              ? 'info'
                              : 'neutral'
                      }
                      size="sm"
                    >
                      {LIBELLE_GRAVITE[e.gravite]}
                    </Badge>
                    {e.gravite === 'info' ? (
                      <Badge tone="neutral" size="sm">
                        Acquitté
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          pousser({
                            ton: 'ok',
                            titre: 'Événement acquitté',
                            detail: 'Votre nom et l’horodatage sont enregistrés dans l’audit.',
                          })
                        }
                      >
                        Acquitter
                      </Button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            )}
            <div className="mt-4 border-t border-g-100 pt-4">
              <LiensSortie centreon grafana logs hrefGrafana={hrefGrafana} />
            </div>
          </Card>
        </div>
      )}

      {onglet === 'alertes' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Règles d’alerte"
                sousTitre="Une règle définit un seuil, une durée de dépassement et un canal de notification. Sans durée, une alerte se déclenche sur le moindre pic et finit par être ignorée."
                className="mb-0"
                actions={
                  <BoutonFormulaire
                    libelle="Ajouter"
                    icone={<Plus size={13} />}
                    titre="Ajouter une règle d’alerte"
                    champs={CHAMPS_ALERTE}
                    valeursDepart={{ plage: '15 min', canal: 'email', actif: true }}
                    libelleValider="Ajouter la règle"
                    action="network.manage"
                    operation={(v) => {
                      const idAlerte = alertes.identifiant('alerte')
                      return {
                        titre: `Règle « ${v.metrique} » ajoutée`,
                        appel: () =>
                          creerRessource('/observabilite/alertes', {
                            cible: String(v.cible),
                            metrique: String(v.metrique),
                            seuil: String(v.seuil),
                            canaux: [v.canal as AlerteRegle['canaux'][number]],
                            plage: String(v.plage),
                            actif: Boolean(v.actif),
                          }),
                        effet: () =>
                          alertes.creer({
                            id: idAlerte,
                            cible: String(v.cible),
                            metrique: String(v.metrique),
                            seuil: String(v.seuil),
                            canaux: [v.canal as AlerteRegle['canaux'][number]],
                            plage: String(v.plage),
                            actif: Boolean(v.actif),
                          }),
                        effetFinal: () => alertes.recharger(),
                      }
                    }}
                  />
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Règle', 'Portée', 'Condition', 'Canal', 'État', ''].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertes.items.map((r) => (
                    <tr key={r.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 text-[12.5px] font-semibold text-ink">
                        {r.metrique}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">{r.cible}</td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">
                        {r.seuil}
                        <span className="block font-sans text-[10.5px] text-g-500">
                          {r.plage}
                          {r.escalade ? ` · escalade ${r.escalade}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {r.canaux.map((c) => (
                            <Badge key={c} tone="neutral" size="sm">
                              {c}
                            </Badge>
                          ))}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={r.actif ? 'ok' : 'neutral'} dot size="sm">
                          {r.actif ? 'Active' : 'Désactivée'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <BoutonFormulaire
                            libelle="Modifier"
                            variant="ghost"
                            titre={`Modifier « ${r.metrique} »`}
                            champs={CHAMPS_ALERTE}
                            valeursDepart={{
                              metrique: r.metrique,
                              cible: r.cible,
                              seuil: r.seuil,
                              plage: r.plage,
                              canal: r.canaux[0] ?? 'email',
                              actif: r.actif,
                            }}
                            action="network.manage"
                            operation={(v) => ({
                              titre: `Règle « ${v.metrique} » modifiée`,
                              detail: v.actif
                                ? undefined
                                : 'La règle est désarmée : elle ne notifiera plus.',
                              appel: () =>
                                modifierRessource('/observabilite/alertes', r.id, {
                                  cible: String(v.cible),
                                  metrique: String(v.metrique),
                                  seuil: String(v.seuil),
                                  canaux: [v.canal as AlerteRegle['canaux'][number]],
                                  plage: String(v.plage),
                                  actif: Boolean(v.actif),
                                }),
                              effet: () =>
                                alertes.modifier(r.id, {
                                  metrique: String(v.metrique),
                                  cible: String(v.cible),
                                  seuil: String(v.seuil),
                                  plage: String(v.plage),
                                  canaux: [v.canal as AlerteRegle['canaux'][number]],
                                  actif: Boolean(v.actif),
                                }),
                              effetFinal: () => alertes.recharger(),
                            })}
                          />
                          <BoutonAction
                            libelle="Tester"
                            variant="ghost"
                            icone={<FlaskConical size={13} />}
                            operation={{
                              action: 'network.manage',
                              ton: 'info',
                              titre: `Règle « ${r.metrique} » testée`,
                              detail: 'Le résultat du test arrive dans le centre de notifications.',
                              appel: () =>
                                requete(
                                  `/observabilite/alertes/${encodeURIComponent(r.id)}/test`,
                                  { methode: 'POST', corps: {} },
                                ),
                            }}
                          />
                          <GatedAction
                            autorise={autorise('network.manage')}
                            message={refus('network.manage')}
                          >
                            <IconButton
                              label={`Supprimer la règle « ${r.metrique} »`}
                              size="sm"
                              onClick={() =>
                                executer({
                                  action: 'network.manage',
                                  ton: 'warn',
                                  titre: `Règle « ${r.metrique} » supprimée`,
                                  appel: () =>
                                    supprimerRessource('/observabilite/alertes', r.id, r.cible),
                                  effet: () => alertes.supprimer(r.id),
                                  effetFinal: () => alertes.recharger(),
                                })
                              }
                            >
                              <Trash2 size={13} className="text-err" />
                            </IconButton>
                          </GatedAction>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Nouvelle règle"
                sousTitre="Trois champs suffisent dans la plupart des cas."
              />
              <div className="space-y-4">
                <Field label="Métrique">
                  <Select value={regleMetrique} onChange={(e) => setRegleMetrique(e.target.value)}>
                    <option value="Charge processeur">Charge processeur</option>
                    <option value="Mémoire utilisée">Mémoire utilisée</option>
                    <option value="Espace disque restant">Espace disque restant</option>
                    <option value="Latence 95e centile">Latence 95e centile</option>
                    <option value="Taux d’erreur HTTP">Taux d’erreur HTTP</option>
                    <option value="Sauvegarde en échec">Sauvegarde en échec</option>
                  </Select>
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Seuil" hint="en pourcentage">
                    <Input
                      type="number"
                      value={regleSeuil}
                      onChange={(e) => setRegleSeuil(Number(e.target.value))}
                    />
                  </Field>
                  <Field
                    label="Dépassement continu"
                    hint="minutes — évite les alertes sur un pic isolé"
                  >
                    <Input
                      type="number"
                      value={regleDuree}
                      onChange={(e) => setRegleDuree(Number(e.target.value))}
                    />
                  </Field>
                </div>
                <Field label="Portée">
                  <Select value={reglePortee} onChange={(e) => setReglePortee(e.target.value)}>
                    <option value="espace">Tout l’espace {espace.code}</option>
                    <option value="vm">Une machine précise</option>
                    <option value="app">Une application</option>
                  </Select>
                </Field>
                <div className="space-y-3">
                  <Switch
                    checked={canalCourriel}
                    onChange={(v) =>
                      executer({
                        titre: v ? 'Courriel activé' : 'Courriel coupé',
                        detail: v
                          ? undefined
                          : 'Plus aucune alerte ne partira par courriel : vérifiez qu’un autre canal reste actif.',
                        effet: () => setCanalCourriel(v),
                      })
                    }
                    label="Courriel aux administrateurs de l’organisation"
                  />
                  <Switch
                    checked={canalWebhook}
                    onChange={(v) =>
                      executer({
                        titre: v ? 'Webhook activé' : 'Webhook coupé',
                        detail: v ? 'Charge JSON signée, format documenté.' : undefined,
                        effet: () => setCanalWebhook(v),
                      })
                    }
                    label="Webhook vers un canal d’équipe"
                    description="Nous envoyons une charge JSON signée ; le format est décrit dans la documentation."
                  />
                  <Switch
                    checked={canalTicket}
                    onChange={(v) =>
                      executer({
                        titre: v
                          ? 'Ouverture automatique de ticket activée'
                          : 'Ouverture automatique de ticket coupée',
                        detail: v
                          ? 'Uniquement pour les alertes critiques, rattachées à la ressource concernée.'
                          : undefined,
                        effet: () => setCanalTicket(v),
                      })
                    }
                    label="Ouvrir automatiquement un ticket de support"
                    description="Uniquement pour les alertes critiques. Le ticket est rattaché à la ressource concernée."
                  />
                </div>
              </div>
              <GatedAction autorise={autorise('network.manage')} message={refus('network.manage')}>
                <Button
                  className="mt-4"
                  onClick={() => {
                    const idAlerte = alertes.identifiant('alerte')
                    const corps = {
                      cible:
                        reglePortee === 'espace'
                          ? `Tout l’espace ${espace.code}`
                          : reglePortee === 'vm'
                            ? 'Une machine précise'
                            : 'Une application',
                      metrique: regleMetrique,
                      seuil: `> ${regleSeuil} %`,
                      canaux: ['email'] as AlerteRegle['canaux'],
                      plage: `${regleDuree} min`,
                      actif: true,
                    }
                    executer({
                      action: 'network.manage',
                      titre: 'Règle d’alerte créée',
                      detail: 'Elle prendra effet au prochain cycle de collecte, dans moins d’une minute.',
                      appel: () => creerRessource('/observabilite/alertes', corps),
                      effet: () => alertes.creer({ id: idAlerte, ...corps }),
                      effetFinal: () => alertes.recharger(),
                    })
                  }}
                >
                  Créer la règle
                </Button>
              </GatedAction>
            </Card>

            <Card>
              <CardHeader
                titre="Événements récents"
                sousTitre="Les mêmes événements de supervision que l’onglet « Événements », pour repérer vite une règle trop sensible."
              />
              {degradeEvenements ? (
                <DegradedState
                  source="supervision"
                  integration={degradeEvenements.integration}
                  dateDonnees={degradeEvenements.dateDonnees}
                />
              ) : (
                <EventList evenements={evenements} max={6} />
              )}
              <Callout ton="info" className="mt-4" titre="Repérer une règle trop sensible">
                Une règle qui se déclenche à presque chaque cycle de collecte, sans incident réel en
                face, produit du bruit plutôt que de l’information. Le bon réflexe est de monter le
                seuil ou d’allonger la durée de dépassement — pas de couper le canal de
                notification, qui finirait par masquer une vraie alerte.
              </Callout>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Jauge({ valeur, seuil }: { valeur: number; seuil: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative block h-1.5 w-16 overflow-hidden rounded-full bg-g-100">
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            valeur >= seuil ? 'bg-err' : valeur >= seuil - 15 ? 'bg-warn' : 'bg-p-600',
          )}
          style={{ width: `${Math.min(100, valeur)}%` }}
        />
      </span>
      <span
        className={cn(
          'tnum text-[11.5px] font-semibold',
          valeur >= seuil ? 'text-err' : valeur === 0 ? 'text-g-500' : 'text-g-700',
        )}
      >
        {pct(valeur)}
      </span>
    </span>
  )
}
