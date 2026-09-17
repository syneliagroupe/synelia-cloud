import type { Metadata } from 'next'
import { BUCKETS } from '@/lib/mock'
import { VueBucket } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const b = BUCKETS.find((x) => x.id === id)
  return { title: b ? `${b.nom} · Bucket S3` : 'Bucket introuvable' }
}

/**
 * Pas de `notFound()` : un bucket créé pendant la session n'existe pas dans
 * le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la vue
 * cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageBucket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueBucket id={id} />
}
