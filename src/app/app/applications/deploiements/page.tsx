'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GitCommitHorizontal, RotateCcw, ShieldCheck } from 'lucide-react'
import { dateHeure, duree, relatif } from '@/lib/format'
import { DEPLOIEMENTS, appById, hrefDuService } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { DeploymentPipeline, SecurityFindings } from '@/components/business/paas'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction } from '@/components/app/actions'
import { estActif, requete } from '@/lib/api/client'
import type { Deployment } from '@/lib/types'

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

export default function Deploiements() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const lesDeploiements = useCollection<Deployment>('deploiements', DEPLOIEMENTS)
  const [ouvert, setOuvert] = useState<string | null>(
    lesDeploiements.items.find((d) => d.statut === 'failed')?.id ?? DEPLOIEMENTS[0]?.id ?? null,
  )

  const enCours = lesDeploiements.items.filter(
    (d) => !['live', 'failed', 'rolled_back'].includes(d.statut),
  ).length
  const echecs = lesDeploiements.items.filter((d) => d.statut === 'failed').length
  const reussis = lesDeploiements.items.filter((d) => d.statut === 'live').length
  const bloquants = lesDeploiements.items.reduce(
    (a, d) => a + d.findings.filter((f) => f.severite === 'eleve').length,
    0,
  )

  const chronometres = lesDeploiements.items.filter((d) => d.dureeS)
  const dureeMoy = Math.round(
    chronometres.reduce((a, d) => a + (d.dureeS ?? 0), 0) / Math.max(1, chronometres.length),
  )

  const selection = ouvert ? lesDeploiements.items.find((d) => d.id === ouvert) : undefined

  // Comptés depuis les déploiements réellement chargés (réels en mode API, de
  // la graine sinon) — pas depuis l'ancien modèle PaaS figé (§ « Partie 11 »),
  // qui n'a plus aucun lien avec ce qui est effectivement suivi.
  const appsSuivies = [...new Set(lesDeploiements.items.map((d) => d.appId))]
  const envsSuivis = new Set(lesDeploiements.items.map((d) => d.envId)).size

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Déploiements' }]}
        titre="Déploiements"
        sousTitre="L’historique complet de tous les déploiements de l’organisation, applications confondues. Chaque ligne est immuable : le commit, l’artefact, le résultat de l’analyse DevSecOps et l’auteur restent consultables indéfiniment, y compris après un retour arrière. Tous Espaces Cloud confondus : un historique de livraisons ne se lit pas Espace par Espace."
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {appsSuivies.length} application{appsSuivies.length > 1 ? 's' : ''} suivie
              {appsSuivies.length > 1 ? 's' : ''}
            </Badge>
            <Badge tone="neutral" size="sm">
              {envsSuivis} environnement{envsSuivis > 1 ? 's' : ''}
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile libelle="Déploiements en ligne" valeur={reussis} ton="ok" />
        <StatTile
          libelle="En cours"
          valeur={enCours}
          ton={enCours > 0 ? 'info' : 'neutral'}
          detail={enCours > 0 ? 'Suivi temps réel ci-dessous' : 'Aucun en vol'}
        />
        <StatTile
          libelle="Échecs"
          valeur={echecs}
          ton={echecs > 0 ? 'err' : 'ok'}
          detail={echecs > 0 ? 'Diagnostic disponible' : 'Aucun échec'}
        />
        <StatTile
          libelle="Vulnérabilités bloquantes"
          valeur={bloquants}
          ton={bloquants > 0 ? 'err' : 'ok'}
          detail="Critiques non corrigées"
        />
        <StatTile libelle="Durée médiane" valeur={duree(dureeMoy)} detail="Du commit à la mise en ligne" />
      </div>

      {bloquants > 0 && (
        <Callout ton="err" titre="Un déploiement a été refusé par la politique de sécurité">
          L’analyse DevSecOps a détecté une vulnérabilité critique dans une dépendance. La politique
          de l’organisation refuse la mise en production dans ce cas — le déploiement s’arrête à
          l’étape d’analyse et ne touche jamais la production. Le correctif proposé est appliqué en
          un clic depuis le détail du déploiement.
        </Callout>
      )}

      <Card padding={false}>
        <div className="border-b border-g-100 px-4 py-3.5">
          <CardHeader
            titre="Historique immuable"
            sousTitre="Cliquez sur une ligne pour dérouler son pipeline, ses journaux et son rapport d’analyse."
            className="mb-0"
          />
        </div>
        <div className="p-4">
          <DataTable<Deployment>
            lignes={[...lesDeploiements.items].sort((a, b) => b.startedAt.localeCompare(a.startedAt))}
            parPage={10}
            exportable
            placeholderRecherche="Rechercher un commit, une version, une application…"
            filtres={[
              {
                id: 'statut',
                libelle: 'Statut',
                options: [
                  { value: 'tous', label: 'Tous les statuts' },
                  { value: 'live', label: 'En ligne' },
                  { value: 'failed', label: 'Échec' },
                  { value: 'rolled_back', label: 'Annulé' },
                  { value: 'encours', label: 'En cours' },
                ],
              },
              {
                id: 'app',
                libelle: 'Application',
                options: [
                  { value: 'tous', label: 'Toutes les applications' },
                  ...appsSuivies.map((id) => ({ value: id, label: appById(id)?.nom ?? id })),
                ],
              },
            ]}
            selection={(l, fid, val) => {
              if (fid === 'app') return l.appId === val
              if (fid === 'statut') {
                if (val === 'encours')
                  return !['live', 'failed', 'rolled_back'].includes(l.statut)
                return l.statut === val
              }
              return true
            }}
            colonnes={[
              {
                id: 'app',
                entete: 'Application / environnement',
                cle: (d) => `${appById(d.appId)?.nom ?? ''} ${d.envNom}`,
                rendu: (d) => (
                  <span className="block min-w-0">
                    <Link
                      href={hrefDuService(d.appId)}
                      className="block truncate font-mono text-[12.5px] font-semibold text-ink hover:text-p-700"
                    >
                      {appById(d.appId)?.nom ?? d.appId}
                    </Link>
                    {/* d.envNom vient du déploiement lui-même (le contrat le porte) — envById()
                        ne résout que les environnements de la graine, jamais ceux créés par
                        l'API réelle. */}
                    <span className="block text-[11px] text-g-500">{d.envNom}</span>
                  </span>
                ),
              },
              {
                id: 'version',
                entete: 'Version',
                cle: (d) => d.version,
                rendu: (d) => (
                  <span className="block">
                    <span className="block font-mono text-[12px] text-ink">{d.version}</span>
                    {d.commit && (
                      <span className="flex items-center gap-1 font-mono text-[11px] text-g-500">
                        <GitCommitHorizontal size={11} />
                        {d.commit}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                id: 'message',
                entete: 'Message',
                cle: (d) => d.commitMessage ?? '',
                masquable: true,
                rendu: (d) => (
                  <span className="line-clamp-2 max-w-[26ch] text-[12px] text-g-700">
                    {d.commitMessage ?? '—'}
                  </span>
                ),
              },
              {
                id: 'analyse',
                entete: 'Analyse',
                aligne: 'center',
                cle: (d) => d.findings.length,
                rendu: (d) => {
                  if (d.findings.length === 0)
                    return <span className="text-[11.5px] text-g-500">—</span>
                  const crit = d.findings.filter((f) => f.severite === 'eleve').length
                  return (
                    <span className="flex items-center justify-center gap-1">
                      <ShieldCheck size={12} className={crit > 0 ? 'text-err' : 'text-ok'} />
                      <Badge tone={crit > 0 ? 'err' : 'ok'} size="sm">
                        {crit > 0 ? `${crit} critique${crit > 1 ? 's' : ''}` : 'Conforme'}
                      </Badge>
                    </span>
                  )
                },
              },
              {
                id: 'statut',
                entete: 'Statut',
                cle: (d) => d.statut,
                rendu: (d) => (
                  <Badge tone={TON_STATUT[d.statut]} dot size="sm">
                    {LIBELLE_STATUT[d.statut]}
                  </Badge>
                ),
              },
              {
                id: 'duree',
                entete: 'Durée',
                aligne: 'right',
                cle: (d) => d.dureeS ?? 0,
                rendu: (d) => (
                  <span className="tnum text-[12px] text-g-700">
                    {d.dureeS ? duree(d.dureeS) : '—'}
                  </span>
                ),
              },
              {
                id: 'quand',
                entete: 'Lancé',
                aligne: 'right',
                cle: (d) => d.startedAt,
                rendu: (d) => (
                  <span className="block text-right">
                    <span className="block text-[12px] text-ink">{relatif(d.startedAt, maintenant)}</span>
                    <span className="block text-[10.5px] text-g-500">{dateHeure(d.startedAt)}</span>
                  </span>
                ),
              },
              {
                id: 'auteur',
                entete: 'Auteur',
                cle: (d) => d.auteur,
                masquable: true,
                masqueeParDefaut: true,
                rendu: (d) => <span className="text-[12px] text-g-700">{d.auteur}</span>,
              },
              {
                id: 'actions',
                entete: '',
                aligne: 'right',
                rendu: (d) => (
                  <span className="flex items-center justify-end gap-1.5">
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
                          effetFinal: () => {
                            if (estActif()) {
                              lesDeploiements.recharger()
                              return
                            }
                            lesDeploiements.modifier(d.id, { statut: 'rolled_back' })
                            const precedent = lesDeploiements.items.find(
                              (x) => x.appId === d.appId && x.id !== d.id && x.statut !== 'failed',
                            )
                            if (precedent) {
                              lesDeploiements.modifier(precedent.id, { statut: 'live' })
                            }
                          },
                        }}
                      />
                    )}
                  </span>
                ),
              },
            ]}
            vide={{
              titre: 'Aucun déploiement',
              phrase: 'L’historique se remplit dès votre premier déploiement.',
              action: { libelle: 'Ouvrir un projet', href: '/app/applications/projets' },
            }}
          />
        </div>
      </Card>

      {selection && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre={
                <span className="flex flex-wrap items-baseline gap-2">
                  <span>{appById(selection.appId)?.nom ?? selection.appId}</span>
                  <span className="font-mono text-[12px] font-normal text-g-500">
                    {selection.version} · {selection.envNom}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="violet" titre="Le retour arrière ne reconstruit rien">
          Chaque déploiement conserve son artefact. Un retour arrière repromeut l’artefact précédent
          tel quel — pas de rebuild, pas de dépendance à récupérer, pas de surprise de version. C’est
          la raison pour laquelle une remise en état prend quelques secondes plutôt qu’un quart
          d’heure.
        </Callout>
        <Callout ton="info" titre="L’historique ne se réécrit pas">
          Un déploiement annulé reste dans l’historique, avec son motif et son auteur. C’est ce qui
          permet, six mois plus tard, de répondre à la question « qu’est-ce qui tournait le 12 mars à
          14 h ? » sans reconstituer les faits de mémoire.
        </Callout>
      </div>
    </div>
  )
}
