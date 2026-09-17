import type { Metadata } from 'next'
import { siteById } from '@/lib/mock'
import { VueApplication } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const s = siteById(id)
  return { title: s ? `${s.hote} · Application` : 'Application introuvable' }
}

/**
 * Pas de `notFound()` : une ressource créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueApplication id={id} />
}
