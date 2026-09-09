/**
 * Chemins — tableau de bord, travaux, IaaS, stockage, bases managées,
 * sauvegarde et PRA.
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

const T_BORD = 'Tableau de bord'
const T_TRAVAUX = 'Travaux de provisioning'
const T_ESPACES = 'Espaces Cloud'
const T_VMS = 'Machines virtuelles'
const T_K8S = 'Kubernetes'
const T_RESEAU = 'Réseau'
const T_STOCKAGE = 'Stockage'
const T_BASES = 'Bases managées'
const T_PROTECTION = 'Sauvegarde & PRA'
const T_OBS = 'Observabilité'

const idEspace = chemin('espaceId', 'Identifiant de l’Espace Cloud.', 'ec-dba-01')
const idVm = chemin('vmId', 'Identifiant de la machine virtuelle.', 'vm-web-01')
const idCluster = chemin('clusterId', 'Identifiant du cluster.', 'k8s-prod')
const filtreEspace = filtre('espaceId', chaine(), 'Restreint à un Espace Cloud.')
const filtreSite = filtre('site', liste(SITES))

// ─── Tableau de bord et travaux ───────────────────────────────────────

const bord = fusion(
  {
    '/tableau-de-bord': {
      get: op({
        tag: T_BORD,
        id: 'obtenirTableauDeBord',
        resume: 'Obtenir la synthèse de l’organisation',
        detail:
          'Agrégats, quotas, dépense du mois, huit derniers événements et travaux en cours. ' +
          'Un seul appel : le tableau de bord ne doit pas déclencher vingt requêtes.',
        ok: ref('SyntheseClient'),
        rbac: 'org.dashboard.view',
        erreurs: [424],
      }),
    },
    '/travaux': {
      get: op({
        tag: T_TRAVAUX,
        id: 'listerTravaux',
        resume: 'Lister les travaux de provisioning',
        paginee: true,
        params: [
          filtre('statut', liste(['queued', 'running', 'done', 'failed', 'rolled_back'])),
          filtre('type', chaine()),
          filtre('depuis', horodatage()),
        ],
        ok: page(ref('TravailProvisioning')),
      }),
    },
    '/travaux/{travailId}': {
      get: op({
        tag: T_TRAVAUX,
        id: 'obtenirTravail',
        resume: 'Suivre un travail de provisioning',
        detail: 'Les étapes sont renvoyées dans l’ordre ; un échec nomme la tâche fautive.',
        params: [chemin('travailId', 'Identifiant du travail.', 'job-1')],
        ok: ref('TravailProvisioning'),
      }),
    },
  },
  action({
    tag: T_TRAVAUX,
    chemin: '/travaux/{travailId}/relance',
    id: 'relancerTravail',
    resume: 'Relancer un travail en échec',
    detail: 'Reprend à la première tâche non aboutie plutôt que de tout rejouer.',
    params: [chemin('travailId', 'Identifiant du travail.', 'job-1')],
    erreurs: [409],
  }),
  action({
    tag: T_TRAVAUX,
    chemin: '/travaux/{travailId}/annulation',
    id: 'annulerTravail',
    resume: 'Annuler un travail en attente ou en cours',
    detail: 'Les tâches déjà appliquées sont défaites quand elles sont réversibles.',
    params: [chemin('travailId', 'Identifiant du travail.', 'job-1')],
    erreurs: [409],
  }),
)

// ─── Espaces Cloud ────────────────────────────────────────────────────

const espaces = fusion(
  crud({
    tag: T_ESPACES,
    base: '/espaces',
    idParam: idEspace,
    nomSingulier: 'Espace',
    nomPluriel: 'Espaces',
    libelle: 'un Espace Cloud',
    libellePluriel: 'les Espaces Cloud',
    schema: 'EspaceCloud',
    creation: 'EspaceCloudCreation',
    modification: 'EspaceCloudModification',
    creationAsync: true,
    suppressionAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'espace.create',
    filtres: [filtreSite, filtre('statut', liste(['active', 'suspendue', 'provisioning']))],
  }),
  {
    '/espaces/{espaceId}/quota': {
      put: op({
        tag: T_ESPACES,
        id: 'modifierQuotaEspace',
        resume: 'Modifier le quota d’un Espace Cloud',
        detail: 'Une réduction en dessous de la consommation courante est refusée avec le détail par ressource.',
        params: [idEspace],
        corps: ref('Quota'),
        ok: ref('EspaceCloud'),
        rbac: 'espace.quota.update',
        erreurs: [409, 402],
      }),
    },
    '/espaces/{espaceId}/placements': {
      get: op({
        tag: T_ESPACES,
        id: 'listerPlacementsEspace',
        resume: 'Voir la répartition d’un espace sur les socles',
        detail:
          'Le client voit sur quels socles ses ressources tournent, y compris ceux en sortie : ' +
          'la transition est affichée, pas cachée.',
        params: [idEspace],
        ok: tableau(ref('Placement')),
      }),
    },
    '/espaces/{espaceId}/consommation': {
      get: op({
        tag: T_ESPACES,
        id: 'obtenirConsommationEspace',
        resume: 'Obtenir la consommation d’un espace',
        params: [idEspace, filtre('periode', chaine(), 'Mois au format `2026-08`.')],
        ok: ref('Consommation'),
      }),
    },
  },
)

// ─── Machines virtuelles ──────────────────────────────────────────────

const vms = fusion(
  crud({
    tag: T_VMS,
    base: '/vms',
    idParam: idVm,
    nomSingulier: 'Vm',
    nomPluriel: 'Vms',
    libelle: 'une machine virtuelle',
    libellePluriel: 'les machines virtuelles',
    schema: 'Vm',
    creation: 'VmCreation',
    modification: 'VmModification',
    creationAsync: true,
    suppressionAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'vm.create_delete',
    filtres: [
      filtreEspace,
      filtreSite,
      filtre('statut', liste(['running', 'stopped', 'creating', 'error', 'migrating'])),
      filtre('tag', chaine()),
      filtre('applicationId', chaine()),
    ],
    erreursCreation: [404],
  }),
  {
    '/vms/lot': {
      post: op({
        tag: T_VMS,
        id: 'creerVmsEnLot',
        resume: 'Déployer plusieurs serveurs en une passe',
        detail:
          'Un seul travail porte tout le lot : il échoue ou aboutit ensemble, et son détail dit ' +
          'quelle machine a bloqué.',
        corps: ref('VmLotCreation'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.create_delete',
        erreurs: [409, 402, 404],
      }),
    },
    '/vms/{vmId}/materiel': {
      put: op({
        tag: T_VMS,
        id: 'modifierMaterielVm',
        resume: 'Modifier le matériel virtuel',
        detail: 'Contrôleurs SCSI, cartes réseau, USB, démarrage sécurisé, vTPM, mémoire vidéo.',
        params: [idVm],
        corps: ref('MateielVirtuel'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.hardware.update',
        erreurs: [409],
      }),
    },
    '/vms/{vmId}/metriques': {
      get: op({
        tag: T_VMS,
        id: 'obtenirMetriquesVm',
        resume: 'Obtenir les séries d’une machine',
        params: [idVm, { $ref: '#/components/parameters/Fenetre' }],
        ok: objet({ series: tableau(ref('Serie')), liens: ref('LiensSortie') }, ['series']),
        erreurs: [424],
      }),
    },
    '/vms/{vmId}/journaux': {
      get: op({
        tag: T_VMS,
        id: 'obtenirJournauxVm',
        resume: 'Obtenir un extrait de journal',
        detail: 'Vingt lignes au plus, avec un lien de sortie vers VictoriaLogs pour la suite.',
        params: [idVm, filtre('niveau', liste(['INFO', 'WARN', 'ERROR', 'DEBUG']))],
        ok: ref('ExtraitLogs'),
        erreurs: [424],
      }),
    },
    '/catalogue/images': {
      get: op({
        tag: T_VMS,
        id: 'listerImagesSysteme',
        resume: 'Lister les images système déployables',
        params: [filtreSite, filtre('famille', liste(['linux', 'windows', 'bsd', 'appliance']))],
        ok: tableau(ref('ImageSysteme')),
      }),
    },
    '/catalogue/gabarits': {
      get: op({
        tag: T_VMS,
        id: 'listerGabarits',
        resume: 'Lister les gabarits de machines',
        params: [filtreSite, filtre('famille', chaine())],
        ok: tableau(ref('Gabarit')),
      }),
    },
  },
  ...[
    ['demarrage', 'demarrerVm', 'Démarrer une machine', 'vm.power'],
    ['arret', 'arreterVm', 'Arrêter une machine', 'vm.power'],
    ['redemarrage', 'redemarrerVm', 'Redémarrer une machine', 'vm.power'],
  ].map(([verbe, id, resume, rbac]) =>
    action({
      tag: T_VMS,
      chemin: `/vms/{vmId}/${verbe}`,
      id,
      resume,
      params: [idVm],
      corps: objet({ force: booleen('Coupe l’alimentation sans arrêt propre.') }),
      rbac,
      erreurs: [409],
    }),
  ),
  action({
    tag: T_VMS,
    chemin: '/vms/{vmId}/redimensionnement',
    id: 'redimensionnerVm',
    resume: 'Redimensionner une machine',
    params: [idVm],
    corps: ref('VmRedimensionnement'),
    corpsRequis: true,
    rbac: 'vm.hardware.update',
    erreurs: [409, 402],
  }),
  action({
    tag: T_VMS,
    chemin: '/vms/{vmId}/migration',
    id: 'migrerVm',
    resume: 'Migrer une machine vers un autre socle ou site',
    detail: 'Le déplacement entre sites implique une coupure : la réponse en donne la durée estimée.',
    params: [idVm],
    corps: objet({ backendId: chaine(), site: liste(SITES), fenetre: horodatage() }),
    rbac: 'vm.hardware.update',
    erreurs: [409],
  }),
  {
    '/vms/{vmId}/instantanes': {
      get: op({
        tag: T_VMS,
        id: 'listerInstantanesVm',
        resume: 'Lister les instantanés d’une machine',
        params: [idVm],
        ok: tableau(ref('InstantaneVm')),
      }),
      post: op({
        tag: T_VMS,
        id: 'creerInstantaneVm',
        resume: 'Prendre un instantané',
        detail:
          'Un instantané n’est pas une sauvegarde : il vit sur le même socle, n’est pas immuable ' +
          'et sa durée de vie est bornée. Pour protéger, il faut un plan de sauvegarde.',
        params: [idVm],
        corps: objet({ nom: chaine(), avecMemoire: booleen(), description: chaine() }, ['nom']),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'backup.plan.write',
        erreurs: [402],
      }),
    },
    '/vms/{vmId}/instantanes/{instantaneId}': {
      delete: op({
        tag: T_VMS,
        id: 'supprimerInstantaneVm',
        resume: 'Supprimer un instantané',
        params: [idVm, chemin('instantaneId', 'Identifiant de l’instantané.')],
        code: 204,
        rbac: 'backup.plan.write',
      }),
      post: op({
        tag: T_VMS,
        id: 'restaurerInstantaneVm',
        resume: 'Revenir à un instantané',
        detail: 'La machine redémarre sur l’état capturé : tout ce qui a suivi est perdu.',
        params: [idVm, chemin('instantaneId', 'Identifiant de l’instantané.')],
        destructif: true,
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'backup.restore',
        erreurs: [409],
      }),
    },
  },
  action({
    tag: T_VMS,
    chemin: '/vms/{vmId}/console',
    id: 'ouvrirConsoleVm',
    resume: 'Ouvrir une console',
    params: [idVm],
    ok: ref('ConsoleVm'),
    code: 201,
    rbac: 'vm.power',
  }),
)

// ─── Kubernetes ───────────────────────────────────────────────────────

const k8s = fusion(
  crud({
    tag: T_K8S,
    base: '/kubernetes',
    idParam: idCluster,
    nomSingulier: 'Cluster',
    nomPluriel: 'Clusters',
    libelle: 'un cluster Kubernetes',
    libellePluriel: 'les clusters Kubernetes',
    schema: 'ClusterK8s',
    creation: 'ClusterK8sCreation',
    modification: 'ClusterK8sCreation',
    creationAsync: true,
    suppressionAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'vm.create_delete',
    filtres: [filtreEspace, filtreSite, filtre('statut', liste(['running', 'degraded', 'provisioning', 'updating']))],
    sansModification: true,
    erreursCreation: [404],
  }),
  {
    '/kubernetes/versions': {
      get: op({
        tag: T_K8S,
        id: 'listerVersionsK8s',
        resume: 'Lister les versions qualifiées',
        detail: 'Première étape de l’assistant : aucune version « latest », chaque ligne porte sa fin de support.',
        ok: tableau(ref('VersionK8s')),
      }),
    },
    '/kubernetes/modules': {
      get: op({
        tag: T_K8S,
        id: 'listerModulesK8s',
        resume: 'Lister les modules installables',
        params: [filtre('version', chaine(), 'Filtre sur la compatibilité d’une version.')],
        ok: tableau(
          objet(
            {
              slug: chaine(),
              nom: chaine(),
              description: chaine(),
              categorie: chaine(),
              version: chaine(),
              recommande: booleen(),
              coutMensuel: entier(),
            },
            ['slug', 'nom', 'description', 'version'],
          ),
        ),
      }),
    },
    '/kubernetes/{clusterId}/pools': {
      get: op({
        tag: T_K8S,
        id: 'listerPoolsK8s',
        resume: 'Lister les pools de workers',
        params: [idCluster],
        ok: tableau(ref('PoolWorkers')),
      }),
      post: op({
        tag: T_K8S,
        id: 'ajouterPoolK8s',
        resume: 'Ajouter un pool de workers',
        params: [idCluster],
        corps: ref('PoolWorkers'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.create_delete',
        erreurs: [409, 402],
      }),
    },
    '/kubernetes/{clusterId}/pools/{poolNom}': {
      patch: op({
        tag: T_K8S,
        id: 'modifierPoolK8s',
        resume: 'Modifier un pool de workers',
        params: [idCluster, chemin('poolNom', 'Nom du pool.')],
        corps: ref('PoolWorkers'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.create_delete',
      }),
      delete: op({
        tag: T_K8S,
        id: 'supprimerPoolK8s',
        resume: 'Supprimer un pool de workers',
        detail: 'Les charges sont drainées avant retrait des nœuds.',
        params: [idCluster, chemin('poolNom', 'Nom du pool.')],
        destructif: true,
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.create_delete',
      }),
    },
    '/kubernetes/{clusterId}/modules': {
      put: op({
        tag: T_K8S,
        id: 'modifierModulesK8s',
        resume: 'Installer ou retirer des modules',
        params: [idCluster],
        corps: objet({ modules: tableau(chaine()) }, ['modules']),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.create_delete',
      }),
    },
    '/kubernetes/{clusterId}/kubeconfig': {
      get: op({
        tag: T_K8S,
        id: 'obtenirKubeconfig',
        resume: 'Obtenir un kubeconfig',
        detail: 'Émis au nom du compte appelant, avec la durée de vie fixée par la politique de l’organisation.',
        params: [idCluster],
        ok: ref('Kubeconfig'),
        rbac: 'component.restart',
      }),
    },
    '/kubernetes/{clusterId}/metriques': {
      get: op({
        tag: T_K8S,
        id: 'obtenirMetriquesK8s',
        resume: 'Obtenir les métriques d’un cluster',
        detail:
          'Agrège les diagnostics Nova/libvirt des VM réelles derrière le cluster (masters et ' +
          'workers, retrouvées via la stack Heat du cluster Magnum) — un instantané réel, pas un ' +
          'historique, même mécanique que `GET /vms/{vmId}/metriques`.',
        params: [idCluster],
        ok: objet(
          {
            series: tableau(ref('Serie')),
            noeuds: tableau(
              objet(
                { id: chaine(), statut: chaine(), vcpu: entier(), cpu: nombre(), ram: nombre() },
                ['id', 'statut'],
              ),
            ),
          },
          ['series', 'noeuds'],
        ),
        rbac: 'org.dashboard.view',
        erreurs: [424],
      }),
    },
  },
  action({
    tag: T_K8S,
    chemin: '/kubernetes/{clusterId}/mise-a-jour',
    id: 'mettreAJourClusterK8s',
    resume: 'Mettre à jour la version d’un cluster',
    detail: 'Control plane puis pools, un pool à la fois. La fenêtre demandée est respectée.',
    params: [idCluster],
    corps: objet({ version: chaine(), fenetre: horodatage(), poolsSimultanes: entier() }, ['version']),
    corpsRequis: true,
    rbac: 'vm.create_delete',
    erreurs: [409],
  }),
)

// ─── Réseau ───────────────────────────────────────────────────────────

const reseau = fusion(
  crud({
    tag: T_RESEAU,
    base: '/reseaux',
    idParam: chemin('reseauId', 'Identifiant du réseau.'),
    nomSingulier: 'Reseau',
    nomPluriel: 'Reseaux',
    libelle: 'un réseau privé',
    libellePluriel: 'les réseaux privés',
    schema: 'Reseau',
    creation: 'ReseauCreation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'network.manage',
    filtres: [filtreEspace],
  }),
  crud({
    tag: T_RESEAU,
    base: '/ips',
    idParam: chemin('ipId', 'Identifiant de l’adresse.'),
    nomSingulier: 'Ip',
    nomPluriel: 'Ips',
    libelle: 'une adresse IP publique',
    libellePluriel: 'les adresses IP publiques',
    schema: 'IpPublique',
    creation: 'IpPubliqueReservation',
    modification: 'IpPubliqueReservation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'network.manage',
    filtres: [filtreEspace, filtre('attachee', booleen())],
    idsOperations: { creation: 'reserverIp', suppression: 'libererIp' },
  }),
  {
    '/ips/{ipId}/attachement': {
      put: op({
        tag: T_RESEAU,
        id: 'attacherIp',
        resume: 'Attacher une adresse à une ressource',
        params: [chemin('ipId', 'Identifiant de l’adresse.')],
        corps: objet({ cibleId: chaine('VM, load balancer ou passerelle.'), ptr: chaine() }, ['cibleId']),
        ok: ref('IpPublique'),
        rbac: 'network.manage',
        erreurs: [409],
      }),
      delete: op({
        tag: T_RESEAU,
        id: 'detacherIp',
        resume: 'Détacher une adresse',
        params: [chemin('ipId', 'Identifiant de l’adresse.')],
        ok: ref('IpPublique'),
        rbac: 'network.manage',
      }),
    },
  },
  crud({
    tag: T_RESEAU,
    base: '/groupes-securite',
    idParam: chemin('groupeId', 'Identifiant du groupe.'),
    nomSingulier: 'GroupeSecurite',
    nomPluriel: 'GroupesSecurite',
    libelle: 'un groupe de sécurité',
    libellePluriel: 'les groupes de sécurité',
    schema: 'GroupeSecurite',
    creation: 'GroupeSecuriteCreation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'network.manage',
    filtres: [filtreEspace],
  }),
  {
    '/groupes-securite/{groupeId}/regles': {
      post: op({
        tag: T_RESEAU,
        id: 'ajouterRegleSecurite',
        resume: 'Ajouter une règle de filtrage',
        params: [chemin('groupeId', 'Identifiant du groupe.')],
        corps: ref('RegleSecurite'),
        ok: ref('GroupeSecurite'),
        code: 201,
        rbac: 'network.manage',
      }),
    },
    '/groupes-securite/{groupeId}/regles/{regleId}': {
      put: op({
        tag: T_RESEAU,
        id: 'modifierRegleSecurite',
        resume: 'Modifier une règle de filtrage',
        params: [chemin('groupeId', 'Identifiant du groupe.'), chemin('regleId', 'Identifiant de la règle.')],
        corps: ref('RegleSecurite'),
        ok: ref('GroupeSecurite'),
        rbac: 'network.manage',
      }),
      delete: op({
        tag: T_RESEAU,
        id: 'supprimerRegleSecurite',
        resume: 'Supprimer une règle de filtrage',
        params: [chemin('groupeId', 'Identifiant du groupe.'), chemin('regleId', 'Identifiant de la règle.')],
        code: 204,
        rbac: 'network.manage',
      }),
    },
    '/groupes-securite/{groupeId}/attachements': {
      put: op({
        tag: T_RESEAU,
        id: 'attacherGroupeSecurite',
        resume: 'Attacher un groupe de sécurité à des ressources',
        params: [chemin('groupeId', 'Identifiant du groupe.')],
        corps: objet({ cibles: tableau(chaine()) }, ['cibles']),
        ok: ref('GroupeSecurite'),
        rbac: 'network.manage',
      }),
    },
  },
  crud({
    tag: T_RESEAU,
    base: '/vpn',
    idParam: chemin('tunnelId', 'Identifiant du tunnel.'),
    nomSingulier: 'Tunnel',
    nomPluriel: 'Tunnels',
    libelle: 'un tunnel VPN',
    libellePluriel: 'les tunnels VPN',
    schema: 'TunnelVpn',
    creation: 'TunnelVpnCreation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'network.manage',
    filtres: [filtreEspace, filtre('statut', liste(['up', 'down', 'negociation']))],
  }),
  {
    '/vpn/{tunnelId}/profils': {
      post: op({
        tag: T_RESEAU,
        id: 'creerProfilVpn',
        resume: 'Émettre un profil client VPN',
        detail: 'La configuration et le certificat ne sont renvoyés qu’une fois.',
        params: [chemin('tunnelId', 'Identifiant du tunnel.')],
        corps: objet({ nom: chaine(), utilisateur: chaine() }, ['nom', 'utilisateur']),
        ok: objet(
          { nom: chaine(), configuration: chaine(), expire: horodatage() },
          ['nom', 'configuration'],
        ),
        code: 201,
        rbac: 'network.manage',
      }),
    },
    '/vpn/{tunnelId}/profils/{profilNom}': {
      delete: op({
        tag: T_RESEAU,
        id: 'revoquerProfilVpn',
        resume: 'Révoquer un profil client VPN',
        params: [chemin('tunnelId', 'Identifiant du tunnel.'), chemin('profilNom', 'Nom du profil.')],
        code: 204,
        rbac: 'network.manage',
      }),
    },
  },
  action({
    tag: T_RESEAU,
    chemin: '/vpn/{tunnelId}/renegociation',
    id: 'renegocierTunnelVpn',
    resume: 'Renégocier un tunnel',
    detail: 'Coupe la session en cours et relance la négociation : quelques secondes de trafic perdu.',
    params: [chemin('tunnelId', 'Identifiant du tunnel.')],
    ok: ref('TunnelVpn'),
    code: 200,
    rbac: 'network.manage',
    erreurs: [409],
  }),
  crud({
    tag: T_RESEAU,
    base: '/load-balancers',
    idParam: chemin('lbId', 'Identifiant du load balancer.', 'lb-1'),
    nomSingulier: 'LoadBalancer',
    nomPluriel: 'LoadBalancers',
    libelle: 'un load balancer',
    libellePluriel: 'les load balancers',
    schema: 'LoadBalancer',
    creation: 'LoadBalancerCreation',
    creationAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'lb.create',
    filtres: [filtreEspace, filtre('layer', liste(['l4', 'l7'])), filtre('exposure', liste(['public', 'interne']))],
  }),
  {
    '/load-balancers/{lbId}/pool': {
      put: op({
        tag: T_RESEAU,
        id: 'modifierPoolLoadBalancer',
        resume: 'Remplacer le pool de cibles',
        params: [chemin('lbId', 'Identifiant du load balancer.', 'lb-1')],
        corps: objet(
          {
            cibles: tableau(
              objet({ targetId: chaine(), poids: entier(), drain: booleen() }, ['targetId']),
            ),
          },
          ['cibles'],
        ),
        ok: ref('LoadBalancer'),
        rbac: 'lb.create',
      }),
    },
    '/load-balancers/{lbId}/regles-l7': {
      put: op({
        tag: T_RESEAU,
        id: 'modifierReglesL7',
        resume: 'Définir les règles de routage L7',
        params: [chemin('lbId', 'Identifiant du load balancer.', 'lb-1')],
        corps: objet(
          {
            regles: tableau(
              objet({ hote: chaine(), chemin: chaine(), entete: chaine(), cible: chaine() }, ['cible']),
            ),
          },
          ['regles'],
        ),
        ok: ref('LoadBalancer'),
        rbac: 'lb.create',
      }),
    },
    '/load-balancers/{lbId}/metriques': {
      get: op({
        tag: T_RESEAU,
        id: 'obtenirMetriquesLoadBalancer',
        resume: 'Obtenir les séries d’un load balancer',
        params: [chemin('lbId', 'Identifiant du load balancer.', 'lb-1'), { $ref: '#/components/parameters/Fenetre' }],
        ok: objet({ series: tableau(ref('Serie')), liens: ref('LiensSortie') }, ['series']),
        erreurs: [424],
      }),
    },
  },
)

// ─── Stockage ─────────────────────────────────────────────────────────

const stockage = fusion(
  crud({
    tag: T_STOCKAGE,
    base: '/volumes',
    idParam: chemin('volumeId', 'Identifiant du volume.'),
    nomSingulier: 'Volume',
    nomPluriel: 'Volumes',
    libelle: 'un volume bloc',
    libellePluriel: 'les volumes bloc',
    schema: 'Volume',
    creation: 'VolumeCreation',
    creationAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'vm.create_delete',
    filtres: [filtreEspace, filtre('classe', liste(['nvme', 'ssd', 'hdd', 'archive'])), filtre('attache', booleen())],
  }),
  {
    '/volumes/{volumeId}/attachement': {
      put: op({
        tag: T_STOCKAGE,
        id: 'attacherVolume',
        resume: 'Attacher un volume à une machine',
        params: [chemin('volumeId', 'Identifiant du volume.')],
        corps: objet({ vmId: chaine(), montage: chaine() }, ['vmId']),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.hardware.update',
        erreurs: [409],
      }),
      delete: op({
        tag: T_STOCKAGE,
        id: 'detacherVolume',
        resume: 'Détacher un volume',
        detail: 'Refusé tant que le système de fichiers est monté côté machine.',
        params: [chemin('volumeId', 'Identifiant du volume.')],
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'vm.hardware.update',
        erreurs: [409],
      }),
    },
  },
  action({
    tag: T_STOCKAGE,
    chemin: '/volumes/{volumeId}/extension',
    id: 'etendreVolume',
    resume: 'Étendre un volume',
    detail: 'Un volume ne se réduit pas. L’extension du système de fichiers reste à la charge du client.',
    params: [chemin('volumeId', 'Identifiant du volume.')],
    corps: objet({ tailleGo: entier() }, ['tailleGo']),
    corpsRequis: true,
    rbac: 'vm.hardware.update',
    erreurs: [402],
  }),
  crud({
    tag: T_STOCKAGE,
    base: '/buckets',
    idParam: chemin('bucketId', 'Identifiant du bucket.', 'bkt-1'),
    nomSingulier: 'Bucket',
    nomPluriel: 'Buckets',
    libelle: 'un bucket objet',
    libellePluriel: 'les buckets objet',
    schema: 'Bucket',
    creation: 'BucketCreation',
    modification: 'BucketCreation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'vm.create_delete',
    filtres: [filtre('region', liste(SITES)), filtre('classe', liste(['chaud', 'froid']))],
  }),
  {
    '/buckets/{bucketId}/usage': {
      get: op({
        tag: T_STOCKAGE,
        id: 'obtenirUsageBucket',
        resume: 'Obtenir l’usage d’un bucket',
        detail:
          "Taille, nombre d'objets, requêtes et egress. Le portail ne liste pas les objets : " +
          'ce serait réimplémenter un explorateur de fichiers.',
        params: [chemin('bucketId', 'Identifiant du bucket.', 'bkt-1'), { $ref: '#/components/parameters/Fenetre' }],
        ok: objet(
          {
            tailleGo: nombre(),
            objets: entier(),
            requetes: entier(),
            egressGo: nombre(),
            series: tableau(ref('Serie')),
          },
          ['tailleGo', 'objets'],
        ),
      }),
    },
  },
  crud({
    tag: T_STOCKAGE,
    base: '/cles-s3',
    idParam: chemin('cleS3Id', 'Identifiant de la clé.'),
    nomSingulier: 'CleS3',
    nomPluriel: 'ClesS3',
    libelle: 'une clé d’accès S3',
    libellePluriel: 'les clés d’accès S3',
    schema: 'CleS3',
    creation: 'CleS3Creation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'vm.create_delete',
    sansModification: true,
    idsOperations: { suppression: 'revoquerCleS3' },
  }),
)

stockage['/cles-s3'].post.responses['201'].content['application/json'].schema = ref('CleS3Secret')

// ─── Bases managées ───────────────────────────────────────────────────

const bases = fusion(
  crud({
    tag: T_BASES,
    base: '/bases',
    idParam: chemin('baseId', 'Identifiant de la base.'),
    nomSingulier: 'BaseManagee',
    nomPluriel: 'BasesManagees',
    libelle: 'une base managée',
    libellePluriel: 'les bases managées',
    schema: 'BaseManagee',
    creation: 'BaseManageeCreation',
    modification: 'BaseManageeCreation',
    creationAsync: true,
    suppressionAsync: true,
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'vm.create_delete',
    filtres: [filtreEspace, filtre('moteur', chaine()), filtre('statut', liste(['running', 'degraded', 'maintenance']))],
  }),
  {
    '/bases/{baseId}/metriques': {
      get: op({
        tag: T_BASES,
        id: 'obtenirMetriquesBase',
        resume: 'Obtenir les séries d’une base',
        params: [chemin('baseId', 'Identifiant de la base.'), { $ref: '#/components/parameters/Fenetre' }],
        ok: objet({ series: tableau(ref('Serie')), liens: ref('LiensSortie') }, ['series']),
        erreurs: [424],
      }),
    },
    '/bases/{baseId}/identifiants': {
      get: op({
        tag: T_BASES,
        id: 'obtenirIdentifiantsBase',
        resume: 'Obtenir la chaîne de connexion',
        params: [chemin('baseId', 'Identifiant de la base.')],
        ok: objet(
          {
            host: chaine(),
            port: entier(),
            utilisateur: chaine(),
            base: chaine(),
            uri: chaine('URI complète, mot de passe masqué.'),
            certificatCa: chaine(),
          },
          ['host', 'port', 'utilisateur', 'base'],
        ),
        rbac: 'secrets.update',
      }),
    },
  },
  action({
    tag: T_BASES,
    chemin: '/bases/{baseId}/restauration',
    id: 'restaurerBaseDansLeTemps',
    resume: 'Restaurer une base à un instant donné',
    detail: 'Exige `pitr` actif. Restaure sur une nouvelle instance ; l’originale n’est pas touchée.',
    params: [chemin('baseId', 'Identifiant de la base.')],
    corps: objet({ instant: horodatage(), nomCible: chaine() }, ['instant', 'nomCible']),
    corpsRequis: true,
    rbac: 'backup.restore',
    erreurs: [409],
  }),
  action({
    tag: T_BASES,
    chemin: '/bases/{baseId}/identifiants/rotation',
    id: 'rotationnerIdentifiantsBase',
    resume: 'Faire tourner le mot de passe d’une base',
    detail:
      'L’ancien mot de passe cesse de fonctionner à la fin du délai de grâce : les applications ' +
      'qui le portent encore doivent être redéployées avant.',
    params: [chemin('baseId', 'Identifiant de la base.')],
    corps: objet({ delaiGraceMin: entier() }),
    ok: objet(
      { host: chaine(), port: entier(), utilisateur: chaine(), motDePasse: chaine('Renvoyé une seule fois.') },
      ['host', 'port', 'utilisateur', 'motDePasse'],
    ),
    code: 200,
    rbac: 'secrets.update',
    erreurs: [409],
  }),
  action({
    tag: T_BASES,
    chemin: '/bases/{baseId}/replicas',
    id: 'ajouterReplicaBase',
    resume: 'Ajouter un réplica de lecture',
    params: [chemin('baseId', 'Identifiant de la base.')],
    corps: objet({ site: liste(SITES) }),
    rbac: 'vm.create_delete',
    erreurs: [402],
  }),
)

// ─── Sauvegarde, restauration, PRA ────────────────────────────────────

const protection = fusion(
  crud({
    tag: T_PROTECTION,
    base: '/sauvegarde/plans',
    idParam: chemin('planId', 'Identifiant du plan.'),
    nomSingulier: 'PlanSauvegarde',
    nomPluriel: 'PlansSauvegarde',
    libelle: 'un plan de sauvegarde',
    libellePluriel: 'les plans de sauvegarde',
    schema: 'PlanSauvegarde',
    creation: 'PlanSauvegardeCreation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'backup.plan.write',
    filtres: [
      filtre('frequence', liste(['horaire', 'quotidien', 'hebdo', 'continu'])),
      filtre('dernierResultat', liste(['ok', 'echec', 'partiel'])),
      filtre('ressourceId', chaine(), 'Plans couvrant une ressource donnée.'),
    ],
  }),
  {
    '/sauvegarde/points': {
      get: op({
        tag: T_PROTECTION,
        id: 'listerPointsRestauration',
        resume: 'Lister les points de restauration',
        paginee: true,
        params: [
          filtre('planId', chaine()),
          filtre('ressourceId', chaine()),
          filtre('depuis', horodatage()),
          filtre('jusqua', horodatage()),
          filtre('immuables', booleen()),
        ],
        ok: page(ref('PointRestauration')),
      }),
    },
    '/sauvegarde/points/{pointId}': {
      delete: op({
        tag: T_PROTECTION,
        id: 'supprimerPointRestauration',
        resume: 'Supprimer un point de restauration',
        detail:
          'Refusé (`409`) tant que le point est immuable : c’est précisément ce que garantit ' +
          'l’immuabilité, et aucun rôle ne peut la contourner.',
        params: [chemin('pointId', 'Identifiant du point.')],
        destructif: true,
        code: 204,
        rbac: 'backup.plan.write',
        erreurs: [409],
      }),
    },
    '/sauvegarde/restaurations': {
      get: op({
        tag: T_PROTECTION,
        id: 'listerRestaurations',
        resume: 'Lister les restaurations demandées',
        detail: 'Trace de qui a restauré quoi, quand, et avec quelle granularité.',
        paginee: true,
        params: [filtre('statut', chaine()), filtre('ressourceId', chaine()), filtre('depuis', horodatage())],
        ok: page(ref('Restauration')),
      }),
    },
    '/sauvegarde/restaurations/{restaurationId}': {
      get: op({
        tag: T_PROTECTION,
        id: 'obtenirRestauration',
        resume: 'Suivre une restauration',
        params: [chemin('restaurationId', 'Identifiant de la restauration.')],
        ok: ref('Restauration'),
      }),
    },
    '/sauvegarde/conformite': {
      get: op({
        tag: T_PROTECTION,
        id: 'obtenirConformiteSauvegarde',
        resume: 'Obtenir le tableau de conformité 3-2-1',
        detail: 'Une ligne par ressource, protégée ou non. C’est la vue qu’on présente à un auditeur.',
        paginee: true,
        params: [filtre('protection', liste(['protegee', 'non_protegee', 'echec'])), filtre('type', chaine())],
        ok: page(ref('LigneConformite')),
        rbac: 'audit.view',
      }),
    },
  },
  action({
    tag: T_PROTECTION,
    chemin: '/sauvegarde/plans/{planId}/execution',
    id: 'executerPlanSauvegarde',
    resume: 'Lancer une sauvegarde hors planning',
    params: [chemin('planId', 'Identifiant du plan.')],
    rbac: 'backup.plan.write',
  }),
  action({
    tag: T_PROTECTION,
    chemin: '/sauvegarde/restaurations',
    id: 'lancerRestauration',
    resume: 'Lancer une restauration',
    detail:
      'La granularité demandée décide de ce qui remonte : tout, des fichiers, une base, une ' +
      'boîte aux lettres. Une restauration en place exige la confirmation par le nom.',
    corps: ref('DemandeRestauration'),
    corpsRequis: true,
    rbac: 'backup.restore',
    erreurs: [409, 404],
  }),
  action({
    tag: T_PROTECTION,
    chemin: '/sauvegarde/points/{pointId}/verification',
    id: 'verifierPointRestauration',
    resume: 'Vérifier un point de restauration',
    detail: 'Restauration à blanc dans un bac isolé : c’est ce qui distingue une sauvegarde d’un espoir.',
    params: [chemin('pointId', 'Identifiant du point.')],
    rbac: 'backup.restore',
  }),
  crud({
    tag: T_PROTECTION,
    base: '/pra',
    idParam: chemin('praId', 'Identifiant du plan de reprise.', 'pra-dba-prod'),
    nomSingulier: 'PlanPra',
    nomPluriel: 'PlansPra',
    libelle: 'un plan de reprise',
    libellePluriel: 'les plans de reprise',
    schema: 'PlanPra',
    creation: 'PlanPraCreation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'dr.failover.test',
    filtres: [filtre('statut', liste(['operationnel', 'degrade', 'jamais_teste']))],
  }),
  action({
    tag: T_PROTECTION,
    chemin: '/pra/{praId}/bascule',
    id: 'basculerPra',
    resume: 'Déclencher une bascule',
    detail:
      'Une bascule de test s’exécute en isolation sur le site de repli ; une bascule réelle coupe ' +
      'le site source et exige la saisie du nom exact du plan.',
    params: [chemin('praId', 'Identifiant du plan de reprise.', 'pra-dba-prod')],
    corps: ref('DemandeBascule'),
    corpsRequis: true,
    rbac: 'dr.failover.real',
    erreurs: [409],
  }),
  action({
    tag: T_PROTECTION,
    chemin: '/pra/{praId}/retour',
    id: 'revenirSiteSource',
    resume: 'Revenir sur le site source après bascule',
    params: [chemin('praId', 'Identifiant du plan de reprise.', 'pra-dba-prod')],
    corps: objet({ fenetre: horodatage(), confirmation: chaine() }, ['confirmation']),
    corpsRequis: true,
    rbac: 'dr.failover.real',
    erreurs: [409],
  }),
  {
    '/pra/{praId}/exercices': {
      get: op({
        tag: T_PROTECTION,
        id: 'listerExercicesPra',
        resume: 'Lister les exercices d’un plan de reprise',
        params: [chemin('praId', 'Identifiant du plan de reprise.', 'pra-dba-prod')],
        ok: tableau(ref('ExercicePra')),
      }),
    },
  },
)

// ─── Observabilité transverse ─────────────────────────────────────────

const observabilite = fusion(
  {
    '/observabilite/metriques': {
      get: op({
        tag: T_OBS,
        id: 'obtenirMetriques',
        resume: 'Obtenir des séries pour une ressource',
        detail:
          'Quatre formats seulement dans le portail : tuile, série, liste d’événements, extrait de ' +
          'journal. Le reste passe par les liens de sortie.',
        params: [
          filtre('ressourceId', chaine(), 'Identifiant de la ressource observée.'),
          filtre('metriques', chaine(), 'Liste séparée par des virgules.'),
          { $ref: '#/components/parameters/Fenetre' },
        ],
        ok: objet(
          { tuiles: tableau(ref('Tuile')), series: tableau(ref('Serie')), liens: ref('LiensSortie') },
          ['series'],
        ),
        erreurs: [424],
      }),
    },
    '/observabilite/evenements': {
      get: op({
        tag: T_OBS,
        id: 'listerEvenementsSupervision',
        resume: 'Lister les événements de supervision',
        detail: 'Huit lignes par défaut : au-delà, la liste devient un outil de supervision, ce qu’elle n’est pas.',
        paginee: true,
        params: [
          filtre('gravite', liste(['critique', 'majeure', 'mineure', 'info'])),
          filtre('ressourceId', chaine()),
          filtreSite,
          filtre('depuis', horodatage()),
        ],
        ok: page(ref('EvenementSupervision')),
        erreurs: [424],
      }),
    },
    '/observabilite/journaux': {
      get: op({
        tag: T_OBS,
        id: 'obtenirJournaux',
        resume: 'Obtenir un extrait de journal',
        params: [
          filtre('ressourceId', chaine()),
          filtre('niveau', liste(['INFO', 'WARN', 'ERROR', 'DEBUG'])),
          filtre('depuis', horodatage()),
          filtre('recherche', chaine()),
        ],
        ok: ref('ExtraitLogs'),
        erreurs: [424],
      }),
    },
  },
  crud({
    tag: T_OBS,
    base: '/observabilite/alertes',
    idParam: chemin('alerteId', 'Identifiant de la règle.'),
    nomSingulier: 'RegleAlerte',
    nomPluriel: 'ReglesAlerte',
    libelle: 'une règle d’alerte',
    libellePluriel: 'les règles d’alerte',
    schema: 'RegleAlerte',
    creation: 'RegleAlerteCreation',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'network.manage',
    filtres: [filtre('actif', booleen()), filtre('cible', chaine())],
  }),
  action({
    tag: T_OBS,
    chemin: '/observabilite/alertes/{alerteId}/test',
    id: 'testerRegleAlerte',
    resume: 'Envoyer une notification de test',
    params: [chemin('alerteId', 'Identifiant de la règle.')],
    ok: objet({ envoye: booleen(), canaux: tableau(chaine()) }, ['envoye']),
    code: 200,
  }),
)

export const cheminsInfra = fusion(bord, espaces, vms, k8s, reseau, stockage, bases, protection, observabilite)
