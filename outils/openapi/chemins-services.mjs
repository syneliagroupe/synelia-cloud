/**
 * Chemins — services managés, facturation, support, documentation.
 */

import {
  DEVISES,
  SITES,
  action,
  booleen,
  chaine,
  chemin,
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

const T_SERVICES = 'Services managés'
const T_FACTURATION = 'Facturation'
const T_SUPPORT = 'Support'
const T_DOCS = 'Documentation & formation'

const idService = chemin('serviceManageId', 'Identifiant du service managé.')
const slugCatalogue = chemin('slug', 'Slug de la fiche catalogue.', 'drive-pro')

// ─── Catalogue et services managés ────────────────────────────────────

const servicesManages = fusion(
  {
    '/catalogue/services': {
      get: op({
        tag: T_SERVICES,
        id: 'listerCatalogueServices',
        resume: 'Lister le catalogue des services managés',
        detail:
          'Chaque fiche annonce ses paliers, sa réversibilité et ses migrations entrantes. ' +
          'Le portail provisionne et ouvre la porte ; l’écran métier reste celui de la solution.',
        paginee: true,
        params: [
          filtre('categorie', chaine()),
          filtre('mode', liste(['dedie', 'mutualise'])),
          filtre('certifie', booleen()),
        ],
        ok: page(ref('FicheCatalogue')),
      }),
    },
    '/catalogue/services/{slug}': {
      get: op({
        tag: T_SERVICES,
        id: 'obtenirFicheCatalogue',
        resume: 'Obtenir une fiche du catalogue',
        params: [slugCatalogue],
        ok: ref('FicheCatalogue'),
      }),
    },
    '/catalogue/services/{slug}/configuration': {
      get: op({
        tag: T_SERVICES,
        id: 'obtenirSchemaConfiguration',
        resume: 'Obtenir le schéma de configuration d’un service',
        detail:
          'Un fichier par service : configurer une messagerie n’a presque rien de commun avec ' +
          'configurer un drive ou un ERP. `horsPerimetre` dit ce qui ne se règle pas ici.',
        params: [slugCatalogue],
        ok: ref('ConfigurationService'),
      }),
    },
    '/catalogue/services-partages': {
      get: op({
        tag: T_SERVICES,
        id: 'listerCataloguePartage',
        resume: 'Lister les services partagés attachables à un domaine',
        detail:
          'Messagerie et drive mutualisés : ils se rattachent au domaine d’un hébergement, ' +
          'pas à un projet.',
        ok: tableau(ref('FicheCatalogue')),
      }),
    },
    '/catalogue/contrat-integration': {
      get: op({
        tag: T_SERVICES,
        id: 'obtenirContratIntegration',
        resume: 'Obtenir le contrat d’intégration du catalogue',
        detail:
          'Ce que la plateforme garantit pour toute solution intégrée — provisioning, SSO, ' +
          'sauvegarde, supervision, réversibilité — et l’écran qui le porte.',
        portee: 'public',
        ok: ref('ContratIntegration'),
      }),
    },
    '/services': {
      get: op({
        tag: T_SERVICES,
        id: 'listerServicesManages',
        resume: 'Lister les services managés souscrits',
        paginee: true,
        params: [
          filtre('catalogSlug', chaine()),
          filtre('mode', liste(['dedie', 'mutualise'])),
          filtre('site', liste(SITES)),
          filtre('statut', chaine()),
        ],
        ok: page(ref('ServiceManage')),
      }),
      post: op({
        tag: T_SERVICES,
        id: 'souscrireService',
        resume: 'Souscrire un service managé',
        corps: ref('SouscriptionService'),
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
        erreurs: [409, 402, 404],
      }),
    },
    '/services/{serviceManageId}': {
      get: op({
        tag: T_SERVICES,
        id: 'obtenirServiceManage',
        resume: 'Obtenir un service managé',
        params: [idService],
        ok: ref('ServiceManage'),
      }),
      patch: op({
        tag: T_SERVICES,
        id: 'modifierServiceManage',
        resume: 'Modifier un service managé',
        detail: 'Palier, nombre de sièges, domaine, plan de sauvegarde.',
        params: [idService],
        corps: objet({
          nom: chaine(),
          palier: chaine(),
          siegesSouscrits: entier(),
          domaine: chaine(),
          backupPlanId: chaine(),
        }),
        ok: ref('ServiceManage'),
        rbac: 'service.admin',
        erreurs: [402],
      }),
      delete: op({
        tag: T_SERVICES,
        id: 'resilierServiceManage',
        resume: 'Résilier un service managé',
        detail:
          'Un export au format annoncé dans la fiche de réversibilité est produit avant ' +
          'destruction ; le délai de conservation figure dans la réponse.',
        params: [idService],
        destructif: true,
        ok: ref('TravailProvisioning'),
        code: 202,
        rbac: 'marketplace.subscribe',
      }),
    },
    '/services/{serviceManageId}/configuration': {
      get: op({
        tag: T_SERVICES,
        id: 'obtenirConfigurationService',
        resume: 'Obtenir la configuration courante d’un service',
        detail: 'Le schéma est renvoyé avec les valeurs appliquées et les champs verrouillés par le palier.',
        params: [idService],
        ok: ref('ConfigurationService'),
        rbac: 'service.admin',
      }),
      put: op({
        tag: T_SERVICES,
        id: 'modifierConfigurationService',
        resume: 'Modifier la configuration d’un service',
        detail:
          'Des politiques, jamais du contenu. La réponse indique ce qui prend effet ' +
          'immédiatement et ce qui attend un redémarrage ou une fenêtre de maintenance.',
        params: [idService],
        corps: ref('MiseAJourConfiguration'),
        ok: objet(
          {
            configuration: ref('ConfigurationService'),
            effets: tableau(
              objet(
                {
                  cle: chaine(),
                  effet: liste(['immediat', 'redemarrage', 'prochaine_connexion', 'fenetre_maintenance']),
                },
                ['cle', 'effet'],
              ),
            ),
            travailId: chaine(),
          },
          ['configuration', 'effets'],
        ),
        rbac: 'service.admin',
        erreurs: [409],
      }),
    },
    '/services/{serviceManageId}/sieges': {
      get: op({
        tag: T_SERVICES,
        id: 'listerSieges',
        resume: 'Lister les sièges d’un service',
        paginee: true,
        params: [idService, filtre('statut', liste(['actif', 'suspendu']))],
        ok: page(ref('Siege')),
      }),
      post: op({
        tag: T_SERVICES,
        id: 'attribuerSiege',
        resume: 'Attribuer un siège',
        params: [idService],
        corps: ref('SiegeAttribution'),
        ok: ref('Siege'),
        code: 201,
        rbac: 'seat.assign',
        erreurs: [409, 402],
      }),
    },
    '/services/{serviceManageId}/sieges/{siegeId}': {
      patch: op({
        tag: T_SERVICES,
        id: 'modifierSiege',
        resume: 'Modifier un siège',
        params: [idService, chemin('siegeId', 'Identifiant du siège.')],
        corps: objet({ statut: liste(['actif', 'suspendu']), quotaTotal: nombre(), roleApp: chaine() }),
        ok: ref('Siege'),
        rbac: 'seat.assign',
      }),
      delete: op({
        tag: T_SERVICES,
        id: 'retirerSiege',
        resume: 'Retirer un siège',
        detail: 'L’accès cesse à la prochaine connexion ; les données de l’utilisateur suivent la politique du service.',
        params: [idService, chemin('siegeId', 'Identifiant du siège.')],
        code: 204,
        rbac: 'seat.assign',
      }),
    },
    '/services/{serviceManageId}/sso': {
      put: op({
        tag: T_SERVICES,
        id: 'modifierSsoService',
        resume: 'Configurer le SSO d’un service',
        params: [idService],
        corps: objet(
          {
            actif: booleen(),
            groupMappings: tableau(objet({ groupe: chaine(), roleApp: chaine() }, ['groupe', 'roleApp'])),
          },
          ['actif'],
        ),
        ok: ref('ServiceManage'),
        rbac: 'sso.configure',
      }),
    },
    '/services/{serviceManageId}/versions': {
      get: op({
        tag: T_SERVICES,
        id: 'listerVersionsService',
        resume: 'Lister les versions d’un service managé',
        detail:
          'Version installée, versions disponibles, notes, ruptures de compatibilité et durée ' +
          'd’indisponibilité annoncée. Jamais de « latest ».',
        params: [idService],
        ok: tableau(ref('VersionService')),
      }),
    },
    '/services/{serviceManageId}/exports': {
      get: op({
        tag: T_SERVICES,
        id: 'listerExportsService',
        resume: 'Lister les exports de réversibilité',
        detail: 'Ce qui a été sorti, quand, et jusqu’à quand c’est récupérable.',
        params: [idService],
        ok: tableau(ref('ExportService')),
        rbac: 'service.admin',
      }),
    },
    '/services/{serviceManageId}/metriques': {
      get: op({
        tag: T_SERVICES,
        id: 'obtenirMetriquesService',
        resume: 'Obtenir les séries d’un service managé',
        params: [idService, { $ref: '#/components/parameters/Fenetre' }],
        ok: objet({ tuiles: tableau(ref('Tuile')), series: tableau(ref('Serie')), liens: ref('LiensSortie') }, ['series']),
        erreurs: [424],
      }),
    },
  },
  action({
    tag: T_SERVICES,
    chemin: '/services/{serviceManageId}/ouverture',
    id: 'ouvrirServiceManage',
    resume: 'Ouvrir un service managé',
    detail:
      'Rebond SSO vers l’interface d’origine de la solution. Le portail ouvre la porte, ' +
      'il ne réimplémente pas l’écran principal du produit.',
    params: [idService],
    ok: ref('OuvertureService'),
    code: 201,
    rbac: 'service.open',
  }),
  action({
    tag: T_SERVICES,
    chemin: '/services/{serviceManageId}/mise-a-jour',
    id: 'mettreAJourServiceManage',
    resume: 'Appliquer la version disponible',
    params: [idService],
    corps: objet({ version: chaine(), fenetre: horodatage() }),
    rbac: 'service.admin',
    erreurs: [409],
  }),
  action({
    tag: T_SERVICES,
    chemin: '/services/{serviceManageId}/versions/rollback',
    id: 'revenirVersionService',
    resume: 'Revenir à la version précédente d’un service',
    detail:
      'Possible seulement quand la version installée l’annonce (`rollbackPossible`) : une migration ' +
      'de schéma ne se défait pas, et le contrat le dit plutôt que de le laisser découvrir.',
    params: [idService],
    corps: objet({ version: chaine(), confirmation: chaine() }, ['confirmation']),
    corpsRequis: true,
    rbac: 'service.admin',
    erreurs: [409],
  }),
  action({
    tag: T_SERVICES,
    chemin: '/services/{serviceManageId}/export',
    id: 'exporterServiceManage',
    resume: 'Exporter les données d’un service',
    detail: 'Réversibilité : formats et délai annoncés dans la fiche catalogue.',
    params: [idService],
    corps: objet({ format: chaine(), perimetre: tableau(chaine()) }),
    rbac: 'service.admin',
  }),
)

// ─── Facturation ──────────────────────────────────────────────────────

const facturation = fusion(
  {
    '/facturation/factures': {
      get: op({
        tag: T_FACTURATION,
        id: 'listerFactures',
        resume: 'Lister les factures',
        paginee: true,
        params: [
          filtre('statut', liste(['brouillon', 'emise', 'payee', 'impayee', 'annulee'])),
          filtre('periode', chaine(), 'Mois au format `2026-08`.'),
          filtre('devise', liste(DEVISES)),
        ],
        ok: page(ref('Facture')),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/factures/{factureId}': {
      get: op({
        tag: T_FACTURATION,
        id: 'obtenirFacture',
        resume: 'Obtenir une facture',
        params: [chemin('factureId', 'Identifiant ou numéro de facture.')],
        ok: ref('Facture'),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/factures/{factureId}/pdf': {
      get: op({
        tag: T_FACTURATION,
        id: 'obtenirPdfFacture',
        resume: 'Obtenir le PDF d’une facture',
        detail: 'Renvoie une URL signée à durée de vie courte plutôt que le binaire.',
        params: [chemin('factureId', 'Identifiant ou numéro de facture.')],
        ok: objet({ url: chaine(), expire: horodatage(), tailleOctets: entier() }, ['url', 'expire']),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/consommation': {
      get: op({
        tag: T_FACTURATION,
        id: 'obtenirConsommation',
        resume: 'Obtenir la consommation détaillée',
        params: [filtre('periode', chaine(), 'Mois au format `2026-08`.')],
        ok: ref('Consommation'),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/ventilation': {
      get: op({
        tag: T_FACTURATION,
        id: 'obtenirVentilation',
        resume: 'Ventiler la dépense selon un axe',
        detail: 'Par famille, par Espace Cloud, par application ou par projet — le showback interne.',
        params: [
          filtre('axe', liste(['famille', 'espace', 'application', 'projet', 'site'])),
          filtre('periode', chaine()),
        ],
        ok: ref('Ventilation'),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/souscriptions': {
      get: op({
        tag: T_FACTURATION,
        id: 'listerSouscriptions',
        resume: 'Lister les souscriptions',
        paginee: true,
        params: [filtre('actives', booleen())],
        ok: page(ref('Souscription')),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/souscriptions/{souscriptionId}': {
      patch: op({
        tag: T_FACTURATION,
        id: 'modifierSouscription',
        resume: 'Modifier une souscription',
        detail: 'Quantité ou périodicité. Le passage à l’annuel s’applique au prochain terme.',
        params: [chemin('souscriptionId', 'Identifiant de la souscription.')],
        corps: objet({ quantite: entier(), periodicite: liste(['mensuelle', 'annuelle']) }),
        ok: ref('Souscription'),
        rbac: 'payment.update',
        erreurs: [409, 402],
      }),
      delete: op({
        tag: T_FACTURATION,
        id: 'resilierSouscription',
        resume: 'Résilier une souscription',
        detail:
          'La ressource souscrite continue de tourner jusqu’au terme, puis est arrêtée : ' +
          'la réponse donne la date et ce qui sera détruit.',
        params: [chemin('souscriptionId', 'Identifiant de la souscription.')],
        destructif: true,
        ok: objet(
          { souscription: ref('Souscription'), finEffet: chaine(), ressourcesConcernees: tableau(chaine()) },
          ['souscription', 'finEffet'],
        ),
        code: 200,
        rbac: 'payment.update',
        erreurs: [409],
      }),
    },
    '/facturation/devis': {
      get: op({
        tag: T_FACTURATION,
        id: 'listerDevis',
        resume: 'Lister les devis',
        paginee: true,
        params: [filtre('statut', liste(['envoye', 'accepte', 'refuse', 'expire']))],
        ok: page(ref('Devis')),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/moyens-paiement': {
      get: op({
        tag: T_FACTURATION,
        id: 'listerMoyensPaiement',
        resume: 'Lister les moyens de paiement',
        detail: 'Carte, virement, Orange Money, MTN MoMo, Wave, porte-monnaie prépayé.',
        ok: tableau(ref('MoyenPaiement')),
        rbac: 'payment.update',
      }),
      post: op({
        tag: T_FACTURATION,
        id: 'ajouterMoyenPaiement',
        resume: 'Ajouter un moyen de paiement',
        corps: ref('MoyenPaiementCreation'),
        ok: ref('MoyenPaiement'),
        code: 201,
        rbac: 'payment.update',
        erreurs: [424],
      }),
    },
    '/facturation/moyens-paiement/{moyenId}': {
      patch: op({
        tag: T_FACTURATION,
        id: 'modifierMoyenPaiement',
        resume: 'Modifier un moyen de paiement',
        params: [chemin('moyenId', 'Identifiant du moyen de paiement.')],
        corps: objet({ defaut: booleen(), libelle: chaine() }),
        ok: ref('MoyenPaiement'),
        rbac: 'payment.update',
      }),
      delete: op({
        tag: T_FACTURATION,
        id: 'supprimerMoyenPaiement',
        resume: 'Supprimer un moyen de paiement',
        detail: 'Refusé quand c’est le seul moyen actif et que des souscriptions courent.',
        params: [chemin('moyenId', 'Identifiant du moyen de paiement.')],
        code: 204,
        rbac: 'payment.update',
        erreurs: [409],
      }),
    },
    '/facturation/sla': {
      get: op({
        tag: T_FACTURATION,
        id: 'obtenirSla',
        resume: 'Obtenir les engagements et les crédits SLA',
        detail: 'Disponibilité engagée, constatée, et crédits appliqués — sans avoir à les réclamer.',
        ok: objet(
          { engagements: tableau(ref('EngagementSla')), credits: tableau(ref('CreditSla')) },
          ['engagements', 'credits'],
        ),
        rbac: 'invoice.view',
      }),
    },
    '/facturation/estimation': {
      post: op({
        tag: T_FACTURATION,
        id: 'estimerCout',
        resume: 'Estimer le coût d’une action facturable',
        detail: 'Appelé avant toute création : l’aperçu de coût précède l’engagement.',
        corps: ref('DemandeEstimation'),
        ok: ref('EstimationCout'),
      }),
    },
  },
  action({
    tag: T_FACTURATION,
    chemin: '/facturation/factures/{factureId}/paiement',
    id: 'payerFacture',
    resume: 'Payer une facture',
    params: [chemin('factureId', 'Identifiant ou numéro de facture.')],
    corps: objet({ moyenId: chaine() }, ['moyenId']),
    corpsRequis: true,
    ok: objet(
      {
        facture: ref('Facture'),
        urlRedirection: chaine('Page de paiement du prestataire, quand le moyen l’exige.'),
        statut: liste(['payee', 'en_attente', 'echec']),
      },
      ['facture', 'statut'],
    ),
    code: 200,
    rbac: 'payment.update',
    erreurs: [409, 424],
  }),
  action({
    tag: T_FACTURATION,
    chemin: '/facturation/prepaye/rechargement',
    id: 'rechargerPrepaye',
    resume: 'Recharger le porte-monnaie prépayé',
    corps: ref('Rechargement'),
    corpsRequis: true,
    ok: objet(
      { solde: entier(), urlRedirection: chaine(), statut: liste(['credite', 'en_attente', 'echec']) },
      ['statut'],
    ),
    code: 200,
    rbac: 'payment.update',
    erreurs: [424],
  }),
  action({
    tag: T_FACTURATION,
    chemin: '/facturation/consommation/export',
    id: 'exporterConsommation',
    resume: 'Exporter la consommation détaillée',
    detail: 'Pour la refacturation interne : une ligne par jour et par imputation.',
    corps: objet(
      { periode: chaine(), format: liste(['csv', 'xlsx', 'json']), axe: liste(['famille', 'espace', 'application', 'projet', 'site']) },
      ['periode', 'format'],
    ),
    corpsRequis: true,
    ok: objet({ url: chaine(), expire: horodatage() }, []),
    code: 202,
    rbac: 'invoice.view',
  }),
  action({
    tag: T_FACTURATION,
    chemin: '/facturation/sla/reclamations',
    id: 'reclamerCreditSla',
    resume: 'Réclamer un crédit SLA',
    detail:
      'Les crédits constatés sont appliqués sans demande. Cette réclamation sert au cas où le ' +
      'client mesure une indisponibilité que la plateforme n’a pas vue.',
    corps: ref('ReclamationCredit'),
    corpsRequis: true,
    ok: ref('AccuseReception'),
    code: 201,
    rbac: 'invoice.view',
  }),
  action({
    tag: T_FACTURATION,
    chemin: '/facturation/devis/{devisId}/acceptation',
    id: 'accepterDevis',
    resume: 'Accepter un devis',
    params: [chemin('devisId', 'Identifiant ou numéro de devis.')],
    ok: ref('Devis'),
    code: 200,
    rbac: 'payment.update',
    erreurs: [409],
  }),
)

// ─── Support ──────────────────────────────────────────────────────────

const support = fusion(
  {
    '/support/tickets': {
      get: op({
        tag: T_SUPPORT,
        id: 'listerTickets',
        resume: 'Lister les tickets',
        paginee: true,
        params: [
          filtre('statut', liste(['ouvert', 'en_cours', 'attente_client', 'resolu', 'ferme'])),
          filtre('gravite', liste(['critique', 'majeure', 'mineure', 'question'])),
          filtre('ressourceId', chaine()),
        ],
        ok: page(ref('Ticket')),
      }),
      post: op({
        tag: T_SUPPORT,
        id: 'creerTicket',
        resume: 'Ouvrir un ticket',
        detail: 'Les ressources liées permettent au support de voir l’état sans le demander.',
        corps: ref('TicketCreation'),
        ok: ref('Ticket'),
        code: 201,
      }),
    },
    '/support/tickets/{ticketId}': {
      get: op({
        tag: T_SUPPORT,
        id: 'obtenirTicket',
        resume: 'Obtenir un ticket',
        params: [chemin('ticketId', 'Identifiant ou numéro du ticket.', 'tck-4471')],
        ok: ref('Ticket'),
      }),
      patch: op({
        tag: T_SUPPORT,
        id: 'modifierTicket',
        resume: 'Modifier un ticket',
        params: [chemin('ticketId', 'Identifiant ou numéro du ticket.', 'tck-4471')],
        corps: objet({
          gravite: liste(['critique', 'majeure', 'mineure', 'question']),
          statut: liste(['ouvert', 'attente_client', 'resolu', 'ferme']),
          ressourcesLiees: tableau(chaine()),
        }),
        ok: ref('Ticket'),
      }),
    },
    '/support/tickets/{ticketId}/messages': {
      post: op({
        tag: T_SUPPORT,
        id: 'repondreTicket',
        resume: 'Répondre à un ticket',
        params: [chemin('ticketId', 'Identifiant ou numéro du ticket.', 'tck-4471')],
        corps: ref('MessageTicket'),
        ok: ref('Ticket'),
        code: 201,
      }),
    },
    '/support/pieces': {
      post: op({
        tag: T_SUPPORT,
        id: 'televerserPieceJointe',
        resume: 'Téléverser une pièce jointe',
        detail: 'Renvoie un identifiant à citer dans un ticket ou un message.',
        corps: objet(
          { nom: chaine(), typeMime: chaine(), tailleOctets: entier(), contenuBase64: chaine() },
          ['nom', 'typeMime', 'tailleOctets', 'contenuBase64'],
        ),
        ok: objet({ id: chaine(), nom: chaine(), url: chaine(), expire: horodatage() }, ['id', 'nom']),
        code: 201,
      }),
    },
    '/support/base-connaissances': {
      get: op({
        tag: T_SUPPORT,
        id: 'listerArticlesKb',
        resume: 'Rechercher dans la base de connaissances',
        portee: 'public',
        paginee: true,
        params: [filtre('categorie', chaine())],
        ok: page(ref('ArticleKb')),
      }),
    },
    '/support/base-connaissances/{articleId}': {
      get: op({
        tag: T_SUPPORT,
        id: 'obtenirArticleKb',
        resume: 'Obtenir un article',
        portee: 'public',
        params: [chemin('articleId', 'Identifiant de l’article.')],
        ok: ref('ArticleKb'),
      }),
    },
  },
  action({
    tag: T_SUPPORT,
    chemin: '/support/tickets/{ticketId}/escalade',
    id: 'escaladerTicket',
    resume: 'Demander une escalade',
    detail: 'Réservé aux gravités critique et majeure ; la réponse rappelle le SLA restant.',
    params: [chemin('ticketId', 'Identifiant ou numéro du ticket.', 'tck-4471')],
    corps: objet({ motif: chaine() }, ['motif']),
    corpsRequis: true,
    ok: ref('Ticket'),
    code: 200,
    erreurs: [409],
  }),
)

// ─── Documentation et formation ───────────────────────────────────────

const docs = fusion(
  {
    '/docs/sections': {
      get: op({
        tag: T_DOCS,
        id: 'listerSectionsDocumentation',
        resume: 'Lister les sections de documentation',
        portee: 'public',
        ok: tableau(
          objet({ titre: chaine(), articles: tableau(chaine()) }, ['titre', 'articles']),
        ),
      }),
    },
    '/docs/parcours': {
      get: op({
        tag: T_DOCS,
        id: 'listerParcoursFormation',
        resume: 'Lister les parcours de formation',
        detail: 'Filtrés par rôle : un Billing Manager et un Operator n’ont pas le même parcours.',
        params: [filtre('niveau', liste(['debutant', 'intermediaire', 'avance'])), filtre('role', chaine())],
        ok: tableau(ref('ParcoursFormation')),
      }),
    },
    '/docs/parcours/{parcoursSlug}': {
      get: op({
        tag: T_DOCS,
        id: 'obtenirParcoursFormation',
        resume: 'Obtenir un parcours de formation',
        params: [chemin('parcoursSlug', 'Slug du parcours.')],
        ok: objet(
          { parcours: ref('ParcoursFormation'), progression: ref('ProgressionFormation') },
          ['parcours'],
        ),
      }),
    },
    '/docs/progression': {
      get: op({
        tag: T_DOCS,
        id: 'listerMaProgression',
        resume: 'Obtenir sa progression de formation',
        ok: tableau(ref('ProgressionFormation')),
      }),
    },
    '/docs/bac-a-sable': {
      get: op({
        tag: T_DOCS,
        id: 'obtenirBacASable',
        resume: 'Obtenir son bac à sable',
        detail: 'Environnement d’entraînement jetable, sans facturation.',
        ok: ref('BacASable'),
      }),
      post: op({
        tag: T_DOCS,
        id: 'creerBacASable',
        resume: 'Créer ou réinitialiser son bac à sable',
        corps: objet({ dureeHeures: entier(), parcoursSlug: chaine() }),
        corpsRequis: false,
        ok: ref('TravailProvisioning'),
        code: 202,
        erreurs: [409],
      }),
      delete: op({
        tag: T_DOCS,
        id: 'supprimerBacASable',
        resume: 'Détruire son bac à sable',
        code: 204,
      }),
    },
  },
  action({
    tag: T_DOCS,
    chemin: '/docs/parcours/{parcoursSlug}/modules/{moduleSlug}/completion',
    id: 'validerModuleFormation',
    resume: 'Marquer un module comme terminé',
    params: [chemin('parcoursSlug', 'Slug du parcours.'), chemin('moduleSlug', 'Slug du module.')],
    corps: objet({ score: entier('Score du quiz, quand le module en comporte un.') }),
    ok: ref('ProgressionFormation'),
    code: 200,
  }),
)

export const cheminsServices = fusion(servicesManages, facturation, support, docs)
