/**
 * Données de démonstration — projets applicatifs, services et domaines (§5).
 *
 * Le projet est la maille de regroupement : une application, sa base, son cache
 * et ses tâches de fond appartiennent au même système et se déploient ensemble.
 * Toutes les valeurs sont fictives.
 */

import type {
  DomaineApplicatif,
  MoteurBase,
  Projet,
  ServiceProjet,
  TypeServiceProjet,
  ZoneApplicative,
} from '../types'
import { seededSeries } from '../utils'

export const PROJETS: Projet[] = [
  {
    id: 'prj-metier',
    nom: 'Plateforme métier',
    description:
      'API métier, back-office interne et traitements de rapprochement bancaire. Le système le plus critique de l’organisation.',
    espaceId: 'ec-dba-01',
    clusterId: 'k8s-prod',
    lbId: 'lb-prj-metier',
    cree: '2025-03-11',
    etiquettes: ['production', 'critique'],
    environnements: ['Production', 'Préproduction', 'Développement'],
    variables: [
      {
        cle: 'DATABASE_URL',
        secret: true,
        portee: 'runtime',
        environnements: ['Production', 'Préproduction', 'Développement'],
      },
      {
        cle: 'REDIS_URL',
        secret: true,
        portee: 'runtime',
        environnements: ['Production', 'Préproduction'],
      },
      {
        cle: 'SMTP_HOST',
        valeur: 'smtp.synelia.cloud',
        secret: false,
        portee: 'runtime',
        environnements: ['Production', 'Préproduction', 'Développement'],
      },
      {
        cle: 'SENTRY_DSN',
        secret: true,
        portee: 'runtime',
        environnements: ['Production'],
      },
      {
        cle: 'NODE_ENV',
        valeur: 'production',
        secret: false,
        portee: 'build',
        environnements: ['Production'],
      },
    ],
  },
  {
    id: 'prj-vitrine',
    nom: 'Présence web',
    description: 'Site institutionnel et pages de campagne, servis en statique derrière le cache.',
    espaceId: 'ec-dba-01',
    clusterId: 'k8s-prod',
    lbId: 'lb-prj-vitrine',
    cree: '2025-06-02',
    etiquettes: ['production', 'public'],
    environnements: ['Production', 'Préproduction'],
    variables: [
      {
        cle: 'NEXT_PUBLIC_API_URL',
        valeur: 'https://api.dba.africa',
        secret: false,
        portee: 'build',
        environnements: ['Production'],
      },
      {
        cle: 'NEXT_PUBLIC_API_URL',
        valeur: 'https://preprod.dba.synelia.app',
        secret: false,
        portee: 'build',
        environnements: ['Préproduction'],
      },
    ],
  },
  {
    id: 'prj-data',
    nom: 'Données & analyse',
    description:
      'Chaîne d’ingestion, entrepôt colonne et tableaux de bord métiers. Alimentée chaque nuit par un ETL.',
    espaceId: 'ec-dba-01',
    clusterId: 'k8s-prod',
    lbId: 'lb-prj-data',
    cree: '2025-09-24',
    etiquettes: ['production', 'analytique'],
    environnements: ['Production', 'Développement'],
    variables: [
      {
        cle: 'CLICKHOUSE_URL',
        secret: true,
        portee: 'runtime',
        environnements: ['Production', 'Développement'],
      },
      {
        cle: 'ETL_BATCH_SIZE',
        valeur: '5000',
        secret: false,
        portee: 'runtime',
        environnements: ['Production', 'Développement'],
      },
    ],
  },
  {
    id: 'prj-solutions',
    nom: 'Solutions métier',
    description:
      'Les solutions déployées depuis la bibliothèque de modèles : messagerie dédiée, ERP, GED. Chacune est une instance isolée, avec ses ressources et son plan de sauvegarde.',
    espaceId: 'ec-dba-01',
    clusterId: 'k8s-prod',
    lbId: 'lb-prj-solutions',
    cree: '2026-02-04',
    etiquettes: ['production', 'catalogue'],
    environnements: ['Production'],
    variables: [
      {
        cle: 'SMTP_RELAY',
        valeur: 'smtp.synelia.cloud',
        secret: false,
        portee: 'runtime',
        environnements: ['Production'],
      },
    ],
  },
  {
    id: 'prj-outillage',
    nom: 'Outillage interne',
    description:
      'Runners d’intégration continue et bac à sable partagé de l’équipe produit. Rien de client ici.',
    espaceId: 'ec-dba-02',
    clusterId: 'k8s-lab',
    lbId: 'lb-prj-outillage',
    cree: '2025-11-08',
    etiquettes: ['interne'],
    environnements: ['Production'],
    variables: [
      {
        cle: 'REGISTRY_TOKEN',
        secret: true,
        portee: 'build',
        environnements: ['Production'],
      },
    ],
  },
]

