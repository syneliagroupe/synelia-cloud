'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { MAINTENANT } from '@/lib/format'
import { goHumain, money, num } from '@/lib/format'
import type { VM, Volume } from '@/lib/types'
import { VMS, VOLUMES } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, requete, supprimerRessource } from '@/lib/api/client'

const PRIX_GO: Record<Volume['classe'], number> = {
  nvme: 5.4,
  ssd: 3.2,
  hdd: 1.1,
  archive: 0.32,
}

const LIBELLE_CLASSE: Record<Volume['classe'], string> = {
  nvme: 'NVMe · 12 000 IOPS',
  ssd: 'SSD · 6 000 IOPS',
  hdd: 'HDD · 900 IOPS',
  archive: 'Archive · accès rare',
}

export default function Stockage() {
  const espace = useEspace()
  const { autorise, refus } = useApp()
  const disques = useCollection<Volume>('volumes', VOLUMES)
  const parc = useCollection<VM>('vms', VMS)
  const [creationOuverte, setCreationOuverte] = useState(false)
  const volumes = disques.items.filter((v) => v.espaceId === espace.id)
  const machines = parc.items.filter((v) => v.espaceId === espace.id)

  const champsVolume = [
    { id: 'nom', label: 'Nom du volume', placeholder: 'data-postgres-03', obligatoire: true },
    { id: 'taille', label: 'Taille', type: 'nombre' as const, demi: true, min: 10, max: 8000, suffixe: 'Go' },
    {
      id: 'classe',
      label: 'Classe',
      type: 'select' as const,
      demi: true,
      options: (['nvme', 'ssd', 'hdd', 'archive'] as const).map((c) => ({
        value: c,
        label: LIBELLE_CLASSE[c],
      })),
    },
    { id: 'chiffre', label: 'Chiffrement au repos', type: 'switch' as const, placeholder: 'Activé' },
  ]
  const total = volumes.reduce((a, v) => a + v.tailleGo, 0)
  const cout = volumes.reduce((a, v) => a + Math.round(v.tailleGo * PRIX_GO[v.classe]), 0)

  const colonnes: Array<Colonne<Volume>> = [
    {
      id: 'nom',
      entete: 'Volume',
      cle: (v) => v.nom,
      rendu: (v) => (
        <span className="block">
          <span className="block font-mono text-[13px] font-semibold text-ink">{v.nom}</span>
          {v.ephemere && (
            <Badge tone="warn" size="sm" className="mt-0.5">
              Éphémère
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: 'taille',
      entete: 'Taille',
      aligne: 'right',
      cle: (v) => v.tailleGo,
      rendu: (v) => goHumain(v.tailleGo),
    },
    {
      id: 'classe',
      entete: 'Classe',
      cle: (v) => v.classe,
      rendu: (v) => (
        <span className="block">
          <Badge tone="neutral" size="sm">
            {v.classe.toUpperCase()}
          </Badge>
          <span className="mt-0.5 block text-[11px] text-g-500">{LIBELLE_CLASSE[v.classe]}</span>
        </span>
      ),
    },
    {
      id: 'iops',
      entete: 'IOPS',
      aligne: 'right',
      cle: (v) => v.iops,
      rendu: (v) => num(v.iops),
      masquable: true,
    },
    {
      id: 'chiffre',
      entete: 'Chiffrement',
      cle: (v) => (v.chiffre ? 1 : 0),
      rendu: (v) => (
        <Badge tone={v.chiffre ? 'ok' : 'warn'} size="sm">
          {v.chiffre ? 'Au repos' : 'Aucun'}
        </Badge>
      ),
    },
    {
      id: 'attache',
      entete: 'Machine attachée',
      cle: (v) => v.attachedLabel ?? '',
      rendu: (v) =>
        v.attachedLabel ? (
          <span className="font-mono text-[12px] text-ink">{v.attachedLabel}</span>
        ) : (
          <span className="text-[12px] text-g-500">détaché</span>
        ),
    },
    {
      id: 'montage',
      entete: 'Point de montage',
      cle: (v) => v.montage ?? '',
      rendu: (v) => (
        <span className="font-mono text-[12px] text-g-700">{v.montage ?? '—'}</span>
      ),
      masquable: true,
    },
    {
      id: 'cout',
      entete: 'Coût mensuel',
      aligne: 'right',
      cle: (v) => v.tailleGo * PRIX_GO[v.classe],
      rendu: (v) => money(Math.round(v.tailleGo * PRIX_GO[v.classe])),
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (v) => (
        <span className="flex justify-end gap-1">
          <BoutonFormulaire
            libelle="Étendre"
            variant="ghost"
            action="network.manage"
            titre={`Étendre ${v.nom}`}
            description="L’extension est appliquée à chaud. Un volume ne rétrécit jamais : le système de fichiers de l’invité doit ensuite être étendu à son tour."
            champs={[
              { id: 'taille', label: 'Nouvelle taille', type: 'nombre', min: v.tailleGo, max: 8000, suffixe: 'Go' },
            ]}
            valeursDepart={{ taille: v.tailleGo }}
            libelleValider="Étendre"
            operation={(f) => ({
              titre: `${v.nom} étendu à ${num(Number(f.taille))} Go`,
              appel: () =>
                requete(`/volumes/${encodeURIComponent(v.id)}/extension`, {
                  methode: 'POST',
                  corps: { tailleGo: Number(f.taille) },
                }),
              effet: () => disques.modifier(v.id, { tailleGo: Number(f.taille) }),
              effetFinal: () => disques.recharger(),
            })}
          />
          {v.attachedTo ? (
            <BoutonAction
              libelle="Détacher"
              variant="ghost"
              operation={{
                action: 'network.manage',
                ton: 'warn',
                titre: `${v.nom} détaché`,
                detail: 'Le volume reste facturé tant qu’il existe.',
                appel: () =>
                  requete(`/volumes/${encodeURIComponent(v.id)}/attachement`, { methode: 'DELETE' }),
                effet: () =>
                  disques.modifier(v.id, {
                    attachedTo: undefined,
                    attachedLabel: undefined,
                    montage: undefined,
                  }),
                effetFinal: () => disques.recharger(),
              }}
            />
          ) : (
            <BoutonFormulaire
              libelle="Attacher"
              variant="ghost"
              action="network.manage"
              titre={`Attacher ${v.nom}`}
              champs={[
                {
                  id: 'machine',
                  label: 'Machine de destination',
                  type: 'select',
                  options: machines.map((m) => ({ value: m.id, label: m.nom })),
                },
                { id: 'montage', label: 'Point de montage', placeholder: '/srv/data' },
              ]}
              valeursDepart={{ montage: '/srv/data' }}
              libelleValider="Attacher"
              operation={(f) => {
                const cible = machines.find((m) => m.id === f.machine)
                return {
                  titre: `${v.nom} attaché à ${cible?.nom ?? ''}`,
                  appel: () =>
                    requete(`/volumes/${encodeURIComponent(v.id)}/attachement`, {
                      methode: 'PUT',
                      corps: { vmId: cible?.id, montage: String(f.montage) || undefined },
                    }),
                  effet: () =>
                    disques.modifier(v.id, {
                      attachedTo: cible?.id,
                      attachedLabel: cible?.nom,
                      montage: String(f.montage) || undefined,
                    }),
                  effetFinal: () => disques.recharger(),
                }
              }}
            />
          )}
          <BoutonAction
            libelle="Supprimer"
            variant="ghost"
            desactive={Boolean(v.attachedTo)}
            operation={{
              action: 'network.manage',
              ton: 'warn',
              titre: `Volume ${v.nom} supprimé`,
              appel: () => supprimerRessource('/volumes', v.id, v.nom),
              effet: () => disques.supprimer(v.id),
              effetFinal: () => disques.recharger(),
            }}
            confirmation={{
              ressource: v.nom,
              pertes: [
                `Les ${goHumain(v.tailleGo)} de données sont détruites, sans retour possible`,
                'La facturation du volume cesse dès la suppression',
              ],
            }}
          />
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace.code, href: `/app/espaces/${espace.id}` },
          { label: 'Stockage' },
        ]}
        titre="Volumes"
        sousTitre="Des disques attachables, extensibles à chaud, chiffrés au repos. Séparer les données du disque système permet de les déplacer, de les sauvegarder et de les étendre indépendamment."
        actions={
          <BoutonFormulaire
            libelle="Créer un volume"
            size="md"
            variant="primary"
            icone={<Plus size={14} />}
            action="network.manage"
            titre="Créer un volume"
            description="Un volume est un disque indépendant du système : il s’étend à chaud, se déplace d’une machine à l’autre et se sauvegarde séparément."
            ouvert={creationOuverte}
            onOuvertChange={setCreationOuverte}
            champs={champsVolume}
            valeursDepart={{ taille: 100, classe: 'ssd', chiffre: true }}
            libelleValider="Créer le volume"
            operation={(v) => ({
              titre: `Volume ${v.nom} créé`,
              detail: `${v.taille} Go · ${String(v.classe).toUpperCase()} · détaché`,
              appel: () =>
                creerRessource('/volumes', {
                  espaceId: espace.id,
                  nom: String(v.nom),
                  tailleGo: Number(v.taille),
                  classe: v.classe,
                  chiffre: Boolean(v.chiffre),
                }),
              effet: () =>
                disques.creer({
                  id: disques.identifiant('vol'),
                  espaceId: espace.id,
                  nom: String(v.nom),
                  tailleGo: Number(v.taille),
                  classe: v.classe as Volume['classe'],
                  chiffre: Boolean(v.chiffre),
                  ephemere: false,
                  iops:
                    v.classe === 'nvme'
                      ? 12000
                      : v.classe === 'ssd'
                        ? 6000
                        : v.classe === 'hdd'
                          ? 900
                          : 120,
                }),
              effetFinal: () => disques.recharger(),
            })}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatTile libelle="Volumes" valeur={volumes.length} />
        <StatTile libelle="Capacité allouée" valeur={goHumain(total)} />
        <StatTile
          libelle="Attachés"
          valeur={volumes.filter((v) => v.attachedTo).length}
          ton="ok"
          detail={`${volumes.filter((v) => !v.attachedTo).length} détaché(s), facturé(s)`}
        />
        <StatTile
          libelle="Chiffrés"
          valeur={`${volumes.filter((v) => v.chiffre).length}/${volumes.length}`}
          ton={volumes.every((v) => v.chiffre) ? 'ok' : 'warn'}
        />
        <StatTile libelle="Coût mensuel" valeur={money(cout).replace(' FCFA', '')} unite="FCFA" />
      </div>

      <DataTable
        lignes={volumes}
        colonnes={colonnes}
        placeholderRecherche="Rechercher un volume ou un point de montage…"
        filtres={[
          {
            id: 'classe',
            libelle: 'Classe',
            options: (['nvme', 'ssd', 'hdd', 'archive'] as const).map((c) => ({
              value: c,
              label: c.toUpperCase(),
            })),
          },
          {
            id: 'attache',
            libelle: 'Attachement',
            options: [
              { value: 'oui', label: 'Attaché' },
              { value: 'non', label: 'Détaché' },
            ],
          },
        ]}
        selection={(v, id, val) =>
          id === 'classe' ? v.classe === val : val === 'oui' ? Boolean(v.attachedTo) : !v.attachedTo
        }
        exportable
        actionsGroupees={(ids) => (
          <>
            <BoutonAction
              libelle={`Créer un snapshot (${ids.length})`}
              operation={{
                action: 'backup.plan.write',
                titre: `Snapshot de ${ids.length} volume(s) demandé`,
                detail:
                  'Un snapshot de volume vit sur le même stockage : ce n’est pas une sauvegarde hors site.',
                sansApi:
                  'Indisponible : la prise de snapshot d’un volume n’est pas encore exposée par l’API.',
                job: {
                  type: 'volume.snapshot',
                  label: `Snapshot · ${ids.length} volume(s)`,
                  etapes: ['Geler les écritures', 'Capturer les blocs', 'Reprendre les écritures'],
                  dureeEtapeMs: 900,
                },
              }}
            />
            <BoutonAction
              libelle="Appliquer un plan de sauvegarde"
              operation={{
                action: 'backup.plan.write',
                titre: `Plan appliqué à ${ids.length} volume(s)`,
                detail: `Prise en compte à la prochaine fenêtre, le ${MAINTENANT.slice(8, 10)} à 02h00.`,
              }}
            />
          </>
        )}
        vide={{
          titre: 'Aucun volume dans cet espace',
          phrase:
            'Un volume est un disque indépendant du système. Il s’étend à chaud, se déplace d’une machine à l’autre, et se sauvegarde séparément.',
          action: { libelle: 'Créer un volume', onClick: () => setCreationOuverte(true) },
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <p className="type-micro mb-3 text-g-500">Grille tarifaire des classes</p>
          <div className="space-y-2">
            {(['nvme', 'ssd', 'hdd', 'archive'] as const).map((c) => (
              <div
                key={c}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">
                    {c.toUpperCase()}
                  </span>
                  <span className="block text-[11px] text-g-500">{LIBELLE_CLASSE[c]}</span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-semibold text-p-700">
                  {money(Math.round(PRIX_GO[c] * 1000))}/To/mois
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Callout ton="warn" titre="Les volumes détachés restent facturés">
          {volumes.filter((v) => !v.attachedTo).length > 0
            ? `${volumes.filter((v) => !v.attachedTo).map((v) => v.nom).join(', ')} n’est attaché à aucune machine mais continue d’occuper — et de facturer — sa capacité. C’est voulu : détacher un volume ne détruit pas ses données. Si vous n’en avez plus besoin, créez d’abord un snapshot, puis supprimez le volume.`
            : 'Tous vos volumes sont attachés. Un volume détaché conserve ses données et reste facturé : c’est ce qui permet de le déplacer d’une machine à l’autre sans risque.'}
        </Callout>
      </div>

      <Callout ton="violet" titre="Extension à chaud, mais pas réduction">
        L’extension d’un volume est instantanée et sans interruption : la nouvelle capacité apparaît
        immédiatement côté hyperviseur, il reste à étendre le système de fichiers dans l’invité
        (<span className="font-mono text-[12px]">resize2fs</span> ou{' '}
        <span className="font-mono text-[12px]">xfs_growfs</span>). La réduction n’est pas
        supportée — c’est une limitation générale du stockage bloc, pas une restriction Synelia.
      </Callout>
    </div>
  )
}
