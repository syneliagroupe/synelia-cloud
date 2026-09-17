import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'accent'
  | 'inverse'
  | 'ghostInverse'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-p-700 text-white border border-transparent hover:bg-p-600 active:bg-p-800 shadow-[0_1px_2px_rgba(43,27,77,.12)]',
  secondary:
    'bg-white text-p-700 border border-p-700 hover:bg-p-050 active:bg-p-100',
  ghost:
    'bg-transparent text-g-700 border border-transparent hover:bg-g-100 hover:text-ink',
  danger:
    'bg-err text-white border border-transparent hover:bg-[#a3312a] active:bg-[#8f2b25]',
  /** Réservé au bouton « Ouvrir » d'un service managé (§1.1). */
  accent:
    'bg-m-600 text-white border border-transparent hover:bg-m-700 active:bg-m-700 shadow-[0_1px_2px_rgba(192,41,122,.24)]',
  /**
   * Action principale posée sur un fond violet foncé — héros, bandeau d'appel
   * final. Défini ici plutôt que surchargé par `className` : deux utilitaires
   * de couleur concurrents se départagent par l'ordre de la feuille de style,
   * pas par l'ordre des classes, ce qui rend le libellé invisible une fois sur deux.
   */
  inverse: 'bg-white text-p-700 border border-transparent hover:bg-p-050 active:bg-p-100',
  /** Action secondaire sur fond violet foncé. */
  ghostInverse:
    'bg-transparent text-white border border-p-400 hover:bg-white/10 active:bg-white/15',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-[13px] gap-2',
  lg: 'h-11 px-6 text-[14px] gap-2',
  /** Grand appel à l'action — héros de la vitrine, uniquement. */
  xl: 'h-[52px] px-7 text-[15px] gap-2',
}

const BASE =
  'inline-flex items-center justify-center rounded-[6px] font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none [font-family:var(--font-display)]'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconBefore?: ReactNode
  iconAfter?: ReactNode
  fullWidth?: boolean
  children?: ReactNode
  className?: string
}

function Spinner() {
  return (
    <svg
      className="animate-spin shrink-0"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function inner({ loading, iconBefore, iconAfter, children }: CommonProps) {
  return (
    <>
      {loading ? <Spinner /> : iconBefore}
      {children}
      {!loading && iconAfter}
    </>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconBefore,
  iconAfter,
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<'button'>, 'children' | 'className'>) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {inner({ loading, iconBefore, iconAfter, children })}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  iconBefore,
  iconAfter,
  fullWidth,
  className,
  children,
  href,
  external,
  ...rest
}: CommonProps & {
  href: string
  external?: boolean
} & Omit<ComponentProps<'a'>, 'children' | 'className' | 'href'>) {
  const cls = cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
        {inner({ iconBefore, iconAfter, children })}
      </a>
    )
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {inner({ iconBefore, iconAfter, children })}
    </Link>
  )
}

/** Bouton icône seule, carré. */
export function IconButton({
  size = 'md',
  variant = 'ghost',
  label,
  className,
  children,
  ...rest
}: {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
} & Omit<ComponentProps<'button'>, 'children' | 'className'>) {
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-[6px] transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed',
        VARIANTS[variant],
        dim,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
