'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Field, Input, MonoTextarea, Select, Switch, Textarea } from '@/components/ui/field'
import { ConfirmDialog, Modal } from '@/components/ui/overlay'
import type { AuditEvent } from '@/lib/types'
import { UTILISATEUR_COURANT } from '@/lib/mock/orgs'
import { libelleWorkflow, workflowById } from '@/lib/workflows'
import { ApiError, estActif, estTravail, suivreTravail } from '@/lib/api/client'
import { useApp } from './contexte'
import { useAtelier, type SpecJob } from './atelier'

/**
 * Actions de la maquette — un seul chemin pour « ce bouton fait quelque chose ».
 *
 * Trois choses doivent arriver ensemble quand on agit sur une ressource :
 * le RBAC décide si l'action est possible (désactivée et nommée, jamais
 * masquée), l'état de l'atelier change, et l'utilisateur reçoit une trace —
 * notification, et job de provisionnement quand l'opération n'est pas
 * instantanée. Regroupé ici pour que chaque écran ne réinvente pas la séquence.
 */

export interface SpecOperation {
  /** Identifiant d'action RBAC. Absent = toujours autorisé. */
  action?: string
  titre: string
  detail?: string
  ton?: 'ok' | 'info' | 'warn' | 'err'
  /** Mutation immédiate de l'atelier. En mode API avec `appel`, elle est
   * sautée : l’appel réel a déjà muté le backend (la rejouer doublerait
   * l’écriture, la collection distante `POST` à nouveau). */
  effet?: () => void
  /** Job de provisionnement affiché dans le centre de tâches. Mode maquette
   * uniquement quand `appel` est fourni et l’API active. */
  job?: Omit<SpecJob, 'alFin' | 'alEchec'>
  /** Réconciliation après l’appel réel (recharger, naviguer) ou mutation
   * appliquée à la fin du job simulé. Court dans les deux modes. */
  effetFinal?: () => void
  /**
   * Appel réel au backend, utilisé quand l’API est active. S’il renvoie un
   * travail de provisioning (`202`), le job existant est piloté par ses
   * `taches` ; sinon `effetFinal` s’applique au retour. En mode maquette,
   * `effet` + `job` gardent leur comportement simulé.
   */
  appel?: () => Promise<unknown>
  /**
   * Rappelé sur `ApiError` en mode API, avant le toast : le site d’appel y
   * accroche ses erreurs de champs (`422`, `e.champs`) sans rouvrir la modale.
   */
  onErreur?: (e: ApiError) => void
  /**
   * Ce qu'on écrit au journal d'audit. Par défaut l'opération est journalisée
   * en déduisant l'action de `action` et la cible de `titre` ; `audit: false`
   * dispense les gestes qui ne valent pas une trace — replier un panneau,
   * exporter un CSV déjà affiché.
   */
  audit?:
    | false
    | {
        action?: string
        cible?: string
        scope?: AuditEvent['scope']
        detail?: string
      }
}

