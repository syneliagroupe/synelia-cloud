import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Check, FileDown, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pct } from '@/lib/format'
import { estActif } from '@/lib/api/client'
import { lirePublicServeur } from '@/lib/api/public-serveur'
import { CATALOGUE, NIVEAUX_SOUVERAINETE, TRAJECTOIRE_SORTIE } from '@/lib/mock'
import { MATRICE_RBAC, ROLES_ORDRE } from '@/lib/rbac'
import { ROLE_LABEL } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import {
  AppelFinal,
  Container,
  HeroCourt,
  SectionTitle,
  SiteSection,
} from '@/components/site/blocs'

export const metadata: Metadata = {
  title: 'Souveraineté : données, opérations, logiciel',
  description:
    'Les trois niveaux de souveraineté et la position exacte de Synelia sur chacun, y compris ce qui n’est pas encore atteint. Trajectoire de sortie des backends propriétaires documentée.',
}

interface SouveraineteApi {
  niveaux: { niveau: string; titre: string; description: string; atteint: boolean }[]
  trajectoireSortie: { backend: string; part: string; cible: string; avancement: number }[]
}

export default async function Souverainete() {
  const api = estActif() ? await lirePublicServeur<SouveraineteApi>('/public/souverainete') : null
  const niveaux = api
    ? api.niveaux.map((n) => ({
        niveau: n.niveau,
        question: n.titre,
        statut: n.atteint ? ('ok' as const) : ('warn' as const),
        position: n.atteint ? 'Atteinte' : 'En transition',
        detail: n.description,
        ancre: ({ Données: 'donnees', Logiciels: 'logiciel', Compétences: 'operations' } as Record<string, string>)[n.niveau],
      }))
    : NIVEAUX_SOUVERAINETE.map((n) => ({ ...n, ancre: undefined as string | undefined }))
  // En mode API, sans réponse du backend il n'y a pas de trajectoire à publier : on n'invente pas celle de la maquette.
  const trajectoire = api ? api.trajectoireSortie : estActif() ? [] : TRAJECTOIRE_SORTIE
  const avecTrajectoire = trajectoire.length > 0
  const atteints = niveaux.filter((n) => n.statut === 'ok').length
  return (
    <>
      <HeroCourt
        surtitre="Souveraineté"
        titre={
          <>
            Trois niveaux.
            <br />
            <span className="text-m-600">
              {atteints === niveaux.length
                ? 'Tous atteints.'
                : `${atteints} atteint${atteints > 1 ? 's' : ''}, ${niveaux.length - atteints} en transition.`}
            </span>
          </>
        }
        chapeau="« Cloud souverain » ne veut rien dire tant qu’on ne précise pas de quelle souveraineté on parle. Il y en a trois : celle des données, celle des opérations, celle du logiciel. Voici notre position sur chacune — y compris là où nous ne sommes pas encore arrivés."
      />

      <SiteSection>
        <Container>
          <div className="space-y-5">
            {niveaux.map((n, i) => (
              <div
                key={n.niveau}
                id={n.ancre ?? (i === 0 ? 'donnees' : i === 1 ? 'operations' : 'logiciel')}
                className={cn(
                  'rounded-[14px] border-2 bg-white p-6',
                  n.statut === 'ok' ? 'border-ok/25' : 'border-warn/25',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <MicroLabel className="text-g-500">Niveau {i + 1}</MicroLabel>
                    <h2 className="mt-1.5 text-[22px] font-bold leading-tight [font-family:var(--font-display)] text-ink">
                      {n.niveau}
                    </h2>
                    <p className="mt-1.5 text-[14px] italic text-g-500">{n.question}</p>
                  </div>
                  <Badge tone={n.statut === 'ok' ? 'ok' : 'warn'} dot>
                    {n.position}
                  </Badge>
                </div>
                <p className="mt-4 max-w-4xl text-[14px] leading-relaxed text-g-700">{n.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </SiteSection>

      {avecTrajectoire && (
      <SiteSection fond="clair">
        <Container>
          <SectionTitle
            surtitre="Transparence"
            titre="Notre trajectoire de sortie des backends propriétaires"
            chapeau="Nous exploitons encore de la capacité VMware vSphere et Microsoft Hyper-V, héritée de reprises de parcs clients. Nous préférons l’afficher que le taire : un évaluateur technique le découvrirait en une minute, et une trajectoire datée est plus crédible qu’une affirmation invérifiable."
          />
          {/*
            Une sortie de socle n'est pas une case à cocher : c'est du matériel
            qu'on démonte et des données qu'on rebascule. La photo dit l'effort
            que le tableau de pourcentages ci-dessous ne montre pas.
          */}
          <figure className="mt-8 overflow-hidden rounded-[14px] border border-g-300">
            <img
              src="/photos/migration.webp"
              alt="Gros plan sur des mains gantées extrayant une lame de serveur d’une baie, un chariot et un carton d’expédition à côté."
              width={1376}
              height={768}
              loading="lazy"
              className="h-48 w-full object-cover sm:h-60"
            />
            <figcaption className="bg-white px-5 py-3 text-[12px] leading-relaxed text-g-500">
              Vue d’illustration. Chaque bascule de socle est planifiée avec vous, exercée à blanc
              sur une copie, et réversible jusqu’au basculement final.
            </figcaption>
          </figure>

          <Card className="mt-8">
            <CardHeader
              titre="Part de capacité par socle, et date cible de migration"
              actions={<Badge tone="violet">Mise à jour trimestrielle</Badge>}
            />
            <div className="space-y-4">
              {trajectoire.map((t) => (
                <div key={t.backend}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {t.backend}
                      <span className="ml-2 font-normal text-g-500">{t.part}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={t.avancement === 100 ? 'ok' : 'warn'} size="sm">
                        {t.cible}
                      </Badge>
                      <span className="tnum text-[12px] font-semibold text-g-700">
                        {pct(t.avancement)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-g-100">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        t.avancement === 100 ? 'bg-ok' : 'bg-warn',
                      )}
                      style={{ width: `${t.avancement}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {!api && (
            <Callout ton="warn" className="mt-5" titre="Ce que cela implique pour vous, concrètement">
              Si la souveraineté logicielle est une exigence contractuelle de votre côté, souscrivez
              l’offre <span className="font-semibold">Cloud Souverain</span> : elle garantit
              contractuellement un placement exclusif sur OpenStack, Proxmox VE ou Apache CloudStack,
              et l’attestation que nous générons le mentionne explicitement. Si vous arrivez avec un
              parc VMware existant, l’offre{' '}
              <span className="font-semibold">Cloud Hybride</span> absorbe cette capacité et
              contractualise sa sortie progressive.
            </Callout>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href="/offres/espace-cloud" variant="secondary" size="sm">
                Offre Cloud Souverain
              </ButtonLink>
              <ButtonLink href="/entreprises#contact" variant="ghost" size="sm">
                Discuter d’une trajectoire de migration
              </ButtonLink>
            </div>
          </Card>
        </Container>
      </SiteSection>
      )}

      {/* Qui peut y accéder */}
      <SiteSection id="acces">
        <Container>
          <SectionTitle
            surtitre="Contrôle d’accès"
            titre="Qui peut accéder à vos données, et comment on le prouve"
            chapeau="Un modèle de droits explicite, publié, avec dix rôles. Et un journal d’audit qui enregistre non seulement les actions réussies, mais aussi les refus."
          />

          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card>
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-p-100 text-p-700">
                <ScrollText size={17} />
              </span>
              <h3 className="mt-3 type-h3">Dix rôles, une matrice publiée</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-g-700">
                {MATRICE_RBAC.length} actions × {ROLES_ORDRE.length} rôles, avec trois niveaux :
                autorisé, lecture seule, interdit. La matrice est visible dans votre espace client et
                fournie en annexe contractuelle. Une action interdite n’est jamais masquée : elle est
                désactivée avec le rôle requis en infobulle.
              </p>
            </Card>
            <Card>
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-p-100 text-p-700">
                <AlertTriangle size={17} />
              </span>
              <h3 className="mt-3 type-h3">Les refus sont journalisés</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-g-700">
                La plupart des journaux d’audit ne consignent que ce qui a réussi. Le nôtre consigne
                aussi les tentatives refusées, avec l’acteur, l’action, la cible et le rôle
                insuffisant. C’est ce qui permet de détecter une escalade de privilèges avant qu’elle
                n’aboutisse.
              </p>
            </Card>
            <Card>
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-p-100 text-p-700">
                <Check size={17} />
              </span>
              <h3 className="mt-3 type-h3">Nos accès aussi sont tracés</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-g-700">
                Les accès de nos ingénieurs sont nominatifs — jamais de compte partagé — soumis à une
                élévation temporaire justifiée par un ticket, et apparaissent dans{' '}
                <span className="font-semibold">votre</span> journal d’audit, pas seulement dans le
                nôtre.
              </p>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader
              titre="Extrait de la matrice des rôles"
              sousTitre="Six actions parmi les plus sensibles. La matrice complète est consultable dans l’espace client."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    <th className="type-micro sticky left-0 z-10 min-w-56 bg-g-050 px-3 py-2 text-left text-g-500">
                      Action
                    </th>
                    {(['org_admin', 'espace_admin', 'project_owner', 'operator', 'compliance', 'read_only'] as const).map(
                      (r) => (
                        <th key={r} className="type-micro px-2 py-2 text-center text-g-500">
                          {ROLE_LABEL[r]}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {MATRICE_RBAC.filter((a) =>
                    [
                      'espace.create',
                      'vm.create_delete',
                      'dr.failover.real',
                      'secrets.update',
                      'invoice.view',
                      'audit.view',
                    ].includes(a.id),
                  ).map((a) => (
                    <tr key={a.id} className="border-b border-g-100 last:border-0">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-[13px] text-ink">
                        {a.libelle}
                      </td>
                      {(['org_admin', 'espace_admin', 'project_owner', 'operator', 'compliance', 'read_only'] as const).map(
                        (r) => {
                          const p = a.perms[r]
                          return (
                            <td
                              key={r}
                              className={cn(
                                'px-2 py-2 text-center text-[15px] font-bold',
                                p === 'full'
                                  ? 'text-ok'
                                  : p === 'read'
                                    ? 'text-warn'
                                    : 'text-g-500',
                              )}
                            >
                              {p === 'full' ? '●' : p === 'read' ? '◐' : '—'}
                            </td>
                          )
                        },
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2.5 text-[12px] text-g-500">
              <span className="font-bold text-ok">●</span> autorisé ·{' '}
              <span className="font-bold text-warn">◐</span> lecture seule ·{' '}
              <span className="font-bold text-g-500">—</span> interdit
            </p>
          </Card>
        </Container>
      </SiteSection>

      {/* Réversibilité */}
      <SiteSection fond="clair" id="reversibilite">
        <Container>
          <SectionTitle
            surtitre="Réversibilité"
            titre="Comment vous repartez, service par service"
            chapeau="Chaque service publie son format d’export et son délai. Nous vérifions périodiquement que ces exports se réimportent effectivement dans une instance vierge — un format annoncé mais jamais éprouvé ne vaut rien le jour où vous en avez besoin."
          />
          <div className="mt-8 overflow-x-auto rounded-[10px] border border-g-300 bg-white">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Service', 'Solution', 'Formats d’export', 'Délai', 'Documentation'].map((h) => (
                    <th key={h} className="type-micro px-4 py-2.5 text-left text-g-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATALOGUE.map((c, i) => (
                  <tr
                    key={c.slug}
                    className={cn('border-b border-g-100 last:border-0', i % 2 === 1 && 'bg-g-050/60')}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/marketplace/${c.slug}`}
                        className="text-[13px] font-medium text-ink hover:text-p-700"
                      >
                        {c.nom}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-g-700">{c.solutionOSS}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {c.reversibilite.formats.map((f) => (
                          <Badge key={f} tone="neutral" size="sm">
                            {f}
                          </Badge>
                        ))}
                      </span>
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13px] text-g-700">
                      {c.reversibilite.delaiJours} j ouvrés
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-p-700">
                        <FileDown size={12} />
                        Publiée
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Callout ton="violet" className="mt-5" titre="Ce que dit le contrat">
            À la résiliation, vous disposez de trente jours pour récupérer vos données dans les
            formats documentés. Nous fournissons l’assistance nécessaire à l’export et procédons à
            l’effacement sécurisé après votre confirmation écrite. Les données d’infrastructure
            (images de machines, volumes, sauvegardes) s’exportent en formats standards — qcow2, tar,
            objets S3 — sans conversion propriétaire.
          </Callout>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Ces engagements se vérifient sur pièces"
        chapeau="Demandez une attestation de résidence des données, un rapport d’exercice PRA ou la matrice de rôles complète. Nous les fournissons avant la signature, pas après."
        primaire={{ libelle: 'Parler à un architecte', href: '/entreprises#contact' }}
        secondaire={{ libelle: 'Voir les datacenters', href: '/datacenters' }}
      />
    </>
  )
}