export const SERVICES_PROJET: ServiceProjet[] = [
  // ── Plateforme métier · Production
  {
    id: 'svc-metier-api',
    projetId: 'prj-metier',
    nom: 'api',
    type: 'application',
    environnement: 'Production',
    statut: 'running',
    appId: 'app-metier',
    source: { type: 'git', ref: 'github.com/dba-africa/app-metier', branche: 'main' },
    portConteneur: 3000,
    ressources: { cpu: 2, ramMo: 4096, diskGo: 40 },
    emplacement: { site: 'ABJ', backend: 'CL-GRA-01', vms: ['web-prod-01', 'web-prod-02'] },
    derniereMaj: '2026-08-19T15:08:00Z',
    coutMensuel: 28400,
  },
  {
    id: 'svc-metier-db',
    projetId: 'prj-metier',
    nom: 'postgres',
    type: 'base',
    environnement: 'Production',
    statut: 'running',
    moteur: 'postgresql',
    version: '16.4',
    base: {
      nom: 'app_metier',
      utilisateur: 'app_metier',
      motDePasse: 'Xk7-fT2p-Rq94-mZ1v',
      hoteInterne: 'svc-metier-db.prj-metier.interne',
      port: 5432,
    },
    exposeExterne: { actif: false },
    sauvegarde: {
      plan: 'Quotidien immuable',
      cron: '0 1 * * *',
      destination: 'bkt-sauvegardes (GBM)',
      dernier: '2026-08-19T01:04:00Z',
      retentionJours: 30,
      taille: '18,4 Go',
    },
    ressources: { cpu: 4, ramMo: 16384, diskGo: 500 },
    emplacement: { site: 'ABJ', backend: 'CL-GRA-01', vms: ['db-prod-01', 'db-prod-02-replica'] },
    derniereMaj: '2026-07-28T22:10:00Z',
    coutMensuel: 48000,
  },
  {
    id: 'svc-metier-cache',
    projetId: 'prj-metier',
    nom: 'redis',
    type: 'base',
    environnement: 'Production',
    statut: 'running',
    moteur: 'redis',
    version: '7.2',
    base: {
      nom: '—',
      utilisateur: 'default',
      motDePasse: 'Rd8-vQ4m-Lp07-nB2c',
      hoteInterne: 'svc-metier-cache.prj-metier.interne',
      port: 6379,
    },
    exposeExterne: { actif: false },
    ressources: { cpu: 1, ramMo: 2048, diskGo: 20 },
    emplacement: { site: 'ABJ', backend: 'CL-GRA-01', vms: ['cache-prod-01'] },
    derniereMaj: '2026-06-14T21:40:00Z',
    coutMensuel: 9800,
  },
  {
    id: 'svc-metier-worker',
    projetId: 'prj-metier',
    nom: 'worker-rapprochement',
    type: 'worker',
    environnement: 'Production',
    statut: 'failed',
    appId: 'app-batch',
    source: { type: 'git', ref: 'github.com/dba-africa/batch-worker', branche: 'main' },
    file: { nom: 'rapprochement', enAttente: 1284, traitesJour: 18400, echecsJour: 37, concurrence: 4 },
    ressources: { cpu: 2, ramMo: 4096, diskGo: 20 },
    emplacement: { site: 'ABJ', backend: 'CL-GRA-01', vms: ['worker-prod-01'] },
    derniereMaj: '2026-08-19T11:47:00Z',
    coutMensuel: 14200,
  },
  {
    id: 'svc-metier-cron',
    projetId: 'prj-metier',
    nom: 'cron-cloture',
    type: 'cron',
    environnement: 'Production',
    statut: 'running',
    cron: {
      expression: '0 2 * * *',
      lisible: 'chaque jour à 02:00',
      commande: 'node scripts/cloture-journaliere.js',
      derniereExecution: '2026-08-19T02:00:00Z',
      dureeS: 214,
      statut: 'ok',
      prochaine: '2026-08-20T02:00:00Z',
    },
    ressources: { cpu: 1, ramMo: 1024, diskGo: 10 },
    emplacement: { site: 'ABJ', backend: 'CL-GRA-01', vms: ['worker-prod-01'] },
    derniereMaj: '2026-08-12T09:30:00Z',
    coutMensuel: 3600,
  },

  // ── Plateforme métier · Préproduction
  {
    id: 'svc-metier-api-preprod',
    projetId: 'prj-metier',
    nom: 'api',
    type: 'application',
    environnement: 'Préproduction',
    statut: 'running',
    appId: 'app-metier',
    source: { type: 'git', ref: 'github.com/dba-africa/app-metier', branche: 'develop' },
    portConteneur: 3000,
    ressources: { cpu: 1, ramMo: 2048, diskGo: 20 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'dba-preprod' },
    derniereMaj: '2026-08-19T09:22:00Z',
    coutMensuel: 9400,
  },
  {
    id: 'svc-metier-db-preprod',
    projetId: 'prj-metier',
    nom: 'postgres',
    type: 'base',
    environnement: 'Préproduction',
    statut: 'running',
    moteur: 'postgresql',
    version: '16.4',
    base: {
      nom: 'app_metier_preprod',
      utilisateur: 'app_metier',
      motDePasse: 'Pp3-nH8k-Vt51-wD7q',
      hoteInterne: 'svc-metier-db-preprod.prj-metier.interne',
      port: 5432,
    },
    exposeExterne: {
      actif: true,
      port: 25432,
      sourcesAutorisees: ['102.176.20.0/24', '41.207.180.14/32'],
    },
    sauvegarde: {
      plan: 'Hebdomadaire',
      cron: '0 3 * * 0',
      destination: 'bkt-sauvegardes (GBM)',
      dernier: '2026-08-16T03:02:00Z',
      retentionJours: 14,
      taille: '4,1 Go',
    },
    ressources: { cpu: 2, ramMo: 4096, diskGo: 100 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'dba-preprod' },
    derniereMaj: '2026-07-28T22:18:00Z',
    coutMensuel: 14800,
  },

  // ── Présence web
  {
    id: 'svc-vitrine-site',
    projetId: 'prj-vitrine',
    nom: 'site',
    type: 'statique',
    environnement: 'Production',
    statut: 'running',
    appId: 'app-site',
    source: { type: 'image', ref: 'registre.synelia.cloud/dba/site-vitrine:1.14.2' },
    portConteneur: 80,
    ressources: { cpu: 1, ramMo: 512, diskGo: 10 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'dba-web' },
    derniereMaj: '2026-08-17T10:22:00Z',
    coutMensuel: 6200,
  },
  {
    id: 'svc-vitrine-site-preprod',
    projetId: 'prj-vitrine',
    nom: 'site',
    type: 'statique',
    environnement: 'Préproduction',
    statut: 'building',
    appId: 'app-site',
    source: { type: 'image', ref: 'registre.synelia.cloud/dba/site-vitrine:1.15.0-rc1' },
    portConteneur: 80,
    ressources: { cpu: 1, ramMo: 512, diskGo: 10 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'dba-web' },
    derniereMaj: '2026-08-19T15:18:00Z',
    coutMensuel: 3100,
  },

  // ── Données & analyse
  {
    id: 'svc-data-api',
    projetId: 'prj-data',
    nom: 'analytics',
    type: 'application',
    environnement: 'Production',
    statut: 'degraded',
    appId: 'app-analytics',
    source: { type: 'git', ref: 'git.dba.africa/data/analytics', branche: 'main' },
    portConteneur: 8000,
    ressources: { cpu: 4, ramMo: 8192, diskGo: 60 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'dba-analytics' },
    derniereMaj: '2026-08-18T18:38:00Z',
    coutMensuel: 34800,
  },
  {
    id: 'svc-data-entrepot',
    projetId: 'prj-data',
    nom: 'clickhouse',
    type: 'base',
    environnement: 'Production',
    statut: 'running',
    moteur: 'clickhouse',
    version: '24.8',
    base: {
      nom: 'entrepot',
      utilisateur: 'analytics',
      motDePasse: 'Ch2-bY6r-Kn38-jS4t',
      hoteInterne: 'svc-data-entrepot.prj-data.interne',
      port: 9000,
    },
    exposeExterne: { actif: false },
    sauvegarde: {
      plan: 'Quotidien immuable',
      cron: '30 1 * * *',
      destination: 'bkt-sauvegardes (GBM)',
      dernier: '2026-08-19T01:34:00Z',
      retentionJours: 30,
      taille: '112 Go',
    },
    ressources: { cpu: 8, ramMo: 32768, diskGo: 1000 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'dba-analytics' },
    derniereMaj: '2026-08-02T23:12:00Z',
    coutMensuel: 96000,
  },
  {
    id: 'svc-data-etl',
    projetId: 'prj-data',
    nom: 'cron-etl-nuit',
    type: 'cron',
    environnement: 'Production',
    statut: 'failed',
    cron: {
      expression: '0 0 * * *',
      lisible: 'chaque jour à 00:00',
      commande: 'python -m etl.run --source erp --cible entrepot',
      derniereExecution: '2026-08-19T00:00:00Z',
      dureeS: 1847,
      statut: 'echec',
      prochaine: '2026-08-20T00:00:00Z',
    },
    ressources: { cpu: 2, ramMo: 8192, diskGo: 40 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'dba-analytics' },
    derniereMaj: '2026-08-05T14:20:00Z',
    coutMensuel: 8400,
  },

  // ── Outillage interne
  {
    id: 'svc-outil-ci',
    projetId: 'prj-outillage',
    nom: 'ci-runners',
    type: 'application',
    environnement: 'Production',
    statut: 'running',
    appId: 'app-ci',
    source: { type: 'image', ref: 'docker:27-dind' },
    portConteneur: 2375,
    ressources: { cpu: 8, ramMo: 16384, diskGo: 200 },
    emplacement: { site: 'GBM', backend: 'PVE-PAR-01', vms: ['ci-runner-01', 'ci-runner-02'] },
    derniereMaj: '2026-08-14T09:12:00Z',
    coutMensuel: 26400,
  },
  {
    id: 'svc-sol-mail',
    projetId: 'prj-solutions',
    nom: 'messagerie',
    type: 'application',
    environnement: 'Production',
    statut: 'running',
    modeleSlug: 'zimbra',
    sieges: { attribues: 128, souscrits: 150 },
    source: { type: 'image', ref: 'synelia/zimbra:10.1.4' },
    portConteneur: 443,
    ressources: { cpu: 4, ramMo: 16384, diskGo: 500 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'prj-solutions-prod' },
    derniereMaj: '2026-07-22T22:14:00Z',
    coutMensuel: 78000,
    sauvegarde: {
      plan: 'Messagerie — quotidienne immuable',
      cron: '0 1 * * *',
      destination: 'Bucket immuable — Grand-Bassam',
      dernier: '2026-08-19T01:04:00Z',
      retentionJours: 30,
      taille: '284 Go',
    },
  },
  {
    id: 'svc-sol-erp',
    projetId: 'prj-solutions',
    nom: 'erp',
    type: 'application',
    environnement: 'Production',
    statut: 'running',
    modeleSlug: 'odoo',
    sieges: { attribues: 6, souscrits: 10 },
    source: { type: 'image', ref: 'synelia/odoo:18.0' },
    portConteneur: 8069,
    ressources: { cpu: 4, ramMo: 8192, diskGo: 200 },
    emplacement: { site: 'ABJ', backend: 'OS-GRA-02', namespace: 'prj-solutions-prod' },
    derniereMaj: '2026-08-02T23:41:00Z',
    coutMensuel: 96000,
    sauvegarde: {
      plan: 'ERP — quotidienne immuable',
      cron: '30 1 * * *',
      destination: 'Bucket immuable — Grand-Bassam',
      dernier: '2026-08-19T01:34:00Z',
      retentionJours: 90,
      taille: '41 Go',
    },
  },
  {
    id: 'svc-sol-ged',
    projetId: 'prj-solutions',
    nom: 'ged',
    type: 'application',
    environnement: 'Production',
    statut: 'building',
    modeleSlug: 'mayan',
    sieges: { attribues: 0, souscrits: 25 },
    source: { type: 'image', ref: 'synelia/mayan:4.8.3' },
    portConteneur: 8000,
    ressources: { cpu: 4, ramMo: 8192, diskGo: 500 },
    emplacement: { site: 'GBM', backend: 'PVE-PAR-01', namespace: 'prj-solutions-prod' },
    derniereMaj: '2026-08-19T14:52:00Z',
    coutMensuel: 68000,
  },
  {
    id: 'svc-outil-staging',
    projetId: 'prj-outillage',
    nom: 'bac-a-sable',
    type: 'application',
    environnement: 'Production',
    statut: 'stopped',
    appId: 'app-staging',
    source: { type: 'git', ref: 'github.com/dba-africa/app-metier', branche: 'develop' },
    portConteneur: 3000,
    ressources: { cpu: 2, ramMo: 4096, diskGo: 40 },
    emplacement: { site: 'GBM', backend: 'PVE-PAR-01', vms: ['staging-01'] },
    derniereMaj: '2026-08-11T16:04:00Z',
    coutMensuel: 0,
  },
]

