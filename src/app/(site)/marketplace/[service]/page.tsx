import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowRight, Check, FileDown, MonitorPlay, Repeat, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money } from '@/lib/format'
import { CATEGORIE_LABEL } from '@/lib/types'
import { CATALOGUE, CONTRAT_INTEGRATION } from '@/lib/mock'
import { lirePublicServeur } from '@/lib/api/public-serveur'
import { fusionnerFicheCatalogue, type FicheCataloguePublique } from '@/lib/api/vitrine'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { SolutionLogo } from '@/components/ui/display'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { AppelFinal, Container, SiteSection } from '@/components/site/blocs'

/**
 * La fiche publiée (`GET /public/catalogue/services/{slug}`) quand l’API
 * est active, complétée par la fiche locale de même `slug` ; la fiche
 * locale seule sinon, ou si le backend ne répond pas.
 */
async function ficheDe(slug: string) {
  const locale = CATALOGUE.find((c) => c.slug === slug)
  const distante = await lirePublicServeur<FicheCataloguePublique>(
    `/public/catalogue/services/${encodeURIComponent(slug)}`,
  )
  return distante ? fusionnerFicheCatalogue(distante, locale) : locale
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>
}): Promise<Metadata> {
  const { service } = await params
  const s = await ficheDe(service)
  return {
    title: s ? `${s.nom} — ${s.solutionOSS} opéré par Synelia` : 'Service introuvable',
    description: s?.description,
  }
}

const PRECISIONS: Record<number, (nom: string, oss: string) => string> = {
  1: (_n, oss) =>
    `Instance ${oss} isolée en mode dédié, ou compte sur instance partagée en mode mutualisé. Vous choisissez le site — Abidjan ou Grand-Bassam — à la souscription.`,
  2: () =>
    'Palier, sièges et quotas modifiables à chaud, sans interruption de service, avec application immédiate du prorata journalier.',
  3: () =>
    'Sous-domaine Synelia fourni par défaut, ou votre propre domaine avec vérification DNS guidée et certificat renouvelé automatiquement.',
  4: (_n, oss) =>
    `Client OIDC déclaré dans Keycloak, provisioning des comptes à la première connexion, et mapping de vos groupes d’annuaire vers les rôles applicatifs de ${oss}.`,
  5: () =>
    'Attribution et retrait de sièges depuis le portail, avec la vue « qui consomme quoi » et le coût par siège.',
  6: (n) =>
    `Plan de sauvegarde appliqué dès le provisioning, restauration granulaire adaptée à ${n}, et test de restauration périodique dont le résultat est daté.`,
  7: () =>
    'Sondes de supervision posées automatiquement, disponibilité mesurée par nos sondes et comparée à l’engagement contractuel du service.',
  8: (_n, oss) =>
    `Versions ${oss} qualifiées avant déploiement, fenêtre de maintenance annoncée, changelog consultable et retour arrière disponible sept jours.`,
  9: () =>
    'Export dans un format standard, documenté et testé. Nous vérifions la réversibilité comme nous vérifions les restaurations.',
}

