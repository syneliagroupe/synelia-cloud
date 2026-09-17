# API Synelia Cloud — contrat backend

`openapi.json` décrit **tout ce que le portail attend du backend** : 546 opérations
sur 381 chemins, 242 schémas (compte affiché par `bun run api:spec` à chaque
exécution — ne le recopiez pas en dur ailleurs, il dérive). Document
OpenAPI 3.0.3 valide, directement exploitable par Swagger UI, Redoc ou un
générateur de client.

Le backend est à construire séparément : cette spécification ne présume rien de
l'implémentation. Les hyperviseurs, l'orchestrateur, l'annuaire et les solutions
libres du catalogue restent derrière ces points d'entrée — aucun n'apparaît dans
le contrat.

## Le fichier est généré

```bash
bun run api:spec        # ou : node outils/openapi/index.mjs
```

Ne l'éditez pas à la main : éditez `outils/openapi/`, puis régénérez. Le
générateur **refuse d'écrire un document incohérent** — référence morte,
`operationId` en doublon, paramètre de chemin non déclaré, `GET` avec corps,
résumé manquant. Une erreur à la génération vaut mieux qu'un client généré qui
compile et ne marche pas.

| Fichier | Contenu |
|---|---|
| `socle.mjs` | fabriques de schémas, paramètres et réponses communs, fabrique d'opérations, gabarit CRUD |
| `schemas-socle.mjs` | erreurs, enveloppes, identité, IaaS, protection |
| `schemas-produits.mjs` | applicatif, projets, services managés, Web Cloud, commerce, exploitation |
| `schemas-transverses.mjs` | recherche, copilote, onboarding, anomalies, attestations, prospects, clés SMTP |
| `chemins-*.mjs` | les chemins, par domaine |
| `index.mjs` | assemblage, vérifications, écriture |

Vérifier et consommer :

```bash
bunx @redocly/cli lint docs/api/openapi.json
bunx @redocly/cli preview-docs docs/api/openapi.json
bun run api:derive   # dérive types.ts ↔ contrat — ne générez pas de types sous src/
```

`api:derive` compare `src/lib/types.ts` au contrat par une table de
correspondance (`outils/contrat/correspondances.ts`, les noms diffèrent :
`VM`↔`Vm`, `K8sCluster`↔`ClusterK8s`…) plutôt qu'un diff textuel. Informatif
par défaut ; `CONTRAT_STRICT=1` le rend bloquant sur le niveau 1 (clés en trop
ou manquantes). Le niveau 2 (assignabilité bidirectionnelle) reste informatif
plus longtemps — voir `outils/contrat/derive.mjs`.

## Conventions

| Sujet | Règle |
| --- | --- |
| Base | `/v1`, réponses en `application/json; charset=utf-8` |
| Langue | Champs et libellés en français, comme `src/lib/types.ts`. `Accept-Language` gouverne les libellés, jamais les clés |
| Montants | Entiers en FCFA (XOF), hors taxes |
| Dates | ISO 8601 en UTC |
| Collections | Enveloppe `{ donnees, pagination }` · paramètres `page`, `parPage`, `tri`, `ordre`, `q` |
| Ressource unique | Objet à la racine, sans enveloppe |
| Multi-tenant | L'organisation vient du jeton ; `X-Organisation-Id` la remplace pour un utilisateur qui appartient à plusieurs organisations |
| Opérations longues | `202` + `TravailProvisioning`, suivi par `GET /travaux/{travailId}` |
| Erreurs | `{ erreur: { code, message, correlationId } }` — le `correlationId` est toujours présent |
| Secrets | Mots de passe, clés privées et jetons ne sont renvoyés qu'à la création ou à la rotation |
| Actions destructives | Paramètre `confirmation` valant le nom exact de la ressource. Un écart renvoie `422` **sans rien détruire** |
| Actions facturables | `POST /facturation/estimation` renvoie l'aperçu de coût avant l'engagement |
| Intégration amont en défaut | `424` avec `integration`, `donneesPartielles` et `dateDonnees`, pour un écran dégradé daté plutôt qu'une page vide |

Les noms de champs des ressources reprennent **exactement** ceux de
`src/lib/types.ts`. L'interface les consomme tels quels : renommer un champ ici,
c'est casser un écran.

