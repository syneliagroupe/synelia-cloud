import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

/**
 * `client.ts` lit `typeof window` pour distinguer serveur/navigateur et
 * `window.localStorage` pour la session : on pose un faux navigateur minimal
 * avant chaque test plutôt que d'ajouter `@testing-library`/jsdom pour ça
 * seul (§ plan, pas de test unitaire des hooks React ici).
 */
function fauxLocalStorage() {
  const magasin = new Map<string, string>()
  return {
    getItem: (cle: string) => magasin.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void magasin.set(cle, valeur),
    removeItem: (cle: string) => void magasin.delete(cle),
  }
}

let hrefDefini = ''

beforeEach(() => {
  hrefDefini = ''
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: fauxLocalStorage(),
    location: {
      pathname: '/app/vms',
      get href() {
        return hrefDefini
      },
      set href(v: string) {
        hrefDefini = v
      },
    },
  }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
  delete process.env.NEXT_PUBLIC_API_URL
  mock.restore()
})

// Import après le stub de `window` : les fonctions lisent `window` à l'appel
// (pas au chargement du module), donc l'ordre importe peu ici, mais on reste
// cohérent avec le reste du fichier.
const {
  ApiError,
  estActif,
  estTravail,
  lireSession,
  ecrireSession,
  lister,
  requete,
  suivreTravail,
  supprimerRessource,
} = await import('./client')

describe('estActif', () => {
  test('faux sans NEXT_PUBLIC_API_URL', () => {
    delete process.env.NEXT_PUBLIC_API_URL
    expect(estActif()).toBe(false)
  })

  test('vrai avec NEXT_PUBLIC_API_URL', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/v1'
    expect(estActif()).toBe(true)
  })
})

describe('estTravail', () => {
  test('vrai sur un travail', () => {
    expect(estTravail({ statut: 'queued', taches: [] })).toBe(true)
  })

  test('faux sur une ressource ordinaire', () => {
    expect(estTravail({ id: 'vm-1', statut: 'running' })).toBe(false)
  })

  test('faux sur null', () => {
    expect(estTravail(null)).toBe(false)
  })
})

describe('ApiError', () => {
  test('construite depuis { erreur, champs, rolesRequis } — frères, pas imbriqués', () => {
    const err = new ApiError(422, {
      erreur: { code: 'validation', message: 'Champs invalides', correlationId: 'cor-1' },
      champs: { nom: 'requis' },
      rolesRequis: ['org_admin'],
      integration: 'nova',
      dateDonnees: '2026-09-08T00:00:00Z',
    })
    expect(err.statut).toBe(422)
    expect(err.code).toBe('validation')
    expect(err.message).toBe('Champs invalides')
    expect(err.correlationId).toBe('cor-1')
    expect(err.champs).toEqual({ nom: 'requis' })
    expect(err.rolesRequis).toEqual(['org_admin'])
    expect(err.integration).toBe('nova')
    expect(err.dateDonnees).toBe('2026-09-08T00:00:00Z')
  })

  test('message de repli quand le corps ne porte pas erreur.message', () => {
    const err = new ApiError(500, {})
    expect(err.message).toBe('L’API a répondu 500.')
    expect(err.code).toBe('inconnu')
  })
})

