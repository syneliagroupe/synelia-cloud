/**
 * Modèle de données — Synelia Cloud (spécification Partie 9).
 * Modèle de données partagé par la maquette (`src/lib/mock/`) et le contrat
 * d'API (`docs/api/openapi.json`) ; les noms de champs y font foi.
 */

export type Site = 'ABJ' | 'GBM'

export const SITE_LABEL: Record<Site, string> = {
  ABJ: 'Abidjan · Synertech Vallon',
  GBM: 'Grand-Bassam · VITIB',
}

export const SITE_COURT: Record<Site, string> = {
  ABJ: 'Abidjan',
  GBM: 'Grand-Bassam',
}

// ─── Tenancy & identité ───────────────────────────────────────────────

/**
 * Une organisation est cliente de Synelia, directement et sans intermédiaire.
 *
 * Il n'y a pas de niveau revendeur : la plateforme ne connaît que deux sortes
 * d'acteurs, les organisations clientes et l'équipe Synelia qui l'exploite.
 * Aucun contrat ne transite par un tiers, donc aucun écran n'a à répondre à
 * « qui facture qui ».
 */
export interface Organisation {
  id: string
  nom: string
  pays: string
  secteur?: string
  tva?: string
  statut: 'active' | 'suspendue' | 'fermee'
  logoUrl?: string
  createdAt: string
  /** Champs de démonstration côté super admin. */
  espaces?: number
  utilisateurs?: number
  caMensuel?: number
  consommationVcpu?: number
  tenantPlan?: string
  domaine?: string
}

export interface User {
  id: string
  email: string
  nom: string
  mfaEnabled: boolean
  idpSource: 'local' | 'oidc' | 'saml' | 'ldap'
  lastLoginAt?: string
  orgId?: string
  fonction?: string
  statut?: 'actif' | 'invite' | 'suspendu'
}

/**
 * Deux familles de rôles, et deux seulement : ceux de l'équipe Synelia qui
 * exploite la plateforme, et ceux d'une organisation cliente. Rien entre les
 * deux — pas de revendeur, pas d'apporteur d'affaires, pas d'intégrateur qui
 * hériterait d'un sous-ensemble des droits du super admin.
 */
export type Role =
  | 'super_admin'
  | 'platform_operator'
  | 'org_admin'
  | 'espace_admin'
  | 'project_owner'
  | 'operator'
  | 'service_admin'
  | 'billing_manager'
  | 'compliance'
  | 'read_only'

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  platform_operator: 'Platform Operator',
  org_admin: 'Org Admin',
  espace_admin: 'Espace Cloud Admin',
  project_owner: 'Project Owner',
  operator: 'Operator',
  service_admin: 'Service Admin',
  billing_manager: 'Billing Manager',
  compliance: 'Compliance',
  read_only: 'Read-Only',
}

export type ScopeType = 'org' | 'espace' | 'application' | 'service'

export interface Membership {
  id: string
  userId: string
  orgId: string
  role: Role
  scopeType: ScopeType
  scopeId?: string
  scopeLabel?: string
  /** Utilisateur embarqué par le backend (`GET /membres`) ; absent côté maquette. */
  utilisateur?: User
}

// ─── IaaS ─────────────────────────────────────────────────────────────

export interface Quota {
  vcpu: number
  ramGo: number
  stockageTo: number
}

export interface EspaceCloud {
  id: string
  orgId: string
  code: string
  offerId: string
  offreNom: string
  site: Site
  cidr: string
  quota: Quota
  usage: Quota
  projets: number
  statut: 'active' | 'suspendue' | 'provisioning'
  createdAt: string
  dnsInterne?: string
}

export type BackendType = 'openstack' | 'proxmox' | 'cloudstack' | 'vsphere' | 'hyperv'

export const BACKEND_LABEL: Record<BackendType, string> = {
  openstack: 'OpenStack',
  proxmox: 'Proxmox VE',
  cloudstack: 'Apache CloudStack',
  vsphere: 'VMware vSphere',
  hyperv: 'Microsoft Hyper-V',
}

export interface Backend {
  id: string
  code: string
  type: BackendType
  site: Site
  hosts: number
  statut: 'en_ligne' | 'maintenance' | 'degrade'
  usage: { vcpuPct: number; ramPct: number; stockagePct: number }
  capacite: Quota
  /** Arbitrage §12.1 — trajectoire assumée : backend propriétaire en sortie. */
  enSortie?: { actif: boolean; cibleMigration: string }
  souverain: boolean
  saturation?: { j30: number; j60: number; j90: number }
}

export interface Placement {
  id: string
  espaceId: string
  backendId: string
  percent: number
}

export interface VM {
  id: string
  espaceId: string
  nom: string
  os: string
  vcpu: number
  ramGo: number
  diskGo: number
  ips: Array<{ adresse: string; type: 'privee' | 'publique'; ptr?: string }>
  statut: 'running' | 'stopped' | 'creating' | 'error' | 'migrating'
  applicationId?: string
  applicationNom?: string
  hardware: {
    scsiControllers: number
    nics: number
    usb: boolean
    secureBoot: boolean
    videoMo?: number
    vtpm?: boolean
  }
  backupPlanId?: string
  derniereSauvegarde?: string
  site: Site
  tags?: string[]
  flavor?: string
}

export interface K8sCluster {
  id: string
  espaceId: string
  nom: string
  version: string
  controlPlane: { mode: 'single' | 'ha'; nodes: number }
  pools: Array<{
    nom: string
    nodes: number
    flavor: string
    diskGo?: number
    autoscale?: { min: number; max: number }
    type: 'standard' | 'gpu' | 'memory' | 'preemptible'
    labels?: string[]
    taints?: string[]
  }>
  modules: string[]
  statut: 'running' | 'degraded' | 'provisioning' | 'updating'
  site: Site
  applicationId?: string
}

export interface Network {
  id: string
  espaceId: string
  nom: string
  cidr: string
  dnsInterne: boolean
  workloads: number
  vlan?: number
}

