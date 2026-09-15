'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateHeure, duree, money, relatif } from '@/lib/format'
import type { DomaineApplicatif, Projet, ServiceProjet } from '@/lib/types'
import {
  DOMAINES_APPLICATIFS,
  PROJETS,
  SERVICES_PROJET,
  EVENEMENTS_SUPERVISION,
  LOGS_EXECUTION,
  MOTEUR_LABEL,
  MOTEUR_URI,
  TYPE_SERVICE_LABEL,
  ZONE_APPLICATIVE,
  deploiementsDeLApp,
  domainesDuService,
  serviceProjetById,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Slider, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { ConfirmDialog, Drawer } from '@/components/ui/overlay'
import { EventList, GrilleSparkCharts, LogPeek } from '@/components/business/observabilite'
import { EmplacementReel, StatutServiceBadge } from '@/components/business/projets'
import { ConfigurationServicePanel } from '@/components/business/configuration-service'
import { configurationDuService } from '@/lib/configurations'
import { modeleBySlug } from '@/lib/mock/modeles'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, requete, supprimerRessource } from '@/lib/api/client'
import { useServicesProjet } from '@/lib/api/services-projet'

/** Raccourci : la collection des services d'un projet, partout dans ce fichier. */
function useServices() {
  return useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
}

/** Le serveur ne répond plus 404 sur cette route : la vue s'en explique. */
function ServiceIntrouvable() {
  return (
    <div className="space-y-6">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Applications', href: '/app/applications' },
          { label: 'Service introuvable' },
        ]}
        titre="Ce service n’existe plus"
      />
      <EmptyState
        titre="Ce service n’existe plus"
        phrase="Il a été supprimé, ou la démonstration a été réinitialisée. La fiche de son projet liste les services encore en place."
        action={{ libelle: 'Voir tous les projets', href: '/app/applications/projets' }}
      />
    </div>
  )
}

/**
 * Les onglets dépendent du type — une base n'a pas de domaine, un cron n'a pas
 * de file — et du fait que le service vienne ou non d'un modèle. Un service
 * issu d'un modèle matérialise le contrat d'intégration en neuf capacités
 * (§6.1) : configuration, sièges, sauvegarde, versions, réversibilité.
 */
function ongletsDu(service: ServiceProjet) {
  const communs = [{ id: 'apercu', label: 'Aperçu' }]
  const specifiques =
    service.type === 'base'
      ? [
          { id: 'connexion', label: 'Connexion' },
          { id: 'sauvegardes', label: 'Sauvegardes' },
        ]
      : service.type === 'cron'
        ? [{ id: 'executions', label: 'Exécutions' }]
        : service.type === 'worker'
          ? [{ id: 'file', label: 'File' }]
          : [
              { id: 'domaines', label: 'Domaines' },
              ...(service.modeleSlug ? [] : [{ id: 'deploiements', label: 'Déploiements' }]),
            ]
  const duModele = service.modeleSlug
    ? [
        { id: 'configuration', label: 'Configuration' },
        ...(service.sieges ? [{ id: 'sieges', label: 'Sièges' }] : []),
        ...(service.type === 'base' ? [] : [{ id: 'sauvegardes', label: 'Sauvegardes' }]),
        { id: 'versions', label: 'Versions' },
        { id: 'reversibilite', label: 'Réversibilité' },
      ]
    : []
  return [
    ...communs,
    ...specifiques,
    ...duModele,
    { id: 'variables', label: 'Variables' },
    { id: 'journaux', label: 'Journaux' },
    { id: 'supervision', label: 'Supervision' },
    { id: 'avance', label: 'Avancé' },
  ]
}

export function VueService({ id, projetId }: { id: string; projetId?: string }) {
  const maintenant = useMaintenant()
  const services = useServices()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesDomaines = useCollection<DomaineApplicatif>('domaines-applicatifs', DOMAINES_APPLICATIFS)
  const [onglet, setOnglet] = useState('apercu')
  const { autorise, refus } = useApp()

  // Avec l’API, le service vient de `GET /projets/{projetId}/services` (route
  // nichée) : un service né pendant la session n’existe pas dans le jeu figé.
  const { distants: servicesDistants, rechargerServices } = useServicesProjet(projetId ?? '')
  const service =
    (servicesDistants ?? services.items).find((x) => x.id === id) ??
    services.items.find((x) => x.id === id)
  const projet = service ? lesProjets.items.find((p) => p.id === service.projetId) : undefined

  if (!service || !projet) return <ServiceIntrouvable />

  const domaines = lesDomaines.items.filter((d) => d.serviceId === id)
  const onglets = ongletsDu(service)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Projets', href: '/app/applications/projets' },
          { label: projet.nom, href: `/app/applications/projets/${projet.id}` },
          { label: service.nom },
        ]}
        titre={
          <span className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono">{service.nom}</span>
            <span className="text-[14px] font-semibold text-g-500">
              {TYPE_SERVICE_LABEL[service.type]}
              {service.moteur && ` · ${MOTEUR_LABEL[service.moteur]} ${service.version}`}
            </span>
          </span>
        }
        sousTitre={
          service.type === 'base'
            ? 'Base managée par la plateforme : version qualifiée, sauvegarde appliquée, accès restreint au réseau du projet.'
            : service.type === 'cron'
              ? 'Commande exécutée selon une planification, avec historique daté de chaque exécution.'
              : service.type === 'worker'
                ? 'Processus de file sans port exposé. Sa santé se lit à la profondeur de file, pas à un code HTTP.'
                : 'Service exposé sur le web, construit depuis sa source puis déployé sans coupure.'
        }
        meta={
          <>
            <StatutServiceBadge statut={service.statut} size="md" />
            <Badge tone="neutral">{service.environnement}</Badge>
            <Badge tone="neutral">
              {service.ressources.cpu} vCPU · {service.ressources.ramMo / 1024} Go ·{' '}
              {service.ressources.diskGo} Go
            </Badge>
            <Badge tone="violet">{money(service.coutMensuel)}/mois</Badge>
            <span className="text-[11.5px] text-g-500">
              dernière modification {relatif(service.derniereMaj, maintenant)}
            </span>
          </>
        }
        actions={
          <>
            {domaines.length > 0 && (
              <ButtonLink
                href={`https://${domaines[0].hote}`}
                variant="secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir
                <ExternalLink size={13} />
              </ButtonLink>
            )}
            {service.statut === 'stopped' ? (
              <BoutonAction
                libelle="Démarrer"
                variant="primary"
                size="md"
                icone={<Play size={14} />}
                operation={{
                  action: 'app.deploy',
                  ton: 'info',
                  titre: `Démarrage de ${service.nom}`,
                  appel: () =>
                    requete(
                      `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(service.id)}/demarrage`,
                      { methode: 'POST', corps: {} },
                    ),
                  effet: () => services.modifier(service.id, { statut: 'building' }),
                  job: { workflow: 'service.start', cible: service.nom },
                  effetFinal: () => {
                    if (!estActif()) services.modifier(service.id, { statut: 'running' })
                    rechargerServices()
                  },
                }}
              />
            ) : (
              <BoutonAction
                libelle={service.type === 'base' ? 'Redémarrer' : 'Redéployer'}
                variant="primary"
                size="md"
                icone={<RefreshCw size={14} />}
                operation={{
                  action: 'app.deploy',
                  ton: 'info',
                  titre:
                    service.type === 'base'
                      ? `Redémarrage de ${service.nom}`
                      : `Redéploiement de ${service.nom}`,
                  detail:
                    service.type === 'base'
                      ? 'Les connexions en cours sont fermées proprement.'
                      : 'Déploiement sans coupure : l’ancienne version sert le trafic jusqu’à la bascule.',
                  effet: () => services.modifier(service.id, { statut: 'building' }),
                  appel: () =>
                    requete(
                      `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(service.id)}/redemarrage`,
                      { methode: 'POST', corps: {} },
                    ),
                  job: {
                    workflow: service.type === 'base' ? 'component.restart' : 'app.deploy',
                    cible: service.nom,
                  },
                  effetFinal: () => {
                    if (!estActif())
                      services.modifier(service.id, { statut: 'running', derniereMaj: MAINTENANT })
                    rechargerServices()
                  },
                }}
              />
            )}
          </>
        }
      />

      <Tabs tabs={onglets} active={onglet} onChange={setOnglet} />

      {onglet === 'apercu' && <Apercu service={service} domaines={domaines} />}
      {onglet === 'connexion' && <Connexion service={service} />}
      {onglet === 'sauvegardes' && <Sauvegardes service={service} />}
      {onglet === 'executions' && <Executions service={service} />}
      {onglet === 'file' && <FileAttente service={service} />}
      {onglet === 'domaines' && <Domaines service={service} domaines={domaines} />}
      {onglet === 'deploiements' && <Deploiements service={service} />}
      {onglet === 'configuration' && (
        <Configuration service={service} onVoirVariables={() => setOnglet('variables')} />
      )}
      {onglet === 'sieges' && <Sieges service={service} />}
      {onglet === 'versions' && <Versions service={service} />}
      {onglet === 'reversibilite' && <Reversibilite service={service} />}
      {onglet === 'variables' && <Variables service={service} />}
      {onglet === 'journaux' && <Journaux service={service} />}
      {onglet === 'supervision' && <Supervision service={service} />}
      {onglet === 'avance' && <Avance service={service} />}
    </div>
  )
}

