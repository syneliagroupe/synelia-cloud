import type { ReactNode } from 'react'
import { AlertTriangle, CloudOff, Lock, ServerCrash } from 'lucide-react'
import { cn, correlationId } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/button'
import { CopyField, Skeleton } from '@/components/ui/display'
import { Card } from './card'

/**
 * Les cinq états obligatoires de chaque écran (§1.5) :
 * chargement · vide · erreur · droits insuffisants · dégradé.
 */

/** 1 — Chargement : squelettes respectant la mise en page finale. */
export function SkeletonTable({ lignes = 6, colonnes = 5 }: { lignes?: number; colonnes?: number }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-g-300 bg-white">
      <div className="flex gap-4 border-b border-g-300 bg-g-050 px-4 py-2.5">
        {Array.from({ length: colonnes }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: lignes }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-g-100 px-4 py-3 last:border-0">
          {Array.from({ length: colonnes }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-40')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCards({ nombre = 3, hauteur = 'h-32' }: { nombre?: number; hauteur?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: nombre }).map((_, i) => (
        <div key={i} className="rounded-[10px] border border-g-300 bg-white p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className={cn('mt-3 w-full', hauteur)} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats({ nombre = 5 }: { nombre?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: nombre }).map((_, i) => (
        <div key={i} className="rounded-[10px] border border-g-300 bg-white p-4">
          <Skeleton className="h-2.5 w-2/3" />
          <Skeleton className="mt-2.5 h-6 w-1/2" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

/** 2 — Vide : illustration, phrase de valeur, action principale. */
export function EmptyState({
  titre,
  phrase,
  action,
  actionSecondaire,
  icone,
  className,
}: {
  titre: string
  phrase: string
  action?: { libelle: string; href?: string; onClick?: () => void }
  actionSecondaire?: { libelle: string; href: string }
  icone?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[10px] border border-dashed border-g-300 bg-g-050 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] bg-p-100 text-p-600">
        {icone ?? <CloudOff size={24} />}
      </span>
      <h3 className="type-h2">{titre}</h3>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-g-500">{phrase}</p>
      {(action || actionSecondaire) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action &&
            (action.href ? (
              <ButtonLink href={action.href}>{action.libelle}</ButtonLink>
            ) : (
              <Button onClick={action.onClick}>{action.libelle}</Button>
            ))}
          {actionSecondaire && (
            <ButtonLink variant="secondary" href={actionSecondaire.href}>
              {actionSecondaire.libelle}
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  )
}

/** 3 — Erreur : message français, cause probable, reprise, identifiant. */
export function ErrorState({
  titre = 'Cette section n’a pas pu être chargée',
  cause,
  reprise,
  seed = 'erreur',
  className,
}: {
  titre?: string
  cause: string
  reprise?: string
  seed?: string
  className?: string
}) {
  return (
    <Card className={cn('border-err/25 bg-err-bg', className)}>
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white text-err">
          <ServerCrash size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="type-h3">{titre}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-g-700">
            <span className="font-semibold">Cause probable — </span>
            {cause}
          </p>
          {reprise && (
            <p className="mt-1 text-[13px] leading-relaxed text-g-700">
              <span className="font-semibold">Que faire — </span>
              {reprise}
            </p>
          )}
          <div className="mt-3 max-w-sm">
            <CopyField
              label="Identifiant de corrélation"
              value={correlationId(seed)}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

/** 4 — Droits insuffisants : bandeau nommant le rôle requis, écran grisé. */
export function PermissionDenied({
  message,
  children,
  className,
}: {
  message: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-start gap-3 rounded-[8px] border border-warn/40 bg-warn-bg px-4 py-3">
        <Lock size={16} className="mt-0.5 shrink-0 text-warn" />
        <div>
          <p className="text-[13px] font-semibold text-ink">{message}</p>
          <p className="mt-0.5 text-[13px] text-g-700">
            L’écran reste consultable en lecture. Toute tentative d’action est journalisée dans
            l’audit de votre organisation.
          </p>
        </div>
      </div>
      {children && (
        <div className="pointer-events-none select-none opacity-55 grayscale-[35%]">{children}</div>
      )}
    </div>
  )
}

/** 5 — Dégradé : une intégration externe ne répond pas. */
export function DegradedState({
  source = 'supervision',
  hauteur = 'h-40',
  className,
  integration,
  dateDonnees,
}: {
  source?: string
  hauteur?: string
  className?: string
  /** Intégration amont en cause (`424`) : nommée au lieu du « ne répond pas » générique. */
  integration?: string
  /** Date des dernières données connues (`424`), affichée telle quelle. */
  dateDonnees?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-g-300 bg-g-050 px-4 text-center',
        hauteur,
        className,
      )}
    >
      <AlertTriangle size={18} className="text-warn" />
      <p className="text-[13px] font-semibold text-g-700">Données de {source} indisponibles</p>
      <p className="max-w-xs text-[12px] leading-relaxed text-g-500">
        {integration ? (
          <>L’intégration « {integration} » ne répond pas actuellement. </>
        ) : (
          <>L’intégration ne répond pas actuellement. </>
        )}
        {dateDonnees ? (
          <>Dernières données connues : {dateDonnees}. </>
        ) : null}
        Le reste de la page reste utilisable ; les données réapparaîtront automatiquement.
      </p>
    </div>
  )
}
