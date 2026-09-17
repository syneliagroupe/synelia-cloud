'use client'

import { useState } from 'react'
import { Download, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateCourte, money } from '@/lib/format'
import {
  CERTIFICATS,
  TYPE_CERTIFICAT_LABEL,
  hebergementById,
  joursAvant,
  nomServi,
  type Certificat,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Switch } from '@/components/ui/field'
import { PageHeader, Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { CarteAbonnement } from '@/components/business/abonnement'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, useOperation } from '@/components/app/actions'
import { estActif, modifierRessource, requete, supprimerRessource } from '@/lib/api/client'

const ONGLETS = [
  { id: 'apercu', label: 'Vue d’ensemble' },
  { id: 'chaine', label: 'Chaîne & validation' },
  { id: 'historique', label: 'Historique' },
]

export function VueCertificat({ id }: { id: string }) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const certificats = useCollection<Certificat>('certificats', CERTIFICATS)
  const [onglet, setOnglet] = useState('apercu')

  const c = certificats.items.find((x) => x.id === id)
  // Le hook est appelé avant tout retour anticipé : un `useState` conditionnel
  // décale l'ordre des hooks entre deux rendus et React perd son état.
  if (!c) return null
  const auto = c.renouvellementAuto
  const jours = joursAvant(c.expire)
  const h = c.hebergementId ? hebergementById(c.hebergementId) : undefined
  const couverts = [c.hote, ...(c.hotesSupplementaires ?? [])]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'SSL', href: '/app/web/ssl' },
          { label: c.hote },
        ]}
        titre={<span className="break-words font-mono">{c.hote}</span>}
        sousTitre={`${TYPE_CERTIFICAT_LABEL[c.type]} émis par ${c.emetteur}${h ? `, posé sur ${nomServi(h)}` : ''}.`}
        meta={
          <>
            <Badge
              tone={c.etat === 'actif' ? 'ok' : c.etat === 'en_emission' ? 'info' : 'err'}
              dot={c.etat === 'actif'}
            >
              {c.etat === 'actif' ? 'Actif' : c.etat === 'en_emission' ? 'En émission' : 'Expiré'}
            </Badge>
            <Badge tone="neutral">{c.algorithme}</Badge>
            <Badge tone={c.prixAnnuel === 0 ? 'ok' : 'violet'}>
              {c.prixAnnuel === 0 ? 'Inclus' : `${money(c.prixAnnuel)} / an`}
            </Badge>
            {!auto && <Badge tone="err">Renouvellement manuel</Badge>}
          </>
        }
        actions={
          <>
            <BoutonAction
              libelle="Renouveler maintenant"
              size="md"
              icone={<RotateCcw size={14} />}
              operation={{
                action: 'service.admin',
                ton: 'info',
                titre: 'Renouvellement lancé',
                appel: () =>
                  requete(`/web/ssl/${encodeURIComponent(c.id)}/renouvellement`, {
                    methode: 'POST',
                  }),
                effet: () => certificats.modifier(c.id, { etat: 'en_emission' }),
                job: { workflow: 'web.ssl.renew', cible: c.hote },
                effetFinal: () => {
                  if (estActif()) {
                    certificats.recharger()
                    return
                  }
                  certificats.modifier(c.id, {
                    etat: 'actif',
                    emisLe: MAINTENANT.slice(0, 10),
                    expire: '2026-11-17',
                  })
                },
              }}
            />
            <BoutonAction
              libelle="Télécharger"
              variant="ghost"
              size="md"
              icone={<Download size={14} />}
              operation={{
                ton: 'info',
                titre: `Certificat de ${c.hote} téléchargé`,
                detail: 'Chaîne complète au format PEM. La clé privée reste dans le coffre.',
              }}
            />
          </>
        }
      />

      {!auto && c.etat === 'actif' && (
        <Callout ton="err" titre="Ce certificat ne se renouvellera pas seul">
          Dans {jours} jours, les navigateurs afficheront un avertissement de sécurité sur{' '}
          <span className="font-mono">{c.hote}</span> et la plupart des visiteurs partiront. Activez
          le renouvellement automatique, ou notez l’échéance quelque part de fiable.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Jours restants"
          valeur={jours}
          detail={dateCourte(c.expire)}
          ton={jours <= 14 ? 'err' : jours <= 30 ? 'warn' : 'ok'}
        />
        <StatTile libelle="Hôtes couverts" valeur={couverts.length} detail={c.type === 'wildcard' ? 'joker' : 'nominatifs'} />
        <StatTile libelle="Validation" valeur={c.validationDomaine.toUpperCase()} detail="preuve de contrôle" />
        <StatTile
          libelle="Renouvellement"
          valeur={auto ? 'Automatique' : 'Manuel'}
          ton={auto ? 'ok' : 'err'}
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'apercu' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader
                titre="Ce que ce certificat couvre"
                sousTitre={
                  c.type === 'wildcard'
                    ? 'Un joker couvre tous les sous-domaines d’un niveau, y compris ceux créés après son émission.'
                    : 'Un certificat nominatif ne couvre que les hôtes qui y figurent.'
                }
              />
              <ul className="space-y-1.5">
                {couverts.map((x) => (
                  <li
                    key={x}
                    className="flex items-center gap-2 rounded-[6px] border border-g-300 px-2.5 py-1.5"
                  >
                    <ShieldCheck size={13} className="shrink-0 text-ok" />
                    <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-ink">
                      {x}
                    </span>
                  </li>
                ))}
              </ul>
              {c.type === 'wildcard' && (
                <Callout ton="warn" className="mt-3" titre="Un joker se partage, donc se perd ensemble">
                  La même clé privée sert tous les sous-domaines. Si un serveur est compromis, il
                  faut révoquer et réémettre pour tous. C’est le prix de la commodité.
                </Callout>
              )}
            </Card>

            <Card>
              <CardHeader
                titre="Renouvellement"
                sousTitre="Un certificat expiré coupe le site plus sûrement qu’une panne : les navigateurs refusent la connexion."
              />
              <Switch
                label="Renouveler automatiquement"
                description={
                  c.prixAnnuel === 0
                    ? 'Réémission 30 jours avant l’échéance, sans intervention.'
                    : 'Réémission et refacturation 30 jours avant l’échéance.'
                }
                checked={auto}
                onChange={(v) =>
                  executer({
                    action: 'service.admin',
                    ton: v ? 'ok' : 'warn',
                    titre: v ? 'Renouvellement automatique activé' : 'Renouvellement automatique désactivé',
                    detail: v
                      ? 'Réémission 30 jours avant l’échéance.'
                      : 'À l’échéance, les navigateurs afficheront un avertissement de sécurité.',
                    appel: () => modifierRessource('/web/ssl', c.id, { renouvellementAuto: v }),
                    effet: () => certificats.modifier(c.id, { renouvellementAuto: v }),
                    effetFinal: () => certificats.recharger(),
                  })
                }
              />
              <KeyValueList
                className="mt-3 border-t border-g-100 pt-3"
                items={[
                  { cle: 'Émis le', valeur: dateCourte(c.emisLe) },
                  { cle: 'Expire le', valeur: dateCourte(c.expire) },
                  {
                    cle: 'Alerte',
                    valeur: '21 jours avant, par e-mail et notification',
                  },
                  {
                    cle: 'Coût',
                    valeur: c.prixAnnuel === 0 ? 'Inclus dans l’hébergement' : `${money(c.prixAnnuel)} par an`,
                  },
                ]}
              />
            </Card>
          </div>

          <div className="space-y-4">
            {c.prixAnnuel > 0 && (
              <CarteAbonnement
                offre={TYPE_CERTIFICAT_LABEL[c.type]}
                debut={c.emisLe}
                echeance={c.expire}
                joursRestants={jours}
                renouvellementAuto={auto}
                frequence="Tous les ans"
              />
            )}

            <Card>
              <CardHeader titre="Actions" />
              <div className="space-y-2">
                <BoutonAction
                  libelle="Réémettre"
                  fullWidth
                  icone={<RotateCcw size={13} />}
                  operation={{
                    action: 'service.admin',
                    ton: 'info',
                    titre: `Réémission de ${c.hote}`,
                    detail: 'Une nouvelle clé est générée : l’ancienne cesse d’être utilisée.',
                    appel: () =>
                      requete(`/web/ssl/${encodeURIComponent(c.id)}/renouvellement`, {
                        methode: 'POST',
                      }),
                    effet: () => certificats.modifier(c.id, { etat: 'en_emission' }),
                    job: {
                      type: 'certificat.reissue',
                      label: `Réémission · ${c.hote}`,
                      etapes: ['Générer une nouvelle clé', 'Valider le domaine', 'Installer le certificat'],
                      dureeEtapeMs: 1100,
                    },
                    effetFinal: () => {
                      if (estActif()) {
                        certificats.recharger()
                        return
                      }
                      certificats.modifier(c.id, { etat: 'actif' })
                    },
                  }}
                />
                <BoutonAction
                  libelle="Télécharger la chaîne"
                  variant="ghost"
                  fullWidth
                  icone={<Download size={13} />}
                  operation={{
                    ton: 'info',
                    titre: 'Chaîne de certification téléchargée',
                    detail: 'Certificat, intermédiaires et racine, dans l’ordre attendu par un serveur.',
                  }}
                />
                <BoutonAction
                  libelle="Révoquer"
                  variant="danger"
                  fullWidth
                  icone={<Trash2 size={13} />}
                  operation={{
                    action: 'service.admin',
                    ton: 'err',
                    titre: `Certificat de ${c.hote} révoqué`,
                    detail: 'Le HTTPS est coupé sur les hôtes couverts jusqu’à l’émission d’un nouveau certificat.',
                    appel: () => supprimerRessource('/web/ssl', c.id, c.hote),
                    effet: () => certificats.modifier(c.id, { etat: 'revoque' }),
                    effetFinal: () => certificats.recharger(),
                  }}
                  confirmation={{
                    ressource: c.hote,
                    titre: 'Révoquer ce certificat ?',
                    pertes: [
                      `Le HTTPS sera coupé immédiatement sur ${couverts.length} hôte(s)`,
                      'Les navigateurs afficheront un avertissement de sécurité',
                      'La révocation est définitive : il faudra émettre un nouveau certificat',
                    ],
                    libelleAction: 'Révoquer le certificat',
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-g-500">
                Révoquer coupe immédiatement le HTTPS sur les hôtes couverts. À ne faire qu’en cas de
                clé privée compromise.
              </p>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'chaine' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Chaîne de confiance"
              sousTitre="Le navigateur remonte cette chaîne jusqu’à une racine qu’il connaît déjà. Une intermédiaire manquante casse la validation chez certains clients."
            />
            <ol className="space-y-2">
              {[
                { n: c.hote, r: 'Certificat du serveur', ok: true },
                { n: `${c.emetteur} — intermédiaire`, r: 'Autorité intermédiaire', ok: true },
                { n: c.type === 'letsencrypt' ? 'ISRG Root X1' : 'Sectigo Root', r: 'Racine, dans le magasin du navigateur', ok: true },
              ].map((x, i) => (
                <li key={x.n} className="flex gap-2.5">
                  <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-p-100 text-[11px] font-bold text-p-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[12px] font-semibold text-ink">
                      {x.n}
                    </span>
                    <span className="block text-[11px] text-g-500">{x.r}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <MicroLabel>Empreinte SHA-256</MicroLabel>
              <CopyField
                value="9f:2a:41:c8:7d:e3:55:b1:0a:64:9c:d2:88:31:af:70:12:be:44:6d:e9:07:53:a8:c1:2f:9b:60:4e:d7:38:15"
                mono
                className="mt-1"
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Validation du domaine"
              sousTitre={`Ce certificat se valide par ${c.validationDomaine.toUpperCase()}. C’est la preuve que vous contrôlez le nom.`}
            />
            {c.validationDomaine === 'dns' ? (
              <>
                <p className="text-[13px] leading-relaxed text-g-700">
                  Un enregistrement TXT est posé dans la zone, vérifié par l’autorité, puis retiré.
                  C’est la seule méthode possible pour un joker.
                </p>
                <CodeBlock
                  langue="dns"
                  code={`_acme-challenge.${c.hote.replace('*.', '')}. 60 IN TXT "gY7k2Qf…"`}
                  className="mt-3"
                />
              </>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-g-700">
                  Un fichier est déposé sur le serveur et lu par l’autorité en HTTP. Rapide, mais
                  impossible pour un joker et bloqué si le site force une redirection.
                </p>
                <CodeBlock
                  langue="bash"
                  code={`GET http://${c.hote}/.well-known/acme-challenge/gY7k2Qf…\n200 OK`}
                  className="mt-3"
                />
              </>
            )}
            <Callout ton="info" className="mt-3" titre="Rien à faire de votre côté">
              La zone étant chez nous, nous posons et retirons l’enregistrement automatiquement. Si
              vous rapatriez la zone ailleurs, la validation DNS demandera votre intervention.
            </Callout>
          </Card>
        </div>
      )}

      {onglet === 'historique' && (
        <Card padding={false}>
          <div className="border-b border-g-100 px-4 py-3">
            <p className="text-[13px] font-bold text-ink">Émissions successives</p>
            <p className="mt-0.5 text-[12px] text-g-500">
              Chaque renouvellement produit un nouveau certificat. L’ancien reste valide jusqu’à son
              échéance.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Émis le', 'Expire le', 'Déclencheur', 'Résultat'].map((x) => (
                    <th key={x} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { e: c.emisLe, x: c.expire, d: 'Renouvellement automatique', r: 'ok' },
                  { e: '2026-04-30', x: '2026-07-29', d: 'Renouvellement automatique', r: 'ok' },
                  { e: '2026-01-28', x: '2026-04-28', d: 'Renouvellement automatique', r: 'ok' },
                  { e: '2025-10-27', x: '2026-01-25', d: 'Première émission', r: 'ok' },
                ].map((l) => (
                  <tr key={l.e} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{dateCourte(l.e)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{dateCourte(l.x)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{l.d}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone="ok" size="sm">
                        Émis
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
