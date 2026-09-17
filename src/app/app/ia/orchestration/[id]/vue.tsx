'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  BookOpen,
  Code2,
  GitBranch,
  EyeOff,
  Lock,
  Maximize2,
  Minus,
  PhoneForwarded,
  Plus,
  Repeat,
  Send,
  Trash2,
  UserCheck,
  Wrench,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num, pct } from '@/lib/format'
import {
  TYPE_ETAPE_LABEL,
  type EtapeFlux,
  type FluxOrchestration,
  type LigneLog,
  type TypeEtape,
} from '@/lib/types'
import { AGENTS_IA, FLUX_ORCHESTRATION, OUTILS_AGENT, PIECES_FLUX } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { CodeBlock, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Slider, Switch } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { LogPeek } from '@/components/business/observabilite'
import { creerRessource, estActif } from '@/lib/api/client'
import { useOperation } from '@/components/app/actions'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'

const ONGLETS = [
  { id: 'studio', label: 'Studio' },
  { id: 'executions', label: 'Exécutions' },
  { id: 'reglages', label: 'Réglages' },
]

/** Largeur d'une carte d'étape : la colonne et les barres de branche s'y calent. */
const CARTE = 260
const DEMI = CARTE / 2

const STYLE: Record<TypeEtape, { icone: React.ReactNode; pastille: string }> = {
  declencheur: { icone: <Zap size={14} />, pastille: 'bg-p-900 text-white' },
  agent: { icone: <Bot size={14} />, pastille: 'bg-p-100 text-p-700' },
  outil: { icone: <Wrench size={14} />, pastille: 'bg-info-bg text-info' },
  connaissance: { icone: <BookOpen size={14} />, pastille: 'bg-ok-bg text-ok' },
  routeur: { icone: <GitBranch size={14} />, pastille: 'bg-warn-bg text-warn' },
  boucle: { icone: <Repeat size={14} />, pastille: 'bg-warn-bg text-warn' },
  humain: { icone: <UserCheck size={14} />, pastille: 'bg-p-050 text-p-700' },
  code: { icone: <Code2 size={14} />, pastille: 'bg-g-100 text-g-700' },
  reponse: { icone: <Send size={14} />, pastille: 'bg-g-100 text-g-700' },
  anonymisation: { icone: <EyeOff size={14} />, pastille: 'bg-p-700 text-white' },
  habilitation: { icone: <Lock size={14} />, pastille: 'bg-p-700 text-white' },
  transfert: { icone: <PhoneForwarded size={14} />, pastille: 'bg-g-100 text-g-700' },
}

const JOURNAL_FLUX: LigneLog[] = [
  { ts: '2026-08-19T15:14:15Z', niveau: 'INFO', source: 'exec-8841f2', message: 'WhatsApp · facturation · 12,8 s · 8 420 jetons · 46 F · succès' },
  { ts: '2026-08-19T15:13:58Z', niveau: 'INFO', source: 'presidio', message: '3 entités masquées — téléphone, référence client, IBAN · avant appel modèle' },
  { ts: '2026-08-19T15:11:48Z', niveau: 'INFO', source: 'exec-8841e9', message: 'SMS · technique · 9,2 s · 6 180 jetons · 38 F · succès' },
  { ts: '2026-08-19T15:10:22Z', niveau: 'INFO', source: 'habilitation', message: 'Portée « équipe support » · 2 bases sur 5 écartées avant calcul de similarité' },
  { ts: '2026-08-19T15:08:02Z', niveau: 'WARN', source: 'exec-8841d4', message: 'Dossier client en délai dépassé — reprise 1/2 réussie · 15,4 s' },
  { ts: '2026-08-19T15:04:37Z', niveau: 'INFO', source: 'exec-8841c1', message: 'Widget · facturation · 11,1 s · succès' },
  { ts: '2026-08-19T14:59:20Z', niveau: 'ERROR', source: 'exec-8841b8', message: 'Journaux de supervision indisponibles après 2 reprises — branche technique abandonnée' },
  { ts: '2026-08-19T14:56:44Z', niveau: 'INFO', source: 'exec-8841a2', message: 'WhatsApp · technique · 18,7 s · succès' },
  { ts: '2026-08-19T14:52:10Z', niveau: 'WARN', source: 'exec-88419e', message: 'En attente de validation humaine depuis 6 min · enjeu 124 365 F' },
  { ts: '2026-08-19T14:48:33Z', niveau: 'WARN', source: 'exec-884188', message: 'Triage sous le seuil de confiance (0,54) — branche par défaut' },
  { ts: '2026-08-19T14:44:07Z', niveau: 'INFO', source: 'exec-884171', message: 'SMS · facturation · 8,4 s · succès' },
  { ts: '2026-08-19T14:40:52Z', niveau: 'INFO', source: 'exec-884160', message: 'Widget · technique · 21,3 s · succès' },
]

// ─── Manipulation de l'arbre ──────────────────────────────────────────

