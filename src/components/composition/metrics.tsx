import type { ReactNode } from 'react'
import { cn, clamp, estSerieFictive, modeApiActif } from '@/lib/utils'
import { delta, pct } from '@/lib/format'
import { Badge, type Tone } from '@/components/ui/badge'

/** Micro-courbe 24 h intégrée à une tuile de métrique. */
export function Sparkline({
  serie,
  couleur = 'var(--color-p-600)',
  hauteur = 28,
  className,
}: {
  serie: number[]
  couleur?: string
  hauteur?: number
  className?: string
}) {
  if (serie.length < 2) return null
  const min = Math.min(...serie)
  const max = Math.max(...serie)
  const span = max - min || 1
  const w = 100
  const pts = serie.map((v, i) => {
    const x = (i / (serie.length - 1)) * w
    const y = hauteur - ((v - min) / span) * (hauteur - 3) - 1.5
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const id = `sp-${serie.length}-${Math.round(min)}-${Math.round(max)}`

  return (
    <svg
      viewBox={`0 0 ${w} ${hauteur}`}
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height: hauteur }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={couleur} stopOpacity="0.22" />
          <stop offset="100%" stopColor={couleur} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${hauteur} ${pts.join(' ')} ${w},${hauteur}`} fill={`url(#${id})`} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={couleur}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Tuile de métrique : valeur, unité, variation, micro-courbe 24 h (§0.3). */
export function StatTile({
  libelle,
  valeur,
  unite,
  variation,
  variationUnite = 'pts',
  serie,
  ton = 'violet',
  detail,
  className,
}: {
  libelle: string
  valeur: ReactNode
  unite?: string
  variation?: number
  variationUnite?: string
  serie?: number[]
  ton?: Tone
  detail?: string
  className?: string
}) {
  const couleurs: Record<Tone, string> = {
    neutral: 'var(--color-g-500)',
    violet: 'var(--color-p-600)',
    accent: 'var(--color-m-600)',
    ok: 'var(--color-ok)',
    warn: 'var(--color-warn)',
    err: 'var(--color-err)',
    info: 'var(--color-info)',
  }
  const varTon =
    variation === undefined ? undefined : variation > 0 ? 'ok' : variation < 0 ? 'err' : 'neutral'
  const longueurValeur =
    typeof valeur === 'string' || typeof valeur === 'number' ? String(valeur).length : 0

  return (
    <div
      className={cn(
        'flex flex-col rounded-[10px] border border-g-300 bg-white p-3.5 shadow-[0_1px_2px_rgba(43,27,77,.06)]',
        className,
      )}
    >
      <p className="type-micro text-g-500">{libelle}</p>
      <div className="mt-1.5 flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn(
            'tnum min-w-0 font-bold leading-none [font-family:var(--font-display)] text-ink',
            // Un montant en francs CFA dépasse facilement la largeur d'une tuile :
            // on réduit le corps plutôt que de tronquer le chiffre.
            longueurValeur > 15
              ? 'text-[17px]'
              : longueurValeur > 11
                ? 'text-[20px]'
                : 'text-[24px]',
          )}
        >
          {valeur}
        </span>
        {unite && <span className="shrink-0 text-[13px] font-semibold text-g-500">{unite}</span>}
      </div>
      {variation !== undefined && (
        <p
          className={cn(
            'tnum mt-1.5 text-[12px] font-semibold',
            varTon === 'ok' ? 'text-ok' : varTon === 'err' ? 'text-err' : 'text-g-500',
          )}
        >
          {delta(variation, variationUnite)}
        </p>
      )}
      {detail && <p className="mt-1.5 text-[12px] leading-snug text-g-500">{detail}</p>}
      {serie && !(modeApiActif() && estSerieFictive(serie)) && (
        <div className="mt-auto pt-3">
          <Sparkline serie={serie} couleur={couleurs[ton]} />
        </div>
      )}
    </div>
  )
}

/** Barre de quota : utilisé / total, pourcentage, seuil d'alerte (§1.4). */
export function QuotaBar({
  libelle,
  utilise,
  total,
  unite,
  seuil = 85,
  compact,
  formateur,
  className,
}: {
  libelle?: string
  utilise: number
  total: number
  unite?: string
  seuil?: number
  compact?: boolean
  formateur?: (v: number) => string
  className?: string
}) {
  const ratio = total > 0 ? clamp((utilise / total) * 100, 0, 100) : 0
  const alerte = ratio >= seuil
  const critique = ratio >= 95
  const fmt = formateur ?? ((v: number) => String(v))

  return (
    <div className={className}>
      {(libelle || !compact) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {libelle && (
            <span className={cn('font-semibold text-g-700', compact ? 'text-[12px]' : 'text-[13px]')}>
              {libelle}
            </span>
          )}
          <span className="tnum text-[12px] text-g-500">
            {/* Un taux déjà sur 100 : « 6 / 100 % 6 % » dirait deux fois la même chose. */}
            {unite === '%' && total === 100 ? null : (
              <>
                {fmt(utilise)} / {fmt(total)}
                {unite ? ` ${unite}` : ''}
              </>
            )}
            <span
              className={cn(
                unite === '%' && total === 100 ? 'text-[12px] font-bold' : 'ml-1.5 font-bold',
                critique ? 'text-err' : alerte ? 'text-warn' : 'text-g-700',
              )}
            >
              {pct(Math.round(ratio))}
            </span>
          </span>
        </div>
      )}
      <div
        className={cn('relative w-full overflow-hidden rounded-full bg-g-100', compact ? 'h-1.5' : 'h-2')}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            critique ? 'bg-err' : alerte ? 'bg-warn' : 'bg-p-600',
          )}
          style={{ width: `${ratio}%` }}
        />
        {seuil > 0 && seuil < 100 && (
          <span
            className="absolute top-0 h-full w-[1.5px] bg-g-500/45"
            style={{ left: `${seuil}%` }}
            title={`Seuil d'alerte ${seuil} %`}
          />
        )}
      </div>
    </div>
  )
}

