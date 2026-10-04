import type { Metadata } from 'next'
import { estActif } from '@/lib/api/client'
import { RubriqueNonPubliee } from '@/components/site/rubrique-non-publiee'
import { MapPin } from 'lucide-react'
import { TEMOIGNAGES } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
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
  title: 'Ce qu’en disent nos clients',
  description:
    estActif()
      ? 'Rubrique non publiée.'
      : 'Quatre organisations racontent leur migration : l’état des lieux avant, ce qui a été fait, et ce qui s’est mal passé en cours de route. Finance, mobilité, secteur public et santé, en Côte d’Ivoire.',
}

export default function Temoignages() {
  if (estActif()) return <RubriqueNonPubliee surtitre="Témoignages" titre="Ce qu’en disent nos clients" />
  return (
    <>
      <HeroCourt
        surtitre="Témoignages"
        titre={
          <>
            Quatre migrations racontées,
            <br />
            <span className="text-m-600">accrocs compris.</span>
          </>
        }
        chapeau="Un témoignage sans accroc ne se lit pas : personne ne migre quatre cents boîtes aux lettres sans mauvaise surprise. Chaque récit dit donc aussi ce qui a dérapé, et de qui c’était la faute."
        actions={
          /*
            Une phrase de soixante-six caractères n'est pas une étiquette :
            `Badge` porte `whitespace-nowrap` — correct pour un libellé court —
            et celle-ci débordait de 38 px à 390 px. C'est une légende.
          */
          <p className="text-[13px] font-semibold text-encre-2/60">
            Organisations anonymisées · ordres de grandeur réellement constatés
          </p>
        }
      />

      {/*
        Un rappel de la citation d'ouverture aurait fait doublon avec la
        première fiche : on donne plutôt l'index, qui sert à choisir par quel
        contexte commencer.
      */}
      <SiteSection className="!py-9">
        <Container>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMOIGNAGES.map((t, i) => (
              <li
                key={t.slug}
                className="flex items-start gap-3 rounded-[10px] border border-g-300 bg-white p-4"
              >
                <Monogramme initiales={t.initiales} index={i} taille="sm" />
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-p-700">{t.secteur}</span>
                  <span className="block text-[13px] leading-snug text-g-700">
                    {t.organisation}
                  </span>
                  <span className="tnum mt-1.5 block text-[13px] font-bold [font-family:var(--font-display)] text-ink">
                    {t.chiffre}{' '}
                    <span className="text-[11px] font-normal text-g-500">{t.chiffreLibelle}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </SiteSection>

      {/* ─── Les récits ──────────────────────────────────────────────── */}
      <SiteSection fond="clair">
        <Container>
          <SectionTitle
            surtitre="Les récits"
            titre="Avant, après, et ce qui a coincé"
            chapeau="Même structure pour les quatre, afin que vous puissiez comparer plutôt que de lire quatre plaquettes."
            className="max-w-3xl"
          />
          <div className="mt-10 space-y-5">
            {TEMOIGNAGES.map((t, i) => (
              <article
                key={t.slug}
                className="overflow-hidden rounded-[14px] border border-g-300 bg-white"
              >
                <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_0.9fr] sm:p-8">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge tone="violet" size="sm">
                        {t.secteur}
                      </Badge>
                      <span className="flex items-center gap-1.5 text-[12px] text-g-500">
                        <MapPin size={11} className="shrink-0" aria-hidden />
                        {t.site}
                      </span>
                    </div>
                    <h3 className="mt-3 text-[17px] font-bold leading-tight [font-family:var(--font-display)] text-ink">
                      {t.organisation}
                    </h3>
                    <blockquote className="mt-4 border-l-2 border-p-400 pl-4 text-[15px] font-medium leading-relaxed [font-family:var(--font-display)] text-ink">
                      <span aria-hidden>«&nbsp;</span>
                      {t.citation}
                      <span aria-hidden>&nbsp;»</span>
                    </blockquote>
                    <div className="mt-4 flex items-center gap-2.5">
                      <Monogramme initiales={t.initiales} index={i} taille="sm" />
                      <span className="text-[13px] text-g-700">{t.auteur}</span>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 gap-4 rounded-[10px] bg-g-050 p-5">
                    <div>
                      <dt className="type-micro text-g-500">Avant</dt>
                      <dd className="mt-1.5 text-[13px] leading-relaxed text-g-700">{t.avant}</dd>
                    </div>
                    <div>
                      <dt className="type-micro text-g-500">Ce qui a été fait</dt>
                      <dd className="mt-1.5 text-[13px] leading-relaxed text-g-700">{t.apres}</dd>
                    </div>
                    <div>
                      <dt className="type-micro text-warn">Ce qui a coincé</dt>
                      <dd className="mt-1.5 text-[13px] leading-relaxed text-g-700">
                        {t.accroc}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-g-100 bg-p-050 px-6 py-4 sm:px-8">
                  <p className="flex items-baseline gap-2.5">
                    <span className="tnum text-[26px] font-bold leading-none [font-family:var(--font-display)] text-p-700">
                      {t.chiffre}
                    </span>
                    <span className="text-[13px] text-g-700">{t.chiffreLibelle}</span>
                  </p>
                  <LienFleche href="/entreprises#contact">
                    Un contexte proche du vôtre ? Parlons-en
                  </LienFleche>
                </div>
              </article>
            ))}
          </div>

          <Callout ton="info" className="mt-8" titre="Pourquoi les noms sont masqués">
            Nos clients sont des institutions financières, des opérateurs de transport et des
            administrations : publier leur architecture avec leur nom leur créerait un risque que
            nous n’avons pas à leur faire porter pour vendre. Les secteurs, les volumes et les
            chiffres sont exacts ; en atelier de cadrage, nous mettons en relation avec une
            référence de votre secteur si elle y consent.
          </Callout>
        </Container>
      </SiteSection>

      {/* ─── Ce qu'ils n'ont pas dit ─────────────────────────────────── */}
      <SiteSection>
        <Container taille="md">
          <SectionTitle
            surtitre="Honnêteté"
            titre="Ce qu’aucun de ces quatre n’a dit"
            chapeau="Nous n’avons pas de client qui a migré sans dépassement de délai, et aucun de ces projets n’a été indolore pour leurs équipes."
          />
          <ul className="mt-8 space-y-3">
            {[
              'Aucun ne dit que la migration a été transparente pour ses utilisateurs. Une bascule de messagerie se remarque toujours.',
              'Trois sur quatre ont dépassé le délai annoncé, de deux semaines en moyenne. Deux fois par notre faute.',
              'Deux ont dû réécrire des configurations qui contenaient des adresses IP en dur, invisibles dans leur documentation.',
              'Aucun n’a économisé la première année sur autre chose que les licences et le taux de change.',
            ].map((x) => (
              <li
                key={x}
                className="rounded-[10px] border border-g-300 bg-white px-4 py-3.5 text-[13px] leading-relaxed text-g-700"
              >
                {x}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <ButtonLink href="/entreprises#contact">Demander un atelier de cadrage</ButtonLink>
            <LienFleche href="/equipe">Voir qui vous accompagnerait</LienFleche>
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Votre contexte ressemble à l’un de ces quatre ?"
        chapeau="Dites-nous lequel. Nous partirons de ce qui a marché et de ce qui a coincé chez eux, plutôt que d’une page blanche."
        primaire={{ libelle: 'Parler à un architecte', href: '/entreprises#contact' }}
        secondaire={{ libelle: 'Estimer mon budget', href: '/simulateur' }}
      />
    </>
  )
}
