'use client'

import { useState } from 'react'
import { ArrowUpRight, ExternalLink } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { heure, relatif } from '@/lib/format'
import type { EvenementSupervision, LigneLog } from '@/lib/types'
import { SearchInput, SegmentedControl } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/composition/card'
import { DegradedState } from '@/components/composition/states'
import { useMaintenant } from '@/components/app/contexte'

export type Periode = '24h' | '7j' | '30j'

const POINTS: Record<Periode, number> = { '24h': 24, '7j': 28, '30j': 30 }
const LEGENDE: Record<Periode, string[]> = {
  '24h': ['-24 h', '-18 h', '-12 h', '-6 h', 'maintenant'],
  '7j': ['-7 j', '-5 j', '-3 j', '-1 j', 'maintenant'],
  '30j': ['-30 j', '-22 j', '-15 j', '-7 j', 'maintenant'],
}

/**
 * Mini-graphique : une série, hauteur 120–160 px, sans axes complexes,
 * sans zoom, avec le seul sélecteur 24 h / 7 j / 30 j autorisé (§0.3).
 */
export function SparkChart({
  titre,
  serie,
  unite = '%',
  couleur = 'var(--color-p-600)',
  hauteur = 140,
  seuil,
  className,
}: {
  titre: string
  serie: number[]
  unite?: string
  couleur?: string
  hauteur?: number
  seuil?: number
  className?: string
}) {
  const min = 0
  const max = Math.max(...serie, seuil ?? 0) * 1.12 || 100
  const w = 300
  const h = hauteur - 26
  const pts = serie.map((v, i) => {
    const x = (i / Math.max(1, serie.length - 1)) * w
    const y = h - ((v - min) / (max - min)) * h
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const gid = `sc-${titre.replace(/\W/g, '')}`
  const dernier = serie[serie.length - 1]

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-g-700">{titre}</span>
        <span className="tnum text-[13px] font-bold text-ink">
          {dernier}
          <span className="text-[11px] font-semibold text-g-500"> {unite}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: h }}
        role="img"
        aria-label={`${titre} : ${dernier} ${unite}`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={couleur} stopOpacity="0.2" />
            <stop offset="100%" stopColor={couleur} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={w}
            y1={h * f}
            y2={h * f}
            stroke="var(--color-g-100)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {seuil !== undefined && (
          <line
            x1="0"
            x2={w}
            y1={h - ((seuil - min) / (max - min)) * h}
            y2={h - ((seuil - min) / (max - min)) * h}
            stroke="var(--color-warn)"
            strokeWidth="1"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${gid})`} />
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={couleur}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

/** Grille de mini-graphiques avec le sélecteur de période autorisé. */
export function GrilleSparkCharts({
  seed,
  metriques,
  degrade,
  className,
}: {
  seed: string
  metriques?: Array<{ titre: string; unite?: string; min: number; max: number; couleur?: string; seuil?: number }>
  degrade?: boolean
  className?: string
}) {
  const [periode, setPeriode] = useState<Periode>('24h')
  const defs =
    metriques ??
    [
      { titre: 'CPU', unite: '%', min: 18, max: 62 },
      { titre: 'Mémoire', unite: '%', min: 42, max: 78 },
      { titre: 'Disque', unite: '%', min: 51, max: 58 },
      { titre: 'Réseau', unite: 'Mbit/s', min: 40, max: 320, couleur: 'var(--color-m-600)' },
    ]

  return (
    <Card className={className}>
      <CardHeader
        titre="Métriques"
        sousTitre="Lecture seule — l’analyse détaillée reste dans Grafana."
        actions={
          <SegmentedControl
            size="sm"
            value={periode}
            onChange={setPeriode}
            options={[
              { value: '24h', label: '24 h' },
              { value: '7j', label: '7 j' },
              { value: '30j', label: '30 j' },
            ]}
          />
        }
      />
      {degrade ? (
        <DegradedState source="supervision" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {defs.map((m) => (
              <SparkChart
                key={m.titre}
                titre={m.titre}
                unite={m.unite}
                couleur={m.couleur}
                seuil={m.seuil}
                serie={seededSeries(`${seed}-${m.titre}-${periode}`, POINTS[periode], m.min, m.max)}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-g-500">
            {LEGENDE[periode].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </>
      )}
      <LiensSortie className="mt-4" />
    </Card>
  )
}

/** URL réelle du Grafana déployé sur le cluster workload dev01 (victoria-metrics-k8s-stack).
 * `hrefGrafana` permet à un écran qui a lu `liens.grafana` depuis le backend (dégradable,
 * donc parfois absent) de la préciser ; sans backend actif, cette constante reste correcte. */
const GRAFANA_URL_DEFAUT = 'https://grafana.synelia.dev01.ovh.smile.ci'

/** Les trois liens de sortie autorisés (§4.9). */
export function LiensSortie({
  centreon = true,
  grafana = true,
  logs = true,
  hrefGrafana,
  className,
}: {
  centreon?: boolean
  grafana?: boolean
  logs?: boolean
  hrefGrafana?: string
  className?: string
}) {
  const liens = [
    centreon && { libelle: 'Ouvrir dans Centreon', href: 'https://centreon.synelia.tech' },
    grafana && { libelle: 'Ouvrir dans Grafana', href: hrefGrafana || GRAFANA_URL_DEFAUT },
    logs && { libelle: 'Ouvrir dans VictoriaLogs', href: 'https://vlogs.synelia.cloud' },
  ].filter(Boolean) as Array<{ libelle: string; href: string }>

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-g-100 pt-3', className)}>
      {liens.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-p-700 transition-colors hover:underline"
        >
          {l.libelle}
          <ExternalLink size={11} />
        </a>
      ))}
    </div>
  )
}

/** Liste d'événements — 5 à 8 lignes maximum (§0.3). */
export function EventList({
  evenements,
  max = 8,
  lienSortie = 'Voir tout dans Centreon',
  hrefSortie = 'https://centreon.synelia.tech',
  className,
}: {
  evenements: EvenementSupervision[]
  max?: number
  lienSortie?: string
  hrefSortie?: string
  className?: string
}) {
  const maintenant = useMaintenant()
  const tons = {
    critique: 'err',
    majeure: 'warn',
    mineure: 'info',
    info: 'neutral',
  } as const
  const libelles = {
    critique: 'Critique',
    majeure: 'Majeure',
    mineure: 'Mineure',
    info: 'Info',
  }

  return (
    <div className={className}>
      <ul className="divide-y divide-g-100">
        {evenements.slice(0, max).map((e) => (
          <li key={e.id} className="flex items-start gap-3 py-2.5 first:pt-0">
            <Badge tone={tons[e.gravite]} size="sm" className="mt-0.5 shrink-0">
              {libelles[e.gravite]}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-ink">{e.message}</p>
              <p className="mt-0.5 text-[12px] text-g-500">
                {e.ressource}
                {e.site && ` · ${e.site}`} · {relatif(e.ts, maintenant)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {lienSortie && (
        <a
          href={hrefSortie}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 border-t border-g-100 pt-3 text-[12px] font-semibold text-p-700 transition-colors hover:underline"
        >
          {lienSortie}
          <ArrowUpRight size={12} />
        </a>
      )}
    </div>
  )
}

/** Aperçu de journal — 20 lignes maximum, filtre texte simple (§0.3). */
export function LogPeek({
  lignes,
  max = 20,
  titre = 'Journal',
  hrefSortie = 'https://vlogs.synelia.cloud',
  className,
}: {
  lignes: LigneLog[]
  max?: number
  titre?: string
  hrefSortie?: string
  className?: string
}) {
  const [filtre, setFiltre] = useState('')
  const visibles = lignes
    .filter(
      (l) =>
        !filtre.trim() ||
        l.message.toLowerCase().includes(filtre.toLowerCase()) ||
        l.source.toLowerCase().includes(filtre.toLowerCase()),
    )
    .slice(0, max)

  const couleurs = {
    INFO: 'text-[#9DB4D4]',
    WARN: 'text-[#E8B84B]',
    ERROR: 'text-[#F08278]',
    // #8A83A8 ne donnait que 4,31:1 sur le fond p-900 du journal.
    DEBUG: 'text-[#9A93BE]',
  }

  return (
    <div className={className}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-g-700">{titre}</span>
        <div className="flex items-center gap-2">
          <SearchInput
            placeholder="Filtrer…"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            className="h-8 w-44"
          />
          <a
            href={hrefSortie}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold text-p-700 hover:underline"
          >
            Ouvrir dans VictoriaLogs
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-[8px] border border-g-300 bg-p-900 px-3 py-2.5">
        {visibles.length === 0 ? (
          <p className="py-3 text-center font-mono text-[12px] text-[#9A93BE]">
            Aucune ligne ne correspond au filtre.
          </p>
        ) : (
          <table className="w-full border-collapse font-mono text-[12px] leading-relaxed">
            <tbody>
              {visibles.map((l, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap pr-3 align-top text-[#9A93BE]">{heure(l.ts)}</td>
                  <td
                    className={cn('whitespace-nowrap pr-3 align-top font-semibold', couleurs[l.niveau])}
                  >
                    {l.niveau}
                  </td>
                  <td className="whitespace-nowrap pr-3 align-top text-[#A79EC8]">{l.source}</td>
                  <td className="align-top text-[#E6E1F5]">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-g-500">
        Aperçu limité à {max} lignes. Le portail n’embarque pas de constructeur de requêtes LogsQL.
      </p>
    </div>
  )
}
