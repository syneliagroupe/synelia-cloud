import type { Metadata } from 'next'
import { CadreEmails } from './cadre'

export const metadata: Metadata = {
  title: 'Messagerie',
  description: 'Boîtes, alias, redirections et authentification d\'expédition, domaine par domaine.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreEmails>{children}</CadreEmails>
}
