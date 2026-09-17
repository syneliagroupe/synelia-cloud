'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Clock, Database, ExternalLink, FileCode2, Rocket, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, relatif } from '@/lib/format'
import { SITE_COURT, type ServiceProjet, type TypeServiceProjet } from '@/lib/types'
import { MOTEUR_LABEL, TYPE_SERVICE_LABEL, domainesDuService } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Card, PageHeader } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import type { Projet } from '@/lib/types'
import { useMaintenant } from '@/components/app/contexte'

/**
 * En-tête commun aux sections d'un projet.
 *
 * Les sept sections d'Applications décrivent le même objet sous sept angles :
 * le fil d'Ariane et le nom du projet doivent donc être identiques partout,
 * sinon on doute d'être resté sur le même projet en changeant d'onglet.
 */
/**
 * Ce qu'affiche une section quand le projet demandé n'existe pas.
 *
 * Le serveur ne répond plus 404 sur ces routes : un projet créé pendant la
 * session n'existe pas dans le jeu figé, et une page d'erreur du serveur
 * ferait croire à une panne. C'est donc la vue qui dit ce qu'elle ne trouve pas.
 */
export function ProjetIntrouvable({ section }: { section?: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Applications', href: '/app/applications' },
          { label: 'Projet introuvable' },
        ]}
        titre="Ce projet n’existe plus"
        sousTitre={
          section
            ? `La section ${section} porte sur un projet ; celui-ci a été supprimé, ou n’a jamais existé.`
            : undefined
        }
      />
      <EmptyState
        titre="Ce projet n’existe plus"
        phrase="Il a peut-être été supprimé depuis ses paramètres, ou la démonstration a été réinitialisée. Le panneau de gauche liste les projets existants."
        action={{ libelle: 'Voir tous les projets', href: '/app/applications/projets' }}
      />
    </div>
  )
}

export function EnteteProjet({
  projet,
  section,
  titre,
  sousTitre,
  actions,
  meta,
}: {
  projet: Projet
  /** Nom de la section, dernier maillon du fil. Absent sur la fiche du projet. */
  section?: string
  titre?: ReactNode
  sousTitre?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <PageHeader
      fil={[
        { label: 'Espace client', href: '/app' },
        { label: 'Applications', href: '/app/applications' },
        section
          ? { label: projet.nom, href: `/app/applications/projets/${projet.id}` }
          : { label: projet.nom },
        ...(section ? [{ label: section }] : []),
      ]}
      titre={titre ?? projet.nom}
      sousTitre={sousTitre}
      actions={actions}
      meta={meta}
    />
  )
}

/** Icône par type de service — le même repère visuel dans tout l'univers. */
export const ICONE_TYPE: Record<TypeServiceProjet, ReactNode> = {
  application: <Rocket size={13} />,
  base: <Database size={13} />,
  statique: <FileCode2 size={13} />,
  cron: <Clock size={13} />,
  worker: <Workflow size={13} />,
}

const TON_STATUT: Record<ServiceProjet['statut'], 'ok' | 'warn' | 'err' | 'neutral' | 'info'> = {
  running: 'ok',
  degraded: 'warn',
  failed: 'err',
  stopped: 'neutral',
  building: 'info',
}

const LIBELLE_STATUT: Record<ServiceProjet['statut'], string> = {
  running: 'En ligne',
  degraded: 'Dégradé',
  failed: 'En échec',
  stopped: 'Arrêté',
  building: 'Construction',
}

export function StatutServiceBadge({
  statut,
  size = 'sm',
}: {
  statut: ServiceProjet['statut']
  size?: 'sm' | 'md'
}) {
  return (
    <Badge tone={TON_STATUT[statut]} dot size={size}>
      {LIBELLE_STATUT[statut]}
    </Badge>
  )
}

export function couleurStatut(statut: ServiceProjet['statut']): string {
  return {
    running: 'text-ok',
    degraded: 'text-warn',
    failed: 'text-err',
    stopped: 'text-g-500',
    building: 'text-p-700',
  }[statut]
}

/**
 * Carte d'un service dans la grille d'un projet. Chaque type montre ce qui le
 * caractérise plutôt qu'un tronc commun tiède : une base affiche son moteur et
 * sa dernière sauvegarde, une tâche planifiée sa prochaine exécution.
 */
