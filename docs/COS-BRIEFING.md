# COS briefing — Synelia Cloud portal

Read-only snapshot of how the portal is built, how to run it, how it deploys, known gaps, and the local battery run against the GitHub default branch.

**This document describes the tree that was checked out.** `main` is a different, newer line of history (see [Default branch](#default-branch)).

| | |
|---|---|
| Repo | `syneliagroupe/synelia-cloud` |
| GitHub `default_branch` | `claude/marketplace-admin-vercel-x4f2mh` |
| Ref used | `a408f405efa57aaffeee523e26d4a7f929c6e44d` |
| Tip commit | *Déploiement par GitHub Actions : main en production, les autres branches en prévisualisation* |
| Battery date | 2026-09-17 |
| Live API | **None.** Screens import `src/lib/mock/`. Session mutations live in the in-memory *atelier*. |

---

## Default branch

GitHub reports `default_branch`: **`claude/marketplace-admin-vercel-x4f2mh`**. `origin/HEAD` points there. That is the branch this briefing and its PR are based on.

`main` still exists (`d74aa2a809295835780c3cc37ee21d06ff6b61a1`, merge of `claude/cartes-service-cliquables`). Relative to the default-branch tip:

- `main` is **28 commits ahead**
- the default branch is **0 commits ahead of `main`** (it is an **ancestor** of `main`)

`.github/workflows/vercel.yml` still treats **`main` as production** and every other branch as preview. So:

- GitHub’s default clone/PR base ≠ the production deploy branch
- work merged only into the GitHub default branch will **not** go to production until it also lands on `main`
- anyone cloning without a specified ref gets this older tree, not `main`

Notable product work that exists on `main` and **not** on this ref includes: clickable service cards, project-creation / LB / K8s linking, simplified user management, removal of the Infrastructure “Bases managées” tab, Kubernetes/Applications shell + internal URLs, project vs application-deploy split, variable/secret workflows, disable of the proposed-architecture step, Drive/mail user management, web-hosting transfer accounts.

---

## What this is

A **functional mock** of a multi-tenant cloud portal: public marketing site, customer console (`/app`), provider console (`/admin`). All data is fictional. There is no network client, no database, no Next.js `app/api` route.

Stack: **Next.js 15.5.23** (App Router + Turbopack), **React 19**, **Tailwind 4**, **TypeScript 5.9**, package manager **bun 1.4.0** (`bun.lock` v2). Dependencies are pinned **without carets**.

---

## App Router

Root: `src/app/`. Three route groups plus the two authenticated spaces:

| Tree | Role |
|---|---|
| `src/app/layout.tsx` | Fonts (Montserrat, Open Sans, JetBrains Mono), `metadataBase` from Vercel URL or `https://cloud.synelia.tech` |
| `src/app/(site)/` | Public vitrine (`bg-creme`). Header + footer. Routes: `/`, tarifs, simulateur, marketplace, offres, souveraineté, datacenters, statut, équipe, etc. |
| `src/app/(auth)/` | Login UX **without a password field**. `/login`, `/login/sso`, `/callback`, `/select-organisation`, `/signup`, `/invitation/[token]` |
| `src/app/app/` | Customer console. `AppProvider` + `TopBar portee="client"` + `Conteneur` |
| `src/app/admin/` | Provider console. Same provider with `roleInitial="super_admin"` + `ConteneurAdmin` |

There is **no `middleware.ts`**. Authenticated layouts do not check a cookie or JWT. Deep-linking `/app` or `/admin` works without a login.

`outils/routes.json` lists **191** demo URLs (concrete IDs such as `dba.africa`, `heb-dba`). `next build` on this ref emitted **99** generated pages (dynamic segments collapsed: ƒ vs ○). `next.config.ts` sets `turbopack.root` and `eslint.ignoreDuringBuilds: true` (lint is a separate command).

Navigation model: `src/lib/navigation.ts` — two bars (universes, then sections). `sectionActive()` uses the **longest prefix**. Layout width is `gabarit()`: `plein` / `large` / `borne`.

---

## Auth (demo only)

Product story: identity is **Keycloak**; the portal never stores or paints a password.

Implemented flow:

1. `/login` — email field + “Continuer” → `/callback` (no IdP).
2. `/callback` — timed fake OIDC steps (`authorization_code+pkce`, issuer `sso.synelia.cloud/realms/dba-africa`) → `/select-organisation`.
3. `/select-organisation` — picks from `MES_ORGANISATIONS` in mock data; every card links to `/app`.
4. `/login/sso` — domain lookup against a hardcoded directory list.

RBAC is a **role switcher** in the top bar (`setRole` in `src/components/app/contexte.tsx`). Default customer role: `org_admin` (`ROLE_COURANT_DEFAUT`). Admin layouts start as `super_admin`. Matrix: `src/lib/rbac.ts` (`can`, `GatedAction` — forbidden actions stay visible but disabled).

Roles (two families only; **no reseller**):

`super_admin` · `platform_operator` · `org_admin` · `espace_admin` · `project_owner` · `operator` · `service_admin` · `billing_manager` · `compliance` · `read_only`

---

## Universes

Customer (`UNIVERS_CLIENT`):

| Universe | Pattern | Sections (this ref) |
|---|---|---|
| **Global** | Bounded width | Dashboard `/app`, supervision, billing, support, docs, settings. Tasks `/app/taches` and launcher `/app/lanceur` hang off the dashboard tab |
| **Infrastructure** (IaaS) | Full width + **one Cloud Space selector** (`panneauEspace`) for all tabs except Accueil | Accueil, Espaces, VMs, Kubernetes, LBs, Réseau & VPN, block storage, S3, **Bases managées**, Sauvegardes & PRA |
| **Applications** (PaaS) | Full width + **shared project panel** on every section except Accueil | Accueil, Projets, Déploiements, Observabilité, Backup, Domaines & routage, Variables & secrets, Paramètres |
| **IA & Agents** | Full width + **per-section resource panel** (Web Cloud pattern) | Accueil, Agents, Orchestration, Connaissances, Intégrations, Modèles, Inférence dédiée, Consommation, Paramètres (six fixed settings) |
| **Web Cloud** | Full width + per-section resource panel | Accueil, Domaines, Hébergement, Databases, Emails, Drive, Applications, SSL, Backup, Relais SMTP (`/app/smtp`) |
| **IAM & sécurité** | Bounded | Membres, SSO, Sécurité & audit |

Provider (`UNIVERS_SUPER_ADMIN`): Pilotage, Clients (org panel), Infrastructure (capacity, GPU/IA, sites, migration), Produit (catalogue, marketplace), Finance, Exploitation (tickets, audit, conformité, équipe).

A **domain is attached to one hosting server**. The portal is a **map to upstream products**, not a rebuild of webmail, file explorer, ERP UI, CMS editor, or log query builder. Observability widgets are capped: `StatTile`, `SparkChart` (24h/7j/30j), `EventList` (≤8), `LogPeek` (≤20), plus egress links.

Magenta `#C0297A` is reserved (hero hook, managed-service **Ouvrir**, SSO flow labels). Amounts are **FCFA**. Frozen clock: `MAINTENANT` = `2026-08-19T15:20:00Z`. No `Math.random()` / live `Date.now()` in render.

---

## Mock vs live API

| Layer | Where | Role |
|---|---|---|
| Types | `src/lib/types.ts` | Field names the UI (and the OpenAPI schemas) share |
| Seed data | `src/lib/mock/*.ts` | Orgs, IaaS, PaaS, Web, IA, commerce, vitrine, workflow catalogue, … |
| Session state | `src/components/app/atelier.tsx` | Overlay: untouched collections read the seed (SSR = first client paint). Reload resets. |
| Long jobs | `src/lib/mock/workflows.ts` + `src/lib/workflows.ts` | Announced durations; two workflows fail on first try so `failed` / retry exist |
| Mutations | `BoutonAction` / `BoutonFormulaire` / `useOperation()` | RBAC → patch → toast → optional job → audit row |
| Contract | `docs/api/openapi.json` (**generated**) | What a future backend must serve |

**No code path calls a backend.** Replacing mock means implementing `docs/api/openapi.json` and swapping imports; the UI is written against the TypeScript types, not against `fetch`.

OpenAPI on this tree (measured from `docs/api/openapi.json`): **3.0.3**, **364 paths**, **514 operations**. Generator: `bun run api:spec` → `outils/openapi/` (do not edit the JSON by hand). Conventions: `/v1`, `{ erreur }` envelope, `202` + `TravailProvisioning`, destructive `confirmation` = exact name, `403` names required roles, `424` dated upstream outage. Scopes: client `/`, admin `/admin/**`, public `/public/**`.

`docs/api/README.md` on this ref still says 514 operations; `CLAUDE.md` mentions 527 — treat the JSON as source of truth.

---

## How to run

Requires **bun ≥ 1.4.0** (lockfile v2). Never npm/yarn/pnpm.

```bash
curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.0"
bun install
bun run dev          # next dev --turbopack
bun run build        # next build --turbopack (~25 s here)
bun run start
bun run typecheck    # tsc --noEmit
bun run lint         # next lint
bun run api:spec     # regenerate docs/api/openapi.json
```

There is **no `test` script** and **no `*.test.*` / `*.spec.*` files**.

Visual audit (not in `package.json`): build + start, then Chromium over the 191 routes:

```bash
bun add -d playwright   # once
pkill -f next-server    # stale next start serves old .next
bun run build && bun run start
BASE=http://127.0.0.1:3111 node outils/audit.mjs
LARGEUR=390 HAUTEUR=800 node outils/audit.mjs
```

Expected: zero console/HTTP errors, zero horizontal overflow, WCAG AA contrast, named buttons, real document titles — at 390 px and 1440 px.

---

## Deploy

- `vercel.json`: `git.deploymentEnabled: false` so Vercel Git integration does not double-deploy.
- `.github/workflows/vercel.yml`: every push; **`main` → `--prod`**, other branches → preview; concurrency per ref; comments preview URL on open PRs.
- Runner does **not** build: `npx vercel@latest deploy --yes --archive=tgz`. Vercel’s bun cannot read lockfile v2 and re-resolves; a local `vercel build` would not match.
- Secret: `VERCEL_TOKEN`. Org/project IDs are in the workflow (`team_OK32u0Kw0W0VTHna9v2r5LnQ` / `prj_53cyLREuPg0BjZK0vO0hRyPWfqgr`).
- Manual: `bunx vercel@latest --prod --yes --archive=tgz --token "$VERCEL_TOKEN"`.
- Public homepage on GitHub: `https://synelia-cloud.vercel.app`.

---

## Key docs

| File | In this tree? | What it is |
|---|---|---|
| `CLAUDE.md` | yes | Working notes: tools, non-negotiables, navigation, gaps |
| `Design.md` | yes | Graphic charter as implemented (`Ronde & claire`; CSS in `src/app/globals.css` wins on conflict) |
| `PLAN-AGENTS-MIA.md` | yes | Orange CI MIA CDC: 6 modules / 39 functions → IA screens |
| `docs/CONTRAT-UI.md` | yes | UI contract for anyone adding a screen (reuse components, no new primitives) |
| `docs/api/README.md` | yes | OpenAPI conventions and generator |
| `SPECBUILDSYNELIACLOUD.md` | **no** | Original 1143-line spec; cited in `CLAUDE.md`, not committed |

`PLAN-*` glob: only `PLAN-AGENTS-MIA.md`.

---

## Gaps (as recorded on this ref)

From `CLAUDE.md` “Ce qui reste à faire”, still true on `a408f40`:

1. **`/app/docs`** — no training path, completion tracking, or sandbox access.
2. **i18n** — French hard-coded; no locale mechanism.
3. **Launcher as home** — `/app/lanceur` exists; no setting pins it for end-user-only roles.
4. **RBAC refusals from the UI** — `useOperation()` can write `result: 'refuse'`, but `GatedAction` uses `pointer-events-none`, so the click never fires. Seed data supplies the refusals an auditor would see.
5. **Customer dashboard `/app`** — server component reads seed `AUDIT`, not the atelier journal. Session-created audit rows show on `/admin/audit` and `/app/securite`, not on `/app`.

Structural (this mock, by design):

- No live API, no middleware session, login is theatre.
- No automated unit/e2e suite in `package.json` (Playwright audit is a separate harness).
- GitHub default branch is not `main`; production workflow targets `main`.
- Marketplace as a **customer universe** was removed in later product notes; this ref still has `/admin/marketplace` and a public marketplace, and CLAUDE still describes marketplace as moved into Web Cloud / deployable templates.

`PLAN-AGENTS-MIA.md` still mentions older IA routes (`/app/ia/outils`, `/app/ia/passerelle`, `/app/ia/routage`) that on this tree live under Intégrations and Paramètres.

---

## Battery results (2026-09-17)

Environment: bun **1.4.0**, Node **v22.14.0**, `bun install` OK (327 packages). Commands run from `/workspace` at `a408f40`.

| Command | In `package.json`? | Result |
|---|---|---|
| `bun run test` | **no** | **FAIL** (harness, not product). bun executed `/usr/bin/test` → exit 1. Note: `a package.json script "test" was not found`. No test files in the repo. |
| `bun run lint` | yes | **PASS**. `✔ No ESLint warnings or errors`. `next lint` deprecation warning (removed in Next 16). |
| `bun run typecheck` | yes | **PASS**. `tsc --noEmit`, exit 0. |
| `bun run build` | yes | **PASS**. Next 15.5.23 Turbopack; compile ~7.1 s; 99 static pages generated; lint skipped during build (`ignoreDuringBuilds`). Exit 0. |

Not run (out of the test/lint/typecheck battery, or would rewrite files):

- `bun run build:webpack` — optional webpack comparison.
- `bun run api:spec` — regenerates `docs/api/openapi.json`.
- `node outils/audit.mjs` — needs `next start` + Playwright; not a package script.

Failing output for the only failed command:

```
$ bun run test
error: "/usr/bin/test" exited with code 1
note: a package.json script "test" was not found
```

No application code was changed for this briefing.
