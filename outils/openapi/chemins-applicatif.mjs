/**
 * Chemins — plateforme applicative, projets, domaines applicatifs, modèles.
 */

import {
  action,
  booleen,
  chaine,
  chemin,
  crud,
  entier,
  filtre,
  fusion,
  horodatage,
  liste,
  objet,
  op,
  page,
  ref,
  tableau,
} from './socle.mjs'

const T_APPS = 'Applications'
const T_DEPLOIEMENTS = 'Déploiements'
const T_PROJETS = 'Projets applicatifs'
const T_MODELES = 'Modèles applicatifs'

const idApp = chemin('appId', 'Identifiant de l’application.')
const idEnv = chemin('envId', 'Identifiant de l’environnement.')
const idProjet = chemin('projetId', 'Identifiant du projet.', 'prj-metier')
const idService = chemin('serviceId', 'Identifiant du service.', 'svc-metier-api')

// ─── Applications et environnements ───────────────────────────────────

const applications = fusion(
  crud({
    tag: T_APPS,
    base: '/applications',
    idParam: idApp,
    nomSingulier: 'Application',
    nomPluriel: 'Applications',
    libelle: 'une application',
    libellePluriel: 'les applications',
    schema: 'ApplicationPaas',
    creation: 'ApplicationPaasCreation',
    modification: 'ApplicationPaasCreation',
    creationAsync: true,
    suppressionAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'app.deploy',
    filtres: [
      filtre('espaceId', chaine()),
      filtre('cible', liste(['vm', 'k8s'])),
      filtre('sante', liste(['sain', 'degrade', 'arrete', 'echec'])),
    ],
  }),
  {
    '/applications/analyse-depot': {
      post: op({
        tag: T_APPS,
        id: 'analyserDepot',
        resume: 'Analyser un dépôt avant création',
        detail:
          'Lit le dépôt et dit ce qu’il y a vu : services détectés, constructeur proposé, ' +
          'variables attendues. Rien n’est créé.',
        corps: objet(
          {
            provider: liste(['github', 'gitlab']),
            url: chaine(),
            branche: chaine(),
            jetonAcces: chaine('Nécessaire pour un dépôt privé ; jamais conservé.'),
          },
          ['provider', 'url'],
        ),
        ok: ref('AnalyseDepot'),
        rbac: 'app.deploy',
      }),
    },
    '/applications/{appId}/environnements': {
      get: op({
        tag: T_APPS,
        id: 'listerEnvironnements',
        resume: 'Lister les environnements d’une application',
        params: [idApp],
        ok: tableau(ref('Environnement')),
      }),
      post: op({
        tag: T_APPS,
        id: 'creerEnvironnement',
        resume: 'Créer un environnement',
        params: [idApp],
        corps: ref('EnvironnementCreation'),
        ok: ref('Environnement'),
        code: 201,
        rbac: 'app.deploy',
        erreurs: [409],
      }),
    },
    '/environnements/{envId}': {
      get: op({
        tag: T_APPS,
        id: 'obtenirEnvironnement',
        resume: 'Obtenir un environnement',
        params: [idEnv],
        ok: ref('Environnement'),
      }),
      patch: op({
        tag: T_APPS,
        id: 'modifierEnvironnement',
        resume: 'Modifier un environnement',
        params: [idEnv],
        corps: ref('EnvironnementCreation'),
        ok: ref('Environnement'),
        rbac: 'app.deploy',
      }),
      delete: op({
        tag: T_APPS,
        id: 'supprimerEnvironnement',
        resume: 'Supprimer un environnement',
        params: [idEnv],
        destructif: true,
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'app.deploy',
      }),
    },
    '/environnements/{envId}/variables': {
      get: op({
        tag: T_APPS,
        id: 'listerVariablesEnvironnement',
        resume: 'Lister les variables d’un environnement',
        detail: 'La valeur d’un secret n’est jamais renvoyée : seule son existence est visible.',
        params: [idEnv],
        ok: tableau(ref('VariableEnvironnement')),
        rbac: 'secrets.update',
      }),
      put: op({
        tag: T_APPS,
        id: 'modifierVariablesEnvironnement',
        resume: 'Remplacer les variables d’un environnement',
        params: [idEnv],
        corps: objet(
          {
            variables: tableau(
              objet(
                {
                  cle: chaine(),
                  valeur: chaine(),
                  secret: booleen(),
                  scope: liste(['build', 'runtime']),
                  supprimer: booleen(),
                },
                ['cle'],
              ),
            ),
            redeployer: booleen('Applique les nouvelles valeurs en redéployant l’environnement.'),
          },
          ['variables'],
        ),
        ok: tableau(ref('VariableEnvironnement')),
        rbac: 'secrets.update',
      }),
    },
    '/environnements/{envId}/composants': {
      get: op({
        tag: T_APPS,
        id: 'listerComposants',
        resume: 'Lister les composants d’un environnement',
        params: [idEnv],
        ok: tableau(ref('Composant')),
      }),
      post: op({
        tag: T_APPS,
        id: 'creerComposant',
        resume: 'Ajouter un composant',
        params: [idEnv],
        corps: ref('ComposantCreation'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'app.deploy',
        erreurs: [402],
      }),
    },
    '/composants/{composantId}': {
      get: op({
        tag: T_APPS,
        id: 'obtenirComposant',
        resume: 'Obtenir un composant',
        params: [chemin('composantId', 'Identifiant du composant.')],
        ok: ref('Composant'),
      }),
      patch: op({
        tag: T_APPS,
        id: 'modifierComposant',
        resume: 'Modifier un composant',
        params: [chemin('composantId', 'Identifiant du composant.')],
        corps: ref('ComposantCreation'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'app.deploy',
      }),
      delete: op({
        tag: T_APPS,
        id: 'supprimerComposant',
        resume: 'Supprimer un composant',
        params: [chemin('composantId', 'Identifiant du composant.')],
        destructif: true,
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'app.deploy',
      }),
    },
    '/canvas/briques': {
      get: op({
        tag: T_APPS,
        id: 'listerBriquesCanvas',
        resume: 'Lister les briques assemblables',
        detail: 'Images qualifiées proposées dans la composition visuelle d’une application.',
        ok: tableau(ref('BriqueCanvas')),
      }),
    },
    '/depots/branches': {
      get: op({
        tag: T_APPS,
        id: 'listerBranchesDepot',
        resume: 'Lister les branches d’un dépôt',
        detail:
          'Sert le choix de branche du déploiement automatique, avec le dernier commit de chacune : ' +
          'on choisit une branche vivante, pas un nom saisi de mémoire.',
        params: [
          filtre('provider', liste(['github', 'gitlab'])),
          filtre('url', chaine()),
          filtre('appId', chaine(), 'Reprend le dépôt déjà connu de l’application.'),
        ],
        ok: tableau(ref('BrancheDepot')),
        rbac: 'app.deploy',
        erreurs: [424],
      }),
    },
  },
  ...[
    ['redemarrage', 'redemarrerComposant', 'Redémarrer un composant', 'component.restart'],
    ['arret', 'arreterComposant', 'Arrêter un composant', 'component.restart'],
  ].map(([verbe, id, resume, rbac]) =>
    action({
      tag: T_APPS,
      chemin: `/composants/{composantId}/${verbe}`,
      id,
      resume,
      params: [chemin('composantId', 'Identifiant du composant.')],
      rbac,
    }),
  ),
  action({
    tag: T_APPS,
    chemin: '/composants/{composantId}/dimensionnement',
    id: 'dimensionnerComposant',
    resume: 'Ajuster les ressources d’un composant',
    params: [chemin('composantId', 'Identifiant du composant.')],
    corps: objet(
      { cpu: entier(), ramMo: entier(), diskGo: entier(), replicas: entier() },
      [],
    ),
    corpsRequis: true,
    rbac: 'app.deploy',
    erreurs: [402],
  }),
)

// ─── Déploiements ─────────────────────────────────────────────────────

const deploiements = fusion(
  {
    '/deploiements': {
      get: op({
        tag: T_DEPLOIEMENTS,
        id: 'listerDeploiements',
        resume: 'Lister les déploiements',
        paginee: true,
        params: [
          filtre('appId', chaine()),
          filtre('envId', chaine()),
          filtre('statut', chaine()),
          filtre('branche', chaine()),
          filtre('depuis', horodatage()),
        ],
        ok: page(ref('Deploiement')),
      }),
      post: op({
        tag: T_DEPLOIEMENTS,
        id: 'lancerDeploiement',
        resume: 'Lancer un déploiement',
        detail:
          'Quatre étapes suivies séparément : construction, analyse de vulnérabilités, ' +
          'provisionnement, mise en service.',
        corps: ref('DeploiementDemande'),
        ok: ref('Deploiement'),
        code: 202,
        rbac: 'app.deploy',
        erreurs: [409, 402, 404],
      }),
    },
    '/deploiements/{deploiementId}': {
      get: op({
        tag: T_DEPLOIEMENTS,
        id: 'obtenirDeploiement',
        resume: 'Suivre un déploiement',
        params: [chemin('deploiementId', 'Identifiant du déploiement.')],
        ok: ref('Deploiement'),
      }),
    },
    '/deploiements/{deploiementId}/journaux': {
      get: op({
        tag: T_DEPLOIEMENTS,
        id: 'obtenirJournauxDeploiement',
        resume: 'Obtenir les journaux d’une étape',
        params: [
          chemin('deploiementId', 'Identifiant du déploiement.'),
          filtre('etape', liste(['build', 'scan', 'provision', 'deploy'])),
        ],
        ok: ref('ExtraitLogs'),
      }),
    },
  },
  action({
    tag: T_DEPLOIEMENTS,
    chemin: '/deploiements/{deploiementId}/rollback',
    id: 'annulerDeploiement',
    resume: 'Revenir à la version précédente',
    params: [chemin('deploiementId', 'Identifiant du déploiement.')],
    corps: objet({ versionCible: chaine('Par défaut, la dernière version en service.') }),
    ok: ref('Deploiement'),
    rbac: 'app.rollback',
    erreurs: [409],
  }),
  action({
    tag: T_DEPLOIEMENTS,
    chemin: '/deploiements/{deploiementId}/approbation',
    id: 'approuverDeploiement',
    resume: 'Approuver ou refuser un déploiement en attente',
    detail:
      'Barrière des environnements protégés (`protection.approbationRequise`). ' +
      'L’approbateur ne peut pas être l’auteur du déploiement.',
    params: [chemin('deploiementId', 'Identifiant du déploiement.')],
    corps: objet({ decision: liste(['approuver', 'refuser']), motif: chaine() }, ['decision']),
    corpsRequis: true,
    ok: ref('Deploiement'),
    code: 200,
    rbac: 'app.deploy',
    erreurs: [409],
  }),
  action({
    tag: T_DEPLOIEMENTS,
    chemin: '/deploiements/{deploiementId}/promotion',
    id: 'promouvoirDeploiement',
    resume: 'Promouvoir un déploiement vers un autre environnement',
    detail: 'Reprend l’artefact déjà construit : on ne reconstruit pas ce qui a été validé.',
    params: [chemin('deploiementId', 'Identifiant du déploiement.')],
    corps: objet({ envCibleId: chaine() }, ['envCibleId']),
    corpsRequis: true,
    ok: ref('Deploiement'),
    rbac: 'app.deploy',
  }),
  action({
    tag: T_DEPLOIEMENTS,
    chemin: '/deploiements/{deploiementId}/canari',
    id: 'reglerCanariDeploiement',
    resume: 'Faire avancer ou arrêter un canari',
    params: [chemin('deploiementId', 'Identifiant du déploiement.')],
    corps: objet(
      { action: liste(['avancer', 'figer', 'annuler', 'terminer']), pct: entier() },
      ['action'],
    ),
    corpsRequis: true,
    ok: ref('Deploiement'),
    rbac: 'app.deploy',
    erreurs: [409],
  }),
)

// ─── Projets applicatifs ──────────────────────────────────────────────

const projets = fusion(
  crud({
    tag: T_PROJETS,
    base: '/projets',
    idParam: idProjet,
    nomSingulier: 'Projet',
    nomPluriel: 'Projets',
    libelle: 'un projet',
    libellePluriel: 'les projets',
    schema: 'Projet',
    creation: 'ProjetCreation',
    modification: 'ProjetCreation',
    suppressionAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'app.deploy',
    filtres: [filtre('espaceId', chaine())],
    erreursCreation: [404],
  }),
  {
    '/projets/synthese': {
      get: op({
        tag: T_PROJETS,
        id: 'obtenirSyntheseProjets',
        resume: 'Obtenir la synthèse des projets',
        ok: ref('SyntheseProjets'),
      }),
    },
    '/projets/{projetId}/variables': {
      get: op({
        tag: T_PROJETS,
        id: 'listerVariablesProjet',
        resume: 'Lister les variables partagées d’un projet',
        detail: 'Partagées par tous les services du projet, déclinées par environnement.',
        params: [idProjet],
        ok: tableau(
          objet(
            {
              cle: chaine(),
              valeur: chaine(),
              secret: booleen(),
              portee: liste(['build', 'runtime']),
              environnements: tableau(chaine()),
            },
            ['cle', 'secret', 'portee', 'environnements'],
          ),
        ),
        rbac: 'secrets.update',
      }),
      put: op({
        tag: T_PROJETS,
        id: 'modifierVariablesProjet',
        resume: 'Remplacer les variables partagées d’un projet',
        params: [idProjet],
        corps: objet(
          {
            variables: tableau(
              objet(
                {
                  cle: chaine(),
                  valeur: chaine(),
                  secret: booleen(),
                  portee: liste(['build', 'runtime']),
                  environnements: tableau(chaine()),
                  supprimer: booleen(),
                },
                ['cle'],
              ),
            ),
            redeployer: booleen(),
          },
          ['variables'],
        ),
        ok: objet({ appliquees: entier(), servicesARedeployer: tableau(chaine()) }, ['appliquees']),
        rbac: 'secrets.update',
      }),
    },
    '/projets/{projetId}/services': {
      get: op({
        tag: T_PROJETS,
        id: 'listerServicesProjet',
        resume: 'Lister les services d’un projet',
        params: [
          idProjet,
          filtre('environnement', chaine()),
          filtre('type', liste(['application', 'base', 'statique', 'cron', 'worker'])),
        ],
        ok: tableau(ref('ServiceProjet')),
      }),
      post: op({
        tag: T_PROJETS,
        id: 'creerServiceProjet',
        resume: 'Ajouter un service à un projet',
        detail:
          'Avec `modeleSlug`, le service arrive avec la version qualifiée du modèle, sa ' +
          'configuration propre et son plan de sauvegarde.',
        params: [idProjet],
        corps: ref('ServiceProjetCreation'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'app.deploy',
        erreurs: [409, 402],
      }),
    },
    '/projets/{projetId}/services/{serviceId}': {
      get: op({
        tag: T_PROJETS,
        id: 'obtenirServiceProjet',
        resume: 'Obtenir un service de projet',
        params: [idProjet, idService],
        ok: ref('ServiceProjet'),
      }),
      patch: op({
        tag: T_PROJETS,
        id: 'modifierServiceProjet',
        resume: 'Modifier un service de projet',
        params: [idProjet, idService],
        corps: ref('ServiceProjetCreation'),
        ok: ref('ServiceProjet'),
        rbac: 'app.deploy',
      }),
      delete: op({
        tag: T_PROJETS,
        id: 'supprimerServiceProjet',
        resume: 'Supprimer un service de projet',
        detail: 'La réponse liste les services qui dépendaient de celui-ci avant de détruire quoi que ce soit.',
        params: [idProjet, idService],
        destructif: true,
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'app.deploy',
        erreurs: [409],
      }),
    },
    '/projets/{projetId}/services/{serviceId}/identifiants': {
      get: op({
        tag: T_PROJETS,
        id: 'obtenirIdentifiantsServiceProjet',
        resume: 'Obtenir les identifiants de connexion d’un service',
        detail:
          'Appel dédié parce que les listes de services ne portent jamais de mot de passe : ' +
          'un secret se demande, il ne traîne pas dans une réponse de collection.',
        params: [idProjet, idService],
        ok: objet(
          {
            hoteInterne: chaine(),
            port: entier(),
            utilisateur: chaine(),
            motDePasse: chaine(),
            base: chaine(),
            uri: chaine(),
            variablesInjectees: tableau(chaine(), 'Variables déjà disponibles aux autres services du projet.'),
          },
          ['hoteInterne', 'port'],
        ),
        rbac: 'secrets.update',
      }),
    },
    '/projets/{projetId}/services/{serviceId}/journaux': {
      get: op({
        tag: T_PROJETS,
        id: 'obtenirJournauxServiceProjet',
        resume: 'Obtenir un extrait de journal d’un service',
        params: [idProjet, idService, filtre('niveau', liste(['INFO', 'WARN', 'ERROR', 'DEBUG']))],
        ok: ref('ExtraitLogs'),
        erreurs: [424],
      }),
    },
    '/projets/{projetId}/services/{serviceId}/metriques': {
      get: op({
        tag: T_PROJETS,
        id: 'obtenirMetriquesServiceProjet',
        resume: 'Obtenir les séries d’un service',
        params: [idProjet, idService, { $ref: '#/components/parameters/Fenetre' }],
        ok: objet({ tuiles: tableau(ref('Tuile')), series: tableau(ref('Serie')), liens: ref('LiensSortie') }, ['series']),
        erreurs: [424],
      }),
    },
  },
  ...[
    ['demarrage', 'demarrerServiceProjet', 'Démarrer un service'],
    ['arret', 'arreterServiceProjet', 'Arrêter un service'],
    ['redemarrage', 'redemarrerServiceProjet', 'Redémarrer un service'],
  ].map(([verbe, id, resume]) =>
    action({
      tag: T_PROJETS,
      chemin: `/projets/{projetId}/services/{serviceId}/${verbe}`,
      id,
      resume,
      params: [idProjet, idService],
      rbac: 'component.restart',
    }),
  ),
  action({
    tag: T_PROJETS,
    chemin: '/projets/{projetId}/services/{serviceId}/execution',
    id: 'executerServiceProjet',
    resume: 'Exécuter une tâche planifiée hors planning',
    detail: 'Réservé aux services de type `cron`.',
    params: [idProjet, idService],
    rbac: 'component.restart',
    erreurs: [409],
  }),
)

// ─── Zone applicative, domaines et routage ────────────────────────────

const domainesApplicatifs = fusion(
  {
    '/zone-applicative': {
      get: op({
        tag: T_PROJETS,
        id: 'obtenirZoneApplicative',
        resume: 'Obtenir la zone applicative de l’organisation',
        detail:
          'La zone offerte permet de mettre en ligne sans avoir acheté de domaine : on déploie, ' +
          'on obtient une URL qui fonctionne, on branche son nom plus tard.',
        ok: ref('ZoneApplicative'),
      }),
    },
    '/domaines-applicatifs': {
      get: op({
        tag: T_PROJETS,
        id: 'listerDomainesApplicatifs',
        resume: 'Lister les domaines applicatifs',
        paginee: true,
        params: [
          filtre('serviceId', chaine()),
          filtre('origine', liste(['genere', 'personnalise'])),
          filtre('verification', liste(['ok', 'attente', 'echec'])),
        ],
        ok: page(ref('DomaineApplicatif')),
      }),
      post: op({
        tag: T_PROJETS,
        id: 'creerDomaineApplicatif',
        resume: 'Brancher un domaine sur un service',
        detail:
          'La réponse contient l’enregistrement DNS exact à créer chez le registrar, ' +
          'et l’état de sa vérification.',
        corps: ref('DomaineApplicatifCreation'),
        ok: ref('DomaineApplicatif'),
        code: 201,
        rbac: 'app.deploy',
        erreurs: [409, 404],
      }),
    },
    '/domaines-applicatifs/{domaineId}': {
      get: op({
        tag: T_PROJETS,
        id: 'obtenirDomaineApplicatif',
        resume: 'Obtenir un domaine applicatif',
        params: [chemin('domaineId', 'Identifiant du domaine applicatif.')],
        ok: ref('DomaineApplicatif'),
      }),
      patch: op({
        tag: T_PROJETS,
        id: 'modifierDomaineApplicatif',
        resume: 'Modifier un domaine applicatif',
        params: [chemin('domaineId', 'Identifiant du domaine applicatif.')],
        corps: ref('DomaineApplicatifCreation'),
        ok: ref('DomaineApplicatif'),
        rbac: 'app.deploy',
      }),
      delete: op({
        tag: T_PROJETS,
        id: 'supprimerDomaineApplicatif',
        resume: 'Retirer un domaine applicatif',
        params: [chemin('domaineId', 'Identifiant du domaine applicatif.')],
        destructif: true,
        code: 204,
        rbac: 'app.deploy',
      }),
    },
    '/routage': {
      get: op({
        tag: T_PROJETS,
        id: 'listerReglesRoutage',
        resume: 'Lister les règles de routage HTTP',
        detail: 'Vue consolidée : quel hôte et quel chemin mènent à quel service, dans quel environnement.',
        paginee: true,
        params: [filtre('hote', chaine()), filtre('environnement', chaine())],
        ok: page(ref('RegleRoutage')),
      }),
    },
  },
  action({
    tag: T_PROJETS,
    chemin: '/domaines-applicatifs/{domaineId}/verification',
    id: 'verifierDomaineApplicatif',
    resume: 'Relancer la vérification DNS d’un domaine',
    detail: 'En cas d’échec, le détail dit ce qui a été lu et ce qui était attendu, avec un identifiant de corrélation.',
    params: [chemin('domaineId', 'Identifiant du domaine applicatif.')],
    ok: ref('DomaineApplicatif'),
    code: 200,
    rbac: 'app.deploy',
  }),
  action({
    tag: T_PROJETS,
    chemin: '/domaines-applicatifs/{domaineId}/certificat',
    id: 'emettreCertificatDomaineApplicatif',
    resume: 'Émettre ou renouveler le certificat d’un domaine applicatif',
    params: [chemin('domaineId', 'Identifiant du domaine applicatif.')],
    ok: ref('DomaineApplicatif'),
    code: 202,
    rbac: 'app.deploy',
    erreurs: [409],
  }),
)

// ─── Modèles applicatifs ──────────────────────────────────────────────

const modeles = {
  '/modeles': {
    get: op({
      tag: T_MODELES,
      id: 'listerModeles',
      resume: 'Lister les modèles déployables',
      detail:
        'Bibliothèque de solutions libres qualifiées. Un modèle apporte sa version, sa ' +
        'configuration et son plan de sauvegarde ; il ne remplace pas l’interface du produit.',
      paginee: true,
      params: [
        filtre('categorie', chaine()),
        filtre('certifie', booleen()),
        filtre('populaire', booleen()),
      ],
      ok: page(ref('ModeleApplicatif')),
    }),
  },
  '/modeles/{slug}': {
    get: op({
      tag: T_MODELES,
      id: 'obtenirModele',
      resume: 'Obtenir un modèle',
      params: [chemin('slug', 'Slug du modèle.', 'zimbra')],
      ok: ref('ModeleApplicatif'),
    }),
  },
  '/modeles/{slug}/estimation': {
    post: op({
      tag: T_MODELES,
      id: 'estimerModele',
      resume: 'Estimer le coût d’un déploiement de modèle',
      params: [chemin('slug', 'Slug du modèle.', 'zimbra')],
      corps: objet(
        {
          ressources: objet({ cpu: entier(), ramMo: entier(), diskGo: entier() }),
          sieges: entier(),
          environnement: chaine(),
        },
        [],
      ),
      ok: ref('EstimationCout'),
      code: 200,
    }),
  },
}

export const cheminsApplicatif = fusion(applications, deploiements, projets, domainesApplicatifs, modeles)
