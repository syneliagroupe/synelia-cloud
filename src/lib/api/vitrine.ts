import type { CatalogService, Offer } from '@/lib/types'
import type { FamilleTarif, FicheProduit } from '@/lib/mock/vitrine'
import type { DATACENTERS } from '@/lib/mock/vitrine'

/**
 * Fusion des lectures publiques (`GET /v1/public/…`) avec la maquette.
 *
 * Le backend publie des fiches plus sobres que la vitrine (pas de
 * pictogramme, pas de schéma d’architecture, pas de puces rédigées) : on ne
 * remplace que ce qu’il renvoie réellement et l’on garde le reste du jeu
 * local, fiche par fiche, pour ne jamais afficher une page à moitié vide.
 * Pures et sans `use client` : utilisables des deux côtés.
 */

// ─── Tarifs ─────────────────────────────────────────────────────────

export interface TarifsPublics {
  familles: Array<{ code: string; nom: string; description?: string; offres: Offer[] }>
  hypotheses?: string[]
}

const NOM_FAMILLE: Record<string, string> = {
  espace_cloud: 'Espaces Cloud',
  image_vm: 'Machines virtuelles',
  k8s: 'Kubernetes',
  stack: 'Piles applicatives',
  web: 'Web',
  economique: 'Économique',
  generique: 'Usage général',
  calcul: 'Calcul intensif',
  memoire: 'Mémoire étendue',
}

function libelleFamille(code: string, nom: string): string {
  if (nom && nom !== code) return nom
  return NOM_FAMILLE[code] ?? code.charAt(0).toUpperCase() + code.slice(1)
}

/**
 * `GET /public/tarifs` → familles de la grille. Chaque offre devient une
 * colonne ; les lignes sont la configuration, le SLA, puis chaque
 * caractéristique rencontrée (cochée quand l’offre la porte).
 */
export function famillesDepuisTarifs(distant: TarifsPublics | undefined): FamilleTarif[] | undefined {
  if (!distant || !Array.isArray(distant.familles) || distant.familles.length === 0) return undefined
  const familles = distant.familles
    .filter((f) => Array.isArray(f.offres) && f.offres.length > 0)
    .map((f) => {
      const offres = f.offres.filter((o) => o.statut !== 'brouillon')
      const caracteristiques = [...new Set(offres.flatMap((o) => o.caracteristiques ?? []))]
      // Une caractéristique portée par toutes les offres n’aide pas à choisir ;
      // elle reste utile quand la famille n’en a qu’une, sinon elle sort.
      const discriminantes =
        offres.length > 1
          ? caracteristiques.filter((c) => !offres.every((o) => o.caracteristiques?.includes(c)))
          : caracteristiques
      const communes = caracteristiques.filter((c) => !discriminantes.includes(c))
      return {
        id: f.code,
        nom: libelleFamille(f.code, f.nom),
        note:
          f.description ??
          (communes.length > 0 ? `Toutes les offres incluent : ${communes.join(', ')}.` : undefined),
        colonnes: offres.map((o) => ({
          nom: o.nom,
          prix: o.surDevis ? null : o.prix,
          surDevis: o.surDevis,
          recommande: o.populaire,
          unite: '/mois',
        })),
        lignes: [
          { caracteristique: 'Configuration', valeurs: offres.map((o) => o.specs) },
          ...(offres.some((o) => o.sla)
            ? [
                {
                  caracteristique: 'Disponibilité contractuelle',
                  valeurs: offres.map((o) => (o.sla ? `${o.sla} %` : '—')),
                },
              ]
            : []),
          ...discriminantes.map((c) => ({
            caracteristique: c,
            valeurs: offres.map((o) => Boolean(o.caracteristiques?.includes(c))),
          })),
        ],
      } satisfies FamilleTarif
    })
  return familles.length > 0 ? familles : undefined
}

// ─── Catalogue marketplace ──────────────────────────────────────────

/** Forme publiée par le backend : la fiche locale, moins l’habillage. */
export type FicheCataloguePublique = Partial<CatalogService> & {
  slug: string
  nom: string
  solutionOSS: string
  categorie: CatalogService['categorie']
}

function initiales(nom: string): string {
  return nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? '')
    .join('')
}

