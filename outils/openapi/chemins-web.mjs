/**
 * Chemins — Web Cloud : domaines, DNS, hébergement mutualisé, bases,
 * messagerie, drive, applications web, SSL, sauvegarde, relais SMTP.
 *
 * Règle du produit portée par ces chemins : **un domaine est attaché à un
 * serveur et à un seul.** C'est ce qui évite qu'un même nom réapparaisse dans
 * trois listes sans qu'aucune page ne dise tout ce qui le concerne.
 */

import {
  SITES,
  action,
  booleen,
  chaine,
  chemin,
  crud,
  entier,
  filtre,
  fusion,
  horodatage,
  jour,
  liste,
  nombre,
  objet,
  op,
  page,
  ref,
  tableau,
} from './socle.mjs'

const T_DOMAINES = 'Web Cloud — domaines & DNS'
const T_HEB = 'Web Cloud — hébergement'
const T_SITES = 'Web Cloud — applications web'
const T_BASES = 'Web Cloud — bases'
const T_MAIL = 'Web Cloud — emails'
const T_DRIVE = 'Web Cloud — drive'
const T_SSL = 'Web Cloud — SSL'
const T_BACKUP = 'Web Cloud — sauvegarde'
const T_SMTP = 'Web Cloud — relais SMTP'

const idDomaine = chemin('domaineId', 'Identifiant ou nom du domaine.', 'dba.africa')
const idZone = chemin('zoneId', 'Identifiant de la zone DNS.')
const idHeb = chemin('hebergementId', 'Identifiant de l’hébergement.', 'heb-dba')
const idSite = chemin('siteId', 'Identifiant du site web installé.', 'site-boutique')

// ─── Domaines et DNS ──────────────────────────────────────────────────

