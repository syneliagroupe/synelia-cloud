import type { Metadata } from 'next'
import { estActif } from '@/lib/api/client'
import { RubriqueNonPubliee } from '@/components/site/rubrique-non-publiee'
import { AlertTriangle } from 'lucide-react'
import { CHANTIERS_OUVERTS, HISTOIRE, VALEURS } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import {
  AppelFinal,
  Container,
  HeroCourt,
  LienFleche,
  SectionTitle,
  SiteSection,
} from '@/components/site/blocs'

export const metadata: Metadata = {
  title: 'Notre histoire',
  description:
    estActif()
      ? 'Rubrique non publiée.'
      : 'Pourquoi Synelia a construit ses propres datacenters : un client privé de son ERP pendant trois jours, un support à 5 000 km, et rien d’autre à offrir que de la patience. De 2016 au portail unique, dix ans en sept jalons.',
}

export default function Histoire() {
  if (estActif()) return <RubriqueNonPubliee surtitre="Notre histoire" titre="Notre histoire" />
  return (
    <>
      <HeroCourt
        surtitre="Notre histoire"
        titre={
          <>
            Nous avons construit ceci
            <br />
            <span className="text-m-600">parce que nous en avions besoin.</span>
          </>
        }
        chapeau="Synelia n’a pas commencé comme hébergeur. Nous intégrions des systèmes, et nous achetions l’hébergement ailleurs — jusqu’au jour où cela nous a coûté trois jours de production chez un client, sans que nous puissions rien y faire."
        actions={
          <Badge tone="violet" dot>
            Dix ans, deux sites, quarante organisations clientes
          </Badge>
        }
      />

      {/* ─── Le déclencheur ───────────────────────────────────────────── */}
      <SiteSection>
        <Container taille="md">
          <MicroLabel className="text-m-700">Le déclencheur · 2017</MicroLabel>
          <p className="mt-4 text-[19px] font-medium leading-relaxed [font-family:var(--font-display)] text-ink sm:text-[22px]">
            Un client perd l’accès à son ERP un mardi matin. La cause est dans un datacenter à
            5 000 km. Le support répond en anglais, sur un autre fuseau, à des heures où notre
            client dort. Trois jours plus tard le service revient, sans explication écrite.
          </p>
          <p className="mt-5 text-[15px] leading-relaxed text-g-700">
            Nous n’avions rien à offrir que de la patience — et une facture à défendre. Ce n’était
            pas un problème de qualité : le fournisseur était compétent. C’était un problème de
            distance, de fuseau et de droits. Personne de joignable ne connaissait ce parc, et
            personne de compétent n’était joignable. Nous avons décidé de nous mettre en situation
            de répondre nous-mêmes.
          </p>
        </Container>
      </SiteSection>

      {/* ─── La chronologie ──────────────────────────────────────────── */}
      <SiteSection fond="clair">
        <Container>
          <SectionTitle
            surtitre="Chronologie"
            titre="Dix ans, sept jalons"
            chapeau="Y compris ceux qui n’ont pas été des succès."
            className="max-w-3xl"
          />
          <ol className="relative mt-10 space-y-6 border-l border-p-300 pl-6 sm:pl-8">
            {HISTOIRE.map((h) => (
              <li key={h.annee} className="relative">
                <span
                  className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-p-050 bg-p-700 sm:-left-[39px]"
                  aria-hidden
                />
                <p className="tnum type-micro text-m-700">{h.annee}</p>
                <h3 className="mt-1.5 text-[17px] font-bold leading-tight [font-family:var(--font-display)] text-ink sm:text-[19px]">
                  {h.titre}
                </h3>
                <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-g-700">{h.texte}</p>
              </li>
            ))}
          </ol>
        </Container>
      </SiteSection>

      {/* ─── Les valeurs ─────────────────────────────────────────────── */}
      <SiteSection>
        <Container>
          <SectionTitle
            surtitre="Ce qui en découle"
            titre="Quatre règles, et où vous pouvez les vérifier"
            chapeau="Une valeur qu’on ne peut pas vérifier est un slogan. Chacune renvoie vers la page où elle s’applique."
            className="max-w-3xl"
          />
          <div className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {VALEURS.map((v, i) => (
              <div
                key={v.titre}
                className="flex flex-col rounded-[14px] border border-g-300 bg-white p-6"
              >
                <span className="tnum text-[13px] font-bold [font-family:var(--font-display)] text-p-600">
                  0{i + 1}
                </span>
                <h3 className="mt-2 text-[18px] font-bold leading-tight [font-family:var(--font-display)] text-ink">
                  {v.titre}
                </h3>
                <p className="mt-3 flex-1 text-[14px] leading-relaxed text-g-700">{v.texte}</p>
                <div className="mt-5 border-t border-g-100 pt-4">
                  <LienFleche href={v.lien.href}>{v.lien.libelle}</LienFleche>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </SiteSection>

      {/* ─── Ce qui n'est pas fini ───────────────────────────────────── */}
      <SiteSection fond="violet-fonce" className="relative overflow-hidden">
        <span className="absolute inset-0 bg-grid-light opacity-50" aria-hidden />
        <Container className="relative" taille="md">
          <SectionTitle
            sombre
            surtitre="En chantier"
            titre="Ce que cette page ne va pas prétendre"
            chapeau="Une page « notre histoire » se termine d’ordinaire en fanfare. Voici plutôt ce qui n’est pas terminé — vous le découvririez de toute façon."
          />
          <ul className="mt-9 space-y-3">
            {CHANTIERS_OUVERTS.map((c) => (
              <li
                key={c}
                className="flex items-start gap-3 rounded-[10px] border border-p-400/50 bg-p-900/70 px-4 py-3.5"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-m-400" aria-hidden />
                <span className="text-[13px] leading-relaxed text-p-300">{c}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <ButtonLink href="/souverainete" variant="inverse">
              Voir notre position sur la souveraineté
            </ButtonLink>
            <LienFleche href="/equipe" sombre>
              Rencontrer l’équipe
            </LienFleche>
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="La suite dépend en partie de vous"
        chapeau="Nous sommes quarante organisations, pas quatre cents. À cette échelle, ce que vous demandez finit par changer le produit."
        primaire={{ libelle: 'Parler à un architecte', href: '/entreprises#contact' }}
        secondaire={{ libelle: 'Lire les témoignages', href: '/temoignages' }}
      />
    </>
  )
}
