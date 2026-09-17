import type { Metadata } from 'next'
import { MOTEUR_WEB_LABEL, serveurBasesById } from '@/lib/mock'
import { VueServeurBases } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const s = serveurBasesById(id)
  return {
    title: s ? `${MOTEUR_WEB_LABEL[s.moteur]} · ${s.serveur}` : 'Moteur introuvable',
  }
}

/**
 * Pas de `notFound()` : une ressource créée pendant la session n'existe pas
 * dans le jeu figé, et un 404 du serveur ferait croire à une panne. C'est la
 * vue cliente qui sait ce qu'elle trouve, et qui le dit.
 */
export default async function PageServeurBases({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueServeurBases id={id} />
}
