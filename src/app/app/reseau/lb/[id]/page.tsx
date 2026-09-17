import type { Metadata } from 'next'
import { LOAD_BALANCERS } from '@/lib/mock'
import { VueLb } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const l = LOAD_BALANCERS.find((x) => x.id === id)
  return { title: l ? `${l.nom} · Load balancer` : 'Load balancer introuvable' }
}

/**
 * Pas de `notFound()` : un load balancer créé pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageLb({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueLb id={id} />
}
