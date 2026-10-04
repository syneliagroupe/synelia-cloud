'use client'

import Link from 'next/link'
import { Server } from 'lucide-react'
import { PageHeader, Callout } from '@/components/composition/card'

/** Accueil de section — la liste des hébergements est dans le panneau de gauche. */
export default function AccueilHebergement() {
  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'Hébergements' },
        ]}
        titre="Hébergements"
        sousTitre="Un domaine, un serveur. Choisissez un hébergement dans le panneau pour PHP, fichiers, applications et bases."
      />
      <Callout ton="info" titre="Où commencer ?">
        <span className="flex items-start gap-2">
          <Server size={16} className="mt-0.5 shrink-0 text-p-700" />
          <span>
            Attachez d’abord un hébergement depuis la fiche d’un{' '}
            <Link href="/app/web/domaines" className="font-semibold underline">domaine</Link>, ou ouvrez un
            serveur déjà actif dans la liste à gauche. Les applications et les bases se règlent depuis la fiche de
            chaque hébergement.
          </span>
        </span>
      </Callout>
    </div>
  )
}
