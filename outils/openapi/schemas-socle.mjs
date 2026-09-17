/**
 * Schémas — enveloppes, erreurs, identité, IaaS, protection.
 *
 * Les noms de champs reprennent `src/lib/types.ts`. Quand un champ est
 * facultatif dans le modèle TypeScript, il est absent de `required` ici.
 */

import {
  BACKENDS,
  MOTEURS_MANAGES,
  ROLES,
  SITES,
  booleen,
  chaine,
  dictionnaire,
  entier,
  horodatage,
  jour,
  liste,
  montant,
  nombre,
  objet,
  pourcentage,
  ref,
  tableau,
} from './socle.mjs'

// ─── Enveloppes et erreurs ────────────────────────────────────────────

const communs = {
  Pagination: objet(
    {
      page: entier(),
      parPage: entier(),
      total: entier('Nombre total d’éléments correspondant au filtre.'),
      totalPages: entier(),
    },
    ['page', 'parPage', 'total', 'totalPages'],
  ),

  Erreur: objet(
    {
      code: chaine('Code stable, exploitable par le client (`quota_depasse`, `nom_deja_pris`).'),
      message: chaine('Phrase affichable, en français, qui dit ce qui bloque.'),
      detail: chaine('Contexte technique, jamais affiché tel quel.'),
      correlationId: chaine(
        "Identifiant de corrélation. L'interface l'affiche et le rend copiable sur tout écran d'erreur : " +
          "c'est ce que le client colle dans un ticket.",
      ),
      documentationUrl: chaine(),
    },
    ['code', 'message', 'correlationId'],
    'Forme unique de toutes les erreurs de l’API.',
  ),

  // Les erreurs voyagent sous une enveloppe `erreur` : un client distingue ainsi
  // un échec d'une ressource sans regarder le code HTTP. `erreur` ne porte que
  // le socle commun (code, message, correlationId) ; le détail propre à
  // chaque famille d'erreur (rôles requis, champs en défaut, intégration en
  // panne) voyage à côté, au même niveau que `erreur` — c'est la forme que
  // `AppError.corps()` construit réellement côté serveur.
  ReponseErreur: objet({ erreur: ref('Erreur') }, ['erreur']),

  ReponseErreurInterdit: objet(
    {
      erreur: ref('Erreur'),
      rolesRequis: tableau(liste(ROLES), 'Rôles qui exécutent pleinement cette action.'),
      roleCourant: liste(ROLES),
    },
    ['erreur', 'rolesRequis'],
  ),

  ReponseErreurValidation: objet(
    {
      erreur: ref('Erreur'),
      champs: dictionnaire(
        chaine(),
        'Message de validation par champ en défaut, indexé par son chemin (`prix`, `espaceId`…).',
      ),
    },
    ['erreur', 'champs'],
  ),

  ReponseErreurDegrade: objet(
    {
      erreur: ref('Erreur'),
      integration: chaine('Intégration en défaut : `centreon`, `grafana`, `victorialogs`, `openstack`…'),
      donneesPartielles: booleen('Vrai quand une réponse dégradée accompagne l’erreur.'),
      dateDonnees: horodatage('Fraîcheur des dernières données connues.'),
    },
    ['erreur', 'integration'],
  ),

  Quota: objet(
    { vcpu: entier(), ramGo: entier(), stockageTo: nombre() },
    ['vcpu', 'ramGo', 'stockageTo'],
  ),

  TravailProvisioning: objet(
    {
      id: chaine(),
      orgId: chaine(),
      type: chaine('Type de travail : `espace.create`, `vm.create`, `dr.failover`…'),
      label: chaine(),
      statut: liste(['queued', 'running', 'done', 'failed', 'rolled_back']),
      taches: tableau(
        objet(
          {
            ordre: entier(),
            nom: chaine(),
            statut: liste(['pending', 'running', 'ok', 'failed']),
            dureeS: entier(),
            message: chaine(),
          },
          ['ordre', 'nom', 'statut'],
        ),
      ),
      erreur: objet({ message: chaine(), correlationId: chaine(), suggestion: chaine() }, [
        'message',
        'correlationId',
      ]),
      startedAt: horodatage(),
      dureeS: entier(),
    },
    ['id', 'orgId', 'type', 'label', 'statut', 'taches', 'startedAt'],
    "Toute opération de provisioning est asynchrone et suivie par un travail : l'interface affiche " +
      'ses étapes une par une, et un échec nomme la tâche fautive plutôt que « erreur ».',
  ),

  PointSerie: objet({ ts: horodatage(), valeur: nombre() }, ['ts', 'valeur']),

  Serie: objet(
    {
      metrique: chaine('`cpu`, `ram`, `disque`, `reseau_entrant`, `rps`, `latence_p95`, `erreurs_5xx`…'),
      unite: chaine(),
      fenetre: liste(['24h', '7j', '30j']),
      points: tableau(ref('PointSerie')),
    },
    ['metrique', 'unite', 'fenetre', 'points'],
    'Série destinée à un `SparkChart`. Trois fenêtres seulement : au-delà, on renvoie vers Grafana.',
  ),

  Tuile: objet(
    {
      cle: chaine(),
      libelle: chaine(),
      valeur: nombre(),
      unite: chaine(),
      variationPct: nombre(),
      tendance: liste(['hausse', 'baisse', 'stable']),
    },
    ['cle', 'libelle', 'valeur'],
    'Valeur unitaire destinée à une `StatTile`.',
  ),

  EstimationCout: objet(
    {
      lignes: tableau(
        objet(
          {
            libelle: chaine(),
            quantite: nombre(),
            unite: chaine(),
            prixUnitaire: montant(),
            total: montant(),
          },
          ['libelle', 'quantite', 'total'],
        ),
      ),
      totalMensuel: montant(),
      totalHoraire: nombre('Coût horaire en FCFA, pour les ressources facturées à l’heure.'),
      proRataMoisCourant: montant(),
      devise: liste(['XOF', 'EUR', 'USD']),
      engagement: chaine('`aucun`, `12_mois`, `36_mois`.'),
      remisePct: nombre(),
      avertissements: tableau(chaine(), 'Ce que l’estimation ne couvre pas (egress, licences tierces).'),
    },
    ['lignes', 'totalMensuel', 'devise'],
    "Aperçu de coût exigé avant toute action facturable (`CostPreview`). Le corps de la demande " +
      "est celui de la ressource à créer : on estime ce qu'on s'apprête à commander.",
  ),

  DemandeEstimation: objet(
    {
      type: chaine('Type de ressource : `espace`, `vm`, `k8s`, `volume`, `bucket`, `base`, `service_manage`, `hebergement`, `certificat`, `siege`.'),
      quantite: entier(),
      periodicite: liste(['mensuelle', 'annuelle']),
      specification: dictionnaire({}, 'Corps de création de la ressource visée, tel qu’il sera envoyé.'),
    },
    ['type', 'specification'],
  ),

  LigneLog: objet(
    {
      ts: horodatage(),
      niveau: liste(['INFO', 'WARN', 'ERROR', 'DEBUG']),
      source: chaine(),
      message: chaine(),
    },
    ['ts', 'niveau', 'source', 'message'],
  ),

  ExtraitLogs: objet(
    {
      lignes: tableau(ref('LigneLog'), 'Vingt lignes au plus : le portail ne réimplémente pas un explorateur de journaux.'),
      tronque: booleen(),
      lienVictoriaLogs: chaine('URL de sortie vers VictoriaLogs, requête pré-remplie.'),
    },
    ['lignes', 'tronque'],
  ),

  LiensSortie: objet(
    {
      centreon: chaine('Supervision de la ressource dans Centreon.'),
      grafana: chaine('Tableau de bord Grafana correspondant.'),
      victorialogs: chaine('Recherche VictoriaLogs pré-filtrée.'),
    },
    [],
    'Le portail borne son observabilité et assume de sortir vers les outils spécialisés.',
  ),
}