export interface PublicIP {
  id: string
  espaceId: string
  adresse: string
  ptr?: string
  attachedTo?: string
  attachedLabel?: string
  antiDdos?: boolean
}

export interface SecurityGroup {
  id: string
  espaceId: string
  nom: string
  description?: string
  defaultPolicy: { ingress: 'deny' | 'allow'; egress: 'deny' | 'allow' }
  rules: Array<{
    id: string
    direction: 'in' | 'out'
    protocole: 'tcp' | 'udp' | 'icmp' | 'any'
    ports?: string
    cible: string
    description?: string
  }>
  attaches: number
}

export interface VpnTunnel {
  id: string
  espaceId: string
  nom: string
  type: 'ipsec' | 'ssl'
  passerelleDistante?: string
  reseauxAnnonces?: string[]
  statut: 'up' | 'down' | 'negociation'
  derniereNegociation?: string
  profils?: Array<{ nom: string; utilisateur: string; cree: string; revoque?: boolean }>
}

export interface LoadBalancer {
  id: string
  espaceId: string
  nom: string
  layer: 'l4' | 'l7'
  exposure: 'public' | 'interne'
  vip: string
  algo: 'round_robin' | 'least_conn' | 'source_hash' | 'weighted'
  sticky?: 'cookie' | 'ip'
  listeners: Array<{ protocole: string; port: number; certId?: string; tlsMin?: string }>
  pool: Array<{
    targetId: string
    targetLabel: string
    poids: number
    sante: 'ok' | 'ko' | 'drain'
  }>
  healthCheck: {
    protocole: string
    chemin?: string
    codeAttendu?: number
    intervalleS: number
    seuilKo: number
    seuilOk: number
  }
  waf?: { actif: boolean; ruleset: string }
  rateLimit?: { requetesParMin: number }
  metriques: {
    rps: number
    p50: number
    p95: number
    p99: number
    taux4xx: number
    taux5xx: number
    connexions: number
  }
  reglesL7?: Array<{ hote?: string; chemin?: string; entete?: string; cible: string }>
}

export interface Volume {
  id: string
  espaceId: string
  nom: string
  tailleGo: number
  classe: 'nvme' | 'ssd' | 'hdd' | 'archive'
  chiffre: boolean
  attachedTo?: string
  attachedLabel?: string
  ephemere: boolean
  iops: number
  montage?: string
}

export interface Bucket {
  id: string
  orgId: string
  espaceId: string
  nom: string
  region: Site
  classe: 'chaud' | 'froid'
  tailleGo: number
  objets: number
  versioning: boolean
  objectLock?: { actif: boolean; retentionJours: number }
  replication?: { cible: Site }
  accessLogs: boolean
  policy: 'prive' | 'lecture_publique' | 'json'
}

export interface ManagedDatabase {
  id: string
  espaceId: string
  nom: string
  moteur: 'postgresql' | 'mysql' | 'mariadb' | 'mongodb' | 'redis'
  version: string
  palier: string
  ha: boolean
  tailleGo: number
  connexions: { actives: number; max: number }
  replicas: number
  statut: 'running' | 'degraded' | 'maintenance'
  pitr: boolean
  host: string
}

// ─── Protection ───────────────────────────────────────────────────────

export interface BackupPlan {
  id: string
  orgId: string
  nom: string
  scope: { type: 'tag' | 'espace' | 'ressource' | 'service'; valeur: string }
  frequence: 'horaire' | 'quotidien' | 'hebdo' | 'continu'
  mode: 'incrementale_complete_hebdo' | 'complete'
  retentionJours: number
  immutable: boolean
  destinations: Array<{ type: 'local' | 'autre_site' | 'immuable'; bucketId?: string }>
  prochaineExecution: string
  chiffrement: { mode: 'synelia' | 'byok'; kmsRef?: string }
  ressourcesProtegees: number
  dernierResultat: 'ok' | 'echec' | 'partiel'
}

export interface RestorePoint {
  id: string
  planId: string
  planNom: string
  resourceId: string
  resourceNom: string
  resourceType: string
  date: string
  tailleGo: number
  type: 'complete' | 'incrementale' | 'snapshot'
  immuableJusquau?: string
  verifie: boolean
  destination: string
  expiration: string
}

export interface ConformiteLigne {
  ressourceId: string
  ressourceNom: string
  type: string
  protection: 'protegee' | 'non_protegee' | 'echec'
  dernierSucces?: string
  rpoConstateMin?: number
  regle321: { copies: boolean; supports: boolean; horsSite: boolean }
  dernierTestRestauration?: { date: string; succes: boolean; dureeMin: number }
}

export interface DRPlan {
  id: string
  orgId: string
  nom: string
  siteSource: Site
  siteRepli: Site
  rpoCibleMin: number
  rpoConstateMin: number
  rtoCibleMin: number
  rtoConstateMin: number
  groupes: Array<{
    ordre: number
    nom: string
    ressources: string[]
    dependances: string[]
    ipRepli?: Record<string, string>
  }>
  replication: { mode: 'continu' | 'planifie'; retardS: number }
  exercices: Array<{
    date: string
    type: 'test' | 'reel'
    dureeMin: number
    rtoConstateMin: number
    succes: boolean
    rapportUrl: string
    incidents?: string[]
  }>
  statut: 'operationnel' | 'degrade' | 'jamais_teste'
}

// ─── PaaS ─────────────────────────────────────────────────────────────

export interface Application {
  id: string
  espaceId: string
  nom: string
  source: 'git' | 'image'
  repo?: { provider: 'github' | 'gitlab'; url: string; branche: string }
  builder?: 'nixpacks' | 'dockerfile' | 'image'
  cible: 'vm' | 'k8s'
  domainePrincipal: string
  sante: 'sain' | 'degrade' | 'arrete' | 'echec'
  stack: string[]
  dernierDeploiement: string
  environnements: number
  description?: string
}

