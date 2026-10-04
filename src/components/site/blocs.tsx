import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SolutionLogo } from '@/components/ui/display'
import { ButtonLink } from '@/components/ui/button'
import { MicroLabel } from '@/components/ui/badge'

/** Conteneur de largeur de page pour la vitrine. */
export function Container({
  children,
  className,
  taille = 'lg',
}: {
  children: ReactNode
  className?: string
  taille?: 'md' | 'lg'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6',
        taille === 'md' ? 'max-w-4xl' : 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Section de la vitrine, avec fond alterné. */
export function SiteSection({
  children,
  fond = 'blanc',
  className,
  id,
}: {
  children: ReactNode
  fond?: 'blanc' | 'clair' | 'violet' | 'violet-fonce'
  className?: string
  id?: string
}) {
  // « blanc » et « clair » alternent désormais deux crèmes : le blanc clinique
  // et le violet très pâle appartenaient à l'ancienne charte froide.
  const fonds = {
    blanc: 'bg-creme',
    clair: 'bg-creme-2',
    violet: 'bg-p-700',
    'violet-fonce': 'bg-p-900',
  }[fond]
  return (
    <section id={id} className={cn('py-14 sm:py-20', fonds, className)}>
      {/*
        L'apparition porte sur le contenu, pas sur la section : la section
        porte la couleur de fond, et la faire varier en opacité laisserait
        voir le fond de page au travers à chaque défilement.
      */}
      <div className="revele">{children}</div>
    </section>
  )
}

/** Titre de section marketing. */
export function SectionTitle({
  surtitre,
  titre,
  chapeau,
  sombre,
  centre,
  className,
}: {
  surtitre?: string
  titre: ReactNode
  chapeau?: ReactNode
  sombre?: boolean
  centre?: boolean
  className?: string
}) {
  return (
    <div className={cn(centre && 'mx-auto max-w-2xl text-center', className)}>
      {surtitre && (
        <MicroLabel className={sombre ? 'text-p-300' : 'text-m-600'}>{surtitre}</MicroLabel>
      )}
      <h2
        className={cn(
          'mt-2 text-[26px] font-bold leading-tight [font-family:var(--font-display)] sm:text-[32px]',
          sombre ? 'text-white' : 'text-ink',
        )}
      >
        {titre}
      </h2>
      {chapeau && (
        <p
          className={cn(
            'mt-3 text-[15px] leading-relaxed',
            sombre ? 'text-p-300' : 'text-g-700',
            centre && 'mx-auto max-w-2xl',
          )}
        >
          {chapeau}
        </p>
      )}
    </div>
  )
}

/**
 * Pastille d'état posée dans un héros sombre. Le héros affirmait « 99,98 % de
 * disponibilité » sans jamais renvoyer vers la page qui le prouve : la pastille
 * fait le lien, et dit l'état du moment plutôt qu'une moyenne.
 */
/**
 * Pastille d'état, en lien vers `/statut`.
 *
 * `clair` la rend lisible sur fond blanc : le libellé était en `text-white` en
 * dur, donc invisible dès qu'on posait la pastille ailleurs que sur le violet
 * foncé du héros. Une variante, pas une surcharge par `className` — deux
 * classes de couleur concurrentes se départagent par l'ordre de la feuille de
 * style, pas par l'ordre des classes.
 */
export function PastilleEtat({
  ton,
  texte,
  href,
  clair,
}: {
  ton: 'ok' | 'warn' | 'err'
  texte: string
  href: string
  clair?: boolean
}) {
  const pastille = { ok: 'bg-ok', warn: 'bg-warn', err: 'bg-err' }[ton]
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border py-1 pl-2.5 pr-3 transition-colors',
        clair
          ? 'border-g-300 bg-white hover:border-p-400 hover:bg-p-050'
          : 'border-p-400/60 bg-white/5 hover:border-p-300 hover:bg-white/10',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full animate-pulse-dot', pastille)} />
      <span className={cn('text-[12px] font-semibold', clair ? 'text-ink' : 'text-white')}>
        {texte}
      </span>
      <span
        className={cn(
          'text-[12px] transition-transform group-hover:translate-x-0.5',
          clair ? 'text-g-500' : 'text-p-300',
        )}
      >
        →
      </span>
    </Link>
  )
}

/**
 * Héros court des pages secondaires.
 *
 * Passé au crème avec l'ambiance « Ronde & claire » : le halo flou et la grille
 * appartenaient au héros sombre, et treize pages les portaient. Les pages qui
 * lui passaient des boutons `inverse` ont été ajustées en conséquence — un
 * bouton blanc sur crème ne se voit pas.
 */
export function HeroCourt({
  surtitre,
  titre,
  chapeau,
  actions,
  enfants,
}: {
  surtitre?: string
  titre: ReactNode
  chapeau?: ReactNode
  actions?: ReactNode
  enfants?: ReactNode
}) {
  return (
    <section className="border-b border-encre-2/10 bg-creme-2">
      <Container className="py-14 sm:py-16">
        {surtitre && <MicroLabel className="text-m-600">{surtitre}</MicroLabel>}
        <h1 className="mt-2 max-w-3xl text-[32px] font-black leading-[1.06] tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[46px]">
          {titre}
        </h1>
        {chapeau && (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-encre-2/70">{chapeau}</p>
        )}
        {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
        {enfants}
      </Container>
    </section>
  )
}

/** Appel final en bandeau violet, deux boutons (§2.2 §10). */
export function AppelFinal({
  titre = 'Prêt à voir la plateforme sur vos propres charges ?',
  chapeau = 'Créez un compte pour explorer le portail avec des données de démonstration, ou parlez à un architecte qui connaît le contexte ivoirien.',
  primaire = { libelle: 'Créer un compte', href: '/signup' },
  secondaire = { libelle: 'Parler à un architecte', href: '/entreprises#contact' },
}: {
  titre?: string
  chapeau?: string
  primaire?: { libelle: string; href: string }
  secondaire?: { libelle: string; href: string }
}) {
  return (
    <section className="relative overflow-hidden bg-p-700">
      <span className="absolute inset-0 bg-grid-light opacity-50" aria-hidden />
      <Container className="relative py-14 text-center sm:py-16">
        <h2 className="mx-auto max-w-2xl text-[26px] font-bold leading-tight [font-family:var(--font-display)] text-white sm:text-[32px]">
          {titre}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-p-300">{chapeau}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink
            href={primaire.href}
            size="lg"
            variant="inverse"
          >
            {primaire.libelle}
          </ButtonLink>
          <ButtonLink
            href={secondaire.href}
            size="lg"
            variant="ghostInverse"
          >
            {secondaire.libelle}
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}

/** Accordéon de questions fréquentes. */
export function Accordeon({
  items,
  className,
}: {
  items: Array<{ question: string; reponse: string }>
  className?: string
}) {
  return (
    <div className={cn('divide-y divide-g-300 overflow-hidden rounded-[10px] border border-g-300 bg-white', className)}>
      {items.map((it) => (
        <details key={it.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-g-050">
            <span className="text-[14px] font-semibold text-ink">{it.question}</span>
            <ChevronDown
              size={16}
              className="shrink-0 text-g-500 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-4 pb-4">
            <p className="max-w-3xl text-[14px] leading-relaxed text-g-700">{it.reponse}</p>
          </div>
        </details>
      ))}
    </div>
  )
}

/** Chiffre clé dans un bandeau. */
export function ChiffreCle({
  valeur,
  libelle,
  sombre,
}: {
  valeur: string
  libelle: string
  sombre?: boolean
}) {
  return (
    <div>
      <p
        className={cn(
          'tnum text-[30px] font-bold leading-none [font-family:var(--font-display)] sm:text-[36px]',
          sombre ? 'text-p-300' : 'text-p-700',
        )}
      >
        {valeur}
      </p>
      <p className={cn('mt-1.5 text-[13px]', sombre ? 'text-white/80' : 'text-g-500')}>
        {libelle}
      </p>
    </div>
  )
}

/**
 * Portrait en monogramme. La charte proscrit les photographies génériques, et
 * un visage de banque d'images réchauffe moins qu'un nom : on affiche les
 * initiales sur une teinte de la palette, choisie par la position pour rester
 * stable d'un rendu à l'autre.
 */
const TEINTES_MONOGRAMME = [
  'bg-p-700 text-white',
  'bg-p-100 text-p-700',
  'bg-p-600 text-white',
  'bg-m-050 text-m-700',
  'bg-p-800 text-white',
  'bg-p-050 text-p-700',
]

export function Monogramme({
  initiales,
  index = 0,
  taille = 'md',
  className,
}: {
  initiales: string
  index?: number
  taille?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const tailles = {
    sm: 'h-9 w-9 text-[12px] rounded-[8px]',
    md: 'h-12 w-12 text-[15px] rounded-[10px]',
    lg: 'h-16 w-16 text-[19px] rounded-[12px]',
  }[taille]
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center font-bold [font-family:var(--font-display)]',
        tailles,
        TEINTES_MONOGRAMME[index % TEINTES_MONOGRAMME.length],
        className,
      )}
    >
      {initiales}
    </span>
  )
}

/** Citation mise en avant — le seul endroit de la vitrine où un client parle. */
export function Citation({
  texte,
  auteur,
  role,
  initiales,
  index = 0,
  sombre,
  className,
}: {
  texte: string
  auteur: string
  role: string
  initiales: string
  index?: number
  sombre?: boolean
  className?: string
}) {
  return (
    <figure className={cn('flex flex-col', className)}>
      <blockquote
        className={cn(
          'text-[16px] font-medium leading-relaxed [font-family:var(--font-display)] sm:text-[18px]',
          sombre ? 'text-white' : 'text-ink',
        )}
      >
        <span aria-hidden>«&nbsp;</span>
        {texte}
        <span aria-hidden>&nbsp;»</span>
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <Monogramme initiales={initiales} index={index} taille="sm" />
        <span className="min-w-0">
          <span className={cn('block text-[13px] font-semibold', sombre ? 'text-white' : 'text-ink')}>
            {auteur}
          </span>
          <span className={cn('block text-[12px] leading-snug', sombre ? 'text-p-300' : 'text-g-500')}>
            {role}
          </span>
        </span>
      </figcaption>
    </figure>
  )
}

/** Carrousel de logos du marketplace (§2.2 §7). */
export function CarrouselLogos({
  logos,
}: {
  logos: Array<{ nom: string; initiales: string; teinte: string; icone?: string }>
}) {
  const doubles = [...logos, ...logos]
  return (
    <div className="relative overflow-hidden">
      <div className="flex w-max animate-marquee gap-3">
        {doubles.map((l, i) => (
          <div
            key={`${l.nom}-${i}`}
            className="flex w-40 shrink-0 items-center gap-2.5 rounded-[14px] border-2 border-encre-2/10 bg-creme px-3 py-2.5"
          >
            <SolutionLogo initiales={l.initiales} teinte={l.teinte} icone={l.icone} size="sm" />
            <span className="truncate text-[13px] font-semibold text-encre-2">{l.nom}</span>
          </div>
        ))}
      </div>
      {/*
        Les voiles de bord reprennent le fond de la section qui porte le
        carrousel — `creme-2`. Ils étaient restés en blanc et posaient deux
        traînées claires sur le crème.
      */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-creme-2 to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-creme-2 to-transparent" />
    </div>
  )
}

/** Lien texte fléché. */
export function LienFleche({
  href,
  children,
  sombre,
}: {
  href: string
  children: ReactNode
  sombre?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors',
        sombre ? 'text-p-300 hover:text-white' : 'text-p-700 hover:underline',
      )}
    >
      {children}
      <span className="transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  )
}
