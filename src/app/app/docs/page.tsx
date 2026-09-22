'use client'

import { useMemo, useState } from 'react'
import { BookOpen, ExternalLink, FileCode2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARTICLES_KB, SECTIONS_DOCS } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, CopyField, Tabs } from '@/components/ui/display'
import { SearchInput, Select } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { NavCard } from '@/components/composition/card'

const ONGLETS = [
  { id: 'guides', label: 'Guides' },
  { id: 'api', label: 'API REST' },
  { id: 'cli', label: 'Ligne de commande' },
  { id: 'terraform', label: 'Infrastructure déclarative' },
  { id: 'reference', label: 'Références' },
]

const RESSOURCES_API = [
  {
    groupe: 'Espaces Cloud',
    routes: [
      { m: 'GET', r: '/v1/espaces', d: 'Lister les espaces de l’organisation' },
      { m: 'POST', r: '/v1/espaces', d: 'Créer un espace — renvoie l’aperçu de coût si dry_run=true' },
      { m: 'GET', r: '/v1/espaces/{id}', d: 'Détail d’un espace, quota et usage' },
      { m: 'PATCH', r: '/v1/espaces/{id}/quota', d: 'Modifier le quota — rôle infra_admin requis' },
    ],
  },
  {
    groupe: 'Machines virtuelles',
    routes: [
      { m: 'GET', r: '/v1/vms', d: 'Lister les machines — filtrable par espaceId' },
      { m: 'POST', r: '/v1/vms', d: 'Créer une machine — espaceId dans le corps' },
      { m: 'POST', r: '/v1/vms/{id}/power', d: 'Démarrer, arrêter, redémarrer' },
      { m: 'PATCH', r: '/v1/vms/{id}/hardware', d: 'Modifier processeur, mémoire, disque' },
      { m: 'DELETE', r: '/v1/vms/{id}', d: 'Supprimer — exige le paramètre confirm=<nom exact>' },
    ],
  },
  {
    groupe: 'Applications',
    routes: [
      { m: 'GET', r: '/v1/applications', d: 'Lister les applications' },
      { m: 'POST', r: '/v1/deploiements', d: 'Déclencher un déploiement — envId dans le corps' },
      { m: 'POST', r: '/v1/deploiements/{id}/rollback', d: 'Retour arrière vers l’artefact précédent' },
      { m: 'GET', r: '/v1/deploiements/{id}/journaux', d: 'Journaux de build et d’exécution' },
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
      { m: 'GET', r: '/v1/facturation/factures/{id}', d: 'Détail d’une facture, lignes incluses' },
      { m: 'GET', r: '/v1/facturation/consommation', d: 'Consommation par jour, ventilée par étiquette' },
      { m: 'GET', r: '/v1/facturation/souscriptions', d: 'Souscriptions actives' },
    ],
  },
  {
    groupe: 'Audit & conformité',
    routes: [
      { m: 'GET', r: '/v1/audit', d: 'Journal d’audit — rôle org_admin ou read_only requis' },
      { m: 'POST', r: '/v1/audit/export', d: 'Générer un export signé' },
      { m: 'GET', r: '/v1/audit/integrite', d: 'Vérifier la chaîne d’empreintes du journal' },
    ],
  },
]

const TON_METHODE: Record<string, string> = {
  GET: 'bg-info-bg text-info',
  POST: 'bg-ok-bg text-ok',
  PATCH: 'bg-warn-bg text-warn',
  DELETE: 'bg-err-bg text-err',
}

