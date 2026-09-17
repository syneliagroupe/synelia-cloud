'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Server,
  ShieldAlert,
  TicketCheck,
} from 'lucide-react'
import { cn, seededSeries, trendSeries } from '@/lib/utils'
import { dateHeure, goHumain, money, num, pct, relatif } from '@/lib/format'
import {
  ALERTES_PLATEFORME,
  BACKENDS,
  IMPAYES,
  INCIDENTS,
  JOBS_PLATEFORME,
  libellePlan,
  ORGANISATIONS,
  SYNTHESE_PLATEFORME,
  TICKETS_PLATEFORME,
  TOP_ORGANISATIONS,
} from '@/lib/mock'
import type { Impaye } from '@/lib/mock'
import { BACKEND_LABEL, SITE_COURT } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardHeader, Callout, NavCard, PageHeader } from '@/components/composition/card'
import { QuotaBar, StatTile } from '@/components/composition/metrics'
import { EventList } from '@/components/business/observabilite'
import { BackendGauge } from '@/components/business/infra'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { BoutonAction } from '@/components/app/actions'
import type { Backend, Incident, ProvisioningJob, Ticket } from '@/lib/types'
import { useLectureDegradable } from '@/lib/api/degradable'
import { estActif } from '@/lib/api/client'
import { useMaintenant } from '@/components/app/contexte'

/** `GET /admin/tableau-de-bord` : même forme que `SYNTHESE_PLATEFORME`. */
interface SynthesePlateformeDistante {
  vcpuTotal: number
  vcpuUtilise: number
  ramTotalGo: number
  stockageTotalTo: number
  tenantsActifs: number
  espacesTotal: number
  projetsTotal: number
  backendsEnLigne: number
  backendsTotal: number
  accesRefuses24h: number
  jobsEnEchec: number
  ticketsSlaRisque: number
  caMensuel: number
}

