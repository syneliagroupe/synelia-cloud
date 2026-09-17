/**
 * Socle du contrat d'API — vocabulaire commun à tous les fichiers de chemins.
 *
 * Le contrat est écrit en français, comme le reste du dépôt : les noms de
 * champs des ressources reprennent **exactement** ceux de `src/lib/types.ts`,
 * parce que l'interface les consomme tels quels. Renommer un champ ici, c'est
 * casser un écran.
 */

// ─── Fabriques de schémas ─────────────────────────────────────────────

const decrit = (description) => (description ? { description } : {})

export const chaine = (description, extra = {}) => ({ type: 'string', ...decrit(description), ...extra })

export const liste = (valeurs, description, extra = {}) => ({
  type: 'string',
  enum: valeurs,
  ...decrit(description),
  ...extra,
})

export const entier = (description, extra = {}) => ({
  type: 'integer',
  format: 'int32',
  ...decrit(description),
  ...extra,
})

export const nombre = (description, extra = {}) => ({ type: 'number', ...decrit(description), ...extra })

export const booleen = (description, extra = {}) => ({ type: 'boolean', ...decrit(description), ...extra })

/** Horodatage ISO 8601 en UTC. La maquette gèle le temps à 2026-08-19T15:20:00Z. */
export const horodatage = (description) => ({ type: 'string', format: 'date-time', ...decrit(description) })

export const jour = (description) => ({ type: 'string', format: 'date', ...decrit(description) })

/** Montant en FCFA (XOF) sauf mention contraire — la devise par défaut du produit. */
export const montant = (description) => ({
  type: 'integer',
  format: 'int64',
  ...decrit(description ?? 'Montant en FCFA.'),
})

export const pourcentage = (description) => ({ type: 'number', minimum: 0, maximum: 100, ...decrit(description) })

export const ref = (nom) => ({ $ref: `#/components/schemas/${nom}` })

export const tableau = (items, description, extra = {}) => ({
  type: 'array',
  items,
  ...decrit(description),
  ...extra,
})

export const objet = (proprietes, requis = [], description) => ({
  type: 'object',
  ...decrit(description),
  properties: proprietes,
  ...(requis.length ? { required: requis } : {}),
})

/** Dictionnaire libre — utilisé pour les paramètres propres à chaque service. */
export const dictionnaire = (valeurs = {}, description) => ({
  type: 'object',
  ...decrit(description),
  additionalProperties: Object.keys(valeurs).length ? valeurs : true,
})

/**
 * Enveloppe des collections. Inline plutôt que nommée : cela éviterait une
 * centaine de schémas `PageDeX` sans rien apporter au générateur de code.
 */
export const page = (items, description) =>
  objet(
    {
      donnees: tableau(items),
      pagination: ref('Pagination'),
    },
    ['donnees', 'pagination'],
    description,
  )

// ─── Énumérations partagées ───────────────────────────────────────────

export const SITES = ['ABJ', 'GBM']

export const ROLES = [
  'super_admin',
  'platform_operator',
  'org_admin',
  'espace_admin',
  'project_owner',
  'operator',
  'service_admin',
  'billing_manager',
  'compliance',
  'read_only',
]

export const BACKENDS = ['openstack', 'proxmox', 'cloudstack', 'vsphere', 'hyperv']

export const DEVISES = ['XOF', 'EUR', 'USD']

export const MOYENS_PAIEMENT = ['carte', 'virement', 'orange_money', 'mtn_momo', 'wave', 'prepaye']

export const MOTEURS_MANAGES = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis']

export const MOTEURS_PROJET = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'clickhouse']

export const TYPES_ENREGISTREMENT_DNS = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA', 'NS']

export const FENETRES = ['24h', '7j', '30j']

// ─── Paramètres réutilisables ─────────────────────────────────────────

