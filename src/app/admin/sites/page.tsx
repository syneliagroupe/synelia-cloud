'use client'

import { useState } from 'react'
import { Cable, Thermometer } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { dateCourte, num, pct } from '@/lib/format'
import { BACKENDS as BACKENDS_GRAINE, DATACENTERS } from '@/lib/mock'
import { BACKEND_LABEL, SITE_COURT, SITE_LABEL, type Backend, type Site } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Tabs } from '@/components/ui/display'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { QuotaBar, StatTile } from '@/components/composition/metrics'
import { GrilleSparkCharts } from '@/components/business/observabilite'
import { useCollection } from '@/components/app/atelier'
import { useLectureDegradable } from '@/lib/api/degradable'
import { estActif } from '@/lib/api/client'

const ONGLETS = [
  { id: 'sites', label: 'Sites physiques' },
  { id: 'environnement', label: 'Énergie & refroidissement' },
  { id: 'reseau', label: 'Connectivité' },
  { id: 'contraintes', label: 'Contraintes de placement' },
]

// Grand-Bassam (GBM) n'existe pas réellement sur ce lab — un seul site physique (ABJ) est
// adossé à de la vraie infrastructure (cf. GET /admin/sites, qui ne renvoie qu'ABJ). GBM
// reste un second site de démonstration en mode maquette uniquement, jamais en mode API.
const SITES: Site[] = estActif() ? ['ABJ'] : ['ABJ', 'GBM']

const CARACTERISTIQUES: Record<
  Site,
  {
    role: string
    adresse: string
    surface: string
    baies: string
    puissance: string
    pue: number
    onduleurs: string
    groupes: string
    refroidissement: string
    operateurs: string[]
    latenceInter: string
    certifications: string[]
    inaugure: string
  }
> = {
  ABJ: {
    role: 'Site principal — production',
    adresse: 'Plateau, Abidjan, Côte d’Ivoire',
    surface: '420 m² de salle blanche',
    baies: '68 baies installées sur 96 emplacements',
    puissance: '480 kW utiles, 720 kW installés',
    pue: 1.42,
    onduleurs: '2 chaînes indépendantes, 15 min d’autonomie chacune',
    groupes: '2 groupes électrogènes, 72 h de carburant sur site',
    refroidissement: 'Confinement en allée froide, redondance N+1',
    operateurs: ['Orange CI', 'MTN CI', 'CSquared', 'Liaison directe au point d’échange ivoirien'],
    latenceInter: '2,4 ms vers Grand-Bassam',
    certifications: ['Équivalent Tier III (conception)', 'ISO 27001 en cours'],
    inaugure: '2022-11-14',
  },
  GBM: {
    role: 'Site de reprise — sauvegarde et bascule',
    adresse: 'Grand-Bassam, Côte d’Ivoire — à 42 km d’Abidjan',
    surface: '180 m² de salle blanche',
    baies: '24 baies installées sur 48 emplacements',
    puissance: '180 kW utiles, 320 kW installés',
    pue: 1.51,
    onduleurs: '2 chaînes indépendantes, 12 min d’autonomie chacune',
    groupes: '1 groupe électrogène, 48 h de carburant sur site',
    refroidissement: 'Confinement en allée froide, redondance N+1',
    operateurs: ['Orange CI', 'MTN CI', 'Fibre dédiée vers Abidjan'],
    latenceInter: '2,4 ms vers Abidjan',
    certifications: ['Équivalent Tier II renforcé'],
    inaugure: '2024-06-03',
  },
}

