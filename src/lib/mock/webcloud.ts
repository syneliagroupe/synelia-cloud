/**
 * Données de démonstration — les sections de Web Cloud (§6.8).
 *
 * Chaque section de la barre a sa ressource maîtresse : un serveur de bases, une
 * messagerie de domaine, un drive de domaine, un certificat, un plan de
 * sauvegarde. Elles se rattachent toutes à un hébergement ou à un domaine, ce
 * qui garde la règle du produit intacte : un domaine, un serveur.
 *
 * Toutes les valeurs sont fictives.
 */

import { MAINTENANT } from '../format'
import type { Site } from '../types'
import { HEBERGEMENTS, joursAvant } from './hebergement'
import { ORG_COURANTE } from './orgs'
import { DOMAINES } from './web'

// ─── Serveurs de bases de données ─────────────────────────────────────

export type MoteurWeb = 'mariadb' | 'postgresql' | 'redis' | 'mysql' | 'mongodb'

export interface ServeurBases {
  id: string
  hebergementId: string
  serveur: string
  moteur: MoteurWeb
  version: string
  /** Un moteur non activé est proposé, pas facturé. */
  actif: boolean
  /**
   * Aucun accès distant : le serveur n'écoute que sur la boucle locale de son
   * hébergement. C'est ce qui permet de ne pas exposer une base au monde par
   * simple oubli de configuration.
   */
  hoteInterne: string
  port: number
  bases: Array<{
    nom: string
    tailleMo: number
    tables?: number
    cles?: number
    collation?: string
    utilise: string
  }>
  utilisateurs: Array<{ nom: string; droits: 'complet' | 'lecture' | 'ecriture'; base: string }>
  quotaMo: number
  utiliseMo: number
  connexions?: { actives: number; max: number }
  sauvegarde: { frequence: string; derniere: string; retentionJours: number }
  prixMensuel: number
}