/**
 * Zone offerte à l'organisation. Le sous-domaine générique existe pour que la
 * première mise en ligne ne dépende d'aucun achat : on déploie, l'URL répond,
 * on branche son propre domaine ensuite.
 */
export const ZONE_APPLICATIVE: ZoneApplicative = {
  zone: 'dba.synelia.app',
  wildcard: '*.dba.synelia.app',
  ingress: [
    { site: 'ABJ', ip: '102.176.20.40', ipv6: '2c0f:f7a8:12::28' },
    { site: 'GBM', ip: '102.176.44.12', ipv6: '2c0f:f7a8:44::0c' },
  ],
  certificat: {
    emetteur: "Let's Encrypt (ACME DNS-01)",
    renouvellementAuto: true,
    expire: '2026-10-28',
  },
  quotaDomaines: { utilises: 9, total: 50 },
}

export const DOMAINES_APPLICATIFS: DomaineApplicatif[] = [
  {
    id: 'dom-1',
    hote: 'api.dba.africa',
    origine: 'personnalise',
    serviceId: 'svc-metier-api',
    chemin: '/',
    portConteneur: 3000,
    https: true,
    certificat: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-11-02' },
    verification: {
      etat: 'ok',
      enregistrement: { type: 'A', nom: 'api.dba.africa', valeur: '102.176.20.40' },
      verifieLe: '2026-08-02T10:14:00Z',
    },
  },
  {
    id: 'dom-2',
    hote: 'api.dba.synelia.app',
    origine: 'genere',
    serviceId: 'svc-metier-api',
    chemin: '/',
    portConteneur: 3000,
    https: true,
    certificat: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-28' },
  },
  {
    id: 'dom-3',
    hote: 'api-preprod.dba.synelia.app',
    origine: 'genere',
    serviceId: 'svc-metier-api-preprod',
    chemin: '/',
    portConteneur: 3000,
    https: true,
    certificat: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-28' },
  },
  {
    id: 'dom-4',
    hote: 'www.dba.africa',
    origine: 'personnalise',
    serviceId: 'svc-vitrine-site',
    chemin: '/',
    portConteneur: 80,
    https: true,
    certificat: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-19' },
    verification: {
      etat: 'ok',
      enregistrement: { type: 'A', nom: 'www.dba.africa', valeur: '102.176.20.40' },
      verifieLe: '2026-06-02T08:40:00Z',
    },
    redirections: [{ de: 'dba.africa', vers: 'www.dba.africa', code: 301 }],
  },
  {
    id: 'dom-5',
    hote: 'site-preprod.dba.synelia.app',
    origine: 'genere',
    serviceId: 'svc-vitrine-site-preprod',
    chemin: '/',
    portConteneur: 80,
    https: true,
    certificat: { etat: 'en_emission', emetteur: "Let's Encrypt" },
  },
  {
    id: 'dom-6',
    hote: 'analytics.dba.africa',
    origine: 'personnalise',
    serviceId: 'svc-data-api',
    chemin: '/',
    portConteneur: 8000,
    https: true,
    certificat: { etat: 'aucun' },
    verification: {
      etat: 'attente',
      enregistrement: { type: 'A', nom: 'analytics.dba.africa', valeur: '102.176.20.40' },
      detail:
        'L’enregistrement n’est pas encore visible depuis nos résolveurs. La propagation dépend du TTL fixé chez votre bureau d’enregistrement.',
    },
  },
  {
    id: 'dom-7',
    hote: 'analytics.dba.synelia.app',
    origine: 'genere',
    serviceId: 'svc-data-api',
    chemin: '/',
    portConteneur: 8000,
    https: true,
    certificat: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-28' },
  },
  {
    id: 'dom-8',
    hote: 'ci.dba.synelia.app',
    origine: 'genere',
    serviceId: 'svc-outil-ci',
    chemin: '/',
    portConteneur: 2375,
    https: true,
    certificat: { etat: 'actif', emetteur: "Let's Encrypt", expire: '2026-10-28' },
  },
  {
    id: 'dom-9',
    hote: 'boutique.dba.africa',
    origine: 'personnalise',
    serviceId: 'svc-vitrine-site',
    chemin: '/boutique',
    portConteneur: 80,
    https: false,
    certificat: { etat: 'echec' },
    verification: {
      etat: 'echec',
      enregistrement: { type: 'A', nom: 'boutique.dba.africa', valeur: '102.176.20.40' },
      verifieLe: '2026-08-19T14:52:00Z',
      detail:
        'L’enregistrement pointe vers 41.207.180.14, qui n’est pas une adresse d’entrée Synelia. Le certificat ne peut pas être émis tant que la vérification échoue.',
      correlationId: 'req-7f3a91c4',
    },
  },
]