/** Une fiche distante complétée par la locale de même `slug` (ou des défauts). */
export function fusionnerFicheCatalogue(
  distante: FicheCataloguePublique,
  locale: CatalogService | undefined,
): CatalogService {
  return {
    // Défauts d’habillage pour une solution inconnue du jeu local.
    icone: 'forge',
    logoTeinte: '#5B4B8A',
    logoInitiales: initiales(distante.nom),
    backupPolicyDefault: 'Sauvegarde quotidienne, rétention 30 jours, copie immuable hors site',
    migrationEntrante: [],
    urlDemo: '#',
    captures: [],
    parametresSpecifiques: [],
    granulariteRestauration: ['complete'],
    modes: ['dedie'],
    paliers: [],
    versionsSupportees: [],
    certifie: false,
    sla: '99,9 % mensuel',
    description: '',
    pitch: '',
    reversibilite: { formats: [], delaiJours: 30, docUrl: '#' },
    ...locale,
    // Les champs réellement publiés priment ; les absents ne vident pas la fiche.
    ...Object.fromEntries(Object.entries(distante).filter(([, v]) => v !== undefined && v !== null)),
  } as CatalogService
}

/** Le catalogue publié, chaque fiche complétée par son équivalent local. */
export function fusionnerCatalogue(
  distantes: FicheCataloguePublique[] | undefined,
  locales: readonly CatalogService[],
): CatalogService[] | undefined {
  if (!distantes || distantes.length === 0) return undefined
  return distantes.map((d) => fusionnerFicheCatalogue(d, locales.find((l) => l.slug === d.slug)))
}

// ─── Fiches produit ─────────────────────────────────────────────────

export interface FicheProduitPublique {
  slug: string
  nom: string
  accroche: string
  description: string
  categorie: string
  aPartirDe?: number
  caracteristiques?: string[]
  cequeCeNestPas?: string[]
  paliers?: Array<{ nom: string; specs: string; prix: number }>
  sla?: string
  faq?: Array<{ question: string; reponse: string }>
}

/**
 * `GET /public/offres/{slug}` fusionné à la fiche locale : nom, accroche,
 * résumé, paliers et FAQ viennent du backend quand il les publie ; le
 * schéma d’architecture, les puces et le SLA détaillé restent locaux (le
 * backend ne publie qu’une phrase de SLA, la vitrine en montre quatre).
 */
export function fusionnerFicheProduit(
  distante: FicheProduitPublique | undefined,
  locale: FicheProduit,
): FicheProduit {
  if (!distante) return locale
  return {
    ...locale,
    nom: distante.nom || locale.nom,
    accroche: distante.accroche || locale.accroche,
    resume: distante.description || locale.resume,
    puces:
      distante.caracteristiques && distante.caracteristiques.length >= 3
        ? distante.caracteristiques.slice(0, 3)
        : locale.puces,
    paliers:
      distante.paliers && distante.paliers.length > 0
        ? distante.paliers.map((p, i) => ({
            nom: p.nom,
            specs: p.specs,
            prix: p.prix,
            unite: '/mois',
            recommande: locale.paliers[i]?.nom === p.nom ? locale.paliers[i]?.recommande : undefined,
          }))
        : locale.paliers,
    sla: distante.sla ? { ...locale.sla, dispo: distante.sla } : locale.sla,
    faq: distante.faq && distante.faq.length > 0 ? distante.faq : locale.faq,
  }
}

// ─── Datacenters ────────────────────────────────────────────────────

export interface DatacenterPublic {
  code: string
  nom: string
  ville: string
  site: string
  operateur: string
  certifications?: string[]
  energie?: string
  redondance?: string
  capacite?: string
  latencesMs?: Array<{ vers: string; ms: number }>
  photoUrl?: string
}

type DatacenterLocal = (typeof DATACENTERS)[number]

/**
 * `GET /public/datacenters` rapproché de la fiche locale par site (`ABJ`,
 * `GBM`) : nom, ville, certifications, puissance et alimentation suivent le
 * backend ; le texte de refroidissement, de connectivité et de sécurité
 * physique — qu’il ne publie pas — reste local.
 */
export function fusionnerDatacenters(
  distants: DatacenterPublic[] | undefined,
  locaux: readonly DatacenterLocal[],
): DatacenterLocal[] {
  if (!distants || distants.length === 0) return [...locaux]
  return locaux.map((l) => {
    const d = distants.find((x) => x.site === l.code || x.code === l.code)
    if (!d) return l
    return {
      ...l,
      nom: d.nom || l.nom,
      ville: d.ville || l.ville,
      certifications: d.certifications && d.certifications.length > 0 ? d.certifications : l.certifications,
      puissance: d.capacite ?? l.puissance,
      alimentation: [d.energie, d.redondance ? `redondance ${d.redondance}` : undefined]
        .filter(Boolean)
        .join(' · ') || l.alimentation,
    }
  })
}