// ─── Aperçu ───────────────────────────────────────────────────────────

function Apercu({
  service,
  domaines,
}: {
  service: ServiceProjet
  domaines: DomaineApplicatif[]
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        {service.statut === 'failed' && (
          <Callout ton="err" titre="Ce service est en échec">
            {service.type === 'cron'
              ? 'La dernière exécution planifiée s’est terminée en erreur. L’onglet Exécutions donne le journal complet et la commande jouée.'
              : 'Le service ne répond plus à ses sondes. L’onglet Journaux montre les vingt dernières lignes ; la supervision détaillée est dans Grafana.'}
          </Callout>
        )}
        {service.statut === 'building' && (
          <Callout ton="info" titre="Construction en cours">
            Le déploiement précédent reste en ligne jusqu’à ce que le nouveau passe ses contrôles de
            santé. Aucune coupure n’est attendue.
          </Callout>
        )}
        {service.statut === 'stopped' && (
          <Callout ton="warn" titre="Service arrêté">
            Un service arrêté ne facture ni processeur ni mémoire. Ses volumes, en revanche,
            continuent d’être facturés tant qu’ils existent.
          </Callout>
        )}

        <Card>
          <CardHeader
            titre="Caractéristiques"
            sousTitre="Ce que la plateforme exécute, exactement."
          />
          <KeyValueList
            colonnes={2}
            items={[
              { cle: 'Type', valeur: TYPE_SERVICE_LABEL[service.type] },
              ...(service.description ? [{ cle: 'Description', valeur: service.description }] : []),
              { cle: 'Environnement', valeur: service.environnement },
              ...(service.source
                ? [
                    {
                      cle: service.source.type === 'git' ? 'Dépôt' : 'Image',
                      valeur: (
                        <span className="font-mono text-[12px]">
                          {service.source.ref}
                          {service.source.branche && ` · ${service.source.branche}`}
                        </span>
                      ),
                    },
                  ]
                : service.type === 'application'
                  ? [
                      {
                        cle: 'Source',
                        valeur: <span className="text-g-500">Aucune — à configurer</span>,
                      },
                    ]
                  : []),
              ...(service.moteur
                ? [
                    {
                      cle: 'Moteur',
                      valeur: `${MOTEUR_LABEL[service.moteur]} ${service.version}`,
                    },
                  ]
                : []),
              ...(service.portConteneur
                ? [
                    {
                      cle: 'Port du conteneur',
                      valeur: <span className="tnum font-mono">{service.portConteneur}</span>,
                    },
                  ]
                : []),
              {
                cle: 'Processeur et mémoire',
                valeur: `${service.ressources.cpu} vCPU · ${service.ressources.ramMo / 1024} Go`,
              },
              { cle: 'Disque', valeur: `${service.ressources.diskGo} Go` },
              { cle: 'Coût mensuel', valeur: `${money(service.coutMensuel)} hors taxes` },
            ]}
          />
        </Card>

        {domaines.length > 0 && (
          <Card>
            <CardHeader
              titre="Adresses qui répondent"
              sousTitre="Une adresse offerte, plus les vôtres si vous en avez branché."
            />
            <div className="space-y-2">
              {domaines.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <a
                    href={`https://${d.hote}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[12.5px] font-semibold text-ink hover:text-p-700"
                  >
                    <span className="truncate">
                      {d.hote}
                      {d.chemin !== '/' && <span className="text-g-500">{d.chemin}</span>}
                    </span>
                    <ExternalLink size={11} className="shrink-0 text-g-500" />
                  </a>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Badge tone={d.origine === 'genere' ? 'violet' : 'neutral'} size="sm">
                      {d.origine === 'genere' ? 'Offert' : 'Votre domaine'}
                    </Badge>
                    <Badge tone={d.certificat.etat === 'actif' ? 'ok' : 'warn'} size="sm">
                      {d.certificat.etat === 'actif' ? 'HTTPS' : 'Certificat en attente'}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <EmplacementReel service={service} />

        <Card>
          <CardHeader titre="Sur 24 heures" sousTitre="Trois indicateurs, rien de plus." />
          <div className="space-y-2.5">
            <StatTile
              libelle="Processeur"
              valeur={service.statut === 'stopped' ? '—' : '38'}
              unite="%"
            />
            <StatTile
              libelle="Mémoire"
              valeur={service.statut === 'stopped' ? '—' : '61'}
              unite="%"
            />
            <StatTile
              libelle={service.type === 'worker' ? 'File d’attente' : 'Requêtes par minute'}
              valeur={
                service.statut === 'stopped'
                  ? '—'
                  : service.type === 'worker'
                    ? String(service.file?.enAttente ?? 0)
                    : '1 240'
              }
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-g-500">
            L’analyse fine se fait dans Grafana, la recherche de journaux dans VictoriaLogs. Le
            portail ne réimplémente ni l’un ni l’autre.
          </p>
        </Card>
      </div>
    </div>
  )
}

// ─── Connexion (base de données) ──────────────────────────────────────

function Connexion({ service }: { service: ServiceProjet }) {
  const { autorise, refus } = useApp()
  const services = useServices()
  const { rechargerServices } = useServicesProjet(service.projetId)
  const base = service.base!

  // En mode API, la liste des services ne porte jamais le mot de passe en clair
  // (`Base1.motDePasse` reste `null` sur `GET /projets/{id}/services`, par construction
  // côté backend) : sans cet appel dédié, le champ « Mot de passe » ci-dessous affichait
  // toujours une valeur vide derrière son masque, un bouton « révéler » qui ne révélait
  // rien. `GET .../identifiants` (RBAC `secrets.update`) porte le vrai secret.
  const [identifiants, setIdentifiants] = useState<{
    utilisateur?: string
    motDePasse?: string
  } | null>(null)
  const serviceId = service.id
  useEffect(() => {
    setIdentifiants(null)
    if (!estActif() || !serviceId) return
    let annule = false
    requete<{ utilisateur?: string; motDePasse?: string }>(
      `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(serviceId)}/identifiants`,
    ).then(
      (r) => {
        if (!annule) setIdentifiants(r)
      },
      () => {},
    )
    return () => {
      annule = true
    }
  }, [service.projetId, serviceId])

  const utilisateurReel = identifiants?.utilisateur ?? base.utilisateur
  const motDePasseReel = identifiants?.motDePasse ?? base.motDePasse ?? ''
  const uri = MOTEUR_URI[service.moteur!]({ ...base, utilisateur: utilisateurReel, motDePasse: motDePasseReel })
  const [expose, setExpose] = useState(service.exposeExterne?.actif ?? false)

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader
            titre="Connexion depuis le projet"
            sousTitre="Les services du même projet joignent la base par son nom interne, sans passer par Internet."
          />
          <div className="space-y-3">
            <div>
              <MicroLabel>URI de connexion</MicroLabel>
              <CopyField value={uri} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <MicroLabel>Hôte</MicroLabel>
                <CopyField value={base.hoteInterne} className="mt-1.5" />
              </div>
              <div>
                <MicroLabel>Port</MicroLabel>
                <CopyField value={String(base.port)} className="mt-1.5" />
              </div>
              <div>
                <MicroLabel>Base</MicroLabel>
                <CopyField value={base.nom} className="mt-1.5" />
              </div>
              <div>
                <MicroLabel>Utilisateur</MicroLabel>
                <CopyField value={utilisateurReel} className="mt-1.5" />
              </div>
            </div>
            <div>
              <MicroLabel>Mot de passe</MicroLabel>
              <CopyField value={motDePasseReel} masque className="mt-1.5" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            titre="Exposition sur Internet"
            sousTitre="Fermée par défaut. Ouvrir un port de base de données au monde entier est la première cause de fuite de données."
            actions={
              <GatedAction autorise={autorise('app.deploy')} message={refus('app.deploy')}>
                <Switch
                  checked={expose}
                  onChange={setExpose}
                  label={expose ? 'Exposée' : 'Fermée'}
                />
              </GatedAction>
            }
          />
          {expose ? (
            <div className="space-y-3">
              <Callout ton="warn" titre="Restreignez toujours les sources">
                Sans liste d’adresses autorisées, le port est joignable depuis n’importe où. Nous
                refusons l’exposition sans au moins une plage déclarée.
              </Callout>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Port public attribué">
                  <Input readOnly defaultValue={service.exposeExterne?.port ?? 25432} />
                </Field>
                <Field label="Adresse d’entrée">
                  <Input readOnly defaultValue={ZONE_APPLICATIVE.ingress[0].ip} />
                </Field>
              </div>
              <div>
                <MicroLabel>Sources autorisées</MicroLabel>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(service.exposeExterne?.sourcesAutorisees ?? []).map((s) => (
                    <Badge key={s} tone="neutral">
                      <span className="font-mono">{s}</span>
                    </Badge>
                  ))}
                  <BoutonFormulaire
                    libelle="Ajouter une plage"
                    variant="ghost"
                    icone={<Plus size={12} />}
                    action="app.deploy"
                    titre="Autoriser une plage d’adresses"
                    description="Chaque plage ouverte élargit la surface d’attaque. Une application du même projet n’en a pas besoin : elle passe par le réseau privé."
                    champs={[
                      { id: 'plage', label: 'Plage', placeholder: '102.176.9.0/24', obligatoire: true },
                    ]}
                    libelleValider="Autoriser"
                    operation={(v) => ({
                      ton: 'warn',
                      titre: `${v.plage} autorisée`,
                      detail: 'Retirez-la dès que l’opération qui l’exigeait est terminée.',
                      appel: () =>
                        requete(
                          `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(service.id)}`,
                          {
                            methode: 'PATCH',
                            corps: {
                              exposeExterne: {
                                ...(service.exposeExterne ?? { actif: true }),
                                sourcesAutorisees: [
                                  ...(service.exposeExterne?.sourcesAutorisees ?? []),
                                  String(v.plage),
                                ],
                              },
                            },
                          },
                        ),
                      effet: () =>
                        services.modifier(service.id, (x) => ({
                          exposeExterne: {
                            ...(x.exposeExterne ?? { actif: true }),
                            sourcesAutorisees: [
                              ...(x.exposeExterne?.sourcesAutorisees ?? []),
                              String(v.plage),
                            ],
                          },
                        })),
                      effetFinal: () => rechargerServices(),
                    })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-g-700">
              La base n’est joignable que depuis le réseau privé du projet{' '}
              <span className="font-mono text-[12px]">{service.projetId}</span>. C’est le réglage
              recommandé : une application du même projet n’a pas besoin d’Internet pour parler à sa
              base.
            </p>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader titre="Ce que le portail ne fait pas" />
          <p className="text-[12.5px] leading-relaxed text-g-700">
            Il n’y a pas d’explorateur de tables ici, et il n’y en aura pas. Le portail donne la
            chaîne de connexion, la santé, les sauvegardes et les journaux lents. Pour interroger
            vos données, <span className="font-semibold">psql</span>,{' '}
            <span className="font-semibold">DBeaver</span> ou votre ORM font mieux que ce que nous
            écririons.
          </p>
        </Card>
        <EmplacementReel service={service} />
      </div>
    </div>
  )
}

// ─── Sauvegardes (base de données) ────────────────────────────────────

function Sauvegardes({ service }: { service: ServiceProjet }) {
  const { autorise, refus } = useApp()
  const [instant, setInstant] = useState('2026-08-19T09:30')
  const [baseCible, setBaseCible] = useState(`${service.base?.nom ?? service.nom}_restore`)
  const s = service.sauvegarde

  if (!s) {
    return (
      <EmptyState
        titre="Aucun plan de sauvegarde"
        phrase="Cette base n’est pas sauvegardée. Un cache peut s’en passer ; une base de production, jamais."
        icone={<RotateCcw size={22} />}
      />
    )
  }

  const points = [
    { date: '2026-08-19T01:04:00Z', taille: s.taille, type: 'Complète', etat: 'ok' as const },
    { date: '2026-08-18T01:04:00Z', taille: '18,1 Go', type: 'Complète', etat: 'ok' as const },
    { date: '2026-08-17T01:04:00Z', taille: '17,9 Go', type: 'Complète', etat: 'ok' as const },
    { date: '2026-08-16T01:04:00Z', taille: '17,8 Go', type: 'Complète', etat: 'ok' as const },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader
            titre="Points de restauration"
            sousTitre="Restaurer crée toujours une nouvelle base. L’originale n’est jamais écrasée."
            actions={
              <BoutonAction
                libelle="Sauvegarder maintenant"
                icone={<Download size={13} />}
                operation={{
                  action: 'backup.plan.write',
                  titre: `Sauvegarde de ${service.nom} lancée`,
                  detail: `Destination : ${s.destination}`,
                  job: {
                    type: 'base.backup',
                    label: `Sauvegarde · ${service.nom}`,
                    etapes: ['Geler les écritures', 'Écrire la sauvegarde', 'Vérifier l’empreinte'],
                    dureeEtapeMs: 900,
                  },
                }}
              />
            }
          />
          <div className="space-y-2">
            {points.map((p) => (
              <div
                key={p.date}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink">
                    {dateHeure(p.date)}
                  </span>
                  <span className="block text-[11px] text-g-500">
                    {p.type} · {p.taille} · immuable jusqu’au{' '}
                    {new Date(new Date(p.date).getTime() + s.retentionJours * 86400000)
                      .toISOString()
                      .slice(0, 10)}
                  </span>
                </span>
                <BoutonAction
                  libelle="Restaurer sur une nouvelle base"
                  variant="ghost"
                  operation={{
                    action: 'backup.restore',
                    ton: 'info',
                    titre: `Restauration du ${dateHeure(p.date)}`,
                    detail: 'Une nouvelle base est créée : l’originale n’est jamais écrasée.',
                    job: { workflow: 'web.db.restore', cible: service.nom },
                  }}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader titre="Restauration à un instant précis" />
          <p className="mb-3 text-[12.5px] leading-relaxed text-g-700">
            Les journaux de transaction sont archivés en continu : au-delà des points quotidiens,
            vous pouvez viser une minute précise des {s.retentionJours} derniers jours.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date et heure visées">
              <Input
                type="datetime-local"
                value={instant}
                onChange={(e) => setInstant(e.target.value)}
              />
            </Field>
            <Field label="Nom de la nouvelle base" required>
              <Input
                value={baseCible}
                onChange={(e) => setBaseCible(e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>
          <BoutonAction
            libelle="Lancer la restauration"
            variant="primary"
            className="mt-3"
            desactive={baseCible.trim().length === 0}
            operation={{
              action: 'backup.restore',
              ton: 'info',
              titre: `Restauration vers ${baseCible.trim()} lancée`,
              detail: `Les journaux de transaction sont rejoués jusqu’au ${instant.replace('T', ' à ')}. La base d’origine n’est pas touchée : la restauration crée une nouvelle base.`,
              job: {
                type: 'base.pitr',
                label: `Restauration à un instant précis · ${baseCible.trim()}`,
                etapes: [
                  'Créer la base cible',
                  'Charger la sauvegarde de base',
                  'Rejouer les journaux',
                  'Vérifier l’intégrité',
                ],
              },
            }}
          />
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader titre="Plan appliqué" />
          <KeyValueList
            colonnes={1}
            items={[
              { cle: 'Plan', valeur: s.plan },
              { cle: 'Planification', valeur: <span className="font-mono text-[12px]">{s.cron}</span> },
              { cle: 'Destination', valeur: s.destination },
              { cle: 'Rétention', valeur: `${s.retentionJours} jours, immuable` },
              { cle: 'Dernière exécution', valeur: `${dateHeure(s.dernier)} · ${s.taille}` },
            ]}
          />
        </Card>
        <Callout ton="violet" titre="Hors site par défaut">
          La destination est un compartiment objet du second site. Une sauvegarde qui vit à côté de
          la base ne protège de rien.
        </Callout>
      </div>
    </div>
  )
}

// ─── Exécutions (tâche planifiée) ─────────────────────────────────────

function Executions({ service }: { service: ServiceProjet }) {
  const c = service.cron!
  const historique = [
    { date: '2026-08-19T00:00:00Z', dureeS: c.dureeS, statut: c.statut, sortie: 'Traceback: KeyError « montant_ht » à la ligne 214' },
    { date: '2026-08-18T00:00:00Z', dureeS: 1204, statut: 'ok' as const, sortie: '5 128 lignes traitées' },
    { date: '2026-08-17T00:00:00Z', dureeS: 1187, statut: 'ok' as const, sortie: '4 902 lignes traitées' },
    { date: '2026-08-16T00:00:00Z', dureeS: 1256, statut: 'ok' as const, sortie: '5 344 lignes traitées' },
    { date: '2026-08-15T00:00:00Z', dureeS: 1198, statut: 'ok' as const, sortie: '5 011 lignes traitées' },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        {c.statut === 'echec' && (
          <Callout ton="err" titre="La dernière exécution a échoué">
            La tâche a tourné {duree(c.dureeS)} avant de s’arrêter en erreur. La prochaine
            exécution reste planifiée : une tâche en échec n’est pas désactivée automatiquement, à
            vous de décider.
          </Callout>
        )}
        <Card>
          <CardHeader
            titre="Historique des exécutions"
            sousTitre="Daté, avec la durée et la sortie de chaque passage."
          />
          <div className="space-y-2">
            {historique.map((h) => (
              <div
                key={h.date}
                className="rounded-[6px] border border-g-300 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Badge tone={h.statut === 'ok' ? 'ok' : 'err'} dot size="sm">
                      {h.statut === 'ok' ? 'Succès' : 'Échec'}
                    </Badge>
                    <span className="text-[12.5px] font-semibold text-ink">
                      {dateHeure(h.date)}
                    </span>
                  </span>
                  <span className="tnum text-[11.5px] text-g-500">{duree(h.dureeS)}</span>
                </div>
                <p
                  className={cn(
                    'mt-1.5 font-mono text-[11.5px] leading-relaxed',
                    h.statut === 'ok' ? 'text-g-700' : 'text-err',
                  )}
                >
                  {h.sortie}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader titre="Planification" />
          <KeyValueList
            colonnes={1}
            items={[
              {
                cle: 'Expression',
                valeur: <span className="font-mono text-[12px]">{c.expression}</span>,
              },
              { cle: 'En clair', valeur: c.lisible },
              {
                cle: 'Commande',
                valeur: <span className="font-mono text-[11.5px]">{c.commande}</span>,
              },
              { cle: 'Prochaine exécution', valeur: dateHeure(c.prochaine) },
              { cle: 'Fuseau', valeur: 'UTC — affiché en heure d’Abidjan (UTC+0)' },
            ]}
          />
        </Card>
        <EmplacementReel service={service} />
      </div>
    </div>
  )
}

// ─── File (worker) ────────────────────────────────────────────────────

function FileAttente({ service }: { service: ServiceProjet }) {
  const f = service.file!
  const { autorise, refus } = useApp()
  const services = useServices()
  const { rechargerServices } = useServicesProjet(service.projetId)
  const [concurrence, setConcurrence] = useState(f.concurrence)

  return (
    <div className="space-y-4">
      {f.enAttente > 1000 && (
        <Callout ton="err" titre="La file s’allonge plus vite qu’elle ne se vide">
          {f.enAttente} messages en attente pour {f.traitesJour} traités aujourd’hui. Augmenter la
          concurrence n’aidera pas si les échecs viennent d’une dépendance en panne — les{' '}
          {f.echecsJour} échecs du jour méritent d’être lus avant.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="En attente"
          valeur={f.enAttente}
          ton={f.enAttente > 1000 ? 'err' : 'neutral'}
        />
        <StatTile libelle="Traités aujourd’hui" valeur={f.traitesJour} />
        <StatTile
          libelle="Échecs du jour"
          valeur={f.echecsJour}
          ton={f.echecsJour > 0 ? 'warn' : 'ok'}
        />
        <StatTile libelle="Concurrence" valeur={concurrence} detail="tâches en parallèle" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre={`File « ${f.nom} »`}
            sousTitre="Un worker n’a pas d’adresse : sa santé se lit à la profondeur de file, pas à un code HTTP."
          />
          <Field
            label="Tâches traitées en parallèle"
            hint="Au-delà de la capacité de la base, augmenter la concurrence déplace le goulot d’étranglement sans rien accélérer."
          >
            <Slider min={1} max={16} value={concurrence} onChange={setConcurrence} unite="tâches" />
          </Field>
          <BoutonAction
            libelle="Appliquer"
            variant="primary"
            className="mt-3"
            desactive={concurrence === f.concurrence}
            operation={{
              action: 'app.deploy',
              titre: `Concurrence portée à ${concurrence} tâches`,
              detail:
                concurrence > f.concurrence
                  ? 'Au-delà de la capacité de la base, cela déplace le goulot sans rien accélérer.'
                  : undefined,
              appel: () =>
                requete(
                  `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(service.id)}`,
                  {
                    methode: 'PATCH',
                    corps: { file: { nom: f.nom, concurrence } },
                  },
                ),
              effet: () =>
                services.modifier(service.id, (x) => ({
                  file: x.file ? { ...x.file, concurrence } : undefined,
                })),
              effetFinal: () => rechargerServices(),
            }}
          />
        </Card>

        <Card>
          <CardHeader
            titre="Messages en échec"
            sousTitre="Conservés sept jours pour être rejoués après correction."
          />
          <div className="space-y-2">
            {[
              { id: 'msg-8841', erreur: 'Timeout sur svc-metier-db après 30 s', tentatives: 5 },
              { id: 'msg-8839', erreur: 'Timeout sur svc-metier-db après 30 s', tentatives: 5 },
              { id: 'msg-8802', erreur: 'Montant hors tolérance : écart de 1 240 FCFA', tentatives: 1 },
            ].map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[11.5px] font-semibold text-ink">
                    {m.id}
                  </span>
                  <span className="block text-[11px] text-err">{m.erreur}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-[11px] text-g-500">{m.tentatives} tentatives</span>
                  <BoutonAction
                    libelle="Rejouer"
                    variant="ghost"
                    operation={{
                      action: 'app.deploy',
                      ton: 'info',
                      titre: `Message ${m.id} rejoué`,
                      detail:
                        m.tentatives > 3
                          ? 'Cinq tentatives ont déjà échoué : corrigez la cause avant de rejouer, sinon il repartira en échec.'
                          : undefined,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Domaines du service ──────────────────────────────────────────────

function Domaines({
  service,
  domaines,
}: {
  service: ServiceProjet
  domaines: DomaineApplicatif[]
}) {
  const { autorise, refus } = useApp()
  const lesDomaines = useCollection<DomaineApplicatif>('domaines-applicatifs', DOMAINES_APPLICATIFS)
  const [ajout, setAjout] = useState(false)
  const genere = domaines.find((d) => d.origine === 'genere')
  const hoteOfferte = `${service.nom}-${service.id.slice(0, 6)}.apps.synelia.cloud`

  return (
    <div className="space-y-4">
      <Callout ton="violet" titre="Une adresse offerte, et la vôtre quand vous voulez">
        {genere ? (
          <>
            Ce service répond déjà sur{' '}
            <span className="font-mono text-[12px]">{genere.hote}</span>, certificat compris. Brancher
            votre domaine consiste à créer un enregistrement DNS vers notre adresse d’entrée, puis à
            l’associer ici — l’adresse offerte continue de fonctionner.
          </>
        ) : (
          <>
            Ce service n’a pas encore d’adresse. Générez-en une dans{' '}
            <span className="font-mono text-[12px]">{ZONE_APPLICATIVE.zone}</span> pour le mettre en
            ligne sans acheter de domaine.
          </>
        )}
      </Callout>

      <Card>
        <CardHeader
          titre="Domaines de ce service"
          sousTitre="Chaque entrée route un hôte et un chemin vers un port du conteneur."
          actions={
            <span className="flex flex-wrap gap-2">
              <BoutonAction
                libelle="Générer une adresse offerte"
                icone={<Globe size={13} />}
                operation={{
                  action: 'app.deploy',
                  titre: 'Adresse offerte générée',
                  detail: `${hoteOfferte} — certificat posé, prête à servir.`,
                  appel: () =>
                    creerRessource('/domaines-applicatifs', {
                      hote: hoteOfferte,
                      serviceId: service.id,
                    }),
                  effet: () =>
                    lesDomaines.creer({
                      id: lesDomaines.identifiant('dom'),
                      hote: hoteOfferte,
                      origine: 'genere',
                      serviceId: service.id,
                      chemin: '/',
                      portConteneur: service.portConteneur ?? 80,
                      https: true,
                      certificat: { etat: 'actif' },
                      verification: {
                        etat: 'ok',
                        enregistrement: {
                          type: 'A',
                          nom: hoteOfferte,
                          valeur: ZONE_APPLICATIVE.ingress[0].ip,
                        },
                      },
                    }),
                  effetFinal: () => lesDomaines.recharger(),
                }}
              />
              <GatedAction autorise={autorise('app.deploy')} message={refus('app.deploy')}>
                <Button size="sm" iconBefore={<Plus size={13} />} onClick={() => setAjout(true)}>
                  Brancher mon domaine
                </Button>
              </GatedAction>
            </span>
          }
        />

        {domaines.length === 0 ? (
          <EmptyState
            titre="Aucune adresse"
            phrase="Le service tourne mais rien ne pointe vers lui. Générez une adresse offerte pour le joindre immédiatement."
            icone={<Globe size={22} />}
          />
        ) : (
          <div className="space-y-3">
            {domaines.map((d) => (
              <LigneDomaine key={d.id} domaine={d} portDefaut={service.portConteneur ?? 80} />
            ))}
          </div>
        )}
      </Card>

      <TiroirDomaine
        open={ajout}
        onClose={() => setAjout(false)}
        service={service}
      />
    </div>
  )
}

export function LigneDomaine({
  domaine: d,
  portDefaut,
}: {
  domaine: DomaineApplicatif
  portDefaut: number
}) {
  const maintenant = useMaintenant()
  const domaines = useCollection<DomaineApplicatif>('domaines-applicatifs', DOMAINES_APPLICATIFS)
  return (
    <div className="rounded-[8px] border border-g-300 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0">
          <a
            href={`https://${d.hote}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold text-ink hover:text-p-700"
          >
            <span className="truncate">
              {d.hote}
              {d.chemin !== '/' && <span className="text-g-500">{d.chemin}</span>}
            </span>
            <ExternalLink size={11} className="shrink-0 text-g-500" />
          </a>
          <span className="mt-0.5 block text-[11px] text-g-500">
            → port {d.portConteneur || portDefaut} du conteneur ·{' '}
            {d.https ? 'HTTPS forcé' : 'HTTP seulement'}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge tone={d.origine === 'genere' ? 'violet' : 'neutral'} size="sm">
            {d.origine === 'genere' ? 'Offert' : 'Votre domaine'}
          </Badge>
          <Badge
            tone={
              d.certificat.etat === 'actif'
                ? 'ok'
                : d.certificat.etat === 'en_emission'
                  ? 'info'
                  : d.certificat.etat === 'echec'
                    ? 'err'
                    : 'neutral'
            }
            size="sm"
          >
            {
              {
                actif: 'Certificat actif',
                en_emission: 'Émission en cours',
                echec: 'Certificat en échec',
                aucun: 'Sans certificat',
              }[d.certificat.etat]
            }
          </Badge>
        </span>
      </div>

      {d.verification && d.verification.etat !== 'ok' && (
        <div
          className={cn(
            'mt-3 rounded-[6px] border p-3',
            d.verification.etat === 'echec'
              ? 'border-err/40 bg-err-bg'
              : 'border-warn/40 bg-warn-bg',
          )}
        >
          <p className="text-[12px] font-semibold text-ink">
            {d.verification.etat === 'echec'
              ? 'La vérification DNS a échoué'
              : 'En attente de propagation DNS'}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">{d.verification.detail}</p>
          <div className="mt-2.5 rounded-[6px] border border-g-300 bg-white p-2.5">
            <MicroLabel>Enregistrement à créer chez votre bureau d’enregistrement</MicroLabel>
            <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11.5px]">
              <span className="text-g-500">Type</span>
              <span className="font-semibold text-ink">{d.verification.enregistrement.type}</span>
              <span className="text-g-500">Nom</span>
              <span className="font-semibold text-ink">{d.verification.enregistrement.nom}</span>
              <span className="text-g-500">Valeur</span>
              <span className="font-semibold text-ink">
                {d.verification.enregistrement.valeur}
              </span>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <BoutonAction
              libelle="Vérifier maintenant"
              icone={<RefreshCw size={12} />}
              operation={{
                action: 'app.deploy',
                ton: 'info',
                titre: `Vérification DNS de ${d.hote}`,
                detail: 'Nos résolveurs sont interrogés sans cache.',
                appel: () =>
                  requete(`/domaines-applicatifs/${encodeURIComponent(d.id)}/verification`, {
                    methode: 'POST',
                    corps: {},
                  }),
                job: { workflow: 'domaine.verify', cible: d.hote },
                effetFinal: () => domaines.recharger(),
              }}
            />
            {d.verification.verifieLe && (
              <span className="text-[11px] text-g-500">
                dernière vérification {relatif(d.verification.verifieLe, maintenant)}
              </span>
            )}
            {d.verification.correlationId && (
              <span className="font-mono text-[10.5px] text-g-500">
                identifiant de corrélation {d.verification.correlationId}
              </span>
            )}
          </div>
        </div>
      )}

      {d.redirections && d.redirections.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <MicroLabel>Redirections</MicroLabel>
          {d.redirections.map((r) => (
            <Badge key={r.de} tone="neutral" size="sm">
              <span className="font-mono">
                {r.de} → {r.vers}
              </span>{' '}
              · {r.code}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function TiroirDomaine({
  open,
  onClose,
  service,
}: {
  open: boolean
  onClose: () => void
  service: ServiceProjet
}) {
  const domaines = useCollection<DomaineApplicatif>('domaines-applicatifs', DOMAINES_APPLICATIFS)
  const executer = useOperation()
  const [hote, setHote] = useState('')
  const [etape, setEtape] = useState<'saisie' | 'dns'>('saisie')
  const [chemin, setChemin] = useState('/')
  const [port, setPort] = useState(service.portConteneur ?? 80)
  const [certificat, setCertificat] = useState('acme')
  const [redirection, setRedirection] = useState(true)

  const brancher = () => {
    const id = domaines.identifiant('dom')
    const enregistrement = {
      type: 'A' as const,
      nom: hote,
      valeur: ZONE_APPLICATIVE.ingress[0].ip,
    }
    executer({
      action: 'app.deploy',
      ton: 'info',
      titre: `${hote} branché sur ${service.nom}`,
      detail:
        'La vérification DNS démarre. L’adresse offerte du service continue de répondre pendant ce temps.',
      appel: () =>
        creerRessource('/domaines-applicatifs', {
          hote,
          serviceId: service.id,
          chemin,
          portConteneur: port,
          https: redirection,
        }),
      effet: () =>
        domaines.creer({
          id,
          hote,
          origine: 'personnalise',
          serviceId: service.id,
          chemin,
          portConteneur: port,
          https: redirection,
          certificat: { etat: certificat === 'acme' ? 'en_emission' : 'actif' },
          verification: { etat: 'attente', enregistrement },
        }),
      job: {
        type: 'domaine.attach',
        label: `Branchement de ${hote}`,
        etapes: [
          'Vérifier l’enregistrement DNS',
          'Déclarer la route sur l’entrée',
          ...(certificat === 'acme' ? ['Émettre le certificat'] : []),
          ...(redirection ? ['Activer la redirection HTTPS'] : []),
        ],
        dureeEtapeMs: 1100,
      },
      effetFinal: () => {
        if (estActif()) {
          domaines.recharger()
          return
        }
        domaines.modifier(id, {
          verification: { etat: 'ok', enregistrement, verifieLe: MAINTENANT },
          certificat: {
            etat: 'actif',
            emetteur: certificat === 'acme' ? 'Let’s Encrypt' : 'Certificat fourni',
            expire: '2026-11-17',
          },
        })
      },
    })
    setHote('')
    setEtape('saisie')
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Brancher votre domaine"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {etape === 'saisie' ? (
            <Button onClick={() => setEtape('dns')} disabled={!hote.trim()}>
              Continuer
            </Button>
          ) : (
            <Button iconBefore={<RefreshCw size={13} />} onClick={brancher}>
              Vérifier et activer
            </Button>
          )}
        </div>
      }
    >
      {etape === 'saisie' ? (
        <div className="space-y-4">
          <Field
            label="Domaine ou sous-domaine"
            hint="Sans http:// ni barre oblique finale. Un apex comme exemple.ci est accepté."
          >
            <Input
              value={hote}
              onChange={(e) => setHote(e.target.value)}
              placeholder="api.mon-entreprise.ci"
              className="font-mono"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Chemin" hint="Laissez / pour tout le trafic.">
              <Input
                value={chemin}
                onChange={(e) => setChemin(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Port du conteneur" hint="Le port sur lequel votre service écoute.">
              <Input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Certificat">
            <Select value={certificat} onChange={(e) => setCertificat(e.target.value)}>
              <option value="acme">Émission automatique (Let’s Encrypt)</option>
              <option value="manuel">Certificat que je fournis</option>
            </Select>
          </Field>
          <Switch
            checked={redirection}
            onChange={setRedirection}
            label="Rediriger HTTP vers HTTPS"
            description={
              redirection
                ? undefined
                : 'Sans redirection, une adresse tapée en http:// reste en clair : le certificat existe mais personne ne l’emprunte.'
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <Callout ton="info" titre="Créez cet enregistrement, puis revenez">
            Tant que l’enregistrement n’est pas visible depuis nos résolveurs, le certificat ne peut
            pas être émis. La propagation dépend du TTL fixé chez votre bureau d’enregistrement.
          </Callout>
          <Card padding={false} className="p-3">
            <MicroLabel>Enregistrement DNS à créer</MicroLabel>
            <div className="mt-2 space-y-2">
              <div>
                <MicroLabel>Type</MicroLabel>
                <CopyField value="A" className="mt-1" />
              </div>
              <div>
                <MicroLabel>Nom</MicroLabel>
                <CopyField value={hote || 'api.mon-entreprise.ci'} className="mt-1" />
              </div>
              <div>
                <MicroLabel>Valeur — adresse d’entrée {ZONE_APPLICATIVE.ingress[0].site}</MicroLabel>
                <CopyField value={ZONE_APPLICATIVE.ingress[0].ip} className="mt-1" />
              </div>
            </div>
          </Card>
          <p className="text-[11.5px] leading-relaxed text-g-500">
            Vous préférez un CNAME ? Pointez vers{' '}
            <span className="font-mono">{ZONE_APPLICATIVE.zone}</span> — impossible en revanche sur
            un apex, où la norme DNS impose un enregistrement A.
          </p>
        </div>
      )}
    </Drawer>
  )
}

// ─── Déploiements ─────────────────────────────────────────────────────

function Deploiements({ service }: { service: ServiceProjet }) {
  const maintenant = useMaintenant()
  const deploiements = service.appId ? deploiementsDeLApp(service.appId).slice(0, 6) : []

  if (deploiements.length === 0) {
    return (
      <EmptyState
        titre="Aucun déploiement"
        phrase="Ce service n’a pas encore été construit. Le premier déploiement crée l’historique immuable."
        icone={<RefreshCw size={22} />}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Callout ton="info" titre="Historique immuable">
        Un déploiement ne se modifie pas : on en produit un nouveau. Le retour arrière rejoue un
        artefact déjà construit, sans reconstruction, donc sans surprise.
      </Callout>
      <Card padding={false}>
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-g-300 bg-g-050">
                {['Version', 'Commit', 'Auteur', 'Durée', 'État', ''].map((h) => (
                  <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deploiements.map((d) => (
                <tr key={d.id} className="border-b border-g-100 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[12.5px] font-semibold text-ink">
                      {d.version}
                    </span>
                    <span className="block text-[11px] text-g-500">{relatif(d.startedAt, maintenant)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[11.5px] text-g-700">{d.commit ?? '—'}</span>
                    <span className="block max-w-56 truncate text-[11px] text-g-500">
                      {d.commitMessage}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-g-700">{d.auteur}</td>
                  <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                    {d.dureeS ? duree(d.dureeS) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      tone={
                        d.statut === 'live'
                          ? 'ok'
                          : d.statut === 'failed'
                            ? 'err'
                            : d.statut === 'rolled_back'
                              ? 'warn'
                              : 'info'
                      }
                      size="sm"
                    >
                      {
                        {
                          queued: 'En file',
                          building: 'Construction',
                          scanning: 'Analyse',
                          provisioning: 'Provisioning',
                          deploying: 'Déploiement',
                          live: 'En ligne',
                          failed: 'Échec',
                          rolled_back: 'Retour arrière',
                        }[d.statut]
                      }
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href="/app/applications/deploiements"
                      className="text-[12px] font-semibold text-p-700 hover:text-m-600"
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[12px] text-g-500">
        L’historique immuable de tous les déploiements, tous projets confondus, est sur{' '}
        <Link href="/app/applications/deploiements" className="font-semibold text-p-700 hover:text-m-600">
          l’écran Déploiements
        </Link>
        .
      </p>
    </div>
  )
}

// ─── Variables du service ─────────────────────────────────────────────

function Variables({ service }: { service: ServiceProjet }) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const projet = lesProjets.items.find((p) => p.id === service.projetId)
  const heritees = (projet?.variables ?? []).filter((v) =>
    v.environnements.includes(service.environnement),
  )
  // Révéler une valeur secrète est lui-même journalisé (§ « qui a vu quoi et
  // quand ») : ce n'est pas une bascule d'affichage anodine.
  const [reveles, setReveles] = useState<Record<string, boolean>>({})
  const basculer = (id: string, cle: string) => {
    if (!reveles[id]) {
      executer({
        ton: 'info',
        titre: `Révélation de ${cle} journalisée`,
        detail:
          'Votre nom, l’heure et la variable concernée figurent désormais dans le journal d’audit de l’organisation.',
      })
    }
    setReveles((r) => ({ ...r, [id]: !r[id] }))
  }

  const propres =
    service.type === 'base'
      ? [{ cle: 'POSTGRES_MAX_CONNECTIONS', valeur: '200', secret: false }]
      : [
          { cle: 'PORT', valeur: String(service.portConteneur ?? 3000), secret: false },
          { cle: 'LOG_LEVEL', valeur: 'info', secret: false },
        ]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          titre="Variables propres au service"
          sousTitre="Elles écrasent la valeur héritée du projet, pour ce service seulement."
          actions={
            <BoutonFormulaire
              libelle="Ajouter"
              variant="primary"
              icone={<Plus size={13} />}
              action="secrets.update"
              titre="Ajouter une variable"
              description="Une variable propre au service écrase celle héritée du projet. Une variable marquée secrète n’est plus jamais réaffichée."
              champs={[
                { id: 'cle', label: 'Clé', placeholder: 'FEATURE_FLAG_X', obligatoire: true },
                { id: 'valeur', label: 'Valeur', placeholder: 'true', obligatoire: true },
                { id: 'secret', label: 'Valeur secrète', type: 'switch', placeholder: 'Masquée après enregistrement' },
              ]}
              libelleValider="Ajouter"
              operation={(v) => ({
                titre: `Variable ${v.cle} ajoutée`,
                detail: 'Prise en compte au prochain déploiement du service.',
              })}
            />
          }
        />
        <div className="space-y-2">
          {propres.map((v, i) => {
            const id = `propre-${v.cle}-${i}`
            return (
              <div
                key={v.cle}
                className="flex items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2"
              >
                <span className="font-mono text-[12px] font-semibold text-ink">{v.cle}</span>
                {v.secret ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-g-700">
                      {reveles[id] ? v.valeur : '••••••••••••'}
                    </span>
                    <IconButton
                      label={reveles[id] ? 'Masquer la valeur' : 'Révéler la valeur'}
                      size="sm"
                      onClick={() => basculer(id, v.cle)}
                    >
                      {reveles[id] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </IconButton>
                  </span>
                ) : (
                  <span className="font-mono text-[12px] text-g-700">{v.valeur}</span>
                )}
              </div>
            )
          })}
        </div>
        <Callout ton="warn" className="mt-3" titre="Un changement demande un redéploiement">
          Les variables sont injectées au démarrage du conteneur. Modifier une valeur sans
          redéployer ne change rien au processus en cours.
        </Callout>
      </Card>

      <Card>
        <CardHeader
          titre={`Héritées du projet ${projet?.nom ?? ''}`}
          sousTitre={`Environnement ${service.environnement}. Modifiables au niveau du projet.`}
        />
        <div className="space-y-2">
          {heritees.map((v, i) => {
            const id = `heritee-${v.cle}-${i}`
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-3 rounded-[6px] border border-g-300 bg-g-050 px-3 py-2"
              >
                <span className="font-mono text-[12px] font-semibold text-ink">{v.cle}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-g-700">
                    {v.secret
                      ? reveles[id]
                        ? 'Géré par le coffre de secrets — non stocké en clair'
                        : '••••••••••••'
                      : v.valeur}
                  </span>
                  {v.secret && (
                    <IconButton
                      label={reveles[id] ? 'Masquer' : 'Révéler la valeur'}
                      size="sm"
                      onClick={() => basculer(id, v.cle)}
                    >
                      {reveles[id] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </IconButton>
                  )}
                  <Badge tone={v.portee === 'build' ? 'info' : 'neutral'} size="sm">
                    {v.portee === 'build' ? 'Build' : 'Exécution'}
                  </Badge>
                </span>
              </div>
            )
          })}
        </div>
        <Link
          href={`/app/applications/variables/${service.projetId}`}
          className="mt-3 inline-block text-[12px] font-semibold text-p-700 hover:text-m-600"
        >
          Gérer les variables du projet →
        </Link>
      </Card>
    </div>
  )
}

// ─── Journaux ─────────────────────────────────────────────────────────

function Journaux({ service }: { service: ServiceProjet }) {
  return (
    <div className="space-y-4">
      <Callout ton="info" titre="Vingt dernières lignes ici, l’historique dans VictoriaLogs">
        Le portail montre l’extrait qui permet de décider. La recherche sur plusieurs jours, les
        expressions et les agrégats sont l’affaire d’un moteur de journaux, que nous ne
        réimplémentons pas.
      </Callout>
      <Card>
        <LogPeek
          lignes={LOGS_EXECUTION}
          max={20}
          titre={`Exécution · ${service.nom} · ${service.environnement}`}
        />
      </Card>
    </div>
  )
}

// ─── Supervision ──────────────────────────────────────────────────────

function Supervision({ service }: { service: ServiceProjet }) {
  const evenements = EVENEMENTS_SUPERVISION.slice(0, 6)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Disponibilité 30 j"
          valeur={service.statut === 'running' ? '99,96' : '98,12'}
          unite="%"
          ton={service.statut === 'running' ? 'ok' : 'warn'}
        />
        <StatTile libelle="Engagement" valeur="99,9" unite="%" detail="palier souscrit" />
        <StatTile
          libelle="Incidents 30 j"
          valeur={service.statut === 'running' ? 0 : 2}
          ton={service.statut === 'running' ? 'ok' : 'warn'}
        />
        <StatTile libelle="Sondes posées" valeur={4} detail="automatiquement" />
      </div>

      <GrilleSparkCharts seed={service.id} degrade={service.statut === 'degraded'} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader titre="Derniers événements" sousTitre="Les six plus récents." />
          <EventList evenements={evenements} max={6} />
        </Card>
        <Card>
          <CardHeader
            titre="Aller plus loin"
            sousTitre="Le portail donne l'essentiel ; l'analyse détaillée vit dans les outils dédiés."
          />
          <div className="space-y-2">
            {[
              { nom: 'Centreon', phrase: 'État des sondes et historique des alertes', href: 'https://centreon.synelia.tech' },
              { nom: 'Grafana', phrase: 'Métriques détaillées et tableaux de bord', href: 'https://grafana.synelia.dev01.ovh.smile.ci' },
              { nom: 'VictoriaLogs', phrase: 'Recherche dans les journaux, toute la rétention', href: 'https://vlogs.synelia.cloud' },
            ].map((o) => (
              <a
                key={o.nom}
                href={o.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5 transition-colors hover:border-p-400 hover:bg-p-050"
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink">{o.nom}</span>
                  <span className="block text-[11px] text-g-500">{o.phrase}</span>
                </span>
                <ExternalLink size={13} className="shrink-0 text-g-500" />
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Avancé ───────────────────────────────────────────────────────────

function Avance({ service }: { service: ServiceProjet }) {
  const { autorise, refus } = useApp()
  const services = useServices()
  const { rechargerServices } = useServicesProjet(service.projetId)
  const executer = useOperation()
  const [cpu, setCpu] = useState(service.ressources.cpu)
  const [ram, setRam] = useState(service.ressources.ramMo / 1024)
  const [suppression, setSuppression] = useState(false)
  const [redemarrage, setRedemarrage] = useState('echec')
  const [sonde, setSonde] = useState('/healthz')

  const coutEstime = Math.round(cpu * 4200 + ram * 1800 + service.ressources.diskGo * 70)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader
            titre="Ressources"
            sousTitre="Modifiables à chaud. Le service redémarre si la mémoire diminue."
          />
          <div className="space-y-4">
            <Field label="Processeur">
              <Slider min={1} max={16} value={cpu} onChange={setCpu} unite="vCPU" />
            </Field>
            <Field label="Mémoire">
              <Slider min={1} max={64} value={ram} onChange={setRam} unite="Go" />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-g-050 px-3 py-2.5">
              <span className="text-[12px] text-g-700">Nouveau coût mensuel estimé</span>
              <span className="tnum text-[13px] font-bold text-ink">{money(coutEstime)}</span>
            </div>
          </div>
          <BoutonAction
            libelle="Appliquer"
            variant="primary"
            className="mt-3"
            desactive={cpu === service.ressources.cpu && ram === service.ressources.ramMo / 1024}
            operation={{
              action: 'app.deploy',
              titre: `${service.nom} redimensionné`,
              detail:
                ram < service.ressources.ramMo / 1024
                  ? 'La mémoire diminue : le service redémarre.'
                  : 'Appliqué à chaud, sans redémarrage.',
              appel: () =>
                requete(
                  `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(service.id)}`,
                  {
                    methode: 'PATCH',
                    corps: { ressources: { cpu, ramMo: ram * 1024 } },
                  },
                ),
              effet: () =>
                services.modifier(service.id, (x) => ({
                  ressources: { ...x.ressources, cpu, ramMo: ram * 1024 },
                  coutMensuel: coutEstime,
                })),
              effetFinal: () => rechargerServices(),
            }}
          />
        </Card>

        <Card>
          <CardHeader titre="Redémarrage et santé" />
          <div className="space-y-3">
            <Field
              label="Politique de redémarrage"
              hint="Par défaut, la plateforme relance un conteneur qui s’arrête anormalement."
            >
              <Select value={redemarrage} onChange={(e) => setRedemarrage(e.target.value)}>
                <option value="echec">Relancer en cas d’échec</option>
                <option value="toujours">Toujours relancer</option>
                <option value="jamais">Ne jamais relancer</option>
              </Select>
            </Field>
            {service.type !== 'base' && service.type !== 'cron' && (
              <Field
                label="Contrôle de santé"
                hint="Un service qui ne répond pas à sa sonde n’entre pas en production."
              >
                <Input
                  value={sonde}
                  onChange={(e) => setSonde(e.target.value)}
                  className="font-mono"
                />
              </Field>
            )}
            {redemarrage === 'jamais' && (
              <Callout ton="warn" titre="Un service qui ne se relance pas reste tombé">
                Personne ne le remettra en marche à 3 h du matin. À réserver aux traitements dont un
                redémarrage automatique ferait plus de dégâts qu’un arrêt.
              </Callout>
            )}
          </div>
          <BoutonAction
            libelle="Enregistrer"
            className="mt-3"
            operation={{
              action: 'app.deploy',
              titre: `Politique de ${service.nom} enregistrée`,
              detail:
                redemarrage === 'jamais'
                  ? 'La plateforme ne relancera plus ce service : sa remise en marche est désormais manuelle.'
                  : `Relance ${redemarrage === 'toujours' ? 'systématique' : 'en cas d’échec'}${
                      service.type !== 'base' && service.type !== 'cron'
                        ? `, sonde de santé sur ${sonde}`
                        : ''
                    }. Effet au prochain démarrage du conteneur.`,
              effet: () => services.modifier(service.id, { derniereMaj: MAINTENANT }),
            }}
          />
        </Card>
      </div>

      <div className="space-y-4">
        <EmplacementReel service={service} />

        <Card className="border-err/40">
          <CardHeader
            titre="Zone de danger"
            sousTitre="Ces actions ne se rattrapent pas depuis le portail."
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink">Arrêter</span>
                <span className="block text-[11px] text-g-500">
                  Libère processeur et mémoire. Les volumes restent facturés.
                </span>
              </span>
              <BoutonAction
                libelle="Arrêter"
                icone={<Square size={12} />}
                desactive={service.statut === 'stopped'}
                operation={{
                  action: 'app.deploy',
                  ton: 'warn',
                  titre: `${service.nom} arrêté`,
                  detail: 'Processeur et mémoire libérés. Les volumes restent facturés.',
                  appel: () =>
                    requete(
                      `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(service.id)}/arret`,
                      { methode: 'POST', corps: {} },
                    ),
                  effet: () => services.modifier(service.id, { statut: 'stopped' }),
                  effetFinal: () => rechargerServices(),
                }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-err/40 bg-err-bg px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink">Supprimer</span>
                <span className="block text-[11px] text-g-700">
                  {service.type === 'base'
                    ? 'Détruit la base, ses volumes et ses sauvegardes hors rétention légale.'
                    : 'Détruit le service et ses volumes. Les domaines cessent de répondre.'}
                </span>
              </span>
              <GatedAction autorise={autorise('app.deploy')} message={refus('app.deploy')}>
                <Button
                  size="sm"
                  variant="danger"
                  iconBefore={<Trash2 size={12} />}
                  onClick={() => setSuppression(true)}
                >
                  Supprimer
                </Button>
              </GatedAction>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader titre="Identifiants techniques" sousTitre="Utiles au support." />
          <div className="space-y-2">
            <div>
              <MicroLabel>Identifiant du service</MicroLabel>
              <CopyField value={service.id} className="mt-1" />
            </div>
            <div>
              <MicroLabel>Identifiant du projet</MicroLabel>
              <CopyField value={service.projetId} className="mt-1" />
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={suppression}
        onClose={() => setSuppression(false)}
        onConfirm={() =>
          executer({
            action: 'app.deploy',
            ton: 'err',
            titre: `Service ${service.nom} supprimé`,
            detail:
              service.type === 'base'
                ? 'La base, ses volumes et ses sauvegardes hors rétention légale sont détruits.'
                : 'Le service et ses volumes sont détruits ; ses domaines cessent de répondre.',
            appel: () =>
              requete(
                `/projets/${encodeURIComponent(service.projetId)}/services/${encodeURIComponent(service.id)}`,
                { methode: 'DELETE', query: { confirmation: service.nom } },
              ),
            effet: () => services.supprimer(service.id),
            effetFinal: () => rechargerServices(),
          })
        }
        titre={`Supprimer le service ${service.nom}`}
        ressource={service.nom}
        pertes={
          service.type === 'base'
            ? [
                'La base de données et toutes ses tables',
                `Le volume de ${service.ressources.diskGo} Go`,
                'Les sauvegardes au-delà de la rétention légale',
                'Les services qui s’y connectent tomberont en erreur',
              ]
            : [
                'Le service et son volume',
                'Les domaines rattachés cesseront de répondre',
                'L’historique des déploiements',
              ]
        }
        libelleAction="Supprimer définitivement"
      />
    </div>
  )
}

// ─── Contrat d'intégration d'un service issu d'un modèle (§6.1) ────────

/**
 * Configuration propre à la solution. Le fichier de configuration du service
 * décrit le schéma — sections, champs, aides, valeurs par défaut ; l'instance
 * porte l'état. Régler une messagerie n'a presque rien de commun avec régler
 * un ERP, d'où un fichier par solution plutôt qu'un formulaire générique.
 */
function Configuration({
  service,
  onVoirVariables,
}: {
  service: ServiceProjet
  onVoirVariables: () => void
}) {
  const { autorise, refus } = useApp()
  const modele = service.modeleSlug ? modeleBySlug(service.modeleSlug) : undefined
  const config = modele?.configuration ? configurationDuService(modele.configuration) : undefined

  if (!config) {
    return (
      <EmptyState
        titre="Pas de réglages propres à cette solution"
        phrase="Ce modèle se configure entièrement par ses variables d’environnement. L’onglet Variables porte tout ce qui est réglable."
        action={{ libelle: 'Voir les variables', onClick: onVoirVariables }}
      />
    )
  }

  return (
    <ConfigurationServicePanel
      config={config}
      autorise={autorise('service.admin')}
      messageRefus={refus('service.admin')}
    />
  )
}

/** Sièges et licences — la vue « qui consomme quoi » du contrat d'intégration. */
function Sieges({ service }: { service: ServiceProjet }) {
  const { autorise, refus } = useApp()
  const services = useServices()
  const sieges = service.sieges
  if (!sieges) return null

  const libres = sieges.souscrits - sieges.attribues

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile libelle="Sièges souscrits" valeur={sieges.souscrits} />
        <StatTile libelle="Sièges attribués" valeur={sieges.attribues} ton="violet" />
        <StatTile
          libelle="Sièges libres"
          valeur={libres}
          ton={libres === 0 ? 'warn' : 'ok'}
          detail={libres === 0 ? 'Ajoutez des sièges pour inviter' : 'attribuables tout de suite'}
        />
        <StatTile
          libelle="Coût par siège"
          valeur={money(Math.round(service.coutMensuel / Math.max(1, sieges.souscrits)))}
          detail="par mois, à titre indicatif"
        />
      </div>

      <Card>
        <CardHeader
          titre="Qui consomme quoi"
          sousTitre="Un siège attribué est facturé, qu’il soit utilisé ou non. Le retirer libère la facturation au prorata du jour."
          actions={
            <BoutonFormulaire
              libelle="Attribuer un siège"
              variant="primary"
              action="seat.assign"
              titre="Attribuer un siège"
              description="Un siège attribué est facturé, qu’il soit utilisé ou non. La personne accède au service en SSO."
              champs={[
                { id: 'membre', label: 'Adresse électronique', placeholder: 'prenom.nom@dba.africa', obligatoire: true },
              ]}
              libelleValider="Attribuer"
              operation={(v) => ({
                titre: `Siège attribué à ${v.membre}`,
                detail:
                  libres === 0
                    ? 'Aucun siège libre : un siège supplémentaire est souscrit, facturé au prorata.'
                    : `${libres - 1} siège(s) restant(s).`,
                effet: () =>
                  services.modifier(service.id, (x) => ({
                    sieges: x.sieges
                      ? {
                          attribues: x.sieges.attribues + 1,
                          souscrits: Math.max(x.sieges.souscrits, x.sieges.attribues + 1),
                        }
                      : undefined,
                  })),
              })}
            />
          }
        />
        <ul className="divide-y divide-g-100">
          {[
            { n: 'Léa Konan', e: 'l.konan@dba.africa', d: '2026-08-19T15:02:00Z', u: 'quotidien' },
            { n: 'Fatou Diallo', e: 'f.diallo@dba.africa', d: '2026-08-19T14:41:00Z', u: 'quotidien' },
            { n: 'Yao Kouassi', e: 'y.kouassi@dba.africa', d: '2026-08-18T09:12:00Z', u: 'hebdomadaire' },
            { n: 'Aïcha Koné', e: 'a.kone@dba.africa', d: '2026-07-28T10:22:00Z', u: 'inactif depuis 3 semaines' },
          ].map((m) => (
            <li key={m.e} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{m.n}</span>
                <span className="block truncate text-[11.5px] text-g-500">{m.e}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[11.5px] text-g-500">{m.u}</span>
                <Badge tone={m.u.startsWith('inactif') ? 'warn' : 'ok'} size="sm" dot>
                  Actif
                </Badge>
                <BoutonAction
                  libelle="Retirer"
                  variant="ghost"
                  operation={{
                    action: 'seat.assign',
                    ton: 'warn',
                    titre: `Siège de ${m.n} retiré`,
                    detail:
                      'La personne est déconnectée, ses données restent, et le siège se réattribue immédiatement.',
                    effet: () =>
                      services.modifier(service.id, (x) => ({
                        sieges: x.sieges
                          ? { ...x.sieges, attribues: Math.max(0, x.sieges.attribues - 1) }
                          : undefined,
                      })),
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
        <Callout ton="info" className="mt-3" titre="Un siège inactif reste facturé">
          Aïcha Koné n’a pas ouvert le service depuis trois semaines. Retirer son siège la
          déconnecte mais ne supprime rien : ses données restent, et le siège se réattribue.
        </Callout>
      </Card>
    </div>
  )
}

/** Cycle de vie : versions qualifiées, fenêtre de mise à jour, retour arrière. */
function Versions({ service }: { service: ServiceProjet }) {
  const { autorise, refus } = useApp()
  const services = useServices()
  const modele = service.modeleSlug ? modeleBySlug(service.modeleSlug) : undefined
  if (!modele) return null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          titre="Version déployée"
          sousTitre="Nous qualifions chaque version avant de la proposer : jamais de « latest », jamais de mise à jour non annoncée."
          actions={
            <BoutonFormulaire
              libelle="Planifier la mise à jour"
              variant="primary"
              action="app.deploy"
              titre={`Mettre à jour ${modele.solution}`}
              description="Nous qualifions chaque version avant de la proposer. Un retour arrière reste possible pendant sept jours."
              champs={[
                {
                  id: 'fenetre',
                  label: 'Fenêtre',
                  type: 'select',
                  options: [
                    { value: 'dimanche', label: 'Prochaine fenêtre · dimanche 22h00' },
                    { value: 'maintenant', label: 'Maintenant · coupure de quelques minutes' },
                  ],
                },
              ]}
              valeursDepart={{ fenetre: 'dimanche' }}
              libelleValider="Planifier"
              operation={(v) =>
                v.fenetre === 'maintenant'
                  ? {
                      ton: 'info',
                      titre: `Mise à jour de ${modele.solution} lancée`,
                      job: { workflow: 'service.update', cible: service.nom },
                      effetFinal: () =>
                        services.modifier(service.id, { derniereMaj: MAINTENANT }),
                    }
                  : {
                      titre: 'Mise à jour planifiée',
                      detail: 'Annonce envoyée sept jours avant, rappel vingt-quatre heures avant.',
                    }
              }
            />
          }
        />
        <KeyValueList
          items={[
            { cle: 'Solution', valeur: `${modele.solution} ${modele.version}` },
            { cle: 'Chart déployé', valeur: <span className="font-mono text-[12px]">{modele.chart}</span> },
            { cle: 'Dernière mise à jour', valeur: dateHeure(service.derniereMaj) },
            { cle: 'Fenêtre de maintenance', valeur: 'Dimanche 22:00 – 02:00, annoncée 7 jours avant' },
            { cle: 'Retour arrière', valeur: 'Disponible 7 jours après une mise à jour' },
          ]}
        />
      </Card>

      <Card>
        <CardHeader
          titre="Historique"
          sousTitre="Chaque ligne porte son changelog et reste restaurable pendant sept jours."
        />
        <ul className="divide-y divide-g-100">
          {[
            { v: modele.version, d: service.derniereMaj, n: 'Version courante — correctifs de sécurité et corrections mineures.', a: true },
            { v: '10.1.2', d: '2026-05-14T22:30:00Z', n: 'Montée de version mineure. Aucun changement de schéma.', a: false },
            { v: '10.0.8', d: '2026-02-18T22:12:00Z', n: 'Correctif de sécurité, appliqué hors fenêtre après validation.', a: false },
          ].map((h) => (
            <li key={h.v} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12.5px] font-semibold text-ink">{h.v}</span>
                  {h.a && (
                    <Badge tone="ok" size="sm">
                      Déployée
                    </Badge>
                  )}
                  <span className="text-[11px] text-g-500">{dateHeure(h.d)}</span>
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-g-500">{h.n}</span>
              </span>
              {!h.a && (
                <BoutonAction
                  libelle="Revenir à cette version"
                  variant="ghost"
                  operation={{
                    action: 'app.rollback',
                    ton: 'warn',
                    titre: `Retour à la version ${h.v}`,
                    detail: 'Les données créées depuis la mise à jour sont conservées ; le schéma revient en arrière.',
                    job: {
                      type: 'modele.rollback',
                      label: `Retour arrière · ${service.nom} → ${h.v}`,
                      etapes: ['Snapshot de l’état courant', 'Redéployer la version cible', 'Vérifier le démarrage'],
                    },
                  }}
                  confirmation={{
                    ressource: service.nom,
                    titre: `Revenir à la version ${h.v} ?`,
                    pertes: [
                      'Le schéma de données revient à celui de cette version',
                      'Les fonctionnalités introduites depuis disparaissent',
                      'Un nouveau retour arrière ne sera possible que pendant sept jours',
                    ],
                    libelleAction: 'Revenir à cette version',
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/** Réversibilité — §6.1 capacité 9. Une instance qu'on ne peut pas quitter ne se prend pas. */
function Reversibilite({ service }: { service: ServiceProjet }) {
  const { autorise, refus } = useApp()
  const modele = service.modeleSlug ? modeleBySlug(service.modeleSlug) : undefined
  if (!modele) return null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          titre="Sortir de ce service"
          sousTitre="L’export se fait dans le format natif de la solution, documenté, et nous testons sa réimportation comme nous testons nos restaurations."
          actions={
            <BoutonAction
              libelle="Générer un export complet"
              variant="primary"
              operation={{
                action: 'compliance.export',
                titre: `Export de ${modele.solution} demandé`,
                detail: `Format natif documenté · ${modele.sauvegardeParDefaut.inclut.join(' · ')}. Mise à disposition sous 24 h.`,
                job: { workflow: 'export.donnees', cible: service.nom },
              }}
            />
          }
        />
        <KeyValueList
          items={[
            { cle: 'Format d’export', valeur: `Format natif ${modele.solution}, documenté` },
            { cle: 'Contenu', valeur: modele.sauvegardeParDefaut.inclut.join(' · ') },
            { cle: 'Dernier export testé', valeur: '12 juillet 2026 — réimport vérifié sur une instance vierge' },
            { cle: 'Délai de mise à disposition', valeur: 'Moins de 24 h pour une instance de cette taille' },
            { cle: 'Conservation après résiliation', valeur: '30 jours, puis suppression définitive avec attestation' },
          ]}
        />
      </Card>

      <Callout ton="info" titre="Ce que la réversibilité ne couvre pas">
        Les réglages que vous avez faits dans {modele.solution} suivent l’export. En revanche, ce
        que le portail ajoute autour — plan de sauvegarde, sondes de supervision, fédération
        d’identité — est propre à Synelia et devra être reconstruit chez votre nouvel hébergeur.
        Nous le disons pour que la comparaison soit honnête.
      </Callout>
    </div>
  )
}
