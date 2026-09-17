'use client'

import Link from 'next/link'
import { ArrowUpRight, CalendarClock, FileText, LifeBuoy, PackageSearch, Plus } from 'lucide-react'
import { dateHeure, money, num, pct, relatif, toHumain } from '@/lib/format'
import { trendSeries } from '@/lib/utils'
import { ButtonLink } from '@/components/ui/button'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Card, CardHeader, Section, PageHeader } from '@/components/composition/card'
import { GaugeCircle, QuotaBar, StatTile } from '@/components/composition/metrics'
import { Sparkline } from '@/components/composition/metrics'
import { Timeline } from '@/components/composition/flow'
import { DegradedState } from '@/components/composition/states'
import { EventList } from '@/components/business/observabilite'
import { MODELES } from '@/lib/mock/modeles'
import { ServiceCard } from '@/components/business/service-card'
import { PanneauOnboarding } from '@/components/app/onboarding'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { ApiError } from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'
import type {
  AuditEvent,
  EspaceCloud,
  Invoice,
  K8sCluster,
  Membership,
  Projet,
  Ticket,
  VM,
} from '@/lib/types'
import {
  CATALOGUE,
  ESPACES,
  EVENEMENTS_SUPERVISION,
  FACTURES,
  K8S_CLUSTERS,
  MEMBERSHIPS,
  ORG_COURANTE,
  PROJETS,
  SERVICES_MANAGES,
  SYNTHESE_CLIENT,
  TICKETS,
  VMS,
  serviceCatalogue,
} from '@/lib/mock'

const LIBELLES_ACTION: Record<string, string> = {
  'project.scale': 'a redimensionné',
  'capacity.rebalance': 'a rééquilibré la capacité',
  'auth.login': 's’est connecté à',
  'lb.rule.create': 'a créé une règle sur',
  'app.deploy': 'a déployé',
  'vm.delete': 'a tenté de supprimer',
  'invoice.download': 'a téléchargé',
  'backup.run': 'a exécuté',
  'member.invite': 'a invité des membres sur',
  'service.seats.extend': 'a étendu les sièges de',
  'compliance.export': 'a exporté',
  'backend.maintenance.start': 'a démarré la maintenance de',
  'espace.create': 'a créé',
}