export interface Environment {
  id: string
  appId: string
  nom: string
  domaines: string[]
  couleur: string
  statut: 'running' | 'degraded' | 'stopped' | 'building' | 'failed'
  autoDeploy?: { branche: string; previewParPR: boolean }
  protection?: { approbationRequise: boolean; gelJusquau?: string; motDePasse?: boolean }
  sante: { cpu: number; ram: number; latenceMs: number; erreursPct: number }
  strategie?: 'rolling' | 'canari' | 'blue_green'
  canari?: { pct: number; seuil5xx: number; fenetreS: number }
}

export interface Component {
  id: string
  envId: string
  nom: string
  kind: 'vm' | 'k8s'
  role: 'web' | 'api' | 'db' | 'cache' | 'proxy' | 'worker' | 'cron' | 'observabilite'
  image: string
  version: string
  ressources: { cpu: number; ramMo: number; diskGo: number }
  ports: Array<{ interne: number; expose?: number; type: 'ClusterIP' | 'LoadBalancer' }>
  envVars: Array<{ cle: string; secret: boolean; scope: 'build' | 'runtime'; valeur?: string }>
  storage?: Array<{ chemin: string; tailleGo: number; classe: string }>
  emplacement: { vms?: string[]; namespace?: string; pods?: string[] }
  statut: 'deployed' | 'degraded' | 'stopped' | 'failed'
  dependances?: string[]
}

export interface Deployment {
  id: string
  envId: string
  envNom: string
  appId: string
  version: string
  commit?: string
  commitMessage?: string
  auteur: string
  statut:
    | 'queued'
    | 'building'
    | 'scanning'
    | 'provisioning'
    | 'deploying'
    | 'live'
    | 'failed'
    | 'rolled_back'
  etapes: Array<{
    nom: 'build' | 'scan' | 'provision' | 'deploy'
    statut: 'pending' | 'running' | 'ok' | 'failed'
    dureeS?: number
    logRef: string
    detail?: string
  }>
  findings: Array<{
    severite: 'eleve' | 'moyen' | 'faible'
    titre: string
    detail: string
    correctif?: { libelle: string; action: string }
  }>
  previewUrl?: string
  startedAt: string
  dureeS?: number
  branche?: string
  pr?: number
}

// ─── Projets applicatifs ──────────────────────────────────────────────

/**
 * Un projet regroupe les services qui forment un même système : l'application,
 * sa base, son cache, ses tâches de fond. Le regroupement est la seule façon de
 * répondre à « qu'est-ce qui casse si j'arrête ça ? » sans lire une liste plate.
 */
export interface Projet {
  id: string
  nom: string
  description: string
  espaceId: string
  cree: string
  /** Ventilation de la dépense et recherche — pas de rôle fonctionnel. */
  etiquettes: string[]
  /**
   * Le cluster Kubernetes qui héberge les services du projet — dédié
   * (provisionné avec le projet) ou partagé avec d'autres projets du même
   * Espace. Un projet ne consomme rien par lui-même : c'est ce cluster, et le
   * load balancer qui pointe dessus, qui sont facturés dès la création.
   */
  clusterId: string
  /** Un même projet se décline par environnement, chacun avec ses services. */
  environnements: string[]
  /**
   * Cible de calcul, fixée à la création (`k8s` par défaut) : servie par le
   * backend, pas encore affichée côté maquette.
   */
  cible?: 'vm' | 'k8s'
  /** Variables partagées par tous les services du projet, par environnement. */
  variables: Array<{
    cle: string
    valeur?: string
    secret: boolean
    portee: 'build' | 'runtime'
    environnements: string[]
  }>
}

export type TypeServiceProjet = 'application' | 'base' | 'statique' | 'cron' | 'worker'

export type MoteurBase = 'postgresql' | 'mysql' | 'mariadb' | 'mongodb' | 'redis' | 'clickhouse'

export interface ServiceProjet {
  id: string
  projetId: string
  nom: string
  /** Saisie à la création, à côté du nom — pas de rôle fonctionnel. */
  description?: string
  type: TypeServiceProjet
  environnement: string
  statut: 'running' | 'building' | 'stopped' | 'degraded' | 'failed'
  ressources: { cpu: number; ramMo: number; diskGo: number }
  /**
   * Emplacement réel d'exécution — rare chez les concurrents et volontairement
   * exposé ici (§5.4) : on ne demande pas au client de faire confiance à vide.
   */
  emplacement: { site: Site; backend: string; vms?: string[]; namespace?: string }
  derniereMaj: string
  coutMensuel: number

  /**
   * Modèle de la bibliothèque dont ce service est issu. Il apporte avec lui sa
   * configuration propre, ses versions qualifiées et son plan de sauvegarde :
   * un Odoo ne se règle pas comme un Zimbra.
   */
  modeleSlug?: string
  /** Sièges attribués, pour les modèles qui se comptent par utilisateur. */
  sieges?: { attribues: number; souscrits: number }

  /** Applications, sites statiques et workers : l'entrée qui porte les déploiements. */
  appId?: string
  source?: { type: 'git' | 'image'; ref: string; branche?: string }
  portConteneur?: number

  /** Base de données managée par la plateforme applicative. */
  moteur?: MoteurBase
  version?: string
  base?: {
    nom: string
    utilisateur: string
    motDePasse: string
    hoteInterne: string
    port: number
  }
  exposeExterne?: { actif: boolean; port?: number; sourcesAutorisees?: string[] }
  sauvegarde?: {
    plan: string
    cron: string
    destination: string
    dernier: string
    retentionJours: number
    taille: string
  }

  /** Tâche planifiée. */
  cron?: {
    expression: string
    lisible: string
    commande: string
    derniereExecution: string
    dureeS: number
    statut: 'ok' | 'echec'
    prochaine: string
  }

  /** Worker de file. */
  file?: {
    nom: string
    enAttente: number
    traitesJour: number
    echecsJour: number
    concurrence: number
  }
}

