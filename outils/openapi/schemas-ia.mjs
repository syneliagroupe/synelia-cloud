/**
 * Schémas — univers « IA & Agents » (MVP passerelle LiteLLM/OpenRouter, puis
 * exécution réelle de flux d'orchestration, puis bases de connaissances et
 * clés d'accès IA réelles).
 *
 * Le catalogue de modèles, les agents (CRUD + invocation), les flux
 * d'orchestration (CRUD + exécution + reprise humaine), les bases de
 * connaissances (CRUD + ingestion + recherche réelle Docling/BGE-M3/Qdrant) et
 * les clés d'accès IA (CRUD + application réelle des quotas) sont couverts.
 * Outils, canaux, règles de routage et garde-fous restent hors de cette passe.
 */

import { booleen, chaine, dictionnaire, entier, horodatage, liste, montant, nombre, objet, ref, tableau } from './socle.mjs'

const FAMILLES_MODELE = ['texte', 'code', 'embedding', 'reranker', 'transcription', 'vision']
const HEBERGEMENTS_MODELE = ['souverain', 'externe']
const STATUTS_MODELE = ['disponible', 'apercu', 'degrade', 'retire']
const STATUTS_AGENT = ['brouillon', 'publie', 'suspendu']

// ─── Bases de connaissances (Docling + BGE-M3 + Qdrant réels) ─────────
const SOURCES_CONNAISSANCE = ['s3', 'drive', 'web', 'git']
const MODES_DECOUPAGE = ['general', 'parent_enfant', 'qr']
const METHODES_INDEX = ['haute_qualite', 'economique']
const MODES_RECHERCHE = ['vectorielle', 'plein_texte', 'hybride']
const FREQUENCES_CONNAISSANCE = ['manuelle', 'quotidienne', 'horaire']
const STATUTS_CONNAISSANCE = ['a_jour', 'indexation', 'erreur', 'jamais_indexee']

// ─── Clés d'accès IA (quotas, débit, budget réellement appliqués) ─────
const CLASSES_DONNEES = ['publique', 'interne', 'personnelle', 'reglementee']
const DEPASSEMENTS_CLE = ['bloquer', 'alerter']
const STATUTS_CLE_IA = ['active', 'suspendue', 'revoquee']

// ─── Flux d'orchestration (FONC-02) ────────────────────────────────────
const TYPES_ETAPE = [
  'declencheur',
  'agent',
  'outil',
  'connaissance',
  'routeur',
  'boucle',
  'humain',
  'code',
  'reponse',
  'anonymisation',
  'habilitation',
  'transfert',
]
const STATUTS_FLUX = ['publie', 'brouillon', 'suspendu']
const TYPES_DECLENCHEUR_FLUX = ['message', 'planifie', 'webhook', 'fichier', 'evenement']
const MODES_ROUTAGE = ['premiere', 'toutes']
const PORTEES_VARIABLE = ['environnement', 'conversation', 'systeme']

const declencheurFlux = () =>
  objet(
    { type: liste(TYPES_DECLENCHEUR_FLUX), libelle: chaine(), detail: chaine() },
    ['type', 'libelle', 'detail'],
  )

