'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { MAINTENANT } from '@/lib/format'
import { correlationId } from '@/lib/utils'
import type { AuditEvent, DefinitionWorkflow, ProvisioningJob } from '@/lib/types'
import {
  creerRessource,
  estActif,
  lister,
  modifierRessource,
  requete,
  supprimerRessource,
  type TravailDistant,
} from '@/lib/api/client'
import { champConfirmation, endpointDe } from '@/lib/api/collections'
import { AUDIT, JOBS } from '@/lib/mock/ops'
import {
  etapeEnEchec,
  libelleWorkflow,
  planifier,
  workflowById,
} from '@/lib/workflows'

/**
 * Atelier — couche d'état mutable posée par-dessus le jeu de données fictif.
 *
 * La maquette n'a ni base ni API : `src/lib/mock/` est figé et importé
 * directement par les écrans. Un bouton « Supprimer » ne pouvait donc que
 * pousser une notification, et la ressource restait dans la liste juste
 * derrière — ce qui se voit immédiatement en démonstration.
 *
 * L'atelier garde, le temps de la session, les collections qui ont été
 * touchées. Une collection jamais modifiée n'existe pas dans l'état : la
 * lecture retombe sur la graine importée du jeu de données, si bien que le
 * rendu serveur et le premier rendu client restent identiques et que
 * l'hydratation ne diverge pas. Un rechargement complet remet la
 * démonstration à son état d'origine, ce qui est le comportement attendu.
 */

export interface Entite {
  id: string
}

type Patch<T> = Partial<T> | ((item: T) => Partial<T>)

export interface SpecJob {
  /**
   * Identifiant d'un workflow du catalogue. Quand il est fourni, le libellé,
   * les étapes, leurs durées annoncées et l'échec éventuel viennent de là —
   * c'est la forme à préférer : deux écrans qui lancent la même opération
   * racontent alors la même chose.
   */
  workflow?: string
  /** Ressource concernée, substituée à `{cible}` dans le libellé du catalogue. */
  cible?: string
  /** Type technique, par exemple `vm.create` — sert au regroupement. */
  type?: string
  label?: string
  /** Libellés des étapes, dans l'ordre. Ignoré si `workflow` est fourni. */
  etapes?: string[]
  /** Durée simulée d'une étape, pour la forme sans catalogue. */
  dureeEtapeMs?: number
  /** Appelé une fois la dernière étape terminée : bascule d'état, toast… */
  alFin?: () => void
  /** Appelé si l'étape écrite comme échouée interrompt la séquence. */
  alEchec?: (etape: string) => void
}

interface CtxAtelier {
  lire: <T extends Entite>(nom: string, graine: readonly T[]) => T[]
  creer: <T extends Entite>(
    nom: string,
    graine: readonly T[],
    item: T | T[],
    ou?: 'debut' | 'fin',
  ) => void
  modifier: <T extends Entite>(
    nom: string,
    graine: readonly T[],
    id: string,
    patch: Patch<T>,
  ) => void
  /** Applique le même correctif à plusieurs entités — actions groupées. */
  modifierPlusieurs: <T extends Entite>(
    nom: string,
    graine: readonly T[],
    ids: string[],
    patch: Patch<T>,
  ) => void
  supprimer: (nom: string, graine: readonly Entite[], id: string | string[]) => void
  /** Identifiant séquentiel — jamais `Math.random()`, jamais `Date.now()`. */
  identifiant: (prefixe: string) => string
  jobs: ProvisioningJob[]
  lancerJob: (spec: SpecJob) => string
  /**
   * Intègre un travail renvoyé par l’API (`202`) dans la collection des jobs :
   * créé à la première vue, mis à jour aux suivantes. Le suivi périodique
   * (`suivreTravail`) rappelle cette fonction à chaque réponse.
   */
  integrerTravail: (travail: TravailDistant, nom?: string) => string
  /**
   * Reprend un job échoué à son étape échouée. L'espace fournisseur garde ses
   * jobs dans une autre collection, d'où les deux paramètres facultatifs.
   * Faux si le job est inconnu ou si son type n'est pas au catalogue.
   */
  reprendreJob: (id: string, nom?: string, graine?: readonly ProvisioningJob[]) => boolean
  /**
   * Écrit une entrée au journal d'audit. La vitrine promet un journal « qui
   * enregistre aussi les refus » : c'est ici que la promesse se tient, y compris
   * quand le RBAC refuse l'action.
   */
  journaliser: (ev: Omit<AuditEvent, 'id' | 'ts'> & { ts?: string }) => void
  journal: AuditEvent[]
  /** Nombre de collections modifiées depuis le chargement de la page. */
  collectionsModifiees: number
  reinitialiser: () => void
}

