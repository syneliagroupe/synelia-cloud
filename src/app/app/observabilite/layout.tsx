import type { Metadata } from 'next'

/**
 * Une page « use client » ne peut pas exporter `metadata`. Ce layout minimal
 * n'existe que pour nommer l'onglet du navigateur — il n'ajoute aucun rendu.
 */
export const metadata: Metadata = {
  title: 'Supervision',
  description: 'Règles d’alerte, sondes posées et accès à Centreon, Grafana et VictoriaLogs.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