/**
 * Zone applicative offerte à l'organisation. Elle existe pour que la première
 * mise en ligne ne dépende pas d'un achat de domaine : on déploie, on obtient
 * une URL qui fonctionne, on branche son domaine plus tard.
 */
export interface ZoneApplicative {
  zone: string
  wildcard: string
  /** Adresses d'entrée à viser depuis un DNS externe, par site. */
  ingress: Array<{ site: Site; ip: string; ipv6: string }>
  certificat: { emetteur: string; renouvellementAuto: boolean; expire: string }
  quotaDomaines: { utilises: number; total: number }
}

export interface DomaineApplicatif {
  id: string
  hote: string
  origine: 'genere' | 'personnalise'
  serviceId: string
  chemin: string
  portConteneur: number
  https: boolean
  certificat: {
    etat: 'actif' | 'en_emission' | 'echec' | 'aucun'
    emetteur?: string
    expire?: string
  }
  /** Vérification DNS guidée : l'enregistrement exact à créer, et son état. */
  verification?: {
    etat: 'ok' | 'attente' | 'echec'
    enregistrement: { type: 'A' | 'CNAME'; nom: string; valeur: string }
    verifieLe?: string
    detail?: string
    correlationId?: string
  }
  redirections?: Array<{ de: string; vers: string; code: 301 | 302 }>
}

// ─── Marketplace ──────────────────────────────────────────────────────

export type CategorieService =
  | 'collaboration'
  | 'communication'
  | 'metier'
  | 'web'
  | 'donnees'
  | 'technique'

export const CATEGORIE_LABEL: Record<CategorieService, string> = {
  collaboration: 'Collaboration',
  communication: 'Communication',
  metier: 'Métier',
  web: 'Web & e-commerce',
  donnees: 'Données',
  technique: 'Outils techniques',
}

export interface CatalogService {
  slug: string
  nom: string
  solutionOSS: string
  categorie: CategorieService
  /**
   * Nom du pictogramme en pâte à modeler, dans `public/photos/pate-<icone>.webp`.
   * Il illustre *ce que le service fait* chez nous, pas la marque de la solution
   * amont : inventer un logo Nextcloud serait lui prêter une identité qui n'est
   * pas la nôtre. Les initiales et la teinte restent le repli.
   */
  icone: string
  /**
   * URL de logo servie par le backend — approche différente de `icone` (nom
   * de pictogramme local), pas encore réconciliée entre maquette et contrat.
   */
  logoUrl?: string
  /** Couleur d'accent du logo de la solution, pour la vignette. */
  logoTeinte: string
  logoInitiales: string
  description: string
  pitch: string
  modes: Array<'dedie' | 'mutualise'>
  paliers: Array<{
    code: string
    nom: string
    specs: string
    prixSiege?: number
    prixMois?: number
    limites: string[]
    recommande?: boolean
  }>
  sla: string
  backupPolicyDefault: string
  reversibilite: { formats: string[]; delaiJours: number; docUrl: string }
  migrationEntrante: string[]
  migrationDelais?: string
  versionsSupportees: string[]
  certifie: boolean
  /** Lien vers l'interface native de la solution — externe au portail. */
  urlDemo: string
  captures: string[]
  parametresSpecifiques: Array<{ titre: string; description: string }>
  granulariteRestauration: string[]
}

export interface ManagedService {
  id: string
  orgId: string
  catalogSlug: string
  nom: string
  mode: 'dedie' | 'mutualise'
  site: Site
  palier: string
  version: string
  versionDisponible?: string
  domaine: string
  urlNative: string
  statut:
    | 'provisioning'
    | 'operationnel'
    | 'degrade'
    | 'maintenance'
    | 'maj_disponible'
    | 'erreur'
  siegesSouscrits: number
  siegesUtilises: number
  sso: {
    actif: boolean
    clientId: string
    groupMappings: Array<{ groupe: string; roleApp: string }>
  }
  backupPlanId?: string
  derniereSauvegarde?: string
  uptime30j: number
  parametres: Record<string, unknown>
  coutMensuel: number
  createdAt: string
  certificat?: { expire: string; auto: boolean }
}

export interface Seat {
  id: string
  managedServiceId: string
  userId: string
  /** Utilisateur embarqué par le backend ; absent côté maquette. */
  utilisateur?: User
  statut: 'actif' | 'suspendu'
  quotaUtilise?: number
  quotaTotal?: number
  derniereActivite?: string
}

// ─── Web Cloud — hébergement mutualisé (§6.8) ─────────────────────────

/**
 * Un hébergement, c'est un domaine et un serveur, liés strictement.
 *
 * Le serveur porte Apache, PHP et un moteur de base : tout ce qui est installé
 * dessus partage la même machine, et c'est cette mise en commun qui rend
 * l'offre abordable. Plusieurs sites cohabitent, chacun sur son sous-domaine.
 * Le domaine peut n'être acheté que plus tard : l'hébergement démarre alors
 * sur un nom provisoire, pour que la mise en ligne ne dépende pas d'un achat.
 */
export interface WebHosting {
  id: string
  orgId: string
  /** `null` tant que le client n'a pas acheté ou transféré son nom. */
  domaine: string | null
  domaineProvisoire: string
  palier: string
  /** Un domaine est attaché à un serveur et à un seul. */
  serveur: {
    nom: string
    vcpu: number
    ramGo: number
    diskGo: number
    ip: string
    ipv6?: string
    site: Site
    os: string
    serveurWeb: string
    statut: 'en_ligne' | 'maintenance' | 'redemarrage'
    chargeCpuPct?: number
    ramUtiliseePct?: number
    uptimeJours?: number
  }
  php: {
    versionDefaut: string
    versionsDisponibles: string[]
    extensions: Array<{ nom: string; active: boolean; requisePar?: string }>
    limites: {
      memoryLimitMo: number
      uploadMaxMo: number
      maxExecutionS: number
      opcache: boolean
    }
  }
  /** Protocoles de transfert ouverts sur le serveur, activables séparément. */
  acces: { ftp: boolean; sftp: boolean; ftps: boolean; ssh: boolean; portSsh: number }
  espaceUtiliseGo: number
  espaceTotalGo: number
  sauvegarde: {
    frequence: 'quotidienne' | 'bihebdomadaire' | 'hebdomadaire'
    heure: string
    retentionJours: number
    destination: string
    immuable: boolean
    derniere?: string
    taille?: string
    statut: 'ok' | 'echec' | 'en_cours'
  }
  statut: 'en_ligne' | 'maintenance' | 'suspendu'
  cree: string
}