const Ctx = createContext<CtxAtelier | null>(null)

const NOM_JOBS = 'jobs'
const NOM_AUDIT = 'audit'

export function AtelierProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Record<string, Entite[]>>({})
  const compteur = useRef(0)

  const lire = useCallback(
    <T extends Entite>(nom: string, graine: readonly T[]): T[] =>
      (collections[nom] as T[] | undefined) ?? (graine as T[]),
    [collections],
  )

  const ecrire = useCallback(
    <T extends Entite>(nom: string, graine: readonly T[], f: (courant: T[]) => T[]) => {
      setCollections((p) => ({
        ...p,
        [nom]: f((p[nom] as T[] | undefined) ?? ([...graine] as T[])),
      }))
    },
    [],
  )

  const creer = useCallback<CtxAtelier['creer']>(
    (nom, graine, item, ou = 'debut') => {
      const ajouts = Array.isArray(item) ? item : [item]
      ecrire(nom, graine, (c) => (ou === 'debut' ? [...ajouts, ...c] : [...c, ...ajouts]))
    },
    [ecrire],
  )

  const appliquer = <T extends Entite>(item: T, patch: Patch<T>): T => ({
    ...item,
    ...(typeof patch === 'function' ? patch(item) : patch),
  })

  const modifier = useCallback<CtxAtelier['modifier']>(
    (nom, graine, id, patch) => {
      ecrire(nom, graine, (c) => c.map((x) => (x.id === id ? appliquer(x, patch) : x)))
    },
    [ecrire],
  )

  const modifierPlusieurs = useCallback<CtxAtelier['modifierPlusieurs']>(
    (nom, graine, ids, patch) => {
      ecrire(nom, graine, (c) => c.map((x) => (ids.includes(x.id) ? appliquer(x, patch) : x)))
    },
    [ecrire],
  )

  const supprimer = useCallback<CtxAtelier['supprimer']>(
    (nom, graine, id) => {
      const cibles = Array.isArray(id) ? id : [id]
      ecrire(nom, graine, (c) => c.filter((x) => !cibles.includes(x.id)))
    },
    [ecrire],
  )

  const identifiant = useCallback((prefixe: string) => {
    compteur.current += 1
    return `${prefixe}-s${compteur.current}`
  }, [])

  /**
   * Un travail distant a la même forme qu’un job local (`taches` comprises) :
   * on le normalise une fois ici pour que le centre de tâches n’ait pas à
   * distinguer les deux provenances.
   */
  const integrerTravail = useCallback((travail: TravailDistant, nom: string = NOM_JOBS) => {
    const normalise: ProvisioningJob = {
      id: travail.id,
      orgId: travail.orgId ?? 'org-dba',
      type: travail.type,
      label: travail.label,
      statut: travail.statut,
      startedAt: travail.startedAt ?? MAINTENANT,
      dureeS: travail.dureeS,
      erreur: travail.erreur,
      taches: travail.taches.map((t) => ({
        ordre: t.ordre,
        nom: t.nom,
        statut: t.statut,
        dureeS: t.dureeS,
        message: t.message,
      })),
    }
    setCollections((p) => {
      const courant = ((p[nom] as ProvisioningJob[] | undefined) ??
        (nom === NOM_JOBS ? [...JOBS] : [])) as ProvisioningJob[]
      return {
        ...p,
        [nom]: courant.some((j) => j.id === travail.id)
          ? courant.map((j) => (j.id === travail.id ? normalise : j))
          : [normalise, ...courant],
      }
    })
    return travail.id
  }, [])

  const jobs = lire<ProvisioningJob>(NOM_JOBS, JOBS)
  const journal = lire<AuditEvent>(NOM_AUDIT, AUDIT)

  /**
   * Les entrées ajoutées pendant la session portent `MAINTENANT` décalé d'une
   * seconde par événement : sans ce décalage elles partageraient toutes le même
   * horodatage et le tri antéchronologique du journal deviendrait arbitraire.
   * `Date.now()` reste exclu — il ferait diverger serveur et client.
   */
  const journaliser = useCallback<CtxAtelier['journaliser']>(
    (ev) => {
      compteur.current += 1
      const decale = new Date(new Date(MAINTENANT).getTime() + compteur.current * 1000)
      creer(NOM_AUDIT, AUDIT, {
        ...ev,
        id: `ev-s${compteur.current}`,
        ts: ev.ts ?? decale.toISOString().replace('.000', ''),
      } as AuditEvent)
    },
    [creer],
  )

  /**
   * Effets à appliquer à la fin d'un job, gardés hors de l'état : un job qui
   * échoue ne doit pas muter les collections — la ressource ne doit pas
   * apparaître — mais sa reprise, elle, doit pouvoir le faire.
   */
  const effetsDiferes = useRef(new Map<string, () => void>())
  const alertesEchec = useRef(new Map<string, (etape: string) => void>())
  const essais = useRef(new Map<string, number>())

  /**
   * Joue une séquence d'étapes sur un job existant. `depuis` permet de
   * reprendre à l'étape échouée : les précédentes restent acquises.
   */
  const jouer = useCallback(
    (
      id: string,
      def: DefinitionWorkflow,
      essai: number,
      depuis: number,
      nom: string = NOM_JOBS,
      graine: readonly ProvisioningJob[] = JOBS,
    ) => {
      const rangEchec = etapeEnEchec(def, essai)
      const plan = planifier(def, { depuis, jusqua: rangEchec || def.etapes.length })
      const totalAnnonce = def.etapes.reduce((a, e) => a + e.dureeS, 0)

      plan.forEach((etape, i) => {
        const ordre = depuis + i + 1
        const derniere = i === plan.length - 1
        const ratee = derniere && rangEchec > 0
        const suivante = def.etapes[ordre]

        setTimeout(() => {
          modifier<ProvisioningJob>(nom, graine, id, (job) => ({
            statut: ratee
              ? def.echec?.rollback
                ? 'rolled_back'
                : 'failed'
              : derniere
                ? 'done'
                : 'running',
            dureeS: derniere
              ? ratee
                ? def.etapes.slice(0, ordre).reduce((a, e) => a + e.dureeS, 0)
                : totalAnnonce
              : undefined,
            erreur:
              ratee && def.echec
                ? {
                    message: def.echec.message,
                    correlationId: correlationId(`${def.id}-${job.label}`),
                    suggestion: def.echec.suggestion,
                  }
                : undefined,
            taches: job.taches.map((t) =>
              t.ordre === ordre
                ? ratee
                  ? {
                      ...t,
                      statut: 'failed',
                      dureeS: etape.dureeS,
                      message: 'Interrompue — voir le diagnostic',
                    }
                  : { ...t, statut: 'ok', dureeS: etape.dureeS, message: undefined }
                : t.ordre === ordre + 1 && !ratee
                  ? { ...t, statut: 'running', message: suivante?.message }
                  : t,
            ),
          }))
          if (derniere && !ratee) {
            effetsDiferes.current.get(id)?.()
            effetsDiferes.current.delete(id)
          }
          if (ratee) alertesEchec.current.get(id)?.(etape.nom)
        }, etape.aMs)
      })
    },
    [modifier],
  )

  const lancerJob = useCallback<CtxAtelier['lancerJob']>(
    (spec) => {
      const id = identifiant('job')
      const def = spec.workflow ? workflowById(spec.workflow) : undefined

      if (def) {
        const label = spec.label ?? libelleWorkflow(def, spec.cible ?? '')
        creer(NOM_JOBS, JOBS, {
          id,
          orgId: 'org-dba',
          type: def.id,
          label,
          statut: 'running',
          startedAt: MAINTENANT,
          taches: def.etapes.map((e, i) => ({
            ordre: i + 1,
            nom: e.nom,
            statut: i === 0 ? 'running' : 'pending',
            message: i === 0 ? e.message : undefined,
          })),
        } satisfies ProvisioningJob)

        if (spec.alFin) effetsDiferes.current.set(id, spec.alFin)
        if (spec.alEchec) alertesEchec.current.set(id, spec.alEchec)
        essais.current.set(id, 0)
        jouer(id, def, 0, 0)
        return id
      }

      // Forme sans catalogue : étapes fournies au site d'appel, cadence fixe.
      const etapes = spec.etapes ?? []
      const pas = spec.dureeEtapeMs ?? 1400
      const dureeEtapeS = Math.max(1, Math.round(pas / 1000))

      creer(NOM_JOBS, JOBS, {
        id,
        orgId: 'org-dba',
        type: spec.type ?? 'ui.action',
        label: spec.label ?? 'Opération',
        statut: 'running',
        startedAt: MAINTENANT,
        taches: etapes.map((nom, i) => ({
          ordre: i + 1,
          nom,
          statut: i === 0 ? 'running' : 'pending',
        })),
      } satisfies ProvisioningJob)

      etapes.forEach((_, i) => {
        const derniere = i === etapes.length - 1
        setTimeout(
          () => {
            modifier<ProvisioningJob>(NOM_JOBS, JOBS, id, (job) => ({
              statut: derniere ? 'done' : 'running',
              dureeS: derniere ? dureeEtapeS * etapes.length : undefined,
              taches: job.taches.map((t) =>
                t.ordre <= i + 1
                  ? { ...t, statut: 'ok', dureeS: dureeEtapeS }
                  : t.ordre === i + 2
                    ? { ...t, statut: 'running' }
                    : t,
              ),
            }))
            if (derniere) spec.alFin?.()
          },
          pas * (i + 1),
        )
      })

      return id
    },
    [creer, identifiant, jouer, modifier],
  )

  /**
   * Reprise d'un job échoué, sur le job lui-même : l'étape échouée repart, les
   * précédentes restent acquises, et l'essai suivant aboutit. Sans cela un
   * échec resterait un cul-de-sac, ou obligerait à lancer un second job qui
   * raconterait deux fois la même opération.
   */
  const reprendreJob = useCallback<CtxAtelier['reprendreJob']>(
    (id, nom = NOM_JOBS, graine = JOBS) => {
      const job = lire<ProvisioningJob>(nom, graine).find((j) => j.id === id)
      const def = job && workflowById(job.type)
      if (!job || !def) return false

      const ratee = job.taches.find((t) => t.statut === 'failed')
      const depuis = ratee ? ratee.ordre - 1 : 0
      const essai = (essais.current.get(id) ?? 0) + 1
      essais.current.set(id, essai)

      modifier<ProvisioningJob>(nom, graine, id, (j) => ({
        statut: 'running',
        erreur: undefined,
        dureeS: undefined,
        taches: j.taches.map((t) =>
          t.ordre === depuis + 1 ? { ...t, statut: 'running', message: undefined } : t,
        ),
      }))
      jouer(id, def, essai, depuis, nom, graine)
      return true
    },
    [jouer, lire, modifier],
  )

  const valeur = useMemo<CtxAtelier>(
    () => ({
      lire,
      creer,
      modifier,
      modifierPlusieurs,
      supprimer,
      identifiant,
      jobs,
      lancerJob,
      integrerTravail,
      reprendreJob,
      journaliser,
      journal,
      collectionsModifiees: Object.keys(collections).length,
      reinitialiser: () => setCollections({}),
    }),
    [
      lire,
      creer,
      modifier,
      modifierPlusieurs,
      supprimer,
      identifiant,
      jobs,
      lancerJob,
      integrerTravail,
      reprendreJob,
      journaliser,
      journal,
      collections,
    ],
  )

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}