const ia = {
  ModeleIA: objet(
    {
      id: chaine(),
      slug: chaine('Identifiant appelé côté passerelle — le vrai modèle OpenRouter pour les modèles invocables.'),
      nom: chaine(),
      editeur: chaine(),
      famille: liste(FAMILLES_MODELE),
      hebergement: liste(HEBERGEMENTS_MODELE),
      residence: chaine(),
      site: chaine(),
      parametres: chaine(),
      licence: chaine(),
      contexteJetons: entier(),
      prixEntree: nombre('Prix pour un million de jetons en entrée, en FCFA.'),
      prixSortie: nombre('Prix pour un million de jetons en sortie, en FCFA.'),
      unite: liste(['jeton', 'minute']),
      latenceP50Ms: entier(),
      debitJetonsSec: entier(),
      statut: liste(STATUTS_MODELE),
      usages: tableau(chaine()),
      description: chaine(),
      invocable: booleen(
        'Vrai si ce modèle est réellement appelable via la passerelle LiteLLM ; sinon `invoquer` renvoie 422.',
      ),
    },
    ['id', 'slug', 'nom', 'editeur', 'famille', 'hebergement', 'residence', 'licence', 'statut', 'invocable'],
  ),

  ModeleIACreation: objet(
    {
      slug: chaine(),
      nom: chaine(),
      editeur: chaine(),
      famille: liste(FAMILLES_MODELE),
      hebergement: liste(HEBERGEMENTS_MODELE),
      residence: chaine(),
      licence: chaine(),
      contexteJetons: entier(),
      prixEntree: nombre(),
      prixSortie: nombre(),
      unite: liste(['jeton', 'minute']),
      statut: liste(STATUTS_MODELE),
      usages: tableau(chaine()),
      description: chaine(),
      invocable: booleen(),
    },
    ['slug', 'nom', 'editeur', 'famille', 'hebergement', 'residence', 'licence'],
  ),

  AgentIA: objet(
    {
      id: chaine(),
      nom: chaine(),
      consigne: chaine('Consigne système envoyée au modèle avant le message de l’appelant.'),
      espaceId: chaine(),
      modele: chaine('Slug du modèle IA utilisé — référence `ModeleIA.slug`.'),
      temperature: nombre(),
      topP: nombre(),
      jetonsMax: entier(),
      statut: liste(STATUTS_AGENT),
      createdAt: horodatage(),
    },
    ['id', 'nom', 'consigne', 'modele', 'temperature', 'topP', 'jetonsMax', 'statut', 'createdAt'],
  ),

  AgentIACreation: objet(
    {
      nom: chaine(),
      consigne: chaine(),
      espaceId: chaine(),
      modele: chaine(),
      temperature: nombre(undefined, { default: 0.7 }),
      topP: nombre(undefined, { default: 1 }),
      jetonsMax: entier(undefined, { default: 1024 }),
    },
    ['nom', 'consigne', 'modele'],
  ),

  AgentIAModification: objet({
    nom: chaine(),
    consigne: chaine(),
    modele: chaine(),
    temperature: nombre(),
    topP: nombre(),
    jetonsMax: entier(),
    statut: liste(STATUTS_AGENT),
  }),

  AgentInvocationRequest: objet(
    {
      message: chaine('Message de l’appelant — un seul tour, pas de mémoire de conversation dans ce MVP.'),
      conversationId: chaine('Réservé pour un usage futur ; ignoré aujourd’hui.'),
    },
    ['message'],
  ),

  AgentInvocationResponse: objet(
    {
      reponse: chaine(),
      jetonsEntree: entier(),
      jetonsSortie: entier(),
      coutFcfa: nombre(),
      latenceMs: entier(),
    },
    ['reponse', 'jetonsEntree', 'jetonsSortie', 'coutFcfa', 'latenceMs'],
  ),

  SourceConnaissance: objet(
    { type: liste(SOURCES_CONNAISSANCE), libelle: chaine() },
    ['type', 'libelle'],
  ),

  BaseConnaissance: objet(
    {
      id: chaine(),
      nom: chaine(),
      espaceId: chaine(),
      source: ref('SourceConnaissance'),
      documents: entier(),
      fragments: entier(),
      modeleEmbedding: chaine(),
      dimension: entier(),
      modeDecoupage: liste(MODES_DECOUPAGE, 'Le choix se fige à la création. Seul `general` est réellement découpé aujourd’hui.'),
      methodeIndex: liste(METHODES_INDEX),
      modeRecherche: liste(MODES_RECHERCHE),
      citations: booleen('Renvoyer le document d’origine avec chaque fragment cité.'),
      tailleMo: nombre(),
      frequence: liste(FREQUENCES_CONNAISSANCE),
      derniereIndexation: horodatage(),
      statut: liste(STATUTS_CONNAISSANCE),
      clesAutorisees: tableau(chaine(), 'Identifiants de `CleIA` autorisées à interroger cette base.'),
      erreur: chaine(),
    },
    [
      'id', 'nom', 'espaceId', 'source', 'documents', 'fragments', 'modeleEmbedding', 'dimension',
      'modeDecoupage', 'methodeIndex', 'modeRecherche', 'citations', 'tailleMo', 'frequence',
      'derniereIndexation', 'statut',
    ],
  ),

  BaseConnaissanceCreation: objet(
    {
      nom: chaine(),
      espaceId: chaine(),
      source: ref('SourceConnaissance'),
      modeDecoupage: liste(MODES_DECOUPAGE, undefined, { default: 'general' }),
      methodeIndex: liste(METHODES_INDEX, undefined, { default: 'haute_qualite' }),
      modeRecherche: liste(MODES_RECHERCHE, undefined, { default: 'vectorielle' }),
      citations: booleen(undefined, { default: true }),
      frequence: liste(FREQUENCES_CONNAISSANCE, undefined, { default: 'manuelle' }),
    },
    ['nom', 'espaceId', 'source'],
  ),

  BaseConnaissanceModification: objet({
    nom: chaine(),
    citations: booleen(),
    frequence: liste(FREQUENCES_CONNAISSANCE),
    clesAutorisees: tableau(chaine()),
    statut: liste(STATUTS_CONNAISSANCE),
  }),

  DocumentConnaissanceCreation: objet(
    {
      nom: chaine('Nom du document — apparaît dans les citations.'),
      texte: chaine('Contenu déjà en texte ou Markdown (collé) — évite un aller-retour Docling inutile.'),
      contenuBase64: chaine('Fichier encodé en base64 (pdf, docx, html…), réellement extrait par Docling.'),
      url: chaine('Document déjà accessible en ligne (source web/git) — Docling va le chercher lui-même.'),
    },
    ['nom'],
  ),

  ConnaissanceRechercheRequest: objet(
    {
      query: chaine('Question ou texte de recherche — vectorisé avec le même modèle que les fragments indexés.'),
      topK: entier('Nombre de fragments renvoyés, du plus au moins pertinent.', { default: 5 }),
    },
    ['query'],
  ),

  FragmentRecherche: objet(
    {
      texte: chaine(),
      score: nombre('Similarité cosinus, entre 0 et 1.'),
      document: chaine('Nom du document source — présent même si `citations` est faux.'),
      citations: chaine('Extrait de citation du document d’origine, uniquement si `citations` est vrai sur la base.'),
    },
    ['texte', 'score', 'document'],
  ),

  ConnaissanceRechercheResponse: objet({ fragments: tableau(ref('FragmentRecherche')) }, ['fragments']),

  CleIA: objet(
    {
      id: chaine(),
      nom: chaine(),
      prefixe: chaine('Préfixe visible, seul fragment du secret affichable après création.'),
      espaceId: chaine(),
      usage: chaine('Application ou équipe qui porte la clé — sert au showback.'),
      modelesAutorises: tableau(chaine(), 'Slugs de `ModeleIA` autorisés, ou la valeur unique `tous`.'),
      quotaJetonsMois: entier(),
      jetonsConsommes: entier(),
      debitMaxParMinute: entier(),
      budgetMensuel: montant(),
      budgetConsomme: montant(),
      auDepassement: liste(DEPASSEMENTS_CLE, 'Comportement au dépassement : couper, ou laisser passer en alertant.'),
      residenceMax: liste(CLASSES_DONNEES, 'Classe de données maximale que cette clé peut faire sortir vers un modèle externe.'),
      statut: liste(STATUTS_CLE_IA),
      creeeLe: horodatage(),
      creeePar: chaine(),
      derniereUtilisation: horodatage(),
    },
    [
      'id', 'nom', 'prefixe', 'espaceId', 'usage', 'modelesAutorises', 'quotaJetonsMois',
      'jetonsConsommes', 'debitMaxParMinute', 'budgetMensuel', 'budgetConsomme', 'auDepassement',
      'residenceMax', 'statut', 'creeeLe',
    ],
  ),

  CleIACreation: objet(
    {
      nom: chaine(),
      espaceId: chaine(),
      usage: chaine(),
      modelesAutorises: tableau(chaine(), undefined, { default: ['tous'] }),
      quotaJetonsMois: entier(undefined, { default: 1_000_000 }),
      debitMaxParMinute: entier(undefined, { default: 60 }),
      budgetMensuel: montant(undefined, { default: 0 }),
      auDepassement: liste(DEPASSEMENTS_CLE, undefined, { default: 'bloquer' }),
      residenceMax: liste(CLASSES_DONNEES, undefined, { default: 'interne' }),
    },
    ['nom', 'espaceId'],
  ),

  CleIAModification: objet({
    nom: chaine(),
    usage: chaine(),
    modelesAutorises: tableau(chaine()),
    quotaJetonsMois: entier(),
    debitMaxParMinute: entier(),
    budgetMensuel: montant(),
    auDepassement: liste(DEPASSEMENTS_CLE),
    residenceMax: liste(CLASSES_DONNEES),
    statut: liste(STATUTS_CLE_IA),
  }),

  CleIASecret: objet(
    { cle: ref('CleIA'), secret: chaine('Renvoyé une seule fois, à la création.') },
    ['cle', 'secret'],
  ),

  VariableFlux: objet(
    {
      cle: chaine(),
      portee: liste(PORTEES_VARIABLE),
      valeur: chaine(),
      secret: booleen(),
      description: chaine(),
    },
    ['cle', 'portee', 'valeur', 'description'],
  ),

  BrancheFlux: objet(
    {
      id: chaine(),
      nom: chaine(),
      condition: chaine('Évaluée en « premier mot-clé de la condition trouvé dans les variables ou la dernière sortie » — pas un langage d’expression complet.'),
      partPct: nombre(),
      parDefaut: booleen('La branche de repli reçoit ce qu’aucune condition n’a retenu.'),
      etapes: tableau(ref('EtapeFlux')),
    },
    ['id', 'nom', 'condition', 'partPct', 'etapes'],
  ),

  EtapeFlux: objet(
    {
      id: chaine(),
      type: liste(TYPES_ETAPE),
      nom: chaine(),
      source: chaine(),
      detail: chaine(),
      agentId: chaine(),
      outilId: chaine(),
      connaissanceId: chaine('Base de connaissances interrogée — seul un champ dédié permet à l’exécution de savoir où chercher.'),
      condition: chaine(),
      verrouillee: booleen(),
      executions24h: entier(),
      latenceMs: entier(),
      coutPourMille: nombre(),
      tauxErreurPct: nombre(),
      reprise: objet({ tentatives: entier(), delaiS: entier() }, ['tentatives', 'delaiS']),
      branches: tableau(ref('BrancheFlux')),
      modeRoutage: liste(MODES_ROUTAGE),
      corps: tableau(ref('EtapeFlux')),
      surItems: chaine(),
      maxIterations: entier(),
    },
    ['id', 'type', 'nom', 'source', 'detail', 'executions24h', 'latenceMs', 'coutPourMille', 'tauxErreurPct'],
  ),

  FluxOrchestration: objet(
    {
      id: chaine(),
      nom: chaine(),
      description: chaine(),
      espaceId: chaine(),
      statut: liste(STATUTS_FLUX),
      declencheur: declencheurFlux(),
      etapes: tableau(ref('EtapeFlux')),
      variables: tableau(ref('VariableFlux')),
      executions7j: entier(),
      dureeMedianeS: entier(),
      tauxSuccesPct: nombre(),
      coutParExecution: nombre(),
      memoirePartagee: booleen(),
      version: chaine(),
    },
    ['id', 'nom', 'description', 'espaceId', 'statut', 'declencheur', 'etapes', 'variables', 'memoirePartagee', 'version'],
  ),

  FluxOrchestrationCreation: objet(
    {
      nom: chaine(),
      description: chaine(),
      espaceId: chaine(),
      declencheur: declencheurFlux(),
      etapes: tableau(ref('EtapeFlux')),
      variables: tableau(ref('VariableFlux')),
      memoirePartagee: booleen(undefined, { default: false }),
    },
    ['nom', 'declencheur'],
  ),

  FluxOrchestrationModification: objet({
    nom: chaine(),
    description: chaine(),
    statut: liste(STATUTS_FLUX),
    declencheur: declencheurFlux(),
    etapes: tableau(ref('EtapeFlux')),
    variables: tableau(ref('VariableFlux')),
    memoirePartagee: booleen(),
  }),

  FluxExecutionRequest: objet(
    {
      entree: chaine('Message ou charge utile qui déclenche le flux — ce que le déclencheur aurait reçu.'),
      variables: dictionnaire({}, 'Valeurs de variables à surcharger pour cette exécution seulement (clé → valeur).'),
    },
    ['entree'],
  ),

  FluxRepriseRequest: objet(
    {
      decision: liste(['approuve', 'rejete']),
      commentaire: chaine('Motif ou précision laissé par la personne qui valide.'),
    },
    ['decision'],
  ),
}

export const schemasIa = { ...ia }
