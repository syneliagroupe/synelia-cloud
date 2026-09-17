'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Check,
  CornerDownRight,
  ExternalLink,
  History,
  Plus,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateHeure, jetons, money, num, pct, relatif } from '@/lib/format'
import {
  CATEGORIE_OUTIL_LABEL,
  CLASSE_DONNEES_LABEL,
  TYPE_AGENT_LABEL,
  TYPE_CANAL_LABEL,
  type AgentIA,
} from '@/lib/types'
import {
  AGENTS_IA,
  ANNOTATIONS_IA,
  BASES_CONNAISSANCE,
  CANAUX_AGENT,
  OUTILS_AGENT,
  PASSERELLE_IA,
  TRACE_EXECUTION,
  modeleParSlug,
  outilParId,
} from '@/lib/mock'
import { ApiError, creerRessource, estActif, modifierRessource, supprimerRessource } from '@/lib/api/client'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, SolutionLogo, Tabs } from '@/components/ui/display'
import { Field, MonoTextarea, Select, Slider, Switch } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { QuotaBar, StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useApp, useEspace, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire } from '@/components/app/actions'

const ONGLETS = [
  { id: 'consigne', label: 'Rôle & consigne' },
  { id: 'outils', label: 'Outils & connaissances' },
  { id: 'garde', label: 'Garde-fous & mémoire' },
  { id: 'canaux', label: 'Publication' },
  { id: 'versions', label: 'Versions & épreuves' },
  { id: 'traces', label: 'Traces & annotations' },
]

const TON_STATUT = { publie: 'ok', brouillon: 'neutral', suspendu: 'warn' } as const
const LIBELLE_STATUT = { publie: 'Publié', brouillon: 'Brouillon', suspendu: 'Suspendu' } as const

const TON_TRACE = {
  entree: 'neutral',
  garde: 'violet',
  agent: 'info',
  connaissance: 'ok',
  outil: 'info',
  reprise: 'warn',
  humain: 'violet',
  sortie: 'neutral',
} as const

/** Surligne les `{{variables}}` d'une consigne sans en faire un éditeur. */
function ConsigneAnnotee({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\{\{[a-z_]+\}\})/g)
  return (
    <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink">
      {morceaux.map((m, i) =>
        m.startsWith('{{') ? (
          <span key={i} className="rounded-[3px] bg-p-100 px-1 py-0.5 font-semibold text-p-700">
            {m}
          </span>
        ) : (
          <span key={i}>{m}</span>
        ),
      )}
    </p>
  )
}

