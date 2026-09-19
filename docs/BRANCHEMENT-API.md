# Branchement API — la couture données

> ⚠️ **Generated from `registre_capacites.py` + `x-etat`, do not edit manually — run `bun run api:derive` to verify**
>
> Source de vérité : `synelia-cloud-backend/packages/openstack/synelia_openstack/registre_capacites.py` (`REGISTRE: list[Capacite]`) → extension OpenAPI `x-etat` par opération (`reel` | `persiste` | `simule` | `maquette`) + `x-capacite` (`registrar.domain`, `acme.certificat`…) + `x-provisionnement: manuel` quand `simule`. Ce document est une projection lisible du registre au 2026-09-19 — ne pas le maintenir à la main.

Ce document décrit la couture ; `CLAUDE.md` en donne le résumé.

Quand `NEXT_PUBLIC_API_URL` est renseignée (`.env.local`), l’interface parle au
backend FastAPI ; sans elle, tout vient de `src/lib/mock/` comme avant. Les
deux modes partagent les mêmes écrans : seule la provenance des données change.

```bash
# Backend (une fois, en fond)
cd /var/lib/synelia-cloud/synelia-cloud-backend \
  && export PATH="$HOME/.local/bin:$PATH" \
  && nohup uv run synelia api --port 4000 > /tmp/api.log 2>&1 &
# Interface branchée
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000/v1' > .env.local
bun run dev --port 3111
# Compte de démonstration : admin@synelia.cloud / Synelia!2026
```

## Comment marche la couture

| Couche | Fichier | Rôle |
|---|---|---|
| Transport | `src/lib/api/client.ts` | `fetch` (Bearer + `X-Organisation-Id`, JSON), session `localStorage`, `ApiError` depuis `{ erreur }`, un rafraîchissement sur `401` via `/auth/rafraichir`, `estActif()`, `lister/créer/modifier/supprimerRessource`, `suivreTravail` (sonde `/travaux/{id}` toutes les 1,5 s) |
| Registre | `src/lib/api/collections.ts` | clé de `useCollection` → endpoint (`vms` → `/vms`, `clusters` → `/kubernetes`, `tunnels` → `/vpn`, `volumes` → `/volumes`, `drives` → `/web/drive`…). Motif à suffixe : `snapshots-<vmId>` → `/vms/<vmId>/instantanes`. Les autres clés à suffixe (`elevations-<id>`, `objets-<id>`…) et les inconnues : pas d’entrée, la graine est gardée |
| État | `src/components/app/atelier.tsx` | `useCollection` charge `GET {endpoint}?parPage=200` dans un effet (la graine reste affichée jusque-là : pas de divergence d’hydratation), expose `chargement`/`erreur`/`recharger` ; les mutations appellent l’API (`POST`, `PATCH {id}`, `DELETE {id}?confirmation=<nom exact>`) puis rechargent. `integrerTravail` fond un `TravailProvisioning` dans la collection des jobs pour le centre de tâches |
| Opérations | `src/components/app/actions.tsx` | `useOperation` accepte `appel: () => Promise<unknown>` : en mode API il l’exécute, suit un éventuel travail via `suivreTravail` (toasts de fin/échec avec `correlationId`), et traduit `ApiError` en toast (`rolesRequis` sur `403`, `champs` sur `422`). Sans `appel`, le chemin maquette est inchangé |
| Session | `src/components/app/contexte.tsx` | en mode API : réhydratation `localStorage`, permissions depuis `/moi` (`autorise()` les consulte, jamais la matrice locale), organisations et `changerOrganisation()` (`X-Organisation-Id` immédiat + `PUT /moi/organisation-active`), `deconnecter()` (`POST /auth/deconnexion`), `GardeAuth` (`/app/**` et `/admin/**` → `/login` sans session). `useEspace()` lit la collection (repli : le plus ancien `createdAt`, jamais le dernier créé qui est vide) et le choix est persisté (`synelia.espace`) |
| Entrée | `src/app/(auth)/login/` | `formulaire-connexion.tsx` : mot de passe + MFA (`/auth/connexion` → `/auth/mfa`), session stockée, redirection `/app`. La page serveur choisit le parcours selon la même variable (pas de bascule à l’hydratation) |
| Recherche | `src/components/app/recherche.tsx` | en mode API, dès qu’une requête est saisie, `GET /recherche?q=` (anti-rebond 250 ms) remplace l’index local ; à vide, les raccourcis locaux restent |
| Onboarding | `src/components/app/onboarding.tsx` | en mode API, `GET /onboarding` masque le panneau quand le backend le dit (`termine`/`masque`), et « Ne plus afficher » rejoue `PATCH { masque: true }` |

