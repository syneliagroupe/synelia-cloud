import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ArrowDown, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dureeMin, money, pct, slaLibelle } from '@/lib/format'
import { PRIX } from '@/lib/tarifs'
import { FICHES_PRODUIT } from '@/lib/mock'
import { lirePublicServeur } from '@/lib/api/public-serveur'
import {
  CATEGORIES_PAR_FICHE,
  ficheDeCategorie,
  fusionnerFicheProduit,
  paliersDepuisTarifs,
  type FicheProduitPublique,
  type TarifsPublics,
} from '@/lib/api/vitrine'
import { estActif } from '@/lib/api/client'
import { SITES } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { Accordeon, AppelFinal, Container, SiteSection } from '@/components/site/blocs'

/**
 * Fiche locale, enrichie de `GET /public/offres/{slug}` quand l’API est
 * active (nom, accroche, résumé, paliers, FAQ). Une offre connue du seul
 * backend n’a ni schéma ni architecture à montrer : la page reste 404.
 */
interface LigneSla {
  dispo: number
  reponseCritique: number
  resolutionCritique: number
}
const SLA_INFRA = ['espace-cloud', 'machines-virtuelles', 'kubernetes', 'load-balancer', 'stockage-objet', 'cloud-backup', 'reseau-vpn', 'ip-antiddos', 'volumes', 'pra']
const SLA_MANAGES = ['bases-managees', 'hebergement-web', 'wordpress', 'smtp', 'dns']

/** Fiche portée par des offres qui annoncent chacune leur SLA : la fourchette réelle. */
function dispoOffres(tarifs: TarifsPublics | undefined, slug: string): string | undefined {
  const offres = (tarifs?.familles ?? [])
    .filter((f) => CATEGORIES_PAR_FICHE[slug]?.includes(f.code))
    .flatMap((f) => f.offres)
    .filter((o) => o.sla && o.statut !== 'brouillon')
    .sort((a, b) => parseFloat(a.sla!) - parseFloat(b.sla!))
  if (offres.length === 0) return undefined
  const [min, max] = [offres[0], offres[offres.length - 1]]
  return min.sla === max.sla
    ? slaLibelle(min.sla!)
    : `${slaLibelle(min.sla!)} (${min.nom}) à ${slaLibelle(max.sla!)} (${max.nom})`
}

