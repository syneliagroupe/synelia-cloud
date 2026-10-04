import type { Metadata } from 'next'
import { estActif } from '@/lib/api/client'
import { RubriqueNonPubliee } from '@/components/site/rubrique-non-publiee'
import { ACTIONS_COMMUNAUTE, CONTRIBUTIONS_OSS } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Callout } from '@/components/composition/card'
import {
  AppelFinal,
  ChiffreCle,
  Container,
  HeroCourt,
  LienFleche,
  SectionTitle,
  SiteSection,
} from '@/components/site/blocs'

export const metadata: Metadata = {
  title: 'Dans l’écosystème ivoirien',
  description:
    estActif()
      ? 'Rubrique non publiée.'
      : 'Bac à sable gratuit pour les écoles, rencontre mensuelle Cloud & Souveraineté à Cocody, alternance sur l’exploitation, et correctifs renvoyés aux projets open source que nous opérons.',
}

const ETATS_OSS: Record<string, 'ok' | 'info' | 'neutral'> = {
  Fusionné: 'ok',
  'Corrigé en amont': 'ok',
  Publié: 'info',
  'En revue': 'neutral',
}

export default function Communaute() {
  if (estActif()) return <RubriqueNonPubliee surtitre="Écosystème" titre="Dans l’écosystème ivoirien" />
  return (
    <>
      <HeroCourt
        surtitre="Écosystème"
        titre={
          <>
            Une plateforme locale
            <br />
            <span className="text-m-600">doit servir localement.</span>
          </>
        }
        chapeau="Nous vendons de la souveraineté : ce serait creux si nous ne formions personne ici et si nous nous contentions de consommer les logiciels libres sur lesquels toute notre offre est bâtie. Voici ce que nous rendons, et ce que ça vaut."
        actions={
          <Badge tone="ok" dot>
            Prochaine rencontre · dernier jeudi du mois, à Cocody
          </Badge>
        }
      />

      {/* ─── Les actions ─────────────────────────────────────────────── */}
      <SiteSection>
        <Container>
          <SectionTitle
            surtitre="Nos actions"
            titre="Quatre engagements, chiffrés"
            chapeau="Sans chiffre, un engagement n’est pas vérifiable. Ceux-ci sont modestes, et c’est l’échelle réelle d’une entreprise de quarante clients."
            className="max-w-3xl"
          />
          <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ACTIONS_COMMUNAUTE.map((a) => (
              <div
                key={a.titre}
                className="flex flex-col rounded-[14px] border border-g-300 bg-white p-6"
              >
                <div className="flex items-baseline gap-3">
                  <span className="tnum text-[30px] font-bold leading-none [font-family:var(--font-display)] text-p-700">
                    {a.chiffre}
                  </span>
                  <span className="text-[12px] leading-snug text-g-500">{a.libelle}</span>
                </div>
                <h3 className="mt-4 text-[16px] font-bold leading-tight [font-family:var(--font-display)] text-ink">
                  {a.titre}
                </h3>
                <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-g-700">{a.texte}</p>
              </div>
            ))}
          </div>
        </Container>
      </SiteSection>

      {/* ─── Le bac à sable ─────────────────────────────────────────── */}
      <SiteSection fond="clair">
        <Container>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_0.85fr]">
            <div>
              <SectionTitle
                surtitre="Enseignement"
                titre="Un Espace Cloud pour les écoles, remis à zéro chaque nuit"
                chapeau="Les étudiants ivoiriens apprennent le cloud sur des comptes d’essai étrangers qui expirent, exigent une carte bancaire internationale et facturent en devise. Le nôtre n’expire pas et ne demande rien."
              />
              <ul className="mt-7 space-y-2.5">
                {[
                  'Deux Espaces Cloud par établissement, quatre machines virtuelles chacun, un cluster Kubernetes à trois nœuds.',
                  'Réinitialisation automatique à 3 h du matin : l’exercice du jour repart d’un état propre.',
                  'Les mêmes écrans que la production, avec les mêmes rôles — on apprend le portail réel, pas une version bridée.',
                  'Aucune conversion en offre payante à la fin du semestre, et aucune sollicitation commerciale des étudiants.',
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2.5">
                    <span
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-p-600"
                      aria-hidden
                    />
                    <span className="text-[14px] leading-relaxed text-g-700">{x}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <ButtonLink href="mailto:avs@synelia.tech">Inscrire un établissement</ButtonLink>
                <LienFleche href="/docs">Voir la documentation</LienFleche>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-5 rounded-[14px] border border-p-300 bg-white p-6">
              {[
                { valeur: '2', libelle: 'Espaces Cloud par établissement' },
                { valeur: '340', libelle: 'comptes étudiants actifs' },
                { valeur: '0 F', libelle: 'facturé aux écoles' },
                { valeur: '3 h', libelle: 'remise à zéro quotidienne' },
              ].map((c) => (
                <ChiffreCle key={c.libelle} valeur={c.valeur} libelle={c.libelle} />
              ))}
            </dl>
          </div>
        </Container>
      </SiteSection>

      {/* ─── Contributions amont ────────────────────────────────────── */}
      <SiteSection>
        <Container>
          <SectionTitle
            surtitre="Logiciel libre"
            titre="Ce que nous renvoyons en amont"
            chapeau="Notre marketplace opère Nextcloud, Zimbra, Odoo, OpenStack et Proxmox. Nous ne les écrivons pas : nous les exploitons, nous trouvons des défauts que nos clients rencontrent, et ces correctifs repartent chez leurs auteurs."
            className="max-w-3xl"
          />
          <ul className="mt-9 divide-y divide-g-100 overflow-hidden rounded-[12px] border border-g-300 bg-white">
            {CONTRIBUTIONS_OSS.map((c) => (
              <li
                key={c.projet}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-bold [font-family:var(--font-display)] text-ink">
                    {c.projet}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-g-700">{c.apport}</p>
                </div>
                <Badge tone={ETATS_OSS[c.etat] ?? 'neutral'} size="sm" className="self-start sm:self-center">
                  {c.etat}
                </Badge>
              </li>
            ))}
          </ul>

          <Callout ton="warn" className="mt-6" titre="Ce que nous ne prétendons pas">
            Vingt-trois correctifs en trois ans, ce n’est pas une contribution majeure à ces
            projets, et nous ne finançons aucune de leurs fondations. Nous consommons plus de
            logiciel libre que nous n’en produisons — c’est vrai de presque tout hébergeur, et
            l’écrire vaut mieux que de compter sur un logo « nous aimons l’open source ».
          </Callout>
        </Container>
      </SiteSection>

      {/* ─── La rencontre mensuelle ─────────────────────────────────── */}
      <SiteSection fond="violet-fonce" className="relative overflow-hidden">
        <span className="absolute inset-0 bg-grid-light opacity-50" aria-hidden />
        <Container className="relative" taille="md">
          <SectionTitle
            sombre
            centre
            surtitre="Rencontre mensuelle"
            titre="« Cloud & Souveraineté », le dernier jeudi du mois"
            chapeau="À Cocody, de 18 h à 20 h. Un retour d’expérience, une panne racontée sans filtre — souvent l’une des nôtres — et un temps de questions. Entrée libre, aucune présentation commerciale."
          />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="mailto:avs@synelia.tech" size="lg" variant="inverse">
              S’inscrire à la prochaine
            </ButtonLink>
            <ButtonLink href="/ressources" size="lg" variant="ghostInverse">
              Revoir les éditions passées
            </ButtonLink>
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Vous voulez juger l’équipe avant la plateforme ?"
        chapeau="Venez à une rencontre, ou lisez ce que quatre clients racontent de leur migration — accrocs compris."
        primaire={{ libelle: 'Lire les témoignages', href: '/temoignages' }}
        secondaire={{ libelle: 'Rencontrer l’équipe', href: '/equipe' }}
      />
    </>
  )
}