Les jobs (`jobs`, `jobs-plateforme`) se rechargent en plus toutes les 10 s :
une opération lancée ailleurs avance dans le centre de tâches sans rechargement.

Le cache distant est partagé par clé (`CACHE_DISTANT` dans `atelier.tsx`) :
plusieurs `useCollection` montés ensemble ne déclenchent qu’une requête
(les chargements simultanés partagent la même promesse), le cache sert
immédiatement puis se réactualise en fond. `recharger()` force la relecture —
chaque `effetFinal` branché le fait après l’appel réel.

En mode API avec `appel`, `useOperation` ne rejoue **pas** `effet` (la
collection distante `POST`/`PATCH` à nouveau : la mutation serait doublée).
`effet` reste le chemin maquette, `effetFinal` la réconciliation commune
(`recharger()`, navigation). `job` reste simulé uniquement sans `appel`.

`DELETE` confirme avec le champ exact relevé des `exiger_confirmation` du
backend (`champConfirmation()` dans `collections.ts`) : `code` pour un espace,
`adresse` pour une IP, `cible` pour une alerte, `hote`/`domaine`/`domaineProvisoire`/`resourceNom`
côté Web Cloud et sauvegarde. `supprimer(id, confirmation?)` accepte une
valeur explicite quand la collection ne la porte pas (courriel d’un membre).

## Brancher une page

1. Lecture : rien à faire si elle utilise `useCollection` avec une clé du
   registre — vérifier le filtre (périmètre par `id`, pas par objet figé).
2. Écriture : ajouter `appel` à l’opération `useOperation` (ou à
   `BoutonAction`/`BoutonFormulaire` via `operation()`), avec `effetFinal`
   qui `recharger()` la collection. Garder `effet`/`job` pour le mode
   maquette derrière `if (estActif()) … else …` (exemple :
   `src/app/app/espaces/new/page.tsx`).
3. Vérifier : `bun run typecheck && bun run lint && bun run build`, avec et
   sans `.env.local`.

## Vérifié en direct (2026-09-04)

`bun run dev --port 3111` + backend local, scénario Playwright (Chromium
système) : login démo → `/app` (12/12) ; `/app/vms` affiche `web-01`, `db-01`
du backend ; `/app/espaces` affiche `demo-abj` puis l’espace créé ; création
UI (`/app/espaces/new`) → `202`, travail à 5 étapes suivi jusqu’à `done`,
visible dans `/app/taches` ; visite sans session → `/login`. Mode maquette
(port sans `.env.local`) : zéro appel backend, données fictives inchangées.

## Vague 2 — mutations branchées (vérifié 2026-09-05, 23/23 verts)

Scénario `/tmp/w2-verif.mjs` (Chromium système, backend local), non versionné —
la suite d'intégration versionnée qui lui succède est `tests/integration/`
(`bun run test:integration`, backend réel dev01, voir son en-tête et
`docs/PLAN-ARCHITECTURE-SUITE.md` §3) :

- VM : création par l’assistant UI (`POST /vms/lot` → `202`, la taille par
  défaut 2×4 vCPU répond `402` — quota, le toast porte le motif) ; arrêt et
  démarrage depuis la fiche (`POST /vms/{id}/arret|demarrage|redemarrage`) ;
  redimensionnement (`POST …/redimensionnement`) ; snapshot
  (`POST …/instantanes { nom }`), restauration (`POST …/instantanes/{id}`),
  suppression (`DELETE …/instantanes/{id}`, sans confirmation) ; suppression
  de la machine (`DELETE /vms/{id}?confirmation=<nom>`, 404 après) ;
  migration (`POST …/migration { site }`).