export default function TableauDeBord() {
  const maintenant = useMaintenant()
  const s = SYNTHESE_CLIENT
  // Le sélecteur d'organisation de la barre supérieure lit `organisations` /
  // `organisationId` du contexte, pas `ORG_COURANTE` : en mode API, c'est la
  // vraie organisation connectée. La reprendre ici évite qu'un client voie son
  // vrai nom en haut d'écran et un autre nom, fictif, dans la salutation en
  // dessous — deux vérités différentes sur le même tableau de bord.
  const { api, organisations, organisationId } = useApp()
  const orgActive = organisations.find((o) => o.id === organisationId) ?? organisations[0]
  const nomOrg = orgActive?.nom ?? ORG_COURANTE.nom
  // Espaces Cloud, machines, clusters, projets, factures et tickets ont un
  // vrai backend (`/espaces`, `/vms`, `/kubernetes`, `/projets`,
  // `/facturation/factures`, `/support/tickets`) : `useCollection` en sert les
  // données réelles quand l'API est active, et retombe sur la graine de
  // démonstration sinon — même mécanisme que `/app/espaces`, `/app/vms`,
  // `/app/facturation`, `/app/support`. Les services managés (catalogue
  // `/app/lanceur`) et les événements Centreon n'ont, eux, aucune
  // contrepartie réelle sur ce lab (13-slug catalogue jamais raccordé à une
  // infra, pas d'intégration Centreon) : les tuiles concernées le disent
  // plutôt que de se faire passer pour du réel.
  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  const vms = useCollection<VM>('vms', VMS)
  const clusters = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  const projets = useCollection<Projet>('projets', PROJETS)
  const factures = useCollection<Invoice>('factures', FACTURES)
  const tickets = useCollection<Ticket>('tickets', TICKETS)
  // Idem pour les membres (`/membres`) : il existe un vrai compte
  // d'utilisateurs par organisation côté backend, même si aucune offre ne
  // porte de quota de sièges — `organisations/service.py::nb_utilisateurs`
  // ne compte que les adhésions de portée `org`, la tuile fait de même.
  const memberships = useCollection<Membership>('memberships', MEMBERSHIPS)
  // Même motif que /app/securite : `journal` (atelier local) sert de repli,
  // `/audit` réel prime quand il répond — l'activité récente lisait jusqu'ici
  // uniquement le journal local, jamais le vrai journal d'audit en mode API.
  const { journal: journalLocal } = useAtelier()
  const { donnees: journalDistant } = useLectureDegradable<{ donnees: AuditEvent[] }>('/audit', {
    parPage: '8',
  })
  const journal = journalDistant?.donnees ?? journalLocal

  const espacesN = espaces.items.length
  // Détail réel de la tuile « Espaces Cloud » : sites et offres distincts
  // parmi les Espaces réellement chargés, plutôt que le texte fixe qui
  // s'affichait quel que soit le nombre d'Espaces.
  const sitesN = new Set(espaces.items.map((e) => e.site)).size
  const offresN = new Set(espaces.items.map((e) => e.offerId)).size
  const vmsN = vms.items.length
  const clustersN = clusters.items.length
  const applicationsN = projets.items.length
  const environnementsN = projets.items.reduce((a, p) => a + p.environnements.length, 0)
  const membresOrgN = memberships.items.filter(
    (m) => m.scopeType === 'org' && m.orgId === (api ? organisationId : ORG_COURANTE.id),
  ).length

  // Quota/usage souscrits contre consommés : somme des Espaces Cloud réels,
  // le champ `quota`/`usage` de chacun ayant exactement la forme `Quota`
  // (`vcpu`, `ramGo`, `stockageTo`) que la maquette utilisait déjà en dur.
  const quota = {
    vcpu: espaces.items.reduce((a, e) => a + e.quota.vcpu, 0),
    ramGo: espaces.items.reduce((a, e) => a + e.quota.ramGo, 0),
    stockageTo: Math.round(espaces.items.reduce((a, e) => a + e.quota.stockageTo, 0) * 10) / 10,
  }
  const usage = {
    vcpu: espaces.items.reduce((a, e) => a + e.usage.vcpu, 0),
    ramGo: espaces.items.reduce((a, e) => a + e.usage.ramGo, 0),
    stockageTo: Math.round(espaces.items.reduce((a, e) => a + e.usage.stockageTo, 0) * 10) / 10,
  }
  const margeVcpu = quota.vcpu - usage.vcpu
  const stockagePct = quota.stockageTo > 0 ? Math.round((usage.stockageTo / quota.stockageTo) * 100) : 0

  // `useCollection` retombe silencieusement sur la graine pour tout échec —
  // sauf le `424` (intégration amont muette), qu'il faut nommer plutôt que de
  // laisser la carte de capacité mentir avec des chiffres qu'on ne sait plus
  // dater. Le même motif que `degradeConsommation` en facturation.
  const erreurEspaces = espaces.erreur
  const espacesDegrade =
    erreurEspaces instanceof ApiError && erreurEspaces.statut === 424
      ? { integration: erreurEspaces.integration, dateDonnees: erreurEspaces.dateDonnees }
      : null

  const servicesVedette = SERVICES_MANAGES.filter((x) => x.statut !== 'provisioning').slice(0, 4)
  const factureEnCours = factures.items.find((f) => f.statut === 'brouillon')
  const facturesImpayees = factures.items.filter((f) => f.statut === 'impayee')
  const ticketsOuverts = tickets.items.filter((t) => t.statut !== 'resolu' && t.statut !== 'ferme')
  const attenteClient = tickets.items.filter((t) => t.statut === 'attente_client')
  // Pas de champ `updatedAt` sur un ticket : impossible de dater la résolution
  // sans le fabriquer, donc un compte total plutôt qu'un « ce mois » inventé.
  const ticketsResolus = tickets.items.filter((t) => t.statut === 'resolu').length

  const periodeCourante = maintenant.slice(0, 7)
  const [anneeCourante, moisCourant] = periodeCourante.split('-').map(Number)
  const periodePrecedente = `${moisCourant === 1 ? anneeCourante - 1 : anneeCourante}-${String(
    moisCourant === 1 ? 12 : moisCourant - 1,
  ).padStart(2, '0')}`
  const depenseMoisReelle = factures.items
    .filter((f) => f.periode === periodeCourante)
    .reduce((a, f) => a + f.total, 0)
  const depenseMoisPrecedenteReelle = factures.items
    .filter((f) => f.periode === periodePrecedente)
    .reduce((a, f) => a + f.total, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        titre={`Bonjour, voici l’état de ${nomOrg}`}
        sousTitre={
          api
            ? 'Données hébergées à Abidjan et Grand-Bassam.'
            : `Organisation ${ORG_COURANTE.tenantPlan} · ${ORG_COURANTE.pays} · TVA ${ORG_COURANTE.tva} · données hébergées à Abidjan et Grand-Bassam.`
        }
        actions={
          <>
            <ButtonLink href="/app/espaces/new" variant="secondary" iconBefore={<Plus size={14} />}>
              Nouvel Espace Cloud
            </ButtonLink>
            <ButtonLink href="/app/applications/nouveau" iconBefore={<Plus size={14} />}>
              Nouveau projet
            </ButtonLink>
          </>
        }
      />

      <PanneauOnboarding />

      {/* ─── Bande 1 : chiffres clés ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          libelle="Espaces Cloud"
          valeur={espacesN}
          detail={
            espacesN > 0
              ? `${sitesN} site(s) · ${offresN} offre(s) souscrite(s)`
              : 'Aucun Espace Cloud pour le moment'
          }
          serie={trendSeries('espaces', 24, Math.max(0, espacesN - 1), espacesN, 0)}
        />
        <StatTile
          libelle="Machines virtuelles"
          valeur={vmsN}
          detail={`${clustersN} clusters Kubernetes`}
          serie={trendSeries('vms', 24, Math.max(0, vmsN - 3), vmsN + 1, 1)}
        />
        <StatTile
          libelle="Services managés"
          valeur={s.servicesManages}
          detail={
            api
              ? 'Démonstration — pas encore une lecture réelle'
              : '1 en provisioning · 1 mise à jour disponible'
          }
          ton="violet"
          serie={trendSeries('svc', 24, 4, 6, 0)}
        />
        <StatTile
          libelle="Applications déployées"
          valeur={applicationsN}
          detail={`${environnementsN} environnements`}
          serie={trendSeries('apps', 24, Math.max(0, applicationsN - 1), applicationsN, 0)}
        />
        <StatTile
          libelle={api ? 'Membres de l’organisation' : 'Sièges utilisés'}
          valeur={api ? membresOrgN : `${s.siegesUtilises}/${s.siegesSouscrits}`}
          detail={
            api
              ? // Le compte de membres est réel (`/membres`, même filtre que
                // `nb_utilisateurs` côté backend) ; aucune offre ne porte
                // aujourd'hui de quota de sièges par organisation, donc pas de
                // « souscrits » à afficher en face — un « Démonstration »
                // aurait caché une donnée réelle disponible.
                `${membresOrgN > 1 ? 'membres actifs' : 'membre actif'} · pas de quota de sièges par offre`
              : `${pct(Math.round((s.siegesUtilises / s.siegesSouscrits) * 100))} des sièges souscrits`
          }
          ton="ok"
          serie={
            api
              ? trendSeries('sieges', 24, Math.max(0, membresOrgN - 1), membresOrgN, 2)
              : trendSeries('sieges', 24, 58, 67, 2)
          }
        />
      </div>

      {/* ─── Bande 2 : capacité et disponibilité ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            titre="Capacité souscrite contre consommée"
            sousTitre="Somme des Espaces Cloud. Le placement technique sur nos hyperviseurs reste de notre responsabilité."
            actions={
              <Link
                href="/app/espaces"
                className="text-[12px] font-semibold text-p-700 hover:text-m-600"
              >
                Détail par espace →
              </Link>
            }
          />
          {espacesDegrade ? (
            <DegradedState
              source="capacité"
              integration={espacesDegrade.integration}
              dateDonnees={espacesDegrade.dateDonnees}
            />
          ) : espacesN === 0 ? (
            <p className="rounded-[8px] border border-dashed border-g-300 bg-g-050 px-3.5 py-4 text-center text-[12.5px] text-g-500">
              Aucun Espace Cloud pour le moment. Créez-en un premier pour voir apparaître ici la
              capacité souscrite et consommée.
            </p>
          ) : (
            <>
              <div className="space-y-3.5">
                <QuotaBar
                  libelle="vCPU"
                  utilise={usage.vcpu}
                  total={quota.vcpu}
                  formateur={(v) => num(v)}
                />
                <QuotaBar
                  libelle="Mémoire"
                  utilise={usage.ramGo}
                  total={quota.ramGo}
                  unite="Go"
                  formateur={(v) => num(v)}
                />
                <QuotaBar
                  libelle="Stockage"
                  utilise={usage.stockageTo}
                  total={quota.stockageTo}
                  formateur={(v) => toHumain(v)}
                  seuil={85}
                />
              </div>

              <div className="mt-4 rounded-[8px] border-l-4 border-p-600 bg-p-050 px-3.5 py-2.5">
                <p className="text-[12.5px] leading-relaxed text-g-700">
                  Marge disponible : <span className="tnum font-semibold text-ink">{margeVcpu} vCPU</span>{' '}
                  et <span className="tnum font-semibold text-ink">{quota.ramGo - usage.ramGo} Go</span>.
                  Le stockage, à {pct(stockagePct)}, est généralement le premier facteur limitant.
                </p>
              </div>

              <div className="mt-4 border-t border-g-100 pt-3.5">
                <div className="mb-2 flex items-baseline justify-between">
                  <MicroLabel>Consommation vCPU sur 30 jours</MicroLabel>
                  <span className="tnum text-[12px] font-semibold text-ink">
                    {usage.vcpu} / {quota.vcpu} vCPU
                  </span>
                </div>
                {/* Pas d'historique réel de consommation exposé par le backend :
                    la courbe reste une forme illustrative, seulement recadrée
                    autour du niveau d'usage réel du jour. */}
                <Sparkline
                  serie={trendSeries('conso-30j', 30, Math.max(0, usage.vcpu - 15), usage.vcpu + 5, 4)}
                  hauteur={64}
                  couleur="var(--color-p-600)"
                />
                <div className="mt-1 flex justify-between text-[10.5px] text-g-500">
                  <span>-30 j</span>
                  <span>-20 j</span>
                  <span>-10 j</span>
                  <span>aujourd’hui</span>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardHeader
            titre="Disponibilité"
            sousTitre={
              api
                ? 'Démonstration — pas encore une lecture réelle'
                : 'Moyenne pondérée sur 30 jours'
            }
          />
          {/* Pas de supervision SLA/incidents branchée côté backend : en
              mode API, la jauge et les trois lignes gardent les valeurs
              illustratives du jeu de démonstration, mais l'écran le dit —
              même convention que la tuile « Services managés » plus haut sur
              cette page (catalogue jamais raccordé à une infra réelle). */}
          <GaugeCircle
            valeur={s.uptime30j}
            cible={s.slaContractuel}
            min={99}
            libelle="Face à un engagement contractuel de 99,9 %"
            taille={148}
            className="mx-auto"
          />
          <dl className="mt-4 space-y-2 border-t border-g-100 pt-3.5">
            <Ligne cle="Applications à surveiller" valeur="2 sur 6" ton="warn" />
            <Ligne cle="Incidents ouverts" valeur="1 critique · 2 majeurs" ton="err" />
            <Ligne cle="Crédit SLA en cours de calcul" valeur={money(12200)} ton="ok" />
          </dl>
          {api && (
            <p className="mt-2 text-[11px] font-semibold text-g-500">
              Démonstration — pas encore une lecture réelle
            </p>
          )}
          <Link
            href="/app/support"
            className="mt-3 inline-flex items-center gap-1 border-t border-g-100 pt-3 text-[12px] font-semibold text-p-700 hover:text-m-600"
          >
            Voir les engagements SLA
            <ArrowUpRight size={12} />
          </Link>
        </Card>
      </div>

      {/* ─── Bande 3 : services, santé, facturation ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section
          titre="Mes services opérés"
          actions={
            <Link
              href="/app/lanceur"
              className="text-[12px] font-semibold text-p-700 hover:text-m-600"
            >
              Ouvrir le lanceur →
            </Link>
          }
        >
          {api ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-g-300 bg-g-050 px-4 py-8 text-center">
              <PackageSearch size={20} className="text-g-400" />
              <p className="text-[12.5px] font-semibold text-g-700">
                Catalogue non raccordé sur ce lab
              </p>
              <p className="max-w-xs text-[11.5px] leading-relaxed text-g-500">
                Drive, messagerie, visioconférence et ERP existent dans le catalogue de services
                managés, mais aucun n’est aujourd’hui provisionné derrière une infrastructure
                réelle. Parcourez le catalogue depuis le lanceur.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {servicesVedette.map((svc) => (
                <ServiceCard
                  key={svc.id}
                  service={svc}
                  catalogue={serviceCatalogue(svc.catalogSlug)}
                  compact
                />
              ))}
            </div>
          )}
        </Section>

        <Card>
          <CardHeader
            titre="Santé de l’infrastructure"
            sousTitre="Six derniers événements de supervision"
          />
          <EventList evenements={EVENEMENTS_SUPERVISION} max={6} />
          {api && (
            <p className="mt-2 text-[11px] font-semibold text-g-500">
              Démonstration — aucune intégration Centreon réelle sur ce lab.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titre="Facturation" />
            <dl className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[12.5px] text-g-500">Dépense du mois en cours</dt>
                <dd className="tnum text-[16px] font-bold [font-family:var(--font-display)] text-ink">
                  {money(api ? depenseMoisReelle : s.depenseMois)}
                </dd>
              </div>
              {!api && (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-[12.5px] text-g-500">Prévision de fin de mois</dt>
                  <dd className="tnum text-[13px] font-semibold text-warn">
                    {money(s.previsionMois)}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[12.5px] text-g-500">Mois précédent</dt>
                <dd className="tnum text-[13px] text-g-700">
                  {money(api ? depenseMoisPrecedenteReelle : s.depenseMoisPrecedent)}
                </dd>
              </div>
            </dl>
            {!api && (
              <div className="mt-3 border-t border-g-100 pt-3">
                <QuotaBar
                  utilise={s.depenseMois}
                  total={s.previsionMois}
                  seuil={90}
                  compact
                  formateur={(v) => money(v)}
                />
                <p className="mt-1.5 text-[11px] text-g-500">
                  Hausse de {pct(Math.round(((s.previsionMois - s.depenseMoisPrecedent) / s.depenseMoisPrecedent) * 100))}{' '}
                  attendue : souscription GED au prorata et troisième Espace Cloud.
                </p>
              </div>
            )}
            {factureEnCours && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-[6px] bg-g-050 px-2.5 py-2">
                <span className="flex items-center gap-1.5 text-[12px] text-g-700">
                  <FileText size={13} className="text-g-500" />
                  {factureEnCours.numero} · brouillon
                </span>
                <Link
                  href="/app/facturation"
                  className="text-[11.5px] font-semibold text-p-700 hover:text-m-600"
                >
                  Ouvrir
                </Link>
              </div>
            )}
            {(api ? facturesImpayees.length : s.facturesEnAttente) > 0 && (
              <p className="mt-2 rounded-[6px] bg-err-bg px-2.5 py-2 text-[11.5px] text-err">
                {api
                  ? `${facturesImpayees.length} facture${facturesImpayees.length > 1 ? 's' : ''} impayée${facturesImpayees.length > 1 ? 's' : ''}${facturesImpayees[0] ? ` · ${facturesImpayees[0].numero}` : ''}`
                  : `${s.facturesEnAttente} facture impayée · INV-1962, échue depuis le 10 juin`}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader titre="Support" />
            <div className="grid grid-cols-3 gap-2">
              <Compteur libelle="Ouverts" valeur={ticketsOuverts.length} ton="warn" />
              <Compteur libelle="Vous attendent" valeur={attenteClient.length} ton="err" />
              <Compteur libelle="Résolus" valeur={api ? ticketsResolus : 2} ton="ok" />
            </div>
            <ul className="mt-3 space-y-2 border-t border-g-100 pt-3">
              {ticketsOuverts.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <Link href={`/app/support/${t.id}`} className="group block">
                    <div className="flex items-start gap-2">
                      <Badge
                        size="sm"
                        tone={
                          t.gravite === 'critique'
                            ? 'err'
                            : t.gravite === 'majeure'
                              ? 'warn'
                              : 'neutral'
                        }
                        className="mt-0.5 shrink-0"
                      >
                        {t.numero}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-ink group-hover:text-p-700">
                          {t.sujet}
                        </span>
                        {t.slaRestantMin !== undefined && (
                          <span className="tnum block text-[10.5px] text-g-500">
                            SLA restant : {Math.floor(t.slaRestantMin / 60)} h{' '}
                            {String(t.slaRestantMin % 60).padStart(2, '0')}
                          </span>
                        )}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Pas de planification de point d'exploitation réelle sur ce lab :
                simplifié plutôt que de garder une date fabriquée en mode API. */}
            {!api && (
              <div className="mt-3 flex items-center gap-2 border-t border-g-100 pt-3 text-[11.5px] text-g-700">
                <CalendarClock size={13} className="shrink-0 text-p-700" />
                Prochain point d’exploitation : {dateHeure(s.prochainRdv)}
              </div>
            )}
            <Link
              href="/app/support"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-p-700 hover:text-m-600"
            >
              <LifeBuoy size={12} />
              Ouvrir un ticket
            </Link>
          </Card>
        </div>
      </div>

      {/* ─── Bande 4 : activité récente ──────────────────────────────── */}
      <Card>
        <CardHeader
          titre="Activité récente"
          sousTitre="Huit derniers événements, refus de droits inclus"
          actions={
            <Link
              href="/app/securite"
              className="text-[12px] font-semibold text-p-700 hover:text-m-600"
            >
              Journal d’audit complet →
            </Link>
          }
        />
        <Timeline
          evenements={journal
            .filter((e) => e.orgId === (api ? organisationId : ORG_COURANTE.id) || !e.orgId)
            .slice(0, 8)
            .map((e) => ({
              id: e.id,
              ton:
                e.result === 'refuse'
                  ? ('err' as const)
                  : e.result === 'erreur'
                    ? ('warn' as const)
                    : ('ok' as const),
              titre: (
                <>
                  <span className="font-semibold">{e.actor.nom}</span>{' '}
                  {LIBELLES_ACTION[e.action] ?? e.action}{' '}
                  <span className="font-mono text-[12px]">{e.target}</span>{' '}
                  <span className="text-g-500">· {e.scope.label}</span>
                  {e.result === 'refuse' && (
                    <Badge tone="err" size="sm" className="ml-1.5">
                      Refusé
                    </Badge>
                  )}
                </>
              ),
              detail: e.detail,
              horodatage: relatif(e.ts, maintenant),
            }))}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODELES.filter((m) => m.populaire || m.certifie)
          .slice(0, 4)
          .map((c) => (
          <Link
            key={c.slug}
            href="/app/applications/projets"
            className="group rounded-[10px] border border-dashed border-g-300 bg-white p-3.5 transition-colors hover:border-p-400 hover:bg-p-050"
          >
            <MicroLabel>Suggestion</MicroLabel>
            <p className="mt-1.5 text-[13px] font-semibold text-ink group-hover:text-p-700">
              {c.nom}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-g-500">{c.phrase}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Ligne({
  cle,
  valeur,
  ton,
}: {
  cle: string
  valeur: string
  ton?: 'ok' | 'warn' | 'err'
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[12px] text-g-500">{cle}</dt>
      <dd
        className={
          ton === 'err'
            ? 'tnum text-[12.5px] font-semibold text-err'
            : ton === 'warn'
              ? 'tnum text-[12.5px] font-semibold text-warn'
              : ton === 'ok'
                ? 'tnum text-[12.5px] font-semibold text-ok'
                : 'tnum text-[12.5px] font-semibold text-ink'
        }
      >
        {valeur}
      </dd>
    </div>
  )
}

function Compteur({
  libelle,
  valeur,
  ton,
}: {
  libelle: string
  valeur: number
  ton: 'ok' | 'warn' | 'err'
}) {
  const couleurs = { ok: 'text-ok', warn: 'text-warn', err: 'text-err' }[ton]
  return (
    <div className="rounded-[6px] bg-g-050 px-2 py-2 text-center">
      <p className={`tnum text-[18px] font-bold leading-none [font-family:var(--font-display)] ${couleurs}`}>
        {valeur}
      </p>
      <p className="mt-1 text-[10.5px] leading-tight text-g-500">{libelle}</p>
    </div>
  )
}