## Périmètres

- **`/**`** — espace client. Le jeton porte l'organisation active ; toute
  collection est implicitement filtrée sur elle. `GET /vms` ne retourne jamais
  les machines d'un autre tenant.
- **`/admin/**`** — espace super admin, réservé aux rôles `super_admin` et
  `platform_operator`. Voit toutes les organisations. Il n'y a pas de troisième
  famille de rôles : la plateforme ne connaît que le client et le super admin.
- **`/public/**`** — vitrine, sans authentification.

## Autorisations

352 opérations portent l'extension `x-rbac` avec l'identifiant d'action de
`src/lib/rbac.ts` (`vm.create_delete`, `dr.failover.real`…). Un refus retourne
`403` avec `rolesRequis` : le portail **désactive** l'action et nomme le rôle
attendu, il ne masque pas le bouton. Tout refus est journalisé dans l'audit.

`rolesRequis` est un tableau, pas un rôle unique : `messageRefus()` écrit
« Cette action demande le rôle Org Admin ou Espace Cloud Admin », ce qu'un champ
singulier ne saurait pas dire.

`GET /rbac/matrice` sert la matrice complète, `GET /moi` les permissions
effectives de la session.

## Répartition des opérations

| Domaine | Opérations |
|---|---|
| Authentification, compte, organisations, membres, sécurité, audit | 61 |
| Tableau de bord, travaux, recherche, copilote, anomalies | 13 |
| IaaS — espaces, machines, Kubernetes, réseau, stockage, bases | 107 |
| Sauvegarde et PRA | 21 |
| Plateforme applicative — applications, déploiements, projets, modèles | 63 |
| Observabilité | 9 |
| Services managés | 24 |
| Web Cloud — domaines, hébergement, applications, bases, emails, drive, SSL, sauvegarde, SMTP | 104 |
| Facturation, support, documentation | 37 |
| Espace super admin | 57 |
| Vitrine publique | 18 |

Verbes : 212 `GET`, 169 `POST`, 55 `DELETE`, 51 `PATCH`, 27 `PUT`.

## Ce que l'API ne fait pas

Le portail ne réimplémente aucun produit externe : ni webmail, ni explorateur de
fichiers, ni écran métier d'ERP, ni éditeur de contenu de CMS, ni constructeur
de requêtes de journaux. L'API expose donc :

- des points d'entrée d'**ouverture** — `POST /services/{id}/ouverture`,
  `POST /web/emails/{id}/ouverture`, `POST /web/drive/{id}/ouverture` retournent
  une URL SSO à usage unique vers l'interface d'origine de la solution ;
- une observabilité **bornée** à quatre formats — `Tuile`, `Serie` (fenêtres
  `24h`, `7j`, `30j` uniquement), liste d'événements (huit lignes),
  `ExtraitLogs` (vingt lignes) — plus les liens de sortie (`LiensSortie`) vers
  Centreon, Grafana et VictoriaLogs. Le backend n'a pas à servir de moteur de
  requêtes.

Deux règles du produit que le contrat fait respecter plutôt que documenter :

- **Un domaine est attaché à un serveur et à un seul.**
  `POST /web/hebergements/{id}/attachement-domaine` refuse (`409`) un nom déjà
  attaché ailleurs, et `GET /web/domaines/{id}` renvoie en une réponse tout ce
  qui concerne le nom — hébergement, zone, messagerie, drive, certificats, sites.
- **Les bases mutualisées n'ont aucun accès distant.** `hoteInterne` est une
  boucle locale, et aucun point d'entrée ne permet de l'ouvrir : c'est une
  propriété de l'offre, pas un réglage.

## Écarts connus

- Le serveur de développement (`http://localhost:4000/v1`) déclenche
  l'avertissement `no-server-example.com` chez Redocly. Il est conservé : il sert
  au branchement local de l'interface.
- Les téléversements passent par du base64 en JSON (`POST /support/pieces`),
  pas par `multipart/form-data` : un seul format de corps dans tout le contrat
  simplifie les clients générés. À revoir si des pièces lourdes apparaissent.
- Le registre d'images privé n'est plus décrit : son écran a disparu de l'espace
  client. À rétablir si la construction d'images revient dans l'interface.
