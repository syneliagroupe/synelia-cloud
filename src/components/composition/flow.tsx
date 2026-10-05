import type { ReactNode } from 'react'
import { Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, prorata, TVA_PCT, ventilationTva } from '@/lib/format'
import { Card } from './card'

/** Chronologie d'événements. */
export function Timeline({
  evenements,
  className,
}: {
  evenements: Array<{
    id: string
    titre: ReactNode
    detail?: ReactNode
    horodatage: string
    ton?: 'ok' | 'warn' | 'err' | 'info' | 'neutral'
  }>
  className?: string
}) {
  const couleurs = {
    ok: 'bg-ok',
    warn: 'bg-warn',
    err: 'bg-err',
    info: 'bg-info',
    neutral: 'bg-g-300',
  }
  return (
    <ol className={cn('relative space-y-3.5 pl-5', className)}>
      <span className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-g-100" aria-hidden />
      {evenements.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              'absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
              couleurs[e.ton ?? 'neutral'],
            )}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-[13px] text-ink">{e.titre}</p>
            <span className="tnum shrink-0 text-[12px] text-g-500">{e.horodatage}</span>
          </div>
          {e.detail && <p className="mt-0.5 text-[12px] text-g-500">{e.detail}</p>}
        </li>
      ))}
    </ol>
  )
}

/** Fil d'étapes d'un assistant. */
export function Stepper({
  etapes,
  courante,
  onChange,
  className,
}: {
  etapes: Array<{ numero: number; titre: string }>
  courante: number
  onChange?: (n: number) => void
  className?: string
}) {
  return (
    <ol className={cn('no-scrollbar flex items-center gap-1 overflow-x-auto', className)}>
      {etapes.map((e, i) => {
        const passee = e.numero < courante
        const active = e.numero === courante
        return (
          <li key={e.numero} className="flex min-w-max items-center">
            <button
              type="button"
              disabled={!onChange || e.numero > courante}
              onClick={() => onChange?.(e.numero)}
              className={cn(
                'flex items-center gap-2 rounded-[6px] px-2.5 py-1.5 transition-colors',
                onChange && e.numero <= courante && 'hover:bg-p-050',
                e.numero > courante && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                  passee
                    ? 'bg-ok text-white'
                    : active
                      ? 'bg-p-700 text-white'
                      : 'bg-g-100 text-g-500',
                )}
              >
                {passee ? <Check size={12} strokeWidth={3} /> : e.numero}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[13px] font-semibold',
                  active ? 'text-p-700' : passee ? 'text-g-700' : 'text-g-500',
                )}
              >
                {e.titre}
              </span>
            </button>
            {i < etapes.length - 1 && <span className="mx-1 h-px w-5 bg-g-300" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Aperçu de coût affiché avant toute validation facturable (§1.6) :
 * montant mensuel, prorata du mois en cours, mention explicite.
 */
export function CostPreview({
  lignes,
  periodicite = 'mensuelle',
  jourDuMois = 19,
  remiseAnnuellePct = 15,
  className,
  compact,
}: {
  lignes: Array<{ libelle: string; detail?: string; montant: number; quantite?: number }>
  periodicite?: 'mensuelle' | 'annuelle'
  jourDuMois?: number
  remiseAnnuellePct?: number
  className?: string
  compact?: boolean
}) {
  const mensuelHt = lignes.reduce((a, l) => a + l.montant, 0)
  const remise = periodicite === 'annuelle' ? Math.round((mensuelHt * remiseAnnuellePct) / 100) : 0
  const baseHt = mensuelHt - remise
  const { tva, total } = ventilationTva(baseHt)
  const pro = prorata(total, jourDuMois)

  return (
    <Card
      className={cn('border-p-300 bg-p-050', className)}
      padding={false}
    >
      <div className="border-b border-p-300/60 px-4 py-2.5">
        <p className="type-micro text-p-700">Impact sur votre prochaine facture</p>
      </div>
      <div className="px-4 py-3">
        <ul className="space-y-1.5">
          {lignes.map((l) => (
            <li key={l.libelle} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[13px] text-g-700">
                {l.libelle}
                {l.quantite !== undefined && (
                  <span className="tnum text-g-500"> × {l.quantite}</span>
                )}
                {l.detail && <span className="block text-[12px] text-g-500">{l.detail}</span>}
              </span>
              <span className="tnum shrink-0 text-[13px] font-semibold text-ink">
                {money(l.montant)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1.5 border-t border-p-300/60 pt-3">
          <Ligne libelle="Sous-total mensuel HT" valeur={money(mensuelHt)} />
          {remise > 0 && (
            <Ligne
              libelle={`Remise annuelle (−${remiseAnnuellePct} %)`}
              valeur={`− ${money(remise)}`}
              ton="ok"
            />
          )}
          <Ligne libelle={`TVA ${TVA_PCT} %`} valeur={money(tva)} />
          <div className="flex items-baseline justify-between gap-3 border-t border-p-300/60 pt-2">
            <span className="text-[13px] font-bold text-ink">Total mensuel TTC</span>
            <span className="tnum text-[16px] font-bold [font-family:var(--font-display)] text-p-700">
              {money(total)}
            </span>
          </div>
        </div>

        {!compact && (
          <div className="mt-3 flex gap-2 rounded-[6px] bg-white px-3 py-2">
            <Info size={13} className="mt-0.5 shrink-0 text-info" />
            <p className="text-[12px] leading-relaxed text-g-700">
              Prorata du mois en cours :{' '}
              <span className="tnum font-semibold text-ink">{money(pro)}</span>, ajouté à votre
              prochaine facture. La facturation complète démarre au 1<sup>er</sup> du mois suivant.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

function Ligne({
  libelle,
  valeur,
  ton,
}: {
  libelle: string
  valeur: string
  ton?: 'ok'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-g-700">{libelle}</span>
      <span
        className={cn(
          'tnum text-[13px] font-semibold',
          ton === 'ok' ? 'text-ok' : 'text-ink',
        )}
      >
        {valeur}
      </span>
    </div>
  )
}

/** Coquille d'un assistant multi-étapes. */
export function WizardShell({
  etapes,
  courante,
  onChange,
  titre,
  niveau: Titre = 'h1',
  children,
  panneau,
  actions,
  className,
}: {
  etapes: Array<{ numero: number; titre: string }>
  courante: number
  onChange?: (n: number) => void
  titre: string
  /** `h2` quand la page porte déjà son `PageHeader`. */
  niveau?: 'h1' | 'h2'
  children: ReactNode
  panneau?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-5', className)}>
      <div className="rounded-[10px] border border-g-300 bg-white px-4 py-3">
        <Stepper etapes={etapes} courante={courante} onChange={onChange} />
      </div>
      <div className={cn('grid gap-5', panneau ? 'lg:grid-cols-[1fr_340px]' : '')}>
        <div className="min-w-0 space-y-4">
          <Titre className="type-h2">
            <span className="tnum mr-2 text-g-500">
              {courante}/{etapes.length}
            </span>
            {titre}
          </Titre>
          {children}
          {actions && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-g-100 pt-4">
              {actions}
            </div>
          )}
        </div>
        {panneau && <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">{panneau}</aside>}
      </div>
    </div>
  )
}