export default function Sites() {
  // Un socle passé en maintenance depuis Capacité ou Santé doit se voir ici
  // aussi : les deux écrans parlent du même parc.
  const parc = useCollection<Backend>('backends', BACKENDS_GRAINE)
  const [onglet, setOnglet] = useState('sites')
  // `GET /admin/sites` ne sert que son `424` : le descriptif reste local,
  // mais un site dont l’état réel est inconnu se signale.
  const { degrade } = useLectureDegradable('/admin/sites')

  const BACKENDS = parc.items

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Sites physiques' }]}
        titre="Sites physiques"
        sousTitre="Deux sites en Côte d’Ivoire, à 42 kilomètres l’un de l’autre. Assez proches pour une réplication synchrone, assez éloignés pour qu’un même sinistre — inondation, coupure de réseau électrique, incendie — ne les touche pas ensemble."
        actions={
          <ButtonLink variant="secondary" external href="/datacenters">
            Voir la page publique
          </ButtonLink>
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {SITES.length} sites
            </Badge>
            <Badge tone="neutral" size="sm">
              {BACKENDS.length} socles répartis
            </Badge>
            <Badge tone="ok" size="sm">
              Aucune donnée hors de Côte d’Ivoire
            </Badge>
          </>
        }
      />

      {degrade && (
        <Callout
          ton="warn"
          titre={`État des sites incertain${degrade.integration ? ` — ${degrade.integration}` : ''}`}
        >
          L’intégration amont ne répond pas
          {degrade.dateDonnees ? ` (données du ${degrade.dateDonnees})` : ''} : le descriptif
          ci-dessous reste valable, mais l’état temps réel des socles est inconnu.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Baies installées"
          valeur={92}
          detail="sur 144 emplacements, les deux sites"
        />
        <StatTile
          libelle="Puissance utile"
          valeur="660 kW"
          detail="1 040 kW installés"
        />
        <StatTile
          libelle="Indicateur d’efficacité moyen"
          valeur="1,46"
          ton="ok"
          detail="Moyenne mondiale des centres de données : 1,55"
        />
        <StatTile
          libelle="Latence entre sites"
          valeur="2,4 ms"
          ton="ok"
          detail="Fibre dédiée, deux chemins distincts"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'sites' && (
        <div className="space-y-4">
          {SITES.map((s) => {
            const c = CARACTERISTIQUES[s]
            const socles = BACKENDS.filter((b) => b.site === s)
            const vcpu = socles.reduce((a, b) => a + b.capacite.vcpu, 0)
            const utilise = Math.round(
              socles.reduce((a, b) => a + (b.capacite.vcpu * b.usage.vcpuPct) / 100, 0),
            )
            return (
              <Card key={s}>
                <CardHeader
                  titre={
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span>{SITE_LABEL[s]}</span>
                      <Badge tone={s === 'ABJ' ? 'violet' : 'accent'} size="sm">
                        {c.role}
                      </Badge>
                    </span>
                  }
                  sousTitre={`${c.adresse} · mis en service le ${dateCourte(c.inaugure)}`}
                  actions={
                    <span className="flex flex-wrap items-center gap-1.5">
                      {c.certifications.map((x) => (
                        <Badge key={x} tone="neutral" size="sm">
                          {x}
                        </Badge>
                      ))}
                    </span>
                  }
                />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <KeyValueList
                      colonnes={2}
                      items={[
                        { cle: 'Surface', valeur: c.surface },
                        { cle: 'Baies', valeur: c.baies },
                        { cle: 'Puissance', valeur: c.puissance },
                        { cle: 'Indicateur d’efficacité', valeur: String(c.pue) },
                        { cle: 'Alimentation sans coupure', valeur: c.onduleurs },
                        { cle: 'Groupes électrogènes', valeur: c.groupes },
                        { cle: 'Refroidissement', valeur: c.refroidissement },
                        { cle: 'Latence inter-site', valeur: c.latenceInter },
                      ]}
                    />
                    <MicroLabel className="mt-4 mb-2">Socles hébergés</MicroLabel>
                    <div className="space-y-2">
                      {socles.map((b) => (
                        <div
                          key={b.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2"
                        >
                          <span className="min-w-0">
                            <span className="block font-mono text-[12px] font-semibold text-ink">
                              {b.code}
                            </span>
                            <span className="block text-[11px] text-g-500">
                              {BACKEND_LABEL[b.type]} · {b.hosts} hôtes
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <Badge tone={b.souverain ? 'ok' : 'warn'} size="sm">
                              {b.souverain ? 'Libre' : 'Propriétaire'}
                            </Badge>
                            <Badge
                              tone={b.statut === 'en_ligne' ? 'ok' : 'warn'}
                              dot
                              size="sm"
                            >
                              {b.statut === 'en_ligne' ? 'En ligne' : b.statut}
                            </Badge>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <QuotaBar
                      libelle="Processeur alloué"
                      utilise={utilise}
                      total={vcpu}
                      unite="vCPU"
                      seuil={85}
                      formateur={(v) => num(v)}
                    />
                    <QuotaBar
                      libelle="Baies occupées"
                      utilise={s === 'ABJ' ? 68 : 24}
                      total={s === 'ABJ' ? 96 : 48}
                      seuil={85}
                    />
                    <QuotaBar
                      libelle="Puissance consommée"
                      utilise={s === 'ABJ' ? 412 : 118}
                      total={s === 'ABJ' ? 480 : 180}
                      unite="kW"
                      seuil={85}
                    />
                    <MicroLabel className="mt-3">Opérateurs raccordés</MicroLabel>
                    <ul className="space-y-1">
                      {c.operateurs.map((o) => (
                        <li key={o} className="flex items-start gap-1.5 text-[12px] text-g-700">
                          <Cable size={11} className="mt-0.5 shrink-0 text-p-700" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )
          })}

          <Callout ton="violet" titre="Deux sites à 42 kilomètres">
            Plus près, un même sinistre naturel peut toucher les deux. Plus loin, la latence interdit
            la réplication synchrone. Les deux sites sont sur deux réseaux électriques distincts et
            deux chemins de fibre séparés.
          </Callout>
        </div>
      )}

      {onglet === 'environnement' && (
        <div className="space-y-4">
          <GrilleSparkCharts
            seed="sites-environnement"
            metriques={[
              { titre: 'Puissance consommée · Abidjan', unite: 'kW', min: 380, max: 448, seuil: 460 },
              { titre: 'Température allée froide', unite: '°C', min: 20, max: 24, seuil: 27 },
              {
                titre: 'Indicateur d’efficacité',
                unite: '',
                min: 1.38,
                max: 1.52,
                seuil: 1.6,
                couleur: 'var(--color-m-600)',
              },
              { titre: 'Humidité relative', unite: '%', min: 42, max: 58 },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Chaîne électrique"
                sousTitre="Ce qui se passe quand le réseau public tombe."
              />
              <div className="space-y-2">
                {[
                  {
                    t: 'T + 0 seconde — coupure réseau',
                    d: 'Les onduleurs prennent le relais sans interruption perceptible. Aucun serveur ne redémarre.',
                    ton: 'ok' as const,
                  },
                  {
                    t: 'T + 12 secondes — démarrage des groupes',
                    d: 'Les groupes électrogènes montent en charge et reprennent l’alimentation. Les onduleurs se rechargent.',
                    ton: 'ok' as const,
                  },
                  {
                    t: 'T + 72 heures — autonomie carburant',
                    d: 'Réserve sur site à Abidjan. Un contrat de réapprovisionnement prioritaire est en place avec deux fournisseurs distincts.',
                    ton: 'info' as const,
                  },
                  {
                    t: 'Au-delà — bascule vers Grand-Bassam',
                    d: 'Si l’autonomie approche de sa fin sans réapprovisionnement, les plans de reprise sont déclenchés, client par client, selon leur ordre de priorité contractuel.',
                    ton: 'warn' as const,
                  },
                ].map((x) => (
                  <div
                    key={x.t}
                    className={cn(
                      'rounded-[6px] border px-3 py-2.5',
                      x.ton === 'ok'
                        ? 'border-g-300'
                        : x.ton === 'info'
                          ? 'border-info/40'
                          : 'border-warn/40',
                    )}
                  >
                    <p className="text-[13px] font-semibold text-ink">{x.t}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-g-700">{x.d}</p>
                  </div>
                ))}
              </div>
              <Callout ton="info" className="mt-4" titre="Les coupures sont testées, pas supposées">
                Nous coupons volontairement l’arrivée réseau une fois par trimestre, en heures
                ouvrées, avec les équipes présentes. Un groupe électrogène qui n’a jamais démarré en
                charge réelle est une hypothèse, pas une protection.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Refroidissement"
                sousTitre="Le climat ivoirien, chaud et humide, est la contrainte dimensionnante."
              />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Principe', valeur: 'Confinement en allée froide, air soufflé par le plancher' },
                  { cle: 'Redondance', valeur: 'N+1 — la perte d’un groupe froid ne dégrade rien' },
                  { cle: 'Température de consigne', valeur: '22 °C ± 2 en allée froide' },
                  { cle: 'Humidité de consigne', valeur: '45 à 55 % — hors de cette plage, corrosion ou électricité statique' },
                  { cle: 'Indicateur d’efficacité', valeur: '1,42 à Abidjan · 1,51 à Grand-Bassam' },
                  { cle: 'Refroidissement libre', valeur: 'Non applicable — la température extérieure ne descend jamais assez' },
                ]}
              />
              <Callout ton="warn" className="mt-4" titre="1,42 sous climat tropical, 1,15 en Scandinavie">
                <span className="inline-flex items-start gap-1.5">
                  <Thermometer size={13} className="mt-0.5 shrink-0" />
                  Le refroidissement à l’air extérieur n’est pas possible ici : il faut produire du
                  froid toute l’année. Les deux chiffres ne se comparent pas directement.
                </span>
              </Callout>
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Empreinte et sobriété"
              sousTitre="Ce qui est mesuré, et à quelle fréquence."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  t: 'Ce que nous mesurons',
                  l: [
                    'Consommation électrique par baie et par socle',
                    'Indicateur d’efficacité en continu',
                    'Consommation de carburant des groupes',
                    'Taux de remplissage des baies',
                  ],
                },
                {
                  t: 'Ce que nous améliorons',
                  l: [
                    'Densification des baies plutôt qu’extension',
                    'Extinction automatique des hôtes en surcapacité la nuit',
                    'Allongement de la durée de vie du matériel à 6 ans',
                    'Reconditionnement plutôt que remplacement',
                  ],
                },
                {
                  t: 'Ce que nous ne prétendons pas',
                  l: [
                    'Aucune neutralité carbone affichée : le réseau ivoirien n’est pas décarboné',
                    'Aucune compensation achetée pour améliorer un chiffre',
                    'Aucun engagement sur une trajectoire que nous ne maîtrisons pas',
                  ],
                },
              ].map((x) => (
                <div key={x.t} className="rounded-[8px] border border-g-300 p-3.5">
                  <p className="text-[13px] font-bold text-ink">{x.t}</p>
                  <ul className="mt-2 space-y-1.5">
                    {x.l.map((y) => (
                      <li key={y} className="text-[12px] leading-relaxed text-g-700">
                        · {y}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {onglet === 'reseau' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Connectivité"
              sousTitre="Le réseau est la première cause d’indisponibilité perçue par un client, bien avant la panne matérielle."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Lien', 'Opérateur', 'Capacité', 'Chemin physique', 'Usage', 'État'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { l: 'ABJ ↔ Internet #1', o: 'Orange CI', c: '10 Gb/s', p: 'Sud — Boulevard lagunaire', u: 42, e: 'ok' },
                    { l: 'ABJ ↔ Internet #2', o: 'MTN CI', c: '10 Gb/s', p: 'Nord — Adjamé', u: 38, e: 'ok' },
                    { l: 'ABJ ↔ Point d’échange', o: 'CIXP', c: '20 Gb/s', p: 'Sud — mutualisé', u: 61, e: 'ok' },
                    { l: 'ABJ ↔ GBM #1', o: 'Fibre dédiée', c: '40 Gb/s', p: 'Route de Bassam', u: 28, e: 'ok' },
                    { l: 'ABJ ↔ GBM #2', o: 'Fibre dédiée', c: '40 Gb/s', p: 'Autoroute du Nord', u: 24, e: 'ok' },
                    { l: 'GBM ↔ Internet', o: 'Orange CI', c: '10 Gb/s', p: 'Unique', u: 12, e: 'warn' },
                  ].map((x) => (
                    <tr key={x.l} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-ink">
                        {x.l}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-g-700">{x.o}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-g-700">{x.c}</td>
                      <td className="px-3 py-2.5 text-[12px] text-g-500">{x.p}</td>
                      <td className="w-32 px-3 py-2.5">
                        <QuotaBar utilise={x.u} total={100} compact seuil={75} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={x.e === 'ok' ? 'ok' : 'warn'} dot size="sm">
                          {x.e === 'ok' ? 'Nominal' : 'Sans redondance'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout ton="warn" className="mt-4" titre="Grand-Bassam n’a qu’une seule arrivée Internet">
              Le site de reprise sert d’abord à recevoir des sauvegardes par la fibre dédiée, pas à
              servir du trafic public. En cas de bascule prolongée, sa connectivité devient un point
              unique de défaillance. Un second opérateur est budgété pour le prochain trimestre.
            </Callout>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader titre="Adressage et autonomie" />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Système autonome', valeur: 'AS328xxx — annonces indépendantes' },
                  { cle: 'Plages IPv4', valeur: '102.176.16.0/20 · 1 024 adresses publiques' },
                  { cle: 'Plages IPv6', valeur: '2c0f:fxxx::/32' },
                  { cle: 'Protection contre le déni de service', valeur: 'Filtrage en amont chez les deux opérateurs, seuil à 2 Gb/s' },
                  { cle: 'Point d’échange', valeur: 'Membre du point d’échange ivoirien depuis 2023' },
                  { cle: 'Trafic local', valeur: '68 % du trafic reste en Côte d’Ivoire' },
                ]}
              />
              <Callout ton="violet" className="mt-4" titre="8 ms en local, 180 ms via l’Europe">
                Pour un utilisateur abidjanais, un service hébergé en Europe ajoute un aller-retour
                transatlantique à chaque requête.
              </Callout>
            </Card>

            <Card>
              <CardHeader titre="Latences mesurées" sousTitre="Médianes constatées depuis Abidjan." />
              <div className="space-y-2">
                {[
                  { d: 'Abidjan (fibre locale)', ms: 4, ok: true },
                  { d: 'Grand-Bassam (inter-site)', ms: 2.4, ok: true },
                  { d: 'Dakar', ms: 28, ok: true },
                  { d: 'Lagos', ms: 34, ok: true },
                  { d: 'Casablanca', ms: 62, ok: true },
                  { d: 'Paris', ms: 118, ok: false },
                  { d: 'Francfort', ms: 132, ok: false },
                  { d: 'Nord de la Virginie', ms: 186, ok: false },
                ].map((x) => (
                  <div key={x.d} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-[12px] text-ink">{x.d}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-g-100">
                      <span
                        className={cn(
                          'absolute inset-y-0 left-0 rounded-full',
                          x.ok ? 'bg-ok' : 'bg-warn',
                        )}
                        style={{ width: `${Math.min(100, (x.ms / 200) * 100)}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        'tnum w-16 shrink-0 text-right text-[12px] font-semibold',
                        x.ok ? 'text-ok' : 'text-warn',
                      )}
                    >
                      {x.ms} ms
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-g-500">
                Ces chiffres sont l’argument central de la proximité, et ils sont vérifiables par
                n’importe qui avec un simple ping. C’est le seul avantage concurrentiel qu’un
                fournisseur international ne peut pas nous prendre.
              </p>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'contraintes' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Contraintes de placement"
              sousTitre="Les règles qui déterminent où une ressource peut être créée. Elles sont appliquées par la plateforme, pas laissées à l’appréciation de l’opérateur."
            />
            <div className="space-y-2">
              {[
                {
                  r: 'Une sauvegarde ne peut pas résider sur le même site que sa source',
                  d: 'Sinon la règle 3-2-1 n’est pas respectée et un sinistre local emporte les deux. Non contournable, y compris pour une demande client.',
                  dur: true,
                },
                {
                  r: 'Un plan de reprise doit désigner un site différent du site source',
                  d: 'Un plan de reprise vers le même site protège d’une panne matérielle, pas d’un sinistre. La création est refusée si les deux sites sont identiques.',
                  dur: true,
                },
                {
                  r: 'Une organisation marquée « souveraine » ne peut être placée que sur un socle libre en Côte d’Ivoire',
                  d: 'Contrainte contractuelle. Le placement automatique exclut les socles propriétaires, même s’ils ont plus de capacité disponible.',
                  dur: true,
                },
                {
                  r: 'Un socle en maintenance ne reçoit pas de nouvelle création',
                  d: 'Retiré du pool automatiquement. Ses charges existantes continuent de tourner normalement.',
                  dur: true,
                },
                {
                  r: 'Un socle au-delà de 90 % d’allocation ne reçoit plus de nouvelle création',
                  d: 'Garde une réserve pour les migrations à chaud et les redémarrages. Sans réserve, une panne d’hôte ne peut plus être absorbée.',
                  dur: true,
                },
                {
                  r: 'Un socle en trajectoire de sortie ne reçoit plus de nouvelle création',
                  d: 'Inutile d’ajouter des charges à migrer plus tard. Les extensions d’espaces existants y sont encore autorisées, à la demande.',
                  dur: false,
                },
                {
                  r: 'Les composants d’un même environnement applicatif sont placés sur le même socle',
                  d: 'Réduit la latence entre composants. Peut être desserré pour un environnement de production réparti volontairement.',
                  dur: false,
                },
              ].map((x) => (
                <div
                  key={x.r}
                  className={cn(
                    'rounded-[6px] border px-3 py-2.5',
                    x.dur ? 'border-p-300 bg-p-050' : 'border-g-300',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0 text-[13px] font-semibold text-ink">{x.r}</span>
                    <Badge tone={x.dur ? 'violet' : 'neutral'} size="sm">
                      {x.dur ? 'Non contournable' : 'Ajustable'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-g-700">{x.d}</p>
                </div>
              ))}
            </div>
          </Card>

          <Callout ton="violet" titre="Une règle non contournable protège aussi le client de lui-même">
            Il arrive qu’un client demande de placer sa sauvegarde sur le même site que sa production,
            pour gagner sur le coût du transfert. Nous refusons. Non par rigidité : parce que le jour
            du sinistre, c’est nous qui devrons lui expliquer qu’il n’y a rien à restaurer, et
            qu’aucune économie de transfert ne compensera cela.
          </Callout>

          <Card>
            <CardHeader
              titre="Refus de placement récents"
              sousTitre="Chaque refus est journalisé, avec la règle invoquée."
            />
            <div className="space-y-2">
              {[
                {
                  q: 'il y a 2 jours',
                  org: 'AMUGA',
                  d: 'Création d’un plan de sauvegarde avec destination identique à la source',
                  r: 'Règle 3-2-1 — copie hors site obligatoire',
                },
                {
                  q: 'il y a 6 jours',
                  org: 'ONECI',
                  d: 'Création d’un Espace Cloud sur CL-GRA-01',
                  r: 'Organisation souveraine — socle propriétaire exclu',
                },
                {
                  q: 'il y a 11 jours',
                  org: 'SOTRA',
                  d: 'Extension de 32 vCPU sur HV-RBX-01',
                  r: 'Socle en trajectoire de sortie — proposition de placement sur OS-ABJ-01',
                },
              ].map((x) => (
                <div key={x.q} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 text-[12px] font-semibold text-ink">{x.d}</span>
                    <span className="shrink-0 text-[11px] text-g-500">
                      {x.org} · {x.q}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-warn">Règle invoquée : {x.r}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-g-500">
              Un refus n’est jamais silencieux : le client voit la règle invoquée, et une alternative
              lui est proposée dans le même écran. Un refus sans explication, c’est un ticket de
              support garanti.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
