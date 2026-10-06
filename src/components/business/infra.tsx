'use client'

import { useState } from 'react'
import { AlertTriangle, Plus, Server } from 'lucide-react'
import { cn, clamp } from '@/lib/utils'
import { dateCourte, dureeMin, num, pct, toHumain } from '@/lib/format'
import { BACKEND_LABEL, SITE_COURT, UN_SEUL_SITE, trajetSites, type Backend, type DRPlan } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { HealthBadge, QuotaBar } from '@/components/composition/metrics'
import { BoutonAction } from '@/components/app/actions'

/** Jauge d'un backend de la plateforme — visible côté super admin seulement. */
export function BackendGauge({
  backend,
  compact,
  className,
}: {
  backend: Backend
  compact?: boolean
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-p-050 text-p-700">
            <Server size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="type-h3 font-mono">{backend.code}</h3>
            <p className="mt-0.5 text-[12px] text-g-500">
              {BACKEND_LABEL[backend.type]} · {SITE_COURT[backend.site]} · {backend.hosts} hôte{backend.hosts > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <HealthBadge etat={backend.statut} size="sm" />
      </div>

      <div className="mt-3.5 space-y-2.5">
        <QuotaBar
          libelle="vCPU"
          utilise={Math.round((backend.capacite.vcpu * backend.usage.vcpuPct) / 100)}
          total={backend.capacite.vcpu}
          formateur={(v) => num(v)}
          compact
        />
        <QuotaBar
          libelle="Mémoire"
          utilise={Math.round((backend.capacite.ramGo * backend.usage.ramPct) / 100)}
          total={backend.capacite.ramGo}
          unite="Go"
          formateur={(v) => num(v)}
          compact
        />
        <QuotaBar
          libelle="Stockage"
          utilise={(backend.capacite.stockageTo * backend.usage.stockagePct) / 100}
          total={backend.capacite.stockageTo}
          formateur={toHumain}
          compact
        />
      </div>

      {!compact && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-g-100 pt-3">
          <Badge tone={backend.souverain ? 'ok' : 'warn'} size="sm">
            {backend.souverain ? 'Socle open source' : 'Socle propriétaire'}
          </Badge>
          {backend.enSortie?.actif && (
            <Badge tone="info" size="sm">
              En sortie · cible {dateCourte(backend.enSortie.cibleMigration)}
            </Badge>
          )}
          {backend.saturation && (
            <span className="tnum text-[12px] text-g-500">
              Saturation projetée à 90 j : {pct(backend.saturation.j90)}
            </span>
          )}
        </div>
      )}
    </Card>
  )
}

/**
 * Répartition en pourcentage d'un Espace Cloud entre plusieurs backends,
 * somme contrainte à 100 % (§8.4). Écran super admin uniquement.
 */
