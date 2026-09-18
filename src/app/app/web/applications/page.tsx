'use client'

import Link from 'next/link'
import { ExternalLink, Plus } from 'lucide-react'
import { cn, surfaceMarque } from '@/lib/utils'
import type { SiteWeb } from '@/lib/types'
import { num, relatif } from '@/lib/format'
import {
  DOMAINES,
  HEBERGEMENTS,
  ORG_COURANTE,
  SITES_WEB,
  TYPE_SITE_LABEL,
  hebergementById,
  nomServi,
} from '@/lib/mock'
import type { Domaine, WebHosting } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

const TEINTE: Record<string, string> = {
  wordpress: '#21759B',
  prestashop: '#DF0067',
  ghost: '#15171A',
  dolibarr: '#243A5E',
  php: '#777BB4',
  statique: '#4B2882',
  laravel: '#FF2D20',
}

// Le nom (en minuscules, sans espaces ni accents) sert de sous-domaine ET de discriminant
// applicatif côté backend quand `type` reste générique (`php`) : « Ghost » installe une
// image `ghost`, « Dolibarr » une image `dolibarr`, jamais la même que « Application PHP ».
const CATALOGUE = [
  { nom: 'WordPress', type: 'wordpress', phrase: 'Site vitrine, blog, portail éditorial.', php: '8.3' },
  { nom: 'PrestaShop', type: 'prestashop', phrase: 'Boutique en ligne, paiements mobile money.', php: '8.2' },
  { nom: 'Ghost', type: 'php', phrase: 'Blog et newsletter, édition sobre.', php: '8.3' },
  { nom: 'Dolibarr', type: 'php', phrase: 'Gestion commerciale et facturation.', php: '8.2' },
  { nom: 'Site statique', type: 'statique', phrase: 'HTML généré, déployé par Git.', php: '—' },
]