async function ficheDe(slug: string) {
  const locale = FICHES_PRODUIT.find((x) => x.slug === slug)
  if (!locale) {
    // `/offres/espace-pro` : un code d’offre du catalogue (lien de la page
    // Facturation, par exemple) renvoie à la fiche du produit qui la porte.
    const offre = await lirePublicServeur<FicheProduitPublique>(`/public/offres/${encodeURIComponent(slug)}`)
    const produit = offre && ficheDeCategorie(offre.categorie)
    if (produit) redirect(`/offres/${produit}`)
    return undefined
  }
  const distante = await lirePublicServeur<FicheProduitPublique>(
    `/public/offres/${encodeURIComponent(slug)}`,
  )
  const fiche = fusionnerFicheProduit(distante, locale)
  if (!estActif()) return fiche
  const [tarifs, catalogue, sla] = await Promise.all([
    lirePublicServeur<TarifsPublics>('/public/tarifs'),
    slug === 'wordpress'
      ? lirePublicServeur<{ paliers?: Array<{ nom: string; specs: string; prixMois?: number }> }>(
          '/public/catalogue/services/wordpress',
        )
      : undefined,
    lirePublicServeur<LigneSla[]>('/public/sla'),
  ])
  // Produits tarifés à l'unité par la grille de facturation (`PRIX`, miroir du backend), sans offre au catalogue.
  const GRILLE: Record<string, typeof fiche.paliers> = {
    'load-balancer': [{ nom: 'Load balancer', specs: 'L4 ou L7, tarif plat par load balancer', prix: PRIX.lbMois, unite: '/mois' }],
    'ip-antiddos': [{ nom: 'Adresse publique', specs: 'IPv4 · PTR modifiable · anti-DDoS inclus', prix: PRIX.ipPubliqueMois, unite: '/mois' }],
    'stockage-objet': [{ nom: 'Classe chaude', specs: 'Accès fréquent · compatible S3', prix: 1500, unite: '/To/mois' }],
    volumes: fiche.paliers.filter((p) => p.prix !== null && p.unite === '/To/mois'),
  }
  // Les paliers affichés sont ceux du catalogue publié, pas ceux de la maquette ;
  // pour les produits sans offre au catalogue, un prix de la grille ou « sur devis ».
  const paliers =
    paliersDepuisTarifs(tarifs, slug) ??
    GRILLE[slug] ??
    (slug === 'kubernetes'
      ? [
          { nom: 'Plan de contrôle simple', specs: 'Un master géré ; les workers se facturent comme des machines virtuelles', prix: PRIX.k8sControleMois, unite: '/mois' },
          { nom: 'Plan de contrôle haute disponibilité', specs: 'Trois masters ; les workers se facturent comme des machines virtuelles', prix: PRIX.k8sControleHaMois, unite: '/mois', recommande: true },
        ]
      : slug === 'pra' || slug === 'cloud-backup'
        ? [{ nom: 'Sur mesure', specs: slug === 'pra' ? 'Dimensionné après un atelier de cadrage : RPO/RTO, volumétrie, fréquence des exercices' : 'Plan, rétention et volumétrie chiffrés sur devis : la grille publique ne publie pas de tarif de sauvegarde', prix: null, surDevis: true, unite: '' }]
        : slug === 'wordpress' && catalogue?.paliers?.some((p) => p.prixMois)
          ? catalogue.paliers.map((p, i) => ({ nom: p.nom, specs: p.specs, prix: p.prixMois ?? null, surDevis: !p.prixMois, unite: p.prixMois ? '/mois' : '', recommande: i === 0 }))
          : undefined)
  // Engagements de service : ceux de `/public/sla`, les mêmes que l'accueil et l'annexe légale.
  const ligne = sla?.[SLA_MANAGES.includes(slug) ? 1 : 0]
  const engagement =
    ligne && (SLA_INFRA.includes(slug) || SLA_MANAGES.includes(slug))
      ? {
          ...fiche.sla,
          dispo: dispoOffres(tarifs, slug) ?? pct(ligne.dispo, 2),
          reponse: `${dureeMin(ligne.reponseCritique)} en gravité critique`,
          resolution: `${dureeMin(ligne.resolutionCritique)} en gravité critique`,
        }
      : fiche.sla
  return { ...fiche, paliers: paliers ?? fiche.paliers, sla: engagement }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const f = await ficheDe(slug)
  return {
    title: f ? `${f.nom} — ${f.accroche}` : 'Offre introuvable',
    description: f?.resume,
  }
}

