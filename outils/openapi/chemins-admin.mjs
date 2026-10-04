/**
 * Chemins — espace super admin : pilotage, clients, infrastructure, produit,
 * finance, exploitation.
 */

import {
  BACKENDS,
  ROLES,
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

const T_PILOTAGE = 'Super admin — pilotage'
const T_CLIENTS = 'Super admin — clients'
const T_INFRA = 'Super admin — infrastructure'
const T_PRODUIT = 'Super admin — produit'
const T_FINANCE = 'Super admin — finance'
const T_EXPLOIT = 'Super admin — exploitation'

const A = 'admin'
const idBackend = chemin('backendId', 'Identifiant du socle.')

// ─── Pilotage ─────────────────────────────────────────────────────────

const pilotage = {
  '/admin/tableau-de-bord': {
    get: op({
      tag: T_PILOTAGE,
      portee: A,
      id: 'obtenirTableauDeBordPlateforme',
      resume: 'Obtenir la synthèse de la plateforme',
      ok: ref('SynthesePlateforme'),
      rbac: 'capacity.manage',
      erreurs: [424],
    }),
  },
  '/admin/sante': {
    get: op({
      tag: T_PILOTAGE,
      portee: A,
      id: 'obtenirSantePlateforme',
      resume: 'Obtenir la santé de la plateforme',
      detail: 'Socles, files de provisioning, intégrations amont et alertes en cours.',
      ok: ref('SanteePlateforme'),
      rbac: 'capacity.manage',
      erreurs: [424],
    }),
  },
  '/admin/travaux': {
    get: op({
      tag: T_PILOTAGE,
      portee: A,
      id: 'listerTravauxPlateforme',
      resume: 'Lister les travaux de toutes les organisations',
      paginee: true,
      params: [
        filtre('statut', liste(['queued', 'running', 'done', 'failed', 'rolled_back'])),
        filtre('orgId', chaine()),
        filtre('type', chaine()),
      ],
      ok: page(ref('TravailProvisioning')),
      rbac: 'capacity.manage',
    }),
  },
  '/admin/audit': {
    get: op({
      tag: T_PILOTAGE,
      portee: A,
      id: 'listerAuditPlateforme',
      resume: 'Lister le journal d’audit de la plateforme',
      paginee: true,
      params: [
        filtre('orgId', chaine()),
        filtre('acteur', chaine()),
        filtre('action', chaine()),
        filtre('resultat', liste(['ok', 'refuse', 'erreur'])),
        filtre('depuis', horodatage()),
        filtre('jusqua', horodatage()),
      ],
      ok: page(ref('EvenementAudit')),
      rbac: 'audit.view',
    }),
  },
  '/admin/conformite': {
    get: op({
      tag: T_PILOTAGE,
      portee: A,
      id: 'obtenirConformitePlateforme',
      resume: 'Obtenir l’état de conformité de la plateforme',
      ok: objet(
        {
          referentiels: tableau(
            objet(
              {
                nom: chaine(),
                statut: liste(['conforme', 'partiel', 'non_conforme']),
                dernierAudit: jour(),
                prochainAudit: jour(),
                ecarts: entier(),
              },
              ['nom', 'statut'],
            ),
          ),
          conformite321: tableau(ref('LigneConformite')),
          exercicesPra: entier(),
          organisationsSansSauvegarde: entier(),
        },
        ['referentiels'],
      ),
      rbac: 'compliance.export',
    }),
  },
}

// ─── Infrastructure ───────────────────────────────────────────────────

const infrastructure = fusion(
  {
    '/admin/capacite': {
      get: op({
        tag: T_INFRA,
        portee: A,
        id: 'obtenirCapacite',
        resume: 'Obtenir la capacité et sa projection',
        detail: 'Saturation à 30, 60 et 90 jours par socle : c’est ce qui déclenche une commande de matériel.',
        params: [filtre('site', liste(SITES))],
        ok: ref('Capacite'),
        rbac: 'capacity.manage',
      }),
    },
    '/admin/backends': {
      get: op({
        tag: T_INFRA,
        portee: A,
        id: 'listerBackends',
        resume: 'Lister les socles de virtualisation',
        paginee: true,
        params: [
          filtre('type', liste(BACKENDS)),
          filtre('site', liste(SITES)),
          filtre('statut', liste(['en_ligne', 'maintenance', 'degrade'])),
          filtre('enSortie', booleen(), 'Socles propriétaires dont la sortie est engagée.'),
        ],
        ok: page(ref('Backend')),
        rbac: 'capacity.manage',
      }),
    },
    '/admin/backends/{backendId}': {
      get: op({
        tag: T_INFRA,
        portee: A,
        id: 'obtenirBackend',
        resume: 'Obtenir un socle',
        params: [idBackend],
        ok: ref('Backend'),
        rbac: 'capacity.manage',
      }),
      patch: op({
        tag: T_INFRA,
        portee: A,
        id: 'modifierBackend',
        resume: 'Modifier un socle',
        detail: 'Mise en maintenance, capacité déclarée, trajectoire de sortie.',
        params: [idBackend],
        corps: objet({
          statut: liste(['en_ligne', 'maintenance', 'degrade']),
          capacite: ref('Quota'),
          hosts: entier(),
          enSortie: objet({ actif: booleen(), cibleMigration: chaine() }),
        }),
        ok: ref('Backend'),
        rbac: 'capacity.manage',
      }),
    },
    '/admin/placements': {
      get: op({
        tag: T_INFRA,
        portee: A,
        id: 'listerPlacements',
        resume: 'Lister les règles de placement des espaces',
        ok: tableau(ref('Placement')),
        rbac: 'capacity.manage',
      }),
      put: op({
        tag: T_INFRA,
        portee: A,
        id: 'modifierPlacements',
        resume: 'Modifier la règle de placement d’un espace',
        detail: 'La somme des pourcentages d’un espace doit valoir 100.',
        corps: objet({ placements: tableau(ref('Placement')) }, ['placements']),
        ok: tableau(ref('Placement')),
        rbac: 'capacity.manage',
        erreurs: [409],
      }),
    },
    '/admin/sites': {
      get: op({
        tag: T_INFRA,
        portee: A,
        id: 'listerSitesPhysiques',
        resume: 'Lister les sites physiques',
        ok: tableau(ref('Datacenter')),
        rbac: 'capacity.manage',
      }),
    },
    '/admin/migration/campagnes': {
      get: op({
        tag: T_INFRA,
        portee: A,
        id: 'listerCampagnesMigration',
        resume: 'Lister les campagnes de migration',
        detail: 'Sortie des socles propriétaires : chaque campagne dit ce qu’elle déplace et l’impact client.',
        paginee: true,
        params: [filtre('statut', chaine()), filtre('backendSource', chaine())],
        ok: page(ref('CampagneMigration')),
        rbac: 'capacity.manage',
      }),
      post: op({
        tag: T_INFRA,
        portee: A,
        id: 'creerCampagneMigration',
        resume: 'Créer une campagne de migration',
        corps: objet(
          {
            nom: chaine(),
            backendSource: chaine(),
            backendCible: chaine(),
            ressources: tableau(chaine()),
            fenetre: chaine(),
            notifierClients: booleen(),
          },
          ['nom', 'backendSource', 'backendCible', 'fenetre'],
        ),
        ok: ref('CampagneMigration'),
        code: 201,
        rbac: 'capacity.manage',
      }),
    },
  },
  ...[
    ['lancement', 'lancerCampagneMigration', 'Lancer une campagne de migration'],
    ['suspension', 'suspendreCampagneMigration', 'Suspendre une campagne de migration'],
  ].map(([verbe, id, resume]) =>
    action({
      tag: T_INFRA,
      portee: A,
      chemin: `/admin/migration/campagnes/{campagneId}/${verbe}`,
      id,
      resume,
      params: [chemin('campagneId', 'Identifiant de la campagne.')],
      rbac: 'capacity.manage',
      erreurs: [409],
    }),
  ),
  action({
    tag: T_INFRA,
    portee: A,
    chemin: '/admin/migration/campagnes/{campagneId}/rollback',
    id: 'annulerCampagneMigration',
    resume: 'Revenir en arrière sur une campagne de migration',
    params: [chemin('campagneId', 'Identifiant de la campagne.')],
    destructif: true,
    rbac: 'capacity.manage',
    erreurs: [409],
  }),
)

// ─── Produit : catalogue et parc de services ──────────────────────────

const produit = fusion(
  crud({
    tag: T_PRODUIT,
    base: '/admin/catalogue/offres',
    idParam: chemin('offreId', 'Identifiant de l’offre.'),
    nomSingulier: 'Offre',
    nomPluriel: 'Offres',
    libelle: 'une offre',
    libellePluriel: 'les offres',
    schema: 'Offre',
    creation: 'OffreCreation',
    modification: 'OffreCreation',
    portee: A,
    rbacLecture: 'catalog.edit',
    rbacEcriture: 'catalog.edit',
    filtres: [
      filtre(
        'categorie',
        liste(['espace_cloud', 'image_vm', 'k8s', 'stack', 'web']),
        'Famille du catalogue — le découpage attendu côté fournisseur.',
      ),
      filtre('statut', liste(['brouillon', 'publiee', 'depreciee'])),
    ],
  }),
  {
    '/admin/catalogue/familles': {
      get: op({
        tag: T_PRODUIT,
        portee: A,
        id: 'listerFamillesCatalogue',
        resume: 'Lister les familles du catalogue',
        detail: 'Espace Cloud, images de VM, clusters, stacks, web — avec le compte d’offres par famille.',
        ok: tableau(
          objet(
            {
              code: liste(['espace_cloud', 'image_vm', 'k8s', 'stack', 'web']),
              libelle: chaine(),
              offres: entier(),
              publiees: entier(),
              souscriptionsActives: entier(),
            },
            ['code', 'libelle', 'offres'],
          ),
        ),
        rbac: 'catalog.edit',
      }),
    },
    '/admin/catalogue/services/{slug}': {
      put: op({
        tag: T_PRODUIT,
        portee: A,
        id: 'modifierFicheCatalogueService',
        resume: 'Modifier une fiche du catalogue de services managés',
        detail:
          'Paliers, prix, SLA, formats de réversibilité, migrations entrantes. La fiche est le ' +
          'contrat commercial du service : ce qu’elle annonce, la plateforme doit le tenir.',
        params: [chemin('slug', 'Slug du service.', 'drive-pro')],
        corps: ref('FicheCatalogue'),
        ok: ref('FicheCatalogue'),
        rbac: 'catalog.edit',
      }),
    },
    '/admin/catalogue/services/{slug}/versions': {
      post: op({
        tag: T_PRODUIT,
        portee: A,
        id: 'qualifierVersionService',
        resume: 'Qualifier une version d’un service managé',
        detail:
          'Une version n’est déployable qu’une fois qualifiée : c’est ce qui permet de ne jamais ' +
          'servir « latest » à un client.',
        params: [chemin('slug', 'Slug du service.', 'drive-pro')],
        corps: objet(
          {
            version: chaine(),
            notes: chaine(),
            notesUrl: chaine(),
            rupture: booleen(),
            dureeIndisponibiliteMin: entier(),
            rollbackPossible: booleen(),
            statut: liste(['disponible', 'depreciee', 'retiree']),
          },
          ['version'],
        ),
        ok: ref('VersionService'),
        code: 201,
        rbac: 'catalog.edit',
        erreurs: [409],
      }),
    },
    '/admin/modeles/{slug}': {
      put: op({
        tag: T_PRODUIT,
        portee: A,
        id: 'modifierModeleApplicatif',
        resume: 'Modifier un modèle de la bibliothèque',
        detail:
          'Version qualifiée, ressources par défaut, dépendances, variables, plan de sauvegarde ' +
          'proposé, et ce que le portail ne fera pas pour ce produit.',
        params: [chemin('slug', 'Slug du modèle.', 'zimbra')],
        corps: ref('ModeleApplicatif'),
        ok: ref('ModeleApplicatif'),
        rbac: 'catalog.edit',
      }),
    },
    '/admin/marketplace/instances': {
      get: op({
        tag: T_PRODUIT,
        portee: A,
        id: 'listerParcInstances',
        resume: 'Lister le parc des services managés',
        paginee: true,
        params: [
          filtre('catalogSlug', chaine()),
          filtre('orgId', chaine()),
          filtre('sante', liste(['ok', 'degrade', 'maintenance', 'maj_disponible'])),
          filtre('version', chaine()),
          filtre('site', liste(SITES)),
        ],
        ok: page(ref('InstanceParc')),
        rbac: 'capacity.manage',
      }),
    },
    '/admin/marketplace/campagnes': {
      get: op({
        tag: T_PRODUIT,
        portee: A,
        id: 'listerCampagnesMaj',
        resume: 'Lister les campagnes de mise à jour',
        paginee: true,
        params: [filtre('catalogSlug', chaine()), filtre('statut', chaine())],
        ok: page(ref('CampagneMaj')),
        rbac: 'capacity.manage',
      }),
      post: op({
        tag: T_PRODUIT,
        portee: A,
        id: 'creerCampagneMaj',
        resume: 'Créer une campagne de mise à jour',
        corps: objet(
          {
            nom: chaine(),
            catalogSlug: chaine(),
            versionCible: chaine(),
            fenetre: chaine(),
            strategie: liste(['par_vagues', 'immediate']),
            instances: tableau(chaine(), 'Vide pour tout le parc du service.'),
            notesVersion: chaine(),
          },
          ['nom', 'catalogSlug', 'versionCible', 'fenetre'],
        ),
        ok: ref('CampagneMaj'),
        code: 201,
        rbac: 'capacity.manage',
      }),
    },
  },
  action({
    tag: T_PRODUIT,
    portee: A,
    chemin: '/admin/catalogue/offres/{offreId}/publication',
    id: 'publierOffre',
    resume: 'Publier ou déprécier une offre',
    detail: 'Déprécier n’interrompt pas les souscriptions en cours ; la réponse en donne le nombre.',
    params: [chemin('offreId', 'Identifiant de l’offre.')],
    corps: objet({ statut: liste(['publiee', 'depreciee']) }, ['statut']),
    corpsRequis: true,
    ok: ref('Offre'),
    code: 200,
    rbac: 'catalog.edit',
  }),
  ...[
    ['lancement', 'lancerCampagneMaj', 'Lancer une campagne de mise à jour'],
    ['suspension', 'suspendreCampagneMaj', 'Suspendre une campagne de mise à jour'],
  ].map(([verbe, id, resume]) =>
    action({
      tag: T_PRODUIT,
      portee: A,
      chemin: `/admin/marketplace/campagnes/{campagneId}/${verbe}`,
      id,
      resume,
      params: [chemin('campagneId', 'Identifiant de la campagne.')],
      rbac: 'capacity.manage',
      erreurs: [409],
    }),
  ),
)

// ─── Finance ──────────────────────────────────────────────────────────

const finance = fusion(
  {
    '/admin/facturation/factures': {
      get: op({
        tag: T_FINANCE,
        portee: A,
        id: 'listerFacturesPlateforme',
        resume: 'Lister les factures de toutes les organisations',
        paginee: true,
        params: [
          filtre('orgId', chaine()),
          filtre('statut', liste(['brouillon', 'emise', 'payee', 'impayee', 'annulee'])),
          filtre('periode', chaine()),
        ],
        ok: page(ref('Facture')),
        rbac: 'invoice.view',
      }),
    },
    '/admin/facturation/impayes': {
      get: op({
        tag: T_FINANCE,
        portee: A,
        id: 'listerImpayes',
        resume: 'Lister les impayés et les relances',
        paginee: true,
        params: [filtre('retardMinJours', entier()), filtre('orgId', chaine())],
        ok: page(ref('Impaye')),
        rbac: 'invoice.view',
      }),
    },
    '/admin/facturation/marges': {
      get: op({
        tag: T_FINANCE,
        portee: A,
        id: 'listerMargesBackends',
        resume: 'Obtenir la marge par socle',
        detail: 'Coût d’infrastructure contre revenu : c’est ce qui justifie la sortie d’un socle propriétaire.',
        ok: tableau(ref('MargeBackend')),
        rbac: 'catalog.edit',
      }),
    },
    '/admin/facturation/cycles': {
      get: op({
        tag: T_FINANCE,
        portee: A,
        id: 'listerCyclesFacturation',
        resume: 'Lister les cycles de facturation',
        detail: 'Un cycle par période, avec le nombre de factures émises et les organisations en échec.',
        paginee: true,
        params: [filtre('periode', chaine()), filtre('statut', chaine())],
        ok: page(ref('CycleFacturation')),
        rbac: 'invoice.view',
      }),
    },
  },
  action({
    tag: T_FINANCE,
    portee: A,
    chemin: '/admin/facturation/cycle',
    id: 'lancerCycleFacturation',
    resume: 'Lancer le cycle de facturation d’une période',
    detail: 'Produit les factures à l’état brouillon ; l’émission reste une action distincte.',
    corps: objet({ periode: chaine(), orgIds: tableau(chaine()), emettre: booleen() }, ['periode']),
    corpsRequis: true,
    rbac: 'invoice.view',
    erreurs: [409],
  }),
  action({
    tag: T_FINANCE,
    portee: A,
    chemin: '/admin/facturation/impayes/relances',
    id: 'lancerRelances',
    resume: 'Envoyer une vague de relances',
    corps: objet(
      { factures: tableau(chaine()), niveau: liste(['rappel', 'mise_en_demeure', 'suspension']) },
      ['factures', 'niveau'],
    ),
    corpsRequis: true,
    ok: objet({ envoyees: entier(), echecs: entier() }, ['envoyees']),
    code: 200,
    rbac: 'invoice.view',
  }),
)

// ─── Exploitation ─────────────────────────────────────────────────────

const exploitation = fusion(
  {
    '/admin/tickets': {
      get: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'listerTicketsPlateforme',
        resume: 'Lister les tickets de toutes les organisations',
        paginee: true,
        params: [
          filtre('orgId', chaine()),
          filtre('statut', chaine()),
          filtre('gravite', liste(['critique', 'majeure', 'mineure', 'question'])),
          filtre('slaRisque', booleen(), 'Tickets dont le SLA arrive à échéance.'),
          filtre('assigneA', chaine()),
        ],
        ok: page(ref('Ticket')),
      }),
    },
    '/admin/tickets/{ticketId}': {
      patch: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'traiterTicket',
        resume: 'Assigner ou faire évoluer un ticket',
        params: [chemin('ticketId', 'Identifiant ou numéro du ticket.', 'tck-4471')],
        corps: objet({
          assigneA: chaine(),
          statut: liste(['ouvert', 'en_cours', 'attente_client', 'resolu', 'ferme']),
          gravite: liste(['critique', 'majeure', 'mineure', 'question']),
        }),
        ok: ref('Ticket'),
      }),
    },
    '/admin/tickets/{ticketId}/messages': {
      post: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'repondreTicketPlateforme',
        resume: 'Répondre à un ticket au nom de Synelia',
        params: [chemin('ticketId', 'Identifiant ou numéro du ticket.', 'tck-4471')],
        corps: objet({ contenu: chaine(), pieces: tableau(chaine()), interne: booleen() }, ['contenu']),
        ok: ref('Ticket'),
        code: 201,
      }),
    },
    '/admin/statut/services': {
      get: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'listerStatutServices',
        resume: 'Lister l’état publié des services',
        ok: tableau(ref('StatutService')),
        rbac: 'capacity.manage',
      }),
      put: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'modifierStatutServices',
        resume: 'Modifier l’état publié des services',
        detail: 'Alimente la page de statut publique, par service et par site.',
        corps: objet({ services: tableau(ref('StatutService')) }, ['services']),
        ok: tableau(ref('StatutService')),
        rbac: 'capacity.manage',
      }),
    },
    '/admin/statut/incidents': {
      get: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'listerIncidentsPlateforme',
        resume: 'Lister les incidents',
        paginee: true,
        params: [filtre('statut', liste(['en_cours', 'surveille', 'resolu']))],
        ok: page(ref('Incident')),
      }),
      post: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'ouvrirIncident',
        resume: 'Ouvrir un incident public',
        corps: objet(
          {
            titre: chaine(),
            gravite: liste(['majeur', 'mineur', 'maintenance']),
            services: tableau(chaine()),
            sites: tableau(liste(SITES)),
            message: chaine(),
            notifierClients: booleen(),
          },
          ['titre', 'gravite', 'services', 'sites', 'message'],
        ),
        ok: ref('Incident'),
        code: 201,
        rbac: 'capacity.manage',
      }),
    },
    '/admin/statut/incidents/{incidentId}': {
      post: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'mettreAJourIncident',
        resume: 'Publier une mise à jour d’incident',
        params: [chemin('incidentId', 'Identifiant de l’incident.')],
        corps: objet(
          { texte: chaine(), statut: liste(['en_cours', 'surveille', 'resolu']), notifierClients: booleen() },
          ['texte'],
        ),
        ok: ref('Incident'),
        code: 201,
        rbac: 'capacity.manage',
      }),
    },
    '/admin/equipe': {
      get: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'listerEquipe',
        resume: 'Lister l’équipe Synelia',
        paginee: true,
        params: [filtre('equipe', chaine()), filtre('privilegie', booleen()), filtre('revueDue', booleen())],
        ok: page(ref('MembreEquipe')),
      }),
      post: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'ajouterMembreEquipe',
        resume: 'Ajouter un membre de l’équipe',
        corps: objet(
          { nom: chaine(), email: chaine(), role: liste(ROLES), equipe: chaine(), privilegie: booleen() },
          ['nom', 'email', 'role', 'equipe'],
        ),
        ok: ref('MembreEquipe'),
        code: 201,
        rbac: 'org.manage',
      }),
    },
    '/admin/equipe/{membreId}': {
      patch: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'modifierMembreEquipe',
        resume: 'Modifier un membre de l’équipe',
        params: [chemin('membreId', 'Identifiant du membre.')],
        corps: objet({ role: liste(ROLES), equipe: chaine(), privilegie: booleen(), revuLe: horodatage() }),
        ok: ref('MembreEquipe'),
        rbac: 'org.manage',
      }),
      delete: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'retirerMembreEquipe',
        resume: 'Retirer un membre de l’équipe',
        params: [chemin('membreId', 'Identifiant du membre.')],
        code: 204,
        rbac: 'org.manage',
      }),
    },
  },
  action({
    tag: T_EXPLOIT,
    portee: A,
    chemin: '/admin/organisations/{orgId}/notification',
    id: 'notifierOrganisation',
    resume: 'Notifier une organisation',
    detail: 'Message de maintenance ou d’incident, adressé aux rôles choisis.',
    params: [chemin('orgId', 'Identifiant de l’organisation.', 'org-dba')],
    corps: objet(
      {
        sujet: chaine(),
        message: chaine(),
        canaux: tableau(liste(['email', 'sms', 'whatsapp', 'portail'])),
        roles: tableau(chaine()),
      },
      ['sujet', 'message', 'canaux'],
    ),
    corpsRequis: true,
    ok: objet({ destinataires: entier() }, ['destinataires']),
    code: 200,
  }),
)


