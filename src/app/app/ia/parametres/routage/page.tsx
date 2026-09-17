'use client'

import { useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Lock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { num, pct } from '@/lib/format'
import { CLASSE_DONNEES_LABEL } from '@/lib/types'
import { GARDE_FOUS, MATRICE_RESIDENCE, MODELES_IA, REGLES_ROUTAGE, modeleParSlug } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'

const LIBELLE_ACTION = {
  bloquer: 'Bloque la requête',
  masquer: 'Masque avant l’appel',
  journaliser: 'Journalise seulement',
} as const

const TON_ACTION = { bloquer: 'err', masquer: 'violet', journaliser: 'info' } as const

const LIBELLE_SENS = { entree: 'Entrée', sortie: 'Sortie', les_deux: 'Entrée et sortie' } as const

export default function ReglesRoutage() {
  const { autorise, refus, pousser } = useApp()
  const [regles, setRegles] = useState(() =>
    Object.fromEntries(REGLES_ROUTAGE.map((r) => [r.id, r.actif])),
  )
  const [gardes, setGardes] = useState(() =>
    Object.fromEntries(GARDE_FOUS.map((g) => [g.id, g.actif])),
  )

  const peutModifier = autorise('ia.routing.update')
  const requetes24h = REGLES_ROUTAGE.reduce((a, r) => a + r.requetes24h, 0)
  const replis24h = REGLES_ROUTAGE.reduce((a, r) => a + r.replisDeclenches24h, 0)
  const sortiesAutorisees = REGLES_ROUTAGE.filter((r) => !r.residenceImposee && regles[r.id]).length

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Paramètres', href: '/app/ia/parametres' },
          { label: 'Règles de routage' },
        ]}
        titre="Règles de routage"
        sousTitre="Vos applications demandent une capacité, pas un modèle précis. Ces règles décident lequel répond, et vers quoi basculer quand il ne répond plus."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Requêtes routées 24 h" valeur={num(requetes24h)} />
        <StatTile
          libelle="Replis déclenchés"
          valeur={num(replis24h)}
          ton={replis24h > 2_000 ? 'warn' : 'ok'}
          detail={`${pct((replis24h / requetes24h) * 100, 2)} des requêtes`}
        />
        <StatTile
          libelle="Règles autorisant une sortie"
          valeur={sortiesAutorisees}
          ton={sortiesAutorisees > 0 ? 'warn' : 'ok'}
          detail={`sur ${REGLES_ROUTAGE.length} règles`}
        />
        <StatTile
          libelle="Garde-fous actifs"
          valeur={Object.values(gardes).filter(Boolean).length}
          detail={`sur ${GARDE_FOUS.length} disponibles`}
          ton="ok"
        />
      </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Règles, dans l’ordre d’évaluation"
              sousTitre="La première règle qui correspond gagne. Une requête qui n’en satisfait aucune part sur le modèle par défaut de sa clé."
              actions={
                <GatedAction autorise={peutModifier} message={refus('ia.routing.update')}>
                  <Button
                    size="sm"
                    variant="secondary"
                    iconBefore={<Plus size={13} />}
                    disabled
                    title="La création d’une règle de routage n’a pas encore de contrepartie côté backend — cette liste reste fixe pour l’instant."
                  >
                    Ajouter une règle
                  </Button>
                </GatedAction>
              }
            />
            <div className="space-y-2.5">
              {REGLES_ROUTAGE.map((r, i) => {
                const cible = modeleParSlug(r.cible)
                const actif = regles[r.id]
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'rounded-[8px] border px-3.5 py-3',
                      actif ? 'border-g-300 bg-white' : 'border-g-300 bg-g-050',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-p-050 text-[12px] font-bold text-p-700">
                          {r.ordre}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block text-[13px] font-semibold',
                              actif ? 'text-ink' : 'text-g-500',
                            )}
                          >
                            {r.nom}
                          </span>
                          <span className="block text-[12px] text-g-500">{r.quand}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {r.residenceImposee && (
                          <Badge tone="ok" size="sm">
                            <Lock size={10} className="mr-1 inline" aria-hidden />
                            Territoire imposé
                          </Badge>
                        )}
                        <GatedAction autorise={peutModifier} message={refus('ia.routing.update')}>
                          <IconButton
                            label={`Remonter la règle ${r.nom}`}
                            variant="ghost"
                            size="sm"
                            disabled
                            title="Réordonner les règles n’a pas encore de contrepartie côté backend."
                          >
                            <ArrowUp size={13} />
                          </IconButton>
                        </GatedAction>
                        <GatedAction autorise={peutModifier} message={refus('ia.routing.update')}>
                          <IconButton
                            label={`Descendre la règle ${r.nom}`}
                            variant="ghost"
                            size="sm"
                            disabled
                            title="Réordonner les règles n’a pas encore de contrepartie côté backend."
                          >
                            <ArrowDown size={13} />
                          </IconButton>
                        </GatedAction>
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-g-100 pt-2.5">
                      <MicroLabel>Chaîne</MicroLabel>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={cible?.hebergement === 'souverain' ? 'ok' : 'warn'} size="sm">
                          {cible?.nom ?? r.cible}
                        </Badge>
                        {r.repli.map((slug) => {
                          const m = modeleParSlug(slug)
                          return (
                            <span key={slug} className="flex items-center gap-1.5">
                              <ArrowRight size={11} className="text-g-500" aria-hidden />
                              <Badge tone={m?.hebergement === 'souverain' ? 'neutral' : 'warn'} size="sm">
                                {m?.nom ?? slug}
                              </Badge>
                            </span>
                          )
                        })}
                        {r.repli.length === 0 && (
                          <span className="text-[12px] text-g-500">
                            Aucun repli — l’appel échoue en 503 si le modèle est indisponible
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                      <span className="tnum text-[12px] text-g-500">
                        {num(r.requetes24h)} requêtes en 24 h ·{' '}
                        {r.replisDeclenches24h > 0
                          ? `${num(r.replisDeclenches24h)} replis`
                          : 'aucun repli'}
                      </span>
                      <GatedAction autorise={peutModifier} message={refus('ia.routing.update')}>
                        <Switch
                          checked={actif}
                          onChange={(v) => {
                            setRegles((s) => ({ ...s, [r.id]: v }))
                            pousser({
                              ton: v ? 'ok' : 'warn',
                              titre: v ? 'Règle activée' : 'Règle désactivée',
                              detail: r.nom,
                            })
                          }}
                          label="Active"
                        />
                      </GatedAction>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Callout ton="violet" titre="Ce qu’un repli change, et ce qu’il ne change pas">
            Basculer sur un autre modèle rétablit le service, pas la qualité : les réponses changent
            de style, parfois de format. Si votre application analyse la sortie, testez-la avec chaque
            modèle de la chaîne, pas seulement avec le premier. Un repli non éprouvé n’est pas un
            repli, c’est une panne différée.
          </Callout>
        </div>
    </div>
  )
}
