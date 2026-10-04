'use client'

import Link from 'next/link'
import { use } from 'react'
import { Plus } from 'lucide-react'
import { surfaceMarque } from '@/lib/utils'
import { num } from '@/lib/format'
import { HEBERGEMENTS, SITES_WEB, TYPE_SITE_LABEL, hebergementById } from '@/lib/mock'
import type { SiteWeb, WebHosting } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'
import { useEntreeSite, hrefSite } from '@/lib/web/entrees'

const TEINTE: Record<string, string> = {
  wordpress: '#21759B',
  prestashop: '#DF0067',
  php: '#777BB4',
  statique: '#4B2882',
  laravel: '#FF2D20',
}

export default function PageSiteApplications({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const siteId = decodeURIComponent(id)
  const entree = useEntreeSite(siteId)
  const h = entree?.hebergement
  const tousSites = useCollection<SiteWeb>('sites-web', SITES_WEB)
  const parcHebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const sites = h ? tousSites.items.filter((s) => s.hebergementId === h.id) : []
  const majEnAttente = sites.reduce((a, s) => a + (s.majEnAttente ?? 0), 0)

  if (!entree) {
    return (
      <EmptyState
        titre="Site introuvable"
        phrase="Ce nom n’existe pas dans votre organisation."
        action={{ libelle: 'Retour aux sites', href: '/app/web/sites' }}
      />
    )
  }

  if (!h) {
    return (
      <EmptyState
        titre="Aucun hébergement"
        phrase="Installez d’abord un serveur sur ce nom."
        action={{ libelle: 'Vue d’ensemble', href: hrefSite(siteId) }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Sites', href: '/app/web/sites' },
          { label: entree.nom, href: hrefSite(siteId) },
          { label: 'Applications' },
        ]}
        titre="Applications"
        sousTitre={`Sites installés sur ${h.serveur.nom} pour ${entree.nom}.`}
        actions={
          <BoutonFormulaire
            libelle="Installer"
            size="md"
            variant="primary"
            icone={<Plus size={14} />}
            action="service.admin"
            titre="Installer une application"
            description="Nous posons le socle et les sauvegardes ; le contenu s’édite dans l’application."
            champs={[
              {
                id: 'hote',
                label: 'Nom d’hôte',
                type: 'texte',
                placeholder: `app.${entree.nom}`,
                obligatoire: true,
              },
              {
                id: 'type',
                label: 'Application',
                type: 'select',
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
                options: ['8.3', '8.2', '8.1'].map((v) => ({ value: v, label: `PHP ${v}` })),
              },
            ]}
            valeursDepart={{ type: 'wordpress', php: '8.3', hote: `www.${entree.nom}` }}
            libelleValider="Installer"
            operation={(v) => ({
              titre: `Installation de ${v.hote} lancée`,
              appel: () =>
                creerRessource('/web/sites', {
                  hebergementId: h.id,
                  site: {
                    hote: String(v.hote),
                    type: v.type as SiteWeb['type'],
                    phpVersion: String(v.php),
                    ssl: true,
                  },
                }),
              effetFinal: () => tousSites.recharger(),
            })}
          />
        }
      />

      {majEnAttente > 0 && (
        <Callout ton="warn" titre={`${majEnAttente} mises à jour en attente`}>
          Chaque mise à jour est précédée d’une sauvegarde ; un retour arrière reste disponible sept jours.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile libelle="Applications" valeur={sites.length} />
        <StatTile
          libelle="Visites du mois"
          valeur={estActif() ? '—' : num(sites.reduce((a, s) => a + s.visitesMois, 0))}
        />
        <StatTile libelle="En ligne" valeur={sites.filter((s) => s.statut === 'en_ligne').length} />
      </div>

      {sites.length === 0 ? (
        <EmptyState
          titre="Aucune application sur ce serveur"
          phrase="WordPress, PrestaShop ou un site statique — une installation par sous-domaine."
          action={{ libelle: 'Vue d’ensemble', href: hrefSite(siteId) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => {
            const host = estActif()
              ? parcHebergements.items.find((x) => x.id === s.hebergementId)
              : hebergementById(s.hebergementId)
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
                          {TYPE_SITE_LABEL[s.type]} · PHP {s.phpVersion}
                          {host ? ` · ${host.serveur.nom}` : ''}
                        </span>
                      </span>
                    </span>
                  }
                  actions={
                    <Badge tone={s.statut === 'en_ligne' ? 'ok' : 'neutral'} size="sm" dot>
                      {s.statut === 'en_ligne' ? 'En ligne' : s.statut}
                    </Badge>
                  }
                />
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