// ─── Identité, tenancy, sécurité ──────────────────────────────────────

const identite = {
  Organisation: objet(
    {
      id: chaine(),
      nom: chaine(),
      pays: chaine(),
      secteur: chaine(),
      tva: chaine(),
      statut: liste(['active', 'suspendue', 'fermee']),
      logoUrl: chaine(),
      createdAt: horodatage(),
      espaces: entier(),
      utilisateurs: entier(),
      caMensuel: montant(),
      consommationVcpu: entier(),
      tenantPlan: chaine(),
      domaine: chaine(),
    },
    ['id', 'nom', 'pays', 'statut', 'createdAt'],
  ),

  OrganisationCreation: objet(
    {
      nom: chaine(),
      pays: chaine(),
      secteur: chaine(),
      tva: chaine(),
      tenantPlan: chaine(),
      administrateur: objet({ email: chaine(), nom: chaine() }, ['email', 'nom']),
    },
    ['nom', 'pays'],
  ),

  OrganisationModification: objet({
    nom: chaine(),
    secteur: chaine(),
    tva: chaine(),
    statut: liste(['active', 'suspendue', 'fermee']),
    logoUrl: chaine(),
    tenantPlan: chaine(),
  }),

  Utilisateur: objet(
    {
      id: chaine(),
      email: chaine(undefined, { format: 'email' }),
      nom: chaine(),
      mfaEnabled: booleen(),
      idpSource: liste(['local', 'oidc', 'saml', 'ldap']),
      lastLoginAt: horodatage(),
      orgId: chaine(),
      fonction: chaine(),
      statut: liste(['actif', 'invite', 'suspendu']),
    },
    ['id', 'email', 'nom', 'mfaEnabled', 'idpSource'],
  ),

  Membre: objet(
    {
      id: chaine(),
      userId: chaine(),
      orgId: chaine(),
      role: liste(ROLES),
      scopeType: liste(['org', 'espace', 'application', 'service']),
      scopeId: chaine(),
      scopeLabel: chaine(),
      utilisateur: ref('Utilisateur'),
    },
    ['id', 'userId', 'orgId', 'role', 'scopeType'],
  ),

  Invitation: objet(
    {
      id: chaine(),
      email: chaine(undefined, { format: 'email' }),
      orgId: chaine(),
      orgNom: chaine(),
      role: liste(ROLES),
      scopeType: liste(['org', 'espace', 'application', 'service']),
      scopeId: chaine(),
      invitePar: chaine(),
      expire: horodatage(),
      statut: liste(['en_attente', 'acceptee', 'expiree', 'revoquee']),
    },
    ['id', 'email', 'orgId', 'role', 'scopeType', 'expire', 'statut'],
  ),

  InvitationCreation: objet(
    {
      email: chaine(undefined, { format: 'email' }),
      role: liste(ROLES),
      scopeType: liste(['org', 'espace', 'application', 'service']),
      scopeId: chaine(),
      message: chaine(),
    },
    ['email', 'role', 'scopeType'],
  ),

  DemandeConnexion: objet(
    { email: chaine(undefined, { format: 'email' }), motDePasse: chaine(undefined, { format: 'password' }) },
    ['email', 'motDePasse'],
  ),

  Session: objet(
    {
      accessToken: chaine('Jeton porteur, à placer dans `Authorization: Bearer`.'),
      refreshToken: chaine(),
      expiresIn: entier('Durée de vie du jeton d’accès, en secondes.'),
      utilisateur: ref('Utilisateur'),
      organisations: tableau(ref('AppartenanceOrganisation')),
      organisationActive: chaine(),
      roleActif: liste(ROLES),
      mfaRequis: booleen('Vrai quand un second facteur reste à fournir : `accessToken` est alors absent.'),
      defiMfa: chaine('Identifiant du défi à renvoyer à `/auth/mfa`.'),
    },
    ['expiresIn'],
  ),

  AppartenanceOrganisation: objet(
    {
      orgId: chaine(),
      nom: chaine(),
      secteur: chaine(),
      role: liste(ROLES),
      logoUrl: chaine(),
      defaut: booleen(),
    },
    ['orgId', 'nom', 'role'],
  ),

  Inscription: objet(
    {
      email: chaine(undefined, { format: 'email' }),
      nom: chaine(),
      motDePasse: chaine(undefined, { format: 'password' }),
      telephone: chaine(),
      organisation: ref('OrganisationCreation'),
      accepteConditions: booleen(),
    },
    ['email', 'nom', 'motDePasse', 'accepteConditions'],
  ),

  DecouverteSso: objet(
    {
      federationDisponible: booleen(),
      orgId: chaine(),
      orgNom: chaine(),
      protocole: liste(['oidc', 'saml', 'ldap']),
      urlDemarrage: chaine('URL vers laquelle rediriger le navigateur.'),
      libelleBouton: chaine(),
    },
    ['federationDisponible'],
  ),

  ConfigurationSso: objet(
    {
      actif: booleen(),
      protocole: liste(['oidc', 'saml', 'ldap']),
      emetteur: chaine(),
      clientId: chaine(),
      secretDefini: booleen('Le secret n’est jamais renvoyé.'),
      urlMetadonnees: chaine(),
      certificatEmpreinte: chaine(),
      domainesVerifies: tableau(chaine()),
      provisioningJustInTime: booleen(),
      correspondanceGroupes: tableau(
        objet({ groupe: chaine(), role: liste(ROLES), scopeId: chaine() }, ['groupe', 'role']),
      ),
      dernierTest: objet({ date: horodatage(), succes: booleen(), detail: chaine() }),
    },
    ['actif'],
  ),

  PolitiquesSecurite: objet(
    {
      mfa: objet(
        {
          obligatoire: booleen(),
          methodes: tableau(liste(['totp', 'webauthn', 'sms'])),
          delaiGraceJours: entier(),
          exemptions: tableau(chaine(), 'Identifiants de comptes de service exemptés.'),
        },
        ['obligatoire', 'methodes'],
      ),
      session: objet(
        {
          dureeMaxMin: entier(),
          inactiviteMin: entier(),
          sessionUniqueParUtilisateur: booleen(),
          reauthentificationActionsSensibles: booleen(),
        },
        ['dureeMaxMin', 'inactiviteMin'],
      ),
      restrictionIp: objet(
        {
          actif: booleen(),
          plages: tableau(
            objet({ cidr: chaine(), libelle: chaine(), portee: liste(['portail', 'api', 'les_deux']) }, [
              'cidr',
              'portee',
            ]),
          ),
          appliqueAuxAdmins: booleen(),
        },
        ['actif', 'plages'],
      ),
      motDePasse: objet({
        longueurMin: entier(),
        complexite: liste(['faible', 'standard', 'forte']),
        rotationJours: entier(),
        interdireReutilisation: entier(),
      }),
    },
    ['mfa', 'session', 'restrictionIp'],
    'Politiques de sécurité de l’organisation — écran `/app/securite`, onglet Politiques.',
  ),

  SessionActive: objet(
    {
      id: chaine(),
      userId: chaine(),
      utilisateurNom: chaine(),
      email: chaine(),
      ip: chaine(),
      pays: chaine(),
      agent: chaine(),
      appareil: chaine(),
      idpSource: liste(['local', 'oidc', 'saml', 'ldap']),
      debut: horodatage(),
      derniereActivite: horodatage(),
      courante: booleen('Vrai pour la session qui fait l’appel : l’interface la désigne au lieu de la révoquer par erreur.'),
    },
    ['id', 'userId', 'ip', 'debut', 'derniereActivite'],
  ),

  CleApi: objet(
    {
      id: chaine(),
      nom: chaine(),
      prefixe: chaine('Six premiers caractères, seuls affichables après création.'),
      portee: tableau(chaine(), 'Actions RBAC autorisées, ou `*`.'),
      scopeType: liste(['org', 'espace', 'application', 'service']),
      scopeId: chaine(),
      creeLe: horodatage(),
      creePar: chaine(),
      expire: horodatage(),
      derniereUtilisation: horodatage(),
      ipsAutorisees: tableau(chaine()),
      statut: liste(['active', 'revoquee', 'expiree']),
    },
    ['id', 'nom', 'prefixe', 'portee', 'creeLe', 'statut'],
  ),

  CleApiCreation: objet(
    {
      nom: chaine(),
      portee: tableau(chaine()),
      scopeType: liste(['org', 'espace', 'application', 'service']),
      scopeId: chaine(),
      expire: horodatage(),
      ipsAutorisees: tableau(chaine()),
    },
    ['nom', 'portee'],
  ),

  CleApiSecret: objet(
    {
      cle: ref('CleApi'),
      secret: chaine('Renvoyé une seule fois, à la création ou à la rotation.'),
    },
    ['cle', 'secret'],
  ),

  ActionRbac: objet(
    {
      id: chaine(),
      libelle: chaine(),
      groupe: chaine(),
      perms: dictionnaire(liste(['full', 'read', 'none']), 'Permission par rôle.'),
    },
    ['id', 'libelle', 'groupe', 'perms'],
    "Matrice RBAC servie au client : l'interface désactive une action interdite plutôt que de la masquer, " +
      'et nomme le rôle requis dans l’infobulle.',
  ),

  Preferences: objet(
    {
      langue: liste(['fr', 'en']),
      fuseau: chaine(),
      pageAccueil: liste(
        ['tableau_de_bord', 'lanceur'],
        'Un membre au rôle purement utilisateur peut avoir le lanceur de services comme page d’accueil.',
      ),
      sitePrefere: liste(SITES),
      deviseAffichee: liste(['XOF', 'EUR', 'USD']),
      notifications: objet({ email: booleen(), sms: booleen(), whatsapp: booleen() }),
      formatCompact: booleen(),
    },
    [],
  ),

  EvenementAudit: objet(
    {
      id: chaine(),
      ts: horodatage(),
      orgId: chaine(),
      orgNom: chaine(),
      actor: objet(
        { id: chaine(), nom: chaine(), email: chaine(), type: liste(['user', 'systeme', 'api']) },
        ['id', 'nom', 'type'],
      ),
      role: liste(ROLES),
      scope: objet(
        {
          type: liste(['plateforme', 'org', 'espace', 'application', 'service']),
          id: chaine(),
          label: chaine(),
        },
        ['type', 'label'],
      ),
      action: chaine(),
      target: chaine(),
      result: liste(['ok', 'refuse', 'erreur']),
      detail: chaine(),
      ip: chaine(),
    },
    ['id', 'ts', 'actor', 'role', 'scope', 'action', 'target', 'result'],
  ),
}

