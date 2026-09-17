'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Globe } from 'lucide-react'
import { dateCourte } from '@/lib/format'
import { SITE_LABEL, type Projet, type ServiceProjet } from '@/lib/types'
import {
  DOMAINES_APPLICATIFS,
  ZONE_APPLICATIVE,
  PROJETS,
  SERVICES_PROJET,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { CopyField } from '@/components/ui/display'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useCollection } from '@/components/app/atelier'
import { useServicesProjet } from '@/lib/api/services-projet'
import { EnteteProjet, ProjetIntrouvable } from '@/components/business/projets'

const ETAT_CERT = {
  actif: { ton: 'ok' as const, label: 'Certificat actif' },
  en_emission: { ton: 'info' as const, label: 'Certificat en émission' },
  echec: { ton: 'err' as const, label: 'Certificat en échec' },
  aucun: { ton: 'neutral' as const, label: 'Sans certificat' },
}

export function VueRoutage({ id }: { id: string }) {
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)

  const projet = lesProjets.items.find((p) => p.id === id)
  // Avec l’API, la liste vient de `GET /projets/{id}/services` (route nichée,
  // hors registre) ; en maquette, du filtre local.
  const { distants: servicesDistants } = useServicesProjet(id)
  const services = useMemo(
    () => servicesDistants ?? lesServices.items.filter((x) => x.projetId === id),
    [servicesDistants, lesServices.items, id],
  )

  if (!projet) return <ProjetIntrouvable />
  const ids = new Set(services.map((s) => s.id))
  const domaines = DOMAINES_APPLICATIFS.filter((d) => ids.has(d.serviceId))

  const propres = domaines.filter((d) => d.origine !== 'genere')
  const aVerifier = domaines.filter((d) => d.verification && d.verification.etat !== 'ok')

  return (
    <div className="space-y-5">
      <EnteteProjet
        projet={projet}
        section="Domaines & routage"
        titre="Domaines & routage"
        sousTitre="Les adresses par lesquelles on entre dans ce projet. Chacune vise un service et un port précis : le projet n’est qu’un regroupement, il ne répond à aucune adresse en propre."
        meta={
          <>
            <Badge tone="neutral">
              {domaines.length} hôte{domaines.length > 1 ? 's' : ''}
            </Badge>
            <Badge tone="violet">{domaines.length - propres.length} sur la zone offerte</Badge>
            {aVerifier.length > 0 && (
              <Badge tone="warn" dot>
                {aVerifier.length} à vérifier
              </Badge>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Hôtes du projet" valeur={domaines.length} />
        <StatTile
          libelle="Vos propres domaines"
          valeur={propres.length}
          detail={`${domaines.length - propres.length} sur ${ZONE_APPLICATIVE.zone}`}
        />
        <StatTile
          libelle="Certificats actifs"
          valeur={domaines.filter((d) => d.certificat.etat === 'actif').length}
          ton={domaines.some((d) => d.certificat.etat === 'echec') ? 'err' : 'ok'}
        />
        <StatTile
          libelle="Vérifications en attente"
          valeur={aVerifier.length}
          ton={aVerifier.length > 0 ? 'warn' : 'ok'}
          detail={aVerifier.length > 0 ? 'certificat non émis tant qu’elle échoue' : 'toutes vues'}
        />
      </div>

      {domaines.length === 0 ? (
        <EmptyState
          titre="Aucun domaine sur ce projet"
          phrase="Les services de ce projet ne sont pas exposés sur le web : une base, une tâche planifiée ou un worker n’ont pas d’adresse publique. Une application ou un site statique en reçoit une dès son premier déploiement."
          icone={<Globe size={22} />}
          action={{ libelle: 'Voir tous les domaines', href: '/app/applications/routage' }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {domaines.map((d) => {
            const svc = services.find((s) => s.id === d.serviceId)!
            const cert = ETAT_CERT[d.certificat.etat]
            return (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <a
                      href={`https://${d.hote}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-mono text-[13px] font-bold text-ink hover:text-p-700"
                    >
                      {d.hote}
                      {d.chemin !== '/' && <span className="text-g-500">{d.chemin}</span>}
                    </a>
                    <Link
                      href={`/app/applications/projets/${projet.id}/${svc.id}`}
                      className="block truncate text-[11px] text-g-500 hover:text-p-700"
                    >
                      {svc.nom} · {svc.environnement} · port {d.portConteneur}
                    </Link>
                  </span>
                  <Badge tone={d.origine === 'genere' ? 'violet' : 'neutral'} size="sm">
                    {d.origine === 'genere' ? 'Offert' : 'Votre domaine'}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-g-100 pt-3">
                  <Badge tone={cert.ton} size="sm">
                    {cert.label}
                  </Badge>
                  {d.certificat.expire && (
                    <span className="text-[12px] text-g-500">
                      renouvellement le {dateCourte(d.certificat.expire)}
                    </span>
                  )}
                  <Badge tone={d.https ? 'ok' : 'warn'} size="sm">
                    {d.https ? 'HTTPS forcé' : 'HTTP seulement'}
                  </Badge>
                </div>

                {d.verification && d.verification.etat !== 'ok' && (
                  <Callout
                    ton={d.verification.etat === 'echec' ? 'err' : 'warn'}
                    className="mt-3"
                    titre={
                      d.verification.etat === 'echec'
                        ? 'Vérification en échec'
                        : 'Vérification en attente'
                    }
                  >
                    Ajoutez cet enregistrement chez votre hébergeur DNS. Tant qu’il n’est pas vu,
                    le certificat n’est pas émis et l’hôte ne répond pas en HTTPS.
                    <CopyField
                      className="mt-2"
                      label={`${d.verification.enregistrement.type} ${d.verification.enregistrement.nom}`}
                      value={d.verification.enregistrement.valeur}
                    />
                  </Callout>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader
          titre="Où pointer votre DNS"
          sousTitre="Les adresses d’entrée de la plateforme, par site. Un enregistrement A ou AAAA vers l’une d’elles suffit."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ZONE_APPLICATIVE.ingress.map((i) => (
            <div key={i.site} className="rounded-[8px] border border-g-300 bg-g-050 p-3">
              <p className="type-micro text-g-500">{SITE_LABEL[i.site]}</p>
              <div className="mt-2 space-y-2">
                <CopyField label="A" value={i.ip} />
                <CopyField label="AAAA" value={i.ipv6} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-g-500">
          {ZONE_APPLICATIVE.quotaDomaines.utilises} domaines personnalisés sur{' '}
          {ZONE_APPLICATIVE.quotaDomaines.total} pour l’organisation. La vue complète, tous projets
          confondus, est dans{' '}
          <Link
            href="/app/applications/routage"
            className="font-semibold text-p-700 hover:underline"
          >
            la racine de cette section
          </Link>
          .
        </p>
      </Card>
    </div>
  )
}
