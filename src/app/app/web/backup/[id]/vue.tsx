'use client'

import { useState } from 'react'
import { Download, Lock, Play, RotateCcw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, dateHeure, relatif } from '@/lib/format'
import { SITE_LABEL, type WebHosting } from '@/lib/types'
import {
  HEBERGEMENTS,
  SAUVEGARDES_WEB,
  hebergementById,
  sauvegardeWebById,
  type SauvegardeWeb,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { PageHeader, Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { Stepper } from '@/components/composition/flow'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, useOperation } from '@/components/app/actions'
import { estActif, requete } from '@/lib/api/client'

const ONGLETS = [
  { id: 'executions', label: 'Exécutions' },
  { id: 'plan', label: 'Réglages du plan' },
  { id: 'restauration', label: 'Restaurer' },
]

const ETAPES = [
  { numero: 1, titre: 'Quoi' },
  { numero: 2, titre: 'Quand' },
  { numero: 3, titre: 'Où' },
  { numero: 4, titre: 'Récapitulatif' },
]

/** Le libellé du périmètre choisi vers la granularité du contrat. */
function granulariteDu(perimetre: string): 'complete' | 'fichiers' | 'base' | 'boite_mail' {
  if (perimetre === 'Le serveur entier') return 'complete'
  if (perimetre === 'Une base seule') return 'base'
  if (perimetre === 'Une boîte aux lettres') return 'boite_mail'
  return 'fichiers'
}

export function VueSauvegarde({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const [onglet, setOnglet] = useState('executions')
  const [etape, setEtape] = useState(1)
  const [perimetre, setPerimetre] = useState('Une application')
  const [pointChoisi, setPointChoisi] = useState<string | null>(null)
  const [destination, setDestination] = useState('À côté, sur le même serveur')
  const executer = useOperation()

  const collection = useCollection<SauvegardeWeb>('sauvegardes-web', SAUVEGARDES_WEB)
  const hebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const p = estActif() ? collection.items.find((s) => s.id === id) : sauvegardeWebById(id)
  if (!p) return null
  const h = estActif()
    ? hebergements.items.find((x) => x.id === p.hebergementId)
    : hebergementById(p.hebergementId)
  const dernier = p.executions[0]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Sauvegardes', href: '/app/web/backup' },
          { label: p.nomServi },
        ]}
        titre={<span className="break-words font-mono">{p.nomServi}</span>}
        sousTitre={`Plan de sauvegarde de ${p.serveur}. Une exécution prend les fichiers, les bases, la configuration${p.perimetre.messagerie ? ' et la messagerie' : ''} en une seule passe cohérente.`}
        meta={
          <>
            <Badge tone={p.actif ? 'ok' : 'neutral'} dot={p.actif}>
              {p.actif ? 'Actif' : 'Suspendu'}
            </Badge>
            <Badge tone="neutral">{p.frequence} à {p.heure}</Badge>
            <Badge tone="neutral">Rétention {p.retentionJours} j</Badge>
            {p.immuable && (
              <Badge tone="ok">
                <Lock size={10} className="mr-1 inline" />
                Immuable
              </Badge>
            )}
            <Badge tone="violet">{SITE_LABEL[p.site]}</Badge>
          </>
        }
        actions={
          <>
            <BoutonAction
              libelle="Sauvegarder maintenant"
              size="md"
              icone={<Play size={14} />}
              operation={{
                action: 'backup.plan.write',
                ton: 'info',
                titre: 'Sauvegarde lancée',
                detail: `Exécution hors planning sur ${p.serveur}. Suivi dans le centre de tâches.`,
                appel: () =>
                  requete(`/web/backup/${encodeURIComponent(p.id)}/execution`, {
                    methode: 'POST',
                  }),
                job: { workflow: 'web.backup.run', cible: p.serveur },
              }}
            />
            {h && (
              <ButtonLink href={`/app/web/hebergement/${h.id}`} variant="ghost">
                Le serveur
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Dernière exécution"
          valeur={dernier ? relatif(dernier.ts, maintenant) : '—'}
          detail={dernier?.taille}
          ton={dernier?.statut === 'ok' ? 'ok' : 'warn'}
        />
        <StatTile
          libelle="Espace conservé"
          valeur={`${p.espaceOccupeGo.toFixed(1)} Go`}
          detail={`${p.executions.length} copies sous rétention`}
        />
        <StatTile
          libelle="Point de restauration le plus ancien"
          valeur={p.executions.length > 0 ? dateCourte(p.executions[p.executions.length - 1].ts) : '—'}
        />
        <StatTile
          libelle="Dernier test de restauration"
          valeur={p.dernierTestRestauration ? dateCourte(p.dernierTestRestauration.date) : 'jamais'}
          detail={
            p.dernierTestRestauration ? `${p.dernierTestRestauration.dureeMin} min` : 'à programmer'
          }
          ton={p.dernierTestRestauration?.resultat === 'ok' ? 'ok' : 'warn'}
        />
      </div>

      {!p.dernierTestRestauration && (
        <Callout ton="warn" titre="Aucun test de restauration sur ce plan">
          Une sauvegarde qu’on n’a jamais restaurée est une hypothèse, pas une garantie. Programmez
          un test : il restaure dans un environnement isolé, sans toucher la production.
        </Callout>
      )}

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'executions' && (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Exécution', 'État', 'Taille', 'Durée', 'Contenu', 'Immuable jusqu’au', ''].map(
                    (c) => (
                      <th
                        key={c}
                        className="type-micro px-3 py-2 text-left font-semibold text-g-500"
                      >
                        {c}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {p.executions.map((e) => (
                  <tr key={e.id} className="border-b border-g-100 last:border-0 align-top">
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{dateHeure(e.ts)}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={e.statut === 'ok' ? 'ok' : e.statut === 'partielle' ? 'warn' : 'err'}
                        size="sm"
                      >
                        {e.statut === 'ok' ? 'OK' : e.statut === 'partielle' ? 'Partielle' : 'Échec'}
                      </Badge>
                      {e.message && (
                        <p className="mt-1 max-w-[46ch] text-[11px] leading-snug text-g-700">
                          {e.message}
                        </p>
                      )}
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{e.taille}</td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{e.dureeMin} min</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-500">{e.contenu.join(' · ')}</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">
                      {e.immuableJusqua ? (
                        <span className="flex items-center gap-1">
                          <Lock size={11} className="text-ok" />
                          {e.immuableJusqua}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="flex items-center justify-end gap-1.5">
                        <BoutonAction
                          libelle="Restaurer"
                          variant="ghost"
                          icone={<RotateCcw size={12} />}
                          operation={{
                            action: 'backup.restore',
                            ton: 'info',
                            titre: `Restauration du ${dateHeure(e.ts)}`,
                            detail: e.contenu.join(' · '),
                            appel: () =>
                              requete(`/web/backup/${encodeURIComponent(p.id)}/restauration`, {
                                methode: 'POST',
                                corps: {
                                  executionId: e.id,
                                  granularite: granulariteDu(perimetre),
                                  cible: 'preproduction',
                                },
                              }),
                            job: { workflow: 'web.backup.restore', cible: `${perimetre.toLowerCase()}` },
                          }}
                          confirmation={
                            e.statut === 'ok'
                              ? undefined
                              : {
                                  ressource: dateCourte(e.ts),
                                  titre: 'Restaurer depuis une sauvegarde incomplète ?',
                                  pertes: [
                                    e.message ?? 'Cette exécution ne s’est pas terminée normalement',
                                    'Le contenu restauré peut être partiel',
                                  ],
                                  libelleAction: 'Restaurer quand même',
                                }
                          }
                        />
                        <BoutonAction
                          libelle="Télécharger"
                          variant="ghost"
                          icone={<Download size={12} />}
                          operation={{
                            action: 'backup.restore',
                            ton: 'info',
                            titre: `Archive du ${dateCourte(e.ts)} préparée`,
                            detail: `${e.taille} · lien signé valable une heure`,
                            sansApi:
                              'Indisponible : aucun lien de téléchargement signé n’est encore généré par l’API.',
                          }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {onglet === 'plan' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Planification"
              sousTitre="L’heure est celle du serveur, à Abidjan. Une exécution quotidienne suffit à la plupart des sites ; au-delà, il faut une réplication."
            />
            <div className="space-y-3">
              <Field label="Fréquence">
                <Select
                  defaultValue={p.frequence}
                  onChange={(e) =>
                    executer({
                      action: 'backup.plan.write',
                      titre: `Fréquence changée : ${e.target.value}`,
                      detail: `${p.nomServi} passe en sauvegarde ${e.target.value}.`,
                      appel: () =>
                        requete(`/web/backup/${encodeURIComponent(p.id)}`, {
                          methode: 'PATCH',
                          corps: { frequence: e.target.value },
                        }),
                      effet: () => collection.modifier(p.id, { frequence: e.target.value as SauvegardeWeb['frequence'] }),
                      effetFinal: () => collection.recharger(),
                    })
                  }
                >
                  <option value="quotidienne">Quotidienne</option>
                  <option value="bihebdomadaire">Deux fois par semaine</option>
                  <option value="hebdomadaire">Hebdomadaire</option>
                </Select>
              </Field>
              <Field label="Heure" hint="hors heures de trafic">
                <Input
                  defaultValue={p.heure}
                  onBlur={(e) => {
                    if (e.target.value === p.heure) return
                    executer({
                      action: 'backup.plan.write',
                      titre: `Heure changée : ${e.target.value}`,
                      detail: `${p.nomServi} s’exécute désormais à ${e.target.value}.`,
                      appel: () =>
                        requete(`/web/backup/${encodeURIComponent(p.id)}`, {
                          methode: 'PATCH',
                          corps: { heure: e.target.value },
                        }),
                      effet: () => collection.modifier(p.id, { heure: e.target.value }),
                      effetFinal: () => collection.recharger(),
                    })
                  }}
                />
              </Field>
              <Field label="Rétention" hint="au-delà, les copies sont détruites automatiquement">
                <Select
                  defaultValue={String(p.retentionJours)}
                  onChange={(e) =>
                    executer({
                      action: 'backup.plan.write',
                      titre: `Rétention changée : ${e.target.value} jours`,
                      detail: `${p.nomServi} conserve désormais ${e.target.value} jours de copies.`,
                      appel: () =>
                        requete(`/web/backup/${encodeURIComponent(p.id)}`, {
                          methode: 'PATCH',
                          corps: { retentionJours: Number(e.target.value) },
                        }),
                      effet: () => collection.modifier(p.id, { retentionJours: Number(e.target.value) }),
                      effetFinal: () => collection.recharger(),
                    })
                  }
                >
                  <option value="7">7 jours</option>
                  <option value="14">14 jours</option>
                  <option value="30">30 jours</option>
                  <option value="90">90 jours</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Périmètre et destination"
              sousTitre="Ce qui entre dans l’exécution, et où la copie est écrite."
            />
            <div className="space-y-2">
              {(
                [
                  ['Fichiers du serveur', p.perimetre.fichiers],
                  ['Bases de données', p.perimetre.bases],
                  ['Configuration', p.perimetre.configuration],
                  ['Messagerie', p.perimetre.messagerie],
                ] as const
              ).map(([l, actif]) => (
                <div
                  key={l}
                  className="flex items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2"
                >
                  <span className="text-[13px] text-g-700">{l}</span>
                  <Badge tone={actif ? 'ok' : 'neutral'} size="sm">
                    {actif ? 'Inclus' : 'Exclu'}
                  </Badge>
                </div>
              ))}
            </div>
            <Switch
              className="mt-3"
              label="Copies immuables"
              description="Une copie écrite ne peut plus être altérée avant la fin de sa rétention, même par un compte administrateur compromis."
              checked={p.immuable}
              onChange={(valeur) =>
                executer({
                  action: 'backup.plan.write',
                  titre: valeur ? 'Copies immuables activées' : 'Copies immuables désactivées',
                  detail: `${p.nomServi} : ${valeur ? 'les copies écrites deviennent verrouillées jusqu’à la fin de leur rétention.' : 'les copies redeviennent modifiables.'}`,
                  appel: () =>
                    requete(`/web/backup/${encodeURIComponent(p.id)}`, {
                      methode: 'PATCH',
                      corps: { immuable: valeur },
                    }),
                  effet: () => collection.modifier(p.id, { immuable: valeur }),
                  effetFinal: () => collection.recharger(),
                })
              }
            />
            <KeyValueList
              className="mt-3 border-t border-g-100 pt-3"
              items={[
                { cle: 'Destination', valeur: p.destination },
                { cle: 'Site de la copie', valeur: SITE_LABEL[p.site] },
                {
                  cle: 'Site du serveur',
                  valeur: h ? SITE_LABEL[h.serveur.site] : '—',
                },
                { cle: 'Chiffrement', valeur: 'AES-256 au repos, TLS en transit' },
              ]}
            />
          </Card>
        </div>
      )}

      {onglet === 'restauration' && (
        <div className="space-y-4">
          <Stepper etapes={ETAPES} courante={etape} />

          <Card>
            {etape === 1 && (
              <>
                <CardHeader
                  titre="Que faut-il restaurer ?"
                  sousTitre="Plus le périmètre est étroit, plus la restauration est rapide et moins elle risque d’écraser du travail récent."
                />
                <div className="space-y-2">
                  {[
                    { l: 'Le serveur entier', d: 'Fichiers, bases et configuration. Pour un sinistre.' },
                    { l: 'Une application', d: 'Les fichiers d’un site et sa base. Le cas le plus courant.' },
                    { l: 'Une base seule', d: 'Restaurée à côté de l’originale, jamais par-dessus.' },
                    { l: 'Des fichiers précis', d: 'Arborescence parcourable, sélection fine.' },
                    ...(p.perimetre.messagerie
                      ? [{ l: 'Une boîte aux lettres', d: 'Un dossier ou la boîte entière.' }]
                      : []),
                  ].map((x) => (
                    <button
                      key={x.l}
                      type="button"
                      onClick={() => {
                        setPerimetre(x.l)
                        setEtape(2)
                      }}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-[6px] border px-3 py-2.5 text-left transition-colors',
                        perimetre === x.l
                          ? 'border-p-600 bg-p-050'
                          : 'border-g-300 hover:border-p-400 hover:bg-p-050',
                      )}
                    >
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-p-700" />
                      <span>
                        <span className="block text-[13px] font-semibold text-ink">{x.l}</span>
                        <span className="block text-[12px] text-g-500">{x.d}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {etape === 2 && (
              <>
                <CardHeader
                  titre="À quel moment ?"
                  sousTitre="Chaque exécution est un point de restauration distinct."
                />
                <div className="space-y-2">
                  {p.executions.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setPointChoisi(e.id)
                        setEtape(3)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-[6px] border px-3 py-2.5 text-left transition-colors',
                        pointChoisi === e.id
                          ? 'border-p-600 bg-p-050'
                          : 'border-g-300 hover:border-p-400 hover:bg-p-050',
                      )}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold text-ink">
                          {dateHeure(e.ts)}
                        </span>
                        <span className="block text-[12px] text-g-500">
                          {e.taille} · {e.contenu.join(' · ')}
                        </span>
                      </span>
                      <Badge tone={e.statut === 'ok' ? 'ok' : 'warn'} size="sm">
                        {e.statut === 'ok' ? 'Complète' : 'Partielle'}
                      </Badge>
                    </button>
                  ))}
                </div>
              </>
            )}

            {etape === 3 && (
              <>
                <CardHeader
                  titre="Où écrire la restauration ?"
                  sousTitre="Écrire par-dessus la production est le seul choix irréversible du parcours."
                />
                <div className="space-y-2">
                  {[
                    {
                      l: 'À côté, sur le même serveur',
                      d: 'Recommandé. Vous comparez, puis vous basculez vous-même.',
                      ton: 'ok' as const,
                    },
                    {
                      l: 'Sur un autre hébergement',
                      d: 'Utile pour reconstruire sans toucher au serveur d’origine.',
                      ton: 'neutral' as const,
                    },
                    {
                      l: 'Par-dessus la production',
                      d: 'Écrase les données actuelles. Demande la saisie du nom du serveur.',
                      ton: 'err' as const,
                    },
                    {
                      l: 'Téléchargement local',
                      d: 'Archive chiffrée, lien valable 24 heures.',
                      ton: 'neutral' as const,
                    },
                  ].map((x) => (
                    <button
                      key={x.l}
                      type="button"
                      onClick={() => {
                        setDestination(x.l)
                        setEtape(4)
                      }}
                      className={cn(
                        'flex w-full items-start justify-between gap-2 rounded-[6px] border px-3 py-2.5 text-left transition-colors',
                        destination === x.l
                          ? 'border-p-600 bg-p-050'
                          : x.ton === 'err'
                            ? 'border-err/40 hover:bg-err-bg'
                            : 'border-g-300 hover:border-p-400 hover:bg-p-050',
                      )}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold text-ink">{x.l}</span>
                        <span className="block text-[12px] text-g-500">{x.d}</span>
                      </span>
                      {x.ton === 'err' && (
                        <Badge tone="err" size="sm">
                          Irréversible
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {etape === 4 && (
              <>
                <CardHeader
                  titre="Récapitulatif"
                  sousTitre="Relisez avant de lancer : une restauration est une opération d’exploitation, pas un clic."
                />
                <KeyValueList
                  items={[
                    { cle: 'Périmètre', valeur: `${perimetre} — ${p.serveur}` },
                    {
                      cle: 'Point de restauration',
                      valeur: (() => {
                        const point = p.executions.find((e) => e.id === pointChoisi) ?? dernier
                        return point ? dateHeure(point.ts) : '—'
                      })(),
                    },
                    { cle: 'Destination', valeur: destination },
                    { cle: 'Durée estimée', valeur: '6 à 9 minutes' },
                    {
                      cle: 'Impact sur la production',
                      valeur: destination.startsWith('Par-dessus') ? 'Écrasement des données actuelles' : 'Aucun',
                    },
                  ]}
                />
                <BoutonAction
                  libelle="Lancer la restauration"
                  variant="primary"
                  size="md"
                  className="mt-4"
                  operation={{
                    action: 'backup.restore',
                    ton: 'info',
                    titre: 'Restauration lancée',
                    detail: 'Suivi dans le centre de tâches. Vous serez notifié à la fin.',
                    // Écrire par-dessus la production exige la confirmation par
                    // le nom du serveur, déjà saisie dans le dialogue.
                    appel: () =>
                      requete(`/web/backup/${encodeURIComponent(p.id)}/restauration`, {
                        methode: 'POST',
                        corps: {
                          executionId: pointChoisi ?? dernier?.id,
                          granularite: granulariteDu(perimetre),
                          cible: destination.startsWith('Par-dessus')
                            ? 'origine'
                            : 'preproduction',
                          ...(destination.startsWith('Par-dessus')
                            ? { confirmation: p.serveur }
                            : {}),
                        },
                      }),
                    job: { workflow: 'web.backup.restore', cible: `${perimetre.toLowerCase()}` },
                    effetFinal: () => setEtape(1),
                  }}
                  confirmation={
                    destination.startsWith('Par-dessus')
                      ? {
                          ressource: p.serveur,
                          titre: 'Restaurer par-dessus la production ?',
                          pertes: [
                            'Les données actuelles du périmètre choisi seront écrasées',
                            'Le travail postérieur au point de restauration sera perdu',
                            'Le service sera indisponible pendant l’opération',
                          ],
                          libelleAction: 'Écraser et restaurer',
                        }
                      : undefined
                  }
                />
              </>
            )}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-g-100 pt-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={etape === 1}
                onClick={() => setEtape((e) => Math.max(1, e - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={etape === 4}
                onClick={() => setEtape((e) => Math.min(4, e + 1))}
              >
                Suivant
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
