# Couverture du cahier des charges MIA

Ce document rattache chaque fonction du cahier des charges *Mise en place d'une
plateforme d'orchestration d'agents IA* (Orange Côte d'Ivoire, v1.0 du 26/05/2026,
18 pages) à l'écran qui la porte dans la maquette.

Le CDC décrit **6 modules et 39 fonctions** numérotées `FONC-01.1` à `FONC-06.9`.
Elles sont toutes prises une par une ci-dessous, avec l'écran correspondant. Il a
servi de grille de construction : ce n'est pas une liste de fonctionnalités
imaginées après coup.

Branche : `claude/ai-gateway-universe-ptjxux`.

---

## 1. Ce qui a été construit

L'univers **IA & Agents** compte dix sections côté client et une côté fournisseur.

| Écran | Ce qu'il porte |
|---|---|
| `/app/ia` | Tableau de bord : requêtes, jetons, part traitée sur le territoire, dépense, agents en production |
| `/app/ia/agents` | Liste et fiche à six onglets : consigne annotée, outils et connaissances, garde-fous et mémoire, publication, versions et épreuves, traces et annotations |
| `/app/ia/agents/new` | Assistant en quatre étapes, aperçu de coût, création en brouillon |
| `/app/ia/orchestration` | Studio de flux au patron d'Activepieces, exécutions, réglages |
| `/app/ia/integrations` | Catalogue des outils et des canaux, routeur omnicanal |
| `/app/ia/modeles` | Douze modèles, résidence, tarif, performance, appel |
| `/app/ia/passerelle` | Point d'entrée, clés, coffre-fort des clés fournisseurs |
| `/app/ia/routage` | Règles de routage, garde-fous, matrice de résidence |
| `/app/ia/connaissances` | Bases vectorielles, connecteurs, découpage, filtres de métadonnées |
| `/app/ia/consommation` | Coûts, plafond, alertes de seuil, quotas par direction |
| `/admin/ia` | Modèles appelés, agents et orchestration par organisation |

Jeu de données dans `src/lib/mock/ia.ts` : 12 modèles, 6 agents, 13 outils,
8 canaux, 3 flux, 5 bases de connaissances, 3 points d'inférence, une trace
d'exécution en dix étapes, annotations, alertes, quotas, coffre de clés.

RBAC : `ia.agent.write`, `ia.agent.publish`, `ia.flow.write`, `ia.tool.register`,
`ia.key.manage`, `ia.routing.update`, `ia.endpoint.deploy`, `ia.knowledge.write`,
`ia.budget.update`.

**Inférence dédiée supprimée.** `/app/ia/inference` (GPU réservés) et le parc
GPU / les contrats fournisseurs d'`/admin/ia` ont été retirés : il n'y a pas de
GPU sur cette plateforme, le calcul passe entièrement par LiteLLM devant
OpenRouter en pay-per-token — voir la décision « Inférence dédiée » dans
`CLAUDE.md`.

**Ce qui est réellement câblé, au-delà de la maquette.** Modèles, Agents
(création, modification, statut, invocation), Connaissances (Docling → BGE-M3 →
Qdrant), Orchestration (exécution de flux via LiteLLM) et Consommation lisent un
vrai backend (`/ia/modeles`, `/ia/agents`, `/ia/connaissances`, `/ia/flux`,
`/ia/cles`). Un agent créé via l'API n'a que dix champs — pas d'outils, de
connaissances attribuées, de mémoire, de canaux, de versions ni de jeu
d'épreuves côté serveur : la fiche d'agent le montre en clair (carte réduite au
lieu des six onglets), avec publication/suspension réelles (`PATCH statut`, sans
gate de réussite ni bascule progressive — cette gouvernance n'existe que pour les
agents de démonstration) et l'appel direct `POST /ia/agents/{id}/invoquer`.
**Intégrations reste entièrement maquette** : ni `OutilAgent` ni un canal n'ont
de contrepartie dans le contrat backend, aucun endpoint `/ia/outils` ou
`/ia/canaux` n'existe — vérifié à nouveau, pas seulement supposé.

---

## 2. Les trois partis pris

**Un agent se construit ici, il se parle ailleurs.** Le portail définit, borne,
publie, observe et facture. La conversation a lieu sur le canal publié — widget,
WhatsApp, SMS, voix, API. Pas de fenêtre de discussion dans le portail : ce serait
reconstruire l'écran principal d'un produit de conversation, et cela masquerait le
vrai sujet, qui est la gouvernance.

