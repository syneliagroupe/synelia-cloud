'use client'

import { useState } from 'react'
import { AlertTriangle, Megaphone, RefreshCw, Send } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { dateHeure, duree, num, pct, relatif } from '@/lib/format'
import {
  ALERTES_PLATEFORME,
  BACKENDS,
  INCIDENTS,
  JOBS_PLATEFORME,
  STATUT_SERVICES,
} from '@/lib/mock'
import {
  BACKEND_LABEL,
  SITE_COURT,
  type Backend,
  type Incident,
  type ProvisioningJob,
  type StatutService,
} from '@/lib/types'
import { MAINTENANT } from '@/lib/format'
import { Badge, MicroLabel, StatusDot } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { HealthBadge, QuotaBar, StatTile } from '@/components/composition/metrics'
import { Timeline } from '@/components/composition/flow'
import { EventList, GrilleSparkCharts, LiensSortie } from '@/components/business/observabilite'
import { BackendGauge } from '@/components/business/infra'
import { JobTracker } from '@/components/business/paas'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, modifierRessource, requete } from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'

const ONGLETS = [
  { id: 'services', label: 'État des services' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'socles', label: 'Socles techniques' },
  { id: 'jobs', label: 'Provisionnements' },
  { id: 'alertes', label: 'Alertes' },
]

