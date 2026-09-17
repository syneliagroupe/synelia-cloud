/**
 * Chemins — authentification, compte, organisations, membres, sécurité, audit.
 */

import {
  ROLES,
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

const T_AUTH = 'Authentification'
const T_MOI = 'Compte & organisation active'
const T_ORG = 'Organisations'
const T_MEMBRES = 'Membres & rôles'
const T_SECU = 'Sécurité & accès'
const T_AUDIT = 'Audit'

const idOrg = chemin('orgId', 'Identifiant de l’organisation.', 'org-dba')

// ─── Authentification ─────────────────────────────────────────────────

const auth = {
  '/auth/connexion': {
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'seConnecter',
      resume: 'Ouvrir une session par mot de passe',
      detail:
        "Renvoie `mfaRequis` et un `defiMfa` sans jeton d'accès quand un second facteur est " +
        "exigé par la politique de l'organisation.",
      corps: ref('DemandeConnexion'),
      ok: ref('Session'),
    }),
  },
  '/auth/mfa': {
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'validerMfa',
      resume: 'Valider le second facteur',
      corps: objet(
        { defiMfa: chaine(), code: chaine(), methode: liste(['totp', 'webauthn', 'sms']), memoriserAppareil: booleen() },
        ['defiMfa', 'code'],
      ),
      ok: ref('Session'),
    }),
  },
  '/auth/rafraichir': {
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'rafraichirSession',
      resume: 'Rafraîchir le jeton d’accès',
      corps: objet({ refreshToken: chaine() }, ['refreshToken']),
      ok: ref('Session'),
    }),
  },
  '/auth/deconnexion': {
    post: op({
      tag: T_AUTH,
      id: 'seDeconnecter',
      resume: 'Fermer la session courante',
      portee: 'client',
      ok: objet({ ferme: booleen() }, ['ferme']),
    }),
  },
  '/auth/sso/decouverte': {
    get: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'decouvrirSso',
      resume: 'Découvrir la fédération d’un domaine de messagerie',
      detail:
        "Appelé dès la saisie de l'adresse : si le domaine est fédéré, l'écran de connexion " +
        'remplace le champ mot de passe par le bouton du fournisseur d’identité.',
      params: [filtre('email', chaine(undefined, { format: 'email' }), 'Adresse saisie.', true)],
      ok: ref('DecouverteSso'),
    }),
  },
  '/auth/sso/callback': {
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'terminerSso',
      resume: 'Échanger le code du fournisseur d’identité contre une session',
      corps: objet({ code: chaine(), state: chaine(), orgId: chaine() }, ['code', 'state']),
      ok: ref('Session'),
    }),
  },
  '/auth/inscription': {
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'sInscrire',
      resume: 'Créer un compte et son organisation',
      corps: ref('Inscription'),
      ok: ref('Session'),
      code: 201,
      erreurs: [409],
    }),
  },
  '/auth/mot-de-passe/oubli': {
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'demanderReinitialisation',
      resume: 'Demander la réinitialisation du mot de passe',
      detail: 'Répond toujours 200, que l’adresse existe ou non : ne pas révéler les comptes.',
      corps: objet({ email: chaine(undefined, { format: 'email' }) }, ['email']),
      ok: ref('AccuseReception'),
    }),
  },
  '/auth/mot-de-passe/reinitialiser': {
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'reinitialiserMotDePasse',
      resume: 'Fixer un nouveau mot de passe depuis un jeton reçu par courriel',
      corps: objet({ jeton: chaine(), motDePasse: chaine(undefined, { format: 'password' }) }, [
        'jeton',
        'motDePasse',
      ]),
      ok: ref('Session'),
    }),
  },
  '/auth/invitations/{jeton}': {
    get: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'obtenirInvitation',
      resume: 'Lire une invitation avant de l’accepter',
      params: [chemin('jeton', 'Jeton d’invitation reçu par courriel.', 'inv-1')],
      ok: ref('Invitation'),
    }),
    post: op({
      tag: T_AUTH,
      portee: 'auth',
      id: 'accepterInvitation',
      resume: 'Accepter une invitation',
      params: [chemin('jeton', 'Jeton d’invitation.', 'inv-1')],
      corps: objet(
        { nom: chaine(), motDePasse: chaine(undefined, { format: 'password' }) },
        [],
        'Nom et mot de passe seulement quand le compte n’existe pas encore.',
      ),
      corpsRequis: false,
      ok: ref('Session'),
      erreurs: [409],
    }),
  },
}

