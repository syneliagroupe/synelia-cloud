'use client'

import Link from 'next/link'
import { ArrowRight, FileDown, Plus } from 'lucide-react'
import { dateCourte, dureeMin, pct } from '@/lib/format'
import { SITE_COURT, SITE_LABEL } from '@/lib/types'
import { DR_PLANS } from '@/lib/mock'
import type { DRPlan } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DrPlanSummary } from '@/components/business/infra'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire } from '@/components/app/actions'

export default function ListePra() {
  const plans = useCollection<DRPlan>('plans-pra', DR_PLANS)
  const DR_PLANS_ITEMS = plans.items
  const testes = DR_PLANS_ITEMS.filter((p) => p.exercices.length > 0)
  const dernier = testes.flatMap((p) => p.exercices).sort((a, b) => b.date.localeCompare(a.date))[0]
  const conformes = DR_PLANS_ITEMS.filter(
    (p) => p.rtoConstateMin > 0 && p.rtoConstateMin <= p.rtoCibleMin,
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Plan de reprise (PRA)' }]}
        titre="Plan de reprise"
        sousTitre="Un plan de reprise qui n’a jamais été exercé n’est pas un plan, c’est une intention. Nous affichons systématiquement la cible et le constaté côte à côte, et nous exerçons vos plans trimestriellement en réseau isolé."
        actions={
          <BoutonFormulaire
            libelle="Nouveau plan de reprise"
            icone={<Plus size={14} />}
            variant="primary"
            action="dr.failover.test"
            titre="Créer un plan de reprise"
            description="Le site source et le site de repli, les cibles de RPO et de RTO. L’ordre de démarrage et les ressources répliquées se composent ensuite depuis la fiche du plan."
            champs={[
              { id: 'nom', label: 'Nom du plan', placeholder: 'ERP · reprise Grand-Bassam', obligatoire: true },
              {
                id: 'siteSource',
                label: 'Site source',
                type: 'select',
                options: [
                  { value: 'ABJ', label: SITE_LABEL.ABJ },
                  { value: 'GBM', label: SITE_LABEL.GBM },
                ],
              },
              {
                id: 'siteRepli',
                label: 'Site de repli',
                type: 'select',
                options: [
                  { value: 'GBM', label: SITE_LABEL.GBM },
                  { value: 'ABJ', label: SITE_LABEL.ABJ },
                ],
              },
              { id: 'rpoCibleMin', label: 'RPO cible (minutes)', type: 'nombre', min: 1, demi: true },
              { id: 'rtoCibleMin', label: 'RTO cible (minutes)', type: 'nombre', min: 1, demi: true },
            ]}
            valeursDepart={{ rpoCibleMin: 15, rtoCibleMin: 60 }}
            libelleValider="Créer le plan"
            operation={(v) => ({
              titre: `Plan « ${v.nom} » créé`,
              detail: 'Composez l’ordre de démarrage et les groupes de ressources depuis la fiche du plan.',
              effet: () =>
                plans.creer({
                  id: plans.identifiant('pra'),
                  orgId: 'org-dba',
                  nom: String(v.nom),
                  siteSource: v.siteSource as DRPlan['siteSource'],
                  siteRepli: v.siteRepli as DRPlan['siteRepli'],
                  rpoCibleMin: Number(v.rpoCibleMin),
                  rpoConstateMin: 0,
                  rtoCibleMin: Number(v.rtoCibleMin),
                  rtoConstateMin: 0,
                  groupes: [],
                  replication: { mode: 'planifie', retardS: 0 },
                  exercices: [],
                  statut: 'jamais_teste',
                }),
            })}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile libelle="Plans de reprise" valeur={DR_PLANS_ITEMS.length} />
        <StatTile
          libelle="Conformes au RTO"
          valeur={`${conformes}/${DR_PLANS_ITEMS.length}`}
          ton={conformes === DR_PLANS_ITEMS.length ? 'ok' : 'warn'}
        />
        <StatTile
          libelle="Exercices réalisés"
          valeur={testes.flatMap((p) => p.exercices).length}
          detail={dernier ? `Dernier le ${dateCourte(dernier.date)}` : 'Aucun exercice'}
        />
        <StatTile
          libelle="Plans jamais testés"
          valeur={DR_PLANS_ITEMS.filter((p) => p.exercices.length === 0).length}
          ton={DR_PLANS_ITEMS.some((p) => p.exercices.length === 0) ? 'warn' : 'ok'}
        />
      </div>

      <div className="space-y-4">
        {DR_PLANS_ITEMS.map((plan) => (
          <div key={plan.id} className="space-y-2">
            <DrPlanSummary plan={plan} />
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <span className="flex flex-wrap items-center gap-2 text-[12px] text-g-500">
                <Badge tone="neutral" size="sm">
                  {SITE_COURT[plan.siteSource]} → {SITE_COURT[plan.siteRepli]}
                </Badge>
                <span>
                  {plan.groupes.length} groupes de démarrage ·{' '}
                  {plan.groupes.reduce((a, g) => a + g.ressources.length, 0)} ressources
                </span>
              </span>
              <Link
                href={`/app/pra/${plan.id}`}
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-p-700 hover:text-m-600"
              >
                Ouvrir le plan
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          titre="Historique des exercices"
          sousTitre="Chaque exercice produit un rapport daté, téléchargeable, opposable à un auditeur."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-g-300 bg-g-050">
                {['Date', 'Plan', 'Type', 'Durée', 'RTO constaté', 'Cible', 'Résultat', 'Rapport'].map(
                  (h) => (
                    <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {DR_PLANS_ITEMS.flatMap((p) =>
                p.exercices.map((e) => ({ ...e, plan: p.nom, cible: p.rtoCibleMin })),
              )
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((e) => (
                  <tr key={`${e.plan}-${e.date}`} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2.5 text-[12.5px] text-ink">{dateCourte(e.date)}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-g-700">{e.plan}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={e.type === 'reel' ? 'err' : 'info'} size="sm">
                        {e.type === 'reel' ? 'Bascule réelle' : 'Bascule de test'}
                      </Badge>
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                      {dureeMin(e.dureeMin)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12.5px] font-semibold">
                      <span
                        className={e.rtoConstateMin <= e.cible ? 'text-ok' : 'text-err'}
                      >
                        {dureeMin(e.rtoConstateMin)}
                      </span>
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                      {dureeMin(e.cible)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={e.succes ? 'ok' : 'err'} dot size="sm">
                        {e.succes ? 'Réussi' : 'Échoué'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={e.rapportUrl}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-p-700 hover:text-m-600"
                      >
                        <FileDown size={12} />
                        Télécharger
                      </a>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(() => {
        // Deux exemples illustratifs, calculés depuis les vrais plans plutôt que
        // nommés en dur : un plan conforme récemment exercé, et un plan jamais
        // testé. L'un ou l'autre — voire aucun — peut manquer sur une petite
        // organisation, donc chaque bloc ne s'affiche que s'il a une donnée réelle
        // à montrer.
        const planConforme = DR_PLANS_ITEMS.find(
          (p) => p.exercices.length > 0 && p.rtoConstateMin > 0 && p.rtoConstateMin <= p.rtoCibleMin,
        )
        const planJamaisTeste = DR_PLANS_ITEMS.find((p) => p.exercices.length === 0)
        if (!planConforme && !planJamaisTeste) return null
        return (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {planConforme && (
              <Callout ton="ok" titre={`${planConforme.nom} : les chiffres tiennent`}>
                RPO constaté de {dureeMin(planConforme.rpoConstateMin)} pour une cible de{' '}
                {dureeMin(planConforme.rpoCibleMin)}, RTO constaté de{' '}
                {dureeMin(planConforme.rtoConstateMin)} pour une cible de{' '}
                {dureeMin(planConforme.rtoCibleMin)}.
              </Callout>
            )}
            {planJamaisTeste && (
              <Callout ton="warn" titre={`${planJamaisTeste.nom} n’a jamais été exercé`}>
                Le plan est configuré, mais aucune bascule de test n’a été menée : le RTO de{' '}
                {dureeMin(planJamaisTeste.rtoCibleMin)} affiché est donc théorique. Une bascule de
                test en réseau isolé n’a aucun impact sur votre production — c’est précisément ce qui
                permet de l’exercer souvent.
              </Callout>
            )}
          </div>
        )
      })()}
    </div>
  )
}