// ─── IaaS ─────────────────────────────────────────────────────────────

const iaas = {
  EspaceCloud: objet(
    {
      id: chaine(),
      orgId: chaine(),
      code: chaine(),
      offerId: chaine(),
      offreNom: chaine(),
      site: liste(SITES),
      cidr: chaine(),
      quota: ref('Quota'),
      usage: ref('Quota'),
      projets: entier(),
      statut: liste(['active', 'suspendue', 'provisioning']),
      createdAt: horodatage(),
      dnsInterne: chaine(),
    },
    ['id', 'orgId', 'code', 'offerId', 'site', 'cidr', 'quota', 'usage', 'statut', 'createdAt'],
  ),

  EspaceCloudCreation: objet(
    {
      code: chaine('Code court, unique dans l’organisation.'),
      offerId: chaine(),
      site: liste(SITES),
      cidr: chaine('Plage privée de l’espace, en notation CIDR.'),
      quota: ref('Quota'),
      dnsInterne: chaine(),
      backendPrefere: chaine('Laisser vide pour laisser le placement décider.'),
    },
    ['code', 'offerId', 'site', 'cidr', 'quota'],
  ),

  EspaceCloudModification: objet({
    code: chaine(),
    quota: ref('Quota'),
    dnsInterne: chaine(),
    statut: liste(['active', 'suspendue']),
  }),

  Backend: objet(
    {
      id: chaine(),
      code: chaine(),
      type: liste(BACKENDS),
      site: liste(SITES),
      hosts: entier(),
      statut: liste(['en_ligne', 'maintenance', 'degrade']),
      usage: objet({ vcpuPct: pourcentage(), ramPct: pourcentage(), stockagePct: pourcentage() }, [
        'vcpuPct',
        'ramPct',
        'stockagePct',
      ]),
      capacite: ref('Quota'),
      enSortie: objet({ actif: booleen(), cibleMigration: chaine() }, ['actif', 'cibleMigration']),
      souverain: booleen(),
      saturation: objet({ j30: pourcentage(), j60: pourcentage(), j90: pourcentage() }),
    },
    ['id', 'code', 'type', 'site', 'hosts', 'statut', 'usage', 'capacite', 'souverain'],
  ),

  Placement: objet({ id: chaine(), espaceId: chaine(), backendId: chaine(), percent: pourcentage() }, [
    'id',
    'espaceId',
    'backendId',
    'percent',
  ]),

  MateielVirtuel: objet(
    {
      scsiControllers: entier(),
      nics: entier(),
      usb: booleen(),
      secureBoot: booleen(),
      videoMo: entier(),
      vtpm: booleen(),
    },
    ['scsiControllers', 'nics', 'usb', 'secureBoot'],
  ),

  Vm: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      os: chaine(),
      vcpu: entier(),
      ramGo: entier(),
      diskGo: entier(),
      ips: tableau(
        objet({ adresse: chaine(), type: liste(['privee', 'publique']), ptr: chaine() }, [
          'adresse',
          'type',
        ]),
      ),
      statut: liste(['running', 'stopped', 'creating', 'error', 'migrating']),
      applicationId: chaine(),
      applicationNom: chaine(),
      hardware: ref('MateielVirtuel'),
      backupPlanId: chaine(),
      derniereSauvegarde: horodatage(),
      site: liste(SITES),
      tags: tableau(chaine()),
      flavor: chaine(),
    },
    ['id', 'espaceId', 'nom', 'os', 'vcpu', 'ramGo', 'diskGo', 'ips', 'statut', 'hardware', 'site'],
  ),

  VmCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      imageId: chaine('Image système du catalogue.'),
      gabarit: chaine('Gabarit prédéfini ; ou renseigner vcpu/ramGo/diskGo.'),
      vcpu: entier(),
      ramGo: entier(),
      diskGo: entier(),
      classeDisque: liste(['nvme', 'ssd', 'hdd']),
      reseauId: chaine(),
      ipPubliqueDemandee: booleen(),
      groupesSecurite: tableau(chaine()),
      cleSsh: chaine(),
      cloudInit: chaine('Script d’amorçage, encodé en clair.'),
      hardware: ref('MateielVirtuel'),
      backupPlanId: chaine(),
      tags: tableau(chaine()),
      site: liste(SITES),
    },
    ['espaceId', 'nom', 'imageId'],
  ),

  VmModification: objet({
    nom: chaine(),
    tags: tableau(chaine()),
    backupPlanId: chaine(),
    applicationId: chaine(),
  }),

  VmRedimensionnement: objet(
    {
      vcpu: entier(),
      ramGo: entier(),
      diskGo: entier('Un disque ne se réduit pas : la valeur doit être supérieure ou égale à l’actuelle.'),
      redemarrageAutorise: booleen('Sans redémarrage autorisé, seule l’extension à chaud est tentée.'),
    },
    [],
  ),

  VmLotCreation: objet(
    {
      espaceId: chaine(),
      site: liste(SITES),
      reseauId: chaine(),
      groupesSecurite: tableau(chaine()),
      machines: tableau(
        objet(
          {
            nom: chaine(),
            quantite: entier('Suffixe numérique ajouté au nom quand la quantité dépasse 1.'),
            imageId: chaine(),
            vcpu: entier(),
            ramGo: entier(),
            diskGo: entier(),
            classeDisque: liste(['nvme', 'ssd', 'hdd']),
            nics: entier(),
            role: chaine('Rôle applicatif, pour l’étiquetage : `web`, `api`, `db`…'),
            logicielsPreinstalles: tableau(chaine()),
            backupPlanId: chaine(),
          },
          ['nom', 'imageId', 'vcpu', 'ramGo', 'diskGo'],
        ),
        'Plan de déploiement composé dans l’écran de composition.',
      ),
      cleSsh: chaine(),
      cloudInit: chaine('Script d’amorçage, encodé en clair, commun au lot.'),
      antiAffinite: booleen('Répartit les machines du lot sur des hôtes distincts.'),
    },
    ['espaceId', 'machines'],
    "Déploiement de plusieurs serveurs en une passe, tel que composé dans `/app/vms/composer`.",
  ),

  ImageSysteme: objet(
    {
      id: chaine(),
      nom: chaine(),
      famille: liste(['linux', 'windows', 'bsd', 'appliance']),
      version: chaine(),
      architecture: liste(['x86_64', 'aarch64']),
      tailleGo: entier(),
      licencePayante: booleen(),
      coutLicenceMensuel: montant(),
      sitesDisponibles: tableau(liste(SITES)),
      finDeSupport: jour(),
      logicielsPreinstallables: tableau(chaine()),
    },
    ['id', 'nom', 'famille', 'version', 'architecture', 'sitesDisponibles'],
  ),

  Gabarit: objet(
    {
      id: chaine(),
      nom: chaine(),
      vcpu: entier(),
      ramGo: entier(),
      diskGo: entier(),
      famille: liste(['generique', 'calcul', 'memoire', 'gpu', 'economique']),
      prixMensuel: montant(),
      sitesDisponibles: tableau(liste(SITES)),
    },
    ['id', 'nom', 'vcpu', 'ramGo', 'diskGo', 'famille', 'prixMensuel'],
  ),

  ConsoleVm: objet(
    {
      url: chaine('URL de console à usage unique.'),
      protocole: liste(['vnc', 'spice', 'serie']),
      expire: horodatage(),
    },
    ['url', 'protocole', 'expire'],
  ),

  PoolWorkers: objet(
    {
      nom: chaine(),
      nodes: entier(),
      flavor: chaine(),
      diskGo: entier(),
      autoscale: objet({ min: entier(), max: entier() }, ['min', 'max']),
      type: liste(['standard', 'gpu', 'memory', 'preemptible']),
      labels: tableau(chaine()),
      taints: tableau(chaine()),
    },
    ['nom', 'nodes', 'flavor', 'type'],
  ),

  ClusterK8s: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      version: chaine(),
      controlPlane: objet({ mode: liste(['single', 'ha']), nodes: entier() }, ['mode', 'nodes']),
      pools: tableau(ref('PoolWorkers')),
      modules: tableau(chaine(), 'Modules installés : `ingress-nginx`, `cert-manager`, `metrics-server`…'),
      statut: liste(['running', 'degraded', 'provisioning', 'updating']),
      site: liste(SITES),
      applicationId: chaine(),
    },
    ['id', 'espaceId', 'nom', 'version', 'controlPlane', 'pools', 'modules', 'statut', 'site'],
  ),

  ClusterK8sCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      version: chaine('Version qualifiée, jamais « latest ».'),
      site: liste(SITES),
      controlPlane: objet({ mode: liste(['single', 'ha']) }, ['mode']),
      pools: tableau(ref('PoolWorkers')),
      modules: tableau(chaine()),
      reseauId: chaine(),
      cidrPods: chaine(),
      cidrServices: chaine(),
      apiPrivee: booleen('Serveur d’API joignable seulement depuis l’espace.'),
    },
    ['espaceId', 'nom', 'version', 'site', 'controlPlane', 'pools'],
    'Corps des quatre étapes de l’assistant : version et région, control plane, pools, modules.',
  ),

  VersionK8s: objet(
    {
      version: chaine(),
      statut: liste(['recommandee', 'supportee', 'depreciee']),
      finDeSupport: jour(),
      notesUrl: chaine(),
      modulesCompatibles: tableau(chaine()),
    },
    ['version', 'statut'],
  ),

  Kubeconfig: objet(
    {
      contenu: chaine('Fichier kubeconfig complet, au format YAML.'),
      expire: horodatage(),
      utilisateur: chaine(),
    },
    ['contenu', 'utilisateur'],
  ),

  Reseau: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      cidr: chaine(),
      dnsInterne: booleen(),
      workloads: entier(),
      vlan: entier(),
    },
    ['id', 'espaceId', 'nom', 'cidr', 'dnsInterne', 'workloads'],
  ),

  ReseauCreation: objet(
    { nom: chaine(), cidr: chaine(), espaceId: chaine(), dnsInterne: booleen(), vlan: entier() },
    ['nom', 'cidr', 'espaceId'],
  ),

  IpPublique: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      adresse: chaine(),
      ptr: chaine(),
      attachedTo: chaine(),
      attachedLabel: chaine(),
      antiDdos: booleen(),
    },
    ['id', 'espaceId', 'adresse'],
  ),

  IpPubliqueReservation: objet(
    { espaceId: chaine(), site: liste(SITES), antiDdos: booleen(), ptr: chaine() },
    ['espaceId', 'site'],
  ),

  RegleSecurite: objet(
    {
      id: chaine(),
      direction: liste(['in', 'out']),
      protocole: liste(['tcp', 'udp', 'icmp', 'any']),
      ports: chaine('Port unique ou plage : `443`, `8000-8100`.'),
      cible: chaine('CIDR ou identifiant d’un autre groupe de sécurité.'),
      description: chaine(),
    },
    ['id', 'direction', 'protocole', 'cible'],
  ),

  GroupeSecurite: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      description: chaine(),
      defaultPolicy: objet(
        { ingress: liste(['deny', 'allow']), egress: liste(['deny', 'allow']) },
        ['ingress', 'egress'],
      ),
      rules: tableau(ref('RegleSecurite')),
      attaches: entier(),
    },
    ['id', 'espaceId', 'nom', 'defaultPolicy', 'rules', 'attaches'],
  ),

  GroupeSecuriteCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      description: chaine(),
      defaultPolicy: objet({ ingress: liste(['deny', 'allow']), egress: liste(['deny', 'allow']) }),
      rules: tableau(ref('RegleSecurite')),
    },
    ['espaceId', 'nom'],
  ),

  TunnelVpn: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      type: liste(['ipsec', 'ssl']),
      passerelleDistante: chaine(),
      reseauxAnnonces: tableau(chaine()),
      statut: liste(['up', 'down', 'negociation']),
      derniereNegociation: horodatage(),
      profils: tableau(
        objet({ nom: chaine(), utilisateur: chaine(), cree: horodatage(), revoque: booleen() }, [
          'nom',
          'utilisateur',
          'cree',
        ]),
      ),
    },
    ['id', 'espaceId', 'nom', 'type', 'statut'],
  ),

  TunnelVpnCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      type: liste(['ipsec', 'ssl']),
      passerelleDistante: chaine(),
      reseauxAnnonces: tableau(chaine()),
      secretPartage: chaine(),
      propositions: objet({ chiffrement: chaine(), integrite: chaine(), dhGroupe: chaine() }),
    },
    ['espaceId', 'nom', 'type'],
  ),

  LoadBalancer: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      layer: liste(['l4', 'l7']),
      exposure: liste(['public', 'interne']),
      vip: chaine(),
      algo: liste(['round_robin', 'least_conn', 'source_hash', 'weighted']),
      sticky: liste(['cookie', 'ip']),
      listeners: tableau(
        objet({ protocole: chaine(), port: entier(), certId: chaine(), tlsMin: chaine() }, [
          'protocole',
          'port',
        ]),
      ),
      pool: tableau(
        objet(
          {
            targetId: chaine(),
            targetLabel: chaine(),
            poids: entier(),
            sante: liste(['ok', 'ko', 'drain']),
          },
          ['targetId', 'targetLabel', 'poids', 'sante'],
        ),
      ),
      healthCheck: objet(
        {
          protocole: chaine(),
          chemin: chaine(),
          codeAttendu: entier(),
          intervalleS: entier(),
          seuilKo: entier(),
          seuilOk: entier(),
        },
        ['protocole', 'intervalleS', 'seuilKo', 'seuilOk'],
      ),
      waf: objet({ actif: booleen(), ruleset: chaine() }, ['actif', 'ruleset']),
      rateLimit: objet({ requetesParMin: entier() }, ['requetesParMin']),
      metriques: objet(
        {
          rps: nombre(),
          p50: nombre(),
          p95: nombre(),
          p99: nombre(),
          taux4xx: nombre(),
          taux5xx: nombre(),
          connexions: entier(),
        },
        ['rps', 'p50', 'p95', 'p99', 'taux4xx', 'taux5xx', 'connexions'],
      ),
      reglesL7: tableau(
        objet({ hote: chaine(), chemin: chaine(), entete: chaine(), cible: chaine() }, ['cible']),
      ),
    },
    ['id', 'espaceId', 'nom', 'layer', 'exposure', 'vip', 'algo', 'listeners', 'pool', 'healthCheck', 'metriques'],
  ),

  LoadBalancerCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      layer: liste(['l4', 'l7']),
      exposure: liste(['public', 'interne']),
      algo: liste(['round_robin', 'least_conn', 'source_hash', 'weighted']),
      sticky: liste(['cookie', 'ip']),
      listeners: tableau(objet({ protocole: chaine(), port: entier(), certId: chaine(), tlsMin: chaine() })),
      cibles: tableau(objet({ targetId: chaine(), poids: entier() }, ['targetId'])),
      healthCheck: objet({
        protocole: chaine(),
        chemin: chaine(),
        codeAttendu: entier(),
        intervalleS: entier(),
        seuilKo: entier(),
        seuilOk: entier(),
      }),
      waf: objet({ actif: booleen(), ruleset: chaine() }),
      rateLimit: objet({ requetesParMin: entier() }),
    },
    ['espaceId', 'nom', 'layer', 'exposure'],
  ),

  Volume: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      tailleGo: entier(),
      classe: liste(['nvme', 'ssd', 'hdd', 'archive']),
      chiffre: booleen(),
      attachedTo: chaine(),
      attachedLabel: chaine(),
      ephemere: booleen(),
      iops: entier(),
      montage: chaine(),
    },
    ['id', 'espaceId', 'nom', 'tailleGo', 'classe', 'chiffre', 'ephemere', 'iops'],
  ),

  VolumeCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      tailleGo: entier(),
      classe: liste(['nvme', 'ssd', 'hdd', 'archive']),
      chiffre: booleen(),
      attacherA: chaine('Identifiant de VM à laquelle rattacher le volume dès sa création.'),
      montage: chaine(),
    },
    ['espaceId', 'nom', 'tailleGo', 'classe'],
  ),

  Bucket: objet(
    {
      id: chaine(),
      orgId: chaine(),
      nom: chaine(),
      region: liste(SITES),
      classe: liste(['chaud', 'froid']),
      tailleGo: nombre(),
      objets: entier(),
      versioning: booleen(),
      objectLock: objet({ actif: booleen(), retentionJours: entier() }, ['actif', 'retentionJours']),
      replication: objet({ cible: liste(SITES) }, ['cible']),
      accessLogs: booleen(),
      policy: liste(['prive', 'lecture_publique', 'json']),
    },
    ['id', 'orgId', 'nom', 'region', 'classe', 'tailleGo', 'objets', 'versioning', 'accessLogs', 'policy'],
  ),

  BucketCreation: objet(
    {
      nom: chaine(),
      region: liste(SITES),
      classe: liste(['chaud', 'froid']),
      versioning: booleen(),
      objectLock: objet({ actif: booleen(), retentionJours: entier() }),
      replication: objet({ cible: liste(SITES) }),
      accessLogs: booleen(),
      policy: liste(['prive', 'lecture_publique', 'json']),
      policyJson: chaine('Politique explicite, quand `policy` vaut `json`.'),
    },
    ['nom', 'region', 'classe'],
  ),

  CleS3: objet(
    {
      id: chaine(),
      nom: chaine(),
      portee: chaine('Buckets et droits couverts, en clair.'),
      buckets: tableau(chaine()),
      droits: liste(['lecture', 'ecriture', 'lecture_ecriture']),
      creee: jour(),
      derniereUtilisation: horodatage(),
      accessKeyId: chaine(),
    },
    ['id', 'nom', 'portee', 'creee'],
  ),

  CleS3Creation: objet(
    {
      nom: chaine(),
      buckets: tableau(chaine(), 'Vide pour couvrir tous les buckets de l’organisation.'),
      droits: liste(['lecture', 'ecriture', 'lecture_ecriture']),
    },
    ['nom', 'droits'],
  ),

  CleS3Secret: objet(
    { cle: ref('CleS3'), accessKeyId: chaine(), secretAccessKey: chaine('Renvoyé une seule fois.'), endpoint: chaine() },
    ['cle', 'accessKeyId', 'secretAccessKey', 'endpoint'],
  ),

  BaseManagee: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      moteur: liste(MOTEURS_MANAGES),
      version: chaine(),
      palier: chaine(),
      ha: booleen(),
      tailleGo: entier(),
      connexions: objet({ actives: entier(), max: entier() }, ['actives', 'max']),
      replicas: entier(),
      statut: liste(['running', 'degraded', 'maintenance']),
      pitr: booleen(),
      host: chaine(),
    },
    ['id', 'espaceId', 'nom', 'moteur', 'version', 'palier', 'ha', 'tailleGo', 'connexions', 'replicas', 'statut', 'pitr', 'host'],
  ),

  BaseManageeCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      moteur: liste(MOTEURS_MANAGES),
      version: chaine(),
      palier: chaine(),
      ha: booleen(),
      tailleGo: entier(),
      pitr: booleen(),
      replicas: entier(),
      reseauId: chaine(),
      sourcesAutorisees: tableau(chaine(), 'CIDR autorisés à se connecter.'),
    },
    ['espaceId', 'nom', 'moteur', 'version', 'palier'],
  ),
}