export const SERVEURS_BASES: ServeurBases[] = [
  {
    id: 'db-dba-maria',
    hebergementId: 'heb-dba',
    serveur: 'web-dba-01',
    moteur: 'mariadb',
    version: '11.4.4',
    actif: true,
    hoteInterne: 'localhost',
    port: 3306,
    bases: [
      { nom: 'dba_wp', tailleMo: 412, tables: 68, collation: 'utf8mb4_unicode_ci', utilise: 'www.dba.africa' },
      { nom: 'dba_presta', tailleMo: 2840, tables: 812, collation: 'utf8mb4_general_ci', utilise: 'boutique.dba.africa' },
      { nom: 'dba_blog', tailleMo: 186, tables: 61, collation: 'utf8mb4_unicode_ci', utilise: 'blog.dba.africa' },
    ],
    utilisateurs: [
      { nom: 'dba_wp_rw', droits: 'complet', base: 'dba_wp' },
      { nom: 'dba_presta_rw', droits: 'complet', base: 'dba_presta' },
      { nom: 'dba_blog_rw', droits: 'complet', base: 'dba_blog' },
      { nom: 'dba_reporting', droits: 'lecture', base: 'dba_presta' },
    ],
    quotaMo: 10240,
    utiliseMo: 3438,
    connexions: { actives: 18, max: 150 },
    sauvegarde: { frequence: 'Quotidienne à 03:00', derniere: '2026-08-19T03:04:00Z', retentionJours: 30 },
    prixMensuel: 0,
  },
  {
    id: 'db-dba-pg',
    hebergementId: 'heb-dba',
    serveur: 'web-dba-01',
    moteur: 'postgresql',
    version: '16.4',
    actif: true,
    hoteInterne: 'localhost',
    port: 5432,
    bases: [
      { nom: 'dba_docs', tailleMo: 96, tables: 22, collation: 'fr_FR.UTF-8', utilise: 'Documentation interne' },
    ],
    utilisateurs: [{ nom: 'dba_docs_rw', droits: 'complet', base: 'dba_docs' }],
    quotaMo: 10240,
    utiliseMo: 96,
    connexions: { actives: 3, max: 100 },
    sauvegarde: { frequence: 'Quotidienne à 03:20', derniere: '2026-08-19T03:22:00Z', retentionJours: 30 },
    prixMensuel: 0,
  },
  {
    id: 'db-dba-redis',
    hebergementId: 'heb-dba',
    serveur: 'web-dba-01',
    moteur: 'redis',
    version: '7.4',
    actif: true,
    hoteInterne: 'localhost',
    port: 6379,
    bases: [
      { nom: 'db0', tailleMo: 148, cles: 41_820, utilise: 'Cache objet WordPress' },
      { nom: 'db1', tailleMo: 62, cles: 8_140, utilise: 'Sessions PrestaShop' },
    ],
    utilisateurs: [],
    quotaMo: 512,
    utiliseMo: 210,
    connexions: { actives: 9, max: 64 },
    sauvegarde: { frequence: 'Sans objet — cache volatil', derniere: '—', retentionJours: 0 },
    prixMensuel: 0,
  },
  {
    id: 'db-labo-maria',
    hebergementId: 'heb-dba-labo',
    serveur: 'web-dba-04',
    moteur: 'mariadb',
    version: '11.4.4',
    actif: true,
    hoteInterne: 'localhost',
    port: 3306,
    bases: [{ nom: 'labo_app', tailleMo: 24, tables: 14, collation: 'utf8mb4_unicode_ci', utilise: 'Bac à sable' }],
    utilisateurs: [{ nom: 'labo_rw', droits: 'complet', base: 'labo_app' }],
    quotaMo: 2048,
    utiliseMo: 24,
    connexions: { actives: 1, max: 50 },
    sauvegarde: { frequence: 'Quotidienne à 04:30', derniere: '2026-08-19T04:32:00Z', retentionJours: 14 },
    prixMensuel: 0,
  },
  {
    id: 'db-labo-pg',
    hebergementId: 'heb-dba-labo',
    serveur: 'web-dba-04',
    moteur: 'postgresql',
    version: '16.4',
    // Proposé, pas encore activé : l'activation crée le service sur le serveur.
    actif: false,
    hoteInterne: 'localhost',
    port: 5432,
    bases: [],
    utilisateurs: [],
    quotaMo: 2048,
    utiliseMo: 0,
    sauvegarde: { frequence: '—', derniere: '—', retentionJours: 0 },
    prixMensuel: 0,
  },
  {
    id: 'db-labo-redis',
    hebergementId: 'heb-dba-labo',
    serveur: 'web-dba-04',
    moteur: 'redis',
    version: '7.4',
    actif: false,
    hoteInterne: 'localhost',
    port: 6379,
    bases: [],
    utilisateurs: [],
    quotaMo: 256,
    utiliseMo: 0,
    sauvegarde: { frequence: '—', derniere: '—', retentionJours: 0 },
    prixMensuel: 0,
  },
]

export const MOTEUR_WEB_LABEL: Record<MoteurWeb, string> = {
  mariadb: 'MariaDB',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
}

export const MOTEUR_WEB_TEINTE: Record<MoteurWeb, string> = {
  mariadb: '#C0765A',
  mysql: '#00758F',
  postgresql: '#336791',
  mongodb: '#47A248',
  redis: '#DC382D',
}

// ─── Messagerie d'un domaine ──────────────────────────────────────────

export interface BoiteMail {
  adresse: string
  nom: string
  quotaGo: number
  utiliseGo: number
  statut: 'active' | 'suspendue' | 'archivee'
  derniereConnexion?: string
  mfa: boolean
}

export interface MessagerieDomaine {
  id: string
  domaine: string
  actif: boolean
  palier: string
  solutionOSS: string
  hoteWebmail: string
  boites: BoiteMail[]
  boitesIncluses: number
  alias: Array<{ de: string; vers: string[] }>
  redirections: Array<{ de: string; vers: string; copie: boolean }>
  attrapeTout?: string
  authentification: { spf: 'valide' | 'absent' | 'invalide'; dkim: 'valide' | 'absent'; dmarc: string }
  antispam: { actif: boolean; niveau: 'permissif' | 'standard' | 'strict'; quarantaine: number }
  prixSiege: number
}

