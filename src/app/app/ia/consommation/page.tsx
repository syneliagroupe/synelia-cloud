'use client'

import { dateCourte, jetons, money, pct, relatif } from '@/lib/format'
import type { CleIA } from '@/lib/types'
import { CLES_IA } from '@/lib/mock'
import { estActif } from '@/lib/api/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { QuotaBar, StatTile } from '@/components/composition/metrics'
import { useEspace, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

const TON_STATUT = { active: 'ok', suspendue: 'warn', revoquee: 'neutral' } as const
const LIBELLE_STATUT = { active: 'Active', suspendue: 'Suspendue', revoquee: 'Révoquée' } as const

export default function ConsommationIA() {
  const refMaintenant = useMaintenant()
  const espace = useEspace()
  const clesCol = useCollection<CleIA>('cles-ia', CLES_IA)
  const cles = clesCol.items.filter((c) => c.espaceId === espace.id)
  const actives = cles.filter((c) => c.statut === 'active')

  const jetonsTotal = actives.reduce((a, c) => a + c.jetonsConsommes, 0)
  const depense = actives.reduce((a, c) => a + c.budgetConsomme, 0)
  const plafondCumule = actives.reduce((a, c) => a + c.budgetMensuel, 0)

  // Projection fin de mois : une règle de trois sur la dépense déjà comptée,
  // pas une moyenne historique — la passerelle LiteLLM ne journalise pas
  // encore la dépense par jour (`/spend/logs` → aucune base connectée), donc
  // il n'existe pas de série quotidienne réelle à extrapoler autrement.
  // `refMaintenant` (pas `new Date()`) : le rendu doit rester déterministe
  // entre serveur et client (§ CLAUDE.md « Déterminisme du rendu »).
  const maintenant = new Date(refMaintenant)
  const joursEcoules = maintenant.getUTCDate()
  const joursDuMois = new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const prevision =
    joursEcoules > 0 ? Math.round((depense / joursEcoules) * joursDuMois) : depense

  const parDepense = [...cles].sort((a, b) => b.budgetConsomme - a.budgetConsomme)
  const depenseMax = Math.max(...parDepense.map((c) => c.budgetConsomme), 1)

  const colonnes: Array<Colonne<CleIA>> = [
    {
      id: 'nom',
      entete: 'Clé',
      cle: (c) => c.nom,
      rendu: (c) => (
        <span className="block">
          <span className="block text-[12.5px] font-semibold text-ink">{c.nom}</span>
          <span className="block text-[11px] text-g-500">{c.usage || '—'}</span>
        </span>
      ),
    },
    {
      id: 'jetons',
      entete: 'Jetons consommés',
      largeur: 'w-52',
      cle: (c) => c.jetonsConsommes / Math.max(c.quotaJetonsMois, 1),
      rendu: (c) => (
        <QuotaBar
          utilise={c.jetonsConsommes}
          total={c.quotaJetonsMois}
          compact
          seuil={90}
          formateur={(v) => jetons(v)}
        />
      ),
    },
    {
      id: 'montant',
      entete: 'Dépense du mois',
      aligne: 'right',
      cle: (c) => c.budgetConsomme,
      rendu: (c) => (
        <span className="block">
          <span className="tnum block text-[12.5px] font-semibold text-ink">
            {money(c.budgetConsomme)}
          </span>
          {c.budgetMensuel > 0 && (
            <span className="tnum block text-[11px] text-g-500">
              plafond {money(c.budgetMensuel)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'derniereUtilisation',
      entete: 'Dernier appel',
      masquable: true,
      cle: (c) => c.derniereUtilisation ?? '',
      rendu: (c) => (
        <span className="text-[12px] text-g-500">
          {c.derniereUtilisation ? relatif(c.derniereUtilisation, refMaintenant) : 'Jamais'}
        </span>
      ),
    },
    {
      id: 'statut',
      entete: 'État',
      cle: (c) => c.statut,
      rendu: (c) => (
        <Badge tone={TON_STATUT[c.statut]} dot size="sm">
          {LIBELLE_STATUT[c.statut]}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Consommation & coûts' },
        ]}
        titre="Consommation & coûts"
        sousTitre="Chaque clé d’accès compte ses propres jetons et sa propre dépense, appliqués en temps réel à chaque appel — c’est ce compteur, pas un journal de la passerelle, qui sert de source de vérité pour les quotas."
      />

      {!estActif() && (
        <Callout ton="info" titre="Démonstration">
          Ces chiffres viennent du jeu de données fictif — connectez l’API pour voir la
          consommation réelle des clés de cet Espace.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Dépense du mois" valeur={money(depense)} detail={`Au ${dateCourte(maintenant.toISOString())}`} />
        <StatTile
          libelle="Prévision fin de mois"
          valeur={money(prevision)}
          ton={plafondCumule > 0 && prevision > plafondCumule ? 'warn' : 'ok'}
          detail={
            plafondCumule > 0
              ? `Plafonds cumulés ${money(plafondCumule)}`
              : 'Estimation linéaire sur les jours écoulés'
          }
        />
        <StatTile libelle="Jetons du mois" valeur={jetons(jetonsTotal)} detail={`${actives.length} clé(s) active(s)`} />
        <StatTile
          libelle="Utilisation des plafonds"
          valeur={plafondCumule > 0 ? pct((depense / plafondCumule) * 100) : '—'}
          ton={plafondCumule > 0 && depense / plafondCumule > 0.85 ? 'warn' : undefined}
          detail="Cumulé sur les clés actives"
        />
      </div>

      <Card>
        <CardHeader
          titre="Par clé"
          sousTitre="Le showback interne se lit ici : chaque clé porte une application, via son champ « usage »."
        />
        {parDepense.length === 0 ? (
          <p className="text-[12.5px] text-g-500">Aucune clé sur cet Espace.</p>
        ) : (
          <div className="space-y-3">
            {parDepense.map((c) => (
              <div key={c.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[12.5px] text-ink">{c.nom}</span>
                  <span className="tnum shrink-0 text-[12px] font-semibold text-ink">
                    {money(c.budgetConsomme)}
                  </span>
                </div>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-g-100">
                  <span
                    className="block h-full rounded-full bg-p-600"
                    style={{ width: `${(c.budgetConsomme / depenseMax) * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
        <Callout ton="info" className="mt-4" titre="Ce qui manque encore à ce détail">
          La passerelle LiteLLM ne journalise pas la dépense par modèle ni par jour (base de spend
          non connectée) : impossible aujourd’hui de dire honnêtement quelle part revient à quel
          modèle sur une clé qui en autorise plusieurs. Le compteur par clé, lui, est réel — il vient
          du même mécanisme qui applique les quotas et coupe les appels au dépassement.
        </Callout>
      </Card>

      <Card padding={false}>
        <div className="border-b border-g-100 px-4 py-3">
          <CardHeader titre="Détail par clé" sousTitre={`Espace ${espace.code}`} className="mb-0" />
        </div>
        <DataTable
          lignes={cles}
          colonnes={colonnes}
          parPage={10}
          densiteInitiale="compacte"
          vide={{
            titre: 'Aucune clé sur cet Espace',
            phrase: 'Une clé porte le quota et le plafond de dépense qui alimentent ce tableau.',
            action: { libelle: 'Créer une clé', href: '/app/ia/parametres/passerelle' },
          }}
        />
      </Card>
    </div>
  )
}
