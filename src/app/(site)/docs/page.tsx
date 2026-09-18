'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowUpRight, FileText, Terminal } from 'lucide-react'
import { SECTIONS_DOCS } from '@/lib/mock'
import { MicroLabel } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/field'
import { CodeBlock } from '@/components/ui/display'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { Container, HeroCourt, SectionTitle, SiteSection } from '@/components/site/blocs'

const EXEMPLES = [
  {
    titre: 'Authentification par clé d’API',
    langue: 'bash',
    code: `# Créez une clé depuis /app/securite → onglet Clés d'API.
# La valeur n'est affichée qu'une seule fois.

export SYNELIA_TOKEN="syn_live_…"

curl -sS https://api.synelia.cloud/v1/me \\
  -H "Authorization: Bearer $SYNELIA_TOKEN" \\
  -H "Accept: application/json"`,
  },
  {
    titre: 'Créer un Espace Cloud',
    langue: 'bash',
    code: `curl -sS -X POST https://api.synelia.cloud/v1/espaces \\
  -H "Authorization: Bearer $SYNELIA_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "EC-DBA-04",
    "offerId": "off-souverain",
    "site": "ABJ",
    "cidr": "10.6.0.0/22",
    "options": {
      "backupPlanId": "bp-prod-quotidien",
      "supervision": true
    }
  }'

# Réponse : 202 Accepted + identifiant de job.
# Suivez l'avancement sur /v1/jobs/{id} ou dans le centre de tâches.`,
  },
  {
    titre: 'Provisionner avec Terraform',
    langue: 'hcl',
    code: `terraform {
  required_providers {
    synelia = {
      source  = "synelia/synelia"
      version = "~> 1.4"
    }
  }
}

provider "synelia" {
  # SYNELIA_TOKEN lu depuis l'environnement
  region = "ABJ"
}

resource "synelia_espace_cloud" "prod" {
  code     = "EC-DBA-04"
  offer_id = "off-souverain"
  site     = "ABJ"
  cidr     = "10.6.0.0/22"
}

resource "synelia_vm" "web" {
  count     = 2
  espace_id = synelia_espace_cloud.prod.id
  nom       = "web-prod-\${count.index + 1}"
  image     = "ubuntu-24.04-lts"
  flavor    = "c2.medium"

  reseau {
    nom       = "prod-front"
    ip_public = count.index == 0
  }

  backup_plan_id = "bp-prod-quotidien"
  tags           = ["production", "web"]
}`,
  },
]

