'use client'

import Link from 'next/link'
import { relatif } from '@/lib/format'
import { PROJETS, SERVICES_PROJET, pointsRestaurationDuService } from '@/lib/mock'
import type { Projet, ServiceProjet } from '@/lib/types'
import { useCollection } from '@/components/app/atelier'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { useMaintenant } from '@/components/app/contexte'

export default function BackupTousProjets() {
  const maintenant = useMaintenant()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const proteges = lesServices.items.filter((s) => s.sauvegarde)
  const nus = lesServices.items.filter(
    (s) => !s.sauvegarde && s.type !== 'statique' && s.type !== 'cron',
  )
  const volume = proteges.reduce(
    (a, s) => a + pointsRestaurationDuService(s.id).reduce((b, p) => b + p.tailleGo, 0),
    0,
  )
  const dernier = proteges.reduce(
    (a, s) => (s.sauvegarde!.dernier > a ? s.sauvegarde!.dernier : a),
    '1970-01-01T00:00:00Z',
  )

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Applications', href: '/app/applications' },
          { label: 'Sauvegardes' },
        ]}
        titre="Sauvegardes applicatives"
        sousTitre="Ce qui est protégé dans vos projets, et ce qui ne l’est pas. Choisissez un projet dans le panneau de gauche pour ses points de restauration et son bouton de restauration."
        actions={
          <ButtonLink href="/app/sauvegarde" variant="secondary">
            Plans réutilisables & PRA
          </ButtonLink>
        }
        meta={
          <Badge tone={nus.length > 0 ? 'warn' : 'ok'} dot>
            {proteges.length} sur {lesServices.items.length} services protégés
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Services protégés"
          valeur={proteges.length}
          detail={`sur ${lesServices.items.length}`}
          ton={nus.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Sans plan"
          valeur={nus.length}
          ton={nus.length > 0 ? 'err' : 'ok'}
          detail="hors services sans état"
        />
        <StatTile
          libelle="Volume conservé"
          valeur={`${volume.toFixed(0)} Go`}
          detail="tous points confondus"
        />
        <StatTile
          libelle="Dernière exécution"
          valeur={relatif(dernier, maintenant)}
          detail="tous projets confondus"
          ton="ok"
        />
      </div>

      {nus.length > 0 && (
        <Callout
          ton="warn"
          titre={`${nus.length} service${nus.length > 1 ? 's' : ''} sans plan de sauvegarde`}
        >
          Ces services détiennent un état que rien ne protège : une base, un volume ou une file.
          Les sites statiques et les tâches planifiées n’y figurent pas — ils n’ont rien à perdre
          entre deux exécutions.
        </Callout>
      )}

      <Card>
        <CardHeader
          titre="Couverture par projet"
          sousTitre="Un projet dont tous les services à état sont protégés est prêt pour un audit ; les autres ne le sont pas."
        />
        <div className="space-y-3">
          {lesProjets.items.map((p) => {
            const services = lesServices.items.filter((x) => x.projetId === p.id)
            const aEtat = services.filter((s) => s.type !== 'statique' && s.type !== 'cron')
            const couverts = aEtat.filter((s) => s.sauvegarde)
            const complet = aEtat.length > 0 && couverts.length === aEtat.length
            return (
              <div key={p.id} className="rounded-[8px] border border-g-300 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <Link
                      href={`/app/applications/backup/${p.id}`}
                      className="block truncate text-[13px] font-bold text-ink hover:text-p-700"
                    >
                      {p.nom}
                    </Link>
                    <span className="block text-[12px] text-g-500">
                      {aEtat.length} service{aEtat.length > 1 ? 's' : ''} à état ·{' '}
                      {services.length - aEtat.length} sans état
                    </span>
                  </span>
                  <Badge tone={complet ? 'ok' : couverts.length > 0 ? 'warn' : 'err'} size="sm" dot>
                    {complet
                      ? 'Couverture complète'
                      : `${couverts.length} sur ${aEtat.length} protégés`}
                  </Badge>
                </div>
                <QuotaBar
                  className="mt-2.5"
                  libelle="Services à état protégés"
                  utilise={couverts.length}
                  total={Math.max(1, aEtat.length)}
                  compact
                  formateur={(v) => `${v}`}
                />
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="violet" titre="Deux endroits, deux questions">
          Ici on répond à « ce projet est-il protégé, et jusqu’où puis-je revenir ? ».{' '}
          <Link href="/app/sauvegarde" className="font-semibold text-p-700 hover:underline">
            Sauvegardes &amp; PRA
          </Link>{' '}
          répond à « quels plans couvrent quoi, et que montre-t-on à un auditeur ? » — plans
          réutilisables, restauration granulaire, conformité 3-2-1.
        </Callout>
        <Callout ton="info" titre="Ce que la rétention interdit">
          Un point écrit ne peut être ni modifié ni supprimé avant la fin de sa rétention, ni par
          vous, ni par nous — un attaquant qui obtient vos droits n’obtient pas celui d’effacer vos
          sauvegardes.
        </Callout>
      </div>
    </div>
  )
}