// ─── Compte courant ───────────────────────────────────────────────────

const moi = {
  '/moi': {
    get: op({
      tag: T_MOI,
      id: 'obtenirMonCompte',
      resume: 'Obtenir le compte courant, ses appartenances et son rôle actif',
      ok: objet(
        {
          utilisateur: ref('Utilisateur'),
          organisations: tableau(ref('AppartenanceOrganisation')),
          organisationActive: chaine(),
          roleActif: liste(ROLES),
          permissions: tableau(chaine(), 'Actions RBAC autorisées, pour désactiver le reste côté interface.'),
        },
        ['utilisateur', 'organisations', 'roleActif'],
      ),
    }),
    patch: op({
      tag: T_MOI,
      id: 'modifierMonCompte',
      resume: 'Modifier son profil',
      corps: objet({ nom: chaine(), fonction: chaine(), telephone: chaine() }),
      ok: ref('Utilisateur'),
    }),
  },
  '/moi/organisations': {
    get: op({
      tag: T_MOI,
      id: 'listerMesOrganisations',
      resume: 'Lister les organisations accessibles',
      detail: 'Alimente l’écran de sélection d’organisation après connexion.',
      ok: tableau(ref('AppartenanceOrganisation')),
    }),
  },
  '/moi/organisation-active': {
    put: op({
      tag: T_MOI,
      id: 'choisirOrganisationActive',
      resume: 'Choisir l’organisation active de la session',
      corps: objet({ orgId: chaine(), memoriser: booleen() }, ['orgId']),
      ok: ref('Session'),
    }),
  },
  '/moi/mot-de-passe': {
    put: op({
      tag: T_MOI,
      id: 'changerMonMotDePasse',
      resume: 'Changer son mot de passe',
      corps: objet(
        { actuel: chaine(undefined, { format: 'password' }), nouveau: chaine(undefined, { format: 'password' }) },
        ['actuel', 'nouveau'],
      ),
      ok: objet({ change: booleen() }, ['change']),
    }),
  },
  '/moi/mfa': {
    post: op({
      tag: T_MOI,
      id: 'activerMonMfa',
      resume: 'Enrôler un second facteur',
      corps: objet({ methode: liste(['totp', 'webauthn', 'sms']), telephone: chaine() }, ['methode']),
      ok: objet(
        { secret: chaine(), urlOtpauth: chaine(), codesSecours: tableau(chaine()) },
        [],
        'Secret et codes de secours renvoyés une seule fois.',
      ),
      code: 201,
    }),
    delete: op({
      tag: T_MOI,
      id: 'desactiverMonMfa',
      resume: 'Retirer un second facteur',
      detail: 'Refusé quand la politique de l’organisation impose le MFA.',
      code: 204,
      erreurs: [409],
    }),
  },
  '/moi/preferences': {
    get: op({ tag: T_MOI, id: 'obtenirMesPreferences', resume: 'Obtenir ses préférences', ok: ref('Preferences') }),
    put: op({
      tag: T_MOI,
      id: 'modifierMesPreferences',
      resume: 'Modifier ses préférences',
      detail:
        "`pageAccueil` fixe le lanceur de services comme écran d'arrivée — utile pour un membre " +
        "qui n'administre rien et ne fait qu'ouvrir ses services.",
      corps: ref('Preferences'),
      ok: ref('Preferences'),
    }),
  },
  '/moi/lanceur': {
    get: op({
      tag: T_MOI,
      id: 'obtenirMonLanceur',
      resume: 'Lister les services que le compte peut ouvrir',
      detail: 'Un service n’apparaît que si un siège actif est attribué au compte.',
      ok: tableau(
        objet(
          {
            service: ref('ServiceManage'),
            siege: ref('Siege'),
            urlOuverture: chaine(),
            derniereOuverture: horodatage(),
          },
          ['service', 'urlOuverture'],
        ),
      ),
    }),
  },
  '/moi/sessions': {
    get: op({
      tag: T_MOI,
      id: 'listerMesSessions',
      resume: 'Lister ses propres sessions',
      ok: tableau(ref('SessionActive')),
    }),
  },
}

