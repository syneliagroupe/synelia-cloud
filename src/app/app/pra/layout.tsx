import type { Metadata } from 'next'

/**
 * Une page « use client » ne peut pas exporter `metadata`. Ce layout minimal
 * n'existe que pour nommer l'onglet du navigateur — il n'ajoute aucun rendu.
 */
export const metadata: Metadata = {
  title: 'Plan de reprise (PRA)',
  description:
    'RPO et RTO en cible et en constaté, ordre de démarrage, réplication, bascule de test et exercices datés.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
