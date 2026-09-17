'use client'

import Link from 'next/link'
import { FolderTree, Plus, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num, relatif } from '@/lib/format'
import { SITE_LABEL } from '@/lib/types'
import {
  HEBERGEMENTS,
  ORG_COURANTE,
  PRIX_PALIER,
  SITES_WEB,
  nomServi,
  sitesDeLHebergement,
  tachesDeLHebergement,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'
import type { SiteWeb, WebHosting } from '@/lib/types'

const PALIERS = [
  {
    nom: 'Démarrage',
    specs: '2 vCPU · 4 Go · 40 Go',
    sites: '1 site',
    pour: 'Un site vitrine qui démarre.',
  },
  {
    nom: 'Pro',
    specs: '4 vCPU · 8 Go · 100 Go',
    sites: '5 sites',
    pour: 'Plusieurs sites, ou une boutique naissante.',
  },
  {
    nom: 'Agence',
    specs: '4 vCPU · 8 Go · 200 Go',
    sites: '25 sites',
    pour: 'Une agence qui héberge ses clients.',
    recommande: true,
  },
]

export default function ListeHebergements() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const hebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const tousSites = useCollection<SiteWeb>('sites-web', SITES_WEB)
  // Le backend filtre déjà par organisation ; la maquette restreint au
  // périmètre fictif, dont les identifiants sont inconnus du backend.
  const heberges = estActif()
    ? hebergements.items
    : HEBERGEMENTS.filter((h) => h.orgId === ORG_COURANTE.id)
  const miens = new Set(heberges.map((h) => h.id))
  const sites = (estActif() ? tousSites.items : SITES_WEB).filter((s) =>
    miens.has(s.hebergementId),
  )

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'Hébergement Web' },
        ]}
        titre="Hébergement Web"
        sousTitre="Un domaine, un serveur. Sur ce serveur : Apache, PHP, un moteur de bases, vos accès fichiers et vos tâches planifiées. Tout ce qui y est installé partage ses ressources."
        actions={
          <BoutonFormulaire
            libelle="Commander un hébergement"
            size="md"
            variant="primary"
            icone={<Plus size={14} />}
            action="service.admin"
            titre="Commander un hébergement"
            description="Un domaine, un serveur. Si vous n’avez pas encore de domaine, nous servons le site sur un nom provisoire le temps que vous l’enregistriez."
            champs={[
              {
                id: 'palier',
                label: 'Palier',
                type: 'select',
                options: PALIERS.map((p) => ({ value: p.nom, label: `${p.nom} · ${p.specs} · ${p.sites}` })),
              },
              { id: 'domaine', label: 'Domaine à servir', placeholder: 'mon-entreprise.ci — laissez vide pour un nom provisoire' },
              {
                id: 'site',
                label: 'Site physique',
                type: 'select',
                demi: true,
                options: [
                  { value: 'ABJ', label: 'Abidjan' },
                  { value: 'GBM', label: 'Grand-Bassam' },
                ],
              },
              {
                id: 'frequence',
                label: 'Facturation',
                type: 'select',
                demi: true,
                options: [
                  { value: 'mensuelle', label: 'Mensuelle' },
                  { value: 'annuelle', label: 'Annuelle · deux mois offerts' },
                ],
              },
            ]}
            valeursDepart={{ palier: 'Pro', site: 'ABJ', frequence: 'mensuelle' }}
            libelleValider="Commander"
            operation={(v) => ({
              titre: `Hébergement ${v.palier} commandé`,
              detail: v.domaine
                ? `Servira ${v.domaine} depuis ${v.site === 'ABJ' ? 'Abidjan' : 'Grand-Bassam'}.`
                : 'Un nom provisoire est attribué le temps que vous enregistriez votre domaine.',
              appel: () =>
                creerRessource('/web/hebergements', {
                  palier: String(v.palier),
                  site: v.site as 'ABJ' | 'GBM',
                  ...(String(v.domaine).trim() ? { domaine: String(v.domaine).trim() } : {}),
                }),
              job: {
                type: 'hebergement.create',
                label: `Création de l’hébergement ${v.palier}`,
                etapes: [
                  'Provisionner le serveur',
                  'Installer le serveur web et PHP',
                  'Démarrer le moteur de bases',
                  'Créer le compte de transfert',
                  'Poser le certificat',
                ],
              },
              effetFinal: () => hebergements.recharger(),
            })}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Hébergements" valeur={heberges.length} detail="un serveur chacun" />
        <StatTile libelle="Applications" valeur={sites.length} detail="tous serveurs confondus" />
        <StatTile
          libelle="Espace occupé"
          valeur={`${heberges.reduce((a, h) => a + h.espaceUtiliseGo, 0).toFixed(0)} Go`}
          detail={`sur ${heberges.reduce((a, h) => a + h.espaceTotalGo, 0)} Go`}
        />
        <StatTile
          libelle="Coût mensuel"
          valeur={money(heberges.reduce((a, h) => a + (PRIX_PALIER[h.palier] ?? 0), 0)).replace(' FCFA', '')}
          unite="FCFA"
        />
      </div>

      {heberges.map((h) => {
        const sitesDuServeur = estActif()
          ? tousSites.items.filter((s) => s.hebergementId === h.id)
          : sitesDeLHebergement(h.id)
        const taches = tachesDeLHebergement(h.id)
        return (
          <Card key={h.id}>
            <CardHeader
              titre={
                <Link
                  href={`/app/web/hebergement/${h.id}`}
                  className="font-mono text-[15px] hover:text-p-700"
                >
                  {nomServi(h)}
                </Link>
              }
              sousTitre={`${h.palier} · ${h.serveur.nom} · ${h.serveur.os} · ${h.serveur.serveurWeb}${
                h.serveur.uptimeJours != null ? ` · en service depuis ${h.serveur.uptimeJours} jours` : ''
              }`}
              actions={
                <span className="flex flex-wrap items-center gap-2">
                  {!h.domaine && <Badge tone="warn" size="sm">Nom provisoire</Badge>}
                  <Badge tone={h.statut === 'en_ligne' ? 'ok' : 'warn'} size="sm" dot>
                    {h.statut === 'en_ligne' ? 'En ligne' : 'Maintenance'}
                  </Badge>
                  <ButtonLink href={`/app/web/hebergement/${h.id}`} variant="secondary" size="sm">
                    Gérer
                  </ButtonLink>
                </span>
              }
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-2.5 lg:col-span-2">
                {h.serveur.chargeCpuPct != null && (
                  <QuotaBar
                    libelle="Processeur"
                    utilise={h.serveur.chargeCpuPct}
                    total={100}
                    compact
                    formateur={(v) => `${v} %`}
                  />
                )}
                {h.serveur.ramUtiliseePct != null && (
                  <QuotaBar
                    libelle="Mémoire"
                    utilise={h.serveur.ramUtiliseePct}
                    total={100}
                    compact
                    formateur={(v) => `${v} %`}
                  />
                )}
                <QuotaBar
                  libelle="Disque"
                  utilise={h.espaceUtiliseGo}
                  total={h.espaceTotalGo}
                  compact
                  formateur={(v) => `${v.toFixed(1)} Go`}
                />
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                <div>
                  <dt className="type-micro text-g-500">Adresse IPv4</dt>
                  <dd className="mt-0.5 font-mono text-[12px] text-ink">{h.serveur.ip}</dd>
                </div>
                <div>
                  <dt className="type-micro text-g-500">Site physique</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{SITE_LABEL[h.serveur.site]}</dd>
                </div>
                <div>
                  <dt className="type-micro text-g-500">PHP par défaut</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{h.php.versionDefaut}</dd>
                </div>
                <div>
                  <dt className="type-micro text-g-500">Applications</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">{sitesDuServeur.length}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-g-100 pt-3">
              <Badge tone="neutral" size="sm">
                <FolderTree size={10} className="mr-1 inline" />
                {(['ftp', 'ftps', 'sftp', 'ssh'] as const)
                  .filter((k) => h.acces[k])
                  .map((k) => k.toUpperCase())
                  .join(' · ') || 'aucun accès ouvert'}
              </Badge>
              <Badge tone="neutral" size="sm">
                <Terminal size={10} className="mr-1 inline" />
                {taches.length} tâche{taches.length > 1 ? 's' : ''} planifiée
                {taches.length > 1 ? 's' : ''}
              </Badge>
              <Badge tone={h.sauvegarde.statut === 'ok' ? 'ok' : 'err'} size="sm">
                Sauvegarde {h.sauvegarde.derniere ? relatif(h.sauvegarde.derniere, maintenant) : '—'}
              </Badge>
              <span className="tnum ml-auto text-[13px] font-bold text-ink">
                {money(PRIX_PALIER[h.palier] ?? 0)} / mois
              </span>
            </div>
          </Card>
        )
      })}

      <Card>
        <CardHeader
          titre="Les paliers"
          sousTitre="Le palier fixe les ressources du serveur et le nombre d’applications qu’on peut y installer. Changer de palier se fait à chaud, facturé au prorata."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PALIERS.map((p) => (
            <div
              key={p.nom}
              className={cn(
                'rounded-[8px] border-2 p-4',
                p.recommande ? 'border-p-700 bg-p-050' : 'border-g-300 bg-white',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-bold text-ink">{p.nom}</p>
                {p.recommande && (
                  <Badge tone="violet" size="sm">
                    Le plus pris
                  </Badge>
                )}
              </div>
              <p className="tnum mt-2 text-[20px] font-bold leading-none [font-family:var(--font-display)] text-p-700">
                {money(PRIX_PALIER[p.nom] ?? 0)}
                <span className="text-[11px] font-semibold text-g-500"> / mois</span>
              </p>
              <p className="mt-2 font-mono text-[12px] text-g-700">{p.specs}</p>
              <p className="mt-0.5 text-[12px] text-g-700">{p.sites}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-g-500">{p.pour}</p>
            </div>
          ))}
        </div>
        <Callout ton="info" className="mt-3" titre="Ce que le palier ne change pas">
          Les accès FTP, SFTP et FTPS, les tâches planifiées, les versions de PHP, le pare-feu
          applicatif et les sauvegardes immuables sont dans tous les paliers. Ce qui varie, c’est la
          taille du serveur et le nombre d’applications — {num(sites.length)} chez vous
          aujourd’hui.
        </Callout>
      </Card>
    </div>
  )
}
