/**
 * Chemins publics — vitrine. Aucun jeton n'est requis ; ce sont les seules
 * routes que le site public appelle.
 */

import {
  SITES,
  booleen,
  chaine,
  chemin,
  entier,
  filtre,
  fusion,
  liste,
  nombre,
  objet,
  op,
  page,
  pourcentage,
  ref,
  tableau,
} from './socle.mjs'

const T = 'Vitrine publique'
const P = 'public'

const offres = {
  '/public/offres': {
    get: op({
      tag: T,
      portee: P,
      id: 'listerOffresPubliques',
      resume: 'Lister les offres publiées',
      paginee: true,
      params: [filtre('categorie', chaine()), filtre('populaire', booleen())],
      ok: page(ref('Offre')),
    }),
  },
  '/public/offres/{slug}': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirFicheProduit',
      resume: 'Obtenir une fiche produit',
      detail: 'La fiche dit ce que l’offre fait **et ce qu’elle ne fait pas**.',
      params: [chemin('slug', 'Slug de la fiche produit.', 'machines-virtuelles')],
      ok: ref('FicheProduit'),
    }),
  },
  '/public/catalogue/services': {
    get: op({
      tag: T,
      portee: P,
      id: 'listerCataloguePublic',
      resume: 'Lister le catalogue public des services managés',
      paginee: true,
      params: [filtre('categorie', chaine()), filtre('mode', liste(['dedie', 'mutualise']))],
      ok: page(ref('FicheCatalogue')),
    }),
  },
  '/public/catalogue/services/{slug}': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirFicheCataloguePublique',
      resume: 'Obtenir une fiche publique de service managé',
      params: [chemin('slug', 'Slug du service.', 'drive-pro')],
      ok: ref('FicheCatalogue'),
    }),
  },
  '/public/tarifs': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirTarifs',
      resume: 'Obtenir la grille tarifaire publique',
      detail: 'Montants en FCFA. Les familles servent la page de tarifs, les prix unitaires le simulateur.',
      ok: objet(
        {
          familles: tableau(
            objet(
              {
                code: chaine(),
                nom: chaine(),
                description: chaine(),
                offres: tableau(ref('Offre')),
              },
              ['code', 'nom', 'offres'],
            ),
          ),
          tarifsUnitaires: ref('TarifsUnitaires'),
          hypotheses: tableau(chaine(), 'Ce que la grille suppose, dit explicitement.'),
        },
        ['familles', 'tarifsUnitaires'],
      ),
    }),
  },
  '/public/simulateur': {
    post: op({
      tag: T,
      portee: P,
      id: 'simulerCout',
      resume: 'Simuler le coût d’une configuration',
      detail:
        'Même moteur que l’aperçu de coût de l’espace client, sans authentification. ' +
        'Les hypothèses retenues sont renvoyées avec le résultat.',
      corps: objet(
        {
          site: liste(SITES),
          vcpu: entier(),
          ramGo: entier(),
          stockageGo: entier(),
          classeStockage: liste(['nvme', 'ssd', 'hdd', 'archive']),
          ipsPubliques: entier(),
          antiDdos: booleen(),
          sauvegardeGo: entier(),
          egressGo: entier(),
          servicesManages: tableau(
            objet({ slug: chaine(), palier: chaine(), sieges: entier() }, ['slug', 'palier']),
          ),
          hebergementWeb: objet({ palier: chaine(), quantite: entier() }),
          engagement: liste(['aucun', '12_mois', '36_mois']),
          devise: liste(['XOF', 'EUR', 'USD']),
        },
        [],
      ),
      ok: ref('EstimationCout'),
    }),
  },
}

