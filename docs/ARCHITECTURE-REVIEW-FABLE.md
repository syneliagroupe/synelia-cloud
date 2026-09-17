# Architecture review — synelia-cloud (web frontend)

Date: 2026-09-08. Consultant-level review, based on `CLAUDE.md`, `docs/BRANCHEMENT-API.md`, the `outils/openapi/` generator, `src/components/app/atelier.tsx`, `src/lib/api/*` — targeted reads, not an exhaustive audit.
Reviewer: Fable 5.1 (design/architecture consultant pass).

Context: a Next.js console with ~130 page routes and a 12k-line fictional dataset (`src/lib/mock/`), originally a pure demo, now wired to the real FastAPI backend by an env var. Zero test files.

## Decisions

1. **The frontend owns the API contract: `docs/api/openapi.json` is generated from hand-written `.mjs` files that mirror `src/lib/types.ts`, and the backend consumes it.**
   Unusual direction (UI dictates the API), and for this project it was correct — the UI existed first, and a contract with a validating generator beat a hand-edited 500-operation JSON. The cost is that nothing on the frontend checks itself against the contract: no `openapi-typescript`, no runtime validation, so `types.ts` and the generator can drift and only the backend's `contrat_diff` would notice. Cheap fix: generate types from the JSON and diff them against `types.ts` in CI.

2. **Mock-first with a deliberate runtime seam: `estActif()` (`NEXT_PUBLIC_API_URL` set) flips `useCollection` from the local seed to `GET {endpoint}`, per collection, via a 67-entry name→endpoint registry.**
   This is the frontend's central architectural bet and it worked — the same 130 screens run in both modes, and the seed is displayed until the first remote response so SSR/hydration stay identical. Two costs. First, the seed is *shown* while loading, so a user briefly sees fictional VMs before real ones; that is acceptable for a preview, not for production. Second, the mode is decided at build time from an env var, so a single deployment is either all-mock or all-real; there's no per-collection fallback if one endpoint is missing (the seed silently stays, which is the same "fake success" class the backend fought). I'd want `chargement`/`erreur` rendered as skeleton/error rather than seed in API mode.

3. **`useOperation` runs a different path per mode: `appel` (real call + `suivreTravail` polling) in API mode; `effet` + simulated `job` in mock mode; `effetFinal` shared.**
   Good separation, and the doc is explicit that `effet` must not replay in API mode or mutations double. But the branching lives at every call site (`if (estActif()) … else …`), and BRANCHEMENT-API's "vague 3" list shows many creations still go through the generic POST with no job tracking. The mock path is now the thing that makes each screen twice as expensive to wire. Question for the team: is the mock mode still a product requirement (demo without backend), or can it be retired screen by screen?

4. **Atelier = session-only mutable overlay on a frozen seed; deterministic IDs and a frozen clock (`MAINTENANT`), never `Date.now()`/`Math.random()` in render.**
   Well-reasoned for a demo (hydration safety, reproducible audits). In API mode it's mostly dead weight except for the shared remote cache it now also hosts (`CACHE_DISTANT`, one in-flight promise per key, 10 s polling for jobs). That cache is effectively a hand-rolled TanStack Query; fine at this size, but it's the piece that will grow.

5. **Workflow catalogue (`mock/workflows.ts`, 41 ids with announced step durations and two deliberate first-try failures) shared by name with the backend.**
   The idea that "two screens launching the same operation tell the same story" is right and it became the backend's job vocabulary. The simulated failures are a smart way to make `failed`/`rolled_back` UI reachable in a demo.

6. **Deployment via GitHub Actions calling `vercel deploy`, Vercel's own Git integration disabled; exact-pinned dependencies because Vercel's bun can't read `bun.lock` v2.**
   Sound reasoning (one deployer, not two), but the pinning workaround is a toolchain fragility that will bite whoever inherits this. Consider whether the Vercel bun version constraint still holds.

7. **No automated tests; quality gate is `typecheck && lint && build` plus a Playwright render audit (console errors, overflow, contrast, a11y names) over all routes.**
   For a demo this audit is genuinely more useful than unit tests. For a console doing real `DELETE ?confirmation=` against real infra, the absence of even one integration test per wired mutation is the biggest risk in this repo. The BRANCHEMENT-API "23/23 verts" scenarios were run by hand from `/tmp` — they should be checked in.

8. **Product rule enforced in architecture: never rebuild an upstream product's main screen; observability bounded to four widget types; "an action is disabled, never hidden" (`GatedAction`).**
   These are decisions, not style, and they keep 130 routes coherent. One known inconsistency the doc itself flags: `GatedAction` blocks pointer events, so RBAC refusals can never be journaled from the UI, contradicting the "journal records refusals" promise. Worth resolving one way or the other.

## Overall

The web repo made the right early bet (mock-first, contract exported) and then paid the natural price when it became real: every screen now carries two code paths and the documentation header still says "no network calls, no database". The immediate follow-ups are documentation truth (`CLAUDE.md` line 4), type-level coupling to the contract, and checked-in tests for the mutations that now touch real OpenStack.