// ─── Protection : sauvegarde, restauration, PRA ───────────────────────

const protection = {
  PlanSauvegarde: objet(
    {
      id: chaine(),
      orgId: chaine(),
      nom: chaine(),
      scope: objet(
        { type: liste(['tag', 'espace', 'ressource', 'service']), valeur: chaine() },
        ['type', 'valeur'],
      ),
      frequence: liste(['horaire', 'quotidien', 'hebdo', 'continu']),
      mode: liste(['incrementale_complete_hebdo', 'complete']),
      retentionJours: entier(),
      immutable: booleen(),
      destinations: tableau(
        objet({ type: liste(['local', 'autre_site', 'immuable']), bucketId: chaine() }, ['type']),
      ),
      prochaineExecution: horodatage(),
      chiffrement: objet({ mode: liste(['synelia', 'byok']), kmsRef: chaine() }, ['mode']),
      ressourcesProtegees: entier(),
      dernierResultat: liste(['ok', 'echec', 'partiel']),
    },
    ['id', 'orgId', 'nom', 'scope', 'frequence', 'mode', 'retentionJours', 'immutable', 'destinations', 'prochaineExecution', 'chiffrement', 'ressourcesProtegees', 'dernierResultat'],
  ),

  PlanSauvegardeCreation: objet(
    {
      nom: chaine(),
      scope: objet({ type: liste(['tag', 'espace', 'ressource', 'service']), valeur: chaine() }, [
        'type',
        'valeur',
      ]),
      frequence: liste(['horaire', 'quotidien', 'hebdo', 'continu']),
      mode: liste(['incrementale_complete_hebdo', 'complete']),
      retentionJours: entier(),
      immutable: booleen(),
      destinations: tableau(objet({ type: liste(['local', 'autre_site', 'immuable']), bucketId: chaine() }, ['type'])),
      chiffrement: objet({ mode: liste(['synelia', 'byok']), kmsRef: chaine() }),
      fenetre: chaine('Plage horaire d’exécution, `22:00-04:00`.'),
    },
    ['nom', 'scope', 'frequence', 'mode', 'retentionJours', 'destinations'],
  ),

  PointRestauration: objet(
    {
      id: chaine(),
      planId: chaine(),
      planNom: chaine(),
      resourceId: chaine(),
      resourceNom: chaine(),
      resourceType: chaine(),
      date: horodatage(),
      tailleGo: nombre(),
      type: liste(['complete', 'incrementale', 'snapshot']),
      immuableJusquau: horodatage(),
      verifie: booleen(),
      destination: chaine(),
      expiration: horodatage(),
    },
    ['id', 'planId', 'resourceId', 'resourceNom', 'resourceType', 'date', 'tailleGo', 'type', 'verifie', 'destination', 'expiration'],
  ),

  DemandeRestauration: objet(
    {
      pointId: chaine(),
      cible: liste(
        ['origine', 'nouvelle_ressource', 'autre_site'],
        'Restaurer en place, à côté, ou sur le site de repli.',
      ),
      nomCible: chaine(),
      site: liste(SITES),
      granularite: liste(
        ['complete', 'fichiers', 'base', 'boite_mail', 'objet'],
        'Restauration granulaire : ce qu’on remonte réellement.',
      ),
      chemins: tableau(chaine(), 'Éléments à restaurer quand la granularité n’est pas `complete`.'),
      ecraserExistant: booleen(),
      confirmation: chaine('Nom exact de la ressource cible quand la restauration écrase en place.'),
    },
    ['pointId', 'cible', 'granularite'],
  ),

  LigneConformite: objet(
    {
      ressourceId: chaine(),
      ressourceNom: chaine(),
      type: chaine(),
      protection: liste(['protegee', 'non_protegee', 'echec']),
      dernierSucces: horodatage(),
      rpoConstateMin: entier(),
      regle321: objet({ copies: booleen(), supports: booleen(), horsSite: booleen() }, [
        'copies',
        'supports',
        'horsSite',
      ]),
      dernierTestRestauration: objet({ date: horodatage(), succes: booleen(), dureeMin: entier() }, [
        'date',
        'succes',
        'dureeMin',
      ]),
    },
    ['ressourceId', 'ressourceNom', 'type', 'protection', 'regle321'],
    'Tableau de conformité 3-2-1 — celui qu’on montre à un auditeur.',
  ),

  PlanPra: objet(
    {
      id: chaine(),
      orgId: chaine(),
      nom: chaine(),
      siteSource: liste(SITES),
      siteRepli: liste(SITES),
      rpoCibleMin: entier(),
      rpoConstateMin: entier(),
      rtoCibleMin: entier(),
      rtoConstateMin: entier(),
      groupes: tableau(
        objet(
          {
            ordre: entier(),
            nom: chaine(),
            ressources: tableau(chaine()),
            dependances: tableau(chaine()),
            ipRepli: dictionnaire(chaine(), 'Correspondance d’adresses sur le site de repli.'),
          },
          ['ordre', 'nom', 'ressources', 'dependances'],
        ),
      ),
      replication: objet({ mode: liste(['continu', 'planifie']), retardS: entier() }, ['mode', 'retardS']),
      exercices: tableau(ref('ExercicePra')),
      statut: liste(['operationnel', 'degrade', 'jamais_teste']),
    },
    ['id', 'orgId', 'nom', 'siteSource', 'siteRepli', 'rpoCibleMin', 'rtoCibleMin', 'groupes', 'replication', 'exercices', 'statut'],
  ),

  PlanPraCreation: objet(
    {
      nom: chaine(),
      siteSource: liste(SITES),
      siteRepli: liste(SITES),
      rpoCibleMin: entier(),
      rtoCibleMin: entier(),
      groupes: tableau(
        objet(
          { ordre: entier(), nom: chaine(), ressources: tableau(chaine()), dependances: tableau(chaine()) },
          ['ordre', 'nom', 'ressources'],
        ),
      ),
      replication: objet({ mode: liste(['continu', 'planifie']), retardS: entier() }),
    },
    ['nom', 'siteSource', 'siteRepli', 'rpoCibleMin', 'rtoCibleMin', 'groupes'],
  ),

  ExercicePra: objet(
    {
      date: horodatage(),
      type: liste(['test', 'reel']),
      dureeMin: entier(),
      rtoConstateMin: entier(),
      succes: booleen(),
      rapportUrl: chaine(),
      incidents: tableau(chaine()),
    },
    ['date', 'type', 'dureeMin', 'rtoConstateMin', 'succes', 'rapportUrl'],
  ),

  DemandeBascule: objet(
    {
      type: liste(['test', 'reel'], 'Une bascule réelle coupe le site source ; un test s’exécute en isolation.'),
      groupes: tableau(chaine(), 'Groupes à basculer ; vide pour tout le plan.'),
      confirmation: chaine('Nom exact du plan — exigé pour une bascule réelle.'),
      fenetre: horodatage('Bascule planifiée plutôt qu’immédiate.'),
      motif: chaine(),
    },
    ['type'],
  ),
}

export const schemasSocle = { ...communs, ...identite, ...iaas, ...protection }
