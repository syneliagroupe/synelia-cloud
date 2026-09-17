import type { Metadata } from 'next'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/composition/states'

export const metadata: Metadata = {
  title: 'Page introuvable',
}

/**
 * 404 de l'espace super admin : la barre supérieure et le conteneur viennent
 * déjà de `admin/layout.tsx`. Sans ce fichier, Next rend sa page 404
 * générique — sans TopBar, en anglais.
 */
export default function NotFound() {
  return (
    <EmptyState
      icone={<Compass size={24} />}
      titre="Cette page n’existe pas"
      phrase="L’adresse est mal orthographiée, ou la ressource a été supprimée. La vue plateforme et la liste des organisations restent accessibles depuis la barre du haut."
      action={{ libelle: 'Retour à la vue plateforme', href: '/admin' }}
      className="mt-6"
    />
  )
}
