'use client'

import { usePathname } from 'next/navigation'
import { PROJETS, SERVICES_PROJET, syntheseDeServices } from '@/lib/mock'
import type { Projet, ServiceProjet } from '@/lib/types'
import { useCollection } from '@/components/app/atelier'
import type { Tone } from '@/components/ui/badge'
import {
  SelecteurRessource,
  type EntreeSelecteur,
} from '@/components/composition/selecteur-ressource'
import { CoquillePanneau } from './cadre-section'

/**
 * Coquille maître-détail des sections de l'univers Applications.
 *
 * Web Cloud donne à chaque section son propre panneau : une section liste des
 * domaines, une autre des certificats, une autre des boîtes aux lettres. Ici
 * c'est l'inverse — un seul panneau, le même partout : le projet. Toutes les
 * sections répondent à une question sur le *même* objet (que déploie-t-il ?
 * comment se porte-t-il ? qu'est-ce qui le sauvegarde ?), donc changer d'onglet
 * ne doit jamais redemander de quel projet on parle.
 *
 * Comme dans Web Cloud, le panneau vit dans le `layout` de la section et non
 * dans sa page : passer d'un projet à l'autre ne le reconstruit pas.
 */
export function CadreProjet({
  base,
  children,
}: {
  /** Préfixe des routes de la section, par exemple `/app/applications/backup`. */
  base: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  // Le panneau lit les collections : un projet créé pendant la session doit y
  // apparaître, et un projet supprimé en sortir.
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)

  // `/app/applications/backup/prj-metier` → `prj-metier`. La racine de la
  // section ne sélectionne rien : elle montre la vue tous projets confondus.
  const segment = pathname.startsWith(`${base}/`)
    ? decodeURIComponent(pathname.slice(base.length + 1).split('/')[0])
    : undefined

  const entrees: EntreeSelecteur[] = lesProjets.items.map((p) => {
    const services = lesServices.items.filter((x) => x.projetId === p.id)
    const s = syntheseDeServices(services)
    const etat =
      s.enEchec > 0
        ? { texte: `${s.enEchec} en échec`, ton: 'err' as Tone }
        : s.degrades > 0
          ? { texte: `${s.degrades} dégradé${s.degrades > 1 ? 's' : ''}`, ton: 'warn' as Tone }
          : s.arretes > 0
            ? { texte: `${s.arretes} arrêté${s.arretes > 1 ? 's' : ''}`, ton: 'neutral' as Tone }
            : { texte: 'Sain', ton: 'ok' as Tone }

    return {
      id: p.id,
      nom: p.nom,
      sousTitre: `${s.services} service${s.services > 1 ? 's' : ''} · ${p.environnements.length} env.`,
      etat: etat.texte,
      ton: etat.ton,
      href: `${base}/${p.id}`,
      motsCles: [p.espaceId, ...p.environnements, ...services.map((x) => x.nom)],
    }
  })

  const actif = entrees.find((e) => e.id === segment)

  const panneau = (
    <SelecteurRessource
      titre="Projets"
      actionPrincipale={{ libelle: 'Nouveau projet', href: '/app/applications/nouveau' }}
      entrees={entrees}
      actifId={actif?.id}
      placeholderRecherche="Rechercher un projet, un service…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} projet${total > 1 ? 's' : ''}` : `${visibles} sur ${total}`
      }
      lienBas={{ libelle: 'Vue d’ensemble', href: '/app/applications' }}
    />
  )

  return (
    <CoquillePanneau titre="Projets" nomActif={actif?.nom} panneau={panneau}>
      {children}
    </CoquillePanneau>
  )
}
