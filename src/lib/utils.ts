/**
 * Utilitaires transverses — Synelia Cloud
 */

type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, unknown>

/** Concaténation conditionnelle de classes utilitaires. */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  const walk = (value: ClassValue) => {
    if (!value) return
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value))
      return
    }
    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }
    if (typeof value === 'object') {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) out.push(key)
      }
    }
  }
  inputs.forEach(walk)
  return out.join(' ')
}

/** Génère un identifiant de corrélation lisible pour les états d'erreur (§1.5.3). */
export function correlationId(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)
  return `syn-${hex}-${seed.length.toString(16).padStart(2, '0')}`
}

/** Découpe un tableau en pages de taille fixe. */
export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage
  return items.slice(start, start + perPage)
}

/** Somme d'un champ numérique. */
export function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0)
}

/** Regroupe une collection par clé. */
export function groupBy<T, K extends string>(
  items: T[],
  pick: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = pick(item)
      ;(acc[key] ||= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

const SERIES_FICTIVES = new WeakSet<number[]>()

/** Vrai pour une série fabriquée par `seededSeries`/`trendSeries`, jamais mesurée. */
export function estSerieFictive(serie: number[]): boolean {
  return SERIES_FICTIVES.has(serie)
}

/** Vrai quand l’API réelle est branchée : les données fictives ne doivent alors pas s’afficher. */
export function modeApiActif(): boolean {
  return !!process.env.NEXT_PUBLIC_API_URL
}

/** Générateur pseudo-aléatoire déterministe — évite toute divergence SSR/client. */
export function seededSeries(seed: string, count: number, min = 20, max = 90): number[] {
  let state = 0
  for (let i = 0; i < seed.length; i += 1) {
    state = (state * 31 + seed.charCodeAt(i)) % 2147483647
  }
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    state = (state * 1103515245 + 12345) % 2147483647
    const ratio = (state % 10000) / 10000
    out.push(Math.round((min + ratio * (max - min)) * 10) / 10)
  }
  SERIES_FICTIVES.add(out)
  return out
}

/** Série avec tendance — utile pour les micro-courbes de consommation. */
export function trendSeries(
  seed: string,
  count: number,
  from: number,
  to: number,
  jitter = 6,
): number[] {
  const noise = seededSeries(seed, count, -jitter, jitter)
  const serie = noise.map((n, i) => {
    const base = from + ((to - from) * i) / Math.max(1, count - 1)
    return Math.max(0, Math.round((base + n) * 10) / 10)
  })
  SERIES_FICTIVES.add(serie)
  return serie
}

/** Retourne la valeur bornée entre min et max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Transforme un libellé en slug d'URL. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Initiales d'un nom, pour les avatars. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

// ─── Lisibilité des teintes de marque ─────────────────────────────────

/** Luminance relative d'une couleur `#rrggbb`, au sens WCAG. */
function luminance(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2)
}

/** Assombrit une couleur dans l'espace linéaire jusqu'à la luminance visée. */
function assombrir(hex: string, luminanceVisee: number): string {
  const depart = luminance(hex)
  if (depart <= luminanceVisee) return hex
  const facteur = luminanceVisee / depart
  const canal = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    const lin = (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)) * facteur
    const srgb = lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${canal(0)}${canal(1)}${canal(2)}`
}

/**
 * Rend lisible une vignette portant les initiales d'une marque amont.
 *
 * Les teintes des solutions tierces sont imposées par leur charte :
 * un bleu clair ou un jaune ne tiennent pas 4,5:1 face au blanc. Plutôt que
 * de renoncer à la couleur — elle sert à reconnaître la solution d'un coup
 * d'œil — on choisit le texte qui passe : encre sombre sur une teinte claire,
 * blanc sur une teinte assombrie juste assez. Fonction pure : même entrée,
 * même sortie côté serveur et côté client.
 */
export function surfaceMarque(teinte: string): { fond: string; texte: string } {
  const ENCRE = '#12081f'
  const l = luminance(teinte)
  // (l + 0,05) / (0,0039 + 0,05) ≥ 4,5 → l ≥ 0,193 : l'encre sombre suffit.
  if (l >= 0.193) return { fond: teinte, texte: ENCRE }
  // Sinon, blanc sur teinte ramenée à 1,05 / 4,6 − 0,05 ≈ 0,178.
  return { fond: assombrir(teinte, 0.178), texte: '#ffffff' }
}
