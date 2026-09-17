/**
 * Chemins — univers « IA & Agents ».
 *
 * Une passerelle (LiteLLM devant OpenRouter), un catalogue de modèles, des
 * agents qu'on invoque en un aller-retour, et des flux d'orchestration qu'on
 * exécute réellement (moteur natif Python, pas de service Mastra séparé pour
 * l'instant). Bases de connaissances, outils, canaux, clés, routage, garde-fous
 * et consommation détaillée restent hors de cette passe.
 */

import { action, chemin, crud, fusion, op, ref } from './socle.mjs'

const T_MODELES = 'IA — Modèles'
const T_AGENTS = 'IA — Agents'
const T_FLUX = 'IA — Orchestration'
const T_CONNAISSANCES = 'IA — Connaissances'
const T_CLES = 'IA — Clés'

const idModele = chemin('modeleId', 'Identifiant du modèle IA.', 'm-llama-70b')
const idAgent = chemin('agentId', 'Identifiant de l’agent.', 'agent-support')
const idFlux = chemin('fluxId', 'Identifiant du flux d’orchestration.', 'fx-reclamation')
const idExecution = chemin('travailId', 'Identifiant du travail — l’exécution du flux.', 'trv-01')
const idConnaissance = chemin('connaissanceId', 'Identifiant de la base de connaissances.', 'kb-rh')
const idCle = chemin('cleId', 'Identifiant de la clé IA.', 'cle-prod')

const modeles = crud({
  tag: T_MODELES,
  base: '/ia/modeles',
  idParam: idModele,
  nomSingulier: 'ModeleIA',
  nomPluriel: 'ModelesIA',
  libelle: 'un modèle IA',
  libellePluriel: 'les modèles IA',
  schema: 'ModeleIA',
  creation: 'ModeleIACreation',
  sansModification: true,
  sansSuppression: true,
  rbacLecture: 'org.dashboard.view',
})

const agents = fusion(
  crud({
    tag: T_AGENTS,
    base: '/ia/agents',
    idParam: idAgent,
    nomSingulier: 'AgentIA',
    nomPluriel: 'AgentsIA',
    libelle: 'un agent',
    libellePluriel: 'les agents',
    schema: 'AgentIA',
    creation: 'AgentIACreation',
    modification: 'AgentIAModification',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'ia.agent.write',
  }),
  {
    '/ia/agents/{agentId}/invoquer': {
      post: op({
        tag: T_AGENTS,
        id: 'invoquerAgent',
        resume: 'Invoquer un agent',
        detail:
          'Un aller-retour : la consigne de l’agent et le message de l’appelant partent vers le ' +
          'modèle configuré via la passerelle LiteLLM. Pas de mémoire de conversation ni ' +
          'd’anonymisation dans ce MVP. Un agent dont le modèle n’est pas invocable sur cette ' +
          'passerelle renvoie 422, jamais une réponse inventée.',
        params: [idAgent],
        corps: ref('AgentInvocationRequest'),
        ok: ref('AgentInvocationResponse'),
        erreurs: [424],
      }),
    },
  },
)

const flux = fusion(
  crud({
    tag: T_FLUX,
    base: '/ia/flux',
    idParam: idFlux,
    nomSingulier: 'FluxOrchestration',
    nomPluriel: 'FluxOrchestrations',
    libelle: 'un flux d’orchestration',
    libellePluriel: 'les flux d’orchestration',
    schema: 'FluxOrchestration',
    creation: 'FluxOrchestrationCreation',
    modification: 'FluxOrchestrationModification',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'ia.flow.write',
  }),
  action({
    tag: T_FLUX,
    chemin: `/ia/flux/{${idFlux.name}}/executer`,
    id: 'executerFlux',
    resume: 'Exécuter un flux',
    detail:
      'Démarre une exécution réelle du flux — moteur natif Python, pas un simulateur : les étapes ' +
      '`agent` appellent réellement la passerelle LiteLLM, les étapes `connaissance` la recherche ' +
      'documentaire réelle. Asynchrone comme toute opération longue : renvoie un `TravailProvisioning` ' +
      'à interroger via `GET /travaux/{id}`. Une étape `humain` en attente laisse le travail `running` ' +
      'avec un message explicite sur la tâche concernée, à débloquer via `reprendreExecutionFlux`.',
    params: [idFlux],
    corps: ref('FluxExecutionRequest'),
    corpsRequis: true,
    erreurs: [409, 424],
  }),
  action({
    tag: T_FLUX,
    chemin: `/ia/flux/{${idFlux.name}}/executions/{${idExecution.name}}/reprendre`,
    id: 'reprendreExecutionFlux',
    resume: 'Reprendre un flux en attente d’une validation humaine',
    detail:
      'Une étape `humain` a mis le travail en pause : ce point d’entrée transmet la décision et reprend ' +
      'l’exécution à l’étape suivante. Un travail qui n’est pas en attente d’une validation humaine ' +
      'renvoie 409.',
    params: [idFlux, idExecution],
    corps: ref('FluxRepriseRequest'),
    corpsRequis: true,
    rbac: 'ia.flow.write',
    erreurs: [409, 424],
  }),
)

