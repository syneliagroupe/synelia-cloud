/**
 * Harnais des tests d'intégration (backend réel, `docs/PLAN-ARCHITECTURE-SUITE.md` §3.3).
 *
 * Ces tests créent de vraies ressources sur le laboratoire dev01 via l'API et
 * les détruisent dans `afterEach`/`globalTeardown`. Identifiants uniquement
 * depuis `SYNELIA_TEST_EMAIL`/`SYNELIA_TEST_MDP` — jamais en dur ici.
 */
import {
  test as base,
  expect,
  request as pwRequest,
  type APIRequestContext,
  type Locator,
  type Page,
} from 'playwright/test'

export { expect }

/**
 * `src/components/ui/field.tsx` — `Field({ label, children })` rend `<Label>`
 * (un `<label>` **sans** `htmlFor`) et `children` comme deux frères dans le
 * même conteneur, pas l'un dans l'autre : `page.getByLabel(...)` ne trouve
 * donc jamais un `Input`/`Select` générique (vérifié en direct : `0` sur le
 * champ e-mail de `/login`). Seuls `Slider` (`aria-label` posé à la main) et
 * `Checkbox`/`Radio` (leur propre `useId()` + `htmlFor`) sont de vrais champs
 * étiquetés. Pour tout le reste, ce repli : le premier `input`/`select`/
 * `textarea` dans le conteneur du `<label>` de ce texte.
 */
export function champParLabel(scope: Page | Locator, texteLabel: string): Locator {
  const label = scope.locator('label').filter({ hasText: texteLabel })
  return label.locator('xpath=..').locator('input, select, textarea').first()
}

export const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.synelia.dev01.ovh.smile.ci/v1'

interface SessionApi {
  accessToken: string
  refreshToken: string
  expiresIn: number
  utilisateur: { id: string; nom: string; email: string }
  organisations: Array<{ orgId: string; nom: string; role: string; defaut?: boolean }>
  organisationActive: string
  roleActif: string
}

/** Petit client API — sur le modèle de `src/lib/api/client.ts`, sans session localStorage. */
export class ClientApi {
  session: SessionApi | null = null

  constructor(private readonly req: APIRequestContext) {}

  async connecter(email: string, motDePasse: string): Promise<SessionApi> {
    const r = await this.req.post(`${API}/auth/connexion`, { data: { email, motDePasse } })
    if (!r.ok()) throw new Error(`Connexion échouée (${r.status()}) : ${await r.text()}`)
    this.session = (await r.json()) as SessionApi
    return this.session
  }

  private entetes(organisationId?: string): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.session?.accessToken) h.Authorization = `Bearer ${this.session.accessToken}`
    const org = organisationId ?? this.session?.organisationActive
    if (org) h['X-Organisation-Id'] = org
    return h
  }

  async get<T = unknown>(chemin: string, organisationId?: string): Promise<T> {
    const r = await this.req.get(`${API}${chemin}`, { headers: this.entetes(organisationId) })
    if (!r.ok()) throw new Error(`GET ${chemin} → ${r.status()} : ${await r.text()}`)
    return (await r.json()) as T
  }

  async post<T = unknown>(chemin: string, corps?: unknown, organisationId?: string): Promise<T> {
    const r = await this.req.post(`${API}${chemin}`, { headers: this.entetes(organisationId), data: corps })
    if (!r.ok()) throw new Error(`POST ${chemin} → ${r.status()} : ${await r.text()}`)
    return (await r.json().catch(() => undefined)) as T
  }

  async patch<T = unknown>(chemin: string, corps?: unknown, organisationId?: string): Promise<T> {
    const r = await this.req.patch(`${API}${chemin}`, { headers: this.entetes(organisationId), data: corps })
    if (!r.ok()) throw new Error(`PATCH ${chemin} → ${r.status()} : ${await r.text()}`)
    return (await r.json().catch(() => undefined)) as T
  }

  /**
   * `DELETE {chemin}?confirmation=` — jamais d'exception (un test du mauvais
   * nom veut lire le statut, pas intercepter un throw). Certaines routes
   * (`/espaces`, `/vms`…) rendent un `TravailProvisioning` (`202`) plutôt que
   * `204` : le corps est renvoyé, parsé, pour que l'appelant puisse l'attendre.
   */
  async del(chemin: string, confirmation?: string, organisationId?: string): Promise<{ status: number; corps?: unknown }> {
    const suffixe = confirmation ? `?confirmation=${encodeURIComponent(confirmation)}` : ''
    const r = await this.req.delete(`${API}${chemin}${suffixe}`, { headers: this.entetes(organisationId) })
    const corps = await r.json().catch(() => undefined)
    return { status: r.status(), corps }
  }
}