export default function Docs() {
  const [q, setQ] = useState('')

  const resultats = useMemo(() => {
    if (!q.trim()) return SECTIONS_DOCS
    const n = q.trim().toLowerCase()
    return SECTIONS_DOCS.map((s) => ({
      ...s,
      articles: s.articles.filter((a) => a.toLowerCase().includes(n)),
    })).filter((s) => s.articles.length > 0 || s.titre.toLowerCase().includes(n))
  }, [q])

  const total = resultats.reduce((a, s) => a + s.articles.length, 0)

  return (
    <>
      <HeroCourt
        surtitre="Documentation"
        titre="Documentation technique et utilisateur, en français"
        chapeau="Pas de traduction automatique, pas de renvoi vers une base de connaissances anglophone. La documentation est rédigée en français par les équipes qui exploitent la plateforme, et versionnée avec elle."
      />

      <SiteSection>
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              placeholder="Rechercher dans la documentation…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:w-80"
            />
            <p className="tnum text-[13px] text-g-500">
              {total} article{total > 1 ? 's' : ''}
              {q.trim() && ' correspondant à votre recherche'}
            </p>
          </div>

          {total === 0 ? (
            <EmptyState
              className="mt-8"
              titre="Aucun article ne correspond"
              phrase="Reformulez votre recherche, ou ouvrez un ticket : nous complétons la documentation à partir des questions qui nous sont posées."
              action={{ libelle: 'Ouvrir un ticket', href: '/entreprises#contact' }}
            />
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {resultats.map((s) => (
                <Card key={s.titre}>
                  <CardHeader
                    titre={s.titre}
                    sousTitre={`${s.articles.length} article${s.articles.length > 1 ? 's' : ''}`}
                  />
                  <ul className="space-y-1.5">
                    {s.articles.map((a) => (
                      <li key={a}>
                        {/* Pas de page d’article pour l’instant : le titre est
                            affiché comme texte, jamais comme un lien mort. */}
                        <span className="flex items-start gap-2 text-[13px] leading-snug text-g-700">
                          <FileText size={13} className="mt-0.5 shrink-0 text-g-300" />
                          {a}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </Container>
      </SiteSection>

      <SiteSection fond="clair">
        <Container>
          <SectionTitle
            surtitre="Démarrage rapide"
            titre="Provisionner par API ou par Terraform"
            chapeau="Tout ce que fait le portail est disponible par API. Les clés d’API ont une portée limitée et une valeur affichée une seule fois à la création."
          />
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {EXEMPLES.map((e) => (
              // `min-w-0` : sans lui, la colonne de la grille s'élargit à la
              // ligne de code la plus longue et pousse la page hors de l'écran.
              <div key={e.titre} className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <Terminal size={14} className="text-p-700" />
                  <MicroLabel>{e.titre}</MicroLabel>
                </div>
                <CodeBlock code={e.code} langue={e.langue} />
              </div>
            ))}
          </div>

          <Callout ton="info" className="mt-6" titre="Limites de débit et idempotence">
            L’API accepte 600 requêtes par minute et par clé, 60 pour les opérations de création.
            Toutes les opérations de création acceptent un en-tête{' '}
            <span className="font-mono text-[12px]">Idempotency-Key</span> : rejouer la même
            requête avec la même clé ne crée pas de doublon. Les opérations longues renvoient un{' '}
            <span className="font-mono text-[12px]">202 Accepted</span> avec un identifiant de job
            à suivre.
          </Callout>
        </Container>
      </SiteSection>

      <SiteSection>
        <Container>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Documentation contractuelle et d’exploitation"
                sousTitre="Réservée aux clients sous contrat, depuis leur espace client."
              />
              <ul className="space-y-2">
                {[
                  'Dossier d’architecture technique, versionné et daté',
                  'Dossier d’exploitation : procédures, astreinte, escalade',
                  'Dossier de sécurité : durcissement, gestion des accès, chiffrement',
                  'Plan de réversibilité par service souscrit',
                  'Parcours de formation administrateur et exploitant, avec suivi de complétion',
                  'Accès à un environnement de bac à sable pour la formation',
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2 text-[13px] text-g-700">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-p-600" />
                    {x}
                  </li>
                ))}
              </ul>
              <Link
                href="/app/docs"
                className="mt-4 inline-flex items-center gap-1.5 border-t border-g-100 pt-3.5 text-[13px] font-semibold text-p-700 hover:underline"
              >
                Ouvrir l’espace documentaire client
                <ArrowUpRight size={13} />
              </Link>
            </Card>

            <Card>
              <CardHeader
                titre="Contribuer à la documentation"
                sousTitre="Une imprécision, une procédure obsolète, un exemple qui ne fonctionne pas ?"
              />
              <p className="text-[13px] leading-relaxed text-g-700">
                Signalez-le depuis n’importe quelle page de documentation, ou par ticket. Nous
                traitons les corrections de documentation en gravité mineure, avec un délai de
                première réponse de quatre heures ouvrées — et nous créditons les contributions dans
                l’historique de la page.
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-g-700">
                Les procédures d’exploitation les plus consultées font l’objet d’une revue
                trimestrielle systématique, indépendamment des signalements.
              </p>
            </Card>
          </div>
        </Container>
      </SiteSection>
    </>
  )
}