export const MESSAGERIES: MessagerieDomaine[] = [
  {
    id: 'mail-dba-africa',
    domaine: 'dba.africa',
    actif: true,
    palier: 'Standard',
    solutionOSS: 'Grommunio',
    hoteWebmail: 'mail.dba.africa',
    boitesIncluses: 20,
    boites: [
      { adresse: 'lea.konan@dba.africa', nom: 'Léa Konan', quotaGo: 50, utiliseGo: 18.4, statut: 'active', derniereConnexion: '2026-08-19T15:14:00Z', mfa: true },
      { adresse: 'fatou.diallo@dba.africa', nom: 'Fatou Diallo', quotaGo: 50, utiliseGo: 34.1, statut: 'active', derniereConnexion: '2026-08-19T15:08:00Z', mfa: true },
      { adresse: 'yao.kouassi@dba.africa', nom: 'Yao Kouassi', quotaGo: 25, utiliseGo: 11.2, statut: 'active', derniereConnexion: '2026-08-19T09:34:00Z', mfa: false },
      { adresse: 'aicha.kone@dba.africa', nom: 'Aïcha Koné', quotaGo: 50, utiliseGo: 47.8, statut: 'active', derniereConnexion: '2026-08-19T14:58:00Z', mfa: true },
      { adresse: 'adama.sangare@dba.africa', nom: 'Adama Sangaré', quotaGo: 25, utiliseGo: 4.6, statut: 'active', derniereConnexion: '2026-08-15T17:04:00Z', mfa: false },
      { adresse: 'nadia.traore@dba.africa', nom: 'Nadia Traoré', quotaGo: 25, utiliseGo: 1.2, statut: 'suspendue', derniereConnexion: '2026-07-28T10:22:00Z', mfa: false },
      { adresse: 'compta@dba.africa', nom: 'Comptabilité', quotaGo: 25, utiliseGo: 9.8, statut: 'active', derniereConnexion: '2026-08-19T11:02:00Z', mfa: true },
      { adresse: 'contact@dba.africa', nom: 'Contact général', quotaGo: 25, utiliseGo: 14.2, statut: 'active', derniereConnexion: '2026-08-19T13:41:00Z', mfa: false },
    ],
    alias: [
      { de: 'info@dba.africa', vers: ['contact@dba.africa'] },
      { de: 'direction@dba.africa', vers: ['lea.konan@dba.africa', 'fatou.diallo@dba.africa'] },
      { de: 'facturation@dba.africa', vers: ['compta@dba.africa'] },
    ],
    redirections: [
      { de: 'presse@dba.africa', vers: 'contact@dba.africa', copie: false },
      { de: 'rh@dba.africa', vers: 'lea.konan@dba.africa', copie: true },
    ],
    attrapeTout: 'contact@dba.africa',
    authentification: { spf: 'valide', dkim: 'valide', dmarc: 'p=quarantine' },
    antispam: { actif: true, niveau: 'standard', quarantaine: 47 },
    prixSiege: 1800,
  },
  {
    id: 'mail-dbaci',
    domaine: 'digitalbusinessafrica.ci',
    actif: true,
    palier: 'Essentiel',
    solutionOSS: 'Grommunio',
    hoteWebmail: 'mail.digitalbusinessafrica.ci',
    boitesIncluses: 5,
    boites: [
      { adresse: 'contact@digitalbusinessafrica.ci', nom: 'Contact', quotaGo: 10, utiliseGo: 2.1, statut: 'active', derniereConnexion: '2026-08-18T16:22:00Z', mfa: false },
      { adresse: 'ci@digitalbusinessafrica.ci', nom: 'Bureau Côte d’Ivoire', quotaGo: 10, utiliseGo: 5.4, statut: 'active', derniereConnexion: '2026-08-19T08:11:00Z', mfa: true },
    ],
    alias: [{ de: 'info@digitalbusinessafrica.ci', vers: ['contact@digitalbusinessafrica.ci'] }],
    redirections: [],
    authentification: { spf: 'valide', dkim: 'valide', dmarc: 'p=none' },
    antispam: { actif: true, niveau: 'standard', quarantaine: 12 },
    prixSiege: 1200,
  },
  {
    id: 'mail-boutique',
    domaine: 'dba-boutique.ci',
    actif: false,
    palier: 'Essentiel',
    solutionOSS: 'Grommunio',
    hoteWebmail: 'mail.dba-boutique.ci',
    boitesIncluses: 5,
    boites: [],
    alias: [],
    redirections: [],
    authentification: { spf: 'absent', dkim: 'absent', dmarc: 'absent' },
    antispam: { actif: false, niveau: 'standard', quarantaine: 0 },
    prixSiege: 1200,
  },
  {
    id: 'mail-dbatech',
    domaine: 'dba.tech',
    actif: false,
    palier: 'Essentiel',
    solutionOSS: 'Grommunio',
    hoteWebmail: 'mail.dba.tech',
    boitesIncluses: 5,
    boites: [],
    alias: [],
    redirections: [],
    authentification: { spf: 'absent', dkim: 'absent', dmarc: 'absent' },
    antispam: { actif: false, niveau: 'standard', quarantaine: 0 },
    prixSiege: 1200,
  },
]

