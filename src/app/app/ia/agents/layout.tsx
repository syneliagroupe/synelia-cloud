import type { Metadata } from 'next'
import { CadreAgents } from './cadre'

export const metadata: Metadata = {
  // Chaîne à deux niveaux sous `/app` : un titre simple ne reprend le gabarit
  // que d'un parent direct (§ piège Next.js), donc cette section redéfinit le
  // sien, identique à celui de `/app/layout.tsx`, plutôt que d'afficher un
  // titre d'onglet nu.
  title: { absolute: 'Agents · Espace client Synelia Cloud', template: '%s · Espace client Synelia Cloud' },
  description:
    'Rôle, consigne, variables, modèle, outils, connaissances, garde-fous, versions et traces d’exécution de chaque agent.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreAgents>{children}</CadreAgents>
}
