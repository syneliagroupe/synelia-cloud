import type { Metadata } from 'next'
import { TICKETS } from '@/lib/mock'
import { VueTicket } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const t = TICKETS.find((x) => x.id === id || x.numero === id)
  return { title: t ? `${t.numero} · ${t.sujet}` : 'Ticket introuvable' }
}

/**
 * Pas de `notFound()` : un ticket ouvert pendant la session n'existe pas dans
 * le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la vue
 * cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = TICKETS.find((x) => x.id === id || x.numero === id)
  return <VueTicket id={t?.id ?? id} />
}
