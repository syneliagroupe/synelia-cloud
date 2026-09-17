import type { Metadata } from 'next'
import { CadreModeles } from './cadre'

export const metadata: Metadata = {
  title: {
    absolute: 'Modèles · Espace client Synelia Cloud',
    template: '%s · Espace client Synelia Cloud',
  },
  description:
    'Modèles souverains et externes : résidence du calcul, tarif au million de jetons, latence et disponibilité.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreModeles>{children}</CadreModeles>
}