export function CarteService({ service }: { service: ServiceProjet }) {
  const maintenant = useMaintenant()
  const domaines = domainesDuService(service.id)
  const href = `/app/applications/projets/${service.projetId}/${service.id}`

  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-p-050',
              couleurStatut(service.statut),
            )}
          >
            {ICONE_TYPE[service.type]}
          </span>
          <span className="min-w-0">
            <Link
              href={href}
              className="block truncate font-mono text-[13px] font-bold text-ink hover:text-p-700"
            >
              {service.nom}
            </Link>
            <span className="block text-[11px] text-g-500">
              {TYPE_SERVICE_LABEL[service.type]}
              {service.moteur && ` · ${MOTEUR_LABEL[service.moteur]} ${service.version}`}
            </span>
          </span>
        </span>
        <StatutServiceBadge statut={service.statut} />
      </div>

      <dl className="mt-3.5 space-y-1.5 border-t border-g-100 pt-3">
        {service.type === 'base' && service.base && (
          <>
            <Ligne cle="Hôte interne">
              <span className="font-mono text-[11.5px]">{service.base.hoteInterne}</span>
            </Ligne>
            <Ligne cle="Port">
              <span className="tnum font-mono">{service.base.port}</span>
            </Ligne>
            <Ligne cle="Dernière sauvegarde">
              {service.sauvegarde ? (
                <span>
                  {relatif(service.sauvegarde.dernier, maintenant)} · {service.sauvegarde.taille}
                </span>
              ) : (
                <span className="text-warn">aucun plan</span>
              )}
            </Ligne>
          </>
        )}

        {service.cron && (
          <>
            <Ligne cle="Planification">
              <span className="font-mono text-[11.5px]">{service.cron.expression}</span>
            </Ligne>
            <Ligne cle="Dernière exécution">
              <span className={service.cron.statut === 'echec' ? 'text-err' : undefined}>
                {relatif(service.cron.derniereExecution, maintenant)} ·{' '}
                {service.cron.statut === 'echec' ? 'échec' : 'succès'}
              </span>
            </Ligne>
            <Ligne cle="Prochaine">{relatif(service.cron.prochaine, maintenant)}</Ligne>
          </>
        )}

        {service.file && (
          <>
            <Ligne cle="File d’attente">
              <span className="tnum">{service.file.enAttente} en attente</span>
            </Ligne>
            <Ligne cle="Traités aujourd’hui">
              <span className="tnum">{service.file.traitesJour}</span>
            </Ligne>
            <Ligne cle="Échecs du jour">
              <span className={cn('tnum', service.file.echecsJour > 0 && 'text-err')}>
                {service.file.echecsJour}
              </span>
            </Ligne>
          </>
        )}

        {(service.type === 'application' || service.type === 'statique') && (
          <>
            <Ligne cle="Source">
              {service.source ? (
                <span className="truncate font-mono text-[11.5px]">
                  {service.source.ref}
                  {service.source.branche && ` · ${service.source.branche}`}
                </span>
              ) : (
                <span className="text-warn">à configurer</span>
              )}
            </Ligne>
            <Ligne cle="Domaine">
              {domaines.length > 0 ? (
                <a
                  href={`https://${domaines[0].hote}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-p-700 hover:text-m-600"
                >
                  {domaines[0].hote}
                  <ExternalLink size={10} />
                </a>
              ) : (
                <span className="text-g-500">aucun</span>
              )}
            </Ligne>
            {service.portConteneur && (
              <Ligne cle="Port du conteneur">
                <span className="tnum font-mono">{service.portConteneur}</span>
              </Ligne>
            )}
          </>
        )}
      </dl>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-g-100 pt-3">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" size="sm">
            {SITE_COURT[service.emplacement.site]}
          </Badge>
          <span className="font-mono text-[11px] text-g-500">{service.emplacement.backend}</span>
        </span>
        <span className="tnum text-[11.5px] font-semibold text-ink">
          {service.coutMensuel === 0 ? 'arrêté · 0 FCFA' : `${money(service.coutMensuel)}/mois`}
        </span>
      </div>
    </Card>
  )
}

function Ligne({ cle, children }: { cle: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[11.5px] text-g-500">{cle}</dt>
      <dd className="min-w-0 truncate text-[12px] font-medium text-ink">{children}</dd>
    </div>
  )
}

/**
 * Emplacement réel d'exécution. Exposé volontairement (§5.4) : le client a le
 * droit de savoir sur quelle machine et sur quel socle tourne son service.
 */
export function EmplacementReel({ service }: { service: ServiceProjet }) {
  return (
    <div className="rounded-[8px] border border-g-300 bg-g-050 p-3">
      <MicroLabel>Emplacement réel d’exécution</MicroLabel>
      <dl className="mt-2 space-y-1.5">
        <Ligne cle="Site physique">
          {service.emplacement.site} · {SITE_COURT[service.emplacement.site]}
        </Ligne>
        <Ligne cle="Socle technique">
          <span className="font-mono text-[11.5px]">{service.emplacement.backend}</span>
        </Ligne>
        {service.emplacement.vms && (
          <Ligne cle="Machines">
            <span className="font-mono text-[11.5px]">
              {service.emplacement.vms.join(', ')}
            </span>
          </Ligne>
        )}
        {service.emplacement.namespace && (
          <Ligne cle="Namespace Kubernetes">
            <span className="font-mono text-[11.5px]">{service.emplacement.namespace}</span>
          </Ligne>
        )}
      </dl>
      <p className="mt-2.5 text-[11px] leading-relaxed text-g-500">
        Nous affichons cet emplacement plutôt que de le masquer. Le rééquilibrage de charge reste
        notre décision, mais vous savez toujours où vos données s’exécutent.
      </p>
    </div>
  )
}
