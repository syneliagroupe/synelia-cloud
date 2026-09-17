import type { Metadata } from 'next'
import { certificatById } from '@/lib/mock'
import { VueCertificat } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const c = certificatById(id)
  return { title: c ? `${c.hote} · Certificat` : 'Certificat introuvable' }
}

/**
 * Pas de `notFound()` : une ressource créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageCertificat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueCertificat id={id} />
}