**L'orchestration se voit en entier ou ne se voit pas.** Chaque étape du studio
porte ce qu'elle dure, ce qu'elle coûte pour mille passages et ce qu'elle rate. Un
graphe sans ces trois chiffres serait un dessin.

**Ce qui doit être impossible ne se règle pas dans une consigne.** La consigne
oriente ; la portée de l'outil vérifiée côté API, le garde-fou d'entrée et la
classe de données empêchent. C'est exactement là que les plateformes d'agents
déçoivent en production, et chaque écran rend la différence visible.

---

## 3. Le studio d'orchestration

Le CDC demande un studio en glisser-déposer (FONC-02.1). Le patron retenu est
celui d'**Activepieces**, pas celui d'un canevas libre à la n8n :

- colonne verticale de haut en bas, cartes de 260 px, déclencheur en tête ;
- bouton `+` entre chaque étape pour insérer, avec un sélecteur de pièces groupé
  en trois familles (intelligence, logique, actions) ;
- **glisser une carte sur un bouton `+` la déplace** ; la déposer ailleurs ne fait
  rien, et un déplacement entre deux branches est refusé avec sa raison ;
- aiguillage à branches nommées portant leur part de trafic, plus une branche de
  repli ; corps de boucle encadré avec sa mention de retour ;
- panneau de configuration à droite : nom, identifiant, cible, condition, reprise
  sur erreur, et ce qui est mesuré sur l'étape ;
- barre de canevas : réduire, agrandir, revenir à 100 %.

Le flux est un **arbre** (`EtapeFlux` avec `branches` et `corps`) : la disposition
se calcule au rendu. C'est ce qui permet d'insérer une étape sans rien déplacer, et
ce qui rend l'export YAML lisible.

---

## 4. Couverture, fonction par fonction

`✓` construit · `↗` couvert par un écran préexistant de la maquette.

### FONC-01 — Gestion et configuration des agents

| Code | Fonction | Où | État |
|---|---|---|---|
| 01.1 | Création de profil agent | `/app/ia/agents/new`, fiche d'agent | ✓ |
| 01.2 | Assignation du modèle | Fiche d'agent, onglet *Rôle & consigne* | ✓ |
| 01.3 | Édition du system prompt | Fiche d'agent, consigne annotée | ✓ |
| 01.4 | Variables dynamiques `{{…}}` | Fiche d'agent, table des variables | ✓ |
| 01.5 | Versioning et retour arrière | Fiche d'agent, onglet *Versions* | ✓ |
| 01.6 | Hyperparamètres | Température, Top-P, jetons, stratégie, itérations | ✓ |
| 01.7 | Attribution des outils | Fiche d'agent + `/app/ia/integrations` | ✓ |

