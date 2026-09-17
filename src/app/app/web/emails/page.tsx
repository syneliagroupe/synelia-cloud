'use client'

import Link from 'next/link'
import { Mail, Plus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money } from '@/lib/format'
import {
  DOMAINES,
  MESSAGERIES,
  domainesDeLOrg,
  messageriesDeLOrg,
  type MessagerieDomaine,
} from '@/lib/mock'
import type { Domaine } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

/**
 * Une carte « à activer » pour un domaine du portefeuille qui n'a encore aucun
 * enregistrement `web_messagerie` — le cas normal d'un domaine tout juste
 * enregistré. Sans cette carte, un domaine réel n'apparaît dans cette liste
 * qu'après un premier appel à `POST /web/emails`, ce qui n'a lieu que si le
 * bouton « Activer » existe déjà — cercle vicieux qui rendait la messagerie
 * inaccessible à tout domaine créé après le jeu de données figé.
 */
/** Les clés reprennent celles de `PALIERS` côté backend (`web_emails/service.py`) : le
 * libellé affiché à l'écran n'est pas la valeur envoyée à l'API. */
const PALIER_LABEL: Record<string, string> = {
  starter: 'Essentiel · 5 Go par boîte',
  pro: 'Pro · 25 Go par boîte',
  business: 'Archivage · 100 Go par boîte',
}

function messagerieDefaut(domaine: string): MessagerieDomaine {
  return {
    id: `nouveau:${domaine}`,
    domaine,
    actif: false,
    palier: 'pro',
    solutionOSS: 'zimbra',
    hoteWebmail: 'webmail.synelia.cloud',
    boites: [],
    boitesIncluses: 25,
    alias: [],
    redirections: [],
    authentification: { spf: 'absent', dkim: 'absent', dmarc: '' },
    antispam: { actif: true, niveau: 'standard', quarantaine: 0 },
    prixSiege: 800,
  }
}

