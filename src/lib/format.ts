/**
 * Formatage — Synelia Cloud
 * Montants en FCFA par défaut, format « 172 000 FCFA » (§1.6).
 * TVA 18 % (§2.4).
 */

export const TVA_PCT = 18

export type Devise = 'XOF' | 'EUR' | 'USD'

/** Taux indicatifs de démonstration, base XOF. */
const TAUX: Record<Devise, number> = {
  XOF: 1,
  EUR: 1 / 655.957,
  USD: 1 / 605,
}

const SYMBOLE: Record<Devise, string> = {
  XOF: 'FCFA',
  EUR: '€',
  USD: '$',
}

/** Espace insécable fine utilisée comme séparateur de milliers. */
const NBSP = ' '

function groupe(n: number, decimales = 0): string {
  const fixed = Math.abs(n).toFixed(decimales)
  const [entier, frac] = fixed.split('.')
  const espaced = entier.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  const signe = n < 0 ? '-' : ''
  return frac ? `${signe}${espaced},${frac}` : `${signe}${espaced}`
}

/** « 172 000 FCFA » · « 262 € » · « 284 $ » */
export function money(montantXof: number, devise: Devise = 'XOF'): string {
  const converti = montantXof * TAUX[devise]
  const decimales = devise === 'XOF' ? 0 : converti < 100 ? 2 : 0
  return `${groupe(converti, decimales)}${NBSP}${SYMBOLE[devise]}`
}

/** Code ISO d'un pays (« CI ») → nom affiché ; un code inconnu reste tel quel. */
const NOMS_PAYS: Record<string, string> = {
  CI: 'Côte d’Ivoire',
  SN: 'Sénégal',
  BJ: 'Bénin',
  TG: 'Togo',
  BF: 'Burkina Faso',
  ML: 'Mali',
  FR: 'France',
}
export const nomPays = (code: string) => NOMS_PAYS[code] ?? code

/** « 85 000 FCFA/mois » */
export function moneyPerMonth(montantXof: number, devise: Devise = 'XOF'): string {
  return `${money(montantXof, devise)}/mois`
}

/** Nombre simple avec séparateurs : « 12 480 » */
export function num(value: number, decimales = 0): string {
  return groupe(value, decimales)
}

/** « 34 % » · « 34,5 % » */
export function pct(value: number, decimales = 0): string {
  return `${groupe(value, decimales)}${NBSP}%`
}

/** Variation signée : « ▲ 6 pts » / « ▼ 2 pts » */
export function delta(value: number, unite = 'pts'): string {
  if (value === 0) return `– 0${NBSP}${unite}`
  const fleche = value > 0 ? '▲' : '▼'
  return `${fleche}${NBSP}${groupe(Math.abs(value), Number.isInteger(value) ? 0 : 1)}${NBSP}${unite}`
}

/** Octets lisibles à partir d'un nombre de Go. */
export function goHumain(go: number): string {
  if (go >= 1024) return `${groupe(go / 1024, 1)}${NBSP}To`
  if (go < 1) return `${groupe(go * 1024, 0)}${NBSP}Mo`
  return `${groupe(go, go < 10 ? 1 : 0)}${NBSP}Go`
}

/**
 * Compteur de jetons : « 612,4 M », « 4,18 Md ». Les volumes d'inférence se
 * comptent en centaines de millions — les afficher au chiffre près donnerait
 * une précision que la mesure n'a pas.
 */
export function jetons(valeur: number): string {
  if (valeur >= 1_000_000_000) return `${groupe(valeur / 1_000_000_000, 2)}${NBSP}Md`
  if (valeur >= 1_000_000) return `${groupe(valeur / 1_000_000, 1)}${NBSP}M`
  if (valeur >= 1_000) return `${groupe(valeur / 1_000, 0)}${NBSP}k`
  return groupe(valeur, 0)
}

/** « 7,1 To » */
export function toHumain(to: number): string {
  if (to < 1) return goHumain(to * 1024)
  return `${groupe(to, 1)}${NBSP}To`
}

const MOIS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

function parse(iso: string): Date {
  return new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso)
}

/** « 12 juil. 2026 » */
export function dateCourte(iso: string): string {
  const d = parse(iso)
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** « 12 juil. 2026 · 14:38 » */
export function dateHeure(iso: string): string {
  const d = parse(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dateCourte(iso)} · ${hh}:${mm}`
}

/** « 14:38:02 » — pour les journaux. */
export function heure(iso: string): string {
  const d = parse(iso)
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    .map((v) => String(v).padStart(2, '0'))
    .join(':')
}

/**
 * « il y a 12 min ». Référence figée au 19 août 2026 pour garantir un
 * rendu identique côté serveur et côté client (données de démonstration).
 */
export const MAINTENANT = '2026-08-19T15:20:00Z'

export function relatif(iso: string, reference: string = MAINTENANT): string {
  const diff = parse(reference).getTime() - parse(iso).getTime()
  // Le futur est traité symétriquement : une prochaine exécution planifiée ou
  // une échéance ne doivent pas s'afficher « à l'instant ».
  const futur = diff < 0
  const min = Math.round(Math.abs(diff) / 60000)
  const tourne = (texte: string) => (futur ? `dans ${texte}` : `il y a ${texte}`)

  if (min < 1) return "à l'instant"
  if (min < 60) return tourne(`${min} min`)
  const h = Math.round(min / 60)
  if (h < 24) return tourne(`${h} h`)
  const j = Math.round(h / 24)
  if (j === 1) return futur ? 'demain' : 'hier'
  if (j < 31) return tourne(`${j} j`)
  const m = Math.round(j / 30)
  return tourne(`${m} mois`)
}

/** Durée en secondes → « 1 min 42 s » · « 3 h 12 » */
export function duree(secondes: number): string {
  if (secondes < 60) return `${groupe(secondes)}${NBSP}s`
  if (secondes < 3600) {
    const m = Math.floor(secondes / 60)
    const s = secondes % 60
    return s ? `${m} min ${s} s` : `${m} min`
  }
  const h = Math.floor(secondes / 3600)
  const m = Math.floor((secondes % 3600) / 60)
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** Engagement de disponibilité : le backend stocke « 99.9 », le jeu local « 99,9 % » → « 99,9 % ». */
export function slaLibelle(sla: string): string {
  return sla.includes('%') ? sla : `${sla.replace('.', ',')} %`
}

/** Durée en minutes → « 4 h » · « 3 h 12 » · « 15 min » */
export function dureeMin(minutes: number): string {
  return duree(minutes * 60)
}

/** Ventilation TVA d'un montant hors taxes. */
export function ventilationTva(hors: number, tvaPct = TVA_PCT) {
  const tva = Math.round((hors * tvaPct) / 100)
  return { hors, tva, tvaPct, total: hors + tva }
}

/** Prorata du mois en cours pour un `CostPreview` (§1.6). */
export function prorata(mensuel: number, jourDuMois = 19, joursDuMois = 31): number {
  const restants = Math.max(0, joursDuMois - jourDuMois + 1)
  return Math.round((mensuel * restants) / joursDuMois)
}
