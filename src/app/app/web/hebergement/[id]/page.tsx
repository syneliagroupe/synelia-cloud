import type { Metadata } from 'next'
import { hebergementById, nomServi } from '@/lib/mock'
import { VueHebergement } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const h = hebergementById(id)
  return { title: h ? `${nomServi(h)} · Hébergement` : 'Hébergement introuvable' }
}

/**
 * Pas de `notFound()` : une ressource créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageHebergement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueHebergement id={id} />
}
