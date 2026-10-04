'use client'

import { useMemo, useState } from 'react'
import { BookOpen, ExternalLink, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARTICLES_KB, SECTIONS_DOCS } from '@/lib/mock'
import { SITES, SITE_LABEL } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { CodeBlock, Tabs } from '@/components/ui/display'
import { SearchInput, Select } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { NavCard } from '@/components/composition/card'

const ONGLETS = [
  { id: 'guides', label: 'Guides' },
  { id: 'api', label: 'API REST' },
  { id: 'reference', label: 'Références' },
]

const RESSOURCES_API = [
  {
    groupe: 'Espaces Cloud',
    routes: [
      { m: 'GET', r: '/v1/espaces', d: 'Lister les espaces de l’organisation' },
      { m: 'POST', r: '/v1/espaces', d: 'Créer un espace — opération asynchrone, suivie par un travail' },
      { m: 'GET', r: '/v1/espaces/{espaceId}', d: 'Détail d’un espace, quota et usage' },
      { m: 'PUT', r: '/v1/espaces/{espaceId}/quota', d: 'Modifier le quota — rôle infra_admin requis' },
    ],
  },
  {
    groupe: 'Machines virtuelles',
    routes: [
      { m: 'GET', r: '/v1/vms', d: 'Lister les machines de l’organisation' },
      { m: 'POST', r: '/v1/vms', d: 'Créer une machine — espaceId dans le corps, opération asynchrone' },
      { m: 'POST', r: '/v1/vms/{vmId}/demarrage', d: 'Démarrer — de même /arret et /redemarrage' },
      { m: 'PUT', r: '/v1/vms/{vmId}/materiel', d: 'Modifier processeur, mémoire, disque' },
      { m: 'DELETE', r: '/v1/vms/{vmId}', d: 'Supprimer — exige le paramètre confirmation=<nom exact>' },
    ],
  },
  {
    groupe: 'Applications',
    routes: [
      { m: 'GET', r: '/v1/projets', d: 'Lister les projets applicatifs' },
      { m: 'POST', r: '/v1/deploiements', d: 'Déclencher un déploiement' },
      { m: 'POST', r: '/v1/deploiements/{deploiementId}/rollback', d: 'Retour arrière vers l’artefact précédent' },
      { m: 'GET', r: '/v1/deploiements/{deploiementId}/journaux', d: 'Journaux de build et d’exécution' },
    ],
  },
  {
    groupe: 'Sauvegarde & reprise',
    routes: [
      { m: 'GET', r: '/v1/sauvegarde/plans', d: 'Lister les plans de sauvegarde' },
      { m: 'GET', r: '/v1/sauvegarde/points', d: 'Points de restauration disponibles' },
      { m: 'POST', r: '/v1/sauvegarde/restaurations', d: 'Lancer une restauration' },
      { m: 'GET', r: '/v1/sauvegarde/conformite', d: 'Rapport de conformité 3-2-1' },
    ],
  },
  {
    groupe: 'Facturation',
    routes: [
      { m: 'GET', r: '/v1/facturation/factures', d: 'Lister les factures' },
      { m: 'GET', r: '/v1/facturation/factures/{factureId}', d: 'Détail d’une facture, lignes incluses' },
      { m: 'GET', r: '/v1/facturation/consommation', d: 'Consommation par jour, ventilée par étiquette' },
      { m: 'GET', r: '/v1/facturation/souscriptions', d: 'Souscriptions actives' },
    ],
  },
  {
    groupe: 'Audit & conformité',
    routes: [
      { m: 'GET', r: '/v1/audit', d: 'Journal d’audit de l’organisation' },
      { m: 'POST', r: '/v1/audit/export', d: 'Générer un export signé' },
      { m: 'GET', r: '/v1/audit/integrite', d: 'Vérifier la chaîne d’empreintes du journal' },
    ],
  },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'https://api.cloud.dev01.ovh.smile.ci/v1'

const TON_METHODE: Record<string, string> = {
  GET: 'bg-info-bg text-info',
  POST: 'bg-ok-bg text-ok',
  PATCH: 'bg-warn-bg text-warn',
  PUT: 'bg-warn-bg text-warn',
  DELETE: 'bg-err-bg text-err',
}

export default function Docs() {
  const [onglet, setOnglet] = useState('guides')
  const [q, setQ] = useState('')
  const [theme, setTheme] = useState('tous')

  const themes = ['tous', ...new Set(ARTICLES_KB.map((a) => a.theme))]

  const articles = useMemo(() => {
    let out = ARTICLES_KB
    if (theme !== 'tous') out = out.filter((a) => a.theme === theme)
    if (q.trim()) {
      const n = q.trim().toLowerCase()
      out = out.filter(
        (a) =>
          a.titre.toLowerCase().includes(n) ||
          a.extrait.toLowerCase().includes(n) ||
          a.theme.toLowerCase().includes(n),
      )
    }
    return out
  }, [q, theme])

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Documentation' }]}
        titre="Documentation"
        sousTitre="Guides pratiques et référence de l’API REST. Ce que la plateforme ne fait pas y est documenté aussi."
        actions={
          <ButtonLink variant="secondary" href="/docs" external iconAfter={<ExternalLink size={13} />}>
            Documentation publique
          </ButtonLink>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans la documentation…"
            className="min-w-[240px] flex-1"
          />
          <Select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-auto">
            {themes.map((t) => (
              <option key={t} value={t}>
                {t === 'tous' ? 'Tous les thèmes' : t}
              </option>
            ))}
          </Select>
        </div>
        {q.trim().length > 0 && (
          <p className="mt-2.5 text-[12px] text-g-500">
            {articles.length} résultat{articles.length > 1 ? 's' : ''} pour «&nbsp;{q}&nbsp;»
          </p>
        )}
      </Card>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'guides' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS_DOCS.map((s) => (
              <NavCard
                key={s.titre}
                titre={s.titre}
                description={s.articles.slice(0, 3).join(' · ')}
                href="/docs"
                meta={`${s.articles.length} articles`}
              />
            ))}
          </div>

          <Card>
            <CardHeader
              titre="Guides pratiques"
              sousTitre="Des procédures complètes, testées, avec les écrans réels et les pièges connus."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col rounded-[8px] border border-g-300 p-3.5 transition-colors hover:border-p-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <BookOpen size={14} className="shrink-0 text-p-700" />
                    <Badge tone="neutral" size="sm">
                      {a.duree}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[13px] font-bold leading-snug text-ink">{a.titre}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-g-700">{a.extrait}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <Badge tone="violet" size="sm">
                      {a.theme}
                    </Badge>
                    <ButtonLink size="sm" variant="ghost" href="/docs">
                      Lire
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
            {articles.length === 0 && (
              <div className="rounded-[8px] border border-dashed border-g-300 px-4 py-10 text-center">
                <Search size={18} className="mx-auto text-g-300" />
                <p className="mt-2 text-[13px] text-g-500">
                  Aucun guide ne correspond à cette recherche. Ouvrez un ticket : si la question
                  revient, elle devient un article.
                </p>
              </div>
            )}
          </Card>

          <Callout ton="violet" titre="Ce que la plateforme ne fait pas">
            Nous documentons aussi les limites. Pas de base de données à écriture multi-région, pas
            d’exécution sans serveur à facturation à la milliseconde, pas de service d’apprentissage
            automatique managé, pas de conteneurs Windows. Ce n’est pas une liste de fonctionnalités à
            venir : c’est ce sur quoi nous avons choisi de ne pas nous engager, pour tenir ce que nous
            promettons ailleurs.
          </Callout>
        </div>
      )}

      {onglet === 'api' && (
        <div className="space-y-4">
          <Callout ton="info" titre="Contrat OpenAPI">
            Le schéma machine-readable est versionné avec le backend (
            <code className="font-mono text-[11px]">docs/api/openapi.json</code> dans le dépôt
            portail). En lab, la même spec est servie par l’API à{' '}
            <code className="font-mono text-[11px]">/openapi.json</code> (racine du service FastAPI).
            <span className="mt-2 block">
              <ButtonLink
                variant="secondary"
                size="sm"
                href={
                  process.env.NEXT_PUBLIC_API_URL
                    ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/v1\/?$/, '')}/openapi.json`
                    : 'https://api.cloud.dev01.ovh.smile.ci/openapi.json'
                }
                external
                iconAfter={<ExternalLink size={13} />}
              >
                Télécharger openapi.json
              </ButtonLink>
            </span>
          </Callout>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader titre="Principes" sousTitre="Aucune surprise pour qui a déjà consommé une API REST." />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Adresse', valeur: API_BASE },
                  { cle: 'Authentification', valeur: 'En-tête Authorization: Bearer <jeton>' },
                  { cle: 'Format', valeur: 'JSON en entrée comme en sortie, UTF-8' },
                  { cle: 'Horodatages', valeur: 'ISO 8601, en temps universel' },
                  { cle: 'Montants', valeur: 'Entiers, en plus petite unité de la devise' },
                  { cle: 'Pagination', valeur: 'Paramètres page et parPage — réponse { donnees, pagination }' },
                  { cle: 'Versionnement', valeur: 'Dans le chemin (/v1)' },
                ]}
              />
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                titre="Lister des ressources"
                sousTitre="Chaque liste renvoie ses éléments dans donnees et le total dans pagination."
              />
              <CodeBlock
                langue="bash"
                code={`curl -sS "${API_BASE}/vms?page=1&parPage=50" \\
  -H "Authorization: Bearer $SYNELIA_TOKEN" \\
  -H "X-Organisation-Id: <identifiant de l’organisation>"`}
              />
              <MicroLabel className="mt-3 mb-1.5">Réponse</MicroLabel>
              <CodeBlock
                langue="json"
                code={`{
  "donnees": [ { "id": "…", "nom": "prod-api-01", "statut": "running" } ],
  "pagination": { "page": 1, "parPage": 50, "total": 1, "totalPages": 1 }
}`}
              />
              <Callout ton="info" className="mt-3.5" titre="Les créations sont asynchrones">
                Une création renvoie 202 et un travail : suivez-le sur{' '}
                <span className="font-mono text-[12px]">/v1/travaux/{'{id}'}</span> ou dans le centre
                de tâches du portail.
              </Callout>
            </Card>
          </div>

          {RESSOURCES_API.map((g) => (
            <Card key={g.groupe} padding={false}>
              <div className="border-b border-g-100 px-4 py-3">
                <p className="text-[13px] font-bold text-ink">{g.groupe}</p>
              </div>
              <div className="divide-y divide-g-100">
                {g.routes.map((r) => (
                  <div
                    key={`${r.m}-${r.r}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                  >
                    <span
                      className={cn(
                        'w-16 shrink-0 rounded-[4px] px-1.5 py-0.5 text-center font-mono text-[11px] font-bold',
                        TON_METHODE[r.m],
                      )}
                    >
                      {r.m}
                    </span>
                    <span className="min-w-0 flex-1 font-mono text-[12px] text-ink">{r.r}</span>
                    <span className="text-[12px] text-g-500">{r.d}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card>
            <CardHeader
              titre="Codes de réponse"
              sousTitre="Un message d’erreur porte toujours un identifiant de corrélation, à citer dans un ticket."
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { c: '200', d: 'Requête traitée' },
                { c: '201', d: 'Ressource créée — l’en-tête Location porte son adresse' },
                { c: '202', d: 'Opération acceptée et asynchrone — suivez la tâche renvoyée' },
                { c: '400', d: 'Requête mal formée — le détail nomme le champ fautif' },
                { c: '401', d: 'Jeton absent, expiré ou révoqué' },
                { c: '403', d: 'Rôle insuffisant — la réponse nomme le rôle requis' },
                { c: '404', d: 'Ressource inexistante, ou hors de la portée de votre jeton' },
                { c: '409', d: 'Conflit — la ressource a changé depuis votre lecture' },
                { c: '422', d: 'Refusé par une règle métier — quota dépassé, nom en doublon' },
                { c: '429', d: 'Limite d’appel atteinte — l’en-tête Retry-After indique le délai' },
                { c: '500', d: 'Erreur de notre côté — l’identifiant de corrélation nous suffit' },
                { c: '503', d: 'Maintenance ou mode dégradé — la réponse précise lequel' },
              ].map((x) => (
                <div key={x.c} className="flex items-baseline gap-2.5">
                  <span className="w-10 shrink-0 font-mono text-[12px] font-bold text-p-700">
                    {x.c}
                  </span>
                  <span className="text-[12px] leading-relaxed text-g-700">{x.d}</span>
                </div>
              ))}
            </div>
            <MicroLabel className="mt-4 mb-1.5">Forme d’une erreur</MicroLabel>
            <CodeBlock
              langue="json"
              code={`{
  "erreur": {
    "code": "quota_depasse",
    "message": "La création demanderait 68 vCPU sur un quota de 64.",
    "correlationId": "01a0fe23-269f-75c1-8a9d-fe37fd8299a8"
  }
}`}
            />
          </Card>
        </div>
      )}

      {onglet === 'reference' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader titre="Gabarits de machines" sousTitre="Rapport processeur / mémoire par famille." />
              <div className="overflow-x-auto rounded-[8px] border border-g-300">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Gabarit', 'vCPU', 'Mémoire', 'Usage typique'].map((h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { g: 'c2.small', v: 2, r: '4 Go', u: 'Service léger, tâche périodique' },
                      { g: 'c2.medium', v: 4, r: '8 Go', u: 'Application web, API' },
                      { g: 'c2.large', v: 8, r: '16 Go', u: 'Application à charge soutenue' },
                      { g: 'm2.medium', v: 4, r: '32 Go', u: 'Base de données, cache' },
                      { g: 'm2.large', v: 8, r: '64 Go', u: 'Base volumineuse, analytique' },
                    ].map((x) => (
                      <tr key={x.g} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-[12px] font-semibold text-ink">
                          {x.g}
                        </td>
                        <td className="tnum px-3 py-2 text-[12px] text-g-700">{x.v}</td>
                        <td className="tnum px-3 py-2 text-[12px] text-g-700">{x.r}</td>
                        <td className="px-3 py-2 text-[12px] text-g-500">{x.u}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader titre="Limites de la plateforme" sousTitre="Ce qui est possible, et où ça s’arrête." />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'vCPU par machine', valeur: '64 maximum' },
                  { cle: 'Mémoire par machine', valeur: '512 Go maximum' },
                  { cle: 'Volume de bloc', valeur: '16 To par volume, 24 volumes par machine' },
                  { cle: 'Objet dans un compartiment', valeur: '5 To par objet, aucune limite de nombre' },
                  { cle: 'Nœuds par cluster Kubernetes', valeur: '64' },
                  { cle: 'Adresses IP publiques', valeur: '32 par espace, extensible sur demande' },
                  { cle: 'Enregistrements par zone DNS', valeur: '10 000' },
                  { cle: 'Rétention de sauvegarde', valeur: '3 650 jours' },
                  { cle: 'Membres par organisation', valeur: 'Aucune limite' },
                  { cle: 'Espaces Cloud par organisation', valeur: 'Aucune limite' },
                ]}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Site physique"
              sousTitre="Le site apparaît sur chaque ressource du portail et dans chaque réponse de l’API."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SITES.map((code) => (
                <div key={code} className="rounded-[8px] border border-g-300 p-3.5">
                  <div className="flex items-center gap-2">
                    <Badge tone="violet" size="sm">
                      {code}
                    </Badge>
                    <span className="text-[13px] font-bold text-ink">{SITE_LABEL[code]}</span>
                  </div>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="Une seule région pour l’instant">
              Les ressources, leurs sauvegardes et les journaux de la plateforme restent sur le site
              d’Abidjan. Une copie ailleurs est de votre ressort : exportez vos données si vous en avez
              besoin.
            </Callout>
          </Card>
        </div>
      )}
    </div>
  )
}
