'use client'

import Link from 'next/link'
import {
  EVENEMENTS_SUPERVISION,
  PROJETS,
  SERVICES_PROJET,
} from '@/lib/mock'
import type { Projet, ServiceProjet } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'
import { EventList, LiensSortie } from '@/components/business/observabilite'

export default function ObservabiliteTousProjets() {
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const enEchec = lesServices.items.filter((s) => s.statut === 'failed')
  const degrades = lesServices.items.filter((s) => s.statut === 'degraded')
  const enMarche = lesServices.items.filter((s) => s.statut === 'running')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Applications', href: '/app/applications' },
          { label: 'Observabilité' },
        ]}
        titre="Observabilité applicative"
        sousTitre="L’état de tous les projets d’un coup d’œil. Choisissez un projet dans le panneau de gauche pour ses courbes, ses événements et son journal récent."
        meta={
          <Badge tone={enEchec.length > 0 ? 'err' : degrades.length > 0 ? 'warn' : 'ok'} dot>
            {enMarche.length} sur {lesServices.items.length} services en marche
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Projets suivis" valeur={lesProjets.items.length} />
        <StatTile
          libelle="Services en marche"
          valeur={enMarche.length}
          detail={`sur ${lesServices.items.length}`}
          ton="ok"
        />
        <StatTile
          libelle="Dégradés"
          valeur={degrades.length}
          ton={degrades.length > 0 ? 'warn' : 'ok'}
          detail="répondent hors de leurs seuils"
        />
        <StatTile
          libelle="En échec"
          valeur={enEchec.length}
          ton={enEchec.length > 0 ? 'err' : 'ok'}
          detail="ne répondent plus"
        />
      </div>

      <Card>
        <CardHeader
          titre="Santé par projet"
          sousTitre="Le détail — courbes, événements, journal — s’ouvre projet par projet."
        />
        <ul className="divide-y divide-g-100">
          {lesProjets.items.map((p) => {
            const services = lesServices.items.filter((x) => x.projetId === p.id)
            const ko = services.filter((s) => s.statut === 'failed').length
            const warn = services.filter((s) => s.statut === 'degraded').length
            const ok = services.filter((s) => s.statut === 'running').length
            return (
              <li key={p.id} className="py-2.5 first:pt-0">
                <Link
                  href={`/app/applications/observabilite/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-ink">{p.nom}</span>
                    <span className="block text-[12px] text-g-500">
                      {services.length} service{services.length > 1 ? 's' : ''} ·{' '}
                      {p.environnements.join(', ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {ko > 0 && (
                      <Badge tone="err" size="sm" dot>
                        {ko} en échec
                      </Badge>
                    )}
                    {warn > 0 && (
                      <Badge tone="warn" size="sm" dot>
                        {warn} dégradé{warn > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Badge tone={ko + warn === 0 ? 'ok' : 'neutral'} size="sm">
                      {ok} en marche
                    </Badge>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <LiensSortie className="mt-4" />
      </Card>

      {/* Le flux d'événements de supervision n'a pas de contrepartie API : en mode API il ne montrerait que la maquette. */}
      {!estActif() && (
        <Card>
          <CardHeader
            titre="Derniers événements de l’organisation"
            sousTitre="Toutes ressources confondues, applicatives ou non."
          />
          <EventList evenements={EVENEMENTS_SUPERVISION} />
        </Card>
      )}

      <Callout ton="info" titre="Quatre formats, et des liens de sortie">
        Le portail montre des indicateurs, une courbe par métrique sur 24 h, 7 j ou 30 j, huit
        événements et vingt lignes de journal. Il ne propose ni constructeur de requêtes ni tableau
        de bord à composer : Grafana, Centreon et VictoriaLogs le font déjà, mieux, et les liens y
        mènent en un clic.
      </Callout>
    </div>
  )
}
