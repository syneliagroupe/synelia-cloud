'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { GitCommitHorizontal, Rocket, RotateCcw, ShieldCheck } from 'lucide-react'
import { dateHeure, duree, relatif } from '@/lib/format'
import type { Deployment, Projet, ServiceProjet } from '@/lib/types'
import {
  DEPLOIEMENTS,
  PROJETS,
  SERVICES_PROJET,
  appById,
  envById,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { DeploymentPipeline, SecurityFindings } from '@/components/business/paas'
import { EnteteProjet, ProjetIntrouvable } from '@/components/business/projets'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { useServicesProjet } from '@/lib/api/services-projet'
import { BoutonAction } from '@/components/app/actions'
import { estActif, requete } from '@/lib/api/client'

const LIBELLE_STATUT: Record<Deployment['statut'], string> = {
  queued: 'En file',
  building: 'Construction',
  scanning: 'Analyse',
  provisioning: 'Provisioning',
  deploying: 'Déploiement',
  live: 'En ligne',
  failed: 'Échec',
  rolled_back: 'Annulé',
}

const TON_STATUT: Record<Deployment['statut'], 'ok' | 'err' | 'warn' | 'info'> = {
  queued: 'info',
  building: 'info',
  scanning: 'info',
  provisioning: 'info',
  deploying: 'info',
  live: 'ok',
  failed: 'err',
  rolled_back: 'warn',
}

export function VueDeploiements({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const lesDeploiements = useCollection<Deployment>('deploiements', DEPLOIEMENTS)
  const { autorise, refus } = useApp()

  const projet = lesProjets.items.find((p) => p.id === id)
  // Avec l’API, la liste vient de `GET /projets/{id}/services` (route nichée,
  // hors registre) ; en maquette, du filtre local.
  const { distants: servicesDistants } = useServicesProjet(id)
  const services = useMemo(
    () => servicesDistants ?? lesServices.items.filter((x) => x.projetId === id),
    [servicesDistants, lesServices.items, id],
  )

  // Un déploiement désigne encore une application par son identifiant
  // historique ; le rattachement au projet passe par les services.
  const apps = new Set(services.map((s) => s.appId).filter(Boolean))
  const deploiements = lesDeploiements.items
    .filter((d) => apps.has(d.appId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  const [ouvert, setOuvert] = useState<string | null>(
    deploiements.find((d) => d.statut === 'failed')?.id ?? deploiements[0]?.id ?? null,
  )
  if (!projet) return <ProjetIntrouvable section="Déploiements" />

  const selection = deploiements.find((d) => d.id === ouvert)

  const echecs = deploiements.filter((d) => d.statut === 'failed')
  const enLigne = deploiements.filter((d) => d.statut === 'live')
  const bloquants = deploiements.reduce(
    (a, d) => a + d.findings.filter((f) => f.severite === 'eleve').length,
    0,
  )
  const chronometres = deploiements.filter((d) => d.dureeS)
  const dureeMoy = chronometres.length
    ? Math.round(chronometres.reduce((a, d) => a + (d.dureeS ?? 0), 0) / chronometres.length)
    : 0

  return (
    <div className="space-y-5">
      <EnteteProjet
        projet={projet}
        section="Déploiements"
        titre="Déploiements"
        sousTitre="Tout ce qui a été mis en ligne dans ce projet, dans l’ordre. Chaque ligne est immuable : le commit, l’artefact, le rapport d’analyse et l’auteur restent consultables même après un retour arrière."
        meta={
          <>
            <Badge tone="neutral">
              {deploiements.length} déploiement{deploiements.length > 1 ? 's' : ''}
            </Badge>
            {echecs.length > 0 && (
              <Badge tone="err" dot>
                {echecs.length} en échec
              </Badge>
            )}
          </>
        }
      />

      {deploiements.length === 0 ? (
        <EmptyState
          titre="Aucun déploiement dans ce projet"
          phrase="Ce projet ne contient que des ressources qui ne se déploient pas depuis un dépôt — une base managée, une tâche planifiée ou une solution du catalogue. L’historique se remplira dès la première application."
          icone={<Rocket size={22} />}
          action={{ libelle: 'Déployer une application', href: `/app/applications/projets/${id}` }}
          actionSecondaire={{
            libelle: 'Voir tous les déploiements',
            href: '/app/applications/deploiements',
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile libelle="En ligne" valeur={enLigne.length} ton="ok" />
            <StatTile
              libelle="Échecs"
              valeur={echecs.length}
              ton={echecs.length > 0 ? 'err' : 'ok'}
              detail={echecs.length > 0 ? 'diagnostic ci-dessous' : 'aucun échec'}
            />
            <StatTile
              libelle="Vulnérabilités bloquantes"
              valeur={bloquants}
              ton={bloquants > 0 ? 'err' : 'ok'}
              detail="critiques non corrigées"
            />
            <StatTile
              libelle="Durée médiane"
              valeur={dureeMoy ? duree(dureeMoy) : '—'}
              detail="du commit à la mise en ligne"
            />
          </div>

          {bloquants > 0 && (
            <Callout ton="err" titre="Un déploiement a été refusé par la politique de sécurité">
              L’analyse DevSecOps a trouvé une vulnérabilité critique dans une dépendance. La
              politique de l’organisation refuse la mise en production dans ce cas : le pipeline
              s’arrête à l’analyse et ne touche jamais la production.
            </Callout>
          )}

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Historique du projet"
                sousTitre="Cliquez sur une ligne pour dérouler son pipeline et son rapport d’analyse."
                className="mb-0"
              />
            </div>
            <ul className="divide-y divide-g-100">
              {deploiements.map((d) => (
                <li key={d.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-[12.5px] font-semibold text-ink">
                          {appById(d.appId)?.nom ?? d.appId}
                        </span>
                        <span className="font-mono text-[12px] text-g-700">{d.version}</span>
                        <span className="text-[11.5px] text-g-500">
                          {envById(d.envId)?.nom ?? d.envId}
                        </span>
                      </p>
                      {d.commitMessage && (
                        <p className="mt-0.5 line-clamp-1 max-w-[60ch] text-[12px] text-g-700">
                          {d.commit && (
                            <span className="mr-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-g-500">
                              <GitCommitHorizontal size={11} />
                              {d.commit}
                            </span>
                          )}
                          {d.commitMessage}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-g-500">
                        {relatif(d.startedAt, maintenant)} · {d.auteur}
                        {d.dureeS ? ` · ${duree(d.dureeS)}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.findings.length > 0 && (
                        <Badge
                          tone={
                            d.findings.some((f) => f.severite === 'eleve') ? 'err' : 'ok'
                          }
                          size="sm"
                        >
                          <ShieldCheck size={11} className="mr-1 inline" />
                          {d.findings.some((f) => f.severite === 'eleve')
                            ? 'Critique'
                            : 'Conforme'}
                        </Badge>
                      )}
                      <Badge tone={TON_STATUT[d.statut]} dot size="sm">
                        {LIBELLE_STATUT[d.statut]}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOuvert(d.id === ouvert ? null : d.id)}
                      >
                        {d.id === ouvert ? 'Replier' : 'Détail'}
                      </Button>
                      {d.statut === 'live' && (
                        <BoutonAction
                          libelle="Retour arrière"
                          icone={<RotateCcw size={12} />}
                          operation={{
                            action: 'app.rollback',
                            titre: 'Retour arrière déclenché',
                            detail: `L’artefact précédent de ${appById(d.appId)?.nom} est repromu. Aucun rebuild : la bascule prend quelques secondes.`,
                            appel: () =>
                              requete(
                                `/deploiements/${encodeURIComponent(d.id)}/rollback`,
                                { methode: 'POST', corps: {} },
                              ),
                            job: { workflow: 'app.rollback', cible: `${appById(d.appId)?.nom ?? d.appId} ${d.version}` },
                            // Le déploiement annulé n'est pas effacé : l'historique
                            // doit dire qu'il a existé, et qu'on est revenu en arrière.
                            effetFinal: () => {
                              if (estActif()) {
                                lesDeploiements.recharger()
                                return
                              }
                              lesDeploiements.modifier(d.id, { statut: 'rolled_back' })
                              const precedent = deploiements.find(
                                (x) => x.appId === d.appId && x.id !== d.id && x.statut !== 'failed',
                              )
                              if (precedent) {
                                lesDeploiements.modifier(precedent.id, { statut: 'live' })
                              }
                            },
                          }}
                        />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {selection && (
            <div className="space-y-4">
              <Card>
                <CardHeader
                  titre={
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span>{appById(selection.appId)?.nom ?? selection.appId}</span>
                      <span className="font-mono text-[12px] font-normal text-g-500">
                        {selection.version} · {envById(selection.envId)?.nom}
                      </span>
                    </span>
                  }
                  sousTitre={`Déclenché par ${selection.auteur} · ${dateHeure(selection.startedAt)}`}
                  actions={
                    <Badge tone={TON_STATUT[selection.statut]} dot>
                      {LIBELLE_STATUT[selection.statut]}
                    </Badge>
                  }
                />
                <DeploymentPipeline deploiement={selection} />
              </Card>

              {selection.findings.length > 0 && (
                <Card>
                  <CardHeader
                    titre="Rapport d’analyse DevSecOps"
                    sousTitre="Dépendances, image de base et secrets exposés. Une vulnérabilité critique bloque la mise en production."
                  />
                  <SecurityFindings findings={selection.findings} />
                </Card>
              )}
            </div>
          )}
        </>
      )}

      <Callout ton="violet" titre="Le retour arrière ne reconstruit rien">
        Chaque déploiement conserve son artefact. Revenir en arrière repromeut le précédent tel
        quel — ni rebuild, ni dépendance à récupérer, ni surprise de version. C’est ce qui fait
        qu’une remise en état prend quelques secondes plutôt qu’un quart d’heure. L’historique de
        tous les projets est dans{' '}
        <Link
          href="/app/applications/deploiements"
          className="font-semibold text-p-700 hover:text-m-600"
        >
          la racine de cette section
        </Link>
        .
      </Callout>
    </div>
  )
}
