import type { Metadata } from 'next'
import { hebergementById, nomServi } from '@/lib/mock'
import { VueHebergement } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const h = hebergementById(id)
  return { title: h ? `${nomServi(h)} · Hébergement` : 'Hébergement introuvable' }
}

export default async function PageHebergement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VueHebergement id={id} navigation="domaines" />
}
