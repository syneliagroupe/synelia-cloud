import type { Metadata } from 'next'
import { sauvegardeWebById } from '@/lib/mock'
import { VueSauvegarde } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const s = sauvegardeWebById(id)
  return { title: s ? `${s.nomServi} · Sauvegardes` : 'Plan introuvable' }
}

/**
 * Pas de `notFound()` : une ressource créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageSauvegarde({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueSauvegarde id={id} />
}