export function useAtelier(): CtxAtelier {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAtelier doit être utilisé dans un AtelierProvider')
  return v
}

/**
 * Collection modifiable. `nom` identifie la collection dans l’atelier,
 * `graine` est le tableau du jeu de données fictif qui sert d’état initial.
 *
 * Quand l’API est active et que `nom` figure au registre (`src/lib/api/`),
 * les items viennent de `GET {endpoint}?parPage=200` — la graine reste
 * affichée en attendant la réponse, pour ne pas faire diverger l’hydratation.
 * Les mutations appellent alors l’API (`POST`, `PATCH {id}`, `DELETE
 * {id}?confirmation=<nom>`) puis rechargent ; sinon tout reste local.
 */

// ─── Cache distant partagé ────────────────────────────────────────────
//
// Un seul chargement par clé, même quand plusieurs écrans montent la même
// collection ensemble (le sélecteur d’espace et trois tableaux appelaient
// `/espaces` en même temps : une seule requête part désormais). Le cache sert
// immédiatement, puis se réactualise en fond — la graine ne s’affiche qu’avant
// le tout premier retour.

interface EntreeDistante {
  donnees: Entite[] | null
  chargement: boolean
  erreur: Error | null
}

const CACHE_DISTANT = new Map<string, EntreeDistante>()
const ECOUTEURS_DISTANT = new Map<string, Set<() => void>>()
const CHARGEMENTS_EN_COURS = new Map<string, Promise<void>>()

