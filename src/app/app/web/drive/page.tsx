'use client'

import Link from 'next/link'
import { ExternalLink, FolderOpen, Plus, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, relatif } from '@/lib/format'
import { DRIVES, drivesDeLOrg, type DriveDomaine } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

export default function ListeDrives() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const collection = useCollection<DriveDomaine>('drives', DRIVES)
  // Le backend filtre déjà par organisation ; la maquette restreint au
  // périmètre fictif, dont les identifiants sont inconnus du backend.
  const perimetre = new Set(drivesDeLOrg().map((d) => d.id))
  const drives = estActif() ? collection.items : collection.items.filter((d) => perimetre.has(d.id))
  const actifs = drives.filter((d) => d.actif)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'Drive' },
        ]}
        titre="Drive"
        sousTitre="Un espace de fichiers partagé par domaine : sièges, quota, politique de partage externe et rétention des versions. Les fichiers se manipulent dans le Drive, jamais dans le portail."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Drives actifs" valeur={actifs.length} detail={`sur ${drives.length} domaines`} />
        <StatTile
          libelle="Sièges attribués"
          valeur={actifs.reduce((a, d) => a + d.sieges.attribues, 0)}
          detail={`sur ${actifs.reduce((a, d) => a + d.sieges.souscrits, 0)} souscrits`}
        />
        <StatTile
          libelle="Espace occupé"
          valeur={`${(actifs.reduce((a, d) => a + d.quota.utiliseGo, 0) / 1024).toFixed(2)} To`}
          detail={`sur ${(actifs.reduce((a, d) => a + d.quota.totalGo, 0) / 1024).toFixed(0)} To`}
        />
        <StatTile
          libelle="Liens de partage actifs"
          valeur={actifs.reduce((a, d) => a + d.partage.liensActifs, 0)}
          detail="dont certains publics"
          ton={actifs.some((d) => d.partage.externeAutorise) ? 'warn' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {drives.map((d) => (
          <Card key={d.id} className={cn(!d.actif && 'border-dashed')}>
            <CardHeader
              titre={
                <Link href={`/app/web/drive/${d.id}`} className="font-mono text-[14px] hover:text-p-700">
                  {d.domaine}
                </Link>
              }
              sousTitre={
                d.actif
                  ? `${d.solutionOSS} ${d.version ?? ''} · ${d.palier} · servi sur ${d.hote}`
                  : `Drive non activé · ${money(d.prixSiege)} par siège et par mois`
              }
              actions={
                <Badge tone={d.actif ? 'ok' : 'neutral'} size="sm" dot={d.actif}>
                  {d.actif ? 'Actif' : 'À activer'}
                </Badge>
              }
            />

            {d.actif ? (
              <>
                <div className="space-y-2.5">
                  <QuotaBar
                    libelle="Sièges attribués"
                    utilise={d.sieges.attribues}
                    total={d.sieges.souscrits}
                    compact
                  />
                  <QuotaBar
                    libelle="Espace"
                    utilise={d.quota.utiliseGo}
                    total={d.quota.totalGo}
                    compact
                    formateur={(v) => `${(v / 1024).toFixed(2)} To`}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-g-100 pt-3">
                  <Badge tone={d.partage.externeAutorise ? 'warn' : 'ok'} size="sm">
                    Partage externe {d.partage.externeAutorise ? 'autorisé' : 'bloqué'}
                  </Badge>
                  <Badge tone="neutral" size="sm">
                    {d.partage.liensActifs} liens actifs
                  </Badge>
                  <Badge tone="neutral" size="sm">
                    Versions {d.versionsFichiers.retentionJours} j
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink href={`/app/web/drive/${d.id}`} variant="secondary" size="sm">
                    Administrer
                  </ButtonLink>
                  <ButtonLink
                    href={`https://${d.hote}`}
                    variant="accent"
                    size="sm"
                    iconAfter={<ExternalLink size={12} />}
                  >
                    Ouvrir
                  </ButtonLink>
                </div>
                {d.derniereSauvegarde && (
                  <p className="mt-2 text-[11px] text-g-500">
                    Dernière sauvegarde {relatif(d.derniereSauvegarde, maintenant)}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-g-700">
                  L’activation crée l’instance, pose le certificat sur{' '}
                  <span className="font-mono">{d.hote}</span>, déclare le client SSO et applique le
                  plan de sauvegarde. Les sièges s’attribuent ensuite depuis cette page.
                </p>
                <BoutonFormulaire
                  libelle="Activer le drive"
                  className="mt-3"
                  icone={<Plus size={13} />}
                  action="service.admin"
                  titre={`Activer le drive de ${d.domaine}`}
                  description="L’activation crée l’instance, pose le certificat, déclare le client SSO et applique le plan de sauvegarde. Les sièges s’attribuent ensuite."
                  champs={[
                    { id: 'sieges', label: 'Sièges à souscrire', type: 'nombre', demi: true, min: 1, max: 500 },
                    { id: 'quota', label: 'Quota total', type: 'nombre', demi: true, min: 100, suffixe: 'Go' },
                    { id: 'externe', label: 'Partage externe autorisé', type: 'switch', placeholder: 'Avec mot de passe' },
                  ]}
                  valeursDepart={{ sieges: 10, quota: 500, externe: true }}
                  libelleValider="Activer"
                  operation={(v) => ({
                    titre: `Drive de ${d.domaine} en cours d’activation`,
                    detail: `${v.sieges} sièges · ${v.quota} Go`,
                    appel: () =>
                      creerRessource('/web/drive', {
                        domaine: d.domaine,
                        palier: d.palier,
                        sieges: Number(v.sieges),
                      }),
                    job: { workflow: 'web.drive.activate', cible: d.domaine },
                    effetFinal: () => {
                      if (!estActif())
                        collection.modifier(d.id, (x) => ({
                          actif: true,
                          sieges: { attribues: 0, souscrits: Number(v.sieges) },
                          quota: { utiliseGo: 0, totalGo: Number(v.quota) },
                          partage: { ...x.partage, externeAutorise: Boolean(v.externe) },
                        }))
                      collection.recharger()
                    },
                  })}
                />
              </>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          titre="Le partage externe"
          sousTitre="Les trois garde-fous qui bornent la sortie de fichiers hors de l’organisation."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              t: 'Mot de passe obligatoire',
              d: 'Un lien sans mot de passe transféré dans une conversation reste ouvert à qui le reçoit.',
              i: <Share2 size={14} />,
            },
            {
              t: 'Expiration par défaut',
              d: 'Trente jours suffisent à la plupart des échanges. Un lien éternel est un lien oublié.',
              i: <FolderOpen size={14} />,
            },
            {
              t: 'Journal des accès',
              d: 'Qui a ouvert quoi, depuis quelle adresse. Consultable dans le Drive, conservé 12 mois.',
              i: <Share2 size={14} />,
            },
          ].map((c) => (
            <div key={c.t} className="rounded-[8px] border border-g-300 bg-g-050 p-3">
              <p className="flex items-center gap-1.5 text-p-700">{c.i}</p>
              <p className="mt-1.5 text-[13px] font-bold text-ink">{c.t}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-g-700">{c.d}</p>
            </div>
          ))}
        </div>
        <Callout ton="info" className="mt-3" titre="Ce que le portail ne fera pas">
          Pas de navigateur de fichiers ici : parcourir, téléverser, partager et éditer un document
          sont les gestes du Drive, dans son interface.
        </Callout>
      </Card>
    </div>
  )
}