export default function ListeMessageries() {
  const { autorise, refus } = useApp()
  const collection = useCollection<MessagerieDomaine>('messageries', MESSAGERIES)
  const domaines = useCollection<Domaine>('domaines', DOMAINES)
  const perimetre = new Set(messageriesDeLOrg().map((m) => m.id))
  const scopeMessageries = estActif()
    ? collection.items
    : collection.items.filter((m) => perimetre.has(m.id))
  const scopeDomaines = estActif() ? domaines.items : domainesDeLOrg()
  const nomsAvecMessagerie = new Set(scopeMessageries.map((m) => m.domaine))
  const messageries = [
    ...scopeMessageries,
    ...scopeDomaines.filter((d) => !nomsAvecMessagerie.has(d.nom)).map((d) => messagerieDefaut(d.nom)),
  ]
  const actives = messageries.filter((m) => m.actif)
  const boites = actives.reduce((a, m) => a + m.boites.length, 0)
  const stockage = actives.reduce((a, m) => a + m.boites.reduce((x, b) => x + b.utiliseGo, 0), 0)
  const sansAuth = actives.filter((m) => m.authentification.dmarc === 'p=none')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'Messagerie' },
        ]}
        titre="Messagerie"
        sousTitre="Une messagerie par domaine : boîtes, alias, redirections, antispam et authentification d’expédition. Le courrier se lit dans le webmail, jamais ici."
      />

      {sansAuth.length > 0 && (
        <Callout ton="warn" titre={`${sansAuth.length} domaine en DMARC permissif`}>
          {sansAuth.map((m) => (
            <span key={m.id} className="mr-3 inline-block">
              <Link href={`/app/web/emails/${m.id}`} className="font-mono font-semibold underline">
                {m.domaine}
              </Link>
            </span>
          ))}
          <span className="mt-1 block">
            En <span className="font-mono">p=none</span>, un tiers peut usurper votre domaine sans
            que rien ne le rejette. Passez en <span className="font-mono">quarantine</span> après
            avoir vérifié vos rapports.
          </span>
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Domaines actifs" valeur={actives.length} detail={`sur ${messageries.length}`} />
        <StatTile libelle="Boîtes aux lettres" valeur={boites} />
        <StatTile libelle="Stockage" valeur={`${stockage.toFixed(0)} Go`} detail="toutes boîtes" />
        <StatTile
          libelle="En quarantaine"
          valeur={actives.reduce((a, m) => a + m.antispam.quarantaine, 0)}
          detail="messages retenus"
          ton="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {messageries.map((m) => {
          const utilise = m.boites.reduce((a, b) => a + b.utiliseGo, 0)
          const total = m.boites.reduce((a, b) => a + b.quotaGo, 0)
          return (
            <Card key={m.id} className={cn(!m.actif && 'border-dashed')}>
              <CardHeader
                titre={
                  m.id.startsWith('nouveau:') ? (
                    <span className="font-mono text-[14px] text-ink">{m.domaine}</span>
                  ) : (
                    <Link
                      href={`/app/web/emails/${m.id}`}
                      className="font-mono text-[14px] hover:text-p-700"
                    >
                      {m.domaine}
                    </Link>
                  )
                }
                sousTitre={
                  m.actif
                    ? `${m.solutionOSS} · ${PALIER_LABEL[m.palier] ?? m.palier} · webmail sur ${m.hoteWebmail}`
                    : `Messagerie non activée · ${money(m.prixSiege)} par boîte et par mois`
                }
                actions={
                  <Badge tone={m.actif ? 'ok' : 'neutral'} size="sm" dot={m.actif}>
                    {m.actif ? 'Active' : 'À activer'}
                  </Badge>
                }
              />

              {m.actif ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { l: 'Boîtes', v: `${m.boites.length}/${m.boitesIncluses}` },
                      { l: 'Alias', v: m.alias.length },
                      { l: 'Redirections', v: m.redirections.length },
                    ].map((x) => (
                      <div key={x.l} className="rounded-[6px] bg-g-050 px-2 py-2">
                        <p className="type-micro text-g-500">{x.l}</p>
                        <p className="tnum mt-0.5 text-[15px] font-bold text-ink">{x.v}</p>
                      </div>
                    ))}
                  </div>
                  <QuotaBar
                    className="mt-3"
                    libelle="Stockage utilisé"
                    utilise={utilise}
                    total={total}
                    compact
                    formateur={(v) => `${v.toFixed(0)} Go`}
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-g-100 pt-3">
                    {(['spf', 'dkim'] as const).map((k) => (
                      <Badge
                        key={k}
                        tone={m.authentification[k] === 'valide' ? 'ok' : 'err'}
                        size="sm"
                      >
                        {k.toUpperCase()} {m.authentification[k] === 'valide' ? 'valide' : 'absent'}
                      </Badge>
                    ))}
                    <Badge
                      tone={m.authentification.dmarc.includes('none') ? 'warn' : 'ok'}
                      size="sm"
                    >
                      DMARC {m.authentification.dmarc}
                    </Badge>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[12.5px] leading-relaxed text-g-700">
                    L’activation crée les boîtes, pose les enregistrements MX, SPF, DKIM et DMARC
                    dans la zone, et déclare le client SSO. Aucun courrier existant n’est touché :
                    si vous migrez d’un autre fournisseur, l’import se fait après vérification.
                  </p>
                  <BoutonFormulaire
                    libelle="Activer la messagerie"
                    className="mt-3"
                    icone={<Plus size={13} />}
                    action="service.admin"
                    titre={`Activer la messagerie de ${m.domaine}`}
                    description="L’activation pose les enregistrements MX, SPF, DKIM et DMARC dans la zone et déclare le client SSO. Aucun courrier existant n’est touché."
                    champs={[
                      { id: 'boites', label: 'Boîtes à créer', type: 'nombre', demi: true, min: 1, max: 200 },
                      {
                        id: 'palier',
                        label: 'Palier',
                        type: 'select',
                        demi: true,
                        options: [
                          { value: 'starter', label: 'Essentiel · 5 Go par boîte' },
                          { value: 'pro', label: 'Pro · 25 Go par boîte' },
                          { value: 'business', label: 'Archivage · 100 Go par boîte' },
                        ],
                      },
                      { id: 'import', label: 'Importer depuis un autre fournisseur', type: 'switch', placeholder: 'Après vérification' },
                    ]}
                    valeursDepart={{ boites: 5, palier: 'pro' }}
                    libelleValider="Activer"
                    operation={(v) => ({
                      titre: `Messagerie de ${m.domaine} en cours d’activation`,
                      detail: `${v.boites} boîte(s) · ${PALIER_LABEL[String(v.palier)] ?? v.palier}`,
                      appel: () =>
                        creerRessource('/web/emails', {
                          domaine: m.domaine,
                          palier: String(v.palier),
                          boites: Number(v.boites),
                          ...(v.import ? { migrationDepuis: 'fournisseur actuel' } : {}),
                        }),
                      job: { workflow: 'web.email.activate', cible: m.domaine },
                      effetFinal: () => {
                        if (estActif()) {
                          collection.recharger()
                          return
                        }
                        const patch = { actif: true, palier: String(v.palier), boitesIncluses: Number(v.boites) }
                        if (m.id.startsWith('nouveau:')) {
                          collection.creer({
                            ...messagerieDefaut(m.domaine),
                            ...patch,
                            id: collection.identifiant('mail'),
                          })
                        } else {
                          collection.modifier(m.id, patch)
                        }
                      },
                    })}
                  />
                </>
              )}
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader
          titre="Ce que le portail règle, et ce qui se passe dans le webmail"
          sousTitre="La frontière est nette, et elle ne bougera pas."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[8px] border border-g-300 bg-g-050 p-3">
            <p className="flex items-center gap-1.5 text-p-700">
              <ShieldCheck size={14} />
              <span className="text-[12.5px] font-bold text-ink">Ici, dans le portail</span>
            </p>
            <ul className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-g-700">
              {[
                'Créer, suspendre et supprimer des boîtes',
                'Quotas, alias, redirections, attrape-tout',
                'Niveau d’antispam et quarantaine',
                'SPF, DKIM, DMARC et leur vérification',
                'Sauvegarde et restauration d’une boîte',
              ].map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[8px] border border-g-300 bg-white p-3">
            <p className="flex items-center gap-1.5 text-p-700">
              <Mail size={14} />
              <span className="text-[12.5px] font-bold text-ink">Là-bas, dans le webmail</span>
            </p>
            <ul className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-g-700">
              {[
                'Lire, écrire et classer son courrier',
                'Agenda, contacts, tâches partagées',
                'Règles de tri personnelles, signatures',
                'Recherche dans ses messages',
              ].map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-g-500">
              Nous ne reconstruisons pas un client de messagerie : celui de la solution est
              incomparablement plus riche que ce que nous pourrions écrire.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
