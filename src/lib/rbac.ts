/**
 * Matrice RBAC — Synelia Cloud (spécification Partie 10).
 *
 * Deux familles de rôles seulement : l'équipe Synelia qui exploite la
 * plateforme, et l'organisation cliente. Aucun rôle intermédiaire de type
 * revendeur ou apporteur d'affaires — la plateforme ne vend qu'en direct.
 *
 * Règle de rendu : une action interdite n'est pas masquée, elle est
 * désactivée avec une infobulle qui nomme le rôle requis. Les refus sont
 * journalisés dans l'audit.
 */

import { ROLE_LABEL, type Role } from './types'

/** `●` autorisé · `◐` lecture seule · `—` interdit */
export type Permission = 'full' | 'read' | 'none'

export const ROLES_ORDRE: Role[] = [
  'super_admin',
  'platform_operator',
  'org_admin',
  'espace_admin',
  'project_owner',
  'operator',
  'service_admin',
  'billing_manager',
  'compliance',
  'read_only',
]

export interface ActionRbac {
  id: string
  libelle: string
  groupe: string
  perms: Record<Role, Permission>
}

/** Fabrique compacte : chaîne de 10 caractères dans l'ordre de `ROLES_ORDRE`. */
function ligne(id: string, libelle: string, groupe: string, motif: string): ActionRbac {
  const perms = {} as Record<Role, Permission>
  ROLES_ORDRE.forEach((role, i) => {
    const c = motif[i]
    perms[role] = c === '●' ? 'full' : c === '◐' ? 'read' : 'none'
  })
  return { id, libelle, groupe, perms }
}

//                                                          SA PO OA EA PO OP SA BI CO RO
export const MATRICE_RBAC: ActionRbac[] = [
  ligne('org.dashboard.view', 'Voir le tableau de bord org', 'Organisation',
        '●●●●◐◐◐◐◐◐'),
  ligne('espace.create', 'Créer un Espace Cloud', 'Infrastructure',
        '●—●●——————'),
  ligne('espace.quota.update', "Modifier le quota d'un espace", 'Infrastructure',
        '●—●●◐—————'),
  ligne('vm.create_delete', 'Créer / supprimer une VM', 'Infrastructure',
        '●●●●●—————'),
  ligne('vm.power', 'Démarrer / arrêter une VM', 'Infrastructure',
        '●●●●●●●———'),
  ligne('vm.hardware.update', 'Modifier le matériel virtuel', 'Infrastructure',
        '●●●●●—————'),
  ligne('network.manage', 'Gérer réseau, IP, pare-feu', 'Infrastructure',
        '●●●●●—————'),
  ligne('lb.create', 'Créer un load balancer', 'Infrastructure',
        '●●●●●—————'),
  ligne('backup.plan.write', 'Créer / modifier un plan de sauvegarde', 'Protection',
        '●●●●●——●—◐'),
  ligne('backup.restore', 'Lancer une restauration', 'Protection',
        '●●●●●——●——'),
  ligne('dr.failover.real', 'Déclencher une bascule PRA réelle', 'Protection',
        '●—●●——————'),
  ligne('dr.failover.test', 'Déclencher une bascule PRA de test', 'Protection',
        '●●●●●———◐—'),
  ligne('app.deploy', 'Déployer une application', 'Plateforme applicative',
        '●●●●●●————'),
  ligne('app.rollback', "Rollback d'un déploiement", 'Plateforme applicative',
        '●●●●●●————'),
  ligne('component.restart', 'Redémarrer un composant', 'Plateforme applicative',
        '●●●●●●●———'),
  ligne('secrets.update', 'Modifier variables et secrets', 'Plateforme applicative',
        '●—●●●●————'),
  ligne('marketplace.subscribe', 'Souscrire un service du marketplace', 'Services',
        '●—●●——————'),
  ligne('seat.assign', 'Attribuer / retirer un siège', 'Services',
        '●●●●———●——'),
  ligne('service.open', 'Ouvrir un service managé (SSO)', 'Services',
        '●●●●●●●●—●'),
  ligne('service.admin', 'Administrer un service managé', 'Services',
        '●●●●———●——'),
  ligne('ia.agent.write', 'Créer / modifier un agent', 'Intelligence artificielle',
        '●—●●●—————'),
  ligne('ia.agent.publish', 'Publier un agent ou revenir à une version', 'Intelligence artificielle',
        '●—●●——————'),
  ligne('ia.flow.write', "Modifier un flux d'orchestration", 'Intelligence artificielle',
        '●—●●●—————'),
  ligne('ia.tool.register', 'Déclarer un outil ou un canal', 'Intelligence artificielle',
        '●—●●——————'),
  ligne('ia.key.manage', "Créer / révoquer une clé d'accès IA", 'Intelligence artificielle',
        '●●●●●—————'),
  ligne('ia.routing.update', 'Modifier le routage et les garde-fous', 'Intelligence artificielle',
        '●—●●——————'),
  ligne('ia.knowledge.write', 'Créer / réindexer une base de connaissances', 'Intelligence artificielle',
        '●—●●●—————'),
  ligne('ia.budget.update', 'Modifier le plafond de dépense IA', 'Intelligence artificielle',
        '●—●————●——'),
  ligne('member.invite', 'Inviter un membre / changer un rôle', 'Organisation',
        '●—●●◐—————'),
  ligne('sso.configure', 'Configurer la fédération SSO', 'Organisation',
        '●—●●——————'),
  ligne('invoice.view', 'Voir les factures', 'Finance',
        '●◐●●———●——'),
  ligne('payment.update', 'Modifier les moyens de paiement', 'Finance',
        '●—●●———●——'),
  ligne('audit.view', "Voir le journal d'audit de l'org", 'Conformité',
        '●●●●◐———●◐'),
  ligne('compliance.export', 'Exporter un rapport de conformité', 'Conformité',
        '●●●●————●—'),
  ligne('capacity.manage', 'Gérer la capacité et les backends', 'Plateforme',
        '●●————————'),
  ligne('catalog.edit', 'Éditer le catalogue et les tarifs', 'Plateforme',
        '●—————————'),
  ligne('org.manage', 'Créer / suspendre une organisation cliente', 'Plateforme',
        '●—————————'),
]

