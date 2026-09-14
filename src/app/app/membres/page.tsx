'use client'

import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, relatif } from '@/lib/format'
import {
  ESPACES,
  MEMBERSHIPS,
  ORG_COURANTE,
  USERS,
  UTILISATEUR_COURANT,
  userById,
} from '@/lib/mock'
import { ROLES_CLIENT, MATRICE_RBAC, can, rolesRequis } from '@/lib/rbac'
import { ROLE_LABEL, type Membership, type Role } from '@/lib/types'
import { MAINTENANT } from '@/lib/format'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Avatar, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { ConfirmDialog, Drawer, Modal, Tooltip } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { RoleMatrix } from '@/components/business/rbac-canvas'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, requete, supprimerRessource } from '@/lib/api/client'

interface Invitation {
  id: string
  email: string
  role: Role
  /** Maquette. Le backend renvoie `expire` + `statut` — les deux sont lus. */
  envoyee?: string
  par?: string
  expire?: string
  statut?: string
}

/** Invitations en attente — le jeu de données n'en a pas de table. */
const INVITATIONS: Invitation[] = [
  {
    id: 'inv-1',
    email: 'n.bamba@dba.africa',
    role: 'project_owner',
    envoyee: '2026-08-18T10:04:00Z',
    par: 'Léa Konan',
  },
  {
    id: 'inv-2',
    email: 'consultant@partenaire-abj.ci',
    role: 'read_only',
    envoyee: '2026-08-16T14:22:00Z',
    par: 'Léa Konan',
  },
]

const ONGLETS = [
  { id: 'membres', label: 'Membres' },
  { id: 'invitations', label: 'Invitations' },
  { id: 'roles', label: 'Rôles & permissions' },
  { id: 'portees', label: 'Portées' },
]

interface LigneMembre {
  id: string
  nom: string
  email: string
  role: Role
  portee: string
  mfa: boolean
  source: string
  dernier?: string
  statut: string
}