export function VueAgent({ agentId }: { agentId: string }) {
  const maintenant = useMaintenant()
  const espace = useEspace()
  const router = useRouter()
  const { autorise, refus, pousser } = useApp()
  const [onglet, setOnglet] = useState('consigne')
  const [aRestaurer, setARestaurer] = useState<string | null>(null)
  const [messageTest, setMessageTest] = useState('')
  const [testEnCours, setTestEnCours] = useState(false)
  const [erreurTest, setErreurTest] = useState<string | null>(null)
  const [resultatTest, setResultatTest] = useState<{
    reponse: string
    jetonsEntree: number
    jetonsSortie: number
    coutFcfa: number
    latenceMs: number
  } | null>(null)

  // L'agent est relu dans la collection à chaque rendu : un agent créé pendant
  // la session doit s'ouvrir, et une fiche ne doit pas montrer l'état d'avant.
  const agentsCol = useCollection<AgentIA>('agents-ia', AGENTS_IA)
  const agents = estActif()
    ? agentsCol.items
    : agentsCol.items.filter((a) => a.espaceId === espace.id)
  const agent: AgentIA | undefined = agents.find((a) => a.id === agentId)

  const peutEcrire = autorise('ia.agent.write')
  const peutPublier = autorise('ia.agent.publish')

  // Rôle, description, slug, outils, versions, mémoire, canaux, métriques et
  // épreuves n'existent que côté maquette (`AgentIA` réel n'a que dix champs :
  // id, nom, consigne, espaceId, modele, temperature, topP, jetonsMax, statut,
  // createdAt). `type` ne fait jamais partie de la réponse réelle : sa
  // présence sert de marqueur pour distinguer un agent de démonstration d'un
  // agent effectivement créé via l'API.
  const demo = Boolean(agent?.type)

  const modele = agent ? modeleParSlug(agent.modele) : undefined
  const versionPubliee = demo ? agent?.versions.find((v) => v.statut === 'publiee') : undefined
  const annotations = demo && agent ? ANNOTATIONS_IA.filter((a) => a.agentId === agent.id) : []

  // La garde vient après tous les crochets, et la vue dit ce qu'elle ne trouve
  // pas plutôt que de rendre un 404 serveur : un agent créé pendant la session
  // n'existe pas dans le jeu figé, et une page d'erreur ferait croire à une panne.
  if (!agent) {
    return (
      <EmptyState
        titre="Agent introuvable"
        phrase="Cet agent n’existe pas, ou il appartient à un autre Espace Cloud que celui sélectionné. Le panneau de gauche liste ceux que vous pouvez ouvrir."
        action={{ libelle: 'Créer un agent', href: '/app/ia/nouveau' }}
      />
    )
  }

  const tester = async () => {
    if (!messageTest.trim() || testEnCours) return
    setTestEnCours(true)
    setErreurTest(null)
    try {
      const r = await creerRessource<{
        reponse: string
        jetonsEntree: number
        jetonsSortie: number
        coutFcfa: number
        latenceMs: number
      }>(`/ia/agents/${agent.id}/invoquer`, { message: messageTest })
      setResultatTest(r as typeof resultatTest)
    } catch (e) {
      setErreurTest(e instanceof ApiError ? e.message : 'Le backend ne répond pas.')
    } finally {
      setTestEnCours(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Agents', href: '/app/ia/agents' },
          { label: agent.nom },
        ]}
        titre={agent.nom}
        sousTitre={agent.role}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {agent.statut === 'publie' && agent.canaux?.includes('cx-widget') && (
              <ButtonLink href="https://assistant.dba.africa" external variant="accent" size="sm">
                Ouvrir
                <ExternalLink size={13} />
              </ButtonLink>
            )}
            <GatedAction autorise={peutEcrire} message={refus('ia.agent.write')}>
              <ButtonLink href="/app/ia/nouveau" variant="secondary" size="sm">
                <Plus size={14} />
                Créer un agent
              </ButtonLink>
            </GatedAction>
          </span>
        }
      />


      {agent && !demo && (
        <Card>
          <CardHeader
            titre="Champs réels de cet agent"
            sousTitre="Créé via l’API, cet agent n’a que les dix champs que la passerelle LiteLLM connaît aujourd’hui — pas encore d’outils, de mémoire, de canaux publiés, de versions ni de jeu d’épreuves : cette richesse reste propre aux agents de démonstration."
            actions={
              <span className="flex flex-wrap gap-2">
                {agent.statut !== 'publie' && (
                  <GatedAction autorise={peutPublier} message={refus('ia.agent.publish')}>
                    <Button
                      size="sm"
                      onClick={() => agentsCol.modifier(agent.id, { statut: 'publie' })}
                    >
                      Publier
                    </Button>
                  </GatedAction>
                )}
                {agent.statut === 'publie' && (
                  <GatedAction autorise={peutEcrire} message={refus('ia.agent.write')}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => agentsCol.modifier(agent.id, { statut: 'suspendu' })}
                    >
                      Suspendre
                    </Button>
                  </GatedAction>
                )}
                <BoutonAction
                  libelle="Supprimer"
                  variant="ghost"
                  operation={{
                    action: 'ia.agent.write',
                    ton: 'warn',
                    titre: `Agent « ${agent.nom} » supprimé`,
                    appel: () => supprimerRessource('/ia/agents', agent.id, agent.nom),
                    effet: () => agentsCol.supprimer(agent.id),
                    effetFinal: () => {
                      agentsCol.recharger()
                      router.push('/app/ia/agents')
                    },
                  }}
                  confirmation={{
                    ressource: agent.nom,
                    pertes: [
                      'La consigne et les réglages de cet agent sont détruits, sans retour possible',
                      'Tout appel à /ia/agents/{id}/invoquer sur cet agent échoue ensuite',
                    ],
                  }}
                />
              </span>
            }
          />
          <KeyValueList
            colonnes={2}
            items={[
              { cle: 'Modèle', valeur: modele?.nom ?? agent.modele },
              { cle: 'Statut', valeur: LIBELLE_STATUT[agent.statut] },
              { cle: 'Température', valeur: agent.temperature },
              { cle: 'Top-P', valeur: agent.topP },
              { cle: 'Jetons générés au plus', valeur: num(agent.jetonsMax) },
              { cle: 'Créé le', valeur: agent.createdAt ? dateHeure(agent.createdAt) : '—' },
            ]}
          />
          <div className="mt-4 border-t border-g-100 pt-4">
            <MicroLabel className="mb-2">Consigne</MicroLabel>
            <div className="rounded-[8px] border border-g-300 bg-g-050 p-3.5">
              <ConsigneAnnotee texte={agent.consigne} />
            </div>
          </div>
          <div className="mt-4 border-t border-g-100 pt-4">
            <MicroLabel className="mb-2">Appel direct (réel)</MicroLabel>
            <CodeBlock
              langue="bash"
              code={`curl -X POST {API}/ia/agents/${agent.id}/invoquer \\
  -H "Authorization: Bearer $SYNELIA_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Bonjour"}'`}
            />
          </div>
          <div className="mt-4 border-t border-g-100 pt-4">
            <MicroLabel className="mb-2">Tester cet agent</MicroLabel>
            <p className="mb-2 text-[11.5px] text-g-500">
              Un vrai appel à la passerelle, sans clé d’accès IA : rien n’est compté sur un quota
              ni sur une dépense de clé — seule une trace d’audit est écrite, comme pour tout appel.
            </p>
            <MonoTextarea
              value={messageTest}
              placeholder="Bonjour, peux-tu te présenter ?"
              onChange={(e) => setMessageTest(e.target.value)}
            />
            <Button
              className="mt-2"
              size="sm"
              disabled={!messageTest.trim() || testEnCours}
              onClick={tester}
            >
              {testEnCours ? 'Appel en cours…' : 'Tester'}
            </Button>
            {erreurTest && <p className="mt-2 text-[12px] text-err">{erreurTest}</p>}
            {resultatTest && (
              <div className="mt-3 rounded-[8px] border border-g-300 bg-g-050 p-3.5">
                <p className="whitespace-pre-wrap text-[12.5px] text-ink">{resultatTest.reponse}</p>
                <p className="mt-2 text-[11px] text-g-500">
                  {modele?.nom ?? agent.modele} · {num(resultatTest.jetonsEntree)} +{' '}
                  {num(resultatTest.jetonsSortie)} jetons · {money(resultatTest.coutFcfa)} ·{' '}
                  {num(resultatTest.latenceMs)} ms
                </p>
              </div>
            )}
          </div>
          <Callout ton="info" className="mt-4" titre="Publier ici, ce n’est pas publier une fiche de démonstration">
            « Publier » change le statut de cet agent auprès de la passerelle, immédiatement — il n’y
            a pas encore de jeu d’épreuves ni de bascule progressive sur 10 % du trafic côté backend :
            cette gouvernance existe pour les agents de démonstration de cette maquette, pas encore
            pour un agent créé via l’API.
          </Callout>
        </Card>
      )}

      {agent && demo && (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <span className="flex min-w-0 items-start gap-3">
                <SolutionLogo initiales={agent.initiales} teinte={agent.teinte} size="lg" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="type-h3">{agent.nom}</span>
                    <Badge tone={TON_STATUT[agent.statut]} dot size="sm">
                      {LIBELLE_STATUT[agent.statut]}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {versionPubliee?.numero ?? agent.versions[0]?.numero}
                    </Badge>
                  </span>
                  <span className="mt-1 block font-mono text-[12px] text-g-500">{agent.slug}</span>
                  <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-g-500">
                    {agent.description}
                  </p>
                </span>
              </span>
            </div>
          </Card>

          <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

          {onglet === 'consigne' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <Card>
                  <CardHeader
                    titre="Consigne"
                    sousTitre="Le rôle, le ton, les contraintes et ce que l’agent doit refuser de faire. Les variables entre doubles accolades sont remplacées à chaque appel."
                    actions={
                      <BoutonFormulaire
                        libelle="Enregistrer une version"
                        variant="secondary"
                        size="sm"
                        action="ia.agent.write"
                        titre="Enregistrer une nouvelle consigne"
                        description="La consigne est réécrite immédiatement sur cet agent — pas encore de versionnement distinct côté backend pour un agent créé via l’API."
                        champs={[
                          { id: 'consigne', label: 'Consigne', type: 'mono', obligatoire: true },
                        ]}
                        valeursDepart={{ consigne: agent.consigne }}
                        libelleValider="Enregistrer"
                        operation={(v) => ({
                          titre: 'Consigne enregistrée',
                          appel: () =>
                            modifierRessource('/ia/agents', agent.id, {
                              consigne: String(v.consigne),
                            }),
                          effet: () => agentsCol.modifier(agent.id, { consigne: String(v.consigne) }),
                          effetFinal: () => agentsCol.recharger(),
                        })}
                      />
                    }
                  />
                  <div className="rounded-[8px] border border-g-300 bg-g-050 p-3.5">
                    <ConsigneAnnotee texte={agent.consigne} />
                  </div>
                  <p className="mt-2 text-[12px] text-g-500">
                    {num(agent.consigne.length)} caractères · environ{' '}
                    {num(Math.round(agent.consigne.length / 3.6))} jetons, facturés à chaque appel et
                    mis en cache entre deux tours d’une même conversation.
                  </p>
                  <Callout ton="info" className="mt-4" titre="Une consigne n’est pas une garantie">
                    Écrire « ne demande jamais un mot de passe » réduit le risque, ne le supprime pas.
                    Ce qui doit être impossible se règle ailleurs : garde-fou en entrée, portée de
                    l’outil, filtre sur la classe de données. La consigne oriente, la plateforme
                    empêche.
                  </Callout>
                </Card>

                <Card>
                  <CardHeader
                    titre="Variables"
                    sousTitre="Ce que l’appelant doit fournir, et ce que la plateforme calcule elle-même."
                  />
                  {agent.variables.length === 0 ? (
                    <p className="text-[13px] text-g-500">
                      Aucune variable : la consigne de cet agent est la même à chaque appel.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left">
                        <thead>
                          <tr className="border-b border-g-300">
                            <th className="type-micro py-2 text-g-500">Variable</th>
                            <th className="type-micro py-2 text-g-500">Origine</th>
                            <th className="type-micro py-2 text-g-500">Exemple</th>
                            <th className="type-micro py-2 text-g-500">Requise</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agent.variables.map((v) => (
                            <tr key={v.cle} className="border-b border-g-100 last:border-0">
                              <td className="py-2.5">
                                <span className="block font-mono text-[12px] font-semibold text-p-700">
                                  {`{{${v.cle}}}`}
                                </span>
                                <span className="block text-[11px] text-g-500">{v.libelle}</span>
                              </td>
                              <td className="py-2.5 text-[12px] text-g-700">
                                {v.source === 'appelant'
                                  ? 'Fournie par l’appelant'
                                  : v.source === 'systeme'
                                    ? 'Calculée par la plateforme'
                                    : 'Lue dans l’annuaire'}
                              </td>
                              <td className="py-2.5 font-mono text-[12px] text-g-500">
                                {v.exemple}
                              </td>
                              <td className="py-2.5">
                                <Badge tone={v.obligatoire ? 'violet' : 'neutral'} size="sm">
                                  {v.obligatoire ? 'Oui' : 'Non'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader titre="Modèle" />
                  <Field label="Modèle sous-jacent">
                    <Select defaultValue={agent.modele} disabled={!peutEcrire}>
                      <option value={agent.modele}>{modele?.nom ?? agent.modele}</option>
                    </Select>
                  </Field>
                  <div className="mt-3">
                    <KeyValueList
                      colonnes={1}
                      items={[
                        { cle: 'Résidence', valeur: modele?.residence ?? '—' },
                        {
                          cle: 'Tarif',
                          valeur: modele
                            ? `${money(modele.prixEntree)} / ${money(modele.prixSortie)} le million`
                            : '—',
                        },
                        { cle: 'Latence p50', valeur: `${num(modele?.latenceP50Ms ?? 0)} ms` },
                      ]}
                    />
                  </div>
                  {modele?.hebergement === 'externe' && (
                    <Callout ton="warn" className="mt-3" titre="Sortie de territoire">
                      Cet agent traite des données de classe «{' '}
                      {CLASSE_DONNEES_LABEL[agent.classeDonnees].toLowerCase() }» sur un modèle
                      hébergé hors de Côte d’Ivoire. La politique de résidence peut refuser certains
                      appels à l’exécution.
                    </Callout>
                  )}
                </Card>

                <Card>
                  <CardHeader
                    titre="Hyperparamètres"
                    sousTitre="Une température basse rend l’agent répétitif et fiable ; une température haute le rend inventif, y compris quand il ne faut pas."
                  />
                  <div className="space-y-4">
                    <Slider
                      label="Température"
                      value={agent.temperature}
                      onChange={() => undefined}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                    <Slider
                      label="Top-P"
                      value={agent.topP}
                      onChange={() => undefined}
                      min={0.1}
                      max={1}
                      step={0.05}
                    />
                    <Slider
                      label="Jetons générés au plus"
                      value={agent.jetonsMax}
                      onChange={() => undefined}
                      min={128}
                      max={8_192}
                      step={128}
                      unite="jetons"
                    />
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    titre="Stratégie"
                    sousTitre="Comment l’agent décide d’appeler un outil. Ce choix dépend du modèle autant que de la tâche."
                  />
                  <div className="space-y-4">
                    <Field label="Manière de raisonner">
                      <Select defaultValue={agent.strategie} disabled={!peutEcrire}>
                        <option value="function_calling">
                          Appel de fonction natif — le modèle choisit l’outil lui-même
                        </option>
                        <option value="react">
                          ReAct — pensée, action, observation, à chaque tour
                        </option>
                      </Select>
                    </Field>
                    <Slider
                      label="Itérations au plus"
                      value={agent.maxIterations}
                      onChange={() => undefined}
                      min={1}
                      max={20}
                      unite="tours"
                    />
                  </div>
                  <Callout
                    ton={agent.strategie === 'react' ? 'violet' : 'info'}
                    className="mt-4"
                    titre={
                      agent.strategie === 'react'
                        ? 'ReAct : plus lent, mais lisible'
                        : 'Appel natif : rapide, mais opaque'
                    }
                  >
                    {agent.strategie === 'react'
                      ? 'Chaque tour écrit son raisonnement avant d’agir, ce qui coûte des jetons et du temps mais rend la trace exploitable quand la réponse est fausse. C’est le bon choix sur un agent d’analyse, dont on doit pouvoir contester la conclusion.'
                      : 'Le modèle décide seul quel outil appeler, sans expliciter son raisonnement. Deux fois moins de jetons qu’en ReAct, et une trace qui montre les appels sans montrer le pourquoi. Suffisant quand l’enchaînement est court et vérifiable par son résultat.'}
                    {' '}Au-delà de {agent.maxIterations} tours, l’agent est interrompu et rend ce
                    qu’il a : une boucle d’outils qui ne converge pas coûte plus qu’elle ne rapporte.
                  </Callout>
                </Card>
              </div>
            </div>
          )}

          {onglet === 'outils' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Outils attribués"
                  sousTitre="Un agent ne peut appeler que ce qui est coché ici. Le reste du catalogue lui est invisible."
                  actions={
                    <ButtonLink href="/app/ia/integrations" variant="ghost" size="sm">
                      <Wrench size={13} />
                      Catalogue
                    </ButtonLink>
                  }
                />
                {agent.outils.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-g-500">
                    Aucun outil. Cet agent ne fait que lire sa consigne et répondre — c’est
                    exactement ce qu’on attend d’un classifieur, et une limite pour tout le reste.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {agent.outils.map((id) => {
                      const o = outilParId(id)
                      if (!o) return null
                      return (
                        <div
                          key={id}
                          className="rounded-[6px] border border-g-300 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block font-mono text-[13px] font-semibold text-ink">
                                {o.nom}
                              </span>
                              <span className="block text-[11px] text-g-500">{o.fournisseur}</span>
                            </span>
                            <span className="flex shrink-0 flex-wrap gap-1.5">
                              <Badge tone={o.effet === 'ecriture' ? 'warn' : 'neutral'} size="sm">
                                {o.effet === 'ecriture' ? 'Écrit' : 'Lit'}
                              </Badge>
                              {o.confirmationRequise && (
                                <Badge tone="violet" size="sm">
                                  Confirmation
                                </Badge>
                              )}
                              <Badge
                                tone={o.statut === 'actif' ? 'ok' : o.statut === 'erreur' ? 'err' : 'neutral'}
                                dot
                                size="sm"
                              >
                                {o.statut === 'actif' ? 'Actif' : o.statut === 'erreur' ? 'En erreur' : 'Inactif'}
                              </Badge>
                            </span>
                          </div>
                          <p className="mt-1.5 text-[12px] text-g-500">
                            {CATEGORIE_OUTIL_LABEL[o.categorie]} · {num(o.appels24h)} appels en 24 h
                            · {pct(o.tauxErreurPct, 1)} d’erreurs · {num(o.latenceP50Ms)} ms
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Callout ton="warn" className="mt-4" titre="Un outil échoue plus souvent qu’un modèle">
                  {pct(agent.metriques.tauxEchecOutilPct, 1)} des appels d’outils de cet agent
                  échouent — délai dépassé, schéma inattendu, service indisponible. La reprise
                  automatique en rattrape la majorité ; le reste doit produire une réponse honnête,
                  pas une invention.
                </Callout>
              </Card>

              <Card>
                <CardHeader
                  titre="Bases de connaissances"
                  sousTitre="Ce que l’agent peut citer. Sans base, il répond avec ce que le modèle a appris — donc jamais avec vos procédures."
                  actions={
                    <ButtonLink href="/app/ia/connaissances" variant="ghost" size="sm">
                      <BookOpen size={13} />
                      Gérer
                    </ButtonLink>
                  }
                />
                {agent.connaissances.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-g-500">
                    Aucune base rattachée.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {agent.connaissances.map((id) => {
                      const b = BASES_CONNAISSANCE.find((x) => x.id === id)
                      if (!b) return null
                      return (
                        <div
                          key={id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[13px] font-semibold text-ink">
                              {b.nom}
                            </span>
                            <span className="block text-[11px] text-g-500">
                              {num(b.documents)} documents · indexée {relatif(b.derniereIndexation, maintenant)}
                            </span>
                          </span>
                          <Badge
                            tone={b.statut === 'a_jour' ? 'ok' : b.statut === 'erreur' ? 'err' : 'info'}
                            dot
                            size="sm"
                          >
                            {b.statut === 'a_jour'
                              ? 'À jour'
                              : b.statut === 'erreur'
                                ? 'Index partiel'
                                : 'Indexation'}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="mt-4 border-t border-g-100 pt-4">
                  <MicroLabel className="mb-2">Réglages de recherche</MicroLabel>
                  <KeyValueList
                    colonnes={1}
                    items={[
                      { cle: 'Fragments remontés', valeur: '8 par appel, reclassés' },
                      { cle: 'Score minimal', valeur: '0,32 — en dessous, aucune citation' },
                      { cle: 'Sans résultat', valeur: 'L’agent répond qu’il n’a pas l’information' },
                    ]}
                  />
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader
                  titre="Sortie structurée"
                  sousTitre={
                    agent.sortieStructuree
                      ? 'La réponse est contrainte par un schéma : le modèle ne peut pas rendre autre chose. C’est ce qui permet à du code de la relire sans analyse de texte.'
                      : 'Cet agent répond en texte libre. Un schéma ne se justifie que si sa sortie est consommée par du code plutôt que lue par un humain.'
                  }
                  actions={
                    <Badge tone={agent.sortieStructuree ? 'violet' : 'neutral'} size="sm">
                      {agent.sortieStructuree ? 'Schéma imposé' : 'Texte libre'}
                    </Badge>
                  }
                />
                {agent.sortieStructuree ? (
                  <>
                    <CodeBlock langue="json" code={agent.sortieStructuree} />
                    <Callout ton="info" className="mt-4" titre="Ce que le schéma garantit, et ce qu’il ne garantit pas">
                      Il garantit la forme : les champs sont là, les types sont bons, les valeurs
                      d’énumération sont valides. Il ne garantit rien sur le fond — un montant peut
                      être parfaitement typé et parfaitement faux. C’est pourquoi cet agent porte en
                      plus un contrôle de cohérence, et passe la main quand il ne tombe pas juste.
                    </Callout>
                  </>
                ) : (
                  <p className="text-[13px] leading-relaxed text-g-500">
                    Imposer un schéma à un agent conversationnel le rendrait inutilisable : ses
                    réponses sont lues par des personnes, pas analysées par un programme.
                  </p>
                )}
              </Card>
            </div>
          )}

          {onglet === 'garde' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Limites d’exécution"
                  sousTitre="Ce qui borne l’agent quoi qu’il arrive, y compris si sa consigne est détournée."
                />
                <div className="space-y-3.5">
                  <Field label="Classe de données maximale" hint="Décide où la requête a le droit d’être traitée">
                    <Select defaultValue={agent.classeDonnees} disabled={!peutEcrire}>
                      <option value={agent.classeDonnees}>
                        {CLASSE_DONNEES_LABEL[agent.classeDonnees]}
                      </option>
                    </Select>
                  </Field>
                  <div>
                    <QuotaBar
                      libelle="Budget quotidien"
                      utilise={agent.metriques.coutJour}
                      total={agent.budgetJour}
                      seuil={85}
                      formateur={(v) => money(v)}
                    />
                    <p className="mt-1.5 text-[12px] text-g-500">
                      Au plafond, l’agent est suspendu et les appels reçoivent un 402. Le plafond
                      protège d’une boucle, pas d’une mauvaise réponse.
                    </p>
                  </div>
                  <Switch
                    checked={agent.humainDansLaBoucle}
                    disabled={!peutEcrire}
                    label="Validation humaine avant action engageante"
                    description="Le flux se met en pause et attend une personne. Ce n’est pas une revue de qualité : c’est la garantie qu’aucun engagement ne part sans décision humaine."
                  />
                </div>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader
                    titre="Mémoire"
                    sousTitre="Ce dont l’agent se souvient d’un tour à l’autre — et avec qui il le partage."
                  />
                  <KeyValueList
                    colonnes={1}
                    items={[
                      {
                        cle: 'Portée',
                        valeur:
                          agent.memoire.portee === 'aucune'
                            ? 'Aucune — chaque appel repart de zéro'
                            : agent.memoire.portee === 'session'
                              ? `Session, conservée ${agent.memoire.dureeJours} jour(s)`
                              : `Longue durée, ${agent.memoire.dureeJours} jours glissants`,
                      },
                      {
                        cle: 'Contexte partagé',
                        valeur:
                          agent.memoire.partageeAvec.length === 0
                            ? 'Aucun — la mémoire reste propre à cet agent'
                            : agent.memoire.partageeAvec
                                .map((id) => AGENTS_IA.find((x) => x.id === id)?.nom ?? id)
                                .join(', '),
                      },
                      {
                        cle: 'Reprise sur erreur',
                        valeur: `${agent.reprise.tentatives} tentative(s), ${agent.reprise.delaiS} s d’écart`,
                      },
                    ]}
                  />
                  <Callout ton="violet" className="mt-4" titre="Une mémoire est une donnée conservée">
                    Ce qu’un agent retient d’une conversation tombe sous les mêmes règles que le
                    reste : durée de conservation, droit à l’effacement, classe de données. Une
                    mémoire de trente jours sur des échanges nominatifs se déclare au registre des
                    traitements.
                  </Callout>
                </Card>

                <Card>
                  <CardHeader
                    titre="Garde-fous hérités"
                    sousTitre="Appliqués à toutes les clés de l’organisation, avant et après l’appel au modèle."
                    actions={
                      <ButtonLink href="/app/ia/parametres/garde-fous" variant="ghost" size="sm">
                        <ShieldCheck size={13} />
                        Régler
                      </ButtonLink>
                    }
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['Données personnelles', 'Secrets et clés d’API', 'Injection de consigne', 'Contenu offensant'].map(
                      (g) => (
                        <Badge key={g} tone="ok" size="sm">
                          <Check size={10} className="mr-1 inline" aria-hidden />
                          {g}
                        </Badge>
                      ),
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {onglet === 'canaux' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Canaux publiés"
                  sousTitre="Par où les gens atteignent cet agent. Un même agent répond différemment selon le canal : 160 caractères en SMS, la voix en synthèse au téléphone."
                  actions={
                    <ButtonLink href="/app/ia/integrations" variant="ghost" size="sm">
                      Tous les canaux
                    </ButtonLink>
                  }
                />
                {agent.canaux.length === 0 ? (
                  <EmptyState
                    titre="Agent non publié"
                    phrase="Tant qu’aucun canal n’est ouvert, cet agent n’est joignable par personne — ce qui est le bon état pour un brouillon dont les épreuves ne passent pas."
                  />
                ) : (
                  <div className="space-y-2">
                    {agent.canaux.map((id) => {
                      const c = CANAUX_AGENT.find((x) => x.id === id)
                      if (!c) return null
                      return (
                        <div
                          key={id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-ink">
                              {TYPE_CANAL_LABEL[c.type]}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-g-500">
                              {c.identifiant}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="tnum text-[12px] text-g-500">
                              {num(c.messages24h)} msg / 24 h
                            </span>
                            <Badge tone={c.etat === 'connecte' ? 'ok' : 'warn'} dot size="sm">
                              {c.etat === 'connecte' ? 'Connecté' : 'À configurer'}
                            </Badge>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader
                    titre="Appel direct"
                    sousTitre="Le même agent, depuis vos applications, sans passer par un canal conversationnel."
                  />
                  <CodeBlock
                    langue="bash"
                    code={`curl ${PASSERELLE_IA.base}/agents/${agent.slug}/executions \\
  -H "Authorization: Bearer $SYNELIA_IA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "entree": "Ma facture de juillet me paraît trop élevée",
    "variables": { ${agent.variables
      .filter((v) => v.source === 'appelant')
      .map((v) => `"${v.cle}": "${v.exemple}"`)
      .join(', ')} },
    "session": "wa-2250700000000"
  }'`}
                  />
                  <p className="mt-2.5 text-[12px] leading-relaxed text-g-500">
                    Le champ <span className="font-mono text-[11px]">session</span> est la clé du
                    routeur omnicanal : donnez le même identifiant depuis le SMS et depuis WhatsApp,
                    et l’agent retrouve le fil.
                  </p>
                </Card>
                <Card>
                  <CardHeader
                    titre="Exposer l’agent comme outil MCP"
                    sousTitre="Un agent publié peut devenir un outil pour d’autres systèmes : un autre agent, un assistant de votre poste de travail, ou un flux d’une autre organisation."
                    actions={
                      <Badge tone={agent.publieMcp ? 'ok' : 'neutral'} dot size="sm">
                        {agent.publieMcp ? 'Exposé' : 'Non exposé'}
                      </Badge>
                    }
                  />
                  {agent.publieMcp ? (
                    <>
                      <CopyField
                        label="Point d’entrée MCP"
                        value={`https://ia.synelia.cloud/mcp/${agent.slug}/sse`}
                      />
                      <div className="mt-3">
                        <KeyValueList
                          colonnes={1}
                          items={[
                            { cle: 'Outil exposé', valeur: <span className="font-mono text-[12px]">{agent.slug.replace(/-/g, '_')}</span> },
                            { cle: 'Authentification', valeur: 'Clé d’accès IA, portée limitée à cet agent' },
                            { cle: 'Quota', valeur: 'Compté sur le budget de l’agent, pas sur celui de l’appelant' },
                          ]}
                        />
                      </div>
                      <Callout ton="warn" className="mt-4" titre="Un agent exposé est un agent qu’on ne voit plus appeler">
                        Côté appelant, votre agent devient une ligne dans une liste d’outils. Il sera
                        invoqué par des systèmes que vous ne contrôlez pas, avec des entrées que vous
                        n’avez pas prévues. Son budget quotidien et sa classe de données maximale
                        deviennent alors les seules limites qui tiennent.
                      </Callout>
                    </>
                  ) : (
                    <p className="text-[13px] leading-relaxed text-g-500">
                      Cet agent n’est pas exposé. Son extracteur rend du JSON dans un format qui n’a
                      de sens que pour la chaîne comptable : l’ouvrir à d’autres systèmes créerait une
                      dépendance sans usage.
                    </p>
                  )}
                </Card>

                <Callout ton="info" titre="Publier, c’est engager">
                  Un agent publié répond à de vraies personnes, sur un vrai numéro, au nom de votre
                  organisation. La publication demande le rôle Organisation Admin ou Espace Cloud
                  Admin, et laisse une trace nominative dans l’audit.
                </Callout>
              </div>
            </div>
          )}

          {onglet === 'versions' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
              <Card>
                <CardHeader
                  titre="Historique des versions"
                  sousTitre="Chaque enregistrement fige la consigne, le modèle, les hyperparamètres et la liste des outils. Revenir en arrière republie l’ensemble, pas seulement le texte."
                />
                <div className="space-y-2">
                  {agent.versions.map((v) => (
                    <div
                      key={v.numero}
                      className={cn(
                        'flex flex-wrap items-start justify-between gap-3 rounded-[6px] border px-3 py-2.5',
                        v.statut === 'publiee' ? 'border-p-700 bg-p-050' : 'border-g-300',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[13px] font-bold text-ink">
                            {v.numero}
                          </span>
                          {v.statut === 'publiee' && (
                            <Badge tone="violet" size="sm">
                              En production
                            </Badge>
                          )}
                          {v.statut === 'brouillon' && (
                            <Badge tone="neutral" size="sm">
                              Brouillon
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-g-700">{v.note}</span>
                        <span className="block text-[11px] text-g-500">
                          {dateHeure(v.date)} · {v.auteur}
                        </span>
                      </span>
                      {v.statut === 'archivee' && (
                        <GatedAction autorise={peutPublier} message={refus('ia.agent.publish')}>
                          <Button
                            size="sm"
                            variant="ghost"
                            iconBefore={<RotateCcw size={13} />}
                            onClick={() => setARestaurer(v.numero)}
                          >
                            Restaurer
                          </Button>
                        </GatedAction>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader
                    titre="Jeu d’épreuves"
                    sousTitre="Des cas figés avec la réponse attendue, rejoués avant chaque publication."
                  />
                  <QuotaBar
                    libelle="Cas réussis"
                    utilise={agent.epreuves.reussis}
                    total={agent.epreuves.cas}
                    seuil={80}
                    formateur={(v) => `${v} cas`}
                  />
                  <p className="mt-3 text-[12px] text-g-500">
                    Dernier passage {relatif(agent.epreuves.dernierPassage, maintenant)} ·{' '}
                    {pct((agent.epreuves.reussis / agent.epreuves.cas) * 100)} de réussite
                  </p>
                  {agent.epreuves.reussis / agent.epreuves.cas < 0.8 ? (
                    <Callout ton="warn" className="mt-3" titre="Sous le seuil de publication">
                      La publication est bloquée sous 80 % de réussite. Ce n’est pas un avis : c’est
                      la règle appliquée par la plateforme, et c’est pour cela que cet agent est
                      encore en brouillon.
                    </Callout>
                  ) : (
                    <Callout ton="ok" className="mt-3" titre="Au-dessus du seuil">
                      Les {agent.epreuves.cas - agent.epreuves.reussis} cas en échec restent listés :
                      un jeu d’épreuves à 100 % signifie souvent qu’il est trop facile.
                    </Callout>
                  )}
                </Card>
                <Card>
                  <CardHeader titre="Publication" />
                  <GatedAction autorise={peutPublier} message={refus('ia.agent.publish')}>
                    <Button
                      fullWidth
                      disabled={agent.epreuves.reussis / agent.epreuves.cas < 0.8}
                      onClick={() =>
                        pousser({
                          ton: 'ok',
                          titre: 'Agent publié',
                          detail: `${agent.nom} — bascule progressive sur 10 % du trafic pendant 30 minutes.`,
                        })
                      }
                    >
                      Publier la version courante
                    </Button>
                  </GatedAction>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-g-500">
                    La bascule se fait sur 10 % du trafic pendant trente minutes. Si le taux d’erreur
                    dépasse celui de la version en place, la plateforme revient seule à l’ancienne.
                  </p>
                </Card>
              </div>
            </div>
          )}

          {onglet === 'traces' && (
            <div className="space-y-4">
              <Card>
                <CardHeader
                  titre="Trace d’une exécution"
                  sousTitre={`Exécution ${TRACE_EXECUTION.id} · ${TRACE_EXECUTION.canal} · ${dateHeure(TRACE_EXECUTION.debut)}`}
                  actions={
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="ok" size="sm">
                        Succès
                      </Badge>
                      <span className="tnum text-[12px] text-g-500">
                        {(TRACE_EXECUTION.dureeMs / 1000).toFixed(1).replace('.', ',')} s ·{' '}
                        {jetons(TRACE_EXECUTION.jetons)} · {money(TRACE_EXECUTION.cout)}
                      </span>
                    </span>
                  }
                />
                <ol className="space-y-1.5">
                  {TRACE_EXECUTION.etapes.map((e, i) => (
                    <li
                      key={e.id}
                      className={cn(
                        'rounded-[6px] border px-3 py-2.5',
                        e.type === 'reprise' ? 'border-warn/40' : 'border-g-300',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="flex min-w-0 items-start gap-2">
                          <span className="tnum mt-0.5 w-5 shrink-0 text-[11px] text-g-500">
                            {i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-semibold text-ink">{e.noeud}</span>
                              <Badge tone={TON_TRACE[e.type]} size="sm">
                                {e.type === 'garde'
                                  ? 'Garde-fou'
                                  : e.type === 'reprise'
                                    ? 'Reprise'
                                    : e.type === 'connaissance'
                                      ? 'Recherche'
                                      : e.type === 'outil'
                                        ? 'Outil'
                                        : e.type === 'humain'
                                          ? 'Humain'
                                          : e.type === 'agent'
                                            ? 'Modèle'
                                            : e.type === 'entree'
                                              ? 'Entrée'
                                              : 'Sortie'}
                              </Badge>
                            </span>
                            <span className="mt-1 flex items-start gap-1.5">
                              <CornerDownRight size={11} className="mt-1 shrink-0 text-g-500" aria-hidden />
                              <span className="font-mono text-[12px] leading-relaxed text-g-700">
                                {e.detail}
                              </span>
                            </span>
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-right text-[11px] text-g-500">
                          <span className="block">{num(e.dureeMs)} ms</span>
                          {e.jetons > 0 && <span className="block">{num(e.jetons)} jetons</span>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                <Callout ton="info" className="mt-4" titre="Ce que la trace conserve">
                  Le message d’origine après masquage, chaque appel intermédiaire, les fragments
                  cités et la réponse finale — cinq ans pour les classes réglementées, quatre-vingt-dix
                  jours sinon. Le contenu avant masquage n’est jamais écrit : il n’existe qu’en
                  mémoire, le temps de l’appel.
                </Callout>
              </Card>

              <Card>
                <CardHeader
                  titre="Corrections annotées"
                  sousTitre="Une réponse corrigée par un humain est rejouée en priorité sur les questions équivalentes, sans réentraîner quoi que ce soit."
                  actions={
                    <span className="flex items-center gap-1.5 text-[12px] text-g-500">
                      <History size={13} aria-hidden />
                      {agent.annotations} corrections enregistrées
                    </span>
                  }
                />
                {annotations.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-g-500">
                    Aucune correction sur cet agent. C’est normal pour un extracteur : sa sortie est
                    vérifiée par un contrôle de cohérence, pas par une relecture.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {annotations.map((a) => (
                      <div key={a.id} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                        <p className="text-[13px] font-semibold text-ink">{a.question}</p>
                        <p className="mt-1.5 text-[12px] text-g-500 line-through">
                          {a.reponseInitiale}
                        </p>
                        <p className="mt-1 text-[12px] text-ink">{a.correction}</p>
                        <p className="mt-1.5 text-[11px] text-g-500">
                          {a.auteur} · {relatif(a.date, maintenant)} · réutilisée {num(a.reutilisations)} fois
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={aRestaurer !== null}
        onClose={() => setARestaurer(null)}
        onConfirm={() => {
          pousser({
            ton: 'warn',
            titre: 'Version restaurée',
            detail: `${aRestaurer} redevient la version publiée de ${agent?.nom}.`,
          })
          setARestaurer(null)
        }}
        titre="Revenir à une version antérieure"
        ressource={`${agent?.slug ?? ''}@${aRestaurer ?? ''}`}
        libelleAction="Restaurer"
        pertes={[
          'La consigne, le modèle, les hyperparamètres et la liste des outils reviennent à cette version',
          'Les corrections annotées depuis restent actives : elles ne dépendent pas de la version',
          'La version actuelle est archivée, pas supprimée — le retour arrière est réversible',
          'Les conversations en cours terminent sur la version qui les a commencées',
        ]}
      />

      <Callout ton="violet" titre="Où s’arrête l’agent">
        Un agent n’est pas un collègue : il n’a pas de jugement sur ce qu’il ignore. Ce qui le rend
        utilisable en production tient en quatre points visibles sur cette page — un périmètre écrit,
        des outils dont la portée est vérifiée côté API, un jeu d’épreuves qui bloque la publication,
        et une trace qui permet de dire après coup pourquoi il a répondu cela.{' '}
        <Link href="/app/ia/orchestration" className="font-semibold text-p-700 hover:underline">
          Plusieurs agents se coordonnent dans un flux d’orchestration →
        </Link>
      </Callout>
    </div>
  )
}
