'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { EspaceCloud, Role } from '@/lib/types'
import { can, messageRefus, type Permission } from '@/lib/rbac'
import { MAINTENANT } from '@/lib/format'
import { ESPACES, ESPACE_DEFAUT } from '@/lib/mock/iaas'
import {
  MES_ORGANISATIONS,
  ORG_COURANTE,
  ROLE_COURANT_DEFAUT,
  UTILISATEUR_COURANT,
} from '@/lib/mock/orgs'
import {
  ecrireSession,
  effacerSession,
  estActif,
  lireSession,
  requete,
  type SessionApi,
} from '@/lib/api/client'
import { AtelierProvider, useCollection } from './atelier'

export interface Toast {
  id: string
  titre: string
  detail?: string
  ton: 'ok' | 'info' | 'warn' | 'err'
}

export interface OrganisationContexte {
  id: string
  nom: string
  role: string
}

interface CtxValeur {
  /** Rôle simulé — sélecteur précieux en démonstration (§4.1). */
  role: Role
  setRole: (r: Role) => void
  /** Espace Cloud sélectionné, contexte du groupe Infrastructure (§4.1). */
  espaceId: string
  setEspaceId: (id: string) => void
  perm: (actionId: string) => Permission
  autorise: (actionId: string) => boolean
  refus: (actionId: string) => string
  toasts: Toast[]
  pousser: (t: Omit<Toast, 'id'>) => void
  retirer: (id: string) => void
  /** Vrai quand l’interface parle au backend (`NEXT_PUBLIC_API_URL`). */
  api: boolean
  /** Utilisateur de la session — maquette en mode local. */
  utilisateur: { id: string; nom: string; email: string }
  /** Organisations de la session — appartenances fictives en mode local. */
  organisations: OrganisationContexte[]
  organisationId: string
  changerOrganisation: (id: string) => void
  deconnecter: () => void
  /** Session réhydratée (toujours vrai en mode maquette). */
  pret: boolean
  connecte: boolean
  /**
   * Référence « maintenant » pour `relatif()`. Reste à `MAINTENANT` (figé)
   * en mode maquette, et pendant le rendu serveur et la première passe
   * cliente en mode API — donc pas de divergence d'hydratation — puis
   * bascule sur l'heure réelle une fois montée (§ voir l'effet ci-dessous).
   */
  maintenant: string
}

const Ctx = createContext<CtxValeur | null>(null)

interface MoiDistant {
  utilisateur?: { id: string; nom: string; email: string }
  organisationActive?: string
  roleActif?: string
  permissions?: string[]
}

