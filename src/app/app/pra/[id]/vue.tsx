'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  FileDown,
  FlaskConical,
  GripVertical,
  RotateCcw,
  Zap,
} from 'lucide-react'
import { cn, seededSeries } from '@/lib/utils'
import { dateCourte, dureeMin, pct } from '@/lib/format'
import { SITE_LABEL } from '@/lib/types'
import { DR_PLANS } from '@/lib/mock'
import type { DRPlan } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { ConfirmDialog } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { StatTile } from '@/components/composition/metrics'
import { RpoRtoGauge } from '@/components/business/infra'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { requete } from '@/lib/api/client'

const ONGLETS = [
  { id: 'composition', label: 'Composition' },
  { id: 'replication', label: 'Réplication' },
  { id: 'bascule', label: 'Bascule' },
  { id: 'exercices', label: 'Exercices' },
]

export function VuePra({ id }: { id: string }) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const plans = useCollection<DRPlan>('plans-pra', DR_PLANS)
  const [onglet, setOnglet] = useState('composition')
  const [bascule, setBascule] = useState(false)

  const plan = plans.items.find((p) => p.id === id)
  // L’ordre initial vient du plan quand il est déjà là ; sinon la liste vide,
  // complétée à l’arrivée de la collection (garde ci-dessous).
  const [ordre, setOrdre] = useState(plan?.groupes ?? [])

  if (!plan) {
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Plan de reprise', href: '/app/pra' },
            { label: 'Introuvable' },
          ]}
          titre="Plan introuvable"
        />
        <EmptyState
          titre="Ce plan de reprise n’existe pas ou plus"
          phrase="Il a peut-être été supprimé, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: 'Retour aux plans', href: '/app/pra' }}
        />
      </div>
    )
  }

  const basculeDeTest = () =>
    executer({
      action: 'dr.failover.test',
      ton: 'info',
      titre: 'Bascule de test lancée en réseau isolé',
      detail: `Durée estimée ${dureeMin(plan.rtoCibleMin)}. Aucun impact sur la production.`,
      appel: () =>
        requete(`/pra/${encodeURIComponent(plan.id)}/bascule`, {
          methode: 'POST',
          corps: { type: 'test' },
        }),
      job: { workflow: 'dr.failover.test', cible: plan.nom },
      effetFinal: () => {
        plans.modifier(plan.id, (p) => ({
          statut: 'operationnel',
          rtoConstateMin: p.rtoConstateMin || p.rtoCibleMin,
          exercices: [
            {
              date: '2026-08-19',
              type: 'test' as const,
              dureeMin: p.rtoCibleMin,
              rtoConstateMin: p.rtoConstateMin || p.rtoCibleMin,
              succes: true,
              rapportUrl: '#rapport-exercice',
            },
            ...p.exercices,
          ],
        }))
        plans.recharger()
      },
    })

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Plan de reprise', href: '/app/pra' },
          { label: plan.nom },
        ]}
        titre={<span className="font-mono">{plan.nom}</span>}
        sousTitre={`${SITE_LABEL[plan.siteSource]} → ${SITE_LABEL[plan.siteRepli]} · réplication ${plan.replication.mode === 'continu' ? 'continue' : 'planifiée'} · retard actuel ${plan.replication.retardS} s`}
        meta={
          <>
            <Badge
              tone={
                plan.statut === 'operationnel'
                  ? 'ok'
                  : plan.statut === 'jamais_teste'
                    ? 'warn'
                    : 'err'
              }
              dot
            >
              {plan.statut === 'operationnel'
                ? 'Opérationnel'
                : plan.statut === 'jamais_teste'
                  ? 'Jamais testé'
                  : 'Dégradé'}
            </Badge>
            <Badge tone="neutral">{plan.groupes.length} groupes de démarrage</Badge>
            <Badge tone="neutral">
              {plan.groupes.reduce((a, g) => a + g.ressources.length, 0)} ressources
            </Badge>
          </>
        }
        actions={
          <>
            <GatedAction
              autorise={autorise('dr.failover.test')}
              message={refus('dr.failover.test')}
            >
              <Button
                variant="secondary"
                iconBefore={<FlaskConical size={14} />}
                onClick={basculeDeTest}
              >
                Bascule de test
              </Button>
            </GatedAction>
            <GatedAction
              autorise={autorise('dr.failover.real')}
              message={refus('dr.failover.real')}
            >
              <Button variant="danger" iconBefore={<Zap size={14} />} onClick={() => setBascule(true)}>
                Bascule réelle
              </Button>
            </GatedAction>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <RpoRtoGauge libelle="RPO" cibleMin={plan.rpoCibleMin} constateMin={plan.rpoConstateMin} />
        <RpoRtoGauge libelle="RTO" cibleMin={plan.rtoCibleMin} constateMin={plan.rtoConstateMin} />
        <StatTile
          libelle="Retard de réplication"
          valeur={plan.replication.retardS < 120 ? plan.replication.retardS : Math.round(plan.replication.retardS / 60)}
          unite={plan.replication.retardS < 120 ? 's' : 'min'}
          ton={plan.replication.retardS < 120 ? 'ok' : 'warn'}
          serie={seededSeries(`${id}-lag`, 24, plan.replication.retardS * 0.6, plan.replication.retardS * 1.4)}
        />
        <StatTile
          libelle="Exercices menés"
          valeur={plan.exercices.length}
          ton={plan.exercices.length === 0 ? 'warn' : 'ok'}
          detail={
            plan.exercices[0]
              ? `Dernier le ${dateCourte(plan.exercices[0].date)}`
              : 'Aucun exercice à ce jour'
          }
        />
      </div>

      {plan.statut === 'jamais_teste' && (
        <Callout ton="warn" titre="Ce plan n’a jamais été exercé">
          Le RTO de {dureeMin(plan.rtoCibleMin)} affiché est une cible théorique, pas une mesure. Une
          bascule de test démarre les ressources répliquées dans un réseau isolé, sans conflit
          d’adressage et sans toucher au DNS public : elle n’a aucun impact sur votre production.
        </Callout>
      )}

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {/* ─── Composition ─────────────────────────────────────────────── */}
      {onglet === 'composition' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Ordre de démarrage"
              sousTitre="Réordonnable par glisser-déposer. Les dépendances déterminent quels groupes doivent être en ligne avant de démarrer le suivant."
            />
            <div className="mx-auto max-w-2xl">
              {ordre.map((g, i) => (
                <div key={g.nom}>
                  <div
                    className={cn(
                      'rounded-[10px] border-2 bg-white px-4 py-3.5',
                      i === 0
                        ? 'border-p-700'
                        : i === ordre.length - 1
                          ? 'border-ok'
                          : 'border-g-300',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="flex min-w-0 items-start gap-3">
                        <button
                          type="button"
                          aria-label="Réordonner ce groupe"
                          onClick={() => {
                            if (i === 0) return
                            setOrdre((p) => {
                              const c = [...p]
                              ;[c[i - 1], c[i]] = [c[i], c[i - 1]]
                              return c.map((x, k) => ({ ...x, ordre: k + 1 }))
                            })
                          }}
                          className="mt-0.5 cursor-grab text-g-300 transition-colors hover:text-p-700"
                        >
                          <GripVertical size={16} />
                        </button>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="tnum flex h-5 w-5 items-center justify-center rounded-full bg-p-700 text-[10.5px] font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="text-[13.5px] font-bold text-ink">{g.nom}</span>
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {g.ressources.map((r) => (
                              <Badge key={r} tone="neutral" size="sm">
                                {r}
                              </Badge>
                            ))}
                          </span>
                          {g.dependances.length > 0 && (
                            <span className="mt-1.5 block text-[11.5px] text-g-500">
                              Dépend de : {g.dependances.join(', ')}
                            </span>
                          )}
                        </span>
                      </span>
                      {g.ipRepli && (
                        <span className="shrink-0 rounded-[6px] bg-g-050 px-2.5 py-1.5">
                          <MicroLabel className="mb-1">Adressage de repli</MicroLabel>
                          {Object.entries(g.ipRepli).map(([r, ip]) => (
                            <span key={r} className="block font-mono text-[11px] text-g-700">
                              {r} → {ip}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  {i < ordre.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown size={15} className="text-g-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-g-100 pt-3 text-[11.5px] leading-relaxed text-g-500">
              L’exercice de janvier 2026 avait échoué précisément sur cet ordre : sessions-redis
              démarrait avant la base, ce qui provoquait une avalanche d’erreurs de connexion. La
              correction est vérifiée depuis avril.
            </p>
          </Card>

          <Card>
            <CardHeader titre="Périmètre et paramètres" />
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Site source', valeur: SITE_LABEL[plan.siteSource] },
                { cle: 'Site de repli', valeur: SITE_LABEL[plan.siteRepli] },
                { cle: 'RPO cible', valeur: dureeMin(plan.rpoCibleMin) },
                {
                  cle: 'RPO constaté',
                  valeur: plan.rpoConstateMin > 0 ? dureeMin(plan.rpoConstateMin) : 'non mesuré',
                },
                { cle: 'RTO cible', valeur: dureeMin(plan.rtoCibleMin) },
                {
                  cle: 'RTO constaté',
                  valeur: plan.rtoConstateMin > 0 ? dureeMin(plan.rtoConstateMin) : 'non mesuré',
                },
                {
                  cle: 'Mode de réplication',
                  valeur: plan.replication.mode === 'continu' ? 'Continue (journalisation)' : 'Planifiée (snapshots)',
                },
                { cle: 'Bascule DNS', valeur: 'Automatisée sur les zones hébergées chez Synelia' },
              ]}
            />
          </Card>
        </div>
      )}

      {/* ─── Réplication ─────────────────────────────────────────────── */}
      {onglet === 'replication' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="État de la réplication par ressource"
              sousTitre={`Mode ${plan.replication.mode === 'continu' ? 'continu' : 'planifié'} · retard global ${plan.replication.retardS} s`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Ressource', 'Groupe', 'Mode', 'Retard', 'Dernier point', 'État'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.groupes.flatMap((g) =>
                    g.ressources.map((r, i) => {
                      const retard = Math.round(
                        plan.replication.retardS * (0.6 + ((i + g.ordre) % 5) * 0.18),
                      )
                      const critique = retard > plan.rpoCibleMin * 60
                      return (
                        <tr key={`${g.nom}-${r}`} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{r}</td>
                          <td className="px-3 py-2.5 text-[12.5px] text-g-700">{g.nom}</td>
                          <td className="px-3 py-2.5">
                            <Badge tone="neutral" size="sm">
                              {plan.replication.mode === 'continu' ? 'Continu' : 'Planifié'}
                            </Badge>
                          </td>
                          <td className="tnum px-3 py-2.5 text-[12.5px]">
                            <span className={critique ? 'font-semibold text-err' : 'text-g-700'}>
                              {retard < 120 ? `${retard} s` : `${Math.round(retard / 60)} min`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-g-700">
                            il y a {retard < 120 ? `${retard} s` : `${Math.round(retard / 60)} min`}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge tone={critique ? 'warn' : 'ok'} dot size="sm">
                              {critique ? 'Retard supérieur au RPO' : 'Synchronisé'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <Callout ton="info" titre="Ce que le retard de réplication signifie">
            Le retard détermine votre RPO réel : c’est la quantité de données que vous perdriez si le
            sinistre survenait maintenant. Un retard de {plan.replication.retardS} secondes signifie
            qu’au pire, moins d’une minute d’écritures serait perdue. Nous alertons dès qu’une
            ressource dépasse durablement le RPO cible du plan.
          </Callout>
        </div>
      )}

      {/* ─── Bascule ─────────────────────────────────────────────────── */}
      {onglet === 'bascule' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-2 border-[#BFD6EE]">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-info-bg text-info">
                  <FlaskConical size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="type-h3">Bascule de test</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-700">
                    Démarre les ressources répliquées dans un <strong>réseau isolé</strong>, sans
                    conflit d’adressage et sans toucher au DNS public. Votre production continue de
                    tourner normalement pendant tout l’exercice. C’est précisément cette isolation
                    qui permet de l’exercer souvent, sans négociation de fenêtre.
                  </p>
                  <ul className="mt-3 space-y-1">
                    {[
                      'Aucun impact sur la production',
                      'Aucune coupure de service',
                      'Produit un rapport avec le RTO réellement constaté',
                      'Exerçable à volonté, y compris en heures ouvrées',
                    ].map((x) => (
                      <li key={x} className="text-[12px] text-g-700">
                        · {x}
                      </li>
                    ))}
                  </ul>
                  <GatedAction
                    autorise={autorise('dr.failover.test')}
                    message={refus('dr.failover.test')}
                  >
                    <Button
                      className="mt-4"
                      iconBefore={<FlaskConical size={14} />}
                      onClick={basculeDeTest}
                    >
                      Lancer une bascule de test
                    </Button>
                  </GatedAction>
                </div>
              </div>
            </Card>

            <Card className="border-2 border-[#EFC3BD]">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-err-bg text-err">
                  <Zap size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="type-h3">Bascule réelle</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-700">
                    Arrête la production sur {SITE_LABEL[plan.siteSource]}, démarre les ressources sur{' '}
                    {SITE_LABEL[plan.siteRepli]}, et bascule le DNS public. C’est l’opération de
                    sinistre. Elle exige une <strong>double confirmation</strong> et n’est accessible
                    qu’aux rôles Provider Admin et Org Admin.
                  </p>
                  <ul className="mt-3 space-y-1">
                    {[
                      'Interruption de service pendant la bascule',
                      `Perte de données limitée au RPO constaté (${dureeMin(plan.rpoConstateMin || plan.rpoCibleMin)})`,
                      'Bascule DNS publique effective en quelques minutes',
                      'Retour arrière possible après resynchronisation',
                    ].map((x) => (
                      <li key={x} className="text-[12px] text-g-700">
                        · {x}
                      </li>
                    ))}
                  </ul>
                  <GatedAction
                    autorise={autorise('dr.failover.real')}
                    message={refus('dr.failover.real')}
                  >
                    <Button
                      variant="danger"
                      className="mt-4"
                      iconBefore={<AlertTriangle size={14} />}
                      onClick={() => setBascule(true)}
                    >
                      Déclencher une bascule réelle
                    </Button>
                  </GatedAction>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Retour arrière"
              sousTitre="Après une bascule réelle, le retour vers le site d’origine se fait en deux temps."
            />
            <ol className="space-y-2.5">
              {[
                ['Resynchronisation inverse', `Les écritures effectuées sur ${SITE_LABEL[plan.siteRepli]} pendant la bascule sont répliquées vers ${SITE_LABEL[plan.siteSource]}. La durée dépend du volume produit.`],
                ['Bascule de retour', 'Même séquence que la bascule initiale, dans l’autre sens, avec une fenêtre de coupure courte car les données sont déjà synchronisées.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-p-100 text-[11px] font-bold text-p-700">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-ink">{t}</span>
                    <span className="block text-[12.5px] leading-relaxed text-g-700">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <BoutonAction
              libelle={
                plan.exercices.some((e) => e.type === 'reel')
                  ? 'Lancer le retour arrière'
                  : 'Retour arrière — disponible après une bascule'
              }
              size="md"
              className="mt-4"
              icone={<RotateCcw size={13} />}
              desactive={!plan.exercices.some((e) => e.type === 'reel')}
              operation={{
                action: 'dr.failover.real',
                ton: 'warn',
                titre: 'Retour arrière engagé',
                detail: `La resynchronisation inverse doit se terminer avant la bascule DNS de retour vers ${SITE_LABEL[plan.siteSource]}.`,
                // Comme la bascule réelle ci-dessus : en mode API, `appel` remplace la
                // simulation locale par le vrai `POST /pra/{id}/retour` (confirmation par
                // le nom exact, déjà exigée par le dialogue de confirmation du bouton).
                appel: () =>
                  requete(`/pra/${encodeURIComponent(plan.id)}/retour`, {
                    methode: 'POST',
                    corps: { confirmation: plan.nom },
                  }),
                job: {
                  type: 'dr.failback',
                  label: `Retour arrière · ${plan.nom}`,
                  etapes: [
                    'Resynchroniser les données vers le site d’origine',
                    'Arrêter les services sur le site de repli',
                    'Redémarrer les groupes sur le site d’origine',
                    'Rebasculer le DNS public',
                  ],
                },
              }}
              confirmation={{
                ressource: plan.nom,
                titre: 'Déclencher le retour arrière ?',
                pertes: [
                  `Les services du site de repli ${SITE_LABEL[plan.siteRepli]} seront arrêtés`,
                  'Les écritures en vol pendant la resynchronisation inverse seront perdues',
                  'Une nouvelle interruption de service est nécessaire',
                ],
                libelleAction: 'Déclencher le retour arrière',
              }}
            />
          </Card>
        </div>
      )}

      {/* ─── Exercices ───────────────────────────────────────────────── */}
      {onglet === 'exercices' && (
        <div className="space-y-4">
          {plan.exercices.length === 0 ? (
            <Card>
              <Callout ton="warn" titre="Aucun exercice à ce jour">
                Ce plan n’a jamais été exercé. Le RTO affiché est une cible contractuelle, pas une
                mesure. Nous recommandons un premier exercice de test dans les trente jours : il est
                inclus dans l’offre et n’a aucun impact sur votre production.
              </Callout>
              <GatedAction
                autorise={autorise('dr.failover.test')}
                message={refus('dr.failover.test')}
              >
                <BoutonFormulaire
                  libelle="Planifier le premier exercice"
                  variant="primary"
                  size="md"
                  className="mt-4"
                  icone={<FlaskConical size={14} />}
                  action="dr.failover.test"
                  titre="Planifier un exercice de bascule"
                  description="L’exercice se déroule dans un réseau isolé : la production continue de tourner. Le rapport est daté et opposable à un auditeur."
                  champs={[
                    {
                      id: 'quand',
                      label: 'Fenêtre',
                      type: 'select',
                      options: [
                        { value: 'nuit', label: 'La prochaine nuit · 02h00' },
                        { value: 'week-end', label: 'Le prochain week-end · samedi 03h00' },
                        { value: 'maintenant', label: 'Maintenant' },
                      ],
                    },
                    { id: 'temoin', label: 'Personne témoin', placeholder: 'a.kone@dba.africa' },
                  ]}
                  libelleValider="Planifier"
                  operation={(v) =>
                    v.quand === 'maintenant'
                      ? {
                          ton: 'info',
                          titre: 'Exercice lancé en réseau isolé',
                          job: { workflow: 'dr.failover.test', cible: plan.nom },
                          effetFinal: () =>
                            plans.modifier(plan.id, (p) => ({
                              statut: 'operationnel',
                              exercices: [
                                {
                                  date: '2026-08-19',
                                  type: 'test' as const,
                                  dureeMin: p.rtoCibleMin,
                                  rtoConstateMin: p.rtoCibleMin,
                                  succes: true,
                                  rapportUrl: '#rapport-exercice',
                                },
                                ...p.exercices,
                              ],
                            })),
                        }
                      : {
                          titre: 'Exercice planifié',
                          detail: 'Un rappel est envoyé 24 heures avant, avec la liste des vérifications à mener.',
                        }
                  }
                />
              </GatedAction>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  titre="Historique des exercices"
                  sousTitre="La progression du RTO constaté est l’indicateur qui compte : elle mesure la maturité réelle du plan."
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max border-collapse">
                    <thead>
                      <tr className="border-b border-g-300 bg-g-050">
                        {['Date', 'Type', 'Durée totale', 'RTO constaté', 'Écart à la cible', 'Résultat', 'Rapport'].map(
                          (h) => (
                            <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {plan.exercices.map((e) => {
                        const conforme = e.rtoConstateMin <= plan.rtoCibleMin
                        return (
                          <tr key={e.date} className="border-b border-g-100 last:border-0">
                            <td className="px-3 py-2.5 text-[12.5px] text-ink">
                              {dateCourte(e.date)}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge tone={e.type === 'reel' ? 'err' : 'info'} size="sm">
                                {e.type === 'reel' ? 'Réelle' : 'Test'}
                              </Badge>
                            </td>
                            <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                              {dureeMin(e.dureeMin)}
                            </td>
                            <td className="tnum px-3 py-2.5 text-[12.5px] font-semibold">
                              <span className={conforme ? 'text-ok' : 'text-err'}>
                                {dureeMin(e.rtoConstateMin)}
                              </span>
                            </td>
                            <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">
                              {conforme ? '−' : '+'}
                              {dureeMin(Math.abs(plan.rtoCibleMin - e.rtoConstateMin))}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge tone={e.succes ? 'ok' : 'err'} dot size="sm">
                                {e.succes ? 'Réussi' : 'Échoué'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5">
                              <a
                                href={e.rapportUrl}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-p-700 hover:text-m-600"
                              >
                                <FileDown size={12} />
                                Télécharger
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <CardHeader
                  titre="Incidents relevés lors des exercices"
                  sousTitre="Un exercice qui ne relève rien est un exercice mal conçu."
                />
                <div className="space-y-3">
                  {plan.exercices
                    .filter((e) => e.incidents && e.incidents.length > 0)
                    .map((e) => (
                      <div key={e.date} className="border-l-2 border-p-300 pl-3.5">
                        <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-ink">
                          Exercice du {dateCourte(e.date)}
                          <Badge tone={e.succes ? 'ok' : 'err'} size="sm">
                            {e.succes ? 'Réussi' : 'Échoué'}
                          </Badge>
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {e.incidents!.map((inc) => (
                            <li key={inc} className="text-[12.5px] leading-relaxed text-g-700">
                              · {inc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </Card>

              <Callout ton="ok" titre="Progression mesurée">
                Le RTO constaté est passé de {dureeMin(plan.exercices[plan.exercices.length - 1].rtoConstateMin)}{' '}
                en janvier à {dureeMin(plan.exercices[0].rtoConstateMin)} en juillet, soit une
                amélioration de{' '}
                {pct(
                  Math.round(
                    ((plan.exercices[plan.exercices.length - 1].rtoConstateMin -
                      plan.exercices[0].rtoConstateMin) /
                      plan.exercices[plan.exercices.length - 1].rtoConstateMin) *
                      100,
                  ),
                )}
                . Prochain exercice planifié : 15 octobre 2026.
              </Callout>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={bascule}
        onClose={() => setBascule(false)}
        onConfirm={() =>
          executer({
            action: 'dr.failover.real',
            ton: 'warn',
            titre: 'Bascule réelle engagée',
            detail: `Séquence de ${plan.groupes.length} groupes en cours. Suivi dans le centre de tâches.`,
            // La confirmation voyage dans le corps, pas en paramètre : le
            // dialogue a déjà fait saisir le nom exact du plan.
            appel: () =>
              requete(`/pra/${encodeURIComponent(plan.id)}/bascule`, {
                methode: 'POST',
                corps: { type: 'reel', confirmation: plan.nom },
              }),
            job: { workflow: 'dr.failover.real', cible: `${plan.nom} → ${SITE_LABEL[plan.siteRepli]}` },
            effetFinal: () => {
              plans.modifier(plan.id, (p) => ({
                exercices: [
                  {
                    date: '2026-08-19',
                    type: 'reel' as const,
                    dureeMin: p.rtoConstateMin || p.rtoCibleMin,
                    rtoConstateMin: p.rtoConstateMin || p.rtoCibleMin,
                    succes: true,
                    rapportUrl: '#rapport-bascule',
                  },
                  ...p.exercices,
                ],
              }))
              plans.recharger()
            },
          })
        }
        titre="Déclencher une bascule réelle"
        ressource={plan.nom}
        pertes={[
          `La production sur ${SITE_LABEL[plan.siteSource]} sera arrêtée`,
          `Les données non répliquées seront perdues (jusqu’à ${dureeMin(plan.rpoConstateMin || plan.rpoCibleMin)} d’écritures)`,
          `Le DNS public basculera vers ${SITE_LABEL[plan.siteRepli]}`,
          `Interruption de service estimée : ${dureeMin(plan.rtoConstateMin || plan.rtoCibleMin)}`,
          'Un retour arrière exigera une resynchronisation inverse complète',
        ]}
        libelleAction="Déclencher la bascule réelle"
      />
    </div>
  )
}
