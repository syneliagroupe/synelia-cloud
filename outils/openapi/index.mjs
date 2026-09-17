/**
 * Génère `docs/api/openapi.json` — le contrat que le backend doit servir.
 *
 *     node outils/openapi/index.mjs
 *
 * Le fichier généré est versionné : c'est lui que lisent les générateurs de
 * code et Swagger UI. Ne l'éditez pas à la main, éditez ce dossier.
 *
 * Le générateur refuse d'écrire un document incohérent : références mortes,
 * `operationId` en doublon, paramètre de chemin non déclaré. Une erreur ici
 * vaut mieux qu'un client généré qui compile et ne marche pas.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fusion, parametres, reponses } from './socle.mjs'
import { schemasSocle } from './schemas-socle.mjs'
import { schemasProduits } from './schemas-produits.mjs'
import { schemasTransverses } from './schemas-transverses.mjs'
import { schemasIa } from './schemas-ia.mjs'
import { cheminsIdentite } from './chemins-identite.mjs'
import { cheminsInfra } from './chemins-infra.mjs'
import { cheminsIa } from './chemins-ia.mjs'
import { cheminsApplicatif } from './chemins-applicatif.mjs'
import { cheminsWeb } from './chemins-web.mjs'
import { cheminsServices } from './chemins-services.mjs'
import { cheminsAdmin } from './chemins-admin.mjs'
import { cheminsPublic } from './chemins-public.mjs'
import { cheminsTransverses } from './chemins-transverses.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const SORTIE = join(ICI, '..', '..', 'docs', 'api', 'openapi.json')

const DESCRIPTION = `
API de Synelia Cloud — plateforme de gestion de cloud multi-tenant opérée à
Abidjan (Synertech Vallon) et Grand-Bassam (VITIB).

## Ce que cette API couvre

Trois espaces, une seule API :

- **espace client** : Espaces Cloud, machines, Kubernetes, réseau, stockage,
  sauvegarde et PRA, plateforme applicative, projets, Web Cloud, services
  managés, facturation, support ;
- **espace super admin** (préfixe \`/admin\`) : pilotage, clients,
  capacité, catalogue, finance, exploitation ;
- **vitrine publique** (préfixe \`/public\`) : offres, tarifs, simulateur,
  statut, souveraineté, demandes de contact.

## Ce qu'elle ne couvre pas, volontairement

Le portail **ne réimplémente jamais l'écran principal d'un produit amont** :
pas d'explorateur de fichiers, pas de webmail, pas d'écran métier d'ERP, pas
d'éditeur de contenu de CMS, pas de constructeur de requêtes de journaux.
L'API provisionne, dimensionne, sauvegarde, supervise et **ouvre la porte**
(\`POST /services/{id}/ouverture\` renvoie un rebond SSO). Aucun point d'entrée
ne lit un courriel, ne liste un objet de bucket ni ne modifie une écriture
comptable.

L'observabilité est bornée à quatre formats : tuile (\`Tuile\`), série
(\`Serie\`, fenêtres \`24h\` / \`7j\` / \`30j\` seulement), liste d'événements
(huit lignes), extrait de journal (vingt lignes). Au-delà, les réponses
portent des liens de sortie vers Centreon, Grafana et VictoriaLogs.

## Conventions

- **Langue** : les noms de champs reprennent le modèle de données du produit,
  en français. \`Accept-Language\` gouverne les libellés, jamais les clés.
- **Multi-tenant** : l'organisation vient du jeton ; \`X-Organisation-Id\` la
  remplace quand l'utilisateur appartient à plusieurs organisations.
- **Pagination** : \`page\`, \`parPage\`, \`tri\`, \`ordre\` et \`q\` en requête,
  \`{ donnees, pagination }\` en réponse. Une ressource seule n'est pas enveloppée.
- **Asynchrone** : toute opération de provisioning répond \`202\` avec un
  \`TravailProvisioning\` dont les étapes se suivent une par une.
- **Actions destructives** : paramètre \`confirmation\` obligatoire, valant le
  nom exact de la ressource. Un écart renvoie \`422\` sans rien détruire.
- **Actions facturables** : \`POST /facturation/estimation\` renvoie l'aperçu de
  coût attendu avant l'engagement.
- **Droits** : chaque opération porte \`x-rbac\`, l'identifiant de son action
  dans la matrice RBAC. Un refus renvoie \`403\` avec \`rolesRequis\` : le client
  désactive l'action et nomme le rôle requis, il ne la masque pas.
- **Erreurs** : enveloppe \`{ erreur: { code, message, correlationId } }\`. Le
  \`correlationId\` est toujours présent, affiché et copiable côté interface.
- **Secrets** : mots de passe, clés privées et jetons ne sont renvoyés qu'à leur
  création ou à leur rotation, jamais en lecture.
- **Intégration amont en défaut** : \`424\` avec la fraîcheur des dernières
  données connues, pour un affichage dégradé plutôt qu'une page vide.
- **Montants** : entiers en FCFA (XOF) sauf mention contraire.
`.trim()

const TAGS = [
  ['Authentification', 'Connexion, MFA, fédération, inscription, invitations.'],
  ['Compte & organisation active', 'Profil, préférences, organisation courante, lanceur de services.'],
  ['Organisations', 'Cycle de vie des organisations, vue fournisseur.'],
  ['Membres & rôles', 'Membres, invitations, matrice des droits.'],
  ['Sécurité & accès', 'Fédération SSO, politiques, sessions, clés d’API.'],
  ['Audit', 'Journal d’audit, rapports de conformité, attestations.'],
  ['Tableau de bord', 'Synthèse, recherche globale, copilote, guide de démarrage, anomalies.'],
  ['Travaux de provisioning', 'Suivi des opérations asynchrones.'],
  ['Espaces Cloud', 'Espaces, quotas, placement, consommation.'],
  ['Machines virtuelles', 'Machines, matériel virtuel, console, déploiement en lot.'],
  ['Kubernetes', 'Clusters managés, pools, modules, kubeconfig.'],
  ['Réseau', 'Réseaux privés, IP publiques, pare-feu, VPN, load balancers.'],
  ['Stockage', 'Volumes bloc, buckets objet, clés d’accès S3.'],
  ['Bases managées', 'Bases opérées par la plateforme, réplicas, restauration dans le temps.'],
  ['Sauvegarde & PRA', 'Plans, points de restauration, conformité 3-2-1, plans de reprise.'],
  ['Applications', 'Applications, environnements, composants, dépôts.'],
  ['Déploiements', 'Construction, analyse, mise en service, retour arrière.'],
  ['Projets applicatifs', 'Projets, services, zone applicative, domaines, routage.'],
  ['Modèles applicatifs', 'Bibliothèque de solutions libres qualifiées.'],
  ['IA — Modèles', 'Catalogue des modèles IA, avec la passerelle qui les rend réellement invocables.'],
  ['IA — Agents', 'Agents : consigne, modèle, réglages, invocation en un aller-retour.'],
  ['Observabilité', 'Séries, événements, journaux, règles d’alerte.'],
  ['Services managés', 'Catalogue, souscription, sièges, configuration, ouverture.'],
  ['Web Cloud — domaines & DNS', 'Noms de domaine, zones et enregistrements.'],
  ['Web Cloud — hébergement', 'Hébergement mutualisé, PHP, transfert, tâches planifiées.'],
  ['Web Cloud — applications web', 'WordPress, PrestaShop, Laravel, sites statiques.'],
  ['Web Cloud — bases', 'Bases des hébergements, sans accès distant.'],
  ['Web Cloud — emails', 'Messagerie de domaine, boîtes, alias, authentification.'],
  ['Web Cloud — drive', 'Drive de domaine, sièges, partage, rétention.'],
  ['Web Cloud — SSL', 'Certificats, validation, renouvellement.'],
  ['Web Cloud — sauvegarde', 'Sauvegarde des hébergements et restauration granulaire.'],
  ['Web Cloud — relais SMTP', 'Envoi applicatif, réputation, journal de remise.'],
  ['Facturation', 'Factures, consommation, ventilation, moyens de paiement, SLA.'],
  ['Support', 'Tickets, pièces jointes, base de connaissances.'],
  ['Documentation & formation', 'Parcours, progression, bac à sable.'],
  ['Super admin — pilotage', 'Synthèse, santé, audit et conformité de la plateforme.'],
  ['Super admin — clients', 'Organisations clientes et demandes entrantes de la vitrine.'],
  ['Super admin — infrastructure', 'Capacité, socles, placement, campagnes de migration.'],
  ['Super admin — produit', 'Catalogue par famille, parc de services, campagnes de mise à jour.'],
  ['Super admin — finance', 'Facturation, impayés, marges.'],
  ['Super admin — exploitation', 'Tickets, statut public, incidents, équipe.'],
  ['Vitrine publique', 'Offres, tarifs, simulateur, statut, souveraineté, demandes.'],
].map(([name, description]) => ({ name, description }))

const chemins = fusion(
  cheminsIdentite,
  cheminsInfra,
  cheminsIa,
  cheminsApplicatif,
  cheminsWeb,
  cheminsServices,
  cheminsAdmin,
  cheminsPublic,
  cheminsTransverses,
)

const document = {
  openapi: '3.0.3',
  info: {
    title: 'Synelia Cloud — API',
    version: '1.0.0',
    description: DESCRIPTION,
    contact: { name: 'Synelia', url: 'https://synelia.tech', email: 'support@synelia.tech' },
    license: { name: 'Propriétaire — Synelia', url: 'https://synelia.tech/legal/mentions-legales' },
  },
  servers: [
    { url: 'https://api.synelia.cloud/v1', description: 'Production' },
    { url: 'https://api.bac-a-sable.synelia.cloud/v1', description: 'Bac à sable' },
    { url: 'http://localhost:4000/v1', description: 'Développement local' },
  ],
  tags: TAGS,
  security: [{ bearerAuth: [] }, { cleApi: [] }],
  paths: Object.fromEntries(Object.entries(chemins).sort(([a], [b]) => a.localeCompare(b))),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Jeton de session obtenu par `/auth/connexion`, `/auth/mfa` ou `/auth/sso/callback`. ' +
          'Il porte l’utilisateur, son organisation active et son rôle.',
      },
      cleApi: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Key',
        description:
          'Clé d’API d’organisation, pour un accès machine. Sa portée est bornée aux actions ' +
          'RBAC déclarées à sa création ; elle ne peut jamais dépasser les droits du rôle qui l’a émise.',
      },
    },
    parameters: parametres,
    responses: reponses,
    schemas: Object.fromEntries(
      Object.entries({ ...schemasSocle, ...schemasProduits, ...schemasTransverses, ...schemasIa }).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
  },
}

// ─── Vérifications ────────────────────────────────────────────────────

const METHODES = ['get', 'post', 'put', 'patch', 'delete']
const erreurs = []
const avertissements = []

const refsUtilisees = new Set()
const idsVus = new Map()
let nbOperations = 0

/** Collecte toutes les `$ref` et vérifie qu'elles pointent sur du réel. */
function verifieRefs(noeud, ou) {
  if (Array.isArray(noeud)) {
    noeud.forEach((n, i) => verifieRefs(n, `${ou}[${i}]`))
    return
  }
  if (!noeud || typeof noeud !== 'object') return
  if (typeof noeud.$ref === 'string') {
    const chemin = noeud.$ref.replace(/^#\//, '').split('/')
    let cible = document
    for (const segment of chemin) cible = cible?.[segment]
    if (cible === undefined) erreurs.push(`Référence morte ${noeud.$ref} (${ou})`)
    if (noeud.$ref.startsWith('#/components/schemas/')) refsUtilisees.add(chemin.at(-1))
    return
  }
  for (const [cle, valeur] of Object.entries(noeud)) verifieRefs(valeur, `${ou}.${cle}`)
}

verifieRefs(document.paths, 'paths')
verifieRefs(document.components.schemas, 'schemas')
verifieRefs(document.components.responses, 'responses')

for (const [url, item] of Object.entries(document.paths)) {
  const attendus = [...url.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
  const methodes = Object.keys(item)

  const inconnues = methodes.filter((m) => !METHODES.includes(m))
  if (inconnues.length) erreurs.push(`Méthode inconnue sur ${url} : ${inconnues.join(', ')}`)
  if (!methodes.length) erreurs.push(`Chemin sans méthode : ${url}`)

  for (const methode of methodes.filter((m) => METHODES.includes(m))) {
    const operation = item[methode]
    nbOperations += 1
    const etiquette = `${methode.toUpperCase()} ${url}`

    if (!operation.operationId) erreurs.push(`operationId manquant : ${etiquette}`)
    else if (idsVus.has(operation.operationId)) {
      erreurs.push(
        `operationId en doublon « ${operation.operationId} » : ${etiquette} et ${idsVus.get(operation.operationId)}`,
      )
    } else idsVus.set(operation.operationId, etiquette)

    if (!operation.summary) erreurs.push(`Résumé manquant : ${etiquette}`)
    if (!operation.tags?.length) erreurs.push(`Rubrique manquante : ${etiquette}`)

    // Un paramètre peut arriver par référence : on le résout pour comparer.
    const params = (operation.parameters ?? []).map((p) =>
      p.$ref ? document.components.parameters[p.$ref.split('/').at(-1)] : p,
    )
    const cles = params.map((p) => `${p.in}:${p.name}`)
    const doublons = cles.filter((c, i) => cles.indexOf(c) !== i)
    if (doublons.length) erreurs.push(`Paramètre en doublon (${[...new Set(doublons)].join(', ')}) : ${etiquette}`)

    const declares = params.filter((p) => p.in === 'path').map((p) => p.name)
    for (const attendu of attendus) {
      if (!declares.includes(attendu)) erreurs.push(`Paramètre de chemin « ${attendu} » non déclaré : ${etiquette}`)
    }
    for (const declare of declares) {
      if (!attendus.includes(declare)) erreurs.push(`Paramètre de chemin « ${declare} » absent de l’URL : ${etiquette}`)
    }

    if (methode === 'get' && operation.requestBody) erreurs.push(`GET avec corps de requête : ${etiquette}`)
    if (!Object.keys(operation.responses ?? {}).length) erreurs.push(`Aucune réponse déclarée : ${etiquette}`)
  }
}

for (const nom of Object.keys(document.components.schemas)) {
  if (!refsUtilisees.has(nom)) avertissements.push(`Schéma jamais référencé : ${nom}`)
}

if (avertissements.length) {
  console.warn(`${avertissements.length} avertissement(s) :`)
  for (const a of avertissements) console.warn(`  · ${a}`)
}

if (erreurs.length) {
  console.error(`\n${erreurs.length} erreur(s) — rien n’a été écrit :`)
  for (const e of erreurs) console.error(`  ✗ ${e}`)
  process.exit(1)
}

mkdirSync(dirname(SORTIE), { recursive: true })
writeFileSync(SORTIE, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

const parRubrique = new Map()
for (const item of Object.values(document.paths)) {
  for (const methode of METHODES) {
    const tag = item[methode]?.tags?.[0]
    if (tag) parRubrique.set(tag, (parRubrique.get(tag) ?? 0) + 1)
  }
}

console.log(
  `docs/api/openapi.json — ${Object.keys(document.paths).length} chemins, ${nbOperations} opérations, ` +
    `${Object.keys(document.components.schemas).length} schémas, ${parRubrique.size} rubriques.`,
)
