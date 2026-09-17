'use client'

import { useState } from 'react'
import { ArrowRightLeft, Plus } from 'lucide-react'
import { cn, seededSeries, trendSeries } from '@/lib/utils'
import { dateCourte, money, num, pct } from '@/lib/format'
import {
  BACKENDS,
  ESPACES,
  MARGE_BACKENDS,
  PLACEMENTS,
  SYNTHESE_PLATEFORME,
  VMS,
} from '@/lib/mock'
import { BACKEND_LABEL, SITE_COURT, type Backend, type Placement } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { QuotaBar, StatTile } from '@/components/composition/metrics'
import { BackendGauge, PlacementSlider, AvertissementMigration } from '@/components/business/infra'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, modifierRessource, requete } from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'

const ONGLETS = [
  { id: 'socles', label: 'Socles et capacité' },
  { id: 'placement', label: 'Placement par espace' },
  { id: 'projection', label: 'Projection de saturation' },
  { id: 'marge', label: 'Marge par socle' },
]

export default function Capacite() {
  const { autorise, refus, pousser } = useApp()
  const executer = useOperation()
  const socles = useCollection<Backend>('backends', BACKENDS)
  // `BACKENDS` est la graine de maquette ; en mode API, les socles réels
  // viennent de `socles.items` (cf. la même dérive déjà corrigée sur
  // /admin/sites — un socle fabriqué (GBM) ne doit plus apparaître ici).
  const BACKENDS_LUS = estActif() ? socles.items : BACKENDS
  const placements = useCollection<Placement>('placements', PLACEMENTS)
  // En mode API, les espaces viennent du backend : le sélecteur local
  // filtrerait sur des identifiants inconnus de l’API.
  const espacesDistants = useCollection('espaces', ESPACES)
  const ESPACES_LUS = estActif() ? espacesDistants.items : ESPACES
  // `GET /admin/capacite` ne sert que son `424` : les chiffres restent
  // locaux, mais une projection indisponible se dit au lieu de se taire.
  const { degrade } = useLectureDegradable('/admin/capacite')
  const [onglet, setOnglet] = useState('socles')
  const [espaceId, setEspaceId] = useState(ESPACES_LUS[0]?.id ?? '')
  const [rebalance, setRebalance] = useState(false)
  const [repartition, setRepartition] = useState<Array<{ backendId: string; percent: number }>>([])

  const espace = ESPACES_LUS.find((e) => e.id === espaceId)
  const placementsEspace = placements.items.filter((p) => p.espaceId === espaceId)

  /** Remplace la répartition de l'espace courant par celle qui vient d'être réglée. */
  const appliquerRepartition = (parts: Array<{ backendId: string; percent: number }>) => {
    if (parts.length === 0) return
    placements.supprimer(placementsEspace.map((p) => p.id))
    placements.creer(
      parts.map((part) => ({
        id: placements.identifiant('pl'),
        espaceId,
        backendId: part.backendId,
        percent: part.percent,
      })),
      'fin',
    )
  }
  const satures = socles.items.filter((b) => (b.saturation?.j30 ?? 0) > 85)
  const enSortie = socles.items.filter((b) => b.enSortie?.actif)

  const vcpuPct = Math.round(
    (SYNTHESE_PLATEFORME.vcpuUtilise / SYNTHESE_PLATEFORME.vcpuTotal) * 100,
  )
  const margeMoyenne =
    Math.round(
      (MARGE_BACKENDS.reduce((a, m) => a + m.marge, 0) / MARGE_BACKENDS.length) * 10,
    ) / 10

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Capacité & backends' }]}
        titre="Capacité & backends"
        sousTitre="Le placement multi-socle transparent est un objectif de produit, pas un détail d’exploitation : un Espace Cloud peut être réparti entre plusieurs hyperviseurs, et le client voit sur quel socle tourne chacune de ses machines."
        actions={
          <BoutonFormulaire
            libelle="Déclarer un socle"
            size="md"
            variant="primary"
            icone={<Plus size={14} />}
            action="capacity.manage"
            titre="Déclarer un socle d’hypervision"
            description="Un socle déclaré n’accueille rien tant qu’il n’est pas en ligne : les sondes tournent d’abord, le placement suit."
            champs={[
              { id: 'code', label: 'Code', placeholder: 'OS-ABJ-02', obligatoire: true },
              {
                id: 'type',
                label: 'Type',
                type: 'select',
                options: [
                  { value: 'openstack', label: 'OpenStack' },
                  { value: 'proxmox', label: 'Proxmox VE' },
                  { value: 'cloudstack', label: 'Apache CloudStack' },
                  { value: 'vmware', label: 'VMware vSphere' },
                  { value: 'hyperv', label: 'Microsoft Hyper-V' },
                ],
              },
              {
                id: 'site',
                label: 'Site',
                type: 'select',
                demi: true,
                options: [
                  { value: 'ABJ', label: 'Abidjan' },
                  { value: 'GBM', label: 'Grand-Bassam' },
                ],
              },
              { id: 'vcpu', label: 'vCPU', type: 'nombre', demi: true, min: 8 },
              { id: 'ram', label: 'Mémoire', type: 'nombre', demi: true, min: 32, suffixe: 'Go' },
              { id: 'stockage', label: 'Stockage', type: 'nombre', demi: true, min: 1, suffixe: 'To' },
            ]}
            valeursDepart={{ type: 'openstack', site: 'ABJ', vcpu: 256, ram: 1024, stockage: 100 }}
            libelleValider="Déclarer"
            operation={(v) => {
              const idSocle = socles.identifiant('bk')
              return {
                titre: `Socle ${v.code} déclaré`,
                detail: 'Il reste hors placement jusqu’à sa mise en ligne.',
                effet: () =>
                  socles.creer({
                    id: idSocle,
                    code: String(v.code),
                    type: v.type as Backend['type'],
                    site: v.site as Backend['site'],
                    statut: 'degrade',
                    capacite: {
                      vcpu: Number(v.vcpu),
                      ramGo: Number(v.ram),
                      stockageTo: Number(v.stockage),
                    },
                    usage: { vcpuPct: 0, ramPct: 0, stockagePct: 0 },
                    hosts: 0,
                    souverain: v.type !== 'vmware' && v.type !== 'hyperv',
                  }),
                job: {
                  type: 'backend.declare',
                  label: `Raccordement du socle ${v.code}`,
                  etapes: [
                    'Vérifier l’accès à l’API du socle',
                    'Inventorier les hôtes',
                    'Déclarer les sondes de supervision',
                    'Ouvrir le socle au placement',
                  ],
                },
                effetFinal: () => socles.modifier(idSocle, { statut: 'en_ligne' }),
              }
            }}
          />
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {BACKENDS_LUS.length} socles
            </Badge>
            <Badge tone="neutral" size="sm">
              {num(SYNTHESE_PLATEFORME.vcpuTotal)} vCPU installés
            </Badge>
            <Badge tone={margeMoyenne > 40 ? 'ok' : 'warn'} size="sm">
              Marge moyenne {pct(margeMoyenne, 1)}
            </Badge>
          </>
        }
      />

      {degrade && (
        <Callout
          ton="warn"
          titre={`Projection de capacité indisponible${degrade.integration ? ` — ${degrade.integration}` : ''}`}
        >
          L’intégration amont ne répond pas
          {degrade.dateDonnees ? ` (données du ${degrade.dateDonnees})` : ''} : les projections
          ci-dessous sont les dernières connues. Le plan d’extension reste à valider contre
          l’état réel des socles.
        </Callout>
      )}

      {satures.length > 0 && (
        <Callout ton="warn" titre={`${satures.length} socle dépassera 85 % de saturation sous 30 jours`}>
          {satures
            .map((b) => `${b.code} (${pct(b.saturation!.j30)} projeté à 30 jours)`)
            .join(' · ')}
          . Deux leviers : rééquilibrer le placement des espaces vers un socle moins chargé, ou ajouter
          des hôtes. Le rééquilibrage est immédiat pour les nouvelles créations, progressif pour
          l’existant — machine par machine, à froid ou à chaud selon le socle.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          libelle="Processeur alloué"
          valeur={pct(vcpuPct)}
          ton={vcpuPct > 80 ? 'warn' : 'violet'}
          detail={`${num(SYNTHESE_PLATEFORME.vcpuUtilise)} / ${num(SYNTHESE_PLATEFORME.vcpuTotal)} vCPU`}
          serie={trendSeries('cap-vcpu', 30, vcpuPct - 11, vcpuPct)}
        />
        <StatTile
          libelle="Mémoire installée"
          valeur={`${num(Math.round(SYNTHESE_PLATEFORME.ramTotalGo / 1024))} Tio`}
          detail={`${num(SYNTHESE_PLATEFORME.ramTotalGo)} Go`}
        />
        <StatTile
          libelle="Stockage installé"
          valeur={`${num(SYNTHESE_PLATEFORME.stockageTotalTo)} To`}
        />
        <StatTile
          libelle="Socles en tension"
          valeur={satures.length}
          ton={satures.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Socles en sortie"
          valeur={enSortie.length}
          ton={enSortie.length > 0 ? 'info' : 'ok'}
          detail="Trajectoire assumée et publiée"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'socles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {BACKENDS_LUS.map((b) => (
              <BackendGauge key={b.id} backend={b} />
            ))}
          </div>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Capacité détaillée"
                sousTitre="Un socle en maintenance est retiré du pool de placement pour les nouvelles créations, sans que ses charges existantes soient touchées."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Socle', 'Technologie', 'Site', 'Hôtes', 'Processeur', 'Mémoire', 'Stockage', 'Souverain', 'État', ''].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {BACKENDS_LUS.map((b) => (
                    <tr key={b.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="block font-mono text-[12px] font-semibold text-ink">
                          {b.code}
                        </span>
                        {b.enSortie?.actif && (
                          <span className="mt-0.5 block text-[11px] text-warn">
                            Sortie vers {b.enSortie.cibleMigration}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-g-700">
                        {BACKEND_LABEL[b.type]}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-g-700">{SITE_COURT[b.site]}</td>
                      <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{b.hosts}</td>
                      <td className="w-40 px-3 py-2.5">
                        <QuotaBar
                          utilise={Math.round((b.capacite.vcpu * b.usage.vcpuPct) / 100)}
                          total={b.capacite.vcpu}
                          compact
                          seuil={85}
                          formateur={(v) => num(v)}
                        />
                      </td>
                      <td className="w-40 px-3 py-2.5">
                        <QuotaBar
                          utilise={Math.round((b.capacite.ramGo * b.usage.ramPct) / 100)}
                          total={b.capacite.ramGo}
                          compact
                          seuil={85}
                          formateur={(v) => num(v)}
                        />
                      </td>
                      <td className="w-40 px-3 py-2.5">
                        <QuotaBar
                          utilise={Math.round((b.capacite.stockageTo * b.usage.stockagePct) / 100)}
                          total={b.capacite.stockageTo}
                          compact
                          seuil={85}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={b.souverain ? 'ok' : 'warn'} size="sm">
                          {b.souverain ? 'Libre' : 'Propriétaire'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          tone={
                            b.statut === 'en_ligne'
                              ? 'ok'
                              : b.statut === 'maintenance'
                                ? 'info'
                                : 'warn'
                          }
                          dot
                          size="sm"
                        >
                          {b.statut === 'en_ligne'
                            ? 'En ligne'
                            : b.statut === 'maintenance'
                              ? 'Maintenance'
                              : 'Dégradé'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <BoutonAction
                            libelle="Détail"
                            variant="ghost"
                            operation={{
                              ton: 'info',
                              titre: `${b.code} · ${BACKEND_LABEL[b.type]}`,
                              detail: `${b.hosts} hôtes · ${b.capacite.vcpu} vCPU · ${num(b.capacite.ramGo)} Go · saturation projetée à 30 jours ${b.saturation?.j30 ?? 0} %`,
                            }}
                          />
                          <BoutonAction
                            libelle={b.statut === 'maintenance' ? 'Remettre en ligne' : 'Drainer'}
                            variant="ghost"
                            operation={{
                              action: 'capacity.manage',
                              ton: b.statut === 'maintenance' ? 'ok' : 'warn',
                              titre:
                                b.statut === 'maintenance'
                                  ? `${b.code} remis en ligne`
                                  : `Drainage de ${b.code} lancé`,
                              detail:
                                b.statut === 'maintenance'
                                  ? 'Le socle accueille de nouveau des placements.'
                                  : 'Les machines du socle sont migrées à chaud vers les autres socles du site avant la maintenance.',
                              appel: () =>
                                modifierRessource('/admin/backends', b.id, {
                                  statut:
                                    b.statut === 'maintenance' ? 'en_ligne' : 'maintenance',
                                }),
                              job:
                                b.statut === 'maintenance'
                                  ? undefined
                                  : {
                                      type: 'backend.drain',
                                      label: `Drainage du socle ${b.code}`,
                                      etapes: [
                                        'Fermer le socle au placement',
                                        'Calculer le plan de migration',
                                        'Migrer les machines à chaud',
                                        'Vérifier qu’aucune charge ne reste',
                                      ],
                                    },
                              effet:
                                b.statut === 'maintenance'
                                  ? () => socles.modifier(b.id, { statut: 'en_ligne' })
                                  : undefined,
                              effetFinal: () => {
                                // En maquette, le drainage simulé bascule le
                                // socle à la fin ; en mode API, le
                                // rechargement rapporte l’état réel.
                                if (!estActif() && b.statut !== 'maintenance')
                                  socles.modifier(b.id, { statut: 'maintenance' })
                                socles.recharger()
                              },
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {enSortie.length > 0 && (
            <Card>
              <CardHeader
                titre="Socles en trajectoire de sortie"
                sousTitre="Le calendrier de sortie est publié, y compris côté vitrine."
              />
              <AvertissementMigration
                lots={enSortie.length}
                machines={VMS.filter((v) => enSortie.some((b) => b.code.startsWith(v.site))).length + 42}
              />
              <div className="mt-4 space-y-2">
                {enSortie.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[13px] font-semibold text-ink">
                        {b.code} · {BACKEND_LABEL[b.type]}
                      </span>
                      <span className="block text-[11px] text-g-700">
                        Cible de migration : {b.enSortie!.cibleMigration}
                      </span>
                    </span>
                    <ButtonLink size="sm" variant="secondary" href="/admin/migration">
                      Plan de migration
                    </ButtonLink>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {onglet === 'placement' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Placement d’un Espace Cloud"
              sousTitre="Un espace peut être réparti entre plusieurs socles ; la somme des pourcentages est forcée à 100."
              actions={
                <Select
                  value={espaceId}
                  onChange={(e) => setEspaceId(e.target.value)}
                  className="w-auto"
                >
                  {ESPACES_LUS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code} — {e.offreNom}
                    </option>
                  ))}
                </Select>
              }
            />
            {espace && (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <StatTile
                    libelle="Processeur"
                    valeur={`${espace.usage.vcpu}/${espace.quota.vcpu}`}
                    unite="vCPU"
                    ton={espace.usage.vcpu / espace.quota.vcpu > 0.85 ? 'warn' : 'violet'}
                  />
                  <StatTile
                    libelle="Mémoire"
                    valeur={`${espace.usage.ramGo}/${espace.quota.ramGo}`}
                    unite="Go"
                  />
                  <StatTile
                    libelle="Machines"
                    valeur={VMS.filter((v) => v.espaceId === espace.id).length}
                  />
                  <StatTile libelle="Site" valeur={SITE_COURT[espace.site]} detail={espace.cidr} />
                </div>

                <PlacementSlider
                  key={espaceId}
                  backends={socles.items.filter((b) => b.statut === 'en_ligne')}
                  initial={
                    placementsEspace.length > 0
                      ? placementsEspace.map((p) => ({ backendId: p.backendId, percent: p.percent }))
                      : [{ backendId: BACKENDS_LUS[0]?.id ?? BACKENDS[1].id, percent: 100 }]
                  }
                  onChange={setRepartition}
                  onAppliquer={appliquerRepartition}
                />

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-g-100 pt-4">
                  <GatedAction
                    autorise={autorise('capacity.manage')}
                    message={refus('capacity.manage')}
                  >
                    <Button
                      iconBefore={<ArrowRightLeft size={13} />}
                      onClick={() => setRebalance(true)}
                    >
                      Appliquer le rééquilibrage
                    </Button>
                  </GatedAction>
                  <BoutonAction
                    libelle="Simuler l’impact"
                    variant="ghost"
                    size="md"
                    operation={{
                      ton: 'info',
                      titre: 'Simulation terminée',
                      detail: `${placementsEspace.length} socle(s) concerné(s) : migration à chaud possible pour la majorité des machines, redémarrage nécessaire pour celles dont le socle cible change de famille d’hyperviseur. Rien n’a été déplacé.`,
                    }}
                  />
                  <span className="text-[12px] text-g-500">
                    La simulation liste les machines à déplacer et le mode de migration disponible pour
                    chacune.
                  </span>
                </div>
              </>
            )}
          </Card>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Placement de tous les espaces"
                sousTitre="Vue d’ensemble de la répartition, tous clients confondus."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Espace', 'Offre', 'Site', 'Répartition', 'Machines', 'Statut'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ESPACES_LUS.map((e) => {
                    const pls = placements.items.filter((p) => p.espaceId === e.id)
                    return (
                      <tr key={e.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-ink">
                          {e.code}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-g-700">{e.offreNom}</td>
                        <td className="px-3 py-2.5 text-[12px] text-g-700">
                          {SITE_COURT[e.site]}
                        </td>
                        <td className="px-3 py-2.5">
                          {pls.length === 0 ? (
                            <span className="text-[12px] text-g-500">Placement automatique</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {pls.map((p) => {
                                const b = BACKENDS_LUS.find((x) => x.id === p.backendId)
                                return (
                                  <Badge
                                    key={p.backendId}
                                    tone={b?.souverain ? 'ok' : 'warn'}
                                    size="sm"
                                  >
                                    {b?.code ?? p.backendId} {pct(p.percent)}
                                  </Badge>
                                )
                              })}
                            </span>
                          )}
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                          {VMS.filter((v) => v.espaceId === e.id).length}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={e.statut === 'active' ? 'ok' : 'warn'} dot size="sm">
                            {e.statut}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Callout ton="violet" titre="Le socle est visible côté client">
            Un client qui doit prouver la localisation de ses données, ou savoir si une migration à
            chaud est possible sur telle machine, a besoin de cette information.
          </Callout>
        </div>
      )}

      {onglet === 'projection' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Projection de saturation"
              sousTitre="Extrapolation de la croissance observée sur 90 jours, socle par socle. Elle indique quand agir, pas ce qui va arriver."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Socle', 'Aujourd’hui', 'À 30 jours', 'À 60 jours', 'À 90 jours', 'Action recommandée'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {BACKENDS_LUS.filter((b) => b.saturation).map((b) => {
                    const s = b.saturation!
                    return (
                      <tr key={b.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <span className="block font-mono text-[12px] font-semibold text-ink">
                            {b.code}
                          </span>
                          <span className="block text-[11px] text-g-500">
                            {BACKEND_LABEL[b.type]} · {SITE_COURT[b.site]}
                          </span>
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                          {pct(b.usage.vcpuPct)}
                        </td>
                        {[s.j30, s.j60, s.j90].map((v, i) => (
                          <td key={i} className="px-3 py-2.5">
                            <Badge tone={v > 95 ? 'err' : v > 85 ? 'warn' : 'ok'} size="sm">
                              {pct(v)}
                            </Badge>
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-[12px] text-g-700">
                          {s.j30 > 90
                            ? 'Ajouter des hôtes ou drainer maintenant'
                            : s.j60 > 90
                              ? 'Commander des hôtes ce mois-ci'
                              : s.j90 > 85
                                ? 'Prévoir au budget du trimestre'
                                : 'Aucune action requise'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Croissance observée"
                sousTitre="Processeur alloué sur la plateforme, 90 derniers jours."
              />
              <div className="flex items-end gap-1">
                {trendSeries('cap-croissance', 90, vcpuPct - 22, vcpuPct).map((v, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex-1 rounded-t-sm',
                      v > 85 ? 'bg-warn' : v > 75 ? 'bg-p-600' : 'bg-p-300',
                    )}
                    style={{ height: `${20 + v}px` }}
                    title={`${pct(Math.round(v))}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-g-500">
                <span>Il y a 90 jours</span>
                <span>Aujourd’hui</span>
              </div>
              <KeyValueList
                className="mt-4 border-t border-g-100 pt-4"
                colonnes={1}
                items={[
                  { cle: 'Croissance mensuelle moyenne', valeur: '+ 7,4 % de vCPU alloué' },
                  { cle: 'Nouvelles organisations sur 90 jours', valeur: '3' },
                  { cle: 'Espaces créés sur 90 jours', valeur: '5' },
                  {
                    cle: 'Capacité résiduelle au rythme actuel',
                    valeur: 'Environ 4 mois avant 90 % d’allocation',
                  },
                ]}
              />
            </Card>

            <Card>
              <CardHeader
                titre="Plan d’extension"
                sousTitre="Ce qu’il faut commander, et à quelle date au plus tard."
              />
              <div className="space-y-2">
                {[
                  {
                    q: 'Ce trimestre',
                    quoi: '4 hôtes sur OS-ABJ-01',
                    d: 'Absorbe la croissance prévue et permet de drainer HV-RBX-01 sans dégrader le service.',
                    cout: 18_400_000,
                    urgent: true,
                  },
                  {
                    q: 'Prochain trimestre',
                    quoi: '2 baies de stockage à Grand-Bassam',
                    d: 'La capacité de sauvegarde hors site sature avant le calcul. C’est la contrainte la moins visible et la plus pénalisante.',
                    cout: 9_800_000,
                    urgent: false,
                  },
                  {
                    q: 'Dans six mois',
                    quoi: '6 hôtes sur CS-ABJ-03',
                    d: 'Reprise des charges de CL-GRA-01 dans le cadre de la trajectoire de sortie.',
                    cout: 27_600_000,
                    urgent: false,
                  },
                ].map((x) => (
                  <div
                    key={x.quoi}
                    className={cn(
                      'rounded-[6px] border px-3 py-2.5',
                      x.urgent ? 'border-warn/40' : 'border-g-300',
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="min-w-0 text-[13px] font-semibold text-ink">{x.quoi}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={x.urgent ? 'warn' : 'neutral'} size="sm">
                          {x.q}
                        </Badge>
                        <span className="tnum text-[12px] font-bold text-ink">{money(x.cout)}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-g-700">{x.d}</p>
                  </div>
                ))}
              </div>
              <Callout ton="info" className="mt-4" titre="La capacité de sauvegarde sature avant le calcul">
                C’est un piège classique : on dimensionne le calcul, on oublie que chaque machine
                supplémentaire produit des points de restauration, et le stockage hors site arrive à
                saturation le premier. Là, plus personne n’est conforme à la règle 3-2-1.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'marge' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Marge par socle"
                sousTitre="Coût d’infrastructure — matériel amorti, licences, énergie, hébergement — face au revenu qu’il porte."
                className="mb-0"
                actions={
                  <Badge tone={margeMoyenne > 40 ? 'ok' : 'warn'} size="sm">
                    Moyenne {pct(margeMoyenne, 1)}
                  </Badge>
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Socle', 'Technologie', 'Coût d’infrastructure', 'Revenu porté', 'Marge', 'Lecture'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...MARGE_BACKENDS]
                    .sort((a, b) => b.marge - a.marge)
                    .map((m) => {
                      const socle = BACKENDS_LUS.find((b) => b.code === m.backend)
                      return (
                        <tr key={m.backend} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2.5">
                            <span className="block font-mono text-[12px] font-semibold text-ink">
                              {m.backend}
                            </span>
                            {socle?.enSortie?.actif && (
                              <Badge tone="warn" size="sm">
                                En sortie
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-g-700">{m.type}</td>
                          <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                            {money(m.coutInfra)}
                          </td>
                          <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                            {money(m.revenu)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="relative block h-2 w-20 overflow-hidden rounded-full bg-g-100">
                                <span
                                  className={cn(
                                    'absolute inset-y-0 left-0 rounded-full',
                                    m.marge > 50 ? 'bg-ok' : m.marge > 30 ? 'bg-p-600' : 'bg-warn',
                                  )}
                                  style={{ width: `${m.marge}%` }}
                                />
                              </span>
                              <span
                                className={cn(
                                  'tnum text-[12px] font-bold',
                                  m.marge > 50 ? 'text-ok' : m.marge > 30 ? 'text-ink' : 'text-warn',
                                )}
                              >
                                {pct(m.marge, 1)}
                              </span>
                            </span>
                          </td>
                          <td className="max-w-[32ch] px-3 py-2.5 text-[11px] leading-relaxed text-g-500">
                            {m.marge > 50
                              ? 'Socle libre, sans licence à payer. Le placement devrait le privilégier.'
                              : m.marge > 30
                                ? 'Marge correcte, licences comprises.'
                                : 'Licences propriétaires coûteuses. La sortie de ce socle améliore mécaniquement la marge.'}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-g-300 bg-p-050">
                    <td colSpan={2} className="px-3 py-2.5 text-right text-[13px] font-bold text-ink">
                      Total
                    </td>
                    <td className="tnum px-3 py-2.5 text-[13px] font-bold text-ink">
                      {money(MARGE_BACKENDS.reduce((a, m) => a + m.coutInfra, 0))}
                    </td>
                    <td className="tnum px-3 py-2.5 text-[13px] font-bold text-ink">
                      {money(MARGE_BACKENDS.reduce((a, m) => a + m.revenu, 0))}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone="ok" size="sm">
                        {pct(
                          Math.round(
                            ((MARGE_BACKENDS.reduce((a, m) => a + m.revenu, 0) -
                              MARGE_BACKENDS.reduce((a, m) => a + m.coutInfra, 0)) /
                              MARGE_BACKENDS.reduce((a, m) => a + m.revenu, 0)) *
                              1000,
                          ) / 10,
                          1,
                        )}
                      </Badge>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Callout ton="violet" titre="Marge par famille de socle">
              Socles libres : 49 à 57 %. Socles propriétaires : 24 à 31 %. L’écart correspond au coût
              des licences.
            </Callout>
            <Card>
              <CardHeader
                titre="Effet de la trajectoire de sortie"
                sousTitre="Marge projetée à la fin de la migration."
              />
              <div className="space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-g-700">Marge actuelle</span>
                    <span className="tnum text-[13px] font-bold text-ink">{pct(margeMoyenne, 1)}</span>
                  </div>
                  <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-g-100">
                    <span
                      className="block h-full rounded-full bg-p-600"
                      style={{ width: `${margeMoyenne}%` }}
                    />
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-g-700">
                      Marge projetée après sortie des socles propriétaires
                    </span>
                    <span className="tnum text-[13px] font-bold text-ok">{pct(51.2, 1)}</span>
                  </div>
                  <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-g-100">
                    <span className="block h-full rounded-full bg-ok" style={{ width: '51.2%' }} />
                  </span>
                </div>
              </div>
              <KeyValueList
                className="mt-4 border-t border-g-100 pt-4"
                colonnes={1}
                items={[
                  { cle: 'Licences économisées par an', valeur: money(28_800_000) },
                  { cle: 'Coût de la migration', valeur: money(9_400_000) },
                  { cle: 'Retour sur investissement', valeur: 'Moins de 5 mois' },
                  { cle: 'Fin de trajectoire', valeur: dateCourte('2027-06-30') },
                ]}
              />
              <ButtonLink size="sm" variant="secondary" className="mt-3.5" href="/admin/migration">
                Voir le plan de migration
              </ButtonLink>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={rebalance}
        onClose={() => setRebalance(false)}
        titre="Appliquer un rééquilibrage de placement"
        ressource={espace?.code ?? ''}
        libelleAction="Appliquer le rééquilibrage"
        pertes={[
          'Les nouvelles machines seront créées selon la nouvelle répartition, immédiatement',
          'Les machines existantes seront déplacées progressivement — à chaud quand le socle le permet, sinon lors d’un redémarrage planifié',
          'Le client verra le changement de socle sur chacune de ses machines, et l’opération apparaîtra dans son journal d’audit',
        ]}
        onConfirm={() => {
          executer({
            action: 'capacity.manage',
            titre: 'Rééquilibrage appliqué',
            detail: `Le placement de ${espace?.code} est mis à jour. Les migrations à chaud démarrent maintenant ; les autres sont planifiées dans la fenêtre de maintenance du client.`,
            appel: () =>
              requete('/admin/placements', {
                methode: 'PUT',
                corps: {
                  placements: repartition.map((part) => ({
                    // Le backend régénère les identifiants : on renvoie
                    // l’existant quand il y en a un, sinon un provisoire.
                    id:
                      placementsEspace.find((p) => p.backendId === part.backendId)?.id ??
                      `${espaceId}-${part.backendId}`,
                    espaceId,
                    backendId: part.backendId,
                    percent: part.percent,
                  })),
                },
              }),
            job: { workflow: 'capacite.rebalance', cible: espace?.code ?? 'espace' },
            effetFinal: () => appliquerRepartition(repartition),
          })
          setRebalance(false)
        }}
      />
    </div>
  )
}