/** `GET /travaux/{id}` jusqu'à `done`/`failed`, avec échéance. */
export async function attendreTravail(
  api: ClientApi,
  travailId: string,
  { echeanceS = 120, organisationId }: { echeanceS?: number; organisationId?: string } = {},
): Promise<{ statut: string; erreur?: { message: string; correlationId: string } }> {
  const fin = Date.now() + echeanceS * 1000
  for (;;) {
    const t = await api.get<{ statut: string; erreur?: { message: string; correlationId: string } }>(
      `/travaux/${travailId}`,
      organisationId,
    )
    if (t.statut === 'done') return t
    if (t.statut === 'failed' || t.statut === 'rolled_back') {
      throw new Error(
        `Travail ${travailId} en échec : ${t.erreur?.message ?? 'sans message'} (correlationId ${
          t.erreur?.correlationId ?? '—'
        })`,
      )
    }
    if (Date.now() > fin) throw new Error(`Travail ${travailId} non terminé après ${echeanceS}s (statut ${t.statut})`)
    await new Promise((r) => setTimeout(r, 2000))
  }
}

interface EspaceMinimal {
  id: string
  code: string
}

/**
 * Espace Cloud dédié au test qui l'appelle : plusieurs specs (T3, T7, T9) ont
 * besoin d'un Espace mais ne doivent pas dépendre de l'ordre d'exécution des
 * autres — chacune crée le sien (Keystone + Neutron réels, ~30 s) et le
 * détruit dans son propre `afterAll`/`afterEach`. `POST /espaces` ne rend pas
 * l'identifiant créé (seulement un `TravailProvisioning` sans `cibleId`
 * exposé au contrat) : on le retrouve après coup par le `code`, unique et
 * préfixé.
 */
export async function creerEspaceDeTest(
  api: ClientApi,
  prefixe: string,
  options: {
    /** Distingue les Espaces de plusieurs specs qui partagent le même préfixe de run. */
    suffixe?: string
    cidr?: string
    quota?: { vcpu: number; ramGo: number; stockageTo: number }
  } = {},
): Promise<EspaceMinimal> {
  const offres = await api.get<{ donnees: Array<{ id: string; statut: string; categorie: string }> }>(
    '/admin/catalogue/offres?parPage=50',
  )
  const offre = offres.donnees.find((o) => o.statut === 'publiee' && o.categorie === 'espace_cloud')
  if (!offre) throw new Error('Aucune offre « espace_cloud » publiée au catalogue.')

  const code = `${prefixe}esp${options.suffixe ?? ''}`
  const travail = await api.post<{ id: string }>('/espaces', {
    code,
    offerId: offre.id,
    site: 'ABJ',
    cidr: options.cidr ?? '10.90.0.0/24',
    quota: options.quota ?? { vcpu: 2, ramGo: 4, stockageTo: 10 },
  })
  await attendreTravail(api, travail.id, { echeanceS: 180 })

  const liste = await api.get<{ donnees: Array<{ id: string; code: string }> }>('/espaces?parPage=200')
  const espace = liste.donnees.find((e) => e.code === code)
  if (!espace) throw new Error(`Espace ${code} introuvable après la fin du travail de création.`)
  return espace
}

/**
 * Détruit un espace créé par `creerEspaceDeTest` — idempotent, à appeler dans
 * un teardown. `DELETE /espaces/{id}` rend elle aussi un `TravailProvisioning`
 * (`202`) : on l'attend pour ne pas rendre la main avant la suppression
 * réelle côté Keystone/Neutron.
 */
export async function detruireEspaceDeTest(api: ClientApi, espace: EspaceMinimal): Promise<void> {
  const encore = await api.get<{ donnees: Array<{ id: string }> }>('/espaces?parPage=200')
  if (!encore.donnees.some((e) => e.id === espace.id)) return
  const r = await api.del(`/espaces/${espace.id}`, espace.code)
  if (r.status < 200 || r.status >= 300) {
    console.warn(`[creerEspaceDeTest] suppression de ${espace.code} → ${r.status}`)
    return
  }
  const travail = r.corps as { id?: string } | undefined
  if (travail?.id) {
    await attendreTravail(api, travail.id, { echeanceS: 180 }).catch((e) =>
      console.warn(`[creerEspaceDeTest] suppression de ${espace.code} en échec : ${(e as Error).message}`),
    )
  }
}

interface Fixtures {
  pageConnectee: import('playwright/test').Page
}

