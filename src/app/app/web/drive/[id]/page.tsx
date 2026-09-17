import type { Metadata } from 'next'
import { driveById } from '@/lib/mock'
import { VueDrive } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const d = driveById(id)
  return { title: d ? `${d.domaine} · Drive` : 'Drive introuvable' }
}

/**
 * Pas de `notFound()` : une ressource créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageDrive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueDrive id={id} />
}
