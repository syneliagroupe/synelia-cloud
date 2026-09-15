'use client'

import { useState } from 'react'
import { Download, File, Folder, KeyRound, Lock, Plus, RotateCw, Trash2 } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { MAINTENANT, dateCourte, dateHeure, goHumain, money, num } from '@/lib/format'
import { BUCKETS, CLES_S3, LOGS_EXECUTION } from '@/lib/mock'
import type { Bucket } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, MonoTextarea, Radio, Select, Slider, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { StatTile } from '@/components/composition/metrics'
import { LogPeek } from '@/components/business/observabilite'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource } from '@/lib/api/client'
import { CHAMPS_CLE, type CleS3 } from '../cles'

interface Entree {
  id: string
  type: 'dossier' | 'fichier'
  nom: string
  taille: number
  objets: number
}

interface RegleCycle {
  id: string
  nom: string
  prefixe: string
  action: string
  apres: string
}

const ONGLETS = [
  { id: 'objets', label: 'Objets' },
  { id: 'politique', label: 'Politique d’accès' },
  { id: 'versioning', label: 'Versioning' },
  { id: 'cycle', label: 'Cycle de vie' },
  { id: 'worm', label: 'Verrouillage d’objet' },
  { id: 'replication', label: 'Réplication' },
  { id: 'cles', label: 'Clés d’accès' },
  { id: 'journaux', label: 'Journaux d’accès' },
]

const ARBORESCENCE: Entree[] = [
  { id: 'e1', type: 'dossier', nom: '2026-08/', taille: 412_000, objets: 12_840 },
  { id: 'e2', type: 'dossier', nom: '2026-07/', taille: 398_000, objets: 12_412 },
  { id: 'e3', type: 'dossier', nom: '2026-06/', taille: 386_000, objets: 11_988 },
  { id: 'e4', type: 'fichier', nom: 'manifest.json', taille: 0.8, objets: 1 },
  { id: 'e5', type: 'fichier', nom: 'checksums.sha256', taille: 2.4, objets: 1 },
]

const REGLES_CYCLE: RegleCycle[] = [
  {
    id: 'rc1',
    nom: 'Transition vers la classe froide',
    prefixe: '2026-*/',
    action: 'Passer en classe froide',
    apres: '30 jours après création',
  },
  {
    id: 'rc2',
    nom: 'Expiration des versions non courantes',
    prefixe: '*',
    action: 'Supprimer les versions antérieures',
    apres: '90 jours',
  },
  {
    id: 'rc3',
    nom: 'Purge des téléversements incomplets',
    prefixe: '*',
    action: 'Abandonner les multipart incomplets',
    apres: '7 jours',
  },
]