export function useOperation() {
  const { pousser, autorise, role } = useApp()
  const { lancerJob, integrerTravail, journaliser } = useAtelier()

  const executer = useCallback(
    (spec: SpecOperation) => {
      /** L'acteur, tel que le journal doit le nommer. */
      const trace = (result: AuditEvent['result'], detail?: string) => {
        if (spec.audit === false) return
        journaliser({
          actor: {
            id: UTILISATEUR_COURANT.id,
            nom: UTILISATEUR_COURANT.nom,
            email: UTILISATEUR_COURANT.email,
            type: 'user',
          },
          role,
          scope: spec.audit?.scope ?? { type: 'plateforme', label: 'Portail' },
          action: spec.audit?.action ?? spec.action ?? 'ui.action',
          target: spec.audit?.cible ?? spec.titre,
          result,
          detail: detail ?? spec.audit?.detail ?? spec.detail,
        })
      }

      // Un refus se journalise aussi : c'est ce que la vitrine promet, et c'est
      // la seule trace qu'un auditeur ne peut pas reconstituer autrement.
      if (spec.action && !autorise(spec.action)) {
        trace('refuse', `Rôle ${role} insuffisant pour ${spec.action}`)
        return
      }

      // Mode API : l’appel réel remplace la simulation. Un refus ou un échec
      // métier arrive en `ApiError` et se dit avec les mots du backend.
      if (estActif() && spec.appel) {
        const echec = (e: unknown) => {
          if (e instanceof ApiError) {
            spec.onErreur?.(e)
            const complements = [
              e.rolesRequis && e.rolesRequis.length > 0
                ? `Rôle requis : ${e.rolesRequis.join(' ou ')}.`
                : undefined,
              e.champs
                ? Object.entries(e.champs)
                    .map(([champ, message]) => `${champ} : ${message}`)
                    .join(' ')
                : undefined,
              e.correlationId ? `Référence ${e.correlationId}.` : undefined,
            ].filter(Boolean)
            pousser({
              ton: 'err',
              titre: spec.titre,
              detail: [e.message, ...complements].join(' '),
            })
            trace(e.statut === 403 ? 'refuse' : 'erreur', e.message)
          } else {
            pousser({ ton: 'err', titre: spec.titre, detail: 'Le backend ne répond pas.' })
            trace('erreur', 'Le backend ne répond pas.')
          }
        }
        spec.appel().then(
          (resultat) => {
            if (estTravail(resultat)) {
              const id = integrerTravail(resultat)
              suivreTravail(id, (travail) => {
                integrerTravail(travail)
                if (travail.statut === 'done') {
                  spec.effetFinal?.()
                  pousser({
                    ton: 'ok',
                    titre: travail.label,
                    detail: 'Opération terminée. Suivi dans le centre de tâches.',
                  })
                } else if (travail.statut === 'failed' || travail.statut === 'rolled_back') {
                  pousser({
                    ton: 'err',
                    titre: `Échec · ${travail.label}`,
                    detail: travail.erreur
                      ? `${travail.erreur.message} Référence ${travail.erreur.correlationId}.`
                      : 'Diagnostic et reprise dans le centre de tâches.',
                  })
                }
              })
              trace('ok')
              pousser({
                ton: spec.ton ?? 'ok',
                titre: spec.titre,
                detail: spec.detail ?? 'Opération acceptée. Suivi dans le centre de tâches.',
              })
            } else {
              // Réponse directe (ressource créée, `204`) : l’écriture a eu
              // lieu côté backend, on réconcilie sans rejouer `effet`.
              spec.effetFinal?.()
              trace('ok')
              pousser({ ton: spec.ton ?? 'ok', titre: spec.titre, detail: spec.detail })
            }
          },
          (e: unknown) => echec(e),
        )
        return
      }

      spec.effet?.()

      // Quand l'opération vient du catalogue, c'est lui qui fournit les phrases
      // de départ, de fin et d'échec : deux écrans qui lancent la même
      // opération ne doivent pas la raconter différemment.
      const def = spec.job?.workflow ? workflowById(spec.job.workflow) : undefined
      const libelle = def
        ? libelleWorkflow(def, spec.job?.cible ?? '')
        : (spec.job?.label ?? spec.titre)

      if (spec.job) {
        lancerJob({
          ...spec.job,
          alFin: def
            ? () => {
                spec.effetFinal?.()
                pousser({ ton: 'ok', titre: libelle, detail: def.fin })
              }
            : spec.effetFinal,
          alEchec: def
            ? (etape) =>
                pousser({
                  ton: 'err',
                  titre: `Échec · ${libelle}`,
                  detail: `Étape « ${etape} ». Diagnostic et reprise dans le centre de tâches.`,
                })
            : undefined,
        })
      } else {
        spec.effetFinal?.()
      }

      trace('ok')
      pousser({
        ton: spec.ton ?? 'ok',
        titre: spec.titre,
        detail:
          spec.detail ??
          (def
            ? `${def.lancement} Suivi dans le centre de tâches.`
            : spec.job
              ? 'Avancement suivi dans le centre de tâches.'
              : undefined),
      })
    },
    [autorise, integrerTravail, journaliser, lancerJob, pousser, role],
  )

  return executer
}

// ─── Bouton d'action ──────────────────────────────────────────────────

/**
 * Bouton qui exécute une opération : gabarit RBAC, confirmation éventuelle,
 * mutation, notification, job. `confirmation` demande la saisie du nom exact
 * de la ressource, comme l'exige toute action destructive.
 */
