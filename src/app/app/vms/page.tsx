'use client'

import Link from 'next/link'
import { Camera, Plus, Power, RotateCw, Shield, Tag, Layers} from 'lucide-react'
import { num, relatif } from '@/lib/format'
import { SITE_COURT, type EspaceCloud, type VM } from '@/lib/types'
import { BACKUP_PLANS, ESPACES, VMS,
  hrefDuService,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { PageHeader, Card, Callout } from '@/components/composition/card'
import { HealthBadge, StatTile } from '@/components/composition/metrics'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { useApp, useEspace, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, requete } from '@/lib/api/client'
import { useEffect, useState } from 'react'

export default function ListeVms() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const espace = useEspace()
  const parc = useCollection<VM>('vms', VMS)
  // `/catalogue/images` résout l'UUID Glance que le backend pose sur `vm.os` — même
  // contrat que la fiche détail (`vms/[vm]/vue.tsx`). Sans ça, la colonne « Système »
  // affiche un UUID au lieu d'un nom lisible.
  const [catalogueImages, setCatalogueImages] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!estActif()) return
    requete<Array<{ id: string; nom: string }>>('/catalogue/images')
      .then((images) => setCatalogueImages(Object.fromEntries(images.map((i) => [i.id, i.nom]))))
      .catch(() => {})
  }, [])
  // Même collection que le panneau `CadreEspace` : en mode API, la liste des
  // « autres Espaces » ci-dessous doit suivre le backend, pas rester sur la
  // graine de démonstration alors que le reste de l'écran est déjà réel.
  const espacesCol = useCollection<EspaceCloud>('espaces', ESPACES)
  const executer = useOperation()
  const vms = parc.items.filter((v) => v.espaceId === espace.id)

  /** Une opération de cycle de vie : job court, puis bascule d'état. */
  const cycleDeVie = (
    ids: string[],
    libelle: string,
    workflow: string,
    statutFinal: VM['statut'],
  ) => {
    const actionApi =
      workflow === 'vm.power.start'
        ? 'demarrage'
        : workflow === 'vm.power.stop'
          ? 'arret'
          : 'redemarrage'
    return executer({
      action: 'vm.power',
      ton: 'info',
      titre: `${libelle} de ${ids.length} machine${ids.length > 1 ? 's' : ''}`,
      // En mode API chaque machine reçoit son ordre ; le premier travail
      // renvoyé pilote le suivi, les autres avancent dans le centre de tâches.
      appel: () =>
        Promise.all(
          ids.map((vmId) => requete(`/vms/${encodeURIComponent(vmId)}/${actionApi}`, { methode: 'POST', corps: {} })),
        ).then((reponses) => reponses[0]),
      job: {
        workflow,
        cible: `${ids.length} machine${ids.length > 1 ? 's' : ''}`,
      },
      effetFinal: () => {
        parc.modifierPlusieurs(ids, { statut: statutFinal })
        parc.recharger()
      },
    })
  }

  const colonnes: Array<Colonne<VM>> = [
    {
      id: 'nom',
      entete: 'Nom',
      cle: (v) => v.nom,
      rendu: (v) => (
        <span className="block">
          <span className="block font-mono text-[12.5px] font-semibold text-ink">{v.nom}</span>
          {v.applicationNom && (
            <span className="block text-[11px] text-g-500">{v.applicationNom}</span>
          )}
        </span>
      ),
    },
    {
      id: 'statut',
      entete: 'État',
      cle: (v) => v.statut,
      rendu: (v) => <HealthBadge etat={v.statut} size="sm" />,
    },
    {
      id: 'os',
      entete: 'Système',
      cle: (v) => catalogueImages[v.os] ?? v.os,
      rendu: (v) => catalogueImages[v.os] ?? v.os,
    },
    {
      id: 'gabarit',
      entete: 'Gabarit',
      cle: (v) => v.vcpu,
      rendu: (v) => (
        <span className="block">
          <span className="block font-mono text-[12px] text-ink">{v.flavor}</span>
          <span className="tnum block text-[11px] text-g-500">
            {v.vcpu} vCPU · {v.ramGo} Go · {num(v.diskGo)} Go
          </span>
        </span>
      ),
    },
    {
      id: 'ips',
      entete: 'Adresses IP',
      cle: (v) => v.ips.map((i) => i.adresse).join(' '),
      rendu: (v) => (
        <span className="block space-y-0.5">
          {v.ips.map((i) => (
            <span key={i.adresse} className="flex items-center gap-1.5">
              <span className="font-mono text-[11.5px] text-ink">{i.adresse}</span>
              <Badge tone={i.type === 'publique' ? 'accent' : 'neutral'} size="sm">
                {i.type === 'publique' ? 'pub' : 'priv'}
              </Badge>
            </span>
          ))}
        </span>
      ),
    },
    {
      id: 'site',
      entete: 'Site',
      cle: (v) => v.site,
      rendu: (v) => (
        <span className="text-[12px]">
          <span className="font-semibold text-ink">{v.site}</span>
          <span className="block text-[11px] text-g-500">{SITE_COURT[v.site]}</span>
        </span>
      ),
    },
    {
      id: 'application',
      entete: 'Application',
      cle: (v) => v.applicationNom ?? '',
      rendu: (v) =>
        v.applicationId ? (
          <Link
            href={hrefDuService(v.applicationId)}
            className="text-[12.5px] text-p-700 hover:text-m-600"
          >
            {v.applicationNom}
          </Link>
        ) : (
          <span className="text-[12px] text-g-500">autonome</span>
        ),
      masquable: true,
    },
    {
      id: 'sauvegarde',
      entete: 'Dernière sauvegarde',
      cle: (v) => v.derniereSauvegarde ?? '',
      rendu: (v) =>
        v.derniereSauvegarde ? (
          <span className="text-[12px] text-g-700">{relatif(v.derniereSauvegarde, maintenant)}</span>
        ) : (
          <Badge tone="warn" size="sm">
            Non protégée
          </Badge>
        ),
    },
    {
      id: 'tags',
      entete: 'Étiquettes',
      cle: (v) => (v.tags ?? []).join(' '),
      rendu: (v) => (
        <span className="flex flex-wrap gap-1">
          {(v.tags ?? []).map((t) => (
            <Badge key={t} tone="neutral" size="sm">
              {t}
            </Badge>
          ))}
        </span>
      ),
      masquable: true,
      masqueeParDefaut: true,
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (v) => (
        <Link
          href={`/app/vms/${v.id}`}
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
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace.code, href: `/app/espaces/${espace.id}` },
          { label: 'Machines virtuelles' },
        ]}
        titre="Machines virtuelles"
        sousTitre={`Machines de l’espace ${espace.code} (${SITE_COURT[espace.site]}). Changez d’espace depuis le sélecteur de contexte, en haut à droite.`}
        actions={
          <GatedAction autorise={autorise('vm.create_delete')} message={refus('vm.create_delete')}>
            <>
              <ButtonLink href="/app/vms/composer" variant="secondary" iconBefore={<Layers size={14} />}>
                Composer un lot
              </ButtonLink>
              <ButtonLink href="/app/vms/new" iconBefore={<Plus size={14} />}>
                Créer des machines
              </ButtonLink>
            </>
          </GatedAction>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile libelle="Machines" valeur={vms.length} />
        <StatTile
          libelle="En marche"
          valeur={vms.filter((v) => v.statut === 'running').length}
          ton="ok"
        />
        <StatTile
          libelle="Arrêtées"
          valeur={vms.filter((v) => v.statut === 'stopped').length}
          ton="neutral"
        />
        <StatTile
          libelle="En erreur ou migration"
          valeur={vms.filter((v) => v.statut === 'error' || v.statut === 'migrating').length}
          ton="warn"
        />
        <StatTile
          libelle="Non protégées"
          valeur={vms.filter((v) => !v.backupPlanId).length}
          ton={vms.some((v) => !v.backupPlanId) ? 'err' : 'ok'}
          detail="Aucun plan de sauvegarde"
        />
      </div>

      <DataTable
        lignes={vms}
        colonnes={colonnes}
        placeholderRecherche="Rechercher par nom, système ou adresse IP…"
        filtres={[
          {
            id: 'statut',
            libelle: 'État',
            options: [
              { value: 'running', label: 'En marche' },
              { value: 'stopped', label: 'Arrêtée' },
              { value: 'error', label: 'En erreur' },
              { value: 'migrating', label: 'En migration' },
            ],
          },
          {
            id: 'os',
            libelle: 'Système',
            options: Array.from(
              new Set(vms.map((v) => (catalogueImages[v.os] ?? v.os).split(' ')[0])),
            ).map((o) => ({
              value: o,
              label: o,
            })),
          },
          {
            id: 'protection',
            libelle: 'Protection',
            options: [
              { value: 'oui', label: 'Protégée' },
              { value: 'non', label: 'Non protégée' },
            ],
          },
        ]}
        selection={(v, id, val) => {
          if (id === 'statut') return v.statut === val
          if (id === 'os') return (catalogueImages[v.os] ?? v.os).startsWith(val)
          return val === 'oui' ? Boolean(v.backupPlanId) : !v.backupPlanId
        }}
        href={(v) => `/app/vms/${v.id}`}
        exportable
        actionsGroupees={(ids) => (
          <>
            <GatedAction autorise={autorise('vm.power')} message={refus('vm.power')}>
              <Button
                size="sm"
                variant="secondary"
                iconBefore={<Power size={13} />}
                onClick={() =>
                  cycleDeVie(ids, 'Démarrage', 'vm.power.start', 'running')
                }
              >
                Démarrer
              </Button>
            </GatedAction>
            <GatedAction autorise={autorise('vm.power')} message={refus('vm.power')}>
              <Button
                size="sm"
                variant="secondary"
                iconBefore={<Power size={13} />}
                onClick={() =>
                  cycleDeVie(ids, 'Arrêt', 'vm.power.stop', 'stopped')
                }
              >
                Arrêter
              </Button>
            </GatedAction>
            <GatedAction autorise={autorise('vm.power')} message={refus('vm.power')}>
              <Button
                size="sm"
                variant="secondary"
                iconBefore={<RotateCw size={13} />}
                onClick={() =>
                  cycleDeVie(ids, 'Redémarrage', 'vm.power.reboot', 'running')
                }
              >
                Redémarrer
              </Button>
            </GatedAction>
            <GatedAction autorise={autorise('vm.create_delete')} message={refus('vm.create_delete')}>
              <Button
                size="sm"
                variant="secondary"
                iconBefore={<Camera size={13} />}
                onClick={() =>
                  executer({
                    action: 'vm.create_delete',
                    titre: `Snapshot de ${ids.length} machine${ids.length > 1 ? 's' : ''} demandé`,
                    detail:
                      'Un snapshot n’est pas une sauvegarde : il vit sur le même stockage que la machine.',
                    appel: () =>
                      Promise.all(
                        ids.map((vmId) =>
                          requete(`/vms/${encodeURIComponent(vmId)}/instantanes`, {
                            methode: 'POST',
                            corps: { nom: `groupe-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}` },
                          }),
                        ),
                      ).then((reponses) => reponses[0]),
                    job: { workflow: 'vm.snapshot', cible: `${ids.length} machine${ids.length > 1 ? 's' : ''}` },
                    effetFinal: () => parc.recharger(),
                  })
                }
              >
                Snapshot
              </Button>
            </GatedAction>
            <BoutonFormulaire
              libelle="Appliquer un plan de sauvegarde"
              icone={<Shield size={13} />}
              action="backup.plan.write"
              titre="Appliquer un plan de sauvegarde"
              description={`${ids.length} machine${ids.length > 1 ? 's' : ''} sélectionnée${ids.length > 1 ? 's' : ''}. Le plan s’applique à la prochaine fenêtre de sauvegarde.`}
              champs={[
                {
                  id: 'plan',
                  label: 'Plan de sauvegarde',
                  type: 'select',
                  options: BACKUP_PLANS.map((p) => ({ value: p.id, label: p.nom })),
                },
              ]}
              operation={(v) => ({
                titre: 'Plan de sauvegarde appliqué',
                detail: BACKUP_PLANS.find((p) => p.id === v.plan)?.nom,
                effet: () => parc.modifierPlusieurs(ids, { backupPlanId: String(v.plan) }),
              })}
            />
            <BoutonFormulaire
              libelle="Étiqueter"
              variant="ghost"
              icone={<Tag size={13} />}
              titre="Ajouter une étiquette"
              description="Les plans de sauvegarde et les règles de pare-feu peuvent cibler une étiquette : toute machine qui la porte est couverte, y compris celles créées plus tard."
              champs={[
                {
                  id: 'etiquette',
                  label: 'Étiquette',
                  placeholder: 'production',
                  obligatoire: true,
                },
              ]}
              operation={(v) => ({
                titre: `Étiquette « ${v.etiquette} » posée sur ${ids.length} machine${ids.length > 1 ? 's' : ''}`,
                effet: () =>
                  parc.modifierPlusieurs(ids, (vm) => ({
                    tags: Array.from(new Set([...(vm.tags ?? []), String(v.etiquette)])),
                  })),
              })}
            />
          </>
        )}
        vide={{
          titre: 'Aucune machine dans cet espace',
          phrase:
            'Une machine virtuelle se crée en quelques minutes depuis notre bibliothèque d’images ou depuis vos propres images. Vous pouvez créer une machine unique ou un lot avec un gabarit identique.',
          action: { libelle: 'Créer des machines', href: '/app/vms/new' },
        }}
      />

      {vms.some((v) => !v.backupPlanId) && (
        <Callout ton="warn" titre="Des machines ne sont pas protégées">
          {vms
            .filter((v) => !v.backupPlanId)
            .map((v) => v.nom)
            .join(', ')}{' '}
          n’ont aucun plan de sauvegarde appliqué. Le moyen le plus simple de couvrir un parc est un
          plan par étiquette : toute machine portant l’étiquette{' '}
          <span className="font-mono text-[12px]">production</span> est protégée automatiquement, y
          compris celles créées plus tard.
        </Callout>
      )}

      {espacesCol.items.length > 1 && (
        <Callout ton="info" titre="Machines dans les autres espaces">
          {espacesCol.items.filter((e) => e.id !== espace.id).map((e) => (
            <span key={e.id} className="mr-4 inline-block">
              <Link href={`/app/espaces/${e.id}`} className="font-semibold text-p-700 hover:text-m-600">
                {e.code}
              </Link>{' '}
              · {parc.items.filter((v) => v.espaceId === e.id).length} machines
            </span>
          ))}
        </Callout>
      )}
    </div>
  )
}
