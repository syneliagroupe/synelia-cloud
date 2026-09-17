'use client'

import { useState } from 'react'
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  Loader2,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { duree, relatif } from '@/lib/format'
import type { Anomalie } from '@/lib/mock/paas'
import type { Component, Deployment, ProvisioningJob } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { CodeBlock } from '@/components/ui/display'
import { useMaintenant } from '@/components/app/contexte'

const ETAPE_LABELS: Record<string, { titre: string; detail: string }> = {
  build: { titre: 'Build', detail: 'Nixpacks, Dockerfile ou image pré-construite' },
  scan: { titre: 'Analyse DevSecOps', detail: 'Secrets, ports exposés, CVE' },
  provision: { titre: 'Provisioning', detail: 'Mise en place des briques sur la cible' },
  deploy: { titre: 'Déploiement', detail: 'Bascule sans coupure, health check, promotion' },
}

function IconeEtat({ statut }: { statut: 'pending' | 'running' | 'ok' | 'failed' }) {
  if (statut === 'ok') return <CircleCheck size={16} className="shrink-0 text-ok" />
  if (statut === 'failed') return <CircleAlert size={16} className="shrink-0 text-err" />
  if (statut === 'running')
    return <Loader2 size={16} className="shrink-0 animate-spin text-info" />
  return <CircleDashed size={16} className="shrink-0 text-g-300" />
}