export default async function FicheServicePublique({
  params,
}: {
  params: Promise<{ service: string }>
}) {
  const { service: slug } = await params
  const s = await ficheDe(slug)
  if (!s) notFound()

  const prixEntree = s.paliers.reduce<{ valeur: number; unite: string } | null>((acc, p) => {
    const v = p.prixSiege ?? p.prixMois
    if (v === undefined) return acc
    const unite = p.prixSiege !== undefined ? '/siège/mois' : '/mois'
    if (!acc || v < acc.valeur) return { valeur: v, unite }
    return acc
  }, null)

  return (
    <>
      {/* Bloc 1 — en-tête */}
      <section className="border-b border-encre-2/10 bg-creme-2">
        <Container className="py-12 sm:py-14">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-3">
                <SolutionLogo initiales={s.logoInitiales} teinte={s.logoTeinte} icone={s.icone} size="lg" />
                <div>
                  <MicroLabel className="text-m-600">{CATEGORIE_LABEL[s.categorie]}</MicroLabel>
                  <h1 className="mt-1 text-[32px] font-black leading-none [font-family:var(--font-display)] text-encre-2 sm:text-[40px]">
                    {s.nom}
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-[15px] font-bold text-m-600">{s.pitch}</p>
              <p className="mt-2.5 text-[14px] leading-relaxed text-encre-2/70">{s.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Badge tone={s.certifie ? 'ok' : 'neutral'}>
                  {s.certifie ? 'Certifié Synelia' : 'Communauté'}
                </Badge>
                <Badge tone="violet">{s.solutionOSS}</Badge>
                {s.modes.map((m) => (
                  <Badge key={m} tone="neutral" size="sm">
                    {m === 'dedie' ? 'Dédié' : 'Mutualisé'}
                  </Badge>
                ))}
                <span className="text-[12px] text-encre-2/65">SLA {s.sla}</span>
              </div>
            </div>

            <div className="w-full max-w-xs rounded-[20px] border border-encre-2/10 bg-creme p-5">
              <MicroLabel className="text-m-600">Prix d’entrée</MicroLabel>
              <p className="tnum mt-2 text-[28px] font-black leading-none [font-family:var(--font-display)] text-p-600">
                {prixEntree ? money(prixEntree.valeur) : 'Sur devis'}
                {prixEntree && (
                  <span className="block text-[12px] font-semibold text-encre-2/60">
                    {prixEntree.unite}
                  </span>
                )}
              </p>
              <ButtonLink
                href="/signup"
                fullWidth
                size="lg"
                variant="primary" className="mt-4"
                iconAfter={<ArrowRight size={15} />}
              >
                Souscrire
              </ButtonLink>
              <p className="mt-2.5 text-[11px] leading-relaxed text-encre-2/60">
                Vous serez invité à créer un compte, puis l’assistant de souscription en six étapes
                vous guidera : palier, mode et site, sièges, domaine, SSO et sauvegarde.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Bloc 2 — ce que vous obtenez */}
      <SiteSection>
        <Container>
          <h2 className="type-h2">Ce que vous obtenez</h2>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-g-700">
            L’interface de {s.solutionOSS}, telle que ses auteurs l’ont conçue — avec son écosystème,
            ses applications mobiles et sa documentation. Nous n’en réimplémentons aucun écran.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {s.captures.map((c, i) => (
              <figure key={c} className="overflow-hidden rounded-[10px] border border-g-300 bg-g-050">
                <div
                  className="flex h-8 items-center gap-2 border-b border-g-300 px-3"
                  style={{ background: `${s.logoTeinte}14` }}
                >
                  <span className="flex gap-1">
                    {['#E5534B', '#E3B341', '#3FB950'].map((t) => (
                      <span key={t} className="h-2 w-2 rounded-full" style={{ background: t }} />
                    ))}
                  </span>
                  <span className="truncate font-mono text-[11px] text-g-500">
                    {s.urlDemo.replace('https://', '')}
                  </span>
                </div>
                <div className="space-y-2 p-4">
                  <div
                    className="h-2 rounded-full"
                    style={{ background: s.logoTeinte, width: `${52 + i * 14}%` }}
                  />
                  <div className="h-2 w-full rounded-full bg-g-300" />
                  <div className="h-2 w-4/5 rounded-full bg-g-300" />
                  <div className="grid grid-cols-3 gap-1.5 pt-2">
                    {Array.from({ length: 9 }).map((_, k) => (
                      <div key={k} className="h-8 rounded-[4px] bg-white ring-1 ring-g-300" />
                    ))}
                  </div>
                </div>
                <figcaption className="border-t border-g-300 px-3 py-2 text-[12px] font-medium text-g-700">
                  {c}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-[8px] bg-g-050 px-4 py-3">
            <MonitorPlay size={15} className="mt-0.5 shrink-0 text-g-500" />
            <p className="text-[13px] leading-relaxed text-g-700">
              Représentation schématique.{' '}
              <span className="font-semibold">
                Interface de la solution open source, opérée par Synelia.
              </span>{' '}
              Nous préférons le dire clairement : ce que vous utilisez au quotidien, ce n’est pas un
              écran Synelia, c’est {s.solutionOSS}.
            </p>
          </div>
        </Container>
      </SiteSection>

      {/* Bloc 3 — ce que Synelia opère : le bloc qui justifie le prix */}
      <SiteSection fond="clair">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <MicroLabel className="text-m-600">Le cœur de l’offre</MicroLabel>
              <h2 className="mt-2 text-[26px] font-bold leading-tight [font-family:var(--font-display)] text-ink sm:text-[32px]">
                Ce que Synelia opère pour vous
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-g-700">
                Vous pourriez installer {s.solutionOSS} vous-même. Voici précisément ce que vous
                achetez en passant par nous — les neuf capacités du contrat d’intégration, appliquées
                à ce service.
              </p>
            </div>
            <Badge tone="violet">Inclus dans le prix affiché</Badge>
          </div>

          <ol className="mt-8 grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
            {CONTRAT_INTEGRATION.map((c) => (
              <li key={c.num} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-ink">{c.capacite}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-g-700">
                    {PRECISIONS[c.num]?.(s.nom, s.solutionOSS)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <Callout ton="violet" className="mt-8" titre="Le raisonnement, en une phrase">
            Une installation faite soi-même coûte peu en licence et beaucoup en exploitation : c’est
            la sauvegarde jamais testée, la montée de version repoussée, le certificat qui expire un
            samedi. Ce que nous facturons, c’est la disparition de cette charge — avec un engagement
            de service mesuré et des crédits automatiques s’il n’est pas tenu.
          </Callout>
        </Container>
      </SiteSection>

      {/* Bloc 4 — paliers et limites */}
      <SiteSection>
        <Container>
          <h2 className="type-h2">Paliers et limites</h2>
          <p className="mt-2 text-[14px] text-g-700">
            {s.modes.length > 1
              ? 'Le mode dédié majore de 20 % le prix affiché. Prix hors taxes, TVA 18 % à la facturation.'
              : 'Ce service n’existe qu’en mode dédié. Prix hors taxes, TVA 18 % à la facturation.'}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.paliers.map((p) => (
              <div
                key={p.code}
                className={cn(
                  'flex flex-col rounded-[10px] border-2 bg-white p-5',
                  p.recommande ? 'border-p-700 shadow-[0_4px_16px_rgba(43,27,77,.1)]' : 'border-g-300',
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
                <p className="mt-1 text-[12px] text-g-500">{p.specs}</p>
                <p className="tnum mt-4 text-[24px] font-bold leading-none [font-family:var(--font-display)] text-p-700">
                  {money(p.prixSiege ?? p.prixMois ?? 0)}
                  <span className="block text-[11px] font-semibold text-g-500">
                    {p.prixSiege !== undefined ? 'par siège et par mois' : 'par mois'}
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 border-t border-g-100 pt-4">
                  {p.limites.map((l) => (
                    <li key={l} className="flex items-start gap-2 text-[13px] text-g-700">
                      <Check size={13} className="mt-0.5 shrink-0 text-ok" />
                      {l}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href="/signup"
                  variant={p.recommande ? 'primary' : 'secondary'}
                  fullWidth
                  className="mt-4"
                >
                  Souscrire
                </ButtonLink>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-g-500">
            Versions actuellement supportées : {s.versionsSupportees.join(' · ')}. Nous maintenons en
            parallèle plusieurs versions afin de ne jamais vous imposer une montée de version dans
            l’urgence.
          </p>
        </Container>
      </SiteSection>

      {/* Blocs 5 et 6 */}
      <SiteSection fond="clair">
        <Container>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader
                titre={
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={15} className="text-p-700" />
                    Sauvegarde
                  </span>
                }
              />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Politique par défaut', valeur: s.backupPolicyDefault },
                  {
                    cle: 'Granularité de restauration',
                    valeur: (
                      <ul className="space-y-0.5">
                        {s.granulariteRestauration.map((g) => (
                          <li key={g} className="text-[13px]">
                            · {g}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    cle: 'Tests de restauration',
                    valeur:
                      'Échantillon mensuel restauré et vérifié. Le résultat est daté et consultable dans votre espace client.',
                  },
                ]}
              />
            </Card>

            <Card>
              <CardHeader
                titre={
                  <span className="flex items-center gap-2">
                    <Repeat size={15} className="text-p-700" />
                    Réversibilité
                  </span>
                }
              />
              <KeyValueList
                colonnes={1}
                items={[
                  {
                    cle: 'Formats d’export',
                    valeur: (
                      <span className="flex flex-wrap gap-1.5">
                        {s.reversibilite.formats.map((f) => (
                          <Badge key={f} tone="neutral" size="sm">
                            {f}
                          </Badge>
                        ))}
                      </span>
                    ),
                  },
                  {
                    cle: 'Délai de mise à disposition',
                    valeur: `${s.reversibilite.delaiJours} jours ouvrés après la demande`,
                  },
                  {
                    cle: 'Documentation',
                    valeur: (
                      <span className="inline-flex items-center gap-1 font-semibold text-p-700">
                        <FileDown size={12} />
                        Procédure de reprise publiée
                      </span>
                    ),
                  },
                ]}
              />
              <p className="mt-2 text-[12px] leading-relaxed text-g-500">
                Partir doit être possible pour que rester soit un choix.
              </p>
            </Card>

            <Card>
              <CardHeader titre="Migration entrante" sousTitre={s.migrationDelais} />
              <div className="flex flex-wrap gap-1.5">
                {s.migrationEntrante.map((m) => (
                  <Badge key={m} tone="violet" size="sm">
                    {m}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-g-700">
                Menée par l’équipe Synelia à Abidjan : inventaire, pré-synchronisation, bascule sur
                un créneau que vous choisissez, et retour arrière possible pendant quarante-huit
                heures. Le chiffrage fait l’objet d’un devis distinct de l’abonnement.
              </p>
              <ButtonLink
                href="/entreprises#contact"
                variant="secondary"
                size="sm"
                className="mt-3"
              >
                Demander une évaluation de migration
              </ButtonLink>
            </Card>
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre={`Souscrire à ${s.nom}`}
        chapeau="L’assistant vous guide en six étapes : palier, mode et site, sièges, domaine, SSO et sauvegarde, récapitulatif chiffré. Le provisioning prend quelques minutes."
        primaire={{ libelle: 'Créer un compte et souscrire', href: '/signup' }}
        secondaire={{ libelle: 'Voir tout le catalogue', href: '/marketplace' }}
      />
    </>
  )
}