function entreeDistante(nom: string): EntreeDistante {
  let entree = CACHE_DISTANT.get(nom)
  if (!entree) {
    entree = { donnees: null, chargement: false, erreur: null }
    CACHE_DISTANT.set(nom, entree)
  }
  return entree
}

function notifierDistant(nom: string) {
  ECOUTEURS_DISTANT.get(nom)?.forEach((cb) => cb())
}

function poserDistant(nom: string, patch: Partial<EntreeDistante>) {
  CACHE_DISTANT.set(nom, { ...entreeDistante(nom), ...patch })
  notifierDistant(nom)
}

/** Intègre un item isolé (lecture unitaire) dans la liste en cache. */
export function integrerDistant(nom: string, item: Entite) {
  const courant = entreeDistante(nom).donnees ?? []
  poserDistant(nom, {
    donnees: courant.some((x) => x.id === item.id)
      ? courant.map((x) => (x.id === item.id ? item : x))
      : [item, ...courant],
  })
}

function chargerDistant(nom: string, endpoint: string) {
  if (CHARGEMENTS_EN_COURS.has(nom)) return
  poserDistant(nom, { chargement: true, erreur: null })
  const tache = lister<Entite>(endpoint).then(
    (page) => {
      // Certaines listes reviennent en tableau brut (`/projets/{id}/services`,
      // `/projets/{id}/variables`, `/facturation/moyens-paiement`) plutôt
      // qu’enveloppées dans `{ donnees, pagination }` : on les range telles
      // quelles au lieu de garder la graine en silence.
      const brut = page as unknown
      const donnees = Array.isArray(brut) ? (brut as Entite[]) : page.donnees
      poserDistant(nom, { donnees, chargement: false })
    },
    (e: unknown) => {
      poserDistant(nom, {
        erreur: e instanceof Error ? e : new Error('Chargement impossible'),
        chargement: false,
      })
    },
  )
  CHARGEMENTS_EN_COURS.set(nom, tache)
  void tache.finally(() => {
    CHARGEMENTS_EN_COURS.delete(nom)
  })
}

