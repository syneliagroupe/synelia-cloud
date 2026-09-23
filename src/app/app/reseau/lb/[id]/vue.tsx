'use client'

import { useEffect, useState } from 'react'
import { Download, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { dateCourte, num, pct } from '@/lib/format'
import { ESPACES, LOAD_BALANCERS, LOGS_EXECUTION, VMS } from '@/lib/mock'
import type { EspaceCloud, LoadBalancer, VM } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Slider, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { DegradedState, EmptyState } from '@/components/composition/states'
import { StatTile } from '@/components/composition/metrics'
import { GrilleSparkCharts, LogPeek } from '@/components/business/observabilite'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { ApiError, estActif, requete } from '@/lib/api/client'

interface Exception {
  id: string
  chemin: string
  regle: string
  motif: string
}

const EXCEPTIONS_GRAINE: Exception[] = [
  {
    id: 'exc-acme',
    chemin: '/.well-known/acme-challenge/*',
    regle: 'Toutes les règles',
    motif: 'Renouvellement automatique du certificat',
  },
  {
    id: 'exc-upload',
    chemin: '/v1/documents/upload',
    regle: 'REQUEST-941 (XSS)',
    motif: 'Faux positif sur les documents contenant du HTML',
  },
]

const ONGLETS = [
  { id: 'apercu', label: 'Vue d’ensemble' },
  { id: 'backends', label: 'Backends' },
  { id: 'tls', label: 'Écouteurs & TLS' },
  { id: 'regles', label: 'Règles L7' },
  { id: 'waf', label: 'WAF & limitation de débit' },
  { id: 'journaux', label: 'Journaux d’accès' },
]

export function VueLb({ id }: { id: string }) {
  const { autorise, refus, pousser } = useApp()
  const executer = useOperation()
  const lbs = useCollection<LoadBalancer>('load-balancers', LOAD_BALANCERS)
  const parc = useCollection<VM>('vms', VMS)
  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  const exceptions = useCollection<Exception>(`waf-exceptions-${id}`, EXCEPTIONS_GRAINE)
  const [onglet, setOnglet] = useState('apercu')
  /**
   * `GET /load-balancers/{id}/metriques` : un `424` nomme l’intégration en
   * défaut (et la date des dernières données) à la place des courbes.
   */
  const [metriquesDegradees, setMetriquesDegradees] = useState<{
    integration?: string
    dateDonnees?: string
  } | null>(null)
  useEffect(() => {
    if (!estActif()) return
    let annule = false
    requete(`/load-balancers/${encodeURIComponent(id)}/metriques`).then(
      () => {
        if (!annule) setMetriquesDegradees(null)
      },
      (e: unknown) => {
        if (annule) return
        if (e instanceof ApiError && e.statut === 424)
          setMetriquesDegradees({ integration: e.integration, dateDonnees: e.dateDonnees })
      },
    )
    return () => {
      annule = true
    }
  }, [id])

  const lb = lbs.items.find((l) => l.id === id)
  const espace = lb ? espaces.items.find((e) => e.id === lb.espaceId) : undefined

  if (!lb) {
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Load balancers', href: '/app/reseau/lb' },
            { label: 'Introuvable' },
          ]}
          titre="Load balancer introuvable"
        />
        <EmptyState
          titre="Ce load balancer n’existe pas ou plus"
          phrase="Il a peut-être été supprimé, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: 'Retour au réseau', href: '/app/reseau' }}
        />
      </div>
    )
  }
  const candidats = parc.items.filter(
    (v) => v.espaceId === lb.espaceId && !lb.pool.some((p) => p.targetId === v.id),
  )

  /**
   * PUT /load-balancers/{id}/pool — remplacement complet du pool (poids et
   * drain compris). Utilisé sans `useOperation` par les réglages continus
   * (poids, drain) : un toast par frappe serait du bruit, le rechargement
   * suffit à confirmer.
   */
  const publierPool = (pool: LoadBalancer['pool']) => {
    if (!estActif()) {
      lbs.modifier(lb.id, { pool })
      return
    }
    requete(`/load-balancers/${encodeURIComponent(lb.id)}/pool`, {
      methode: 'PUT',
      corps: {
        cibles: pool.map((p) => ({
          targetId: p.targetId,
          poids: p.poids,
          drain: p.sante === 'drain',
        })),
      },
    }).then(
      () => lbs.recharger(),
      (e: unknown) => {
        pousser({
          ton: 'err',
          titre: 'Pool non mis à jour',
          detail: e instanceof ApiError ? e.message : 'Le backend ne répond pas.',
        })
        lbs.recharger()
      },
    )
  }

  /** Même remplacement, sous forme d’`appel` pour les actions discrètes. */
  const appelPool = (pool: LoadBalancer['pool']) => () =>
    requete(`/load-balancers/${encodeURIComponent(lb.id)}/pool`, {
      methode: 'PUT',
      corps: {
        cibles: pool.map((p) => ({
          targetId: p.targetId,
          poids: p.poids,
          drain: p.sante === 'drain',
        })),
      },
    })

  const onglets = lb.layer === 'l7' ? ONGLETS : ONGLETS.filter((o) => o.id !== 'regles' && o.id !== 'waf')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace?.code ?? '', href: `/app/espaces/${lb.espaceId}` },
          { label: 'Load balancers', href: '/app/reseau/lb' },
          { label: lb.nom },
        ]}
        titre={<span className="font-mono">{lb.nom}</span>}
        sousTitre={`${lb.layer === 'l7' ? 'Couche 7 — HTTP/HTTPS' : 'Couche 4 — TCP/UDP'} · ${lb.exposure === 'public' ? 'exposé sur Internet' : 'interne'} · VIP ${lb.vip}`}
        meta={
          <>
            <Badge tone={lb.layer === 'l7' ? 'violet' : 'neutral'}>{lb.layer.toUpperCase()}</Badge>
            <Badge
              tone={
                lb.pool.every((p) => p.sante === 'ok')
                  ? 'ok'
                  : lb.pool.some((p) => p.sante === 'ok')
                    ? 'warn'
                    : 'err'
              }
              dot
            >
              {lb.pool.filter((p) => p.sante === 'ok').length}/{lb.pool.length} backends sains
            </Badge>
            {lb.waf?.actif && <Badge tone="ok">WAF {lb.waf.ruleset}</Badge>}
            <span className="font-mono text-[12px] text-g-500">{lb.vip}</span>
          </>
        }
      />

      <Tabs tabs={onglets} active={onglet} onChange={setOnglet} />

      {/* Vue d'ensemble */}
      {onglet === 'apercu' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              libelle="Requêtes / s"
              valeur={num(lb.metriques.rps)}
              ton="violet"
              serie={seededSeries(`${id}-rps`, 24, lb.metriques.rps * 0.6, lb.metriques.rps * 1.3)}
            />
            <StatTile
              libelle="Latence P50"
              valeur={lb.metriques.p50}
              unite="ms"
              serie={seededSeries(`${id}-p50`, 24, lb.metriques.p50 * 0.8, lb.metriques.p50 * 1.2)}
            />
            <StatTile
              libelle="Latence P95"
              valeur={lb.metriques.p95}
              unite="ms"
              serie={seededSeries(`${id}-p95`, 24, lb.metriques.p95 * 0.7, lb.metriques.p95 * 1.4)}
            />
            <StatTile
              libelle="Latence P99"
              valeur={lb.metriques.p99}
              unite="ms"
              ton="warn"
              serie={seededSeries(`${id}-p99`, 24, lb.metriques.p99 * 0.6, lb.metriques.p99 * 1.5)}
            />
            <StatTile
              libelle="Taux 4xx / 5xx"
              valeur={`${pct(lb.metriques.taux4xx, 1)} / ${pct(lb.metriques.taux5xx, 2)}`}
              ton={lb.metriques.taux5xx > 1 ? 'err' : 'ok'}
            />
            <StatTile
              libelle="Connexions actives"
              valeur={num(lb.metriques.connexions)}
              serie={seededSeries(`${id}-conn`, 24, lb.metriques.connexions * 0.7, lb.metriques.connexions * 1.2)}
            />
          </div>

          {metriquesDegradees ? (
            <DegradedState
              source="métriques du load balancer"
              integration={metriquesDegradees.integration}
              dateDonnees={metriquesDegradees.dateDonnees}
            />
          ) : (
          <GrilleSparkCharts
            seed={`lb-${id}`}
            metriques={[
              { titre: 'Requêtes par seconde', unite: 'req/s', min: lb.metriques.rps * 0.5, max: lb.metriques.rps * 1.4, couleur: 'var(--color-m-600)' },
              { titre: 'Latence P95', unite: 'ms', min: lb.metriques.p95 * 0.7, max: lb.metriques.p95 * 1.5, seuil: 200 },
              { titre: 'Taux 5xx', unite: '%', min: 0, max: Math.max(0.5, lb.metriques.taux5xx * 4), seuil: 2 },
              { titre: 'Connexions actives', unite: '', min: lb.metriques.connexions * 0.6, max: lb.metriques.connexions * 1.3 },
            ]}
          />
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader titre="Configuration" />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'VIP', valeur: <span className="font-mono">{lb.vip}</span> },
                  {
                    cle: 'Algorithme',
                    valeur: {
                      round_robin: 'Round-robin',
                      least_conn: 'Moindre connexion',
                      source_hash: 'Hash IP source',
                      weighted: 'Pondéré',
                    }[lb.algo],
                  },
                  {
                    cle: 'Sessions persistantes',
                    valeur: lb.sticky
                      ? lb.sticky === 'cookie'
                        ? 'Par cookie'
                        : 'Par IP source'
                      : 'Désactivées',
                  },
                  {
                    cle: 'Écouteurs',
                    valeur: lb.listeners
                      .map((l) => `${l.protocole} ${l.port}${l.tlsMin ? ` · ${l.tlsMin}` : ''}`)
                      .join(' · '),
                  },
                  {
                    cle: 'Health check',
                    valeur: `${lb.healthCheck.protocole}${lb.healthCheck.chemin ? ` ${lb.healthCheck.chemin}` : ''} toutes les ${lb.healthCheck.intervalleS} s · seuils ${lb.healthCheck.seuilKo}/${lb.healthCheck.seuilOk}`,
                  },
                ]}
              />
            </Card>
            <Card>
              <CardHeader titre="Accès" />
              <div className="space-y-3">
                <CopyField label="Adresse virtuelle" value={lb.vip} />
                {lb.layer === 'l7' && lb.listeners[0]?.certId && (
                  <CopyField
                    label="Point d’entrée public"
                    value={`https://${lb.reglesL7?.[0]?.hote ?? 'api.dba.africa'}`}
                  />
                )}
              </div>
              {lb.rateLimit && (
                <p className="mt-3 border-t border-g-100 pt-3 text-[11.5px] leading-relaxed text-g-500">
                  Limitation de débit active : {num(lb.rateLimit.requetesParMin)} requêtes par minute
                  et par adresse IP. Au-delà, le load balancer répond 429 sans solliciter les
                  backends.
                </p>
              )}
            </Card>
          </div>

          {lb.metriques.p99 > lb.metriques.p95 * 2 && (
            <Callout ton="warn" titre="Écart marqué entre P95 et P99">
              La latence P99 ({lb.metriques.p99} ms) est plus du double de la P95 (
              {lb.metriques.p95} ms). Cet écart signale généralement une file d’attente ponctuelle
              sur un backend, ou des requêtes lourdes minoritaires. Le journal des requêtes lentes
              côté application est le bon point de départ.
            </Callout>
          )}
        </div>
      )}

      {/* Backends */}
      {onglet === 'backends' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Pool de backends"
              sousTitre="État de santé évalué en direct par le health check."
              actions={
                <BoutonFormulaire
                  libelle="Ajouter une cible"
                  variant="primary"
                  icone={<Plus size={13} />}
                  action="lb.create"
                  titre="Ajouter une cible au pool"
                  description="La cible n’entre dans la répartition qu’après validation du health check."
                  champs={[
                    {
                      id: 'cible',
                      label: 'Machine',
                      type: 'select',
                      options: candidats.map((v) => ({ value: v.id, label: v.nom })),
                    },
                    { id: 'poids', label: 'Poids', type: 'nombre', demi: true, min: 1, max: 100 },
                  ]}
                  valeursDepart={{ poids: 10 }}
                  libelleValider="Ajouter"
                  operation={(v) => {
                    const cible = candidats.find((c) => c.id === v.cible)
                    const pool = cible
                      ? [
                          ...lb.pool,
                          {
                            targetId: cible.id,
                            targetLabel: cible.nom,
                            poids: Number(v.poids),
                            sante: 'drain' as const,
                          },
                        ]
                      : lb.pool
                    return {
                      titre: cible ? `${cible.nom} ajoutée au pool` : 'Cible ajoutée',
                      detail: 'En attente de deux health checks consécutifs réussis.',
                      appel: appelPool(pool),
                      effet: () =>
                        cible
                          ? lbs.modifier(lb.id, (l) => ({
                              pool: [
                                ...l.pool,
                                {
                                  targetId: cible.id,
                                  targetLabel: cible.nom,
                                  poids: Number(v.poids),
                                  sante: 'drain' as const,
                                },
                              ],
                            }))
                          : undefined,
                      job: {
                        type: 'lb.pool.add',
                        label: `Ajout au pool · ${lb.nom}`,
                        etapes: ['Déclarer la cible', 'Attendre deux health checks réussis'],
                        dureeEtapeMs: 1100,
                      },
                      effetFinal: () => {
                        if (!estActif() && cible)
                          lbs.modifier(lb.id, (l) => ({
                            pool: l.pool.map((p) =>
                              p.targetId === cible.id ? { ...p, sante: 'ok' as const } : p,
                            ),
                          }))
                        lbs.recharger()
                      },
                    }
                  }}
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Cible', 'Poids', 'Santé', 'Requêtes/s estimées', 'Mode drain', ''].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lb.pool.map((p) => {
                    const enDrain = p.sante === 'drain'
                    const poidsTotal = lb.pool.reduce((a, x) => a + x.poids, 0) || 1
                    return (
                      <tr
                        key={p.targetId}
                        className={cn(
                          'border-b border-g-100 last:border-0',
                          enDrain && 'bg-info-bg/50',
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <span className="block font-mono text-[12.5px] font-medium text-ink">
                            {p.targetLabel}
                          </span>
                          <span className="block text-[11px] text-g-500">{p.targetId}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Input
                            type="number"
                            value={p.poids}
                            className="w-20"
                            aria-label="Poids"
                            onChange={(e) =>
                              publierPool(
                                lb.pool.map((x) =>
                                  x.targetId === p.targetId
                                    ? { ...x, poids: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            tone={
                              enDrain ? 'info' : p.sante === 'ok' ? 'ok' : p.sante === 'ko' ? 'err' : 'info'
                            }
                            dot
                            size="sm"
                          >
                            {enDrain ? 'En drain' : p.sante === 'ok' ? 'Sain' : 'Défaillant'}
                          </Badge>
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                          {enDrain || p.sante !== 'ok'
                            ? '0'
                            : num(Math.round((lb.metriques.rps * p.poids) / poidsTotal))}
                        </td>
                        <td className="px-3 py-2.5">
                          <Switch
                            checked={enDrain}
                            label={`Mode drain de ${p.targetLabel}`}
                            onChange={(v) =>
                              executer({
                                action: 'lb.create',
                                ton: 'info',
                                titre: v
                                  ? `${p.targetLabel} passe en drain`
                                  : `${p.targetLabel} réintégré au pool`,
                                detail: v
                                  ? 'Aucune nouvelle requête ne lui est envoyée ; les connexions en cours se terminent normalement.'
                                  : 'Réintégration après validation du health check.',
                                appel: appelPool(
                                  lb.pool.map((x) =>
                                    x.targetId === p.targetId
                                      ? { ...x, sante: v ? ('drain' as const) : ('ok' as const) }
                                      : x,
                                  ),
                                ),
                                effet: () =>
                                  lbs.modifier(lb.id, (l) => ({
                                    pool: l.pool.map((x) =>
                                      x.targetId === p.targetId
                                        ? { ...x, sante: v ? ('drain' as const) : ('ok' as const) }
                                        : x,
                                    ),
                                  })),
                                effetFinal: () => lbs.recharger(),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <IconButton
                            label="Retirer la cible du pool"
                            size="sm"
                            onClick={() =>
                              executer({
                                action: 'lb.create',
                                ton: 'warn',
                                titre: `${p.targetLabel} retirée du pool`,
                                detail:
                                  'Les connexions en cours sont coupées. Le mode drain évite cela.',
                                appel: appelPool(
                                  lb.pool.filter((x) => x.targetId !== p.targetId),
                                ),
                                effet: () =>
                                  lbs.modifier(lb.id, (l) => ({
                                    pool: l.pool.filter((x) => x.targetId !== p.targetId),
                                  })),
                                effetFinal: () => lbs.recharger(),
                              })
                            }
                          >
                            <Trash2 size={13} className="text-err" />
                          </IconButton>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Callout ton="violet" titre="À quoi sert exactement le mode drain">
            Retirer une cible du pool coupe brutalement les connexions en cours — l’utilisateur voit
            une erreur. Le mode drain arrête l’envoi de nouvelles requêtes tout en laissant se
            terminer celles déjà engagées. C’est la manœuvre à faire avant toute maintenance sur une
            machine : passez-la en drain, attendez que son compteur de requêtes tombe à zéro, puis
            intervenez.
          </Callout>

          <Card>
            <CardHeader titre="Health check" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Protocole">
                <Select defaultValue={lb.healthCheck.protocole}>
                  <option value={lb.healthCheck.protocole}>{lb.healthCheck.protocole}</option>
                </Select>
              </Field>
              {lb.healthCheck.chemin && (
                <Field label="Chemin">
                  <Input defaultValue={lb.healthCheck.chemin} className="font-mono" />
                </Field>
              )}
              {lb.healthCheck.codeAttendu && (
                <Field label="Code attendu">
                  <Input type="number" defaultValue={lb.healthCheck.codeAttendu} />
                </Field>
              )}
              <Field label="Intervalle">
                <Input type="number" defaultValue={lb.healthCheck.intervalleS} suffix="s" />
              </Field>
              <Field label="Seuil de bascule">
                <Input type="number" defaultValue={lb.healthCheck.seuilKo} />
              </Field>
              <Field label="Seuil de rétablissement">
                <Input type="number" defaultValue={lb.healthCheck.seuilOk} />
              </Field>
            </div>
            <p className="mt-3 text-[11.5px] text-g-500">
              Une cible défaillante est retirée du pool en{' '}
              {lb.healthCheck.intervalleS * lb.healthCheck.seuilKo} secondes au pire.
            </p>
          </Card>
        </div>
      )}

      {/* Écouteurs & TLS */}
      {onglet === 'tls' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Écouteurs"
              actions={
                <BoutonFormulaire
                  libelle="Ajouter un écouteur"
                  variant="primary"
                  icone={<Plus size={13} />}
                  action="lb.create"
                  titre="Ajouter un écouteur"
                  champs={[
                    {
                      id: 'protocole',
                      label: 'Protocole',
                      type: 'select',
                      demi: true,
                      options: [
                        { value: 'HTTPS', label: 'HTTPS' },
                        { value: 'HTTP', label: 'HTTP' },
                        { value: 'TCP', label: 'TCP' },
                        { value: 'UDP', label: 'UDP' },
                      ],
                    },
                    { id: 'port', label: 'Port', type: 'nombre', demi: true, min: 1, max: 65535 },
                    {
                      id: 'tls',
                      label: 'TLS minimum',
                      type: 'select',
                      options: [
                        { value: 'TLS 1.2', label: 'TLS 1.2' },
                        { value: 'TLS 1.3', label: 'TLS 1.3' },
                      ],
                    },
                  ]}
                  valeursDepart={{ protocole: 'HTTPS', port: 443, tls: 'TLS 1.2' }}
                  libelleValider="Ajouter"
                  operation={(v) => ({
                    titre: `Écouteur ${v.protocole}:${v.port} ajouté`,
                    appel: () =>
                      requete(`/load-balancers/${encodeURIComponent(lb.id)}`, {
                        methode: 'PATCH',
                        corps: {
                          espaceId: lb.espaceId,
                          nom: lb.nom,
                          layer: lb.layer,
                          exposure: lb.exposure,
                          listeners: [
                            ...lb.listeners.map((x) => ({
                              protocole: x.protocole,
                              port: x.port,
                              ...(x.certId ? { certId: x.certId } : {}),
                              ...(x.tlsMin ? { tlsMin: x.tlsMin } : {}),
                            })),
                            {
                              protocole: String(v.protocole),
                              port: Number(v.port),
                              ...(String(v.protocole) === 'HTTPS'
                                ? {
                                    certId:
                                      lb.listeners.find((x) => x.certId)?.certId ?? 'cert-auto',
                                    tlsMin: String(v.tls),
                                  }
                                : {}),
                            },
                          ],
                        },
                      }),
                    effet: () =>
                      lbs.modifier(lb.id, (l) => ({
                        listeners: [
                          ...l.listeners,
                          {
                            protocole: String(v.protocole),
                            port: Number(v.port),
                            certId:
                              String(v.protocole) === 'HTTPS'
                                ? (l.listeners.find((x) => x.certId)?.certId ?? 'cert-auto')
                                : undefined,
                            tlsMin: String(v.protocole) === 'HTTPS' ? String(v.tls) : undefined,
                          },
                        ],
                      })),
                    effetFinal: () => lbs.recharger(),
                  })}
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Protocole', 'Port', 'Certificat', 'TLS minimum', 'État'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lb.listeners.map((l) => (
                    <tr key={`${l.protocole}-${l.port}`} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{l.protocole}</td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-ink">{l.port}</td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">
                        {l.certId ?? <span className="text-g-500">aucun</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[12.5px] text-g-700">{l.tlsMin ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone="ok" dot size="sm">
                          Actif
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {lb.listeners.some((l) => l.certId) && (
            <Card>
              <CardHeader titre="Certificat TLS" />
              <KeyValueList
                colonnes={2}
                items={[
                  { cle: 'Identifiant', valeur: <span className="font-mono">{lb.listeners[0].certId}</span> },
                  { cle: 'Autorité', valeur: 'Let’s Encrypt (ACME HTTP-01)' },
                  { cle: 'Renouvellement', valeur: 'Automatique, 30 jours avant expiration' },
                  { cle: 'Expiration', valeur: dateCourte('2026-11-14') },
                  { cle: 'Algorithme', valeur: 'ECDSA P-256' },
                  { cle: 'Version TLS minimale', valeur: lb.listeners[0].tlsMin ?? 'TLS 1.2' },
                ]}
              />
              <div className="mt-3.5 flex flex-wrap gap-2 border-t border-g-100 pt-3.5">
                <BoutonAction
                  libelle="Renouveler maintenant"
                  operation={{
                    action: 'lb.create',
                    ton: 'info',
                    titre: 'Renouvellement ACME lancé',
                    sansApi:
                      'Indisponible : le renouvellement du certificat TLS d’un load balancer n’est pas encore exposé par l’API.',
                    job: {
                      type: 'lb.tls.renew',
                      label: `Renouvellement TLS · ${lb.nom}`,
                      etapes: [
                        'Demander un ordre ACME',
                        'Répondre au challenge HTTP-01',
                        'Installer le certificat sur les écouteurs',
                      ],
                      dureeEtapeMs: 1100,
                    },
                  }}
                />
                <BoutonFormulaire
                  libelle="Téléverser mon certificat"
                  variant="ghost"
                  action="lb.create"
                  titre="Téléverser un certificat"
                  description="Le portail conserve la clé privée dans le coffre et ne l’affiche jamais. Le renouvellement automatique est désactivé pour un certificat fourni."
                  taille="lg"
                  champs={[
                    { id: 'nom', label: 'Nom du certificat', placeholder: 'wildcard-dba-2026', obligatoire: true },
                    { id: 'chaine', label: 'Chaîne de certification (PEM)', type: 'mono', placeholder: '-----BEGIN CERTIFICATE-----' },
                    { id: 'cle', label: 'Clé privée (PEM)', type: 'mono', placeholder: '-----BEGIN PRIVATE KEY-----' },
                  ]}
                  libelleValider="Téléverser"
                  operation={(v) => ({
                    titre: `Certificat ${v.nom} installé`,
                    detail: 'Renouvellement automatique désactivé sur les écouteurs concernés.',
                    effet: () =>
                      lbs.modifier(lb.id, (l) => ({
                        listeners: l.listeners.map((x) =>
                          x.certId ? { ...x, certId: String(v.nom) } : x,
                        ),
                      })),
                  })}
                />
              </div>
              <Callout ton="warn" className="mt-3.5" titre="Exception ACME requise">
                Le renouvellement automatique exige que le chemin{' '}
                <span className="font-mono text-[12px]">/.well-known/acme-challenge</span> reste
                joignable. Une règle L7 qui renvoie 403 sur ce chemin fait échouer le renouvellement
                silencieusement — c’est la cause de l’incident TCK-4471 du 19 août. Une exception est
                maintenue par défaut sur ce load balancer.
              </Callout>
            </Card>
          )}
        </div>
      )}

      {/* Règles L7 */}
      {onglet === 'regles' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Règles de routage"
              sousTitre="Évaluées de haut en bas, la première correspondance gagne."
              actions={
                <BoutonFormulaire
                  libelle="Ajouter une règle"
                  variant="primary"
                  icone={<Plus size={13} />}
                  action="lb.create"
                  titre="Ajouter une règle de routage"
                  description="Les règles sont évaluées de haut en bas : la première correspondance gagne."
                  champs={[
                    { id: 'hote', label: 'Hôte', placeholder: 'api.dba.africa', demi: true },
                    { id: 'chemin', label: 'Chemin', placeholder: '/v1/*', demi: true },
                    { id: 'entete', label: 'En-tête', placeholder: 'X-Canary: true' },
                    { id: 'cible', label: 'Destination', placeholder: 'pool-api ou refus-403', obligatoire: true },
                  ]}
                  libelleValider="Ajouter la règle"
                  operation={(v) => ({
                    titre: 'Règle de routage ajoutée',
                    detail: `${v.hote || '*'}${v.chemin || '/*'} → ${v.cible}`,
                    appel: () =>
                      requete(`/load-balancers/${encodeURIComponent(lb.id)}/regles-l7`, {
                        methode: 'PUT',
                        corps: {
                          regles: [
                            ...(lb.reglesL7 ?? []).map((x) => ({
                              ...(x.hote ? { hote: x.hote } : {}),
                              ...(x.chemin ? { chemin: x.chemin } : {}),
                              ...(x.entete ? { entete: x.entete } : {}),
                              cible: x.cible,
                            })),
                            {
                              ...(String(v.hote) ? { hote: String(v.hote) } : {}),
                              ...(String(v.chemin) ? { chemin: String(v.chemin) } : {}),
                              ...(String(v.entete) ? { entete: String(v.entete) } : {}),
                              cible: String(v.cible),
                            },
                          ],
                        },
                      }),
                    effet: () =>
                      lbs.modifier(lb.id, (l) => ({
                        reglesL7: [
                          ...(l.reglesL7 ?? []),
                          {
                            hote: String(v.hote) || undefined,
                            chemin: String(v.chemin) || undefined,
                            entete: String(v.entete) || undefined,
                            cible: String(v.cible),
                          },
                        ],
                      })),
                    effetFinal: () => lbs.recharger(),
                  })}
                />
              }
            />
            {(lb.reglesL7 ?? []).length === 0 ? (
              <p className="py-6 text-center text-[13px] text-g-500">
                Aucune règle spécifique. Tout le trafic est réparti sur le pool par défaut.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Ordre', 'Hôte', 'Chemin', 'En-tête', 'Destination', ''].map((h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(lb.reglesL7 ?? []).map((r, i) => (
                      <tr key={i} className="border-b border-g-100 last:border-0">
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-500">{i + 1}</td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-ink">
                          {r.hote ?? '*'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-ink">
                          {r.chemin ?? '/*'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">
                          {r.entete ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            tone={r.cible.startsWith('refus') ? 'err' : 'violet'}
                            size="sm"
                          >
                            {r.cible}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <IconButton
                            label="Supprimer la règle"
                            size="sm"
                            onClick={() =>
                              executer({
                                action: 'lb.create',
                                ton: 'warn',
                                titre: 'Règle de routage supprimée',
                                detail: `${r.hote ?? '*'}${r.chemin ?? '/*'} → ${r.cible}`,
                                appel: () =>
                                  requete(
                                    `/load-balancers/${encodeURIComponent(lb.id)}/regles-l7`,
                                    {
                                      methode: 'PUT',
                                      corps: {
                                        regles: (lb.reglesL7 ?? [])
                                          .filter((_, j) => j !== i)
                                          .map((x) => ({
                                            ...(x.hote ? { hote: x.hote } : {}),
                                            ...(x.chemin ? { chemin: x.chemin } : {}),
                                            ...(x.entete ? { entete: x.entete } : {}),
                                            cible: x.cible,
                                          })),
                                      },
                                    },
                                  ),
                                effet: () =>
                                  lbs.modifier(lb.id, (l) => ({
                                    reglesL7: (l.reglesL7 ?? []).filter((_, j) => j !== i),
                                  })),
                                effetFinal: () => lbs.recharger(),
                              })
                            }
                          >
                            <Trash2 size={13} className="text-err" />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader titre="Réécriture d’URL" />
              <div className="space-y-3">
                <Field label="Expression source">
                  <Input defaultValue="^/api/v1/(.*)$" className="font-mono" />
                </Field>
                <Field label="Expression de remplacement">
                  <Input defaultValue="/v1/$1" className="font-mono" />
                </Field>
              </div>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-g-500">
                La réécriture s’applique après le routage : la règle de destination est choisie sur
                l’URL d’origine, puis l’URL est réécrite avant transmission au backend.
              </p>
            </Card>
            <Card>
              <CardHeader titre="Pages d’erreur personnalisées" />
              <div className="space-y-2.5">
                {[
                  ['502 Bad Gateway', 'Aucun backend sain disponible'],
                  ['503 Service Unavailable', 'Tous les backends en drain ou en maintenance'],
                  ['429 Too Many Requests', 'Limitation de débit atteinte'],
                ].map(([code, quand]) => (
                  <div
                    key={code}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] font-semibold text-ink">
                        {code}
                      </span>
                      <span className="block text-[11px] text-g-500">{quand}</span>
                    </span>
                    <Badge tone="ok" size="sm">
                      Page personnalisée
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-g-500">
                Sans page personnalisée, le load balancer sert une page neutre aux couleurs Synelia
                plutôt qu’une réponse vide — ce qui reste préférable à un écran blanc pour vos
                utilisateurs.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* WAF */}
      {onglet === 'waf' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Pare-feu applicatif"
              actions={
                <Badge tone={lb.waf?.actif ? 'ok' : 'neutral'} dot>
                  {lb.waf?.actif ? `Actif · ${lb.waf.ruleset}` : 'Inactif'}
                </Badge>
              }
            />
            <div className="space-y-3.5">
              <Switch
                checked={lb.waf?.actif ?? false}
                // `PATCH /load-balancers/{id}` refuse `waf` et `rateLimit`
                // (`422 non_porte`) : le pare-feu reste un réglage d’écran.
                onChange={(v) =>
                  executer({
                    action: 'lb.create',
                    ton: v ? 'ok' : 'warn',
                    titre: v ? 'Pare-feu applicatif activé' : 'Pare-feu applicatif désactivé',
                    detail: v
                      ? 'Les règles OWASP s’appliquent dès la prochaine requête.'
                      : 'Les injections et le cross-site scripting ne sont plus filtrés.',
                    sansApi:
                      'Indisponible : l’API refuse encore `waf` sur un load balancer (422 non_porte).',
                    effet: () =>
                      lbs.modifier(lb.id, { waf: { actif: v, ruleset: 'OWASP CRS 4.3' } }),
                  })
                }
                label="Jeu de règles OWASP Core Rule Set"
                description="Détection des injections SQL, du cross-site scripting, des inclusions de fichiers, des scanners automatisés et des anomalies de protocole."
              />
              <Field label="Mode d’application">
                <Select defaultValue="blocage">
                  <option value="detection">
                    Détection seule — journalise sans bloquer (à utiliser pour le réglage initial)
                  </option>
                  <option value="blocage">Blocage — rejette les requêtes correspondantes</option>
                </Select>
              </Field>
              <Field label="Niveau de paranoïa" hint="plus élevé = plus de faux positifs">
                <Select defaultValue="1">
                  <option value="1">Niveau 1 — recommandé en production</option>
                  <option value="2">Niveau 2 — applications sensibles</option>
                  <option value="3">Niveau 3 — très strict, réglage requis</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              titre="Exceptions"
              sousTitre="Chemins ou règles exclus du contrôle. À documenter, chaque exception réduit la couverture."
              actions={
                <BoutonFormulaire
                  libelle="Ajouter une exception"
                  icone={<Plus size={13} />}
                  action="lb.create"
                  titre="Ajouter une exception WAF"
                  description="Chaque exception réduit la couverture : le motif est obligatoire pour qu’un audit puisse la relire."
                  champs={[
                    { id: 'chemin', label: 'Chemin', placeholder: '/v1/documents/upload', obligatoire: true },
                    { id: 'regle', label: 'Règle exclue', placeholder: 'REQUEST-941 (XSS) ou Toutes les règles', obligatoire: true },
                    { id: 'motif', label: 'Motif', placeholder: 'Faux positif sur les documents contenant du HTML', obligatoire: true },
                  ]}
                  libelleValider="Ajouter l’exception"
                  operation={(v) => ({
                    ton: 'warn',
                    titre: 'Exception WAF ajoutée',
                    detail: `${v.chemin} · ${v.regle}`,
                    effet: () =>
                      exceptions.creer({
                        id: exceptions.identifiant('exc'),
                        chemin: String(v.chemin),
                        regle: String(v.regle),
                        motif: String(v.motif),
                      }),
                  })}
                />
              }
            />
            <div className="space-y-2">
              {exceptions.items.map(({ id: excId, chemin, regle, motif }) => (
                <div
                  key={excId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[12px] font-semibold text-ink">
                      {chemin}
                    </span>
                    <span className="block text-[11px] text-g-500">
                      Règle exclue : {regle} · {motif}
                    </span>
                  </span>
                  <IconButton
                    label="Retirer l’exception"
                    size="sm"
                    onClick={() =>
                      executer({
                        action: 'lb.create',
                        titre: 'Exception WAF retirée',
                        detail: `${chemin} · la règle ${regle} s’applique de nouveau`,
                        sansApi:
                          'Indisponible : le pare-feu applicatif n’est pas encore piloté par l’API (422 non_porte sur `waf`).',
                        effet: () => exceptions.supprimer(excId),
                      })
                    }
                  >
                    <Trash2 size={13} className="text-err" />
                  </IconButton>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader titre="Limitation de débit" />
            <Slider
              label="Requêtes par minute et par adresse IP"
              value={lb.rateLimit?.requetesParMin ?? 1200}
              onChange={() => {}}
              min={60}
              max={6000}
              step={60}
              unite="req/min"
            />
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-g-500">
              Au-delà du seuil, le load balancer répond 429 sans solliciter les backends. Attention
              derrière un NAT d’entreprise : plusieurs centaines d’utilisateurs peuvent partager une
              même adresse source. Prévoyez une liste d’adresses exemptées pour vos sites clients
              connus.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile
                libelle="Requêtes bloquées 24 h"
                valeur={num(1842)}
                ton="warn"
                serie={seededSeries(`${id}-waf`, 24, 20, 180)}
              />
              <StatTile libelle="429 émis 24 h" valeur={num(96)} />
              <StatTile libelle="IP en limitation" valeur={4} detail="Scanners automatisés" />
            </div>
          </Card>

          <Callout ton="warn" titre="Un WAF mal réglé casse la production">
            Démarrez toujours en mode détection : les requêtes suspectes sont journalisées sans être
            bloquées. Examinez les correspondances pendant une à deux semaines, posez vos exceptions,
            puis passez en blocage. Nos équipes accompagnent ce réglage — c’est inclus dans
            l’accompagnement de mise en production.
          </Callout>
        </div>
      )}

      {/* Journaux */}
      {onglet === 'journaux' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Journaux d’accès"
              sousTitre="Aperçu limité à vingt lignes. Le portail n’embarque pas de constructeur de requêtes."
              actions={
                <BoutonAction
                  libelle="Exporter"
                  icone={<Download size={13} />}
                  operation={{
                    ton: 'info',
                    titre: 'Export des journaux préparé',
                    detail: 'Les 20 dernières lignes ne sont qu’un aperçu : l’export complet part vers VictoriaLogs.',
                  }}
                />
              }
            />
            <LogPeek lignes={LOGS_EXECUTION} max={20} titre="Requêtes récentes" />
          </Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              libelle="Rétention des journaux"
              valeur="30 j"
              detail="Selon le palier de l’offre"
            />
            <StatTile libelle="Volume journalier" valeur="1,8 Go" detail="Compressé" />
            <StatTile
              libelle="Destination"
              valeur="VictoriaLogs"
              detail="Interrogeable avec LogsQL"
            />
          </div>
        </div>
      )}
    </div>
  )
}