export const parametres = {
  Organisation: {
    name: 'X-Organisation-Id',
    in: 'header',
    required: false,
    description:
      "Organisation sur laquelle porte l'appel. Par défaut celle du jeton. " +
      "À renseigner quand l'utilisateur appartient à plusieurs organisations " +
      'et bascule depuis le sélecteur de la barre supérieure.',
    schema: chaine(),
    example: 'org-dba',
  },
  Langue: {
    name: 'Accept-Language',
    in: 'header',
    required: false,
    description:
      "Langue des libellés renvoyés par l'API (messages, intitulés de catalogue). " +
      "Chaîne libre (l'API accepte toute étiquette de langue RFC 5646 envoyée par un client HTTP réel) ; " +
      "seul `fr` est effectivement traduit aujourd'hui, tout le reste retombe sur `fr`. " +
      'Les identifiants et les codes ne sont jamais traduits.',
    schema: chaine(undefined, { default: 'fr' }),
  },
  Page: {
    name: 'page',
    in: 'query',
    required: false,
    description: 'Numéro de page, à partir de 1.',
    schema: entier(undefined, { minimum: 1, default: 1 }),
  },
  ParPage: {
    name: 'parPage',
    in: 'query',
    required: false,
    description: 'Taille de page.',
    schema: entier(undefined, { minimum: 1, maximum: 200, default: 25 }),
  },
  Tri: {
    name: 'tri',
    in: 'query',
    required: false,
    description: 'Champ de tri (`nom`, `createdAt`, `statut`…).',
    schema: chaine(),
  },
  Ordre: {
    name: 'ordre',
    in: 'query',
    required: false,
    description: 'Sens du tri.',
    schema: liste(['asc', 'desc'], undefined, { default: 'asc' }),
  },
  Recherche: {
    name: 'q',
    in: 'query',
    required: false,
    description: 'Recherche plein texte sur le nom et les identifiants.',
    schema: chaine(),
  },
  Fenetre: {
    name: 'fenetre',
    in: 'query',
    required: false,
    description:
      "Fenêtre d'observation. Le produit n'en expose que trois : au-delà, on renvoie vers Grafana.",
    schema: liste(FENETRES, undefined, { default: '24h' }),
  },
  Confirmation: {
    name: 'confirmation',
    in: 'query',
    required: true,
    description:
      "Nom exact de la ressource, saisi par l'utilisateur. Toute action destructive " +
      'le réclame ; un écart renvoie 422 sans rien détruire.',
    schema: chaine(),
  },
}

// ─── Réponses réutilisables ───────────────────────────────────────────

const erreur = (description) => ({
  description,
  content: { 'application/json': { schema: ref('ReponseErreur') } },
})

export const reponses = {
  Invalide: erreur('Requête mal formée.'),
  NonAuthentifie: erreur('Jeton absent, expiré ou révoqué.'),
  Interdit: {
    description:
      "Droits insuffisants. `rolesRequis` nomme les rôles qui peuvent l'exécuter : " +
      "l'interface s'en sert pour l'infobulle de l'action désactivée. Le refus est journalisé dans l'audit.",
    content: { 'application/json': { schema: ref('ReponseErreurInterdit') } },
  },
  Introuvable: erreur('Ressource inexistante ou hors du périmètre de la clé.'),
  Conflit: erreur("État incompatible avec l'action (ressource déjà en cours de modification, unicité)."),
  Invalidee: {
    description: 'Validation échouée. `champs` porte le détail par champ.',
    content: { 'application/json': { schema: ref('ReponseErreurValidation') } },
  },
  Quota: erreur('Quota de l’organisation dépassé ou capacité indisponible sur le site demandé.'),
  TropDeRequetes: erreur('Trop de requêtes. `Retry-After` indique le délai.'),
  Degrade: {
    description:
      "Intégration amont indisponible (Centreon, Grafana, VictoriaLogs, socle de virtualisation). " +
      "Les données renvoyées sont partielles et datées : l'interface passe en état dégradé.",
    content: { 'application/json': { schema: ref('ReponseErreurDegrade') } },
  },
  Serveur: erreur('Erreur interne. `correlationId` est à fournir au support.'),
}

// ─── Fabrique d'opérations ────────────────────────────────────────────

const P = (nom) => ({ $ref: `#/components/parameters/${nom}` })
const R = (nom) => ({ $ref: `#/components/responses/${nom}` })

const PAGINATION = [P('Page'), P('ParPage'), P('Tri'), P('Ordre'), P('Recherche')]