export function VueBucket({ id }: { id: string }) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const seaux = useCollection<Bucket>('buckets', BUCKETS)
  const cles = useCollection<CleS3>('cles-s3', CLES_S3)
  const entrees = useCollection<Entree>(`objets-${id}`, ARBORESCENCE)
  const regles = useCollection<RegleCycle>(`cycle-${id}`, REGLES_CYCLE)
  const [onglet, setOnglet] = useState('objets')
  /** Identifiants renvoyés une seule fois à la création d’une clé S3. */
  const [secretS3, setSecretS3] = useState<{
    accessKeyId: string
    secret: string
    endpoint: string
  } | null>(null)

  const bucket = seaux.items.find((b) => b.id === id)

  if (!bucket) {
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Stockage objet S3', href: '/app/objet' },
            { label: 'Introuvable' },
          ]}
          titre="Bucket introuvable"
        />
        <EmptyState
          titre="Ce bucket n’existe pas ou plus"
          phrase="Il a peut-être été supprimé, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: 'Retour au stockage objet', href: '/app/objet' }}
        />
      </div>
    )
  }

  const prixGo = bucket.classe === 'chaud' ? 1.5 : 0.62

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Stockage objet S3', href: '/app/objet' },
          { label: bucket.nom },
        ]}
        titre={<span className="font-mono">{bucket.nom}</span>}
        sousTitre={`Région ${bucket.region} · classe ${bucket.classe === 'chaud' ? 'chaude' : 'froide'} · ${num(bucket.objets)} objets · ${goHumain(bucket.tailleGo)}`}
        meta={
          <>
            <Badge tone="neutral">{bucket.region}</Badge>
            <Badge tone={bucket.classe === 'chaud' ? 'violet' : 'neutral'}>
              {bucket.classe === 'chaud' ? 'Classe chaude' : 'Classe froide'}
            </Badge>
            {bucket.versioning && <Badge tone="ok">Versioning actif</Badge>}
            {bucket.objectLock?.actif && (
              <Badge tone="ok" dot>
                WORM {bucket.objectLock.retentionJours} j
              </Badge>
            )}
            {bucket.replication && (
              <Badge tone="violet">Réplication → {bucket.replication.cible}</Badge>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          libelle="Volume stocké"
          valeur={goHumain(bucket.tailleGo)}
          serie={seededSeries(`${id}-vol`, 24, bucket.tailleGo * 0.94, bucket.tailleGo)}
        />
        <StatTile libelle="Objets" valeur={num(bucket.objets)} />
        <StatTile
          libelle="Coût mensuel"
          valeur={money(Math.round(bucket.tailleGo * prixGo)).replace(' FCFA', '')}
          unite="FCFA"
          detail={`${money(Math.round(prixGo * 1000))} par To`}
        />
        <StatTile
          libelle="Trafic sortant du mois"
          valeur={goHumain(Math.round(bucket.tailleGo * 0.12))}
          detail={`Quota inclus : ${goHumain(bucket.classe === 'chaud' ? bucket.tailleGo : bucket.tailleGo * 0.2)}`}
          ton="ok"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {/* Objets */}
      {onglet === 'objets' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Navigateur d’objets"
              sousTitre="Navigation simple pour vérifier un contenu. Le portail n’est pas un explorateur de fichiers : utilisez aws-cli ou rclone pour les opérations de masse."
              actions={
                <BoutonFormulaire
                  libelle="Téléverser"
                  icone={<Plus size={13} />}
                  action="network.manage"
                  titre="Téléverser un objet"
                  description="Le portail dépose un fichier isolé pour vérifier une configuration ; il ne remplace pas un client S3. Pour un envoi de masse, aws-cli et rclone restent la bonne réponse."
                  champs={[
                    { id: 'cle', label: 'Clé de l’objet', placeholder: '2026-08/rapport.pdf', obligatoire: true },
                    { id: 'taille', label: 'Taille', type: 'nombre', demi: true, min: 1, suffixe: 'Mo' },
                  ]}
                  valeursDepart={{ taille: 4 }}
                  libelleValider="Téléverser"
                  operation={(v) => ({
                    titre: `${v.cle} téléversé`,
                    effet: () => {
                      entrees.creer({
                        id: entrees.identifiant('obj'),
                        type: 'fichier',
                        nom: String(v.cle),
                        taille: Number(v.taille) / 1024,
                        objets: 1,
                      })
                      seaux.modifier(bucket.id, (b) => ({
                        objets: b.objets + 1,
                        tailleGo: Math.round((b.tailleGo + Number(v.taille) / 1024) * 10) / 10,
                      }))
                    },
                  })}
                />
              }
            />
            <div className="mb-3 flex items-center gap-1.5 font-mono text-[12px] text-g-500">
              <span className="text-p-700">{bucket.nom}</span>
              <span>/</span>
            </div>
            <div className="overflow-x-auto rounded-[6px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Nom', 'Taille', 'Objets', 'Dernière modification', ''].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entrees.items.map((e) => (
                    <tr key={e.id} className="border-b border-g-100 last:border-0 hover:bg-p-050/60">
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          {e.type === 'dossier' ? (
                            <Folder size={14} className="shrink-0 text-p-600" />
                          ) : (
                            <File size={14} className="shrink-0 text-g-500" />
                          )}
                          <span className="font-mono text-[12.5px] text-ink">{e.nom}</span>
                        </span>
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                        {goHumain(e.taille)}
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                        {e.type === 'dossier' ? num(e.objets) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-g-700">
                        {dateCourte('2026-08-19')}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex justify-end gap-1">
                          <IconButton
                            label={`Télécharger ${e.nom}`}
                            size="sm"
                            onClick={() =>
                              executer({
                                ton: 'info',
                                titre: `Téléchargement de ${e.nom}`,
                                detail:
                                  e.type === 'dossier'
                                    ? 'Un préfixe entier se récupère avec aws s3 sync, pas depuis le portail.'
                                    : 'Lien signé valable dix minutes.',
                              })
                            }
                          >
                            <Download size={13} />
                          </IconButton>
                          <IconButton
                            label={
                              bucket.objectLock?.actif
                                ? `Suppression de ${e.nom} impossible : verrouillage WORM actif`
                                : `Supprimer ${e.nom}`
                            }
                            size="sm"
                            disabled={bucket.objectLock?.actif}
                            onClick={() =>
                              executer({
                                action: 'network.manage',
                                ton: 'warn',
                                titre: `${e.nom} supprimé`,
                                detail: bucket.versioning
                                  ? 'Le versioning est actif : un marqueur de suppression est posé, l’objet reste récupérable.'
                                  : 'Sans versioning, la suppression est définitive.',
                                effet: () => {
                                  entrees.supprimer(e.id)
                                  seaux.modifier(bucket.id, (b) => ({
                                    objets: Math.max(0, b.objets - e.objets),
                                  }))
                                },
                              })
                            }
                          >
                            <Trash2
                              size={13}
                              className={bucket.objectLock?.actif ? 'text-g-300' : 'text-err'}
                            />
                          </IconButton>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bucket.objectLock?.actif && (
              <Callout ton="info" className="mt-3.5" titre="Suppression désactivée">
                Ce bucket est protégé par un verrouillage d’objet de {bucket.objectLock.retentionJours}{' '}
                jours. Les objets ne peuvent être supprimés qu’après expiration de leur rétention —
                la restriction est appliquée par le stockage, pas par cette interface.
              </Callout>
            )}
          </Card>
        </div>
      )}

      {/* Politique d'accès */}
      {onglet === 'politique' && (
        <div className="space-y-4">
          <Card>
            <CardHeader titre="Politique d’accès" />
            <div className="space-y-3">
              <Radio
                name="politique"
                defaultChecked={bucket.policy === 'prive'}
                label="Privé"
                description="Accès uniquement par clé d’accès signée. Aucune lecture anonyme. C’est le réglage à conserver pour tout bucket de sauvegarde ou d’export."
              />
              <Radio
                name="politique"
                defaultChecked={bucket.policy === 'lecture_publique'}
                label="Lecture publique"
                description="Tout objet est lisible sans authentification par son URL. À réserver aux médias destinés à être servis sur un site web."
              />
              <Radio
                name="politique"
                defaultChecked={bucket.policy === 'json'}
                label="Politique JSON personnalisée"
                description="Contrôle fin par préfixe, par action et par principal."
              />
            </div>

            {bucket.policy === 'json' && (
              <div className="mt-4">
                <MicroLabel className="mb-2">Politique appliquée</MicroLabel>
                <MonoTextarea
                  rows={16}
                  defaultValue={`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AuditLectureSeule",
      "Effect": "Allow",
      "Principal": { "SYN": ["arn:syn:iam::org-dba:key/audit-lecture-seule"] },
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:syn:s3:::${bucket.nom}",
        "arn:syn:s3:::${bucket.nom}/*"
      ]
    },
    {
      "Sid": "InterdireSuppression",
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
      "Resource": "arn:syn:s3:::${bucket.nom}/*"
    }
  ]
}`}
                />
              </div>
            )}

            {bucket.policy === 'lecture_publique' && (
              <Callout ton="warn" className="mt-4" titre="Bucket en lecture publique">
                Tout objet déposé ici est lisible par quiconque connaît son URL. Vérifiez qu’aucune
                donnée personnelle ni aucun document interne n’y transite. Pour un site web, préférez
                un préfixe dédié plutôt que le bucket entier.
              </Callout>
            )}

            <div className="mt-4 border-t border-g-100 pt-4">
              <CopyField
                label="Endpoint du bucket"
                value={`https://s3.${bucket.region.toLowerCase()}.synelia.cloud/${bucket.nom}`}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Versioning */}
      {onglet === 'versioning' && (
        <div className="space-y-4">
          <Card>
            <CardHeader titre="Versioning" />
            <Switch
              checked={bucket.versioning}
              onChange={(v) =>
                executer({
                  action: 'network.manage',
                  ton: v ? 'ok' : 'warn',
                  titre: v ? 'Versioning activé' : 'Versioning désactivé',
                  detail: v
                    ? 'Une écriture crée une version au lieu d’écraser ; une suppression pose un marqueur.'
                    : 'Les versions déjà créées sont conservées, mais les prochaines écritures écraseront.',
                  effet: () => seaux.modifier(bucket.id, { versioning: v }),
                })
              }
              label="Conserver chaque version d’un objet"
              description="Une écriture sur une clé existante crée une nouvelle version au lieu d’écraser l’ancienne. Une suppression pose un marqueur sans détruire les versions précédentes."
            />
            {bucket.versioning ? (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatTile
                    libelle="Versions conservées"
                    valeur={num(Math.round(bucket.objets * 1.34))}
                    detail={`pour ${num(bucket.objets)} clés distinctes`}
                  />
                  <StatTile
                    libelle="Surcoût du versioning"
                    valeur={goHumain(Math.round(bucket.tailleGo * 0.24))}
                    ton="warn"
                    detail="Versions antérieures"
                  />
                  <StatTile
                    libelle="Marqueurs de suppression"
                    valeur={num(842)}
                    detail="Purgés par le cycle de vie"
                  />
                </div>
                <Callout ton="info" className="mt-4" titre="Le versioning a un coût de stockage">
                  Chaque version antérieure occupe sa propre capacité. Sans règle de cycle de vie
                  pour les expirer, un bucket versionné croît indéfiniment. Configurez l’expiration
                  des versions non courantes dans l’onglet Cycle de vie.
                </Callout>
              </>
            ) : (
              <Callout ton="warn" className="mt-4" titre="Versioning désactivé">
                Une écriture sur une clé existante écrase définitivement le contenu précédent. Sur un
                bucket recevant des sauvegardes, activez le versioning : c’est ce qui permet de
                revenir en arrière après une écriture erronée.
              </Callout>
            )}
          </Card>
        </div>
      )}

      {/* Cycle de vie */}
      {onglet === 'cycle' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Règles de cycle de vie"
              sousTitre="Transition chaud → froid et expiration automatique. Évaluées une fois par jour."
              actions={
                <BoutonFormulaire
                  libelle="Ajouter une règle"
                  icone={<Plus size={13} />}
                  action="network.manage"
                  titre="Ajouter une règle de cycle de vie"
                  description="Les règles sont évaluées une fois par jour. Une transition vers la classe froide ne se rembobine pas gratuitement : la relecture d’un objet froid est facturée."
                  champs={[
                    { id: 'nom', label: 'Nom de la règle', placeholder: 'Archivage des exports', obligatoire: true },
                    { id: 'prefixe', label: 'Préfixe visé', placeholder: 'exports/', demi: true },
                    { id: 'apres', label: 'Après', type: 'nombre', demi: true, min: 1, suffixe: 'jours' },
                    {
                      id: 'action',
                      label: 'Action',
                      type: 'select',
                      options: [
                        { value: 'Passer en classe froide', label: 'Passer en classe froide' },
                        { value: 'Supprimer les objets', label: 'Supprimer les objets' },
                        { value: 'Supprimer les versions antérieures', label: 'Supprimer les versions antérieures' },
                      ],
                    },
                  ]}
                  valeursDepart={{ prefixe: '*', apres: 30, action: 'Passer en classe froide' }}
                  libelleValider="Ajouter la règle"
                  operation={(v) => ({
                    titre: `Règle « ${v.nom} » ajoutée`,
                    detail: `${v.action} · ${v.apres} jours`,
                    effet: () =>
                      regles.creer({
                        id: regles.identifiant('rc'),
                        nom: String(v.nom),
                        prefixe: String(v.prefixe),
                        action: String(v.action),
                        apres: `${v.apres} jours`,
                      }),
                  })}
                />
              }
            />
            <div className="space-y-3">
              {regles.items
                .map((regle) => ({
                  ...regle,
                  actif:
                    regle.id === 'rc1'
                      ? bucket.classe === 'chaud'
                      : regle.id === 'rc2'
                        ? bucket.versioning
                        : true,
                }))
                .map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    'rounded-[8px] border px-3.5 py-3',
                    r.actif ? 'border-g-300' : 'border-g-300 bg-g-050 opacity-70',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink">{r.nom}</span>
                      <span className="mt-0.5 block text-[11.5px] text-g-500">
                        Préfixe <span className="font-mono">{r.prefixe}</span> · {r.action} ·{' '}
                        {r.apres}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={r.actif ? 'ok' : 'neutral'} size="sm">
                        {r.actif ? 'Active' : 'Inactive'}
                      </Badge>
                      <IconButton
                        label={`Supprimer la règle ${r.nom}`}
                        size="sm"
                        onClick={() =>
                          executer({
                            action: 'network.manage',
                            ton: 'warn',
                            titre: `Règle « ${r.nom} » supprimée`,
                            effet: () => regles.supprimer(r.id),
                          })
                        }
                      >
                        <Trash2 size={13} className="text-err" />
                      </IconButton>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {bucket.objectLock?.actif && (
              <Callout ton="warn" className="mt-4" titre="Interaction avec le verrouillage WORM">
                Une règle d’expiration ne peut pas supprimer un objet encore sous rétention WORM.
                L’expiration s’applique à la date la plus tardive entre celle de la règle et celle du
                verrouillage — la protection prime toujours.
              </Callout>
            )}
          </Card>
        </div>
      )}

      {/* WORM */}
      {onglet === 'worm' && (
        <div className="space-y-4">
          <Card className={bucket.objectLock?.actif ? 'border-[#B7E3D0]' : undefined}>
            <CardHeader
              titre={
                <span className="flex items-center gap-2">
                  <Lock size={15} className="text-p-700" />
                  Verrouillage d’objet (WORM)
                </span>
              }
              sousTitre="Write Once Read Many — écriture unique, lecture multiple."
              actions={
                <Badge tone={bucket.objectLock?.actif ? 'ok' : 'neutral'} dot>
                  {bucket.objectLock?.actif
                    ? `Actif · ${bucket.objectLock.retentionJours} jours`
                    : 'Inactif'}
                </Badge>
              }
            />

            <div className="rounded-[8px] border-l-4 border-p-600 bg-p-050 px-4 py-3.5">
              <p className="text-[13px] font-semibold text-ink">
                C’est votre protection anti-rançongiciel
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-700">
                Un attaquant qui compromet un compte administrateur peut chiffrer vos serveurs, puis
                tenter d’effacer vos sauvegardes pour vous forcer à payer. Sur un bucket verrouillé,
                cette seconde étape échoue : ni lui, ni vous, ni nos propres équipes ne pouvons
                supprimer ou raccourcir la rétention d’un objet avant son expiration. C’est la seule
                mesure qui offre cette garantie — le chiffrement, les droits d’accès et même les
                copies multiples n’y suffisent pas.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <Switch
                checked={bucket.objectLock?.actif ?? false}
                disabled={bucket.objectLock?.actif}
                onChange={(v) =>
                  executer({
                    action: 'network.manage',
                    ton: 'warn',
                    titre: 'Verrouillage d’objet activé',
                    detail:
                      'Définitif : le verrouillage ne peut plus être désactivé sur ce bucket. C’est une contrainte de la norme.',
                    effet: () =>
                      seaux.modifier(bucket.id, {
                        objectLock: { actif: v, retentionJours: 35 },
                        versioning: true,
                      }),
                  })
                }
                label="Activer le verrouillage d’objet"
                description="Une fois activé sur un bucket, le verrouillage ne peut plus être désactivé. C’est une contrainte assumée de la norme, pas une limitation Synelia."
              />
              {bucket.objectLock?.actif && (
                <>
                  <Slider
                    label="Durée de rétention par défaut"
                    value={bucket.objectLock.retentionJours}
                    onChange={() => {}}
                    min={1}
                    max={3650}
                    step={1}
                    unite="jours"
                  />
                  <Field label="Mode de rétention">
                    <Select defaultValue="conformite">
                      <option value="gouvernance">
                        Gouvernance — un rôle privilégié peut lever la rétention
                      </option>
                      <option value="conformite">
                        Conformité — personne ne peut lever la rétention (recommandé)
                      </option>
                    </Select>
                  </Field>
                </>
              )}
            </div>

            {bucket.objectLock?.actif && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-g-100 pt-4 sm:grid-cols-3">
                <StatTile
                  libelle="Objets sous rétention"
                  valeur={num(Math.round(bucket.objets * 0.92))}
                  ton="ok"
                />
                <StatTile
                  libelle="Rétention en cours"
                  valeur={bucket.objectLock.retentionJours}
                  unite="jours"
                />
                <StatTile
                  libelle="Mode"
                  valeur="Conformité"
                  detail="Non contournable"
                  ton="ok"
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Réplication */}
      {onglet === 'replication' && (
        <Card>
          <CardHeader
            titre="Réplication inter-site"
            actions={
              bucket.replication ? (
                <Badge tone="ok" dot>
                  Active vers {bucket.replication.cible}
                </Badge>
              ) : (
                <Badge tone="neutral">Inactive</Badge>
              )
            }
          />
          <Switch
            checked={Boolean(bucket.replication)}
            onChange={(v) =>
              executer({
                action: 'network.manage',
                ton: 'info',
                titre: v ? 'Réplication activée' : 'Réplication arrêtée',
                detail: v
                  ? 'Chaque nouvel objet est copié vers le second site. Les objets déjà présents ne le sont pas rétroactivement.'
                  : 'La copie déjà écrite sur l’autre site reste en place et reste facturée.',
                effet: () =>
                  seaux.modifier(bucket.id, {
                    replication: v
                      ? { cible: bucket.region === 'ABJ' ? 'GBM' : 'ABJ' }
                      : undefined,
                  }),
              })
            }
            label={`Répliquer vers ${bucket.region === 'ABJ' ? 'Grand-Bassam' : 'Abidjan'}`}
            description="Réplication asynchrone de chaque nouvel objet vers le second site. Le trafic inter-site n’est pas facturé ; seul le stockage de la copie l’est."
          />
          {bucket.replication ? (
            <>
              <KeyValueList
                className="mt-4"
                colonnes={2}
                items={[
                  { cle: 'Bucket cible', valeur: <span className="font-mono">{bucket.nom.replace(bucket.region.toLowerCase(), bucket.replication.cible.toLowerCase())}</span> },
                  { cle: 'Région cible', valeur: bucket.replication.cible },
                  { cle: 'Mode', valeur: 'Asynchrone, à l’écriture' },
                  { cle: 'Retard moyen', valeur: '18 secondes' },
                  { cle: 'Objets répliqués', valeur: num(Math.round(bucket.objets * 0.998)) },
                  { cle: 'En attente', valeur: num(Math.round(bucket.objets * 0.002)) },
                ]}
              />
              <Callout ton="ok" className="mt-4" titre="Vous satisfaites la règle « une copie hors site »">
                La réplication vers {bucket.replication.cible} constitue la troisième copie de la
                règle 3-2-1, sur un site physiquement distinct. C’est ce qui apparaît en pastille
                verte dans le tableau de conformité.
              </Callout>
            </>
          ) : (
            <Callout ton="warn" className="mt-4" titre="Aucune copie hors site">
              Sans réplication, une défaillance majeure du site {bucket.region} emporte ce bucket. Si
              ce bucket contient des sauvegardes, la réplication est indispensable pour satisfaire la
              règle 3-2-1.
            </Callout>
          )}
        </Card>
      )}

      {/* Clés */}
      {onglet === 'cles' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Clés d’accès ayant une portée sur ce bucket"
              actions={
                <BoutonFormulaire
                  libelle="Créer une clé"
                  variant="primary"
                  icone={<KeyRound size={13} />}
                  action="network.manage"
                  titre={`Créer une clé sur ${bucket.nom}`}
                  description="La valeur secrète n’est affichée qu’une seule fois, à la création."
                  champs={CHAMPS_CLE}
                  valeursDepart={{ portee: 'ecriture' }}
                  libelleValider="Créer la clé"
                  operation={(v) => ({
                    titre: `Clé ${v.nom} créée`,
                    detail: 'Conservez la valeur secrète maintenant : elle ne sera plus affichée.',
                    // Le backend exige `droits` dans son vocabulaire ; le
                    // libellé du formulaire y est traduit ici — même patron
                    // que la création de clé depuis la liste des buckets.
                    appel: () =>
                      creerRessource('/cles-s3', {
                        nom: String(v.nom),
                        buckets: [bucket.nom],
                        droits:
                          v.portee === 'lecture'
                            ? 'lecture'
                            : v.portee === 'ecriture'
                              ? 'lecture_ecriture'
                              : 'lecture_ecriture',
                      }).then((reponse) => {
                        const r = reponse as {
                          accessKeyId?: unknown
                          secretAccessKey?: unknown
                          endpoint?: unknown
                        } | null
                        if (r && typeof r.secretAccessKey === 'string')
                          setSecretS3({
                            accessKeyId: String(r.accessKeyId ?? ''),
                            secret: String(r.secretAccessKey),
                            endpoint: String(r.endpoint ?? ''),
                          })
                        return reponse
                      }),
                    effet: () =>
                      cles.creer({
                        id: cles.identifiant('ak'),
                        nom: String(v.nom),
                        portee: `${bucket.nom} (${v.portee})`,
                        creee: MAINTENANT.slice(0, 10),
                        derniereUtilisation: MAINTENANT,
                      }),
                    effetFinal: () => cles.recharger(),
                  })}
                />
              }
            />
            <div className="space-y-2">
              {cles.items.filter(
                (c) => c.portee.includes(bucket.nom) || c.portee.includes('tous les buckets'),
              ).map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[12.5px] font-semibold text-ink">
                      {c.nom}
                    </span>
                    <span className="block text-[11px] text-g-500">
                      {c.portee} · créée le {c.creee} · dernière utilisation{' '}
                      {dateHeure(c.derniereUtilisation)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <IconButton
                      label={`Faire tourner la clé ${c.nom}`}
                      size="sm"
                      onClick={() =>
                        executer({
                          action: 'network.manage',
                          titre: `Clé ${c.nom} renouvelée`,
                          detail: 'L’ancienne valeur reste valable une heure.',
                          effet: () => cles.modifier(c.id, { creee: MAINTENANT.slice(0, 10) }),
                        })
                      }
                    >
                      <RotateCw size={13} />
                    </IconButton>
                    <IconButton
                      label={`Révoquer la clé ${c.nom}`}
                      size="sm"
                      onClick={() =>
                        executer({
                          action: 'network.manage',
                          ton: 'warn',
                          titre: `Clé ${c.nom} révoquée`,
                          detail: 'Toute application qui l’utilise recevra un 403 immédiatement.',
                          effet: () => cles.supprimer(c.id),
                        })
                      }
                    >
                      <Trash2 size={13} className="text-err" />
                    </IconButton>
                  </span>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="La valeur secrète n’est affichée qu’une fois">
              À la création, le secret est affiché une seule fois : si vous le perdez, il faut créer
              une nouvelle clé. Ce n’est pas une contrainte arbitraire — un secret récupérable est un
              secret compromis dès qu’un accès en lecture au portail est obtenu.
            </Callout>
            {secretS3 && (
              <div className="mt-3 rounded-[8px] border border-err/40 bg-err-bg px-3.5 py-3">
                <p className="text-[12.5px] font-bold text-ink">
                  Copiez ces identifiants maintenant — le secret ne sera plus jamais affiché
                </p>
                <p className="mt-1 font-mono text-[12px] break-all text-ink">
                  {secretS3.accessKeyId} · {secretS3.secret}
                </p>
                {secretS3.endpoint && (
                  <p className="mt-0.5 font-mono text-[11.5px] break-all text-g-700">
                    {secretS3.endpoint}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setSecretS3(null)}
                >
                  Je les ai copiés, masquer
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader titre="Exemple d’utilisation" />
            <CodeBlock
              langue="bash"
              code={`export AWS_ACCESS_KEY_ID="SYN…"
export AWS_SECRET_ACCESS_KEY="…"

aws --endpoint-url https://s3.${bucket.region.toLowerCase()}.synelia.cloud \\
  s3 ls s3://${bucket.nom}/ --recursive --human-readable --summarize`}
            />
          </Card>
        </div>
      )}

      {/* Journaux */}
      {onglet === 'journaux' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Journaux d’accès"
              actions={
                <Switch
                  checked={bucket.accessLogs}
                  onChange={(v) =>
                    executer({
                      action: 'network.manage',
                      titre: v ? 'Journaux d’accès activés' : 'Journaux d’accès coupés',
                      detail: v
                        ? 'Chaque requête est journalisée : utile en audit, et facturé au volume écrit.'
                        : undefined,
                      effet: () => seaux.modifier(bucket.id, { accessLogs: v }),
                    })
                  }
                  label="Journaux d’accès"
                />
              }
            />
            {bucket.accessLogs ? (
              <LogPeek lignes={LOGS_EXECUTION} max={20} titre="Requêtes récentes sur ce bucket" />
            ) : (
              <Callout ton="warn" titre="Journaux d’accès désactivés">
                Sans journalisation, aucune trace des lectures et écritures sur ce bucket n’est
                conservée. Activez-la sur tout bucket contenant des sauvegardes ou des données
                sensibles : c’est ce qui permet de reconstituer un incident après coup.
              </Callout>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