01.1, 01.2, 01.3 et 01.6 sont réels pour un agent créé via l'API (`POST`/`PATCH
/ia/agents`) ; 01.4, 01.5 et 01.7 restent construits uniquement pour les agents
de démonstration — le contrat backend ne porte ni variables, ni versions, ni
outils attribués à ce jour.

### FONC-02 — Moteur d'orchestration et multi-agents

| Code | Fonction | Où | État |
|---|---|---|---|
| 02.1 | Studio visuel de workflow | `/app/ia/orchestration`, patron Activepieces | ✓ |
| 02.2 | Orchestration séquentielle | Colonne verticale, une étape après l'autre | ✓ |
| 02.3 | Orchestration parallèle | Aiguillage en mode « toutes les branches vraies » | ✓ |
| 02.4 | Routage conditionnel | Branches nommées avec condition et part de trafic | ✓ |
| 02.5 | Boucle humaine | Étape *Validation humaine*, seuil à 50 000 FCFA | ✓ |
| 02.6 | Mémoire partagée | Fiche d'agent et réglages du flux | ✓ |
| 02.7 | Reprise sur erreur | Tentatives par étape, comportement après épuisement | ✓ |

### FONC-03 — Connaissance et RAG

| Code | Fonction | Où | État |
|---|---|---|---|
| 03.1 | Import de documents | Connecteur *Téléversement direct* | ✓ |
| 03.2 | Connecteurs externes | SharePoint, Confluence, Notion, Drive, S3, git, web | ✓ |
| 03.3 | Découpage automatique | Taille de fragment, recouvrement, stratégie, mode | ✓ |
| 03.4 | Vectorisation | Modèle d'embedding, dimensions, méthode d'index | ✓ |
| 03.5 | Recherche sémantique | Mode vectoriel, plein texte ou hybride, reclassement | ✓ |
| 03.6 | Filtres de métadonnées | Table des attributs et de leur couverture | ✓ |

### FONC-04 — Observabilité, journaux et supervision

| Code | Fonction | Où | État |
|---|---|---|---|
| 04.1 | Tableau de bord de consommation | `/app/ia` | ✓ |
| 04.2 | Suivi financier | `/app/ia/consommation`, en FCFA | ✓ |
| 04.3 | Traçabilité des prompts | Fiche d'agent, onglet *Traces* | ✓ |
| 04.4 | Chaîne de pensée inspectable | Trace en dix étapes, durée et jetons par étape | ✓ |
| 04.5 | Alertes de dépassement | Règles d'alerte, canaux e-mail, WhatsApp, webhook | ✓ |

### FONC-05 — Sécurité, gouvernance et administration

| Code | Fonction | Où | État |
|---|---|---|---|
| 05.1 | Authentification unique | `/app/sso` — OIDC, SAML 2, annuaire | ↗ |
| 05.2 | Gestion des rôles | Matrice RBAC, neuf actions IA | ✓ |
| 05.3 | Masquage des données personnelles | Garde-fou *Données personnelles* | ✓ |
| 05.4 | Coffre-fort de clés fournisseurs | `/app/ia/passerelle` | ✓ |
| 05.5 | Quotas par utilisateur ou direction | `/app/ia/consommation` | ✓ |

### FONC-06 — Connecteurs multicanaux et API

| Code | Fonction | Où | État |
|---|---|---|---|
| 06.1 | WhatsApp Business | `/app/ia/integrations`, onglet *Canaux* | ✓ |
| 06.2 | Telegram | idem | ✓ |
| 06.3 | SMS bidirectionnel | idem, découpage à 160 caractères | ✓ |
| 06.4 | Transcription vocale | idem — Whisper souverain, à Abidjan | ✓ |
| 06.5 | Synthèse vocale | idem | ✓ |
| 06.6 | Couplage téléphonique | idem — état *à configurer*, plan de numérotation | ✓ |
| 06.7 | API REST synchrone | Fiche d'agent, onglet *Publication* | ✓ |
| 06.8 | WebSocket | `/app/ia/integrations`, onglet *Canaux* | ✓ |
| 06.9 | Routeur de contexte omnicanal | idem, carte dédiée | ✓ |

**39 fonctions sur 39.** 38 construites dans l'univers, 1 couverte par un écran
préexistant de la maquette.

---

## 5. Au-delà du cahier des charges

Repris de l'état de l'art des plateformes d'agents, parce que le CDC ne les demande
pas mais qu'ils manqueraient en production :

- **Déclencheurs** — message entrant, planification, dépôt de fichier ; le CDC ne
  parle que de messages.
- **Stratégie d'agent** — appel de fonction natif ou boucle ReAct, avec un plafond
  d'itérations.
- **Sorties structurées** — schéma JSON imposé, pour les agents dont le résultat
  est relu par du code.
- **Publication en serveur MCP** — un agent publié devient un outil pour d'autres
  systèmes, avec sa propre portée et son propre budget.
- **Jeu d'épreuves bloquant** — sous 80 % de réussite, la publication est refusée
  par la plateforme.
- **Annotations rejouées** — une réponse corrigée par un humain est resservie sur
  les questions équivalentes, sans réentraîner quoi que ce soit.
- **Variables à trois portées** — environnement (secrets jamais exportés),
  conversation, système.
- **Conservation des journaux** — trois mois consultables, puis archives ; cinq ans
  pour les classes réglementées.

---

## 6. Ce qui reste ouvert

- **Le multi-agent hiérarchique** — un agent superviseur qui délègue à des agents
  subordonnés. Le modèle de données le permettrait ; aucun écran ne le montre. À
  laisser de côté tant que le besoin n'est pas exprimé.
- **Dix sections dans une barre** est le maximum tenable. Si les agents prennent de
  l'ampleur, séparer « IA & Agents » (agents, orchestration, outils) de
  « Modèles & passerelle » (le reste).
- **Le déplacement d'une étape entre deux branches** est refusé, avec sa raison. Le
  permettre demanderait de traiter le cas des variables référencées depuis la
  branche d'origine — c'est un vrai sujet, pas une limite de maquette.
