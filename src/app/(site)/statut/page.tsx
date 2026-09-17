'use client'

import { useMemo, useState } from 'react'
import { Bell, CheckCircle2, Rss, Webhook } from 'lucide-react'
import { cn, groupBy, seededSeries } from '@/lib/utils'
import { dateHeure, pct, relatif } from '@/lib/format'
import { SITE_COURT, type Site } from '@/lib/types'
import { INCIDENTS as INCIDENTS_GRAINE, STATUT_SERVICES as STATUT_GRAINE } from '@/lib/mock'
import { usePublic } from '@/lib/api/public'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, SegmentedControl } from '@/components/ui/field'
import { Card, CardHeader } from '@/components/composition/card'
import { Timeline } from '@/components/composition/flow'
import { Container, HeroCourt, SectionTitle, SiteSection } from '@/components/site/blocs'

const ETATS = {
  operationnel: { tone: 'ok' as const, label: 'Opérationnel' },
  degrade: { tone: 'warn' as const, label: 'Dégradé' },
  panne: { tone: 'err' as const, label: 'Panne' },
  maintenance: { tone: 'info' as const, label: 'Maintenance' },
}

const COULEURS_JOUR = ['bg-ok', 'bg-ok', 'bg-ok', 'bg-ok', 'bg-ok', 'bg-warn', 'bg-err']