/** Barre empilée — répartition d'un total entre plusieurs segments. */
export function StackedBar({
  segments,
  hauteur = 'h-2.5',
  className,
}: {
  segments: Array<{ label: string; valeur: number; couleur: string }>
  hauteur?: string
  className?: string
}) {
  const total = segments.reduce((a, s) => a + s.valeur, 0) || 1
  return (
    <div className={className}>
      <div className={cn('flex w-full overflow-hidden rounded-full bg-g-100', hauteur)}>
        {segments.map((s) => (
          <div
            key={s.label}
            title={`${s.label} · ${pct(Math.round((s.valeur / total) * 100))}`}
            style={{ width: `${(s.valeur / total) * 100}%`, background: s.couleur }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-g-700">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.couleur }} />
            {s.label}
            <span className="tnum font-semibold">{pct(Math.round((s.valeur / total) * 100))}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Jauge circulaire — disponibilité constatée face au SLA. */
export function GaugeCircle({
  valeur,
  max = 100,
  min = 99,
  libelle,
  cible,
  taille = 132,
  className,
}: {
  valeur: number
  max?: number
  min?: number
  libelle?: string
  cible?: number
  taille?: number
  className?: string
}) {
  const r = (taille - 16) / 2
  const c = 2 * Math.PI * r
  const norm = clamp((valeur - min) / (max - min), 0, 1)
  const conforme = cible === undefined || valeur >= cible
  const couleur = conforme ? 'var(--color-ok)' : 'var(--color-warn)'

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: taille, height: taille }}>
        <svg width={taille} height={taille} className="-rotate-90" aria-hidden>
          <circle
            cx={taille / 2}
            cy={taille / 2}
            r={r}
            fill="none"
            stroke="var(--color-g-100)"
            strokeWidth="8"
          />
          <circle
            cx={taille / 2}
            cy={taille / 2}
            r={r}
            fill="none"
            stroke={couleur}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - norm)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[22px] font-bold leading-none [font-family:var(--font-display)] text-ink">
            {valeur.toFixed(2)}
            <span className="text-[13px]"> %</span>
          </span>
          {cible !== undefined && (
            <span className="tnum mt-1 text-[11px] text-g-500">SLA {cible} %</span>
          )}
        </div>
      </div>
      {libelle && <p className="mt-2 text-center text-[13px] text-g-500">{libelle}</p>}
    </div>
  )
}

/** Badge de santé d'une ressource. */
export function HealthBadge({
  etat,
  size = 'md',
}: {
  etat:
    | 'sain'
    | 'ok'
    | 'operationnel'
    | 'running'
    | 'deployed'
    | 'en_ligne'
    | 'degrade'
    | 'degraded'
    | 'warn'
    | 'maintenance'
    | 'provisioning'
    | 'creating'
    | 'building'
    | 'migrating'
    | 'updating'
    | 'arrete'
    | 'stopped'
    | 'suspendue'
    | 'suspendu'
    | 'echec'
    | 'error'
    | 'failed'
    | 'erreur'
    | 'maj_disponible'
    | 'jamais_teste'
  size?: 'sm' | 'md'
}) {
  const map: Record<string, { tone: Tone; label: string; pulse?: boolean }> = {
    sain: { tone: 'ok', label: 'Sain' },
    ok: { tone: 'ok', label: 'Opérationnel' },
    operationnel: { tone: 'ok', label: 'Opérationnel' },
    running: { tone: 'ok', label: 'En marche' },
    deployed: { tone: 'ok', label: 'Déployé' },
    en_ligne: { tone: 'ok', label: 'En ligne' },
    degrade: { tone: 'warn', label: 'Dégradé' },
    degraded: { tone: 'warn', label: 'Dégradé' },
    warn: { tone: 'warn', label: 'À surveiller' },
    maintenance: { tone: 'info', label: 'En maintenance' },
    provisioning: { tone: 'info', label: 'Provisioning', pulse: true },
    creating: { tone: 'info', label: 'Création', pulse: true },
    building: { tone: 'info', label: 'Construction', pulse: true },
    migrating: { tone: 'info', label: 'Migration', pulse: true },
    updating: { tone: 'info', label: 'Mise à jour', pulse: true },
    arrete: { tone: 'neutral', label: 'Arrêté' },
    stopped: { tone: 'neutral', label: 'Arrêté' },
    suspendue: { tone: 'neutral', label: 'Suspendue' },
    suspendu: { tone: 'neutral', label: 'Suspendu' },
    echec: { tone: 'err', label: 'En échec' },
    error: { tone: 'err', label: 'En erreur' },
    failed: { tone: 'err', label: 'En échec' },
    erreur: { tone: 'err', label: 'En erreur' },
    maj_disponible: { tone: 'accent', label: 'Mise à jour disponible' },
    jamais_teste: { tone: 'warn', label: 'Jamais testé' },
  }
  const v = map[etat] ?? { tone: 'neutral' as Tone, label: etat }
  return (
    <Badge tone={v.tone} dot size={size} className={v.pulse ? 'animate-pulse-dot' : undefined}>
      {v.label}
    </Badge>
  )
}

/** Contenu illustratif (courbes, récits chiffrés) : remplacé par une mention honnête quand l’API réelle est active. */
export function HistoriqueSimule({ children }: { children: ReactNode }) {
  if (!modeApiActif()) return <>{children}</>
  return (
    <p className="rounded-[6px] border border-dashed border-g-300 px-3 py-6 text-center text-[12.5px] text-g-500">
      Historique non disponible pour le moment.
    </p>
  )
}
