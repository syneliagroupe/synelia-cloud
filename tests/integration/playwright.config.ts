/**
 * Tests d'intégration — backend réel (dev01), voir `docs/PLAN-ARCHITECTURE-SUITE.md` §3.3
 * et `docs/BRANCHEMENT-API.md`. Deux modes de build ne coexistent pas (même
 * `.next`), donc deux projets, lancés l'un après l'autre :
 *
 *     pkill -f next-server
 *     NEXT_PUBLIC_API_URL= bun run build && bun run start -p 3111 &   # maquette
 *     bun run test:integration --project maquette
 *     BASE=http://127.0.0.1:3111 node outils/audit.mjs                # ne doit pas régresser
 *     pkill -f next-server
 *     NEXT_PUBLIC_API_URL=https://api.synelia.dev01.ovh.smile.ci/v1 bun run build && bun run start -p 3113 &
 *     SYNELIA_TEST_EMAIL=admin@synelia.cloud SYNELIA_TEST_MDP=… bun run test:integration --project api
 *
 * Le projet `api` crée de vraies ressources sur le laboratoire OpenStack de
 * dev01 (Nova, Neutron, Designate, Zimbra…) et les détruit lui-même. Il ne
 * tourne pas en CI (laboratoire privé, extinction nocturne, organisation
 * partagée) — lancement à la main, avant une fusion qui touche une mutation.
 */
import { defineConfig } from 'playwright/test'

const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  outputDir: 'resultats',
  globalSetup: require.resolve('./globalSetup.ts'),
  globalTeardown: require.resolve('./fixtures.ts'),
  use: {
    launchOptions: { executablePath: CHROMIUM },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'maquette',
      use: { baseURL: process.env.BASE_MAQUETTE ?? 'http://127.0.0.1:3111' },
      testMatch: ['maquette-isolee.spec.ts'],
    },
    {
      // Timeout par défaut 120 s (ci-dessus) ; espace.spec.ts et vm.spec.ts
      // portent leur propre `test.setTimeout(12 * 60_000)` (Nova/Neutron réels).
      name: 'api',
      use: { baseURL: process.env.BASE_API ?? 'http://127.0.0.1:3113' },
      testMatch: ['*.spec.ts'],
      testIgnore: ['maquette-isolee.spec.ts'],
    },
  ],
})