const domaines = fusion(
  {
    '/web/domaines': {
      get: op({
        tag: T_DOMAINES,
        id: 'listerDomaines',
        resume: 'Lister les domaines de l’organisation',
        paginee: true,
        params: [
          filtre('extension', chaine()),
          filtre('expireAvant', jour()),
          filtre('hebergementId', chaine()),
          filtre('renouvellementAuto', booleen()),
        ],
        ok: page(ref('Domaine')),
      }),
      post: op({
        tag: T_DOMAINES,
        id: 'commanderDomaine',
        resume: 'Commander un domaine',
        detail: 'Crée la zone DNS et, si demandé, attache le nom à un hébergement existant.',
        corps: ref('CommandeDomaine'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
        erreurs: [409, 402],
      }),
    },
    '/web/domaines/disponibilite': {
      get: op({
        tag: T_DOMAINES,
        id: 'verifierDisponibiliteDomaine',
        resume: 'Vérifier la disponibilité d’un nom',
        params: [
          filtre('nom', chaine(), 'Nom complet avec son extension.', true),
          filtre('extensions', chaine(), 'Extensions supplémentaires à tester, séparées par des virgules.'),
        ],
        ok: ref('DisponibiliteDomaine'),
        erreurs: [424],
      }),
    },
    '/web/domaines/transferts': {
      post: op({
        tag: T_DOMAINES,
        id: 'transfererDomaine',
        resume: 'Transférer un domaine entrant',
        corps: ref('TransfertDomaine'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
        erreurs: [409],
      }),
    },
    '/web/domaines/{domaineId}': {
      get: op({
        tag: T_DOMAINES,
        id: 'obtenirDomaine',
        resume: 'Obtenir un domaine',
        detail:
          'La fiche dit tout ce qui concerne le nom : hébergement attaché, zone DNS, messagerie, ' +
          'drive, certificats, sauvegarde.',
        params: [idDomaine],
        ok: objet(
          {
            domaine: ref('Domaine'),
            zone: ref('ZoneDns'),
            hebergement: ref('Hebergement'),
            messagerie: ref('Messagerie'),
            drive: ref('Drive'),
            certificats: tableau(ref('Certificat')),
            sites: tableau(ref('SiteWeb')),
          },
          ['domaine'],
        ),
      }),
      patch: op({
        tag: T_DOMAINES,
        id: 'modifierDomaine',
        resume: 'Modifier un domaine',
        params: [idDomaine],
        corps: objet({
          renouvellementAuto: booleen(),
          whoisProtege: booleen(),
          verrouTransfert: booleen(),
          hebergementId: chaine('Attache le nom à un hébergement — un seul serveur par domaine.'),
        }),
        ok: ref('Domaine'),
        rbac: 'network.manage',
      }),
    },
  },
  action({
    tag: T_DOMAINES,
    chemin: '/web/domaines/{domaineId}/renouvellement',
    id: 'renouvelerDomaine',
    resume: 'Renouveler un domaine',
    params: [idDomaine],
    corps: objet({ dureeAnnees: entier() }, ['dureeAnnees']),
    corpsRequis: true,
    rbac: 'marketplace.subscribe',
    erreurs: [402],
  }),
  action({
    tag: T_DOMAINES,
    chemin: '/web/domaines/{domaineId}/code-auth',
    id: 'obtenirCodeAuthDomaine',
    resume: 'Obtenir le code d’autorisation de transfert sortant',
    detail: 'La réversibilité fait partie de l’offre : le code est délivré sans friction.',
    params: [idDomaine],
    ok: objet({ code: chaine(), expire: horodatage() }, ['code']),
    code: 200,
    rbac: 'network.manage',
  }),
  {
    '/web/dns': {
      get: op({
        tag: T_DOMAINES,
        id: 'listerZonesDns',
        resume: 'Lister les zones DNS',
        paginee: true,
        params: [filtre('dnssec', booleen())],
        ok: page(ref('ZoneDns')),
      }),
      post: op({
        tag: T_DOMAINES,
        id: 'creerZoneDns',
        resume: 'Créer une zone DNS',
        detail: 'Utile pour un domaine géré ailleurs dont on veut confier la zone à Synelia.',
        corps: objet({ domaine: chaine(), importerExistant: booleen() }, ['domaine']),
        ok: ref('ZoneDns'),
        code: 201,
        rbac: 'network.manage',
        erreurs: [409],
      }),
    },
    '/web/dns/{zoneId}': {
      get: op({
        tag: T_DOMAINES,
        id: 'obtenirZoneDns',
        resume: 'Obtenir une zone DNS',
        params: [idZone],
        ok: ref('ZoneDns'),
      }),
      delete: op({
        tag: T_DOMAINES,
        id: 'supprimerZoneDns',
        resume: 'Supprimer une zone DNS',
        detail: 'Action destructive : la résolution du domaine cesse dès la propagation.',
        params: [idZone],
        destructif: true,
        code: 204,
        rbac: 'network.manage',
      }),
    },
    '/web/dns/{zoneId}/enregistrements': {
      post: op({
        tag: T_DOMAINES,
        id: 'creerEnregistrementDns',
        resume: 'Ajouter un enregistrement DNS',
        params: [idZone],
        corps: ref('EnregistrementDnsCreation'),
        ok: ref('ZoneDns'),
        code: 201,
        rbac: 'network.manage',
        erreurs: [409],
      }),
      put: op({
        tag: T_DOMAINES,
        id: 'remplacerEnregistrementsDns',
        resume: 'Remplacer tous les enregistrements d’une zone',
        detail: 'Import en masse. La réponse liste les différences appliquées.',
        params: [idZone],
        corps: objet(
          { enregistrements: tableau(ref('EnregistrementDnsCreation')), format: liste(['json', 'bind']) },
          ['enregistrements'],
        ),
        ok: ref('ZoneDns'),
        rbac: 'network.manage',
      }),
    },
    '/web/dns/{zoneId}/enregistrements/{enregistrementId}': {
      patch: op({
        tag: T_DOMAINES,
        id: 'modifierEnregistrementDns',
        resume: 'Modifier un enregistrement DNS',
        params: [idZone, chemin('enregistrementId', 'Identifiant de l’enregistrement.')],
        corps: ref('EnregistrementDnsCreation'),
        ok: ref('ZoneDns'),
        rbac: 'network.manage',
      }),
      delete: op({
        tag: T_DOMAINES,
        id: 'supprimerEnregistrementDns',
        resume: 'Supprimer un enregistrement DNS',
        params: [idZone, chemin('enregistrementId', 'Identifiant de l’enregistrement.')],
        code: 204,
        rbac: 'network.manage',
      }),
    },
    '/web/dns/modeles': {
      get: op({
        tag: T_DOMAINES,
        id: 'listerModelesDns',
        resume: 'Lister les modèles d’enregistrements',
        detail: 'Jeux prêts à appliquer : messagerie, vérification de service, redirection.',
        ok: tableau(ref('ModeleDns')),
      }),
    },
    '/web/dns/{zoneId}/dnssec': {
      put: op({
        tag: T_DOMAINES,
        id: 'modifierDnssec',
        resume: 'Activer ou désactiver DNSSEC',
        params: [idZone],
        corps: objet({ actif: booleen() }, ['actif']),
        ok: ref('ZoneDns'),
        rbac: 'network.manage',
        erreurs: [409],
      }),
    },
  },
  action({
    tag: T_DOMAINES,
    chemin: '/web/dns/{zoneId}/modeles/{modeleId}',
    id: 'appliquerModeleDns',
    resume: 'Appliquer un modèle d’enregistrements',
    params: [idZone, chemin('modeleId', 'Identifiant du modèle.')],
    corps: objet({ remplacerExistants: booleen() }),
    ok: ref('ZoneDns'),
    code: 200,
    rbac: 'network.manage',
  }),
)

// ─── Hébergement mutualisé ────────────────────────────────────────────

const hebergement = fusion(
  crud({
    tag: T_HEB,
    base: '/web/hebergements',
    idParam: idHeb,
    nomSingulier: 'Hebergement',
    nomPluriel: 'Hebergements',
    libelle: 'un hébergement web',
    libellePluriel: 'les hébergements web',
    schema: 'Hebergement',
    creation: 'HebergementCreation',
    modification: 'HebergementCreation',
    creationAsync: true,
    suppressionAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'marketplace.subscribe',
    filtres: [
      filtre('site', liste(SITES)),
      filtre('statut', liste(['en_ligne', 'maintenance', 'suspendu'])),
      filtre('palier', chaine()),
    ],
  }),
  {
    '/web/hebergements/{hebergementId}/php': {
      put: op({
        tag: T_HEB,
        id: 'modifierPhp',
        resume: 'Régler PHP',
        detail:
          'Version, extensions et limites. Régler PHP et installer une application sont deux ' +
          'intentions distinctes : elles ne partagent pas d’écran.',
        params: [idHeb],
        corps: ref('ReglagesPhp'),
        ok: ref('Hebergement'),
        rbac: 'service.admin',
        erreurs: [409],
      }),
    },
    '/web/hebergements/{hebergementId}/acces': {
      put: op({
        tag: T_HEB,
        id: 'modifierAccesHebergement',
        resume: 'Activer ou fermer les protocoles de transfert',
        params: [idHeb],
        corps: ref('ReglagesAcces'),
        ok: ref('Hebergement'),
        rbac: 'service.admin',
      }),
    },
    '/web/hebergements/{hebergementId}/comptes-fichiers': {
      get: op({
        tag: T_HEB,
        id: 'listerComptesFichiers',
        resume: 'Lister les comptes de transfert',
        params: [idHeb],
        ok: tableau(ref('CompteFichiers')),
      }),
      post: op({
        tag: T_HEB,
        id: 'creerCompteFichiers',
        resume: 'Créer un compte de transfert',
        params: [idHeb],
        corps: ref('CompteFichiersCreation'),
        ok: ref('CompteFichiers'),
        code: 201,
        rbac: 'service.admin',
        erreurs: [409],
      }),
    },
    '/web/hebergements/{hebergementId}/comptes-fichiers/{compteId}': {
      patch: op({
        tag: T_HEB,
        id: 'modifierCompteFichiers',
        resume: 'Modifier un compte de transfert',
        params: [idHeb, chemin('compteId', 'Identifiant du compte.')],
        corps: ref('CompteFichiersCreation'),
        ok: ref('CompteFichiers'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_HEB,
        id: 'supprimerCompteFichiers',
        resume: 'Supprimer un compte de transfert',
        params: [idHeb, chemin('compteId', 'Identifiant du compte.')],
        destructif: true,
        code: 204,
        rbac: 'service.admin',
      }),
    },
    '/web/hebergements/{hebergementId}/taches': {
      get: op({
        tag: T_HEB,
        id: 'listerTachesWeb',
        resume: 'Lister les tâches planifiées',
        params: [idHeb],
        ok: tableau(ref('TachePlanifieeWeb')),
      }),
      post: op({
        tag: T_HEB,
        id: 'creerTacheWeb',
        resume: 'Créer une tâche planifiée',
        params: [idHeb],
        corps: ref('TachePlanifieeWebCreation'),
        ok: ref('TachePlanifieeWeb'),
        code: 201,
        rbac: 'service.admin',
      }),
    },
    '/web/hebergements/{hebergementId}/taches/{tacheId}': {
      patch: op({
        tag: T_HEB,
        id: 'modifierTacheWeb',
        resume: 'Modifier une tâche planifiée',
        params: [idHeb, chemin('tacheId', 'Identifiant de la tâche.')],
        corps: ref('TachePlanifieeWebCreation'),
        ok: ref('TachePlanifieeWeb'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_HEB,
        id: 'supprimerTacheWeb',
        resume: 'Supprimer une tâche planifiée',
        params: [idHeb, chemin('tacheId', 'Identifiant de la tâche.')],
        code: 204,
        rbac: 'service.admin',
      }),
    },
    '/web/hebergements/{hebergementId}/services-partages': {
      get: op({
        tag: T_HEB,
        id: 'listerServicesPartages',
        resume: 'Lister les services partagés du domaine',
        detail: 'Messagerie et drive mutualisés, fixés au domaine plutôt qu’à un projet.',
        params: [idHeb],
        ok: tableau(ref('ServicePartage')),
      }),
    },
    '/web/hebergements/{hebergementId}/metriques': {
      get: op({
        tag: T_HEB,
        id: 'obtenirMetriquesHebergement',
        resume: 'Obtenir les séries d’un hébergement',
        params: [idHeb, { $ref: '#/components/parameters/Fenetre' }],
        ok: objet({ tuiles: tableau(ref('Tuile')), series: tableau(ref('Serie')), liens: ref('LiensSortie') }, ['series']),
        erreurs: [424],
      }),
    },
  },
  action({
    tag: T_HEB,
    chemin: '/web/hebergements/{hebergementId}/taches/{tacheId}/execution',
    id: 'executerTacheWeb',
    resume: 'Exécuter une tâche planifiée sur demande',
    params: [idHeb, chemin('tacheId', 'Identifiant de la tâche.')],
    rbac: 'service.admin',
  }),
  action({
    tag: T_HEB,
    chemin: '/web/hebergements/{hebergementId}/redemarrage',
    id: 'redemarrerHebergement',
    resume: 'Redémarrer les services du serveur',
    detail: 'Coupure de quelques secondes sur tous les sites du serveur : la confirmation est exigée.',
    params: [idHeb],
    corps: objet({ services: tableau(liste(['web', 'php', 'base'])) }),
    destructif: true,
    rbac: 'service.admin',
  }),
  action({
    tag: T_HEB,
    chemin: '/web/hebergements/{hebergementId}/attachement-domaine',
    id: 'attacherDomaineHebergement',
    resume: 'Attacher un domaine à l’hébergement',
    detail:
      'Remplace le nom provisoire. Un domaine ne peut être attaché qu’à un seul serveur : ' +
      's’il l’est déjà ailleurs, la réponse le dit et n’attache rien.',
    params: [idHeb],
    corps: objet({ domaine: chaine(), migrerSites: booleen() }, ['domaine']),
    corpsRequis: true,
    ok: ref('Hebergement'),
    code: 200,
    rbac: 'network.manage',
    erreurs: [409],
  }),
)

// ─── Applications web installées ──────────────────────────────────────

const sitesWeb = fusion(
  {
    '/web/sites': {
      get: op({
        tag: T_SITES,
        id: 'listerSitesWeb',
        resume: 'Lister les applications web installées',
        paginee: true,
        params: [
          filtre('hebergementId', chaine()),
          filtre('type', liste(['wordpress', 'prestashop', 'php', 'statique', 'laravel'])),
          filtre('majEnAttente', booleen()),
        ],
        ok: page(ref('SiteWeb')),
      }),
      post: op({
        tag: T_SITES,
        id: 'installerSiteWeb',
        resume: 'Installer une application web',
        detail:
          'WordPress, PrestaShop, Laravel ou un site statique. Le portail installe et met à ' +
          'jour ; il n’ouvre pas l’éditeur de contenu du produit.',
        corps: objet(
          {
            hebergementId: chaine(),
            site: ref('SiteWebCreation'),
          },
          ['hebergementId', 'site'],
        ),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'service.admin',
        erreurs: [409, 402, 404],
      }),
    },
    '/web/sites/{siteId}': {
      get: op({
        tag: T_SITES,
        id: 'obtenirSiteWeb',
        resume: 'Obtenir une application web',
        params: [idSite],
        ok: ref('SiteWeb'),
      }),
      patch: op({
        tag: T_SITES,
        id: 'modifierSiteWeb',
        resume: 'Modifier une application web',
        params: [idSite],
        corps: objet({
          phpVersion: chaine(),
          racine: chaine(),
          securite: objet({ waf: booleen(), bruteForce: booleen(), scanMalware: booleen() }),
          statut: liste(['en_ligne', 'maintenance']),
        }),
        ok: ref('SiteWeb'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_SITES,
        id: 'supprimerSiteWeb',
        resume: 'Supprimer une application web',
        detail: 'Les fichiers et la base associée sont détruits : le nom exact du site est exigé.',
        params: [idSite],
        destructif: true,
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'service.admin',
      }),
    },
  },
  {
    '/web/sites/{siteId}/mises-a-jour': {
      get: op({
        tag: T_SITES,
        id: 'listerMisesAJourSiteWeb',
        resume: 'Lister les mises à jour en attente',
        detail:
          'Cœur, extensions, thèmes et traductions, avec ce qui relève d’un correctif de sécurité — ' +
          'celui-là ne se remet pas à la prochaine fenêtre.',
        params: [idSite, filtre('securiteSeulement', booleen())],
        ok: tableau(ref('MiseAJourSite')),
        erreurs: [424],
      }),
    },
  },
  action({
    tag: T_SITES,
    chemin: '/web/sites/{siteId}/mise-a-jour',
    id: 'mettreAJourSiteWeb',
    resume: 'Appliquer les mises à jour disponibles',
    detail: 'Un instantané est pris avant application, pour pouvoir revenir en arrière.',
    params: [idSite],
    corps: objet({ coeur: booleen(), extensions: booleen(), themes: booleen(), instantaneAvant: booleen() }),
    rbac: 'service.admin',
  }),
  action({
    tag: T_SITES,
    chemin: '/web/sites/{siteId}/preproduction',
    id: 'creerPreproductionSiteWeb',
    resume: 'Créer ou rafraîchir la préproduction',
    params: [idSite],
    corps: objet({ copierBase: booleen(), protegerParMotDePasse: booleen() }),
    rbac: 'service.admin',
  }),
  action({
    tag: T_SITES,
    chemin: '/web/sites/{siteId}/mise-en-production',
    id: 'publierPreproductionSiteWeb',
    resume: 'Publier la préproduction en production',
    detail: 'Écrase la production : la confirmation par le nom du site est exigée.',
    params: [idSite],
    corps: objet({ inclureBase: booleen() }),
    destructif: true,
    rbac: 'service.admin',
    erreurs: [409],
  }),
  action({
    tag: T_SITES,
    chemin: '/web/sites/{siteId}/analyse-securite',
    id: 'analyserSecuriteSiteWeb',
    resume: 'Lancer une analyse de sécurité',
    params: [idSite],
    rbac: 'service.admin',
  }),
)

// ─── Bases de l'hébergement ───────────────────────────────────────────

const basesWeb = fusion(
  {
    '/web/bases': {
      get: op({
        tag: T_BASES,
        id: 'listerServeursBases',
        resume: 'Lister les serveurs de bases des hébergements',
        detail:
          'Aucun accès distant : chaque serveur n’écoute que sur la boucle locale de son ' +
          'hébergement. C’est une propriété de l’offre, pas un réglage à activer.',
        paginee: true,
        params: [filtre('hebergementId', chaine()), filtre('moteur', liste(['mariadb', 'postgresql', 'redis'])), filtre('actif', booleen())],
        ok: page(ref('ServeurBases')),
      }),
    },
    '/web/bases/{serveurId}': {
      get: op({
        tag: T_BASES,
        id: 'obtenirServeurBases',
        resume: 'Obtenir un serveur de bases',
        params: [chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria')],
        ok: ref('ServeurBases'),
      }),
      patch: op({
        tag: T_BASES,
        id: 'modifierServeurBases',
        resume: 'Activer un moteur ou changer son quota',
        params: [chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria')],
        corps: objet({ actif: booleen(), quotaMo: nombre(), version: chaine() }),
        ok: ref('ServeurBases'),
        rbac: 'service.admin',
        erreurs: [402],
      }),
    },
    '/web/bases/{serveurId}/bases': {
      post: op({
        tag: T_BASES,
        id: 'creerBaseHebergement',
        resume: 'Créer une base sur l’hébergement',
        params: [chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria')],
        corps: ref('BaseHebergementCreation'),
        ok: ref('BaseHebergement'),
        code: 201,
        rbac: 'service.admin',
        erreurs: [409, 402],
      }),
    },
    '/web/bases/{serveurId}/bases/{baseNom}': {
      delete: op({
        tag: T_BASES,
        id: 'supprimerBaseHebergement',
        resume: 'Supprimer une base de l’hébergement',
        params: [chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria'), chemin('baseNom', 'Nom de la base.')],
        destructif: true,
        code: 204,
        rbac: 'service.admin',
        erreurs: [409],
      }),
    },
    '/web/bases/{serveurId}/utilisateurs': {
      post: op({
        tag: T_BASES,
        id: 'creerUtilisateurBaseHebergement',
        resume: 'Créer un utilisateur de base',
        params: [chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria')],
        corps: objet(
          {
            nom: chaine(),
            motDePasse: chaine(),
            base: chaine(),
            droits: liste(['complet', 'lecture', 'ecriture']),
          },
          ['nom', 'motDePasse', 'base', 'droits'],
        ),
        ok: ref('ServeurBases'),
        code: 201,
        rbac: 'service.admin',
      }),
    },
    '/web/bases/{serveurId}/utilisateurs/{utilisateurNom}': {
      patch: op({
        tag: T_BASES,
        id: 'modifierUtilisateurBaseHebergement',
        resume: 'Changer les droits ou le mot de passe d’un utilisateur',
        params: [
          chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria'),
          chemin('utilisateurNom', 'Nom de l’utilisateur.'),
        ],
        corps: objet({ motDePasse: chaine(), droits: liste(['complet', 'lecture', 'ecriture']) }),
        ok: ref('ServeurBases'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_BASES,
        id: 'supprimerUtilisateurBaseHebergement',
        resume: 'Supprimer un utilisateur de base',
        params: [
          chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria'),
          chemin('utilisateurNom', 'Nom de l’utilisateur.'),
        ],
        code: 204,
        rbac: 'service.admin',
      }),
    },
  },
  action({
    tag: T_BASES,
    chemin: '/web/bases/{serveurId}/bases/{baseNom}/export',
    id: 'exporterBaseHebergement',
    resume: 'Exporter une base',
    detail: 'Produit une archive téléchargeable ; le portail n’expose pas de console SQL.',
    params: [chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria'), chemin('baseNom', 'Nom de la base.')],
    corps: objet({ format: liste(['sql', 'sql_gz', 'csv']) }),
    rbac: 'service.admin',
  }),
  action({
    tag: T_BASES,
    chemin: '/web/bases/{serveurId}/bases/{baseNom}/import',
    id: 'importerBaseHebergement',
    resume: 'Importer un jeu de données dans une base',
    detail: 'Écrase le contenu existant : la confirmation par le nom de la base est exigée.',
    params: [chemin('serveurId', 'Identifiant du serveur de bases.', 'db-dba-maria'), chemin('baseNom', 'Nom de la base.')],
    corps: objet({ archiveId: chaine('Identifiant de l’archive téléversée.') }, ['archiveId']),
    corpsRequis: true,
    destructif: true,
    rbac: 'service.admin',
  }),
)

// ─── Messagerie ───────────────────────────────────────────────────────

const emails = fusion(
  {
    '/web/emails': {
      get: op({
        tag: T_MAIL,
        id: 'listerMessageries',
        resume: 'Lister les messageries de domaine',
        paginee: true,
        params: [filtre('domaine', chaine()), filtre('actif', booleen())],
        ok: page(ref('Messagerie')),
      }),
      post: op({
        tag: T_MAIL,
        id: 'activerMessagerie',
        resume: 'Activer la messagerie d’un domaine',
        corps: objet(
          { domaine: chaine(), palier: chaine(), boites: entier(), migrationDepuis: chaine() },
          ['domaine', 'palier'],
        ),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
        erreurs: [409, 402],
      }),
    },
    '/web/emails/{messagerieId}': {
      get: op({
        tag: T_MAIL,
        id: 'obtenirMessagerie',
        resume: 'Obtenir une messagerie',
        params: [chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa')],
        ok: ref('Messagerie'),
      }),
      patch: op({
        tag: T_MAIL,
        id: 'modifierMessagerie',
        resume: 'Régler la messagerie d’un domaine',
        detail:
          'Politiques seulement : antispam, attrape-tout, palier. Le portail ne montre aucun ' +
          'message — le webmail reste l’interface de lecture.',
        params: [chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa')],
        corps: objet({
          palier: chaine(),
          attrapeTout: chaine(),
          antispam: objet({
            actif: booleen(),
            niveau: liste(['permissif', 'standard', 'strict']),
          }),
        }),
        ok: ref('Messagerie'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_MAIL,
        id: 'supprimerMessagerie',
        resume: 'Supprimer une messagerie',
        detail: 'Action destructive : le domaine Zimbra et ses boîtes sont détruits ; le nom exact de la ressource est exigé en confirmation.',
        params: [chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa')],
        ok: ref('TravailProvisioning'),
        code: 202,
        destructif: true,
        rbac: 'marketplace.subscribe',
        erreurs: [409],
      }),
    },
    '/web/emails/{messagerieId}/boites': {
      post: op({
        tag: T_MAIL,
        id: 'creerBoiteMail',
        resume: 'Créer une boîte aux lettres',
        params: [chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa')],
        corps: ref('BoiteMailCreation'),
        ok: ref('BoiteMail'),
        code: 201,
        rbac: 'seat.assign',
        erreurs: [409, 402],
      }),
    },
    '/web/emails/{messagerieId}/boites/{adresse}': {
      patch: op({
        tag: T_MAIL,
        id: 'modifierBoiteMail',
        resume: 'Modifier une boîte aux lettres',
        params: [
          chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa'),
          chemin('adresse', 'Adresse complète de la boîte.'),
        ],
        corps: objet({
          nom: chaine(),
          quotaGo: nombre(),
          motDePasse: chaine(),
          statut: liste(['active', 'suspendue', 'archivee']),
          mfa: booleen(),
        }),
        ok: ref('BoiteMail'),
        rbac: 'seat.assign',
      }),
      delete: op({
        tag: T_MAIL,
        id: 'supprimerBoiteMail',
        resume: 'Supprimer une boîte aux lettres',
        detail: 'Le contenu est détruit après le délai de rétention du palier : l’adresse exacte est exigée.',
        params: [
          chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa'),
          chemin('adresse', 'Adresse complète de la boîte.'),
        ],
        destructif: true,
        code: 204,
        rbac: 'seat.assign',
      }),
    },
    '/web/emails/{messagerieId}/alias': {
      put: op({
        tag: T_MAIL,
        id: 'modifierAliasMessagerie',
        resume: 'Définir les alias et redirections',
        params: [chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa')],
        corps: objet({
          alias: tableau(objet({ de: chaine(), vers: tableau(chaine()) }, ['de', 'vers'])),
          redirections: tableau(objet({ de: chaine(), vers: chaine(), copie: booleen() }, ['de', 'vers'])),
        }),
        ok: ref('Messagerie'),
        rbac: 'service.admin',
      }),
    },
  },
  action({
    tag: T_MAIL,
    chemin: '/web/emails/{messagerieId}/authentification/verification',
    id: 'verifierAuthentificationMessagerie',
    resume: 'Vérifier SPF, DKIM et DMARC',
    detail: 'Renvoie l’état constaté et les enregistrements exacts à créer quand ils manquent.',
    params: [chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa')],
    ok: objet(
      {
        spf: liste(['valide', 'absent', 'invalide']),
        dkim: liste(['valide', 'absent']),
        dmarc: chaine(),
        aCreer: tableau(ref('EnregistrementDnsCreation')),
      },
      ['spf', 'dkim', 'dmarc'],
    ),
    code: 200,
    erreurs: [424],
  }),
  action({
    tag: T_MAIL,
    chemin: '/web/emails/{messagerieId}/ouverture',
    id: 'ouvrirWebmail',
    resume: 'Ouvrir le webmail en SSO',
    params: [chemin('messagerieId', 'Identifiant de la messagerie.', 'mail-dba-africa')],
    corps: objet({ adresse: chaine('Boîte à ouvrir ; par défaut celle du compte appelant.') }),
    ok: ref('OuvertureService'),
    code: 201,
    rbac: 'service.open',
  }),
)

// ─── Drive ────────────────────────────────────────────────────────────

const drive = fusion(
  {
    '/web/drive': {
      get: op({
        tag: T_DRIVE,
        id: 'listerDrives',
        resume: 'Lister les drives de domaine',
        paginee: true,
        params: [filtre('domaine', chaine()), filtre('actif', booleen())],
        ok: page(ref('Drive')),
      }),
      post: op({
        tag: T_DRIVE,
        id: 'activerDrive',
        resume: 'Activer le drive d’un domaine',
        corps: objet({ domaine: chaine(), palier: chaine(), sieges: entier() }, ['domaine', 'palier']),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
        erreurs: [409, 402],
      }),
    },
    '/web/drive/{driveId}': {
      get: op({
        tag: T_DRIVE,
        id: 'obtenirDrive',
        resume: 'Obtenir un drive',
        params: [chemin('driveId', 'Identifiant du drive.', 'drive-dba-africa')],
        ok: ref('Drive'),
      }),
      patch: op({
        tag: T_DRIVE,
        id: 'modifierDrive',
        resume: 'Régler le partage et la rétention d’un drive',
        detail:
          'Politiques de partage, versions et corbeille. Le portail ne liste aucun fichier : ' +
          'ce serait reconstruire un explorateur.',
        params: [chemin('driveId', 'Identifiant du drive.', 'drive-dba-africa')],
        corps: objet({
          palier: chaine(),
          partage: objet({
            externeAutorise: booleen(),
            motDePasseObligatoire: booleen(),
            expirationJours: entier(),
          }),
          versionsFichiers: objet({ actif: booleen(), retentionJours: entier() }),
          corbeille: objet({ retentionJours: entier() }),
        }),
        ok: ref('Drive'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_DRIVE,
        id: 'desactiverDrive',
        resume: 'Désactiver le drive d’un domaine',
        detail: 'Action destructive : le serveur Nextcloud est détruit ; le nom exact de la ressource est exigé en confirmation.',
        params: [chemin('driveId', 'Identifiant du drive.', 'drive-dba-africa')],
        ok: ref('TravailProvisioning'),
        code: 202,
        destructif: true,
        rbac: 'service.admin',
        erreurs: [409],
      }),
    },
    '/web/drive/{driveId}/sieges': {
      get: op({
        tag: T_DRIVE,
        id: 'listerSiegesDrive',
        resume: 'Lister les sièges attribués d’un drive',
        params: [chemin('driveId', 'Identifiant du drive.', 'drive-dba-africa')],
        ok: tableau(ref('Siege')),
      }),
      post: op({
        tag: T_DRIVE,
        id: 'attribuerSiegeDrive',
        resume: 'Attribuer un siège de drive',
        params: [chemin('driveId', 'Identifiant du drive.', 'drive-dba-africa')],
        corps: ref('SiegeAttribution'),
        ok: ref('Siege'),
        code: 201,
        rbac: 'seat.assign',
        erreurs: [409, 402],
      }),
    },
  },
  action({
    tag: T_DRIVE,
    chemin: '/web/drive/{driveId}/ouverture',
    id: 'ouvrirDrive',
    resume: 'Ouvrir le drive en SSO',
    params: [chemin('driveId', 'Identifiant du drive.', 'drive-dba-africa')],
    ok: ref('OuvertureService'),
    code: 201,
    rbac: 'service.open',
  }),
)

// ─── SSL ──────────────────────────────────────────────────────────────

const ssl = fusion(
  {
    '/web/ssl': {
      get: op({
        tag: T_SSL,
        id: 'listerCertificats',
        resume: 'Lister les certificats',
        paginee: true,
        params: [
          filtre('hebergementId', chaine()),
          filtre('etat', liste(['actif', 'en_emission', 'expire', 'revoque'])),
          filtre('expireAvant', jour()),
          filtre('type', liste(['letsencrypt', 'dv', 'ov', 'ev', 'wildcard'])),
        ],
        ok: page(ref('Certificat')),
      }),
      post: op({
        tag: T_SSL,
        id: 'commanderCertificat',
        resume: 'Commander un certificat',
        detail:
          'Un certificat Let’s Encrypt est gratuit et automatique ; un DV, OV ou EV a une ' +
          'échéance commerciale en plus de la technique.',
        corps: ref('CertificatCommande'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
        erreurs: [409, 402],
      }),
    },
    '/web/ssl/{certificatId}': {
      get: op({
        tag: T_SSL,
        id: 'obtenirCertificat',
        resume: 'Obtenir un certificat',
        params: [chemin('certificatId', 'Identifiant du certificat.', 'crt-wildcard')],
        ok: ref('Certificat'),
      }),
      patch: op({
        tag: T_SSL,
        id: 'modifierCertificat',
        resume: 'Modifier un certificat',
        params: [chemin('certificatId', 'Identifiant du certificat.', 'crt-wildcard')],
        corps: objet({ renouvellementAuto: booleen(), hebergementId: chaine() }),
        ok: ref('Certificat'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_SSL,
        id: 'revoquerCertificat',
        resume: 'Révoquer un certificat',
        detail: 'Les sites servis par ce certificat basculent en HTTP jusqu’au remplacement.',
        params: [chemin('certificatId', 'Identifiant du certificat.', 'crt-wildcard')],
        destructif: true,
        code: 204,
        rbac: 'service.admin',
      }),
    },
    '/web/ssl/offres': {
      get: op({
        tag: T_SSL,
        id: 'listerOffresCertificat',
        resume: 'Lister les offres de certificat',
        portee: 'client',
        ok: tableau(
          objet(
            {
              type: liste(['letsencrypt', 'dv', 'ov', 'ev', 'wildcard']),
              nom: chaine(),
              emetteur: chaine(),
              prixAnnuel: entier(),
              delaiEmission: chaine(),
              garantie: chaine(),
              caracteristiques: tableau(chaine()),
            },
            ['type', 'nom', 'emetteur', 'prixAnnuel'],
          ),
        ),
      }),
    },
  },
  action({
    tag: T_SSL,
    chemin: '/web/ssl/{certificatId}/renouvellement',
    id: 'renouvelerCertificat',
    resume: 'Renouveler un certificat',
    params: [chemin('certificatId', 'Identifiant du certificat.', 'crt-wildcard')],
    corps: objet({ dureeAnnees: entier() }),
    rbac: 'service.admin',
    erreurs: [402],
  }),
  action({
    tag: T_SSL,
    chemin: '/web/ssl/{certificatId}/validation',
    id: 'relancerValidationCertificat',
    resume: 'Relancer la validation de domaine',
    detail: 'Renvoie l’enregistrement ou le fichier de validation attendu quand il manque encore.',
    params: [chemin('certificatId', 'Identifiant du certificat.', 'crt-wildcard')],
    ok: objet(
      {
        etat: liste(['ok', 'attente', 'echec']),
        methode: liste(['dns', 'http', 'email']),
        enregistrement: ref('EnregistrementDnsCreation'),
        detail: chaine(),
        correlationId: chaine(),
      },
      ['etat', 'methode'],
    ),
    code: 200,
    rbac: 'service.admin',
  }),
)

// ─── Sauvegarde Web Cloud ─────────────────────────────────────────────

const backupWeb = fusion(
  {
    '/web/backup': {
      get: op({
        tag: T_BACKUP,
        id: 'listerSauvegardesWeb',
        resume: 'Lister les sauvegardes des hébergements',
        paginee: true,
        params: [filtre('hebergementId', chaine()), filtre('actif', booleen()), filtre('site', liste(SITES))],
        ok: page(ref('SauvegardeWeb')),
      }),
    },
    '/web/backup/{sauvegardeId}': {
      get: op({
        tag: T_BACKUP,
        id: 'obtenirSauvegardeWeb',
        resume: 'Obtenir la sauvegarde d’un hébergement',
        params: [chemin('sauvegardeId', 'Identifiant de la sauvegarde.', 'bak-dba')],
        ok: ref('SauvegardeWeb'),
      }),
      patch: op({
        tag: T_BACKUP,
        id: 'modifierSauvegardeWeb',
        resume: 'Régler la sauvegarde d’un hébergement',
        params: [chemin('sauvegardeId', 'Identifiant de la sauvegarde.', 'bak-dba')],
        corps: objet({
          actif: booleen(),
          frequence: liste(['quotidienne', 'bihebdomadaire', 'hebdomadaire']),
          heure: chaine(),
          retentionJours: entier(),
          destination: chaine(),
          immuable: booleen(),
          perimetre: objet({
            fichiers: booleen(),
            bases: booleen(),
            configuration: booleen(),
            messagerie: booleen(),
          }),
        }),
        ok: ref('SauvegardeWeb'),
        rbac: 'backup.plan.write',
      }),
    },
  },
  action({
    tag: T_BACKUP,
    chemin: '/web/backup/{sauvegardeId}/execution',
    id: 'executerSauvegardeWeb',
    resume: 'Lancer une sauvegarde hors planning',
    params: [chemin('sauvegardeId', 'Identifiant de la sauvegarde.', 'bak-dba')],
    rbac: 'backup.plan.write',
  }),
  action({
    tag: T_BACKUP,
    chemin: '/web/backup/{sauvegardeId}/restauration',
    id: 'restaurerSauvegardeWeb',
    resume: 'Restaurer depuis une exécution',
    detail:
      'Granularité au choix : tout l’hébergement, un site, une base, une boîte. Une ' +
      'restauration en place exige la confirmation par le nom.',
    params: [chemin('sauvegardeId', 'Identifiant de la sauvegarde.', 'bak-dba')],
    corps: objet(
      {
        executionId: chaine(),
        granularite: liste(['complete', 'fichiers', 'base', 'boite_mail', 'configuration']),
        elements: tableau(chaine()),
        cible: liste(['origine', 'preproduction']),
        confirmation: chaine(),
      },
      ['executionId', 'granularite'],
    ),
    corpsRequis: true,
    rbac: 'backup.restore',
    erreurs: [409],
  }),
  action({
    tag: T_BACKUP,
    chemin: '/web/backup/{sauvegardeId}/test-restauration',
    id: 'testerRestaurationWeb',
    resume: 'Tester une restauration à blanc',
    params: [chemin('sauvegardeId', 'Identifiant de la sauvegarde.', 'bak-dba')],
    rbac: 'backup.restore',
  }),
)

// ─── Relais SMTP ──────────────────────────────────────────────────────

const smtp = fusion(
  {
    '/web/smtp': {
      get: op({
        tag: T_SMTP,
        id: 'obtenirRelaisSmtp',
        resume: 'Obtenir le relais SMTP de l’organisation',
        detail: 'Envoi applicatif : le relais expédie, il ne stocke ni ne lit de courrier.',
        ok: ref('RelaisSmtp'),
      }),
      post: op({
        tag: T_SMTP,
        id: 'activerRelaisSmtp',
        resume: 'Activer le relais SMTP',
        corps: objet(
          { domainesAutorises: tableau(chaine()), quotaJour: entier(), ipDediee: booleen() },
          ['domainesAutorises'],
        ),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
        erreurs: [409, 402],
      }),
      patch: op({
        tag: T_SMTP,
        id: 'modifierRelaisSmtp',
        resume: 'Régler le relais SMTP',
        corps: objet({
          domainesAutorises: tableau(chaine()),
          quotaJour: entier(),
          actif: booleen(),
        }),
        ok: ref('RelaisSmtp'),
        rbac: 'service.admin',
      }),
    },
    '/web/smtp/messages': {
      get: op({
        tag: T_SMTP,
        id: 'listerMessagesSmtp',
        resume: 'Lister les remises récentes',
        detail:
          'Journal de remise seulement — expéditeur, destinataire, sujet, code de retour. ' +
          'Le contenu des messages n’est jamais exposé.',
        paginee: true,
        params: [
          filtre('statut', liste(['remis', 'differe', 'rebond', 'rejete', 'plainte'])),
          filtre('depuis', horodatage()),
          filtre('destinataire', chaine()),
        ],
        ok: page(ref('MessageSmtp')),
        erreurs: [424],
      }),
    },
  },
  {
    '/web/smtp/cles': {
      get: op({
        tag: T_SMTP,
        id: 'listerClesSmtp',
        resume: 'Lister les clés d’envoi',
        detail:
          'Une clé par application émettrice : celle qui fuit se révoque sans couper les autres, ' +
          'et le journal de remise dit laquelle a envoyé quoi.',
        params: [filtre('statut', liste(['active', 'suspendue', 'revoquee']))],
        ok: tableau(ref('CleSmtp')),
      }),
      post: op({
        tag: T_SMTP,
        id: 'creerCleSmtp',
        resume: 'Créer une clé d’envoi',
        corps: ref('CleSmtpCreation'),
        ok: ref('CleSmtpSecret'),
        code: 201,
        rbac: 'secrets.update',
        erreurs: [409],
      }),
    },
    '/web/smtp/cles/{cleSmtpId}': {
      patch: op({
        tag: T_SMTP,
        id: 'modifierCleSmtp',
        resume: 'Modifier une clé d’envoi',
        params: [chemin('cleSmtpId', 'Identifiant de la clé.')],
        corps: objet({
          nom: chaine(),
          domainesAutorises: tableau(chaine()),
          quotaJour: entier(),
          statut: liste(['active', 'suspendue']),
        }),
        ok: ref('CleSmtp'),
        rbac: 'secrets.update',
      }),
      delete: op({
        tag: T_SMTP,
        id: 'revoquerCleSmtp',
        resume: 'Révoquer une clé d’envoi',
        detail: 'L’application qui la porte cesse d’émettre immédiatement.',
        params: [chemin('cleSmtpId', 'Identifiant de la clé.')],
        destructif: true,
        code: 204,
        rbac: 'secrets.update',
      }),
    },
    '/web/smtp/webhooks': {
      get: op({
        tag: T_SMTP,
        id: 'listerWebhooksSmtp',
        resume: 'Lister les webhooks de remise',
        detail: 'Rebonds et plaintes remontés à l’application, pour qu’elle nettoie ses listes.',
        ok: tableau(ref('WebhookSmtp')),
      }),
      post: op({
        tag: T_SMTP,
        id: 'creerWebhookSmtp',
        resume: 'Créer un webhook de remise',
        corps: ref('WebhookSmtpCreation'),
        ok: ref('WebhookSmtp'),
        code: 201,
        rbac: 'service.admin',
      }),
    },
    '/web/smtp/webhooks/{webhookId}': {
      patch: op({
        tag: T_SMTP,
        id: 'modifierWebhookSmtp',
        resume: 'Modifier un webhook de remise',
        params: [chemin('webhookId', 'Identifiant du webhook.')],
        corps: ref('WebhookSmtpCreation'),
        ok: ref('WebhookSmtp'),
        rbac: 'service.admin',
      }),
      delete: op({
        tag: T_SMTP,
        id: 'supprimerWebhookSmtp',
        resume: 'Supprimer un webhook de remise',
        params: [chemin('webhookId', 'Identifiant du webhook.')],
        code: 204,
        rbac: 'service.admin',
      }),
    },
  },
  action({
    tag: T_SMTP,
    chemin: '/web/smtp/identifiants',
    id: 'regenererIdentifiantsSmtp',
    resume: 'Régénérer les identifiants du relais',
    detail: 'L’ancien mot de passe cesse de fonctionner immédiatement.',
    corps: objet({ confirmation: chaine() }, ['confirmation']),
    corpsRequis: true,
    ok: objet(
      { hote: chaine(), ports: tableau(entier()), identifiant: chaine(), motDePasse: chaine() },
      ['hote', 'identifiant', 'motDePasse'],
    ),
    code: 200,
    rbac: 'secrets.update',
  }),
  action({
    tag: T_SMTP,
    chemin: '/web/smtp/test',
    id: 'testerRelaisSmtp',
    resume: 'Envoyer un message de test',
    corps: objet({ destinataire: chaine(), de: chaine() }, ['destinataire']),
    corpsRequis: true,
    ok: objet({ envoye: booleen(), code: chaine(), detail: chaine(), correlationId: chaine() }, ['envoye']),
    code: 200,
    rbac: 'service.admin',
  }),
)

export const cheminsWeb = fusion(
  domaines,
  hebergement,
  sitesWeb,
  basesWeb,
  emails,
  drive,
  ssl,
  backupWeb,
  smtp,
)
