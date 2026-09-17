/**
 * Données de démonstration — hébergement mutualisé (§6.8).
 *
 * Le jeu illustre la règle du produit : un domaine, un serveur, et sur ce
 * serveur autant de sites que le client veut, chacun sur son sous-domaine.
 * Les services partagés — messagerie, drive — sont rattachés au domaine et pas
 * au site : c'est ce qui les distingue des applications dédiées d'un projet.
 * Toutes les valeurs sont fictives.
 */

import type {
  BaseHebergement,
  CompteFichiers,
  DnsZone,
  Domaine,
  ServicePartage,
  SiteWeb,
  TachePlanifieeWeb,
  WebHosting,
} from '../types'
import { MAINTENANT } from '../format'
import { ORG_COURANTE } from './orgs'
import { DOMAINES, ZONES_DNS } from './web'

const EXTENSIONS_PHP = [
  { nom: 'mysqli', active: true, requisePar: 'WordPress, PrestaShop' },
  { nom: 'pdo_pgsql', active: true, requisePar: 'Documentation interne' },
  { nom: 'gd', active: true, requisePar: 'Traitement des images' },
  { nom: 'imagick', active: true, requisePar: 'PrestaShop' },
  { nom: 'intl', active: true, requisePar: 'PrestaShop' },
  { nom: 'zip', active: true },
  { nom: 'curl', active: true },
  { nom: 'mbstring', active: true },
  { nom: 'opcache', active: true },
  { nom: 'redis', active: true, requisePar: 'Cache objet WordPress' },
  { nom: 'soap', active: false },
  { nom: 'xdebug', active: false, requisePar: 'Débogage — à n’activer qu’en préproduction' },
]

