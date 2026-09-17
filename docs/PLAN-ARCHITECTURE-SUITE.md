# Plan d'exécution — suites de la revue d'architecture

Date : 2026-09-08. Auteur : Fable 5.1 (consultant architecture), à la suite de
`docs/ARCHITECTURE-REVIEW-FABLE.md`. Destinataires : les agents de codage qui
exécutent, dans l'ordre, les trois chantiers ci-dessous. Chaque section est
autonome ; les sections 2 et 3 touchent toutes deux `package.json` et
`tsconfig.json`, donc exécutez-les l'une après l'autre, pas en parallèle.

Faits vérifiés le 2026-09-08 sur lesquels ce plan repose (ne pas re-dériver) :

- Dépôt sur la branche `dev01-real-infra`, arbre propre hormis
  `docs/ARCHITECTURE-REVIEW-FABLE.md` non suivi. bun 1.4.2, node 24, Playwright
  `1.62.1` déjà en devDependency (avec un caret, seule entrée non épinglée).
  Aucun fichier de test, aucune configuration Vitest/Jest, aucun `@types/bun`.
- `src/lib/api/client.ts` : `estActif()` = `!!process.env.NEXT_PUBLIC_API_URL`,
  évalué à la construction (Next inline la variable). `.env.local` du dépôt
  pointe sur `http://localhost:4000/v1`. Session en `localStorage` sous la clé
  `synelia.session` (forme `SessionApi`).
- `src/lib/api/collections.ts` : `REGISTRE_COLLECTIONS` a 58 entrées littérales
  plus quatre motifs à suffixe (`snapshots-`, `services-`, `variables-`,
  `elevations-`) ; `champConfirmation()` liste dix collections dont la
  confirmation n'est pas `nom`.
- 137 sites `estActif()` et 229 `appel:` dans `src/`.
- `docs/api/openapi.json` : 381 chemins, 242 schémas (le README annonce
  364/218 et CLAUDE.md « 527 opérations » — les trois nombres divergent).
  `src/lib/types.ts` : 84 exports (`interface`/`type`). Les noms de schémas ne
  sont pas ceux de `types.ts` (`VM`↔`Vm`, `K8sCluster`↔`ClusterK8s`,
  `Network`↔`Reseau`, `PublicIP`↔`IpPublique`…) : un diff textuel est
  impossible, il faut une table de correspondance.
- `bunx openapi-typescript@7.13.0 docs/api/openapi.json` fonctionne sur ce
  contrat tel quel (35 095 lignes, 521 ms) : `Vm` sort avec les enums littéraux
  attendus, `ReponseErreurValidation` sort avec `erreur` et `champs` frères
  (la forme réelle du backend depuis le 2026-09-05), `TravailProvisioning`
  sort complet. Aucune adaptation du générateur n'est nécessaire.
- Backend : `/var/lib/synelia-cloud/synelia-cloud-backend`, un module par
  domaine sous `apps/synelia/synelia/modules/<module>/router.py`, connecteurs
  amont par paire `*Simule`/`*OpenStack|*Reel` dans
  `packages/openstack/synelia_openstack/`. CORS par défaut `["*"]`
  (`packages/kernel/synelia_kernel/config.py`), non restreint sur dev01. API de
  référence : `https://api.synelia.dev01.ovh.smile.ci/v1` (répond 200 sur
  `/public/statut` ce jour). Compte d'amorçage `admin@synelia.cloud` /
  `Synelia!2026` (README backend, `SYNELIA_SEED_*`). Chaque `DELETE`
  destructif passe par `exiger_confirmation(<champ>, confirmation)` — les
  champs sont relevés section 3.
- Le laboratoire OpenStack s'éteint seul chaque soir vers 21:01 UTC ; l'API
  répond alors `424` sur tout ce qui touche Nova/Neutron. Toute suite de tests
  réels doit le détecter et se déclarer non exécutée, pas échouer.

---

## 1. Vérité documentaire — `CLAUDE.md`

### Décision