// ─── Organisations ────────────────────────────────────────────────────

const organisations = fusion(
  crud({
    tag: T_ORG,
    base: '/organisations',
    idParam: idOrg,
    nomSingulier: 'Organisation',
    nomPluriel: 'Organisations',
    schema: 'Organisation',
    creation: 'OrganisationCreation',
    modification: 'OrganisationModification',
    portee: 'admin',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'org.manage',
    filtres: [
      filtre('statut', liste(['active', 'suspendue', 'fermee'])),
      filtre('secteur', chaine()),
      filtre('site', liste(['ABJ', 'GBM'])),
    ],
    sansSuppression: true,
  }),
  {
    '/organisations/{orgId}/synthese': {
      get: op({
        tag: T_ORG,
        portee: 'admin',
        id: 'obtenirSyntheseOrganisation',
        resume: 'Obtenir la fiche de synthèse d’une organisation',
        detail: 'Vue super admin : consommation, espaces, factures, tickets, contacts.',
        params: [idOrg],
        ok: objet(
          {
            organisation: ref('Organisation'),
            synthese: ref('SyntheseClient'),
            impayes: tableau(ref('Impaye')),
            tickets: tableau(ref('Ticket')),
          },
          ['organisation', 'synthese'],
        ),
        rbac: 'org.dashboard.view',
      }),
    },
    '/organisations/{orgId}/suspension': {
      post: op({
        tag: T_ORG,
        portee: 'admin',
        id: 'suspendreOrganisation',
        resume: 'Suspendre une organisation',
        detail: 'Les ressources restent en place ; les accès et le provisioning sont bloqués.',
        params: [idOrg],
        corps: objet({ motif: chaine(), notifier: booleen() }, ['motif']),
        destructif: true,
        ok: ref('Organisation'),
        code: 200,
        rbac: 'org.manage',
      }),
      delete: op({
        tag: T_ORG,
        portee: 'admin',
        id: 'reactiverOrganisation',
        resume: 'Lever la suspension d’une organisation',
        params: [idOrg],
        ok: ref('Organisation'),
        rbac: 'org.manage',
      }),
    },
    '/organisations/{orgId}/emprunt-identite': {
      post: op({
        tag: T_ORG,
        portee: 'admin',
        id: 'emprunterIdentiteOrganisation',
        resume: 'Ouvrir une session de support dans le contexte d’une organisation',
        detail:
          'Session en lecture seule par défaut, bornée dans le temps et intégralement journalisée : ' +
          'chaque écran consulté apparaît dans l’audit de l’organisation.',
        params: [idOrg],
        corps: objet(
          { motif: chaine(), ticketId: chaine(), ecriture: booleen(), dureeMin: entier() },
          ['motif'],
        ),
        corpsRequis: true,
        ok: ref('Session'),
        code: 201,
        rbac: 'org.manage',
      }),
    },
  },
)

// ─── Membres, rôles, invitations ──────────────────────────────────────

const idMembre = chemin('membreId', 'Identifiant de l’appartenance.')

