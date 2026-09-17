import type { Metadata } from 'next'
import { VMS } from '@/lib/mock'
import { VueVm } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vm: string }>
}): Promise<Metadata> {
  const { vm } = await params
  const m = VMS.find((x) => x.id === vm)
  return { title: m ? `${m.nom} · Machine virtuelle` : 'Machine introuvable' }
}

/**
 * Pas de `notFound()` : une machine créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageVm({ params }: { params: Promise<{ vm: string }> }) {
  const { vm } = await params
  return <VueVm id={vm} />
}