// ─── Libellés ─────────────────────────────────────────────────────────

export const TYPE_SERVICE_LABEL: Record<TypeServiceProjet, string> = {
  application: 'Application',
  base: 'Base de données',
  statique: 'Site statique',
  cron: 'Tâche planifiée',
  worker: 'Worker de file',
}

export const MOTEUR_LABEL: Record<MoteurBase, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  mongodb: 'MongoDB',
  redis: 'Redis',
  clickhouse: 'ClickHouse',
}

/** Schéma d'URI de connexion par moteur — affiché tel quel, jamais deviné. */
export const MOTEUR_URI: Record<MoteurBase, (b: NonNullable<ServiceProjet['base']>) => string> = {
  postgresql: (b) => `postgresql://${b.utilisateur}:••••••@${b.hoteInterne}:${b.port}/${b.nom}`,
  mysql: (b) => `mysql://${b.utilisateur}:••••••@${b.hoteInterne}:${b.port}/${b.nom}`,
  mariadb: (b) => `mysql://${b.utilisateur}:••••••@${b.hoteInterne}:${b.port}/${b.nom}`,
  mongodb: (b) => `mongodb://${b.utilisateur}:••••••@${b.hoteInterne}:${b.port}/${b.nom}`,
  redis: (b) => `redis://:••••••@${b.hoteInterne}:${b.port}`,
  clickhouse: (b) => `clickhouse://${b.utilisateur}:••••••@${b.hoteInterne}:${b.port}/${b.nom}`,
}