const membres = fusion(
  {
    '/membres': {
      get: op({
        tag: T_MEMBRES,
        id: 'listerMembres',
        resume: 'Lister les membres de l’organisation',
        paginee: true,
        params: [
          filtre('role', liste(ROLES)),
          filtre('scopeType', liste(['org', 'espace', 'application', 'service'])),
          filtre('scopeId', chaine()),
          filtre('statut', liste(['actif', 'invite', 'suspendu'])),
        ],
        ok: page(ref('Membre')),
        rbac: 'member.invite',
      }),
      post: op({
        tag: T_MEMBRES,
        id: 'ajouterAppartenance',
        resume: 'Donner un rôle supplémentaire à un membre existant',
        detail:
          'Un même utilisateur peut être Operator sur un Espace et Billing Manager sur ' +
          "l'organisation : les appartenances s'ajoutent, elles ne se remplacent pas. " +
          "Pour un utilisateur qui n'a pas encore de compte, passer par une invitation.",
        corps: objet(
          {
            userId: chaine(),
            role: liste(ROLES),
            scopeType: liste(['org', 'espace', 'application', 'service']),
            scopeId: chaine(),
          },
          ['userId', 'role', 'scopeType'],
        ),
        ok: ref('Membre'),
        code: 201,
        rbac: 'member.invite',
        erreurs: [409, 404],
      }),
    },
    '/membres/{membreId}': {
      get: op({
        tag: T_MEMBRES,
        id: 'obtenirMembre',
        resume: 'Obtenir un membre',
        params: [idMembre],
        ok: ref('Membre'),
      }),
      patch: op({
        tag: T_MEMBRES,
        id: 'modifierMembre',
        resume: 'Changer le rôle ou le périmètre d’un membre',
        params: [idMembre],
        corps: objet({
          role: liste(ROLES),
          scopeType: liste(['org', 'espace', 'application', 'service']),
          scopeId: chaine(),
        }),
        ok: ref('Membre'),
        rbac: 'member.invite',
      }),
      delete: op({
        tag: T_MEMBRES,
        id: 'retirerMembre',
        resume: 'Retirer un membre de l’organisation',
        detail: 'Les sièges de services managés attribués au membre sont libérés.',
        params: [idMembre],
        destructif: true,
        code: 204,
        rbac: 'member.invite',
      }),
    },
    '/invitations': {
      get: op({
        tag: T_MEMBRES,
        id: 'listerInvitations',
        resume: 'Lister les invitations en cours',
        paginee: true,
        params: [filtre('statut', liste(['en_attente', 'acceptee', 'expiree', 'revoquee']))],
        ok: page(ref('Invitation')),
        rbac: 'member.invite',
      }),
      post: op({
        tag: T_MEMBRES,
        id: 'inviterMembre',
        resume: 'Inviter un membre',
        corps: ref('InvitationCreation'),
        ok: ref('Invitation'),
        code: 201,
        rbac: 'member.invite',
        erreurs: [409],
      }),
    },
    '/invitations/{invitationId}': {
      delete: op({
        tag: T_MEMBRES,
        id: 'revoquerInvitation',
        resume: 'Révoquer une invitation',
        params: [chemin('invitationId', 'Identifiant de l’invitation.')],
        code: 204,
        rbac: 'member.invite',
      }),
    },
    '/rbac/matrice': {
      get: op({
        tag: T_MEMBRES,
        id: 'obtenirMatriceRbac',
        resume: 'Obtenir la matrice des droits',
        detail:
          'Sert à désactiver les actions interdites en nommant le rôle requis, plutôt qu’à les masquer.',
        ok: tableau(ref('ActionRbac')),
      }),
    },
    '/utilisateurs': {
      get: op({
        tag: T_MEMBRES,
        id: 'listerUtilisateurs',
        resume: 'Lister les utilisateurs de l’organisation',
        detail: 'Nécessaire pour attribuer un siège ou une boîte : un membre n’est pas toujours un compte actif.',
        paginee: true,
        params: [filtre('statut', liste(['actif', 'invite', 'suspendu']))],
        ok: page(ref('Utilisateur')),
      }),
    },
  },
  action({
    tag: T_MEMBRES,
    chemin: '/invitations/{invitationId}/relance',
    id: 'relancerInvitation',
    resume: 'Renvoyer une invitation',
    params: [chemin('invitationId', 'Identifiant de l’invitation.')],
    ok: ref('Invitation'),
    code: 200,
    rbac: 'member.invite',
  }),
)

// ─── Sécurité : SSO, politiques, sessions, clés d'API ─────────────────

