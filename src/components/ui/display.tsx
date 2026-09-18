'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Children, Fragment, cloneElement, isValidElement, useState } from 'react'
import { Check, ChevronRight, Copy, Eye, EyeOff } from 'lucide-react'
import { cn, initials, surfaceMarque } from '@/lib/utils'
import { Tooltip } from './overlay'

export function Avatar({
  nom,
  src,
  size = 'md',
  teinte,
  className,
}: {
  nom: string
  src?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  teinte?: string
  className?: string
}) {
  const dims = {
    xs: 'h-5 w-5 text-[11px]',
    sm: 'h-7 w-7 text-[11px]',
    md: 'h-9 w-9 text-[12px]',
    lg: 'h-12 w-12 text-[15px]',
    xl: 'h-16 w-16 text-[19px]',
  }[size]

  if (src) {
    return (
      <img
        src={src}
        alt={nom}
        className={cn('shrink-0 rounded-full object-cover', dims, className)}
      />
    )
  }
  return (
    <span
      title={nom}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold [font-family:var(--font-display)]',
        dims,
        teinte ? undefined : 'bg-p-100 text-p-700',
        className,
      )}
      style={
        teinte
          ? { background: surfaceMarque(teinte).fond, color: surfaceMarque(teinte).texte }
          : undefined
      }
    >
      {initials(nom)}
    </span>
  )
}

/** Vignette carrée du logo d'une solution open source. */
export function SolutionLogo({
  initiales,
  teinte,
  icone,
  size = 'md',
  className,
}: {
  initiales: string
  teinte: string
  /** Pictogramme en pâte à modeler, sans l'extension : `pate-<icone>.webp`. */
  icone?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dims = {
    sm: 'h-8 w-8 text-[11px] rounded-[6px]',
    md: 'h-11 w-11 text-[14px] rounded-[8px]',
    lg: 'h-14 w-14 text-[17px] rounded-[10px]',
  }[size]
  // Le pictogramme prime quand il existe : il dit ce que le service fait, là
  // où deux initiales n'apprenaient rien. La pastille teintée reste le repli
  // pour ce qui n'en a pas — les agents IA, un service hors catalogue.
  if (icone) {
    return (
      <img
        src={`/photos/pate-${icone}.webp`}
        alt=""
        aria-hidden
        width={320}
        height={320}
        // Le rendu porte son propre fond crème plein : sur une surface plus
        // foncée il laisse un carré. Il reprend donc le rayon de la pastille
        // teintée qu'il remplace, et occupe exactement la même empreinte.
        className={cn(
          'shrink-0',
          {
            sm: 'h-8 w-8 rounded-[6px]',
            md: 'h-11 w-11 rounded-[8px]',
            lg: 'h-14 w-14 rounded-[10px]',
          }[size],
          className,
        )}
      />
    )
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-bold [font-family:var(--font-display)]',
        dims,
        className,
      )}
      // `surfaceMarque` choisit l'encre lisible sur la teinte de la solution
      // sans renoncer à la couleur, qui sert à la reconnaître d'un coup d'œil.
      style={{ background: surfaceMarque(teinte).fond, color: surfaceMarque(teinte).texte }}
      aria-hidden
    >
      {initiales}
    </span>
  )
}

export function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>
}) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={12} className="text-g-300" />}
          {it.href ? (
            <Link
              href={it.href}
              className="text-[12px] text-g-500 transition-colors hover:text-p-700"
            >
              {it.label}
            </Link>
          ) : (
            <span className="text-[12px] font-medium text-g-700">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; badge?: ReactNode }>
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('no-scrollbar overflow-x-auto border-b border-g-300', className)}>
      <div className="flex min-w-max gap-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-semibold transition-colors',
              active === t.id
                ? 'text-p-700 after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-p-700'
                : 'text-g-500 hover:text-g-700',
            )}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Onglets liés à l'URL — pour les pages à sous-navigation persistante. */
export function LinkTabs({
  tabs,
  active,
  className,
}: {
  tabs: Array<{ href: string; label: string; badge?: ReactNode }>
  active: string
  className?: string
}) {
  return (
    <div className={cn('no-scrollbar overflow-x-auto border-b border-g-300', className)}>
      <div className="flex min-w-max gap-0.5">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-semibold transition-colors',
              active === t.href
                ? 'text-p-700 after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-p-700'
                : 'text-g-500 hover:text-g-700',
            )}
          >
            {t.label}
            {t.badge}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Valeur avec bouton copier. */
