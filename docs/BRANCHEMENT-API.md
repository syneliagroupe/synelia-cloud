# Branchement API — la couture données

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

## Reste pour la vague 3

- Les créations dont le corps mock contient déjà les champs requis partent par
  le chemin générique (`POST` + `recharger`) sans `appel` dédié : données
  justes, mais pas de suivi fin du `202` dans le centre de tâches (réseaux,
  IP, groupes, LB, VPN, buckets, plans de sauvegarde/PRA, projets, sites,
  DNS, SMTP…).
- Écrans sans équivalent branché : souscription à un service managé (pas
  d’écran client dédié — vérifié au niveau API), estimation facturable (`POST
  /facturation/estimation`, aucun écran ne l’appelle — `CostPreview` calcule
  en local), attribution de sièges (`userId` backend vs `USERS` mock),
  ouverture SSO (`POST …/ouverture` → URL à ouvrir), politiques
  SSO (`PUT /securite/politiques`) — **console VM (`POST /vms/{vmId}/console`) est désormais branchée en réel** (voir table `vms` ci-dessous), consommation/ventilation facturation,
  métriques/journaux/événements d’observabilité (graines locales), tableaux de
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

## État réel par collection (2026-09-19 — mis à jour, vérifié contre openapi.json + Subagent A)

Quatre états, et pas un de plus :