export const HEBERGEMENTS: WebHosting[] = [
  {
    id: 'heb-dba',
    orgId: 'org-dba',
    domaine: 'dba.africa',
    domaineProvisoire: 'dba-01.heberge.synelia.cloud',
    palier: 'Agence',
    serveur: {
      nom: 'web-dba-01',
      vcpu: 4,
      ramGo: 8,
      diskGo: 200,
      ip: '102.176.20.44',
      ipv6: '2c0f:f0e0:20::2c',
      site: 'ABJ',
      os: 'Debian 12',
      serveurWeb: 'Apache 2.4.62',
      statut: 'en_ligne',
      chargeCpuPct: 34,
      ramUtiliseePct: 61,
      uptimeJours: 214,
    },
    php: {
      versionDefaut: '8.3',
      versionsDisponibles: ['8.1', '8.2', '8.3', '8.4'],
      extensions: EXTENSIONS_PHP,
      limites: { memoryLimitMo: 512, uploadMaxMo: 128, maxExecutionS: 120, opcache: true },
    },
    acces: { ftp: false, sftp: true, ftps: true, ssh: true, portSsh: 2222 },
    espaceUtiliseGo: 86.4,
    espaceTotalGo: 200,
    sauvegarde: {
      frequence: 'quotidienne',
      heure: '02:30',
      retentionJours: 30,
      destination: 'Bucket immuable — Grand-Bassam',
      immuable: true,
      derniere: '2026-08-19T02:34:00Z',
      taille: '31,8 Go',
      statut: 'ok',
    },
    statut: 'en_ligne',
    cree: '2024-11-08',
  },
  {
    id: 'heb-cofina',
    orgId: 'org-cofina',
    domaine: 'cofina.digital',
    domaineProvisoire: 'cofina-01.heberge.synelia.cloud',
    palier: 'Pro',
    serveur: {
      nom: 'web-cofina-01',
      vcpu: 2,
      ramGo: 4,
      diskGo: 80,
      ip: '102.176.20.61',
      ipv6: '2c0f:f0e0:20::3d',
      site: 'ABJ',
      os: 'Debian 12',
      serveurWeb: 'Apache 2.4.62',
      statut: 'en_ligne',
      chargeCpuPct: 18,
      ramUtiliseePct: 42,
      uptimeJours: 96,
    },
    php: {
      versionDefaut: '8.2',
      versionsDisponibles: ['8.1', '8.2', '8.3', '8.4'],
      extensions: EXTENSIONS_PHP.map((e) => (e.nom === 'imagick' ? { ...e, active: false } : e)),
      limites: { memoryLimitMo: 256, uploadMaxMo: 64, maxExecutionS: 60, opcache: true },
    },
    acces: { ftp: false, sftp: true, ftps: false, ssh: false, portSsh: 2222 },
    espaceUtiliseGo: 21.7,
    espaceTotalGo: 80,
    sauvegarde: {
      frequence: 'quotidienne',
      heure: '03:10',
      retentionJours: 14,
      destination: 'Bucket immuable — Grand-Bassam',
      immuable: true,
      derniere: '2026-08-19T03:12:00Z',
      taille: '8,4 Go',
      statut: 'ok',
    },
    statut: 'en_ligne',
    cree: '2025-05-20',
  },
  {
    id: 'heb-amuga',
    orgId: 'org-amuga',
    // Cas volontaire : l'hébergement tourne avant l'achat du nom de domaine.
    domaine: null,
    domaineProvisoire: 'amuga-01.heberge.synelia.cloud',
    palier: 'Démarrage',
    serveur: {
      nom: 'web-amuga-01',
      vcpu: 2,
      ramGo: 4,
      diskGo: 40,
      ip: '102.176.21.12',
      ipv6: '2c0f:f0e0:21::0c',
      site: 'GBM',
      os: 'Debian 12',
      serveurWeb: 'Apache 2.4.62',
      statut: 'en_ligne',
      chargeCpuPct: 6,
      ramUtiliseePct: 23,
      uptimeJours: 11,
    },
    php: {
      versionDefaut: '8.3',
      versionsDisponibles: ['8.1', '8.2', '8.3', '8.4'],
      extensions: EXTENSIONS_PHP,
      limites: { memoryLimitMo: 256, uploadMaxMo: 64, maxExecutionS: 60, opcache: true },
    },
    acces: { ftp: false, sftp: true, ftps: false, ssh: false, portSsh: 2222 },
    espaceUtiliseGo: 1.9,
    espaceTotalGo: 40,
    sauvegarde: {
      frequence: 'quotidienne',
      heure: '04:00',
      retentionJours: 14,
      destination: 'Bucket immuable — Abidjan',
      immuable: true,
      derniere: '2026-08-19T04:02:00Z',
      taille: '740 Mo',
      statut: 'ok',
    },
    statut: 'en_ligne',
    cree: '2026-08-08',
  },
  {
    id: 'heb-dba-labo',
    orgId: 'org-dba',
    // Deuxième hébergement de l'organisation courante, encore sans nom acheté :
    // le sélecteur doit savoir présenter une entrée qui n'a pas de domaine.
    domaine: null,
    domaineProvisoire: 'dba-labo.heberge.synelia.cloud',
    palier: 'Démarrage',
    serveur: {
      nom: 'web-dba-04',
      vcpu: 2,
      ramGo: 4,
      diskGo: 40,
      ip: '102.176.21.34',
      ipv6: '2c0f:f0e0:21::22',
      site: 'GBM',
      os: 'Debian 12',
      serveurWeb: 'Apache 2.4.62',
      statut: 'en_ligne',
      chargeCpuPct: 4,
      ramUtiliseePct: 19,
      uptimeJours: 6,
    },
    php: {
      versionDefaut: '8.4',
      versionsDisponibles: ['8.1', '8.2', '8.3', '8.4'],
      extensions: EXTENSIONS_PHP,
      limites: { memoryLimitMo: 256, uploadMaxMo: 64, maxExecutionS: 60, opcache: true },
    },
    acces: { ftp: false, sftp: true, ftps: false, ssh: true, portSsh: 2222 },
    espaceUtiliseGo: 0.8,
    espaceTotalGo: 40,
    sauvegarde: {
      frequence: 'quotidienne',
      heure: '04:30',
      retentionJours: 14,
      destination: 'Bucket immuable — Grand-Bassam',
      immuable: true,
      derniere: '2026-08-19T04:31:00Z',
      taille: '310 Mo',
      statut: 'ok',
    },
    statut: 'en_ligne',
    cree: '2026-08-13',
  },
]