- Volumes : création UI (`POST /volumes` → `202` + travail suivi) ; extension
  (`POST …/extension { tailleGo }`) ; attachement (`PUT …/attachement
  { vmId, montage }` → `202`) et détachement (`DELETE`, `204` après le job) ;
  suppression (`204`).
- Membres : invitation UI (`POST /invitations` → `201`), relance (`POST
  …/relance`), révocation (`DELETE`, sans confirmation), changement de rôle
  (`PATCH /membres/{id} { role }`), retrait (`DELETE …?confirmation=<email>`),
  attribution (`POST /membres`).
- Clés API (`/app/parametres`, onglet API) : création (`POST
  /securite/cles-api`, rôles traduits en actions RBAC) avec secret affiché une
  seule fois ; révocation (`DELETE ?confirmation=<nom>`). Clés S3 : création
  (`POST /cles-s3`, `droits` traduits) avec identifiants affichés une fois.
- Support : ouverture (`POST /support/tickets`), réponse (`POST
  …/messages`), résolu/réouvert (`PATCH { statut }`), escalade (`POST
  …/escalade { motif }`).
- Services : activation drive (`POST /web/drive { domaine, palier, sieges }`) ;
  souscription/résiliation managée vérifiées au niveau API (`POST /services`
  → `202`, `DELETE ?confirmation=<nom>` → `202`) — aucun écran client dédié.
- Facturation : règlement (`POST /facturation/factures/{id}/paiement`),
  moyen principal (`PATCH …/moyens-paiement/{id} { defaut }`), ajout de moyen
  (`POST`), souscriptions (`PATCH { quantite, periodicite }`).
- Sécurité : révocation d’une session (`DELETE /securite/sessions/{id}`) et
  de toutes (`DELETE /securite/sessions?confirmation=<nom org>`) ; formes
  backend normalisées (utilisateur embarqué, `type`/`defaut`, `expire`).
- Sauvegarde & PRA : restauration depuis un point (`POST
  /sauvegarde/restaurations { pointId, cible }`) ; bascule de test et réelle
  (`POST /pra/{id}/bascule { type, confirmation }`).
- Bases : réplica (`POST /bases/{id}/replicas`), PITR (`POST
  …/restauration { instant, nomCible }`).
- Kubernetes : création (`POST /kubernetes` → `202`), mise à jour (`POST
  …/mise-a-jour { version }`), pool (`POST …/pools`, `DELETE
  …/pools/{nom}?confirmation=<nom>`), modules (`PUT …/modules`).
- Espaces : quota (`PUT /espaces/{id}/quota`) ; création déjà vague 1.
- Admin catalogue : création (`201`), modification, publication/dépréciation
  (`POST …/publication { statut }`), suppression (`204`) — vérifiés au niveau
  API (voir l’écart `/moi` ci-dessous).

Détail : les 15 routes de détail sous `/app/**` ne font plus `notFound()` sur
le jeu figé (elles 404aient tout identifiant backend) ; la vue cliente dit
l’absence (`EmptyState` nommé, squelettes pendant le chargement, lecture
unitaire `GET {endpoint}/{id}` via `useEntite` quand la liste ne contient pas
l’item). Les périmètres mock (`…DeLOrg()`) ne filtrent plus en mode API (le
backend filtre déjà, avec des identifiants inconnus du jeu local) : listes et
panneaux Web Cloud, membres (utilisateur embarqué), moyens, sessions, jetons.

## Reste pour la vague 3 — mise à jour 2026-09-19

- Les créations dont le corps mock contient déjà les champs requis partent par
  le chemin générique (`POST` + `recharger`) sans `appel` dédié : données
  justes, mais pas de suivi fin du `202` dans le centre de tâches (réseaux,
  IP, groupes, LB, VPN, buckets, plans de sauvegarde/PRA, projets, sites,
  DNS, SMTP…).
