/**
 * Schémas — plateforme applicative, projets, modèles, services managés,
 * Web Cloud, commerce, exploitation, vitrine.
 */

import {
  DEVISES,
  MOTEURS_PROJET,
  MOYENS_PAIEMENT,
  ROLES,
  SITES,
  TYPES_ENREGISTREMENT_DNS,
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

// ─── Plateforme applicative (PaaS) ────────────────────────────────────

const paas = {
  ApplicationPaas: objet(
    {
      id: chaine(),
      espaceId: chaine(),
      nom: chaine(),
      source: liste(['git', 'image', 'canvas']),
      repo: objet(
        { provider: liste(['github', 'gitlab']), url: chaine(), branche: chaine() },
        ['provider', 'url', 'branche'],
      ),
      builder: liste(['nixpacks', 'dockerfile', 'image']),
      cible: liste(['vm', 'k8s']),
      domainePrincipal: chaine(),
      sante: liste(['sain', 'degrade', 'arrete', 'echec']),
      stack: tableau(chaine()),
      dernierDeploiement: horodatage(),
      environnements: entier(),
      description: chaine(),
    },
    ['id', 'espaceId', 'nom', 'source', 'cible', 'domainePrincipal', 'sante', 'stack', 'dernierDeploiement', 'environnements'],
  ),

  ApplicationPaasCreation: objet(
    {
      espaceId: chaine(),
      nom: chaine(),
      source: liste(['git', 'image', 'canvas']),
      repo: objet({ provider: liste(['github', 'gitlab']), url: chaine(), branche: chaine() }),
      image: chaine('Référence d’image quand `source` vaut `image`.'),
      builder: liste(['nixpacks', 'dockerfile', 'image']),
      cible: liste(['vm', 'k8s']),
      domainePrincipal: chaine(),
      description: chaine(),
      briques: tableau(chaine(), 'Briques du canvas quand `source` vaut `canvas`.'),
    },
    ['espaceId', 'nom', 'source', 'cible'],
  ),

  Environnement: objet(
    {
      id: chaine(),
      appId: chaine(),
      nom: chaine(),
      domaines: tableau(chaine()),
      couleur: chaine(),
      statut: liste(['running', 'degraded', 'stopped', 'building', 'failed']),
      autoDeploy: objet({ branche: chaine(), previewParPR: booleen() }, ['branche', 'previewParPR']),
      protection: objet({
        approbationRequise: booleen(),
        gelJusquau: horodatage(),
        motDePasse: booleen(),
      }),
      sante: objet(
        { cpu: pourcentage(), ram: pourcentage(), latenceMs: nombre(), erreursPct: nombre() },
        ['cpu', 'ram', 'latenceMs', 'erreursPct'],
      ),
      strategie: liste(['rolling', 'canari', 'blue_green']),
      canari: objet({ pct: pourcentage(), seuil5xx: nombre(), fenetreS: entier() }, [
        'pct',
        'seuil5xx',
        'fenetreS',
      ]),
    },
    ['id', 'appId', 'nom', 'domaines', 'couleur', 'statut', 'sante'],
  ),

  EnvironnementCreation: objet(
    {
      nom: chaine(),
      couleur: chaine(),
      domaines: tableau(chaine()),
      autoDeploy: objet({ branche: chaine(), previewParPR: booleen() }),
      protection: objet({ approbationRequise: booleen(), gelJusquau: horodatage(), motDePasse: booleen() }),
      strategie: liste(['rolling', 'canari', 'blue_green']),
      canari: objet({ pct: pourcentage(), seuil5xx: nombre(), fenetreS: entier() }),
      copierDepuis: chaine('Environnement dont on reprend les variables.'),
    },
    ['nom'],
  ),

  Composant: objet(
    {
      id: chaine(),
      envId: chaine(),
      nom: chaine(),
      kind: liste(['vm', 'k8s']),
      role: liste(['web', 'api', 'db', 'cache', 'proxy', 'worker', 'cron', 'observabilite']),
      image: chaine(),
      version: chaine(),
      ressources: objet({ cpu: nombre(), ramMo: entier(), diskGo: entier() }, ['cpu', 'ramMo', 'diskGo']),
      ports: tableau(
        objet(
          { interne: entier(), expose: entier(), type: liste(['ClusterIP', 'LoadBalancer']) },
          ['interne', 'type'],
        ),
      ),
      envVars: tableau(ref('VariableEnvironnement')),
      storage: tableau(
        objet({ chemin: chaine(), tailleGo: entier(), classe: chaine() }, ['chemin', 'tailleGo', 'classe']),
      ),
      emplacement: objet({ vms: tableau(chaine()), namespace: chaine(), pods: tableau(chaine()) }),
      statut: liste(['deployed', 'degraded', 'stopped', 'failed']),
      dependances: tableau(chaine()),
    },
    ['id', 'envId', 'nom', 'kind', 'role', 'image', 'version', 'ressources', 'ports', 'envVars', 'emplacement', 'statut'],
  ),

  ComposantCreation: objet(
    {
      nom: chaine(),
      kind: liste(['vm', 'k8s']),
      role: liste(['web', 'api', 'db', 'cache', 'proxy', 'worker', 'cron', 'observabilite']),
      image: chaine(),
      version: chaine(),
      ressources: objet({ cpu: nombre(), ramMo: entier(), diskGo: entier() }),
      ports: tableau(objet({ interne: entier(), expose: entier(), type: liste(['ClusterIP', 'LoadBalancer']) })),
      envVars: tableau(ref('VariableEnvironnement')),
      storage: tableau(objet({ chemin: chaine(), tailleGo: entier(), classe: chaine() })),
      dependances: tableau(chaine()),
    },
    ['nom', 'kind', 'role', 'image'],
  ),

  VariableEnvironnement: objet(
    {
      cle: chaine(),
      valeur: chaine('Absente en lecture quand `secret` vaut vrai : un secret ne se relit pas.'),
      secret: booleen(),
      scope: liste(['build', 'runtime']),
    },
    ['cle', 'secret', 'scope'],
  ),

  Deploiement: objet(
    {
      id: chaine(),
      envId: chaine(),
      envNom: chaine(),
      appId: chaine(),
      version: chaine(),
      commit: chaine(),
      commitMessage: chaine(),
      auteur: chaine(),
      statut: liste([
        'queued',
        'building',
        'scanning',
        'provisioning',
        'deploying',
        'live',
        'failed',
        'rolled_back',
      ]),
      etapes: tableau(
        objet(
          {
            nom: liste(['build', 'scan', 'provision', 'deploy']),
            statut: liste(['pending', 'running', 'ok', 'failed']),
            dureeS: entier(),
            logRef: chaine(),
            detail: chaine(),
          },
          ['nom', 'statut', 'logRef'],
        ),
      ),
      findings: tableau(
        objet(
          {
            severite: liste(['eleve', 'moyen', 'faible']),
            titre: chaine(),
            detail: chaine(),
            correctif: objet({ libelle: chaine(), action: chaine() }, ['libelle', 'action']),
          },
          ['severite', 'titre', 'detail'],
        ),
        'Résultats du scan de vulnérabilités, avec le correctif proposé quand il existe.',
      ),
      previewUrl: chaine(),
      startedAt: horodatage(),
      dureeS: entier(),
      branche: chaine(),
      pr: entier(),
    },
    ['id', 'envId', 'appId', 'version', 'auteur', 'statut', 'etapes', 'findings', 'startedAt'],
  ),

  DeploiementDemande: objet(
    {
      envId: chaine(),
      branche: chaine(),
      commit: chaine(),
      image: chaine(),
      strategie: liste(['rolling', 'canari', 'blue_green']),
      ignorerScan: booleen('Refusé si la politique de l’organisation impose le scan.'),
      message: chaine(),
    },
    ['envId'],
  ),

  AnalyseDepot: objet(
    {
      depot: chaine(),
      branche: chaine(),
      commit: chaine(),
      constats: tableau(
        objet(
          {
            fichier: chaine(),
            constat: chaine(),
            consequence: chaine(),
            niveau: liste(['info', 'attention', 'bloquant']),
          },
          ['fichier', 'constat'],
        ),
      ),
      builderPropose: liste(['nixpacks', 'dockerfile', 'image']),
      ciblePropose: liste(['vm', 'k8s']),
      servicesDetectes: tableau(
        objet({ nom: chaine(), type: chaine(), port: entier(), image: chaine() }, ['nom', 'type']),
      ),
      variablesRequises: tableau(chaine()),
    },
    ['depot', 'branche', 'constats'],
    "Lecture d'un dépôt avant création : ce que la plateforme y a vu et ce qu'elle en déduit.",
  ),

  BriqueCanvas: objet(
    { id: chaine(), nom: chaine(), categorie: chaine(), image: chaine(), teinte: chaine() },
    ['id', 'nom', 'categorie', 'image'],
  ),

}

// ─── Projets applicatifs ──────────────────────────────────────────────

const projets = {
  Projet: objet(
    {
      id: chaine(),
      nom: chaine(),
      description: chaine(),
      espaceId: chaine(),
      cree: horodatage(),
      environnements: tableau(chaine()),
      etiquettes: tableau(chaine(), 'Ventilation de la dépense et recherche — pas de rôle fonctionnel.'),
      clusterId: chaine(
        "Le cluster Kubernetes qui héberge les services du projet — dédié ou partagé avec d'autres projets du même Espace.",
      ),
      cible: liste(
        ['vm', 'k8s'],
        'Cible de calcul du projet : `k8s` (namespace sur le cluster PaaS partagé, par défaut) ou `vm` (une VM Nova dédiée, ses services en conteneurs Docker Compose). Fixée à la création.',
        { default: 'k8s' },
      ),
      variables: tableau(
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
        'Variables partagées par tous les services du projet, par environnement.',
      ),
    },
    ['id', 'nom', 'description', 'espaceId', 'cree', 'environnements', 'etiquettes', 'clusterId', 'variables'],
  ),

  ProjetCreation: objet(
    {
      nom: chaine(),
      description: chaine(),
      espaceId: chaine(),
      environnements: tableau(chaine(), 'Par défaut `production`.'),
      // Envoyés par l'assistant de création (`/app/applications/nouveau`) : les étiquettes
      // choisies et le cluster retenu (existant, ou celui qu'elle vient de créer). Optionnels
      // ici — une création minimale sans étiquette ni cluster explicite reste valide.
      etiquettes: tableau(chaine(), 'Ventilation de la dépense et recherche.'),
      clusterId: chaine('Cluster Kubernetes à rattacher, existant ou en cours de provisioning.'),
      cible: liste(['vm', 'k8s'], 'Par défaut `k8s`. Ignoré en modification (non modifiable après création).'),
    },
    ['nom', 'espaceId'],
  ),

  ServiceProjet: objet(
    {
      id: chaine(),
      projetId: chaine(),
      nom: chaine(),
      description: chaine('Saisie à la création, à côté du nom — pas de rôle fonctionnel.'),
      type: liste(['application', 'base', 'statique', 'cron', 'worker']),
      environnement: chaine(),
      statut: liste(['running', 'building', 'stopped', 'degraded', 'failed']),
      ressources: objet({ cpu: nombre(), ramMo: entier(), diskGo: entier() }, ['cpu', 'ramMo', 'diskGo']),
      emplacement: objet(
        {
          site: liste(SITES),
          backend: chaine(),
          vms: tableau(chaine()),
          namespace: chaine(),
        },
        ['site', 'backend'],
        "Emplacement réel d'exécution, exposé volontairement : on ne demande pas au client de faire confiance à vide.",
      ),
      derniereMaj: horodatage(),
      coutMensuel: montant(),
      modeleSlug: chaine(),
      sieges: objet({ attribues: entier(), souscrits: entier() }, ['attribues', 'souscrits']),
      appId: chaine(),
      source: objet({ type: liste(['git', 'image']), ref: chaine(), branche: chaine() }, ['type', 'ref']),
      portConteneur: entier(),
      moteur: liste(MOTEURS_PROJET),
      version: chaine(),
      base: objet(
        {
          nom: chaine(),
          utilisateur: chaine(),
          motDePasse: chaine(),
          hoteInterne: chaine(),
          port: entier(),
        },
        ['nom', 'utilisateur', 'hoteInterne', 'port'],
      ),
      exposeExterne: objet({
        actif: booleen(),
        port: entier(),
        sourcesAutorisees: tableau(chaine()),
      }),
      sauvegarde: objet({
        plan: chaine(),
        cron: chaine(),
        destination: chaine(),
        dernier: horodatage(),
        retentionJours: entier(),
        taille: chaine(),
      }),
      cron: objet({
        expression: chaine(),
        lisible: chaine(),
        commande: chaine(),
        derniereExecution: horodatage(),
        dureeS: entier(),
        statut: liste(['ok', 'echec']),
        prochaine: horodatage(),
      }),
      file: objet({
        nom: chaine(),
        enAttente: entier(),
        traitesJour: entier(),
        echecsJour: entier(),
        concurrence: entier(),
      }),
    },
    ['id', 'projetId', 'nom', 'type', 'environnement', 'statut', 'ressources', 'emplacement', 'derniereMaj', 'coutMensuel'],
  ),

  ServiceProjetCreation: objet(
    {
      nom: chaine(),
      type: liste(['application', 'base', 'statique', 'cron', 'worker']),
      environnement: chaine(),
      ressources: objet({ cpu: nombre(), ramMo: entier(), diskGo: entier() }),
      modeleSlug: chaine('Déploiement depuis la bibliothèque de modèles : apporte version, configuration et plan de sauvegarde.'),
      source: objet({ type: liste(['git', 'image']), ref: chaine(), branche: chaine() }),
      portConteneur: entier(),
      moteur: liste(MOTEURS_PROJET),
      version: chaine(),
      exposeExterne: objet({ actif: booleen(), port: entier(), sourcesAutorisees: tableau(chaine()) }),
      cron: objet({ expression: chaine(), commande: chaine() }),
      file: objet({ nom: chaine(), concurrence: entier() }),
      variables: tableau(ref('VariableEnvironnement')),
      sousDomaine: chaine('Sous-domaine à ouvrir sur la zone applicative de l’organisation.'),
    },
    ['nom', 'type', 'environnement'],
  ),

  ZoneApplicative: objet(
    {
      zone: chaine(),
      wildcard: chaine(),
      ingress: tableau(
        objet({ site: liste(SITES), ip: chaine(), ipv6: chaine() }, ['site', 'ip', 'ipv6']),
        'Adresses d’entrée à viser depuis un DNS externe.',
      ),
      certificat: objet(
        { emetteur: chaine(), renouvellementAuto: booleen(), expire: horodatage() },
        ['emetteur', 'renouvellementAuto', 'expire'],
      ),
      quotaDomaines: objet({ utilises: entier(), total: entier() }, ['utilises', 'total']),
    },
    ['zone', 'wildcard', 'ingress', 'certificat', 'quotaDomaines'],
    'Zone offerte à l’organisation : la première mise en ligne ne dépend pas d’un achat de domaine.',
  ),

  DomaineApplicatif: objet(
    {
      id: chaine(),
      hote: chaine(),
      origine: liste(['genere', 'personnalise']),
      serviceId: chaine(),
      chemin: chaine(),
      portConteneur: entier(),
      https: booleen(),
      certificat: objet(
        {
          etat: liste(['actif', 'en_emission', 'echec', 'aucun']),
          emetteur: chaine(),
          expire: horodatage(),
        },
        ['etat'],
      ),
      verification: objet(
        {
          etat: liste(['ok', 'attente', 'echec']),
          enregistrement: objet(
            { type: liste(['A', 'CNAME']), nom: chaine(), valeur: chaine() },
            ['type', 'nom', 'valeur'],
          ),
          verifieLe: horodatage(),
          detail: chaine(),
          correlationId: chaine(),
        },
        ['etat', 'enregistrement'],
        'Vérification DNS guidée : l’enregistrement exact à créer, et son état.',
      ),
      redirections: tableau(
        objet({ de: chaine(), vers: chaine(), code: entier(undefined, { enum: [301, 302] }) }, [
          'de',
          'vers',
          'code',
        ]),
      ),
    },
    ['id', 'hote', 'origine', 'serviceId', 'chemin', 'portConteneur', 'https', 'certificat'],
  ),

  DomaineApplicatifCreation: objet(
    {
      hote: chaine(),
      serviceId: chaine(),
      chemin: chaine(),
      portConteneur: entier(),
      https: booleen(),
      redirections: tableau(objet({ de: chaine(), vers: chaine(), code: entier(undefined, { enum: [301, 302] }) })),
    },
    ['hote', 'serviceId'],
  ),

  ModeleApplicatif: objet(
    {
      slug: chaine(),
      nom: chaine(),
      solution: chaine('Solution libre déployée, nommée sans ambiguïté.'),
      categorie: liste([
        'collaboration',
        'communication',
        'metier',
        'donnees',
        'developpement',
        'observabilite',
        'automatisation',
        'web',
      ]),
      phrase: chaine(),
      description: chaine(),
      logoInitiales: chaine(),
      logoTeinte: chaine(),
      version: chaine('Version qualifiée par Synelia — jamais « latest ».'),
      chart: chaine(),
      ressources: objet({ cpu: nombre(), ramMo: entier(), diskGo: entier() }, ['cpu', 'ramMo', 'diskGo']),
      dependances: tableau(
        objet(
          { nom: chaine(), type: liste(['base', 'cache', 'file', 'stockage']), detail: chaine() },
          ['nom', 'type', 'detail'],
        ),
      ),
      variables: tableau(
        objet(
          { cle: chaine(), valeur: chaine(), secret: booleen(), obligatoire: booleen(), aide: chaine() },
          ['cle', 'secret', 'obligatoire'],
        ),
      ),
      volumes: tableau(objet({ chemin: chaine(), tailleGo: entier(), role: chaine() }, ['chemin', 'tailleGo', 'role'])),
      ports: tableau(
        objet({ conteneur: entier(), protocole: liste(['http', 'tcp']), role: chaine() }, [
          'conteneur',
          'protocole',
          'role',
        ]),
      ),
      sousDomaine: chaine(),
      configuration: chaine('Slug de la fiche de configuration du service, quand il en a une.'),
      sauvegardeParDefaut: objet(
        { frequence: chaine(), retentionJours: entier(), inclut: tableau(chaine()) },
        ['frequence', 'retentionJours', 'inclut'],
      ),
      prixIndicatif: montant(),
      certifie: booleen(),
      populaire: booleen(),
      horsPerimetre: chaine('Ce que le portail ne fera pas : le produit garde son interface.'),
    },
    ['slug', 'nom', 'solution', 'categorie', 'phrase', 'version', 'ressources', 'dependances', 'variables', 'ports', 'sousDomaine', 'sauvegardeParDefaut', 'prixIndicatif', 'certifie', 'horsPerimetre'],
  ),

  RegleRoutage: objet(
    {
      id: chaine(),
      hote: chaine(),
      chemin: chaine(),
      serviceId: chaine(),
      serviceNom: chaine(),
      environnement: chaine(),
      portConteneur: entier(),
      https: booleen(),
      priorite: entier(),
      actif: booleen(),
    },
    ['id', 'hote', 'chemin', 'serviceId', 'portConteneur', 'https', 'actif'],
  ),
}

// ─── Services managés (ex-marketplace) ────────────────────────────────

const services = {
  FicheCatalogue: objet(
    {
      slug: chaine(),
      nom: chaine(),
      solutionOSS: chaine(),
      categorie: liste(['collaboration', 'communication', 'metier', 'web', 'donnees', 'technique']),
      logoUrl: chaine(),
      logoTeinte: chaine(),
      logoInitiales: chaine(),
      description: chaine(),
      pitch: chaine(),
      modes: tableau(liste(['dedie', 'mutualise'])),
      paliers: tableau(
        objet(
          {
            code: chaine(),
            nom: chaine(),
            specs: chaine(),
            prixSiege: montant(),
            prixMois: montant(),
            limites: tableau(chaine()),
            recommande: booleen(),
          },
          ['code', 'nom', 'specs', 'limites'],
        ),
      ),
      sla: chaine(),
      backupPolicyDefault: chaine(),
      reversibilite: objet(
        { formats: tableau(chaine()), delaiJours: entier(), docUrl: chaine() },
        ['formats', 'delaiJours', 'docUrl'],
      ),
      migrationEntrante: tableau(chaine()),
      migrationDelais: chaine(),
      versionsSupportees: tableau(chaine()),
      certifie: booleen(),
      urlDemo: chaine(),
      captures: tableau(chaine()),
      parametresSpecifiques: tableau(objet({ titre: chaine(), description: chaine() }, ['titre', 'description'])),
      granulariteRestauration: tableau(chaine()),
    },
    ['slug', 'nom', 'solutionOSS', 'categorie', 'description', 'pitch', 'modes', 'paliers', 'sla', 'reversibilite', 'versionsSupportees', 'certifie'],
  ),

  ServiceManage: objet(
    {
      id: chaine(),
      orgId: chaine(),
      catalogSlug: chaine(),
      nom: chaine(),
      mode: liste(['dedie', 'mutualise']),
      site: liste(SITES),
      palier: chaine(),
      version: chaine(),
      versionDisponible: chaine(),
      domaine: chaine(),
      urlNative: chaine('Interface d’origine de la solution — hors du portail.'),
      statut: liste(['provisioning', 'operationnel', 'degrade', 'maintenance', 'maj_disponible', 'erreur']),
      siegesSouscrits: entier(),
      siegesUtilises: entier(),
      sso: objet(
        {
          actif: booleen(),
          clientId: chaine(),
          groupMappings: tableau(objet({ groupe: chaine(), roleApp: chaine() }, ['groupe', 'roleApp'])),
        },
        ['actif', 'clientId', 'groupMappings'],
      ),
      backupPlanId: chaine(),
      derniereSauvegarde: horodatage(),
      uptime30j: nombre(),
      parametres: dictionnaire({}, 'Valeurs courantes des paramètres spécifiques du service.'),
      coutMensuel: montant(),
      createdAt: horodatage(),
      certificat: objet({ expire: horodatage(), auto: booleen() }, ['expire', 'auto']),
    },
    ['id', 'orgId', 'catalogSlug', 'nom', 'mode', 'site', 'palier', 'version', 'domaine', 'urlNative', 'statut', 'siegesSouscrits', 'siegesUtilises', 'sso', 'uptime30j', 'parametres', 'coutMensuel', 'createdAt'],
  ),

  SouscriptionService: objet(
    {
      catalogSlug: chaine(),
      nom: chaine(),
      mode: liste(['dedie', 'mutualise']),
      site: liste(SITES),
      palier: chaine(),
      version: chaine(),
      domaine: chaine(),
      sieges: entier(),
      sso: booleen(),
      backupPlanId: chaine(),
      migrationEntrante: objet(
        { depuis: chaine(), volumeGo: nombre(), fenetre: horodatage() },
        [],
        'Reprise d’un service existant, quand le catalogue l’annonce.',
      ),
      parametres: dictionnaire(),
    },
    ['catalogSlug', 'nom', 'mode', 'site', 'palier'],
  ),

  Siege: objet(
    {
      id: chaine(),
      managedServiceId: chaine(),
      userId: chaine(),
      utilisateur: ref('Utilisateur'),
      statut: liste(['actif', 'suspendu']),
      quotaUtilise: nombre(),
      quotaTotal: nombre(),
      derniereActivite: horodatage(),
    },
    ['id', 'managedServiceId', 'userId', 'statut'],
  ),

  SiegeAttribution: objet(
    {
      userId: chaine(),
      quotaTotal: nombre('Quota individuel, pour les services qui en ont un (boîte, espace de fichiers).'),
      roleApp: chaine('Rôle applicatif dans la solution amont, si le service en distingue.'),
    },
    ['userId'],
  ),

  ChampConfiguration: objet(
    {
      cle: chaine(),
      libelle: chaine(),
      aide: chaine('Pourquoi ce réglage existe et ce qu’il change concrètement.'),
      type: liste(['bascule', 'choix', 'nombre', 'liste', 'texte', 'etat']),
      effet: liste(['immediat', 'redemarrage', 'prochaine_connexion', 'fenetre_maintenance']),
      impactFacture: chaine(),
      verrouille: chaine('Motif du verrouillage — réglage imposé par le palier ou la conformité.'),
      valeur: {
        description: 'Valeur courante — booléen, chaîne ou nombre selon `type`.',
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
      },
      valeurs: tableau(chaine(), 'Valeurs courantes quand `type` vaut `liste`.'),
      options: tableau(
        objet({ valeur: chaine(), libelle: chaine(), detail: chaine() }, ['valeur', 'libelle']),
      ),
      unite: chaine(),
      min: nombre(),
      max: nombre(),
      etat: liste(['ok', 'attention', 'echec'], 'Pour un champ de type `etat`, en lecture seule.'),
      detail: chaine(),
      action: chaine('Action de vérification proposée sur un champ d’état.'),
      placeholder: chaine(),
    },
    ['cle', 'libelle', 'aide', 'type'],
  ),

  ConfigurationService: objet(
    {
      slug: chaine(),
      solution: chaine(),
      intro: chaine('Ce que le portail gouverne pour ce service, en une phrase.'),
      horsPerimetre: tableau(
        objet({ quoi: chaine(), ou: chaine() }, ['quoi', 'ou']),
        'Ce qui ne se règle pas ici, et où cela se règle.',
      ),
      sections: tableau(
        objet(
          { titre: chaine(), phrase: chaine(), champs: tableau(ref('ChampConfiguration')) },
          ['titre', 'phrase', 'champs'],
        ),
      ),
    },
    ['slug', 'solution', 'intro', 'horsPerimetre', 'sections'],
    'Des politiques, jamais du contenu : le portail règle ce qui est autorisé, pas ce qui est écrit.',
  ),

  MiseAJourConfiguration: objet(
    { valeurs: dictionnaire({}, 'Couples clé / valeur limités aux champs non verrouillés.'), fenetre: horodatage() },
    ['valeurs'],
  ),

  OuvertureService: objet(
    {
      url: chaine('URL de rebond SSO vers l’interface d’origine de la solution.'),
      expire: horodatage(),
      methode: liste(['redirection', 'formulaire_post']),
    },
    ['url', 'expire', 'methode'],
    "Le portail ouvre la porte du produit ; il ne réimplémente pas son écran principal.",
  ),

  InstanceParc: objet(
    {
      id: chaine(),
      orgId: chaine(),
      orgNom: chaine(),
      catalogSlug: chaine(),
      serviceNom: chaine(),
      mode: liste(['dedie', 'mutualise']),
      site: liste(SITES),
      version: chaine(),
      sieges: chaine('Utilisés sur souscrits, `18/20`.'),
      sante: liste(['ok', 'degrade', 'maintenance', 'maj_disponible']),
      derniereSauvegarde: horodatage(),
      derniereMaj: jour(),
    },
    ['id', 'orgId', 'catalogSlug', 'mode', 'site', 'version', 'sieges', 'sante'],
  ),

  CampagneMaj: objet(
    {
      id: chaine(),
      nom: chaine(),
      catalogSlug: chaine(),
      versionCible: chaine(),
      fenetre: chaine(),
      instances: entier(),
      faites: entier(),
      statut: liste(['planifiee', 'en_cours', 'terminee', 'suspendue', 'echec']),
      strategie: liste(['par_vagues', 'immediate']),
      notesVersion: chaine(),
      rollbackPossible: booleen(),
    },
    ['id', 'nom', 'catalogSlug', 'versionCible', 'fenetre', 'instances', 'faites', 'statut'],
  ),
}

// ─── Web Cloud ────────────────────────────────────────────────────────

const web = {
  Domaine: objet(
    {
      id: chaine(),
      orgId: chaine(),
      nom: chaine(),
      extension: chaine(),
      expiration: jour(),
      renouvellementAuto: booleen(),
      whoisProtege: booleen(),
      verrouTransfert: booleen(),
      zoneId: chaine(),
      hebergementId: chaine('Un domaine est attaché à un serveur et à un seul.'),
    },
    ['id', 'orgId', 'nom', 'extension', 'expiration', 'renouvellementAuto', 'whoisProtege', 'verrouTransfert'],
  ),

  DisponibiliteDomaine: objet(
    {
      nom: chaine(),
      disponible: booleen(),
      prixAnnuel: montant(),
      prixRenouvellement: montant(),
      premium: booleen(),
      registre: chaine(),
      whois: chaine('Titulaire actuel, quand le nom est pris et le whois public.'),
      suggestions: tableau(objet({ nom: chaine(), prixAnnuel: montant() }, ['nom', 'prixAnnuel'])),
    },
    ['nom', 'disponible'],
  ),

  CommandeDomaine: objet(
    {
      nom: chaine(),
      dureeAnnees: entier(),
      renouvellementAuto: booleen(),
      whoisProtege: booleen(),
      titulaire: objet(
        {
          nom: chaine(),
          organisation: chaine(),
          email: chaine(),
          telephone: chaine(),
          adresse: chaine(),
          ville: chaine(),
          codePostal: chaine(),
          pays: chaine(),
        },
        ['nom', 'email', 'telephone', 'adresse', 'ville', 'pays'],
      ),
      creerZoneDns: booleen(),
      attacherHebergementId: chaine(),
    },
    ['nom', 'dureeAnnees', 'titulaire'],
  ),

  TransfertDomaine: objet(
    { nom: chaine(), codeAuth: chaine(), renouvellementAuto: booleen() },
    ['nom', 'codeAuth'],
  ),

  EnregistrementDns: objet(
    {
      id: chaine(),
      type: liste(TYPES_ENREGISTREMENT_DNS),
      nom: chaine(),
      valeur: chaine(),
      ttl: entier(),
      priorite: entier(),
    },
    ['id', 'type', 'nom', 'valeur', 'ttl'],
  ),

  ZoneDns: objet(
    {
      id: chaine(),
      orgId: chaine(),
      domaine: chaine(),
      dnssec: booleen(),
      ns: tableau(chaine()),
      enregistrements: tableau(ref('EnregistrementDns')),
    },
    ['id', 'orgId', 'domaine', 'dnssec', 'ns', 'enregistrements'],
  ),

  EnregistrementDnsCreation: objet(
    {
      type: liste(TYPES_ENREGISTREMENT_DNS),
      nom: chaine(),
      valeur: chaine(),
      ttl: entier(),
      priorite: entier(),
    },
    ['type', 'nom', 'valeur'],
  ),

  ModeleDns: objet(
    {
      id: chaine(),
      nom: chaine(),
      description: chaine(),
      enregistrements: tableau(ref('EnregistrementDnsCreation')),
      remplaceExistants: booleen(),
    },
    ['id', 'nom', 'enregistrements'],
  ),

  Hebergement: objet(
    {
      id: chaine(),
      orgId: chaine(),
      domaine: chaine('`null` tant que le client n’a pas acheté ou transféré son nom.', { nullable: true }),
      domaineProvisoire: chaine(),
      palier: chaine(),
      serveur: objet(
        {
          nom: chaine(),
          vcpu: entier(),
          ramGo: entier(),
          diskGo: entier(),
          ip: chaine(),
          ipv6: chaine(),
          site: liste(SITES),
          os: chaine(),
          serveurWeb: chaine(),
          statut: liste(['en_ligne', 'maintenance', 'redemarrage']),
          chargeCpuPct: pourcentage(),
          ramUtiliseePct: pourcentage(),
          uptimeJours: entier(),
        },
        ['nom', 'vcpu', 'ramGo', 'diskGo', 'ip', 'site', 'os', 'serveurWeb', 'statut'],
      ),
      php: objet(
        {
          versionDefaut: chaine(),
          versionsDisponibles: tableau(chaine()),
          extensions: tableau(
            objet({ nom: chaine(), active: booleen(), requisePar: chaine() }, ['nom', 'active']),
          ),
          limites: objet(
            {
              memoryLimitMo: entier(),
              uploadMaxMo: entier(),
              maxExecutionS: entier(),
              opcache: booleen(),
            },
            ['memoryLimitMo', 'uploadMaxMo', 'maxExecutionS', 'opcache'],
          ),
        },
        ['versionDefaut', 'versionsDisponibles', 'extensions', 'limites'],
      ),
      acces: objet(
        {
          ftp: booleen(),
          sftp: booleen(),
          ftps: booleen(),
          ssh: booleen(),
          portSsh: entier(),
        },
        ['ftp', 'sftp', 'ftps', 'ssh', 'portSsh'],
      ),
      espaceUtiliseGo: nombre(),
      espaceTotalGo: nombre(),
      sauvegarde: objet(
        {
          frequence: liste(['quotidienne', 'bihebdomadaire', 'hebdomadaire']),
          heure: chaine(),
          retentionJours: entier(),
          destination: chaine(),
          immuable: booleen(),
          derniere: horodatage(),
          taille: chaine(),
          statut: liste(['ok', 'echec', 'en_cours']),
        },
        ['frequence', 'heure', 'retentionJours', 'destination', 'immuable', 'statut'],
      ),
      statut: liste(['en_ligne', 'maintenance', 'suspendu']),
      cree: horodatage(),
    },
    ['id', 'orgId', 'domaineProvisoire', 'palier', 'serveur', 'php', 'acces', 'espaceUtiliseGo', 'espaceTotalGo', 'sauvegarde', 'statut', 'cree'],
  ),

  HebergementCreation: objet(
    {
      palier: chaine(),
      site: liste(SITES),
      domaine: chaine('Nom déjà détenu à attacher ; sinon l’hébergement démarre sur un nom provisoire.'),
      versionPhp: chaine(),
      installer: objet(
        { type: liste(['wordpress', 'prestashop', 'php', 'statique', 'laravel']), hote: chaine() },
        [],
        'Application installée dès la mise en service.',
      ),
    },
    ['palier', 'site'],
  ),

  ReglagesPhp: objet(
    {
      versionDefaut: chaine(),
      extensionsActivees: tableau(chaine()),
      limites: objet({
        memoryLimitMo: entier(),
        uploadMaxMo: entier(),
        maxExecutionS: entier(),
        opcache: booleen(),
      }),
    },
    [],
  ),

  ReglagesAcces: objet(
    { ftp: booleen(), sftp: booleen(), ftps: booleen(), ssh: booleen(), portSsh: entier() },
    [],
    'Protocoles de transfert ouverts sur le serveur, activables séparément.',
  ),

  SiteWeb: objet(
    {
      id: chaine(),
      hebergementId: chaine(),
      hote: chaine(),
      racine: chaine(),
      type: liste(['wordpress', 'prestashop', 'php', 'statique', 'laravel']),
      version: chaine(),
      phpVersion: chaine(),
      baseId: chaine(),
      ssl: objet(
        { etat: liste(['actif', 'en_emission', 'expire', 'aucun']), emetteur: chaine(), expire: horodatage() },
        ['etat'],
      ),
      espaceMo: nombre(),
      visitesMois: entier(),
      preproduction: objet({ actif: booleen(), hote: chaine(), derniereSync: horodatage() }, ['actif', 'hote']),
      majEnAttente: entier(),
      securite: objet({ waf: booleen(), bruteForce: booleen(), scanMalware: booleen() }, [
        'waf',
        'bruteForce',
        'scanMalware',
      ]),
      statut: liste(['en_ligne', 'maintenance', 'suspendu', 'installation']),
    },
    ['id', 'hebergementId', 'hote', 'racine', 'type', 'phpVersion', 'ssl', 'espaceMo', 'visitesMois', 'securite', 'statut'],
  ),

  SiteWebCreation: objet(
    {
      hote: chaine(),
      racine: chaine(),
      type: liste(['wordpress', 'prestashop', 'php', 'statique', 'laravel']),
      version: chaine(),
      phpVersion: chaine(),
      creerBase: booleen(),
      administrateur: objet({ email: chaine(), utilisateur: chaine(), langue: chaine() }),
      preproduction: booleen(),
      ssl: booleen(),
    },
    ['hote', 'type'],
    "Installation d'une application web sur l'hébergement : « installer WordPress » et « régler PHP » " +
      'ne sont pas la même intention, d’où deux sections distinctes.',
  ),

  BaseHebergement: objet(
    {
      id: chaine(),
      hebergementId: chaine(),
      nom: chaine(),
      moteur: liste(['mariadb', 'postgresql']),
      version: chaine(),
      tailleMo: nombre(),
      jeuCaracteres: chaine(),
      utilisateurs: tableau(
        objet(
          { nom: chaine(), droits: liste(['tous', 'lecture', 'lecture_ecriture']), hote: chaine() },
          ['nom', 'droits', 'hote'],
        ),
      ),
      siteId: chaine(),
    },
    ['id', 'hebergementId', 'nom', 'moteur', 'version', 'tailleMo', 'jeuCaracteres', 'utilisateurs'],
  ),

  ServeurBases: objet(
    {
      id: chaine(),
      hebergementId: chaine(),
      serveur: chaine(),
      moteur: liste(['mariadb', 'postgresql', 'redis']),
      version: chaine(),
      actif: booleen('Un moteur non activé est proposé, pas facturé.'),
      hoteInterne: chaine(
        'Aucun accès distant : le serveur n’écoute que sur la boucle locale de son hébergement. ' +
          'C’est une propriété de l’offre, pas un réglage.',
      ),
      port: entier(),
      bases: tableau(
        objet(
          {
            nom: chaine(),
            tailleMo: nombre(),
            tables: entier(),
            cles: entier(),
            collation: chaine(),
            utilise: chaine('Site ou application qui s’en sert.'),
          },
          ['nom', 'tailleMo', 'utilise'],
        ),
      ),
      utilisateurs: tableau(
        objet({ nom: chaine(), droits: liste(['complet', 'lecture', 'ecriture']), base: chaine() }, [
          'nom',
          'droits',
          'base',
        ]),
      ),
      quotaMo: nombre(),
      utiliseMo: nombre(),
      connexions: objet({ actives: entier(), max: entier() }),
      sauvegarde: objet(
        { frequence: chaine(), derniere: horodatage(), retentionJours: entier() },
        ['frequence', 'derniere', 'retentionJours'],
      ),
      prixMensuel: montant(),
    },
    ['id', 'hebergementId', 'serveur', 'moteur', 'version', 'actif', 'hoteInterne', 'port', 'bases', 'utilisateurs', 'quotaMo', 'utiliseMo', 'sauvegarde', 'prixMensuel'],
  ),

  BaseHebergementCreation: objet(
    {
      nom: chaine(),
      jeuCaracteres: chaine(),
      utilisateur: objet(
        { nom: chaine(), motDePasse: chaine(), droits: liste(['tous', 'lecture', 'lecture_ecriture']) },
        ['nom', 'motDePasse'],
      ),
      siteId: chaine(),
    },
    ['nom'],
  ),

  CompteFichiers: objet(
    {
      id: chaine(),
      hebergementId: chaine(),
      utilisateur: chaine(),
      protocoles: tableau(liste(['ftp', 'sftp', 'ftps'])),
      racine: chaine(),
      quotaGo: nombre(undefined, { nullable: true }),
      utiliseGo: nombre(),
      clesSsh: entier(),
      derniereConnexion: horodatage(),
      statut: liste(['actif', 'suspendu']),
    },
    ['id', 'hebergementId', 'utilisateur', 'protocoles', 'racine', 'utiliseGo', 'clesSsh', 'statut'],
  ),

  CompteFichiersCreation: objet(
    {
      utilisateur: chaine(),
      motDePasse: chaine(),
      protocoles: tableau(liste(['ftp', 'sftp', 'ftps'])),
      racine: chaine(),
      quotaGo: nombre(undefined, { nullable: true }),
      clesSshPubliques: tableau(chaine()),
    },
    ['utilisateur', 'protocoles', 'racine'],
  ),

  TachePlanifieeWeb: objet(
    {
      id: chaine(),
      hebergementId: chaine(),
      libelle: chaine(),
      expression: chaine(),
      lisible: chaine('Expression cron traduite en français.'),
      commande: chaine(),
      siteId: chaine(),
      derniereExecution: horodatage(),
      dureeS: entier(),
      statut: liste(['ok', 'echec']),
      prochaine: horodatage(),
      actif: booleen(),
    },
    ['id', 'hebergementId', 'libelle', 'expression', 'lisible', 'commande', 'statut', 'prochaine', 'actif'],
  ),

  TachePlanifieeWebCreation: objet(
    {
      libelle: chaine(),
      expression: chaine(),
      commande: chaine(),
      siteId: chaine(),
      actif: booleen(),
      notifierEchec: booleen(),
    },
    ['libelle', 'expression', 'commande'],
  ),

  ServicePartage: objet(
    {
      id: chaine(),
      hebergementId: chaine(),
      slug: chaine(),
      nom: chaine(),
      solution: chaine(),
      hote: chaine(),
      usage: objet(
        { libelle: chaine(), utilise: nombre(), total: nombre(), unite: chaine() },
        ['libelle', 'utilise', 'total', 'unite'],
      ),
      version: chaine(),
      sante: liste(['ok', 'degrade', 'maintenance', 'maj_disponible']),
      derniereSauvegarde: horodatage(),
      urlOuverture: chaine(),
      actif: booleen(),
    },
    ['id', 'hebergementId', 'slug', 'nom', 'solution', 'hote', 'usage', 'version', 'sante', 'urlOuverture', 'actif'],
    'Service mutualisé fixé au domaine de l’hébergement — messagerie, drive.',
  ),

  BoiteMail: objet(
    {
      adresse: chaine(),
      nom: chaine(),
      quotaGo: nombre(),
      utiliseGo: nombre(),
      statut: liste(['active', 'suspendue', 'archivee']),
      derniereConnexion: horodatage(),
      mfa: booleen(),
    },
    ['adresse', 'nom', 'quotaGo', 'utiliseGo', 'statut', 'mfa'],
  ),

  Messagerie: objet(
    {
      id: chaine(),
      domaine: chaine(),
      actif: booleen(),
      palier: chaine(),
      solutionOSS: chaine(),
      hoteWebmail: chaine(),
      boites: tableau(ref('BoiteMail')),
      boitesIncluses: entier(),
      alias: tableau(objet({ de: chaine(), vers: tableau(chaine()) }, ['de', 'vers'])),
      redirections: tableau(objet({ de: chaine(), vers: chaine(), copie: booleen() }, ['de', 'vers', 'copie'])),
      attrapeTout: chaine(),
      authentification: objet(
        {
          spf: liste(['valide', 'absent', 'invalide']),
          dkim: liste(['valide', 'absent']),
          dmarc: chaine(),
        },
        ['spf', 'dkim', 'dmarc'],
      ),
      antispam: objet(
        {
          actif: booleen(),
          niveau: liste(['permissif', 'standard', 'strict']),
          quarantaine: entier(),
        },
        ['actif', 'niveau', 'quarantaine'],
      ),
      prixSiege: montant(),
    },
    ['id', 'domaine', 'actif', 'palier', 'solutionOSS', 'hoteWebmail', 'boites', 'boitesIncluses', 'alias', 'redirections', 'authentification', 'antispam', 'prixSiege'],
  ),

  BoiteMailCreation: objet(
    {
      adresse: chaine(),
      nom: chaine(),
      motDePasse: chaine(),
      quotaGo: nombre(),
      mfaObligatoire: booleen(),
      utilisateurId: chaine('Membre de l’organisation à qui attribuer la boîte.'),
    },
    ['adresse', 'nom'],
  ),

  Drive: objet(
    {
      id: chaine(),
      domaine: chaine(),
      actif: booleen(),
      palier: chaine(),
      solutionOSS: chaine(),
      hote: chaine(),
      version: chaine(),
      sieges: objet({ attribues: entier(), souscrits: entier() }, ['attribues', 'souscrits']),
      quota: objet({ utiliseGo: nombre(), totalGo: nombre() }, ['utiliseGo', 'totalGo']),
      partage: objet(
        {
          externeAutorise: booleen(),
          motDePasseObligatoire: booleen(),
          expirationJours: entier(),
          liensActifs: entier(),
        },
        ['externeAutorise', 'motDePasseObligatoire', 'expirationJours', 'liensActifs'],
      ),
      versionsFichiers: objet({ actif: booleen(), retentionJours: entier() }, ['actif', 'retentionJours']),
      corbeille: objet({ retentionJours: entier(), tailleGo: nombre() }, ['retentionJours', 'tailleGo']),
      suiteBureautique: chaine(),
      derniereSauvegarde: horodatage(),
      prixSiege: montant(),
    },
    ['id', 'domaine', 'actif', 'palier', 'solutionOSS', 'hote', 'sieges', 'quota', 'partage', 'versionsFichiers', 'corbeille', 'prixSiege'],
  ),

  Certificat: objet(
    {
      id: chaine(),
      hote: chaine(),
      hotesSupplementaires: tableau(chaine()),
      type: liste(['letsencrypt', 'dv', 'ov', 'ev', 'wildcard']),
      emetteur: chaine(),
      emisLe: jour(),
      expire: jour(),
      renouvellementAuto: booleen(),
      prixAnnuel: montant(),
      etat: liste(['actif', 'en_emission', 'expire', 'revoque']),
      hebergementId: chaine(),
      algorithme: chaine(),
      validationDomaine: liste(['dns', 'http', 'email']),
    },
    ['id', 'hote', 'type', 'emetteur', 'emisLe', 'expire', 'renouvellementAuto', 'prixAnnuel', 'etat', 'algorithme', 'validationDomaine'],
  ),

  CertificatCommande: objet(
    {
      hote: chaine(),
      hotesSupplementaires: tableau(chaine()),
      type: liste(['letsencrypt', 'dv', 'ov', 'ev', 'wildcard']),
      validationDomaine: liste(['dns', 'http', 'email']),
      dureeAnnees: entier(),
      renouvellementAuto: booleen(),
      hebergementId: chaine(),
      csr: chaine('Requête de signature fournie par le client, facultative.'),
      organisation: objet(
        { nom: chaine(), pays: chaine(), ville: chaine(), registre: chaine() },
        [],
        'Exigée pour un certificat OV ou EV.',
      ),
    },
    ['hote', 'type', 'validationDomaine'],
  ),

  ExecutionSauvegarde: objet(
    {
      id: chaine(),
      ts: horodatage(),
      statut: liste(['ok', 'echec', 'partielle']),
      taille: chaine(),
      dureeMin: entier(),
      contenu: tableau(chaine()),
      immuableJusqua: horodatage(),
      message: chaine(),
    },
    ['id', 'ts', 'statut', 'taille', 'dureeMin', 'contenu'],
  ),

  SauvegardeWeb: objet(
    {
      id: chaine(),
      hebergementId: chaine(),
      serveur: chaine(),
      nomServi: chaine(),
      actif: booleen(),
      frequence: liste(['quotidienne', 'bihebdomadaire', 'hebdomadaire']),
      heure: chaine(),
      retentionJours: entier(),
      destination: chaine(),
      site: liste(SITES),
      immuable: booleen(),
      perimetre: objet(
        { fichiers: booleen(), bases: booleen(), configuration: booleen(), messagerie: booleen() },
        ['fichiers', 'bases', 'configuration', 'messagerie'],
      ),
      executions: tableau(ref('ExecutionSauvegarde')),
      espaceOccupeGo: nombre(),
      dernierTestRestauration: objet(
        { date: jour(), resultat: liste(['ok', 'echec']), dureeMin: entier() },
        ['date', 'resultat', 'dureeMin'],
      ),
    },
    ['id', 'hebergementId', 'serveur', 'nomServi', 'actif', 'frequence', 'heure', 'retentionJours', 'destination', 'site', 'immuable', 'perimetre', 'executions', 'espaceOccupeGo'],
  ),

  RelaisSmtp: objet(
    {
      id: chaine(),
      orgId: chaine(),
      hote: chaine(),
      ports: tableau(entier()),
      identifiant: chaine(),
      domainesAutorises: tableau(chaine()),
      authentification: objet(
        {
          spf: liste(['valide', 'absent', 'invalide']),
          dkim: liste(['valide', 'absent']),
          dmarc: chaine(),
          selecteurDkim: chaine(),
        },
        ['spf', 'dkim', 'dmarc'],
      ),
      quota: objet(
        { parJour: entier(), parHeure: entier(), utiliseJour: entier() },
        ['parJour', 'parHeure', 'utiliseJour'],
      ),
      reputation: objet(
        { tauxRemise: nombre(), tauxRebond: nombre(), plaintes: nombre(), listeNoire: booleen() },
        ['tauxRemise', 'tauxRebond', 'plaintes', 'listeNoire'],
      ),
      ipDediee: chaine(),
      actif: booleen(),
    },
    ['id', 'orgId', 'hote', 'ports', 'identifiant', 'domainesAutorises', 'authentification', 'quota', 'reputation', 'actif'],
  ),

  MessageSmtp: objet(
    {
      id: chaine(),
      ts: horodatage(),
      de: chaine(),
      vers: chaine(),
      sujet: chaine(),
      statut: liste(['remis', 'differe', 'rebond', 'rejete', 'plainte']),
      code: chaine('Code SMTP renvoyé par le destinataire.'),
      detail: chaine(),
    },
    ['id', 'ts', 'de', 'vers', 'statut'],
  ),
}

// ─── Commerce ─────────────────────────────────────────────────────────

const commerce = {
  Offre: objet(
    {
      id: chaine(),
      code: chaine(),
      nom: chaine(),
      categorie: liste(['espace_cloud', 'image_vm', 'k8s', 'stack', 'web']),
      specs: chaine(),
      caracteristiques: tableau(chaine()),
      prix: montant('Prix public mensuel — le seul prix de l’offre, celui de la vitrine.'),
      populaire: booleen(),
      statut: liste(['brouillon', 'publiee', 'depreciee']),
      souscriptionsActives: entier(),
      sla: chaine(),
      surDevis: booleen(),
    },
    ['id', 'code', 'nom', 'categorie', 'specs', 'caracteristiques', 'prix', 'statut', 'souscriptionsActives'],
  ),

  OffreCreation: objet(
    {
      code: chaine(),
      nom: chaine(),
      categorie: liste(['espace_cloud', 'image_vm', 'k8s', 'stack', 'web']),
      specs: chaine(),
      caracteristiques: tableau(chaine()),
      prix: montant('Prix public mensuel.'),
      statut: liste(['brouillon', 'publiee', 'depreciee']),
      sla: chaine(),
      surDevis: booleen(),
      populaire: booleen(),
    },
    ['code', 'nom', 'categorie', 'specs', 'prix'],
  ),

  Souscription: objet(
    {
      id: chaine(),
      orgId: chaine(),
      cible: objet({ type: liste(['offer', 'service']), ref: chaine(), label: chaine() }, [
        'type',
        'ref',
        'label',
      ]),
      quantite: entier(),
      prixApplique: montant(),
      debut: jour(),
      fin: jour(),
      periodicite: liste(['mensuelle', 'annuelle']),
    },
    ['id', 'orgId', 'cible', 'quantite', 'prixApplique', 'debut', 'periodicite'],
  ),

  Facture: objet(
    {
      id: chaine(),
      orgId: chaine(),
      numero: chaine(),
      periode: chaine(),
      lignes: tableau(
        objet(
          { libelle: chaine(), ref: chaine(), quantite: nombre(), pu: montant(), total: montant() },
          ['libelle', 'ref', 'quantite', 'pu', 'total'],
        ),
      ),
      sousTotal: montant(),
      tvaPct: nombre(),
      total: montant(),
      devise: liste(DEVISES),
      statut: liste(['brouillon', 'emise', 'payee', 'impayee', 'annulee']),
      moyen: liste(MOYENS_PAIEMENT),
      pdfUrl: chaine(),
      echeance: jour(),
    },
    ['id', 'orgId', 'numero', 'periode', 'lignes', 'sousTotal', 'tvaPct', 'total', 'devise', 'statut', 'pdfUrl'],
  ),

  Devis: objet(
    {
      id: chaine(),
      orgId: chaine(),
      numero: chaine(),
      objet: chaine(),
      montant: montant(),
      validite: jour(),
      statut: liste(['envoye', 'accepte', 'refuse', 'expire']),
      createdAt: horodatage(),
      pdfUrl: chaine(),
    },
    ['id', 'orgId', 'numero', 'objet', 'montant', 'validite', 'statut', 'createdAt'],
  ),

  MoyenPaiement: objet(
    {
      id: chaine(),
      type: liste(MOYENS_PAIEMENT),
      libelle: chaine(),
      detail: chaine('Quatre derniers chiffres, numéro masqué, IBAN partiel.'),
      defaut: booleen(),
      expire: chaine(),
      statut: liste(['actif', 'expire', 'a_verifier']),
      soldePrepaye: montant('Solde du porte-monnaie, pour le moyen `prepaye`.'),
    },
    ['id', 'type', 'libelle', 'defaut', 'statut'],
  ),

  MoyenPaiementCreation: objet(
    {
      type: liste(MOYENS_PAIEMENT),
      libelle: chaine(),
      numero: chaine('Numéro de carte ou de téléphone mobile money, selon le type.'),
      titulaire: chaine(),
      expiration: chaine(),
      iban: chaine(),
      defaut: booleen(),
    },
    ['type'],
  ),

  Rechargement: objet(
    { montant: montant(), moyenId: chaine() },
    ['montant', 'moyenId'],
    'Recharge du porte-monnaie prépayé.',
  ),

  Consommation: objet(
    {
      periode: chaine(),
      jours: tableau(
        objet(
          {
            date: jour(),
            vcpuHeures: nombre(),
            ramGoHeures: nombre(),
            stockageToJour: nombre(),
            egressGo: nombre(),
            montant: montant(),
          },
          ['date', 'montant'],
        ),
      ),
      total: montant(),
      prevision: montant(),
      totalMoisPrecedent: montant(),
    },
    ['periode', 'jours', 'total'],
  ),

  Ventilation: objet(
    {
      axe: liste(['famille', 'espace', 'application', 'projet', 'site'], 'Axe d’imputation demandé.'),
      lignes: tableau(
        objet({ label: chaine(), montant: montant(), pct: nombre() }, ['label', 'montant', 'pct']),
      ),
      total: montant(),
    },
    ['axe', 'lignes', 'total'],
  ),

  EngagementSla: objet(
    {
      composant: chaine(),
      dispo: nombre(),
      constate: nombre(),
      reponseCritique: entier(),
      resolutionCritique: entier(),
    },
    ['composant', 'dispo', 'constate', 'reponseCritique', 'resolutionCritique'],
  ),

  CreditSla: objet(
    {
      periode: chaine(),
      composant: chaine(),
      dispoConstatee: nombre(),
      engagement: nombre(),
      credit: montant(),
      statut: chaine(),
    },
    ['periode', 'composant', 'dispoConstatee', 'engagement', 'credit', 'statut'],
  ),

  TarifsUnitaires: dictionnaire(
    nombre(),
    'Prix unitaires servant le simulateur : `vcpu`, `ramGo`, `stockageGoSsd`, `ipPublique`…',
  ),
}

// ─── Exploitation, support, contenus ──────────────────────────────────

const ops = {
  Ticket: objet(
    {
      id: chaine(),
      orgId: chaine(),
      numero: chaine(),
      sujet: chaine(),
      gravite: liste(['critique', 'majeure', 'mineure', 'question']),
      statut: liste(['ouvert', 'en_cours', 'attente_client', 'resolu', 'ferme']),
      slaCible: objet({ premiereReponseMin: entier(), resolutionMin: entier() }, [
        'premiereReponseMin',
        'resolutionMin',
      ]),
      slaRestantMin: entier(),
      ressourcesLiees: tableau(chaine()),
      service: chaine(),
      assigneA: chaine(),
      createdAt: horodatage(),
      messages: tableau(
        objet(
          {
            auteur: chaine(),
            role: liste(['client', 'synelia']),
            date: horodatage(),
            contenu: chaine(),
            pieces: tableau(chaine()),
          },
          ['auteur', 'role', 'date', 'contenu'],
        ),
      ),
    },
    ['id', 'orgId', 'numero', 'sujet', 'gravite', 'statut', 'slaCible', 'ressourcesLiees', 'createdAt', 'messages'],
  ),

  TicketCreation: objet(
    {
      sujet: chaine(),
      gravite: liste(['critique', 'majeure', 'mineure', 'question']),
      contenu: chaine(),
      ressourcesLiees: tableau(chaine()),
      service: chaine(),
      pieces: tableau(chaine(), 'Identifiants de pièces déjà téléversées.'),
    },
    ['sujet', 'gravite', 'contenu'],
  ),

  MessageTicket: objet(
    { contenu: chaine(), pieces: tableau(chaine()), cloture: booleen('Le client déclare le problème résolu.') },
    ['contenu'],
  ),

  ArticleKb: objet(
    {
      id: chaine(),
      titre: chaine(),
      categorie: chaine(),
      resume: chaine(),
      contenuMarkdown: chaine(),
      minutes: entier(),
      maj: jour(),
      motsCles: tableau(chaine()),
    },
    ['id', 'titre', 'categorie', 'resume', 'maj'],
  ),

  EvenementSupervision: objet(
    {
      id: chaine(),
      ts: horodatage(),
      gravite: liste(['critique', 'majeure', 'mineure', 'info']),
      ressource: chaine(),
      message: chaine(),
      site: liste(SITES),
    },
    ['id', 'ts', 'gravite', 'ressource', 'message'],
  ),

  RegleAlerte: objet(
    {
      id: chaine(),
      cible: chaine(),
      metrique: chaine(),
      seuil: chaine(),
      canaux: tableau(liste(['email', 'sms', 'whatsapp', 'webhook'])),
      plage: chaine('Plage horaire d’application, `24/7` ou `08:00-20:00`.'),
      escalade: chaine(),
      actif: booleen(),
    },
    ['id', 'cible', 'metrique', 'seuil', 'canaux', 'plage', 'actif'],
  ),

  RegleAlerteCreation: objet(
    {
      cible: chaine(),
      metrique: chaine(),
      seuil: chaine(),
      canaux: tableau(liste(['email', 'sms', 'whatsapp', 'webhook'])),
      plage: chaine(),
      escalade: chaine(),
      actif: booleen(),
      destinataires: tableau(chaine()),
      urlWebhook: chaine(),
    },
    ['cible', 'metrique', 'seuil', 'canaux'],
  ),

  StatutService: objet(
    {
      nom: chaine(),
      categorie: chaine(),
      etats: dictionnaire(
        liste(['operationnel', 'degrade', 'panne', 'maintenance']),
        'État par site : clés `ABJ` et `GBM`.',
      ),
      uptime90j: nombre(),
    },
    ['nom', 'categorie', 'etats', 'uptime90j'],
  ),

  Incident: objet(
    {
      id: chaine(),
      titre: chaine(),
      gravite: liste(['majeur', 'mineur', 'maintenance']),
      statut: liste(['en_cours', 'surveille', 'resolu']),
      debut: horodatage(),
      fin: horodatage(),
      services: tableau(chaine()),
      sites: tableau(liste(SITES)),
      mises_a_jour: tableau(objet({ ts: horodatage(), texte: chaine() }, ['ts', 'texte'])),
    },
    ['id', 'titre', 'gravite', 'statut', 'debut', 'services', 'sites', 'mises_a_jour'],
  ),

  SanteePlateforme: objet(
    {
      backends: tableau(ref('Backend')),
      filesProvisioning: objet(
        { enAttente: entier(), enCours: entier(), enEchec24h: entier() },
        ['enAttente', 'enCours', 'enEchec24h'],
      ),
      integrations: tableau(
        objet(
          {
            nom: chaine(),
            statut: liste(['ok', 'degrade', 'panne']),
            latenceMs: nombre(),
            dernierControle: horodatage(),
          },
          ['nom', 'statut', 'dernierControle'],
        ),
        'Centreon, Grafana, VictoriaLogs, passerelles de paiement, registre.',
      ),
      alertes: tableau(ref('EvenementSupervision')),
      accesRefuses24h: entier(),
      ticketsSlaRisque: entier(),
    },
    ['backends', 'filesProvisioning', 'integrations', 'alertes'],
  ),

  CampagneMigration: objet(
    {
      id: chaine(),
      nom: chaine(),
      backendSource: chaine(),
      backendCible: chaine(),
      ressources: entier(),
      migrees: entier(),
      fenetre: chaine(),
      statut: liste(['planifiee', 'en_cours', 'terminee', 'suspendue', 'echec']),
      rollbackPossible: booleen(),
      impactClient: chaine('Coupure attendue, annoncée telle quelle.'),
    },
    ['id', 'nom', 'backendSource', 'backendCible', 'ressources', 'migrees', 'fenetre', 'statut'],
  ),

  Datacenter: objet(
    {
      code: chaine(),
      nom: chaine(),
      ville: chaine(),
      site: liste(SITES),
      operateur: chaine(),
      certifications: tableau(chaine()),
      energie: chaine(),
      redondance: chaine(),
      capacite: chaine(),
      latencesMs: tableau(objet({ vers: chaine(), ms: nombre() }, ['vers', 'ms'])),
      photoUrl: chaine(),
    },
    ['code', 'nom', 'ville', 'site', 'operateur'],
  ),

  FicheProduit: objet(
    {
      slug: chaine(),
      nom: chaine(),
      accroche: chaine(),
      description: chaine(),
      categorie: chaine(),
      aPartirDe: montant(),
      caracteristiques: tableau(chaine()),
      cequeCeNestPas: tableau(chaine(), 'Ce que l’offre ne fait pas — souvent l’information la plus utile.'),
      paliers: tableau(objet({ nom: chaine(), specs: chaine(), prix: montant() }, ['nom', 'specs', 'prix'])),
      sla: chaine(),
      faq: tableau(objet({ question: chaine(), reponse: chaine() }, ['question', 'reponse'])),
    },
    ['slug', 'nom', 'accroche', 'description', 'categorie'],
  ),

  EtudeCas: objet(
    {
      id: chaine(),
      client: chaine(),
      secteur: chaine(),
      resume: chaine(),
      contexte: chaine(),
      solution: tableau(chaine()),
      resultats: tableau(objet({ indicateur: chaine(), valeur: chaine() }, ['indicateur', 'valeur'])),
      citation: objet({ texte: chaine(), auteur: chaine(), fonction: chaine() }),
      logoUrl: chaine(),
    },
    ['id', 'client', 'secteur', 'resume'],
  ),

  Souverainete: objet(
    {
      niveaux: tableau(
        objet(
          { niveau: chaine(), titre: chaine(), description: chaine(), atteint: booleen() },
          ['niveau', 'titre', 'description'],
        ),
      ),
      trajectoireSortie: tableau(
        objet(
          { backend: chaine(), part: chaine(), cible: chaine(), avancement: pourcentage() },
          ['backend', 'part', 'cible', 'avancement'],
        ),
        'Sortie datée des socles propriétaires : la transition est assumée, pas cachée.',
      ),
      hebergementDonnees: chaine(),
      juridiction: chaine(),
      sousTraitants: tableau(
        objet({ nom: chaine(), role: chaine(), pays: chaine() }, ['nom', 'role', 'pays']),
      ),
    },
    ['niveaux', 'trajectoireSortie'],
  ),

  DemandeContact: objet(
    {
      nom: chaine(),
      email: chaine(undefined, { format: 'email' }),
      telephone: chaine(),
      organisation: chaine(),
      taille: chaine(),
      secteur: chaine(),
      sujet: liste(['commercial', 'technique', 'partenariat', 'presse', 'autre']),
      message: chaine(),
      offresInteressees: tableau(chaine()),
      rappelSouhaite: booleen(),
    },
    ['nom', 'email', 'message', 'sujet'],
  ),

  DemandeDevis: objet(
    {
      contact: ref('DemandeContact'),
      besoin: chaine(),
      estimation: ref('DemandeEstimation'),
      echeance: chaine(),
      budgetIndicatif: montant(),
    },
    ['contact', 'besoin'],
  ),

  AccuseReception: objet(
    {
      reference: chaine('Référence à citer en cas de relance.'),
      message: chaine(),
      delaiReponseHeures: entier(),
    },
    ['reference', 'message'],
  ),

  ParcoursFormation: objet(
    {
      slug: chaine(),
      titre: chaine(),
      description: chaine(),
      niveau: liste(['debutant', 'intermediaire', 'avance']),
      publicVise: tableau(liste(ROLES)),
      dureeMinutes: entier(),
      modules: tableau(
        objet(
          {
            slug: chaine(),
            titre: chaine(),
            format: liste(['article', 'video', 'atelier', 'quiz']),
            dureeMinutes: entier(),
            articleId: chaine(),
            bacASableRequis: booleen(),
          },
          ['slug', 'titre', 'format', 'dureeMinutes'],
        ),
      ),
      certifiant: booleen(),
    },
    ['slug', 'titre', 'description', 'niveau', 'dureeMinutes', 'modules'],
  ),

  ProgressionFormation: objet(
    {
      parcoursSlug: chaine(),
      modulesTermines: tableau(chaine()),
      pctComplete: pourcentage(),
      commence: horodatage(),
      termine: horodatage(),
      attestationUrl: chaine(),
    },
    ['parcoursSlug', 'modulesTermines', 'pctComplete'],
  ),

  BacASable: objet(
    {
      id: chaine(),
      statut: liste(['disponible', 'en_preparation', 'actif', 'expire']),
      espaceId: chaine(),
      expire: horodatage(),
      quota: ref('Quota'),
      urlPortail: chaine(),
      reinitialisationsRestantes: entier(),
    },
    ['id', 'statut'],
    'Environnement d’entraînement jetable, sans facturation, pour suivre un parcours sans risque.',
  ),

  MembreEquipe: objet(
    {
      id: chaine(),
      nom: chaine(),
      email: chaine(),
      role: liste(ROLES),
      equipe: chaine(),
      dernierAcces: horodatage(),
      privilegie: booleen('Compte à privilèges : soumis à revue trimestrielle.'),
      elevation: objet({ active: booleen(), jusqua: horodatage(), justification: chaine() }, ['active']),
      revuLe: horodatage('Dernière revue du privilège — vide tant qu’elle n’a pas eu lieu.'),
    },
    ['id', 'nom', 'email', 'role', 'equipe', 'dernierAcces', 'privilegie'],
  ),

  Impaye: objet(
    {
      org: chaine(),
      orgId: chaine(),
      facture: chaine(),
      montant: montant(),
      echeance: jour(),
      retardJours: entier(),
      relances: entier(),
      prochaineAction: chaine(),
    },
    ['org', 'facture', 'montant', 'echeance', 'retardJours', 'relances'],
  ),

  MargeBackend: objet(
    {
      backend: chaine(),
      type: chaine(),
      coutInfra: montant(),
      revenu: montant(),
      marge: nombre(),
    },
    ['backend', 'type', 'coutInfra', 'revenu', 'marge'],
  ),

  SyntheseClient: objet(
    {
      espaces: entier(),
      vms: entier(),
      clusters: entier(),
      servicesManages: entier(),
      applications: entier(),
      environnements: entier(),
      siegesUtilises: entier(),
      siegesSouscrits: entier(),
      quota: ref('Quota'),
      usage: ref('Quota'),
      uptime30j: nombre(),
      slaContractuel: nombre(),
      depenseMois: montant(),
      previsionMois: montant(),
      depenseMoisPrecedent: montant(),
      facturesEnAttente: entier(),
      ticketsOuverts: entier(),
      prochainRdv: horodatage(),
      evenements: tableau(ref('EvenementSupervision'), 'Huit lignes au plus.'),
      travauxEnCours: tableau(ref('TravailProvisioning')),
    },
    ['espaces', 'vms', 'clusters', 'servicesManages', 'quota', 'usage', 'depenseMois'],
  ),

  SynthesePlateforme: objet(
    {
      vcpuTotal: entier(),
      vcpuUtilise: entier(),
      ramTotalGo: entier(),
      stockageTotalTo: nombre(),
      tenantsActifs: entier(),
      espacesTotal: entier(),
      projetsTotal: entier(),
      backendsEnLigne: entier(),
      backendsTotal: entier(),
      accesRefuses24h: entier(),
      jobsEnEchec: entier(),
      ticketsSlaRisque: entier(),
      caMensuel: montant(),
      topOrganisations: tableau(ref('Organisation')),
    },
    ['vcpuTotal', 'vcpuUtilise', 'tenantsActifs', 'backendsEnLigne', 'backendsTotal', 'caMensuel'],
  ),

  SyntheseProjets: objet(
    {
      projets: entier(),
      services: entier(),
      enEchec: entier(),
      domaines: entier(),
      domainesAVerifier: entier(),
      coutMensuel: montant(),
    },
    ['projets', 'services', 'enEchec', 'domaines'],
  ),

  Capacite: objet(
    {
      backends: tableau(ref('Backend')),
      placements: tableau(ref('Placement')),
      projection: tableau(
        objet(
          { backendId: chaine(), j30: pourcentage(), j60: pourcentage(), j90: pourcentage(), alerte: chaine() },
          ['backendId', 'j30', 'j60', 'j90'],
        ),
      ),
      capaciteParSite: tableau(
        objet(
          { site: liste(SITES), capacite: ref('Quota'), utilise: ref('Quota'), reserve: ref('Quota') },
          ['site', 'capacite', 'utilise'],
        ),
      ),
    },
    ['backends', 'placements', 'projection'],
  ),
}

export const schemasProduits = { ...paas, ...projets, ...services, ...web, ...commerce, ...ops }
