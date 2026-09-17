'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Container, Link2, Plus, Server, Settings2, TrendingUp, Unlink } from 'lucide-react'
import { cn, seededSeries, trendSeries } from '@/lib/utils'
import { dateCourte, dateHeure, goHumain, money, num, pct, toHumain } from '@/lib/format'
import {
  SITE_LABEL,
  type BackupPlan,
  type ServiceProjet,
  type EspaceCloud,
  type K8sCluster,
  type Membership,
  type Network,
  type Offer,
  type PublicIP,
  type RestorePoint,
  type VM,
  type Volume,
} from '@/lib/types'
import {
  BACKUP_PLANS,
  ESPACES,
  EVENEMENTS_SUPERVISION,
  K8S_CLUSTERS,
  MEMBERSHIPS,
  NETWORKS,
  OFFRES,
  PUBLIC_IPS,
  RESTORE_POINTS,
  SERVICES_PROJET,
  VMS,
  VOLUMES,
  userById,
  hrefDuService,
} from '@/lib/mock'
import { ROLE_LABEL } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Avatar, GatedAction, Tabs } from '@/components/ui/display'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { HealthBadge, QuotaBar, Sparkline, StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { EventList, GrilleSparkCharts } from '@/components/business/observabilite'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire } from '@/components/app/actions'
import { modifierRessource, requete } from '@/lib/api/client'

const ONGLETS = [
  { id: 'apercu', label: 'Vue d’ensemble' },
  { id: 'ressources', label: 'Ressources' },
  { id: 'reseau', label: 'Réseau' },
  { id: 'stockage', label: 'Stockage' },
  { id: 'sauvegardes', label: 'Sauvegardes' },
  { id: 'supervision', label: 'Supervision' },
  { id: 'membres', label: 'Membres' },
]