/**
 * Construit une opération complète : paramètres transverses, corps, réponses
 * d'erreur usuelles. Écrire ces blocs à la main sur trois cents opérations
 * garantirait des oublis, d'où la fabrique.
 *
 * @param {object} o
 * @param {string} o.tag        Rubrique de la documentation.
 * @param {string} o.id         `operationId`, unique dans tout le contrat.
 * @param {string} o.resume     Une ligne, à l'infinitif.
 * @param {string} [o.detail]   Ce que fait l'appel, et ce qu'il ne fait pas.
 * @param {'client'|'admin'|'public'|'auth'} [o.portee]
 * @param {Array}  [o.params]   Paramètres propres à l'opération.
 * @param {boolean}[o.paginee]  Ajoute page/parPage/tri/q.
 * @param {object} [o.corps]    Schéma du corps de requête.
 * @param {object} [o.ok]       Schéma de la réponse de succès.
 * @param {number} [o.code]     Code de succès (200 par défaut, 202 pour l'asynchrone).
 * @param {string} [o.rbac]     Identifiant d'action de la matrice RBAC.
 * @param {string[]} [o.erreurs] Réponses d'erreur supplémentaires.
 * @param {boolean}[o.destructif] Impose le paramètre `confirmation`.
 */
export function op({
  tag,
  id,
  resume,
  detail,
  portee = 'client',
  params = [],
  paginee = false,
  corps,
  corpsRequis = true,
  ok,
  code = 200,
  rbac,
  erreurs = [],
  destructif = false,
  deprecie = false,
}) {
  const transverses = [P('Langue')]
  if (portee === 'client') transverses.unshift(P('Organisation'))

  const tous = [...transverses, ...(paginee ? PAGINATION : []), ...(destructif ? [P('Confirmation')] : []), ...params]

  const reponsesOp = {}
  if (code === 204) {
    reponsesOp['204'] = { description: 'Supprimé. Aucun corps.' }
  } else {
    reponsesOp[String(code)] = {
      description: code === 202 ? 'Accepté — travail de provisioning créé.' : 'Succès.',
      content: { 'application/json': { schema: ok ?? objet({}) } },
    }
  }

  reponsesOp['400'] = R('Invalide')
  if (portee !== 'public') {
    reponsesOp['401'] = R('NonAuthentifie')
    reponsesOp['403'] = R('Interdit')
  }
  if (tous.some((p) => p.in === 'path')) reponsesOp['404'] = R('Introuvable')
  // `parPage` (entre autres) porte des bornes (`minimum`/`maximum`) que l'API fait
  // vraiment respecter : une pagination hors bornes ou un paramètre requis absent
  // renvoient un 422, tout comme un corps de requête invalide.
  if (corps || destructif || paginee || tous.some((p) => p.in === 'query' && p.required)) {
    reponsesOp['422'] = R('Invalidee')
  }
  for (const e of erreurs) reponsesOp[e] = R(NOM_ERREUR[e])
  reponsesOp['429'] = R('TropDeRequetes')
  reponsesOp['500'] = R('Serveur')

  return {
    tags: [tag],
    operationId: id,
    summary: resume,
    ...(detail ? { description: detail } : {}),
    ...(deprecie ? { deprecated: true } : {}),
    ...(rbac ? { 'x-rbac': rbac } : {}),
    ...(portee === 'public' || portee === 'auth' ? { security: [] } : {}),
    ...(tous.length ? { parameters: tous } : {}),
    ...(corps
      ? {
          requestBody: {
            required: corpsRequis,
            content: { 'application/json': { schema: corps } },
          },
        }
      : {}),
    responses: reponsesOp,
  }
}

const NOM_ERREUR = {
  409: 'Conflit',
  402: 'Quota',
  424: 'Degrade',
  404: 'Introuvable',
}

/** Paramètre de chemin. */
export const chemin = (nom, description, exemple) => ({
  name: nom,
  in: 'path',
  required: true,
  description,
  schema: chaine(),
  ...(exemple ? { example: exemple } : {}),
})

/** Paramètre de filtre en requête. `requis` pour les rares paramètres que l'API exige vraiment. */
export const filtre = (nom, schema, description, requis = false) => ({
  name: nom,
  in: 'query',
  required: requis,
  description,
  schema,
})