export const SITES_WEB: SiteWeb[] = [
  {
    id: 'site-labo',
    hebergementId: 'heb-dba-labo',
    hote: 'dba-labo.heberge.synelia.cloud',
    racine: '/var/www/labo',
    type: 'php',
    phpVersion: '8.4',
    ssl: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-11-11' },
    espaceMo: 760,
    visitesMois: 210,
    securite: { waf: true, bruteForce: true, scanMalware: false },
    statut: 'en_ligne',
  },
  {
    id: 'site-www',
    hebergementId: 'heb-dba',
    hote: 'www.dba.africa',
    racine: '/var/www/www',
    type: 'wordpress',
    version: '6.7.1',
    phpVersion: '8.3',
    baseId: 'bh-wp',
    ssl: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-28' },
    espaceMo: 4820,
    visitesMois: 38400,
    preproduction: { actif: true, hote: 'staging-www.dba.africa', derniereSync: '2026-08-14' },
    majEnAttente: 3,
    securite: { waf: true, bruteForce: true, scanMalware: true },
    statut: 'en_ligne',
  },
  {
    id: 'site-boutique',
    hebergementId: 'heb-dba',
    hote: 'boutique.dba.africa',
    racine: '/var/www/boutique',
    type: 'prestashop',
    version: '8.1.7',
    phpVersion: '8.2',
    baseId: 'bh-ps',
    ssl: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-11-02' },
    espaceMo: 18640,
    visitesMois: 21900,
    preproduction: { actif: true, hote: 'staging-boutique.dba.africa', derniereSync: '2026-08-18' },
    majEnAttente: 1,
    securite: { waf: true, bruteForce: true, scanMalware: true },
    statut: 'en_ligne',
  },
  {
    id: 'site-blog',
    hebergementId: 'heb-dba',
    hote: 'blog.dba.africa',
    racine: '/var/www/blog',
    type: 'wordpress',
    version: '6.7.1',
    phpVersion: '8.3',
    baseId: 'bh-blog',
    ssl: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-28' },
    espaceMo: 2110,
    visitesMois: 9600,
    preproduction: { actif: false, hote: 'staging-blog.dba.africa' },
    securite: { waf: true, bruteForce: true, scanMalware: true },
    statut: 'en_ligne',
  },
  {
    id: 'site-docs',
    hebergementId: 'heb-dba',
    hote: 'docs.dba.africa',
    racine: '/var/www/docs',
    type: 'statique',
    phpVersion: '—',
    ssl: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-28' },
    espaceMo: 184,
    visitesMois: 2400,
    securite: { waf: true, bruteForce: false, scanMalware: false },
    statut: 'en_ligne',
  },
  {
    id: 'site-recrute',
    hebergementId: 'heb-dba',
    hote: 'recrute.dba.africa',
    racine: '/var/www/recrute',
    type: 'php',
    version: 'Laravel 11',
    phpVersion: '8.3',
    baseId: 'bh-recrute',
    ssl: { etat: 'en_emission' },
    espaceMo: 640,
    visitesMois: 780,
    securite: { waf: true, bruteForce: true, scanMalware: false },
    statut: 'en_ligne',
  },
  {
    id: 'site-cofina',
    hebergementId: 'heb-cofina',
    hote: 'www.cofina.digital',
    racine: '/var/www/www',
    type: 'wordpress',
    version: '6.6.2',
    phpVersion: '8.2',
    baseId: 'bh-cofina',
    ssl: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-09-30' },
    espaceMo: 3240,
    visitesMois: 14200,
    majEnAttente: 7,
    securite: { waf: true, bruteForce: true, scanMalware: true },
    statut: 'en_ligne',
  },
  {
    id: 'site-amuga',
    hebergementId: 'heb-amuga',
    hote: 'amuga-01.heberge.synelia.cloud',
    racine: '/var/www/www',
    type: 'wordpress',
    version: '6.7.1',
    phpVersion: '8.3',
    baseId: 'bh-amuga',
    ssl: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-11-06' },
    espaceMo: 920,
    visitesMois: 140,
    securite: { waf: true, bruteForce: true, scanMalware: true },
    statut: 'installation',
  },
]