const COMMANDES = [
  { c: 'synelia auth login', d: 'Ouvre le navigateur pour une authentification via votre annuaire' },
  { c: 'synelia org list', d: 'Liste les organisations auxquelles vous appartenez' },
  { c: 'synelia espace list', d: 'Espaces Cloud de l’organisation active' },
  { c: 'synelia vm create --espace EC-DBA-01 --gabarit c2.medium --dry-run', d: 'Aperçu de coût sans créer' },
  { c: 'synelia vm power start vm-042', d: 'Démarre une machine' },
  { c: 'synelia app deploy app-metier --env production', d: 'Déclenche un déploiement' },
  { c: 'synelia app rollback app-metier --env production', d: 'Repromeut l’artefact précédent' },
  { c: 'synelia backup restore --point rp-8814 --cible nouvelle', d: 'Restaure dans une nouvelle ressource' },
  { c: 'synelia dns export dba.africa', d: 'Exporte la zone au format BIND' },
  { c: 'synelia facture list --periode 2026-08', d: 'Factures d’une période' },
  { c: 'synelia audit export --du 2026-07-01 --au 2026-07-31 --format pdf', d: 'Export d’audit signé' },
]

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
        sousTitre="Guides pratiques, référence de l’API, interface en ligne de commande et fournisseur d’infrastructure déclarative. Ce que la plateforme ne fait pas y est documenté aussi."
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
                  { cle: 'Adresse', valeur: 'https://api.synelia.cloud/v1' },
                  { cle: 'Authentification', valeur: 'En-tête Authorization: Bearer <jeton>' },
                  { cle: 'Format', valeur: 'JSON en entrée comme en sortie, UTF-8' },
                  { cle: 'Horodatages', valeur: 'ISO 8601, en temps universel' },
                  { cle: 'Montants', valeur: 'Entiers, en plus petite unité de la devise' },
                  { cle: 'Pagination', valeur: 'Par curseur — paramètres limit et after' },
                  { cle: 'Idempotence', valeur: 'En-tête Idempotency-Key sur les POST' },
                  { cle: 'Versionnement', valeur: 'Dans le chemin — v1 maintenue 24 mois après v2' },
                ]}
              />
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                titre="Un aperçu de coût avant chaque création"
                sousTitre="Le paramètre dry_run renvoie exactement ce que la ressource coûtera, sans la créer."
              />
              <CodeBlock
                langue="bash"
                code={`curl -sS -X POST https://api.synelia.cloud/v1/espaces/ec-dba-01/vms \\
  -H "Authorization: Bearer $SYNELIA_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nom": "prod-api-04",
    "gabarit": "c2.medium",
    "os": "Debian 12",
    "diskGo": 100,
    "site": "ABJ",
    "etiquettes": { "centre-de-cout": "DSI", "environnement": "production" },
    "dry_run": true
  }'`}
              />
              <MicroLabel className="mt-3 mb-1.5">Réponse</MicroLabel>
              <CodeBlock
                langue="json"
                code={`{
  "dry_run": true,
  "cout": {
    "mensuel_ht": 34000,
    "tva_pct": 18,
    "mensuel_ttc": 40120,
    "prorata_mois_en_cours": 15530,
    "devise": "XOF",
    "detail": [
      { "libelle": "4 vCPU / 8 Go", "montant": 28000 },
      { "libelle": "Disque 100 Go SSD", "montant": 6000 }
    ]
  },
  "placement_prevu": { "backend": "OS-ABJ-01", "site": "ABJ" },
  "quota_apres": { "vcpu": "57/64", "ramGo": "226/256" }
}`}
              />
              <Callout ton="info" className="mt-3.5" titre="À quoi sert dry_run">
                L’appel renvoie le coût de la création sans rien créer : votre pipeline peut refuser
                une ressource qui dépasse un seuil et le signaler dans la revue de code.
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
    "champ": "gabarit",
    "correlation_id": "syn-8f2a91c4-04",
    "remede": "Réduisez le gabarit, ou demandez une augmentation de quota."
  }
}`}
            />
          </Card>
        </div>
      )}

      {onglet === 'cli' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Installation"
                sousTitre="Un seul binaire, sans dépendance. Le code source est publié."
              />
              <MicroLabel className="mb-1.5">Linux et macOS</MicroLabel>
              <CodeBlock
                langue="bash"
                code={`curl -fsSL https://get.synelia.cloud/cli | sh
synelia auth login`}
              />
              <MicroLabel className="mt-3 mb-1.5">Windows</MicroLabel>
              <CodeBlock langue="powershell" code={`winget install Synelia.Cli\nsynelia auth login`} />
              <div className="mt-3 space-y-3">
                <CopyField label="Somme de contrôle du binaire" value="sha256:8f2a91c4d7b0e5443a17c96e2f0d8b4144ba1e9f029e3c8d1a751b74e0aa93c0" />
              </div>
              <Callout ton="info" className="mt-4" titre="L’authentification passe par votre annuaire">
                <span className="inline-flex items-center gap-1.5">
                  <FileCode2 size={13} />
                  <span>
                    <span className="font-mono text-[12px]">synelia auth login</span> ouvre votre
                    navigateur et vous authentifie via la fédération de votre organisation. Aucun mot
                    de passe n’est saisi dans le terminal, et le jeton obtenu expire au bout de huit
                    heures.
                  </span>
                </span>
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Commandes courantes"
                sousTitre="Chaque commande destructive exige --confirm avec le nom exact de la ressource."
              />
              <div className="space-y-1.5">
                {COMMANDES.map((c) => (
                  <div key={c.c} className="rounded-[6px] bg-g-050 px-2.5 py-2">
                    <p className="break-all font-mono text-[11px] text-ink">{c.c}</p>
                    <p className="mt-0.5 text-[11px] text-g-500">{c.d}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Utilisation dans une intégration continue"
              sousTitre="Le jeton vient d’un secret, jamais d’un fichier du dépôt."
            />
            <CodeBlock
              langue="yaml"
              code={`# .gitlab-ci.yml — déploiement en production après validation