/** Applique `fn` à la liste d'étapes désignée par `listeId`, sans muter l'arbre. */
function majListe(
  etapes: EtapeFlux[],
  listeId: string,
  cible: string,
  fn: (l: EtapeFlux[]) => EtapeFlux[],
): EtapeFlux[] {
  if (listeId === cible) return fn(etapes)
  return etapes.map((e) => ({
    ...e,
    branches: e.branches?.map((b) => ({
      ...b,
      etapes: majListe(b.etapes, `branche:${b.id}`, cible, fn),
    })),
    corps: e.corps ? majListe(e.corps, `boucle:${e.id}`, cible, fn) : undefined,
  }))
}

function toutesLesEtapes(etapes: EtapeFlux[]): EtapeFlux[] {
  return etapes.flatMap((e) => [
    e,
    ...(e.branches?.flatMap((b) => toutesLesEtapes(b.etapes)) ?? []),
    ...(e.corps ? toutesLesEtapes(e.corps) : []),
  ])
}

// ─── Pièces du canevas ────────────────────────────────────────────────

function Ligne({ hauteur, extensible }: { hauteur?: number; extensible?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('w-px shrink-0 bg-g-300', extensible && 'flex-1')}
      style={hauteur ? { height: hauteur } : undefined}
    />
  )
}

/**
 * Point d'insertion entre deux étapes : bouton d'ajout et cible de dépôt.
 * Déposer une étape ailleurs que sur un de ces points ne fait rien — c'est ce
 * qui évite d'inventer une position au jugé.
 */
function PointInsertion({
  actif,
  survol,
  onAjouter,
  onSurvol,
  onDeposer,
}: {
  actif: boolean
  survol: boolean
  onAjouter: () => void
  onSurvol: (v: boolean) => void
  onDeposer: () => void
}) {
  return (
    <span
      className="flex flex-col items-center"
      onDragOver={(e) => {
        if (!actif) return
        e.preventDefault()
        onSurvol(true)
      }}
      onDragLeave={() => onSurvol(false)}
      onDrop={(e) => {
        e.preventDefault()
        onSurvol(false)
        onDeposer()
      }}
    >
      <Ligne hauteur={10} />
      <button
        type="button"
        onClick={onAjouter}
        aria-label="Insérer une étape ici"
        title="Insérer une étape ici"
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
          survol
            ? 'border-p-700 bg-p-700 text-white'
            : actif
              ? 'border-dashed border-p-400 bg-white text-p-700'
              : 'border-g-300 bg-white text-g-500 hover:border-p-400 hover:text-p-700',
        )}
      >
        <Plus size={12} />
      </button>
      <Ligne hauteur={10} />
    </span>
  )
}

