import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import {
  Accordeon,
  CarrouselLogos,
  Container,
  LienFleche,
  PastilleEtat,
  SiteSection,
} from '@/components/site/blocs'
import {
  BANDEAU_CONFIANCE,
  BLOC_PRA,
  BLOC_SOUVERAINETE,
  CARTES_PRODUIT,
  CATALOGUE,
  DATACENTERS,
  ETUDES_CAS,
  FAQ_ACCUEIL,
  INCIDENTS,
  INDICATEURS_HERO,
  PARCOURS_DEMARRAGE,
  PORTES_ENTREE,
  STATUT_SERVICES,
} from '@/lib/mock'

export const metadata: Metadata = {
  title: 'Infrastructure cloud souveraine en Côte d’Ivoire',
  description:
    'Espaces Cloud, machines virtuelles, Kubernetes managé, sauvegarde immuable, plan de reprise exercé, et solutions open source opérées par Synelia. Deux sites à Abidjan et Grand-Bassam, équipe et supervision 24/7 sur place.',
}

/**
 * Accueil, ambiance « Ronde & claire » retenue au labo.
 *
 * Ce qui change par rapport à la version précédente, et pourquoi :
 *
 * - Fond crème plutôt que blanc, et couleur chaude — ocre, terre — que la
 *   charte n'avait pas. C'est ce qui manquait pour qu'une page paraisse
 *   accueillante ; le reste n'était que du violet sur du violet.
 * - Rayons très généreux, ombres portées colorées plutôt que grises, volumes
 *   en pâte à modeler à la place des salles serveurs nocturnes.
 * - Aucun dégradé, aucun flou : les deux halos flous et le voile en dégradé
 *   ont disparu. Les aplats font le travail, et le contraste ne dépend plus
 *   d'un réglage d'opacité.
 *
 * L'ocre ne porte jamais de texte : il tombe à 2:1 sur crème. Il ne sert que
 * d'aplat sous de l'encre, ou de fond de pastille.
 */

/** L'état du moment, dérivé des mêmes sondes que `/statut`. */
function etatPlateforme() {
  const enPanne = STATUT_SERVICES.filter((s) =>
    Object.values(s.etats).some((e) => e === 'panne'),
  ).length
  const degrades = STATUT_SERVICES.filter((s) =>
    Object.values(s.etats).some((e) => e === 'degrade'),
  ).length
  const ouverts = INCIDENTS.filter((i) => i.statut !== 'resolu' && i.gravite !== 'maintenance')

  if (enPanne > 0) {
    return {
      ton: 'err' as const,
      texte: `${enPanne} service${enPanne > 1 ? 's' : ''} en panne sur ${STATUT_SERVICES.length}`,
    }
  }
  if (degrades > 0) {
    return {
      ton: 'warn' as const,
      texte: `${degrades} service${degrades > 1 ? 's' : ''} dégradé${degrades > 1 ? 's' : ''} sur ${STATUT_SERVICES.length}`,
    }
  }
  if (ouverts.length > 0) {
    const n = ouverts.length
    return { ton: 'warn' as const, texte: `${n} incident${n > 1 ? 's' : ''} en cours` }
  }
  return { ton: 'ok' as const, texte: `${STATUT_SERVICES.length} services opérationnels` }
}

function donneesStructurees() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://cloud.synelia.tech/#organisation',
        name: 'Synelia Cloud',
        legalName: 'Synelia Group Afrique',
        url: 'https://cloud.synelia.tech/',
        description:
          'Infrastructure cloud souveraine opérée depuis deux datacenters ivoiriens : Espaces Cloud, machines virtuelles, Kubernetes managé, sauvegarde immuable, plan de reprise exercé et solutions open source opérées.',
        areaServed: { '@type': 'Country', name: 'Côte d’Ivoire' },
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Abidjan',
          addressRegion: 'Cocody',
          addressCountry: 'CI',
        },
        location: DATACENTERS.map((d) => ({
          '@type': 'Place',
          name: d.nom,
          address: { '@type': 'PostalAddress', addressLocality: d.ville, addressCountry: 'CI' },
        })),
      },
      {
        '@type': 'WebSite',
        '@id': 'https://cloud.synelia.tech/#site',
        url: 'https://cloud.synelia.tech/',
        name: 'Synelia Cloud',
        inLanguage: 'fr-CI',
        publisher: { '@id': 'https://cloud.synelia.tech/#organisation' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ACCUEIL.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.reponse },
        })),
      },
    ],
  }
}

