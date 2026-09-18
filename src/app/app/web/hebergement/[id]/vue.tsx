'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Activity,
  Clock,
  Database,
  Download,
  ExternalLink,
  FolderTree,
  Globe,
  HardDrive,
  KeyRound,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  ShoppingBag,
  Terminal,
  Trash2,
} from 'lucide-react'
import { cn, seededSeries, surfaceMarque } from '@/lib/utils'
import { dateHeure, money, num, relatif } from '@/lib/format'
import { SITE_LABEL } from '@/lib/types'
import type {
  BaseHebergement,
  CompteFichiers,
  SiteWeb,
  TachePlanifieeWeb,
  WebHosting,
} from '@/lib/types'
import {
  BASES_HEBERGEMENT,
  HEBERGEMENTS,
  CATALOGUE_PARTAGE,
  COMPTES_FICHIERS,
  LOGS_EXECUTION,
  SERVEURS_BASES,
  SITES_WEB,
  TACHES_WEB,
  type ServeurBases,
  TYPE_SITE_LABEL,
  abonnementDeLEntree,
  basesDeLHebergement,
  comptesDeLHebergement,
  entreesWebCloud,
  hebergementById,
  nomServi,
  partagesDeLHebergement,
  sitesDeLHebergement,
  tachesDeLHebergement,
} from '@/lib/mock'
import { configurationDuService } from '@/lib/configurations'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, SegmentedControl, Select, Switch } from '@/components/ui/field'
import { Drawer, Tooltip } from '@/components/ui/overlay'
import { PageHeader, Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile, QuotaBar, HealthBadge } from '@/components/composition/metrics'
import { DegradedState, EmptyState } from '@/components/composition/states'
import { GrilleSparkCharts, LogPeek } from '@/components/business/observabilite'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { ConfigurationServicePanel } from '@/components/business/configuration-service'
import { CarteAbonnement } from '@/components/business/abonnement'
import {
  ApiError,
  creerRessource,
  estActif,
  modifierRessource,
  requete,
  supprimerRessource,
} from '@/lib/api/client'

/** Mot de passe fort généré côté client — affiché une seule fois, jamais stocké ici. */
function genererMotDePasse(longueur = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#%+-_'
  const octets = new Uint8Array(longueur)
  crypto.getRandomValues(octets)
  return Array.from(octets, (o) => alphabet[o % alphabet.length]).join('')
}

import { useApp, useMaintenant } from '@/components/app/contexte'

const ONGLETS = [
  { id: 'apercu', label: 'Vue d’ensemble' },
  { id: 'runtime', label: 'PHP & runtime' },
  { id: 'fichiers', label: 'Accès fichiers' },
  { id: 'taches', label: 'Tâches planifiées' },
  { id: 'journaux', label: 'Journaux' },
]

const TEINTE_SITE: Record<string, string> = {
  wordpress: '#21759B',
  prestashop: '#DF0067',
  php: '#777BB4',
  statique: '#4B2882',
  laravel: '#FF2D20',
}