// ─── Drive d'un domaine ───────────────────────────────────────────────

export interface DriveDomaine {
  id: string
  domaine: string
  actif: boolean
  palier: string
  solutionOSS: string
  hote: string
  version?: string
  sieges: { attribues: number; souscrits: number }
  quota: { utiliseGo: number; totalGo: number }
  /** Utilisateurs applicatifs du drive — locaux au service, pas de SSO. */
  utilisateurs: Array<{ id: string; nom: string; quotaGo: number; utiliseGo: number }>
  partage: {
    externeAutorise: boolean
    motDePasseObligatoire: boolean
    expirationJours: number
    liensActifs: number
  }
  versionsFichiers: { actif: boolean; retentionJours: number }
  corbeille: { retentionJours: number; tailleGo: number }
  suiteBureautique: string
  derniereSauvegarde?: string
  prixSiege: number
}

export const DRIVES: DriveDomaine[] = [
  {
    id: 'drive-dba-africa',
    domaine: 'dba.africa',
    actif: true,
    palier: 'Standard',
    solutionOSS: 'Nextcloud',
    hote: 'drive.dba.africa',
    version: '29.0.4',
    sieges: { attribues: 8, souscrits: 20 },
    quota: { utiliseGo: 1_142, totalGo: 2_000 },
    utilisateurs: [
      { id: 'drv-lea', nom: 'Léa Konan', quotaGo: 150, utiliseGo: 96 },
      { id: 'drv-fatou', nom: 'Fatou Diallo', quotaGo: 200, utiliseGo: 168 },
      { id: 'drv-yao', nom: 'Yao Kouassi', quotaGo: 100, utiliseGo: 41 },
      { id: 'drv-aicha', nom: 'Aïcha Koné', quotaGo: 200, utiliseGo: 184 },
      { id: 'drv-adama', nom: 'Adama Sangaré', quotaGo: 100, utiliseGo: 22 },
      { id: 'drv-nadia', nom: 'Nadia Traoré', quotaGo: 80, utiliseGo: 9 },
      { id: 'drv-compta', nom: 'Comptabilité', quotaGo: 120, utiliseGo: 74 },
      { id: 'drv-contact', nom: 'Contact général', quotaGo: 80, utiliseGo: 33 },
    ],
    partage: {
      externeAutorise: true,
      motDePasseObligatoire: true,
      expirationJours: 30,
      liensActifs: 64,
    },
    versionsFichiers: { actif: true, retentionJours: 90 },
    corbeille: { retentionJours: 30, tailleGo: 41 },
    suiteBureautique: 'Collabora Online',
    derniereSauvegarde: '2026-08-19T01:22:00Z',
    prixSiege: 2200,
  },
  {
    id: 'drive-dbaci',
    domaine: 'digitalbusinessafrica.ci',
    actif: false,
    palier: 'Essentiel',
    solutionOSS: 'Nextcloud',
    hote: 'drive.digitalbusinessafrica.ci',
    sieges: { attribues: 0, souscrits: 0 },
    quota: { utiliseGo: 0, totalGo: 500 },
    utilisateurs: [],
    partage: { externeAutorise: false, motDePasseObligatoire: true, expirationJours: 30, liensActifs: 0 },
    versionsFichiers: { actif: true, retentionJours: 30 },
    corbeille: { retentionJours: 30, tailleGo: 0 },
    suiteBureautique: 'Collabora Online',
    prixSiege: 1800,
  },
  {
    id: 'drive-boutique',
    domaine: 'dba-boutique.ci',
    actif: false,
    palier: 'Essentiel',
    solutionOSS: 'Nextcloud',
    hote: 'drive.dba-boutique.ci',
    sieges: { attribues: 0, souscrits: 0 },
    quota: { utiliseGo: 0, totalGo: 500 },
    utilisateurs: [],
    partage: { externeAutorise: false, motDePasseObligatoire: true, expirationJours: 30, liensActifs: 0 },
    versionsFichiers: { actif: true, retentionJours: 30 },
    corbeille: { retentionJours: 30, tailleGo: 0 },
    suiteBureautique: 'Collabora Online',
    prixSiege: 1800,
  },
]

