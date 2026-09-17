import type { Metadata } from 'next'
import { CadreConnaissances } from './cadre'

export const metadata: Metadata = {
  title: {
    absolute: 'Connaissances · Espace client Synelia Cloud',
    template: '%s · Espace client Synelia Cloud',
  },
  description:
    'Collections vectorielles alimentées depuis vos sources : documents indexés, fraîcheur, découpage, habilitations et recherche.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreConnaissances>{children}</CadreConnaissances>
}
