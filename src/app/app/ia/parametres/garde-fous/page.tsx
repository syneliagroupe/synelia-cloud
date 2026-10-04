'use client'

import { useState } from 'react'
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
import { AvisDemoApi } from '../../avis-demo'
import { useApp } from '@/components/app/contexte'

const LIBELLE_ACTION = {
  bloquer: 'Bloque la requête',
  masquer: 'Masque avant l’appel',
  journaliser: 'Journalise seulement',
} as const

const TON_ACTION = { bloquer: 'err', masquer: 'violet', journaliser: 'info' } as const

const LIBELLE_SENS = { entree: 'Entrée', sortie: 'Sortie', les_deux: 'Entrée et sortie' } as const

export default function GardeFousReglages() {
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
          { label: 'Garde-fous' },
        ]}
        titre="Garde-fous"
        sousTitre="Ce qui filtre les requêtes avant et après l’appel au modèle, sur toutes les clés de l’organisation. La consigne oriente ; ces filtres empêchent."
      />

      <AvisDemoApi>
        Les garde-fous ci-dessous sont un jeu d’exemple : aucun filtre d’entrée ou de sortie n’est encore branché sur la passerelle, et les compteurs des 24 dernières heures n’existent pas côté API.
      </AvisDemoApi>

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
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {GARDE_FOUS.map((g) => (
              <Card key={g.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-ink">{g.nom}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={TON_ACTION[g.action]} size="sm">
                        {LIBELLE_ACTION[g.action]}
                      </Badge>
                      <Badge tone="neutral" size="sm">
                        {LIBELLE_SENS[g.sens]}
                      </Badge>
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-right">
                    <span className="block text-[15px] font-bold text-ink">
                      {num(g.declenchements24h)}
                    </span>
                    <span className="type-micro block text-g-500">déclenchements 24 h</span>
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-g-500">{g.description}</p>
                <div className="mt-3 border-t border-g-100 pt-3">
                  <GatedAction autorise={peutModifier} message={refus('ia.routing.update')}>
                    <Switch
                      checked={gardes[g.id]}
                      onChange={(v) => setGardes((s) => ({ ...s, [g.id]: v }))}
                      label={gardes[g.id] ? 'Appliqué à toutes les clés' : 'Inactif'}
                    />
                  </GatedAction>
                </div>
              </Card>
            ))}
          </div>

          <Callout ton="warn" titre="Un garde-fou se paie en faux positifs">
            Le filtre de secrets refuse vingt-sept requêtes légitimes par jour, souvent des extraits
            de configuration collés dans un ticket. C’est le prix à payer pour qu’une chaîne de
            connexion ne parte jamais chez un fournisseur étranger. Le désactiver retire la
            protection : il n’y a pas de réglage intermédiaire qui garde l’un sans l’autre.
          </Callout>
        </div>
    </div>
  )
}