interface WorkerFixtures {
  preflight: void
  // `api` et `prefixe` sont partagés par tout le worker (une seule session,
  // un seul préfixe) plutôt que recréés par test : `workers: 1` de toute
  // façon, et ça les rend utilisables depuis `test.beforeAll`/`afterAll`
  // (T3, T7, T9 y créent un Espace Cloud partagé par les tests d'un même
  // fichier).
  api: ClientApi
  prefixe: string
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  // Une seule sonde par worker (`workers: 1` de toute façon) : si le labo est
  // éteint, tout le projet se déclare non exécuté plutôt que d'échouer.
  preflight: [
    async ({}, use) => {
      const req = await pwRequest.newContext()
      try {
        const statut = await req.get(`${API}/public/statut`).catch(() => undefined)
        const gabarits = await req.get(`${API}/catalogue/gabarits`).catch(() => undefined)
        const eteint = !statut || !statut.ok() || !gabarits || gabarits.status() === 424
        if (eteint) {
          test.skip(
            true,
            'laboratoire éteint (extinction nocturne ~21:01 UTC) : ' +
              'sudo virsh start openstack-lab_{ctrl1,comp1,stor1} sur dev01',
          )
        }
      } finally {
        await req.dispose()
      }
      await use()
    },
    { scope: 'worker', auto: true },
  ],

  // Posé une fois par run par `globalSetup.ts` (`SYNELIA_TEST_PREFIX`), pas
  // ici : plusieurs specs doivent partager le même préfixe pour que le
  // balayage de `globalTeardown` les retrouve tous.
  prefixe: [
    async ({}, use) => {
      const p = process.env.SYNELIA_TEST_PREFIX
      if (!p) throw new Error('SYNELIA_TEST_PREFIX non posé — globalSetup a-t-il tourné ?')
      await use(p)
    },
    { scope: 'worker' },
  ],

  api: [
    async ({ playwright }, use) => {
      const req = await playwright.request.newContext()
      const client = new ClientApi(req)
      const email = process.env.SYNELIA_TEST_EMAIL
      const motDePasse = process.env.SYNELIA_TEST_MDP
      if (!email || !motDePasse) {
        throw new Error('SYNELIA_TEST_EMAIL et SYNELIA_TEST_MDP sont requis pour les tests API.')
      }
      await client.connecter(email, motDePasse)
      await use(client)
      await req.dispose()
    },
    { scope: 'worker' },
  ],

  pageConnectee: async ({ page, api }, use) => {
    await page.addInitScript((session) => {
      window.localStorage.setItem('synelia.session', JSON.stringify(session))
    }, api.session)
    await use(page)
  },
})

/**
 * Balayage des restes portant le préfixe du run — un test qui a mal nettoyé.
 * Journalise ce qu'il a dû balayer plutôt que d'échouer silencieusement.
 */
export default async function globalTeardown(): Promise<void> {
  const email = process.env.SYNELIA_TEST_EMAIL
  const motDePasse = process.env.SYNELIA_TEST_MDP
  if (!email || !motDePasse) return

  const req = await pwRequest.newContext()
  const api = new ClientApi(req)
  try {
    await api.connecter(email, motDePasse)
  } catch {
    await req.dispose()
    return
  }

  const prefixe = process.env.SYNELIA_TEST_PREFIX
  if (!prefixe) {
    await req.dispose()
    return
  }

  // `/securite/cles-api` et `/ia/cles` : `DELETE` est une révocation logique
  // (`statut: revoquee`), la ressource reste listée — ce n'est pas un reste
  // à nettoyer une fois révoquée, seulement si elle est encore active.
  const cibles: Array<{ chemin: string; champNom: string; ignoreSiRevoquee?: boolean }> = [
    { chemin: '/vms', champNom: 'nom' },
    { chemin: '/espaces', champNom: 'code' },
    { chemin: '/groupes-securite', champNom: 'nom' },
    { chemin: '/web/dns', champNom: 'domaine' },
    { chemin: '/web/emails', champNom: 'domaine' },
    { chemin: '/securite/cles-api', champNom: 'nom', ignoreSiRevoquee: true },
    { chemin: '/ia/cles', champNom: 'nom', ignoreSiRevoquee: true },
    { chemin: '/ia/agents', champNom: 'nom' },
  ]

  for (const cible of cibles) {
    try {
      const page = await api.get<{ donnees: Array<Record<string, unknown>> }>(`${cible.chemin}?parPage=200`)
      const restes = page.donnees.filter(
        (r) =>
          String(r[cible.champNom] ?? '').startsWith(prefixe) &&
          !(cible.ignoreSiRevoquee && r.statut === 'revoquee'),
      )
      for (const r of restes) {
        console.warn(`[globalTeardown] reste balayé : ${cible.chemin}/${r.id} (${r[cible.champNom]})`)
        await api.del(`${cible.chemin}/${r.id}`, String(r[cible.champNom]))
      }
    } catch (e) {
      console.warn(`[globalTeardown] balayage ${cible.chemin} impossible : ${(e as Error).message}`)
    }
  }
  await req.dispose()
}