// ─── Certificats TLS ──────────────────────────────────────────────────

export type TypeCertificat = 'letsencrypt' | 'dv' | 'ov' | 'ev' | 'wildcard'

export interface Certificat {
  id: string
  hote: string
  hotesSupplementaires?: string[]
  type: TypeCertificat
  emetteur: string
  emisLe: string
  expire: string
  renouvellementAuto: boolean
  /** Un certificat payant a une échéance commerciale en plus de la technique. */
  prixAnnuel: number
  etat: 'actif' | 'en_emission' | 'expire' | 'revoque'
  hebergementId?: string
  algorithme: string
  validationDomaine: 'dns' | 'http' | 'email'
}

export const CERTIFICATS: Certificat[] = [
  {
    id: 'crt-www',
    hote: 'www.dba.africa',
    hotesSupplementaires: ['dba.africa'],
    type: 'letsencrypt',
    emetteur: "Let's Encrypt",
    emisLe: '2026-07-30',
    expire: '2026-10-28',
    renouvellementAuto: true,
    prixAnnuel: 0,
    etat: 'actif',
    hebergementId: 'heb-dba',
    algorithme: 'ECDSA P-256',
    validationDomaine: 'http',
  },
  {
    id: 'crt-boutique',
    hote: 'boutique.dba.africa',
    type: 'ov',
    emetteur: 'Sectigo OV',
    emisLe: '2025-11-02',
    expire: '2026-11-02',
    renouvellementAuto: true,
    prixAnnuel: 48000,
    etat: 'actif',
    hebergementId: 'heb-dba',
    algorithme: 'RSA 2048',
    validationDomaine: 'dns',
  },
  {
    id: 'crt-blog',
    hote: 'blog.dba.africa',
    type: 'letsencrypt',
    emetteur: "Let's Encrypt",
    emisLe: '2026-07-30',
    expire: '2026-10-28',
    renouvellementAuto: true,
    prixAnnuel: 0,
    etat: 'actif',
    hebergementId: 'heb-dba',
    algorithme: 'ECDSA P-256',
    validationDomaine: 'http',
  },
  {
    id: 'crt-wildcard',
    hote: '*.dba.africa',
    type: 'wildcard',
    emetteur: 'Sectigo Wildcard DV',
    emisLe: '2026-02-14',
    expire: '2027-02-14',
    renouvellementAuto: true,
    prixAnnuel: 96000,
    etat: 'actif',
    algorithme: 'RSA 2048',
    validationDomaine: 'dns',
  },
  {
    id: 'crt-api',
    hote: 'api.dba.africa',
    type: 'letsencrypt',
    emetteur: "Let's Encrypt",
    emisLe: '2026-05-29',
    expire: '2026-08-27',
    renouvellementAuto: false,
    prixAnnuel: 0,
    etat: 'actif',
    algorithme: 'ECDSA P-256',
    validationDomaine: 'http',
  },
  {
    id: 'crt-labo',
    hote: 'dba-labo.heberge.synelia.cloud',
    type: 'letsencrypt',
    emetteur: "Let's Encrypt",
    emisLe: '2026-08-13',
    expire: '2026-11-11',
    renouvellementAuto: true,
    prixAnnuel: 0,
    etat: 'actif',
    hebergementId: 'heb-dba-labo',
    algorithme: 'ECDSA P-256',
    validationDomaine: 'http',
  },
  {
    id: 'crt-ci',
    hote: 'digitalbusinessafrica.ci',
    type: 'dv',
    emetteur: 'Sectigo DV',
    emisLe: '2026-08-18',
    expire: '2027-08-18',
    renouvellementAuto: true,
    prixAnnuel: 18000,
    etat: 'en_emission',
    algorithme: 'RSA 2048',
    validationDomaine: 'dns',
  },
]