const confiance = {
  '/public/statut': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirStatutPublic',
      resume: 'Obtenir l’état des services',
      detail: 'Par service et par site, avec la disponibilité constatée sur 90 jours.',
      ok: objet(
        {
          services: tableau(ref('StatutService')),
          incidents: tableau(ref('Incident')),
          disponibiliteGlobale90j: nombre(),
          derniereMaj: chaine(),
        },
        ['services', 'incidents'],
      ),
    }),
  },
  '/public/statut/incidents/{incidentId}': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirIncidentPublic',
      resume: 'Obtenir un incident et son historique',
      params: [chemin('incidentId', 'Identifiant de l’incident.')],
      ok: ref('Incident'),
    }),
  },
  '/public/datacenters': {
    get: op({
      tag: T,
      portee: P,
      id: 'listerDatacenters',
      resume: 'Lister les sites d’hébergement',
      ok: tableau(ref('Datacenter')),
    }),
  },
  '/public/souverainete': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirSouverainete',
      resume: 'Obtenir la trajectoire de souveraineté',
      detail:
        'Publie la sortie datée des socles propriétaires. Assumer la transition plutôt que la cacher.',
      ok: ref('Souverainete'),
    }),
  },
  '/public/etudes-cas': {
    get: op({
      tag: T,
      portee: P,
      id: 'listerEtudesCas',
      resume: 'Lister les études de cas',
      paginee: true,
      params: [filtre('secteur', chaine())],
      ok: page(ref('EtudeCas')),
    }),
  },
  '/public/sla': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirSlaPublic',
      resume: 'Obtenir les engagements de service publiés',
      ok: tableau(ref('EngagementSla')),
    }),
  },
}

const contenus = {
  '/public/pages-legales': {
    get: op({
      tag: T,
      portee: P,
      id: 'listerPagesLegales',
      resume: 'Lister les pages légales',
      ok: tableau(
        objet({ slug: chaine(), titre: chaine(), miseAJour: chaine() }, ['slug', 'titre', 'miseAJour']),
      ),
    }),
  },
  '/public/pages-legales/{slug}': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirPageLegale',
      resume: 'Obtenir une page légale',
      detail: 'Mentions légales, conditions, politique de confidentialité, sous-traitance.',
      params: [chemin('slug', 'Slug de la page.', 'mentions-legales')],
      ok: ref('PageLegale'),
    }),
  },
}

const demandes = {
  '/public/contact': {
    post: op({
      tag: T,
      portee: P,
      id: 'envoyerDemandeContact',
      resume: 'Envoyer une demande de contact',
      corps: ref('DemandeContact'),
      ok: ref('AccuseReception'),
      code: 201,
    }),
  },
  '/public/devis': {
    post: op({
      tag: T,
      portee: P,
      id: 'envoyerDemandeDevis',
      resume: 'Demander un devis',
      detail: 'Une configuration simulée peut être joignée : le commercial part de chiffres, pas d’un intitulé.',
      corps: ref('DemandeDevis'),
      ok: ref('AccuseReception'),
      code: 201,
    }),
  },
  '/public/disponibilite-domaine': {
    get: op({
      tag: T,
      portee: P,
      id: 'verifierDisponibiliteDomainePublique',
      resume: 'Vérifier la disponibilité d’un domaine avant inscription',
      params: [filtre('nom', chaine(), 'Nom complet avec son extension.', true)],
      ok: ref('DisponibiliteDomaine'),
      erreurs: [424],
    }),
  },
  '/public/couverture': {
    get: op({
      tag: T,
      portee: P,
      id: 'obtenirCouverture',
      resume: 'Obtenir la couverture et les latences depuis une ville',
      detail: 'Sert la promesse de proximité : un client d’Abidjan mérite un chiffre, pas une carte.',
      params: [filtre('ville', chaine())],
      ok: tableau(
        objet(
          { site: liste(SITES), ville: chaine(), latenceMs: nombre(), fiabilitePct: pourcentage() },
          ['site', 'latenceMs'],
        ),
      ),
    }),
  },
}

export const cheminsPublic = fusion(offres, confiance, contenus, demandes)