/** Moteurs proposables à la création, avec leur usage courant. */
export const MOTEURS_DISPONIBLES: Array<{
  moteur: MoteurBase
  versions: string[]
  usage: string
}> = [
  { moteur: 'postgresql', versions: ['17.0', '16.4', '15.8'], usage: 'Relationnel, extensions PostGIS et pgvector' },
  { moteur: 'mysql', versions: ['8.4', '8.0'], usage: 'Relationnel, compatibilité applicative large' },
  { moteur: 'mariadb', versions: ['11.4', '10.11'], usage: 'Relationnel, socle des CMS et boutiques' },
  { moteur: 'mongodb', versions: ['7.0', '6.0'], usage: 'Documents, jeu de réplicas' },
  { moteur: 'redis', versions: ['7.4', '7.2'], usage: 'Cache et file de messages' },
  { moteur: 'clickhouse', versions: ['24.8'], usage: 'Entrepôt colonne pour l’analytique' },
]

// ─── Accès ────────────────────────────────────────────────────────────

export const projetById = (id: string) => PROJETS.find((p) => p.id === id)

export const servicesDuProjet = (projetId: string) =>
  SERVICES_PROJET.filter((s) => s.projetId === projetId)

export const serviceProjetById = (id: string) => SERVICES_PROJET.find((s) => s.id === id)