const securite = fusion(
  {
    '/securite/sso': {
      get: op({
        tag: T_SECU,
        id: 'obtenirConfigurationSso',
        resume: 'Obtenir la configuration de fédération',
        ok: ref('ConfigurationSso'),
        rbac: 'sso.configure',
      }),
      put: op({
        tag: T_SECU,
        id: 'modifierConfigurationSso',
        resume: 'Configurer la fédération d’identité',
        corps: ref('ConfigurationSso'),
        ok: ref('ConfigurationSso'),
        rbac: 'sso.configure',
      }),
    },
    '/securite/politiques': {
      get: op({
        tag: T_SECU,
        id: 'obtenirPolitiquesSecurite',
        resume: 'Obtenir les politiques de sécurité',
        ok: ref('PolitiquesSecurite'),
        rbac: 'sso.configure',
      }),
      put: op({
        tag: T_SECU,
        id: 'modifierPolitiquesSecurite',
        resume: 'Modifier les politiques de sécurité',
        detail:
          'MFA obligatoire, durée de session, restriction par plage IP. Un durcissement peut ' +
          'invalider des sessions en cours : la réponse indique combien.',
        corps: ref('PolitiquesSecurite'),
        ok: objet(
          { politiques: ref('PolitiquesSecurite'), sessionsInvalidees: entier() },
          ['politiques', 'sessionsInvalidees'],
        ),
        rbac: 'sso.configure',
      }),
    },
    '/securite/sessions': {
      get: op({
        tag: T_SECU,
        id: 'listerSessionsActives',
        resume: 'Lister les sessions actives de l’organisation',
        paginee: true,
        params: [
          filtre('userId', chaine()),
          filtre('idpSource', liste(['local', 'oidc', 'saml', 'ldap'])),
        ],
        ok: page(ref('SessionActive')),
        rbac: 'sso.configure',
      }),
      delete: op({
        tag: T_SECU,
        id: 'revoquerToutesSessions',
        resume: 'Révoquer toutes les sessions de l’organisation',
        detail: 'La session qui exécute l’appel est conservée.',
        destructif: true,
        ok: objet({ revoquees: entier() }, ['revoquees']),
        rbac: 'sso.configure',
      }),
    },
    '/securite/sessions/{sessionId}': {
      delete: op({
        tag: T_SECU,
        id: 'revoquerSession',
        resume: 'Révoquer une session',
        params: [chemin('sessionId', 'Identifiant de la session.')],
        code: 204,
        rbac: 'sso.configure',
      }),
    },
  },
  action({
    tag: T_SECU,
    chemin: '/securite/sso/test',
    id: 'testerSso',
    resume: 'Tester la fédération sans l’activer',
    ok: objet(
      { succes: booleen(), etapes: tableau(objet({ nom: chaine(), ok: booleen(), detail: chaine() })), correlationId: chaine() },
      ['succes'],
    ),
    code: 200,
    rbac: 'sso.configure',
  }),
  crud({
    tag: T_SECU,
    base: '/securite/cles-api',
    idParam: chemin('cleId', 'Identifiant de la clé.'),
    nomSingulier: 'CleApi',
    nomPluriel: 'ClesApi',
    schema: 'CleApi',
    creation: 'CleApiCreation',
    rbacLecture: 'sso.configure',
    rbacEcriture: 'sso.configure',
    filtres: [filtre('statut', liste(['active', 'revoquee', 'expiree']))],
    idsOperations: {
      liste: 'listerClesApi',
      creation: 'creerCleApi',
      fiche: 'obtenirCleApi',
      modification: 'modifierCleApi',
      suppression: 'revoquerCleApi',
    },
  }),
  action({
    tag: T_SECU,
    chemin: '/securite/cles-api/{cleId}/rotation',
    id: 'rotationnerCleApi',
    resume: 'Faire tourner le secret d’une clé',
    detail: 'L’ancien secret reste valable le temps du délai de grâce demandé.',
    params: [chemin('cleId', 'Identifiant de la clé.')],
    corps: objet({ delaiGraceHeures: entier() }),
    ok: ref('CleApiSecret'),
    code: 200,
    rbac: 'sso.configure',
  }),
)

