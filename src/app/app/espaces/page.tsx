'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { num, pct, toHumain } from '@/lib/format'
import { SITE_COURT, type EspaceCloud, type VM } from '@/lib/types'
import { ESPACES, VMS } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { HealthBadge, QuotaBar, StatTile } from '@/components/composition/metrics'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'

const colonnesEspaces = (vms: VM[]): Array<Colonne<EspaceCloud>> => [
  {
    id: 'code',
    entete: 'Code',
    cle: (e) => e.code,
    rendu: (e) => (
      <span className="block">
        <span className="block font-mono text-[13px] font-semibold text-ink">{e.code}</span>
        <span className="block text-[11px] text-g-500">
          {e.projets} projet{e.projets > 1 ? 's' : ''}
        </span>
      </span>
    ),
  },
  { id: 'offre', entete: 'Offre souscrite', cle: (e) => e.offreNom, rendu: (e) => e.offreNom },
  {
    id: 'site',
    entete: 'Site',
    cle: (e) => e.site,
    rendu: (e) => (
      <span className="flex items-center gap-1.5">
        <Badge tone="neutral" size="sm">
          {e.site}
        </Badge>
        <span className="text-[12px] text-g-500">{SITE_COURT[e.site]}</span>
      </span>
    ),
  },
  {
    id: 'cidr',
    entete: 'Plage réseau',
    cle: (e) => e.cidr,
    rendu: (e) => <span className="font-mono text-[12px]">{e.cidr}</span>,
  },
  {
    id: 'vcpu',
    entete: 'vCPU',
    cle: (e) => e.usage.vcpu / e.quota.vcpu,
    rendu: (e) => (
      <span className="block w-28">
        <QuotaBar utilise={e.usage.vcpu} total={e.quota.vcpu} compact formateur={(v) => num(v)} />
      </span>
    ),
  },
  {
    id: 'ram',
    entete: 'Mémoire',
    cle: (e) => e.usage.ramGo / e.quota.ramGo,
    rendu: (e) => (
      <span className="block w-28">
        <QuotaBar
          utilise={e.usage.ramGo}
          total={e.quota.ramGo}
          compact
          formateur={(v) => `${num(v)} Go`}
        />
      </span>
    ),
    masquable: true,
  },
  {
    id: 'stockage',
    entete: 'Stockage',
    cle: (e) => e.usage.stockageTo / e.quota.stockageTo,
    rendu: (e) => (
      <span className="block w-28">
        <QuotaBar
          utilise={e.usage.stockageTo}
          total={e.quota.stockageTo}
          compact
          seuil={85}
          formateur={(v) => toHumain(v)}
        />
      </span>
    ),
  },
  {
    id: 'machines',
    entete: 'Machines',
    aligne: 'right',
    cle: (e) => vms.filter((v) => v.espaceId === e.id).length,
    rendu: (e) => vms.filter((v) => v.espaceId === e.id).length,
    masquable: true,
  },
  {
    id: 'statut',
    entete: 'État',
    cle: (e) => e.statut,
    rendu: (e) => <HealthBadge etat={e.statut === 'active' ? 'operationnel' : e.statut} size="sm" />,
  },
  {
    id: 'actions',
    entete: '',
    aligne: 'right',
    rendu: (e) => (
      <Link
        href={`/app/espaces/${e.id}`}
        className="text-[12px] font-semibold text-p-700 hover:text-m-600"
      >
        Ouvrir →
      </Link>
    ),
  },
]

export default function ListeEspaces() {
  const { autorise, refus } = useApp()
  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  const parc = useCollection<VM>('vms', VMS)
  // Somme des vrais Espaces Cloud plutôt que `SYNTHESE_CLIENT` : sinon les
  // trois tuiles de quota restent fictives à côté d'un compte « Espaces
  // Cloud » réel, comme sur le tableau de bord (§ même motif).
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

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Espaces Cloud' }]}
        titre="Espaces Cloud"
        sousTitre="Un Espace Cloud est une enveloppe de capacité : un quota de vCPU, de mémoire et de stockage, une plage réseau qui vous est propre, et un site physique que vous choisissez. Vous créez ensuite librement machines, clusters et volumes dedans."
        actions={
          <GatedAction autorise={autorise('espace.create')} message={refus('espace.create')}>
            <ButtonLink href="/app/espaces/new" iconBefore={<Plus size={14} />}>
              Créer un Espace Cloud
            </ButtonLink>
          </GatedAction>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile libelle="Espaces Cloud" valeur={espaces.items.length} detail="Répartis sur 2 sites" />
        <StatTile
          libelle="vCPU consommés"
          valeur={`${usage.vcpu}/${quota.vcpu}`}
          detail={quota.vcpu > 0 ? pct(Math.round((usage.vcpu / quota.vcpu) * 100)) : '—'}
        />
        <StatTile
          libelle="Mémoire consommée"
          valeur={`${num(usage.ramGo)}/${num(quota.ramGo)}`}
          unite="Go"
          detail={quota.ramGo > 0 ? pct(Math.round((usage.ramGo / quota.ramGo) * 100)) : '—'}
        />
        <StatTile
          libelle="Stockage consommé"
          valeur={`${usage.stockageTo}/${quota.stockageTo}`}
          unite="To"
          ton="warn"
          detail="Premier facteur limitant"
        />
      </div>

      <Card padding={false}>
        <div className="px-4 pt-4">
          <CardHeader
            titre="Vos espaces"
            sousTitre="Le placement technique sur nos hyperviseurs n’apparaît pas ici : c’est une décision fournisseur, qui nous permet de rééquilibrer la charge sans vous impliquer."
          />
        </div>
        <div className="px-4 pb-4">
          <DataTable
            lignes={espaces.items}
            colonnes={colonnesEspaces(parc.items)}
            placeholderRecherche="Rechercher un code, une offre, une plage…"
            filtres={[
              {
                id: 'site',
                libelle: 'Site',
                options: [
                  { value: 'ABJ', label: 'Abidjan' },
                  { value: 'GBM', label: 'Grand-Bassam' },
                ],
              },
              {
                id: 'offre',
                libelle: 'Offre',
                options: Array.from(new Set(espaces.items.map((e) => e.offreNom))).map((o) => ({
                  value: o,
                  label: o,
                })),
              },
            ]}
            selection={(e, id, v) => (id === 'site' ? e.site === v : e.offreNom === v)}
            href={(e) => `/app/espaces/${e.id}`}
            exportable
            vide={{
              titre: 'Aucun Espace Cloud',
              phrase:
                'Un Espace Cloud est une enveloppe de capacité. Créez le premier pour provisionner des machines.',
              action: { libelle: 'Créer un Espace Cloud', href: '/app/espaces/new' },
            }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {!estActif() && (
          <Callout ton="warn" titre="EC-DBA-01 approche de son plafond de stockage">
            7,1 To utilisés sur 8 To, soit 89 %. Le devis DEV-0418 propose une extension à 12 To
            accompagnée de 16 vCPU supplémentaires, applicable à chaud et sans interruption. Il est
            en attente de validation dans votre espace facturation.
          </Callout>
        )}
        <Callout ton="violet" titre="Pourquoi plusieurs espaces ?">
          C’est la façon habituelle de séparer production, préproduction et site de repli : chacun
          avec son quota, sa plage réseau et son site. Le peering entre deux Espaces Cloud d’une même
          organisation reste possible, et la facturation est ventilée par espace dans le showback.
        </Callout>
      </div>
    </div>
  )
}