function abonnerDistant(nom: string, cb: () => void) {
  let ecouteurs = ECOUTEURS_DISTANT.get(nom)
  if (!ecouteurs) {
    ecouteurs = new Set()
    ECOUTEURS_DISTANT.set(nom, ecouteurs)
  }
  ecouteurs.add(cb)
  return () => {
    ecouteurs.delete(cb)
  }
}

export function useCollection<T extends Entite>(nom: string, graine: readonly T[]) {
  const a = useAtelier()
  const endpoint = endpointDe(nom)
  const distantActif = estActif() && !!endpoint
  const entree = useSyncExternalStore(
    useCallback((cb: () => void) => abonnerDistant(nom, cb), [nom]),
    () => entreeDistante(nom),
    () => entreeDistante(nom),
  )
  const itemsDistants = entree.donnees as T[] | null
  const chargement = entree.chargement
  const erreur = entree.erreur

  useEffect(() => {
    if (!distantActif || !endpoint) return
    chargerDistant(nom, endpoint)
    // Les travaux avancent côté backend : le centre de tâches les suit sans
    // rechargement manuel. Les autres collections se relisent à la navigation.
    const rafraichissement =
      nom === 'jobs' || nom === 'jobs-plateforme'
        ? setInterval(() => chargerDistant(nom, endpoint), 10000)
        : undefined
    return () => {
      if (rafraichissement) clearInterval(rafraichissement)
    }
  }, [distantActif, endpoint, nom])

  const recharger = useCallback(() => {
    if (endpoint && estActif()) chargerDistant(nom, endpoint)
  }, [endpoint, nom])

  return useMemo(() => {
    const items = itemsDistants ?? a.lire<T>(nom, graine)

    /**
     * Nom exact exigé par l’API pour confirmer une suppression — le champ
     * varie par ressource (`code` pour un espace, `adresse` pour une IP…,
     * voir `champConfirmation`). Un écart renvoie `422` sans rien détruire.
     */
    const nomConfirmation = (id: string): string => {
      const cible = items.find((x) => x.id === id) as
        | (T & Record<string, unknown>)
        | undefined
      const candidat = cible?.[champConfirmation(nom)] ?? cible?.nom ?? cible?.code
      return typeof candidat === 'string' && candidat.length > 0 ? candidat : id
    }

    return {
      items,
      /** Vrai pendant le premier chargement distant — la graine reste affichée. */
      chargement,
      /** Échec du dernier chargement ou rechargement distant, le cas échéant. */
      erreur,
      /** Relit la collection depuis l’API. Sans effet en mode maquette. */
      recharger,
      creer: (item: T | T[], ou: 'debut' | 'fin' = 'debut') => {
        if (distantActif && endpoint) {
          const corps = Array.isArray(item) ? item[0] : item
          creerRessource(endpoint, corps).then(recharger, recharger)
          return
        }
        a.creer(nom, graine, item, ou)
      },
      modifier: (id: string, patch: Patch<T>) => {
        if (distantActif && endpoint) {
          const base = items.find((x) => x.id === id)
          if (typeof patch === 'function' && !base) return
          const corps = typeof patch === 'function' ? (patch as (item: T) => Partial<T>)(base as T) : patch
          modifierRessource(endpoint, id, corps).then(recharger, recharger)
          return
        }
        a.modifier(nom, graine, id, patch)
      },
      modifierPlusieurs: (ids: string[], patch: Patch<T>) => {
        if (distantActif && endpoint) {
          const appels = ids.flatMap((id) => {
            const base = items.find((x) => x.id === id)
            if (typeof patch === 'function' && !base) return []
            const corps =
              typeof patch === 'function' ? (patch as (item: T) => Partial<T>)(base as T) : patch
            return [modifierRessource(endpoint, id, corps)]
          })
          Promise.all(appels).then(recharger, recharger)
          return
        }
        a.modifierPlusieurs(nom, graine, ids, patch)
      },
      supprimer: (id: string | string[], confirmation?: string) => {
        if (distantActif && endpoint) {
          const cibles = Array.isArray(id) ? id : [id]
          Promise.all(
            cibles.map((c) =>
              supprimerRessource(
                endpoint,
                c,
                // `confirmation` explicite (un courriel de membre, par exemple,
                // que la collection ne porte pas) sinon le champ de la ressource.
                !Array.isArray(id) && confirmation ? confirmation : nomConfirmation(c),
              ),
            ),
          ).then(recharger, recharger)
          return
        }
        a.supprimer(nom, graine, id)
      },
      identifiant: a.identifiant,
    }
  }, [a, nom, graine, endpoint, distantActif, itemsDistants, chargement, erreur, recharger])
}

/** Une entité de la collection, par identifiant. */
export function useEntite<T extends Entite>(nom: string, graine: readonly T[], id: string) {
  const { items, modifier, supprimer } = useCollection<T>(nom, graine)
  const endpoint = endpointDe(nom)
  const distantActif = estActif() && !!endpoint
  // Page de détail ouverte sans la liste en cache (lien direct, nouvel onglet) :
  // la ressource se charge seule au lieu d’afficher « introuvable ».
  const manque = distantActif && id.length > 0 && !items.some((x) => x.id === id)
  useEffect(() => {
    if (!manque || !endpoint) return
    let annule = false
    requete<T>(`${endpoint}/${encodeURIComponent(id)}`).then(
      (item) => {
        if (!annule && item && typeof item === 'object') integrerDistant(nom, item as Entite)
      },
      () => {
        // 404 ou réseau : l’écran garde son état « introuvable », qui dit
        // déjà ce qu’il ne trouve pas sans casser la page.
      },
    )
    return () => {
      annule = true
    }
  }, [manque, endpoint, nom, id])
  return {
    entite: items.find((x) => x.id === id),
    modifier: (patch: Patch<T>) => modifier(id, patch),
    supprimer: () => supprimer(id),
  }
}