export const domainesDuService = (serviceId: string) =>
  DOMAINES_APPLICATIFS.filter((d) => d.serviceId === serviceId)

/**
 * Adresse à laquelle les autres services du même projet joignent celui-ci —
 * jamais résolue depuis Internet. Une base la porte déjà (`base.hoteInterne`) ;
 * pour les autres types on la dérive du même gabarit `<id>.<projet>.interne`.
 * Un cron ou un worker n'écoutent aucun port entrant : pas d'adresse pour eux.
 */
export function urlInterneDuService(service: ServiceProjet): string | undefined {
  if (service.base) return `${service.base.hoteInterne}:${service.base.port}`
  if (service.type === 'cron' || service.type === 'worker') return undefined
  return `${service.id}.${service.projetId}.interne${service.portConteneur ? `:${service.portConteneur}` : ''}`
}

/** Service applicatif rattaché à une entrée APPLICATIONS, pour les liens croisés. */
export const serviceDeLApp = (appId: string) => SERVICES_PROJET.find((s) => s.appId === appId)

/**
 * Adresse de la fiche d'un service à partir de l'identifiant d'application.
 *
 * Les machines, les déploiements et la supervision désignent encore une
 * application par son identifiant historique ; la maille d'affichage est
 * désormais le service dans son projet.
 */
