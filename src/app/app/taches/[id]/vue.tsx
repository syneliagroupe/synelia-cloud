'use client'

import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { relatif } from '@/lib/format'
import type { ProvisioningJob } from '@/lib/types'
import { requete } from '@/lib/api/client'
import { JOBS, JOBS_PLATEFORME } from '@/lib/mock'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/composition/states'
import { JobTracker } from '@/components/business/paas'
import { LIBELLE_STATUT_JOB, TON_STATUT_JOB } from '@/lib/workflows'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { BoutonAction } from '@/components/app/actions'
import { useMaintenant } from '@/components/app/contexte'

/**
 * Les tâches nées pendant la session vivent dans l'atelier, pas dans le jeu
 * de données : la vue est donc cliente. Les jobs plateforme restent lisibles
 * ici, les liens de la maquette pointant vers les deux jeux.
 */
export function VueSuiviTache({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const jobs = useCollection<ProvisioningJob>('jobs', JOBS)
  const { reprendreJob } = useAtelier()
  const job = jobs.items.find((j) => j.id === id) ?? JOBS_PLATEFORME.find((j) => j.id === id)

  if (!job) {
    return (
      <div className="space-y-6">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Centre de tâches', href: '/app/taches' },
            { label: 'Tâche introuvable' },
          ]}
          titre="Tâche introuvable"
        />
        <EmptyState
          titre="Cette tâche n’existe plus"
          phrase="Les tâches purgées disparaissent de la liste mais restent dans le journal d’audit, avec leur identifiant de corrélation."
          action={{ libelle: 'Retour au centre de tâches', href: '/app/taches' }}
        />
      </div>
    )
  }

  const autres = jobs.items.filter((j) => j.id !== job.id && j.orgId === job.orgId).slice(0, 4)

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Centre de tâches', href: '/app/taches' },
          { label: job.label },
        ]}
        titre="Suivi du provisioning"
        sousTitre="L’orchestrateur exécute les tâches séquentiellement. Vous pouvez quitter cette page à tout moment : le centre de tâches conserve le suivi et une notification signalera la fin."
        actions={
          <>
            {(job.statut === 'failed' || job.statut === 'rolled_back') && (
              <BoutonAction
                libelle="Reprendre à l’étape échouée"
                variant="primary"
                size="md"
                icone={<RotateCcw size={14} />}
                operation={{
                  titre: `Reprise de « ${job.label} »`,
                  detail:
                    'Le job repart de l’étape échouée. Les étapes déjà réussies ne sont pas rejouées.',
                  appel: () =>
                    requete(`/travaux/${encodeURIComponent(job.id)}/relance`, { methode: 'POST' }),
                  effet: () => reprendreJob(job.id),
                }}
              />
            )}
            <ButtonLink
              href="/app/taches"
              variant="secondary"
              iconBefore={<ArrowLeft size={14} />}
            >
              Centre de tâches
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <JobTracker job={job} />

          {job.statut === 'failed' && (
            <Callout ton="err" titre="Ce job a échoué et a été annulé proprement">
              La capacité réservée a été libérée automatiquement et aucune souscription facturable
              n’a été créée. Corrigez la cause indiquée ci-dessus puis relancez la souscription :
              vos choix de configuration sont conservés.
            </Callout>
          )}

          {job.statut === 'rolled_back' && (
            <Callout ton="warn" titre="Cette tâche a été annulée">
              Les étapes déjà exécutées ont été défaites dans l’ordre inverse. Aucune ressource ne
              reste réservée et rien n’a été facturé.
            </Callout>
          )}

          {job.statut === 'done' && (
            <Callout ton="ok" titre="Provisioning terminé">
              Le service est opérationnel. Le bouton{' '}
              <span className="font-semibold text-m-600">Ouvrir</span> de sa carte vous redirige
              désormais en SSO vers son interface d’origine.
            </Callout>
          )}
        </div>

        <aside className="space-y-4">
          {/*
            Un encart « Les sept tâches de l'orchestrateur » listait ici une
            séquence marketplace fixe (§6.4), affichée sous n'importe quel job
            — y compris des jobs réels sans rapport (`vm.delete`…). `JobTracker`
            ci-contre montre déjà les étapes réelles de *ce* job
            (`job.taches`) : le texte générique ne faisait qu'ajouter un
            discours marketing sous des données réelles. Retiré plutôt que
            réétiqueté « Démonstration », faute d'information qu'il ajoutait.
          */}
          {autres.length > 0 && (
            <Card>
              <CardHeader titre="Autres tâches récentes" />
              <ul className="space-y-2">
                {autres.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/app/taches/${j.id}`}
                      className="group flex items-start justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] text-ink group-hover:text-p-700">
                          {j.label}
                        </span>
                        <span className="block text-[11px] text-g-500">{relatif(j.startedAt, maintenant)}</span>
                      </span>
                      <Badge size="sm" tone={TON_STATUT_JOB[j.statut]} className="mt-0.5 shrink-0">
                        {LIBELLE_STATUT_JOB[j.statut]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
