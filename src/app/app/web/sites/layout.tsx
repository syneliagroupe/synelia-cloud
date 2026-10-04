import type { Metadata } from 'next'
import { CadreSites } from './cadre'

export const metadata: Metadata = {
  title: 'Sites',
  description:
    'Un nom servi, un serveur : vue d’ensemble, applications, bases, accès serveur et zone DNS au même endroit.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreSites>{children}</CadreSites>
}
