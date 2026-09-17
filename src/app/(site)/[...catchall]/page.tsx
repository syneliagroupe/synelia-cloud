import { notFound } from 'next/navigation'

/**
 * Sans ce fichier, une URL de la vitrine qui ne correspond à aucune route ne
 * traverse jamais `(site)/layout.tsx` : Next ne route vers un segment que s'il
 * existe une page qui le déclare, et un chemin totalement inconnu tombe
 * directement sur la 404 racine (générique, sans en-tête ni pied de page),
 * jamais sur `(site)/not-found.tsx`. Ce fourre-tout donne au routeur un
 * segment à matcher, pour que `notFound()` déclenche la bonne limite.
 */
export default function CatchAll(): never {
  notFound()
}