export const hrefDuService = (appId: string | undefined): string => {
  if (!appId) return '/app/applications/projets'
  const service = SERVICES_PROJET.find((s) => s.appId === appId)
  return service ? `/app/applications/projets/${service.projetId}/${service.id}` : '/app/applications/projets'
}

export const projetDeLApp = (appId: string) => {
  const svc = serviceDeLApp(appId)
  return svc ? projetById(svc.projetId) : undefined
}

export interface PointRestaurationService {
  id: string
  ts: string
  tailleGo: number
  type: 'complete' | 'incrementale'
  verifie: boolean
  immuableJusquau: string
}

/**
 * Historique de sauvegarde d'un service applicatif.
 *
 * Dérivé du plan porté par le service plutôt que saisi ligne à ligne : la
 * maquette a besoin d'un historique plausible, pas d'un journal réel. Le calcul
 * part de la dernière exécution connue et remonte d'un jour à la fois — aucune
 * date « maintenant », donc aucun risque de divergence entre serveur et client.
 */
export function pointsRestaurationDuService(
  serviceId: string,
  combien = 7,
): PointRestaurationService[] {
  const service = serviceProjetById(serviceId)
  if (!service?.sauvegarde) return []

  const base = Number(service.sauvegarde.taille.replace(/[^\d,.]/g, '').replace(',', '.')) || 1
  const jitter = seededSeries(`${serviceId}-taille`, combien, -8, 8)
  const dernier = new Date(service.sauvegarde.dernier)

  return Array.from({ length: combien }, (_, i) => {
    const ts = new Date(dernier)
    ts.setUTCDate(ts.getUTCDate() - i)
    const fin = new Date(ts)
    fin.setUTCDate(fin.getUTCDate() + service.sauvegarde!.retentionJours)
    return {
      id: `${serviceId}-rp-${i}`,
      ts: ts.toISOString(),
      tailleGo: Math.max(0.1, Math.round(base * (1 + jitter[i] / 100) * 10) / 10),
      // Une complète par semaine, des incrémentales entre les deux : c'est le
      // mode « incrémentale avec complète hebdomadaire » des plans réutilisables.
      type: i % 7 === 0 ? ('complete' as const) : ('incrementale' as const),
      verifie: i > 0 || service.statut !== 'failed',
      immuableJusquau: fin.toISOString().slice(0, 10),
    }
  })
}