export default async function FicheProduit({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const f = await ficheDe(slug)
  if (!f) notFound()

  return (
    <>
      {/* Héros court */}
      {/*
        Même traitement que `HeroCourt` : crème, encre, sans halo flou ni grille.
        Cette page portait son propre héros sombre, ce qui la laissait seule en
        violet une fois les treize autres passées au crème.
      */}
      <section className="border-b border-encre-2/10 bg-creme-2">
        <Container className="py-14 sm:py-16">
          <div className="flex flex-wrap items-center gap-4">
            {f.icone && (
              <img
                src={`/photos/pate-${f.icone}.webp`}
                alt=""
                aria-hidden
                width={320}
                height={320}
                // Fond crème plein sur un héros crème foncé : sans rayon, le
                // rendu se lit comme un carré rapporté.
                className="h-16 w-16 shrink-0 rounded-[12px]"
              />
            )}
            <MicroLabel className="text-m-700">{f.surtitre}</MicroLabel>
          </div>
          <h1 className="mt-3 text-[34px] font-black leading-[1.06] tracking-[-0.02em] [font-family:var(--font-display)] text-encre-2 sm:text-[46px]">
            {f.nom}
          </h1>
          <p className="mt-3 max-w-2xl text-[18px] font-bold leading-snug text-m-600 sm:text-[22px]">
            {f.accroche}
          </p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-encre-2/70">{f.resume}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href="/signup" size="lg" variant="primary">
              Créer un compte
            </ButtonLink>
            <ButtonLink href="/entreprises#contact" size="lg" variant="secondary">
              Demander un devis
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Ce que c'est, en trois puces */}
      <SiteSection className="!py-10">
        <Container>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {f.puces.map((p, i) => (
              <div key={p} className="flex gap-3">
                <span className="tnum mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-p-100 text-[12px] font-bold text-p-700">
                  {i + 1}
                </span>
                <p className="text-[14px] leading-relaxed text-g-700">{p}</p>
              </div>
            ))}
          </div>
        </Container>
      </SiteSection>

      {/* Paliers */}
      <SiteSection fond="clair">
        <Container>
          <h2 className="type-h2">Paliers et tarifs</h2>
          <p className="mt-2 text-[14px] text-g-700">
            Prix mensuels hors taxes, en francs CFA. TVA 18 % appliquée à la facturation. Facturation
            au prorata journalier sur toute création ou suppression en cours de mois.
          </p>
          <div
            className={cn(
              'mt-6 grid gap-4',
              f.paliers.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3',
            )}
          >
            {f.paliers.map((p) => (
              <div
                key={p.nom}
                className={cn(
                  'flex flex-col rounded-[10px] border-2 bg-white p-5',
                  p.recommande
                    ? 'border-p-700 shadow-[0_4px_16px_rgba(43,27,77,.1)]'
                    : 'border-g-300',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="type-h3">{p.nom}</h3>
                  {p.recommande && (
                    <Badge tone="violet" size="sm">
                      Recommandé
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 flex-1 text-[12px] leading-snug text-g-700">{p.specs}</p>
                <p className="tnum mt-4 border-t border-g-100 pt-4 text-[22px] font-bold leading-none [font-family:var(--font-display)] text-p-700">
                  {p.surDevis ? <span className="text-[16px]">Sur devis</span> : money(p.prix ?? 0)}
                  {!p.surDevis && (
                    <span className="block text-[11px] font-semibold text-g-500">{p.unite}</span>
                  )}
                </p>
                <ButtonLink
                  href={p.surDevis ? '/entreprises#contact' : '/signup'}
                  variant={p.recommande ? 'primary' : 'secondary'}
                  fullWidth
                  className="mt-4"
                  size="sm"
                >
                  {p.surDevis ? 'Demander un devis' : 'Souscrire'}
                </ButtonLink>
              </div>
            ))}
          </div>
        </Container>
      </SiteSection>

      {/* Caractéristiques détaillées, en accordéon par thème */}
      <SiteSection>
        <Container>
          <h2 className="type-h2">Caractéristiques détaillées</h2>
          <div className="mt-6 divide-y divide-g-300 overflow-hidden rounded-[10px] border border-g-300 bg-white">
            {f.caracteristiques.map((c, i) => (
              <details key={c.theme} className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-g-050">
                  <span className="flex items-center gap-3">
                    <span className="text-[14px] font-bold [font-family:var(--font-display)] text-ink">
                      {c.theme}
                    </span>
                    <Badge tone="neutral" size="sm">
                      {c.items.length} points
                    </Badge>
                  </span>
                  <ChevronDown
                    size={16}
                    className="shrink-0 text-g-500 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-g-100 bg-g-050 px-4 py-4">
                  <KeyValueList
                    colonnes={2}
                    items={c.items.map((it) => ({ cle: it.libelle, valeur: it.valeur }))}
                  />
                </div>
              </details>
            ))}
          </div>
        </Container>
      </SiteSection>

      {/* SLA */}
      <SiteSection fond="clair">
        <Container>
          <h2 className="type-h2">Niveau de service associé</h2>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-g-700">
            La disponibilité est mesurée par nos sondes avec un pas d’une minute et publiée
            mensuellement dans votre espace client. Les fenêtres de maintenance annoncées au moins
            sept jours à l’avance sont exclues du calcul.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile libelle="Disponibilité engagée" valeur={f.sla.dispo} ton="ok" />
            <StatTile libelle="Première réponse" valeur={f.sla.reponse} />
            <StatTile libelle="Résolution visée" valeur={f.sla.resolution} />
            <StatTile libelle="Crédits" valeur={f.sla.credits} ton="violet" />
          </div>
        </Container>
      </SiteSection>

      {/* Schéma d'architecture typique */}
      <SiteSection>
        <Container>
          <h2 className="type-h2">{f.architecture.titre}</h2>
          <p className="mt-2 text-[14px] text-g-700">
            Configuration que nous déployons le plus souvent sur cette offre. Elle sert de point de
            départ à l’atelier de cadrage, pas de contrainte.
          </p>
          <div className="mt-7 mx-auto max-w-2xl">
            {f.architecture.couches.map((c, i) => (
              <div key={c.nom}>
                <div
                  className={cn(
                    'rounded-[10px] border-2 px-4 py-3.5',
                    i === 0
                      ? 'border-m-600 bg-m-050'
                      : i === f.architecture.couches.length - 1
                        ? 'border-ok bg-ok-bg'
                        : 'border-p-300 bg-p-050',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[13px] font-bold [font-family:var(--font-display)] text-ink">
                      {c.nom}
                    </p>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {c.elements.map((e) => (
                        <span
                          key={e}
                          className="rounded-full border border-g-300 bg-white px-2.5 py-1 text-[12px] font-medium text-g-700"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {i < f.architecture.couches.length - 1 && (
                  <div className="flex justify-center py-1.5">
                    <ArrowDown size={16} className="text-g-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
          {/*
            La pile de couches au-dessus énumère les composants ; le schéma, quand
            il existe, montre les frontières — ce que le client règle, ce que nous
            opérons, et sur quel site partent les copies.
          */}
          {f.schema && (
            <figure className="mt-9 flex justify-center">
              <img
                src={f.schema.src}
                alt={f.schema.alt}
                width={f.schema.largeur}
                height={f.schema.hauteur}
                loading="lazy"
                className="w-full max-w-[760px] rounded-[14px]"
              />
            </figure>
          )}
          <p className="mt-6 text-center text-[12px] text-g-500">
            {SITES.length > 1
              ? 'Chaque ressource affiche son emplacement physique — site ABJ ou GBM — partout dans le portail.'
              : 'Chaque ressource affiche son emplacement physique — site ABJ — partout dans le portail.'}
          </p>
        </Container>
      </SiteSection>

      {/* FAQ */}
      <SiteSection fond="clair">
        <Container taille="md">
          <h2 className="type-h2 text-center">Questions fréquentes sur cette offre</h2>
          <Accordeon items={f.faq} className="mt-6" />
        </Container>
      </SiteSection>

      <AppelFinal
        titre={`Prêt à démarrer avec ${f.nom} ?`}
        chapeau={
          estActif()
            ? 'Créez un compte pour ouvrir l’assistant de création, ou faites chiffrer votre besoin par un architecte.'
            : 'Créez un compte pour explorer l’assistant de création dans un portail peuplé de données de démonstration, ou faites chiffrer votre besoin réel par un architecte.'
        }
        primaire={{ libelle: 'Créer un compte', href: '/signup' }}
        secondaire={{ libelle: 'Demander un devis', href: '/entreprises#contact' }}
      />
    </>
  )
}