/** Les quatre teintes qui tournent sur les cartes. */
const TEINTES = ['text-p-600', 'text-m-600', 'text-terre', 'text-ok'] as const
const FONDS = ['bg-p-600', 'bg-m-600', 'bg-terre', 'bg-ok'] as const
const PASTILLES = ['bg-p-100', 'bg-m-050', 'bg-ocre/25', 'bg-ok-bg'] as const

export default function Accueil() {
  const etat = etatPlateforme()

  return (
    <div className="bg-creme">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(donneesStructurees()).replace(/</g, '\\u003c'),
        }}
      />

      {/* ─── 1 · Héros ────────────────────────────────────────────────── */}
      <section className="bg-creme">
        <Container className="py-14 sm:py-20">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {['Abidjan', 'Grand-Bassam', '4 ms entre les deux'].map((t, n) => (
                  <span
                    key={t}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${PASTILLES[n]} ${
                      n === 2 ? 'text-encre-2' : TEINTES[n]
                    }`}
                  >
                    {t}
                  </span>
                ))}
                <PastilleEtat ton={etat.ton} texte={etat.texte} href="/statut" clair />
              </div>

              <h1 className="mt-6 text-[42px] font-black leading-[1] tracking-[-0.03em] [font-family:var(--font-display)] text-encre-2 sm:text-[68px]">
                Le cloud,
                <br />
                sans la{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-m-600">migraine</span>
                  {/* Surligneur ocre : aplat sous l'encre, jamais du texte. */}
                  <span
                    className="absolute inset-x-0 bottom-1 z-0 h-3.5 -rotate-1 rounded-full bg-ocre/45"
                    aria-hidden
                  />
                </span>
                .
              </h1>

              <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-encre-2/75">
                Vous cliquez, on provisionne. Vous grandissez, on redimensionne. Vous appelez, on
                décroche — à Abidjan, pas dans un centre d’appels à l’autre bout du monde.
              </p>
              <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-encre-2/55">
                Ce que nous ne faisons pas : réimplémenter les logiciels que vous utilisez déjà.
                Nous les opérons, vous les ouvrez dans leur propre interface.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href="/offres/espace-cloud" size="xl" iconAfter={<ArrowRight size={17} />}>
                  Commencer
                </ButtonLink>
                <ButtonLink href="/simulateur" size="xl" variant="secondary">
                  Estimer mon budget
                </ButtonLink>
              </div>

              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                {INDICATEURS_HERO.map((i, n) => (
                  <div key={i.libelle}>
                    <dt
                      className={`tnum text-[27px] font-black leading-none [font-family:var(--font-display)] ${TEINTES[n]}`}
                    >
                      {i.valeur}
                    </dt>
                    <dd className="mt-1.5 max-w-[16ch] text-[12px] leading-snug text-encre-2/60">
                      {i.libelle}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/*
              Pas de cadre : le fond de l'image est déjà le crème de la page,
              donc l'encadrer ne faisait qu'ajouter un rectangle visible autour
              de rien. Le visuel dit ce que fait la plateforme — deux baies,
              deux sites, un nuage au-dessus — au lieu de formes flottantes qui
              ne racontent rien.
            */}
            <img
              src="/photos/hero-pate.webp"
              alt="Deux baies de serveurs côte à côte sur une plateforme, deux épingles de carte, et un nuage relié par un pointillé au-dessus."
              width={1200}
              height={896}
              className="w-full"
            />
          </div>
        </Container>
      </section>

      {/* ─── 2 · Bandeau de confiance ─────────────────────────────────── */}
      <section className="bg-creme-2">
        <Container className="py-11">
          <dl className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {BANDEAU_CONFIANCE.map((c, n) => (
              <div key={c.libelle}>
                <dt
                  className={`tnum text-[32px] font-black leading-none [font-family:var(--font-display)] ${TEINTES[n]}`}
                >
                  {c.valeur}
                </dt>
                <dd className="mt-2 text-[13px] leading-snug text-encre-2/65">{c.libelle}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ─── 3 · Deux portes d'entrée ─────────────────────────────────── */}
      <SiteSection className="!bg-creme">
        <Container>
          <h2 className="max-w-2xl text-[32px] font-black leading-[1.05] tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[46px]">
            Par quoi vous commencez ?
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-encre-2/70">
            La plupart des plateformes vous font choisir entre de l’infrastructure brute et des
            logiciels prêts à l’emploi. Ici les deux cohabitent, avec la même facturation, les mêmes
            rôles et la même sauvegarde.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {PORTES_ENTREE.map((p, n) => {
              const img = n === 0 ? '/photos/pate-serveurs.webp' : '/photos/pate-nuage.webp'
              return (
                <div
                  key={p.titre}
                  className="flex flex-col rounded-[28px] border border-encre-2/10 bg-creme p-7 sm:p-9"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wider ${PASTILLES[n]} ${TEINTES[n]}`}
                    >
                      {n === 0 ? 'Pour les techniques' : 'Pour les métiers'}
                    </span>
                    <img src={img} alt="" aria-hidden width={640} height={640} className="h-20 w-20 rounded-[16px]" />
                  </div>
                  <h3 className="mt-3 text-[26px] font-black leading-tight [font-family:var(--font-display)] text-encre-2">
                    {p.titre}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-encre-2/70">{p.accroche}</p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${FONDS[n]}`}
                        >
                          <Check size={12} className="text-creme" strokeWidth={3} />
                        </span>
                        <span className="text-[14px] text-encre-2/80">{it}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] font-bold text-encre-2/55">{p.prix}</span>
                    <Link
                      href={p.cta.href}
                      className={`inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-creme transition-transform hover:-translate-y-1 ${FONDS[n]}`}
                    >
                      {p.cta.libelle} <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </Container>
      </SiteSection>

      {/* ─── 4 · Catalogue ────────────────────────────────────────────── */}
      <SiteSection className="!bg-creme-2">
        <Container>
          <h2 className="max-w-3xl text-[30px] font-black leading-tight tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[44px]">
            Des prix affichés.{' '}
            <span className="text-terre">Pas de « nous contacter ».</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-encre-2/70">
            Chaque produit publie son palier d’entrée. Les configurations sur mesure existent, mais
            vous savez d’abord à quoi vous avez affaire.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CARTES_PRODUIT.map((c, n) => (
              <Link
                key={c.slug}
                /* Drive Pro est un service du marketplace, pas une fiche d'offre. */
                href={c.href ?? `/offres/${c.slug}`}
                className="group flex flex-col rounded-[22px] border-2 border-encre-2/10 bg-creme p-5 transition-transform hover:-translate-y-1.5"
              >
                <img
                  src={`/photos/pate-${c.icone}.webp`}
                  alt=""
                  aria-hidden
                  width={320}
                  height={320}
                  className="h-14 w-14"
                />
                <span className="mt-3.5 text-[11px] font-bold uppercase tracking-wider text-encre-2/45">
                  {c.famille}
                </span>
                <h3 className="mt-1 text-[16px] font-bold leading-snug [font-family:var(--font-display)] text-encre-2">
                  {c.nom}
                </h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-encre-2/60">
                  {c.phrase}
                </p>
                <p
                  className={`mt-4 flex items-center gap-1.5 text-[15px] font-black [font-family:var(--font-display)] ${TEINTES[n % 4]}`}
                >
                  {c.prix.toLocaleString('fr-FR')} F
                  <span className="text-[12px] font-semibold opacity-70">{c.unite}</span>
                  <ArrowRight
                    size={15}
                    className="ml-auto transition-transform group-hover:translate-x-1"
                  />
                </p>
              </Link>
            ))}
          </div>
        </Container>
      </SiteSection>

      {/* ─── 5 · Sauvegarde et reprise ────────────────────────────────── */}
      <SiteSection className="!bg-creme">
        <Container>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <img
                src="/photos/pate-sauvegarde.webp"
                alt=""
                aria-hidden
                width={640}
                height={640}
                className="h-28 w-28 rounded-[20px]"
              />
              <h2 className="mt-5 text-[30px] font-black leading-[1.05] tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[42px]">
                {BLOC_PRA.titre}
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-encre-2/70">
                {BLOC_PRA.texte}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  href="/entreprises#contact"
                  className="inline-flex items-center gap-2 rounded-full bg-p-700 px-6 py-3.5 text-[15px] font-bold text-creme transition-transform hover:-translate-y-1"
                >
                  {BLOC_PRA.cta} <ArrowRight size={16} />
                </Link>
                <LienFleche href="/offres/pra">Voir la fiche PRA / DRaaS</LienFleche>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {BLOC_PRA.indicateurs.map((i, n) => (
                <div
                  key={i.libelle}
                  className="rounded-[22px] bg-creme-2 p-5"
                >
                  <p
                    className={`tnum text-[26px] font-black leading-none [font-family:var(--font-display)] ${TEINTES[n]}`}
                  >
                    {i.valeur}
                  </p>
                  <p className="mt-2 text-[13px] leading-snug text-encre-2/70">{i.libelle}</p>
                  <p className="mt-3 inline-block rounded-full bg-ok-bg px-2.5 py-1 text-[11px] font-bold text-ok">
                    {i.cible}
                  </p>
                </div>
              ))}
              <figure className="sm:col-span-3">
                <img
                  src="/illustrations/sauvegarde-321.svg"
                  alt="Schéma de la règle 3-2-1 : production dans l’Espace Cloud à Abidjan, instantané local sur NVMe, réplique hors site sur stockage objet à Grand-Bassam, et copie immuable verrouillée quatorze jours."
                  width={760}
                  height={306}
                  loading="lazy"
                  className="w-full rounded-[18px]"
                />
              </figure>
            </div>
          </div>
        </Container>
      </SiteSection>

      {/* ─── 6 · Les deux sites ───────────────────────────────────────── */}
      <SiteSection className="!bg-creme-2">
        <Container>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <img
                src="/photos/pate-sites.webp"
                alt=""
                aria-hidden
                width={640}
                height={640}
                className="h-28 w-28 rounded-[20px]"
              />
              <h2 className="mt-5 text-[30px] font-black leading-[1.05] tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[42px]">
                Deux sites, nommés.{' '}
                <span className="text-terre">À 4–6 ms l’un de l’autre.</span>
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-encre-2/70">
                « Cloud souverain » ne veut rien dire tant qu’on ne nomme pas les bâtiments. Voici
                les nôtres, et ce que la distance permet : répliquer hors site sans sortir du
                territoire.
              </p>
              <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  {
                    photo: '/photos/abidjan-jour.webp',
                    alt: 'Vue aérienne d’Abidjan en plein jour : le Plateau et la lagune Ébrié sous un ciel bleu.',
                    titre: 'Abidjan · Synertech Vallon',
                    detail: 'Site principal, à Cocody.',
                  },
                  {
                    photo: '/photos/parc-vitib.webp',
                    alt: 'Vue aérienne du campus technologique de Grand-Bassam.',
                    titre: 'Grand-Bassam · VITIB',
                    detail: 'Réplication et copies immuables.',
                  },
                ].map((c) => (
                  <figure
                    key={c.titre}
                    className="overflow-hidden rounded-[20px] border-2 border-encre-2/10 bg-creme"
                  >
                    <img
                      src={c.photo}
                      alt={c.alt}
                      width={1376}
                      height={768}
                      loading="lazy"
                      className="h-28 w-full object-cover"
                    />
                    <figcaption className="p-4">
                      <p className="text-[14px] font-bold [font-family:var(--font-display)] text-encre-2">
                        {c.titre}
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-encre-2/65">{c.detail}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-encre-2/50">
                Vues d’illustration. Les visites de site se demandent depuis votre espace client.
              </p>
            </div>
            {/*
              Carte générative, mais la géographie ne s'invente pas : la
              silhouette réelle du pays (Natural Earth) a servi de référence à
              la génération, sinon le modèle produit une tache qui ne ressemble
              à rien. Les deux épingles sont sur la côte sud-est, là où sont
              réellement les deux sites.
            */}
            <figure className="rounded-[28px] bg-creme-2 p-4">
              <img
                src="/photos/carte-pate.webp"
                alt="Carte en relief de la Côte d’Ivoire, deux épingles proches sur la côte sud-est reliées par un pointillé : Abidjan et Grand-Bassam."
                width={900}
                height={900}
                className="w-full rounded-[22px]"
              />
              <figcaption className="px-2 pb-1 pt-3 text-[12px] leading-relaxed text-encre-2/60">
                Abidjan (Synertech Vallon, Cocody) et Grand-Bassam (parc VITIB),
                à 4–6 ms l’un de l’autre.
              </figcaption>
            </figure>
          </div>
        </Container>
      </SiteSection>

      {/* ─── 7 · Souveraineté ─────────────────────────────────────────── */}
      <SiteSection className="!bg-creme">
        <Container>
          <h2 className="max-w-3xl text-[30px] font-black leading-tight tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[44px]">
            Trois questions auxquelles nous répondons par écrit
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {BLOC_SOUVERAINETE.map((b, n) => (
              <div key={b.titre} className="flex flex-col rounded-[24px] bg-creme-2 p-6">
                <img
                  src={n === 1 ? '/photos/pate-bouclier.webp' : b.illustration}
                  alt=""
                  aria-hidden
                  width={n === 1 ? 640 : 40}
                  height={n === 1 ? 640 : 40}
                  className="h-14 w-14 rounded-[12px]"
                />
                <h3 className="mt-4 text-[18px] font-black leading-snug [font-family:var(--font-display)] text-encre-2">
                  <span className={`tnum mr-1.5 ${TEINTES[n]}`}>0{n + 1}</span>
                  {b.titre}
                </h3>
                <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-encre-2/70">
                  {b.texte}
                </p>
                <div className="mt-4">
                  <LienFleche href={b.lien.href}>{b.lien.libelle}</LienFleche>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </SiteSection>

      {/* ─── 8 · Marketplace ──────────────────────────────────────────── */}
      <SiteSection className="!bg-creme-2">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="max-w-2xl text-[30px] font-black leading-tight tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[42px]">
                Des logiciels libres, opérés par nous
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-encre-2/70">
                Nous ne réimplémentons pas ces produits : nous les provisionnons, les dimensionnons,
                gérons les sièges, les sauvegardons et les facturons. Vous les utilisez dans leur
                interface d’origine, via une redirection SSO.
              </p>
            </div>
            <ButtonLink href="/marketplace" variant="secondary">
              Voir le catalogue
            </ButtonLink>
          </div>
          <div className="mt-9">
            <CarrouselLogos
              logos={CATALOGUE.map((c) => ({
                nom: c.solutionOSS.split(' · ')[0],
                initiales: c.logoInitiales,
                teinte: c.logoTeinte,
                icone: c.icone,
              }))}
            />
          </div>
          <figure className="mt-8 overflow-hidden rounded-[24px] border-2 border-encre-2/10">
            <img
              src="/photos/equipe-jour.webp"
              alt="Une équipe réunie autour d’un ordinateur portable dans un bureau lumineux d’Abidjan."
              width={1376}
              height={768}
              loading="lazy"
              className="h-52 w-full object-cover sm:h-64"
            />
            <figcaption className="bg-creme px-5 py-3.5 text-[12px] leading-relaxed text-encre-2/55">
              Vue d’illustration. Les services du marketplace s’ouvrent dans leur propre interface —
              nous ne la réimplémentons pas, nous vous y menons par une redirection SSO.
            </figcaption>
          </figure>
        </Container>
      </SiteSection>

      {/* ─── 9 · Parcours de démarrage ────────────────────────────────── */}
      <SiteSection className="!bg-creme">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 className="max-w-2xl text-[30px] font-black leading-tight tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[42px]">
              De l’atelier à la production, en quatre étapes
            </h2>
            <img
              src="/photos/pate-fusee.webp"
              alt=""
              aria-hidden
              width={640}
              height={640}
              className="h-24 w-24 rounded-[18px]"
            />
          </div>
          <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PARCOURS_DEMARRAGE.map((e, n) => (
              <li
                key={e.jalon}
                className="flex flex-col rounded-[24px] bg-creme-2 p-6"
              >
                <span
                  className={`self-start rounded-full px-3 py-1 text-[12px] font-bold ${PASTILLES[n % 4]} ${TEINTES[n % 4]}`}
                >
                  {e.jalon}
                </span>
                <h3 className="mt-3.5 text-[17px] font-black leading-snug [font-family:var(--font-display)] text-encre-2">
                  {e.titre}
                </h3>
                <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-encre-2/70">
                  {e.texte}
                </p>
                <p className="mt-4 border-t-2 border-encre-2/10 pt-3 text-[12px] font-bold text-encre-2/55">
                  {e.livrable}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </SiteSection>

      {/* ─── 10 · Preuve ──────────────────────────────────────────────── */}
      <SiteSection className="!bg-ocre">
        <Container>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <p className="text-[74px] font-black leading-[0.85] tracking-[-0.04em] [font-family:var(--font-display)] text-encre-2 sm:text-[112px]">
              {ETUDES_CAS[0].chiffre}
            </p>
            <div>
              <p className="text-[17px] font-black [font-family:var(--font-display)] text-encre-2">
                {ETUDES_CAS[0].chiffreLibelle}
              </p>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-encre-2/80">
                {ETUDES_CAS[0].texte}
              </p>
              <p className="mt-5 text-[13px] font-bold uppercase tracking-wider text-encre-2/65">
                {ETUDES_CAS[0].client}
              </p>
            </div>
          </div>
        </Container>
      </SiteSection>

      {/* ─── 11 · Questions ──────────────────────────────────────────── */}
      <SiteSection className="!bg-creme">
        <Container>
          <h2 className="text-[30px] font-black leading-tight tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[42px]">
            Les questions qu’on nous pose
          </h2>
          <div className="mt-8 max-w-3xl">
            <Accordeon items={FAQ_ACCUEIL} />
          </div>
        </Container>
      </SiteSection>

      {/* ─── 12 · Appel final ────────────────────────────────────────── */}
      <SiteSection className="!bg-p-700">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[32px] font-black leading-[1.05] tracking-[-0.02em] [font-family:var(--font-display)] text-creme sm:text-[46px]">
              On en parle une demi-journée ?
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-p-100">
              L’atelier de cadrage ne se facture pas. Vous repartez avec un dimensionnement chiffré,
              même si vous ne signez pas.
            </p>
            <Link
              href="/entreprises#contact"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-ocre px-8 py-4 text-[16px] font-bold text-encre-2 transition-transform hover:-translate-y-1"
            >
              Réserver l’atelier <ArrowRight size={18} />
            </Link>
          </div>
        </Container>
      </SiteSection>
    </div>
  )
}