| État | Sens |
|---|---|
| **réel** | le backend répond et pilote un amont réel (Nova, Neutron, Cinder, Magnum, Octavia, Designate, MinIO, Zimbra, LiteLLM/OpenRouter, SSH) |
| **persisté** | le backend répond depuis sa base ; il n'y a pas d'amont à piloter par nature (membres, jetons, tickets, factures, journal d'audit…) |
| **simulé côté backend** | le backend répond `2xx`/`202` mais l'amont est un stub vide ou l'exécuteur n'appelle rien : un faux succès |
| **maquette seule** | la collection n'est pas dans le registre, ou l'écran lit une graine : rien ne part vers le backend même en mode API |

Dérivé initialement le 2026-09-08 par lecture du code backend (`synelia-cloud-backend`,
`packages/openstack/synelia_openstack/` pour les connecteurs `*Simule` /
`*OpenStack`/`*Reel`, `apps/synelia/synelia/modules/<module>/service.py` pour
leur usage réel dans les exécuteurs de mutation), pas vérifié en direct
collection par collection — seuls les points déjà vérifiés lors des passes
2026-09-04/05/07 sont marqués comme tels. **Mise à jour 2026-09-19** : `serveurs-bases` → réel (PR #15 2026-09-18), `certificats` → simulé intentionnel (gate `SYNELIA_ACME_URL`), console VM → réel, vérifié contre `openapi.json` + Subagent A §4.

| Collection | Endpoint | Module backend | État | Remarque |
|---|---|---|---|---|
| `vms` | `/vms` | `vms` | réel | Création, arrêt/démarrage, redimensionnement, suppression, instantané (création) **et restauration** réels (`ComputeOpenStack`). La restauration d'instantané (`ExecuteurVmRestore`) a longtemps été un faux succès (mémoire `vm-snapshot-restore-fake-success-bug`) ; le code actuel a un `etape()` réel (`amont().restaurer` = `rebuild_server`) — corrigé côté backend depuis, ce document le dit à jour. **Console VM `POST /vms/{vmId}/console` est réelle** (`ComputeOpenStack.get_console_url` via Nova, `ConsoleVm{url, protocole, expire}`) — était listée en « reste vague 3 » en 2026-09-08, désormais branchée. |
| `espaces` | `/espaces` | `espaces` | réel | Keystone (projet) + Neutron (réseau) via `IdentiteOpenStack`. |
| `volumes` | `/volumes` | `stockage` | réel | Cinder (`BlockStorageOpenStack`). |
| `buckets` | `/buckets` | `stockage` | réel | MinIO (`MinioReel`). |
| `cles-s3` | `/cles-s3` | `stockage` | réel | MinIO. |
| `clusters` | `/kubernetes` | `kubernetes` | réel | Magnum (`MagnumOpenStack`). |
| `reseaux` | `/reseaux` | `reseau` | réel | Neutron. |
| `ips` | `/ips` | `reseau` | réel | IP flottantes, Neutron. |
| `groupes-securite` | `/groupes-securite` | `reseau` | réel | Neutron. |
| `load-balancers` | `/load-balancers` | `reseau` | réel | Octavia. |
| `tunnels` | `/vpn` | `reseau` | réel | Neutron VPNaaS. |
| `plans-sauvegarde` | `/sauvegarde/plans` | `sauvegarde` | réel | Réel et honnête sur l'échec. |
| `points-restauration` | `/sauvegarde/points` | `sauvegarde` | réel | |
| `plans-pra` | `/pra` | `pra` | réel | |
| `conformite-sauvegarde` | `/sauvegarde/conformite` | `sauvegarde` | réel | Tableau calculé depuis les données réelles de sauvegarde. |
| `projets` | `/projets` | `projets` | réel | PaaS : Magnum/`K8sWorkloadReel`, dépôts (`DepotsReel`). |
| `deploiements` | `/deploiements` | `deploiements` | réel | Persistance, RBAC et journal d'audit réels ; le pipeline lui-même (`ExecuteurAppDeploy`) est un théâtre d'étapes — build/scan/provision/deploy ne construisent aucune image et n'appellent jamais `K8sWorkloadReel` (contrairement à `projets`, qui l'appelle réellement pour un service). Le canari (`/deploiements/{id}/canari`) stocke un pourcentage sur l'environnement sans jamais le faire respecter par un routeur. Voir `DEMO-TODO.md`, Ouvert, 2026-09-14. |
| `domaines-applicatifs` | `/domaines-applicatifs` | `projets` (`router_domaines`) | réel | |
| `factures` | `/facturation/factures` | `facturation` | persisté | |
| `souscriptions` | `/facturation/souscriptions` | `facturation` | persisté | |
| `moyens-paiement` | `/facturation/moyens-paiement` | `facturation` | persisté | |
| `memberships` | `/membres` | `membres` | persisté | |
| `invitations` | `/invitations` | `membres` (`router_invitations`) | persisté | |
| `jetons-api` | `/securite/cles-api` | `securite` | persisté | |
| `sessions` | `/securite/sessions` | `securite` | persisté | |
| `tickets` | `/support/tickets` | `support` | persisté | |
| `jobs` | `/travaux` | `travaux` | persisté | Lecture d'état ; les exécuteurs qu'un travail suit sont réels ou non selon leur propre ligne dans cette table. |
| `organisations` | `/organisations` | `organisations` | persisté | |
| `offres` | `/admin/catalogue/offres` | `admin_catalogue` | persisté | |
| `backends` | `/admin/backends` | `admin` | réel | `capacite_plateforme()` via Nova, réel depuis 2026-09-07. |
| `incidents` | `/admin/statut/incidents` | `admin` | persisté | |
| `equipe-synelia` | `/admin/equipe` | `admin` | persisté | |
| `hebergements` | `/web/hebergements` | `web_hebergement` (`router_hebergements`) | réel | Nova + SSH + Network. |
| `sites-web` | `/web/sites` | `web_hebergement` (`router_sites`) | réel | SSH (déploiement/retrait de sites). |
| `serveurs-bases` | `/web/bases` | `web_hebergement` (`router_bases`) | réel | Branché pour de vrai depuis **PR #15 (2026-09-18)** : mot de passe racine propagé, `MDB_MDP` fixé côté `service.py` — était simulé le 2026-09-08 (« Aucun MariaDB mutualisé »), désormais réel. À ne pas confondre avec `bases-managees` (`/bases`), réelle, qui provisionne une VM Nova dédiée par base. |
| `domaines` | `/web/domaines` | `web_domaines` | simulé côté backend | `RegistrarOpenStack` hérite intégralement de `RegistrarSimule` sans surcharger une seule méthode : commande, transfert, code-auth renvoient des valeurs figées même en mode `openstack`. |
| `messageries` | `/web/emails` | `web_emails` | réel | Zimbra (`ZimbraReel`, SOAP admin). |
| `drives` | `/web/drive` | `web_drive` | réel | SSH + règles de load-balancer réelles. |
| `certificats` | `/web/ssl` | `web_ssl` | simulé intentionnel (gate) | `AcmeReel` existe et fait de vrais appels HTTP, mais **gate `SYNELIA_ACME_URL` jamais posée** → toujours `AcmeSimule` (Subagent A §4 `acme.py` = simulé). Table disait « réel » le 2026-09-08 alors que branché = faux. Si `SYNELIA_ACME_URL` est posée, `AcmeReel` devient réel. |
| `cles-smtp` | `/web/smtp/cles` | `web_smtp` | réel | `RelaisSmtpReel`. |
| `webhooks-smtp` | `/web/smtp/webhooks` | `web_smtp` | persisté | Configuration seule (URL, secret) ; aucun appel amont à leur création. |
| `zones-dns` | `/web/dns` | `web_dns` | réel | Designate (`DesignateOpenStack`). |
| `sauvegardes-web` | `/web/backup` | `web_backup` | réel | Instantané/restauration/test via `Compute` ; le code note que ce chemin était un no-op complet avant d'être câblé. |
| `devis` | `/facturation/devis` | `facturation` | persisté | |
| `bases-managees` | `/bases` | `bases` | réel | VM Nova dédiée par base (`ComputeOpenStack`), pas un moteur mutualisé — à ne pas confondre avec `serveurs-bases` ci-dessus. |
| `regles-alertes` | `/observabilite/alertes` | `observabilite` | persisté | Règles seules ; pas d'amont par nature (comme une règle RBAC). |
| `impayes` | `/admin/facturation/impayes` | `admin` | persisté | |
| `agents-ia` | `/ia/agents` | `ia_agents` | réel | LiteLLM/OpenRouter. |
| `modeles-ia` | `/ia/modeles` | `ia_agents` | persisté (catalogue) | Seuls les modèles `invocable: true` sont réellement appelés via LiteLLM/OpenRouter à l'exécution. |
| `connaissances-ia` | `/ia/connaissances` | `ia_agents` (`connaissances.py`) | réel sur dev01 | Le code se déclare explicitement « réel seulement si `SYNELIA_QDRANT_URL` est défini... sans cette variable, tout reste simulé et sans réseau » (docstring du fichier). Vérifié en direct (2026-09-15) : `SYNELIA_QDRANT_URL`/`SYNELIA_DOCLING_URL`/`SYNELIA_EMBEDDINGS_URL` sont bien définies sur le conteneur `synelia-backend-dev01-api-1` (`docker inspect`), les conteneurs `qdrant`/`docling`/`infinity` tournent — pipeline Docling → BGE-M3 → Qdrant réel, pas simulé. |
| `flux-ia` | `/ia/flux` | `ia_agents` (`flux.py`) | réel | Passerelle LiteLLM + recherche documentaire. |
| `cles-ia` | `/ia/cles` | `ia_agents` | réel | Gestion de clés côté LiteLLM. |
| `parc-instances` | `/admin/marketplace/instances` | `admin` | persisté | Inventaire, lecture seule. |
| `campagnes-maj` | `/admin/marketplace/campagnes` | `admin` | simulé côté backend | `ExecuteurMaj.terminer()` ne fait que `definir_statut(..., "terminee")` en base — aucun appel amont. |
| `vagues-migration` | `/admin/migration/campagnes` | `admin` | simulé côté backend | `ExecuteurMigration.terminer()` ne fait que `definir_statut(..., "terminee")` en base — aucun appel amont. |
| `tickets-plateforme` | `/admin/tickets` | `admin` | persisté | |
| `jobs-plateforme` | `/admin/travaux` | `admin` | persisté | |
| `attestations-generees` | `/attestations` | `conformite` | persisté | Générées depuis les données de conformité déjà en base. |
| `snapshots-<vmId>` (motif) | `/vms/{id}/instantanes` | `vms` | réel | |
| `services-<projetId>` (motif) | `/projets/{id}/services` | `projets`/`applications` | réel | |
| `variables-<projetId>` (motif) | `/projets/{id}/variables` | `projets` | réel | `env_projet()` fait réellement atteindre le conteneur applicatif déployé (Docker Compose ou Deployment k8s) — pas un simple aller-retour DB. |
| `elevations-<id>` (motif) | `/admin/equipe/{id}/elevation` | `admin` | persisté | |

### Maquette seule

Clés lues par `useCollection` sans entrée dans `REGISTRE_COLLECTIONS` (ni motif
à suffixe) : la graine locale s'affiche même en mode API.

- `bases-hebergement`, `certifications-catalogue`, `comptes-fichiers`,
  `correspondances-sso`, `taches-web` — pas d'équivalent backend identifié à
  ce jour.
- `placements` — le backend expose pourtant `PUT /admin/placements` : c'est un
  écart du registre, pas une absence de capacité backend. À ajouter au
  registre si l'écran doit devenir réel.
- `services-projet` (littéral, pas un identifiant de projet) — désigne la vue
  « tous les projets » des racines de section ; `endpointDe()` le distingue
  explicitement de `services-<projetId>` (voir le commentaire du code) et ne
  lui donne pas d'endpoint.

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
