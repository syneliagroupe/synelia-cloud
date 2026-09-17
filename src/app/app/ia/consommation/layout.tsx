import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Consommation & coûts · Espace client Synelia Cloud',
    template: '%s · Espace client Synelia Cloud',
  },
  description:
    'Jetons et FCFA par modèle, par clé et par jour, plafond mensuel et comparaison avec un scénario tout externe.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