export type TypeSiteWeb = 'wordpress' | 'prestashop' | 'php' | 'statique' | 'laravel'

/** Un site installé sur un hébergement, servi par son propre sous-domaine. */
export interface SiteWeb {
  id: string
  hebergementId: string
  hote: string
  racine: string
  type: TypeSiteWeb
  version?: string
  phpVersion: string
  baseId?: string
  ssl: { etat: 'actif' | 'en_emission' | 'expire' | 'aucun'; emetteur?: string; expire?: string }
  espaceMo: number
  visitesMois: number
  preproduction?: { actif: boolean; hote: string; derniereSync?: string }
  majEnAttente?: number
  securite: { waf: boolean; bruteForce: boolean; scanMalware: boolean }
  statut: 'en_ligne' | 'maintenance' | 'suspendu' | 'installation'
}

/** Base hébergée sur le serveur de l'hébergement, pas sur une offre managée. */
export interface BaseHebergement {
  id: string
  hebergementId: string
  nom: string
  moteur: 'mariadb' | 'postgresql'
  version: string
  tailleMo: number
  jeuCaracteres: string
  utilisateurs: Array<{ nom: string; droits: 'tous' | 'lecture' | 'lecture_ecriture'; hote: string }>
  siteId?: string
}

export interface CompteFichiers {
  id: string
  hebergementId: string
  utilisateur: string
  protocoles: Array<'ftp' | 'sftp' | 'ftps'>
  racine: string
  quotaGo: number | null
  utiliseGo: number
  clesSsh: number
  derniereConnexion?: string
  statut: 'actif' | 'suspendu'
}

export interface TachePlanifieeWeb {
  id: string
  hebergementId: string
  libelle: string
  expression: string
  lisible: string
  commande: string
  siteId?: string
  derniereExecution?: string
  dureeS?: number
  statut: 'ok' | 'echec'
  prochaine: string
  actif: boolean
}

/**
 * Service partagé rattaché au domaine de l'hébergement — messagerie, drive.
 *
 * « Partagé » a un sens précis ici : l'instance est mutualisée entre plusieurs
 * clients et le service est fixé au domaine, pas à un projet. On le configure
 * depuis la fiche de l'hébergement ; on l'utilise dans son interface d'origine.
 */
export interface ServicePartage {
  id: string
  hebergementId: string
  /** Slug du catalogue : donne accès au fichier de configuration du service. */
  slug: string
  nom: string
  solution: string
  hote: string
  usage: { libelle: string; utilise: number; total: number; unite: string }
  version: string
  sante: 'ok' | 'degrade' | 'maintenance' | 'maj_disponible'
  derniereSauvegarde: string
  urlOuverture: string
  actif: boolean
}

export interface DnsZone {
  id: string
  orgId: string
  domaine: string
  dnssec: boolean
  ns: string[]
  enregistrements: Array<{
    id: string
    type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA' | 'NS'
    nom: string
    valeur: string
    ttl: number
    priorite?: number
  }>
}

export interface Domaine {
  id: string
  orgId: string
  nom: string
  extension: string
  expiration: string
  renouvellementAuto: boolean
  whoisProtege: boolean
  verrouTransfert: boolean
  zoneId?: string
  /** Serveur attaché — un domaine est attaché à un serveur et à un seul. */
  hebergementId?: string
}

// ─── Commerce & exploitation ──────────────────────────────────────────

export interface Offer {
  id: string
  code: string
  nom: string
  categorie: 'espace_cloud' | 'image_vm' | 'k8s' | 'stack' | 'web'
  specs: string
  caracteristiques: string[]
  /**
   * Un prix, un seul, celui de la vitrine. Il n'y a pas de grille d'achat
   * partenaire parce qu'il n'y a pas de partenaire : ce que le client voit
   * publié est ce qu'il paie.
   */
  prix: number
  populaire?: boolean
  statut: 'brouillon' | 'publiee' | 'depreciee'
  souscriptionsActives: number
  sla?: string
  surDevis?: boolean
}

export interface Subscription {
  id: string
  orgId: string
  cible: { type: 'offer' | 'service'; ref: string; label: string }
  quantite: number
  prixApplique: number
  debut: string
  fin?: string
  periodicite: 'mensuelle' | 'annuelle'
}

export interface Invoice {
  id: string
  orgId: string
  numero: string
  periode: string
  lignes: Array<{ libelle: string; ref: string; quantite: number; pu: number; total: number }>
  sousTotal: number
  tvaPct: number
  total: number
  devise: Devise
  statut: 'brouillon' | 'emise' | 'payee' | 'impayee' | 'annulee'
  moyen?: MoyenPaiement
  pdfUrl: string
  echeance?: string
}

export type Devise = 'XOF' | 'EUR' | 'USD'

export type MoyenPaiement =
  | 'carte'
  | 'virement'
  | 'orange_money'
  | 'mtn_momo'
  | 'wave'
  | 'prepaye'

export const MOYEN_LABEL: Record<MoyenPaiement, string> = {
  carte: 'Carte bancaire',
  virement: 'Virement bancaire',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  wave: 'Wave',
  prepaye: 'Porte-monnaie prépayé',
}

export interface Devis {
  id: string
  orgId: string
  numero: string
  objet: string
  montant: number
  validite: string
  statut: 'envoye' | 'accepte' | 'refuse' | 'expire'
  createdAt: string
  /** Servi par le backend une fois le devis édité ; absent côté maquette. */
  pdfUrl?: string
}