export function PlacementSlider({
  backends,
  initial,
  onChange,
  onAppliquer,
  className,
}: {
  backends: Backend[]
  initial: Array<{ backendId: string; percent: number }>
  /** Remonte la répartition en cours de saisie — l'écran l'applique ensuite. */
  onChange?: (parts: Array<{ backendId: string; percent: number }>) => void
  /** Appelé à la fin du job de rééquilibrage, pour persister la répartition. */
  onAppliquer?: (parts: Array<{ backendId: string; percent: number }>) => void
  className?: string
}) {
  const [parts, setParts] = useState(initial)

  const poser = (suite: Array<{ backendId: string; percent: number }>) => {
    setParts(suite)
    onChange?.(suite)
  }
  const somme = parts.reduce((a, p) => a + p.percent, 0)
  const modifie = JSON.stringify(parts) !== JSON.stringify(initial)

  const ajuster = (backendId: string, valeur: number) => {
    const calculer = (prev: Array<{ backendId: string; percent: number }>) => {
      const cible = clamp(valeur, 0, 100)
      const autres = prev.filter((p) => p.backendId !== backendId)
      const resteACaser = 100 - cible
      const sommeAutres = autres.reduce((a, p) => a + p.percent, 0)
      const recalcules = autres.map((p, i) => ({
        ...p,
        percent:
          sommeAutres === 0
            ? Math.round(resteACaser / Math.max(1, autres.length))
            : i === autres.length - 1
              ? resteACaser -
                autres
                  .slice(0, -1)
                  .reduce((a, q) => a + Math.round((q.percent / sommeAutres) * resteACaser), 0)
              : Math.round((p.percent / sommeAutres) * resteACaser),
      }))
      return prev.map((p) =>
        p.backendId === backendId
          ? { ...p, percent: cible }
          : recalcules.find((r) => r.backendId === p.backendId)!,
      )
    }
    poser(calculer(parts))
  }

  const ajouter = () => {
    const dispo = backends.find((b) => !parts.some((p) => p.backendId === b.id))
    if (!dispo) return
    poser([
      ...parts.map((p) => ({ ...p, percent: Math.round((p.percent * (100 - 10)) / 100) })),
      { backendId: dispo.id, percent: 10 },
    ])
  }

  return (
    <div className={cn('space-y-3.5', className)}>
      {parts.map((p) => {
        const b = backends.find((x) => x.id === p.backendId)
        if (!b) return null
        return (
          <div key={p.backendId}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-g-700">
                <span className="font-mono">{b.code}</span>
                <span className="ml-1.5 font-normal text-g-500">{BACKEND_LABEL[b.type]}</span>
              </span>
              <span className="tnum text-[13px] font-bold text-p-700">{pct(p.percent)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={p.percent}
              onChange={(e) => ajuster(p.backendId, Number(e.target.value))}
              aria-label={`Part de ${b.code}`}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-p-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-p-700"
              style={{
                background: `linear-gradient(to right, var(--color-p-700) ${p.percent}%, var(--color-g-300) ${p.percent}%)`,
              }}
            />
          </div>
        )
      })}

      <div className="flex items-center justify-between gap-3 border-t border-g-100 pt-3">
        <span
          className={cn(
            'tnum text-[13px] font-semibold',
            somme === 100 ? 'text-ok' : 'text-err',
          )}
        >
          Somme : {pct(somme)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          iconBefore={<Plus size={13} />}
          onClick={ajouter}
          disabled={parts.length >= backends.length}
        >
          Ajouter un backend
        </Button>
      </div>

      {modifie && (
        <Callout ton="warn" titre="Cette répartition implique un rééquilibrage de charge">
          Appliquer entraînera la migration à chaud de machines entre hyperviseurs. L’opération est
          transparente pour le client mais consomme de la bande passante inter-hôtes pendant sa durée.
        </Callout>
      )}

      <BoutonAction
        libelle="Appliquer la répartition"
        variant="primary"
        size="md"
        fullWidth
        desactive={somme !== 100 || !modifie}
        operation={{
          action: 'capacity.manage',
          ton: 'info',
          titre: 'Rééquilibrage de charge lancé',
          detail: 'Migration à chaud des machines entre hyperviseurs, transparente pour le client.',
          job: { workflow: 'capacite.rebalance', cible: 'la répartition entre backends' },
          effetFinal: () => onAppliquer?.(parts),
        }}
      />
    </div>
  )
}

/**
 * Jauge RPO / RTO — cible et constaté côte à côte.
 * Composant le plus important du module PRA (§4.7).
 */
export function RpoRtoGauge({
  libelle,
  cibleMin,
  constateMin,
  className,
}: {
  libelle: string
  cibleMin: number
  constateMin: number
  className?: string
}) {
  const conforme = constateMin > 0 && constateMin <= cibleMin
  const jamaisMesure = !constateMin
  const ratio = jamaisMesure ? 0 : clamp((constateMin / cibleMin) * 100, 0, 140)

  return (
    <div className={cn('rounded-[8px] border border-g-300 bg-white p-3.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="type-micro text-g-500">{libelle}</span>
        <Badge tone={jamaisMesure ? 'warn' : conforme ? 'ok' : 'err'} size="sm">
          {jamaisMesure ? 'Jamais mesuré' : conforme ? 'Conforme' : 'Hors cible'}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-g-500">Cible</p>
          <p className="tnum mt-0.5 text-[17px] font-bold [font-family:var(--font-display)] text-g-700">
            {dureeMin(cibleMin)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-g-500">Constaté</p>
          <p
            className={cn(
              'tnum mt-0.5 text-[17px] font-bold [font-family:var(--font-display)]',
              jamaisMesure ? 'text-g-500' : conforme ? 'text-ok' : 'text-err',
            )}
          >
            {jamaisMesure ? '—' : dureeMin(constateMin)}
          </p>
        </div>
      </div>

      <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-g-100">
        <div
          className={cn('h-full rounded-full', conforme ? 'bg-ok' : 'bg-err')}
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
        <span className="absolute top-0 h-full w-[1.5px] bg-p-700" style={{ left: '100%' }} />
      </div>
      <p className="mt-1.5 text-[11px] text-g-500">
        {jamaisMesure
          ? 'Aucun exercice n’a encore été mené sur ce plan.'
          : `${pct(Math.round(ratio))} de la cible contractuelle.`}
      </p>
    </div>
  )
}

/** Jauge SLA — disponibilité constatée face à l'engagement (§7.5). */
export function SlaGauge({
  composant,
  engagement,
  constate,
  className,
}: {
  composant: string
  engagement: number
  constate: number
  className?: string
}) {
  const conforme = constate >= engagement
  const min = Math.min(engagement, constate) - 0.15
  const etendue = 100 - min || 1

  return (
    <div className={cn('rounded-[8px] border border-g-300 bg-white p-3.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-g-700">{composant}</span>
        <span
          className={cn('tnum text-[13px] font-bold', conforme ? 'text-ok' : 'text-err')}
        >
          {pct(constate, 2)}
        </span>
      </div>
      <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-g-100">
        <div
          className={cn('h-full rounded-full', conforme ? 'bg-ok' : 'bg-err')}
          style={{ width: `${((constate - min) / etendue) * 100}%` }}
        />
        <span
          className="absolute top-0 h-full w-[1.5px] bg-p-700"
          style={{ left: `${((engagement - min) / etendue) * 100}%` }}
          title={`Engagement ${engagement} %`}
        />
      </div>
      <p className="tnum mt-1.5 text-[11px] text-g-500">
        Engagement {pct(engagement, 2)} ·{' '}
        {conforme
          ? `marge de ${pct(constate - engagement, 2)}`
          : `écart de ${pct(engagement - constate, 2)} → crédit SLA`}
      </p>
    </div>
  )
}

/** Résumé d'un plan de reprise. */
export function DrPlanSummary({ plan, className }: { plan: DRPlan; className?: string }) {
  const dernier = plan.exercices[0]
  return (
    <Card className={className}>
      <CardHeader
        titre={<span className="font-mono">{plan.nom}</span>}
        sousTitre={`${trajetSites(plan.siteSource, plan.siteRepli)}${UN_SEUL_SITE ? '' : ` · réplication ${plan.replication.mode === 'continu' ? 'continue' : 'planifiée'}`}`}
        actions={<HealthBadge etat={plan.statut} size="sm" />}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RpoRtoGauge libelle="RPO" cibleMin={plan.rpoCibleMin} constateMin={plan.rpoConstateMin} />
        <RpoRtoGauge libelle="RTO" cibleMin={plan.rtoCibleMin} constateMin={plan.rtoConstateMin} />
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-g-100 pt-3">
        <Meta cle="Groupes de démarrage" valeur={String(plan.groupes.length)} />
        {!UN_SEUL_SITE && (
          <Meta cle="Retard de réplication" valeur={`${plan.replication.retardS} s`} />
        )}
        <Meta
          cle="Dernier exercice"
          valeur={dernier ? `${dateCourte(dernier.date)} · ${dernier.succes ? 'réussi' : 'échoué'}` : 'jamais'}
        />
      </div>
      {plan.statut === 'jamais_teste' && (
        <Callout ton="warn" className="mt-3" titre="Ce plan n’a jamais été exercé">
          Un plan de reprise qui n’a pas été testé n’offre aucune garantie de temps de reprise.
          Lancez une bascule de test en réseau isolé — elle n’a aucun impact sur la production.
        </Callout>
      )}
    </Card>
  )
}

function Meta({ cle, valeur }: { cle: string; valeur: string }) {
  return (
    <span className="text-[12px]">
      <span className="text-g-500">{cle} : </span>
      <span className="tnum font-semibold text-ink">{valeur}</span>
    </span>
  )
}

/** Pastilles de conformité 3-2-1 (§4.7 onglet Conformité). */
export function Regle321({
  copies,
  supports,
  horsSite,
}: {
  copies: boolean
  supports: boolean
  horsSite: boolean
}) {
  const items = [
    { ok: copies, label: '3 copies' },
    { ok: supports, label: '2 supports' },
    { ok: horsSite, label: '1 hors site' },
  ]
  // Un seul site réel : la copie « hors site » ne peut pas être satisfaite sur la plateforme.
  const noteHorsSite = UN_SEUL_SITE ? ' (la plateforme n’a qu’un site)' : ''
  return (
    <span className="inline-flex items-center gap-1.5">
      {items.map((it) => (
        <span
          key={it.label}
          title={`${it.label} — ${it.ok ? 'conforme' : 'non conforme'}${it === items[2] ? noteHorsSite : ''}`}
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold text-white',
            it.ok ? 'bg-ok' : 'bg-g-300',
          )}
        >
          {it.label[0]}
        </span>
      ))}
    </span>
  )
}

/** Avertissement de rééquilibrage / migration. */
export function AvertissementMigration({ lots, machines }: { lots: number; machines: number }) {
  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-warn/40 bg-warn-bg px-3.5 py-3">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
      <p className="text-[13px] leading-relaxed text-g-700">
        <span className="font-semibold text-ink">
          {machines} machines réparties en {lots} lots
        </span>{' '}
        seront migrées. Chaque lot est validé avant le suivant, et un retour arrière reste possible
        jusqu’à la bascule réseau finale.
      </p>
    </div>
  )
}
