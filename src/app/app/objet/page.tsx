'use client'

import Link from 'next/link'
import { useState } from 'react'
import { KeyRound, Plus, RotateCw, Trash2 } from 'lucide-react'
import { MAINTENANT, goHumain, money, num } from '@/lib/format'
import type { Bucket, Site } from '@/lib/types'
import { BUCKETS, CLES_S3 } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { CodeBlock, GatedAction } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource } from '@/lib/api/client'
import { CHAMPS_CLE, type CleS3 } from './cles'

const PRIX_GO = { chaud: 1.5, froid: 0.62 }

export default function StockageObjet() {
  const { autorise, refus } = useApp()
  const espace = useEspace()
  const executer = useOperation()
  const seaux = useCollection<Bucket>('buckets', BUCKETS)
  const cles = useCollection<CleS3>('cles-s3', CLES_S3)
  const buckets = seaux.items.filter((b) => b.espaceId === espace.id)
  const [creationOuverte, setCreationOuverte] = useState(false)
  /** Identifiants renvoyés une seule fois à la création d’une clé S3. */
  const [secretS3, setSecretS3] = useState<{
    accessKeyId: string
    secret: string
    endpoint: string
  } | null>(null)
  const total = buckets.reduce((a, b) => a + b.tailleGo, 0)
  const objets = buckets.reduce((a, b) => a + b.objets, 0)
  const cout = buckets.reduce((a, b) => a + Math.round(b.tailleGo * PRIX_GO[b.classe]), 0)

  const colonnes: Array<Colonne<Bucket>> = [
    {
      id: 'nom',
      entete: 'Bucket',
      cle: (b) => b.nom,
      rendu: (b) => (
        <span className="block">
          {/* Pas de lien ici : le DataTable enveloppe déjà la première colonne
              dans le lien de la ligne, et deux <a> imbriqués sont du HTML
              invalide — React refuse alors d'hydrater la table. */}
          <span className="block font-mono text-[12.5px] font-semibold text-ink">{b.nom}</span>
          <span className="block text-[11px] text-g-500">
            {b.policy === 'prive'
              ? 'Privé'
              : b.policy === 'lecture_publique'
                ? 'Lecture publique'
                : 'Politique JSON'}
          </span>
        </span>
      ),
    },
    {
      id: 'region',
      entete: 'Région',
      cle: (b) => b.region,
      rendu: (b) => (
        <Badge tone="neutral" size="sm">
          {b.region}
        </Badge>
      ),
    },
    {
      id: 'classe',
      entete: 'Classe',
      cle: (b) => b.classe,
      rendu: (b) => (
        <Badge tone={b.classe === 'chaud' ? 'violet' : 'neutral'} size="sm">
          {b.classe === 'chaud' ? 'Chaude' : 'Froide'}
        </Badge>
      ),
    },
    {
      id: 'taille',
      entete: 'Taille',
      aligne: 'right',
      cle: (b) => b.tailleGo,
      rendu: (b) => goHumain(b.tailleGo),
    },
    {
      id: 'objets',
      entete: 'Objets',
      aligne: 'right',
      cle: (b) => b.objets,
      rendu: (b) => num(b.objets),
    },
    {
      id: 'versioning',
      entete: 'Versioning',
      cle: (b) => (b.versioning ? 1 : 0),
      rendu: (b) => (
        <Badge tone={b.versioning ? 'ok' : 'neutral'} size="sm">
          {b.versioning ? 'Actif' : 'Inactif'}
        </Badge>
      ),
    },
    {
      id: 'worm',
      entete: 'Verrouillage d’objet',
      cle: (b) => (b.objectLock?.actif ? 1 : 0),
      rendu: (b) =>
        b.objectLock?.actif ? (
          <Badge tone="ok" size="sm">
            WORM {b.objectLock.retentionJours} j
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            Non
          </Badge>
        ),
    },
    {
      id: 'replication',
      entete: 'Réplication',
      rendu: (b) =>
        b.replication ? (
          <Badge tone="violet" size="sm">
            → {b.replication.cible}
          </Badge>
        ) : (
          <span className="text-[12px] text-g-500">aucune</span>
        ),
      masquable: true,
    },
    {
      id: 'cout',
      entete: 'Coût mensuel',
      aligne: 'right',
      cle: (b) => b.tailleGo * PRIX_GO[b.classe],
      rendu: (b) => money(Math.round(b.tailleGo * PRIX_GO[b.classe])),
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (b) => (
        <Link
          href={`/app/objet/${b.id}`}
          className="text-[12px] font-semibold text-p-700 hover:text-m-600"
        >
          Ouvrir →
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Stockage objet S3' }]}
        titre="Stockage objet"
        sousTitre="Compatible avec l’API S3 : vos outils existants fonctionnent en changeant simplement l’endpoint. Le verrouillage d’objet WORM est la seule protection qui résiste à une compromission de compte administrateur."
        actions={
          <BoutonFormulaire
            libelle="Créer un bucket"
            size="md"
            variant="primary"
            icone={<Plus size={14} />}
            action="network.manage"
            titre="Créer un bucket"
            description="Le nom d’un bucket est global et définitif : il entre dans l’URL. La région détermine où les objets résident physiquement."
            ouvert={creationOuverte}
            onOuvertChange={setCreationOuverte}
            champs={[
              { id: 'nom', label: 'Nom du bucket', placeholder: 'dba-archives-abj', obligatoire: true },
              {
                id: 'region',
                label: 'Région',
                type: 'select',
                demi: true,
                options: [
                  { value: 'ABJ', label: 'Abidjan' },
                  { value: 'GBM', label: 'Grand-Bassam' },
                ],
              },
              {
                id: 'classe',
                label: 'Classe',
                type: 'select',
                demi: true,
                options: [
                  { value: 'chaud', label: 'Chaud · accès fréquent' },
                  { value: 'froid', label: 'Froid · accès rare, moins cher' },
                ],
              },
              { id: 'versioning', label: 'Versioning', type: 'switch', placeholder: 'Activé' },
              { id: 'journaux', label: 'Journaux d’accès', type: 'switch', placeholder: 'Activés' },
            ]}
            valeursDepart={{ region: 'ABJ', classe: 'chaud', versioning: true, journaux: true }}
            libelleValider="Créer le bucket"
            operation={(v) => ({
              titre: `Bucket ${v.nom} créé`,
              detail: `${v.region === 'ABJ' ? 'Abidjan' : 'Grand-Bassam'} · classe ${v.classe}`,
              effet: () =>
                seaux.creer({
                  id: seaux.identifiant('bkt'),
                  orgId: 'org-dba',
                  espaceId: espace.id,
                  nom: String(v.nom),
                  region: v.region as Site,
                  classe: v.classe as Bucket['classe'],
                  tailleGo: 0,
                  objets: 0,
                  versioning: Boolean(v.versioning),
                  accessLogs: Boolean(v.journaux),
                  policy: 'prive',
                }),
            })}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile libelle="Buckets" valeur={buckets.length} />
        <StatTile libelle="Volume stocké" valeur={goHumain(total)} />
        <StatTile libelle="Objets" valeur={num(objets)} />
        <StatTile
          libelle="Buckets protégés WORM"
          valeur={buckets.filter((b) => b.objectLock?.actif).length}
          ton="ok"
          detail="Anti-rançongiciel"
        />
        <StatTile libelle="Coût mensuel" valeur={money(cout).replace(' FCFA', '')} unite="FCFA" />
      </div>

      <DataTable
        lignes={buckets}
        colonnes={colonnes}
        placeholderRecherche="Rechercher un bucket…"
        filtres={[
          {
            id: 'region',
            libelle: 'Région',
            options: [
              { value: 'ABJ', label: 'Abidjan' },
              { value: 'GBM', label: 'Grand-Bassam' },
            ],
          },
          {
            id: 'classe',
            libelle: 'Classe',
            options: [
              { value: 'chaud', label: 'Chaude' },
              { value: 'froid', label: 'Froide' },
            ],
          },
        ]}
        selection={(b, id, v) => (id === 'region' ? b.region === v : b.classe === v)}
        href={(b) => `/app/objet/${b.id}`}
        exportable
        vide={{
          titre: 'Aucun bucket',
          phrase:
            'Un bucket de stockage objet accueille sauvegardes, médias, exports et archives, avec versioning et verrouillage WORM.',
          action: { libelle: 'Créer un bucket', onClick: () => setCreationOuverte(true) },
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre="Clés d’accès"
            sousTitre="La valeur secrète n’est affichée qu’une seule fois, à la création."
            actions={
              <BoutonFormulaire
                libelle="Créer une clé"
                variant="primary"
                icone={<KeyRound size={13} />}
                action="network.manage"
                titre="Créer une clé d’accès S3"
                description="Donnez à chaque usage sa propre clé, avec la portée la plus étroite possible. La valeur secrète n’est affichée qu’une seule fois."
                champs={[
                  ...CHAMPS_CLE,
                  {
                    id: 'bucket',
                    label: 'Bucket',
                    type: 'select',
                    options: [
                      { value: 'tous', label: 'Tous les buckets' },
                      ...buckets.map((b) => ({ value: b.nom, label: b.nom })),
                    ],
                  },
                ]}
                valeursDepart={{ portee: 'lecture', bucket: 'tous' }}
                libelleValider="Créer la clé"
                operation={(v) => ({
                  titre: `Clé ${v.nom} créée`,
                  detail: 'La valeur secrète est affichée une seule fois : conservez-la maintenant.',
                  // Le backend exige `droits` dans son vocabulaire ; le
                  // libellé du formulaire y est traduit ici.
                  appel: () =>
                    creerRessource('/cles-s3', {
                      nom: String(v.nom),
                      buckets: v.bucket === 'tous' ? [] : [String(v.bucket)],
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
                      portee:
                        v.bucket === 'tous'
                          ? `tous les buckets (${v.portee})`
                          : `${v.bucket} (${v.portee})`,
                      creee: MAINTENANT.slice(0, 10),
                      derniereUtilisation: MAINTENANT,
                    }),
                  effetFinal: () => cles.recharger(),
                })}
              />
            }
          />
          <div className="space-y-2">
            {cles.items.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[12.5px] font-semibold text-ink">
                    {c.nom}
                  </span>
                  <span className="block text-[11px] text-g-500">
                    Portée : {c.portee} · créée le {c.creee}
                  </span>
                  <span className="block text-[11px] text-g-500">
                    Dernière utilisation : {c.derniereUtilisation.slice(0, 10)}
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
                        detail:
                          'L’ancienne valeur reste valable une heure, le temps de mettre à jour vos applications.',
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
                        detail: 'La révocation est immédiate : toute application qui l’utilise recevra un 403.',
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
          <p className="mt-3 border-t border-g-100 pt-3 text-[11.5px] leading-relaxed text-g-500">
            Donnez à chaque usage sa propre clé, avec la portée la plus étroite possible. Une clé
            d’écriture sur le bucket de sauvegarde ne doit jamais pouvoir supprimer d’objet — le
            verrouillage WORM l’en empêche de toute façon.
          </p>
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
          <CardHeader
            titre="Compatibilité S3"
            sousTitre="Changez l’endpoint, rien d’autre."
          />
          <CodeBlock
            langue="bash"
            code={`# Configuration aws-cli
aws configure set aws_access_key_id     "SYN…"
aws configure set aws_secret_access_key "…"
aws configure set region                "abj"

export S3_ENDPOINT="https://s3.abj.synelia.cloud"

# Lister les buckets
aws --endpoint-url $S3_ENDPOINT s3 ls

# Synchroniser un dossier
aws --endpoint-url $S3_ENDPOINT s3 sync ./exports \\
  s3://dba-exports-reversibilite/2026-08/

# rclone fonctionne également
rclone copy ./medias synelia:dba-medias-publics --progress`}
          />
          <p className="mt-3 text-[11.5px] leading-relaxed text-g-500">
            La compatibilité couvre les opérations sur les objets, le versioning, le cycle de vie, le
            verrouillage d’objet et les téléversements multipartites. Endpoints :{' '}
            <span className="font-mono">s3.abj.synelia.cloud</span> et{' '}
            <span className="font-mono">s3.gbm.synelia.cloud</span>.
          </p>
        </Card>
      </div>

      <Callout ton="violet" titre="Le verrouillage WORM, expliqué sans détour">
        Une fois la rétention posée sur un objet, ni vous, ni nos administrateurs, ni un attaquant
        ayant obtenu vos droits ne peuvent la raccourcir ou supprimer l’objet avant son expiration.
        C’est contraignant — et c’est précisément l’intérêt. Un rançongiciel qui chiffre vos serveurs
        et tente d’effacer vos sauvegardes échoue sur un bucket verrouillé. Aucune autre mesure ne
        garantit cela.
      </Callout>
    </div>
  )
}