export default function Membres() {
  const maintenant = useMaintenant()
  const { autorise, refus, role: roleCourant, organisations, organisationId } = useApp()
  const orgActive = organisations.find((o) => o.id === organisationId) ?? organisations[0]
  const nomOrg = orgActive?.nom ?? ORG_COURANTE.nom
  const executer = useOperation()
  const adhesions = useCollection<Membership>('memberships', MEMBERSHIPS)
  const invitations = useCollection<Invitation>('invitations', INVITATIONS)
  // Les Espaces Cloud existent en tant que collection API à part entière : les
  // lire depuis la maquette locale montrerait les trois espaces de démonstration
  // même quand l’organisation réelle en a d’autres.
  const espacesDistants = useCollection('espaces', ESPACES)
  const ESPACES_LUS = estActif() ? espacesDistants.items : ESPACES
  const [onglet, setOnglet] = useState('membres')
  const [invitation, setInvitation] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [retrait, setRetrait] = useState<LigneMembre | null>(null)
  const [roleSurligne, setRoleSurligne] = useState<Role | undefined>(roleCourant)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('read_only')
  const [invitePortee, setInvitePortee] = useState('org')
  const [inviteMfa, setInviteMfa] = useState(true)
  const [inviteMessage, setInviteMessage] = useState(false)
  const [attribMembre, setAttribMembre] = useState('')
  const [attribRole, setAttribRole] = useState<Role>('project_owner')
  const [attribPortee, setAttribPortee] = useState('org')

  const membres = adhesions.items
    // Le backend filtre déjà par organisation active ; la maquette, non.
    .filter((m) => estActif() || m.orgId === ORG_COURANTE.id)
    // En mode API l’utilisateur arrive embarqué (`utilisateur`) : les
    // identifiants du backend sont inconnus du jeu de données local.
    .map((m) => ({
      membership: m,
      user: userById(m.userId) ?? (m as unknown as { utilisateur?: (typeof USERS)[number] }).utilisateur,
    }))
    .flatMap((x) => (x.user ? [x as { membership: Membership; user: (typeof USERS)[number] }] : []))
  const lignes: LigneMembre[] = membres.map(({ membership: m, user: u }) => ({
    id: m.id,
    nom: u.nom,
    email: u.email,
    role: m.role,
    portee:
      m.scopeLabel ??
      (m.scopeType === 'org'
        ? 'Toute l’organisation'
        : (() => {
            const espace = ESPACES_LUS.find((e) => e.id === m.scopeId)
            return espace ? `Espace ${espace.code}` : m.scopeType
          })()),
    mfa: u.mfaEnabled,
    source: u.idpSource,
    dernier: u.lastLoginAt,
    statut: u.statut ?? 'actif',
  }))

  const sansMfa = lignes.filter((l) => !l.mfa).length
  const admins = lignes.filter((l) => l.role === 'org_admin').length
  const membreDetail = lignes.find((l) => l.id === detail)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Membres & rôles' }]}
        titre="Membres & rôles"
        sousTitre="Qui a le droit de faire quoi, et sur quel périmètre. Les rôles sont volontairement nombreux et étroits : donner à un développeur le droit de déployer ne devrait pas lui donner celui de voir les factures."
        actions={
          <GatedAction autorise={autorise('member.invite')} message={refus('member.invite')}>
            <Button iconBefore={<UserPlus size={14} />} onClick={() => setInvitation(true)}>
              Inviter un membre
            </Button>
          </GatedAction>
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {nomOrg}
            </Badge>
            <Badge tone="neutral" size="sm">
              {lignes.length} membres
            </Badge>
          </>
        }
      />

      {sansMfa > 0 && (
        <Callout ton="warn" titre={`${sansMfa} membre sans deuxième facteur d’authentification`}>
          Un mot de passe seul se retrouve dans une fuite de données tôt ou tard. Vous pouvez rendre le
          deuxième facteur obligatoire pour toute l’organisation depuis les réglages d’identité — les
          membres concernés devront l’activer à leur prochaine connexion.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Membres actifs" valeur={lignes.filter((l) => l.statut === 'actif').length} ton="ok" />
        <StatTile
          libelle="Administrateurs"
          valeur={admins}
          ton={admins > 3 ? 'warn' : 'violet'}
          detail={admins > 3 ? 'Beaucoup pour cette taille d’organisation' : 'Accès complet à l’organisation'}
        />
        <StatTile
          libelle="Deuxième facteur"
          valeur={lignes.length - sansMfa}
          detail={`sur ${lignes.length} membres`}
          ton={sansMfa === 0 ? 'ok' : 'warn'}
        />
        <StatTile
          libelle="Comptes fédérés"
          valeur={lignes.filter((l) => l.source !== 'local').length}
          detail="Via votre annuaire d’entreprise"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'membres' && (
        <Card padding={false}>
          <div className="p-4">
            <DataTable<LigneMembre>
              lignes={lignes}
              exportable
              placeholderRecherche="Rechercher un membre…"
              filtres={[
                {
                  id: 'role',
                  libelle: 'Rôle',
                  options: [
                    { value: 'tous', label: 'Tous les rôles' },
                    ...ROLES_CLIENT.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
                  ],
                },
                {
                  id: 'mfa',
                  libelle: 'Deuxième facteur',
                  options: [
                    { value: 'tous', label: 'Tous' },
                    { value: 'oui', label: 'Activé' },
                    { value: 'non', label: 'Absent' },
                  ],
                },
              ]}
              selection={(l, fid, val) => {
                if (fid === 'role') return l.role === val
                if (fid === 'mfa') return val === 'oui' ? l.mfa : !l.mfa
                return true
              }}
              colonnes={[
                {
                  id: 'nom',
                  entete: 'Membre',
                  cle: (l) => `${l.nom} ${l.email}`,
                  rendu: (l) => (
                    <span className="flex items-center gap-2.5">
                      <Avatar nom={l.nom} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">
                          {l.nom}
                          {l.email === UTILISATEUR_COURANT.email && (
                            <span className="ml-1.5 text-[10.5px] font-normal text-g-500">(vous)</span>
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-g-500">{l.email}</span>
                      </span>
                    </span>
                  ),
                },
                {
                  id: 'role',
                  entete: 'Rôle',
                  cle: (l) => ROLE_LABEL[l.role],
                  rendu: (l) => (
                    <Tooltip
                      content={`${MATRICE_RBAC.filter((a) => can(l.role, a.id) === 'full').length} actions autorisées sur ${MATRICE_RBAC.length}`}
                    >
                      <Badge tone={l.role === 'org_admin' ? 'violet' : 'neutral'} size="sm">
                        {ROLE_LABEL[l.role]}
                      </Badge>
                    </Tooltip>
                  ),
                },
                {
                  id: 'portee',
                  entete: 'Portée',
                  cle: (l) => l.portee,
                  rendu: (l) => <span className="text-[11.5px] text-g-700">{l.portee}</span>,
                },
                {
                  id: 'mfa',
                  entete: 'Deuxième facteur',
                  aligne: 'center',
                  cle: (l) => (l.mfa ? 1 : 0),
                  rendu: (l) =>
                    l.mfa ? (
                      <Badge tone="ok" size="sm">
                        Actif
                      </Badge>
                    ) : (
                      <Badge tone="warn" dot size="sm">
                        Absent
                      </Badge>
                    ),
                },
                {
                  id: 'source',
                  entete: 'Identité',
                  cle: (l) => l.source,
                  masquable: true,
                  rendu: (l) => (
                    <span className="text-[11.5px] text-g-700">
                      {l.source === 'local'
                        ? 'Compte Synelia'
                        : l.source === 'oidc'
                          ? 'OpenID Connect'
                          : l.source === 'saml'
                            ? 'SAML'
                            : 'Annuaire LDAP'}
                    </span>
                  ),
                },
                {
                  id: 'dernier',
                  entete: 'Dernière connexion',
                  aligne: 'right',
                  cle: (l) => l.dernier ?? '',
                  rendu: (l) => (
                    <span className="text-[11.5px] text-g-500">
                      {l.dernier ? relatif(l.dernier, maintenant) : 'Jamais connecté'}
                    </span>
                  ),
                },
                {
                  id: 'actions',
                  entete: '',
                  aligne: 'right',
                  rendu: (l) => (
                    <span className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(l.id)}>
                        Détail
                      </Button>
                      <GatedAction autorise={autorise('member.invite')} message={refus('member.invite')}>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={l.email === UTILISATEUR_COURANT.email}
                          onClick={() => setRetrait(l)}
                        >
                          Retirer
                        </Button>
                      </GatedAction>
                    </span>
                  ),
                },
              ]}
              vide={{
                titre: 'Aucun membre',
                phrase: 'Invitez les personnes de votre équipe et attribuez-leur un rôle.',
              }}
            />
          </div>
        </Card>
      )}

      {onglet === 'invitations' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Invitations en attente"
              sousTitre="Une invitation expire au bout de sept jours. Le lien est à usage unique."
            />
            <div className="space-y-2">
              {invitations.items
                // Le backend renvoie toutes les invitations, quel que soit leur
                // statut (`GET /invitations` sans filtre) : une invitation
                // relancée ou annulée doit disparaître d'ici, pas rester
                // affichée « en attente » avec ses boutons actifs.
                .filter((i) => !i.statut || i.statut === 'en_attente')
                .map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                      <Mail size={12} className="shrink-0 text-g-500" />
                      {i.email}
                    </span>
                    <span className="block text-[11px] text-g-500">
                      {ROLE_LABEL[i.role]} ·{' '}
                      {i.envoyee
                        ? `envoyée ${relatif(i.envoyee, maintenant)}${i.par ? ` par ${i.par}` : ''}`
                        : `expire le ${i.expire ? dateCourte(i.expire) : '—'}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Badge tone="info" size="sm">
                      En attente
                    </Badge>
                    <BoutonAction
                      libelle="Relancer"
                      variant="ghost"
                      operation={{
                        action: 'member.invite',
                        titre: `Invitation renvoyée à ${i.email}`,
                        detail: 'Le lien précédent est invalidé : seul le dernier fonctionne.',
                        appel: () =>
                          requete(`/invitations/${encodeURIComponent(i.id)}/relance`, {
                            methode: 'POST',
                            corps: {},
                          }),
                        effet: () => invitations.modifier(i.id, { envoyee: MAINTENANT }),
                        effetFinal: () => invitations.recharger(),
                      }}
                    />
                    <BoutonAction
                      libelle="Annuler"
                      variant="ghost"
                      operation={{
                        action: 'member.invite',
                        ton: 'warn',
                        titre: `Invitation de ${i.email} annulée`,
                        detail: 'Le lien devient inutilisable immédiatement.',
                        // Sans `confirmation` : le backend n’en exige pas pour
                        // une invitation (le lien seul porte le risque).
                        appel: () => supprimerRessource('/invitations', i.id),
                        effet: () => invitations.supprimer(i.id),
                        effetFinal: () => invitations.recharger(),
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="Nous n’envoyons jamais de mot de passe">
              L’invitation mène à la création d’une identité chez notre fournisseur d’identité, où la
              personne choisit son mot de passe et active son deuxième facteur. Aucun mot de passe ne
              transite par courriel, et ce portail n’en stocke aucun.
            </Callout>
          </Card>

          <Card>
            <CardHeader
              titre="Invitations acceptées récemment"
              sousTitre="Trente derniers jours."
            />
            <div className="space-y-1.5">
              {[
                { email: 'k.toure@dba.africa', role: 'app_admin' as Role, quand: '2026-08-02T09:14:00Z' },
                { email: 'm.diallo@dba.africa', role: 'billing_admin' as Role, quand: '2026-07-28T16:41:00Z' },
                { email: 'audit@partenaire.com', role: 'read_only' as Role, quand: '2026-07-24T11:08:00Z' },
              ].map((i) => (
                <div
                  key={i.email}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-g-100 pb-1.5 last:border-0"
                >
                  <span className="min-w-0 text-[12px] text-ink">{i.email}</span>
                  <span className="shrink-0 text-[10.5px] text-g-500">
                    {ROLE_LABEL[i.role]} · {dateCourte(i.quand)}
                  </span>
                </div>
              ))}
            </div>
            <ButtonLink size="sm" variant="ghost" className="mt-3" href="/app/securite">
              Voir le journal d’audit
            </ButtonLink>
          </Card>
        </div>
      )}

      {onglet === 'roles' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Matrice des permissions"
              sousTitre="Ce que chaque rôle peut faire. Cette matrice est la source de vérité : le portail ne cache jamais une action interdite, il l’affiche désactivée en nommant le rôle requis."
              actions={
                <Select
                  value={roleSurligne ?? ''}
                  onChange={(e) => setRoleSurligne((e.target.value || undefined) as Role | undefined)}
                  className="w-auto"
                >
                  <option value="">Aucun rôle surligné</option>
                  {ROLES_CLIENT.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              }
            />
            <RoleMatrix roles={ROLES_CLIENT} roleSurligne={roleSurligne} />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Choisir le bon rôle"
                sousTitre="Le principe : le droit minimum pour faire le travail."
              />
              <div className="space-y-2.5">
                {[
                  {
                    r: 'org_admin' as Role,
                    quand: 'La personne qui décide de l’architecture, des quotas et des accès. Deux ou trois personnes suffisent, y compris dans une grande organisation.',
                  },
                  {
                    r: 'infra_admin' as Role,
                    quand: 'Crée et exploite les machines, les réseaux et le stockage, sans toucher aux factures ni aux accès.',
                  },
                  {
                    r: 'app_admin' as Role,
                    quand: 'Déploie, redéploie et revient en arrière sur les applications. Ne peut pas créer d’espace ni modifier un quota.',
                  },
                  {
                    r: 'billing_admin' as Role,
                    quand: 'Voit les factures, les devis et les moyens de paiement. Ne voit aucune ressource technique.',
                  },
                  {
                    r: 'read_only' as Role,
                    quand: 'Consultation seule, sur tout le périmètre technique. Le rôle à donner à un auditeur externe ou à un nouvel arrivant.',
                  },
                ].map((x) => (
                  <div key={x.r} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px] font-bold text-ink">{ROLE_LABEL[x.r]}</span>
                      <Badge tone="neutral" size="sm">
                        {MATRICE_RBAC.filter((a) => can(x.r, a.id) === 'full').length} actions
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">{x.quand}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Les actions les plus sensibles"
                sousTitre="Celles qu’un rôle unique détient, et qu’il faut donc attribuer avec attention."
              />
              <div className="space-y-2">
                {['dr.failover.real', 'espace.quota.update', 'payment.update', 'sso.configure', 'secrets.update'].map(
                  (id) => {
                    const a = MATRICE_RBAC.find((x) => x.id === id)
                    if (!a) return null
                    const roles = rolesRequis(id).filter((r) => ROLES_CLIENT.includes(r))
                    return (
                      <div key={id} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                        <p className="text-[12.5px] font-semibold text-ink">{a.libelle}</p>
                        <p className="mt-1 flex flex-wrap gap-1">
                          {roles.length === 0 ? (
                            <Badge tone="neutral" size="sm">
                              Réservée au fournisseur
                            </Badge>
                          ) : (
                            roles.map((r) => (
                              <Badge key={r} tone="violet" size="sm">
                                {ROLE_LABEL[r]}
                              </Badge>
                            ))
                          )}
                        </p>
                      </div>
                    )
                  },
                )}
              </div>
              <Callout ton="violet" className="mt-4" titre="Un refus est journalisé">
                Quand quelqu’un tente une action que son rôle n’autorise pas, l’action est refusée et
                la tentative apparaît dans le journal d’audit avec le nom de la personne, l’action
                visée et le rôle manquant. Ce n’est pas une punition : c’est ce qui permet de
                s’apercevoir qu’un rôle est mal calibré.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'portees' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Portées d’attribution"
              sousTitre="Un rôle peut s’appliquer à toute l’organisation, à un Espace Cloud précis, ou à une seule application. Un développeur n’a pas besoin d’un droit de déploiement sur la production de tous les projets."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Portée', 'Ce qu’elle couvre', 'Cas d’usage typique'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      p: 'Organisation',
                      c: 'Tous les espaces, toutes les applications, tous les services managés.',
                      u: 'Administrateur de l’organisation, responsable de la facturation, auditeur.',
                    },
                    {
                      p: 'Espace Cloud',
                      c: 'Les machines, réseaux, volumes et bases d’un espace donné.',
                      u: 'Équipe d’exploitation dédiée à un environnement, prestataire d’infogérance.',
                    },
                    {
                      p: 'Application',
                      c: 'Les environnements, composants et déploiements d’une application.',
                      u: 'Équipe de développement produit, prestataire externe sur un projet précis.',
                    },
                    {
                      p: 'Service managé',
                      c: 'L’administration d’un service du catalogue et l’attribution de ses sièges.',
                      u: 'Responsable bureautique pour la messagerie et le partage de fichiers.',
                    },
                  ].map((x) => (
                    <tr key={x.p} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <Badge tone="violet" size="sm">
                          {x.p}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink">{x.c}</td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-500">{x.u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader titre="Attributions par espace" />
              <div className="space-y-2">
                {ESPACES_LUS.map((e) => {
                  const membresEspace = adhesions.items.filter((m) => m.scopeId === e.id)
                  return (
                    <div
                      key={e.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-[12.5px] font-semibold text-ink">
                          {e.code}
                        </span>
                        <span className="block text-[11px] text-g-500">{e.offreNom}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="flex items-center gap-1 text-[11.5px] text-g-700">
                          <Users size={12} />
                          {membresEspace.length} attribution{membresEspace.length > 1 ? 's' : ''}
                        </span>
                        <ButtonLink size="sm" variant="ghost" href={`/app/espaces/${e.id}`}>
                          Ouvrir
                        </ButtonLink>
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card>
              <CardHeader titre="Attribuer un rôle sur une portée" />
              <div className="space-y-4">
                <Field label="Membre">
                  <Select
                    value={attribMembre || (lignes[0]?.id ?? '')}
                    onChange={(e) => setAttribMembre(e.target.value)}
                  >
                    {lignes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nom} — {l.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Rôle">
                  <Select value={attribRole} onChange={(e) => setAttribRole(e.target.value as Role)}>
                    {ROLES_CLIENT.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Portée" hint="restreindre le rôle à un périmètre précis">
                  <Select value={attribPortee} onChange={(e) => setAttribPortee(e.target.value)}>
                    <option value="org">Toute l’organisation</option>
                    {ESPACES_LUS.map((e) => (
                      <option key={e.id} value={e.id}>
                        Espace {e.code} — {e.offreNom}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <GatedAction autorise={autorise('member.invite')} message={refus('member.invite')}>
                <Button
                  className="mt-4"
                  onClick={() => {
                    const cible = lignes.find((l) => l.id === (attribMembre || lignes[0]?.id))
                    const espace = ESPACES_LUS.find((e) => e.id === attribPortee)
                    executer({
                      action: 'member.invite',
                      titre: 'Attribution enregistrée',
                      detail: `${cible?.nom ?? ''} · ${ROLE_LABEL[attribRole]} sur ${espace ? `l’espace ${espace.code}` : 'toute l’organisation'}. Effet immédiat, sans nouvelle connexion.`,
                      appel: () =>
                        creerRessource('/membres', {
                          userId: adhesions.items.find((m) => m.id === cible?.id)?.userId,
                          role: attribRole,
                          scopeType: espace ? 'espace' : 'org',
                          scopeId: espace?.id,
                        }),
                      effet: () =>
                        cible
                          ? adhesions.creer({
                              id: adhesions.identifiant('mb'),
                              userId:
                                adhesions.items.find((m) => m.id === cible.id)?.userId ?? cible.id,
                              orgId: ORG_COURANTE.id,
                              role: attribRole,
                              scopeType: espace ? 'espace' : 'org',
                              scopeId: espace?.id,
                              scopeLabel: espace ? `Espace ${espace.code}` : undefined,
                            })
                          : undefined,
                      effetFinal: () => adhesions.recharger(),
                    })
                  }}
                >
                  Attribuer
                </Button>
              </GatedAction>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={invitation}
        onClose={() => setInvitation(false)}
        title="Inviter un membre"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInvitation(false)}>
              Annuler
            </Button>
            <Button
              disabled={!inviteEmail.trim()}
              onClick={() => {
                executer({
                  action: 'member.invite',
                  titre: `Invitation envoyée à ${inviteEmail}`,
                  detail:
                    'Le lien est valable sept jours et à usage unique. Aucun mot de passe n’est transmis par courriel.',
                  appel: () =>
                    creerRessource('/invitations', {
                      email: inviteEmail,
                      role: inviteRole,
                      scopeType: invitePortee === 'org' ? 'org' : 'espace',
                      scopeId: invitePortee === 'org' ? undefined : invitePortee,
                    }),
                  effet: () =>
                    invitations.creer({
                      id: invitations.identifiant('inv'),
                      email: inviteEmail,
                      role: inviteRole,
                      envoyee: MAINTENANT,
                      par: UTILISATEUR_COURANT.nom,
                    }),
                  effetFinal: () => invitations.recharger(),
                })
                setInviteEmail('')
                setInvitation(false)
              }}
            >
              Envoyer l’invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Adresse électronique" hint="professionnelle de préférence — elle sert d’identifiant">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="prenom.nom@dba.africa"
            />
          </Field>
          <Field label="Rôle" hint="vous pourrez le changer plus tard sans réinviter la personne">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
              {ROLES_CLIENT.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} — {MATRICE_RBAC.filter((a) => can(r, a.id) === 'full').length} actions
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Portée">
            <Select value={invitePortee} onChange={(e) => setInvitePortee(e.target.value)}>
              <option value="org">Toute l’organisation</option>
              {ESPACES_LUS.map((e) => (
                <option key={e.id} value={e.id}>
                  Espace {e.code}
                </option>
              ))}
            </Select>
          </Field>
          <div className="space-y-3">
            <Switch
              checked={inviteMfa}
              onChange={setInviteMfa}
              label="Exiger le deuxième facteur à la première connexion"
              description="La personne devra enregistrer une application d’authentification avant d’accéder au portail."
            />
            <Switch
              checked={inviteMessage}
              onChange={setInviteMessage}
              label="Ajouter un message personnalisé à l’invitation"
            />
          </div>
          <Callout ton="info" titre="Ce que la personne recevra">
            Un courriel avec un lien vers notre fournisseur d’identité, où elle choisira son mot de
            passe. Ce portail ne verra jamais ce mot de passe et n’affiche aucun champ pour le saisir.
          </Callout>
        </div>
      </Modal>

      <Drawer
        open={membreDetail !== undefined}
        onClose={() => setDetail(null)}
        title={membreDetail?.nom ?? ''}
        size="md"
      >
        {membreDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar nom={membreDetail.nom} size="lg" />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-ink">{membreDetail.nom}</p>
                <p className="text-[12px] text-g-500">{membreDetail.email}</p>
              </div>
            </div>

            <KeyValueList
              colonnes={1}
              items={[
                { cle: 'Rôle', valeur: ROLE_LABEL[membreDetail.role] },
                { cle: 'Portée', valeur: membreDetail.portee },
                {
                  cle: 'Deuxième facteur',
                  valeur: membreDetail.mfa ? 'Activé' : 'Absent — à activer',
                },
                {
                  cle: 'Source d’identité',
                  valeur:
                    membreDetail.source === 'local'
                      ? 'Compte Synelia'
                      : `Fédéré (${membreDetail.source.toUpperCase()})`,
                },
                {
                  cle: 'Dernière connexion',
                  valeur: membreDetail.dernier ? relatif(membreDetail.dernier, maintenant) : 'Jamais connecté',
                },
                { cle: 'Statut', valeur: membreDetail.statut },
              ]}
            />

            <div>
              <MicroLabel className="mb-2">Ce que ce rôle autorise</MicroLabel>
              <div className="space-y-1">
                {MATRICE_RBAC.filter((a) => can(membreDetail.role, a.id) !== 'none')
                  .slice(0, 10)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-[5px] bg-g-050 px-2.5 py-1.5"
                    >
                      <span className="min-w-0 truncate text-[11.5px] text-ink">{a.libelle}</span>
                      <Badge
                        tone={can(membreDetail.role, a.id) === 'full' ? 'ok' : 'neutral'}
                        size="sm"
                      >
                        {can(membreDetail.role, a.id) === 'full' ? 'Complet' : 'Lecture'}
                      </Badge>
                    </div>
                  ))}
              </div>
              <p className="mt-2 text-[11px] text-g-500">
                {MATRICE_RBAC.filter((a) => can(membreDetail.role, a.id) !== 'none').length} actions
                au total — voir l’onglet Rôles &amp; permissions pour la matrice complète.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-g-100 pt-4">
              <BoutonFormulaire
                libelle="Changer le rôle"
                icone={<ShieldCheck size={12} />}
                action="member.invite"
                titre={`Changer le rôle de ${membreDetail.nom}`}
                description="Le changement prend effet immédiatement, sans nouvelle connexion. Les actions interdites resteront visibles, désactivées, avec le rôle requis en infobulle."
                champs={[
                  {
                    id: 'role',
                    label: 'Rôle',
                    type: 'select',
                    options: ROLES_CLIENT.map((r) => ({
                      value: r,
                      label: `${ROLE_LABEL[r]} — ${MATRICE_RBAC.filter((a) => can(r, a.id) === 'full').length} actions`,
                    })),
                  },
                ]}
                valeursDepart={{ role: membreDetail.role }}
                libelleValider="Changer le rôle"
                operation={(v) => ({
                  titre: `${membreDetail.nom} est désormais ${ROLE_LABEL[v.role as Role]}`,
                  appel: () =>
                    requete(`/membres/${encodeURIComponent(membreDetail.id)}`, {
                      methode: 'PATCH',
                      corps: { role: v.role },
                    }),
                  effet: () => adhesions.modifier(membreDetail.id, { role: v.role as Role }),
                  effetFinal: () => adhesions.recharger(),
                })}
              />
              {!membreDetail.mfa && (
                <BoutonAction
                  libelle="Exiger le deuxième facteur"
                  variant="ghost"
                  icone={<KeyRound size={12} />}
                  operation={{
                    action: 'member.invite',
                    titre: `Deuxième facteur exigé pour ${membreDetail.nom}`,
                    detail:
                      'À sa prochaine connexion, la personne devra enregistrer une application d’authentification avant d’accéder au portail.',
                  }}
                />
              )}
              <BoutonAction
                libelle="Fermer les sessions actives"
                variant="ghost"
                operation={{
                  action: 'member.invite',
                  ton: 'warn',
                  titre: `Sessions de ${membreDetail.nom} fermées`,
                  detail: 'La personne devra se reconnecter sur tous ses appareils.',
                }}
              />
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={retrait !== null}
        onClose={() => setRetrait(null)}
        titre="Retirer un membre de l’organisation"
        ressource={retrait?.email ?? ''}
        libelleAction="Retirer le membre"
        pertes={[
          'Toutes les attributions de rôle de cette personne dans l’organisation',
          'Ses sessions actives sont fermées immédiatement',
          'Ses sièges de services managés sont libérés et redeviennent attribuables',
        ]}
        onConfirm={() => {
          const cible = retrait
          if (cible) {
            executer({
              action: 'member.invite',
              ton: 'info',
              titre: `${cible.nom} a été retiré de l’organisation`,
              detail:
                'Son identité subsiste chez notre fournisseur d’identité, mais elle n’a plus accès à vos ressources.',
              // Le backend confirme par le courriel, que l’adhésion seule
              // ne porte pas : on le passe explicitement.
              appel: () => supprimerRessource('/membres', cible.id, cible.email),
              effet: () => {
                adhesions.supprimer(cible.id)
                if (detail === cible.id) setDetail(null)
              },
              effetFinal: () => {
                adhesions.recharger()
                if (detail === cible.id) setDetail(null)
              },
            })
          }
          setRetrait(null)
        }}
      />
    </div>
  )
}
