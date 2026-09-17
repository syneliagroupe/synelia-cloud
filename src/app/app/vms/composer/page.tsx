'use client'

import { useState } from 'react'
import { Rocket, Server } from 'lucide-react'
import { SITE_LABEL, type EspaceCloud, type VM } from '@/lib/types'
import { ESPACES, NETWORKS, VMS } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Field, SegmentedControl, Select } from '@/components/ui/field'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { CostPreview, Timeline } from '@/components/composition/flow'
import {
  ComposeurServeurs,
  ROLES_SERVEUR,
  coutLot,
  type LotServeurs,
} from '@/components/business/composeur-serveurs'
import { useApp } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'

/** Systèmes proposés au lot — le libellé sert de nom d'image sur la machine. */
const IMAGES: Record<'debian' | 'ubuntu' | 'rocky' | 'windows', { nom: string }> = {
  debian: { nom: 'Debian 12' },
  ubuntu: { nom: 'Ubuntu Server 24.04 LTS' },
  rocky: { nom: 'Rocky Linux 9' },
  windows: { nom: 'Windows Server 2022' },
}

/** Le plan de départ raconte une architecture courante : deux frontaux, une base. */
const PLAN_INITIAL: LotServeurs[] = [
  {
    id: 'lot-web-1-0',
    roleId: 'web',
    prefixe: 'web',
    quantite: 2,
    cpu: 4,
    ramGo: 8,
    diskGo: 80,
    nics: 1,
    reseau: 'prod-front',
    logiciels: ['Nginx', 'PHP-FPM 8.3', 'Agent de supervision'],
    antiAffinite: true,
    sauvegarde: false,
  },
  {
    id: 'lot-base-1-1',
    roleId: 'base',
    prefixe: 'db',
    quantite: 1,
    cpu: 8,
    ramGo: 32,
    diskGo: 500,
    nics: 1,
    reseau: 'prod-back',
    logiciels: ['PostgreSQL 16', 'pgBackRest', 'Agent de supervision'],
    antiAffinite: true,
    sauvegarde: true,
  },
]

