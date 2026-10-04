import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { PAGES_LEGALES } from '@/lib/mock'
import { estActif } from '@/lib/api/client'
import { lirePublicServeur } from '@/lib/api/public-serveur'
import { dureeMin } from '@/lib/format'
import { MicroLabel } from '@/components/ui/badge'
import { Callout } from '@/components/composition/card'
import { Container, SiteSection } from '@/components/site/blocs'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = PAGES_LEGALES.find((x) => x.slug === slug)
  return { title: p?.titre ?? 'Page introuvable' }
}

export default async function PageLegale({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const api = estActif()
  const modele = PAGES_LEGALES.find((p) => p.slug === slug)
  if (!modele) notFound()
  // En mode API, l'annexe SLA reprend les engagements publiés par `/public/sla`
  // (les mêmes que ceux de l'accueil), et la date celle de `/public/pages-legales`.
  const [sla, publiees] = await Promise.all([
    api && slug === 'sla'
      ? lirePublicServeur<Array<{ composant: string; dispo: number; reponseCritique: number; resolutionCritique: number }>>('/public/sla')
      : undefined,
    api ? lirePublicServeur<Array<{ slug: string; miseAJour: string }>>('/public/pages-legales') : undefined,
  ])
  // La grille publiée n'affiche aucune remise annuelle : la maquette ne doit pas en promettre une.
  const sansRemise = (m: typeof modele) =>
    !api
      ? m
      : {
          ...m,
          sections: m.sections.map((x) => ({
            ...x,
            texte: x.texte.replace(
              /Les souscriptions annuelles bénéficient d’une remise de 15 % et sont résiliables à l’échéance avec un préavis de trente jours\./,
              'Les engagements annuels ou pluriannuels, et leurs éventuelles conditions tarifaires, sont écrits dans le devis : la grille publiée n’affiche aucune remise.',
            ),
          })),
        }
  const page = sansRemise(
    sla && sla.length > 0
      ? {
          ...modele,
          sections: modele.sections.map((x) =>
            x.titre === 'Délais de réponse'
              ? {
                  ...x,
                  texte: `En gravité critique, par composant : ${sla
                    .map(
                      (l) =>
                        `${l.composant.toLowerCase()} — disponibilité ${l.dispo.toLocaleString('fr-FR')} %, première réponse sous ${dureeMin(l.reponseCritique)}, résolution visée sous ${dureeMin(l.resolutionCritique)}`,
                    )
                    .join(' ; ')}.`,
                }
              : x,
          ),
        }
      : modele,
  )
  const maj = publiees?.find((p) => p.slug === slug)?.miseAJour

  return (
    <SiteSection>
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <MicroLabel className="mb-3">Documents légaux</MicroLabel>
            <nav className="space-y-0.5">
              {PAGES_LEGALES.map((p) => (
                <Link
                  key={p.slug}
                  href={`/legal/${p.slug}`}
                  className={
                    p.slug === slug
                      ? 'block rounded-[6px] bg-p-050 px-2.5 py-1.5 text-[13px] font-semibold text-p-700'
                      : 'block rounded-[6px] px-2.5 py-1.5 text-[13px] text-g-700 transition-colors hover:bg-g-050 hover:text-p-700'
                  }
                >
                  {p.titre}
                </Link>
              ))}
            </nav>

            <div className="mt-6 border-t border-g-300 pt-4">
              <MicroLabel className="mb-2">Sommaire</MicroLabel>
              <nav className="space-y-0.5">
                {page.sections.map((s) => (
                  <a
                    key={s.titre}
                    href={`#${slugify(s.titre)}`}
                    className="block py-1 text-[12px] leading-snug text-g-500 transition-colors hover:text-p-700"
                  >
                    {s.titre}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="min-w-0 max-w-3xl">
            <h1 className="type-h1">{page.titre}</h1>
            <p className="mt-2 text-[13px] text-g-500">
              Dernière mise à jour : {api ? (maj ? new Date(maj).toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }) : 'non renseignée') : '19 août 2026'} · Synelia Group Afrique, Cocody, Abidjan, Côte
              d’Ivoire
            </p>

            <div className="mt-8 space-y-8">
              {page.sections.map((s, i) => (
                <section key={s.titre} id={slugify(s.titre)}>
                  <h2 className="type-h2">
                    <span className="tnum mr-2 text-g-500">{i + 1}.</span>
                    {s.titre}
                  </h2>
                  <p className="mt-3 text-[14px] leading-[1.75] text-g-700">{s.texte}</p>
                </section>
              ))}
            </div>

            <Callout ton="info" className="mt-10" titre={api ? 'Environnement d’essai' : 'Instance de démonstration'}>
              {api
                ? 'Cet environnement est un banc d’essai : les mentions d’immatriculation, de certification et de coordonnées sont des données d’exemple et n’ont aucune valeur juridique.'
                : 'Ce portail est une maquette. Les organisations, utilisateurs, ressources, factures, incidents et montants qui y figurent sont entièrement fictifs. Les mentions d’immatriculation, de certification et de coordonnées sont des données d’exemple et n’ont aucune valeur juridique.'}
            </Callout>

            <div className="mt-8 border-t border-g-300 pt-5">
              <p className="text-[13px] text-g-500">
                Une question sur ce document ?{' '}
                <Link
                  href="/entreprises#contact"
                  className="font-semibold text-p-700 hover:underline"
                >
                  Contactez-nous
                </Link>
                {' · '}
                <a
                  href="mailto:avs@synelia.tech"
                  className="font-semibold text-p-700 hover:underline"
                >
                  avs@synelia.tech
                </a>
              </p>
            </div>
          </article>
        </div>
      </Container>
    </SiteSection>
  )
}
