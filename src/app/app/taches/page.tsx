'use client'

import Link from 'next/link'
import { RotateCw, Trash2, XCircle } from 'lucide-react'
import { relatif } from '@/lib/format'
import type { ProvisioningJob } from '@/lib/types'
import { requete } from '@/lib/api/client'
import { JOBS } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { LIBELLE_STATUT_JOB, TON_STATUT_JOB } from '@/lib/workflows'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { BoutonAction } from '@/components/app/actions'
import { useMaintenant } from '@/components/app/contexte'

export default function CentreDeTaches() {
  const maintenant = useMaintenant()
  const jobs = useCollection<ProvisioningJob>('jobs', JOBS)
  const { reprendreJob } = useAtelier()

  const avancement = (j: ProvisioningJob) => {
    const faites = j.taches.filter((t) => t.statut === 'ok').length
    return { faites, total: j.taches.length, pct: Math.round((faites / j.taches.length) * 100) }
  }

  const colonnes: Array<Colonne<ProvisioningJob>> = [
    {
      id: 'label',
      entete: 'Opération',
      cle: (j) => j.label,
      rendu: (j) => (
        <span className="block">
          <span className="block text-[12.5px] font-semibold text-ink">{j.label}</span>
          <span className="block font-mono text-[11px] text-g-500">{j.type}</span>
        </span>
      ),
    },
    {
      id: 'statut',
      entete: 'État',
      cle: (j) => j.statut,
      rendu: (j) => (
        <Badge tone={TON_STATUT_JOB[j.statut]} size="sm">
          {LIBELLE_STATUT_JOB[j.statut]}
        </Badge>
      ),
    },
    {
      id: 'avancement',
      entete: 'Avancement',
      cle: (j) => avancement(j).pct,
      rendu: (j) => {
        const a = avancement(j)
        return (
          <span className="block w-32">
            <span className="tnum block text-[11.5px] text-g-700">
              {a.faites}/{a.total} étapes
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-g-100">
              <span
                className={
                  j.statut === 'failed'
                    ? 'block h-full rounded-full bg-err'
                    : 'block h-full rounded-full bg-p-600'
                }
                style={{ width: `${a.pct}%` }}
              />
            </span>
          </span>
        )
      },
    },
    {
      id: 'etape',
      entete: 'Étape courante',
      cle: (j) => j.taches.find((t) => t.statut === 'running')?.nom ?? '',
      rendu: (j) => {
        const courante = j.taches.find((t) => t.statut === 'running')
        const echouee = j.taches.find((t) => t.statut === 'failed')
        if (echouee) return <span className="text-[12px] text-err">{echouee.nom}</span>
        if (courante) return <span className="text-[12px] text-g-700">{courante.nom}</span>
        return <span className="text-[12px] text-g-500">—</span>
      },
      masquable: true,
    },
    {
      id: 'debut',
      entete: 'Démarrée',
      cle: (j) => j.startedAt,
      rendu: (j) => <span className="text-[12px] text-g-700">{relatif(j.startedAt, maintenant)}</span>,
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (j) => (
        <span className="flex items-center justify-end gap-1.5">
          {(j.statut === 'failed' || j.statut === 'rolled_back') && (
            <BoutonAction
              libelle="Reprendre"
              icone={<RotateCw size={13} />}
              operation={{
                titre: `Reprise de « ${j.label} »`,
                detail:
                  'Le job repart de l’étape échouée. Les étapes déjà réussies ne sont pas rejouées.',
                appel: () => requete(`/travaux/${encodeURIComponent(j.id)}/relance`, { methode: 'POST' }),
                effet: () => reprendreJob(j.id),
              }}
            />
          )}
          {(j.statut === 'running' || j.statut === 'queued') && (
            <BoutonAction
              libelle="Annuler"
              variant="ghost"
              icone={<XCircle size={13} />}
              operation={{
                ton: 'warn',
                titre: `« ${j.label} » annulée`,
                detail: 'Les ressources déjà réservées ont été libérées.',
                appel: () =>
                  requete(`/travaux/${encodeURIComponent(j.id)}/annulation`, { methode: 'POST' }),
                effet: () =>
                  jobs.modifier(j.id, (job) => ({
                    statut: 'rolled_back',
                    taches: job.taches.map((t) =>
                      t.statut === 'running' || t.statut === 'pending'
                        ? { ...t, statut: 'pending' }
                        : t,
                    ),
                  })),
                effetFinal: () => jobs.recharger(),
              }}
            />
          )}
          <Link
            href={`/app/taches/${j.id}`}
            className="text-[12px] font-semibold text-p-700 hover:text-m-600"
          >
            Suivre →
          </Link>
        </span>
      ),
    },
  ]

  const enCours = jobs.items.filter((j) => j.statut === 'running' || j.statut === 'queued')
  const echecs = jobs.items.filter((j) => j.statut === 'failed')
  const terminees = jobs.items.filter((j) => j.statut === 'done')

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Centre de tâches' }]}
        titre="Centre de tâches"
        sousTitre="Toute opération qui prend plus de quelques secondes — création de machine, souscription, restauration, bascule — devient une tâche suivie ici. Vous pouvez quitter la page : l’avancement continue et une notification signale la fin."
        actions={
          <BoutonAction
            libelle="Purger les tâches terminées"
            variant="ghost"
            icone={<Trash2 size={13} />}
            desactive={terminees.length === 0}
            operation={{
              ton: 'info',
              titre: `${terminees.length} tâche(s) retirée(s) de la liste`,
              detail: 'Les tâches purgées restent dans le journal d’audit.',
              effet: () => jobs.supprimer(terminees.map((j) => j.id)),
            }}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile libelle="En cours" valeur={enCours.length} ton={enCours.length ? 'info' : 'neutral'} />
        <StatTile libelle="Terminées" valeur={terminees.length} ton="ok" />
        <StatTile
          libelle="En échec"
          valeur={echecs.length}
          ton={echecs.length ? 'err' : 'ok'}
          detail={echecs.length ? 'Rollback automatique effectué' : undefined}
        />
        <StatTile libelle="Total" valeur={jobs.items.length} />
      </div>

      {echecs.length > 0 && (
        <Callout ton="err" titre="Des tâches ont échoué">
          Un échec ne laisse jamais de ressource à moitié créée : la capacité réservée est libérée et
          aucune souscription facturable n’est ouverte. Le diagnostic est lisible, avec un
          identifiant de corrélation à joindre au support si vous ouvrez un ticket.
        </Callout>
      )}

      <DataTable
        lignes={jobs.items}
        colonnes={colonnes}
        placeholderRecherche="Rechercher une opération…"
        filtres={[
          {
            id: 'statut',
            libelle: 'État',
            options: (Object.keys(LIBELLE_STATUT_JOB) as Array<ProvisioningJob['statut']>).map((s) => ({
              value: s,
              label: LIBELLE_STATUT_JOB[s],
            })),
          },
        ]}
        selection={(j, _id, val) => j.statut === val}
        vide={{
          titre: 'Aucune tâche en cours',
          phrase:
            'Le centre de tâches se remplit dès qu’une opération longue démarre. Il conserve la séquence exécutée par l’orchestrateur, étape par étape, ce qui permet de dire précisément où une création s’est arrêtée.',
          action: { libelle: 'Créer des machines', href: '/app/vms/new' },
        }}
      />

      <Card>
        <CardHeader
          titre="Ce que le centre de tâches ne fait pas"
          sousTitre="Il suit des opérations de provisionnement, pas des traitements applicatifs."
        />
        <p className="text-[12.5px] leading-relaxed text-g-700">
          Les tâches listées ici sont celles de l’orchestrateur d’infrastructure. Les traitements de
          vos propres applications — files de messages, tâches planifiées, imports métier — restent
          dans vos applications : le portail n’en est pas l’ordonnanceur et ne cherche pas à le
          devenir.
        </p>
      </Card>
    </div>
  )
}
