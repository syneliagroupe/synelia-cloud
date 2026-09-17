import type { Metadata } from 'next'
import { CadreBackup } from './cadre'

export const metadata: Metadata = {
  title: 'Sauvegardes',
  description: 'Un plan par hébergement : périmètre, fréquence, rétention, immuabilité, exécutions et restauration.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreBackup>{children}</CadreBackup>
}
