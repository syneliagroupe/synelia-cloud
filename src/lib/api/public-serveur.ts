/**
 * Lecture publique côté serveur (`GET /v1/public/…`) pour les pages de la
 * vitrine rendues sur le serveur (fiches produit, fiches marketplace,
 * datacenters) — à n’importer que depuis des composants serveur. Pendant de
 * `usePublic` (client) : sans
 * `NEXT_PUBLIC_API_URL`, aucune requête ne part et la page garde son jeu
 * local ; avec elle, tout échec (réseau, `404`, `424`) renvoie `undefined`
 * et la page retombe sur la maquette au lieu de casser.
 *
 * La réponse est revalidée toutes les 60 s : la construction statique
 * n’exige pas que le backend réponde, et une fiche publiée côté backend
 * apparaît en moins d’une minute.
 */
export async function lirePublicServeur<T>(chemin: string): Promise<T | undefined> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
  if (!base) return undefined
  try {
    const reponse = await fetch(`${base}${chemin}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    })
    if (!reponse.ok) return undefined
    return (await reponse.json()) as T
  } catch {
    return undefined
  }
}
