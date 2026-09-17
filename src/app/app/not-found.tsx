import type { Metadata } from 'next'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/composition/states'

export const metadata: Metadata = {
  title: 'Page introuvable',
}

/**
 * 404 de l'espace client : la barre supérieure et le conteneur viennent déjà
 * de `app/layout.tsx`, il n'y a que le contenu à fournir. Sans ce fichier,
 * Next rend sa page 404 générique — sans TopBar, en anglais.
 */
export default function NotFound() {
  return (
    <EmptyState
      icone={<Compass size={24} />}
      titre="Cette page n’existe pas"
      phrase="L’adresse est mal orthographiée, ou la ressource a été supprimée. Le tableau de bord et la recherche restent accessibles depuis la barre du haut."
      action={{ libelle: 'Retour au tableau de bord', href: '/app' }}
      className="mt-6"
    />
  )
}
