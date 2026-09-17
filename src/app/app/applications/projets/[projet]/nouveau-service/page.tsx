import type { Metadata } from 'next'
import { projetById } from '@/lib/mock'
import { VueNouveauService } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projet: string }>
}): Promise<Metadata> {
  const { projet } = await params
  const p = projetById(projet)
  return { title: p ? `Créer un service · ${p.nom}` : 'Créer un service' }
}

export default async function PageNouveauService({
  params,
}: {
  params: Promise<{ projet: string }>
}) {
  const { projet } = await params
  // Pas de 404 côté serveur, même règle que la fiche du projet : la vue
  // cliente relit la collection et dit elle-même ce qu'elle ne trouve pas.
  return <VueNouveauService projetId={projet} />
}