export interface Ticket {
  id: string
  orgId: string
  numero: string
  sujet: string
  gravite: 'critique' | 'majeure' | 'mineure' | 'question'
  statut: 'ouvert' | 'en_cours' | 'attente_client' | 'resolu' | 'ferme'
  slaCible: { premiereReponseMin: number; resolutionMin: number }
  slaRestantMin?: number
  ressourcesLiees: string[]
  service?: string
  assigneA?: string
  createdAt: string
  messages: Array<{
    auteur: string
    role: 'client' | 'synelia'
    date: string
    contenu: string
    pieces?: string[]
  }>
}

export interface AuditEvent {
  id: string
  ts: string
  orgId?: string
  orgNom?: string
  actor: { id: string; nom: string; email: string; type: 'user' | 'systeme' | 'api' }
  role: Role
  scope: {
    type: 'plateforme' | 'org' | 'espace' | 'application' | 'service'
    id?: string
    label: string
  }
  action: string
  target: string
  result: 'ok' | 'refuse' | 'erreur'
  detail?: string
  ip?: string
}

export interface ProvisioningJob {
  id: string
  orgId: string
  type: string
  label: string
  statut: 'queued' | 'running' | 'done' | 'failed' | 'rolled_back'
  taches: Array<{
    ordre: number
    nom: string
    statut: 'pending' | 'running' | 'ok' | 'failed'
    dureeS?: number
    message?: string
  }>
  erreur?: { message: string; correlationId: string; suggestion?: string }
  startedAt: string
  dureeS?: number
}

/**
 * Définition d'une opération longue. Le texte des étapes appartient au
 * catalogue (`src/lib/mock/workflows.ts`), pas au site d'appel : deux écrans
 * qui lancent la même opération doivent raconter la même chose, et les durées
 * annoncées doivent être plausibles plutôt qu'égales à la cadence d'écran.
 */
export interface DefinitionWorkflow {
  id: string
  /** Libellé du job. `{cible}` est remplacé par la ressource concernée. */
  libelle: string
  portee: 'client' | 'fournisseur'
  /** Ce qui est déjà engagé au lancement — dit dans la notification de départ. */
  lancement: string
  /** Ce qui est acquis à la fin. */
  fin: string
  etapes: Array<{ nom: string; dureeS: number; message?: string }>
  /**
   * Échec écrit, joué au premier essai seulement : la reprise aboutit. Sans
   * cela, aucune opération lancée depuis un écran ne montrerait jamais le
   * diagnostic ni le rollback — ces états n'existeraient que dans les données
   * figées du jeu de démonstration.
   */
  echec?: { etape: number; message: string; suggestion: string; rollback: boolean }
  /** Où mène la ressource produite, quand elle a une page. */
  href?: string
}

// ─── Observabilité (formats encadrés §0.3) ────────────────────────────

export interface EvenementSupervision {
  id: string
  ts: string
  gravite: 'critique' | 'majeure' | 'mineure' | 'info'
  ressource: string
  message: string
  site?: Site
}

export interface LigneLog {
  ts: string
  niveau: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  source: string
  message: string
}

export interface AlerteRegle {
  id: string
  cible: string
  metrique: string
  seuil: string
  canaux: Array<'email' | 'sms' | 'whatsapp' | 'webhook'>
  plage: string
  escalade?: string
  actif: boolean
}

// ─── Statut de plateforme (vitrine) ───────────────────────────────────

export interface StatutService {
  nom: string
  categorie: string
  etats: Record<Site, 'operationnel' | 'degrade' | 'panne' | 'maintenance'>
  uptime90j: number
}

export interface Incident {
  id: string
  titre: string
  gravite: 'majeur' | 'mineur' | 'maintenance'
  statut: 'en_cours' | 'surveille' | 'resolu'
  debut: string
  fin?: string
  services: string[]
  sites: Site[]
  mises_a_jour: Array<{ ts: string; texte: string }>
}

// ─── Intelligence artificielle — passerelle et modèles ────────────────

/**
 * Où le calcul a réellement lieu. C'est la propriété structurante de l'offre :
 * un modèle « souverain » tourne sur nos GPU, à Abidjan ou à Grand-Bassam, et
 * la requête ne quitte jamais le territoire ; un modèle « externe » est appelé
 * chez son éditeur, et cela se dit.
 */
export type HebergementModele = 'souverain' | 'externe'

export type FamilleModele =
  | 'texte'
  | 'code'
  | 'embedding'
  | 'reranker'
  | 'vision'
  | 'transcription'

export const FAMILLE_MODELE_LABEL: Record<FamilleModele, string> = {
  texte: 'Génération de texte',
  code: 'Assistance au code',
  embedding: 'Vectorisation',
  reranker: 'Reclassement',
  vision: 'Analyse d’image',
  transcription: 'Transcription audio',
}

/** Classes de données du client, du plus ouvert au plus contraint. */
export type ClasseDonnees = 'publique' | 'interne' | 'personnelle' | 'reglementee'

export const CLASSE_DONNEES_LABEL: Record<ClasseDonnees, string> = {
  publique: 'Publique',
  interne: 'Interne',
  personnelle: 'À caractère personnel',
  reglementee: 'Réglementée',
}

export interface ModeleIA {
  id: string
  /** Identifiant appelé dans l'API, sans espace ni accent. */
  slug: string
  nom: string
  editeur: string
  famille: FamilleModele
  hebergement: HebergementModele
  /** Site physique pour un modèle souverain, juridiction pour un modèle externe. */
  residence: string
  site?: Site
  parametres?: string
  licence: string
  contexteJetons: number
  /** Prix pour un million de jetons, en FCFA. */
  prixEntree: number
  prixSortie: number
  /** Certains modèles se facturent à la minute d'audio, pas au jeton. */
  unite: 'jeton' | 'minute'
  latenceP50Ms: number
  debitJetonsSec: number
  statut: 'disponible' | 'apercu' | 'degrade' | 'retire'
  /** Version successeur annoncée, pour les modèles en fin de vie. */
  remplacePar?: string
  finDeVie?: string
  usages: string[]
  description: string
  /**
   * Réellement appelable sur la route chat de la passerelle (`/ia/agents/{id}/invoquer`) —
   * porté par le backend, absent de la maquette : `undefined` en mode maquette, où
   * seuls des modèles de génération de texte figurent de toute façon.
   */
  invocable?: boolean
}

