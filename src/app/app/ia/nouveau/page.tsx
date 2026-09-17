'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num } from '@/lib/format'
import {
  CLASSE_DONNEES_LABEL,
  TYPE_AGENT_LABEL,
  type AgentIA,
  type ModeleIA,
  type TypeAgent,
} from '@/lib/types'
import { AGENTS_IA, BASES_CONNAISSANCE, CANAUX_AGENT, MODELES_IA, OUTILS_AGENT } from '@/lib/mock'
import { creerRessource, estActif } from '@/lib/api/client'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Checkbox, Field, Input, MonoTextarea, Select, Slider, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { CostPreview, WizardShell } from '@/components/composition/flow'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

const ETAPES = [
  { numero: 1, titre: 'Identité' },
  { numero: 2, titre: 'Modèle & consigne' },
  { numero: 3, titre: 'Outils & connaissances' },
  { numero: 4, titre: 'Garde-fous & publication' },
]

const TYPES: Array<{ value: TypeAgent; resume: string; consequence: string }> = [
  {
    value: 'conversationnel',
    resume: 'Répond à un humain et garde le fil d’une conversation.',
    consequence: 'Mémoire de session, canaux humains, satisfaction mesurée.',
  },
  {
    value: 'tache',
    resume: 'Enchaîne des outils pour accomplir un but, puis rend un résultat.',
    consequence: 'Outils indispensables, validation humaine recommandée.',
  },
  {
    value: 'flux',
    resume: 'Classe ou aiguille selon une liste fermée, sans latitude.',
    consequence: 'Température à zéro, pas de mémoire, erreur mesurable.',
  },
  {
    value: 'extraction',
    resume: 'Reçoit un document et rend un objet structuré.',
    consequence: 'Sortie contrainte par schéma, aucun canal conversationnel.',
  },
]

const CONSIGNE_TYPE: Record<TypeAgent, string> = {
  conversationnel: `Tu es l'assistant de {{organisation}}. Nous sommes le {{date_du_jour}}.
Tu réponds en français, en trois phrases au plus.

Règles :
- Ne réponds qu'à partir des extraits fournis. Si l'information n'y est pas, dis-le.
- N'invente jamais un montant, une date ni un délai.
- Termine par la référence du document cité.`,
  tache: `Tu accomplis la tâche demandée en utilisant les outils mis à ta disposition.

Avant d'agir, énonce ce que tu vas faire. Après avoir agi, dis ce qui a réellement eu lieu.
Si un outil échoue deux fois, arrête-toi et explique ce qui manque.`,
  flux: `Classe l'entrée dans exactement une catégorie parmi la liste fournie.

Rends uniquement : {"categorie": "...", "confiance": 0.0-1.0}
Sous 0,6 de confiance, rends la catégorie par défaut.`,
  extraction: `Tu extrais les données du document et tu rends un objet JSON conforme au schéma.

Aucun texte hors du JSON. Un champ absent vaut null : ne déduis rien.`,
}

