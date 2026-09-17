import type { Metadata } from 'next'
import Lanceur from './vue'

// `Lanceur` est un composant client : il lit la session réelle (`useApp`)
// pour ne pas afficher l'identité d'un autre utilisateur en mode API, ce
// qu'un composant serveur ne peut pas faire. `metadata` ne se déclare que
// depuis un composant serveur — cette page reste donc un simple relais,
// même patron que `src/app/app/page.tsx` → `tableau-de-bord.tsx`.
export const metadata: Metadata = {
  title: 'Lanceur d’applications',
  description:
    'Vos services managés accessibles en un clic, en SSO. Uniquement ceux pour lesquels vous disposez d’un siège.',
}

export default function Page() {
  return <Lanceur />
}