describe('requete', () => {
  test('204 → undefined', async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 204 })) as unknown as typeof fetch
    const r = await requete('/vms/a')
    expect(r).toBeUndefined()
  })

  test('corps JSON invalide sur 2xx → {}', async () => {
    globalThis.fetch = mock(
      async () => new Response('pas-du-json', { status: 200 }),
    ) as unknown as typeof fetch
    const r = await requete('/vms')
    expect(r).toEqual({})
  })

  test('4xx → ApiError avec le bon statut', async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ erreur: { code: 'introuvable', message: 'VM introuvable' } }), {
          status: 404,
        }),
    ) as unknown as typeof fetch
    await expect(requete('/vms/x')).rejects.toMatchObject({ statut: 404, code: 'introuvable' })
  })

  test('en-têtes Authorization et X-Organisation-Id depuis la session', async () => {
    ecrireSession({
      accessToken: 'tok-abc',
      refreshToken: 'ref-abc',
      expiresIn: 3600,
      utilisateur: { id: 'u1', nom: 'Test', email: 't@x.ci' },
      organisations: [],
      organisationActive: 'org-1',
      roleActif: 'org_admin',
    })
    let entetes: Headers | undefined
    globalThis.fetch = mock(async (_url: unknown, options: RequestInit) => {
      entetes = new Headers(options.headers)
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    await requete('/vms')
    expect(entetes?.get('Authorization')).toBe('Bearer tok-abc')
    expect(entetes?.get('X-Organisation-Id')).toBe('org-1')
  })

  test('query : les valeurs undefined sont omises', async () => {
    let urlAppelee = ''
    globalThis.fetch = mock(async (url: unknown) => {
      urlAppelee = String(url)
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    await requete('/vms', { query: { page: 1, q: undefined } })
    expect(urlAppelee).toBe('/vms?page=1')
  })

  test('401 : rafraîchit une fois, réécrit la session, rejoue la requête', async () => {
    ecrireSession({
      accessToken: 'expire',
      refreshToken: 'ref-1',
      expiresIn: 3600,
      utilisateur: { id: 'u1', nom: 'Test', email: 't@x.ci' },
      organisations: [],
      organisationActive: 'org-1',
      roleActif: 'org_admin',
    })
    let appels = 0
    globalThis.fetch = mock(async (url: unknown) => {
      appels += 1
      const chemin = String(url)
      if (chemin === '/auth/rafraichir') {
        return new Response(
          JSON.stringify({
            accessToken: 'neuf',
            refreshToken: 'ref-2',
            expiresIn: 3600,
            utilisateur: { id: 'u1', nom: 'Test', email: 't@x.ci' },
            organisations: [],
            organisationActive: 'org-1',
            roleActif: 'org_admin',
          }),
          { status: 200 },
        )
      }
      if (chemin === '/vms' && appels === 1) {
        return new Response(JSON.stringify({ erreur: { code: 'expire' } }), { status: 401 })
      }
      return new Response('{"donnees":[]}', { status: 200 })
    }) as unknown as typeof fetch

    const r = await requete('/vms')
    expect(r).toEqual({ donnees: [] })
    expect(appels).toBe(3) // /vms (401), /auth/rafraichir, /vms (rejoué)
    expect(lireSession()?.accessToken).toBe('neuf')
  })

  test('401 sur le rafraîchissement lui-même : session effacée, redirection, pas de boucle', async () => {
    ecrireSession({
      accessToken: 'expire',
      refreshToken: 'mauvais',
      expiresIn: 3600,
      utilisateur: { id: 'u1', nom: 'Test', email: 't@x.ci' },
      organisations: [],
      organisationActive: 'org-1',
      roleActif: 'org_admin',
    })
    let appelsRafraichir = 0
    globalThis.fetch = mock(async (url: unknown) => {
      const chemin = String(url)
      if (chemin === '/auth/rafraichir') {
        appelsRafraichir += 1
        return new Response(JSON.stringify({ erreur: { code: 'invalide' } }), { status: 401 })
      }
      return new Response(JSON.stringify({ erreur: { code: 'expire' } }), { status: 401 })
    }) as unknown as typeof fetch

    await expect(requete('/vms')).rejects.toMatchObject({ statut: 401 })
    expect(appelsRafraichir).toBe(1)
    expect(lireSession()).toBeNull()
    expect(hrefDefini).toBe('/login')
  })
})

describe('supprimerRessource', () => {
  test('avec confirmation : DELETE ?confirmation=<valeur>, encodée', async () => {
    let urlAppelee = ''
    let methode = ''
    globalThis.fetch = mock(async (url: unknown, options: RequestInit) => {
      urlAppelee = String(url)
      methode = String(options.method)
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    await supprimerRessource('/vms', 'a b', 'web-01')
    expect(methode).toBe('DELETE')
    expect(urlAppelee).toBe('/vms/a%20b?confirmation=web-01')
  })

  test('sans confirmation : pas de paramètre', async () => {
    let urlAppelee = ''
    globalThis.fetch = mock(async (url: unknown) => {
      urlAppelee = String(url)
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    await supprimerRessource('/vms', 'a')
    expect(urlAppelee).toBe('/vms/a')
  })
})

describe('lister', () => {
  test('page=1&parPage=200 par défaut', async () => {
    let urlAppelee = ''
    globalThis.fetch = mock(async (url: unknown) => {
      urlAppelee = String(url)
      return new Response('{"donnees":[],"pagination":{"page":1,"parPage":200,"total":0,"totalPages":0}}', {
        status: 200,
      })
    }) as unknown as typeof fetch
    await lister('/vms')
    expect(urlAppelee).toBe('/vms?page=1&parPage=200')
  })
})

describe('suivreTravail (minuteries réelles, ~3 s)', () => {
  test('sonde jusqu’au statut final, deux rappels — slow', async () => {
    let appel = 0
    globalThis.fetch = mock(async () => {
      appel += 1
      const statut = appel === 1 ? 'running' : 'done'
      return new Response(JSON.stringify({ id: 't1', type: 'vm.create', label: 'x', statut, taches: [] }), {
        status: 200,
      })
    }) as unknown as typeof fetch

    const vus: string[] = []
    await new Promise<void>((resolve) => {
      suivreTravail('t1', (t) => {
        vus.push(t.statut)
        if (t.statut === 'done') resolve()
      })
    })
    expect(vus).toEqual(['running', 'done'])
  }, 10_000)
})