deploiement:
  stage: deploy
  image: registry.abj.synelia.cloud/synelia/cli:1
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
  script:
    # Le jeton est un secret masqué du projet, porté par un rôle app_admin
    - synelia auth token "$SYNELIA_TOKEN"
    # Aperçu de coût : le job échoue si le déploiement dépasse le seuil
    - synelia app deploy app-metier --env production --dry-run --seuil-mensuel 50000
    - synelia app deploy app-metier --env production --attendre
    # Vérification post-déploiement, sinon retour arrière automatique
    - synelia app sante app-metier --env production --seuil-erreurs 1 --fenetre 5m
      || synelia app rollback app-metier --env production`}
            />
            <Callout ton="violet" className="mt-4" titre="Le retour arrière dans le pipeline">
              Faire échouer un job et laisser une version dégradée en production, c’est reporter le
              problème sur la personne d’astreinte. La dernière ligne vérifie la santé après
              déploiement et repromeut l’artefact précédent si le taux d’erreur dépasse le seuil — en
              quelques secondes, sans rebuild.
            </Callout>
          </Card>
        </div>
      )}

      {onglet === 'terraform' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Fournisseur d’infrastructure déclarative"
              sousTitre="Publié sur le registre public, compatible Terraform et OpenTofu."
              actions={
                <ButtonLink
                  size="sm"
                  variant="secondary"
                  external
                  href="https://registry.terraform.io"
                  iconAfter={<ExternalLink size={12} />}
                >
                  Registre
                </ButtonLink>
              }
            />
            <CodeBlock
              langue="hcl"
              code={`terraform {
  required_providers {
    synelia = {
      source  = "synelia/synelia"
      version = "~> 1.4"
    }
  }
}

provider "synelia" {
  # Jamais de jeton en clair dans le dépôt
  token = var.synelia_token
  org   = "org-dba"
}

resource "synelia_espace" "production" {
  code   = "EC-DBA-01"
  offre  = "off-pro"
  site   = "ABJ"
  cidr   = "10.0.0.0/20"

  quota {
    vcpu        = 64
    ram_go      = 256
    stockage_to = 8
  }
}

resource "synelia_vm" "api" {
  count   = 3
  espace  = synelia_espace.production.id
  nom     = "prod-api-\${count.index + 1}"
  gabarit = "c2.medium"
  os      = "Debian 12"
  disk_go = 100
  site    = "ABJ"

  etiquettes = {
    centre-de-cout = "DSI"
    environnement  = "production"
    projet         = "refonte-2026"
  }

  # Le plan de sauvegarde est rattaché à la création, pas plus tard
  backup_plan = synelia_backup_plan.quotidien.id
}

resource "synelia_backup_plan" "quotidien" {
  nom              = "Production quotidienne"
  espace           = synelia_espace.production.id
  cron             = "0 2 * * *"
  retention_jours  = 30
  copie_hors_site  = "GBM"   # règle 3-2-1 respectée
  verifier_restauration = true
}`}
            />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Le coût apparaît dans le plan"
                sousTitre="terraform plan affiche le coût mensuel de ce qui va être créé."
              />
              <CodeBlock
                langue="bash"
                code={`$ terraform plan

Terraform will perform the following actions:

  # synelia_vm.api[0] will be created
  + resource "synelia_vm" "api" {
      + nom      = "prod-api-1"
      + gabarit  = "c2.medium"
      + cout_mensuel_ht = 34000
    }

Plan: 4 to add, 0 to change, 0 to destroy.

