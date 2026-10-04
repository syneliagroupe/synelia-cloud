'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { num, pct } from '@/lib/format'
import { CLASSE_DONNEES_LABEL, LIEUX_HEBERGEMENT, type ModeleIA } from '@/lib/types'
import { GARDE_FOUS, MATRICE_RESIDENCE, MODELES_IA, REGLES_ROUTAGE, modeleParSlug } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { AvisDemoApi } from '../../avis-demo'

const LIBELLE_ACTION = {
  bloquer: 'Bloque la requête',
  masquer: 'Masque avant l’appel',
  journaliser: 'Journalise seulement',
} as const

const TON_ACTION = { bloquer: 'err', masquer: 'violet', journaliser: 'info' } as const

const LIBELLE_SENS = { entree: 'Entrée', sortie: 'Sortie', les_deux: 'Entrée et sortie' } as const

export default function ResidenceDonnees() {
  const { autorise, refus, pousser } = useApp()
  const [regles, setRegles] = useState(() =>
    Object.fromEntries(REGLES_ROUTAGE.map((r) => [r.id, r.actif])),
  )
  const [gardes, setGardes] = useState(() =>
    Object.fromEntries(GARDE_FOUS.map((g) => [g.id, g.actif])),
  )

  const modeles = useCollection<ModeleIA>('modeles-ia', MODELES_IA).items
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
          { label: 'Résidence des données' },
        ]}
        titre="Résidence des données"
        sousTitre="Où chaque classe de données a le droit d’être traitée. Cette politique prime sur les règles de routage : une règle qui la contredirait est refusée à l’enregistrement."
      />

      <AvisDemoApi>
        Les compteurs ci-dessous sont des exemples. Le tableau de résidence, lui, est la politique de
        la plateforme : chaque clé d’accès porte une résidence maximale que la passerelle fait
        respecter à chaque appel.
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
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3">
              <CardHeader
                titre="Où chaque classe de données a le droit d’être traitée"
                sousTitre="Un croisement entre la classe de la requête et la juridiction du modèle appelé."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    <th className="type-micro px-4 py-2.5 text-g-500">Classe</th>
                    <th className="type-micro px-4 py-2.5 text-g-500">Exemples</th>
                    <th className="type-micro px-4 py-2.5 text-center text-g-500">Territoire</th>
                    <th className="type-micro px-4 py-2.5 text-center text-g-500">Union européenne</th>
                    <th className="type-micro px-4 py-2.5 text-center text-g-500">Hors UE</th>
                  </tr>
                </thead>
                <tbody>
                  {MATRICE_RESIDENCE.map((l) => (
                    <tr key={l.classe} className="border-b border-g-100 last:border-0">
                      <td className="px-4 py-3">
                        <span className="block text-[13px] font-semibold text-ink">
                          {CLASSE_DONNEES_LABEL[l.classe]}
                        </span>
                        <span className="block text-[11px] text-g-500">{l.note}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-g-500">{l.exemples}</td>
                      {[l.souverain, l.ue, l.horsUe].map((permis, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          <Badge tone={permis ? 'ok' : 'err'} size="sm">
                            {permis ? 'Autorisé' : 'Refusé'}
                          </Badge>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Modèles concernés"
                sousTitre="Ce que la politique autorise, modèle par modèle."
              />
              <div className="space-y-1.5">
                {modeles.filter((m) => m.statut !== 'retire').map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-g-100 pb-1.5 last:border-0"
                  >
                    <span className="min-w-0 truncate text-[13px] text-ink">{m.nom}</span>
                    <Badge tone={m.hebergement === 'souverain' ? 'ok' : 'warn'} size="sm">
                      {m.hebergement === 'souverain'
                        ? 'Toutes classes'
                        : m.residence.startsWith('Union') || m.residence.startsWith('France')
                          ? 'Publique et interne'
                          : 'Publique seulement'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <Callout ton="ok" titre="Ce que « souverain » veut dire ici">
                Le calcul a lieu sur des serveurs que nous exploitons, à {LIEUX_HEBERGEMENT}, sous droit
                ivoirien. Les poids des modèles sont ouverts et téléchargés une fois : aucun appel
                sortant n’est nécessaire pour servir une requête. Ce n’est pas le cas des modèles
                externes, quelle que soit leur juridiction.
              </Callout>
              <Callout
                ton="info"
                titre="Trajectoire publiée"
                action={
                  <ButtonLink size="sm" variant="secondary" href="/souverainete">
                    Voir la trajectoire
                  </ButtonLink>
                }
              >
                La part de trafic traitée sur le territoire, la liste des sous-traitants étrangers et
                le calendrier de sortie sont publiés sur la page souveraineté du site. Nous
                n’affirmons pas que rien ne sort : nous publions ce qui sort, vers où, et pourquoi.
              </Callout>
            </div>
          </div>
        </div>
    </div>
  )
}
