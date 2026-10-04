'use client'

import { jetons, money, num, pct } from '@/lib/format'
import {
  AGENTS_PLATEFORME,
  FLOTTE_MODELES,
  SYNTHESE_AGENTS_PLATEFORME,
  SYNTHESE_IA_PLATEFORME,
  modeleParSlug,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'
import { ORGANISATIONS } from '@/lib/mock'
import type { Organisation } from '@/lib/types'

interface ReelIA {
  jetons: number
  organisations: Array<{
    org: string
    agents: number
    publies: number
    flux: number
    cles: number
    jetons: number
  }>
  modeles: Array<{ slug: string; nom: string; hebergement: string; agents: number }>
}

export default function IaPlateforme() {
  const s = SYNTHESE_IA_PLATEFORME
  const api = estActif()
  // `orgsActives` de la graine (41) dépassait le total réel d'organisations
  // (20, vu sur `/admin/organisations`) — on relit la collection réelle plutôt
  // que d'inventer un sous-ensemble « actif IA » qui n'existe pas côté API.
  const orgs = useCollection<Organisation>('organisations', ORGANISATIONS)
  const orgsActives = api ? orgs.items.length : s.orgsActives
  const { donnees: reel } = useLectureDegradable<ReelIA>('/admin/ia')
  const totalAgents = reel?.organisations.reduce((t, o) => t + o.agents, 0) ?? 0
  const totalPublies = reel?.organisations.reduce((t, o) => t + o.publies, 0) ?? 0
  const totalFlux = reel?.organisations.reduce((t, o) => t + o.flux, 0) ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'IA & Agents' }]}
        titre="IA & Agents — vue plateforme"
        sousTitre="Aucun GPU à administrer : le calcul IA est entièrement délégué à la passerelle LiteLLM, en amont d’OpenRouter, facturé au jeton. Ce qui suit décrit l’usage — modèles appelés, agents publiés — pas une capacité matérielle."
      />

      <Callout ton="info" titre="Pas de parc GPU sur cette plateforme">
        Contrairement à un hébergeur qui réserverait des cartes pour un client, Synelia Cloud n’achète
        ni ne loue de GPU : chaque appel de modèle part vers OpenRouter via la passerelle LiteLLM,
        avec une clé d’inférence standard, pas une clé de provisionnement. Il n’y a donc rien à dimensionner, à
        mettre en veille ou à remplacer sous garantie côté matériel.
      </Callout>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {api ? (
          <>
            <StatTile
              libelle="Jetons consommés"
              valeur={jetons(reel?.jetons ?? 0)}
              detail="Somme des compteurs des clés IA"
            />
            <StatTile
              libelle="Organisations utilisatrices"
              valeur={reel?.organisations.length ?? 0}
              detail={`sur ${orgsActives} organisation${orgsActives > 1 ? 's' : ''}`}
            />
            <StatTile
              libelle="Agents"
              valeur={totalAgents}
              detail={`${totalPublies} publiés · ${totalFlux} flux`}
            />
          </>
        ) : (
          <>
        <StatTile
          libelle="Jetons appelés 30 j"
          valeur={jetons(s.jetons30j)}
          detail={`${pct(s.partSouverainePct, 1)} sur les modèles marqués souverains`}
        />
        <StatTile
          libelle="Chiffre d’affaires IA"
          valeur={money(s.caIaMensuel)}
          ton="ok"
          detail={api ? 'Démonstration — pas encore une lecture réelle' : undefined}
        />
        <StatTile libelle="Organisations actives" valeur={orgsActives} />
          </>
        )}
      </div>

      <Card>
        <CardHeader
          titre="Modèles appelés"
          sousTitre={
            api
              ? 'Catalogue des modèles et nombre d’agents qui les utilisent, toutes organisations.'
              : 'Volume par modèle sur l’ensemble de la plateforme, tous clients confondus — pas de notion de réplica ou de carte, uniquement des appels à la passerelle.'
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-g-300">
                <th className="type-micro py-2 text-g-500">Modèle</th>
                <th className="type-micro py-2 text-right text-g-500">{api ? 'Hébergement' : 'Orgs'}</th>
                <th className="type-micro py-2 text-right text-g-500">{api ? 'Agents' : 'Jetons 30 j'}</th>
                {!api && <th className="type-micro py-2 text-right text-g-500">Part du trafic IA</th>}
              </tr>
            </thead>
            <tbody>
              {api &&
                (reel?.modeles ?? []).map((m) => (
                  <tr key={m.slug} className="border-b border-g-100 last:border-0">
                    <td className="py-2.5 text-[12.5px] text-ink">{m.nom}</td>
                    <td className="py-2.5 text-right text-[12.5px] text-g-700">{m.hebergement}</td>
                    <td className="tnum py-2.5 text-right text-[12.5px] text-g-700">{m.agents}</td>
                  </tr>
                ))}
              {(api ? [] : FLOTTE_MODELES).map((m) => (
                <tr key={m.slug} className="border-b border-g-100 last:border-0">
                  <td className="py-2.5 text-[12.5px] text-ink">
                    {modeleParSlug(m.slug)?.nom ?? m.slug}
                  </td>
                  <td className="tnum py-2.5 text-right text-[12.5px] text-g-700">{m.orgs}</td>
                  <td className="tnum py-2.5 text-right text-[12.5px] text-g-700">
                    {m.jetons30j > 0 ? jetons(m.jetons30j) : '—'}
                  </td>
                  <td className="py-2.5 text-right">
                    <Badge
                      tone={m.utilisationPct > 85 ? 'warn' : m.utilisationPct < 30 ? 'neutral' : 'ok'}
                      size="sm"
                    >
                      {pct(m.utilisationPct)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          titre="Agents et orchestration"
          sousTitre={
            api
              ? 'Agents, flux et clés IA par organisation.'
              : 'La consommation ne vient plus seulement d’appels directs : deux tiers des jetons servis passent aujourd’hui par un agent ou un flux, ce qui change la nature de la charge — plus de petits appels enchaînés, moins de gros appels isolés.'
          }
        />
        {!api && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            libelle="Agents déployés"
            valeur={SYNTHESE_AGENTS_PLATEFORME.agents}
            detail={`${SYNTHESE_AGENTS_PLATEFORME.publies} publiés`}
          />
          <StatTile
            libelle="Flux d’orchestration"
            valeur={SYNTHESE_AGENTS_PLATEFORME.flux}
            detail={`${num(SYNTHESE_AGENTS_PLATEFORME.executions30j)} exécutions sur 30 j`}
          />
          <StatTile
            libelle="Trafic orchestré"
            valeur={pct(SYNTHESE_AGENTS_PLATEFORME.partOrchestreePct, 1)}
            ton="ok"
            detail="Part des jetons issus d’un agent"
          />
          <StatTile
            libelle="Outils déclarés"
            valeur={SYNTHESE_AGENTS_PLATEFORME.outilsDeclares}
            detail={`dont ${SYNTHESE_AGENTS_PLATEFORME.serveursMcp} serveurs MCP`}
          />
        </div>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-g-300 bg-g-050">
                <th className="type-micro px-3 py-2.5 text-g-500">Organisation</th>
                <th className="type-micro px-3 py-2.5 text-right text-g-500">Agents</th>
                <th className="type-micro px-3 py-2.5 text-right text-g-500">Publiés</th>
                <th className="type-micro px-3 py-2.5 text-right text-g-500">Flux</th>
                <th className="type-micro px-3 py-2.5 text-right text-g-500">
                  {api ? 'Jetons consommés' : 'Exécutions 30 j'}
                </th>
                <th className="type-micro px-3 py-2.5 text-g-500">{api ? 'Clés IA' : 'Canaux ouverts'}</th>
              </tr>
            </thead>
            <tbody>
              {(api
                ? (reel?.organisations ?? []).map((o) => ({
                    ...o,
                    executions30j: o.jetons,
                    canaux: String(o.cles),
                  }))
                : AGENTS_PLATEFORME
              ).map((o) => (
                <tr key={o.org} className="border-b border-g-100 last:border-0">
                  <td className="px-3 py-3 text-[12.5px] font-semibold text-ink">{o.org}</td>
                  <td className="tnum px-3 py-3 text-right text-[12.5px] text-g-700">{o.agents}</td>
                  <td className="tnum px-3 py-3 text-right text-[12.5px] text-g-700">{o.publies}</td>
                  <td className="tnum px-3 py-3 text-right text-[12.5px] text-g-700">{o.flux}</td>
                  <td className="tnum px-3 py-3 text-right text-[12.5px] font-semibold text-ink">
                    {num(o.executions30j)}
                  </td>
                  <td className="px-3 py-3 text-[11.5px] text-g-500">{o.canaux}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {api && (reel?.organisations.length ?? 0) === 0 && (
          <p className="mt-3 rounded-[6px] border border-dashed border-g-300 px-3 py-4 text-center text-[12px] text-g-500">
            Aucune organisation n’a encore créé d’agent, de flux ni de clé IA.
          </p>
        )}
        {!api && (
        <Callout ton="warn" className="mt-4" titre="Vingt-et-un agents créés ne sont jamais publiés">
          Sur 43 agents, 13 restent en brouillon — pour la plupart parce que leur jeu d’épreuves ne
          passe pas le seuil de 80 %. C’est le garde-fou qui fonctionne, mais c’est aussi une
          promesse commerciale non tenue chez le client. Un accompagnement sur la constitution des
          jeux d’épreuves aurait plus d’effet sur l’adoption que n’importe quelle remise.
        </Callout>
        )}
      </Card>

      <Callout ton="violet" titre="Souverain ou externe reste un choix de résidence, pas d’hébergement">
        Le champ « hébergement » d’un modèle (souverain / externe) régit la politique de résidence des
        données — quelle classe de données peut partir vers quel modèle — pas une infrastructure GPU
        que la plateforme posséderait. Les deux catégories passent aujourd’hui par la même passerelle
        OpenRouter ; « souverain » désigne les modèles dont l’éditeur ou le point de présence est jugé
        acceptable pour des données sensibles, pas un GPU maison.
      </Callout>
    </div>
  )
}