export const BASES_HEBERGEMENT: BaseHebergement[] = [
  {
    id: 'bh-wp',
    hebergementId: 'heb-dba',
    nom: 'dba_wp_prod',
    moteur: 'mariadb',
    version: '11.4',
    tailleMo: 412,
    jeuCaracteres: 'utf8mb4_unicode_ci',
    siteId: 'site-www',
    utilisateurs: [
      { nom: 'dba_wp', droits: 'tous', hote: 'localhost' },
      { nom: 'dba_wp_ro', droits: 'lecture', hote: 'localhost' },
    ],
  },
  {
    id: 'bh-ps',
    hebergementId: 'heb-dba',
    nom: 'dba_presta_prod',
    moteur: 'mariadb',
    version: '11.4',
    tailleMo: 2840,
    jeuCaracteres: 'utf8mb4_unicode_ci',
    siteId: 'site-boutique',
    utilisateurs: [{ nom: 'dba_ps', droits: 'tous', hote: 'localhost' }],
  },
  {
    id: 'bh-blog',
    hebergementId: 'heb-dba',
    nom: 'dba_blog',
    moteur: 'mariadb',
    version: '11.4',
    tailleMo: 96,
    jeuCaracteres: 'utf8mb4_unicode_ci',
    siteId: 'site-blog',
    utilisateurs: [{ nom: 'dba_blog', droits: 'tous', hote: 'localhost' }],
  },
  {
    id: 'bh-recrute',
    hebergementId: 'heb-dba',
    nom: 'dba_recrutement',
    moteur: 'postgresql',
    version: '16.4',
    tailleMo: 58,
    jeuCaracteres: 'UTF8',
    siteId: 'site-recrute',
    utilisateurs: [
      { nom: 'dba_recrute', droits: 'tous', hote: '127.0.0.1' },
      { nom: 'dba_bi', droits: 'lecture', hote: '10.0.1.0/24' },
    ],
  },
  {
    id: 'bh-cofina',
    hebergementId: 'heb-cofina',
    nom: 'cofina_wp',
    moteur: 'mariadb',
    version: '11.4',
    tailleMo: 268,
    jeuCaracteres: 'utf8mb4_unicode_ci',
    siteId: 'site-cofina',
    utilisateurs: [{ nom: 'cofina_wp', droits: 'tous', hote: 'localhost' }],
  },
  {
    id: 'bh-amuga',
    hebergementId: 'heb-amuga',
    nom: 'amuga_wp',
    moteur: 'mariadb',
    version: '11.4',
    tailleMo: 42,
    jeuCaracteres: 'utf8mb4_unicode_ci',
    siteId: 'site-amuga',
    utilisateurs: [{ nom: 'amuga_wp', droits: 'tous', hote: 'localhost' }],
  },
]