const INDEX = new Map(MATRICE_RBAC.map((a) => [a.id, a]))

/** Permission d'un rôle sur une action. Action inconnue → autorisée. */
export function can(role: Role, actionId: string): Permission {
  const action = INDEX.get(actionId)
  if (!action) return 'full'
  return action.perms[role] ?? 'none'
}

export function isAllowed(role: Role, actionId: string): boolean {
  return can(role, actionId) === 'full'
}

/** Rôles capables d'exécuter pleinement l'action — pour l'infobulle. */
export function rolesRequis(actionId: string): Role[] {
  const action = INDEX.get(actionId)
  if (!action) return []
  return ROLES_ORDRE.filter((r) => action.perms[r] === 'full')
}

/**
 * Message d'infobulle qui nomme le rôle requis, conformément à la règle de
 * rendu : « Cette action demande le rôle Espace Cloud Admin ».
 */
export function messageRefus(actionId: string): string {
  const roles = rolesRequis(actionId).filter(
    (r) => r !== 'super_admin' && r !== 'platform_operator',
  )
  const cible = roles.length ? roles : rolesRequis(actionId)
  if (!cible.length) return 'Action réservée à Synelia.'
  const noms = cible.slice(0, 2).map((r) => ROLE_LABEL[r])
  return `Cette action demande le rôle ${noms.join(' ou ')}.`
}

export function libelleAction(actionId: string): string {
  return INDEX.get(actionId)?.libelle ?? actionId
}

/** Rôles simulables depuis le sélecteur de l'espace client (§4.1). */
export const ROLES_CLIENT: Role[] = [
  'org_admin',
  'espace_admin',
  'project_owner',
  'operator',
  'service_admin',
  'billing_manager',
  'compliance',
  'read_only',
]

/** Rôles de l'équipe Synelia, simulables depuis l'espace super admin. */
export const ROLES_SUPER_ADMIN: Role[] = ['super_admin', 'platform_operator']

export const GROUPES_RBAC = Array.from(new Set(MATRICE_RBAC.map((a) => a.groupe)))