export function CopyField({
  value,
  label,
  masque,
  mono = true,
  className,
}: {
  value: string
  label?: string
  masque?: boolean
  mono?: boolean
  className?: string
}) {
  const [copie, setCopie] = useState(false)
  const [revele, setRevele] = useState(!masque)

  const copier = () => {
    navigator.clipboard?.writeText(value)
    setCopie(true)
    setTimeout(() => setCopie(false), 1600)
  }

  return (
    <div className={className}>
      {label && <p className="mb-1.5 text-[13px] font-semibold text-g-700">{label}</p>}
      <div className="flex items-stretch overflow-hidden rounded-[6px] border border-g-300 bg-g-050">
        <span
          className={cn(
            'flex-1 truncate px-3 py-2 text-[13px] text-ink',
            mono && 'font-mono',
          )}
        >
          {revele ? value : '•'.repeat(Math.min(28, value.length))}
        </span>
        {masque && (
          <button
            type="button"
            onClick={() => setRevele((v) => !v)}
            aria-label={revele ? 'Masquer' : 'Révéler'}
            className="border-l border-g-300 px-2.5 text-g-500 transition-colors hover:bg-white hover:text-p-700"
          >
            {revele ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={copier}
          aria-label="Copier"
          className="border-l border-g-300 px-2.5 text-g-500 transition-colors hover:bg-white hover:text-p-700"
        >
          {copie ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

export function CodeBlock({
  code,
  langue,
  copiable = true,
  className,
}: {
  code: string
  langue?: string
  copiable?: boolean
  className?: string
}) {
  const [copie, setCopie] = useState(false)
  return (
    <div className={cn('overflow-hidden rounded-[8px] border border-g-300 bg-p-900', className)}>
      {(langue || copiable) && (
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
          <span className="type-micro text-p-300">{langue ?? 'shell'}</span>
          {copiable && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(code)
                setCopie(true)
                setTimeout(() => setCopie(false), 1600)
              }}
              className="flex items-center gap-1 text-[12px] text-p-300 transition-colors hover:text-white"
            >
              {copie ? <Check size={12} /> : <Copy size={12} />}
              {copie ? 'Copié' : 'Copier'}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto px-3 py-2.5">
        <code className="font-mono text-[13px] leading-relaxed text-[#E6E1F5]">{code}</code>
      </pre>
    </div>
  )
}

export function Pagination({
  page,
  total,
  perPage,
  onChange,
  className,
}: {
  page: number
  total: number
  perPage: number
  onChange: (p: number) => void
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  const debut = total === 0 ? 0 : (page - 1) * perPage + 1
  const fin = Math.min(total, page * perPage)

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="tnum text-[12px] text-g-500">
        {debut}–{fin} sur {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-[6px] border border-g-300 px-2.5 py-1 text-[12px] font-semibold text-g-700 transition-colors hover:bg-g-050 disabled:opacity-40"
        >
          Précédent
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .map((p, i, arr) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && arr[i - 1] !== p - 1 && <span className="px-0.5 text-g-500">…</span>}
              <button
                type="button"
                onClick={() => onChange(p)}
                className={cn(
                  'tnum min-w-7 rounded-[6px] border px-2 py-1 text-[12px] font-semibold transition-colors',
                  p === page
                    ? 'border-p-700 bg-p-700 text-white'
                    : 'border-g-300 text-g-700 hover:bg-g-050',
                )}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded-[6px] border border-g-300 px-2.5 py-1 text-[12px] font-semibold text-g-700 transition-colors hover:bg-g-050 disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn('animate-spin text-p-600', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".22" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Action refusée par le RBAC : le bouton reste visible mais désactivé,
 * avec une infobulle qui nomme le rôle requis (§10, règle de rendu).
 *
 * Le contrôle enfant est cloné pour porter `aria-disabled` et sortir de
 * l’ordre de tabulation : sans cela, l’opacité et `pointer-events-none` ne
 * suffisaient qu’à la souris — le bouton restait focalisable au clavier et
 * annoncé « activé » par un lecteur d’écran.
 */
export function GatedAction({
  autorise,
  message,
  children,
}: {
  autorise: boolean
  message: string
  children: ReactNode
}) {
  if (autorise) return <>{children}</>
  return (
    <Tooltip content={message}>
      <span className="inline-flex cursor-not-allowed opacity-45 [&_*]:pointer-events-none">
        {neutraliser(children)}
      </span>
    </Tooltip>
  )
}

/**
 * Clone l’enfant pour le rendre réellement inerte au clavier (`aria-disabled`,
 * hors tabulation). Un `Fragment` ne peut recevoir que `key` et `children` :
 * on descend alors dans ses enfants au lieu de lui poser l’attribut, ce qui
 * produisait une erreur React « Invalid prop supplied to React.Fragment ».
 */
function neutraliser(children: ReactNode): ReactNode {
  if (!isValidElement(children)) return children
  if ((children as { type: unknown }).type === Fragment) {
    const { children: sous } = children.props as { children?: ReactNode }
    return Children.map(sous, neutraliser)
  }
  if (typeof (children as { type: unknown }).type === 'symbol') return children
  return cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    'aria-disabled': true,
    tabIndex: -1,
  })
}
