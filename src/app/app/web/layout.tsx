import type { Metadata } from 'next'

/**
 * Racine de Web Cloud — sans panneau de sélection.
 *
 * « Accueil » est un tableau de bord : il ne porte pas sur une ressource, donc
 * rien à sélectionner. Chaque autre section apporte son propre panneau via son
 * layout, ce qui évite d'en afficher un vide ici.
 */
export const metadata: Metadata = {
  // Même gabarit que `/app/layout.tsx`, redéfini ici (et non hérité) parce que
  // les huit sections qui suivent sont deux niveaux sous `/app` : un titre
  // simple ne reprend le gabarit que de son parent direct (§ piège Next.js),
  // donc sans ce doublon elles perdraient tout gabarit, pas seulement « Web
  // Cloud Synelia ».
  title: { default: 'Web Cloud', template: '%s · Espace client Synelia Cloud' },
  description:
    'Domaines, hébergement mutualisé, bases de données, messagerie, drive, applications, certificats et sauvegardes.',
}

export default function LayoutWebCloud({ children }: { children: React.ReactNode }) {
  return children
}
