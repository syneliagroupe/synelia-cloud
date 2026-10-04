import type { Metadata } from 'next'
import { entreeWebCloudById } from '@/lib/mock'
import { VueDomaine } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const e = entreeWebCloudById(decodeURIComponent(id))
  return { title: e ? `${e.nom} · Domaine` : 'Domaine introuvable' }
}

export default async function PageDomaine({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const nom = decodeURIComponent(id)
  return <VueDomaine id={nom} navigation="domaines" vue="complet" />
}
