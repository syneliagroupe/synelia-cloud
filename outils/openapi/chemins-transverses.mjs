/**
 * Chemins — capacités transverses : recherche globale, copilote, onboarding,
 * anomalies, attestations. Reprises du contrat rédigé sur `main`, parce que les
 * écrans correspondants existent déjà dans la maquette.
 */

import {
  action,
  booleen,
  chaine,
  chemin,
  entier,
  filtre,
  fusion,
  liste,
  objet,
  op,
  page,
  ref,
  tableau,
} from './socle.mjs'

const T_BORD = 'Tableau de bord'
const T_AUDIT = 'Audit'

export const cheminsTransverses = fusion(
  {
    '/recherche': {
      get: op({
        tag: T_BORD,
        id: 'rechercher',
        resume: 'Rechercher dans toutes les ressources de l’organisation',
        detail:
          'Alimente la recherche de la barre supérieure. Les résultats portent leur route : ' +
          'le client navigue sans avoir à deviner l’écran qui affiche la ressource.',
        params: [
          filtre('q', chaine(), 'Terme recherché.', true),
          filtre('types', chaine(), 'Types à considérer, séparés par des virgules.'),
          filtre('limite', entier(undefined, { maximum: 50, default: 10 })),
        ],
        ok: objet(
          { resultats: tableau(ref('ResultatRecherche')), tronque: booleen() },
          ['resultats'],
        ),
      }),
    },
    '/copilote/suggestions': {
      get: op({
        tag: T_BORD,
        id: 'listerSuggestionsCopilote',
        resume: 'Lister les questions suggérées',
        detail: 'Dépendent de l’écran courant et du rôle : on ne suggère pas ce que le rôle ne peut pas faire.',
        params: [filtre('route', chaine(), 'Route de l’interface où le copilote est ouvert.')],
        ok: tableau(chaine()),
      }),
    },
    '/copilote': {
      post: op({
        tag: T_BORD,
        id: 'interrogerCopilote',
        resume: 'Poser une question au copilote',
        detail:
          'Répond sur le portail et sur les offres. Quand la question porte sur l’intérieur d’un ' +
          'produit amont, la réponse le dit (`horsPerimetre`) et renvoie vers la solution.',
        corps: ref('QuestionCopilote'),
        ok: ref('ReponseCopilote'),
      }),
    },
    '/onboarding': {
      get: op({
        tag: T_BORD,
        id: 'obtenirOnboarding',
        resume: 'Obtenir le guide de démarrage',
        ok: ref('Onboarding'),
      }),
      patch: op({
        tag: T_BORD,
        id: 'modifierOnboarding',
        resume: 'Marquer une étape faite ou masquer le guide',
        corps: objet({ etape: chaine(), faite: booleen(), masque: booleen() }),
        ok: ref('Onboarding'),
      }),
    },
    '/anomalies': {
      get: op({
        tag: T_BORD,
        id: 'listerAnomalies',
        resume: 'Lister les anomalies détectées',
        detail:
          'Chaque ligne dit ce qui a été constaté, ce que cela produit, et le correctif quand il ' +
          'est automatisable. Une ressource sans sauvegarde est une anomalie, pas un réglage par défaut.',
        paginee: true,
        params: [
          filtre('gravite', liste(['critique', 'majeure', 'mineure'])),
          filtre('statut', liste(['ouverte', 'en_cours', 'corrigee', 'ignoree'])),
          filtre('portee', chaine(), 'Identifiant de ressource, projet ou espace.'),
        ],
        ok: page(ref('Anomalie')),
      }),
    },
    '/attestations': {
      get: op({
        tag: T_AUDIT,
        id: 'listerAttestations',
        resume: 'Lister les attestations disponibles',
        detail:
          'Documents à présenter à un tiers. Une attestation indisponible dit ce qui manque pour ' +
          'pouvoir l’émettre, plutôt que de disparaître de la liste.',
        params: [filtre('type', chaine()), filtre('periode', chaine())],
        ok: tableau(ref('Attestation')),
        rbac: 'compliance.export',
      }),
    },
  },
  action({
    tag: T_BORD,
    chemin: '/anomalies/{anomalieId}/correctif',
    id: 'traiterAnomalie',
    resume: 'Appliquer ou écarter le correctif d’une anomalie',
    params: [chemin('anomalieId', 'Identifiant de l’anomalie.')],
    corps: ref('DecisionAnomalie'),
    corpsRequis: true,
    erreurs: [409],
  }),
  action({
    tag: T_AUDIT,
    chemin: '/attestations/{attestationId}',
    id: 'genererAttestation',
    resume: 'Générer une attestation',
    params: [chemin('attestationId', 'Identifiant du modèle d’attestation.')],
    corps: objet({ periode: chaine(), destinataire: chaine() }),
    ok: ref('Attestation'),
    code: 202,
    rbac: 'compliance.export',
    erreurs: [409],
  }),
  {
    '/referentiels': {
      get: op({
        tag: T_BORD,
        id: 'obtenirReferentiels',
        resume: 'Obtenir les listes de référence',
        detail: 'Pays, secteurs, tailles d’organisation, sites, devises, rôles, moyens de paiement.',
        portee: 'public',
        ok: ref('Referentiels'),
      }),
    },
  },
)