export default function SantePlateforme() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const jobs = useCollection<ProvisioningJob>('jobs-plateforme', JOBS_PLATEFORME)
  const { reprendreJob } = useAtelier()
  const incidents = useCollection<Incident>('incidents', INCIDENTS)
  // Pas de `GET` pour les états publiés (seul `PUT /admin/statut/services`
  // existe) : la collection porte le local, l’appel pousse la liste entière.
  // `nom` sert d’identifiant, retiré du corps envoyé.
  const statutsServices = useCollection<StatutService & { id: string }>(
    'statut-services',
    STATUT_SERVICES.map((s) => ({ ...s, id: s.nom })),
  )
  const servicesEtats = statutsServices.items
  const pousserEtats = (items: Array<StatutService & { id: string }>) =>
    requete('/admin/statut/services', {
      methode: 'PUT',
      corps: {
        services: items.map((s) => ({
          nom: s.nom,
          categorie: s.categorie,
          etats: s.etats,
          uptime90j: s.uptime90j,
        })),
      },
    })
  // En mode API, les socles et les jobs viennent du backend ; la maquette,
  // non filtrée par lui, garderait des identifiants inconnus de l’API.
  const socles = useCollection<Backend>('backends', BACKENDS)
  const SOCLES = estActif() ? socles.items : BACKENDS
  // `GET /admin/sante` ne sert que son `424` : les chiffres restent locaux,
  // mais une intégration amont en panne se dit au lieu de se taire.
  const { degrade } = useLectureDegradable('/admin/sante')
  const [onglet, setOnglet] = useState('services')
  const [communication, setCommunication] = useState<string | null>(null)
  const [titreCommunication, setTitreCommunication] = useState('')
  const [typeCommunication, setTypeCommunication] = useState('incident')
  const [graviteCommunication, setGraviteCommunication] = useState('majeur')
  const [serviceTouche, setServiceTouche] = useState('')
  const [sitesTouches, setSitesTouches] = useState('ABJ')
  const [texteCommunication, setTexteCommunication] = useState(
    'Depuis 14 h 10 GMT, les services managés hébergés à Abidjan présentent des temps de réponse dégradés. La cause est identifiée : saturation d’un lien de stockage. Nos équipes travaillent au rééquilibrage. Aucune donnée n’est affectée. Prochaine communication dans 30 minutes.',
  )
  const [notifierClients, setNotifierClients] = useState(true)
  const [publierStatut, setPublierStatut] = useState(true)
  const [smsAstreinte, setSmsAstreinte] = useState(false)

  // La cible est un incident connu, un service dégradé (on ouvre alors un
  // incident), ou `'nouveau'` (même cas, titre à saisir dans la modale).
  const incidentCible =
    communication && communication !== 'nouveau'
      ? (incidents.items.find((i) => i.id === communication) ?? null)
      : null

  const publierCommunication = () => {
    const texte = texteCommunication || 'Mise à jour publiée depuis le portail.'
    const sites =
      sitesTouches === 'tous' ? ['ABJ', 'GBM'] : [sitesTouches]
    // Le type choisi dans la modale fait aussi changer l’état de l’incident :
    // une résolution le clôt (avec sa date de fin), une maintenance le passe
    // sous surveillance. Une simple information ne touche pas à l’état.
    const statutCible =
      typeCommunication === 'resolution'
        ? 'resolu'
        : typeCommunication === 'maintenance'
          ? 'surveille'
          : typeCommunication === 'incident'
            ? 'en_cours'
            : undefined
    executer({
      action: 'capacity.manage',
      titre: 'Communication publiée',
      detail:
        'Visible immédiatement sur la page de statut publique et envoyée aux organisations touchées.',
      appel: () =>
        incidentCible
          ? requete(`/admin/statut/incidents/${encodeURIComponent(incidentCible.id)}`, {
              methode: 'POST',
              corps: {
                texte,
                ...(statutCible ? { statut: statutCible } : {}),
                notifierClients,
              },
            })
          : creerRessource('/admin/statut/incidents', {
              titre:
                titreCommunication.trim() ||
                (typeof communication === 'string' && communication !== 'nouveau'
                  ? communication
                  : 'Incident plateforme'),
              gravite: graviteCommunication,
              services: serviceTouche ? [serviceTouche] : [],
              sites,
              message: texte,
              notifierClients,
            }),
      effet: () => {
        if (incidentCible) {
          incidents.modifier(incidentCible.id, (i) => ({
            mises_a_jour: [...i.mises_a_jour, { ts: MAINTENANT, texte }],
            ...(statutCible ? { statut: statutCible } : {}),
            ...(statutCible === 'resolu' ? { fin: MAINTENANT } : {}),
          }))
          return
        }
        incidents.creer({
          id: incidents.identifiant('inc'),
          titre:
            titreCommunication.trim() ||
            (typeof communication === 'string' && communication !== 'nouveau'
              ? communication
              : 'Incident plateforme'),
          gravite: graviteCommunication as Incident['gravite'],
          statut: 'en_cours',
          debut: MAINTENANT,
          services: serviceTouche ? [serviceTouche] : [],
          sites: sites as Incident['sites'],
          mises_a_jour: [{ ts: MAINTENANT, texte }],
        })
      },
      effetFinal: () => incidents.recharger(),
    })
    setCommunication(null)
  }

  const nonOperationnel = (s: (typeof servicesEtats)[number]) =>
    (['ABJ', 'GBM'] as const).some((x) => s.etats[x] !== 'operationnel')
  const degrades = servicesEtats.filter(nonOperationnel)
  const incidentsOuverts = incidents.items.filter((i) => i.statut !== 'resolu')
  const jobsEchec = jobs.items.filter((j) => j.statut === 'failed')
  const jobsEnCours = jobs.items.filter((j) => j.statut === 'running' || j.statut === 'queued')
  const soclesHs = SOCLES.filter((b) => b.statut !== 'en_ligne')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Santé de la plateforme' }]}
        titre="Santé de la plateforme"
        sousTitre="Ce que nous voyons, et ce que nous publions. La page de statut publique est alimentée depuis cet écran : nous ne maintenons pas deux vérités différentes, une pour nous et une pour les clients."
        actions={
          <>
            <ButtonLink variant="secondary" external href="/statut">
              Voir la page publique
            </ButtonLink>
            <GatedAction autorise={autorise('capacity.manage')} message={refus('capacity.manage')}>
              <Button
                iconBefore={<Megaphone size={14} />}
                onClick={() => setCommunication('nouveau')}
              >
                Publier une communication
              </Button>
            </GatedAction>
          </>
        }
        meta={
          <>
            <Badge tone={degrades.length === 0 ? 'ok' : 'warn'} dot size="sm">
              {degrades.length === 0
                ? 'Tous les services opérationnels'
                : `${degrades.length} service dégradé`}
            </Badge>
            <Badge tone="neutral" size="sm">
              Données à {dateHeure('2026-08-19T15:20:00Z')}
            </Badge>
          </>
        }
      />

      {degrade && (
        <Callout
          ton="warn"
          titre={`Supervision dégradée${degrade.integration ? ` — ${degrade.integration}` : ''}`}
        >
          L’intégration amont ne répond pas
          {degrade.dateDonnees ? ` (données du ${dateHeure(degrade.dateDonnees)})` : ''} : les
          chiffres ci-dessous sont les derniers connus, pas l’état actuel. Détail temps réel dans
          Centreon et Grafana.
        </Callout>
      )}

      {incidentsOuverts.length > 0 && (
        <Callout ton="err" titre={`${incidentsOuverts.length} incident${incidentsOuverts.length > 1 ? 's' : ''} en cours`}>
          {incidentsOuverts.map((i) => i.titre).join(' · ')}. Chaque incident ouvert doit porter une
          communication publique à jour : un client qui constate une panne sans rien lire sur la page
          de statut ouvre un ticket, ce qui charge le support au pire moment.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          libelle="Services opérationnels"
          valeur={`${servicesEtats.length - degrades.length}/${servicesEtats.length}`}
          ton={degrades.length === 0 ? 'ok' : 'warn'}
        />
        <StatTile
          libelle="Incidents ouverts"
          valeur={incidentsOuverts.length}
          ton={incidentsOuverts.length > 0 ? 'err' : 'ok'}
        />
        <StatTile
          libelle="Socles hors service"
          valeur={soclesHs.length}
          ton={soclesHs.length > 0 ? 'warn' : 'ok'}
          detail={soclesHs.length > 0 ? soclesHs.map((b) => b.code).join(', ') : 'Tous en ligne'}
        />
        <StatTile
          libelle="Provisionnements en échec"
          valeur={jobsEchec.length}
          ton={jobsEchec.length > 0 ? 'err' : 'ok'}
        />
        <StatTile
          libelle="Disponibilité 30 j"
          valeur={pct(99.96, 2)}
          ton="ok"
          detail="Mesurée hors plateforme"
          serie={seededSeries('dispo-30j', 30, 99.7, 100)}
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'services' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="État par service"
                sousTitre="Ces états sont publiés tels quels sur la page de statut publique."
                className="mb-0"
                actions={<LiensSortie centreon grafana />}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Service', 'Catégorie', 'Abidjan', 'Grand-Bassam', 'Disponibilité 90 j', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {servicesEtats.map((s) => (
                    <tr key={s.nom} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 text-[12.5px] font-semibold text-ink">{s.nom}</td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-500">{s.categorie}</td>
                      <td className="px-3 py-2.5">
                        <HealthBadge
                          etat={s.etats.ABJ === 'panne' ? 'erreur' : s.etats.ABJ}
                          size="sm"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <HealthBadge
                          etat={s.etats.GBM === 'panne' ? 'erreur' : s.etats.GBM}
                          size="sm"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'tnum text-[12px] font-semibold',
                            s.uptime90j >= 99.9 ? 'text-ok' : 'text-warn',
                          )}
                        >
                          {pct(s.uptime90j, 2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                        <BoutonFormulaire
                          libelle="État"
                          variant="ghost"
                          action="capacity.manage"
                          titre={`État publié de ${s.nom}`}
                          description="Ces états sont publiés tels quels sur la page de statut publique : un « panne » affiché à tort ouvre des tickets pour rien."
                          champs={[
                            {
                              id: 'abj',
                              label: 'Abidjan',
                              type: 'select',
                              demi: true,
                              options: [
                                { value: 'operationnel', label: 'Opérationnel' },
                                { value: 'degrade', label: 'Dégradé' },
                                { value: 'panne', label: 'Panne' },
                                { value: 'maintenance', label: 'Maintenance' },
                              ],
                            },
                            {
                              id: 'gbm',
                              label: 'Grand-Bassam',
                              type: 'select',
                              demi: true,
                              options: [
                                { value: 'operationnel', label: 'Opérationnel' },
                                { value: 'degrade', label: 'Dégradé' },
                                { value: 'panne', label: 'Panne' },
                                { value: 'maintenance', label: 'Maintenance' },
                              ],
                            },
                          ]}
                          valeursDepart={{ abj: s.etats.ABJ, gbm: s.etats.GBM }}
                          libelleValider="Publier l’état"
                          operation={(v) => {
                            const prochains = servicesEtats.map((x) =>
                              x.nom === s.nom
                                ? {
                                    ...x,
                                    etats: {
                                      ABJ: String(v.abj),
                                      GBM: String(v.gbm),
                                    } as StatutService['etats'],
                                  }
                                : x,
                            )
                            return {
                              titre: `État de ${s.nom} publié`,
                              detail: `Abidjan : ${v.abj} · Grand-Bassam : ${v.gbm}.`,
                              appel: () => pousserEtats(prochains),
                              effet: () =>
                                statutsServices.modifier(s.nom, {
                                  etats: {
                                    ABJ: String(v.abj),
                                    GBM: String(v.gbm),
                                  } as StatutService['etats'],
                                }),
                              effetFinal: () => statutsServices.recharger(),
                            }
                          }}
                        />
                        {nonOperationnel(s) && (
                          <GatedAction
                            autorise={autorise('capacity.manage')}
                            message={refus('capacity.manage')}
                          >
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setCommunication(s.nom)}
                            >
                              Communiquer
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

          <GrilleSparkCharts
            seed="plateforme-sante"
            metriques={[
              { titre: 'Requêtes API par seconde', unite: 'req/s', min: 180, max: 940 },
              { titre: 'Latence du portail', unite: 'ms', min: 60, max: 220, seuil: 300 },
              {
                titre: 'Taux d’erreur API',
                unite: '%',
                min: 0,
                max: 1.2,
                seuil: 1,
                couleur: 'var(--color-err)',
              },
              { titre: 'Provisionnements par heure', unite: '', min: 2, max: 28 },
            ]}
          />

          <Callout ton="violet" titre="La mesure vient de l’extérieur">
            La disponibilité affichée est mesurée depuis trois points de contrôle indépendants, hors
            de nos réseaux. Se mesurer depuis sa propre infrastructure revient à ne pas voir les
            pannes de connectivité, qui sont précisément celles que le client subit.
          </Callout>
        </div>
      )}

      {onglet === 'incidents' && (
        <div className="space-y-4">
          {incidents.items.map((i) => (
            <Card
              key={i.id}
              className={cn(
                i.statut === 'en_cours'
                  ? 'border-err/40'
                  : i.statut === 'surveille'
                    ? 'border-warn/40'
                    : '',
              )}
            >
              <CardHeader
                titre={i.titre}
                sousTitre={`Débuté le ${dateHeure(i.debut)}${i.fin ? ` · résolu le ${dateHeure(i.fin)}` : ' · toujours en cours'}`}
                actions={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={
                        i.gravite === 'majeur'
                          ? 'err'
                          : i.gravite === 'mineur'
                            ? 'warn'
                            : 'info'
                      }
                      size="sm"
                    >
                      {i.gravite === 'majeur'
                        ? 'Majeur'
                        : i.gravite === 'mineur'
                          ? 'Mineur'
                          : 'Maintenance'}
                    </Badge>
                    <Badge
                      tone={
                        i.statut === 'resolu' ? 'ok' : i.statut === 'surveille' ? 'warn' : 'err'
                      }
                      dot
                      size="sm"
                    >
                      {i.statut === 'resolu'
                        ? 'Résolu'
                        : i.statut === 'surveille'
                          ? 'Sous surveillance'
                          : 'En cours'}
                    </Badge>
                  </span>
                }
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <MicroLabel className="mb-2">Communications publiées</MicroLabel>
                  <Timeline
                    evenements={i.mises_a_jour.map((m, k) => ({
                      id: `${i.id}-${k}`,
                      titre: m.texte,
                      horodatage: dateHeure(m.ts),
                      ton:
                        k === 0
                          ? i.statut === 'resolu'
                            ? 'ok'
                            : 'err'
                          : k === i.mises_a_jour.length - 1
                            ? 'info'
                            : 'neutral',
                    }))}
                  />
                  {i.statut !== 'resolu' && (
                    <GatedAction
                      autorise={autorise('capacity.manage')}
                      message={refus('capacity.manage')}
                    >
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3.5"
                        iconBefore={<Send size={12} />}
                        onClick={() => setCommunication(i.id)}
                      >
                        Publier une mise à jour
                      </Button>
                    </GatedAction>
                  )}
                </div>
                <div>
                  <KeyValueList
                    colonnes={1}
                    items={[
                      { cle: 'Services touchés', valeur: i.services.join(', ') },
                      { cle: 'Sites', valeur: i.sites.map((s) => SITE_COURT[s]).join(', ') },
                      {
                        cle: 'Durée',
                        valeur: i.fin
                          ? duree(
                              Math.round(
                                (new Date(i.fin).getTime() - new Date(i.debut).getTime()) / 1000,
                              ),
                            )
                          : 'En cours',
                      },
                      { cle: 'Communications', valeur: `${i.mises_a_jour.length} publiées` },
                    ]}
                  />
                  {i.statut === 'resolu' && (
                    <BoutonAction
                      libelle="Rapport d’incident"
                      variant="ghost"
                      className="mt-3"
                      operation={{
                        action: 'capacity.manage',
                        titre: `Rapport d’incident ${i.id} généré`,
                        detail:
                          'Chronologie, cause racine, impact client et actions correctives — le document qu’on remet au client sans qu’il le demande.',
                        job: {
                          type: 'incident.report',
                          label: `Rapport d’incident · ${i.titre}`,
                          etapes: [
                            'Rassembler la chronologie et les communications',
                            'Reprendre la cause racine et les actions correctives',
                            'Composer le rapport',
                          ],
                          dureeEtapeMs: 900,
                        },
                      }}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}

          <Callout ton="info" titre="Un incident majeur donne lieu à un rapport écrit">
            Sous cinq jours ouvrés, nous publions ce qui s’est passé, ce qui a permis que ça arrive,
            comment nous l’avons traité, et ce que nous changeons pour que ça ne se reproduise pas. Le
            rapport est envoyé aux organisations touchées, pas seulement à celles qui l’ont réclamé.
          </Callout>
        </div>
      )}

      {onglet === 'socles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SOCLES.map((b) => (
              <BackendGauge key={b.id} backend={b} />
            ))}
          </div>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Détail des socles"
                sousTitre="Un socle en maintenance ne reçoit plus de nouveaux placements, mais continue de servir ses charges existantes."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Socle', 'Technologie', 'Site', 'Hôtes', 'vCPU', 'Mémoire', 'Stockage', 'Souverain', 'État', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {SOCLES.map((b) => (
                    <tr key={b.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="block font-mono text-[12px] font-semibold text-ink">
                          {b.code}
                        </span>
                        {b.enSortie?.actif && (
                          <Badge tone="warn" size="sm">
                            En sortie
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                        {BACKEND_LABEL[b.type]}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">{SITE_COURT[b.site]}</td>
                      <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{b.hosts}</td>
                      <td className="px-3 py-2.5">
                        <span className="tnum text-[11.5px] text-g-700">
                          {num(b.capacite.vcpu)}
                          <span className="ml-1.5 font-semibold text-ink">
                            {pct(b.usage.vcpuPct)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="tnum text-[11.5px] text-g-700">
                          {num(b.capacite.ramGo)} Go
                          <span className="ml-1.5 font-semibold text-ink">{pct(b.usage.ramPct)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="tnum text-[11.5px] text-g-700">
                          {num(b.capacite.stockageTo)} To
                          <span className="ml-1.5 font-semibold text-ink">
                            {pct(b.usage.stockagePct)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={b.souverain ? 'ok' : 'warn'} size="sm">
                          {b.souverain ? 'Libre' : 'Propriétaire'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <HealthBadge etat={b.statut === 'en_ligne' ? 'ok' : b.statut} size="sm" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <BoutonFormulaire
                          libelle="État"
                          variant="ghost"
                          action="capacity.manage"
                          titre={`État du socle ${b.code}`}
                          description="Un socle en maintenance ne reçoit plus de nouveaux placements, mais continue de servir ses charges existantes."
                          champs={[
                            {
                              id: 'statut',
                              label: 'État',
                              type: 'select',
                              options: [
                                { value: 'en_ligne', label: 'En ligne' },
                                { value: 'maintenance', label: 'Maintenance planifiée' },
                                { value: 'degrade', label: 'Dégradé' },
                              ],
                            },
                          ]}
                          valeursDepart={{ statut: b.statut }}
                          libelleValider="Appliquer"
                          operation={(v) => ({
                            titre: `Socle ${b.code} : ${v.statut}`,
                            detail:
                              String(v.statut) === 'en_ligne'
                                ? 'Le socle reçoit de nouveau les placements.'
                                : 'Retiré du pool de placement : les créations sont dirigées ailleurs.',
                            appel: () =>
                              modifierRessource('/admin/backends', b.id, {
                                statut: v.statut,
                              }),
                            effet: () =>
                              socles.modifier(b.id, {
                                statut: v.statut as Backend['statut'],
                              }),
                            effetFinal: () => socles.recharger(),
                          })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {soclesHs.length > 0 && (
            <Callout ton="warn" titre={`${soclesHs.length} socle n’est pas en ligne`}>
              {soclesHs
                .map(
                  (b) =>
                    `${b.code} (${BACKEND_LABEL[b.type]}, ${SITE_COURT[b.site]}) — ${b.statut === 'maintenance' ? 'en maintenance planifiée' : 'dégradé'}`,
                )
                .join(' · ')}
              . Un socle en maintenance est retiré du pool de placement : les créations d’Espaces
              Cloud sont dirigées ailleurs automatiquement, sans intervention.
            </Callout>
          )}
        </div>
      )}

      {onglet === 'jobs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatTile libelle="En file" valeur={jobs.items.filter((j) => j.statut === 'queued').length} ton="info" />
            <StatTile libelle="En cours" valeur={jobs.items.filter((j) => j.statut === 'running').length} ton="info" />
            <StatTile libelle="Terminés" valeur={jobs.items.filter((j) => j.statut === 'done').length} ton="ok" />
            <StatTile
              libelle="En échec"
              valeur={jobsEchec.length}
              ton={jobsEchec.length > 0 ? 'err' : 'ok'}
            />
          </div>

          {jobsEchec.length > 0 && (
            <Card>
              <CardHeader
                titre="Provisionnements en échec"
                sousTitre="L’étape fautive, le message du socle et l’identifiant de corrélation. Une reprise repart de l’étape échouée, pas du début."
              />
              <div className="space-y-4">
                {jobsEchec.map((j) => (
                  <div key={j.id}>
                    <JobTracker job={j} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <GatedAction
                        autorise={autorise('capacity.manage')}
                        message={refus('capacity.manage')}
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          iconBefore={<RefreshCw size={12} />}
                          onClick={() =>
                            executer({
                              action: 'capacity.manage',
                              ton: 'info',
                              titre: 'Reprise déclenchée',
                              detail:
                                'Le provisionnement repart de l’étape échouée. Aucune ressource déjà créée n’est recréée.',
                              appel: () =>
                                requete(`/travaux/${encodeURIComponent(j.id)}/relance`, {
                                  methode: 'POST',
                                }),
                              effet: () =>
                                reprendreJob(j.id, 'jobs-plateforme', JOBS_PLATEFORME),
                              effetFinal: () => jobs.recharger(),
                            })
                          }
                        >
                          Reprendre à l’étape échouée
                        </Button>
                      </GatedAction>
                      <BoutonAction
                        libelle="Annuler et nettoyer"
                        variant="ghost"
                        operation={{
                          action: 'capacity.manage',
                          ton: 'warn',
                          titre: `« ${j.label} » annulé`,
                          detail:
                            'Les ressources déjà créées sont détruites dans l’ordre inverse et le quota rendu. Aucune souscription facturable n’a été ouverte.',
                          appel: () =>
                            requete(`/travaux/${encodeURIComponent(j.id)}/annulation`, {
                              methode: 'POST',
                            }),
                          effet: () => jobs.modifier(j.id, { statut: 'rolled_back' }),
                          effetFinal: () => jobs.recharger(),
                        }}
                      />
                      <BoutonAction
                        libelle="Ouvrir un ticket interne"
                        variant="ghost"
                        operation={{
                          action: 'capacity.manage',
                          titre: 'Ticket interne ouvert',
                          detail: j.erreur?.correlationId
                            ? `Rattaché à l’identifiant de corrélation ${j.erreur.correlationId}.`
                            : 'Le job et sa trace sont joints automatiquement.',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Callout ton="warn" className="mt-4" titre="Une annulation nettoie les ressources partielles">
                Un provisionnement interrompu peut avoir créé un réseau, un volume ou une entrée DNS.
                L’annulation les supprime dans l’ordre inverse de leur création, pour ne pas laisser de
                ressources orphelines facturées à un client qui n’a rien obtenu.
              </Callout>
            </Card>
          )}

          {jobsEnCours.length > 0 && (
            <Card>
              <CardHeader titre="Provisionnements en cours" sousTitre="Suivi étape par étape." />
              <div className="space-y-4">
                {jobsEnCours.map((j) => (
                  <JobTracker key={j.id} job={j} />
                ))}
              </div>
            </Card>
          )}

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader titre="Historique" sousTitre="Tous les provisionnements récents." className="mb-0" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Type', 'Cible', 'Étapes', 'Durée', 'Lancé', 'Statut'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.items.map((j) => (
                    <tr key={j.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2 text-[12px] font-semibold text-ink">{j.type}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-g-700">{j.label}</td>
                      <td className="px-3 py-2 text-[11.5px] text-g-700">
                        {j.taches.filter((t) => t.statut === 'ok').length}/{j.taches.length}
                      </td>
                      <td className="tnum px-3 py-2 text-[11.5px] text-g-700">
                        {j.dureeS ? duree(j.dureeS) : '—'}
                      </td>
                      <td className="px-3 py-2 text-[11.5px] text-g-500">{relatif(j.startedAt, maintenant)}</td>
                      <td className="px-3 py-2">
                        <Badge
                          tone={
                            j.statut === 'done'
                              ? 'ok'
                              : j.statut === 'failed'
                                ? 'err'
                                : j.statut === 'rolled_back'
                                  ? 'warn'
                                  : 'info'
                          }
                          dot
                          size="sm"
                        >
                          {
                            {
                              queued: 'En file',
                              running: 'En cours',
                              done: 'Terminé',
                              failed: 'Échec',
                              rolled_back: 'Annulé',
                            }[j.statut]
                          }
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {onglet === 'alertes' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Alertes de plateforme"
              sousTitre="Toutes sévérités, tous socles, toutes organisations."
            />
            <EventList
              evenements={ALERTES_PLATEFORME}
              max={8}
              lienSortie="Ouvrir Centreon"
              hrefSortie="https://centreon.synelia.cloud/monitoring/resources"
            />
            <div className="mt-4 border-t border-g-100 pt-4">
              <LiensSortie centreon grafana logs />
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Bruit d’alerte"
              sousTitre="Une règle qui se déclenche sans incident associé finit par être ignorée. Nous les traquons."
            />
            <div className="space-y-2">
              {[
                {
                  r: 'Charge processeur supérieure à 80 % sur un socle',
                  n: 142,
                  incidents: 0,
                  d: 'Nos socles sont dimensionnés pour tourner à 75 %. Le seuil devrait être à 92 %, ou la durée portée à 30 minutes.',
                },
                {
                  r: 'Latence de sauvegarde supérieure à 2 h',
                  n: 38,
                  incidents: 1,
                  d: 'Se déclenche systématiquement pendant la fenêtre de sauvegarde complète du dimanche. À exclure de cette fenêtre.',
                },
                {
                  r: 'Perte de paquets sur un lien opérateur',
                  n: 12,
                  incidents: 4,
                  d: 'Utile : un tiers des déclenchements correspond à un incident réel.',
                },
                {
                  r: 'Certificat expirant sous 30 jours',
                  n: 4,
                  incidents: 0,
                  d: 'Aucun incident, parce que l’alerte fonctionne : chaque déclenchement a mené à un renouvellement avant échéance.',
                },
              ].map((x) => {
                const bruit = x.incidents === 0 && x.n > 20
                return (
                  <div
                    key={x.r}
                    className={cn(
                      'rounded-[6px] border px-3 py-2.5',
                      bruit ? 'border-warn/40 bg-warn-bg' : 'border-g-300',
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="min-w-0 text-[12.5px] font-semibold text-ink">{x.r}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge tone="neutral" size="sm">
                          {x.n} déclenchements
                        </Badge>
                        <Badge tone={x.incidents > 0 ? 'ok' : 'warn'} size="sm">
                          {x.incidents} incident{x.incidents > 1 ? 's' : ''}
                        </Badge>
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">{x.d}</p>
                    {bruit && (
                      <BoutonFormulaire
                        libelle="Ajuster le seuil"
                        variant="ghost"
                        className="mt-1.5"
                        action="capacity.manage"
                        titre={`Ajuster « ${x.r} »`}
                        description="Une règle qui déclenche souvent sans incident derrière finit ignorée. Relever le seuil ou allonger la durée de dépassement vaut mieux que la désactiver."
                        champs={[
                          {
                            id: 'duree',
                            label: 'Durée de dépassement exigée',
                            type: 'select',
                            options: [
                              { value: '5 min', label: '5 minutes' },
                              { value: '15 min', label: '15 minutes' },
                              { value: '30 min', label: '30 minutes' },
                              { value: '1 h', label: '1 heure' },
                            ],
                          },
                        ]}
                        valeursDepart={{ duree: '30 min' }}
                        libelleValider="Ajuster"
                        operation={(v) => ({
                          titre: `Seuil de « ${x.r} » ajusté`,
                          detail: `Déclenchement après ${v.duree} de dépassement continu.`,
                        })}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <Callout ton="violet" className="mt-4" titre="Une alerte ignorée est pire que pas d’alerte">
              <span className="inline-flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Quand une équipe s’habitue à voir passer une alerte sans conséquence, elle finit par
                ne plus lire les autres. Réviser les seuils n’est pas de la cosmétique : c’est ce qui
                garde le signal audible.
              </span>
            </Callout>
          </Card>
        </div>
      )}

      <Modal
        open={communication !== null}
        onClose={() => setCommunication(null)}
        title="Publier une communication"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCommunication(null)}>
              Annuler
            </Button>
            <Button iconBefore={<Send size={13} />} onClick={publierCommunication}>
              Publier
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {incidentCible === null && (
            <Field
              label="Titre de l’incident"
              hint="exigé pour ouvrir un incident — une mise à jour n’en a pas besoin"
              required
            >
              <Input
                placeholder="Latence anormale sur les services managés d’Abidjan"
                value={titreCommunication}
                onChange={(e) => setTitreCommunication(e.target.value)}
              />
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select
                value={typeCommunication}
                onChange={(e) => setTypeCommunication(e.target.value)}
              >
                <option value="incident">Incident en cours</option>
                <option value="resolution">Résolution d’un incident</option>
                <option value="maintenance">Maintenance planifiée</option>
                <option value="info">Information</option>
              </Select>
            </Field>
            <Field label="Gravité">
              <Select
                value={graviteCommunication}
                onChange={(e) => setGraviteCommunication(e.target.value)}
              >
                <option value="majeur">Majeure — service indisponible</option>
                <option value="mineur">Mineure — service dégradé</option>
                <option value="maintenance">Maintenance — interruption planifiée</option>
              </Select>
            </Field>
          </div>
          <Field label="Services touchés" hint="détermine qui reçoit la notification">
            <Select value={serviceTouche} onChange={(e) => setServiceTouche(e.target.value)}>
              <option value="">Sélectionner…</option>
              {servicesEtats.map((s) => (
                <option key={s.nom} value={s.nom}>
                  {s.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sites concernés">
            <Select value={sitesTouches} onChange={(e) => setSitesTouches(e.target.value)}>
              <option value="ABJ">Abidjan · ABJ-1</option>
              <option value="GBM">Grand-Bassam · GBM-1</option>
              <option value="tous">Les deux sites</option>
            </Select>
          </Field>
          <Field
            label="Texte publié"
            hint="ce que le client lit — dites ce que vous savez, ce que vous ignorez encore, et quand vous recommuniquerez"
          >
            <Textarea
              rows={5}
              value={texteCommunication}
              onChange={(e) => setTexteCommunication(e.target.value)}
            />
          </Field>
          <div className="space-y-3">
            <Switch
              checked={notifierClients}
              onChange={setNotifierClients}
              label="Notifier les organisations touchées par courriel"
              description="Seules celles dont une ressource est réellement concernée. Notifier tout le monde à chaque incident finit par faire ignorer les notifications."
            />
            <Switch
              checked={publierStatut}
              onChange={setPublierStatut}
              label="Publier sur la page de statut publique"
            />
            <Switch
              checked={smsAstreinte}
              onChange={setSmsAstreinte}
              label="Envoyer un SMS aux contacts d’astreinte"
              description="À réserver aux incidents majeurs affectant la production."
            />
          </div>
          <Callout ton="info" titre="Ce qu’une bonne communication d’incident contient">
            L’heure de début, ce qui est affecté, ce qui ne l’est pas, si des données sont en jeu, ce
            que vous faites, et quand vous recommuniquerez. Une communication sans horaire de
            prochaine mise à jour laisse le client rafraîchir la page toutes les cinq minutes.
          </Callout>
        </div>
      </Modal>
    </div>
  )
}