export default function VuePlateforme() {
  const maintenant = useMaintenant()
  // Le journal vit dans l'atelier : les actions faites pendant la session s'y
  // ajoutent, refus compris. Sans atelier touché, il retombe sur la graine.
  const { journal: AUDIT, reprendreJob } = useAtelier()
  const api = estActif()

  // Socles, incidents, tickets, impayés et provisionnements ont chacun un
  // vrai backend admin (`/admin/backends`, `/admin/statut/incidents`,
  // `/admin/tickets`, `/admin/facturation/impayes`, `/admin/travaux`) : même
  // mécanisme que le reste de la plateforme. Les agrégats de la bande 1
  // (vCPU, mémoire, stockage, CA, organisations actives) viennent de
  // `/admin/tableau-de-bord`, qui calcule exactement la forme de
  // `SYNTHESE_PLATEFORME` côté backend.
  const jobs = useCollection<ProvisioningJob>('jobs-plateforme', JOBS_PLATEFORME)
  const backends = useCollection<Backend>('backends', BACKENDS)
  const incidents = useCollection<Incident>('incidents', INCIDENTS)
  const ticketsPlateforme = useCollection<Ticket>('tickets-plateforme', TICKETS_PLATEFORME)
  const impayes = useCollection<Impaye>('impayes', IMPAYES)
  const { donnees: syntheseDistante } = useLectureDegradable<SynthesePlateformeDistante>(
    '/admin/tableau-de-bord',
  )
  const synthese = syntheseDistante ?? SYNTHESE_PLATEFORME

  const enSortie = backends.items.filter((b) => b.enSortie?.actif)
  const satures = backends.items.filter((b) => (b.saturation?.j30 ?? 0) > 85)
  const incidentsOuverts = incidents.items.filter((i) => i.statut !== 'resolu')
  const jobsEchec = jobs.items.filter((j) => j.statut === 'failed')
  const slaRisque = ticketsPlateforme.items.filter(
    (t) => (t.slaRestantMin ?? 9999) < 120 && !['resolu', 'ferme'].includes(t.statut),
  )
  const impayesTotal = impayes.items.reduce((a, i) => a + i.montant, 0)

  const vcpuPct = Math.round((synthese.vcpuUtilise / synthese.vcpuTotal) * 100)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin' }]}
        titre="Vue plateforme"
        sousTitre="L’état réel de la plateforme, sans arrondi favorable : capacité par socle technique, incidents en cours, provisionnements en échec, engagements de service en risque et impayés. Ce qui demande une décision est en haut."
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {synthese.tenantsActifs} organisations actives
            </Badge>
            <Badge tone="neutral" size="sm">
              {synthese.backendsEnLigne}/{synthese.backendsTotal} socles en ligne
            </Badge>
            <Badge tone="neutral" size="sm">
              Données à {dateHeure('2026-08-19T15:20:00Z')}
            </Badge>
          </>
        }
        actions={
          <>
            <ButtonLink variant="secondary" href="/admin/capacite">
              Gérer la capacité
            </ButtonLink>
            <ButtonLink href="/admin/organisations">Organisations</ButtonLink>
          </>
        }
      />

      {(incidentsOuverts.length > 0 || satures.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {incidentsOuverts.length > 0 && (
            <Callout ton="err" titre={`${incidentsOuverts.length} incident${incidentsOuverts.length > 1 ? 's' : ''} en cours`}>
              {incidentsOuverts[0].titre} — {incidentsOuverts[0].services.join(', ')} sur{' '}
              {incidentsOuverts[0].sites.map((x) => SITE_COURT[x]).join(' et ')}.{' '}
              {incidentsOuverts[0].mises_a_jour.length} mise
              {incidentsOuverts[0].mises_a_jour.length > 1 ? 's' : ''} à jour publiée
              {incidentsOuverts[0].mises_a_jour.length > 1 ? 's' : ''} sur la page de statut.{' '}
              <Link href="/admin/sante" className="font-semibold text-err underline">
                Voir la santé plateforme
              </Link>
            </Callout>
          )}
          {satures.length > 0 && (
            <Callout
              ton="warn"
              titre={`${satures.length} socle atteindra 85 % de saturation sous 30 jours`}
            >
              {satures.map((b) => b.code).join(', ')} — au rythme actuel, la capacité résiduelle ne
              couvre plus les créations prévues.{' '}
              <Link href="/admin/capacite" className="font-semibold text-warn underline">
                Rééquilibrer le placement
              </Link>
            </Callout>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile
          libelle="Processeur alloué"
          valeur={pct(vcpuPct)}
          ton={vcpuPct > 80 ? 'warn' : 'violet'}
          detail={`${num(synthese.vcpuUtilise)} / ${num(synthese.vcpuTotal)} vCPU`}
          serie={trendSeries('plateforme-vcpu', 30, vcpuPct - 9, vcpuPct)}
        />
        <StatTile
          libelle="Mémoire installée"
          valeur={`${num(Math.round(synthese.ramTotalGo / 1024))} Tio`}
          detail={`${num(synthese.ramTotalGo)} Go sur ${synthese.backendsTotal} socles`}
        />
        <StatTile
          libelle="Stockage installé"
          valeur={`${num(synthese.stockageTotalTo)} To`}
          detail="Bloc et objet confondus"
        />
        <StatTile
          libelle="Chiffre d’affaires mensuel"
          valeur={money(synthese.caMensuel)}
          ton="ok"
          detail={`${synthese.tenantsActifs} organisations facturées`}
          serie={trendSeries('plateforme-ca', 12, synthese.caMensuel * 0.72, synthese.caMensuel)}
        />
        <StatTile
          libelle="Provisionnements en échec"
          valeur={jobsEchec.length}
          ton={jobsEchec.length > 0 ? 'err' : 'ok'}
          detail={jobsEchec.length > 0 ? 'À reprendre manuellement' : 'Aucun échec'}
        />
        <StatTile
          libelle="Engagements en risque"
          valeur={slaRisque.length}
          ton={slaRisque.length > 0 ? 'warn' : 'ok'}
          detail={slaRisque.length > 0 ? 'Moins de 2 h restantes' : 'Tous tenus'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            titre="Capacité par socle technique"
            sousTitre="Un socle est un hyperviseur ou un cloud privé que nous exploitons. Le placement d’un Espace Cloud peut être réparti entre plusieurs socles."
            actions={
              <ButtonLink size="sm" variant="ghost" href="/admin/capacite">
                Détail et rééquilibrage
              </ButtonLink>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {backends.items.map((b) => (
              <BackendGauge key={b.id} backend={b} />
            ))}
          </div>
          {enSortie.length > 0 && (
            <Callout ton="violet" className="mt-4" titre="Trajectoire de sortie assumée">
              {enSortie.length} socles propriétaires sont en sortie planifiée :{' '}
              {enSortie
                .map(
                  (b) =>
                    `${b.code} (${BACKEND_LABEL[b.type]}) vers ${b.enSortie!.cibleMigration}`,
                )
                .join(', ')}
              . Nous ne prétendons pas être déjà entièrement souverains : nous publions le calendrier
              et l’avancement, y compris côté vitrine publique.
            </Callout>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Alertes de plateforme"
              sousTitre="Les huit dernières, toutes sévérités."
            />
            <EventList
              evenements={ALERTES_PLATEFORME}
              max={8}
              lienSortie="Ouvrir Centreon"
              hrefSortie="https://centreon.synelia.cloud/monitoring/resources"
            />
          </Card>

          <Card>
            <CardHeader
              titre="Répartition par site physique"
              sousTitre="Capacité installée."
            />
            <div className="space-y-3">
              {(['ABJ', 'GBM'] as const).map((s) => {
                const socles = backends.items.filter((b) => b.site === s)
                if (socles.length === 0) return null
                const vcpu = socles.reduce((a, b) => a + b.capacite.vcpu, 0)
                const utilise = Math.round(
                  socles.reduce((a, b) => a + (b.capacite.vcpu * b.usage.vcpuPct) / 100, 0),
                )
                return (
                  <QuotaBar
                    key={s}
                    libelle={`${SITE_COURT[s]} · ${socles.length} socle${socles.length > 1 ? 's' : ''}`}
                    utilise={utilise}
                    total={vcpu}
                    unite="vCPU"
                    seuil={85}
                    formateur={(v) => num(v)}
                  />
                )
              })}
            </div>
            <ButtonLink size="sm" variant="ghost" className="mt-3.5" href="/admin/sites">
              Voir les sites et leurs contraintes
            </ButtonLink>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padding={false}>
          <div className="border-b border-g-100 px-4 py-3.5">
            <CardHeader
              titre="Organisations les plus consommatrices"
              sousTitre={
                api
                  ? 'Démonstration — pas encore une lecture réelle, y compris la colonne CA mensuel (qui ne reflète pas le chiffre d’affaires ci-dessus)'
                  : 'Par processeur alloué. Une organisation qui croît vite mérite un contact commercial avant qu’elle ne se heurte à un quota.'
              }
              className="mb-0"
              actions={
                <ButtonLink size="sm" variant="ghost" href="/admin/organisations">
                  Toutes les organisations
                </ButtonLink>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Organisation', 'Plan', 'Espaces', 'Utilisateurs', 'vCPU', 'CA mensuel', 'Statut', ''].map(
                    (h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {/* `GET /organisations` (collection `organisations`, déjà câblée sur
                    `/admin/organisations`) liste bien les organisations réelles, mais
                    sans consommation vCPU ni CA par organisation — le classement
                    « plus consommatrices » n'a pas d'équivalent réel à ce jour et
                    reste sur la graine plutôt que d'inventer un tri sur des champs
                    absents de la réponse. */}
                {TOP_ORGANISATIONS.map((o) => (
                  <tr key={o.id} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/organisations/${o.id}`}
                        className="flex items-center gap-2 text-[12.5px] font-semibold text-ink hover:text-p-700"
                      >
                        <Building2 size={12} className="shrink-0 text-g-500" />
                        {o.nom}
                      </Link>
                      <span className="block pl-[20px] text-[10.5px] text-g-500">
                        {o.pays}
                        {o.secteur ? ` · ${o.secteur}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone="neutral" size="sm">
                        {libellePlan(o.tenantPlan ?? 'Standard')}
                      </Badge>
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{o.espaces ?? 0}</td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                      {o.utilisateurs ?? 0}
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12px] font-semibold text-ink">
                      {num(o.consommationVcpu ?? 0)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12px] font-semibold text-ink">
                      {o.caMensuel ? money(o.caMensuel) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={
                          o.statut === 'active' ? 'ok' : o.statut === 'suspendue' ? 'warn' : 'neutral'
                        }
                        dot
                        size="sm"
                      >
                        {o.statut === 'active'
                          ? 'Active'
                          : o.statut === 'suspendue'
                            ? 'Suspendue'
                            : 'Fermée'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <ButtonLink size="sm" variant="ghost" href={`/admin/organisations/${o.id}`}>
                        Ouvrir
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Impayés"
              sousTitre="Aucune suspension n’est déclenchée automatiquement."
              actions={
                <Badge tone={impayesTotal > 0 ? 'err' : 'ok'} size="sm">
                  {money(impayesTotal)}
                </Badge>
              }
            />
            <div className="space-y-2">
              {impayes.items.map((i) => (
                <div
                  key={i.facture}
                  className={cn(
                    'rounded-[6px] border px-3 py-2.5',
                    i.retardJours > 60 ? 'border-err/40 bg-err-bg' : 'border-warn/40 bg-warn-bg',
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">
                      {i.org}
                    </span>
                    <span className="tnum shrink-0 text-[12.5px] font-bold text-ink">
                      {money(i.montant)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-g-700">
                    <span className="font-mono">{i.facture}</span> · {i.retardJours} jours de retard ·{' '}
                    {i.relances} relance{i.relances > 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
            <ButtonLink size="sm" variant="ghost" className="mt-3" href="/admin/facturation">
              Gérer le recouvrement
            </ButtonLink>
          </Card>

          <Card>
            <CardHeader
              titre="Provisionnements en échec"
              sousTitre="Chaque échec porte l’étape fautive et le message du socle."
            />
            {jobsEchec.length === 0 ? (
              <p className="rounded-[6px] border border-dashed border-g-300 px-3 py-4 text-center text-[12px] text-g-500">
                Aucun provisionnement en échec.
              </p>
            ) : (
              <div className="space-y-2">
                {jobsEchec.map((j) => (
                  <div key={j.id} className="rounded-[6px] border border-err/40 bg-err-bg px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                      <AlertTriangle size={12} className="shrink-0 text-err" />
                      {j.type}
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-g-700">{j.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-g-700">
                      {j.erreur?.message ??
                        j.taches.find((t) => t.statut === 'failed')?.message ??
                        'Échec sans message détaillé'}
                    </p>
                    {j.erreur?.correlationId && (
                      <p className="mt-1 font-mono text-[10px] text-g-500">
                        {j.erreur.correlationId}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <BoutonAction
                        libelle="Reprendre"
                        operation={{
                          action: 'capacity.manage',
                          ton: 'info',
                          titre: `Reprise de « ${j.label} »`,
                          detail: 'La séquence repart à l’étape qui a échoué, pas depuis le début.',
                          effet: () => reprendreJob(j.id, 'jobs-plateforme', JOBS_PLATEFORME),
                        }}
                      />
                      <BoutonAction
                        libelle="Voir le journal"
                        variant="ghost"
                        operation={{
                          ton: 'info',
                          titre: 'Journal du job',
                          detail:
                            j.erreur?.correlationId
                              ? `Identifiant de corrélation ${j.erreur.correlationId} — la trace complète est dans VictoriaLogs.`
                              : 'La trace complète est dans VictoriaLogs.',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <NavCard
          titre="Santé plateforme"
          description="Incidents, socles, jobs et communication publique sur la page de statut."
          href="/admin/sante"
          meta={`${incidentsOuverts.length} incident${incidentsOuverts.length > 1 ? 's' : ''} en cours`}
        />
        <NavCard
          titre="Capacité et placement"
          description="Répartition d’un Espace Cloud entre socles, projection de saturation, rééquilibrage."
          href="/admin/capacite"
          meta={`${satures.length} socle${satures.length > 1 ? 's' : ''} en tension`}
        />
        <NavCard
          titre="Migration entre socles"
          description="Trajectoire de sortie des socles propriétaires, vagues de migration, fenêtres."
          href="/admin/migration"
          meta={`${enSortie.length} socles en sortie`}
        />
        <NavCard
          titre="Audit de la plateforme"
          description="Toutes les actions de nos équipes sur les organisations, y compris les refus."
          href="/admin/audit"
          meta={`${AUDIT.length} événements récents`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            titre="Tickets en risque d’engagement"
            sousTitre="Moins de deux heures avant échéance."
            actions={
              <ButtonLink size="sm" variant="ghost" href="/admin/tickets">
                File complète
              </ButtonLink>
            }
          />
          {slaRisque.length === 0 ? (
            <p className="rounded-[6px] border border-dashed border-g-300 px-3 py-4 text-center text-[12px] text-g-500">
              Aucun ticket en risque.
            </p>
          ) : (
            <div className="space-y-2">
              {slaRisque.map((t) => (
                <Link
                  key={t.id}
                  href="/admin/tickets"
                  className="block rounded-[6px] border border-warn/40 bg-warn-bg px-3 py-2.5 transition-colors hover:border-warn"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] font-semibold text-ink">
                      {t.sujet}
                    </span>
                    <span className="tnum shrink-0 text-[11.5px] font-bold text-err">
                      {t.slaRestantMin} min
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-g-700">
                    <span className="font-mono">{t.numero}</span> ·{' '}
                    {t.assigneA ?? 'non assigné'} · {relatif(t.createdAt, maintenant)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            titre="Accès refusés (24 h)"
            sousTitre="Un refus signale un rôle mal calibré, ou une tentative."
            actions={
              <Badge tone={synthese.accesRefuses24h > 0 ? 'warn' : 'ok'} size="sm">
                {synthese.accesRefuses24h}
              </Badge>
            }
          />
          <div className="space-y-2">
            {AUDIT.filter((a) => a.result === 'refuse')
              .slice(0, 4)
              .map((a) => (
                <div key={a.id} className="rounded-[6px] border border-g-300 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                    <ShieldAlert size={11} className="shrink-0 text-warn" />
                    {a.actor.nom}
                  </p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-p-700">{a.action}</p>
                  <p className="mt-0.5 text-[10.5px] text-g-500">
                    {a.scope.label} · {relatif(a.ts, maintenant)}
                  </p>
                </div>
              ))}
          </div>
          <ButtonLink size="sm" variant="ghost" className="mt-3" href="/admin/audit">
            Journal complet
          </ButtonLink>
        </Card>

        <Card>
          <CardHeader
            titre="Charge du support"
            sousTitre="File courante, toutes organisations."
            actions={<TicketCheck size={15} className="text-p-700" />}
          />
          <div className="space-y-3">
            {[
              {
                l: 'Tickets ouverts',
                v: ticketsPlateforme.items.filter((t) => !['resolu', 'ferme'].includes(t.statut)).length,
                t: 'violet' as const,
              },
              {
                l: 'Critiques',
                v: ticketsPlateforme.items.filter(
                  (t) => t.gravite === 'critique' && !['resolu', 'ferme'].includes(t.statut),
                ).length,
                t: 'err' as const,
              },
              {
                l: 'En attente client',
                v: ticketsPlateforme.items.filter((t) => t.statut === 'attente_client').length,
                t: 'warn' as const,
              },
              {
                l: 'Non assignés',
                v: ticketsPlateforme.items.filter((t) => !t.assigneA).length,
                t: 'warn' as const,
              },
            ].map((x) => (
              <div key={x.l} className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] text-g-700">{x.l}</span>
                <Badge tone={x.v > 0 ? x.t : 'ok'} size="sm">
                  {x.v}
                </Badge>
              </div>
            ))}
          </div>
          <MicroLabel className="mt-4 mb-2">Volume de tickets sur 30 jours</MicroLabel>
          <div className="flex items-end gap-1">
            {seededSeries('tickets-30j', 30, 2, 14).map((v, i) => (
              <span
                key={i}
                className={cn('flex-1 rounded-t-sm', v > 11 ? 'bg-warn' : 'bg-p-300')}
                style={{ height: `${6 + v * 4}px` }}
              />
            ))}
          </div>
          <ButtonLink size="sm" variant="ghost" className="mt-3" href="/admin/tickets">
            Ouvrir la file
          </ButtonLink>
        </Card>
      </div>

      <Callout ton="violet" titre="Ce tableau de bord ne cache pas les mauvaises nouvelles">
        Un socle en tension, un provisionnement en échec, un engagement en risque, un impayé : tout
        est en haut de page, pas dans un onglet secondaire. Un tableau de bord d’exploitation qui
        n’affiche que du vert ne sert à rien — il faut aller chercher l’information ailleurs, et
        c’est précisément ce qui fait perdre du temps quand quelque chose va mal.
      </Callout>
    </div>
  )
}
