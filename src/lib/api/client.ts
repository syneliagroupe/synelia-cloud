/**
 * Client HTTP de l’API Synelia Cloud (`GET /v1/…`).
 *
 * N’est utilisé que quand `NEXT_PUBLIC_API_URL` est renseigné — voir
 * `estActif()`. Sans elle, l’interface garde son comportement de maquette :
 * aucune requête ne part, et tout vient de `src/lib/mock/` via l’atelier.
 */

export interface OrganisationSession {
  orgId: string
  nom: string
  role: string
  defaut?: boolean
}

export interface SessionApi {
  accessToken: string
  refreshToken: string
  expiresIn: number
  utilisateur: { id: string; nom: string; email: string; mfaEnabled?: boolean }
  organisations: OrganisationSession[]
  organisationActive: string
  roleActif: string
  mfaRequis?: boolean
  defiMfa?: string
}

/** Forme d’un travail de provisioning renvoyé par l’API (`202` puis `GET /travaux/{id}`). */
export interface TravailDistant {
  id: string
  orgId?: string
  type: string
  label: string
  statut: 'queued' | 'running' | 'done' | 'failed' | 'rolled_back'
  taches: Array<{
    ordre: number
    nom: string
    statut: 'pending' | 'running' | 'ok' | 'failed'
    dureeS?: number
    message?: string
  }>
  erreur?: { message: string; correlationId: string; suggestion?: string }
  startedAt?: string
  dureeS?: number
}

export interface PageDistante<T> {
  donnees: T[]
  pagination: { page: number; parPage: number; total: number; totalPages: number }
}

/** Vrai quand l’interface doit parler au backend plutôt qu’à la maquette. */
export function estActif(): boolean {
  return !!process.env.NEXT_PUBLIC_API_URL
}

function base(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
}

// ─── Session (localStorage) ─────────────────────────────────────────

const CLE_SESSION = 'synelia.session'

export function lireSession(): SessionApi | null {
  if (typeof window === 'undefined') return null
  try {
    const brut = window.localStorage.getItem(CLE_SESSION)
    return brut ? (JSON.parse(brut) as SessionApi) : null
  } catch {
    return null
  }
}

export function ecrireSession(session: SessionApi): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CLE_SESSION, JSON.stringify(session))
}

export function effacerSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(CLE_SESSION)
}

// ─── Erreurs ────────────────────────────────────────────────────────

/** Erreur métier de l’API : `{ erreur: { code, message, correlationId } }`. */
export class ApiError extends Error {
  statut: number
  code: string
  correlationId?: string
  rolesRequis?: string[]
  champs?: Record<string, string>
  /** Intégration amont en cause sur `424` (avec `dateDonnees` éventuelle). */
  integration?: string
  dateDonnees?: string

  constructor(
    statut: number,
    corps: {
      erreur?: { code?: string; message?: string; correlationId?: string }
      rolesRequis?: string[]
      champs?: Record<string, string>
      integration?: string
      dateDonnees?: string
    },
  ) {
    super(corps.erreur?.message ?? `L’API a répondu ${statut}.`)
    this.name = 'ApiError'
    this.statut = statut
    this.code = corps.erreur?.code ?? 'inconnu'
    this.correlationId = corps.erreur?.correlationId
    this.rolesRequis = corps.rolesRequis
    this.champs = corps.champs
    this.integration = corps.integration
    this.dateDonnees = corps.dateDonnees
  }
}

// ─── Requête ────────────────────────────────────────────────────────

interface OptionsRequete {
  methode?: string
  corps?: unknown
  query?: Record<string, string | number | undefined>
}

async function requeteBrute<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  const session = lireSession()
  const params = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(options.query ?? {})) {
    if (valeur !== undefined) params.set(cle, String(valeur))
  }
  const suffixe = params.size > 0 ? `?${params.toString()}` : ''
  const reponse = await fetch(`${base()}${chemin}${suffixe}`, {
    method: options.methode ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session?.organisationActive ? { 'X-Organisation-Id': session.organisationActive } : {}),
    },
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
  })
  if (reponse.status === 204) return undefined as T
  const corps = (await reponse.json().catch(() => ({}))) as {
    erreur?: { code?: string; message?: string; correlationId?: string }
    rolesRequis?: string[]
    champs?: Record<string, string>
    integration?: string
    dateDonnees?: string
  } & T
  if (!reponse.ok) throw new ApiError(reponse.status, corps)
  return corps as T
}