Réécriture chirurgicale de `CLAUDE.md`, pas de refonte : on corrige les
passages qui décrivent une maquette sans réseau, on ajoute une section courte
sur la couture `estActif()`, et l'état réel/simulé détaillé va dans
`docs/BRANCHEMENT-API.md` (qui est déjà le document de la couture, jamais
référencé depuis `CLAUDE.md` — c'est le premier défaut à corriger). `CLAUDE.md`
n'en garde qu'un résumé par univers et le vocabulaire à quatre états. Raison :
`CLAUDE.md` fait 625 lignes et est lu par chaque agent à chaque session ; une
table de soixante collections y coûterait plus qu'elle n'apporte, alors que
dans `BRANCHEMENT-API.md` elle est à côté du mécanisme qu'elle décrit.

Vocabulaire à employer partout, quatre états et pas un de plus :

| État | Sens |
|---|---|
| **réel** | le backend répond et pilote un amont réel (Nova, Neutron, Cinder, Magnum, Octavia, Designate, MinIO, Zimbra, LiteLLM/OpenRouter, SSH) |
| **persisté** | le backend répond depuis sa base ; il n'y a pas d'amont à piloter par nature (membres, jetons, tickets, factures, journal d'audit…) |
| **simulé côté backend** | le backend répond `2xx`/`202` mais l'amont est un stub vide ou l'exécuteur n'appelle rien : un faux succès |
| **maquette seule** | la collection n'est pas dans le registre, ou l'écran lit une graine : rien ne part vers le backend même en mode API |

### Étapes

**1.1 — Dériver la table « état par collection » (fichier de travail, pas de code).**

1. Lister les clés de `REGISTRE_COLLECTIONS` et les quatre motifs à suffixe
   de `endpointDe()` (`src/lib/api/collections.ts`), avec leur endpoint.
2. Pour chaque endpoint, trouver le module backend : préfixe de chemin →
   `apps/synelia/synelia/modules/<module>/router.py` (les préfixes sont posés
   dans les `include_router` de `apps/synelia/synelia/app.py` ; `web_hebergement`
   a trois routeurs : `router_hebergements.py`, `router_sites.py`,
   `router_bases.py`).
3. Classer le module : ouvrir `service.py` (ou l'équivalent) et chercher
   `amont()`, `Simule`, `OpenStack`, `Reel`, `k8s_workload`, `ssh`. Présence
   d'un connecteur appelé dans l'exécuteur de la mutation → **réel** ; module
   sans connecteur parce qu'il n'en a pas besoin (`auth`, `compte`,
   `organisations`, `membres`, `securite`, `support`, `facturation`, `audit`,
   `admin_catalogue`, `travaux`, `tableau_de_bord`, `conformite`,
   `transverses`, `docs`) → **persisté** ; connecteur existant mais jamais
   appelé, ou stub vide → **simulé côté backend**.
4. Appliquer les exceptions connues, vérifiées dans le code backend avant de
   les écrire (elles viennent des passes de test des 2026-09-05/07, pas du
   présent plan) :
   - `services_manages` (`/services`) : aucun connecteur, phase 7 non
     construite → simulé côté backend. Vérifier au passage qu'aucune clé du
     registre ne pointe dessus (aujourd'hui aucune : `services-<projetId>` va
     vers `projets`, qui est réel).
   - `web_domaines` (`domaines` → `/web/domaines`) : `RegistrarOpenStack` est
     un stub vide → simulé côté backend (commande, transfert, code-auth).
   - `web_hebergement/router_bases.py` (`serveurs-bases` → `/web/bases`) :
     aucun MariaDB mutualisé derrière → simulé côté backend.
   - `vms` : création, arrêt/démarrage, redimensionnement, suppression,
     instantané (création) réels ; **restauration d'instantané** simulée
     (`ExecuteurVmRestore` n'a pas d'`etape()` réelle). Une même collection
     peut donc porter deux états : le dire action par action quand c'est le cas.
   - `web_ssl` : réel dans le code, jamais vérifié en direct (pas de
     `SYNELIA_ACME_URL` sur le laboratoire) → écrire « réel, non vérifié en
     direct ».
   - `sauvegarde`/`pra` : réels et honnêtes sur l'échec ; ne pas les
     reclasser.
   - `ia_agents` : agents (création, publication, invocation), clés
     (création, rotation, révocation), flux (exécution) réels via
     LiteLLM/OpenRouter ; `connaissances` à vérifier dans
     `modules/ia_agents/connaissances.py` (marqué « simulation » dans le
     code) ; la collection `modeles-ia` est un catalogue persisté dont seuls
     les modèles `invocable: true` sont réels.
   - `admin/backends` : la capacité vient de Nova depuis le 2026-09-07 → réel.
5. Lister les collections **maquette seule** : `grep -rhoE
   "useCollection(<[^>]*>)?\(\s*'[a-z-]+'" src | sort -u`, retirer celles du
   registre et des motifs à suffixe ; ajouter les lectures de graine hors
   `useCollection` qui restent (séries de supervision `seededSeries`, journaux
   `LogPeek`, composants serveur qui importent `src/lib/mock/` directement —
   `grep -rl "from '@/lib/mock" src/app --include=page.tsx` puis ne garder que
   les composants sans `'use client'`).
6. Ne rien vérifier en direct pour cette étape : la table s'appuie sur le code
   backend lu et sur les passes citées. Là où le doute subsiste, écrire « à
   vérifier » plutôt qu'un état.

**1.2 — Écrire la table dans `docs/BRANCHEMENT-API.md`.**

Nouvelle section finale `## État réel par collection (2026-09-08)`, introduite
par les quatre définitions ci-dessus, puis une table
`collection | endpoint | module backend | état | remarque`. Une ligne par clé du
registre, une par motif à suffixe, puis un paragraphe « Maquette seule » avec
la liste de l'étape 1.1.5. Ajouter en tête de fichier une phrase : « Ce
document décrit la couture ; `CLAUDE.md` en donne le résumé. » Mettre à jour
son titre (« vague 1 » ne décrit plus le contenu).

**1.3 — Réécrire `CLAUDE.md`, passage par passage.** Les repères sont donnés
par titre et premiers mots, pas par numéro de ligne (ils bougent).

| Passage | Verdict | Quoi faire |
|---|---|---|
| En-tête, « Maquette fonctionnelle … Aucun appel réseau, aucune base. » | **Faux** | Remplacer par deux paragraphes : (1) console Next.js à trois espaces, deux modes de fonctionnement décidés à la construction par `NEXT_PUBLIC_API_URL` — sans elle, tout vient de `src/lib/mock/` et rien ne part sur le réseau ; avec elle, les collections du registre lisent et **écrivent** sur le backend FastAPI (dépôt frère `synelia-cloud-backend`), qui pilote un vrai OpenStack, Zimbra, Designate, OpenRouter ; (2) renvoi : « la couture est décrite dans `docs/BRANCHEMENT-API.md`, l'état réel/simulé collection par collection aussi ». Ne plus employer le mot « maquette » pour désigner l'application ; le réserver au mode. |
| « Le cahier des charges d'origine… » | Exact | Ne pas toucher. |
| Table « Outillage » | Incomplet | Ajouter trois lignes : `Tests unitaires — bun test`, `Tests d'intégration (backend réel) — bun run test:integration`, `Dérive du contrat — bun run api:derive` (les scripts sont créés sections 2 et 3 ; écrire ces lignes **après** qu'ils existent). Ajouter sous la table une phrase : la construction fige le mode ; `NEXT_PUBLIC_API_URL= bun run build` force le mode maquette même avec un `.env.local` présent (une variable déjà dans l'environnement l'emporte sur `.env.local`). |
| « Les versions des dépendances sont épinglées à l'exact » | Exact, non respecté | Ne pas modifier le texte ; la section 3 épingle `playwright` à `1.62.1`. |
| « ### Le contrat d'API », première phrase « …que le backend doit servir pour remplacer `src/lib/mock/` » | **Périmé** | Le backend le sert déjà et le consomme : `uv run tools/contrat_sync.py ../synelia-cloud` côté backend copie `openapi.json` et régénère ses modèles. Supprimer le nombre d'opérations (il diverge déjà entre trois fichiers) ou le remplacer par « le générateur affiche le compte à chaque exécution ». Ajouter une phrase sur `bun run api:derive` et `outils/contrat/correspondances.ts` (section 2). Garder le reste (générateur, refus d'écrire un document incohérent, conventions, noms de champs). |
| « ### L'audit » | Exact, incomplet | Ajouter : l'audit tourne **en mode maquette** (sans `NEXT_PUBLIC_API_URL`) ; ses zéros ne disent rien du mode API, que couvrent les tests d'intégration. Remplacer « les 191 routes » par « les routes de `outils/routes.json` » (le fichier en compte 189 aujourd'hui). |
| « ## Les images de la vitrine » | Exact | Ne pas toucher. |
| « ## Règles… », paragraphe *ponytail* « Cette maquette a 106 routes » | Périmé | « Ce portail a ~130 routes de page » — ou, mieux, retirer le nombre. Garder la règle. |
| « Cinq états par écran » | Exact | Ajouter une demi-phrase : en mode API, `chargement`/`erreur` viennent de `useCollection` et le dégradé de `useLectureDegradable` (`src/lib/api/degradable.ts`, `424`). |
| « ## L'atelier — l'état mutable de la démonstration », premier paragraphe | Partiel | Garder tout le mécanisme. Reformuler la première phrase : l'atelier est l'état mutable **du mode maquette** et, dans les deux modes, l'hôte du cache distant (`CACHE_DISTANT`). Puis **ajouter une sous-section `### Le mode API`** (12–15 lignes) : `estActif()` ; le registre `collections.ts` (une nouvelle collection n'existe côté API que si elle y a une entrée) ; `useCollection` charge `GET {endpoint}?parPage=200` dans un effet, la graine s'affiche jusqu'à la première réponse ; `creer/modifier/supprimer` appellent `POST`/`PATCH`/`DELETE ?confirmation=` puis `recharger()` ; `useEntite` pour une fiche dont l'item n'est pas dans la liste ; `useOperation` exécute `appel` et suit un `202` par `suivreTravail` — **règle : `effet` ne rejoue jamais en mode API, `effetFinal` fait `recharger()`** ; la confirmation d'un `DELETE` utilise `champConfirmation()` (dix exceptions à `nom`, relevées du backend). Renvoi vers `docs/BRANCHEMENT-API.md` pour le détail et l'état par collection. |
| « ### Deux ateliers, un seul retenu » | Exact | Ne pas toucher. |
| « ### Le catalogue des opérations longues » | Partiel | Garder. Ajouter un paragraphe : en mode API, le job affiché est le `TravailProvisioning` du backend (sondé toutes les 1,5 s, fondu dans la collection `jobs` par `integrerTravail`) ; durées annoncées et échecs volontaires ne s'appliquent qu'en mode maquette ; le backend partage le vocabulaire des workflows via `contrat_sync` (`tools/exporter_frontend.mts` lit `src/lib/mock/workflows.ts`) — renommer un workflow ici casse le backend. |
| « ### Les exports », phrase « la phrase qui dit qu'aucun courriel ne part d'une maquette » | **Périmé** | En mode API, `FormulaireSite` poste réellement sur `/public/contact` et `/public/devis` (`src/lib/api/public.ts`). Lire le texte réel du composant `src/components/site/formulaire.tsx` ; si la phrase est inconditionnelle, la rendre conditionnelle à `estActif()` (petit correctif d'interface, à faire dans ce chantier), puis écrire ce que le composant dit vraiment. |
| « ## Architecture de la navigation » et ses sous-sections | Exact | Ne pas toucher. |
| « ## Décisions déjà arbitrées », ligne « Socle du PaaS … Sans effet sur la maquette » | Périmé | « Réel depuis 2026-09-07 : Magnum pilote les clusters clients et le cluster PaaS des projets. » |
| Même table, autres lignes | Exact | Ne pas toucher. |
| « ## Pièges techniques rencontrés » | Exact, incomplet | Ajouter deux pièges : (1) le mode est figé à la construction — un `next start` bâti avec `.env.local` sert le mode API, l'audit y verra des appels réseau ; (2) dans un test Playwright, `waitForURL(/\/app/)` matche déjà `https://app.synelia…/login` — utiliser `u => u.pathname.startsWith('/app')`. |
| « ## Ce qui reste à faire », point 5 (`/app` composant serveur) | À vérifier | Le commit `fb0e455` (2026-09-08) a touché `src/app/app/tableau-de-bord.tsx` ; relire et corriger le point si le tableau lit désormais les collections. Ajouter un renvoi : « les écarts réel/simulé sont tenus dans `docs/BRANCHEMENT-API.md` ». |
| « ## Branches et intégration », séquence de fin de changement | Incomplet | Ajouter `bun test` à la séquence, et `bun run api:derive` (informatif) après le build. |
| « ## Déploiement » | Incomplet | Ajouter un paragraphe « Deux cibles » : Vercel (ce qui est écrit reste vrai) et le bac à sable dev01 `https://app.synelia.dev01.ovh.smile.ci`, construit **avec** `NEXT_PUBLIC_API_URL` par `/var/lib/synelia-cloud/deploy-dev01/redeploy-front.sh [ref]` (défaut `branchement-api` — vérifier le défaut au moment d'écrire, la branche de travail actuelle est `dev01-real-infra`). Pour Vercel, n'écrire que ce que `bunx vercel@latest env ls --token "$VERCEL_TOKEN"` montre ; si l'agent ne peut pas l'exécuter, écrire « production Vercel : mode maquette au dernier relevé (2026-09-05), à confirmer ». |

Corrections annexes, même chantier :

- `src/lib/types.ts`, en-tête : « Toutes les données de l'application sont
  fictives (Partie 11). » → « Modèle de données partagé par la maquette
  (`src/lib/mock/`) et le contrat d'API (`docs/api/openapi.json`) ; les noms de
  champs y font foi. »
- `docs/api/README.md` : rafraîchir la première ligne avec les nombres que
  `bun run api:spec` affiche ; remplacer la suggestion
  `bunx openapi-typescript … -o src/lib/api/types.d.ts` par « `bun run api:derive`
  (section 2) — ne générez pas de types sous `src/` ».

**1.4 — Vérifier.**

- `bun run typecheck && bun run lint && bun run build` (la 1.3 peut toucher
  `formulaire.tsx`).
- Relire `CLAUDE.md` en entier une fois : le mot « maquette » ne doit plus
  désigner l'application ; chaque nombre restant doit être vrai ce jour ou
  absent.
- `grep -n "Aucun appel réseau\|fictives" CLAUDE.md src/lib/types.ts` ne doit
  plus rien renvoyer.
- Commit dédié (`docs : CLAUDE.md dit le vrai sur les deux modes`), sans
  mélange avec les sections 2 et 3.

---

## 2. Couplage typé au contrat — dérive `types.ts` ↔ `openapi.json`

### Décision

- **Outil** : `openapi-typescript` 7.13.0, invoqué par `bunx openapi-typescript@7.13.0`
  (version épinglée dans la chaîne du script), **pas** ajouté en devDependency.
  Raison : 103 paquets transitifs entreraient dans chaque installation Vercel
  pour un contrôle de développement purement informatif ; l'audit traite déjà
  Playwright de cette manière. Si l'équipe préfère une version gouvernée par
  le verrou, `bun add -d openapi-typescript@7.13.0` est l'alternative en une
  ligne — l'un ou l'autre, pas les deux.
- **Sortie générée** : `outils/contrat/contrat.genere.d.ts`, **ignorée par git**
  et régénérée à chaque contrôle. Raison : c'est une fonction déterministe
  d'un fichier déjà versionné ; la versionner créerait une seconde copie de
  la même information avec sa propre dérive et 35 000 lignes de bruit par
  changement de contrat. Elle ne doit **jamais** être importée depuis `src/`.
- **Forme du contrôle** : pas un diff textuel (les noms diffèrent) mais des
  assertions de types compilées par `tsc` sur une table de correspondance
  écrite à la main, `outils/contrat/correspondances.ts`. Deux niveaux :
  clés en trop / clés manquantes (niveau 1, messages nets), puis
  assignabilité bidirectionnelle (niveau 2, plus bruyant, derrière `--strict`).
- **Mode** : informatif d'abord. Le script imprime la dérive et sort `0` ;
  `--strict` (ou `CONTRAT_STRICT=1`) fait sortir `1`. On ne passe en strict
  qu'une fois la dérive réconciliée à la main — jamais par réécriture en bloc
  de `types.ts`.
- **CI** : nouveau workflow `.github/workflows/qualite.yml` (typecheck, lint,
  `bun test`, `api:derive` informatif). Pas de `build` : Vercel construit
  déjà chaque push, le doubler ne dirait rien de plus.

### Étapes

**2.1 — Isoler le dossier du contrôle du typecheck principal.**

- `tsconfig.json` : `"exclude": ["node_modules", "outils/contrat"]`. Sans
  cela, `**/*.ts` ferait entrer les assertions dans `bun run typecheck` et
  `next build`, et le contrôle ne serait plus informatif.
- Créer `tsconfig.contrat.json` :
  `{ "extends": "./tsconfig.json", "compilerOptions": { "plugins": [], "incremental": false, "noEmit": true }, "include": ["outils/contrat/**/*.ts", "src/lib/types.ts"] }`.
- `.gitignore` : ajouter `outils/contrat/contrat.genere.d.ts`.
- Vérifier : `bun run typecheck` inchangé ; `tsc -p tsconfig.contrat.json`
  échoue seulement parce que le fichier généré n'existe pas encore.

**2.2 — Écrire la table de correspondance `outils/contrat/correspondances.ts`.**

Forme :

```ts
import type { components } from './contrat.genere'
import type * as T from '@/lib/types'
export type Schemas = components['schemas']

/** Un export de types.ts → son schéma, ou `null` avec la raison. */
export const CORRESPONDANCES = {
  VM: 'Vm',
  K8sCluster: 'ClusterK8s',
  Network: 'Reseau',
  PublicIP: 'IpPublique',
  SecurityGroup: 'GroupeSecurite',
  VpnTunnel: 'TunnelVpn',
  ManagedDatabase: 'BaseManagee',
  BackupPlan: 'PlanSauvegarde',
  RestorePoint: 'PointRestauration',
  DRPlan: 'PlanPra',
  ConformiteLigne: 'LigneConformite',
  User: 'Utilisateur',
  Application: 'ApplicationPaas',
  Environment: 'Environnement',
  Component: 'Composant',
  Deployment: 'Deploiement',
  WebHosting: 'Hebergement',
  DnsZone: 'ZoneDns',
  Offer: 'Offre',
  Subscription: 'Souscription',
  Invoice: 'Facture',
  AuditEvent: 'EvenementAudit',
  ProvisioningJob: 'TravailProvisioning',
  AlerteRegle: 'RegleAlerte',
  ManagedService: 'ServiceManage',
  Site: null, // énumération inline dans le contrat (socle.mjs SITES)
  // …
} as const satisfies Record<string, keyof Schemas | null>
```

Le `satisfies` valide les **valeurs** (chaque nom de schéma existe dans le
contrat généré : une faute de frappe ou un schéma renommé casse la table). Il
ne peut pas valider les **clés** : TypeScript ne sait pas énumérer les types
exportés d'un module (`keyof typeof T` ne verrait que `SITE_LABEL` et
`SITE_COURT`, les seuls exports valeur). La complétude des clés est donc
vérifiée par `derive.mjs` (2.4, étape 3) par lecture de `types.ts`.

Procédure pour la remplir (84 exports, faites-le en une passe) :

1. Nom identique dans les deux fichiers → écrire le nom.
2. Renommage évident → la liste ci-dessus est un point de départ, pas la
   vérité : ouvrir les deux définitions et confirmer que les champs se
   recouvrent avant d'écrire la paire. `Membership` peut correspondre à
   `Membre` ou `AppartenanceOrganisation` : choisir sur les champs, écrire le
   choix en commentaire.
3. Alias d'union (`Site`, `Role`, `ScopeType`, `BackendType`, `Devise`,
   `TypeSiteWeb`, `TypeServiceProjet`, `MoteurBase`, `CategorieService`,
   `HebergementModele`, `FamilleModele`, `ClasseDonnees`, `TypeAgent`,
   `CategorieOutil`, `TypeCanal`, `TypeEtape`…) → `null`, raison
   « énumération inline » ; un niveau 3 comparant les littéraux est possible
   plus tard, hors périmètre.
4. Types sans équivalent dans le contrat (`DefinitionWorkflow`, `GardeFou`,
   `VariableAgent`, `VersionAgent`, `OutilAgent`, `CanalAgent`, `Seat`…) →
   `null` avec la raison (« écran seul », « IA hors MVP backend »…).
5. La table doit être **complète** : `derive.mjs` compare les clés aux
   `^export (interface|type) <Nom>` de `types.ts` et signale tout export absent
   comme « non classé » — informatif d'abord, bloquant en `--strict`. C'est ce
   qui empêche qu'un nouveau type échappe au contrôle.

**2.3 — Écrire les assertions `outils/contrat/verification.ts`.**

```ts
import type * as T from '@/lib/types'
import type { Schemas } from './correspondances'

/** Échoue en nommant la clé : « Type '"foo"' does not satisfy the constraint 'never' ». */
type Aucune<K extends never> = K
type EnTropDansTypes<A, S> = Exclude<keyof A, keyof S>   // dans types.ts, pas au contrat
type ManqueDansTypes<A, S> = Exclude<keyof S, keyof A>   // au contrat, pas dans types.ts

// Niveau 1 — une ligne par paire, dans l'ordre de CORRESPONDANCES.
type VM_1 = Aucune<EnTropDansTypes<T.VM, Schemas['Vm']>>
type VM_2 = Aucune<ManqueDansTypes<T.VM, Schemas['Vm']>>
// …

// Niveau 2 — derrière CONTRAT_STRICT (voir derive.mjs) : assignabilité dans les deux sens.
type Compatible<A, S> = [A] extends [S] ? ([S] extends [A] ? true : never) : never
type VM_3 = Aucune<Compatible<T.VM, Schemas['Vm']> extends true ? never : 'incompatible'>
```

Générer les lignes de niveau 1 et 2 **mécaniquement** depuis la table (un
petit `node` de dix lignes lancé une fois, ou à la main) ; ne pas les garder
synchronisées à la main — le script `derive.mjs` (2.4) vérifie que chaque
paire non nulle de `CORRESPONDANCES` a ses trois lignes, et le dit sinon.

Champs de démonstration : `Organisation.espaces?`, `utilisateurs?`,
`caMensuel?`… sont annotés « Champs de démonstration côté super admin » dans
`types.ts`. Les recenser dans `correspondances.ts` sous
`CHAMPS_MAQUETTE: Partial<Record<keyof typeof T, readonly string[]>>` et les
retirer de `EnTropDansTypes` via `Omit` dans l'assertion — avec la raison. Un
champ qu'aucun écran n'affiche en mode API n'est pas une dérive.

**2.4 — Écrire le script `outils/contrat/derive.mjs`** (Node, sans dépendance,
sur le modèle de `outils/openapi/index.mjs`) :

1. **Fraîcheur du contrat** : lancer `node outils/openapi/index.mjs`, puis
   `git diff --quiet -- docs/api/openapi.json`. Si le fichier a changé :
   avertir « `openapi.json` n'était pas régénéré depuis le générateur »
   (c'est exactement l'erreur corrigée à la main dans le commit `035d315`).
   Laisser le fichier régénéré en place : c'est le bon.
2. **Génération** : `bunx openapi-typescript@7.13.0 docs/api/openapi.json -o outils/contrat/contrat.genere.d.ts`
   (options par défaut ; ne pas passer `--enum`, les unions littérales sont
   ce que `types.ts` utilise).
3. **Complétude** : (a) extraire les `^export (interface|type) (\w+)` de
   `src/lib/types.ts` et les comparer aux clés de `CORRESPONDANCES` — tout
   export absent est « non classé » ; (b) vérifier que chaque paire non nulle
   a ses lignes `_1`, `_2`, `_3` dans `verification.ts` ; lister les
   manquantes. (Lire `correspondances.ts` par une regex sur les clés suffit :
   la table est plate et littérale par construction.)
4. **Compilation** : `tsc -p tsconfig.contrat.json --pretty false` ; parser
   `fichier(ligne,col): error TSxxxx: message`, rattacher chaque erreur à la
   ligne de `verification.ts` (donc à la paire et au niveau), imprimer un
   tableau `paire | niveau | détail` puis un résumé
   `N paires · M en dérive (niveau 1) · P incompatibles (niveau 2)`.
   Hors `--strict`, ne compter que le niveau 1 dans le résumé et lister le
   niveau 2 à part sous « informatif ».
5. **Sortie** : `0` toujours, sauf `--strict`/`CONTRAT_STRICT=1` et dérive
   > 0 → `1`. Si `GITHUB_STEP_SUMMARY` est défini, y écrire le tableau.

`package.json` : `"api:derive": "node outils/contrat/derive.mjs"`.

**2.5 — Première exécution et réconciliation à la main.**

Attendu : des dizaines de lignes en dérive (le contrat a été édité pendant
des mois sans contrôle). Règles de réconciliation, une par cas, **un commit
par lot cohérent**, jamais de renommage :

- Champ dans `types.ts`, affiché par un écran, absent du contrat → l'ajouter
  au générateur (`outils/openapi/schemas-*.mjs`), `bun run api:spec`, et
  noter dans le message de commit que le backend le verra apparaître dans
  `uv run python tools/contrat_diff.py`.
- Champ dans le contrat (donc servi par le backend), absent de `types.ts` →
  l'ajouter à `types.ts` en **optionnel**. Aucun écran ne casse.
- Champ de démonstration → `CHAMPS_MAQUETTE`, avec la raison.
- Nom différent pour la même chose (`hoteInterne` vs `hote`, ce genre) →
  **ne pas trancher seul** : lister dans le résumé final pour décision
  humaine ; le backend sert déjà l'un des deux à de vrais écrans.
- Écart d'énumération au niveau 2 (`statut` avec une valeur de plus d'un
  côté) → même règle : le côté qui manque une valeur la reçoit, jamais de
  suppression.

Après chaque lot : `bun run typecheck && bun run lint && bun run build`, puis
`bun run api:derive` pour voir le compte baisser. Quand le niveau 1 est à
zéro, passer `CONTRAT_STRICT=1` dans le workflow (2.6). Le niveau 2 peut
rester informatif plus longtemps ; le dire dans `docs/api/README.md`.

**2.6 — Workflow `.github/workflows/qualite.yml`.**

```yaml
name: Qualité
on: { push: { branches: ['**'] }, pull_request: {} }
jobs:
  verifier:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: '1.4.2' }     # bun.lock v2 exige ≥ 1.4.0
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun test
      - run: bun run api:derive             # informatif ; CONTRAT_STRICT=1 quand la dérive est à zéro
```

Commentaire d'en-tête à la manière de `vercel.yml` : pourquoi pas de build
ici, pourquoi la dérive est informative, et la variable qui la rend bloquante.

**2.7 — Vérifier.**

- `bun run typecheck`, `bun run lint`, `bun run build` : inchangés (rien sous
  `src/` n'importe le fichier généré ; `outils/contrat` est exclu).
- `rm outils/contrat/contrat.genere.d.ts && bun run api:derive` : régénère et
  imprime le tableau ; code de sortie `0` ; `CONTRAT_STRICT=1 bun run api:derive`
  sort `1` tant qu'il reste une dérive.
- Introduire volontairement un champ bidon dans `interface VM` : le tableau
  nomme `VM` et le champ ; retirer.
- `git status` : `contrat.genere.d.ts` n'apparaît pas.
- Documenter dans `docs/api/README.md` (section « Vérifier et consommer ») et
  dans `CLAUDE.md` (table Outillage et « Le contrat d'API », section 1).

---

## 3. Tests versionnés pour les mutations réelles

### Décision

Deux couches, **aucune dépendance d'exécution nouvelle** :

- **Unitaire — `bun test`** (intégré à bun 1.4, API compatible Jest, TypeScript
  natif, respecte `paths` de `tsconfig.json`). Cible : la logique **pure** de
  la couture, `src/lib/api/collections.ts` et `src/lib/api/client.ts`, où vit
  toute la décision « maquette ou API » et tout le protocole (enveloppe
  `{erreur}`, `401` → rafraîchissement, `?confirmation=`, sondage des
  travaux). Une seule devDependency de types : `@types/bun` `1.4.2` (épinglée
  à l'exact), sans quoi `tsc` ne résout pas `bun:test` — le `tsconfig.json`
  inclut `**/*.ts`, donc les tests sont typés par `bun run typecheck` et
  `next build`, ce qui est souhaitable.
  **Pas** de test unitaire des hooks React `useOperation`/`useCollection` :
  cela demanderait un DOM et `@testing-library/react` (deux dépendances) pour
  tester ce que la couche d'intégration exerce déjà sur la vraie interface.
- **Intégration — Playwright Test**, via l'entrée `playwright/test` du paquet
  `playwright` **déjà installé** (`node_modules/playwright/test.d.ts` existe en
  1.62.1 ; pas de `@playwright/test` à ajouter). Chromium système
  `/usr/bin/chromium-browser` ou le cache `~/.cache/ms-playwright`, comme
  `outils/audit.mjs`. Ces tests créent de **vraies** ressources sur le
  laboratoire via l'API dev01 et les détruisent ; ils ne tournent pas en CI
  (laboratoire privé, extinction nocturne, organisation partagée) — ils se
  lancent à la main, avant une fusion qui touche une mutation.
- Vitest est écarté : il n'apporterait rien que `bun test` n'a pas ici, et
  ajouterait une dépendance et un second runner.

Épingler `playwright` à `"1.62.1"` (retirer le caret) dans le même commit :
c'est la seule entrée qui viole la règle d'épinglage.

### Étapes

**3.1 — `package.json`, `.gitignore`.**

- devDependencies : `"@types/bun": "1.4.2"`, `"playwright": "1.62.1"`.
  `bun install` puis vérifier que `bun.lock` ne bouge que pour ces deux
  lignes.
- scripts : `"test": "bun test"`,
  `"test:integration": "playwright test -c tests/integration/playwright.config.ts"`
  (`bun run` met `node_modules/.bin` dans le `PATH`).
- `.gitignore` : `tests/integration/resultats/`, `test-results/`.
- Vérifier : `bun run typecheck` passe toujours (les types Bun cohabitent
  avec `@types/node`) ; `bun test` répond « 0 tests ».

**3.2 — Tests unitaires, colocalisés dans `src/lib/api/`.**

`src/lib/api/collections.test.ts` :

- `endpointDe` : `'vms'` → `/vms` ; `'snapshots-vm 1'` → `/vms/vm%201/instantanes`
  (encodage) ; `'services-projet'` → `undefined` (le littéral, voir le
  commentaire du code) ; `'services-p1'`, `'variables-p1'`, `'elevations-u1'`
  → leurs chemins nichés ; `'objets-x'`, `'inconnue'` → `undefined`.
- `champConfirmation` : `'espaces'` → `code`, `'ips'` → `adresse`,
  `'regles-alertes'` → `cible`, `'points-restauration'` → `resourceNom`,
  défaut → `nom`.
- **Registre ↔ contrat** (table-driven, le plus utile) : lire
  `docs/api/openapi.json`, et pour chaque valeur de `REGISTRE_COLLECTIONS`
  vérifier qu'un chemin du contrat commence par cet endpoint et porte un
  `get`. Une entrée du registre pointant sur une route absente du contrat est
  une collection qui restera silencieusement en graine.

`src/lib/api/client.test.ts` (stubs minimaux, sans DOM : `globalThis.window = globalThis as never`
et un `localStorage` en `Map` posés dans `beforeEach`, `globalThis.fetch`
remplacé par `mock()`) :

- `estActif()` : faux sans `NEXT_PUBLIC_API_URL`, vrai avec (poser/retirer
  `process.env` dans le test ; la fonction lit la variable à l'appel).
- `estTravail` : vrai sur `{ statut: 'queued', taches: [] }`, faux sur une
  ressource, faux sur `null`.
- `ApiError` : construit depuis `{ erreur: { code, message, correlationId }, champs, rolesRequis, integration, dateDonnees }`
  — `champs` et `rolesRequis` **frères** de `erreur`, pas dedans (forme
  restructurée le 2026-09-05) ; message de repli « L'API a répondu 500 ».
- `requete` : `204` → `undefined` ; corps JSON invalide sur `2xx` → `{}` ;
  `4xx` → `ApiError` avec `statut` ; en-têtes `Authorization` et
  `X-Organisation-Id` posés depuis la session ; `query` avec `undefined`
  omis.
- `requete` sur `401` : appelle `POST /auth/rafraichir` **une fois** avec le
  `refreshToken`, réécrit la session, rejoue la requête ; si le
  rafraîchissement échoue → session effacée et `window.location.href = '/login'`
  (stub) ; un `401` sur `/auth/rafraichir` lui-même ne boucle pas.
- `supprimerRessource('/vms', 'a b', 'web-01')` → `DELETE /vms/a%20b?confirmation=web-01` ;
  sans confirmation, pas de paramètre.
- `lister('/vms')` → `?page=1&parPage=200`.
- `suivreTravail` : avec `fetch` renvoyant `running` puis `done`, le rappel est
  appelé deux fois et le sondage cesse. Minuteries réelles (1,5 s), donc
  ~3 s : marquer le test `slow` dans son nom et l'accepter — `bun:test` n'a
  pas de fausses minuteries pour `setTimeout`.

Vérifier : `bun test` vert ; `bun run typecheck` vert (les tests sont dans le
programme) ; `bun run lint` vert (`next lint` couvre `src/`).

**3.3 — Harnais d'intégration `tests/integration/`.**

Fichiers :

- `playwright.config.ts` : deux projets.
  - `maquette` : `baseURL = BASE_MAQUETTE ?? 'http://127.0.0.1:3111'` — le
    même serveur que l'audit, construit **sans** variable.
  - `api` : `baseURL = BASE_API ?? 'http://127.0.0.1:3113'`, construit
    **avec** `NEXT_PUBLIC_API_URL=https://api.synelia.dev01.ovh.smile.ci/v1` ;
    ou directement `BASE_API=https://app.synelia.dev01.ovh.smile.ci`.
  - `workers: 1`, `fullyParallel: false` (organisation partagée, capacité
    comp1 ~20 Go), `retries: 0` (un test réel qui échoue doit être lu, pas
    rejoué), `timeout` 120 s par défaut et 12 min sur les specs VM/Espace,
    `outputDir: 'tests/integration/resultats'`, `use.launchOptions.executablePath`
    depuis `CHROMIUM` si défini (sinon le cache Playwright).
  - En-tête : la séquence complète de lancement, puisque les deux builds
    partagent `.next` et ne coexistent pas :
    ```
    pkill -f next-server
    NEXT_PUBLIC_API_URL= bun run build && bun run start -p 3111 &   # maquette
    bun run test:integration --project maquette ; BASE=http://127.0.0.1:3111 node outils/audit.mjs
    pkill -f next-server
    NEXT_PUBLIC_API_URL=https://api.synelia.dev01.ovh.smile.ci/v1 bun run build && bun run start -p 3113 &
    SYNELIA_TEST_EMAIL=… SYNELIA_TEST_MDP=… bun run test:integration --project api
    ```
- `fixtures.ts` :
  - `api` : client `fetch` vers `API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.synelia.dev01.ovh.smile.ci/v1'`
    avec `Bearer` + `X-Organisation-Id`, sur le modèle de l'ancien
    `/tmp/w2-verif.mjs` (login `POST /auth/connexion { email, motDePasse }`,
    identifiants **uniquement** depuis `SYNELIA_TEST_EMAIL` /
    `SYNELIA_TEST_MDP` ; les valeurs d'amorçage sont dans le README backend,
    pas dans le code du test).
  - `pageConnectee` : ouvre le contexte avec `addInitScript` qui écrit la
    `SessionApi` obtenue par l'API dans `localStorage['synelia.session']`,
    pour ne pas rejouer le formulaire à chaque test (le formulaire a son
    propre test, T1).
  - `prefixe` : `t${hhmmss}-` posé une fois par run ; **toute** ressource
    créée porte ce préfixe dans son `nom`/`code`/`domaine`.
  - `attendreTravail(id)` : sonde `GET /travaux/{id}` jusqu'à `done`/`failed`
    avec échéance ; sur `failed`, échoue en citant `erreur.message` et
    `correlationId`.
  - `preflight` (fixture `worker`) : `GET /public/statut` = 200 **et**
    `GET /catalogue/gabarits` ≠ `424`. Sinon `test.skip()` du projet entier
    avec le message « laboratoire éteint (extinction nocturne ~21:01 UTC) :
    `sudo virsh start openstack-lab_{ctrl1,comp1,stor1}` sur dev01 ».
  - `globalTeardown` : balayage des restes portant le préfixe du run sur
    `/vms`, `/espaces`, `/groupes-securite`, `/web/dns`, `/web/emails`,
    `/securite/cles-api`, `/ia/cles`, `/ia/agents` — `DELETE ?confirmation=`
    avec le bon champ ; journaliser ce qui a dû être balayé (c'est un test qui
    a mal nettoyé).

Motif imposé à chaque spec : **préparer** (login API, créer par l'API la
ressource parente la moins chère), **agir** (la mutation depuis la vraie
interface, avec la vraie modale « saisir le nom »), **vérifier** (état réel
par l'API — la source de vérité — puis l'interface avec `expect.poll` /
`getByRole`, jamais de `waitForTimeout`), **détruire** (par l'API, dans
`afterEach`, idempotent). Chaque suppression avec confirmation teste d'abord
**un mauvais nom** (bouton désactivé ou `422`, ressource toujours là) puis le
bon.

**3.4 — Les specs, dans l'ordre de réalisation.** Champs de confirmation
relevés dans les `exiger_confirmation` du backend ce jour.

| # | Fichier | Projet | Préparer | Agir (interface) | Vérifier | Détruire |
|---|---|---|---|---|---|---|
| T0 | `maquette-isolee.spec.ts` | maquette | — | Visiter `/app`, `/app/vms`, `/app/web/domaines`, `/app/ia`, cliquer un bouton d'action quelconque | `page.on('request')` : aucune requête vers un hôte autre que `baseURL` (hors `data:`/`blob:`) ; aucune erreur console (le même invariant que l'audit) | — |
| T1 | `connexion.spec.ts` | api | — | Formulaire `/login` avec les identifiants ; `waitForURL(u => u.pathname.startsWith('/app'))` | `localStorage.synelia.session` a un `accessToken` ; nouveau contexte sans session → `/app/vms` redirige vers `/login` (`GardeAuth`) ; mauvais mot de passe → message d'erreur, pas de session | — |
| T2 | `cles-api.spec.ts` | api | login | `/app/parametres`, onglet API, « Créer le jeton » (`nom = prefixe`) | le secret est **affiché une fois** puis absent du DOM ; `GET /securite/cles-api` liste la clé **sans** champ `secret` ; révocation : mauvais nom refusé, bon nom → `DELETE ?confirmation=<nom>` `204`, la clé disparaît de la liste et de l'API | `DELETE` si encore là |
| T3 | `cles-ia.spec.ts` | api | login, `espaceId` = plus ancien espace | `/app/ia/parametres/passerelle` : créer une clé, puis « Rotation », puis « Révoquer » | secret affiché une fois ; `POST /ia/cles/{id}/rotation` renvoie un secret différent ; révocation confirmée par `cle.nom` → `204` | `DELETE /ia/cles/{id}?confirmation=<nom>` |
| T4 | `dns.spec.ts` | api | login ; `POST /web/dns` pour une zone `<prefixe>.synelia-test.ci` (lire le corps attendu dans `chemins-web.mjs` avant d'écrire) | la fiche qui monte `EditeurZone` (`src/components/business/editeur-zone.tsx` ; trouver la route par `grep -rn EditeurZone src/app`) : ajouter un `A` (`POST …/enregistrements`), puis le supprimer | `GET /web/dns/{id}` contient puis ne contient plus l'enregistrement — c'est Designate qui est derrière | `DELETE /web/dns/{id}?confirmation=<domaine>` |
| T5 | `messagerie.spec.ts` | api | login ; `POST /web/emails { domaine: '<prefixe>.synelia-test.ci', palier, boites }` → `202`, `attendreTravail` (Zimbra réel : compter ~1–2 min) | `/app/web/emails/[id]` : créer une boîte (`POST …/boites { adresse, nom }`), puis la supprimer | boîte listée dans l'interface et dans `GET /web/emails/{id}` ; suppression confirmée par l'**adresse** exacte → disparue | `DELETE /web/emails/{id}?confirmation=<domaine>` (route ajoutée le 2026-09-07) |
| T6 | `espace.spec.ts` | api | login ; `offerId` lu dans le catalogue comme le fait l'assistant | `/app/espaces/new` : `code = prefixe`, site, CIDR, quota → `202` | le travail apparaît dans `/app/taches` et finit `done` ; l'espace est dans `/app/espaces` et dans `GET /espaces/{id}` ; suppression depuis la fiche : mauvais **code** refusé, bon code → travail → `GET` `404` (Keystone + Neutron réels) | `DELETE /espaces/{id}?confirmation=<code>` |
| T7 | `vm.spec.ts` | api | login ; espace = `SYNELIA_TEST_ESPACE_ID` ou le plus ancien ; gabarit le plus petit de `GET /catalogue/gabarits` | `/app/vms/new` : `nom = prefixe-vm` → `202` ; sur la fiche : « Arrêter » ; puis « Supprimer » | `attendreTravail` → `statut: running` (Nova réel, jusqu'à 10 min) ; `POST /vms/{id}/arret` → `stopped` ; suppression : mauvais nom refusé, bon nom → `GET` `404` | `DELETE /vms/{id}?confirmation=<nom>` ; balayage `prefixe-*` |
| T8 (option, `SYNELIA_TEST_IA=1`) | `agent-ia.spec.ts` | api | login ; modèle `invocable: true` dans `GET /ia/modeles` | `/app/ia/nouveau` : créer, publier, « Tester » (appel OpenRouter réel, quelques centimes) | réponse non vide et coût > 0 dans l'interface ; suppression confirmée par `agent.nom` | `DELETE /ia/agents/{id}?confirmation=<nom>` |
| T9 (option, laboratoire contraint) | `groupe-securite.spec.ts` | api | login, `espaceId` | `/app/reseau` : créer un groupe (chemin **générique** `useCollection.creer`, pas d'`appel` — c'est ce qui le rend intéressant), puis le supprimer | `GET /groupes-securite` le liste (Neutron réel), suppression confirmée par `nom` | `DELETE …?confirmation=<nom>` |

Ordre : 3.3 + T0 + T1 + T2 (rien ne touche OpenStack, une heure) ; puis T3 et
T4 (Designate, secondes) ; puis T6, T5, T7 (minutes chacun, laboratoire
allumé) ; T8/T9 si le temps le permet. Un commit par spec ou par paire de
specs ; chaque commit passe `bun run typecheck && bun run lint && bun test`.

Points de vigilance, appris en vérifiant à la main :

- `waitForURL` : jamais une regex `/\/app/` — le nom d'hôte du bac à sable la
  satisfait déjà. `u => u.pathname.startsWith('/app')`.
- Le `useCollection` affiche la graine jusqu'à la première réponse : après
  une mutation, attendre l'état **réel** par l'API puis l'interface avec
  `expect.poll`, pas l'inverse.
- Le formulaire de création de VM propose une taille par défaut qui peut
  répondre `402` (quota) : choisir explicitement le plus petit gabarit.
- Tout ce qui est créé sans le préfixe du run ne sera pas balayé : le préfixe
  n'est pas optionnel.
- Deux instances de l'API sur la même base ont déjà provoqué des
  `disk I/O error` (2026-09-05) : ne lancer qu'un run à la fois.

**3.5 — Vérifier.**

- `bun test` : tous verts, durée < 10 s (hors le test `slow`).
- `bun run typecheck && bun run lint && bun run build` avec et sans
  `NEXT_PUBLIC_API_URL`.
- Projet `maquette` : T0 vert ; `node outils/audit.mjs` sur le même serveur
  toujours à zéro partout (il ne doit pas régresser à cause des tests).
- Projet `api`, laboratoire allumé : T1–T7 verts **et** le journal du
  `globalTeardown` n'a rien eu à balayer. Sur le laboratoire, après le run :
  `openstack server list | grep t[0-9]` vide (admin rc dans
  `~/.config/synelia/admin-openrc.sh` sur dev01).
- Laboratoire éteint : le projet `api` se déclare **non exécuté** avec le
  message du preflight, sans un seul échec.
- Mettre à jour `CLAUDE.md` (table Outillage, séquence de fin de changement,
  section 1) et `docs/BRANCHEMENT-API.md` : remplacer « scénario
  `/tmp/w2-verif.mjs` » par le renvoi vers `tests/integration/`.

---

## Ce que ce plan ne fait pas, volontairement

- Il ne réécrit pas `types.ts` en bloc ni ne bascule le contrôle de dérive en
  bloquant : c'est la réconciliation à la main de 2.5 qui décide, lot par
  lot.
- Il ne met pas les tests d'intégration en CI : ils ont besoin du
  laboratoire, d'identifiants et d'une organisation qui n'est partagée avec
  personne d'autre pendant le run. Une exécution planifiée (nuit, après
  `virsh start`) est un chantier séparé.
- Il ne corrige pas les faux succès du backend qu'il documente
  (restauration d'instantané, registrar, bases mutualisées, services
  managés) : ils sont nommés dans `BRANCHEMENT-API.md` pour qu'aucun écran ne
  les présente comme réels, et laissés au dépôt backend.
- Il ne retire aucune branche maquette (`effet`/`job`) : la question « le
  mode maquette reste-t-il un besoin produit ? » est posée dans la revue,
  elle attend une réponse humaine.