function CarteEtape({
  etape,
  selectionnee,
  glissee,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  etape: EtapeFlux
  selectionnee: boolean
  glissee: boolean
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const st = STYLE[etape.type]
  return (
    <button
      type="button"
      draggable={!etape.verrouillee}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      style={{ width: CARTE }}
      title={etape.verrouillee ? 'Étape posée par la plateforme : ni déplaçable, ni supprimable' : undefined}
      className={cn(
        'flex items-start gap-2.5 rounded-[8px] border-2 px-3 py-2.5 text-left transition-all',
        etape.verrouillee
          ? 'cursor-default border-p-400 bg-p-050'
          : 'cursor-grab bg-white active:cursor-grabbing',
        selectionnee
          ? 'border-p-700 shadow-[0_0_0_3px_rgba(75,40,130,.18)]'
          : etape.verrouillee
            ? 'border-p-400'
            : 'border-g-300 hover:border-p-400',
        glissee && 'opacity-40',
      )}
    >
      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]', st.pastille)}>
        {st.icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="type-micro truncate text-g-500">{TYPE_ETAPE_LABEL[etape.type]}</span>
          {etape.reprise && etape.reprise.tentatives > 1 && (
            <span className="tnum shrink-0 text-[11px] font-bold text-warn">
              ×{etape.reprise.tentatives}
            </span>
          )}
          {etape.condition && (
            <span className="type-micro shrink-0 text-p-700">conditionnelle</span>
          )}
          {etape.verrouillee && (
            <span className="ml-auto shrink-0 text-p-700" title="Non contournable">
              <Lock size={11} aria-hidden />
            </span>
          )}
        </span>
        <span className="block truncate text-[13px] font-bold text-ink">{etape.nom}</span>
        <span className="block truncate text-[11px] text-g-500">{etape.source}</span>
      </span>
    </button>
  )
}

function Colonne({
  etapes,
  listeId,
  ctx,
}: {
  etapes: EtapeFlux[]
  listeId: string
  ctx: {
    selection: string
    glisse: { id: string; listeId: string } | null
    survol: string
    setSurvol: (v: string) => void
    onSelect: (id: string) => void
    onDragStart: (id: string, listeId: string) => void
    onDragEnd: () => void
    onDeposer: (listeId: string, index: number) => void
    onAjouter: (listeId: string, index: number) => void
  }
}) {
  const cle = (i: number) => `${listeId}#${i}`
  return (
    <div className="flex flex-col items-center">
      {etapes.map((e, i) => (
        <div key={e.id} className="flex flex-col items-center">
          <PointInsertion
            actif={ctx.glisse !== null}
            survol={ctx.survol === cle(i)}
            onAjouter={() => ctx.onAjouter(listeId, i)}
            onSurvol={(v) => ctx.setSurvol(v ? cle(i) : '')}
            onDeposer={() => ctx.onDeposer(listeId, i)}
          />
          <CarteEtape
            etape={e}
            selectionnee={ctx.selection === e.id}
            glissee={ctx.glisse?.id === e.id}
            onSelect={() => ctx.onSelect(e.id)}
            onDragStart={() => ctx.onDragStart(e.id, listeId)}
            onDragEnd={ctx.onDragEnd}
          />

          {e.branches && e.branches.length > 0 && (
            <>
              <Ligne hauteur={18} />
              <div className="relative flex items-stretch gap-8">
                <span
                  aria-hidden
                  className="absolute top-0 h-px bg-g-300"
                  style={{ left: DEMI, right: DEMI }}
                />
                <span
                  aria-hidden
                  className="absolute bottom-0 h-px bg-g-300"
                  style={{ left: DEMI, right: DEMI }}
                />
                {e.branches.map((b) => (
                  <div key={b.id} className="flex flex-col items-center" style={{ width: CARTE }}>
                    <Ligne hauteur={16} />
                    <span
                      className={cn(
                        'max-w-full rounded-full border px-2.5 py-1 text-center',
                        b.parDefaut ? 'border-g-300 bg-g-050' : 'border-warn/40',
                      )}
                    >
                      <span className="block truncate text-[12px] font-bold text-ink">
                        {b.nom} · {pct(b.partPct)}
                      </span>
                      <span className="block truncate text-[11px] text-g-500">{b.condition}</span>
                    </span>
                    <Colonne etapes={b.etapes} listeId={`branche:${b.id}`} ctx={ctx} />
                    <Ligne extensible />
                  </div>
                ))}
              </div>
              <Ligne hauteur={18} />
            </>
          )}

          {e.corps && (
            <>
              <Ligne hauteur={14} />
              <div
                className="rounded-[10px] border border-dashed border-warn/50 bg-warn-bg/40 px-4 py-3"
                style={{ width: CARTE + 48 }}
              >
                <p className="type-micro mb-1 text-warn">
                  Corps de la boucle · {e.maxIterations} itérations au plus
                </p>
                <Colonne etapes={e.corps} listeId={`boucle:${e.id}`} ctx={ctx} />
                <p className="type-micro mt-2 text-center text-warn">↻ retour au début</p>
              </div>
              <Ligne hauteur={14} />
            </>
          )}
        </div>
      ))}
      <PointInsertion
        actif={ctx.glisse !== null}
        survol={ctx.survol === cle(etapes.length)}
        onAjouter={() => ctx.onAjouter(listeId, etapes.length)}
        onSurvol={(v) => ctx.setSurvol(v ? cle(etapes.length) : '')}
        onDeposer={() => ctx.onDeposer(listeId, etapes.length)}
      />
    </div>
  )
}

// ─── Constructeur ─────────────────────────────────────────────────────

function Constructeur({
  flux,
  selection,
  onSelect,
  etapes,
  setEtapes,
  onMessage,
}: {
  flux: FluxOrchestration
  selection: string
  onSelect: (id: string) => void
  etapes: EtapeFlux[]
  setEtapes: (e: EtapeFlux[]) => void
  onMessage: (titre: string, detail: string, ton: 'ok' | 'warn') => void
}) {
  const [glisse, setGlisse] = useState<{ id: string; listeId: string } | null>(null)
  const [survol, setSurvol] = useState('')
  const [echelle, setEchelle] = useState(1)
  const [ajout, setAjout] = useState<{ listeId: string; index: number } | null>(null)
  const zone = useRef<HTMLDivElement>(null)

  // Le graphe est centré sur sa branche la plus large : sur un écran étroit, la
  // position de défilement à zéro tombe donc à côté du flux. On recentre.
  useEffect(() => {
    const el = zone.current
    if (!el) return
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
  }, [])

  const deposer = (listeId: string, index: number) => {
    if (!glisse) return
    const verrouillee = toutesLesEtapes(etapes).find((e) => e.id === glisse.id)?.verrouillee
    if (verrouillee) {
      onMessage(
        'Étape non déplaçable',
        'L’anonymisation et le filtrage par habilitation sont posés par la plateforme, à un endroit qui ne se négocie pas.',
        'warn',
      )
      setGlisse(null)
      return
    }
    if (glisse.listeId !== listeId) {
      onMessage(
        'Déplacement refusé',
        'Une étape ne se déplace que dans sa propre branche. Pour la changer de branche, supprimez-la et réinsérez-la.',
        'warn',
      )
      setGlisse(null)
      return
    }
    const suivant = majListe(etapes, 'racine', listeId, (l) => {
      const depuis = l.findIndex((x) => x.id === glisse.id)
      if (depuis === -1) return l
      const copie = [...l]
      const [item] = copie.splice(depuis, 1)
      copie.splice(depuis < index ? index - 1 : index, 0, item)
      return copie
    })
    setEtapes(suivant)
    setGlisse(null)
  }

  const inserer = (type: TypeEtape, nom: string, detail: string) => {
    if (!ajout) return
    const nouvelle: EtapeFlux = {
      id: `neuf-${type}-${ajout.index}-${ajout.listeId}`,
      type,
      nom,
      source: 'À configurer',
      detail,
      executions24h: 0,
      latenceMs: 0,
      coutPourMille: 0,
      tauxErreurPct: 0,
      ...(type === 'routeur'
        ? {
            modeRoutage: 'premiere' as const,
            branches: [
              { id: `br-a-${ajout.index}`, nom: 'Branche 1', condition: 'À définir', partPct: 0, etapes: [] },
              { id: `br-b-${ajout.index}`, nom: 'Repli', condition: 'Aucune des conditions précédentes', partPct: 0, parDefaut: true, etapes: [] },
            ],
          }
        : {}),
      ...(type === 'boucle' ? { corps: [], maxIterations: 20, surItems: 'À définir' } : {}),
    }
    const suivant = majListe(etapes, 'racine', ajout.listeId, (l) => {
      const copie = [...l]
      copie.splice(ajout.index, 0, nouvelle)
      return copie
    })
    setEtapes(suivant)
    onSelect(nouvelle.id)
    setAjout(null)
  }

  const st = STYLE.declencheur

  return (
    <div className="rounded-[10px] border border-g-300 bg-g-050">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-g-300 px-3 py-2">
        <span className="flex items-center gap-2">
          <MicroLabel>Canevas</MicroLabel>
          <span className="text-[12px] text-g-500">
            Glissez une carte sur un bouton <span className="font-bold">+</span> pour la déplacer ·
            les étapes marquées d’un cadenas sont posées par la plateforme
          </span>
        </span>
        <span className="flex items-center gap-1">
          <IconButton
            label="Réduire le canevas"
            size="sm"
            variant="ghost"
            onClick={() => setEchelle((e) => Math.max(0.6, Math.round((e - 0.1) * 10) / 10))}
          >
            <Minus size={13} />
          </IconButton>
          <span className="tnum w-10 text-center text-[12px] text-g-500">
            {Math.round(echelle * 100)} %
          </span>
          <IconButton
            label="Agrandir le canevas"
            size="sm"
            variant="ghost"
            onClick={() => setEchelle((e) => Math.min(1.2, Math.round((e + 0.1) * 10) / 10))}
          >
            <Plus size={13} />
          </IconButton>
          <IconButton label="Revenir à 100 %" size="sm" variant="ghost" onClick={() => setEchelle(1)}>
            <Maximize2 size={13} />
          </IconButton>
        </span>
      </div>

      <div ref={zone} className="overflow-x-auto p-5">
        <div
          className="mx-auto flex w-max flex-col items-center"
          style={{ transform: `scale(${echelle})`, transformOrigin: 'top center' }}
        >
          <div
            style={{ width: CARTE }}
            className="rounded-[8px] border-2 border-p-900 bg-p-900 px-3 py-2.5 text-left"
          >
            <span className="flex items-start gap-2.5">
              <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]', st.pastille)}>
                {st.icone}
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-micro block text-p-300">Déclencheur</span>
                <span className="block truncate text-[13px] font-bold text-white">
                  {flux.declencheur.libelle}
                </span>
                <span className="block truncate text-[11px] text-p-300">
                  {flux.declencheur.detail}
                </span>
              </span>
            </span>
          </div>

          <Colonne
            etapes={etapes}
            listeId="racine"
            ctx={{
              selection,
              glisse,
              survol,
              setSurvol,
              onSelect,
              onDragStart: (id, listeId) => setGlisse({ id, listeId }),
              onDragEnd: () => setGlisse(null),
              onDeposer: deposer,
              onAjouter: (listeId, index) => setAjout({ listeId, index }),
            }}
          />

          <span className="rounded-full border border-g-300 bg-white px-3 py-1 text-[11px] font-semibold text-g-500">
            Fin du flux
          </span>
        </div>
      </div>

      <Modal
        open={ajout !== null}
        onClose={() => setAjout(null)}
        title="Insérer une étape"
        description="Une étape insérée arrive en brouillon, sans configuration. Le flux ne se republie qu’une fois toutes ses étapes valides."
        size="lg"
      >
        <div className="space-y-4">
          {PIECES_FLUX.map((groupe) => (
            <div key={groupe.categorie}>
              <MicroLabel className="mb-2">{groupe.categorie}</MicroLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {groupe.entrees.map((p) => (
                  <button
                    key={p.nom}
                    type="button"
                    onClick={() => inserer(p.type, p.nom, p.detail)}
                    className="rounded-[8px] border-2 border-g-300 p-3 text-left transition-colors hover:border-p-400"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-[5px]',
                          STYLE[p.type].pastille,
                        )}
                      >
                        {STYLE[p.type].icone}
                      </span>
                      <span className="text-[13px] font-bold text-ink">{p.nom}</span>
                    </span>
                    <span className="mt-1.5 block text-[12px] leading-relaxed text-g-500">
                      {p.detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ─── Panneau de configuration ─────────────────────────────────────────

function PanneauEtape({
  etape,
  peutEcrire,
  refus,
  onSupprimer,
}: {
  etape: EtapeFlux
  peutEcrire: boolean
  refus: string
  onSupprimer: () => void
}) {
  return (
    <Card>
      <CardHeader
        titre={etape.nom}
        sousTitre={TYPE_ETAPE_LABEL[etape.type]}
        actions={
          <GatedAction
            autorise={peutEcrire && !etape.verrouillee}
            message={
              etape.verrouillee
                ? 'Étape posée par la plateforme : elle ne se supprime pas.'
                : refus
            }
          >
            <IconButton
              label={`Supprimer l’étape ${etape.nom}`}
              size="sm"
              variant="ghost"
              onClick={onSupprimer}
            >
              <Trash2 size={13} />
            </IconButton>
          </GatedAction>
        }
      />
      <div className="space-y-4">
        {etape.verrouillee && (
          <Callout
            ton="violet"
            titre={
              etape.type === 'anonymisation'
                ? 'Anonymisation en coupure'
                : 'Filtre appliqué avant la recherche'
            }
          >
            {etape.type === 'anonymisation'
              ? 'Le masquage est réversible et s’applique à cent pour cent des flux, voix comprise, avant tout appel modèle. Aucune donnée personnelle en clair ne part au modèle, ni n’est écrite dans la trace.'
              : 'La portée documentaire est dérivée de l’utilisateur final, jamais de l’agent, et le filtre est appliqué avant le calcul de similarité — pas après. Filtrer après aurait déjà exposé les fragments interdits au modèle.'}
            {' '}Cette étape ne se déplace pas et ne se supprime pas : l’étanchéité ne peut pas
            dépendre d’un réglage.
          </Callout>
        )}
        <Field label="Nom affiché">
          <Input defaultValue={etape.nom} key={`${etape.id}-nom`} disabled={!peutEcrire} />
        </Field>
        <Field label="Identifiant" hint="Sert à référencer la sortie de cette étape">
          <Input defaultValue={etape.id} key={`${etape.id}-id`} disabled className="font-mono" />
        </Field>

        {etape.type === 'agent' && (
          <Field label="Agent ou modèle appelé">
            <Select defaultValue={etape.agentId ?? 'modele'} key={`${etape.id}-ag`} disabled={!peutEcrire}>
              {AGENTS_IA.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
              <option value="modele">Appel de modèle sans agent</option>
            </Select>
          </Field>
        )}

        {etape.type === 'outil' &&
          (etape.outilId ? (
            <Field label="Outil appelé">
              <Select defaultValue={etape.outilId} key={`${etape.id}-ou`} disabled={!peutEcrire}>
                {OUTILS_AGENT.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nom} — {o.fournisseur}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field
              label="Composant appelé"
              hint="Brique de la plateforme, pas un outil déclaré au catalogue"
            >
              <Input defaultValue={etape.source} key={`${etape.id}-src`} disabled />
            </Field>
          ))}

        {etape.type === 'routeur' && (
          <>
            <Field label="Mode d’évaluation">
              <Select
                defaultValue={etape.modeRoutage ?? 'premiere'}
                key={`${etape.id}-mode`}
                disabled={!peutEcrire}
              >
                <option value="premiere">Première branche vraie — comportement si/sinon</option>
                <option value="toutes">Toutes les branches vraies — exécution parallèle</option>
              </Select>
            </Field>
            <div>
              <MicroLabel className="mb-2">Branches</MicroLabel>
              <div className="space-y-1.5">
                {etape.branches?.map((b) => (
                  <div key={b.id} className="rounded-[6px] border border-g-300 px-2.5 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-ink">{b.nom}</span>
                      <Badge tone={b.parDefaut ? 'neutral' : 'warn'} size="sm">
                        {b.parDefaut ? 'Repli' : pct(b.partPct)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-g-500">{b.condition}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {etape.type === 'boucle' && (
          <>
            <Field label="Liste parcourue" hint="Référence la sortie d’une étape précédente">
              <Input defaultValue={etape.surItems} key={`${etape.id}-it`} disabled={!peutEcrire} className="font-mono" />
            </Field>
            <Slider
              label="Itérations au plus"
              value={etape.maxIterations ?? 20}
              onChange={() => undefined}
              min={1}
              max={200}
              step={1}
            />
          </>
        )}

        {etape.type === 'humain' && (
          <Field label="Délai avant bascule en file humaine classique">
            <Select defaultValue="4" key={`${etape.id}-del`} disabled={!peutEcrire}>
              <option value="1">1 heure</option>
              <option value="4">4 heures</option>
              <option value="24">24 heures</option>
            </Select>
          </Field>
        )}

        {etape.condition && (
          <Field label="Condition d’exécution" hint="L’étape est sautée si la condition est fausse">
            <Input defaultValue={etape.condition} key={`${etape.id}-cond`} disabled={!peutEcrire} className="font-mono" />
          </Field>
        )}

        <div className="border-t border-g-100 pt-4">
          <MicroLabel className="mb-2.5">Reprise sur erreur</MicroLabel>
          <div className="space-y-3.5">
            <Slider
              label="Tentatives"
              value={etape.reprise?.tentatives ?? 1}
              onChange={() => undefined}
              min={0}
              max={5}
            />
            <Field label="Après épuisement des tentatives">
              <Select defaultValue="poursuivre" key={`${etape.id}-fail`} disabled={!peutEcrire}>
                <option value="poursuivre">Poursuivre sans cette étape, en le signalant</option>
                <option value="humain">Basculer vers un traitement humain</option>
                <option value="echouer">Échouer et rendre une erreur</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="border-t border-g-100 pt-4">
          <MicroLabel className="mb-2.5">Mesuré sur cette étape</MicroLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <span className="block">
              <span className="type-micro block text-g-500">Exécutions 24 h</span>
              <span className="tnum block text-[13px] font-bold text-ink">
                {num(etape.executions24h)}
              </span>
            </span>
            <span className="block">
              <span className="type-micro block text-g-500">Latence médiane</span>
              <span className="tnum block text-[13px] font-bold text-ink">
                {etape.latenceMs === 0
                  ? '—'
                  : etape.latenceMs > 10_000
                    ? `${Math.round(etape.latenceMs / 1000)} s`
                    : `${num(etape.latenceMs)} ms`}
              </span>
            </span>
            <span className="block">
              <span className="type-micro block text-g-500">Coût / 1 000</span>
              <span className="tnum block text-[13px] font-bold text-ink">
                {etape.coutPourMille === 0 ? '—' : money(etape.coutPourMille)}
              </span>
            </span>
            <span className="block">
              <span className="type-micro block text-g-500">Taux d’erreur</span>
              <span
                className={cn(
                  'tnum block text-[13px] font-bold',
                  etape.tauxErreurPct > 5 ? 'text-err' : 'text-ink',
                )}
              >
                {etape.tauxErreurPct === 0 ? '—' : pct(etape.tauxErreurPct, 1)}
              </span>
            </span>
          </div>
        </div>

        {etape.tauxErreurPct > 5 && (
          <Callout ton="warn" titre="Maillon faible">
            Le taux de succès du flux entier ne dépassera pas ce que cette étape autorise. La reprise
            en rattrape une partie, jamais tout.
          </Callout>
        )}
      </div>
    </Card>
  )
}

// ─── Écran ────────────────────────────────────────────────────────────

export function VueFlux({ fluxId }: { fluxId: string }) {
  const espace = useEspace()
  const { autorise, refus, pousser } = useApp()
  const executerOperation = useOperation()
  const [onglet, setOnglet] = useState('studio')
  const [entreeTest, setEntreeTest] = useState('')

  const fluxCol = useCollection<FluxOrchestration>('flux-ia', FLUX_ORCHESTRATION)
  // Voir `page.tsx` de la section : le backend ne rattache pas encore un flux
  // à un Espace Cloud à la création, donc pas de filtre par Espace en mode API.
  const flux = fluxCol.items.filter((f) => (estActif() ? true : f.espaceId === espace.id))
  const trouve = flux.find((f) => f.id === fluxId)
  // Un flux réel (exécuteur natif, FONC-02) ne porte pas encore de métriques
  // agrégées : le backend les laisse `null`, absentes du JSON. Ramenées à 0
  // ici, les affichages `> 0 ? … : '—'` déjà en place plus bas font le reste.
  const courant = trouve
    ? {
        ...trouve,
        executions7j: trouve.executions7j ?? 0,
        dureeMedianeS: trouve.dureeMedianeS ?? 0,
        tauxSuccesPct: trouve.tauxSuccesPct ?? 0,
        coutParExecution: trouve.coutParExecution ?? 0,
      }
    : undefined
  const [arbres, setArbres] = useState<Record<string, EtapeFlux[]>>({})
  const etapes = arbres[courant?.id ?? ''] ?? courant?.etapes ?? []
  const [selection, setSelection] = useState(courant?.etapes[0]?.id ?? '')

  const peutEcrire = autorise('ia.flow.write')
  const toutes = toutesLesEtapes(etapes)
  const etape = toutes.find((e) => e.id === selection) ?? toutes[0]
  const plusLente = [...toutes].sort((a, b) => b.latenceMs - a.latenceMs)[0]
  const plusFragile = [...toutes].sort((a, b) => b.tauxErreurPct - a.tauxErreurPct)[0]

  const enregistrer = (e: EtapeFlux[]) => setArbres((a) => ({ ...a, [fluxId]: e }))

  // Garde après les crochets : un flux créé pendant la session n'existe pas dans
  // le jeu figé, et un 404 serveur ferait croire à une panne.
  if (!courant) {
    return (
      <EmptyState
        titre="Flux introuvable"
        phrase="Ce flux n’existe pas, ou il appartient à un autre Espace Cloud que celui sélectionné. Le panneau de gauche liste ceux que vous pouvez ouvrir."
        action={{ libelle: 'Voir les flux', href: '/app/ia/orchestration' }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Orchestration', href: '/app/ia/orchestration' },
          { label: courant.nom },
        ]}
        titre={courant.nom}
        sousTitre={courant.description}
        actions={
          <GatedAction autorise={peutEcrire} message={refus('ia.flow.write')}>
            <Button
              onClick={() => {
                fluxCol.modifier(courant.id, { statut: 'publie' })
                pousser({
                  ton: 'ok',
                  titre: 'Flux publié',
                  detail: `${courant.nom} — les exécutions en cours terminent sur la version précédente.`,
                })
              }}
            >
              Publier le flux
            </Button>
          </GatedAction>
        }
      />

      <Card>
        <CardHeader
          titre="Exécuter maintenant"
          sousTitre="Lance réellement ce flux tel qu’enregistré côté passerelle — l’exécuteur natif (`ia_agents/flux.py`) appelle pour de vrai chaque agent qu’il référence. Suivi dans le centre de tâches."
        />
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Entrée du déclencheur" className="min-w-0 flex-1">
            <Input
              value={entreeTest}
              placeholder={courant.declencheur.detail || 'Message de test'}
              onChange={(e) => setEntreeTest(e.target.value)}
            />
          </Field>
          <GatedAction autorise={peutEcrire} message={refus('ia.flow.write')}>
            <Button
              onClick={() =>
                executerOperation({
                  action: 'ia.flow.write',
                  titre: `Exécution lancée · ${courant.nom}`,
                  detail: 'Suivi dans le centre de tâches.',
                  appel: () =>
                    creerRessource(`/ia/flux/${courant.id}/executer`, {
                      entree: entreeTest.trim() || courant.declencheur.detail || 'Message de test',
                    }),
                })
              }
            >
              Exécuter
            </Button>
          </GatedAction>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Exécutions 7 jours"
          valeur={courant.executions7j > 0 ? num(courant.executions7j) : '—'}
          detail={courant.statut === 'brouillon' ? 'Flux jamais publié' : undefined}
        />
        <StatTile
          libelle="Durée médiane"
          valeur={`${courant.dureeMedianeS} s`}
          detail={`Étape la plus lente : ${plusLente?.nom ?? '—'}`}
        />
        <StatTile
          libelle="Taux de succès"
          valeur={courant.tauxSuccesPct > 0 ? pct(courant.tauxSuccesPct, 1) : '—'}
          ton={courant.tauxSuccesPct > 90 ? 'ok' : 'warn'}
          detail={`Maillon faible : ${plusFragile?.nom ?? '—'}`}
        />
        <StatTile
          libelle="Coût par exécution"
          valeur={money(courant.coutParExecution)}
          detail={
            courant.executions7j > 0
              ? `${money(courant.coutParExecution * courant.executions7j)} sur 7 jours`
              : 'Estimation'
          }
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'studio' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-4">
            <Constructeur
              key={courant.id}
              flux={courant}
              etapes={etapes}
              setEtapes={enregistrer}
              selection={etape?.id ?? ''}
              onSelect={setSelection}
              onMessage={(titre, detail, ton) => pousser({ ton, titre, detail })}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Callout ton="violet" titre="Un flux se teste par ses branches, pas par son chemin heureux">
                Le chemin nominal fonctionne toujours en démonstration. Ce qui casse en production,
                c’est la branche rare : la classification incertaine, l’outil muet, le montant juste
                au-dessus du seuil. Le jeu d’épreuves d’un flux doit contenir un cas par branche —
                sinon il ne mesure que la moitié du graphe.
              </Callout>
              <Callout ton="info" titre="Les trois manières dont un flux se dégrade sans prévenir">
                Une <strong>régression invisible</strong> : la réponse reste bien formée, mais moins
                juste — c’est le corpus de référence rejoué à chaque livraison qui l’attrape. Une{' '}
                <strong>fuite d’habilitation</strong> : une base mal filtrée expose ce qui est
                cloisonné — c’est le filtre appliqué avant le calcul de similarité qui l’empêche. Une{' '}
                <strong>dérive de coût</strong> : sans plafond appliqué, un agent consomme sans limite
                — ce sont les quotas bloquants à la passerelle qui la coupent.
              </Callout>
            </div>
          </div>

          <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            {etape ? (
              <PanneauEtape
                etape={etape}
                peutEcrire={peutEcrire}
                refus={refus('ia.flow.write')}
                onSupprimer={() =>
                  pousser({
                    ton: 'warn',
                    titre: 'Étape supprimée',
                    detail: `${etape.nom} — les étapes suivantes se réenchaînent automatiquement.`,
                  })
                }
              />
            ) : (
              <Card>
                <p className="text-[13px] text-g-500">
                  Sélectionnez une étape du canevas pour la configurer.
                </p>
              </Card>
            )}
            <Callout ton="info" titre="Le parallèle ne réduit pas le coût">
              Deux branches lancées ensemble raccourcissent l’attente, pas la facture : chacune
              consomme ses jetons. Le parallélisme s’achète en jetons et se rembourse en secondes.
            </Callout>
          </div>
        </div>
      )}

      {onglet === 'executions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              libelle="Exécutions 24 h"
              valeur={num(etapes[0]?.executions24h ?? 0)}
              detail="Entrées dans le flux"
            />
            <StatTile
              libelle="En attente humaine"
              valeur={num(
                toutes.filter((e) => e.type === 'humain').reduce((a, e) => a + e.executions24h, 0),
              )}
              detail="Mises en pause sur 24 h"
              ton="warn"
            />
            <StatTile
              libelle="Reprises déclenchées"
              valeur={num(
                toutes
                  .filter((e) => e.reprise)
                  .reduce((a, e) => a + Math.round((e.executions24h * e.tauxErreurPct) / 100), 0),
              )}
              detail="Étapes rejouées automatiquement"
            />
            <StatTile
              libelle="Échecs définitifs"
              valeur={courant.tauxSuccesPct > 0 ? pct(100 - courant.tauxSuccesPct, 1) : '—'}
              ton="warn"
              detail="Après épuisement des reprises"
            />
          </div>

          <Card>
            <CardHeader
              titre="Dernières exécutions"
              sousTitre="Vingt lignes au plus. Le détail pas à pas d’une exécution se lit dans la trace de l’agent concerné."
            />
            <LogPeek lignes={JOURNAL_FLUX} max={20} titre="Journal du flux" />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Callout ton="warn" titre="Une exécution « réussie » peut avoir perdu une branche">
              L’exécution <span className="font-mono text-[12px]">exec-8841b8</span> est comptée en
              échec parce que la branche technique n’a rien rendu. D’autres aboutissent avec une
              branche muette et sont comptées en succès : la synthèse se fait alors sur moins
              d’éléments, sans que personne ne le remarque. C’est le mode de défaillance le plus
              coûteux d’un flux multi-agents, et le plus discret.
            </Callout>
            <Callout ton="info" titre="Conservation des journaux">
              Les exécutions restent consultables trois mois. Au-delà, elles basculent en archives
              mensuelles téléchargeables : une ligne par exécution, une par étape, une par pause
              humaine. Les traces des flux qui manipulent des données réglementées sont conservées
              cinq ans, comme le reste.
            </Callout>
          </div>
        </div>
      )}

      {onglet === 'reglages' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Variables"
                sousTitre="Trois portées. Les secrets d’environnement ne sont jamais exportés avec la définition du flux."
              />
              <div className="space-y-2">
                {courant.variables.map((v) => (
                  <div key={v.cle} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-ink">
                        {v.portee === 'systeme' ? v.cle : `{{ ${v.cle} }}`}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {v.secret && (
                          <Badge tone="violet" size="sm">
                            Secret
                          </Badge>
                        )}
                        <Badge tone="neutral" size="sm">
                          {v.portee === 'environnement'
                            ? 'Environnement'
                            : v.portee === 'conversation'
                              ? 'Conversation'
                              : 'Système'}
                        </Badge>
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-g-500">
                      {v.secret ? '••••••••••••' : v.valeur}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-g-500">{v.description}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Mémoire et reprise"
                sousTitre="Ce que les agents d’un même flux partagent, et ce qui se rejoue par défaut."
              />
              <div className="space-y-3.5">
                <Switch
                  checked={courant.memoirePartagee}
                  disabled={!peutEcrire}
                  label="Espace de contexte commun"
                  description="Les agents du flux lisent et écrivent dans la même mémoire de session. Pratique pour éviter de reposer trois fois la même question — au prix d’un couplage : ce qu’un agent y écrit de faux, les suivants le prennent pour acquis."
                />
                <Slider
                  label="Tentatives par défaut"
                  value={2}
                  onChange={() => undefined}
                  min={0}
                  max={5}
                  unite="tentatives"
                />
                <Field label="Enjeu déclenchant une validation humaine">
                  <Select defaultValue="50000" disabled={!peutEcrire}>
                    <option value="0">Toujours — chaque réponse est relue</option>
                    <option value="50000">Au-delà de 50 000 FCFA</option>
                    <option value="250000">Au-delà de 250 000 FCFA</option>
                    <option value="jamais">Jamais — le flux répond seul</option>
                  </Select>
                </Field>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Définition du flux"
                sousTitre="Le flux s’exporte et s’importe. Versionné dans votre dépôt, il se relit, se compare et se déploie comme du code."
                actions={
                  <GatedAction autorise={peutEcrire} message={refus('ia.flow.write')}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        pousser({
                          ton: 'ok',
                          titre: 'Définition exportée',
                          detail: `${courant.nom} · ${courant.version}`,
                        })
                      }
                    >
                      Exporter
                    </Button>
                  </GatedAction>
                }
              />
              <CodeBlock
                langue="yaml"
                code={`flux: ${courant.id}
version: ${courant.version}
declencheur:
  type: ${courant.declencheur.type}
  detail: ${courant.declencheur.detail}
memoire_partagee: ${courant.memoirePartagee}

# Les secrets d'environnement sont remplacés par une référence au coffre.
variables:
${courant.variables
  .filter((v) => v.portee === 'environnement')
  .map((v) => `  - ${v.cle}: ${v.secret ? '{{ coffre }}' : v.valeur}`)
  .join('\n')}

etapes:
${etapes
  .map((e) => {
    const base = `  - ${e.id}:\n      type: ${e.type}${e.agentId ? `\n      agent: ${AGENTS_IA.find((a) => a.id === e.agentId)?.slug}` : ''}${e.reprise ? `\n      tentatives: ${e.reprise.tentatives}` : ''}`
    if (!e.branches) return base
    return `${base}\n      branches:\n${e.branches.map((b) => `        - ${b.nom}: ${b.etapes.length} étape(s)${b.parDefaut ? ' (repli)' : ''}`).join('\n')}`
  })
  .join('\n')}`}
              />
            </Card>

            <Callout ton="info" titre="Publier écrase la version en production">
              Les exécutions en cours terminent sur la version qui les a commencées ; les suivantes
              partent sur la nouvelle. Il n’y a pas de bascule progressive sur un flux, contrairement
              aux agents : un flux est un tout, et servir deux versions en parallèle rendrait les
              traces illisibles.
            </Callout>
          </div>
        </div>
      )}
    </div>
  )
}