export const COMPTES_FICHIERS: CompteFichiers[] = [
  {
    id: 'cf-1',
    hebergementId: 'heb-dba',
    utilisateur: 'dba-admin',
    protocoles: ['sftp', 'ftps'],
    racine: '/var/www',
    quotaGo: null,
    utiliseGo: 86.4,
    clesSsh: 2,
    derniereConnexion: '2026-08-19T09:41:00Z',
    statut: 'actif',
  },
  {
    id: 'cf-2',
    hebergementId: 'heb-dba',
    utilisateur: 'agence-boutique',
    protocoles: ['sftp'],
    racine: '/var/www/boutique',
    quotaGo: 25,
    utiliseGo: 18.6,
    clesSsh: 1,
    derniereConnexion: '2026-08-18T16:22:00Z',
    statut: 'actif',
  },
  {
    id: 'cf-3',
    hebergementId: 'heb-dba',
    utilisateur: 'redaction-blog',
    protocoles: ['sftp'],
    racine: '/var/www/blog/wp-content/uploads',
    quotaGo: 5,
    utiliseGo: 1.4,
    clesSsh: 0,
    derniereConnexion: '2026-07-30T11:05:00Z',
    statut: 'suspendu',
  },
  {
    id: 'cf-4',
    hebergementId: 'heb-cofina',
    utilisateur: 'cofina-web',
    protocoles: ['sftp'],
    racine: '/var/www',
    quotaGo: null,
    utiliseGo: 21.7,
    clesSsh: 1,
    derniereConnexion: '2026-08-19T08:14:00Z',
    statut: 'actif',
  },
  {
    id: 'cf-5',
    hebergementId: 'heb-amuga',
    utilisateur: 'amuga-web',
    protocoles: ['sftp'],
    racine: '/var/www',
    quotaGo: null,
    utiliseGo: 1.9,
    clesSsh: 0,
    statut: 'actif',
  },
]

export const TACHES_WEB: TachePlanifieeWeb[] = [
  {
    id: 'tw-1',
    hebergementId: 'heb-dba',
    libelle: 'Cron WordPress',
    expression: '*/15 * * * *',
    lisible: 'toutes les 15 minutes',
    commande: 'php8.3 /var/www/www/wp-cron.php',
    siteId: 'site-www',
    derniereExecution: '2026-08-19T15:15:00Z',
    dureeS: 3,
    statut: 'ok',
    prochaine: '2026-08-19T15:30:00Z',
    actif: true,
  },
  {
    id: 'tw-2',
    hebergementId: 'heb-dba',
    libelle: 'Réindexation du catalogue PrestaShop',
    expression: '0 4 * * *',
    lisible: 'chaque jour à 04:00',
    commande: 'php8.2 /var/www/boutique/bin/console prestashop:reindex',
    siteId: 'site-boutique',
    derniereExecution: '2026-08-19T04:00:00Z',
    dureeS: 148,
    statut: 'ok',
    prochaine: '2026-08-20T04:00:00Z',
    actif: true,
  },
  {
    id: 'tw-3',
    hebergementId: 'heb-dba',
    libelle: 'Export des commandes vers l’ERP',
    expression: '30 5 * * 1-5',
    lisible: 'du lundi au vendredi à 05:30',
    commande: 'php8.2 /var/www/boutique/bin/export-commandes.php',
    siteId: 'site-boutique',
    derniereExecution: '2026-08-19T05:30:00Z',
    dureeS: 62,
    statut: 'echec',
    prochaine: '2026-08-20T05:30:00Z',
    actif: true,
  },
  {
    id: 'tw-4',
    hebergementId: 'heb-dba',
    libelle: 'Purge du cache Redis',
    expression: '0 3 * * 0',
    lisible: 'chaque dimanche à 03:00',
    commande: 'redis-cli FLUSHDB',
    derniereExecution: '2026-08-16T03:00:00Z',
    dureeS: 1,
    statut: 'ok',
    prochaine: '2026-08-23T03:00:00Z',
    actif: false,
  },
  {
    id: 'tw-5',
    hebergementId: 'heb-cofina',
    libelle: 'Cron WordPress',
    expression: '*/15 * * * *',
    lisible: 'toutes les 15 minutes',
    commande: 'php8.2 /var/www/www/wp-cron.php',
    siteId: 'site-cofina',
    derniereExecution: '2026-08-19T15:15:00Z',
    dureeS: 2,
    statut: 'ok',
    prochaine: '2026-08-19T15:30:00Z',
    actif: true,
  },
]

