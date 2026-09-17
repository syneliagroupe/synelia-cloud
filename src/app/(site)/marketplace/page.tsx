'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIE_LABEL, type CategorieService } from '@/lib/types'
import { CATALOGUE, CONTRAT_INTEGRATION } from '@/lib/mock'
import { usePublic } from '@/lib/api/public'
import { fusionnerCatalogue, type FicheCataloguePublique } from '@/lib/api/vitrine'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { SearchInput, SegmentedControl } from '@/components/ui/field'
import { CatalogCard } from '@/components/business/service-card'
import { EmptyState } from '@/components/composition/states'
import {
  AppelFinal,
  Container,
  HeroCourt,
  SectionTitle,
  SiteSection,
} from '@/components/site/blocs'

const CATEGORIES = Object.keys(CATEGORIE_LABEL) as CategorieService[]

export default function MarketplacePublic() {
  const [q, setQ] = useState('')
  const [categorie, setCategorie] = useState<CategorieService | 'toutes'>('toutes')
  const [mode, setMode] = useState<'tous' | 'dedie' | 'mutualise'>('tous')
  // En mode API, le catalogue publié (`GET /public/catalogue/services`)
  // remplace la liste locale ; chaque fiche garde l’habillage local de
  // même `slug` (pictogramme, captures) que le backend ne publie pas.
  const distant = usePublic<{ donnees: FicheCataloguePublique[] }>('/public/catalogue/services')
  const catalogue = useMemo(
    () => fusionnerCatalogue(distant.donnees?.donnees, CATALOGUE) ?? CATALOGUE,
    [distant.donnees],
  )

  const resultats = useMemo(
    () =>
      catalogue.filter((s) => {
        if (categorie !== 'toutes' && s.categorie !== categorie) return false
        if (mode !== 'tous' && !s.modes.includes(mode)) return false
        if (!q.trim()) return true
        const n = q.trim().toLowerCase()
        return (
          s.nom.toLowerCase().includes(n) ||
          s.solutionOSS.toLowerCase().includes(n) ||
          s.pitch.toLowerCase().includes(n)
        )
      }),
    [catalogue, q, categorie, mode],
  )

  return (
    <>
      <HeroCourt
        surtitre="Marketplace"
        titre={
          <>
            Des logiciels libres,
            <br />
            <span className="text-m-600">opérés comme un service.</span>
          </>
        }
        chapeau="Vous pourriez installer chacune de ces solutions vous-même. Ce que nous vendons, c’est l’exploitation : provisioning, dimensionnement à chaud, fédération d’identité, sauvegarde immuable avec restauration testée, supervision avec engagement, montées de version qualifiées, et réversibilité documentée."
        enfants={
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { v: `${catalogue.length}`, l: 'solutions au catalogue' },
              { v: `${catalogue.filter((c) => c.certifie).length}`, l: 'certifiées Synelia' },
              { v: '2', l: 'sites en Côte d’Ivoire' },
            ].map((x) => (
              <div key={x.l} className="rounded-[14px] border border-encre-2/10 bg-creme px-4 py-3">
                <p className="tnum text-[22px] font-black leading-none [font-family:var(--font-display)] text-p-600">
                  {x.v}
                </p>
                <p className="mt-1.5 text-[11.5px] text-encre-2/65">{x.l}</p>
              </div>
            ))}
          </div>
        }
      />

      <SiteSection fond="clair">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                placeholder="Rechercher un service ou une solution…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full sm:w-72"
              />
              <SegmentedControl
                size="sm"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'tous', label: 'Tous' },
                  { value: 'dedie', label: 'Dédié' },
                  { value: 'mutualise', label: 'Mutualisé' },
                ]}
              />
            </div>
            <p className="tnum text-[12.5px] text-g-500">
              {resultats.length} service{resultats.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategorie('toutes')}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                categorie === 'toutes'
                  ? 'border-p-700 bg-p-700 text-white'
                  : 'border-g-300 bg-white text-g-700 hover:border-p-400',
              )}
            >
              Toutes les catégories
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategorie(c)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                  categorie === c
                    ? 'border-p-700 bg-p-700 text-white'
                    : 'border-g-300 bg-white text-g-700 hover:border-p-400',
                )}
              >
                {CATEGORIE_LABEL[c]}
                <span className="ml-1.5 text-[10px] opacity-70">
                  {catalogue.filter((s) => s.categorie === c).length}
                </span>
              </button>
            ))}
          </div>

          {resultats.length === 0 ? (
            <EmptyState
              className="mt-8"
              titre="Aucun service ne correspond"
              phrase="Élargissez les critères, ou dites-nous quelle solution open source vous aimeriez voir opérée par Synelia. Nous instruisons chaque demande, et notre catalogue s’étend à la demande du marché."
              action={{ libelle: 'Proposer une solution', href: '/entreprises#contact' }}
            />
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {resultats.map((s) => (
                <CatalogCard key={s.slug} service={s} href={`/marketplace/${s.slug}`} />
              ))}
            </div>
          )}
        </Container>
      </SiteSection>

      <SiteSection>
        <Container>
          <SectionTitle
            surtitre="Contrat d’intégration"
            titre="Neuf capacités, livrées avec chaque service"
            chapeau="Cette liste est le contrat. L’écran d’administration d’un service dans votre espace client en est la matérialisation exacte, capacité par capacité — c’est ce qui rend le catalogue extensible sans nouveau développement d’interface."
          />
          <ol className="mt-9 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTRAT_INTEGRATION.map((c) => (
              <li key={c.num} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-p-700 text-[11px] font-bold text-white">
                  {c.num}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold leading-snug text-ink">{c.capacite}</p>
                  <p className="mt-0.5 text-[11.5px] text-g-500">{c.ecran}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </SiteSection>

      <SiteSection fond="clair">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <MicroLabel className="text-m-600">Notre ligne de conduite</MicroLabel>
              <h2 className="mt-3 text-[24px] font-bold leading-tight [font-family:var(--font-display)] text-ink sm:text-[30px]">
                Nous ne réimplémentons pas ces produits.
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-g-700">
                Beaucoup de plateformes reconstruisent un explorateur de fichiers approximatif, un
                webmail au rabais, un écran de facturation incomplet. Nous refusons ce chemin. Si un
                écran ressemble à l’écran principal d’un produit existant, nous ne le construisons
                pas : nous construisons la carte qui y mène.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-g-700">
                Concrètement, un bouton{' '}
                <span className="font-semibold text-m-600">Ouvrir</span> vous redirige en SSO vers
                l’interface d’origine de la solution. Vous bénéficiez de son écosystème complet, de
                ses applications mobiles, de ses extensions et de sa documentation. Le portail garde
                ce qu’il fait mieux : le provisioning, les quotas, les sièges, la sauvegarde, la
                supervision et la facture.
              </p>
            </div>
            <div className="space-y-3">
              {[
                {
                  cat: 'Drive / GED',
                  fait: 'provisionner, quotas, sièges, politique de partage, sauvegarde',
                  pas: 'aucun explorateur de fichiers, aucun éditeur de documents',
                },
                {
                  cat: 'Messagerie',
                  fait: 'boîtes, alias, groupes, quotas, anti-spam, SPF/DKIM/DMARC, archivage',
                  pas: 'aucun webmail, aucun compositeur de message',
                },
                {
                  cat: 'ERP / CRM',
                  fait: 'provisionner, modules activés, utilisateurs, jeu de démo, sauvegarde',
                  pas: 'aucun écran métier, aucune facture client, aucun pipeline commercial',
                },
                {
                  cat: 'Observabilité',
                  fait: 'petits tableaux de bord en lecture seule et lien « Ouvrir dans Grafana »',
                  pas: 'aucun explorateur de logs, aucun constructeur de requêtes',
                },
              ].map((x) => (
                <div key={x.cat} className="rounded-[10px] border border-g-300 bg-white p-4">
                  <p className="text-[13px] font-bold text-ink">{x.cat}</p>
                  <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-snug text-g-700">
                    <Check size={13} className="mt-0.5 shrink-0 text-ok" />
                    Le portail : {x.fait}
                  </p>
                  <p className="mt-1.5 flex items-start gap-2 text-[12.5px] leading-snug text-g-500">
                    <span className="mt-0.5 shrink-0 font-bold text-g-500">—</span>
                    Le portail ne fait pas : {x.pas}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Essayez le catalogue depuis votre espace client"
        chapeau="Créez un compte pour explorer l’assistant de souscription en six étapes, le suivi de provisioning et l’écran d’administration d’un service — avec des données de démonstration."
        primaire={{ libelle: 'Créer un compte', href: '/signup' }}
        secondaire={{ libelle: 'Voir les tarifs par siège', href: '/tarifs' }}
      />
    </>
  )
}