export default function ListeApplications() {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const tousSites = useCollection<SiteWeb>('sites-web', SITES_WEB)
  const parcHebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  // Le backend filtre déjà par organisation ; la maquette restreint au
  // périmètre fictif, dont les identifiants sont inconnus du backend.
  const hebergementsConnus = estActif()
    ? parcHebergements.items
    : HEBERGEMENTS.filter((h) => h.orgId === ORG_COURANTE.id)
  const miens = new Set(hebergementsConnus.map((h) => h.id))
  const sites = estActif()
    ? tousSites.items
    : tousSites.items.filter((s) => miens.has(s.hebergementId))
  const majEnAttente = sites.reduce((a, s) => a + (s.majEnAttente ?? 0), 0)
  // Domaines possédés : « Nom d'hôte » propose les domaines connus (plus
  // « + Nouveau… ») pour éviter de retaper un nom qu'on a déjà enregistré.
  const lesDomaines = useCollection<Domaine>('domaines', DOMAINES)
  const domainesConnus = estActif()
    ? lesDomaines.items
    : DOMAINES.filter((d) => d.orgId === ORG_COURANTE.id)
  const optionsDomaines = domainesConnus.map((d) => ({ value: d.nom, label: d.nom }))

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'Applications' },
        ]}
        titre="Applications"
        sousTitre="Les sites installés sur vos hébergements, chacun sur son sous-domaine et sa version de PHP. Nous opérons le socle, les mises à jour et les sauvegardes ; le contenu s’édite dans l’application."
        actions={
          <BoutonFormulaire
            libelle="Installer une application"
            size="md"
            variant="primary"
            icone={<Plus size={14} />}
            action="service.admin"
            titre="Installer une application"
            description="Nous posons le socle, les mises à jour et les sauvegardes. Le contenu s’édite ensuite dans l’application : le portail ne réimplémente pas son écran d’administration."
            champs={[
              {
                id: 'hote',
                label: 'Nom d’hôte',
                type: 'select_ou_nouveau',
                options: optionsDomaines,
                hint: 'Choisissez un domaine existant ou « + Nouveau… » pour un sous-domaine ou un hôte précis.',
                placeholder: 'boutique.dba.africa',
                obligatoire: true,
              },
              {
                id: 'hebergement',
                label: 'Hébergement de destination',
                type: 'select',
                options: hebergementsConnus.map((h) => ({
                  value: h.id,
                  label: `${h.serveur.nom} · ${h.palier}`,
                })),
              },
              {
                id: 'type',
                label: 'Application',
                type: 'select',
                demi: true,
                options: [
                  { value: 'wordpress', label: 'WordPress' },
                  { value: 'prestashop', label: 'PrestaShop' },
                  { value: 'statique', label: 'Site statique' },
                  { value: 'php', label: 'Application PHP' },
                ],
              },
              {
                id: 'php',
                label: 'Version de PHP',
                type: 'select',
                demi: true,
                options: ['8.3', '8.2', '8.1'].map((v) => ({ value: v, label: `PHP ${v}` })),
              },
            ]}
            valeursDepart={{ type: 'wordpress', php: '8.3' }}
            libelleValider="Installer"
            operation={(v) => {
              const idSite = tousSites.identifiant('site')
              return {
                titre: `Installation de ${v.hote} lancée`,
                detail: `${v.type} · PHP ${v.php}`,
                appel: () =>
                  creerRessource('/web/sites', {
                    hebergementId: String(v.hebergement),
                    site: {
                      hote: String(v.hote),
                      type: v.type as 'wordpress' | 'prestashop' | 'php' | 'statique' | 'laravel',
                      phpVersion: String(v.php),
                      ssl: true,
                    },
                  }),
                effet: () =>
                  tousSites.creer({
                    id: idSite,
                    hebergementId: String(v.hebergement),
                    hote: String(v.hote),
                    racine: `/var/www/${String(v.hote).split('.')[0]}`,
                    type: v.type as SiteWeb['type'],
                    phpVersion: String(v.php),
                    ssl: { etat: 'en_emission' },
                    espaceMo: 0,
                    visitesMois: 0,
                    securite: { waf: true, bruteForce: true, scanMalware: true },
                    statut: 'installation',
                  }),
                job: { workflow: 'web.app.install', cible: String(v.hote) },
                effetFinal: () => {
                  if (estActif()) {
                    tousSites.recharger()
                    return
                  }
                  tousSites.modifier(idSite, {
                    statut: 'en_ligne',
                    ssl: { etat: 'actif', emetteur: 'Let’s Encrypt', expire: '2026-11-17' },
                  })
                },
              }
            }}
          />
        }
      />

      {majEnAttente > 0 && (
        <Callout ton="warn" titre={`${majEnAttente} mises à jour en attente`}>
          Chaque mise à jour est précédée d’une sauvegarde, et un retour arrière reste disponible
          sept jours. Les correctifs de sécurité du cœur sont appliqués sans attendre votre
          validation — c’est le seul cas où nous ne demandons pas.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Applications" valeur={sites.length} detail={`${sites.filter((s) => s.statut === 'en_ligne').length} en ligne`} />
        <StatTile
          libelle="Visites du mois"
          valeur={num(sites.reduce((a, s) => a + s.visitesMois, 0))}
          detail="toutes applications"
        />
        <StatTile
          libelle="Mises à jour en attente"
          valeur={majEnAttente}
          ton={majEnAttente > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Préproductions actives"
          valeur={sites.filter((s) => s.preproduction?.actif).length}
          detail="clones de production"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {sites.map((s) => {
          const h = hebergementById(s.hebergementId)
          const surface = surfaceMarque(TEINTE[s.type] ?? '#4B2882')
          return (
            <Card key={s.id}>
              <CardHeader
                titre={
                  <span className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold"
                      style={{ background: surface.fond, color: surface.texte }}
                    >
                      {TYPE_SITE_LABEL[s.type].slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={`/app/web/applications/${s.id}`}
                        className="block truncate font-mono text-[13px] font-bold text-ink hover:text-p-700"
                      >
                        {s.hote}
                      </Link>
                      <span className="block text-[11px] text-g-500">
                        {TYPE_SITE_LABEL[s.type]}
                        {s.version ? ` ${s.version}` : ''} · PHP {s.phpVersion}
                      </span>
                    </span>
                  </span>
                }
                actions={
                  s.majEnAttente ? (
                    <Badge tone="warn" size="sm">
                      {s.majEnAttente} MAJ
                    </Badge>
                  ) : (
                    <Badge tone={s.statut === 'en_ligne' ? 'ok' : 'neutral'} size="sm" dot>
                      {s.statut === 'en_ligne' ? 'En ligne' : 'Arrêté'}
                    </Badge>
                  )
                }
              />

              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                <div>
                  <dt className="type-micro text-g-500">Visites du mois</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">{num(s.visitesMois)}</dd>
                </div>
                <div>
                  <dt className="type-micro text-g-500">Espace</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">
                    {s.espaceMo >= 1024 ? `${(s.espaceMo / 1024).toFixed(1)} Go` : `${s.espaceMo} Mo`}
                  </dd>
                </div>
                <div>
                  <dt className="type-micro text-g-500">Serveur</dt>
                  <dd className="mt-0.5 truncate font-mono text-[12px] text-g-700">
                    {h ? nomServi(h) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="type-micro text-g-500">Certificat</dt>
                  <dd className="mt-0.5">
                    <Badge tone={s.ssl.etat === 'actif' ? 'ok' : 'warn'} size="sm">
                      {s.ssl.etat === 'actif' ? 'Actif' : 'À poser'}
                    </Badge>
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-g-100 pt-3">
                {s.securite.waf && (
                  <Badge tone="ok" size="sm">
                    WAF
                  </Badge>
                )}
                {s.securite.scanMalware && (
                  <Badge tone="ok" size="sm">
                    Scan malware
                  </Badge>
                )}
                {s.preproduction?.actif && (
                  <Badge tone="violet" size="sm">
                    Préprod active
                  </Badge>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href={`/app/web/applications/${s.id}`} variant="secondary" size="sm">
                  Administrer
                </ButtonLink>
                <ButtonLink
                  href={`https://${s.hote}`}
                  variant="accent"
                  size="sm"
                  iconAfter={<ExternalLink size={12} />}
                >
                  Ouvrir
                </ButtonLink>
              </div>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader
          titre="Installer une application"
          sousTitre="Nous provisionnons la base, le sous-domaine, le certificat et le plan de sauvegarde. L’installation prend deux à quatre minutes."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATALOGUE.map((c) => {
            const surface = surfaceMarque(TEINTE[c.type] ?? '#4B2882')
            const logiciel = c.nom.toLowerCase().replace(/[^a-z]/g, '')
            // L'application se installe sur un hébergement choisi et sous un hôte
            // choisi — l'ancienne version prenait silencieusement le premier
            // hébergement et un sous-domaine générique, sans rien demander.
            const hebergementDefaut = hebergementsConnus[0]
            const hoteDefaut = hebergementDefaut
              ? `${logiciel}.${nomServi(hebergementDefaut)}`
              : `${logiciel}.dba.africa`
            return (
              <div
                key={c.nom}
                className="flex flex-col rounded-[8px] border border-g-300 bg-white p-3"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[11px] font-bold"
                  style={{ background: surface.fond, color: surface.texte }}
                >
                  {c.nom.slice(0, 2).toUpperCase()}
                </span>
                <span className="mt-2 block text-[13px] font-bold text-ink">{c.nom}</span>
                <span className="mt-0.5 block flex-1 text-[11px] leading-snug text-g-500">
                  {c.phrase}
                </span>
                <span className="mt-1.5 block text-[11px] text-g-500">PHP {c.php}</span>
                <BoutonFormulaire
                  libelle="Installer"
                  titre={`Installer ${c.nom}`}
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  champs={[
                    {
                      id: 'hebergement',
                      label: 'Hébergement de destination',
                      type: 'select',
                      options: hebergementsConnus.map((h) => ({
                        value: h.id,
                        label: `${nomServi(h)} · ${h.palier}`,
                      })),
                      obligatoire: true,
                    },
                    {
                      id: 'hote',
                      label: 'Nom d’hôte',
                      type: 'select_ou_nouveau',
                      options: [
                        ...new Set([
                          ...sites.map((s) => s.hote),
                          ...domainesConnus.map((d) => `${logiciel}.${d.nom}`),
                          ...domainesConnus.map((d) => d.nom),
                        ]),
                      ]
                        .filter(Boolean)
                        .map((h) => ({ value: h, label: h })),
                      hint: `Sous-domaine dédié (ex. ${hoteDefaut}), ou « + Nouveau… » pour un autre hôte.`,
                      placeholder: hoteDefaut,
                      obligatoire: true,
                    },
                  ]}
                  valeursDepart={{
                    hebergement: hebergementDefaut?.id ?? '',
                    hote: hoteDefaut,
                  }}
                  libelleValider="Installer"
                  operation={(v) => {
                    const idSite = tousSites.identifiant('site')
                    const hote = String(v.hote)
                    const hebergementId = String(v.hebergement)
                    return {
                      titre: `Installation de ${c.nom} lancée`,
                      detail: `${hote} · PHP ${c.php}. Le contenu s’édite ensuite dans l’application.`,
                      appel: () =>
                        creerRessource('/web/sites', {
                          hebergementId,
                          site: {
                            hote,
                            type: c.type as SiteWeb['type'],
                            phpVersion: c.php === '—' ? '8.3' : c.php,
                            ssl: true,
                          },
                        }),
                      effet: () =>
                        tousSites.creer({
                          id: idSite,
                          hebergementId,
                          hote,
                          racine: `/var/www/${hote.split('.')[0] || logiciel}`,
                          type: c.type as SiteWeb['type'],
                          phpVersion: c.php === '—' ? '8.3' : c.php,
                          ssl: { etat: 'en_emission' },
                          espaceMo: 0,
                          visitesMois: 0,
                          securite: { waf: true, bruteForce: true, scanMalware: true },
                          statut: 'installation',
                        }),
                      job: { workflow: 'web.app.install', cible: `${c.nom} · ${hote}` },
                      effetFinal: () => {
                        if (estActif()) {
                          tousSites.recharger()
                          return
                        }
                        tousSites.modifier(idSite, {
                          statut: 'en_ligne',
                          ssl: { etat: 'actif', emetteur: 'Let’s Encrypt', expire: '2026-11-17' },
                        })
                      },
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
        <Callout ton="info" className="mt-3" titre="Où s’arrête notre responsabilité">
          Nous garantissons le socle : version de PHP, extensions, certificat, sauvegarde, pare-feu
          applicatif. Nous ne garantissons pas une extension tierce que vous installez, et nous vous
          dirons quand l’une est connue pour dégrader les performances ou présenter une faille
          ouverte.
        </Callout>
      </Card>
    </div>
  )
}