// La création d'une clé renvoie le secret, ce que le CRUD générique ne sait pas dire.
securite['/securite/cles-api'].post.responses['201'].content['application/json'].schema = ref('CleApiSecret')

// ─── Audit ────────────────────────────────────────────────────────────

const audit = {
  '/audit': {
    get: op({
      tag: T_AUDIT,
      id: 'listerEvenementsAudit',
      resume: 'Lister le journal d’audit de l’organisation',
      detail: 'Les refus de droits y figurent au même titre que les actions abouties.',
      paginee: true,
      params: [
        filtre('depuis', horodatage()),
        filtre('jusqua', horodatage()),
        filtre('acteur', chaine()),
        filtre('action', chaine()),
        filtre('cible', chaine()),
        filtre('resultat', liste(['ok', 'refuse', 'erreur'])),
        filtre('scopeType', liste(['plateforme', 'org', 'espace', 'application', 'service'])),
      ],
      ok: page(ref('EvenementAudit')),
      rbac: 'audit.view',
    }),
  },
  '/audit/integrite': {
    get: op({
      tag: T_AUDIT,
      id: 'verifierIntegriteAudit',
      resume: 'Vérifier l’intégrité de la chaîne d’audit',
      detail:
        'Rejoue la chaîne de hachage de l’organisation active et recalcule chaque empreinte à ' +
        'partir des champs enregistrés : signale `intacte: false` et la première ligne en rupture ' +
        'dès qu’une entrée a été insérée, modifiée ou supprimée hors séquence.',
      ok: objet(
        {
          intacte: booleen(),
          entreesVerifiees: entier(),
          totalEntrees: entier(),
          ruptureId: chaine('Identifiant de la première entrée en rupture. Absent si la chaîne est intacte.'),
          ruptureDate: horodatage('Absente si la chaîne est intacte.'),
          raison: chaine('Absente si la chaîne est intacte.'),
          empreinteFinale: chaine('Empreinte de la dernière entrée. Présente seulement si la chaîne est intacte.'),
        },
        ['intacte', 'entreesVerifiees', 'totalEntrees'],
      ),
      rbac: 'compliance.export',
    }),
  },
  '/audit/export': {
    post: op({
      tag: T_AUDIT,
      id: 'exporterAudit',
      resume: 'Exporter le journal d’audit',
      corps: objet(
        {
          depuis: horodatage(),
          jusqua: horodatage(),
          format: liste(['csv', 'json', 'pdf']),
          signature: booleen('Empreinte signée jointe à l’export, pour un auditeur.'),
        },
        ['depuis', 'jusqua', 'format'],
      ),
      ok: objet(
        { travailId: chaine(), urlTelechargement: chaine(), expire: horodatage() },
        ['travailId'],
      ),
      code: 202,
      rbac: 'compliance.export',
    }),
  },
  '/conformite/rapports': {
    get: op({
      tag: T_AUDIT,
      id: 'listerRapportsConformite',
      resume: 'Lister les rapports de conformité disponibles',
      ok: tableau(
        objet(
          {
            id: chaine(),
            titre: chaine(),
            referentiel: chaine('`3-2-1`, `RGPD`, `ISO 27001`, `PCI-DSS`…'),
            periode: chaine(),
            genereLe: horodatage(),
            url: chaine(),
          },
          ['id', 'titre', 'referentiel', 'periode'],
        ),
      ),
      rbac: 'compliance.export',
    }),
    post: op({
      tag: T_AUDIT,
      id: 'genererRapportConformite',
      resume: 'Générer un rapport de conformité',
      corps: objet(
        { referentiel: chaine(), periode: chaine(), perimetre: tableau(chaine()) },
        ['referentiel', 'periode'],
      ),
      ok: ref('TravailProvisioning'),
      code: 202,
      rbac: 'compliance.export',
    }),
  },
}

export const cheminsIdentite = fusion(auth, moi, organisations, membres, securite, audit)
