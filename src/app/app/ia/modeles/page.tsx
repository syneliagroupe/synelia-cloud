'use client'

import { cn } from '@/lib/utils'
import { money, num } from '@/lib/format'
import type { ModeleIA } from '@/lib/types'
import { MODELES_IA, PASSERELLE_IA } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useCollection } from '@/components/app/atelier'

/** Requête de référence pour comparer les tarifs : 2 000 jetons entrent, 400 sortent. */
const REFERENCE = { entree: 2_000, sortie: 400, requetes: 1_000 }

function coutReference(m: ModeleIA): number {
  if (m.unite === 'minute') return Math.round(m.prixEntree * 60)
  const entree = (REFERENCE.entree * REFERENCE.requetes * m.prixEntree) / 1_000_000
  const sortie = (REFERENCE.sortie * REFERENCE.requetes * m.prixSortie) / 1_000_000
  return Math.round(entree + sortie)
}

export default function CatalogueModeles() {
  const modelesCol = useCollection<ModeleIA>('modeles-ia', MODELES_IA)
  const modeles = modelesCol.items
  const souverains = modeles.filter((m) => m.hebergement === 'souverain')
  const texte = [...modeles]
    .filter((m) => m.famille === 'texte')
    .sort((a, b) => coutReference(a) - coutReference(b))
  const moinsCher = texte[0]
  const plusCher = coutReference(texte[texte.length - 1])

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Modèles' },
        ]}
        titre="Catalogue de modèles"
        sousTitre="Un modèle se choisit sur quatre critères : où le calcul a lieu, ce qu’il coûte au million de jetons, la latence du premier jeton, et ce qu’il sait faire. Le reste est de la littérature d’éditeur. Choisissez-en un dans le panneau pour ouvrir sa fiche."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Modèles au catalogue" valeur={modeles.length} />
        <StatTile
          libelle="Servis depuis nos datacenters"
          valeur={souverains.length}
          ton="ok"
          detail="Abidjan et Grand-Bassam"
        />
        <StatTile
          libelle="Le moins cher en génération"
          valeur={moinsCher?.nom ?? '—'}
          detail={`${money(coutReference(moinsCher))} pour 1 000 requêtes de référence`}
        />
        <StatTile
          libelle="Latence médiane de la passerelle"
          valeur={`${num(PASSERELLE_IA.latenceP50Ms)} ms`}
          detail={`p95 ${num(PASSERELLE_IA.latenceP95Ms)} ms`}
        />
      </div>

      <Card>
        <CardHeader
          titre="Ce que coûtent mille requêtes de référence"
          sousTitre="Deux mille jetons entrants, quatre cents sortants — la charge d’une réponse de support. Tarif public hors taxes, modèles de génération de texte."
        />
        <div className="space-y-1.5">
          {texte.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3">
              <span className="flex w-full min-w-0 items-center gap-2 sm:w-64">
                <span className="truncate text-[13px] text-ink">{m.nom}</span>
                <Badge tone={m.hebergement === 'souverain' ? 'ok' : 'warn'} size="sm">
                  {m.hebergement === 'souverain' ? 'Territoire' : 'Hors territoire'}
                </Badge>
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-g-100">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      m.hebergement === 'souverain' ? 'bg-p-600' : 'bg-warn',
                    )}
                    style={{ width: `${Math.max((coutReference(m) / plusCher) * 100, 2)}%` }}
                  />
                </span>
                <span className="tnum w-24 shrink-0 text-right text-[12px] font-semibold text-ink">
                  {money(coutReference(m))}
                </span>
              </span>
            </div>
          ))}
        </div>
        <Callout ton="info" className="mt-4" titre="Le prix n’est pas le seul critère">
          Un modèle deux fois moins cher qui demande deux essais pour donner la bonne réponse coûte
          davantage. Mesurez sur votre propre charge avant d’arbitrer : la clé d’exploration existe
          pour cela, et sa dépense est plafonnée.
        </Callout>
      </Card>

      <EmptyState
        titre="Choisissez un modèle"
        phrase="Le panneau de gauche liste le catalogue, les modèles souverains d’abord. Sa fiche donne la résidence du calcul, le tarif, la performance observée et la manière de l’appeler."
      />
    </div>
  )
}