- Écrans branchés depuis 2026-09-08 à ne plus lister comme « reste » :
  - **Console VM** (`POST /vms/{vmId}/console` → `201 {url, protocole, expire}`) est **réelle** (`ComputeOpenStack.get_console_url` via Nova, `x-etat: reel`, `capacite: compute.serveur`). L’ancienne mention « console VM reste graine » était fausse.
  - **SSO** (`GET/PUT /securite/sso` persistés, `POST /securite/sso/test` simulé honnête) — voir table SSO ci-dessous (PR #16).
  - **Serveurs de bases** (`/web/bases`) sont **réels** depuis PR #15 (propagation du mot de passe racine, `x-etat: reel`, `capacite: ssh.hebergement`).
- Écrans sans équivalent branché : souscription à un service managé (pas
  d’écran client dédié — vérifié au niveau API), estimation facturable (`POST
  /facturation/estimation`, aucun écran ne l’appelle — `CostPreview` calcule
  en local), attribution de sièges (`userId` backend vs `USERS` mock),
  ouverture SSO (`POST …/ouverture` → URL à ouvrir), politiques SSO
  (`PUT /securite/politiques` — distinct de `/securite/sso`), consommation/ventilation facturation,
  métriques/journaux/événements d’observabilité (graines locales, Victoria simule), tableaux de
  bord `/app` et `/admin` (serveur, graines).
- Écarts backend relevés en vérifiant (pas du ressort du frontend) :
  - `GET /moi` n’expose pas les droits équipe : le backend accorde
    `catalog.edit` par contournement (`est_admin_plateforme`) mais ne le liste
    pas dans `permissions` — les boutons admin restent désactivés avec le
    compte démo alors que l’API répond `201`. Vérifié : création, publication,
    suppression d’offre au niveau API.
  - SQLite en contention : ~170 `OperationalError: disk I/O error` pendant un
    run Playwright (deux instances `:4000` + `:4001` sur le même fichier),
    disparu après redémarrage de `:4000`. À surveiller si les runs se
    chevauchent.
  - Le jeu démo a bougé pendant la vague (7 → 1 espaces) : un autre
    travailleur sur `:4001` partage la même organisation. Coordonner les
    nettoyages.
- Bannières dégradées `424` (`integration`/`dateDonnees`) et erreurs de
  champs `422` vers les formulaires : transportées (`ApiError.champs`,
  toast), pas encore câblées écran par écran.

## État réel par collection (2026-09-19)

Quatre états, et pas un de plus :

| x-etat | Sens | Extension OpenAPI | Couleur CLI `synelia capacites` |
|---|---|---|---|
| **reel** | le backend répond et pilote un amont réel (Nova, Neutron, Cinder, Magnum, Octavia, Designate, MinIO quand gate posée, Zimbra, LiteLLM/OpenRouter, SSH) | `x-etat: reel` | vert |
| **persiste** | le backend répond depuis sa base ; il n'y a pas d'amont à piloter par nature (membres, jetons, tickets, factures, journal d'audit, SSO config…) | `x-etat: persiste` ou absent | blanc |
| **simule** | le backend répond `2xx`/`202` mais l'amont est un stub vide ou l'exécuteur n'appelle rien : un faux succès honnête. Quand `x-provisionnement: manuel`, le `202` ne déclenche aucun dépôt registre — traitement ops manuel ~48h | `x-etat: simule` + `x-provisionnement: manuel` | jaune |
| **maquette** | la collection n'est pas dans `REGISTRE_COLLECTIONS`, ou l'écran lit une graine : rien ne part vers le backend même en mode API | absent | gris |

Dérivé le 2026-09-19 depuis `registre_capacites.py` (`REGISTRE`) + `x-etat` par opération (proposition `PLAN-API.md §1` implémentée), croisé avec `docs/api/openapi.json` (533 opérations) et vérification directe des connecteurs `packages/openstack/synelia_openstack/*Simule` / `*Reel` + `choisir_*()` gates. Les 8 écarts 2026-09-08 → 2026-09-19 sont corrigés ci-dessous.

| Collection | Endpoint | Module backend | x-etat | Capacité (`registre_capacites.py`) | Remarque |
|---|---|---|---|---|---|
| `vms` | `/vms` | `vms` | `reel` | `compute.serveur` | Nova/Glance via `ComputeOpenStack`. Création, arrêt/démarrage, redimensionnement, suppression, instantané (création + restauration via `rebuild_server`) réels. |
| `console-vm` | `POST /vms/{vmId}/console` | `vms` | `reel` | `compute.serveur` | **Corrigé 2026-09-19** : était listée « maquette / vague 3 » le 2026-09-08. Réelle : `ouvrirConsoleVm` → `ConsoleVm{url, protocole, expire}` via `ComputeOpenStack.get_console_url` (chemins-infra.mjs:359, schemas-socle.mjs:789). `x-etat: reel`. |
| `espaces` | `/espaces` | `espaces` | `reel` | `identite.tenancy` | Keystone (projet) + Neutron (réseau) via `IdentiteOpenStack`. |
| `volumes` | `/volumes` | `stockage` | `reel` | `block_storage.volume` | Cinder (`BlockStorageOpenStack`). |
| `buckets` | `/buckets` | `stockage` | `reel`* | `minio.objet` | MinIO `MinioReel` si `SYNELIA_MINIO_URL` posée, sinon `MinioSimule`. *Table 2026-09-08 disait « réel » sans gate — honnêtement `simule` en CI, `reel` en lab dev01 où l’URL est posée. `x-etat` reflète le gate. |
| `cles-s3` | `/cles-s3` | `stockage` | `reel`* | `minio.objet` | Idem MinIO — `SYNELIA_MINIO_URL` gate. |
| `clusters` | `/kubernetes` | `kubernetes` | `reel` | `magnum.cluster` | Magnum (`MagnumOpenStack`). |
| `reseaux` | `/reseaux` | `reseau` | `reel` | `network.reseau` | Neutron. |
| `ips` | `/ips` | `reseau` | `reel` | `network.reseau` | IP flottantes, Neutron. |
| `groupes-securite` | `/groupes-securite` | `reseau` | `reel` | `network.reseau` | Neutron. |
| `load-balancers` | `/load-balancers` | `reseau` | `reel` | `network.reseau` | Octavia. |
| `tunnels` | `/vpn` | `reseau` | `reel` | `network.reseau` | Neutron VPNaaS. |
| `plans-sauvegarde` | `/sauvegarde/plans` | `sauvegarde` | `simule` | `backup.plan` | Réel et honnête sur l’échec, mais amont `BackupOpenStack` partiel (`c.backup.create_plan_run` si présent sinon noop). Classé `simule` dans le registre — pas de faux succès silencieux. |
| `points-restauration` | `/sauvegarde/points` | `sauvegarde` | `simule` | `backup.plan` | Idem. |
| `plans-pra` | `/pra` | `pra` | `simule` | `backup.plan` | `Executeur Pra` partiel. |
| `conformite-sauvegarde` | `/sauvegarde/conformite` | `sauvegarde` | `simule` | `backup.plan` | Tableau calculé depuis données réelles de sauvegarde mais amont Backup simule. |
| `projets` | `/projets` | `projets` | `reel` | `k8s.workload` / `magnum.cluster` | PaaS : `K8sWorkloadReel` réel seulement si `SYNELIA_PAAS_CLUSTER_ID` posé (sinon `K8sSimule`). `DepotsReel` (GitHub) réel si `SYNELIA_GITHUB_TOKEN`. |
| `deploiements` | `/deploiements` | `deploiements` | `reel` (théâtre) | `argo.application` | Persistance, RBAC et journal d’audit réels ; le pipeline lui-même (`ExecuteurAppDeploy`) est un théâtre d’étapes — build/scan/provision/deploy ne construisent aucune image et n’appellent jamais `K8sWorkloadReel` (contrairement à `projets`, qui l’appelle réellement pour un service). Le canari (`/deploiements/{id}/canari`) stocke un pourcentage sans routeur. `x-etat: reel` mais disclaimer obligatoire. |
| `domaines-applicatifs` | `/domaines-applicatifs` | `projets` (`router_domaines`) | `reel` | `k8s.workload` | |
| `factures` | `/facturation/factures` | `facturation` | `persiste` | — | |
| `souscriptions` | `/facturation/souscriptions` | `facturation` | `persiste` | — | |
| `moyens-paiement` | `/facturation/moyens-paiement` | `facturation` | `persiste` | — | |
| `memberships` | `/membres` | `membres` | `persiste` | — | |
| `invitations` | `/invitations` | `membres` (`router_invitations`) | `persiste` | — | |
| `jetons-api` | `/securite/cles-api` | `securite` | `persiste` | — | |
| `sessions` | `/securite/sessions` | `securite` | `persiste` | — | |
| `sso-config` | `GET/PUT /securite/sso` | `securite` | `persiste` | `securite.sso` | **Corrigé 2026-09-19** (PR #16) : n’était pas listée. `GET/PUT` = persistance `organisation.sso` JSONB, aucun appel IdP. `x-etat: persiste`. |
| `sso-test` | `POST /securite/sso/test` | `securite` | `simule` (honnête) | `securite.sso` | **Corrigé 2026-09-19** : `testerSso` renvoie `succes: false` + 3 étapes dont 2 en `ok:false` (« Aucun courtier d’identité n’est configuré » / « Le flux réel n’est pas encore disponible »), persiste `dernierTest` et journalise. Aucun `httpx`/discovery OIDC. `x-etat: simule`, honnête depuis PR #16. |
| `tickets` | `/support/tickets` | `support` | `persiste` | — | |
| `jobs` | `/travaux` | `travaux` | `persiste` | — | Lecture d’état ; les exécuteurs qu’un travail suit sont réels ou non selon leur propre ligne. |
| `organisations` | `/organisations` | `organisations` | `persiste` | — | |
| `offres` | `/admin/catalogue/offres` | `admin_catalogue` | `persiste` | — | |
| `backends` | `/admin/backends` | `admin` | `reel` | `identite.tenancy` / `compute.serveur` | `capacite_plateforme()` via Nova, réel depuis 2026-09-07. |
| `incidents` | `/admin/statut/incidents` | `admin` | `persiste` | — | |
| `equipe-synelia` | `/admin/equipe` | `admin` | `persiste` | — | |
| `placements` | `PUT /admin/placements` | `admin` | `reel` | `identite.tenancy` | **Corrigé 2026-09-19** : était « maquette seule — écart du registre ». Backend existe (`PUT /admin/placements`), amont Keystone réel. À ajouter à `REGISTRE_COLLECTIONS` (`placements: '/admin/placements'`) pour brancher l’écran. |
| `hebergements` | `/web/hebergements` | `web_hebergement` (`router_hebergements`) | `reel` | `ssh.hebergement` | Nova + SSH + Network. |
| `sites-web` | `/web/sites` | `web_hebergement` (`router_sites`) | `reel` | `ssh.hebergement` | SSH (déploiement/retrait de sites). |
| `serveurs-bases` | `/web/bases` | `web_hebergement` (`router_bases`) | `reel` | `ssh.hebergement` | **Corrigé 2026-09-19** (PR #15, 2026-09-18) : était « simulé — aucun MariaDB ». Désormais réel : mot de passe racine propagé (`commande_sql_bases` fixe `-e MDB_MDP` + client `-p`). À ne pas confondre avec `bases-managees` (`/bases`) qui provisionne une VM dédiée. `x-etat: reel`. |
| `domaines` | `/web/domaines` | `web_domaines` | `simule` | `registrar.domain` | `RegistrarOpenStack` hérite intégralement de `RegistrarSimule` sans surcharger une seule méthode. `SYNELIA_REGISTRAR_URL` jamais posée. `POST /web/domaines` → `202 TravailProvisioning` indistinguable d’un vrai provisioning mais `x-etat: simule` + `x-provisionnement: manuel` : commande en `travail` puis **traitement manuel ops sous ~48h**, paiement Paystack retiré depuis PR #13 (badge « provisionnement manuel » côté UI). |
| `messageries` | `/web/emails` | `web_emails` | `reel` | `zimbra.messagerie` | Zimbra (`ZimbraReel`, SOAP admin) — `SYNELIA_ZIMBRA_URL` posée en lab. |
| `drives` | `/web/drive` | `web_drive` | `reel` | `ssh.hebergement` | SSH + règles de load-balancer réelles. |
| `certificats` | `/web/ssl` | `web_ssl` | `simule` | `acme.certificat` | **Corrigé 2026-09-19** : était « réel, non vérifié ». `AcmeReel` existe (`httpx POST /acme/commander…`) mais gate `SYNELIA_ACME_URL` jamais posée → toujours `AcmeSimule`. `x-etat: simule`, `x-provisionnement: manuel` si Let’s Encrypt/DV/OV/EV demandé. |
| `cles-smtp` | `/web/smtp/cles` | `web_smtp` | `reel` | `relais_smtp.envoi` | `RelaisSmtpReel` (`SYNELIA_RELAIS_SMTP_HOTE` posée). |
| `webhooks-smtp` | `/web/smtp/webhooks` | `web_smtp` | `persiste` | — | Configuration seule (URL, secret) ; aucun appel amont à leur création. |
| `zones-dns` | `/web/dns` | `web_dns` | `reel` | `designate.zone` | Designate (`DesignateOpenStack`). |
| `sauvegardes-web` | `/web/backup` | `web_backup` | `reel` | `compute.serveur` | Instantané/restauration/test via `Compute` — réel depuis câblage (avant no-op). |
| `devis` | `/facturation/devis` | `facturation` | `persiste` | — | |
| `bases-managees` | `/bases` | `bases` | `reel` | `compute.serveur` | VM Nova dédiée par base (`ComputeOpenStack`), pas un moteur mutualisé — à ne pas confondre avec `serveurs-bases` ci-dessus. |
| `regles-alertes` | `/observabilite/alertes` | `observabilite` | `persiste` | — | Règles seules ; pas d’amont par nature. Observabilité Vitória est `victoria.observabilite` = `simule` dégradé en `[]` sans `SYNELIA_VICTORIAMETRICS_URL`. |
| `impayes` | `/admin/facturation/impayes` | `admin` | `persiste` | — | |
| `agents-ia` | `/ia/agents` | `ia_agents` | `reel` | — | LiteLLM/OpenRouter. |
| `modeles-ia` | `/ia/modeles` | `ia_agents` | `persiste` (catalogue) | — | Seuls les modèles `invocable: true` sont réellement appelés via LiteLLM/OpenRouter à l’exécution. |
| `connaissances-ia` | `/ia/connaissances` | `ia_agents` (`connaissances.py`) | `reel` sur dev01 | — | Réel seulement si `SYNELIA_QDRANT_URL` définie (docstring du fichier). Vérifié en direct (2026-09-15) : `SYNELIA_QDRANT_URL`/`SYNELIA_DOCLING_URL`/`SYNELIA_EMBEDDINGS_URL` définies sur `synelia-backend-dev01-api-1`, conteneurs `qdrant`/`docling`/`infinity` tournent — pipeline Docling → BGE-M3 → Qdrant réel. Sinon `simule`. |
| `flux-ia` | `/ia/flux` | `ia_agents` (`flux.py`) | `reel` | — | Passerelle LiteLLM + recherche documentaire. |
| `cles-ia` | `/ia/cles` | `ia_agents` | `reel` | — | Gestion de clés côté LiteLLM. |
| `parc-instances` | `/admin/marketplace/instances` | `admin` | `persiste` | — | Inventaire, lecture seule. |
| `campagnes-maj` | `/admin/marketplace/campagnes` | `admin` | `simule` | `argo.application` | `ExecuteurMaj.terminer()` ne fait que `definir_statut(..., "terminee")` en base — aucun appel amont. |
| `vagues-migration` | `/admin/migration/campagnes` | `admin` | `simule` | `argo.application` | `ExecuteurMigration.terminer()` ne fait que `definir_statut(..., "terminee")` en base — aucun appel amont. |
| `tickets-plateforme` | `/admin/tickets` | `admin` | `persiste` | — | |
| `jobs-plateforme` | `/admin/travaux` | `admin` | `persiste` | — | |
| `attestations-generees` | `/attestations` | `conformite` | `persiste` | — | Générées depuis les données de conformité déjà en base. |
| `snapshots-<vmId>` (motif) | `/vms/{id}/instantanes` | `vms` | `reel` | `compute.serveur` | |
| `services-<projetId>` (motif) | `/projets/{id}/services` | `projets`/`applications` | `reel` | `k8s.workload` | |
| `variables-<projetId>` (motif) | `/projets/{id}/variables` | `projets` | `reel` | `k8s.workload` | `env_projet()` atteint réellement le conteneur applicatif déployé — pas un simple aller-retour DB. |
| `elevations-<id>` (motif) | `/admin/equipe/{id}/elevation` | `admin` | `persiste` | — | |

### Maquette seule

Clés lues par `useCollection` sans entrée dans `REGISTRE_COLLECTIONS` (ni motif
à suffixe) : la graine locale s'affiche même en mode API.

- `bases-hebergement`, `certifications-catalogue`, `comptes-fichiers`,
  `correspondances-sso`, `taches-web` — pas d'équivalent backend identifié à
  ce jour. `x-etat: maquette`, pas de `x-capacite`.
- `placements` — **n’est plus maquette** depuis 2026-09-19 (voir ligne `placements` ci-dessus : `x-etat: reel`). Reste un écart `REGISTRE_COLLECTIONS` à corriger côté front.
- `services-projet` (littéral, pas un identifiant de projet) — désigne la vue
  « tous les projets » des racines de section ; `endpointDe()` le distingue
  explicitement de `services-<projetId>` (voir le commentaire du code) et ne
  lui donne pas d'endpoint. `x-etat: maquette` volontaire.

Hors `useCollection` : les pages de la vitrine (`(site)/…` — offres,
témoignages, équipe, communauté, histoire, souveraineté, datacenters,
`marketplace/[service]`, pages légales) lisent `src/lib/mock/` par conception,
dans les deux modes — c'est du contenu public éditorial, pas une donnée de
tenant, il n'y a pas de gain à le rendre dynamique ici. Les séries de
supervision (`seededSeries`) et `LogPeek` sur les écrans d'observabilité
restent des graines tant que ces écrans ne sont pas branchés (§ « Reste pour
la vague 3 » ci-dessus). Un grand nombre de `[id]/page.tsx` serveur sous
`/app` et `/admin` importent `src/lib/mock/` — vérifié sur `vms/[vm]` et
`espaces/[id]` : c'est uniquement pour `generateMetadata` (titre d'onglet), la
donnée affichée vient du composant client voisin (`vue.tsx`) via
`useCollection`/`useEntite`. Une ressource créée uniquement par l'API aura donc
un titre d'onglet générique (« … introuvable ») mais un contenu de page
correct — un défaut cosmétique, pas un défaut de données.

## Vérification

```bash
# Le registre est la source de vérité — cette doc en est une projection
cat synelia-cloud-backend/packages/openstack/synelia_openstack/registre_capacites.py  # REGISTRE + etat_pour()

# Le contrat embarque x-etat par opération (socle.mjs:op() → x-etat, x-capacite, x-provisionnement)
bun run api:spec          # génère docs/api/openapi.json (375 chemins, 533 opérations)
grep -c '"x-etat"' docs/api/openapi.json
grep -c '"x-provisionnement"' docs/api/openapi.json   # domaines + certificats en simule

# La dérive est bloquante via derive
bun run api:derive              # informatif
bun run api:derive --strict     # sort 1 si x-etat simule sur-claim par collections.ts (COLLECTIONS vs openapi.json)
CONTRAT_STRICT=1 bun run api:derive
```

Référence registre : `synelia-cloud-backend/packages/openstack/synelia_openstack/registre_capacites.py:32` (`REGISTRE`), docstring ligne 1-9, `Capacite{id, module, classe_simule, classe_reel, env_gate, etat, detail}`.
