'use client'

import { use, useMemo } from 'react'
import { Database } from 'lucide-react'
import { num } from '@/lib/format'
import {
  MOTEUR_WEB_LABEL,
  MOTEUR_WEB_TEINTE,
  SERVEURS_BASES,
  type ServeurBases,
} from '@/lib/mock'
import { surfaceMarque } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'
import { useEntreeSite, hrefSite } from '@/lib/web/entrees'

export default function PageSiteBases({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const siteId = decodeURIComponent(id)
  const entree = useEntreeSite(siteId)
  const h = entree?.hebergement
  const serveurs = useCollection<ServeurBases>('serveurs-bases', SERVEURS_BASES)

  const moteurs = useMemo(() => {
    if (!h) return []
    if (estActif()) return serveurs.items.filter((m) => m.hebergementId === h.id)
    return SERVEURS_BASES.filter((m) => m.hebergementId === h.id)
  }, [serveurs.items, h])

  const nbBases = useMemo(
    () => moteurs.reduce((a, m) => a + m.bases.length, 0),
    [moteurs],
  )

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
        phrase="Le serveur de bases est créé avec l’hébergement."
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
          { label: 'Bases de données' },
        ]}
        titre="Bases de données"
        sousTitre={`MariaDB, PostgreSQL et Redis sur ${h.serveur.nom} — accès local uniquement.`}
      />

      <Callout ton="info" titre="Pas d’accès depuis Internet">
        Vos applications se connectent en <span className="font-mono">localhost</span> sur ce serveur.
      </Callout>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile libelle="Moteurs" valeur={moteurs.filter((m) => m.actif).length} />
        <StatTile libelle="Bases" valeur={nbBases} />
        <StatTile
          libelle="Volume total"
          valeur={num(moteurs.reduce((a, m) => a + m.bases.reduce((b, x) => b + x.tailleMo, 0), 0))}
          detail="Mo"
        />
      </div>

      {nbBases === 0 ? (
        <EmptyState
          titre="Aucune base"
          phrase="Créez une base depuis la fiche serveur (onglet Vue d’ensemble ou PHP & runtime)."
          action={{ libelle: 'Ouvrir le serveur', href: hrefSite(siteId, '/serveur') }}
        />
      ) : (
        <div className="space-y-4">
          {moteurs.map((m) => {
            const teinte = MOTEUR_WEB_TEINTE[m.moteur]
            const surface = surfaceMarque(teinte)
            const lignes = m.bases
            if (!lignes.length) return null
            return (
              <Card key={m.id}>
                <CardHeader
                  titre={
                    <span className="flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-[6px]"
                        style={{ background: surface.fond, color: surface.texte }}
                      >
                        <Database size={16} />
                      </span>
                      {MOTEUR_WEB_LABEL[m.moteur]}
                    </span>
                  }
                  sousTitre={`${num(lignes.length)} base${lignes.length > 1 ? 's' : ''}`}
                  actions={
                    <Badge tone={m.actif ? 'ok' : 'neutral'} size="sm">
                      {m.actif ? 'Actif' : 'Arrêté'}
                    </Badge>
                  }
                />
                <ul className="divide-y divide-g-100">
                  {lignes.map((b) => (
                    <li
                      key={`${m.id}-${b.nom}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]"
                    >
                      <span className="font-mono font-semibold">{b.nom}</span>
                      <span className="text-g-500">{b.tailleMo != null ? `${num(b.tailleMo)} Mo` : '—'}</span>
                    </li>
                  ))}
                </ul>
                {m.quotaMo != null && m.utiliseMo != null && (
                  <div className="border-t border-g-100 px-4 py-3">
                    <QuotaBar libelle="Espace moteur" utilise={m.utiliseMo} total={m.quotaMo} unite="Mo" />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