export interface CleIA {
  id: string
  nom: string
  prefixe: string
  espaceId: string
  /** Application ou équipe qui porte la clé — sert au showback. */
  usage: string
  modelesAutorises: string[] | 'tous'
  quotaJetonsMois: number
  jetonsConsommes: number
  debitMaxParMinute: number
  budgetMensuel: number
  budgetConsomme: number
  /** Comportement au dépassement : couper, ou laisser passer en alertant. */
  auDepassement: 'bloquer' | 'alerter'
  residenceMax: ClasseDonnees
  statut: 'active' | 'suspendue' | 'revoquee'
  creeeLe: string
  creeePar: string
  derniereUtilisation?: string
}

export interface RegleRoutage {
  id: string
  ordre: number
  nom: string
  /** Condition lisible : clé, famille de modèle demandée, classe de données. */
  quand: string
  cible: string
  repli: string[]
  /** Une règle peut interdire toute sortie du territoire, quoi qu'il arrive. */
  residenceImposee: boolean
  actif: boolean
  requetes24h: number
  replisDeclenches24h: number
}

export interface GardeFou {
  id: string
  nom: string
  type: 'pii' | 'secret' | 'injection' | 'toxicite' | 'sujet'
  sens: 'entree' | 'sortie' | 'les_deux'
  action: 'bloquer' | 'masquer' | 'journaliser'
  actif: boolean
  declenchements24h: number
  description: string
}

export interface BaseConnaissance {
  id: string
  nom: string
  espaceId: string
  /** D'où viennent les documents — nous ne les hébergeons pas en double. */
  source: { type: 's3' | 'drive' | 'web' | 'git'; libelle: string }
  documents: number
  fragments: number
  modeleEmbedding: string
  dimension: number
  /** Comment le document est découpé — le choix se fige à la création. */
  modeDecoupage: 'general' | 'parent_enfant' | 'qr'
  /** Index vectoriel, ou index par mots-clés sans coût de vectorisation. */
  methodeIndex: 'haute_qualite' | 'economique'
  modeRecherche: 'vectorielle' | 'plein_texte' | 'hybride'
  /** Renvoyer le document d'origine avec chaque fragment cité. */
  citations: boolean
  tailleMo: number
  frequence: 'manuelle' | 'quotidienne' | 'horaire'
  derniereIndexation: string
  statut: 'a_jour' | 'indexation' | 'erreur' | 'jamais_indexee'
  clesAutorisees: string[]
  erreur?: string
}

// ─── Agents et orchestration (CDC MIA, FONC-01 à FONC-06) ─────────────

/**
 * Quatre natures d'agent, parce qu'elles n'ont ni les mêmes réglages ni les
 * mêmes garde-fous : un agent conversationnel garde un fil et parle à un
 * humain, un extracteur rend du JSON et n'a rien à dire.
 */
export type TypeAgent = 'conversationnel' | 'tache' | 'flux' | 'extraction'

export const TYPE_AGENT_LABEL: Record<TypeAgent, string> = {
  conversationnel: 'Conversationnel',
  tache: 'Agent de tâche',
  flux: 'Flux déterministe',
  extraction: 'Extracteur',
}

/** Variable injectable dans la consigne, façon `{{nom_client}}` (FONC-01.4). */
export interface VariableAgent {
  cle: string
  libelle: string
  type: 'texte' | 'nombre' | 'date' | 'liste'
  /** D'où vient la valeur : l'appelant la fournit, ou la passerelle la calcule. */
  source: 'appelant' | 'systeme' | 'annuaire'
  obligatoire: boolean
  exemple: string
}

/** Une version d'agent, conservée pour le retour arrière (FONC-01.5). */
export interface VersionAgent {
  numero: string
  date: string
  auteur: string
  note: string
  statut: 'publiee' | 'archivee' | 'brouillon'
}

export interface AgentIA {
  id: string
  slug: string
  nom: string
  /** Le backend réel ne porte que dix champs — celui-ci en fait partie mais
   * n'existe pas côté maquette : la démonstration a une date de création
   * implicite (la graine), pas un horodatage. */
  createdAt?: string
  /** Deux lettres et une teinte tiennent lieu d'icône — pas de téléversement. */
  initiales: string
  teinte: string
  role: string
  description: string
  type: TypeAgent
  espaceId: string
  statut: 'brouillon' | 'publie' | 'suspendu'
  modele: string
  temperature: number
  topP: number
  jetonsMax: number
  /** Appel de fonction natif, ou boucle ReAct pensée → action → observation. */
  strategie: 'function_calling' | 'react'
  /** Garde-fou contre la boucle infinie d'un agent outillé. */
  maxIterations: number
  /** Schéma imposé à la sortie, quand le résultat est relu par du code. */
  sortieStructuree?: string
  /** Un agent publié peut être exposé comme outil MCP à d'autres systèmes. */
  publieMcp: boolean
  consigne: string
  variables: VariableAgent[]
  outils: string[]
  connaissances: string[]
  memoire: {
    portee: 'aucune' | 'session' | 'longue'
    dureeJours: number
    /** Agents avec qui l'espace de contexte est partagé (FONC-02.6). */
    partageeAvec: string[]
  }
  /** Reprise automatique sur échec d'outil ou de modèle (FONC-02.7). */
  reprise: { tentatives: number; delaiS: number }
  humainDansLaBoucle: boolean
  classeDonnees: ClasseDonnees
  budgetJour: number
  canaux: string[]
  versions: VersionAgent[]
  metriques: {
    conversations7j: number
    tauxResolutionPct: number
    satisfactionPct: number
    latenceP50Ms: number
    coutJour: number
    appelsOutils24h: number
    tauxEchecOutilPct: number
  }
  /** Jeu d'épreuves rejoué avant chaque publication. */
  epreuves: { cas: number; reussis: number; dernierPassage: string }
  annotations: number
}