/** Pipeline de déploiement : quatre étapes avec état, durée, journal (§5.3). */
export function DeploymentPipeline({
  deploiement,
  journaux,
  className,
}: {
  deploiement: Deployment
  journaux?: Record<string, string>
  className?: string
}) {
  const [ouvert, setOuvert] = useState<string | null>(
    deploiement.etapes.find((e) => e.statut === 'failed')?.nom ?? null,
  )

  return (
    <div className={cn('space-y-2', className)}>
      {deploiement.etapes.map((e, i) => {
        const meta = ETAPE_LABELS[e.nom]
        const estOuvert = ouvert === e.nom
        return (
          <div
            key={e.nom}
            className={cn(
              'overflow-hidden rounded-[8px] border bg-white',
              e.statut === 'failed'
                ? 'border-[#EFC3BD]'
                : e.statut === 'running'
                  ? 'border-[#BFD6EE]'
                  : 'border-g-300',
            )}
          >
            <button
              type="button"
              onClick={() => setOuvert(estOuvert ? null : e.nom)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-g-050"
            >
              <span className="tnum text-[11px] font-bold text-g-500">{i + 1}</span>
              <IconeEtat statut={e.statut} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-ink">{meta.titre}</span>
                <span className="block truncate text-[11.5px] text-g-500">
                  {e.detail ?? meta.detail}
                </span>
              </span>
              {e.dureeS !== undefined && (
                <span className="tnum shrink-0 text-[11.5px] text-g-500">{duree(e.dureeS)}</span>
              )}
              <ChevronDown
                size={14}
                className={cn('shrink-0 text-g-500 transition-transform', estOuvert && 'rotate-180')}
              />
            </button>
            {estOuvert && (
              <div className="border-t border-g-100 px-3.5 py-3">
                <CodeBlock
                  langue={`journal · ${e.logRef}`}
                  code={
                    journaux?.[e.nom] ??
                    JOURNAUX_DEFAUT[e.nom]?.(deploiement) ??
                    'Aucune sortie enregistrée pour cette étape.'
                  }
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const JOURNAUX_DEFAUT: Record<string, (d: Deployment) => string> = {
  build: (d) =>
    d.statut === 'failed'
      ? [
          '> nixpacks build .',
          'Detected Python application (requirements.txt)',
          'Using Python 3.12.4 (from .python-version)',
          'Collecting psycopg2==2.9.9',
          '  Building wheel for psycopg2 (setup.py) ... error',
          'ERROR: ResolutionImpossible: psycopg2 2.9.9 requires Python <3.12',
          'Build failed with exit code 1',
        ].join('\n')
      : [
          '> nixpacks build .',
          'Detected Node.js application (package.json)',
          'Using Node 20.17.0 · npm 10.8.2',
          'Restoring build cache … 78 % hit',
          '> npm ci --omit=dev',
          `> npm run build   # ${d.version}`,
          'Build succeeded — image poussée vers registry.synelia.cloud',
        ].join('\n'),
  scan: () =>
    [
          '> synelia-scan --secrets --ports --cve',
          'Analyse des couches de l’image … 14 couches',
          'Secrets            : 0 élevé · 1 moyen',
          'Ports exposés      : 2 (443, 80) · 1 signalement',
          'CVE                : 0 élevée · 2 moyennes · 4 faibles',
          'Résultat : PASS avec constats — voir les cartes ci-dessous',
    ].join('\n'),
  provision: () =>
    [
          '> synelia-provision apply',
          'traefik   : inchangé',
          'api       : image mise à jour',
          'postgres  : inchangé',
          'redis     : inchangé',
          'Convergence atteinte en 31 s',
    ].join('\n'),
  deploy: (d) =>
    d.statut === 'rolled_back'
      ? [
          '> synelia-deploy --strategy canary',
          'Bascule 10 % du trafic vers la nouvelle version',
          'Health check /healthz : OK',
          'Taux 5xx : 0,4 % → 2,8 % → 4,2 %',
          'Seuil dépassé (2 % pendant 120 s) — ROLLBACK AUTOMATIQUE',
          'Trafic ramené à 100 % sur la version précédente',
        ].join('\n')
      : [
          '> synelia-deploy --strategy canary',
          'Bascule 10 % du trafic vers la nouvelle version',
          'Health check /healthz : OK (2/2)',
          'Taux 5xx sur la fenêtre : 0,12 % — sous le seuil de 2 %',
          'Promotion du trafic : 10 % → 50 % → 100 %',
          'Déploiement en ligne',
        ].join('\n'),
}

/** Constats de sécurité avec correctif applicable en un clic (§5.3). */
export function SecurityFindings({
  findings,
  className,
}: {
  findings: Deployment['findings']
  className?: string
}) {
  const [corriges, setCorriges] = useState<string[]>([])
  if (findings.length === 0) {
    return (
      <Callout ton="ok" titre="Aucun constat de sécurité" className={className}>
        L’analyse DevSecOps n’a relevé ni secret exposé, ni port d’administration ouvert, ni CVE de
        gravité élevée sur cet artefact.
      </Callout>
    )
  }
  const tons = { eleve: 'err', moyen: 'warn', faible: 'info' } as const
  const labels = { eleve: 'Élevé', moyen: 'Moyen', faible: 'Faible' }

  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {findings.map((f) => {
        const fait = corriges.includes(f.titre)
        return (
          <Card key={f.titre} className={fait ? 'border-[#B7E3D0] bg-ok-bg' : undefined}>
            <div className="flex items-start justify-between gap-3">
              <h4 className="type-h3">{f.titre}</h4>
              <Badge tone={fait ? 'ok' : tons[f.severite]} size="sm">
                {fait ? 'Corrigé' : labels[f.severite]}
              </Badge>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-700">{f.detail}</p>
            {f.correctif && (
              <div className="mt-3 border-t border-g-100 pt-3">
                <Button
                  size="sm"
                  variant={fait ? 'ghost' : 'secondary'}
                  disabled={fait}
                  iconBefore={<Wrench size={13} />}
                  onClick={() => setCorriges((p) => [...p, f.titre])}
                >
                  {fait ? 'Correctif appliqué' : f.correctif.libelle}
                </Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/**
 * Détection d'anomalie avec faisceau de preuves (§5.5).
 * Ce composant ne montre pas seulement qu'il y a un problème : il montre
 * le raisonnement qui y conduit.
 */
export function AnomalieCard({ anomalie, className }: { anomalie: Anomalie; className?: string }) {
  const maintenant = useMaintenant()
  const [applique, setApplique] = useState(false)
  const tons = { critique: 'err', majeure: 'warn', mineure: 'info' } as const

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tons[anomalie.gravite]} dot size="sm">
              Anomalie détectée
            </Badge>
            <span className="text-[11.5px] text-g-500">
              {anomalie.envNom} · {relatif(anomalie.detecteA, maintenant)}
            </span>
          </div>
          <h3 className="type-h2 mt-2">{anomalie.enonce}</h3>
        </div>
      </div>

      <div className="mt-4">
        <MicroLabel>Faisceau de preuves</MicroLabel>
        <ul className="mt-2 space-y-1.5">
          {anomalie.preuves.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="tnum mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-p-100 text-[9.5px] font-bold text-p-700">
                {i + 1}
              </span>
              <span className="min-w-0 text-[12.5px] leading-relaxed text-g-700">
                {p.texte}
                <span className="ml-1.5 text-[11px] text-g-500">— {p.source}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-[8px] border border-p-300 bg-p-050 p-3.5">
        <div className="flex items-start gap-2.5">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-p-700" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">{anomalie.correctif.libelle}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-g-700">
              {anomalie.correctif.detail}
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={applique}
              onClick={() => setApplique(true)}
              iconBefore={<Wrench size={13} />}
            >
              {applique ? 'Correctif appliqué — déploiement lancé' : 'Appliquer le correctif & relancer'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

/** Diagnostic d'échec de build lisible, plutôt qu'un journal brut (§5.5). */
export function BuildDiagnostic({
  erreur,
  traduction,
  correctifs,
  className,
}: {
  erreur: string
  traduction: string
  correctifs: string[]
  className?: string
}) {
  return (
    <Card className={cn('border-[#EFC3BD]', className)}>
      <CardHeader
        titre="Diagnostic de l’échec de build"
        sousTitre="Nous traduisons l’erreur plutôt que de vous renvoyer le journal brut."
      />
      <code className="block rounded-[6px] bg-err-bg px-3 py-2 font-mono text-[12px] text-err">
        {erreur}
      </code>
      <p className="mt-3 text-[13px] leading-relaxed text-g-700">{traduction}</p>
      <div className="mt-3.5 border-t border-g-100 pt-3">
        <MicroLabel>Correctifs possibles</MicroLabel>
        <ul className="mt-2 space-y-1.5">
          {correctifs.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[12.5px] text-g-700">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-p-600" />
              {c}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

/** Suivi d'un job de provisioning et de ses tâches (§6.4). */
export function JobTracker({
  job,
  className,
}: {
  job: ProvisioningJob
  className?: string
}) {
  const maintenant = useMaintenant()
  const total = job.taches.length
  const faites = job.taches.filter((t) => t.statut === 'ok').length

  return (
    <Card className={className}>
      <CardHeader
        titre={job.label}
        sousTitre={`Démarré ${relatif(job.startedAt, maintenant)}${job.dureeS ? ` · durée ${duree(job.dureeS)}` : ''}`}
        actions={
          <Badge
            tone={
              job.statut === 'done'
                ? 'ok'
                : job.statut === 'failed'
                  ? 'err'
                  : job.statut === 'rolled_back'
                    ? 'warn'
                    : 'info'
            }
            dot
          >
            {
              {
                queued: 'En file',
                running: 'En cours',
                done: 'Prêt',
                failed: 'Échec',
                rolled_back: 'Annulé / restauré',
              }[job.statut]
            }
          </Badge>
        }
      />

      <div className="mb-3.5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-g-100">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              job.statut === 'failed' ? 'bg-err' : 'bg-p-600',
            )}
            style={{ width: `${(faites / total) * 100}%` }}
          />
        </div>
        <span className="tnum text-[11.5px] font-semibold text-g-500">
          {faites}/{total}
        </span>
      </div>

      <ol className="space-y-2">
        {job.taches.map((t) => (
          <li key={t.ordre} className="flex items-start gap-3">
            <IconeEtat statut={t.statut} />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-[13px]',
                  t.statut === 'pending' ? 'text-g-500' : 'text-ink',
                )}
              >
                {t.nom}
              </span>
              {t.message && <span className="block text-[11.5px] text-g-500">{t.message}</span>}
            </span>
            {t.dureeS !== undefined && (
              <span className="tnum shrink-0 text-[11.5px] text-g-500">{duree(t.dureeS)}</span>
            )}
          </li>
        ))}
      </ol>

      {job.erreur && (
        <div className="mt-4 rounded-[8px] border-l-4 border-err bg-err-bg px-3.5 py-3">
          <p className="text-[13px] font-semibold text-ink">Diagnostic</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-g-700">{job.erreur.message}</p>
          {job.erreur.suggestion && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-g-700">
              <span className="font-semibold">Que faire — </span>
              {job.erreur.suggestion}
            </p>
          )}
          <p className="mt-2 font-mono text-[11.5px] text-g-500">
            Identifiant de corrélation : {job.erreur.correlationId}
          </p>
        </div>
      )}

      {job.statut === 'running' && (
        <p className="mt-3.5 border-t border-g-100 pt-3 text-[11.5px] text-g-500">
          Vous pouvez quitter cette page : le centre de tâches conserve le suivi et une
          notification signalera la fin de l’opération.
        </p>
      )}
    </Card>
  )
}

/** Détail d'un composant, avec son emplacement réel d'exécution (§5.4). */
export function ComponentCard({
  composant,
  className,
}: {
  composant: Component
  className?: string
}) {
  const tons = { deployed: 'ok', degraded: 'warn', stopped: 'neutral', failed: 'err' } as const
  const labels = {
    deployed: 'Déployé',
    degraded: 'Dégradé',
    stopped: 'Arrêté',
    failed: 'En échec',
  }
  const roles: Record<Component['role'], string> = {
    web: 'Serveur web',
    api: 'Service applicatif',
    db: 'Base de données',
    cache: 'Cache',
    proxy: 'Proxy / entrée',
    worker: 'Worker de file',
    cron: 'Tâche planifiée',
    observabilite: 'Observabilité',
  }

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="type-h3 font-mono">{composant.nom}</h3>
          <p className="mt-0.5 text-[11.5px] text-g-500">{roles[composant.role]}</p>
        </div>
        <Badge tone={tons[composant.statut]} dot size="sm">
          {labels[composant.statut]}
        </Badge>
      </div>

      <dl className="mt-3.5 space-y-2">
        <Ligne cle="Image" valeur={`${composant.image}:${composant.version}`} mono />
        <Ligne
          cle="Ressources"
          valeur={`${composant.ressources.cpu} vCPU · ${composant.ressources.ramMo} Mo · ${composant.ressources.diskGo} Go`}
        />
        {composant.ports.length > 0 && (
          <Ligne
            cle="Ports & endpoints"
            valeur={composant.ports
              .map((p) => `${p.type} · :${p.interne}${p.expose ? ` → ${p.expose}` : ''}`)
              .join('  ·  ')}
            mono
          />
        )}
        {composant.storage?.length ? (
          <Ligne
            cle="Stockage persistant"
            valeur={composant.storage
              .map((s) => `${s.chemin} · ${s.tailleGo} Go ${s.classe}`)
              .join('  ·  ')}
            mono
          />
        ) : null}
        <Ligne
          cle="Variables"
          valeur={`${composant.envVars.length} déclarées · ${composant.envVars.filter((v) => v.secret).length} secrètes`}
        />
      </dl>

      <div className="mt-3.5 rounded-[8px] bg-p-050 px-3 py-2.5">
        <MicroLabel className="text-p-700">Emplacement réel d’exécution</MicroLabel>
        <p className="mt-1 font-mono text-[12px] text-ink">
          {composant.emplacement.namespace
            ? `namespace ${composant.emplacement.namespace}`
            : 'machines virtuelles'}
        </p>
        <ul className="mt-1 space-y-0.5">
          {(composant.emplacement.pods ?? composant.emplacement.vms ?? []).map((x) => (
            <li key={x} className="font-mono text-[11.5px] text-g-700">
              · {x}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function Ligne({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-g-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-[11.5px] text-g-500">{cle}</dt>
      <dd
        className={cn(
          'min-w-0 text-right text-[12.5px] text-ink',
          mono && 'font-mono text-[11.5px]',
        )}
      >
        {valeur}
      </dd>
    </div>
  )
}

/** Lien de prévisualisation d'un déploiement par branche ou PR. */
export function PreviewLink({ url, pr, branche }: { url: string; pr?: number; branche?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-p-300 bg-p-050 px-2.5 py-1 text-[11.5px] font-semibold text-p-700 transition-colors hover:border-m-600 hover:text-m-600"
    >
      {pr ? `PR #${pr}` : branche}
      <ExternalLink size={11} />
    </a>
  )
}
