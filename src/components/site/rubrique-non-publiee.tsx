import { ButtonLink } from '@/components/ui/button'
import { Container, HeroCourt, SiteSection } from '@/components/site/blocs'

/**
 * Rubrique éditoriale (équipe, histoire, témoignages, écosystème) dont le
 * contenu est un récit de démonstration. En mode API, la plateforme n'a ni
 * équipe, ni client, ni chronologie à publier : la page le dit au lieu
 * d'afficher des personnes et des chiffres inventés.
 */
export function RubriqueNonPubliee({ surtitre, titre }: { surtitre: string; titre: string }) {
  return (
    <>
      <HeroCourt
        surtitre={surtitre}
        titre={titre}
        chapeau="Cette rubrique n’est pas encore publiée : nous préférons ne rien afficher plutôt qu’un récit que nous ne pourrions pas vérifier. Les prix, le site d’hébergement et l’état des services, eux, sont lus en direct sur la plateforme."
      />
      <SiteSection>
        <Container className="flex flex-wrap gap-3">
          <ButtonLink href="/datacenters">Voir le site d’hébergement</ButtonLink>
          <ButtonLink href="/statut" variant="secondary">
            État des services
          </ButtonLink>
          <ButtonLink href="/entreprises#contact" variant="secondary">
            Contacter l’équipe commerciale
          </ButtonLink>
        </Container>
      </SiteSection>
    </>
  )
}
