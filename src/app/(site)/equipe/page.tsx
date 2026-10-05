import type { Metadata } from 'next'
import { estActif } from '@/lib/api/client'
import { RubriqueNonPubliee } from '@/components/site/rubrique-non-publiee'
import { Clock, MapPin, PhoneCall } from 'lucide-react'
import { ASTREINTE, EQUIPE } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Callout } from '@/components/composition/card'
import {
  AppelFinal,
  Container,
  HeroCourt,
  LienFleche,
  Monogramme,
  SectionTitle,
  SiteSection,
} from '@/components/site/blocs'

export const metadata: Metadata = {
  title: 'L’équipe qui exploite la plateforme',
  description:
    estActif()
      ? 'Rubrique non publiée.'
      : 'Huit personnes à Abidjan et Grand-Bassam : exploitation, architecture, migrations, sécurité, réseau et relation client. Qui décroche à deux heures du matin, et comment l’astreinte fonctionne réellement.',
}

export default function Equipe() {
  if (estActif()) return <RubriqueNonPubliee surtitre="L’équipe" titre="L’équipe qui exploite la plateforme" />
  const parSite = ['Abidjan', 'Grand-Bassam'] as const

  return (
    <>
      <HeroCourt
        surtitre="L’équipe"
        titre={
          <>
            Derrière la supervision 24/7,
            <br />
            <span className="text-m-600">huit personnes joignables.</span>
          </>
        }
        chapeau="« Supervision 24/7 avec astreinte » est une phrase que tout le monde écrit. Voici ce qu’elle recouvre chez nous : les personnes, leur site, depuis quand elles sont là, et ce qu’elles font quand votre alerte se déclenche."
        actions={
          <>
            <ButtonLink href="/entreprises#contact" size="lg" variant="primary">
              Parler à un architecte
            </ButtonLink>
            <Badge tone="ok" dot>
              Astreinte assurée depuis Abidjan, pas déléguée
            </Badge>
          </>
        }
      />

      {/* ─── Les personnes ─────────────────────────────────────────────── */}
      <SiteSection>
        <Container>
          <SectionTitle
            surtitre="Exploitation"
            titre="Les personnes, leur poste, et ce qu’elles font vraiment"
            chapeau="Nous affichons ce que chacun décide ou corrige, plutôt qu’un intitulé de poste. Les portraits sont des monogrammes : un visage acheté sur une banque d’images n’apprendrait rien sur l’équipe."
            className="max-w-3xl"
          />
          <ul className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EQUIPE.map((m, i) => (
              <li
                key={m.nom}
                className="flex flex-col rounded-[12px] border border-g-300 bg-white p-5 transition-shadow hover:shadow-[0_4px_18px_rgba(43,27,77,.09)]"
              >
                <Monogramme initiales={m.initiales} index={i} taille="lg" />
                <p className="mt-4 text-[15px] font-bold leading-tight [font-family:var(--font-display)] text-ink">
                  {m.nom}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-p-700">{m.role}</p>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-g-700">{m.texte}</p>
                <dl className="mt-4 space-y-1.5 border-t border-g-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="shrink-0 text-g-500" aria-hidden />
                    <dt className="sr-only">Site</dt>
                    <dd className="text-[12px] text-g-500">{m.site}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="shrink-0 text-g-500" aria-hidden />
                    <dt className="sr-only">Dans l’équipe depuis</dt>
                    <dd className="tnum text-[12px] text-g-500">Depuis {m.depuis}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Langues</dt>
                    <dd className="text-[12px] text-g-500">{m.langues.join(' · ')}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {parSite.map((site) => {
              const membres = EQUIPE.filter((m) => m.site === site)
              return (
                <div
                  key={site}
                  className="flex items-baseline justify-between gap-4 rounded-[10px] border border-p-300 bg-p-050 px-5 py-4"
                >
                  <div>
                    <p className="text-[14px] font-bold [font-family:var(--font-display)] text-ink">
                      {site}
                    </p>
                    <p className="mt-1 text-[12px] text-g-700">
                      {membres.map((m) => m.role).join(' · ')}
                    </p>
                  </div>
                  <p className="tnum shrink-0 text-[22px] font-bold leading-none [font-family:var(--font-display)] text-p-700">
                    {membres.length}
                  </p>
                </div>
              )
            })}
          </div>
        </Container>
      </SiteSection>

      {/* ─── L'astreinte ───────────────────────────────────────────────── */}
      <SiteSection fond="clair">
        <Container>
          <SectionTitle
            surtitre="Astreinte"
            titre="Ce qui se passe quand votre alerte se déclenche à 2 h 40"
            chapeau="La question nous est posée à chaque atelier de cadrage. Autant y répondre ici."
            className="max-w-3xl"
          />
          {/*
            La salle, pas les visages : les portraits de cette page restent des
            monogrammes, et une photo de personne achetée ailleurs contredirait
            ce choix. Ici on montre l'endroit d'où l'astreinte répond.
          */}
          <figure className="mt-8 overflow-hidden rounded-[14px] border border-g-300">
            <img
              src="/photos/noc-supervision.webp"
              alt="Salle de supervision de nuit : un mur d’écrans affichant graphes, cartes et journaux, deux opérateurs vus de dos."
              width={1376}
              height={768}
              loading="lazy"
              className="h-52 w-full object-cover sm:h-64"
            />
            <figcaption className="bg-white px-5 py-3 text-[12px] leading-relaxed text-g-500">
              Vue d’illustration du poste de supervision d’Abidjan. Les tableaux affichés sont ceux
              de Centreon et Grafana, dont les liens de sortie figurent dans votre espace client.
            </figcaption>
          </figure>
          <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ASTREINTE.map((a, i) => (
              <div
                key={a.titre}
                className="flex gap-4 rounded-[12px] border border-g-300 bg-white p-5"
              >
                <span className="tnum shrink-0 text-[13px] font-bold [font-family:var(--font-display)] text-p-600">
                  0{i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold [font-family:var(--font-display)] text-ink">
                    {a.titre}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-g-700">{a.texte}</p>
                </div>
              </div>
            ))}
          </div>

          <Callout ton="violet" className="mt-6" titre="Le chiffre que nous publions">
            Trente minutes de délai de première réponse en gravité critique, mesuré de la levée de
            l’alerte au premier contact humain — pas à l’accusé de réception automatique d’un
            ticket. Les manquements génèrent des crédits SLA visibles dans votre espace client sans
            que vous ayez à les réclamer.
          </Callout>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <ButtonLink href="/statut" variant="secondary" iconBefore={<PhoneCall size={14} />}>
              Voir l’état des services en direct
            </ButtonLink>
            <LienFleche href="/legal/sla">Lire l’annexe SLA</LienFleche>
          </div>
        </Container>
      </SiteSection>

      {/* ─── Recrutement ───────────────────────────────────────────────── */}
      <SiteSection>
        <Container taille="md">
          <div className="rounded-[14px] border border-g-300 bg-white p-6 sm:p-8">
            <MicroLabel className="text-m-700">Nous recrutons</MicroLabel>
            <h2 className="mt-3 text-[22px] font-bold leading-tight [font-family:var(--font-display)] text-ink sm:text-[26px]">
              Quatre des huit personnes de cette page sont arrivées en alternance
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-g-700">
              Nous prenons six alternants par promotion sur l’exploitation et le réseau, avec
              astreinte accompagnée — jamais seuls sur un site en production. Si l’infrastructure
              vous intéresse plus que le discours qui l’entoure, écrivez-nous.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <ButtonLink href="mailto:avs@synelia.tech">Envoyer une candidature</ButtonLink>
              <LienFleche href="/communaute">Voir nos actions dans l’écosystème</LienFleche>
            </div>
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Vous préférez juger sur pièces ?"
        chapeau="L’atelier de cadrage n’est pas facturé et n’engage à rien. Vous repartez avec un dimensionnement chiffré, même si vous ne signez pas."
        primaire={{ libelle: 'Demander un atelier de cadrage', href: '/entreprises#contact' }}
        secondaire={{ libelle: 'Lire les témoignages clients', href: '/temoignages' }}
      />
    </>
  )
}
