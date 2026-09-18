'use client'

import type { ComponentProps, ReactNode } from 'react'
import { cloneElement, isValidElement, useId, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FIELD =
  'w-full rounded-[6px] border border-g-300 bg-white text-[13px] text-ink placeholder:text-g-500 transition-colors focus:border-p-600 focus:ring-2 focus:ring-p-100 outline-none disabled:bg-g-050 disabled:text-g-500 disabled:cursor-not-allowed'

export function Label({
  children,
  htmlFor,
  hint,
  required,
}: {
  children: ReactNode
  htmlFor?: string
  hint?: string
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block">
      <span className="text-[13px] font-semibold text-g-700">
        {children}
        {required && <span className="ml-0.5 text-m-600">*</span>}
      </span>
      {hint && <span className="ml-2 text-[12px] text-g-500">{hint}</span>}
    </label>
  )
}

/**
 * Étiquette + champ. `Field` associe réellement l’étiquette au contrôle :
 * sans `htmlFor`/`id`, cliquer sur le libellé ne focalise pas le champ et un
 * lecteur d’écran annonce « zone de saisie » sans nom. L’`id` est généré ici
 * et injecté dans l’enfant (`Input`, `Select`, `Textarea`…), qui le pose sur
 * l’élément natif.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const controle = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ id?: string }>, { id })
    : children
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} hint={hint} required={required}>
          {label}
        </Label>
      )}
      {controle}
      {error && <p className="mt-1 text-[12px] text-err">{error}</p>}
    </div>
  )
}

export function Input({
  className,
  iconBefore,
  suffix,
  ...rest
}: ComponentProps<'input'> & { iconBefore?: ReactNode; suffix?: ReactNode }) {
  if (iconBefore || suffix) {
    return (
      <div className="relative">
        {iconBefore && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-g-500">
            {iconBefore}
          </span>
        )}
        <input
          className={cn(FIELD, 'h-9', iconBefore && 'pl-9', suffix ? 'pr-16' : 'pr-3', !iconBefore && 'pl-3', className)}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-g-500">
            {suffix}
          </span>
        )}
      </div>
    )
  }
  return <input className={cn(FIELD, 'h-9 px-3', className)} {...rest} />
}

/**
 * Champ de recherche : pas d’étiquette visible, donc le nom accessible ne
 * peut pas venir du `placeholder` seul — il disparaît dès la première frappe
 * et un lecteur d’écran annonce alors « zone de saisie » sans nom. On fige le
 * texte du placeholder dans `aria-label` si l’appelant n’en fournit pas.
 */
export function SearchInput({
  className,
  placeholder,
  'aria-label': ariaLabel,
  ...rest
}: ComponentProps<'input'>) {
  return (
    <Input
      iconBefore={<Search size={14} />}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder ?? 'Rechercher'}
      className={className}
      {...rest}
    />
  )
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(FIELD, 'min-h-24 px-3 py-2 leading-relaxed', className)} {...rest} />
}

/**
 * Saisie d'étiquettes en pastilles : Entrée ou virgule ajoute, Retour arrière
 * sur un champ vide retire la dernière. Pas de doublon, pas de vide.
 */
export function TagsInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
}) {
  const [brouillon, setBrouillon] = useState('')

  const ajouter = (texte: string) => {
    const t = texte.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setBrouillon('')
  }

  return (
    <div
      className={cn(
        FIELD,
        'flex min-h-9 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-p-600 focus-within:ring-2 focus-within:ring-p-100',
        className,
      )}
    >
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-p-050 py-0.5 pl-2.5 pr-1 text-[12px] font-semibold text-p-700"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            aria-label={`Retirer l’étiquette ${t}`}
            className="rounded-full p-0.5 text-p-700/60 transition-colors hover:bg-p-100 hover:text-p-700"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={brouillon}
        onChange={(e) => setBrouillon(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            ajouter(brouillon)
          } else if (e.key === 'Backspace' && !brouillon && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => ajouter(brouillon)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="h-6 min-w-[100px] flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-g-500"
      />
    </div>
  )
}

export function MonoTextarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return (
    <textarea
      spellCheck={false}
      className={cn(
        FIELD,
        'min-h-40 px-3 py-2 font-mono text-[13px] leading-relaxed',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({
  className,
  children,
  ...rest
}: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(FIELD, 'h-9 appearance-none pl-3 pr-9 cursor-pointer', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-g-500"
      />
    </div>
  )
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: ComponentProps<'input'> & { label?: ReactNode; description?: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-[4px] border-g-300 text-p-700 accent-[#4B2882] focus:ring-2 focus:ring-p-100"
        {...rest}
      />
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && <span className="block text-[13px] text-ink">{label}</span>}
          {description && <span className="block text-[12px] text-g-500">{description}</span>}
        </label>
      )}
    </div>
  )
}

export function Radio({
  label,
  description,
  className,
  ...rest
}: ComponentProps<'input'> & { label?: ReactNode; description?: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="radio"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer border-g-300 accent-[#4B2882] focus:ring-2 focus:ring-p-100"
        {...rest}
      />
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && <span className="block text-[13px] text-ink">{label}</span>}
          {description && <span className="block text-[12px] text-g-500">{description}</span>}
        </label>
      )}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean
  onChange?: (v: boolean) => void
  label?: ReactNode
  description?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="text-[13px] font-medium text-ink">{label}</p>}
          {description && <p className="mt-0.5 text-[12px] text-g-500">{description}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Basculer'}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-p-700' : 'bg-g-300',
          disabled && 'opacity-45 cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

/** Contrôle segmenté — sélecteurs de période, densité, etc. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[6px] border border-g-300 bg-g-050 p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[4px] font-semibold transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]',
            value === o.value
              ? 'bg-white text-p-700 shadow-[0_1px_2px_rgba(43,27,77,.08)]'
              : 'text-g-500 hover:text-g-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Curseur avec valeur affichée. */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unite,
  className,
}: {
  label?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unite?: string
  className?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={className}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-g-700">{label}</span>
          <span className="tnum text-[13px] font-bold text-p-700">
            {value}
            {unite ? ` ${unite}` : ''}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-p-700 [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(43,27,77,.3)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-p-700"
        style={{
          background: `linear-gradient(to right, var(--color-p-700) ${pct}%, var(--color-g-300) ${pct}%)`,
        }}
      />
    </div>
  )
}

/** Champ de recherche avec liste filtrable. */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Rechercher…',
  className,
}: {
  options: Array<{ value: string; label: string; meta?: string }>
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.meta ?? '').toLowerCase().includes(query.toLowerCase()),
  )
  const selected = options.find((o) => o.value === value)

  return (
    <div className={cn('relative', className)}>
      <Input
        iconBefore={<Search size={14} />}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-[8px] border border-g-300 bg-white py-1 shadow-[0_8px_24px_rgba(43,27,77,.14)]">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-g-500">Aucun résultat</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={() => {
                onChange(o.value)
                setQuery('')
                setOpen(false)
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] hover:bg-p-050"
            >
              <span className="truncate text-ink">{o.label}</span>
              <span className="flex items-center gap-2">
                {o.meta && <span className="text-[12px] text-g-500">{o.meta}</span>}
                {value === o.value && <Check size={13} className="text-p-700" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