export const SERVICES_PARTAGES: ServicePartage[] = [
  {
    id: 'sp-mail-dba',
    hebergementId: 'heb-dba',
    slug: 'email-pro',
    nom: 'Messagerie partagée',
    solution: 'Grommunio',
    hote: 'mail.dba.africa',
    usage: { libelle: 'Boîtes', utilise: 18, total: 25, unite: 'boîtes' },
    version: '2026.01.3',
    sante: 'maj_disponible',
    derniereSauvegarde: '2026-08-19T01:20:00Z',
    urlOuverture: 'https://mail.dba.africa',
    actif: true,
  },
  {
    id: 'sp-drive-dba',
    hebergementId: 'heb-dba',
    slug: 'drive-pro',
    nom: 'Drive partagé',
    solution: 'Nextcloud',
    hote: 'drive.dba.africa',
    usage: { libelle: 'Espace', utilise: 241, total: 500, unite: 'Go' },
    version: '29.0.4',
    sante: 'ok',
    derniereSauvegarde: '2026-08-19T01:22:00Z',
    urlOuverture: 'https://drive.dba.africa',
    actif: true,
  },
  {
    id: 'sp-mail-cofina',
    hebergementId: 'heb-cofina',
    slug: 'email-pro',
    nom: 'Messagerie partagée',
    solution: 'Grommunio',
    hote: 'mail.cofina.digital',
    usage: { libelle: 'Boîtes', utilise: 42, total: 50, unite: 'boîtes' },
    version: '2026.02.1',
    sante: 'ok',
    derniereSauvegarde: '2026-08-19T01:28:00Z',
    urlOuverture: 'https://mail.cofina.digital',
    actif: true,
  },
]

/**
 * Services partagés proposés mais pas encore activés sur un domaine. Le
 * catalogue partagé est court par nature : au-delà de la messagerie, du drive
 * et de la visio, un service demande une instance dédiée et relève d'un projet.
 */
export const CATALOGUE_PARTAGE = [
  {
    slug: 'email-pro',
    nom: 'Messagerie partagée',
    solution: 'Grommunio',
    phrase: 'Boîtes, agendas et contacts partagés sur votre domaine.',
    prix: 700,
    unite: '/boîte/mois',
    sousDomaine: 'mail',
  },
  {
    slug: 'drive-pro',
    nom: 'Drive partagé',
    solution: 'Nextcloud',
    phrase: 'Partage de fichiers et édition collaborative, quota par domaine.',
    prix: 1200,
    unite: '/100 Go/mois',
    sousDomaine: 'drive',
  },
  {
    slug: 'visio',
    nom: 'Visio partagée',
    solution: 'Jitsi',
    phrase: 'Salles de réunion sur votre domaine, sans installation.',
    prix: 9000,
    unite: '/mois',
    sousDomaine: 'visio',
  },
]

export const TYPE_SITE_LABEL: Record<SiteWeb['type'], string> = {
  wordpress: 'WordPress',
  prestashop: 'PrestaShop',
  php: 'PHP',
  statique: 'Site statique',
  laravel: 'Laravel',
}

export const hebergementById = (id: string) => HEBERGEMENTS.find((h) => h.id === id)
export const sitesDeLHebergement = (id: string) => SITES_WEB.filter((s) => s.hebergementId === id)
export const basesDeLHebergement = (id: string) =>
  BASES_HEBERGEMENT.filter((b) => b.hebergementId === id)
export const comptesDeLHebergement = (id: string) =>
  COMPTES_FICHIERS.filter((c) => c.hebergementId === id)
