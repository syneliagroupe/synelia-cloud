import type { Metadata } from 'next'
import { Cpu, Database, Network, Snowflake, Zap } from 'lucide-react'
import { num, pct } from '@/lib/format'
import { BACKENDS, DATACENTERS, ESPACES } from '@/lib/mock'
import { lirePublicServeur } from '@/lib/api/public-serveur'
import { fusionnerDatacenters, type DatacenterPublic } from '@/lib/api/vitrine'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import {
  AppelFinal,
  Container,
  HeroCourt,
  SectionTitle,
  SiteSection,
} from '@/components/site/blocs'

export const metadata: Metadata = {
  title: 'Nos datacenters à Abidjan et Grand-Bassam',
  description:
    'Fiche par site : localisation, alimentation, refroidissement, connectivité, sécurité physique, certifications. Latence inter-site mesurée de 4 à 6 ms.',
}

export default async function Datacenters() {
  // En mode API, nom, ville, certifications, puissance et alimentation
  // suivent `GET /public/datacenters` (rapproché par site) ; le reste de la
  // fiche — que le backend ne publie pas — reste local.
  const datacenters = fusionnerDatacenters(
    await lirePublicServeur<DatacenterPublic[]>('/public/datacenters'),
    DATACENTERS,
  )
  return (
    <>
      <HeroCourt
        surtitre="Datacenters"
        titre={
          <>
            Deux sites,
            <br />
            <span className="text-m-600">un seul territoire.</span>
          </>
        }
        chapeau="Synertech Vallon à Cocody pour la production, le parc technologique VITIB de Grand-Bassam pour le repli et l’archivage immuable. Quarante-cinq kilomètres, deux chemins de fibre distincts, une latence mesurée de 4 à 6 millisecondes."
      />

      {/*
        La carte situe les deux sites dans le pays ; le schéma de la section
        suivante dit comment ils se répartissent les rôles. Les deux répondent à
        des questions différentes, d'où les deux visuels.
      */}
      <SiteSection className="!pb-6">
        <Container>
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <figure>
              <img
                src="/illustrations/carte-sites.svg"
                alt="Carte de la Côte d’Ivoire situant les deux sites de Synelia : Abidjan (Synertech Vallon, à Cocody) et Grand-Bassam (parc VITIB), reliés par une liaison de 4 à 6 millisecondes."
                width={600}
                height={735}
                className="w-full"
              />
            </figure>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  photo: '/photos/datacenter-allee.webp',
                  alt: 'Allée froide d’une salle serveurs : deux rangées de baies sombres aux voyants violets, sol poli.',
                  legende: 'Allée froide, site de production',
                },
                {
                  photo: '/photos/baie-cablage.webp',
                  alt: 'Baie ouverte montrant des faisceaux de cordons de brassage soigneusement rangés.',
                  legende: 'Brassage d’une baie de calcul',
                },
                {
                  photo: '/photos/fibre-optique.webp',
                  alt: 'Panneau de brassage optique et ses connecteurs LC.',
                  legende: 'Panneau optique de la liaison inter-site',
                },
                {
                  photo: '/photos/parc-vitib.webp',
                  alt: 'Vue aérienne du campus technologique de Grand-Bassam : bâtiments bas, groupes de refroidissement en toiture, océan au loin.',
                  legende: 'Parc VITIB, site de repli',
                },
              ].map((c) => (
                <figure
                  key={c.legende}
                  className="overflow-hidden rounded-[12px] border border-g-300 bg-white"
                >
                  <img
                    src={c.photo}
                    alt={c.alt}
                    width={1376}
                    height={768}
                    loading="lazy"
                    className="h-32 w-full object-cover"
                  />
                  <figcaption className="px-3.5 py-2.5 text-[12px] leading-snug text-g-700">
                    {c.legende}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <p className="mt-5 text-[12px] leading-relaxed text-g-500">
            Vues d’illustration. Une visite accompagnée se demande depuis votre espace client ; les
            salles ne se photographient pas librement.
          </p>
        </Container>
      </SiteSection>

      {/* Schéma des deux sites */}
      <SiteSection className="!py-10">
        <Container>
          <div className="mx-auto max-w-3xl">
            <svg viewBox="0 0 600 190" className="w-full" role="img" aria-label="Schéma des deux sites">
              <defs>
                <marker
                  id="fleche"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--color-p-400)" />
                </marker>
              </defs>

              <line
                x1="185"
                y1="80"
                x2="415"
                y2="80"
                stroke="var(--color-p-400)"
                strokeWidth="2"
                markerEnd="url(#fleche)"
              />
              <line
                x1="415"
                y1="104"
                x2="185"
                y2="104"
                stroke="var(--color-p-400)"
                strokeWidth="2"
                strokeDasharray="6 4"
                markerEnd="url(#fleche)"
              />
              <rect x="248" y="76" width="104" height="18" rx="9" fill="var(--color-p-100)" />
              <text
                x="300"
                y="89"
                textAnchor="middle"
                className="fill-[color:var(--color-p-700)] text-[11px] font-semibold"
              >
                4–6 ms · 2 chemins
              </text>
              <text
                x="300"
                y="118"
                textAnchor="middle"
                className="fill-[color:var(--color-g-500)] text-[11px]"
              >
                réplication de sauvegarde et PRA
              </text>

              <g>
                <rect
                  x="30"
                  y="30"
                  width="155"
                  height="110"
                  rx="12"
                  fill="var(--color-p-050)"
                  stroke="var(--color-p-700)"
                  strokeWidth="2"
                />
                <text x="107" y="56" textAnchor="middle" className="fill-[color:var(--color-ink)] text-[12px] font-bold">
                  ABJ
                </text>
                <text x="107" y="72" textAnchor="middle" className="fill-[color:var(--color-g-700)] text-[11px]">
                  Synertech Vallon
                </text>
                <text x="107" y="86" textAnchor="middle" className="fill-[color:var(--color-g-500)] text-[11px]">
                  Cocody, Abidjan
                </text>
                <text x="107" y="108" textAnchor="middle" className="fill-[color:var(--color-p-700)] text-[11px] font-semibold">
                  Site de production
                </text>
                <text x="107" y="124" textAnchor="middle" className="fill-[color:var(--color-g-500)] text-[11px]">
                  640 m² · 1,2 MW · 4 opérateurs
                </text>
              </g>

              <g>
                <rect
                  x="415"
                  y="30"
                  width="155"
                  height="110"
                  rx="12"
                  fill="var(--color-g-050)"
                  stroke="var(--color-m-600)"
                  strokeWidth="2"
                />
                <text x="492" y="56" textAnchor="middle" className="fill-[color:var(--color-ink)] text-[12px] font-bold">
                  GBM
                </text>
                <text x="492" y="72" textAnchor="middle" className="fill-[color:var(--color-g-700)] text-[11px]">
                  Parc VITIB
                </text>
                <text x="492" y="86" textAnchor="middle" className="fill-[color:var(--color-g-500)] text-[11px]">
                  Grand-Bassam
                </text>
                <text x="492" y="108" textAnchor="middle" className="fill-[color:var(--color-m-600)] text-[11px] font-semibold">
                  Site de repli
                </text>
                <text x="492" y="124" textAnchor="middle" className="fill-[color:var(--color-g-500)] text-[11px]">
                  420 m² · 800 kW · 3 opérateurs
                </text>
              </g>

              <text x="300" y="168" textAnchor="middle" className="fill-[color:var(--color-g-500)] text-[11px]">
                Environ 45 km · aucune réplication hors du territoire ivoirien sans demande écrite
              </text>
            </svg>
          </div>
        </Container>
      </SiteSection>

      {datacenters.map((d, idx) => {
        const backendsSite = BACKENDS.filter((b) => b.site === d.code)
        const vcpu = backendsSite.reduce((a, b) => a + b.capacite.vcpu, 0)
        const ram = backendsSite.reduce((a, b) => a + b.capacite.ramGo, 0)
        const sto = backendsSite.reduce((a, b) => a + b.capacite.stockageTo, 0)
        const charge = Math.round(
          backendsSite.reduce((a, b) => a + b.usage.vcpuPct, 0) / Math.max(1, backendsSite.length),
        )
        const espacesSite = ESPACES.filter((e) => e.site === d.code)

        return (
          <SiteSection key={d.code} fond={idx % 2 === 0 ? 'clair' : 'blanc'}>
            <Container>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <MicroLabel className="text-m-600">Site {d.code}</MicroLabel>
                  <h2 className="mt-2 text-[26px] font-bold leading-tight [font-family:var(--font-display)] text-ink sm:text-[32px]">
                    {d.nom}
                  </h2>
                  <p className="mt-1.5 text-[14px] text-g-700">
                    {d.ville}, {d.pays} · en service depuis {d.ouverture}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {d.certifications.map((c) => (
                    <Badge key={c} tone="violet" size="sm">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile libelle="Salle blanche" valeur={d.surface} />
                <StatTile libelle="Puissance installée" valeur={d.puissance} />
                <StatTile
                  libelle="Capacité vCPU"
                  valeur={num(vcpu)}
                  detail={`${backendsSite.length} backends`}
                />
                <StatTile
                  libelle="Taux d’occupation"
                  valeur={pct(charge)}
                  ton={charge > 75 ? 'warn' : 'ok'}
                  detail={`${num(ram)} Go de mémoire · ${num(sto)} To de stockage`}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader titre="Infrastructure physique" />
                  <div className="space-y-3.5">
                    <Bloc icone={<Zap size={15} />} titre="Alimentation" texte={d.alimentation} />
                    <Bloc
                      icone={<Snowflake size={15} />}
                      titre="Refroidissement"
                      texte={d.refroidissement}
                    />
                    <Bloc icone={<Network size={15} />} titre="Connectivité" texte={d.connectivite} />
                    <Bloc icone={<Database size={15} />} titre="Sécurité physique" texte={d.securite} />
                  </div>
                </Card>

                <div className="space-y-5">
                  <Card>
                    <CardHeader titre="Capacité installée" sousTitre="Par type de socle." />
                    <KeyValueList
                      colonnes={1}
                      items={[
                        {
                          cle: 'Socles présents',
                          valeur: (
                            <span className="flex flex-wrap gap-1.5">
                              {Array.from(new Set(backendsSite.map((b) => b.type))).map((t) => (
                                <Badge
                                  key={t}
                                  tone={
                                    ['openstack', 'proxmox', 'cloudstack'].includes(t)
                                      ? 'ok'
                                      : 'warn'
                                  }
                                  size="sm"
                                >
                                  {t}
                                </Badge>
                              ))}
                            </span>
                          ),
                        },
                        {
                          cle: 'Hôtes physiques',
                          valeur: `${backendsSite.reduce((a, b) => a + b.hosts, 0)} hôtes répartis sur ${backendsSite.length} backends`,
                        },
                        {
                          cle: 'Espaces Cloud hébergés',
                          valeur:
                            espacesSite.length > 0
                              ? espacesSite.map((e) => e.code).join(' · ')
                              : 'Aucun dans le jeu de démonstration',
                        },
                        {
                          cle: 'Services de plateforme',
                          valeur: d.services.join(' · '),
                        },
                      ]}
                    />
                  </Card>

                  <Card>
                    <CardHeader
                      titre={
                        <span className="flex items-center gap-2">
                          <Cpu size={15} className="text-p-700" />
                          Rôle du site
                        </span>
                      }
                    />
                    <p className="text-[13px] leading-relaxed text-g-700">
                      {d.code === 'ABJ'
                        ? 'Site principal. Latence la plus faible depuis Abidjan et le district autonome, connectivité la plus dense, capacité la plus importante. C’est le site par défaut de toute création de ressource, et celui que nous recommandons pour les charges de production synchrones.'
                        : 'Site de repli et d’archivage. Il accueille les réplications de sauvegarde immuable, les cibles de bascule PRA, et les charges pour lesquelles un client souhaite une séparation physique de sa production. Situé en zone franche technologique, il bénéficie d’un régime d’exploitation distinct.'}
                    </p>
                  </Card>
                </div>
              </div>
            </Container>
          </SiteSection>
        )
      })}

      <SiteSection>
        <Container>
          <SectionTitle
            surtitre="Résilience"
            titre="Deux sites, deux zones, un PRA — pas un cluster étiré"
            chapeau="Nous ne prétendons pas offrir de la haute disponibilité transparente entre Abidjan et Grand-Bassam."
          />
          <Callout ton="violet" className="mt-7" titre="Pourquoi ce choix">
            Un cluster étiré sur 45 km avec une latence de 4 à 6 ms tient techniquement pour du
            stockage asynchrone, mais pas pour de la réplication synchrone de base de données sans
            dégrader fortement les performances d’écriture. Nous préférons donc être explicites :
            chaque site expose une zone de disponibilité indépendante, et la résilience inter-site
            passe par un plan de reprise exercé — avec un RTO de quelques heures assumé et mesuré —
            plutôt que par une bascule automatique que nous ne pourrions pas garantir. Pour de la
            haute disponibilité intra-site, l’anti-affinité garantit la répartition de vos machines
            sur des hôtes physiques distincts.
          </Callout>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                t: 'Intra-site',
                d: 'Anti-affinité sur hôtes distincts, alimentation et refroidissement redondants, stockage répliqué. Bascule transparente.',
              },
              {
                t: 'Inter-site',
                d: 'Réplication continue ou planifiée, plan de reprise avec ordre de démarrage et adressage de repli. Bascule pilotée.',
              },
              {
                t: 'Hors site immuable',
                d: 'Sauvegardes verrouillées en WORM sur le second site. Protection contre le rançongiciel, y compris en cas de compromission d’administrateur.',
              },
            ].map((x) => (
              <Card key={x.t}>
                <h3 className="type-h3">{x.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-g-700">{x.d}</p>
              </Card>
            ))}
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Visiter les sites"
        chapeau="Les visites sont possibles sur rendez-vous, pour les clients et prospects engagés dans un processus de sélection. Une attestation de résidence des données peut être générée à tout moment depuis votre espace client."
        primaire={{ libelle: 'Demander une visite', href: '/entreprises#contact' }}
        secondaire={{ libelle: 'Lire notre position sur la souveraineté', href: '/souverainete' }}
      />
    </>
  )
}

function Bloc({
  icone,
  titre,
  texte,
}: {
  icone: React.ReactNode
  titre: string
  texte: string
}) {
  return (
    <div className="flex gap-3 border-b border-g-100 pb-3 last:border-0 last:pb-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-p-100 text-p-700">
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{titre}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-g-700">{texte}</p>
      </div>
    </div>
  )
}