export const TYPE_CERTIFICAT_LABEL: Record<TypeCertificat, string> = {
  letsencrypt: 'Let’s Encrypt',
  dv: 'Validation de domaine',
  ov: 'Validation d’organisation',
  ev: 'Validation étendue',
  wildcard: 'Joker',
}

/** Certificats commandables, au-delà du Let's Encrypt inclus. */
export const OFFRES_CERTIFICAT = [
  {
    type: 'letsencrypt' as TypeCertificat,
    nom: 'Let’s Encrypt',
    prix: 0,
    delai: 'Quelques minutes',
    validation: 'Automatique, par fichier HTTP ou enregistrement DNS',
    pour: 'Tout site public. Renouvelé tous les 90 jours sans intervention.',
    garantie: 'Aucune',
  },
  {
    type: 'dv' as TypeCertificat,
    nom: 'Validation de domaine',
    prix: 18000,
    delai: '2 à 4 heures',
    validation: 'Preuve de contrôle du domaine',
    pour: 'Un site vitrine qui préfère une autorité commerciale.',
    garantie: '10 000 000 FCFA',
  },
  {
    type: 'ov' as TypeCertificat,
    nom: 'Validation d’organisation',
    prix: 48000,
    delai: '2 à 5 jours ouvrés',
    validation: 'Vérification de l’existence légale de l’organisation',
    pour: 'Une boutique en ligne : le nom de l’entreprise figure dans le certificat.',
    garantie: '75 000 000 FCFA',
  },
  {
    type: 'wildcard' as TypeCertificat,
    nom: 'Joker',
    prix: 96000,
    delai: '2 à 4 heures',
    validation: 'Enregistrement DNS obligatoire',
    pour: 'Couvre tous les sous-domaines d’un coup, y compris ceux créés plus tard.',
    garantie: '10 000 000 FCFA',
  },
]

// ─── Sauvegardes d'un hébergement ─────────────────────────────────────

export interface ExecutionSauvegarde {
  id: string
  ts: string
  statut: 'ok' | 'echec' | 'partielle'
  taille: string
  dureeMin: number
  contenu: string[]
  immuableJusqua?: string
  message?: string
}

export interface SauvegardeWeb {
  id: string
  hebergementId: string
  serveur: string
  nomServi: string
  actif: boolean
  frequence: 'quotidienne' | 'bihebdomadaire' | 'hebdomadaire'
  heure: string
  retentionJours: number
  destination: string
  site: Site
  immuable: boolean
  perimetre: { fichiers: boolean; bases: boolean; configuration: boolean; messagerie: boolean }
  executions: ExecutionSauvegarde[]
  espaceOccupeGo: number
  dernierTestRestauration?: { date: string; resultat: 'ok' | 'echec'; dureeMin: number }
}

