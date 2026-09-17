import type { Metadata } from 'next'
import { entreeWebCloudById } from '@/lib/mock'
import { VueDomaine } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const e = entreeWebCloudById(decodeURIComponent(id))
  return { title: e ? `${e.nom} · Domaine` : 'Domaine introuvable' }
}

/**
 * Pas de `notFound()` : une ressource créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageDomaine({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const nom = decodeURIComponent(id)
  return <VueDomaine id={nom} />
}