export const tachesDeLHebergement = (id: string) => TACHES_WEB.filter((t) => t.hebergementId === id)
export const partagesDeLHebergement = (id: string) =>
  SERVICES_PARTAGES.filter((s) => s.hebergementId === id)
export const siteById = (id: string) => SITES_WEB.find((s) => s.id === id)
export const baseHebergementById = (id: string) => BASES_HEBERGEMENT.find((b) => b.id === id)

/** Nom servi par l'hébergement : le domaine du client, ou le nom provisoire. */
export const nomServi = (h: WebHosting) => h.domaine ?? h.domaineProvisoire

// ─── Entrée Web Cloud : l'entité maîtresse du panneau ─────────────────

/**
 * Une ligne du sélecteur Web Cloud.
 *
 * Chez la plupart des fournisseurs, un même nom apparaît dans trois listes —
 * domaines, hébergement, messagerie — parce que les trois sont vendus
 * séparément. Nous attachons un domaine à un serveur et à un seul : il n'y a
 * donc qu'une entité, et une seule fiche qui dit tout ce qui la concerne.
 *
 * Deux origines possibles pour une entrée : un nom de domaine détenu par
 * l'organisation, ou un hébergement qui tourne avant l'achat du nom — auquel
 * cas c'est son nom technique provisoire qui sert d'identifiant.
 */
export interface EntreeWebCloud {
  /** Nom servi, qui sert aussi de segment d'URL. */
  id: string
  nom: string
  /** Nom technique, en attendant que le client achète le sien. */
  provisoire: boolean
  hebergement?: WebHosting
  domaine?: Domaine
  zone?: DnsZone
  /** Deuxième ligne du sélecteur : ce qui distingue l'entrée d'un coup d'œil. */
  sousTitre: string
  etat: string
  ton: 'ok' | 'warn' | 'err' | 'neutral'
}

/** Jours restants avant une date, à la date figée de la démonstration. */
export function joursAvant(iso: string, reference: string = MAINTENANT): number {
  const jour = 86_400_000
  return Math.round((new Date(iso).getTime() - new Date(reference).getTime()) / jour)
}

function etatEntree(
  hebergement: WebHosting | undefined,
  domaine: Domaine | undefined,
): { etat: string; ton: EntreeWebCloud['ton'] } {
  if (hebergement && hebergement.statut !== 'en_ligne') {
    return { etat: hebergement.statut === 'maintenance' ? 'Maintenance' : 'Suspendu', ton: 'warn' }
  }
  // Une échéance proche sans renouvellement automatique est le seul risque
  // qu'un client ne voit jamais venir : elle prime sur l'état du serveur.
  if (domaine) {
    const jours = joursAvant(domaine.expiration)
    if (jours <= 0) return { etat: 'Expiré', ton: 'err' }
    if (jours <= 30 && !domaine.renouvellementAuto) return { etat: `${jours} j`, ton: 'err' }
    if (jours <= 90 && !domaine.renouvellementAuto) return { etat: `${jours} j`, ton: 'warn' }
  }
  return { etat: 'Actif', ton: 'ok' }
}

/**
 * Assemble les entrées Web Cloud depuis trois listes — domaines, hébergements,
 * zones — quelle qu’en soit la provenance (graines locales ou collections
 * distantes : le backend nomme les mêmes champs). L’URL reste le nom servi.
 */
