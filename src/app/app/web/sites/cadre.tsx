'use client'

import { useEntreesWeb, hrefSite } from '@/lib/web/entrees'
import { CadreSection } from '@/components/app/cadre-section'

/** Panneau de la section Sites — un nom servi par ligne (domaine ou provisoire). */
export function CadreSites({ children }: { children: React.ReactNode }) {
  const entrees = useEntreesWeb()
  const liste = entrees.map((e) => ({
    id: e.id,
    nom: e.nom,
    sousTitre: e.sousTitre,
    etat: e.etat,
    ton: e.ton,
    href: hrefSite(e.id),
    motsCles: [e.hebergement?.serveur.nom ?? '', e.hebergement?.palier ?? ''],
  }))

  return (
    <CadreSection
      titre="Sites"
      base="/app/web/sites"
      entrees={liste}
      placeholderRecherche="Rechercher un site ou un domaine…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} site${total > 1 ? 's' : ''}` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