// ─── Prospection, conformité, élévations ──────────────────────────────

const ajouts = {
    '/admin/leads': {
      get: op({
        tag: T_CLIENTS,
        portee: A,
        id: 'listerLeads',
        resume: 'Lister les demandes entrantes de la vitrine',
        detail: 'Contacts, devis et configurations simulées, avec leur suivi commercial.',
        paginee: true,
        params: [
          filtre('statut', liste(['nouveau', 'contacte', 'qualifie', 'devis_envoye', 'gagne', 'perdu'])),
          filtre('origine', chaine()),
          filtre('assigneA', chaine()),
          filtre('depuis', horodatage()),
        ],
        ok: page(ref('Lead')),
      }),
    },
    '/admin/leads/{leadId}': {
      patch: op({
        tag: T_CLIENTS,
        portee: A,
        id: 'modifierLead',
        resume: 'Qualifier une demande entrante',
        params: [chemin('leadId', 'Identifiant de la demande.')],
        corps: objet({
          statut: liste(['nouveau', 'contacte', 'qualifie', 'devis_envoye', 'gagne', 'perdu']),
          assigneA: chaine(),
          note: chaine(),
        }),
        ok: ref('Lead'),
      }),
    },
    '/admin/conformite/fenetres-patching': {
      get: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'listerFenetresPatching',
        resume: 'Lister les fenêtres de patching',
        paginee: true,
        params: [filtre('statut', chaine()), filtre('depuis', horodatage())],
        ok: page(ref('FenetrePatching')),
        rbac: 'capacity.manage',
      }),
      post: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'planifierFenetrePatching',
        resume: 'Planifier une fenêtre de patching',
        detail: 'Les organisations concernées sont notifiées avec l’impact annoncé, pas après coup.',
        corps: objet(
          {
            libelle: chaine(),
            perimetre: chaine(),
            debut: horodatage(),
            dureeMin: entier(),
            recurrence: chaine(),
            impactClient: chaine(),
            notifier: booleen(),
          },
          ['libelle', 'perimetre', 'debut', 'dureeMin'],
        ),
        ok: ref('FenetrePatching'),
        code: 201,
        rbac: 'capacity.manage',
        erreurs: [409],
      }),
    },
    '/admin/conformite/tests-restauration': {
      post: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'lancerCampagneTestsRestauration',
        resume: 'Lancer une campagne de tests de restauration',
        detail:
          'Restaurations à blanc sur un échantillon : c’est ce qui distingue une sauvegarde ' +
          'd’un espoir, et ce que l’auditeur demande à voir daté.',
        corps: objet(
          {
            perimetre: liste(['toutes', 'organisation', 'type_ressource']),
            valeur: chaine(),
            echantillonPct: nombre(),
            fenetre: horodatage(),
          },
          ['perimetre'],
        ),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'compliance.export',
      }),
    },
    '/admin/equipe/{membreId}/elevation': {
      get: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'listerElevations',
        resume: 'Lister les élévations d’un membre de l’équipe',
        params: [chemin('membreId', 'Identifiant du membre.')],
        ok: tableau(ref('Elevation')),
        rbac: 'audit.view',
      }),
      post: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'eleverPrivileges',
        resume: 'Élever temporairement les privilèges d’un membre',
        detail:
          'Bornée dans le temps, motivée, rattachée à un ticket, et intégralement journalisée. ' +
          'Aucun rôle permanent ne remplace cette trace.',
        params: [chemin('membreId', 'Identifiant du membre.')],
        corps: objet(
          { role: liste(ROLES), motif: chaine(), ticketId: chaine(), dureeMin: entier() },
          ['role', 'motif', 'dureeMin'],
        ),
        ok: ref('Elevation'),
        code: 201,
        rbac: 'org.manage',
        erreurs: [409],
      }),
      delete: op({
        tag: T_EXPLOIT,
        portee: A,
        id: 'revoquerElevation',
        resume: 'Révoquer une élévation avant son terme',
        params: [chemin('membreId', 'Identifiant du membre.')],
        code: 204,
        rbac: 'org.manage',
      }),
    },
}

export const cheminsAdmin = fusion(
  pilotage,
  infrastructure,
  produit,
  finance,
  exploitation,
  ajouts,
)