export const SAUVEGARDES_WEB: SauvegardeWeb[] = [
  {
    id: 'bak-dba',
    hebergementId: 'heb-dba',
    serveur: 'web-dba-01',
    nomServi: 'dba.africa',
    actif: true,
    frequence: 'quotidienne',
    heure: '03:00',
    retentionJours: 30,
    destination: 'Bucket immuable — Grand-Bassam',
    site: 'GBM',
    immuable: true,
    perimetre: { fichiers: true, bases: true, configuration: true, messagerie: true },
    espaceOccupeGo: 428,
    executions: [
      { id: 'ex-1', ts: '2026-08-19T03:04:00Z', statut: 'ok', taille: '31,8 Go', dureeMin: 22, contenu: ['Fichiers', 'Bases', 'Configuration', 'Messagerie'], immuableJusqua: '2026-09-18' },
      { id: 'ex-2', ts: '2026-08-18T03:03:00Z', statut: 'ok', taille: '31,6 Go', dureeMin: 21, contenu: ['Fichiers', 'Bases', 'Configuration', 'Messagerie'], immuableJusqua: '2026-09-17' },
      { id: 'ex-3', ts: '2026-08-17T03:05:00Z', statut: 'partielle', taille: '28,1 Go', dureeMin: 34, contenu: ['Fichiers', 'Bases', 'Configuration'], immuableJusqua: '2026-09-16', message: 'Messagerie ignorée : boîte aicha.kone verrouillée par une session ouverte. Reprise automatique le lendemain.' },
      { id: 'ex-4', ts: '2026-08-16T03:02:00Z', statut: 'ok', taille: '31,4 Go', dureeMin: 20, contenu: ['Fichiers', 'Bases', 'Configuration', 'Messagerie'], immuableJusqua: '2026-09-15' },
      { id: 'ex-5', ts: '2026-08-15T03:04:00Z', statut: 'ok', taille: '31,2 Go', dureeMin: 21, contenu: ['Fichiers', 'Bases', 'Configuration', 'Messagerie'], immuableJusqua: '2026-09-14' },
    ],
    dernierTestRestauration: { date: '2026-08-02', resultat: 'ok', dureeMin: 38 },
  },
  {
    id: 'bak-labo',
    hebergementId: 'heb-dba-labo',
    serveur: 'web-dba-04',
    nomServi: 'dba-labo.heberge.synelia.cloud',
    actif: true,
    frequence: 'quotidienne',
    heure: '04:30',
    retentionJours: 14,
    destination: 'Bucket immuable — Grand-Bassam',
    site: 'GBM',
    immuable: true,
    perimetre: { fichiers: true, bases: true, configuration: true, messagerie: false },
    espaceOccupeGo: 4.2,
    executions: [
      { id: 'ex-l1', ts: '2026-08-19T04:31:00Z', statut: 'ok', taille: '310 Mo', dureeMin: 2, contenu: ['Fichiers', 'Bases', 'Configuration'], immuableJusqua: '2026-09-02' },
      { id: 'ex-l2', ts: '2026-08-18T04:30:00Z', statut: 'ok', taille: '308 Mo', dureeMin: 2, contenu: ['Fichiers', 'Bases', 'Configuration'], immuableJusqua: '2026-09-01' },
      { id: 'ex-l3', ts: '2026-08-17T04:32:00Z', statut: 'ok', taille: '305 Mo', dureeMin: 2, contenu: ['Fichiers', 'Bases', 'Configuration'], immuableJusqua: '2026-08-31' },
    ],
  },
]

// ─── Sélecteurs ───────────────────────────────────────────────────────

const hebergementsDeLOrg = (orgId: string = ORG_COURANTE.id) =>
  HEBERGEMENTS.filter((h) => h.orgId === orgId)

export const domainesDeLOrg = (orgId: string = ORG_COURANTE.id) =>
  DOMAINES.filter((d) => d.orgId === orgId)

export const serveursBasesDeLOrg = (orgId?: string) => {
  const ids = new Set(hebergementsDeLOrg(orgId).map((h) => h.id))
  return SERVEURS_BASES.filter((s) => ids.has(s.hebergementId))
}
export const serveurBasesById = (id: string) => SERVEURS_BASES.find((s) => s.id === id)

export const messageriesDeLOrg = (orgId?: string) => {
  const noms = new Set(domainesDeLOrg(orgId).map((d) => d.nom))
  return MESSAGERIES.filter((m) => noms.has(m.domaine))
}
export const messagerieById = (id: string) => MESSAGERIES.find((m) => m.id === id)

export const drivesDeLOrg = (orgId?: string) => {
  const noms = new Set(domainesDeLOrg(orgId).map((d) => d.nom))
  return DRIVES.filter((d) => noms.has(d.domaine))
}
export const driveById = (id: string) => DRIVES.find((d) => d.id === id)

export const certificatById = (id: string) => CERTIFICATS.find((c) => c.id === id)

export const sauvegardeWebById = (id: string) => SAUVEGARDES_WEB.find((s) => s.id === id)
export const sauvegardesWebDeLOrg = (orgId?: string) => {
  const ids = new Set(hebergementsDeLOrg(orgId).map((h) => h.id))
  return SAUVEGARDES_WEB.filter((s) => ids.has(s.hebergementId))
}

/** Certificats dont l'échéance approche, les plus urgents d'abord. */
export const certificatsAControler = () =>
  CERTIFICATS.filter((c) => joursAvant(c.expire, MAINTENANT) <= 30 || !c.renouvellementAuto).sort(
    (a, b) => joursAvant(a.expire, MAINTENANT) - joursAvant(b.expire, MAINTENANT),
  )