/** Synthèse d'un projet, pour sa carte dans la liste. */
export function syntheseProjet(projetId: string) {
  return syntheseDeServices(servicesDuProjet(projetId))
}

/**
 * Mêmes agrégats, sur un jeu de services fourni : les écrans lisent le leur
 * dans l'atelier, qui contient les services créés pendant la session.
 */
export function syntheseDeServices(services: ServiceProjet[]) {
  return {
    services: services.length,
    parType: services.reduce<Record<string, number>>((acc, s) => {
      acc[s.type] = (acc[s.type] ?? 0) + 1
      return acc
    }, {}),
    enEchec: services.filter((s) => s.statut === 'failed').length,
    degrades: services.filter((s) => s.statut === 'degraded').length,
    arretes: services.filter((s) => s.statut === 'stopped').length,
    coutMensuel: services.reduce((a, s) => a + s.coutMensuel, 0),
    derniereMaj: services.reduce(
      (a, s) => (s.derniereMaj > a ? s.derniereMaj : a),
      '1970-01-01T00:00:00Z',
    ),
    domaines: services.flatMap((s) => domainesDuService(s.id)).length,
  }
}

/** Agrégats de la vue d'ensemble des projets. */
export const SYNTHESE_PROJETS = {
  projets: PROJETS.length,
  services: SERVICES_PROJET.length,
  enEchec: SERVICES_PROJET.filter((s) => s.statut === 'failed').length,
  domaines: DOMAINES_APPLICATIFS.length,
  domainesAVerifier: DOMAINES_APPLICATIFS.filter(
    (d) => d.verification && d.verification.etat !== 'ok',
  ).length,
  coutMensuel: SERVICES_PROJET.reduce((a, s) => a + s.coutMensuel, 0),
}
