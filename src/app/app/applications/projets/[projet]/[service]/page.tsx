import type { Metadata } from 'next'
import { TYPE_SERVICE_LABEL, serviceProjetById } from '@/lib/mock'
import { VueService } from './vue'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projet: string; service: string }>
}): Promise<Metadata> {
  const { service } = await params
  const s = serviceProjetById(service)
  return {
    title: s ? `${s.nom} · ${TYPE_SERVICE_LABEL[s.type]}` : 'Service introuvable',
  }
}

export default async function PageService({
  params,
}: {
  params: Promise<{ projet: string; service: string }>
}) {
  const { projet, service } = await params
  // Pas de 404 côté serveur : un service créé pendant la session n'existe pas
  // dans le jeu figé, et une page d'erreur ferait croire à une panne. La vue
  // cliente vérifie l'appartenance au projet et le dit elle-même.
  return <VueService id={service} projetId={projet} />
}
