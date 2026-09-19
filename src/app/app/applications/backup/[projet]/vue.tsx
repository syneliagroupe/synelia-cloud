'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { HardDrive, RotateCcw, ShieldAlert } from 'lucide-react'
import { dateHeure, MAINTENANT, relatif } from '@/lib/format'
import type { Projet, ServiceProjet } from '@/lib/types'
import {
  PROJETS,
  SERVICES_PROJET,
  pointsRestaurationDuService,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { ConfirmDialog } from '@/components/ui/overlay'
import { EnteteProjet, ICONE_TYPE, ProjetIntrouvable } from '@/components/business/projets'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { useServicesProjet } from '@/lib/api/services-projet'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'

/**
 * Sauvegardes d'un projet — service par service.
 *
 * La section transverse « Sauvegardes & PRA » d'Infrastructure porte les plans
 * réutilisables et la conformité 3-2-1 qu'on montre à un auditeur. Ici on
 * répond à la question du jour : ce projet est-il protégé, depuis quand, et
 * qu'est-ce que je récupère si je restaure maintenant ?
 */
export function VueBackup({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const executer = useOperation()
  const { autorise, refus } = useApp()
  const [restaurationId, setRestaurationId] = useState<string | null>(null)

  const projet = lesProjets.items.find((p) => p.id === id)
  // Avec l’API, la liste vient de `GET /projets/{id}/services` (route nichée,
  // hors registre) ; en maquette, du filtre local.
  const { distants: servicesDistants } = useServicesProjet(id)
  const services = useMemo(
    () => servicesDistants ?? lesServices.items.filter((x) => x.projetId === id),
    [servicesDistants, lesServices.items, id],
  )
  const restauration = services.find((x) => x.id === restaurationId) ?? null

  if (!projet) return <ProjetIntrouvable section="Sauvegardes" />

  const proteges = services.filter((s) => s.sauvegarde)
  const nus = services.filter((s) => !s.sauvegarde)
  // Un service sans état à perdre n'a rien à sauvegarder : c'est une propriété
  // du type, pas un oubli de configuration.
  const sansEtat = nus.filter((s) => s.type === 'statique' || s.type === 'cron')
  const aRegler = nus.filter((s) => !sansEtat.includes(s))

  const volume = proteges.reduce((a, s) => {
    const pts = pointsRestaurationDuService(s.id)
    return a + pts.reduce((b, p) => b + p.tailleGo, 0)
  }, 0)

  const retentionMin = proteges.length
    ? Math.min(...proteges.map((s) => s.sauvegarde!.retentionJours))
    : 0

  return (
    <div className="space-y-5">
      <EnteteProjet
        projet={projet}
        section="Sauvegardes"
        titre="Sauvegardes du projet"
        sousTitre="Ce qui est protégé dans ce projet, à quelle fréquence, et jusqu’à quand on peut revenir en arrière. Les plans réutilisables et le tableau de conformité 3-2-1 vivent dans Infrastructure."
        meta={
          <>
            <Badge tone={aRegler.length > 0 ? 'warn' : 'ok'} dot>
              {proteges.length} sur {services.length} protégés
            </Badge>
            {retentionMin > 0 && (
              <Badge tone="neutral">rétention la plus courte : {retentionMin} jours</Badge>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Services protégés"
          valeur={proteges.length}
          detail={`sur ${services.length} du projet`}
          ton={aRegler.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Sans plan de sauvegarde"
          valeur={aRegler.length}
          detail={sansEtat.length > 0 ? `${sansEtat.length} sans état à perdre` : 'à décider'}
          ton={aRegler.length > 0 ? 'err' : 'ok'}
        />
        <StatTile
          libelle="Volume conservé"
          valeur={`${volume.toFixed(0)} Go`}
          detail="tous points confondus"
        />
        <StatTile
          libelle="Rétention la plus courte"
          valeur={retentionMin}
          unite="jours"
          detail="au-delà, le point est effacé"
        />
      </div>

      {aRegler.length > 0 && (
        <Callout
          ton="warn"
          titre={`${aRegler.length} service${aRegler.length > 1 ? 's' : ''} sans plan de sauvegarde`}
        >
          <ul className="mt-1 space-y-1">
            {aRegler.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <ShieldAlert size={13} className="mt-0.5 shrink-0 text-warn" />
                <span>
                  <Link
                    href={`/app/applications/projets/${projet.id}/${s.id}`}
                    className="font-semibold underline"
                  >
                    {s.nom}
                  </Link>
                  <span className="ml-1.5 text-g-700">
                    {s.environnement} · si la machine disparaît, ce service repart d’une page
                    blanche.
                  </span>
                  <BoutonFormulaire
                    libelle="Protéger ce service"
                    variant="secondary"
                    className="ml-2"
                    action="backup.plan.write"
                    titre={`Protéger ${s.nom}`}
                    description="Un plan de sauvegarde s’applique à ce service seul. Les plans réutilisables, eux, couvrent plusieurs projets d’un coup et vivent dans Sauvegardes & PRA."
                    libelleValider="Activer la sauvegarde"
                    champs={[
                      {
                        id: 'frequence',
                        label: 'Fréquence',
                        type: 'select',
                        demi: true,
                        options: [
                          { value: '0 2 * * *', label: 'Quotidienne — 02:00 GMT' },
                          { value: '0 */6 * * *', label: 'Toutes les 6 heures' },
                          { value: '0 3 * * 0', label: 'Hebdomadaire — dimanche 03:00' },
                        ],
                      },
                      {
                        id: 'retention',
                        label: 'Rétention',
                        type: 'nombre',
                        demi: true,
                        min: 7,
                        max: 365,
                        suffixe: 'jours',
                      },
                      {
                        id: 'destination',
                        label: 'Destination',
                        type: 'select',
                        options: [
                          { value: 'Grand-Bassam — objet immuable', label: 'Grand-Bassam — objet immuable (hors site)' },
                          { value: 'Abidjan — objet immuable', label: 'Abidjan — objet immuable (même site)' },
                        ],
                      },
                    ]}
                    valeursDepart={{
                      frequence: '0 2 * * *',
                      retention: 30,
                      destination: 'Grand-Bassam — objet immuable',
                    }}
                    complement={(v) =>
                      String(v.destination).startsWith('Abidjan') ? (
                        <Callout ton="warn" titre="Même site que le service">
                          Une sauvegarde qui vit sur le site du service ne protège pas d’un sinistre
                          de site. La règle 3-2-1 demande une copie hors site : c’est Grand-Bassam.
                        </Callout>
                      ) : null
                    }
                    operation={(v) => ({
                      titre: `${s.nom} est désormais sauvegardé`,
                      detail: `Premier point dans l’heure, rétention de ${v.retention} jours, destination ${v.destination}.`,
                      effet: () =>
                        lesServices.modifier(s.id, {
                          sauvegarde: {
                            plan: 'Plan propre au service',
                            cron: String(v.frequence),
                            destination: String(v.destination),
                            dernier: MAINTENANT,
                            retentionJours: Number(v.retention),
                            taille: '—',
                          },
                        }),
                    })}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {proteges.length === 0 ? (
        <EmptyState
          titre="Aucun service sauvegardé dans ce projet"
          phrase="Une sauvegarde se règle par ressource, depuis la fiche du service. Un plan réutilisable peut ensuite couvrir plusieurs projets d’un coup."
          icone={<HardDrive size={22} />}
          action={{ libelle: 'Voir les plans réutilisables', href: '/app/sauvegarde' }}
        />
      ) : (
        <div className="space-y-4">
          {proteges.map((s) => {
            const plan = s.sauvegarde!
            const points = pointsRestaurationDuService(s.id)
            return (
              <Card key={s.id}>
                <CardHeader
                  titre={
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-p-050 text-p-700">
                        {ICONE_TYPE[s.type]}
                      </span>
                      <Link
                        href={`/app/applications/projets/${projet.id}/${s.id}`}
                        className="font-mono text-[14px] font-bold text-ink hover:text-p-700"
                      >
                        {s.nom}
                      </Link>
                    </span>
                  }
                  sousTitre={`${s.environnement} · ${plan.plan} · ${plan.destination}`}
                  actions={
                    <span className="flex items-center gap-2">
                      <Badge tone="ok" size="sm" dot>
                        {relatif(plan.dernier, maintenant)}
                      </Badge>
                      <GatedAction
                        autorise={autorise('backup.restore')}
                        message={refus('backup.restore')}
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          iconBefore={<RotateCcw size={12} />}
                          onClick={() => setRestaurationId(s.id)}
                        >
                          Restaurer
                        </Button>
                      </GatedAction>
                    </span>
                  }
                />

                <KeyValueList
                  colonnes={3}
                  items={[
                    {
                      cle: 'Fréquence',
                      valeur: <span className="font-mono text-[13px]">{plan.cron}</span>,
                    },
                    { cle: 'Rétention', valeur: `${plan.retentionJours} jours` },
                    {
                      cle: 'Dernière exécution',
                      valeur: `${dateHeure(plan.dernier)} · ${plan.taille}`,
                    },
                  ]}
                />

                <p className="type-micro mb-2 mt-4 text-g-500">Points de restauration</p>
                <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="border-b border-g-300 bg-g-050">
                        {['Date', 'Type', 'Taille', 'Immuable jusqu’au', 'Vérifié'].map((h) => (
                          <th
                            key={h}
                            className="type-micro px-3 py-2 text-left font-semibold text-g-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((p) => (
                        <tr key={p.id} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2 text-[12px] text-ink">{dateHeure(p.ts)}</td>
                          <td className="px-3 py-2">
                            <Badge
                              tone={p.type === 'complete' ? 'violet' : 'neutral'}
                              size="sm"
                            >
                              {p.type === 'complete' ? 'Complète' : 'Incrémentale'}
                            </Badge>
                          </td>
                          <td className="tnum px-3 py-2 text-[12px] text-g-700">
                            {p.tailleGo.toFixed(1)} Go
                          </td>
                          <td className="px-3 py-2 text-[12px] text-g-700">{p.immuableJusquau}</td>
                          <td className="px-3 py-2">
                            <Badge tone={p.verifie ? 'ok' : 'warn'} size="sm">
                              {p.verifie ? 'Relu' : 'Non relu'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {sansEtat.length > 0 && (
        <Card>
          <CardHeader
            titre="Ces services n’ont rien à sauvegarder"
            sousTitre="Et c’est une propriété de leur type, pas un réglage manquant."
          />
          <ul className="divide-y divide-g-100">
            {sansEtat.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[13px] font-semibold text-ink">
                    {s.nom}
                  </span>
                  <span className="block text-[11px] text-g-500">
                    {s.type === 'statique'
                      ? 'Sortie de build : elle se reconstruit depuis le dépôt, à l’identique.'
                      : 'Tâche planifiée : elle ne détient rien entre deux exécutions.'}
                  </span>
                </span>
                <Badge tone="neutral" size="sm">
                  Sans état
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="violet" titre="Une sauvegarde qu’on n’a jamais relue n’est pas une sauvegarde">
          Chaque point est relu après écriture, et un test de restauration complet est joué
          périodiquement. Le résultat de ces tests, avec sa durée, est dans{' '}
          <Link href="/app/sauvegarde" className="font-semibold text-p-700 hover:underline">
            Sauvegardes &amp; PRA
          </Link>
          , avec le tableau de conformité 3-2-1.
        </Callout>
        <Callout ton="info" titre="Restaurer ne remonte pas le temps de tout le projet">
          La restauration s’applique à un service, jamais au projet entier : une base et son
          application n’ont pas forcément à revenir au même instant, et le faire d’office
          détruirait des données saines. Choisissez le service, puis le point.
        </Callout>
      </div>

      <ConfirmDialog
        open={restauration !== null}
        onClose={() => setRestaurationId(null)}
        onConfirm={() => {
          if (!restauration) return
          const cible = restauration
          executer({
            action: 'backup.restore',
            ton: 'info',
            titre: `Restauration de ${cible.nom} lancée`,
            detail:
              'Le service est arrêté, le volume remplacé par le point choisi, puis le service redémarre.',
            sansApi:
              'Indisponible : la restauration n’est pas encore exposée pour les services applicatifs (elle existe pour les VM, les bases et le web cloud).',
            effet: () => lesServices.modifier(cible.id, { statut: 'stopped' }),
            job: { workflow: 'backup.restore', cible: `${cible.nom} (${cible.environnement})` },
            effetFinal: () =>
              lesServices.modifier(cible.id, { statut: 'running', derniereMaj: MAINTENANT }),
          })
          setRestaurationId(null)
        }}
        titre="Restaurer ce service"
        ressource={restauration?.nom ?? ''}
        pertes={[
          'Les données écrites depuis le point de restauration choisi',
          'Les migrations de schéma appliquées après ce point',
          'Le service est indisponible pendant la bascule',
        ]}
        libelleAction="Restaurer ce service"
      />
    </div>
  )
}
