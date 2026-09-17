import type { Metadata } from 'next'
import { CadreProjet } from '@/components/app/cadre-projet'

export const metadata: Metadata = {
  title: 'Sauvegardes',
  description:
    'Ce qui protège chaque service d’un projet : plan, fréquence, rétention, dernière exécution et restauration.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreProjet base="/app/applications/backup">{children}</CadreProjet>
}