export function assemblerEntrees(
  domaines: Domaine[],
  hebergements: WebHosting[],
  zones: DnsZone[],
): EntreeWebCloud[] {
  const depuisDomaines = domaines.map<EntreeWebCloud>((d) => {
    const hebergement = hebergements.find(
      (h) => h.id === d.hebergementId || h.domaine === d.nom,
    )
    // `zoneId` n'est posé qu'à la commande d'un domaine avec zone incluse : une
    // zone rapatriée après coup (`POST /web/dns`) n'a aucun moyen de s'y relier
    // (le contrat ne permet pas de patcher `zoneId`), donc le repli par nom
    // évite qu'une zone fraîchement créée reste invisible sur sa propre fiche.
    const zone = d.zoneId
      ? zones.find((z) => z.id === d.zoneId)
      : zones.find((z) => z.domaine === d.nom)
    const sousTitre = hebergement
      ? `${hebergement.palier} · ${hebergement.serveur.nom}`
      : zone
        ? 'Sans hébergement · zone chez nous'
        : 'Sans hébergement · DNS externe'
    return { id: d.nom, nom: d.nom, provisoire: false, hebergement, domaine: d, zone, sousTitre, ...etatEntree(hebergement, d) }
  })

  // Les hébergements sans domaine ferment la liste : ce sont des chantiers.
  const orphelins = hebergements
    .filter((h) => h.domaine === null)
    .map<EntreeWebCloud>((h) => ({
      id: h.domaineProvisoire,
      nom: h.domaineProvisoire,
      provisoire: true,
      hebergement: h,
      sousTitre: `${h.palier} · ${h.serveur.nom} · nom provisoire`,
      ...etatEntree(h, undefined),
    }))

  return [...depuisDomaines, ...orphelins]
}

/** Entrées Web Cloud d'une organisation, domaines et hébergements confondus. */
export function entreesWebCloud(orgId: string = ORG_COURANTE.id): EntreeWebCloud[] {
  return assemblerEntrees(
    DOMAINES.filter((d) => d.orgId === orgId),
    HEBERGEMENTS.filter((h) => h.orgId === orgId),
    ZONES_DNS,
  )
}

export const entreeWebCloudById = (id: string, orgId?: string) =>
  entreesWebCloud(orgId).find((e) => e.id === id)

/**
 * L'abonnement à afficher pour une entrée Web Cloud.
 *
 * Deux horloges cohabitent : celle du nom de domaine, annuelle, et celle de
 * l'hébergement, mensuelle. On montre celle du nom quand il y en a un — c'est
 * celle qu'on oublie, et celle dont l'oubli coupe le service — et celle de
 * l'hébergement pour une entrée encore sans nom.
 */
export function abonnementDeLEntree(entree: EntreeWebCloud) {
  const jour = 86_400_000

  if (entree.domaine) {
    const d = entree.domaine
    const echeance = new Date(d.expiration).getTime()
    const restants = joursAvant(d.expiration)
    // La période en cours est celle qui contient aujourd'hui. Un domaine
    // enregistré pour plusieurs années a une échéance lointaine : retirer une
    // seule année placerait le début de période dans le futur, et la barre
    // afficherait 0 % alors que la période est déjà bien entamée.
    const annees = Math.max(1, Math.ceil(restants / 365))
    return {
      offre: `Nom de domaine ${d.extension}`,
      prixMensuel: undefined as number | undefined,
      debut: new Date(echeance - annees * 365 * jour).toISOString().slice(0, 10),
      echeance: d.expiration,
      joursRestants: restants,
      renouvellementAuto: d.renouvellementAuto,
      frequence: annees > 1 ? `Tous les ans · ${annees} ans souscrits` : 'Tous les ans',
    }
  }

  if (entree.hebergement) {
    const h = entree.hebergement
    return {
      offre: `Hébergement ${h.palier}`,
      prixMensuel: PRIX_PALIER[h.palier] as number | undefined,
      debut: '2026-08-01',
      echeance: '2026-08-31',
      joursRestants: joursAvant('2026-08-31'),
      renouvellementAuto: true,
      frequence: 'Mensuelle',
    }
  }
  return null
}

/** Tarifs mensuels des paliers d'hébergement, en francs CFA. */
export const PRIX_PALIER: Record<string, number> = {
  Démarrage: 4500,
  Pro: 12000,
  Agence: 38000,
}
