import { notFound } from 'next/navigation'

/**
 * Même besoin que `(site)/[...catchall]` : sans route matchée, Next ne
 * traverse jamais `app/layout.tsx` (donc pas de barre supérieure) pour une
 * URL sous `/app/` qui n'existe pas — il tombe direct sur la 404 racine.
 */
export default function CatchAll(): never {
  notFound()
}