const connaissances = fusion(
  crud({
    tag: T_CONNAISSANCES,
    base: '/ia/connaissances',
    idParam: idConnaissance,
    nomSingulier: 'BaseConnaissance',
    nomPluriel: 'BasesConnaissance',
    libelle: 'une base de connaissances',
    libellePluriel: 'les bases de connaissances',
    schema: 'BaseConnaissance',
    creation: 'BaseConnaissanceCreation',
    modification: 'BaseConnaissanceModification',
    rbacLecture: 'org.dashboard.view',
    rbacEcriture: 'ia.knowledge.write',
  }),
  action({
    tag: T_CONNAISSANCES,
    chemin: `/ia/connaissances/{${idConnaissance.name}}/documents`,
    id: 'ingererDocumentConnaissance',
    resume: 'Ingérer un document dans une base de connaissances',
    detail:
      'Extraction réelle du texte (Docling), découpage en fragments, vectorisation (BGE-M3 via ' +
      'Infinity) puis indexation (Qdrant) — un travail de provisioning comme toute opération ' +
      'longue. Au moins un de `texte`, `contenuBase64` ou `url` est requis.',
    params: [idConnaissance],
    corps: ref('DocumentConnaissanceCreation'),
    corpsRequis: true,
    rbac: 'ia.knowledge.write',
    erreurs: [424],
  }),
  {
    [`/ia/connaissances/{${idConnaissance.name}}/rechercher`]: {
      post: op({
        tag: T_CONNAISSANCES,
        id: 'rechercherConnaissance',
        resume: 'Rechercher dans une base de connaissances',
        detail:
          'Recherche vectorielle réelle (Qdrant) sur les fragments indexés — la requête est vectorisée ' +
          'avec le même modèle d’embedding que les documents. C’est ce point d’entrée qu’une étape ' +
          '`connaissance` d’un flux d’orchestration appelle ; il ne dépend d’aucun état de flux.',
        params: [idConnaissance],
        corps: ref('ConnaissanceRechercheRequest'),
        ok: ref('ConnaissanceRechercheResponse'),
        erreurs: [424],
      }),
    },
  },
)

const cles = fusion(
  crud({
    tag: T_CLES,
    base: '/ia/cles',
    idParam: idCle,
    nomSingulier: 'CleIA',
    nomPluriel: 'ClesIA',
    libelle: 'une clé IA',
    libellePluriel: 'les clés IA',
    schema: 'CleIA',
    creation: 'CleIACreation',
    modification: 'CleIAModification',
    rbacLecture: 'ia.key.manage',
    rbacEcriture: 'ia.key.manage',
  }),
  action({
    tag: T_CLES,
    chemin: `/ia/cles/{${idCle.name}}/rotation`,
    id: 'rotationnerCleIA',
    resume: 'Faire tourner le secret d’une clé IA',
    detail:
      'Invalide l’ancien secret et en émet un nouveau immédiatement — contrairement à ' +
      '`rotationnerCleApi`, pas de délai de grâce : une clé IA n’a qu’un secret vivant à la ' +
      'fois. Le quota, le budget consommé et le statut de la clé ne changent pas.',
    params: [idCle],
    ok: ref('CleIASecret'),
    code: 200,
    rbac: 'ia.key.manage',
    erreurs: [409],
  }),
)
// La création d'une clé renvoie le secret, ce que le CRUD générique ne sait pas dire.
cles['/ia/cles'].post.responses['201'].content['application/json'].schema = ref('CleIASecret')

export const cheminsIa = fusion(modeles, agents, flux, connaissances, cles)