export function VueEspace({ id }: { id: string }) {
  const { autorise, refus } = useApp()
  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  const parc = useCollection<VM>('vms', VMS)
  const disques = useCollection<Volume>('volumes', VOLUMES)
  const grappes = useCollection<K8sCluster>('clusters', K8S_CLUSTERS)
  // Le catalogue réel prime sur la graine : un tarif changé côté
  // /admin/catalogue doit se voir ici, pas seulement dans l'admin.
  const offresReelles = useCollection<Offer>('offres', OFFRES)
  // Même collections que `/app/reseau`, `/app/membres` et `/app/sauvegarde` :
  // avant ce correctif, ces trois onglets lisaient les graines directement
  // (`reseauxDeLEspace`/`ipsDeLEspace`, `MEMBERSHIPS`, `BACKUP_PLANS`,
  // `RESTORE_POINTS`) sans jamais passer par l'atelier, donc en mode API la
  // fiche d'un Espace affichait des réseaux/IP/membres/plans fabriqués au lieu
  // des vraies collections déjà branchées ailleurs.
  const reseauxCollection = useCollection<Network>('reseaux', NETWORKS)
  const ipsCollection = useCollection<PublicIP>('ips', PUBLIC_IPS)
  const adhesions = useCollection<Membership>('memberships', MEMBERSHIPS)
  const plansSauvegarde = useCollection<BackupPlan>('plans-sauvegarde', BACKUP_PLANS)
  const pointsRestauration = useCollection<RestorePoint>('points-restauration', RESTORE_POINTS)
  const services = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const [onglet, setOnglet] = useState('apercu')

  const espace = espaces.items.find((e) => e.id === id)
  const vms = parc.items.filter((v) => v.espaceId === id)
  const clusters = grappes.items.filter((c) => c.espaceId === id)
  const volumes = disques.items.filter((v) => v.espaceId === id)
  const reseaux = reseauxCollection.items.filter((n) => n.espaceId === id)
  const ips = ipsCollection.items.filter((i) => i.espaceId === id)

  // Identifiant inconnu (lien direct, espace supprimé) : la page le dit au
  // lieu de planter sur `espace.code`.
  if (!espace) {
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Espaces Cloud', href: '/app/espaces' },
            { label: 'Introuvable' },
          ]}
          titre="Espace introuvable"
        />
        <EmptyState
          titre="Cet Espace Cloud n’existe pas ou plus"
          phrase="Il a peut-être été supprimé, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: 'Retour aux espaces', href: '/app/espaces' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Espaces Cloud', href: '/app/espaces' },
          { label: espace.code },
        ]}
        titre={<span className="font-mono">{espace.code}</span>}
        sousTitre={`${espace.offreNom} · ${SITE_LABEL[espace.site]} · plage ${espace.cidr} · ${espace.projets} projet${espace.projets > 1 ? 's' : ''} · créé le ${dateCourte(espace.createdAt)}`}
        meta={
          <>
            <HealthBadge etat={espace.statut === 'active' ? 'operationnel' : espace.statut} />
            <Badge tone="neutral">{espace.site}</Badge>
            <span className="font-mono text-[12px] text-g-500">{espace.dnsInterne}</span>
          </>
        }
        actions={
          <>
            <BoutonFormulaire
              libelle="Étendre la capacité"
              size="md"
              icone={<TrendingUp size={14} />}
              action="espace.quota.update"
              titre={`Étendre la capacité de ${espace.code}`}
              description="Le quota est l’enveloppe de l’espace : l’étendre ne crée aucune ressource, cela autorise à en créer davantage. La facturation suit le quota réservé, au prorata du mois."
              champs={[
                { id: 'vcpu', label: 'vCPU', type: 'nombre', demi: true, min: espace.usage.vcpu },
                { id: 'ram', label: 'Mémoire', type: 'nombre', demi: true, min: espace.usage.ramGo, suffixe: 'Go' },
                { id: 'stockage', label: 'Stockage', type: 'nombre', demi: true, min: 1, suffixe: 'To' },
              ]}
              valeursDepart={{
                vcpu: espace.quota.vcpu,
                ram: espace.quota.ramGo,
                stockage: espace.quota.stockageTo,
              }}
              libelleValider="Étendre"
              operation={(v) => ({
                titre: `Capacité de ${espace.code} étendue`,
                detail: `${v.vcpu} vCPU · ${v.ram} Go · ${v.stockage} To`,
                appel: () =>
                  requete(`/espaces/${encodeURIComponent(espace.id)}/quota`, {
                    methode: 'PUT',
                    corps: {
                      vcpu: Number(v.vcpu),
                      ramGo: Number(v.ram),
                      stockageTo: Number(v.stockage),
                    },
                  }),
                job: { workflow: 'espace.extend', cible: espace.code },
                effetFinal: () => {
                  espaces.modifier(espace.id, {
                    quota: {
                      vcpu: Number(v.vcpu),
                      ramGo: Number(v.ram),
                      stockageTo: Number(v.stockage),
                    },
                  })
                  espaces.recharger()
                },
              })}
            />
            <BoutonFormulaire
              libelle="Changer d’offre"
              size="md"
              variant="ghost"
              icone={<Settings2 size={14} />}
              action="espace.quota.update"
              titre={`Changer l’offre de ${espace.code}`}
              description="Le changement d’offre prend effet à la prochaine période de facturation. Aucune ressource n’est déplacée."
              champs={[
                {
                  id: 'offre',
                  label: 'Offre',
                  type: 'select',
                  options: offresReelles.items.filter((o) => o.categorie === 'espace_cloud').map((o) => ({
                    value: o.id,
                    label: `${o.nom} · ${o.specs}`,
                  })),
                },
              ]}
              valeursDepart={{ offre: espace.offerId }}
              libelleValider="Changer d’offre"
              operation={(v) => {
                const offre = offresReelles.items.find((o) => o.id === v.offre)
                return {
                  titre: `Offre de ${espace.code} changée`,
                  detail: offre ? `${offre.nom} · effet à la prochaine période` : undefined,
                  // `offerId` ne fait pas partie du contrat : seul le quota
                  // se règle côté backend, le changement d’offre reste local
                  // en attendant (aucun appel, aucun job simulé en mode API).
                  effet: () =>
                    offre
                      ? espaces.modifier(espace.id, {
                          offerId: offre.id,
                          offreNom: offre.nom,
                        })
                      : undefined,
                }
              }}
            />
          </>
        }
      />

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {/* ─── Vue d'ensemble ──────────────────────────────────────────── */}
      {onglet === 'apercu' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              libelle="vCPU"
              valeur={`${espace.usage.vcpu}/${espace.quota.vcpu}`}
              detail={pct(Math.round((espace.usage.vcpu / espace.quota.vcpu) * 100))}
              serie={trendSeries(`${id}-vcpu`, 24, espace.usage.vcpu - 8, espace.usage.vcpu, 2)}
            />
            <StatTile
              libelle="Mémoire"
              valeur={`${num(espace.usage.ramGo)}/${num(espace.quota.ramGo)}`}
              unite="Go"
              detail={pct(Math.round((espace.usage.ramGo / espace.quota.ramGo) * 100))}
              serie={trendSeries(`${id}-ram`, 24, espace.usage.ramGo - 20, espace.usage.ramGo, 6)}
            />
            <StatTile
              libelle="Stockage"
              valeur={`${espace.usage.stockageTo}/${espace.quota.stockageTo}`}
              unite="To"
              ton={espace.usage.stockageTo / espace.quota.stockageTo > 0.85 ? 'warn' : 'violet'}
              detail={pct(Math.round((espace.usage.stockageTo / espace.quota.stockageTo) * 100))}
              serie={trendSeries(
                `${id}-sto`,
                24,
                espace.usage.stockageTo * 0.9,
                espace.usage.stockageTo,
                0.2,
              )}
            />
            <StatTile
              libelle="Machines virtuelles"
              valeur={vms.length}
              detail={`${vms.filter((v) => v.statut === 'running').length} en marche`}
            />
            <StatTile
              libelle="Clusters Kubernetes"
              valeur={clusters.length}
              detail={clusters.length > 0 ? `v${clusters[0].version}` : 'Aucun cluster'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                titre="Consommation du quota"
                sousTitre="Le quota s’étend à chaud, sans recréer de ressource."
              />
              <div className="space-y-3.5">
                <QuotaBar
                  libelle="vCPU"
                  utilise={espace.usage.vcpu}
                  total={espace.quota.vcpu}
                  formateur={(v) => num(v)}
                />
                <QuotaBar
                  libelle="Mémoire"
                  utilise={espace.usage.ramGo}
                  total={espace.quota.ramGo}
                  unite="Go"
                  formateur={(v) => num(v)}
                />
                <QuotaBar
                  libelle="Stockage"
                  utilise={espace.usage.stockageTo}
                  total={espace.quota.stockageTo}
                  seuil={85}
                  formateur={(v) => toHumain(v)}
                />
              </div>
              <div className="mt-4 border-t border-g-100 pt-3.5">
                <MicroLabel className="mb-2">Consommation vCPU sur 30 jours</MicroLabel>
                <Sparkline
                  serie={trendSeries(`${id}-30j`, 30, espace.usage.vcpu * 0.72, espace.usage.vcpu, 3)}
                  hauteur={56}
                />
              </div>
              {espace.usage.stockageTo / espace.quota.stockageTo > 0.85 && (
                <Callout ton="warn" className="mt-3.5" titre="Extension de stockage recommandée">
                  À ce rythme de croissance, le plafond de {toHumain(espace.quota.stockageTo)} sera
                  atteint dans environ trois semaines. Le devis DEV-0418 propose une extension à 12
                  To applicable à chaud.
                </Callout>
              )}
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader titre="Caractéristiques" />
                <KeyValueList
                  colonnes={1}
                  items={[
                    { cle: 'Offre souscrite', valeur: espace.offreNom },
                    { cle: 'Site', valeur: SITE_LABEL[espace.site] },
                    {
                      cle: 'Plage réseau',
                      valeur: <span className="font-mono text-[13px]">{espace.cidr}</span>,
                    },
                    {
                      cle: 'DNS interne',
                      valeur: (
                        <span className="break-all font-mono text-[12px]">
                          {espace.dnsInterne}
                        </span>
                      ),
                    },
                    { cle: 'Projets', valeur: String(espace.projets) },
                    { cle: 'Créé le', valeur: dateCourte(espace.createdAt) },
                  ]}
                />
              </Card>
              <Card>
                <CardHeader titre="Derniers événements" />
                <EventList
                  evenements={EVENEMENTS_SUPERVISION.filter(
                    (e) => e.site === espace.site || e.ressource.includes(espace.code),
                  ).slice(0, 5)}
                  max={5}
                  lienSortie=""
                />
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ─── Ressources ──────────────────────────────────────────────── */}
      {onglet === 'ressources' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Rattachement à une application">
            Les groupes de machines et les clusters peuvent être rattachés à une application de la
            console applicative, ou rester autonomes. Le rattachement conditionne l’affichage de
            l’emplacement réel d’exécution des composants.
          </Callout>

          <Card>
            <CardHeader
              titre="Machines virtuelles autonomes"
              sousTitre="Machines non rattachées à une application."
              actions={
                <GatedAction
                  autorise={autorise('vm.create_delete')}
                  message={refus('vm.create_delete')}
                >
                  <ButtonLink href="/app/vms/new" size="sm" iconBefore={<Plus size={13} />}>
                    Créer des machines
                  </ButtonLink>
                </GatedAction>
              }
            />
            {vms.filter((v) => !v.applicationId).length === 0 ? (
              <EmptyState
                titre="Aucune machine autonome"
                phrase="Toutes les machines de cet espace sont rattachées à une application. Une machine autonome se gère unitairement, sans pipeline de déploiement."
              />
            ) : (
              <ul className="space-y-2">
                {vms
                  .filter((v) => !v.applicationId)
                  .map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Server size={14} className="shrink-0 text-g-500" />
                        <span className="min-w-0">
                          <Link
                            href={`/app/vms/${v.id}`}
                            className="block truncate font-mono text-[13px] font-semibold text-ink hover:text-p-700"
                          >
                            {v.nom}
                          </Link>
                          <span className="block text-[11px] text-g-500">
                            {v.os} · {v.vcpu} vCPU / {v.ramGo} Go / {v.diskGo} Go
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <HealthBadge etat={v.statut} size="sm" />
                        <BoutonFormulaire
                          libelle="Rattacher"
                          variant="ghost"
                          icone={<Link2 size={12} />}
                          action="vm.hardware.update"
                          titre={`Rattacher ${v.nom} à une application`}
                          description="Une machine rattachée apparaît dans la fiche de l’application, et son coût entre dans le showback de celle-ci."
                          champs={[
                            {
                              id: 'application',
                              label: 'Application',
                              type: 'select',
                              options: services.items
                                .filter((s) => s.appId)
                                .map((s) => ({ value: s.appId!, label: s.nom })),
                            },
                          ]}
                          libelleValider="Rattacher"
                          operation={(f) => {
                            const appId = String(f.application)
                            const svc = services.items.find((s) => s.appId === appId)
                            return {
                              titre: `${v.nom} rattachée à ${svc?.nom ?? appId}`,
                              effet: () =>
                                parc.modifier(v.id, {
                                  applicationId: appId,
                                  applicationNom: svc?.nom,
                                }),
                            }
                          }}
                        />
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Clusters Kubernetes"
              actions={
                <ButtonLink href="/app/kubernetes" size="sm" variant="secondary">
                  Gérer les clusters
                </ButtonLink>
              }
            />
            {clusters.length === 0 ? (
              <EmptyState
                titre="Aucun cluster dans cet espace"
                phrase="Un cluster Kubernetes managé consomme le quota vCPU et mémoire de cet espace pour ses nœuds workers. Le control plane est facturé à part."
                action={{ libelle: 'Créer un cluster', href: '/app/kubernetes' }}
              />
            ) : (
              <ul className="space-y-2">
                {clusters.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Container size={14} className="shrink-0 text-g-500" />
                      <span className="min-w-0">
                        <Link
                          href={`/app/kubernetes/${c.id}`}
                          className="block truncate font-mono text-[13px] font-semibold text-ink hover:text-p-700"
                        >
                          {c.nom}
                        </Link>
                        <span className="block text-[11px] text-g-500">
                          v{c.version} · control plane {c.controlPlane.mode === 'ha' ? 'HA' : 'mono'}{' '}
                          · {c.pools.reduce((a, p) => a + p.nodes, 0)} nœuds sur {c.pools.length}{' '}
                          pools
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {c.applicationId ? (
                        <Badge tone="violet" size="sm">
                          Rattaché · {c.applicationId}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          Autonome
                        </Badge>
                      )}
                      <HealthBadge etat={c.statut} size="sm" />
                      {c.applicationId ? (
                        <BoutonAction
                          libelle="Détacher"
                          variant="ghost"
                          icone={<Unlink size={12} />}
                          operation={{
                            action: 'app.deploy',
                            ton: 'warn',
                            titre: `${c.nom} détaché de ${c.applicationId}`,
                            detail: 'Le cluster continue de tourner : seul le rattachement change.',
                            effet: () => grappes.modifier(c.id, { applicationId: undefined }),
                          }}
                        />
                      ) : (
                        <BoutonFormulaire
                          libelle="Rattacher"
                          variant="ghost"
                          icone={<Link2 size={12} />}
                          action="app.deploy"
                          titre={`Rattacher ${c.nom} à une application`}
                          champs={[
                            {
                              id: 'application',
                              label: 'Application',
                              type: 'select',
                              options: services.items
                                .filter((s) => s.appId)
                                .map((s) => ({ value: s.appId!, label: s.nom })),
                            },
                          ]}
                          libelleValider="Rattacher"
                          operation={(f) => {
                            const appId = String(f.application)
                            const svc = services.items.find((s) => s.appId === appId)
                            return {
                              titre: `${c.nom} rattaché à ${svc?.nom ?? appId}`,
                              effet: () =>
                                grappes.modifier(c.id, { applicationId: appId }),
                            }
                          }}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader titre="Machines rattachées à une application" />
            {vms.filter((v) => v.applicationId).length === 0 ? (
              <EmptyState
                titre="Aucune machine rattachée"
                phrase="Rattacher une machine à une application permet de la piloter depuis la console applicative, avec son pipeline de déploiement."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Machine', 'Application', 'Gabarit', 'IP privée', 'État', ''].map((h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vms
                      .filter((v) => v.applicationId)
                      .map((v) => (
                        <tr key={v.id} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/app/vms/${v.id}`}
                              className="font-mono text-[13px] text-ink hover:text-p-700"
                            >
                              {v.nom}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={hrefDuService(v.applicationId)}
                              className="text-[13px] text-p-700 hover:underline"
                            >
                              {v.applicationNom}
                            </Link>
                          </td>
                          <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                            {v.vcpu} vCPU / {v.ramGo} Go
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-g-700">
                            {v.ips.find((i) => i.type === 'privee')?.adresse ?? '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <HealthBadge etat={v.statut} size="sm" />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <BoutonAction
                              libelle="Détacher"
                              variant="ghost"
                              icone={<Unlink size={12} />}
                              operation={{
                                action: 'vm.hardware.update',
                                ton: 'warn',
                                titre: `Volume détaché de ${v.nom}`,
                                detail: 'Le volume est conservé et reste facturé.',
                                effet: () =>
                                  disques.modifierPlusieurs(
                                    disques.items
                                      .filter((d) => d.attachedTo === v.id)
                                      .map((d) => d.id),
                                    { attachedTo: undefined, attachedLabel: undefined, montage: undefined },
                                  ),
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── Réseau ──────────────────────────────────────────────────── */}
      {onglet === 'reseau' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile libelle="Plage allouée" valeur={espace.cidr} />
            <StatTile libelle="Réseaux privés" valeur={reseaux.length} />
            <StatTile
              libelle="IP publiques"
              valeur={ips.length}
              detail={`${ips.filter((i) => !i.attachedTo).length} disponibles`}
            />
            <StatTile
              libelle="Anti-DDoS"
              valeur={ips.filter((i) => i.antiDdos).length}
              detail="IP protégées"
              ton="ok"
            />
          </div>

          <Card>
            <CardHeader
              titre="Réseaux privés de cet espace"
              actions={
                <ButtonLink href="/app/reseau" size="sm" variant="secondary">
                  Gestion complète du réseau
                </ButtonLink>
              }
            />
            {reseaux.length === 0 ? (
              <EmptyState
                titre="Aucun réseau privé"
                phrase="Un réseau privé segmente votre plage CIDR. Créez-en un par usage — front, données, cache — pour appliquer des groupes de sécurité distincts."
                action={{ libelle: 'Créer un réseau', href: '/app/reseau' }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Nom', 'Plage', 'VLAN', 'DNS interne', 'Workloads'].map((h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reseaux.map((r) => (
                      <tr key={r.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 text-[13px] font-medium text-ink">{r.nom}</td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-g-700">{r.cidr}</td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{r.vlan}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={r.dnsInterne ? 'ok' : 'neutral'} size="sm">
                            {r.dnsInterne ? 'Actif' : 'Désactivé'}
                          </Badge>
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{r.workloads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader titre="IP publiques attribuées à cet espace" />
            {ips.length === 0 ? (
              <EmptyState
                titre="Aucune IP publique"
                phrase="Une IP publique expose une machine ou un load balancer sur Internet. Elle est facturée à l’unité, avec une option anti-DDoS volumétrique."
              />
            ) : (
              <ul className="space-y-2">
                {ips.map((ip) => (
                  <li
                    key={ip.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[13px] font-semibold text-ink">
                        {ip.adresse}
                      </span>
                      {ip.ptr && (
                        <span className="block font-mono text-[11px] text-g-500">
                          PTR : {ip.ptr}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {ip.antiDdos && (
                        <Badge tone="ok" size="sm">
                          Anti-DDoS
                        </Badge>
                      )}
                      {ip.attachedLabel ? (
                        <Badge tone="violet" size="sm">
                          {ip.attachedLabel}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          Disponible
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ─── Stockage ────────────────────────────────────────────────── */}
      {onglet === 'stockage' && (
        <Card>
          <CardHeader
            titre="Volumes de cet espace"
            sousTitre={`${volumes.length} volumes · ${goHumain(volumes.reduce((a, v) => a + v.tailleGo, 0))} alloués`}
            actions={
              <ButtonLink href="/app/stockage" size="sm" variant="secondary">
                Gestion complète du stockage
              </ButtonLink>
            }
          />
          {volumes.length === 0 ? (
            <EmptyState
              titre="Aucun volume"
              phrase="Un volume est un disque attachable à une machine, extensible à chaud, chiffré au repos. Créez-en un pour séparer vos données du disque système."
              action={{ libelle: 'Créer un volume', href: '/app/stockage' }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Nom', 'Taille', 'Classe', 'IOPS', 'Chiffré', 'Attaché à', 'Montage'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {volumes.map((v) => (
                    <tr key={v.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[13px] text-ink">{v.nom}</td>
                      <td className="tnum px-3 py-2.5 text-[13px] text-g-700">
                        {goHumain(v.tailleGo)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone="neutral" size="sm">
                          {v.classe.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{num(v.iops)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={v.chiffre ? 'ok' : 'warn'} size="sm">
                          {v.chiffre ? 'Oui' : 'Non'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-g-700">
                        {v.attachedLabel ?? <span className="text-g-500">détaché</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-g-700">
                        {v.montage ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── Sauvegardes ─────────────────────────────────────────────── */}
      {onglet === 'sauvegardes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              libelle="Ressources protégées"
              valeur={vms.filter((v) => v.backupPlanId).length}
              detail={`sur ${vms.length} machines`}
              ton="ok"
            />
            <StatTile
              libelle="Non protégées"
              valeur={vms.filter((v) => !v.backupPlanId).length}
              ton={vms.filter((v) => !v.backupPlanId).length > 0 ? 'warn' : 'ok'}
            />
            <StatTile
              libelle="Points de restauration"
              valeur={pointsRestauration.items.filter((p) =>
                vms.some((v) => v.id === p.resourceId),
              ).length}
            />
            <StatTile
              libelle="Plans appliqués"
              valeur={
                new Set(vms.map((v) => v.backupPlanId).filter(Boolean)).size
              }
            />
          </div>

          <Card>
            <CardHeader
              titre="Plans appliqués dans cet espace"
              actions={
                <ButtonLink href="/app/sauvegarde" size="sm" variant="secondary">
                  Module de sauvegarde
                </ButtonLink>
              }
            />
            <div className="space-y-2">
              {plansSauvegarde.items.filter((p) => vms.some((v) => v.backupPlanId === p.id)).map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{p.nom}</span>
                    <span className="block text-[11px] text-g-500">
                      {p.frequence} · rétention {p.retentionJours} j · prochaine exécution{' '}
                      {dateHeure(p.prochaineExecution)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {p.immutable && (
                      <Badge tone="ok" size="sm">
                        Immuable
                      </Badge>
                    )}
                    <Badge
                      tone={
                        p.dernierResultat === 'ok'
                          ? 'ok'
                          : p.dernierResultat === 'partiel'
                            ? 'warn'
                            : 'err'
                      }
                      dot
                      size="sm"
                    >
                      {vms.filter((v) => v.backupPlanId === p.id).length} ressources
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {vms.filter((v) => !v.backupPlanId).length > 0 && (
            <Callout ton="warn" titre="Ressources non protégées dans cet espace">
              {vms
                .filter((v) => !v.backupPlanId)
                .map((v) => v.nom)
                .join(', ')}{' '}
              n’ont aucun plan de sauvegarde. Sans plan, aucune restauration n’est possible. Un plan
              par étiquette est la façon la plus simple de couvrir l’ensemble de vos machines de
              production.
            </Callout>
          )}
        </div>
      )}

      {/* ─── Supervision ─────────────────────────────────────────────── */}
      {onglet === 'supervision' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              libelle="Disponibilité 30 j"
              valeur={pct(99.96, 2)}
              ton="ok"
              serie={seededSeries(`${id}-up`, 24, 99.8, 100)}
            />
            <StatTile
              libelle="Incidents ouverts"
              valeur={EVENEMENTS_SUPERVISION.filter(
                (e) => e.site === espace.site && e.gravite === 'critique',
              ).length}
              ton="err"
            />
            <StatTile
              libelle="Ressources en alerte"
              valeur={vms.filter((v) => v.statut === 'error').length}
              ton={vms.some((v) => v.statut === 'error') ? 'warn' : 'ok'}
            />
            <StatTile libelle="Dernier incident" valeur="il y a 2 h" detail="Certificat TLS expiré" />
          </div>

          <GrilleSparkCharts seed={`espace-${id}`} />

          <Card>
            <CardHeader
              titre="Événements de supervision"
              sousTitre="Huit lignes maximum. L’analyse détaillée reste dans Centreon."
            />
            <EventList
              evenements={EVENEMENTS_SUPERVISION.filter((e) => e.site === espace.site)}
              max={8}
            />
          </Card>
        </div>
      )}

      {/* ─── Membres ─────────────────────────────────────────────────── */}
      {onglet === 'membres' && (
        <Card>
          <CardHeader
            titre="Membres ayant un rôle sur cet espace"
            sousTitre="Les rôles de portée organisation s’appliquent également ici."
            actions={
              <GatedAction autorise={autorise('member.invite')} message={refus('member.invite')}>
                <ButtonLink href="/app/membres" size="sm" iconBefore={<Plus size={13} />}>
                  Gérer les membres
                </ButtonLink>
              </GatedAction>
            }
          />
          <ul className="space-y-2">
            {adhesions.items.filter(
              (m) =>
                (m.scopeType === 'espace' && m.scopeId === id) || m.scopeType === 'org',
            ).map((m) => {
              const u = userById(m.userId)
              if (!u) return null
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar nom={u.nom} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {u.nom}
                      </span>
                      <span className="block truncate text-[11px] text-g-500">{u.email}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="violet" size="sm">
                      {ROLE_LABEL[m.role]}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {m.scopeType === 'espace' ? 'Portée espace' : 'Portée organisation'}
                    </Badge>
                  </span>
                </li>
              )
            })}
          </ul>
          <Callout ton="info" className="mt-3.5" titre="Portée des rôles">
            Un rôle de portée espace ne s’applique qu’à cet espace. Un rôle de portée organisation
            s’applique à tous les espaces. La matrice complète des droits est consultable dans
            Membres & rôles.
          </Callout>
        </Card>
      )}
    </div>
  )
}