export function AppProvider({
  children,
  roleInitial = ROLE_COURANT_DEFAUT,
}: {
  children: ReactNode
  roleInitial?: Role
}) {
  const router = useRouter()
  const api = estActif()
  const [roleSimule, setRoleSimule] = useState<Role>(roleInitial)
  const [espaceId, setEspaceIdBrut] = useState(ESPACE_DEFAUT.id)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [session, setSession] = useState<SessionApi | null>(null)
  const [permissions, setPermissions] = useState<string[] | null>(null)
  const [pret, setPret] = useState(!api)
  const [maintenant, setMaintenant] = useState(MAINTENANT)

  // Bascule sur l'heure réelle une fois montée, en mode API seulement — le
  // rendu serveur et la première passe cliente restent tous deux sur
  // `MAINTENANT` (déterminisme d'hydratation), l'effet ne joue qu'après.
  useEffect(() => {
    if (api) setMaintenant(new Date().toISOString())
  }, [api])

  // En mode API la session vit dans `localStorage` (voir `src/lib/api/`) :
  // on la relit au montage — jamais pendant le rendu serveur — puis on
  // demande à `/moi` les permissions effectives, qui seules décident.
  useEffect(() => {
    if (!estActif()) return
    const existante = lireSession()
    setSession(existante)
    if (!existante?.accessToken) {
      setPret(true)
      return
    }
    requete<MoiDistant>('/moi')
      .then((moi) => {
        if (moi.permissions) setPermissions(moi.permissions)
        setSession((s) =>
          s
            ? {
                ...s,
                ...(moi.roleActif ? { roleActif: moi.roleActif } : {}),
                ...(moi.organisationActive ? { organisationActive: moi.organisationActive } : {}),
                ...(moi.utilisateur ? { utilisateur: moi.utilisateur } : {}),
              }
            : s,
        )
        setPret(true)
      })
      .catch(() => setPret(true))
  }, [])

  // L’Espace choisi survit au rechargement ; la lecture se fait dans un
  // effet pour ne pas faire diverger le premier rendu client du serveur.
  const setEspaceId = useCallback((id: string) => {
    setEspaceIdBrut(id)
    try {
      window.localStorage.setItem('synelia.espace', id)
    } catch {
      // Navigation privée : le choix vit alors le temps de la session.
    }
  }, [])

  useEffect(() => {
    try {
      const memorise = window.localStorage.getItem('synelia.espace')
      if (memorise) setEspaceIdBrut(memorise)
    } catch {
      // Pas de stockage accessible : on garde l’espace par défaut.
    }
  }, [])
  const pousser = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `t-${Math.round(performance.now() * 1000)}`
    setToasts((p) => [...p, { ...t, id }])
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 5200)
  }, [])

  const retirer = useCallback((id: string) => {
    setToasts((p) => p.filter((x) => x.id !== id))
  }, [])

  const role: Role = api ? ((session?.roleActif as Role | undefined) ?? roleInitial) : roleSimule

  const setRole = useCallback(
    (r: Role) => {
      // En mode API le rôle vient du backend : le sélecteur est masqué.
      if (estActif()) return
      setRoleSimule(r)
    },
    [],
  )

  const autorise = useCallback(
    (actionId: string) =>
      estActif()
        ? (permissions?.includes(actionId) ?? false)
        : can(roleSimule, actionId) === 'full',
    [permissions, roleSimule],
  )

  const organisations: OrganisationContexte[] = useMemo(
    () =>
      api && session
        ? session.organisations.map((o) => ({ id: o.orgId, nom: o.nom, role: o.role }))
        : MES_ORGANISATIONS.map((m) => ({ id: m.org.id, nom: m.org.nom, role: m.role })),
    [api, session],
  )

  const organisationId = api ? (session?.organisationActive ?? '') : ORG_COURANTE.id

  /**
   * Change d’organisation : l’en-tête `X-Organisation-Id` suit
   * immédiatement (la session est réécrite avant l’appel), et le backend est
   * prévenu par `PUT /moi/organisation-active` pour les prochaines sessions.
   */
  const changerOrganisation = useCallback((id: string) => {
    if (!estActif()) return
    const s = lireSession()
    if (!s || s.organisationActive === id) return
    const prochaine = { ...s, organisationActive: id }
    ecrireSession(prochaine)
    setSession(prochaine)
    requete<SessionApi>('/moi/organisation-active', { methode: 'PUT', corps: { orgId: id } })
      .then((neuve) => {
        ecrireSession(neuve)
        setSession(neuve)
      })
      .catch(() => {
        // L’en-tête suffit pour les lectures : le backend mémorisera au
        // prochain appel qui passe.
      })
  }, [])

  const deconnecter = useCallback(() => {
    if (estActif()) {
      requete('/auth/deconnexion', { methode: 'POST', corps: {} }).catch(() => {})
      effacerSession()
      setSession(null)
      setPermissions(null)
    }
    router.push('/login')
  }, [router])

  const valeur = useMemo<CtxValeur>(
    () => ({
      role,
      setRole,
      espaceId,
      setEspaceId,
      perm: (a) => can(role, a),
      autorise,
      refus: (a) => messageRefus(a),
      toasts,
      pousser,
      retirer,
      api,
      utilisateur:
        api && session
          ? session.utilisateur
          : { id: UTILISATEUR_COURANT.id, nom: UTILISATEUR_COURANT.nom, email: UTILISATEUR_COURANT.email },
      organisations,
      organisationId,
      changerOrganisation,
      deconnecter,
      pret,
      connecte: api ? !!session?.accessToken : true,
      maintenant,
    }),
    [
      role,
      setRole,
      espaceId,
      setEspaceId,
      autorise,
      toasts,
      pousser,
      retirer,
      api,
      session,
      organisations,
      organisationId,
      changerOrganisation,
      deconnecter,
      pret,
      maintenant,
    ],
  )

  // L'atelier est monté ici plutôt que dans chaque layout : tout écran qui a
  // accès au rôle et aux notifications a aussi besoin de l'état mutable.
  return (
    <Ctx.Provider value={valeur}>
      <AtelierProvider>{children}</AtelierProvider>
    </Ctx.Provider>
  )
}

export function useApp(): CtxValeur {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp doit être utilisé dans un AppProvider')
  return v
}

/**
 * Référence « maintenant » à passer en second argument de `relatif()` — voir
 * `CtxValeur.maintenant`. Sans elle, `relatif()` retombe sur `MAINTENANT`
 * figé, correct en mode maquette mais faux en mode API pour une donnée
 * réelle (un horodatage d'aujourd'hui s'affichait « dans 20 j »).
 */
export function useMaintenant(): string {
  return useApp().maintenant
}

/**
 * Renvoie vers `/login` quand l’API est active sans session. À monter juste
 * sous `AppProvider` dans les layouts des espaces connectés.
 */
export function GardeAuth() {
  const router = useRouter()
  const { api, pret, connecte } = useApp()
  useEffect(() => {
    if (api && pret && !connecte) router.replace('/login')
  }, [api, pret, connecte, router])
  return null
}

/**
 * Espace Cloud actuellement sélectionné. La liste vient de la collection (qui
 * suit le backend quand l’API est active). Le choix mémorisé qui n’y figure
 * plus — premier passage avec l’API, espace supprimé — retombe sur le plus
 * ancien, pas sur le dernier créé : un espace qui vient de naître est vide,
 * et l’écran des machines s’ouvrirait sur du vide.
 */
export function useEspace() {
  const { espaceId } = useApp()
  const { items } = useCollection<EspaceCloud>('espaces', ESPACES)
  const plusAncien = [...items].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]
  return items.find((e) => e.id === espaceId) ?? plusAncien ?? ESPACE_DEFAUT
}
