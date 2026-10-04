'use client'

import { money, num, pct } from '@/lib/format'
import { BUDGET_IA, CLES_IA, GARDE_FOUS, REGLES_ROUTAGE } from '@/lib/mock'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import type { CleIA } from '@/lib/types'
import { AvisDemoApi } from '../avis-demo'

/** Ce qui prime sur quoi, dans l'ordre où la passerelle l'applique. */
const CHAINE = [
  {
    n: 'Résidence des données',
    quoi: 'La classe déclarée sur la requête, croisée avec l’hébergement du modèle. Une règle de routage qui contredirait la politique est refusée à l’enregistrement, pas au moment de l’appel.',
  },
  {
    n: 'Garde-fous en entrée',
    quoi: 'Anonymisation, secrets, injection de consigne. Ce qui est bloqué ici ne part jamais chez un modèle, souverain ou non.',
  },
  {
    n: 'Règles de routage',
    quoi: 'La première règle qui correspond gagne, dans les modèles que la résidence a laissés éligibles. Le repli suit la même contrainte.',
  },
  {
    n: 'Quota de la clé, puis plafond de l’organisation',
    quoi: 'Le quota de clé refuse un appel isolé ; le plafond coupe toutes les clés à la fois, si la coupure est armée.',
  },
  {
    n: 'Garde-fous en sortie',
    quoi: 'Restitution des valeurs masquées, filtres de contenu, contrôle du format attendu.',
  },
]

export default function ParametresIA() {
  const espace = useEspace()
  const clesCol = useCollection<CleIA>('cles-ia', CLES_IA)
  const cles = clesCol.items.filter((c) => c.espaceId === espace.id)
  const actives = REGLES_ROUTAGE.filter((r) => r.actif)
  const gardesActifs = GARDE_FOUS.filter((g) => g.actif)
  const replis = REGLES_ROUTAGE.reduce((a, r) => a + r.replisDeclenches24h, 0)
  const partBudget = (BUDGET_IA.consomme / BUDGET_IA.plafondMensuel) * 100

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Paramètres' },
        ]}
        titre="Paramètres de la passerelle"
        sousTitre="Six réglages qui s’appliquent à toutes les clés de l’organisation, quel que soit l’agent ou le flux qui appelle. Ce sont eux qui empêchent — une consigne d’agent, elle, ne fait qu’orienter. Choisissez un réglage dans le panneau."
      />

      <AvisDemoApi>
        Seules les clés d’accès sont réelles. Les règles de routage, les garde-fous, le coffre et le
        budget d’organisation sont des jeux d’exemple que la passerelle n’applique pas encore.
      </AvisDemoApi>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Clés d’accès"
          valeur={cles.length}
          detail={`${cles.filter((c) => c.statut === 'active').length} actives`}
        />
        <StatTile
          libelle="Règles de routage"
          valeur={`${actives.length} / ${REGLES_ROUTAGE.length}`}
          detail={`${num(replis)} replis déclenchés sur 24 h`}
        />
        <StatTile
          libelle="Garde-fous armés"
          valeur={`${gardesActifs.length} / ${GARDE_FOUS.length}`}
          ton={gardesActifs.length === GARDE_FOUS.length ? 'ok' : 'warn'}
          detail={`${num(gardesActifs.reduce((a, g) => a + g.declenchements24h, 0))} déclenchements sur 24 h`}
        />
        <StatTile
          libelle="Budget consommé"
          valeur={pct(partBudget)}
          ton={partBudget > BUDGET_IA.seuilAlertePct ? 'warn' : 'ok'}
          detail={`${money(BUDGET_IA.consomme)} sur ${money(BUDGET_IA.plafondMensuel)}`}
        />
      </div>

      <EmptyState
        titre="Choisissez un réglage"
        phrase="Le panneau de gauche suit le trajet d’un appel : par où il entre, avec quelle clé fournisseur, vers quel modèle il part, ce qui le filtre, où il a le droit d’être traité, et ce qu’il coûte."
      />

      <Card>
        <CardHeader
          titre="Ce qui prime sur quoi"
          sousTitre="L’ordre compte : un réglage plus haut dans la liste ne peut pas être contourné par un réglage plus bas. C’est ce qui permet de déléguer le routage sans déléguer la conformité."
        />
        <ol className="space-y-2.5">
          {CHAINE.map((e, i) => (
            <li key={e.n} className="rounded-[6px] border border-g-300 px-3 py-2.5">
              <span className="flex items-center gap-2">
                <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-p-100 text-[11px] font-bold text-p-700">
                  {i + 1}
                </span>
                <span className="text-[13px] font-semibold text-ink">{e.n}</span>
              </span>
              <p className="mt-1.5 text-[12px] leading-relaxed text-g-500">{e.quoi}</p>
            </li>
          ))}
        </ol>
        <Callout ton="violet" className="mt-4" titre="Ce que ces écrans ne règlent pas">
          La consigne d’un agent, ses outils et ses canaux se règlent sur sa fiche, dans la section
          Agents : ils ne valent que pour lui. Ici, tout ce qui est posé s’applique à l’organisation
          entière, y compris aux applications qui appellent la passerelle sans passer par un agent.
        </Callout>
      </Card>
    </div>
  )
}