export default function NouvelAgent() {
  const router = useRouter()
  const espace = useEspace()
  const { autorise, refus, pousser } = useApp()
  const agentsCol = useCollection<AgentIA>('agents-ia', AGENTS_IA)
  const modelesCol = useCollection<ModeleIA>('modeles-ia', MODELES_IA)

  const [etape, setEtape] = useState(1)
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [type, setType] = useState<TypeAgent>('conversationnel')
  const [consigne, setConsigne] = useState(CONSIGNE_TYPE.conversationnel)
  const [modele, setModele] = useState('synelia/mistral-small-3.2-24b')
  const [temperature, setTemperature] = useState(0.2)
  const [jetonsMax, setJetonsMax] = useState(1_024)
  const [outils, setOutils] = useState<string[]>([])
  const [bases, setBases] = useState<string[]>([])
  const [classe, setClasse] = useState('interne')
  const [budget, setBudget] = useState(12_000)
  const [humain, setHumain] = useState(true)
  const [canaux, setCanaux] = useState<string[]>(['cx-rest'])

  const peutEcrire = autorise('ia.agent.write')
  // En mode API, `modelesCol` sert le vrai catalogue (slugs OpenRouter réels) au
  // lieu de la graine de démonstration — sans quoi le choix par défaut ne
  // correspondrait à aucun modèle connu de la passerelle et `POST /ia/agents`
  // rejetterait la création. `invocable === false` écarte les familles
  // hors périmètre de la passerelle chat (embedding, reranker, transcription).
  const modelesTexte = modelesCol.items.filter(
    (x) => (x.famille === 'texte' || x.famille === 'vision') && x.invocable !== false,
  )
  const m = modelesTexte.find((x) => x.slug === modele)
  const basesEspace = BASES_CONNAISSANCE.filter((b) => b.espaceId === espace.id)
  const outilsEcrivains = outils.filter((id) => OUTILS_AGENT.find((o) => o.id === id)?.effet === 'ecriture')

  // Rattrape le choix par défaut une fois le vrai catalogue chargé (l'état
  // initial part de la graine, affichée le temps du premier aller-retour).
  useEffect(() => {
    if (modelesTexte.length > 0 && !modelesTexte.some((x) => x.slug === modele)) {
      setModele(modelesTexte[0].slug)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelesTexte])

  // Hypothèse de charge affichée avec le devis, pour que le chiffre soit lisible.
  const APPELS_JOUR = 500
  const coutModeleMois = m
    ? Math.round(((APPELS_JOUR * 2_000 * m.prixEntree) / 1_000_000 +
        (APPELS_JOUR * jetonsMax * 0.4 * m.prixSortie) / 1_000_000) * 30)
    : 0
  const coutRecherche = bases.length > 0 ? Math.round(APPELS_JOUR * 30 * 0.38) : 0

  const bascule = (liste: string[], set: (v: string[]) => void, id: string) =>
    set(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id])

  // Le backend réel (`POST /ia/agents`) ne connaît que six champs — nom,
  // consigne, espaceId, modèle, température, jetons au plus. Le reste de
  // cet assistant (outils, connaissances, garde-fous, canaux) n'a pas de
  // contrepartie serveur aujourd'hui : ces choix restent cosmétiques tant que
  // l'agent créé est un agent réel, et n'affectent que le devis affiché ici.
  const creerAgent = () => {
    if (estActif()) {
      creerRessource<AgentIA>('/ia/agents', {
        nom,
        consigne,
        espaceId: espace.id,
        modele,
        temperature,
        jetonsMax,
      }).then(
        () => {
          agentsCol.recharger()
          pousser({
            ton: 'ok',
            titre: 'Agent créé en brouillon',
            detail: `${nom || 'Nouvel agent'} — publiez-le depuis sa fiche quand vous êtes prêt.`,
          })
          router.push('/app/ia/agents')
        },
        (e: unknown) => {
          pousser({
            ton: 'err',
            titre: 'Création impossible',
            detail: e instanceof Error ? e.message : 'La passerelle IA n’a pas répondu.',
          })
        },
      )
      return
    }
    pousser({
      ton: 'ok',
      titre: 'Agent créé en brouillon',
      detail: `${nom || 'Nouvel agent'} — constituez son jeu d’épreuves avant de publier.`,
    })
    router.push('/app/ia/agents')
  }

  const panneau = (
    <>
      <CostPreview
        lignes={[
          {
            libelle: 'Inférence',
            detail: `${num(APPELS_JOUR)} appels par jour · ${m?.nom ?? modele}`,
            montant: coutModeleMois,
          },
          ...(coutRecherche > 0
            ? [
                {
                  libelle: 'Recherche dans les connaissances',
                  detail: `${bases.length} base(s) interrogée(s) à chaque appel`,
                  montant: coutRecherche,
                },
              ]
            : []),
        ]}
      />
      <Card>
        <CardHeader titre="Récapitulatif" />
        <KeyValueList
          colonnes={1}
          items={[
            { cle: 'Nom', valeur: nom || <span className="text-g-500">à renseigner</span> },
            { cle: 'Type', valeur: TYPE_AGENT_LABEL[type] },
            { cle: 'Modèle', valeur: m?.nom ?? modele },
            { cle: 'Résidence', valeur: m?.residence ?? '—' },
            { cle: 'Outils', valeur: outils.length === 0 ? 'Aucun' : `${outils.length} attribué(s)` },
            { cle: 'Connaissances', valeur: bases.length === 0 ? 'Aucune' : `${bases.length} base(s)` },
            { cle: 'Classe de données', valeur: CLASSE_DONNEES_LABEL[classe as keyof typeof CLASSE_DONNEES_LABEL] },
            { cle: 'Budget quotidien', valeur: money(budget) },
          ]}
        />
      </Card>
      <Callout ton="info" titre="Créé en brouillon">
        {estActif()
          ? 'Un agent créé via l’API n’est jamais publié à la création. Sa fiche permet de le publier ensuite d’un clic — mais cette passerelle ne tient pas encore de jeu d’épreuves : rien ne bloque la publication d’un agent qui n’a jamais été testé, contrairement aux agents de démonstration.'
          : 'Un agent n’est jamais publié à la création. Il faut d’abord constituer son jeu d’épreuves et obtenir 80 % de réussite — c’est la plateforme qui bloque la publication en dessous, pas une recommandation.'}
      </Callout>
    </>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Agents', href: '/app/ia/agents' },
          { label: 'Nouvel agent' },
        ]}
        titre="Créer un agent"
        sousTitre="Quatre étapes : les trois premières décrivent ce que l’agent sait faire, la quatrième ce qu’il n’a pas le droit de faire."
      />

      <WizardShell
        etapes={ETAPES}
        courante={etape}
        onChange={setEtape}
        titre={ETAPES[etape - 1].titre}
        panneau={panneau}
        actions={
          <>
            <Button
              variant="secondary"
              iconBefore={<ArrowLeft size={14} />}
              onClick={() => (etape === 1 ? router.push('/app/ia/agents') : setEtape(etape - 1))}
            >
              {etape === 1 ? 'Annuler' : 'Précédent'}
            </Button>
            {etape < 4 ? (
              <Button iconAfter={<ArrowRight size={14} />} onClick={() => setEtape(etape + 1)}>
                Continuer
              </Button>
            ) : (
              <GatedAction autorise={peutEcrire} message={refus('ia.agent.write')}>
                <Button iconBefore={<Check size={14} />} onClick={creerAgent}>
                  Créer en brouillon
                </Button>
              </GatedAction>
            )}
          </>
        }
      >
        {etape === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Identité"
                sousTitre="Le nom apparaît dans les traces, la facture et l’audit. Le rôle est ce que vous relirez dans six mois pour savoir si l’agent fait toujours ce pour quoi il a été créé."
              />
              <div className="space-y-4">
                <Field label="Nom" required hint="Lisible par un humain, pas un identifiant">
                  <Input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Assistant de facturation"
                  />
                </Field>
                <Field
                  label="Rôle métier"
                  required
                  hint="Une phrase : ce qu’il fait, et ce qu’il fait quand il ne sait pas"
                >
                  <Input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Répondre aux questions de facturation à partir des procédures, et ouvrir un ticket sinon"
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Nature de l’agent"
                sousTitre="Ce choix conditionne le reste de l’assistant : un extracteur n’a ni mémoire ni canal humain."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setType(t.value)
                      setConsigne(CONSIGNE_TYPE[t.value])
                      if (t.value === 'flux' || t.value === 'extraction') setTemperature(0)
                    }}
                    className={cn(
                      'rounded-[8px] border-2 p-3.5 text-left transition-colors',
                      type === t.value ? 'border-p-700 bg-p-050' : 'border-g-300 hover:border-p-400',
                    )}
                  >
                    <span className="block text-[13px] font-bold text-ink">
                      {TYPE_AGENT_LABEL[t.value]}
                    </span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-g-500">
                      {t.resume}
                    </span>
                    <span className="mt-2 block border-t border-g-100 pt-2 text-[12px] text-g-700">
                      {t.consequence}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {etape === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Modèle"
                sousTitre="Le tarif et la résidence comptent autant que la qualité. Un modèle souverain traite toutes les classes de données ; un modèle externe en refuse certaines."
              />
              <div className="space-y-2">
                {modelesTexte.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setModele(x.slug)}
                    className={cn(
                      'flex w-full flex-wrap items-center justify-between gap-3 rounded-[6px] border-2 px-3 py-2.5 text-left transition-colors',
                      modele === x.slug ? 'border-p-700 bg-p-050' : 'border-g-300 hover:border-p-400',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {x.nom}
                      </span>
                      <span className="block truncate text-[11px] text-g-500">{x.residence}</span>
                      {/* Le catalogue porte la vérité sur ce qui répond réellement aujourd'hui
                          (ex. le garde-fou OpenRouter du 2026-09-07) dans sa description — pas de
                          badge « vérifié » figé côté interface, qui se périmerait en silence dès
                          que le garde-fou serait corrigé côté fournisseur. */}
                      {x.description && (
                        <span className="mt-0.5 block truncate text-[11px] text-g-500">
                          {x.description}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tnum text-[12px] text-g-500">
                        {money(x.prixEntree)} / {money(x.prixSortie)}
                      </span>
                      <Badge tone={x.hebergement === 'souverain' ? 'ok' : 'warn'} size="sm">
                        {x.hebergement === 'souverain' ? 'Territoire' : 'Hors territoire'}
                      </Badge>
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Consigne"
                sousTitre="Un canevas adapté à la nature choisie. Écrivez ce que l’agent doit refuser autant que ce qu’il doit faire."
              />
              <MonoTextarea
                rows={12}
                value={consigne}
                onChange={(e) => setConsigne(e.target.value)}
              />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Slider
                  label="Température"
                  value={temperature}
                  onChange={setTemperature}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <Slider
                  label="Jetons générés au plus"
                  value={jetonsMax}
                  onChange={setJetonsMax}
                  min={128}
                  max={8_192}
                  step={128}
                  unite="jetons"
                />
              </div>
              {temperature > 0.5 && (
                <Callout ton="warn" className="mt-4" titre="Au-dessus de 0,5, l’agent varie">
                  Deux fois la même question donnera deux réponses différentes. Acceptable pour de la
                  rédaction, coûteux partout où une réponse doit être vérifiable — et rédhibitoire
                  pour un classifieur ou un extracteur.
                </Callout>
              )}
            </Card>
          </div>
        )}

        {etape === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Outils"
                sousTitre="Cochez le strict nécessaire. Un outil de plus, c’est une surface d’erreur de plus et une décision de plus à prendre par le modèle."
              />
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-[6px] border border-g-300 p-3">
                {OUTILS_AGENT.filter((o) => o.statut !== 'inactif').map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-start justify-between gap-2 border-b border-g-100 pb-2 last:border-0 last:pb-0"
                  >
                    <Checkbox
                      checked={outils.includes(o.id)}
                      onChange={() => bascule(outils, setOutils, o.id)}
                      label={<span className="font-mono text-[13px]">{o.nom}</span>}
                      description={o.description}
                      className="min-w-0 flex-1"
                    />
                    <span className="flex shrink-0 gap-1.5">
                      <Badge tone={o.effet === 'ecriture' ? 'warn' : 'neutral'} size="sm">
                        {o.effet === 'ecriture' ? 'Écrit' : 'Lit'}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
              {outilsEcrivains.length > 0 && (
                <Callout ton="warn" className="mt-4" titre={`${outilsEcrivains.length} outil(s) qui modifient quelque chose`}>
                  Un agent qui écrit engage votre organisation. La confirmation humaine reste active
                  par défaut sur ces outils : la retirer se décide outil par outil, en connaissance
                  de ce qu’une boucle mal écrite peut produire en une nuit.
                </Callout>
              )}
            </Card>

            <Card>
              <CardHeader
                titre="Bases de connaissances"
                sousTitre="Sans base, l’agent répond avec ce que le modèle a appris — donc jamais avec vos procédures."
              />
              {basesEspace.length === 0 ? (
                <p className="text-[13px] text-g-500">
                  Aucune base sur cet espace. L’agent pourra être créé, mais il ne citera rien.
                </p>
              ) : (
                <div className="space-y-2">
                  {basesEspace.map((b) => (
                    <Checkbox
                      key={b.id}
                      checked={bases.includes(b.id)}
                      onChange={() => bascule(bases, setBases, b.id)}
                      label={<span className="font-mono text-[13px]">{b.nom}</span>}
                      description={`${num(b.documents)} documents · ${b.source.libelle}`}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {etape === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Garde-fous"
                sousTitre="Ce qui borne l’agent même si sa consigne est détournée. C’est la seule partie de cet assistant qui tient sous la pression."
              />
              <div className="space-y-4">
                <Field
                  label="Classe de données maximale"
                  hint="Décide où la requête a le droit d’être traitée, et ce que le journal conserve"
                >
                  <Select value={classe} onChange={(e) => setClasse(e.target.value)}>
                    <option value="publique">Publique — sortie de territoire autorisée</option>
                    <option value="interne">Interne — sortie vers l’Union européenne</option>
                    <option value="personnelle">À caractère personnel — territoire uniquement</option>
                    <option value="reglementee">Réglementée — territoire, trace conservée cinq ans</option>
                  </Select>
                </Field>
                {m?.hebergement === 'externe' && (classe === 'personnelle' || classe === 'reglementee') && (
                  <Callout ton="err" titre="Combinaison refusée à l’exécution">
                    Le modèle choisi est hébergé hors de Côte d’Ivoire, et cette classe de données ne
                    peut pas quitter le territoire. La politique de résidence rejettera les appels :
                    changez de modèle, ou abaissez la classe si les données le permettent réellement.
                  </Callout>
                )}
                <Slider
                  label="Budget quotidien"
                  value={budget}
                  onChange={setBudget}
                  min={1_000}
                  max={100_000}
                  step={1_000}
                  unite="FCFA"
                />
                <Switch
                  checked={humain}
                  onChange={setHumain}
                  label="Validation humaine avant action engageante"
                  description="Le traitement se met en pause et attend une personne. Sans cela, un agent outillé agit à la vitesse d’une boucle."
                />
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Canaux à préparer"
                sousTitre="Rien ne s’ouvre à la création : ces choix sont enregistrés et prendront effet à la publication."
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CANAUX_AGENT.filter((c) => c.etat !== 'indisponible').map((c) => (
                  <Checkbox
                    key={c.id}
                    checked={canaux.includes(c.id)}
                    onChange={() => bascule(canaux, setCanaux, c.id)}
                    label={c.nom}
                    description={c.etat === 'connecte' ? 'Prêt' : 'Reste à configurer'}
                  />
                ))}
              </div>
              <div className="mt-4 border-t border-g-100 pt-4">
                <MicroLabel className="mb-2">Ce qui se passe après la création</MicroLabel>
                <ol className="space-y-1.5 text-[13px] text-g-700">
                  {[
                    'L’agent est créé en brouillon, sans aucun canal ouvert',
                    'Vous constituez son jeu d’épreuves : une question, une réponse attendue',
                    'Les épreuves sont rejouées ; sous 80 % de réussite, la publication reste bloquée',
                    'À la publication, la bascule se fait sur 10 % du trafic pendant trente minutes',
                  ].map((x, i) => (
                    <li key={x} className="flex items-start gap-2">
                      <span className="tnum mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-p-100 text-[11px] font-bold text-p-700">
                        {i + 1}
                      </span>
                      {x}
                    </li>
                  ))}
                </ol>
              </div>
            </Card>
          </div>
        )}
      </WizardShell>
    </div>
  )
}
