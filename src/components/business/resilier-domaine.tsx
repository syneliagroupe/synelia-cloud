'use client'

import { BoutonResilier } from '@/components/business/bouton-resilier'
import { useCollection } from '@/components/app/atelier'
import { estActif, supprimerRessource } from '@/lib/api/client'
import { DOMAINES } from '@/lib/mock'
import type { Domaine } from '@/lib/types'

export function ResilierDomaine({
  domaineId,
  nom,
  hebergementAttache,
  onTermine,
}: {
  domaineId: string
  nom: string
  hebergementAttache?: boolean
  onTermine?: () => void
}) {
  const portefeuille = useCollection<Domaine>('domaines', DOMAINES)

  if (hebergementAttache) {
    return <span className="text-[11px] text-g-500">Hébergement attaché</span>
  }

  return (
    <BoutonResilier
      ressource={nom}
      pertes={[
        'Le nom disparaît de votre portefeuille à la fin du traitement',
        'Le renouvellement automatique est coupé',
        'Exportez la zone DNS avant de résilier si vous rapatriez le nom ailleurs',
      ]}
      operation={{
        action: 'network.manage',
        ton: 'warn',
        titre: `Résiliation de ${nom} lancée`,
        detail: 'Suivi dans le centre de tâches.',
        ...(estActif()
          ? {
              appel: () => supprimerRessource('/web/domaines', domaineId, nom),
              job: { type: 'domaine.resilier', label: `Résiliation · ${nom}` },
              effetFinal: () => {
                portefeuille.recharger()
                onTermine?.()
              },
            }
          : {
              effet: () => {
                portefeuille.supprimer(domaineId)
                onTermine?.()
              },
            }),
      }}
    />
  )
}
