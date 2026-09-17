import type { Metadata } from 'next'
import { ESPACES } from '@/lib/mock'
import { VueEspace } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const e = ESPACES.find((x) => x.id === id)
  return { title: e ? `${e.code} · Espace Cloud` : 'Espace introuvable' }
}

/**
 * Pas de `notFound()` : un espace créé pendant la session n'existe pas dans
 * le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la vue
 * cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageEspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueEspace id={id} />
}
