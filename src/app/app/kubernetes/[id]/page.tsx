import type { Metadata } from 'next'
import { K8S_CLUSTERS } from '@/lib/mock'
import { VueCluster } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const c = K8S_CLUSTERS.find((x) => x.id === id)
  return { title: c ? `${c.nom} · Kubernetes` : 'Cluster introuvable' }
}

/**
 * Pas de `notFound()` : un cluster créé pendant la session n'existe pas dans
 * le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la vue
 * cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageCluster({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueCluster id={id} />
}
