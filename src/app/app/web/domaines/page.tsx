import type { Metadata } from 'next'
import PortefeuilleDomaines from './portefeuille'

export const metadata: Metadata = {
  title: 'Domaines',
  description: 'Portefeuille de noms, recherche, commande et résiliation.',
}

export default function PageDomaines() {
  return <PortefeuilleDomaines />
}
