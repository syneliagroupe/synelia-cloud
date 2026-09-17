import type { Metadata } from 'next'
import { DR_PLANS } from '@/lib/mock'
import { VuePra } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const p = DR_PLANS.find((x) => x.id === id)
  return { title: p ? `${p.nom} · Plan de reprise` : 'Plan introuvable' }
}

/**
 * Pas de `notFound()` : un plan créé pendant la session n'existe pas dans le
 * jeu figé, et un 404 du serveur ferait croire à une panne. C'est la vue
 * cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PagePra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VuePra id={id} />
}