/**
 * Requête avec un unique rafraîchissement du jeton : sur `401`, on rejoue
 * `POST /auth/rafraichir` une fois puis on réessaie. Si le rafraîchissement
 * échoue, la session est effacée et l’on renvoie vers `/login` — c’est ici,
 * pas au garde, que l’expiration se voit en premier (un sondage en fond
 * n’attend pas la prochaine navigation).
 */
export async function requete<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  try {
    return await requeteBrute<T>(chemin, options)
  } catch (e) {
    if (!(e instanceof ApiError) || e.statut !== 401 || chemin === '/auth/rafraichir') throw e
    const session = lireSession()
    if (!session?.refreshToken) {
      effacerSession()
      redirigerConnexion()
      throw e
    }
    try {
      const neuve = await requeteBrute<SessionApi>('/auth/rafraichir', {
        methode: 'POST',
        corps: { refreshToken: session.refreshToken },
      })
      ecrireSession({ ...neuve, refreshToken: neuve.refreshToken ?? session.refreshToken })
    } catch {
      effacerSession()
      redirigerConnexion()
      throw e
    }
    return requeteBrute<T>(chemin, options)
  }
}

/** Renvoie vers `/login` quand la session est morte — jamais depuis `/login`. */
function redirigerConnexion(): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname.startsWith('/login')) return
  window.location.href = '/login'
}

// ─── Collections ────────────────────────────────────────────────────

/** `GET {endpoint}?page=&parPage=` → `{ donnees, pagination }`. */
export function lister<T>(endpoint: string, parPage = 200): Promise<PageDistante<T>> {
  return requete<PageDistante<T>>(endpoint, { query: { page: 1, parPage } })
}

/** `POST {endpoint}` — renvoie la ressource créée ou un `TravailDistant` (`202`). */
export function creerRessource<T>(endpoint: string, corps: unknown): Promise<T | TravailDistant> {
  return requete<T | TravailDistant>(endpoint, { methode: 'POST', corps })
}

/** `PATCH {endpoint}/{id}`. */
export function modifierRessource<T>(endpoint: string, id: string, corps: unknown): Promise<T> {
  return requete<T>(`${endpoint}/${encodeURIComponent(id)}`, { methode: 'PATCH', corps })
}

/**
 * `DELETE {endpoint}/{id}?confirmation=<nom>` — le backend exige le nom exact
 * de la ressource, comme l’interface l’exige déjà dans ses dialogues.
 */
export function supprimerRessource(
  endpoint: string,
  id: string,
  confirmation?: string,
): Promise<unknown> {
  return requete<unknown>(`${endpoint}/${encodeURIComponent(id)}`, {
    methode: 'DELETE',
    query: confirmation ? { confirmation } : {},
  })
}

// ─── Travaux ────────────────────────────────────────────────────────

/** Vrai quand une réponse d’écriture est un travail à suivre, pas la ressource. */
export function estTravail(valeur: unknown): valeur is TravailDistant {
  if (typeof valeur !== 'object' || valeur === null) return false
  const t = valeur as { statut?: unknown; taches?: unknown }
  return (
    typeof t.statut === 'string' &&
    ['queued', 'running', 'done', 'failed', 'rolled_back'].includes(t.statut) &&
    Array.isArray(t.taches)
  )
}

export function lireTravail(id: string): Promise<TravailDistant> {
  return requete<TravailDistant>(`/travaux/${encodeURIComponent(id)}`)
}

/**
 * Interroge `GET /travaux/{id}` toutes les 1,5 s jusqu’à un statut final.
 * Renvoie une fonction d’annulation pour le démontage du composant.
 */
export function suivreTravail(id: string, aChaque: (t: TravailDistant) => void): () => void {
  let annule = false
  const interroger = async () => {
    if (annule) return
    try {
      const travail = await lireTravail(id)
      if (annule) return
      aChaque(travail)
      if (travail.statut === 'queued' || travail.statut === 'running') {
        setTimeout(interroger, 1500)
      }
    } catch {
      // Le travail a peut-être expiré côté backend : on cesse d’interroger
      // plutôt que de spammer une route en erreur.
    }
  }
  const minuteur = setTimeout(interroger, 1500)
  return () => {
    annule = true
    clearTimeout(minuteur)
  }
}