/**
 * Ensemble CRUD complet pour une ressource. `base` sans barre finale,
 * `idParam` est le paramètre de chemin de la fiche.
 */
export function crud({
  tag,
  base,
  idParam,
  nomSingulier,
  nomPluriel,
  libelle,
  libellePluriel,
  schema,
  creation,
  modification,
  filtres = [],
  rbacEcriture,
  rbacLecture,
  portee = 'client',
  creationAsync = false,
  suppressionAsync = false,
  sansSuppression = false,
  sansCreation = false,
  sansModification = false,
  erreursCreation = [],
  idsOperations = {},
}) {
  const P0 = idsOperations
  const chemins = {}
  const collection = {}
  // Les libellés français ne se déduisent pas d'un nom de type : « une VM », pas « un vm ».
  const un = libelle ?? `un ${nomSingulier.toLowerCase()}`
  const lesUns = libellePluriel ?? `les ${nomSingulier.toLowerCase()}s`

  collection.get = op({
    tag,
    portee,
    id: P0.liste ?? `lister${nomPluriel}`,
    resume: `Lister ${lesUns}`,
    paginee: true,
    params: filtres,
    ok: page(ref(schema)),
    rbac: rbacLecture,
  })

  if (!sansCreation) {
    collection.post = op({
      tag,
      portee,
      id: P0.creation ?? `creer${nomSingulier}`,
      resume: `Créer ${un}`,
      corps: ref(creation),
      ok: creationAsync ? ref('TravailProvisioning') : ref(schema),
      code: creationAsync ? 202 : 201,
      rbac: rbacEcriture,
      erreurs: [...(creationAsync ? [409, 402] : [409]), ...erreursCreation],
    })
  }

  chemins[base] = collection

  const fiche = {}
  fiche.get = op({
    tag,
    portee,
    id: P0.fiche ?? `obtenir${nomSingulier}`,
    resume: `Obtenir ${un}`,
    params: [idParam],
    ok: ref(schema),
    rbac: rbacLecture,
  })

  if (!sansModification) {
    fiche.patch = op({
      tag,
      portee,
      id: P0.modification ?? `modifier${nomSingulier}`,
      resume: `Modifier ${un}`,
      params: [idParam],
      corps: ref(modification ?? creation),
      ok: ref(schema),
      rbac: rbacEcriture,
      erreurs: [409],
    })
  }

  if (!sansSuppression) {
    fiche.delete = op({
      tag,
      portee,
      id: P0.suppression ?? `supprimer${nomSingulier}`,
      resume: `Supprimer ${un}`,
      detail: 'Action destructive : le nom exact de la ressource est exigé en confirmation.',
      params: [idParam],
      destructif: true,
      ok: suppressionAsync ? ref('TravailProvisioning') : undefined,
      code: suppressionAsync ? 202 : 204,
      rbac: rbacEcriture,
      erreurs: [409],
    })
  }

  chemins[`${base}/{${idParam.name}}`] = fiche
  return chemins
}

/** Action ponctuelle sur une ressource : `POST base/{id}/actions/verbe`. */
export function action({
  tag,
  chemin: url,
  id,
  resume,
  detail,
  params = [],
  corps,
  corpsRequis = false,
  ok,
  code = 202,
  rbac,
  portee = 'client',
  destructif = false,
  erreurs = [],
}) {
  return {
    [url]: {
      post: op({
        tag,
        portee,
        id,
        resume,
        detail,
        params,
        corps,
        corpsRequis,
        ok: ok ?? ref('TravailProvisioning'),
        code,
        rbac,
        destructif,
        erreurs,
      }),
    },
  }
}

/** Fusionne des blocs de chemins en signalant les collisions. */
export function fusion(...blocs) {
  const total = {}
  for (const bloc of blocs) {
    for (const [url, methodes] of Object.entries(bloc)) {
      if (!total[url]) {
        total[url] = { ...methodes }
        continue
      }
      for (const [methode, corps] of Object.entries(methodes)) {
        if (total[url][methode]) throw new Error(`Collision : ${methode.toUpperCase()} ${url}`)
        total[url][methode] = corps
      }
    }
  }
  return total
}