export default function ComposerServeurs() {
  const { autorise, refus, pousser } = useApp()
  const parc = useCollection<VM>('vms', VMS)
  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  const { lancerJob } = useAtelier()
  const [espaceId, setEspaceId] = useState(ESPACES[0].id)
  const [image, setImage] = useState<'debian' | 'ubuntu' | 'rocky' | 'windows'>('debian')
  const [lots, setLots] = useState<LotServeurs[]>(PLAN_INITIAL)
  const [lance, setLance] = useState(false)

  const espace = espaces.items.find((e) => e.id === espaceId) ?? ESPACES[0]
  const reseaux = NETWORKS.filter((r) => r.espaceId === espace.id).map((r) => r.nom)
  const machines = lots.reduce((a, l) => a + l.quantite, 0)
  const cout = lots.reduce((a, l) => a + coutLot(l), 0)
  const vcpu = lots.reduce((a, l) => a + l.cpu * l.quantite, 0)
  const ram = lots.reduce((a, l) => a + l.ramGo * l.quantite, 0)

  const depasse =
    espace.usage.vcpu + lots.reduce((a, l) => a + l.cpu * l.quantite, 0) > espace.quota.vcpu ||
    espace.usage.ramGo + lots.reduce((a, l) => a + l.ramGo * l.quantite, 0) > espace.quota.ramGo

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Machines virtuelles', href: '/app/vms' },
          { label: 'Composer un lot' },
        ]}
        titre="Composer un lot de serveurs"
        sousTitre="Décrire une architecture plutôt que créer les machines une par une : on tire des rôles sur le plan, on ajuste le gabarit, le réseau et ce qui doit être installé, puis on livre tout d’un coup."
        meta={
          <>
            <Badge tone="neutral">{machines} machines</Badge>
            <Badge tone="neutral">{lots.length} lots</Badge>
            <Badge tone="violet">{SITE_LABEL[espace.site]}</Badge>
          </>
        }
        actions={
          <ButtonLink href="/app/vms/new" variant="secondary" size="sm">
            Créer une machine à l’unité
          </ButtonLink>
        }
      />

      {lance ? (
        <Card>
          <CardHeader
            titre="Livraison lancée"
            sousTitre={`${machines} machines en préparation dans ${espace.code}. Vous pouvez quitter cette page : le centre de tâches garde le suivi.`}
          />
          <Timeline
            evenements={[
              { id: 'e1', titre: 'Plan validé et quota réservé', horodatage: 'terminé', ton: 'ok' },
              { id: 'e2', titre: `Création des ${machines} machines`, detail: 'Placement sur hôtes distincts pour les lots redondants', horodatage: 'en cours', ton: 'info' },
              { id: 'e3', titre: 'Rattachement aux réseaux et attribution des adresses', horodatage: '—', ton: 'neutral' },
              { id: 'e4', titre: 'Installation des logiciels demandés', horodatage: '—', ton: 'neutral' },
              { id: 'e5', titre: 'Pose des sondes de supervision', horodatage: '—', ton: 'neutral' },
              { id: 'e6', titre: 'Rattachement au plan de sauvegarde', horodatage: '—', ton: 'neutral' },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/app/vms" variant="secondary" size="sm">
              Voir les machines
            </ButtonLink>
            <Button variant="ghost" size="sm" onClick={() => setLance(false)}>
              Composer un autre lot
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Espace Cloud" hint="Le quota et le site en découlent.">
                <Select value={espaceId} onChange={(e) => setEspaceId(e.target.value)}>
                  {espaces.items.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code} — {e.offreNom}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Image système" hint="Appliquée à tout le lot.">
                <Select value={image} onChange={(e) => setImage(e.target.value as typeof image)}>
                  <option value="debian">Debian 12</option>
                  <option value="ubuntu">Ubuntu Server 24.04 LTS</option>
                  <option value="rocky">Rocky Linux 9</option>
                  <option value="windows">Windows Server 2022</option>
                </Select>
              </Field>
              <Field label="Site physique" hint="Celui de l’Espace Cloud choisi.">
                <SegmentedControl
                  options={[
                    { value: 'ABJ', label: 'Abidjan' },
                    { value: 'GBM', label: 'Grand-Bassam' },
                  ]}
                  value={espace.site}
                  onChange={() => undefined}
                />
              </Field>
            </div>
          </Card>

          <ComposeurServeurs
            lots={lots}
            onChange={setLots}
            reseaux={reseaux.length > 0 ? reseaux : ['prod-front', 'prod-back', 'admin']}
            quota={espace.quota}
            usage={espace.usage}
          />

          {lots.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Ce qui va être livré"
                  sousTitre="Chaque ligne est une machine réelle, nommée à l’avance."
                />
                <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {lots.flatMap((l) =>
                    Array.from({ length: l.quantite }).map((_, i) => {
                      const role = ROLES_SERVEUR.find((r) => r.id === l.roleId)
                      return (
                        <li
                          key={`${l.id}-${i}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-2.5 py-1.5"
                        >
                          <span className="flex items-center gap-2">
                            <Server size={12} className="shrink-0 text-p-700" />
                            <span className="font-mono text-[12px] font-semibold text-ink">
                              {l.prefixe}-{String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="text-[11px] text-g-500">{role?.nom}</span>
                          </span>
                          <span className="text-[11px] text-g-500">
                            {l.cpu} vCPU · {l.ramGo} Go · {l.diskGo} Go · {l.reseau}
                          </span>
                        </li>
                      )
                    }),
                  )}
                </ul>
              </Card>

              <div className="space-y-4">
                <CostPreview
                  lignes={lots.map((l) => {
                    const role = ROLES_SERVEUR.find((r) => r.id === l.roleId)
                    return {
                      libelle: `${role?.nom ?? l.roleId} — ${l.prefixe}`,
                      detail: `${l.quantite} × ${l.cpu} vCPU · ${l.ramGo} Go · ${l.diskGo} Go${l.sauvegarde ? ' · sauvegardé' : ''}`,
                      quantite: l.quantite,
                      montant: coutLot(l),
                    }
                  })}
                  jourDuMois={19}
                />
                <GatedAction
                  autorise={autorise('vm.create_delete')}
                  message={refus('vm.create_delete')}
                >
                  <Button
                    fullWidth
                    iconBefore={<Rocket size={14} />}
                    disabled={depasse || machines === 0}
                    onClick={() => {
                      setLance(true)
                      // Un lot livré crée réellement ses machines, à l'état
                      // « creating » : c'est ce que le centre de tâches fera
                      // basculer en marche, lot par lot.
                      const octet = parc.items.length + 20
                      let rang = 0
                      const nouvelles: VM[] = lots.flatMap((l) =>
                        Array.from({ length: l.quantite }, (_, i) => {
                          rang += 1
                          return {
                            id: parc.identifiant('vm'),
                            espaceId: espace.id,
                            nom: `${l.prefixe}-${String(i + 1).padStart(2, '0')}`,
                            os: IMAGES[image].nom,
                            vcpu: l.cpu,
                            ramGo: l.ramGo,
                            diskGo: l.diskGo,
                            flavor: 'composé',
                            ips: [
                              { adresse: `10.0.1.${octet + rang}`, type: 'privee' as const },
                            ],
                            statut: 'creating' as const,
                            hardware: {
                              scsiControllers: 1,
                              nics: l.nics,
                              usb: false,
                              secureBoot: true,
                              videoMo: 16,
                              vtpm: true,
                            },
                            backupPlanId: l.sauvegarde ? 'bp-prod-quotidien' : undefined,
                            site: espace.site,
                            tags: [l.roleId],
                          }
                        }),
                      )
                      parc.creer(nouvelles)
                      espaces.modifier(espace.id, (e) => ({
                        usage: {
                          ...e.usage,
                          vcpu: e.usage.vcpu + vcpu,
                          ramGo: e.usage.ramGo + ram,
                        },
                      }))
                      pousser({
                        ton: 'info',
                        titre: `${machines} machines en préparation`,
                        detail: `${espace.code} · ${SITE_LABEL[espace.site]} — suivi dans le centre de tâches.`,
                      })
                      lancerJob({
                        workflow: 'vm.compose',
                        cible: `${machines} machines · ${espace.code}`,
                        alFin: () => {
                          parc.modifierPlusieurs(
                            nouvelles.map((v) => v.id),
                            { statut: 'running' },
                          )
                          pousser({
                            ton: 'ok',
                            titre: `${machines} machines livrées`,
                            detail: 'Le paramétrage fin se fait ensuite en SSH ou dans le logiciel installé.',
                          })
                        },
                      })
                    }}
                  >
                    Livrer {machines} machine{machines > 1 ? 's' : ''} · {cout.toLocaleString('fr-FR')} FCFA/mois
                  </Button>
                </GatedAction>
                {depasse && (
                  <p className="text-[12px] text-err">
                    La livraison est bloquée tant que le plan dépasse le quota de l’espace.
                  </p>
                )}
              </div>
            </div>
          )}

          <Callout ton="info" titre="Ce que la composition ne fait pas">
            Le portail crée les machines, les raccorde, installe ce que vous avez coché et pose les
            sondes. Il ne configure pas vos applications : le paramétrage fin se fait ensuite en
            SSH, par votre outil de configuration, ou dans l’interface du logiciel installé.
          </Callout>
        </>
      )}
    </div>
  )
}
