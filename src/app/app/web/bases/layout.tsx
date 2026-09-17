import type { Metadata } from 'next'
import { CadreBases } from './cadre'

export const metadata: Metadata = {
  title: 'Bases de données',
  description: 'MariaDB, PostgreSQL et Redis installés sur vos hébergements. Aucun accès distant : les bases n\'écoutent que sur leur serveur.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreBases>{children}</CadreBases>
}