export function VueHebergement({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const [onglet, setOnglet] = useState('apercu')
  const [siteOuvertId, setSiteOuvert] = useState<string | null>(null)
  const [baseOuverteId, setBaseOuverte] = useState<string | null>(null)
  const [partageOuvert, setPartageOuvert] = useState<string | null>(null)
  const [phpSite, setPhpSite] = useState<string | null>(null)
  const [tacheOuverte, setTacheOuverte] = useState(false)

  const executer = useOperation()
  const hebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const tousSites = useCollection<SiteWeb>('sites-web', SITES_WEB)
  const toutesBases = useCollection<BaseHebergement>('bases-hebergement', BASES_HEBERGEMENT)
  const tousComptes = useCollection<CompteFichiers>('comptes-fichiers', COMPTES_FICHIERS)
  const toutesTaches = useCollection<TachePlanifieeWeb>('taches-web', TACHES_WEB)
  const serveursBases = useCollection<ServeurBases>('serveurs-bases', SERVEURS_BASES)
  /** Mot de passe remplacé d’un compte de transfert — montré une fois. */
  const [secretCompte, setSecretCompte] = useState<{ utilisateur: string; motDePasse: string } | null>(null)
  /** `GET /web/hebergements/{id}/metriques` : `424` → intégration nommée à la place des courbes. */
  const [metriquesDegradees, setMetriquesDegradees] = useState<{
    integration?: string
    dateDonnees?: string
  } | null>(null)
  useEffect(() => {
    if (!estActif()) return
    let annule = false
    requete(`/web/hebergements/${encodeURIComponent(id)}/metriques`).then(
      () => {
        if (!annule) setMetriquesDegradees(null)
      },
      (e: unknown) => {
        if (annule) return
        if (e instanceof ApiError && e.statut === 424)
          setMetriquesDegradees({ integration: e.integration, dateDonnees: e.dateDonnees })
      },
    )
    return () => {
      annule = true
    }
  }, [id])

  const h = hebergements.items.find((x) => x.id === id)
  if (!h) return null
  const entree = entreesWebCloud().find((e) => e.hebergement?.id === h.id)
  const sites = tousSites.items.filter((x) => x.hebergementId === h.id)
  const bases = toutesBases.items.filter((x) => x.hebergementId === h.id)
  const comptes = tousComptes.items.filter((x) => x.hebergementId === h.id)
  const taches = toutesTaches.items.filter((x) => x.hebergementId === h.id)
  const partages = partagesDeLHebergement(h.id)
  const siteOuvert = tousSites.items.find((x) => x.id === siteOuvertId) ?? null
  const baseOuverte = toutesBases.items.find((x) => x.id === baseOuverteId) ?? null
  const nom = nomServi(h)
  const abonnement = entree ? abonnementDeLEntree(entree) : null

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Hébergement Web', href: '/app/web/hebergement' },
          { label: nom },
        ]}
        titre={<span className="break-words font-mono">{nom}</span>}
        sousTitre={`Un domaine, un serveur. ${sites.length} site${sites.length > 1 ? 's' : ''} et ${bases.length} base${bases.length > 1 ? 's' : ''} cohabitent sur ${h.serveur.nom}, à ${SITE_LABEL[h.serveur.site]}.`}
        meta={
          <>
            <HealthBadge etat={h.statut === 'en_ligne' ? 'ok' : h.statut === 'maintenance' ? 'maintenance' : 'suspendu'} />
            <Badge tone="neutral">{h.palier}</Badge>
            <Badge tone="neutral">{h.serveur.serveurWeb}</Badge>
            <Badge tone="neutral">PHP {h.php.versionDefaut}</Badge>
            <Badge tone="violet">{SITE_LABEL[h.serveur.site]}</Badge>
            {!h.domaine && <Badge tone="warn">Domaine à acheter</Badge>}
          </>
        }
        actions={
          <>
            <BoutonFormulaire
              libelle="Installer un site"
              icone={<Plus size={13} />}
              action="service.admin"
              titre="Installer un site sur cet hébergement"
              description="L’installation crée la racine, pose le certificat et déclare le sous-domaine dans la zone. Le contenu du site se règle ensuite dans l’outil lui-même, pas ici."
              champs={[
                {
                  id: 'hote',
                  label: 'Nom d’hôte',
                  type: 'select_ou_nouveau',
                  options: [
                    ...sites.map((s) => ({ value: s.hote, label: s.hote })),
                    ...(h.domaine
                      ? [
                          { value: `www.${nom}`, label: `www.${nom}` },
                          { value: nom, label: nom },
                        ]
                      : []),
                  ],
                  hint: `Choisissez un hôte existant sur cet hébergement, ou « + Nouveau… » pour un sous-domaine (ex. boutique.${nom}).`,
                  placeholder: `boutique.${nom}`,
                  obligatoire: true,
                },
                {
                  id: 'type',
                  label: 'Type de site',
                  type: 'select',
                  options: [
                    { value: 'wordpress', label: 'WordPress' },
                    { value: 'prestashop', label: 'PrestaShop' },
                    { value: 'statique', label: 'Site statique' },
                    { value: 'php', label: 'Application PHP' },
                  ],
                },
                {
                  id: 'php',
                  label: 'Version de PHP',
                  type: 'select',
                  demi: true,
                  options: h.php.versionsDisponibles.map((v) => ({ value: v, label: `PHP ${v}` })),
                },
                { id: 'base', label: 'Créer une base dédiée', type: 'switch', demi: true, placeholder: 'Oui' },
              ]}
              valeursDepart={{ type: 'wordpress', php: h.php.versionDefaut, base: true }}
              libelleValider="Installer"
              operation={(v) => {
                const idSite = tousSites.identifiant('site')
                return {
                  titre: `Installation de ${v.hote} lancée`,
                  detail: `${v.type} · PHP ${v.php}`,
                  appel: () =>
                    creerRessource('/web/sites', {
                      hebergementId: h.id,
                      site: {
                        hote: String(v.hote),
                        type: v.type as SiteWeb['type'],
                        phpVersion: String(v.php),
                        creerBase: Boolean(v.base),
                        ssl: true,
                      },
                    }),
                  effet: () =>
                    tousSites.creer({
                      id: idSite,
                      hebergementId: h.id,
                      hote: String(v.hote),
                      racine: `/var/www/${String(v.hote).split('.')[0]}`,
                      type: v.type as SiteWeb['type'],
                      phpVersion: String(v.php),
                      ssl: { etat: 'en_emission' },
                      espaceMo: 0,
                      visitesMois: 0,
                      securite: { waf: true, bruteForce: true, scanMalware: true },
                      statut: 'installation',
                    }),
                  job: { workflow: 'web.app.install', cible: String(v.hote) },
                  effetFinal: () => {
                    if (estActif()) {
                      tousSites.recharger()
                      return
                    }
                    tousSites.modifier(idSite, {
                      statut: 'en_ligne',
                      ssl: { etat: 'actif', emetteur: 'Let’s Encrypt', expire: '2026-11-17' },
                    })
                  },
                }
              }}
            />
            <ButtonLink
              href={`https://${nom}`}
              variant="accent"
              size="sm"
              iconAfter={<ExternalLink size={13} />}
            >
              Ouvrir le site
            </ButtonLink>
          </>
        }
      />

      {!h.domaine && (
        <Callout
          ton="warn"
          titre="L’hébergement tourne sur un nom provisoire"
          action={
            <ButtonLink href="/app/web" size="sm" variant="secondary">
              Acheter un domaine
            </ButtonLink>
          }
        >
          Vos sites sont servis sur <span className="font-mono">{h.domaineProvisoire}</span>, avec un
          certificat valide. Dès que vous enregistrez votre nom, il suffit de le pointer sur{' '}
          <span className="font-mono">{h.serveur.ip}</span> : les sites, les bases et les accès
          restent en place, seuls les sous-domaines changent.
        </Callout>
      )}

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'apercu' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              libelle="Sites"
              valeur={sites.length}
              detail={`${sites.filter((s) => s.statut === 'en_ligne').length} en ligne`}
            />
            <StatTile
              libelle="Visites du mois"
              valeur={num(sites.reduce((a, s) => a + s.visitesMois, 0))}
              serie={seededSeries(h.id, 14, 600, 1800)}
            />
            <StatTile
              libelle="Espace occupé"
              valeur={`${h.espaceUtiliseGo.toFixed(1)} Go`}
              detail={`sur ${h.espaceTotalGo} Go`}
              ton={h.espaceUtiliseGo / h.espaceTotalGo > 0.85 ? 'warn' : 'neutral'}
            />
            <StatTile
              libelle="Dernière sauvegarde"
              valeur={h.sauvegarde.derniere ? relatif(h.sauvegarde.derniere, maintenant) : '—'}
              ton={h.sauvegarde.statut === 'ok' ? 'ok' : 'err'}
              detail={h.sauvegarde.taille}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader
                titre="Le serveur de cet hébergement"
                sousTitre="Un domaine est attaché à un serveur et à un seul. Tout ce qui est installé ici partage ces ressources — c’est la contrepartie du prix."
                actions={
                  <BoutonAction
                    libelle={`Redémarrer ${h.serveur.serveurWeb}`}
                    icone={<RefreshCw size={13} />}
                    operation={{
                      action: 'vm.power',
                      ton: 'info',
                      titre: `${h.serveur.serveurWeb} redémarré`,
                      detail:
                        'Coupure de moins d’une seconde : les connexions en cours sont laissées se terminer.',
                      appel: () =>
                        requete(
                          `/web/hebergements/${encodeURIComponent(h.id)}/redemarrage`,
                          { methode: 'POST', query: { confirmation: h.domaineProvisoire } },
                        ),
                      job: {
                        type: 'hebergement.restart',
                        label: `Redémarrage de ${h.serveur.serveurWeb} · ${nom}`,
                        etapes: ['Recharger la configuration', 'Redémarrer les processus'],
                        dureeEtapeMs: 900,
                      },
                    }}
                    confirmation={{
                      ressource: h.domaineProvisoire,
                      titre: `Redémarrer les services de ${nom} ?`,
                      pertes: [
                        'Coupure de quelques secondes sur tous les sites du serveur',
                        'Les sessions en cours seront interrompues',
                      ],
                      libelleAction: 'Redémarrer',
                    }}
                  />
                }
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2.5">
                  {h.serveur.chargeCpuPct != null && (
                    <QuotaBar libelle="Processeur" utilise={h.serveur.chargeCpuPct} total={100} unite="%" seuil={85} />
                  )}
                  {h.serveur.ramUtiliseePct != null && (
                    <QuotaBar libelle="Mémoire" utilise={h.serveur.ramUtiliseePct} total={100} unite="%" seuil={90} />
                  )}
                  <QuotaBar
                    libelle="Disque"
                    utilise={h.espaceUtiliseGo}
                    total={h.espaceTotalGo}
                    seuil={85}
                    formateur={(v) => `${v.toFixed(1)} Go`}
                  />
                </div>
                <KeyValueList
                  colonnes={1}
                  items={[
                    { cle: 'Nom', valeur: <span className="font-mono">{h.serveur.nom}</span> },
                    { cle: 'Gabarit', valeur: `${h.serveur.vcpu} vCPU · ${h.serveur.ramGo} Go · ${h.serveur.diskGo} Go` },
                    { cle: 'Adresse IPv4', valeur: <span className="font-mono">{h.serveur.ip}</span> },
                    {
                      cle: 'Adresse IPv6',
                      valeur: (
                        <span className="font-mono text-[12px]">{h.serveur.ipv6 ?? '—'}</span>
                      ),
                    },
                    { cle: 'Système', valeur: `${h.serveur.os} · ${h.serveur.serveurWeb}` },
                    { cle: 'Site physique', valeur: SITE_LABEL[h.serveur.site] },
                    {
                      cle: 'En service depuis',
                      valeur: h.serveur.uptimeJours != null ? `${h.serveur.uptimeJours} jours` : '—',
                    },
                  ]}
                />
              </div>
              <Callout ton="info" className="mt-4" titre="Pointer votre domaine ici">
                Créez un enregistrement <span className="font-mono">A</span> vers{' '}
                <span className="font-mono">{h.serveur.ip}</span>
                {h.serveur.ipv6 && (
                  <>
                    {' '}
                    et un <span className="font-mono">AAAA</span> vers{' '}
                    <span className="font-mono text-[11.5px]">{h.serveur.ipv6}</span>
                  </>
                )}
                . Si votre zone est gérée chez nous, l’onglet DNS le fait en une action.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Ce qui est installé sur ce serveur"
                sousTitre="Les réglages d’un site — version de PHP, protections, préproduction — se règlent d’ici. Son contenu se règle dans le site lui-même."
              />
              {sites.length === 0 ? (
                <EmptyState
                  titre="Aucun site installé"
                  phrase="Le serveur tourne, il n’attend qu’un site. L’installation crée la racine, la base et le certificat en une passe."
                />
              ) : (
                <ul className="divide-y divide-g-100">
                  {sites.map((st) => (
                    <li key={st.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[12.5px] font-semibold text-ink">
                            {st.hote}
                          </span>
                          <Badge tone="neutral" size="sm">
                            {TYPE_SITE_LABEL[st.type]}
                            {st.version ? ` ${st.version}` : ''}
                          </Badge>
                          <Badge tone="neutral" size="sm">
                            PHP {st.phpVersion}
                          </Badge>
                          <Badge
                            tone={
                              st.statut === 'en_ligne'
                                ? 'ok'
                                : st.statut === 'installation'
                                  ? 'info'
                                  : 'warn'
                            }
                            size="sm"
                            dot
                          >
                            {st.statut === 'en_ligne'
                              ? 'En ligne'
                              : st.statut === 'installation'
                                ? 'Installation'
                                : st.statut === 'maintenance'
                                  ? 'Maintenance'
                                  : 'Suspendu'}
                          </Badge>
                          {(st.majEnAttente ?? 0) > 0 && (
                            <Badge tone="warn" size="sm">
                              {st.majEnAttente} mise(s) à jour
                            </Badge>
                          )}
                        </span>
                        <span className="mt-1 block text-[11.5px] text-g-500">
                          <span className="font-mono">{st.racine}</span> ·{' '}
                          {(st.espaceMo / 1024).toFixed(2)} Go · {num(st.visitesMois)} visites ce mois
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setSiteOuvert(st.id)}>
                          Configurer
                        </Button>
                        <IconButton
                          label={`Supprimer ${st.hote}`}
                          size="sm"
                          onClick={() =>
                            executer({
                              action: 'service.admin',
                              ton: 'warn',
                              titre: `${st.hote} retiré du serveur`,
                              detail:
                                'La racine et la base restent en place le temps de la rétention : rien n’est effacé dans la seconde.',
                              appel: () => supprimerRessource('/web/sites', st.id, st.hote),
                              effet: () => tousSites.supprimer(st.id),
                              effetFinal: () => tousSites.recharger(),
                            })
                          }
                        >
                          <Trash2 size={13} className="text-err" />
                        </IconButton>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {bases.length > 0 && (
                <div className="mt-4 border-t border-g-100 pt-3.5">
                  <MicroLabel className="mb-2">Bases de ce serveur</MicroLabel>
                  <ul className="space-y-1.5">
                    {bases.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-2.5 py-1.5"
                      >
                        <span className="min-w-0">
                          <span className="font-mono text-[12px] font-semibold text-ink">
                            {b.nom}
                          </span>
                          <span className="ml-2 text-[11px] text-g-500">
                            {b.moteur} {b.version} · {b.tailleMo} Mo ·{' '}
                            {b.utilisateurs.length} utilisateur(s)
                          </span>
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setBaseOuverte(b.id)}>
                          Ouvrir
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            </div>

            <div className="space-y-4">
            {abonnement && (
              <CarteAbonnement
                offre={abonnement.offre}
                prixMensuel={abonnement.prixMensuel}
                debut={abonnement.debut}
                echeance={abonnement.echeance}
                joursRestants={abonnement.joursRestants}
                renouvellementAuto={abonnement.renouvellementAuto}
                frequence={abonnement.frequence}
              />
            )}

            <Card>
              <CardHeader
                titre="Actions courantes"
                sousTitre="Les gestes du quotidien, sans passer par les onglets."
              />
              <div className="space-y-2">
                {[
                  { l: 'Installer une application', i: <Globe size={13} />, href: '/app/web/applications' },
                  { l: 'Créer une base', i: <Database size={13} />, href: '/app/web/bases' },
                  { l: 'Ajouter un accès SFTP', i: <FolderTree size={13} />, o: 'fichiers' },
                  { l: 'Changer la version de PHP', i: <Terminal size={13} />, o: 'runtime' },
                  { l: 'Programmer une tâche', i: <Clock size={13} />, o: 'taches' },
                  { l: 'Restaurer une sauvegarde', i: <HardDrive size={13} />, href: '/app/web/backup' },
                ].map((a) =>
                  a.href ? (
                    <Link
                      key={a.l}
                      href={a.href}
                      className="flex w-full items-center gap-2.5 rounded-[6px] border border-g-300 px-2.5 py-2 text-left text-[12.5px] font-semibold text-g-700 transition-colors hover:border-p-400 hover:bg-p-050 hover:text-p-700"
                    >
                      <span className="text-p-700">{a.i}</span>
                      {a.l}
                    </Link>
                  ) : (
                    <button
                      key={a.l}
                      type="button"
                      onClick={() => setOnglet(a.o as string)}
                      className="flex w-full items-center gap-2.5 rounded-[6px] border border-g-300 px-2.5 py-2 text-left text-[12.5px] font-semibold text-g-700 transition-colors hover:border-p-400 hover:bg-p-050 hover:text-p-700"
                    >
                      <span className="text-p-700">{a.i}</span>
                      {a.l}
                    </button>
                  ),
                )}
              </div>
            </Card>
            </div>
          </div>

          <Card>
            <CardHeader
              titre="Trafic et temps de réponse"
              sousTitre="Mesuré par nos sondes sur les sites de cet hébergement."
              actions={
                <ButtonLink
                  href="https://grafana.synelia.dev01.ovh.smile.ci"
                  variant="ghost"
                  size="sm"
                  iconAfter={<ExternalLink size={12} />}
                >
                  Ouvrir dans Grafana
                </ButtonLink>
              }
            />
            {metriquesDegradees ? (
              <DegradedState
                source="métriques de l’hébergement"
                integration={metriquesDegradees.integration}
                dateDonnees={metriquesDegradees.dateDonnees}
              />
            ) : (
              <GrilleSparkCharts
                seed={h.id}
                metriques={[
                  { titre: 'Visites', unite: '/h', min: 40, max: 320 },
                  { titre: 'Temps de réponse', unite: 'ms', min: 120, max: 480 },
                  { titre: 'Processeur', unite: '%', min: 12, max: 68, seuil: 85 },
                  { titre: 'Erreurs 5xx', unite: '/h', min: 0, max: 6 },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      {onglet === 'fichiers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                titre="Comptes de transfert"
                sousTitre="Un compte par intervenant, cantonné à son dossier. Le mot de passe n’est jamais réaffiché : il se remplace."
                actions={
                  <BoutonFormulaire
                    libelle="Ajouter un compte"
                    variant="primary"
                    icone={<Plus size={13} />}
                    action="service.admin"
                    titre="Ajouter un compte de transfert"
                    description="Un compte par intervenant, cantonné à son dossier. Le mot de passe n’est affiché qu’une fois."
                    champs={[
                      { id: 'utilisateur', label: 'Identifiant', placeholder: 'agence-web', obligatoire: true },
                      { id: 'racine', label: 'Dossier racine', placeholder: '/var/www/boutique', obligatoire: true },
                      {
                        id: 'protocole',
                        label: 'Protocoles',
                        type: 'select',
                        demi: true,
                        options: [
                          { value: 'sftp', label: 'SFTP seulement (recommandé)' },
                          { value: 'ftps', label: 'FTPS' },
                          { value: 'ftp', label: 'FTP en clair' },
                        ],
                      },
                      { id: 'quota', label: 'Quota', type: 'nombre', demi: true, min: 0, suffixe: 'Go' },
                    ]}
                    valeursDepart={{ protocole: 'sftp', quota: 5, racine: '/var/www' }}
                    libelleValider="Créer le compte"
                    operation={(v) => ({
                      titre: `Compte ${v.utilisateur} créé`,
                      detail:
                        v.protocole === 'ftp'
                          ? 'FTP en clair transmet le mot de passe en clair : à réserver à un besoin ponctuel.'
                          : 'Le mot de passe est affiché une seule fois.',
                      appel: () =>
                        creerRessource(
                          `/web/hebergements/${encodeURIComponent(h.id)}/comptes-fichiers`,
                          {
                            utilisateur: String(v.utilisateur),
                            protocoles: [v.protocole as 'ftp' | 'sftp' | 'ftps'],
                            racine: String(v.racine),
                            ...(Number(v.quota) ? { quotaGo: Number(v.quota) } : {}),
                          },
                        ),
                      effet: () =>
                        tousComptes.creer({
                          id: tousComptes.identifiant('cf'),
                          hebergementId: h.id,
                          utilisateur: String(v.utilisateur),
                          protocoles: [v.protocole as 'ftp' | 'sftp' | 'ftps'],
                          racine: String(v.racine),
                          quotaGo: Number(v.quota) || null,
                          utiliseGo: 0,
                          clesSsh: 0,
                          statut: 'actif',
                        }),
                      effetFinal: () => tousComptes.recharger(),
                    })}
                  />
                }
              />
              <ul className="divide-y divide-g-100">
                {comptes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12.5px] font-semibold text-ink">
                          {c.utilisateur}
                        </span>
                        {c.protocoles.map((p) => (
                          <Badge key={p} tone="neutral" size="sm">
                            {p.toUpperCase()}
                          </Badge>
                        ))}
                        {c.clesSsh > 0 && (
                          <Badge tone="ok" size="sm">
                            {c.clesSsh} clé{c.clesSsh > 1 ? 's' : ''} SSH
                          </Badge>
                        )}
                        <Badge tone={c.statut === 'actif' ? 'ok' : 'neutral'} size="sm" dot>
                          {c.statut === 'actif' ? 'Actif' : 'Suspendu'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11.5px] text-g-500">
                        <span className="font-mono">{c.racine}</span> ·{' '}
                        {c.quotaGo === null
                          ? `${c.utiliseGo.toFixed(1)} Go, sans quota`
                          : `${c.utiliseGo.toFixed(1)} Go sur ${c.quotaGo} Go`}
                        {c.derniereConnexion
                          ? ` · dernière connexion ${relatif(c.derniereConnexion, maintenant)}`
                          : ' · jamais connecté'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <BoutonAction
                        libelle="Remplacer le mot de passe"
                        operation={(() => {
                          // Généré au clic, envoyé au backend, montré une fois.
                          const motDePasse = genererMotDePasse()
                          return {
                            action: 'service.admin',
                            titre: `Mot de passe de ${c.utilisateur} remplacé`,
                            detail:
                              'Affiché une seule fois ci-dessous. L’ancien cesse de fonctionner immédiatement : prévenez l’intervenant.',
                            // `PATCH …/comptes-fichiers/{id}` reprend le corps de
                            // création (utilisateur, protocoles, racine requis).
                            appel: () =>
                              requete(
                                `/web/hebergements/${encodeURIComponent(h.id)}/comptes-fichiers/${encodeURIComponent(c.id)}`,
                                {
                                  methode: 'PATCH',
                                  corps: {
                                    utilisateur: c.utilisateur,
                                    protocoles: c.protocoles,
                                    racine: c.racine,
                                    ...(c.quotaGo ? { quotaGo: c.quotaGo } : {}),
                                    motDePasse,
                                  },
                                },
                              ),
                            effetFinal: () => {
                              setSecretCompte({ utilisateur: c.utilisateur, motDePasse })
                              if (estActif()) tousComptes.recharger()
                            },
                          }
                        })()}
                      />
                      <IconButton
                        label={`Supprimer ${c.utilisateur}`}
                        size="sm"
                        onClick={() =>
                          executer({
                            action: 'service.admin',
                            ton: 'warn',
                            titre: `Compte ${c.utilisateur} supprimé`,
                            detail: 'Les fichiers déposés restent en place ; seul l’accès disparaît.',
                            appel: () =>
                              requete(
                                `/web/hebergements/${encodeURIComponent(h.id)}/comptes-fichiers/${encodeURIComponent(c.id)}`,
                                { methode: 'DELETE', query: { confirmation: c.utilisateur } },
                              ),
                            effet: () => tousComptes.supprimer(c.id),
                            effetFinal: () => tousComptes.recharger(),
                          })
                        }
                      >
                        <Trash2 size={13} className="text-err" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
              {secretCompte && (
                <Callout
                  ton="warn"
                  className="mt-4"
                  titre={`Nouveau mot de passe de ${secretCompte.utilisateur} — affiché une seule fois`}
                >
                  <CopyField className="mt-2" value={secretCompte.motDePasse} masque mono />
                </Callout>
              )}
            </Card>

            <Card>
              <CardHeader
                titre="Protocoles ouverts"
                sousTitre="Ce qui est fermé ne peut pas être attaqué."
              />
              <div className="space-y-3">
                <Switch
                  checked={h.acces.sftp}
                  onChange={(v) =>
                    executer({
                      action: 'service.admin',
                      ton: v ? 'ok' : 'info',
                      titre: v ? 'SFTP ouvert' : 'SFTP fermé',
                      detail: v
                        ? undefined
                        : 'Ce qui est fermé ne peut pas être attaqué.',
                      appel: () =>
                        requete(`/web/hebergements/${encodeURIComponent(h.id)}/acces`, {
                          methode: 'PUT',
                          corps: {
                            ftp: h.acces.ftp,
                            sftp: v,
                            ftps: h.acces.ftps,
                            ssh: h.acces.ssh,
                            portSsh: h.acces.portSsh,
                          },
                        }),
                      effet: () =>
                        hebergements.modifier(h.id, (x) => ({
                          acces: { ...x.acces, sftp: v },
                        })),
                      effetFinal: () => hebergements.recharger(),
                    })
                  }
                  label="SFTP"
                  description="Transfert sur SSH, chiffré. Le choix par défaut."
                />
                <Switch
                  checked={h.acces.ftps}
                  onChange={(v) =>
                    executer({
                      action: 'service.admin',
                      ton: v ? 'ok' : 'info',
                      titre: v ? 'FTPS ouvert' : 'FTPS fermé',
                      detail: v
                        ? undefined
                        : 'Ce qui est fermé ne peut pas être attaqué.',
                      appel: () =>
                        requete(`/web/hebergements/${encodeURIComponent(h.id)}/acces`, {
                          methode: 'PUT',
                          corps: {
                            ftp: h.acces.ftp,
                            sftp: h.acces.sftp,
                            ftps: v,
                            ssh: h.acces.ssh,
                            portSsh: h.acces.portSsh,
                          },
                        }),
                      effet: () =>
                        hebergements.modifier(h.id, (x) => ({
                          acces: { ...x.acces, ftps: v },
                        })),
                      effetFinal: () => hebergements.recharger(),
                    })
                  }
                  label="FTPS"
                  description="FTP sur TLS. Pour un vieux client qui ne parle pas SSH."
                />
                <Switch
                  checked={h.acces.ftp}
                  onChange={(v) =>
                    executer({
                      action: 'service.admin',
                      ton: v ? 'warn' : 'info',
                      titre: v ? 'FTP simple ouvert' : 'FTP simple fermé',
                      detail: v
                        ? 'Le mot de passe circule en clair : à n’ouvrir que le temps d’un dépannage.'
                        : 'Ce qui est fermé ne peut pas être attaqué.',
                      appel: () =>
                        requete(`/web/hebergements/${encodeURIComponent(h.id)}/acces`, {
                          methode: 'PUT',
                          corps: {
                            ftp: v,
                            sftp: h.acces.sftp,
                            ftps: h.acces.ftps,
                            ssh: h.acces.ssh,
                            portSsh: h.acces.portSsh,
                          },
                        }),
                      effet: () =>
                        hebergements.modifier(h.id, (x) => ({
                          acces: { ...x.acces, ftp: v },
                        })),
                      effetFinal: () => hebergements.recharger(),
                    })
                  }
                  label="FTP simple"
                  description="Mot de passe en clair sur le réseau. Fermé par défaut, et nous le déconseillons."
                />
                <Switch
                  checked={h.acces.ssh}
                  onChange={(v) =>
                    executer({
                      action: 'service.admin',
                      ton: v ? 'ok' : 'info',
                      titre: v ? 'Shell SSH ouvert' : 'Shell SSH fermé',
                      detail: v
                        ? undefined
                        : 'Ce qui est fermé ne peut pas être attaqué.',
                      appel: () =>
                        requete(`/web/hebergements/${encodeURIComponent(h.id)}/acces`, {
                          methode: 'PUT',
                          corps: {
                            ftp: h.acces.ftp,
                            sftp: h.acces.sftp,
                            ftps: h.acces.ftps,
                            ssh: v,
                            portSsh: h.acces.portSsh,
                          },
                        }),
                      effet: () =>
                        hebergements.modifier(h.id, (x) => ({
                          acces: { ...x.acces, ssh: v },
                        })),
                      effetFinal: () => hebergements.recharger(),
                    })
                  }
                  label="Shell SSH"
                  description={`Accès en ligne de commande sur le port ${h.acces.portSsh}, par clé uniquement.`}
                />
              </div>
              <div className="mt-4 border-t border-g-100 pt-3">
                <MicroLabel>Se connecter</MicroLabel>
                <CopyField
                  className="mt-2"
                  label="Commande SFTP"
                  value={`sftp -P ${h.acces.portSsh} dba-admin@${h.serveur.ip}`}
                  mono
                />
                <ButtonLink href="/app/securite" variant="ghost" size="sm" className="mt-2">
                  Gérer les clés SSH →
                </ButtonLink>
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'runtime' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader
                titre="Version de PHP"
                sousTitre="Une version par défaut pour le serveur, et une version propre à chaque site si besoin."
              />
              <Field label="Version par défaut" hint="S’applique aux sites qui n’ont pas de réglage propre.">
                <Select
                  defaultValue={h.php.versionDefaut}
                  onChange={(e) =>
                    executer({
                      action: 'service.admin',
                      titre: `PHP ${e.target.value} par défaut`,
                      detail: 'Les sites sans réglage propre basculent à la prochaine requête.',
                      appel: () =>
                        requete(`/web/hebergements/${encodeURIComponent(h.id)}/php`, {
                          methode: 'PUT',
                          corps: {
                            versionDefaut: e.target.value,
                            extensionsActivees: h.php.extensions
                              .filter((x) => x.active)
                              .map((x) => x.nom),
                            limites: h.php.limites,
                          },
                        }),
                      effet: () =>
                        hebergements.modifier(h.id, (x) => ({
                          php: { ...x.php, versionDefaut: e.target.value },
                        })),
                      effetFinal: () => hebergements.recharger(),
                    })
                  }
                >
                  {h.php.versionsDisponibles.map((v) => (
                    <option key={v} value={v}>
                      PHP {v}
                      {v === '8.4' ? ' — la plus récente' : v === '8.1' ? ' — fin de support en 2026' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="mt-3 space-y-2">
                {sites
                  .filter((s) => s.type !== 'statique')
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-2.5 py-2"
                    >
                      <span className="min-w-0 truncate font-mono text-[12px] text-ink">{s.hote}</span>
                      <Select defaultValue={s.phpVersion} className="h-7 w-24 shrink-0 text-[12px]">
                        {h.php.versionsDisponibles.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
              </div>
            </Card>

            <Card>
              <CardHeader titre="Limites d’exécution" sousTitre="Relever une limite consomme de la mémoire du serveur." />
              <div className="space-y-3">
                <Field label="Mémoire par requête" hint="memory_limit">
                  <Input defaultValue={`${h.php.limites.memoryLimitMo}M`} />
                </Field>
                <Field label="Taille d’envoi maximale" hint="upload_max_filesize et post_max_size">
                  <Input defaultValue={`${h.php.limites.uploadMaxMo}M`} />
                </Field>
                <Field label="Durée maximale d’un script" hint="max_execution_time, en secondes">
                  <Input defaultValue={String(h.php.limites.maxExecutionS)} />
                </Field>
                <Switch
                  checked={h.php.limites.opcache}
                  onChange={(v) =>
                    executer({
                      action: 'service.admin',
                      ton: v ? 'ok' : 'warn',
                      titre: v ? 'OPcache activé' : 'OPcache désactivé',
                      detail: v
                        ? 'Le bytecode compilé reste en mémoire : le gain est immédiat.'
                        : 'Chaque requête recompile le code : à ne faire qu’en développement.',
                      appel: () =>
                        requete(`/web/hebergements/${encodeURIComponent(h.id)}/php`, {
                          methode: 'PUT',
                          corps: {
                            versionDefaut: h.php.versionDefaut,
                            extensionsActivees: h.php.extensions
                              .filter((x) => x.active)
                              .map((x) => x.nom),
                            limites: { ...h.php.limites, opcache: v },
                          },
                        }),
                      effet: () =>
                        hebergements.modifier(h.id, (x) => ({
                          php: { ...x.php, limites: { ...x.php.limites, opcache: v } },
                        })),
                      effetFinal: () => hebergements.recharger(),
                    })
                  }
                  label="OPcache"
                  description="Garde le bytecode compilé en mémoire. À laisser actif en production."
                />
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Extensions"
                sousTitre="Ce qui est requis par un site installé ne peut pas être désactivé."
              />
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {h.php.extensions.map((e) => (
                  <div
                    key={e.nom}
                    className="flex items-start justify-between gap-2 rounded-[6px] border border-g-300 px-2.5 py-1.5"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] font-semibold text-ink">
                        {e.nom}
                      </span>
                      {e.requisePar && (
                        <span className="block text-[10.5px] text-g-500">requise par {e.requisePar}</span>
                      )}
                    </span>
                    {e.requisePar && e.active ? (
                      <Tooltip content={`Requise par ${e.requisePar}`}>
                        <span className="shrink-0">
                          <Badge tone="ok" size="sm">
                            Verrouillée
                          </Badge>
                        </span>
                      </Tooltip>
                    ) : (
                      <Switch
                        checked={e.active}
                        className="shrink-0"
                        label={`Extension ${e.nom}`}
                        onChange={(v) =>
                          executer({
                            action: 'service.admin',
                            titre: v ? `Extension ${e.nom} activée` : `Extension ${e.nom} désactivée`,
                            detail: 'Prise en compte au prochain rechargement de PHP-FPM.',
                            appel: () =>
                              requete(`/web/hebergements/${encodeURIComponent(h.id)}/php`, {
                                methode: 'PUT',
                                corps: {
                                  versionDefaut: h.php.versionDefaut,
                                  extensionsActivees: h.php.extensions
                                    .filter((x) => (x.nom === e.nom ? v : x.active))
                                    .map((x) => x.nom),
                                  limites: h.php.limites,
                                },
                              }),
                            effet: () =>
                              hebergements.modifier(h.id, (x) => ({
                                php: {
                                  ...x.php,
                                  extensions: x.php.extensions.map((ext) =>
                                    ext.nom === e.nom ? { ...ext, active: v } : ext,
                                  ),
                                },
                              })),
                            effetFinal: () => hebergements.recharger(),
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'taches' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-g-100 px-4 py-3">
              <p className="text-[13px] font-bold text-ink">
                {taches.filter((t) => t.actif).length} tâches actives sur {taches.length}
              </p>
              <BoutonFormulaire
                libelle="Programmer une tâche"
                variant="primary"
                icone={<Plus size={13} />}
                action="service.admin"
                titre="Programmer une tâche"
                description="La tâche s’exécute sur ce serveur, avec les droits du compte du site. Une tâche en échec ne bloque pas les autres."
                ouvert={tacheOuverte}
                onOuvertChange={setTacheOuverte}
                champs={[
                  { id: 'libelle', label: 'Intitulé', placeholder: 'Export des commandes', obligatoire: true },
                  { id: 'commande', label: 'Commande', placeholder: 'php /var/www/boutique/bin/export.php', obligatoire: true },
                  {
                    id: 'frequence',
                    label: 'Fréquence',
                    type: 'select',
                    options: [
                      { value: '*/5 * * * *', label: 'Toutes les 5 minutes' },
                      { value: '0 * * * *', label: 'Toutes les heures' },
                      { value: '0 2 * * *', label: 'Chaque nuit à 02h00' },
                      { value: '0 3 * * 1', label: 'Chaque lundi à 03h00' },
                    ],
                  },
                ]}
                valeursDepart={{ frequence: '0 2 * * *' }}
                libelleValider="Programmer"
                operation={(v) => ({
                  titre: `Tâche « ${v.libelle} » programmée`,
                  detail: String(v.frequence),
                  appel: () =>
                    creerRessource(
                      `/web/hebergements/${encodeURIComponent(h.id)}/taches`,
                      {
                        libelle: String(v.libelle),
                        expression: String(v.frequence),
                        commande: String(v.commande),
                        actif: true,
                      },
                    ),
                  effet: () =>
                    toutesTaches.creer({
                      id: toutesTaches.identifiant('cron'),
                      hebergementId: h.id,
                      libelle: String(v.libelle),
                      expression: String(v.frequence),
                      lisible:
                        {
                          '*/5 * * * *': 'toutes les 5 minutes',
                          '0 * * * *': 'toutes les heures',
                          '0 2 * * *': 'chaque nuit à 02h00',
                          '0 3 * * 1': 'chaque lundi à 03h00',
                        }[String(v.frequence)] ?? String(v.frequence),
                      commande: String(v.commande),
                      derniereExecution: '2026-08-19T02:00:00Z',
                      dureeS: 0,
                      statut: 'ok',
                      prochaine: '2026-08-20T02:00:00Z',
                      actif: true,
                    }),
                  effetFinal: () => toutesTaches.recharger(),
                })}
              />
            </div>
            {taches.length === 0 ? (
              <EmptyState
                className="m-4"
                titre="Aucune tâche planifiée"
                phrase="WordPress et PrestaShop ont besoin d’une tâche périodique pour leurs traitements de fond. Nous la créons automatiquement à l’installation."
                action={{ libelle: 'Programmer une tâche', onClick: () => setTacheOuverte(true) }}
              />
            ) : (
              <ul className="divide-y divide-g-100">
                {taches.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink">{t.libelle}</span>
                        <Badge tone="neutral" size="sm">
                          <span className="font-mono">{t.expression}</span>
                        </Badge>
                        <span className="text-[11.5px] text-g-500">{t.lisible}</span>
                        <Badge tone={t.statut === 'ok' ? 'ok' : 'err'} size="sm" dot>
                          {t.statut === 'ok' ? 'Dernière exécution réussie' : 'Dernière exécution en échec'}
                        </Badge>
                        {!t.actif && (
                          <Badge tone="neutral" size="sm">
                            Désactivée
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-g-500">{t.commande}</p>
                      <p className="mt-1 text-[11px] text-g-500">
                        {t.derniereExecution
                          ? `Exécutée ${relatif(t.derniereExecution, maintenant)}${t.dureeS != null ? ` en ${t.dureeS} s` : ''} · `
                          : 'Jamais exécutée · '}
                        prochaine {dateHeure(t.prochaine)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={t.actif}
                        label={`Activer ${t.libelle}`}
                        onChange={(v) =>
                          executer({
                            action: 'service.admin',
                            ton: v ? 'ok' : 'warn',
                            titre: v ? `« ${t.libelle} » réactivée` : `« ${t.libelle} » désactivée`,
                            appel: () =>
                              requete(
                                `/web/hebergements/${encodeURIComponent(h.id)}/taches/${encodeURIComponent(t.id)}`,
                                {
                                  methode: 'PATCH',
                                  corps: {
                                    libelle: t.libelle,
                                    expression: t.expression,
                                    commande: t.commande,
                                    actif: v,
                                  },
                                },
                              ),
                            effet: () => toutesTaches.modifier(t.id, { actif: v }),
                            effetFinal: () => toutesTaches.recharger(),
                          })
                        }
                      />
                      <BoutonAction
                        libelle="Exécuter maintenant"
                        operation={{
                          action: 'service.admin',
                          ton: 'info',
                          titre: `« ${t.libelle} » lancée`,
                          detail: 'La sortie complète apparaît dans l’onglet Journaux.',
                          appel: () =>
                            requete(
                              `/web/hebergements/${encodeURIComponent(h.id)}/taches/${encodeURIComponent(t.id)}/execution`,
                              { methode: 'POST' },
                            ),
                          job: {
                            type: 'cron.run',
                            label: `Exécution · ${t.libelle}`,
                            etapes: ['Lancer la commande', 'Collecter la sortie'],
                            dureeEtapeMs: 900,
                          },
                          effetFinal: () => {
                            if (estActif()) {
                              toutesTaches.recharger()
                              return
                            }
                            toutesTaches.modifier(t.id, {
                              derniereExecution: '2026-08-19T15:20:00Z',
                              statut: 'ok',
                              dureeS: 3,
                            })
                          },
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {taches.some((t) => t.statut === 'echec') && (
            <Callout ton="err" titre="Une tâche échoue">
              L’export des commandes vers l’ERP sort en code 1 depuis le 17/08. La sortie complète
              est dans l’onglet Journaux. Une tâche en échec ne bloque pas les autres.
            </Callout>
          )}
        </div>
      )}

      {onglet === 'journaux' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Vingt dernières lignes"
              sousTitre="Assez pour comprendre un incident en cours. L’historique complet et la recherche sont dans VictoriaLogs."
            />
            <LogPeek lignes={LOGS_EXECUTION} max={20} titre="Journal d’Apache et de PHP" />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { t: 'Accès Apache', d: 'Requêtes servies, codes de retour, temps de réponse.', l: '4,2 Go sur 30 jours' },
              { t: 'Erreurs PHP', d: 'Avertissements et erreurs fatales, par site.', l: '186 Mo sur 30 jours' },
              { t: 'Tâches planifiées', d: 'Sortie standard et code de retour de chaque exécution.', l: '42 Mo sur 30 jours' },
            ].map((j) => (
              <Card key={j.t}>
                <CardHeader titre={j.t} sousTitre={j.d} />
                <p className="text-[12px] text-g-500">{j.l}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink
                    href="https://vlogs.synelia.cloud"
                    variant="secondary"
                    size="sm"
                    iconAfter={<ExternalLink size={12} />}
                  >
                    Ouvrir
                  </ButtonLink>
                  <BoutonAction
                    libelle="Exporter"
                    variant="ghost"
                    icone={<Download size={12} />}
                    operation={{
                      ton: 'info',
                      titre: `Export du journal « ${j.t} »`,
                      detail: `${j.l} — l’export part vers VictoriaLogs, le portail n’en garde que vingt lignes.`,
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>

          <Callout ton="info" titre="Pas de constructeur de requêtes ici">
            Le portail montre les dernières lignes et donne l’accès. Interroger des journaux
            demande un outil spécialisé, et VictoriaLogs le fait mieux que ce que nous
            reconstruirions.
          </Callout>
        </div>
      )}

      {/* Configuration d'un site, en panneau latéral */}
      <Drawer
        open={siteOuvert !== null}
        onClose={() => setSiteOuvert(null)}
        title={siteOuvert ? `Configurer ${siteOuvert.hote}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSiteOuvert(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                const cible = siteOuvert
                executer({
                  action: 'service.admin',
                  titre: 'Réglages appliqués',
                  detail: `${cible?.hote} — rechargement de ${h.serveur.serveurWeb} sans coupure.`,
                  appel: () =>
                    cible
                      ? modifierRessource('/web/sites', cible.id, {
                          phpVersion: phpSite ?? cible.phpVersion,
                        })
                      : Promise.resolve(),
                  effet: () =>
                    cible
                      ? tousSites.modifier(cible.id, {
                          phpVersion: phpSite ?? cible.phpVersion,
                        })
                      : undefined,
                  effetFinal: () => tousSites.recharger(),
                })
                setSiteOuvert(null)
              }}
            >
              Appliquer
            </Button>
          </>
        }
      >
        {siteOuvert && (
          <div className="space-y-4">
            <KeyValueList
              items={[
                { cle: 'Solution', valeur: `${TYPE_SITE_LABEL[siteOuvert.type]} ${siteOuvert.version ?? ''}` },
                { cle: 'Racine du site', valeur: <span className="font-mono text-[12px]">{siteOuvert.racine}</span> },
                { cle: 'Espace occupé', valeur: `${(siteOuvert.espaceMo / 1024).toFixed(2)} Go` },
                { cle: 'Visites du mois', valeur: num(siteOuvert.visitesMois) },
              ]}
            />
            <Field label="Version de PHP pour ce site">
              <Select
                value={phpSite ?? siteOuvert.phpVersion}
                onChange={(e) => setPhpSite(e.target.value)}
              >
                {h.php.versionsDisponibles.map((v) => (
                  <option key={v} value={v}>
                    PHP {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2.5">
              <MicroLabel>Sécurité</MicroLabel>
              <Switch
                checked={siteOuvert.securite.waf}
                onChange={(v) =>
                  executer({
                    action: 'service.admin',
                    titre: v ? 'Pare-feu applicatif activé' : 'Pare-feu applicatif désactivé',
                    detail: `${siteOuvert.hote} — rechargement de ${h.serveur.serveurWeb} sans coupure.`,
                    appel: () =>
                      modifierRessource('/web/sites', siteOuvert.id, {
                        securite: { ...siteOuvert.securite, waf: v },
                      }),
                    effet: () =>
                      tousSites.modifier(siteOuvert.id, (x) => ({
                        securite: { ...x.securite, waf: v },
                      })),
                    effetFinal: () => tousSites.recharger(),
                  })
                }
                label="Pare-feu applicatif"
                description="Règles OWASP adaptées à la solution installée."
              />
              <Switch
                checked={siteOuvert.securite.bruteForce}
                onChange={(v) =>
                  executer({
                    action: 'service.admin',
                    titre: v ? 'Anti-force brute activé' : 'Anti-force brute désactivé',
                    detail: `${siteOuvert.hote} — rechargement de ${h.serveur.serveurWeb} sans coupure.`,
                    appel: () =>
                      modifierRessource('/web/sites', siteOuvert.id, {
                        securite: { ...siteOuvert.securite, bruteForce: v },
                      }),
                    effet: () =>
                      tousSites.modifier(siteOuvert.id, (x) => ({
                        securite: { ...x.securite, bruteForce: v },
                      })),
                    effetFinal: () => tousSites.recharger(),
                  })
                }
                label="Anti-force brute"
                description="Sur les pages d’authentification et les points d’API."
              />
              <Switch
                checked={siteOuvert.securite.scanMalware}
                onChange={(v) =>
                  executer({
                    action: 'service.admin',
                    titre: v ? 'Analyse antimalware activée' : 'Analyse antimalware désactivée',
                    detail: `${siteOuvert.hote} — rechargement de ${h.serveur.serveurWeb} sans coupure.`,
                    appel: () =>
                      modifierRessource('/web/sites', siteOuvert.id, {
                        securite: { ...siteOuvert.securite, scanMalware: v },
                      }),
                    effet: () =>
                      tousSites.modifier(siteOuvert.id, (x) => ({
                        securite: { ...x.securite, scanMalware: v },
                      })),
                    effetFinal: () => tousSites.recharger(),
                  })
                }
                label="Analyse antimalware quotidienne"
                description="Mise en quarantaine et alerte, sans suppression automatique."
              />
            </div>
            {siteOuvert.preproduction && (
              <Callout ton="violet" titre="Préproduction">
                {siteOuvert.preproduction.actif
                  ? `Copie active sur ${siteOuvert.preproduction.hote}, synchronisée le ${siteOuvert.preproduction.derniereSync}. Comparez puis publiez, ou jetez la copie.`
                  : 'Aucune copie active. Cloner la production prend quelques minutes et n’interrompt rien.'}
              </Callout>
            )}
            <Callout ton="info" titre="Le contenu ne s’édite pas ici">
              Pages, articles, produits et thèmes se gèrent dans{' '}
              {TYPE_SITE_LABEL[siteOuvert.type]}, dont l’écosystème est incomparablement plus riche
              que ce que nous pourrions reconstruire.
            </Callout>
          </div>
        )}
      </Drawer>

      {/* Gestion d'une base */}
      <Drawer
        open={baseOuverte !== null}
        onClose={() => setBaseOuverte(null)}
        title={baseOuverte ? `Base ${baseOuverte.nom}` : ''}
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setBaseOuverte(null)}>
            Fermer
          </Button>
        }
      >
        {baseOuverte && (
          <div className="space-y-4">
            <KeyValueList
              items={[
                {
                  cle: 'Moteur',
                  valeur: `${baseOuverte.moteur === 'mariadb' ? 'MariaDB' : 'PostgreSQL'} ${baseOuverte.version}`,
                },
                {
                  cle: 'Taille',
                  valeur:
                    baseOuverte.tailleMo >= 1024
                      ? `${(baseOuverte.tailleMo / 1024).toFixed(2)} Go`
                      : `${baseOuverte.tailleMo} Mo`,
                },
                { cle: 'Jeu de caractères', valeur: baseOuverte.jeuCaracteres },
              ]}
            />
            <div>
              <MicroLabel>Chaîne de connexion depuis le serveur</MicroLabel>
              <CopyField
                className="mt-2"
                value={
                  baseOuverte.moteur === 'mariadb'
                    ? `mysql://${baseOuverte.utilisateurs[0].nom}@localhost/${baseOuverte.nom}`
                    : `postgresql://${baseOuverte.utilisateurs[0].nom}@127.0.0.1:5432/${baseOuverte.nom}`
                }
                mono
              />
              <p className="mt-1.5 text-[11.5px] text-g-500">
                La base n’écoute pas sur l’extérieur. Vos sites l’atteignent en local ; pour un accès
                distant, il faut ouvrir un tunnel SSH.
              </p>
            </div>
            <div>
              <MicroLabel>Utilisateurs</MicroLabel>
              <ul className="mt-2 space-y-1.5">
                {baseOuverte.utilisateurs.map((u) => (
                  <li
                    key={u.nom}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[12px] font-semibold text-ink">{u.nom}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={u.droits === 'tous' ? 'violet' : 'neutral'} size="sm">
                        {u.droits === 'tous'
                          ? 'Tous droits'
                          : u.droits === 'lecture'
                            ? 'Lecture seule'
                            : 'Lecture et écriture'}
                      </Badge>
                      <span className="font-mono text-[11px] text-g-500">{u.hote}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <BoutonAction
                libelle="Exporter en SQL"
                icone={<Download size={13} />}
                operation={{
                  action: 'service.admin',
                  titre: `Export de ${baseOuverte.nom} préparé`,
                  detail: `${baseOuverte.tailleMo} Mo · lien signé valable une heure`,
                  // `POST /web/bases/{serveur}/bases/{nom}/export` → `202` ; le
                  // serveur est celui de l’hébergement pour ce moteur.
                  appel: (() => {
                    const serveur = serveursBases.items.find(
                      (x) => x.hebergementId === h.id && x.moteur === baseOuverte.moteur,
                    )
                    return serveur
                      ? () =>
                          requete(
                            `/web/bases/${encodeURIComponent(serveur.id)}/bases/${encodeURIComponent(baseOuverte.nom)}/export`,
                            { methode: 'POST', corps: { format: 'sql_gz' } },
                          )
                      : undefined
                  })(),
                  job: {
                    type: 'base.dump',
                    label: `Export SQL · ${baseOuverte.nom}`,
                    etapes: ['Verrouiller en lecture', 'Écrire le dump', 'Compresser et signer le lien'],
                    dureeEtapeMs: 900,
                  },
                }}
              />
              <BoutonFormulaire
                libelle="Ajouter un utilisateur"
                icone={<KeyRound size={13} />}
                action="service.admin"
                titre={`Ajouter un utilisateur à ${baseOuverte.nom}`}
                description="Donnez à chaque application son propre utilisateur, avec les droits les plus étroits possibles."
                champs={[
                  { id: 'nom', label: 'Identifiant', placeholder: 'boutique_ro', obligatoire: true },
                  {
                    id: 'droits',
                    label: 'Droits',
                    type: 'select',
                    demi: true,
                    options: [
                      { value: 'lecture', label: 'Lecture seule' },
                      { value: 'lecture_ecriture', label: 'Lecture et écriture' },
                      { value: 'tous', label: 'Tous droits' },
                    ],
                  },
                  { id: 'hote', label: 'Hôte autorisé', placeholder: 'localhost', demi: true },
                ]}
                valeursDepart={{ droits: 'lecture_ecriture', hote: 'localhost' }}
                libelleValider="Ajouter"
                operation={(v) => {
                  const base = baseOuverte
                  return {
                    titre: `Utilisateur ${v.nom} créé`,
                    detail: 'Le mot de passe est affiché une seule fois.',
                    effet: () =>
                      base
                        ? toutesBases.modifier(base.id, (b) => ({
                            utilisateurs: [
                              ...b.utilisateurs,
                              {
                                nom: String(v.nom),
                                droits: v.droits as BaseHebergement['utilisateurs'][number]['droits'],
                                hote: String(v.hote) || 'localhost',
                              },
                            ],
                          }))
                        : undefined,
                  }
                }}
              />
              <ButtonLink
                href={`https://adminer.${nom}`}
                variant="ghost"
                size="sm"
                iconAfter={<ExternalLink size={12} />}
              >
                Ouvrir dans Adminer
              </ButtonLink>
            </div>
            <Callout ton="info" titre="Pas d’explorateur de tables dans le portail">
              Le portail donne la chaîne de connexion, la taille, les utilisateurs et l’export. Pour
              écrire des requêtes, Adminer ou votre client habituel font mieux.
            </Callout>
          </div>
        )}
      </Drawer>
    </div>
  )
}
