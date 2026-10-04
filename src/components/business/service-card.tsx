import Link from 'next/link'
import { ExternalLink, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateHeure, money, pct } from '@/lib/format'
import { SITE_COURT, type CatalogService, type ManagedService } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { SolutionLogo } from '@/components/ui/display'
import { HealthBadge, QuotaBar } from '@/components/composition/metrics'

/**
 * Carte d'un service managé (§1.4, §6.5).
 *
 * Point le plus important de l'espace client : deux boutons visuellement
 * très différents. « Ouvrir » est magenta avec une icône de lien externe —
 * il déclenche la redirection SSO et signale qu'on quitte le portail.
 * « Administrer » est violet secondaire et reste dans le portail.
 */
export function ServiceCard({
  service,
  catalogue,
  compact,
  hrefAdmin,
  className,
}: {
  service: ManagedService
  catalogue?: CatalogService
  compact?: boolean
  /**
   * Où l'administration se fait. Elle n'a plus d'adresse unique : un service
   * partagé se règle sur la fiche de son hébergement, un service dédié sur la
   * fiche de son service dans le projet.
   */
  hrefAdmin?: string
  compactClassName?: never
  className?: string
}) {
  const pretAOuvrir = service.statut !== 'provisioning' && service.statut !== 'erreur'

  return (
    <div
      className={cn(
        'flex flex-col rounded-[10px] border border-g-300 bg-white p-4 shadow-[0_1px_2px_rgba(43,27,77,.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(43,27,77,.1)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <SolutionLogo
          initiales={catalogue?.logoInitiales ?? service.nom.slice(0, 2).toUpperCase()}
          teinte={catalogue?.logoTeinte ?? '#4B2882'}
          icone={catalogue?.icone}
          size={compact ? 'sm' : 'md'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-h3 truncate">{service.nom}</h3>
            <HealthBadge etat={service.statut} size="sm" />
          </div>
          <p className="mt-0.5 truncate text-[12px] text-g-500">
            {catalogue?.solutionOSS ?? '—'} · v{service.version}
          </p>
        </div>
      </div>

      {!compact && (
        <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2">
          <Meta cle="Mode & site" valeur={`${service.mode === 'dedie' ? 'Dédié' : 'Mutualisé'} · ${SITE_COURT[service.site]}`} />
          <Meta cle="Domaine" valeur={service.domaine} mono />
          <Meta
            cle="Dernière sauvegarde"
            valeur={service.derniereSauvegarde ? dateHeure(service.derniereSauvegarde) : '— aucune'}
          />
          <Meta
            cle="Disponibilité 30 j"
            valeur={service.uptime30j > 0 ? pct(service.uptime30j, 2) : '—'}
          />
        </dl>
      )}

      <div className="mt-3.5">
        <QuotaBar
          libelle="Sièges"
          utilise={service.siegesUtilises}
          total={service.siegesSouscrits}
          unite="sièges"
          seuil={90}
          compact
        />
      </div>

      {service.versionDisponible && (
        <p className="mt-2.5 text-[12px] text-m-600">
          Version {service.versionDisponible} disponible
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-g-100 pt-3.5">
        {pretAOuvrir ? (
          <ButtonLink
            href={service.urlNative}
            external
            variant="accent"
            size="sm"
            iconAfter={<ExternalLink size={13} />}
            className="flex-1"
          >
            Ouvrir
          </ButtonLink>
        ) : (
          <span className="flex-1 rounded-[6px] bg-g-100 px-3 py-1.5 text-center text-[13px] font-semibold text-g-500">
            {service.statut === 'provisioning' ? 'Provisioning en cours' : 'Indisponible'}
          </span>
        )}
        <ButtonLink
          href={hrefAdmin ?? '/app/web/emails'}
          variant="secondary"
          size="sm"
          iconBefore={<Settings2 size={13} />}
        >
          Administrer
        </ButtonLink>
      </div>
      {!compact && (
        <p className="mt-2 text-[11px] text-g-500">
          « Ouvrir » vous redirige en SSO vers l’interface de {catalogue?.solutionOSS ?? 'la solution'}.
          Coût actuel : {money(service.coutMensuel)}/mois.
        </p>
      )}
    </div>
  )
}

function Meta({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="type-micro text-g-500">{cle}</dt>
      <dd className={cn('mt-0.5 truncate text-[13px] text-ink', mono && 'font-mono text-[12px]')}>
        {valeur}
      </dd>
    </div>
  )
}

/** Carte du catalogue public ou interne (§2.5, §6.2). */
export function CatalogCard({
  service,
  href,
  className,
}: {
  service: CatalogService
  href: string
  className?: string
}) {
  const prixEntree = service.paliers.reduce<{ valeur: number; unite: string } | null>((acc, p) => {
    const v = p.prixSiege || p.prixMois
    if (v === undefined) return acc
    const unite = p.prixSiege ? '/siège/mois' : '/mois'
    if (!acc || v < acc.valeur) return { valeur: v, unite }
    return acc
  }, null)

  return (
    <Link
      href={href}
      className={cn(
        // Même carte que les produits de l'accueil : crème, coins larges, pas de
        // bordure colorée. Le fond du pictogramme est exactement `creme`, donc
        // sur une carte blanche il laissait un carré beige visible.
        'group flex flex-col rounded-[22px] border-2 border-encre-2/10 bg-creme p-5 transition-transform hover:-translate-y-1.5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <SolutionLogo
          initiales={service.logoInitiales}
          teinte={service.logoTeinte}
          icone={service.icone}
          size="lg"
        />
        <Badge tone={service.certifie ? 'violet' : 'neutral'} size="sm">
          {service.certifie ? 'Certifié Synelia' : 'Communauté'}
        </Badge>
      </div>
      <h3 className="type-h3 mt-3">{service.nom}</h3>
      <p className="mt-0.5 text-[12px] font-semibold text-encre-2/55">{service.solutionOSS}</p>
      <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-encre-2/70">
        {service.pitch}
      </p>
      <div className="mt-3.5 flex items-end justify-between gap-2 border-t border-encre-2/10 pt-3">
        <div>
          <p className="type-micro text-encre-2/55">À partir de</p>
          <p className="tnum mt-0.5 text-[15px] font-bold [font-family:var(--font-display)] text-p-700">
            {prixEntree ? money(prixEntree.valeur) : 'Sur devis'}
            {prixEntree && (
              <span className="text-[11px] font-semibold text-g-500">{prixEntree.unite}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {service.modes.map((m) => (
            <Badge key={m} tone="neutral" size="sm">
              {m === 'dedie' ? 'Dédié' : 'Mutualisé'}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  )
}

/** Grande tuile du lanceur d'applications (§6.7). */
export function AppLauncherTile({
  service,
  catalogue,
  className,
}: {
  service: ManagedService
  catalogue?: CatalogService
  className?: string
}) {
  return (
    <a
      href={service.urlNative}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex flex-col items-start gap-3 rounded-[14px] border border-g-300 bg-white p-5 shadow-[0_1px_2px_rgba(43,27,77,.06)] transition-all hover:-translate-y-0.5 hover:border-m-600 hover:shadow-[0_8px_28px_rgba(43,27,77,.14)]',
        className,
      )}
    >
      <div className="flex w-full items-start justify-between">
        <SolutionLogo
          initiales={catalogue?.logoInitiales ?? service.nom.slice(0, 2).toUpperCase()}
          teinte={catalogue?.logoTeinte ?? '#4B2882'}
          icone={catalogue?.icone}
          size="lg"
        />
        <ExternalLink
          size={15}
          className="text-g-300 transition-colors group-hover:text-m-600"
        />
      </div>
      <div>
        <h3 className="text-[15px] font-bold [font-family:var(--font-display)] text-ink group-hover:text-m-600">
          {service.nom}
        </h3>
        <p className="mt-0.5 text-[13px] text-g-500">
          {catalogue?.pitch ?? service.domaine}
        </p>
      </div>
    </a>
  )
}