Changements de coût :
  + 3 machines c2.medium         102 000 FCFA/mois HT
  + 1 plan de sauvegarde           8 400 FCFA/mois HT
  ────────────────────────────────────────────────────
  Total ajouté                   110 400 FCFA/mois HT
                                 130 272 FCFA/mois TTC
  Prorata du mois en cours        50 424 FCFA TTC`}
              />
            </Card>

            <Card>
              <CardHeader titre="Ressources disponibles" sousTitre="Couverture du fournisseur, version 1.4." />
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {[
                  'synelia_espace',
                  'synelia_vm',
                  'synelia_k8s_cluster',
                  'synelia_reseau',
                  'synelia_ip_publique',
                  'synelia_groupe_securite',
                  'synelia_load_balancer',
                  'synelia_vpn_tunnel',
                  'synelia_volume',
                  'synelia_bucket',
                  'synelia_base_manageee',
                  'synelia_backup_plan',
                  'synelia_dr_plan',
                  'synelia_application',
                  'synelia_environnement',
                  'synelia_domaine',
                  'synelia_dns_zone',
                  'synelia_dns_record',
                  'synelia_service_manage',
                  'synelia_membre',
                  'synelia_jeton_api',
                  'synelia_regle_alerte',
                ].map((r) => (
                  <span key={r} className="font-mono text-[11px] text-ink">
                    {r}
                  </span>
                ))}
              </div>
              <Callout ton="warn" className="mt-4" titre="Les suppressions exigent une confirmation">
                Un <span className="font-mono text-[12px]">terraform destroy</span> sur une ressource
                portant des données demande la variable{' '}
                <span className="font-mono text-[12px]">confirm_destruction</span> avec le nom exact
                de la ressource. C’est délibérément pénible : une suppression déclenchée par erreur
                depuis un pipeline est irréversible.
              </Callout>
            </Card>
          </div>
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
                      { g: 'g2.medium', v: 8, r: '32 Go', u: 'Traitement d’images, encodage' },
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
              titre="Codes des sites physiques"
              sousTitre="Le site apparaît sur chaque ressource du portail et dans chaque réponse de l’API."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  code: 'ABJ',
                  nom: 'Abidjan · ABJ-1',
                  d: 'Site principal. Plateau, Abidjan, Côte d’Ivoire. Alimentation redondée, deux arrivées opérateurs distinctes.',
                },
                {
                  code: 'GBM',
                  nom: 'Grand-Bassam · GBM-1',
                  d: 'Site de reprise, à 42 km. Destination par défaut des copies hors site et des bascules de plan de reprise.',
                },
              ].map((s) => (
                <div key={s.code} className="rounded-[8px] border border-g-300 p-3.5">
                  <div className="flex items-center gap-2">
                    <Badge tone="violet" size="sm">
                      {s.code}
                    </Badge>
                    <span className="text-[13px] font-bold text-ink">{s.nom}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-g-700">{s.d}</p>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="Aucune donnée hors de ces deux sites">
              Sauf demande explicite de votre part, aucune donnée de votre organisation ne quitte ces
              deux sites — ni pour une sauvegarde, ni pour un traitement, ni pour de la supervision.
              Les journaux techniques de la plateforme y restent également.
            </Callout>
          </Card>

          <Card>
            <CardHeader
              titre="Journal des changements de l’API"
              sousTitre="Aucune rupture sans préavis de six mois et version parallèle."
            />
            <div className="space-y-2">
              {[
                {
                  v: 'v1.14',
                  d: '12 août 2026',
                  c: 'Ajout de /v1/conformite et du champ placement_prevu dans les réponses dry_run.',
                },
                {
                  v: 'v1.13',
                  d: '28 juillet 2026',
                  c: 'Le champ emplacement des composants expose désormais les pods, et non plus seulement le namespace.',
                },
                {
                  v: 'v1.12',
                  d: '3 juillet 2026',
                  c: 'Idempotency-Key accepté sur tous les POST. Les créations en double sont désormais détectées.',
                },
                {
                  v: 'v1.11',
                  d: '19 juin 2026',
                  c: 'Déprécié : /v1/vms sans espace en préfixe. Retiré au 19 décembre 2026.',
                },
              ].map((x) => (
                <div key={x.v} className="flex flex-wrap gap-3 border-b border-g-100 pb-2 last:border-0">
                  <span className="w-16 shrink-0 font-mono text-[12px] font-bold text-p-700">
                    {x.v}
                  </span>
                  <span className="w-28 shrink-0 text-[11px] text-g-500">{x.d}</span>
                  <span className="min-w-0 flex-1 text-[12px] text-ink">{x.c}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