export function BoutonAction({
  operation,
  libelle,
  confirmation,
  variant = 'secondary',
  size = 'sm',
  icone,
  fullWidth,
  className,
  desactive,
  nomAccessible,
}: {
  operation: SpecOperation
  libelle: ReactNode
  confirmation?: { ressource: string; titre?: string; pertes: string[]; libelleAction?: string }
  variant?: ButtonVariant
  size?: ButtonSize
  icone?: ReactNode
  fullWidth?: boolean
  className?: string
  desactive?: boolean
  /** Obligatoire quand `libelle` n'est qu'une icône : sinon le bouton est muet. */
  nomAccessible?: string
}) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const [ouvert, setOuvert] = useState(false)
  const permis = operation.action ? autorise(operation.action) : true

  return (
    <>
      <GatedAction autorise={permis} message={operation.action ? refus(operation.action) : ''}>
        <Button
          variant={variant}
          size={size}
          iconBefore={icone}
          fullWidth={fullWidth}
          className={className}
          disabled={desactive}
          aria-label={nomAccessible}
          title={nomAccessible}
          onClick={() => (confirmation ? setOuvert(true) : executer(operation))}
        >
          {libelle}
        </Button>
      </GatedAction>
      {confirmation && (
        <ConfirmDialog
          open={ouvert}
          onClose={() => setOuvert(false)}
          onConfirm={() => executer(operation)}
          titre={confirmation.titre ?? `Supprimer ${confirmation.ressource} ?`}
          ressource={confirmation.ressource}
          pertes={confirmation.pertes}
          libelleAction={confirmation.libelleAction}
        />
      )}
    </>
  )
}

// ─── Formulaire générique ─────────────────────────────────────────────

export type ValeurChamp = string | number | boolean

export interface ChampSpec {
  id: string
  label: string
  type?: 'texte' | 'nombre' | 'select' | 'switch' | 'zone' | 'mono'
  options?: Array<{ value: string; label: string }>
  hint?: string
  placeholder?: string
  suffixe?: string
  obligatoire?: boolean
  /** Un champ court occupe une demi-largeur sur écran large. */
  demi?: boolean
  min?: number
  max?: number
}

export type ValeursFormulaire = Record<string, ValeurChamp>

function valeursInitiales(champs: ChampSpec[], depart?: ValeursFormulaire): ValeursFormulaire {
  const out: ValeursFormulaire = {}
  for (const c of champs) {
    out[c.id] =
      depart?.[c.id] ??
      (c.type === 'switch' ? false : c.type === 'nombre' ? (c.min ?? 0) : (c.options?.[0]?.value ?? ''))
  }
  return out
}

