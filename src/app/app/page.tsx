import type { Metadata } from 'next'
import TableauDeBord from './tableau-de-bord'

// `TableauDeBord` est un composant client : il lit l'atelier et l'API pour
// afficher des données réelles (`useCollection`, `useAtelier`), ce qu'un
// composant serveur ne peut pas faire. `metadata` ne se déclare que depuis un
// composant serveur — cette page reste donc un simple relais, plutôt qu'un
// layout.tsx voisin : `src/app/app/layout.tsx` existe déjà à ce niveau et sert
// tout l'espace client, on ne peut pas lui en ajouter un second.
export const metadata: Metadata = {
  // `absolute` plutôt qu'une chaîne simple : `page.tsx` et `layout.tsx`
  // partagent le même segment `/app`, et un titre simple ici ne reprend pas le
  // gabarit du layout voisin (§ piège Next.js) — il faut écrire le titre
  // complet une fois, identique au gabarit partagé.
  title: { absolute: 'Tableau de bord · Espace client Synelia Cloud' },
  description:
    'Capacité souscrite contre consommée, disponibilité, services managés, santé de l’infrastructure et activité récente.',
}

export default function Page() {
  return <TableauDeBord />
}
