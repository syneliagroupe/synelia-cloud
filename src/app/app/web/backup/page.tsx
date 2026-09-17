'use client'

import Link from 'next/link'
import { HardDrive, Lock, RotateCcw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateHeure, relatif } from '@/lib/format'
import { SITE_LABEL } from '@/lib/types'
import { SAUVEGARDES_WEB, sauvegardesWebDeLOrg, type SauvegardeWeb } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'
import { useMaintenant } from '@/components/app/contexte'

export default function ListeSauvegardes() {
  const maintenant = useMaintenant()
  const collection = useCollection<SauvegardeWeb>('sauvegardes-web', SAUVEGARDES_WEB)
  const plans = estActif() ? collection.items : sauvegardesWebDeLOrg()
  const echecs = plans.flatMap((p) => p.executions).filter((e) => e.statut !== 'ok')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'Sauvegardes' },
        ]}
        titre="Sauvegardes"
        sousTitre="Un plan par hébergement, qui prend les fichiers, les bases, la configuration et la messagerie dans la même exécution. Les copies sont immuables et vivent sur l’autre site."
      />

      <Callout ton="info" titre="Ce que la rétention interdit">
        Une copie écrite ne peut plus être modifiée ni supprimée avant la fin de sa rétention — ni par
        vous, ni par nous, ni par un rançongiciel qui aurait pris la main sur le serveur.
      </Callout>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Plans actifs" valeur={plans.filter((p) => p.actif).length} detail={`sur ${plans.length}`} />
        <StatTile
          libelle="Espace conservé"
          valeur={`${plans.reduce((a, p) => a + p.espaceOccupeGo, 0).toFixed(0)} Go`}
          detail="toutes rétentions"
        />
        <StatTile
          libelle="Dernière exécution"
          valeur={plans[0]?.executions[0] ? relatif(plans[0].executions[0].ts, maintenant) : '—'}
          ton="ok"
        />
        <StatTile
          libelle="Exécutions incomplètes"
          valeur={echecs.length}
          detail="sur la période conservée"
          ton={echecs.length > 0 ? 'warn' : 'ok'}
        />
      </div>

      {plans.map((p) => (
        <Card key={p.id}>
          <CardHeader
            titre={
              <Link
                href={`/app/web/backup/${p.id}`}
                className="font-mono text-[14px] hover:text-p-700"
              >
                {p.nomServi}
              </Link>
            }
            sousTitre={`${p.serveur} · ${p.frequence} à ${p.heure} · rétention ${p.retentionJours} jours · ${p.destination}`}
            actions={
              <span className="flex items-center gap-2">
                {p.immuable && (
                  <Badge tone="ok" size="sm">
                    <Lock size={10} className="mr-1 inline" />
                    Immuable
                  </Badge>
                )}
                <ButtonLink href={`/app/web/backup/${p.id}`} variant="secondary" size="sm">
                  Ouvrir
                </ButtonLink>
              </span>
            }
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['Fichiers', p.perimetre.fichiers],
                ['Bases', p.perimetre.bases],
                ['Configuration', p.perimetre.configuration],
                ['Messagerie', p.perimetre.messagerie],
              ] as const
            ).map(([l, actif]) => (
              <div
                key={l}
                className={cn(
                  'rounded-[6px] border px-2.5 py-2 text-center',
                  actif ? 'border-ok bg-ok-bg' : 'border-g-300 bg-g-050',
                )}
              >
                <p className="type-micro text-g-500">{l}</p>
                <p
                  className={cn(
                    'mt-0.5 text-[12px] font-bold',
                    actif ? 'text-ok' : 'text-g-500',
                  )}
                >
                  {actif ? 'Inclus' : 'Exclu'}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 overflow-x-auto border-t border-g-100 pt-3">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Exécution', 'Taille', 'Durée', 'Contenu', 'Immuable jusqu’au', 'État'].map(
                    (c) => (
                      <th
                        key={c}
                        className="type-micro px-3 py-2 text-left font-semibold text-g-500"
                      >
                        {c}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {p.executions.slice(0, 3).map((e) => (
                  <tr key={e.id} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{dateHeure(e.ts)}</td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{e.taille}</td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{e.dureeMin} min</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-500">
                      {e.contenu.join(' · ')}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">
                      {e.immuableJusqua ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={e.statut === 'ok' ? 'ok' : e.statut === 'partielle' ? 'warn' : 'err'}
                        size="sm"
                      >
                        {e.statut === 'ok' ? 'OK' : e.statut === 'partielle' ? 'Partielle' : 'Échec'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <Card>
        <CardHeader
          titre="La règle 3-2-1, appliquée à votre hébergement"
          sousTitre="Trois copies, sur deux supports, dont une hors site. C’est ce qu’un auditeur vérifie, et c’est ce qui sauve réellement."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              t: 'Trois copies',
              d: 'La production, la copie immuable du jour, et les copies antérieures encore sous rétention.',
              i: <HardDrive size={14} />,
            },
            {
              t: 'Deux supports',
              d: 'Le disque du serveur et le stockage objet, qui ne partagent ni matériel ni logiciel.',
              i: <ShieldCheck size={14} />,
            },
            {
              t: 'Une hors site',
              d: `Vos copies partent sur ${SITE_LABEL[plans[0]?.site ?? 'GBM']}, à des dizaines de kilomètres du serveur.`,
              i: <RotateCcw size={14} />,
            },
          ].map((c) => (
            <div key={c.t} className="rounded-[8px] border border-g-300 bg-g-050 p-3">
              <p className="flex items-center gap-1.5 text-p-700">{c.i}</p>
              <p className="mt-1.5 text-[13px] font-bold text-ink">{c.t}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-g-700">{c.d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