/** Modale de saisie construite depuis une description de champs. */
export function ModaleFormulaire({
  ouvert,
  onFermer,
  titre,
  description,
  champs,
  valeursDepart,
  libelleValider = 'Enregistrer',
  taille = 'md',
  onValider,
  complement,
  erreurs,
  fermetureAuto = true,
}: {
  ouvert: boolean
  onFermer: () => void
  titre: string
  description?: string
  champs: ChampSpec[]
  valeursDepart?: ValeursFormulaire
  libelleValider?: string
  taille?: 'sm' | 'md' | 'lg'
  onValider: (valeurs: ValeursFormulaire) => void
  /** Bloc libre affiché sous les champs — aperçu de coût, avertissement. */
  complement?: (valeurs: ValeursFormulaire) => ReactNode
  /** Erreurs de champs renvoyées par l’API (`422`) : affichées sous le champ. */
  erreurs?: Record<string, string>
  /** Faux quand le site d’appel ferme lui-même, après le succès de l’appel. */
  fermetureAuto?: boolean
}) {
  const depart = useMemo(() => valeursInitiales(champs, valeursDepart), [champs, valeursDepart])
  const [valeurs, setValeurs] = useState<ValeursFormulaire>(depart)
  const [cle, setCle] = useState(0)

  // Remonte les valeurs de départ quand la modale se rouvre sur une autre ressource.
  const signature = JSON.stringify(depart)
  const [signaturePrec, setSignaturePrec] = useState(signature)
  if (signature !== signaturePrec) {
    setSignaturePrec(signature)
    setValeurs(depart)
    setCle((c) => c + 1)
  }

  const poser = (id: string, v: ValeurChamp) => setValeurs((p) => ({ ...p, [id]: v }))

  const complet = champs.every(
    (c) => !c.obligatoire || String(valeurs[c.id] ?? '').trim().length > 0,
  )

  return (
    <Modal
      open={ouvert}
      onClose={onFermer}
      title={titre}
      description={description}
      size={taille}
      footer={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button
            disabled={!complet}
            onClick={() => {
              onValider(valeurs)
              if (fermetureAuto) onFermer()
            }}
          >
            {libelleValider}
          </Button>
        </>
      }
    >
      <div key={cle} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {champs.map((c) => (
          <Field
            key={c.id}
            label={c.label}
            hint={c.hint}
            required={c.obligatoire}
            error={erreurs?.[c.id]}
            className={c.demi ? 'sm:col-span-1' : 'sm:col-span-2'}
          >
            {c.type === 'select' ? (
              <Select value={String(valeurs[c.id] ?? '')} onChange={(e) => poser(c.id, e.target.value)}>
                {(c.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : c.type === 'switch' ? (
              <Switch checked={Boolean(valeurs[c.id])} onChange={(v) => poser(c.id, v)} label={c.placeholder} />
            ) : c.type === 'zone' ? (
              <Textarea
                value={String(valeurs[c.id] ?? '')}
                placeholder={c.placeholder}
                onChange={(e) => poser(c.id, e.target.value)}
              />
            ) : c.type === 'mono' ? (
              <MonoTextarea
                value={String(valeurs[c.id] ?? '')}
                placeholder={c.placeholder}
                onChange={(e) => poser(c.id, e.target.value)}
              />
            ) : (
              <Input
                type={c.type === 'nombre' ? 'number' : 'text'}
                value={String(valeurs[c.id] ?? '')}
                placeholder={c.placeholder}
                suffix={c.suffixe}
                min={c.min}
                max={c.max}
                onChange={(e) =>
                  poser(c.id, c.type === 'nombre' ? Number(e.target.value) : e.target.value)
                }
              />
            )}
          </Field>
        ))}
        {complement && <div className="sm:col-span-2">{complement(valeurs)}</div>}
      </div>
    </Modal>
  )
}

/**
 * Bouton qui ouvre un formulaire puis exécute une opération construite à
 * partir des valeurs saisies. Couvre la création rapide et la modification.
 */
export function BoutonFormulaire({
  libelle,
  titre,
  description,
  champs,
  valeursDepart,
  action,
  libelleValider,
  taille,
  variant = 'secondary',
  size = 'sm',
  icone,
  fullWidth,
  className,
  operation,
  complement,
  ouvert: ouvertControle,
  onOuvertChange,
}: {
  libelle: ReactNode
  titre: string
  description?: string
  champs: ChampSpec[]
  valeursDepart?: ValeursFormulaire
  /** Identifiant RBAC : le bouton reste visible, désactivé et expliqué. */
  action?: string
  libelleValider?: string
  taille?: 'sm' | 'md' | 'lg'
  variant?: ButtonVariant
  size?: ButtonSize
  icone?: ReactNode
  fullWidth?: boolean
  className?: string
  operation: (valeurs: ValeursFormulaire) => SpecOperation
  complement?: (valeurs: ValeursFormulaire) => ReactNode
  /**
   * Ouverture pilotée depuis l'appelant (ex. l'action d'un `DataTable` en état
   * vide, qui n'a pas de référence vers le bouton du bandeau) : non fourni, la
   * modale garde son état interne comme avant.
   */
  ouvert?: boolean
  onOuvertChange?: (v: boolean) => void
}) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const [ouvertInterne, setOuvertInterne] = useState(false)
  const ouvert = ouvertControle ?? ouvertInterne
  const setOuvert = onOuvertChange ?? setOuvertInterne
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const permis = action ? autorise(action) : true

  /**
   * En mode API avec `appel`, la modale reste ouverte jusqu’au succès : un
   * `422` y affiche ses erreurs de champs au lieu de se perdre dans un toast
   * sur un écran déjà refermé. En maquette elle se referme aussitôt, comme avant.
   */
  const valider = (valeurs: ValeursFormulaire) => {
    const spec = operation(valeurs)
    if (estActif() && spec.appel) {
      setErreurs({})
      executer({
        action,
        ...spec,
        onErreur: (e) => setErreurs(e.champs ?? {}),
        effetFinal: () => {
          spec.effetFinal?.()
          setOuvert(false)
        },
      })
      return
    }
    executer({ action, ...spec })
    setOuvert(false)
  }

  return (
    <>
      <GatedAction autorise={permis} message={action ? refus(action) : ''}>
        <Button
          variant={variant}
          size={size}
          iconBefore={icone}
          fullWidth={fullWidth}
          className={className}
          onClick={() => {
            setErreurs({})
            setOuvert(true)
          }}
        >
          {libelle}
        </Button>
      </GatedAction>
      <ModaleFormulaire
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre={titre}
        description={description}
        champs={champs}
        valeursDepart={valeursDepart}
        libelleValider={libelleValider}
        taille={taille}
        complement={complement}
        erreurs={erreurs}
        fermetureAuto={false}
        onValider={valider}
      />
    </>
  )
}