export default function Statut() {
  const [periode, setPeriode] = useState<'90j' | '30j'>('90j')

  // En mode API, les services et incidents publiés viennent de
  // `GET /public/statut` ; sinon la graine locale reste affichée.
  const distant = usePublic<{
    services: typeof STATUT_GRAINE
    incidents: typeof INCIDENTS_GRAINE
  }>('/public/statut')
  const STATUT_SERVICES = distant.donnees?.services ?? STATUT_GRAINE
  const INCIDENTS = distant.donnees?.incidents ?? INCIDENTS_GRAINE

  const parCategorie = useMemo(
    () => Object.entries(groupBy(STATUT_SERVICES, (s) => s.categorie)),
    [STATUT_SERVICES],
  )

  const enCours = INCIDENTS.filter((i) => i.statut !== 'resolu')
  const resolus = INCIDENTS.filter((i) => i.statut === 'resolu')
  const degrades = STATUT_SERVICES.filter((s) =>
    Object.values(s.etats).some((e) => e === 'degrade' || e === 'panne'),
  )
  const maintenance = STATUT_SERVICES.filter((s) =>
    Object.values(s.etats).some((e) => e === 'maintenance'),
  )
  const uptimeMoyen =
    STATUT_SERVICES.reduce((a, s) => a + s.uptime90j, 0) / STATUT_SERVICES.length

  const global =
    degrades.length > 0 ? 'degrade' : maintenance.length > 0 ? 'maintenance' : 'operationnel'

  const jours = periode === '90j' ? 90 : 30
  const frise = seededSeries('frise-statut', jours, 0, 6.4).map((v) => Math.floor(v))

  return (
    <>
      <HeroCourt
        surtitre="État des services"
        titre="Disponibilité en direct, par service et par site"
        chapeau="Les données proviennent de nos sondes de supervision, avec un pas d’une minute. Les fenêtres de maintenance annoncées au moins sept jours à l’avance sont signalées mais exclues du calcul de disponibilité contractuelle."
      />

      <SiteSection className="!py-8">
        <Container>
          <Card
            className={cn(
              'border-2',
              global === 'operationnel'
                ? 'border-ok/25 bg-ok-bg'
                : global === 'degrade'
                  ? 'border-warn/25 bg-warn-bg'
                  : 'border-info/25 bg-info-bg',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full bg-white',
                    global === 'operationnel'
                      ? 'text-ok'
                      : global === 'degrade'
                        ? 'text-warn'
                        : 'text-info',
                  )}
                >
                  <CheckCircle2 size={22} />
                </span>
                <div>
                  <p className="text-[17px] font-bold [font-family:var(--font-display)] text-ink">
                    {global === 'operationnel'
                      ? 'Tous les services sont opérationnels'
                      : global === 'degrade'
                        ? `${degrades.length} service${degrades.length > 1 ? 's' : ''} en état dégradé`
                        : 'Maintenance planifiée en cours'}
                  </p>
                  <p className="mt-0.5 text-[13px] text-g-700">
                    Dernière actualisation {relatif('2026-08-19T15:18:00Z')} ·{' '}
                    {maintenance.length > 0 &&
                      `${maintenance.length} fenêtre de maintenance en cours · `}
                    disponibilité moyenne sur 90 jours : {pct(uptimeMoyen, 2)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="ok" dot>
                  {STATUT_SERVICES.length - degrades.length - maintenance.length} opérationnels
                </Badge>
                {degrades.length > 0 && (
                  <Badge tone="warn" dot>
                    {degrades.length} dégradés
                  </Badge>
                )}
                {maintenance.length > 0 && (
                  <Badge tone="info" dot>
                    {maintenance.length} en maintenance
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        </Container>
      </SiteSection>

      <SiteSection className="!pt-0">
        <Container>
          <div className="overflow-x-auto rounded-[10px] border border-g-300 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  <th className="type-micro sticky left-0 z-10 min-w-56 bg-g-050 px-4 py-2.5 text-left text-g-500">
                    Service
                  </th>
                  {(['ABJ', 'GBM'] as Site[]).map((s) => (
                    <th key={s} className="type-micro px-4 py-2.5 text-left text-g-500">
                      {SITE_COURT[s]}
                    </th>
                  ))}
                  <th className="type-micro px-4 py-2.5 text-right text-g-500">
                    Disponibilité 90 j
                  </th>
                </tr>
              </thead>
              <tbody>
                {parCategorie.map(([cat, services]) => (
                  <>
                    <tr key={`cat-${cat}`} className="border-b border-g-300 bg-p-050">
                      <td colSpan={4} className="px-4 py-2">
                        <span className="type-micro text-p-700">{cat}</span>
                      </td>
                    </tr>
                    {services.map((s) => (
                      <tr key={s.nom} className="border-b border-g-100 last:border-0">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2.5 text-[13px] text-ink">
                          {s.nom}
                        </td>
                        {(['ABJ', 'GBM'] as Site[]).map((site) => {
                          const e = ETATS[s.etats[site]]
                          return (
                            <td key={site} className="px-4 py-2.5">
                              <Badge tone={e.tone} dot size="sm">
                                {e.label}
                              </Badge>
                            </td>
                          )
                        })}
                        <td className="tnum px-4 py-2.5 text-right text-[13px] font-semibold text-g-700">
                          {pct(s.uptime90j, 2)}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </SiteSection>

      {enCours.length > 0 && (
        <SiteSection fond="clair" className="!pt-10">
          <Container>
            <SectionTitle surtitre="En cours" titre="Incidents et maintenances actifs" />
            <div className="mt-6 space-y-4">
              {enCours.map((inc) => (
                <Card
                  key={inc.id}
                  className={cn(
                    inc.gravite === 'majeur'
                      ? 'border-err/25'
                      : inc.gravite === 'maintenance'
                        ? 'border-info/25'
                        : 'border-warn/25',
                  )}
                >
                  <CardHeader
                    titre={inc.titre}
                    sousTitre={`Débuté le ${dateHeure(inc.debut)} · services concernés : ${inc.services.join(', ')} · sites : ${inc.sites.map((s) => SITE_COURT[s]).join(', ')}`}
                    actions={
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          tone={
                            inc.gravite === 'majeur'
                              ? 'err'
                              : inc.gravite === 'maintenance'
                                ? 'info'
                                : 'warn'
                          }
                        >
                          {inc.gravite === 'majeur'
                            ? 'Incident majeur'
                            : inc.gravite === 'maintenance'
                              ? 'Maintenance planifiée'
                              : 'Incident mineur'}
                        </Badge>
                        <Badge tone="neutral" dot>
                          {inc.statut === 'en_cours' ? 'En cours' : 'Sous surveillance'}
                        </Badge>
                      </div>
                    }
                  />
                  <Timeline
                    evenements={[...inc.mises_a_jour].reverse().map((m, i) => ({
                      id: `${inc.id}-${i}`,
                      titre: m.texte,
                      horodatage: dateHeure(m.ts),
                      ton: i === 0 ? ('info' as const) : ('neutral' as const),
                    }))}
                  />
                </Card>
              ))}
            </div>
          </Container>
        </SiteSection>
      )}

      <SiteSection>
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle
              surtitre="Historique"
              titre={`Les ${jours} derniers jours`}
              chapeau="Une case par jour. Vert : aucun incident. Orange : incident mineur ou maintenance. Rouge : incident majeur."
            />
            <SegmentedControl
              value={periode}
              onChange={setPeriode}
              options={[
                { value: '30j', label: '30 jours' },
                { value: '90j', label: '90 jours' },
              ]}
            />
          </div>

          <Card className="mt-6">
            <div className="flex flex-wrap gap-[3px]">
              {frise.map((v, i) => (
                <span
                  key={i}
                  title={`Jour -${jours - i} · ${v >= 6 ? 'incident majeur' : v >= 5 ? 'incident mineur' : 'aucun incident'}`}
                  className={cn('h-6 w-2 rounded-sm', COULEURS_JOUR[v] ?? 'bg-ok')}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-g-500">
              <span>-{jours} j</span>
              <span>aujourd’hui</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-g-100 pt-3 text-[12px] text-g-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-ok" /> aucun incident
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-warn" /> incident mineur ou maintenance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-err" /> incident majeur
              </span>
              <span className="tnum ml-auto">
                Disponibilité moyenne sur la période : {pct(uptimeMoyen, 2)}
              </span>
            </div>
          </Card>

          <div className="mt-6">
            <MicroLabel className="mb-3">Incidents résolus</MicroLabel>
            <div className="space-y-2.5">
              {resolus.map((inc) => (
                <details
                  key={inc.id}
                  className="group rounded-[10px] border border-g-300 bg-white"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink">{inc.titre}</span>
                      <span className="block text-[12px] text-g-500">
                        {dateHeure(inc.debut)}
                        {inc.fin && ` → ${dateHeure(inc.fin)}`} · {inc.services.join(', ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={inc.gravite === 'majeur' ? 'err' : 'warn'} size="sm">
                        {inc.gravite === 'majeur' ? 'Majeur' : 'Mineur'}
                      </Badge>
                      <Badge tone="ok" size="sm">
                        Résolu
                      </Badge>
                    </span>
                  </summary>
                  <div className="border-t border-g-100 px-4 py-3.5">
                    <Timeline
                      evenements={inc.mises_a_jour.map((m, i) => ({
                        id: `${inc.id}-r-${i}`,
                        titre: m.texte,
                        horodatage: dateHeure(m.ts),
                        ton:
                          i === inc.mises_a_jour.length - 1
                            ? ('ok' as const)
                            : ('neutral' as const),
                      }))}
                    />
                  </div>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </SiteSection>

      <SiteSection fond="clair">
        <Container taille="md">
          <Card>
            <CardHeader
              titre={
                <span className="flex items-center gap-2">
                  <Bell size={15} className="text-p-700" />
                  S’abonner aux notifications
                </span>
              }
              sousTitre="Recevez les avis d’incident et les annonces de maintenance planifiée."
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="prenom.nom@organisation.ci"
                className="flex-1"
                aria-label="Adresse e-mail"
                disabled
              />
              <Button disabled title="Abonnement par e-mail pas encore disponible">
                S’abonner
              </Button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-g-500">
              Pas encore disponible : cette page publie l’état en direct, mais rien n’envoie encore
              de notification par e-mail.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-g-100 pt-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <Webhook size={14} className="mt-0.5 shrink-0 text-p-700" />
                <div>
                  <p className="text-[13px] font-semibold text-ink">Webhook</p>
                  <p className="text-[12px] leading-snug text-g-700">
                    Recevez chaque changement d’état en JSON sur votre endpoint. Configuration depuis
                    votre espace client.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Rss size={14} className="mt-0.5 shrink-0 text-p-700" />
                <div>
                  <p className="text-[13px] font-semibold text-ink">Flux RSS</p>
                  <p className="font-mono text-[11px] leading-snug text-g-700">
                    status.synelia.cloud/feed.xml
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 border-t border-g-100 pt-3 text-[12px] leading-relaxed text-g-500">
              Les clients sous contrat reçoivent en plus une notification dans le portail et, pour les
              incidents majeurs, un appel de l’équipe d’astreinte lorsque leurs ressources sont
              concernées.
            </p>
          </Card>
        </Container>
      </SiteSection>
    </>
  )
}
