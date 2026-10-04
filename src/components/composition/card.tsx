import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/ui/display'

export function Card({
  children,
  className,
  padding = true,
  hover,
}: {
  children: ReactNode
  className?: string
  padding?: boolean
  hover?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-g-300 bg-white shadow-[0_1px_2px_rgba(43,27,77,.06)]',
        padding && 'p-4',
        hover && 'transition-shadow hover:shadow-[0_4px_16px_rgba(43,27,77,.1)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  titre,
  sousTitre,
  actions,
  className,
}: {
  titre: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0 flex-1">
        <h3 className="type-h3">{titre}</h3>
        {sousTitre && <p className="mt-0.5 text-[13px] text-g-500">{sousTitre}</p>}
      </div>
      {/* `flex-wrap` sans `shrink-0` : un groupe d'actions large descend sous
          le titre au lieu de pousser la carte hors de l'écran. */}
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Section de page avec titre et actions. */
export function Section({
  titre,
  sousTitre,
  actions,
  children,
  className,
}: {
  titre?: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {(titre || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            {titre && <h2 className="type-h2">{titre}</h2>}
            {sousTitre && <p className="mt-0.5 text-[13px] text-g-500">{sousTitre}</p>}
          </div>
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** En-tête de page : fil d'Ariane, titre, sous-titre, actions (§1.4). */
export function PageHeader({
  fil,
  titre,
  sousTitre,
  actions,
  meta,
  className,
}: {
  fil?: Array<{ label: string; href?: string }>
  titre: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('space-y-2.5', className)}>
      {fil && <Breadcrumb items={fil} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-h1">{titre}</h1>
          {sousTitre && (
            <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-g-500">{sousTitre}</p>
          )}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {/* Pas de `shrink-0` : sur un écran étroit ce bloc doit pouvoir se
            réduire et passer à la ligne, sinon deux boutons côte à côte
            débordent de la largeur de l'écran. */}
        {actions && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
    </header>
  )
}

/** Liste clé/valeur — caractéristiques d'une ressource (§1.4). */
export function KeyValueList({
  items,
  colonnes = 2,
  className,
}: {
  items: Array<{ cle: string; valeur: ReactNode }>
  colonnes?: 1 | 2 | 3
  className?: string
}) {
  const grid = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[colonnes]
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3', grid, className)}>
      {items.map((it) => (
        <div key={it.cle} className="min-w-0 border-b border-g-100 pb-2.5 last:border-0">
          <dt className="type-micro text-g-500">{it.cle}</dt>
          <dd className="mt-1 break-words text-[13px] text-ink">{it.valeur}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Bloc de mise en valeur (callout).
 *
 * Trois niveaux de bruit visuel, et pas cinq : un aparté (`violet`) n'a pas à
 * peser autant qu'une alerte. Un bandeau de couleur pleine avec un liséré de
 * 4 px conviendrait s'il y en avait un par écran ; il y en a plus de quatre
 * cents, et la page finissait en planche de surligneurs. Le fond teinté reste
 * donc aux tons qui demandent une action — `warn` et `err` — et la bordure
 * descend à 1 px partout.
 */
export function Callout({
  ton = 'info',
  titre,
  children,
  className,
  action,
}: {
  ton?: 'info' | 'ok' | 'warn' | 'err' | 'violet'
  titre?: ReactNode
  children?: ReactNode
  className?: string
  action?: ReactNode
}) {
  const styles = {
    info: 'rounded-[8px] border border-g-300 bg-g-050 px-3.5 py-3',
    ok: 'rounded-[8px] border border-ok/30 bg-ok-bg px-3.5 py-3',
    warn: 'rounded-[8px] border border-warn/40 bg-warn-bg px-3.5 py-3',
    err: 'rounded-[8px] border border-err/40 bg-err-bg px-3.5 py-3',
    // Aparté : un filet violet clair, pas de fond. Le texte reste du texte.
    violet: 'border-l-2 border-p-300 pl-3.5',
  }[ton]
  return (
    <div className={cn(styles, className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          {titre && <p className="text-[13px] font-semibold text-ink">{titre}</p>}
          {children && (
            <div className={cn('text-[13px] leading-relaxed text-g-700', titre && 'mt-1')}>
              {children}
            </div>
          )}
        </div>
        {action && <div className="min-w-0">{action}</div>}
      </div>
    </div>
  )
}

/** Carte cliquable menant à un sous-écran. */
export function NavCard({
  href,
  titre,
  description,
  icone,
  meta,
  className,
}: {
  href: string
  titre: ReactNode
  description?: string
  icone?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-[10px] border border-g-300 bg-white p-4 shadow-[0_1px_2px_rgba(43,27,77,.06)] transition-all hover:border-p-400 hover:shadow-[0_4px_16px_rgba(43,27,77,.1)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icone && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-p-050 text-p-700 transition-colors group-hover:bg-p-100">
            {icone}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="type-h3 group-hover:text-p-700">{titre}</h3>
          {description && (
            <p className="mt-1 text-[13px] leading-relaxed text-g-500">{description}</p>
          )}
          {meta && <div className="mt-2.5">{meta}</div>}
        </div>
      </div>
    </Link>
  )
}
