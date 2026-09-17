import type { Metadata } from 'next'
import { Compass } from 'lucide-react'
import { Container } from '@/components/site/blocs'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Page introuvable',
}

/**
 * 404 de la vitrine : le chrome vient de `(site)/layout.tsx` (en-tête,
 * pied de page), il n'y a rien à remonter ici. Un lien externe rompu ou une
 * ancienne URL ne doivent pas atterrir sur la page 404 nue de Next, en
 * anglais et sans navigation.
 */
export default function NotFound() {
  return (
    <Container taille="md" className="flex flex-col items-center py-24 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-p-100 text-p-600">
        <Compass size={26} />
      </span>
      <h1 className="text-[28px] font-black [font-family:var(--font-display)] text-encre-2">
        Cette page n’existe pas
      </h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-encre-2/70">
        L’adresse est mal orthographiée, ou la page a été déplacée. Le reste du site est à un clic.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/">Retour à l’accueil</ButtonLink>
        <ButtonLink href="/contact" variant="secondary">
          Nous contacter
        </ButtonLink>
      </div>
    </Container>
  )
}
