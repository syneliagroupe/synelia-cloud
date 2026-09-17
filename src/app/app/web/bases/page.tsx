'use client'

import Link from 'next/link'
import { Database, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { num, relatif } from '@/lib/format'
import {
  MOTEUR_WEB_LABEL,
  MOTEUR_WEB_TEINTE,
  SERVEURS_BASES,
  serveursBasesDeLOrg,
  type ServeurBases,
} from '@/lib/mock'
import { surfaceMarque } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction } from '@/components/app/actions'
import { estActif, modifierRessource } from '@/lib/api/client'

export default function ListeBases() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const serveurs = useCollection<ServeurBases>('serveurs-bases', SERVEURS_BASES)
  // Le périmètre de l'organisation vient du jeu de données ; l'état vient de
  // l'atelier, pour qu'une activation se voie tout de suite. En mode API le
  // backend filtre déjà, avec des identifiants inconnus du jeu local.
  const perimetre = new Set(serveursBasesDeLOrg().map((m) => m.id))
  const moteurs = estActif() ? serveurs.items : serveurs.items.filter((m) => perimetre.has(m.id))
  const actifs = moteurs.filter((m) => m.actif)
  const bases = actifs.reduce((a, m) => a + m.bases.length, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'Bases de données' },
        ]}
        titre="Bases de données"
        sousTitre="MariaDB, PostgreSQL et Redis tournent sur le serveur de votre hébergement, à côté d’Apache. Compris dans le prix, sans haute disponibilité — et sans accès depuis l’extérieur."
      />

      <Callout ton="info" titre="Aucun accès distant, volontairement">
        Ces serveurs n’écoutent que sur la boucle locale de leur machine. Vos sites s’y connectent
        par <span className="font-mono">localhost</span> ; rien ne vient d’Internet. C’est ce qui
        évite la base laissée ouverte au monde par simple oubli de configuration. Pour une base
        joignable depuis l’extérieur, il faut une base managée, qui vit sur son propre socle.
      </Callout>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Moteurs actifs" valeur={actifs.length} detail={`sur ${moteurs.length} disponibles`} />
        <StatTile libelle="Bases" valeur={bases} detail="toutes machines confondues" />
        <StatTile
          libelle="Volume occupé"
          valeur={`${(actifs.reduce((a, m) => a + m.utiliseMo, 0) / 1024).toFixed(1)} Go`}
          detail={`sur ${(actifs.reduce((a, m) => a + m.quotaMo, 0) / 1024).toFixed(0)} Go`}
        />
        <StatTile
          libelle="Connexions actives"
          valeur={actifs.reduce((a, m) => a + (m.connexions?.actives ?? 0), 0)}
          detail="au moment du relevé"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {moteurs.map((m) => {
          const surface = surfaceMarque(MOTEUR_WEB_TEINTE[m.moteur])
          return (
            <Card key={m.id} className={cn(!m.actif && 'border-dashed')}>
              <CardHeader
                titre={
                  <span className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[11px] font-bold"
                      style={{ background: surface.fond, color: surface.texte }}
                    >
                      {MOTEUR_WEB_LABEL[m.moteur].slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={`/app/web/bases/${m.id}`}
                        className="block truncate text-[14px] font-bold text-ink hover:text-p-700"
                      >
                        {MOTEUR_WEB_LABEL[m.moteur]} {m.version}
                      </Link>
                      <span className="block font-mono text-[11px] text-g-500">{m.serveur}</span>
                    </span>
                  </span>
                }
                actions={
                  <Badge tone={m.actif ? 'ok' : 'neutral'} size="sm" dot={m.actif}>
                    {m.actif ? 'Actif' : 'À activer'}
                  </Badge>
                }
              />

              {m.actif ? (
                <>
                  <QuotaBar
                    libelle={m.moteur === 'redis' ? 'Mémoire' : 'Espace'}
                    utilise={m.utiliseMo}
                    total={m.quotaMo}
                    compact
                    formateur={(v) => `${(v / 1024).toFixed(1)} Go`}
                  />
                  <p className="mt-2.5 text-[12px] text-g-700">
                    {m.bases.length} {m.moteur === 'redis' ? 'index' : 'base'}
                    {m.bases.length > 1 ? 's' : ''}
                    {m.utilisateurs.length > 0 &&
                      ` · ${m.utilisateurs.length} utilisateur${m.utilisateurs.length > 1 ? 's' : ''}`}
                  </p>
                  <p className="mt-1 text-[12px] text-g-500">
                    {m.sauvegarde.derniere === '—'
                      ? m.sauvegarde.frequence
                      : `Sauvegarde ${relatif(m.sauvegarde.derniere, maintenant)}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-g-700">
                    Le moteur est disponible sur ce serveur mais n’est pas installé. L’activer crée
                    le service, ouvre son port local et l’ajoute au plan de sauvegarde.
                  </p>
                  <BoutonAction
                    libelle={`Activer ${MOTEUR_WEB_LABEL[m.moteur]}`}
                    className="mt-3"
                    icone={<Plus size={13} />}
                    operation={{
                      action: 'service.admin',
                      titre: `${MOTEUR_WEB_LABEL[m.moteur]} en cours d’activation`,
                      detail: `Sur ${m.serveur}. Aucun redémarrage du serveur web n’est nécessaire.`,
                      appel: () => modifierRessource('/web/bases', m.id, { actif: true }),
                      job: { workflow: 'web.db.enable', cible: `${MOTEUR_WEB_LABEL[m.moteur]} · ${m.serveur}` },
                      effetFinal: () => {
                        if (estActif()) {
                          serveurs.recharger()
                          return
                        }
                        serveurs.modifier(m.id, { actif: true })
                      },
                    }}
                  />
                </>
              )}
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader
          titre="Ce que ces moteurs savent faire, et ce qu’ils ne savent pas faire"
          sousTitre="Mieux vaut le savoir avant de bâtir dessus."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              t: 'Compris dans l’hébergement',
              d: 'Aucun supplément : le moteur, ses sauvegardes quotidiennes et sa restauration sont dans le prix du palier.',
            },
            {
              t: 'Pas de haute disponibilité',
              d: 'Un seul processus, sur un seul serveur. Si la machine redémarre, la base redémarre avec elle.',
            },
            {
              t: 'Pas de réplique de lecture',
              d: 'Un rapport lourd pèse sur le même moteur que le site. Au-delà, une base managée sépare les deux.',
            },
          ].map((c) => (
            <div key={c.t} className="rounded-[8px] border border-g-300 bg-g-050 p-3">
              <p className="flex items-center gap-1.5 text-p-700">
                <Database size={14} />
              </p>
              <p className="mt-1.5 text-[13px] font-bold text-ink">{c.t}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-g-700">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-g-500">
          Besoin de {num(3)} répliques, d’une bascule automatique ou d’une restauration à l’instant
          près ?{' '}
          <Link href="/app/bases" className="font-semibold text-p-700 hover:underline">
            Les bases managées
          </Link>{' '}
          répondent à ce besoin.
        </p>
      </Card>
    </div>
  )
}