/** Outil appelable par un agent (FONC-01.7). */
export type CategorieOutil = 'integre' | 'interne' | 'openapi' | 'mcp'

export const CATEGORIE_OUTIL_LABEL: Record<CategorieOutil, string> = {
  integre: 'Fourni par la plateforme',
  interne: 'API interne de l’organisation',
  openapi: 'Importé depuis un schéma OpenAPI',
  mcp: 'Serveur MCP',
}

export interface OutilAgent {
  id: string
  nom: string
  categorie: CategorieOutil
  fournisseur: string
  description: string
  /** Un outil qui écrit ne se traite pas comme un outil qui lit. */
  effet: 'lecture' | 'ecriture'
  confirmationRequise: boolean
  signature: string
  authentification: string
  appels24h: number
  tauxErreurPct: number
  latenceP50Ms: number
  statut: 'actif' | 'inactif' | 'erreur'
  note?: string
}

/** Canal par lequel un utilisateur atteint un agent (FONC-06). */
export type TypeCanal =
  | 'widget'
  | 'whatsapp'
  | 'telegram'
  | 'sms'
  | 'voix'
  | 'ivr'
  | 'rest'
  | 'websocket'

export const TYPE_CANAL_LABEL: Record<TypeCanal, string> = {
  widget: 'Widget web',
  whatsapp: 'WhatsApp Business',
  telegram: 'Telegram',
  sms: 'SMS bidirectionnel',
  voix: 'Voix — transcription et synthèse',
  ivr: 'Serveur vocal interactif',
  rest: 'API REST synchrone',
  websocket: 'WebSocket',
}

export interface CanalAgent {
  id: string
  type: TypeCanal
  nom: string
  fournisseur: string
  identifiant: string
  etat: 'connecte' | 'a_configurer' | 'erreur' | 'indisponible'
  messages24h: number
  latenceMs: number
  /** Le routeur omnicanal recolle les fils d'un même numéro (FONC-06.9). */
  contexteOmnicanal: boolean
  agents: string[]
  note: string
}

/**
 * Étape d'un flux (FONC-02).
 *
 * Le flux est un arbre, pas un plan libre : une étape en suit une autre, un
 * routeur ouvre des branches, une boucle rejoue un corps. La disposition se
 * calcule au rendu — elle n'est pas une donnée. C'est ce qui permet d'insérer
 * une étape entre deux autres sans rien déplacer à la main.
 */
export type TypeEtape =
  | 'declencheur'
  | 'agent'
  | 'outil'
  | 'connaissance'
  | 'routeur'
  | 'boucle'
  | 'humain'
  | 'code'
  | 'reponse'
  /** Masquage réversible des données personnelles, en coupure. */
  | 'anonymisation'
  /** Portée documentaire dérivée de l'utilisateur final, jamais de l'agent. */
  | 'habilitation'
  | 'transfert'

export const TYPE_ETAPE_LABEL: Record<TypeEtape, string> = {
  declencheur: 'Déclencheur',
  agent: 'Agent',
  outil: 'Outil',
  connaissance: 'Recherche',
  routeur: 'Aiguillage',
  boucle: 'Boucle',
  humain: 'Validation humaine',
  code: 'Code',
  reponse: 'Réponse',
  anonymisation: 'Anonymisation',
  habilitation: 'Habilitation',
  transfert: 'Transfert',
}

export interface BrancheFlux {
  id: string
  nom: string
  condition: string
  partPct: number
  /** La branche de repli reçoit ce qu'aucune condition n'a retenu. */
  parDefaut?: boolean
  etapes: EtapeFlux[]
}

export interface EtapeFlux {
  id: string
  type: TypeEtape
  nom: string
  /** D'où vient l'étape : un agent, un outil, un serveur MCP, la plateforme. */
  source: string
  detail: string
  agentId?: string
  outilId?: string
  /**
   * Connaissance : quelle base interroger. Ajouté pour que l'exécution réelle sache où
   * chercher — les champs `source`/`detail` restent du texte descriptif, pas un identifiant.
   */
  connaissanceId?: string
  /** Étape conditionnelle : sautée quand la condition n'est pas remplie. */
  condition?: string
  /**
   * Étape posée par la plateforme, ni déplaçable ni supprimable. Deux étapes le
   * sont toujours : l'anonymisation et le filtrage par habilitation. Les rendre
   * facultatives reviendrait à faire dépendre l'étanchéité d'un réglage.
   */
  verrouillee?: boolean
  executions24h: number
  latenceMs: number
  coutPourMille: number
  tauxErreurPct: number
  reprise?: { tentatives: number; delaiS: number }
  /** Routeur : une branche par sortie. */
  branches?: BrancheFlux[]
  /** Premier match seulement, ou toutes les branches vraies en parallèle. */
  modeRoutage?: 'premiere' | 'toutes'
  /** Boucle : les étapes rejouées pour chaque élément. */
  corps?: EtapeFlux[]
  surItems?: string
  maxIterations?: number
}

export interface VariableFlux {
  cle: string
  portee: 'environnement' | 'conversation' | 'systeme'
  valeur: string
  secret?: boolean
  description: string
}

export interface FluxOrchestration {
  id: string
  nom: string
  description: string
  espaceId: string
  statut: 'publie' | 'brouillon' | 'suspendu'
  declencheur: {
    type: 'message' | 'planifie' | 'webhook' | 'fichier' | 'evenement'
    libelle: string
    detail: string
  }
  etapes: EtapeFlux[]
  variables: VariableFlux[]
  executions7j: number
  dureeMedianeS: number
  tauxSuccesPct: number
  coutParExecution: number
  memoirePartagee: boolean
  version: string
}
