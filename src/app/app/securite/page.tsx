'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileCheck2, Fingerprint, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateHeure, pct, relatif } from '@/lib/format'
import { CONFORMITE, MEMBERSHIPS, ORG_COURANTE, USERS, userById } from '@/lib/mock'
import { ROLE_LABEL, type ConformiteLigne, type Membership, type Role } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Drawer } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { Regle321 } from '@/components/business/infra'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { estActif, requete, supprimerRessource } from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { BoutonAction, useOperation } from '@/components/app/actions'
import type { AuditEvent } from '@/lib/types'

interface SessionActive {
  id: string
  userId: string
  nom: string
  appareil: string
  navigateur: string
  ip: string
  lieu: string
  ouverte: string
  derniereActivite: string
  courante?: boolean
  /** Backend (`GET /securite/sessions`) : mêmes sens, autres noms. */
  utilisateurNom?: string | null
  email?: string | null
  agent?: string | null
  debut?: string
}

/** `useCollection` exige un champ `id` ; la conformité s'identifie par ressource —
 *  même collection réelle (`/sauvegarde/conformite`) que l'onglet Conformité de
 *  `/app/sauvegarde`, ne pas la relire depuis la graine ici. */
type ConformiteAvecId = ConformiteLigne & { id: string }
const CONFORMITE_AVEC_ID: ConformiteAvecId[] = CONFORMITE.map((c) => ({ ...c, id: c.ressourceId }))

/**
 * `GET/PUT /securite/politiques` — l’écran ne règle que trois interrupteurs :
 * on renvoie ce qu’on a lu (méthodes MFA, plages IP, durées, mot de passe)
 * avec ces réglages par-dessus, sans écraser le reste.
 */
interface PolitiquesDistantes {
  mfa: { obligatoire: boolean; methodes: string[]; delaiGraceJours?: number; exemptions?: string[] }
  session: {
    dureeMaxMin: number
    inactiviteMin: number
    sessionUniqueParUtilisateur?: boolean
    reauthentificationActionsSensibles?: boolean
  }
  restrictionIp: {
    actif: boolean
    plages: Array<{ cidr: string; libelle?: string; portee: string }>
    appliqueAuxAdmins?: boolean
  }
  motDePasse?: Record<string, unknown>
}

/**
 * Sessions ouvertes sur l'organisation. Le cahier des charges les demandait :
 * une politique de sécurité qui ne montre pas les sessions en cours ne permet
 * pas de répondre à la seule question qui compte après un départ ou un vol de
 * poste — qui est connecté, et depuis où.
 */
const SESSIONS: SessionActive[] = [
  {
    id: 'ses-1',
    userId: 'usr-1',
    nom: 'Léa Konan',
    appareil: 'MacBook Pro',
    navigateur: 'Safari 18',
    ip: '102.176.9.44',
    lieu: 'Abidjan, Côte d’Ivoire',
    ouverte: '2026-08-19T08:12:00Z',
    derniereActivite: '2026-08-19T15:18:00Z',
    courante: true,
  },
  {
    id: 'ses-2',
    userId: 'usr-1',
    nom: 'Léa Konan',
    appareil: 'iPhone 15',
    navigateur: 'Safari mobile',
    ip: '41.207.180.12',
    lieu: 'Abidjan, Côte d’Ivoire',
    ouverte: '2026-08-18T19:40:00Z',
    derniereActivite: '2026-08-19T12:02:00Z',
  },
  {
    id: 'ses-3',
    userId: 'usr-3',
    nom: 'Ali Traoré',
    appareil: 'ThinkPad T14',
    navigateur: 'Firefox 130',
    ip: '102.176.9.51',
    lieu: 'Abidjan, Côte d’Ivoire',
    ouverte: '2026-08-19T07:55:00Z',
    derniereActivite: '2026-08-19T15:04:00Z',
  },
  {
    id: 'ses-4',
    userId: 'usr-5',
    nom: 'Consultant partenaire',
    appareil: 'Windows 11',
    navigateur: 'Edge 128',
    ip: '196.201.44.7',
    lieu: 'Dakar, Sénégal',
    ouverte: '2026-08-17T09:20:00Z',
    derniereActivite: '2026-08-19T10:41:00Z',
  },
]

const ONGLETS = [
  { id: 'audit', label: 'Journal d’audit' },
  { id: 'posture', label: 'Posture de sécurité' },
  { id: 'sessions', label: 'Sessions actives' },
  { id: 'conformite', label: 'Conformité des sauvegardes' },
  { id: 'export', label: 'Export & rétention' },
]

export default function Securite() {
  const maintenant = useMaintenant()
  // Journal réel (`GET /audit`) quand le backend est joignable ; sinon l'atelier — les
  // actions faites pendant la session s'y ajoutent, refus compris, et sans atelier touché il
  // retombe sur la graine. C'est le même journal que `/admin/audit` y voit pour cette organisation.
  const { journal: journalLocal } = useAtelier()
  const { donnees: journalDistant } = useLectureDegradable<{ donnees: AuditEvent[] }>('/audit', {
    parPage: '200',
  })
  const AUDIT = journalDistant?.donnees ?? journalLocal

  const { autorise, refus, perm, pousser, organisations, organisationId } = useApp()
  const executer = useOperation()
  const sessions = useCollection<SessionActive>('sessions', SESSIONS)
  const CONFORMITE = useCollection<ConformiteAvecId>('conformite-sauvegarde', CONFORMITE_AVEC_ID).items
  // Même collection réelle (`/membres`, `Membre.utilisateur.mfaEnabled`) que
  // `/app/membres` — pas la graine `USERS`, figée et indépendante de l'org réelle.
  const adhesions = useCollection<Membership>('memberships', MEMBERSHIPS)
  const USERS_ORG = adhesions.items
    .filter((m) => estActif() || m.orgId === ORG_COURANTE.id)
    .map((m) => userById(m.userId) ?? (m as unknown as { utilisateur?: (typeof USERS)[number] }).utilisateur)
    .filter((u): u is (typeof USERS)[number] => !!u)
  // Le backend nomme les mêmes champs autrement : on normalise une fois pour
  // que l’onglet lise une seule forme (un `lieu` absent plantait l’affichage).
  // `GET /securite/sessions` ne renvoie pas de géolocalisation (pas de champ
  // `lieu`) : replier sur l'adresse IP ferait passer *toute* session réelle
  // pour « hors du pays », l'IP ne contenant jamais « Côte d'Ivoire ». On
  // distingue donc « lieu inconnu » de « lieu connu et hors du pays ».
  const sessionsNorm = sessions.items.map((x) => ({
    ...x,
    nom: x.nom ?? x.utilisateurNom ?? x.email ?? '—',
    appareil: x.appareil ?? x.agent ?? '—',
    lieuConnu: Boolean(x.lieu),
    lieu: x.lieu ?? x.ip,
    ouverte: x.ouverte ?? x.debut ?? MAINTENANT,
  }))
  const horsDuPays = sessionsNorm.filter((x) => x.lieuConnu && !x.lieu.includes('Côte d’Ivoire'))
  const nomOrg = organisations.find((o) => o.id === organisationId)?.nom ?? ORG_COURANTE.nom
  const [onglet, setOnglet] = useState('audit')
  const [detail, setDetail] = useState<string | null>(null)
  /** Politique d'organisation — les réglages non désactivables restent fixes. */
  const [mfaObligatoire, setMfaObligatoire] = useState(false)
  const [approbationProd, setApprobationProd] = useState(true)
  const [plagesIp, setPlagesIp] = useState(false)
  const [expirationSession, setExpirationSession] = useState(true)
  const [empreinteChainage, setEmpreinteChainage] = useState(true)
  const api = estActif()
  // Export réel (`POST /audit/export`) : contrat = depuis/jusqua/format(csv|json|pdf)/signature.
  // `syslog` et le périmètre (refus/admin/accès) n'ont pas d'équivalent contrat — désactivés en
  // mode API plutôt que simulés, comme « Téléchargement local » sur la restauration transverse.
  const [exportDepuis, setExportDepuis] = useState('2026-07-19')
  const [exportJusqua, setExportJusqua] = useState('2026-08-19')
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf' | 'syslog'>('csv')
  const [exportPerimetre, setExportPerimetre] = useState('tout')

  /**
   * `GET /securite/politiques` — l’approbation des déploiements et
   * l’empreinte de chaînage n’ont pas d’équivalent contrat et restent des
   * réglages d’écran. Une inactivité à zéro signifie « sans expiration ».
   */
  const [politiquesDistantes, setPolitiquesDistantes] = useState<PolitiquesDistantes | null>(null)
  const lirePolitiques = useCallback(() => {
    if (!estActif()) return
    requete<PolitiquesDistantes>('/securite/politiques').then(
      (p) => {
        setPolitiquesDistantes(p)
        setMfaObligatoire(p.mfa.obligatoire)
        setExpirationSession(p.session.inactiviteMin > 0)
        setPlagesIp(p.restrictionIp.actif)
      },
      () => {},
    )
  }, [])
  useEffect(() => {
    lirePolitiques()
  }, [lirePolitiques])

  const peutVoir = perm('audit.view') !== 'none'
  const refuses = AUDIT.filter((a) => a.result === 'refuse').length
  const evenement = AUDIT.find((a) => a.id === detail)

  const conforme321 = (c: (typeof CONFORMITE)[number]) =>
    c.regle321.copies && c.regle321.supports && c.regle321.horsSite
  const conformes = CONFORMITE.filter(conforme321).length

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Sécurité & audit' }]}
        titre="Sécurité et audit"
        sousTitre="Tout ce qui est fait sur votre organisation est enregistré : qui, quoi, quand, depuis quelle adresse, avec quel résultat. Les refus aussi — c’est souvent la ligne la plus utile du journal."
        actions={
          <BoutonAction
            libelle="Exporter le journal"
            size="md"
            icone={<Download size={14} />}
            operation={{
              action: 'compliance.export',
              titre: 'Export du journal en préparation',
              detail:
                'Le lien de téléchargement arrive par courriel et expire après 24 heures. L’empreinte de chaînage permet de vérifier que rien n’a été retouché.',
              effet: () => setOnglet('export'),
            }}
          />
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {nomOrg}
            </Badge>
            <Badge tone="neutral" size="sm">
              Rétention 24 mois
            </Badge>
            <Badge tone="ok" size="sm">
              Journal inaltérable
            </Badge>
          </>
        }
      />

      {!peutVoir && (
        <Callout ton="warn" titre="Votre rôle ne donne pas accès au journal d’audit">
          Le journal d’audit contient les noms, les adresses et les actions de tous les membres de
          l’organisation. Sa consultation est réservée aux rôles{' '}
          <span className="font-semibold">{ROLE_LABEL['org_admin']}</span> et{' '}
          <span className="font-semibold">{ROLE_LABEL['read_only']}</span>. Les statistiques
          ci-dessous restent visibles, sans les détails nominatifs.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Événements 30 jours"
          valeur={AUDIT.length * 84}
          detail={api ? 'Démonstration — pas encore une lecture réelle' : 'Toutes actions, tous membres'}
        />
        <StatTile
          libelle="Actions refusées"
          valeur={refuses}
          ton={refuses > 0 ? 'warn' : 'ok'}
          detail={refuses > 0 ? 'Rôle insuffisant ou compte désactivé' : 'Aucun refus'}
        />
        <StatTile
          libelle="Deuxième facteur"
          valeur={
            USERS_ORG.length
              ? pct(Math.round((USERS_ORG.filter((u) => u.mfaEnabled).length / USERS_ORG.length) * 100))
              : '—'
          }
          ton={USERS_ORG.every((u) => u.mfaEnabled) ? 'ok' : 'warn'}
          detail={`${USERS_ORG.filter((u) => !u.mfaEnabled).length} membre(s) sans deuxième facteur`}
        />
        <StatTile
          libelle="Règle 3-2-1 respectée"
          valeur={`${conformes}/${CONFORMITE.length}`}
          ton={conformes === CONFORMITE.length ? 'ok' : 'warn'}
          detail="Ressources protégées conformément"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'audit' && (
        <div className="space-y-4">
          {refuses > 0 && (
            <Callout ton="warn" titre={`${refuses} action refusée dans la période`}>
              Un refus n’est pas un incident de sécurité en soi : c’est le contrôle d’accès qui
              fonctionne. Mais un refus répété sur la même action par la même personne signale
              généralement un rôle mal calibré — quelqu’un a besoin d’un droit qu’il n’a pas, et
              contourne probablement en demandant à un collègue de le faire pour lui.
            </Callout>
          )}

          <Card padding={false}>
            <div className="p-4">
              <DataTable<AuditEvent>
                lignes={peutVoir ? AUDIT : []}
                parPage={12}
                exportable
                densiteInitiale="compacte"
                placeholderRecherche="Rechercher une action, un acteur, une ressource…"
                filtres={[
                  {
                    id: 'resultat',
                    libelle: 'Résultat',
                    options: [
                      { value: 'tous', label: 'Tous les résultats' },
                      { value: 'ok', label: 'Succès' },
                      { value: 'refuse', label: 'Refusé' },
                      { value: 'erreur', label: 'Erreur' },
                    ],
                  },
                  {
                    id: 'famille',
                    libelle: 'Famille d’action',
                    options: [
                      { value: 'tous', label: 'Toutes les familles' },
                      { value: 'auth', label: 'Authentification' },
                      { value: 'vm', label: 'Machines' },
                      { value: 'app', label: 'Applications' },
                      { value: 'backup', label: 'Sauvegarde' },
                      { value: 'member', label: 'Membres' },
                      { value: 'capacity', label: 'Capacité' },
                    ],
                  },
                ]}
                selection={(l, fid, val) => {
                  if (fid === 'resultat') return l.result === val
                  if (fid === 'famille') return l.action.startsWith(val)
                  return true
                }}
                colonnes={[
                  {
                    id: 'ts',
                    entete: 'Horodatage',
                    cle: (a) => a.ts,
                    rendu: (a) => (
                      <span className="block">
                        <span className="block text-[11.5px] text-ink">{dateHeure(a.ts)}</span>
                        <span className="block text-[10px] text-g-500">{relatif(a.ts, maintenant)}</span>
                      </span>
                    ),
                  },
                  {
                    id: 'acteur',
                    entete: 'Acteur',
                    cle: (a) => `${a.actor.nom} ${a.actor.email}`,
                    rendu: (a) => (
                      <span className="block">
                        <span className="block text-[11.5px] font-semibold text-ink">
                          {a.actor.nom}
                        </span>
                        <span className="block text-[10px] text-g-500">
                          {ROLE_LABEL[a.role] ?? a.role}
                          {a.actor.type !== 'user' ? ` · ${a.actor.type}` : ''}
                        </span>
                      </span>
                    ),
                  },
                  {
                    id: 'action',
                    entete: 'Action',
                    cle: (a) => a.action,
                    rendu: (a) => (
                      <span className="font-mono text-[11px] text-p-700">{a.action}</span>
                    ),
                  },
                  {
                    id: 'cible',
                    entete: 'Ressource',
                    cle: (a) => a.target,
                    rendu: (a) => (
                      <span className="block max-w-[24ch] truncate font-mono text-[11px] text-ink">
                        {a.target}
                      </span>
                    ),
                  },
                  {
                    id: 'resultat',
                    entete: 'Résultat',
                    cle: (a) => a.result,
                    rendu: (a) => (
                      <Badge
                        tone={a.result === 'ok' ? 'ok' : a.result === 'refuse' ? 'warn' : 'err'}
                        dot
                        size="sm"
                      >
                        {a.result === 'ok' ? 'Succès' : a.result === 'refuse' ? 'Refusé' : 'Erreur'}
                      </Badge>
                    ),
                  },
                  {
                    id: 'ip',
                    entete: 'Adresse',
                    cle: (a) => a.ip ?? '',
                    masquable: true,
                    rendu: (a) => (
                      <span className="font-mono text-[10.5px] text-g-500">{a.ip ?? '—'}</span>
                    ),
                  },
                  {
                    id: 'detail',
                    entete: '',
                    aligne: 'right',
                    rendu: (a) => (
                      <Button size="sm" variant="ghost" onClick={() => setDetail(a.id)}>
                        Détail
                      </Button>
                    ),
                  },
                ]}
                vide={
                  peutVoir
                    ? {
                        titre: 'Aucun événement',
                        phrase: 'Aucun événement ne correspond à ces filtres.',
                      }
                    : {
                        titre: 'Rôle insuffisant',
                        phrase:
                          'La consultation du journal d’audit est réservée à l’administrateur d’organisation et au rôle de consultation. Demandez l’attribution de l’un de ces rôles à votre administrateur.',
                        action: { libelle: 'Voir les membres', href: '/app/membres' },
                      }
                }
              />
            </div>
          </Card>

          <Callout ton="violet" titre="Pourquoi le journal ne peut pas être modifié">
            Chaque entrée est écrite une seule fois, avec une empreinte cryptographique chaînée à la
            précédente. Modifier ou supprimer une ligne casserait la chaîne, ce qui serait
            immédiatement détectable. Personne ne peut réécrire l’histoire — ni vous, ni nous. C’est
            la seule façon de rendre un journal d’audit utile pour une certification ou un litige.
          </Callout>
        </div>
      )}

      {onglet === 'posture' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Points de contrôle"
                sousTitre="Constats issus de votre configuration réelle, pas d’une liste de bonnes pratiques génériques."
              />
              <div className="space-y-2">
                {[
                  {
                    t: 'Deuxième facteur obligatoire',
                    // Reflète le même calcul que la tuile « Deuxième facteur » au-dessus :
                    // ce point de contrôle annonçait « constats issus de votre
                    // configuration réelle » tout en restant figé sur « À traiter »
                    // même quand tous les membres avaient déjà activé le MFA.
                    etat: USERS_ORG.length && USERS_ORG.every((u) => u.mfaEnabled) ? ('ok' as const) : ('warn' as const),
                    d: USERS_ORG.filter((u) => !u.mfaEnabled).length
                      ? `${USERS_ORG.filter((u) => !u.mfaEnabled).length} membre(s) s’authentifient encore avec un mot de passe seul. Le rendre obligatoire au niveau de l’organisation force son activation à la prochaine connexion.`
                      : 'Tous les membres de l’organisation ont activé un deuxième facteur.',
                    action: { l: 'Voir les membres', h: '/app/membres' },
                  },
                  {
                    t: 'Fédération d’identité active',
                    etat: 'ok' as const,
                    d: 'Vos collaborateurs s’authentifient via Microsoft Entra ID. Un départ dans votre annuaire coupe l’accès sans intervention de notre part.',
                    // Pas de lien vers /app/sso : la fédération n'est pas livrée,
                    // l'écran est masqué de la navigation en attendant.
                  },
                  {
                    t: 'Services managés raccordés',
                    etat: 'warn' as const,
                    d: 'Un service utilise encore ses propres mots de passe. Tant que c’est le cas, un départ n’en coupe pas l’accès automatiquement.',
                    action: { l: 'Voir les projets', h: '/app/applications/projets' },
                  },
                  {
                    t: 'Aucune adresse IP publique sans groupe de sécurité',
                    etat: 'ok' as const,
                    d: 'Toutes les adresses publiques attribuées sont protégées par un groupe de sécurité avec des règles explicites.',
                    action: { l: 'Voir le réseau', h: '/app/reseau' },
                  },
                  {
                    t: 'Chiffrement des volumes',
                    etat: 'ok' as const,
                    d: 'Tous les volumes de bloc et objets sont chiffrés au repos en AES-256.',
                    action: { l: 'Voir le stockage', h: '/app/stockage' },
                  },
                  {
                    t: 'Plan de reprise testé',
                    etat: 'warn' as const,
                    d: 'Un plan de reprise n’a jamais été testé. Un plan non testé est une hypothèse, pas une garantie.',
                    action: { l: 'Voir les plans', h: '/app/pra' },
                  },
                  {
                    t: 'Clés d’accès sans rotation',
                    etat: 'warn' as const,
                    d: 'Deux clés d’accès au stockage objet ont plus de douze mois. Une clé qui ne tourne jamais finit par se retrouver dans un dépôt Git.',
                    action: { l: 'Voir le stockage objet', h: '/app/objet' },
                  },
                  {
                    t: 'Journal d’audit exporté',
                    etat: 'neutral' as const,
                    d: 'Aucun envoi continu vers un collecteur externe. Utile si votre politique exige une conservation hors de la plateforme.',
                    action: { l: 'Configurer l’export', h: '#' },
                  },
                ].map((c) => (
                  <div
                    key={c.t}
                    className={cn(
                      'rounded-[6px] border px-3 py-2.5',
                      c.etat === 'ok'
                        ? 'border-g-300'
                        : c.etat === 'warn'
                          ? 'border-warn/40 bg-warn-bg'
                          : 'border-g-300 bg-g-050',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-ink">{c.t}</span>
                      <span className="flex items-center gap-1.5">
                        <Badge tone={c.etat} size="sm">
                          {c.etat === 'ok' ? 'Conforme' : c.etat === 'warn' ? 'À traiter' : 'Optionnel'}
                        </Badge>
                        {c.action && (
                          <ButtonLink size="sm" variant="ghost" href={c.action.h}>
                            {c.action.l}
                          </ButtonLink>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">{c.d}</p>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader
                  titre="Politique d’organisation"
                  sousTitre="Ces réglages s’appliquent à tous les membres, tous les espaces, toutes les applications."
                />
                <div className="space-y-3.5">
                  <Switch
                    checked={mfaObligatoire}
                    onChange={setMfaObligatoire}
                    label="Rendre le deuxième facteur obligatoire"
                    description="Les membres qui ne l’ont pas activé devront le faire à leur prochaine connexion, avant d’accéder à quoi que ce soit."
                  />
                  <Switch
                    checked
                    disabled
                    label="Exiger la saisie du nom exact pour une suppression"
                    description="Non désactivable. Aucune ressource ne se supprime par un simple clic sur « Oui »."
                  />
                  <Switch
                    checked
                    disabled
                    label="Journaliser les actions refusées"
                    description="Non désactivable. Un refus non journalisé est une information perdue."
                  />
                  <Switch
                    checked={approbationProd}
                    onChange={setApprobationProd}
                    label="Exiger une approbation pour un déploiement en production"
                    description="Une personne différente de l’auteur doit approuver. C’est la séparation des tâches attendue par la plupart des référentiels."
                  />
                  <Switch
                    checked={plagesIp}
                    onChange={setPlagesIp}
                    label="Restreindre l’accès au portail à une liste d’adresses"
                    description="Efficace, mais bloque aussi vos accès en déplacement. À réserver aux organisations dont tous les accès passent par un réseau maîtrisé."
                  />
                  <Switch
                    checked={expirationSession}
                    onChange={setExpirationSession}
                    label="Expirer les sessions inactives après 8 heures"
                  />
                </div>
                <BoutonAction
                  libelle="Enregistrer la politique"
                  size="md"
                  className="mt-4"
                  operation={{
                    action: 'sso.configure',
                    titre: 'Politique d’organisation enregistrée',
                    detail: [
                      mfaObligatoire ? 'deuxième facteur obligatoire' : 'deuxième facteur au choix',
                      approbationProd ? 'approbation exigée en production' : 'aucune approbation exigée',
                      plagesIp ? 'accès restreint par adresse' : 'accès sans restriction d’adresse',
                      expirationSession ? 'sessions expirées après 8 h' : 'sessions sans expiration',
                    ].join(' · '),
                    appel: api
                      ? () =>
                          requete('/securite/politiques', {
                            methode: 'PUT',
                            corps: {
                              mfa: {
                                ...(politiquesDistantes?.mfa ?? { methodes: ['totp'] }),
                                obligatoire: mfaObligatoire,
                              },
                              session: {
                                ...(politiquesDistantes?.session ?? { dureeMaxMin: 720 }),
                                // « 8 heures » quand rien n’était réglé ; sinon on garde
                                // la durée déjà en place plutôt que de l’écraser.
                                inactiviteMin: expirationSession
                                  ? politiquesDistantes?.session.inactiviteMin || 480
                                  : 0,
                              },
                              restrictionIp: {
                                ...(politiquesDistantes?.restrictionIp ?? { plages: [] }),
                                actif: plagesIp,
                              },
                              ...(politiquesDistantes?.motDePasse
                                ? { motDePasse: politiquesDistantes.motDePasse }
                                : {}),
                            },
                          })
                      : undefined,
                    // Une politique plus stricte peut invalider des sessions :
                    // on relit les deux.
                    effetFinal: () => {
                      if (api) {
                        lirePolitiques()
                        sessions.recharger()
                      }
                    },
                  }}
                />
              </Card>

              <Card>
                <CardHeader titre="Élévations de privilège actives" sousTitre="Y compris celles de nos équipes." />
                <div className="rounded-[6px] border border-info/40 bg-info-bg px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                    <Fingerprint size={13} className="shrink-0 text-info" />
                    Aucune élévation active sur votre organisation
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">
                    Quand un membre de nos équipes a besoin d’un accès étendu à vos ressources — pour
                    traiter un ticket, par exemple — cet accès est demandé, limité dans le temps,
                    visible ici, et journalisé de bout en bout. Vous savez qui est intervenu, quand,
                    et sur quoi.
                  </p>
                </div>
                <ButtonLink size="sm" variant="ghost" className="mt-3" href="/app/support">
                  Voir les tickets en cours
                </ButtonLink>
              </Card>
            </div>
          </div>
        </div>
      )}

      {onglet === 'sessions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile libelle="Sessions ouvertes" valeur={sessionsNorm.length} />
            <StatTile
              libelle="Comptes connectés"
              valeur={new Set(sessionsNorm.map((x) => x.userId)).size}
            />
            <StatTile
              libelle="Hors du pays"
              valeur={sessionsNorm.some((x) => x.lieuConnu) ? horsDuPays.length : '—'}
              ton={horsDuPays.length > 0 ? 'warn' : 'ok'}
              detail={
                sessionsNorm.some((x) => x.lieuConnu)
                  ? 'À vérifier si personne n’est en déplacement'
                  : 'Localisation non disponible pour ces sessions'
              }
            />
            <StatTile
              libelle="Expiration d’inactivité"
              valeur={expirationSession ? '8 h' : 'aucune'}
              ton={expirationSession ? 'ok' : 'warn'}
            />
          </div>

          <Card padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-g-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink">Sessions actives</p>
                <p className="mt-0.5 text-[12px] text-g-500">
                  Une session révoquée est coupée immédiatement, sans attendre l’expiration du jeton.
                </p>
              </div>
              <BoutonAction
                libelle="Révoquer toutes les autres"
                icone={<ShieldAlert size={13} />}
                desactive={sessionsNorm.filter((x) => !x.courante).length === 0}
                operation={{
                  action: 'sso.configure',
                  ton: 'warn',
                  titre: `${sessionsNorm.filter((x) => !x.courante).length} session(s) révoquée(s)`,
                  detail:
                    'Toutes les personnes concernées devront se reconnecter. Votre session courante est conservée.',
                  // La révocation globale part sur la route dédiée (le nom
                  // de l’organisation en confirmation), pas en N suppressions.
                  appel: () =>
                    requete('/securite/sessions', {
                      methode: 'DELETE',
                      query: { confirmation: nomOrg },
                    }),
                  effet: () =>
                    sessions.supprimer(
                      sessions.items.filter((x) => !x.courante).map((x) => x.id),
                    ),
                  effetFinal: () => sessions.recharger(),
                }}
                confirmation={{
                  ressource: nomOrg,
                  titre: 'Révoquer toutes les autres sessions ?',
                  pertes: [
                    'Toutes les personnes connectées devront se reconnecter',
                    'Les travaux non enregistrés dans leurs onglets seront perdus',
                    'Votre session courante est conservée',
                  ],
                  libelleAction: 'Révoquer les autres sessions',
                }}
              />
            </div>
            <ul className="divide-y divide-g-100">
              {sessionsNorm.map((x) => (
                <li key={x.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink">{x.nom}</span>
                      <Badge tone="neutral" size="sm">
                        {x.appareil}
                      </Badge>
                      {x.navigateur && (
                        <Badge tone="neutral" size="sm">
                          {x.navigateur}
                        </Badge>
                      )}
                      {x.courante && (
                        <Badge tone="ok" size="sm" dot>
                          Session courante
                        </Badge>
                      )}
                      {x.lieuConnu && !x.lieu.includes('Côte d’Ivoire') && (
                        <Badge tone="warn" size="sm">
                          Connexion hors du pays
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11.5px] text-g-500">
                      <span className="font-mono">{x.ip}</span> ·{' '}
                      {x.lieuConnu ? x.lieu : 'localisation non détectée'} · ouverte{' '}
                      {relatif(x.ouverte, maintenant)} · dernière activité {relatif(x.derniereActivite, maintenant)}
                    </p>
                  </div>
                  <BoutonAction
                    libelle={x.courante ? 'Se déconnecter' : 'Révoquer'}
                    variant="ghost"
                    operation={{
                      action: 'sso.configure',
                      ton: 'warn',
                      titre: x.courante
                        ? 'Votre session sera fermée'
                        : `Session de ${x.nom} révoquée`,
                      detail: x.courante
                        ? 'Vous serez redirigé vers l’écran de connexion.'
                        : `${x.appareil} · ${x.ip} — la personne devra se reconnecter.`,
                      // La session courante ne part pas sur l’API : révoquer
                      // son propre jeton côté backend invaliderait la session
                      // qui porte l’écran, sans redirection conduite.
                      appel:
                        api && !x.courante
                          ? () => supprimerRessource('/securite/sessions', x.id)
                          : undefined,
                      effet: () => sessions.supprimer(x.id),
                      effetFinal: () => sessions.recharger(),
                    }}
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Callout ton="violet" titre="Ce que révoquer une session ne fait pas">
            La révocation coupe l’accès au portail et aux services raccordés au SSO. Elle ne change
            pas le mot de passe et ne désactive pas le compte : après une compromission, révoquez les
            sessions <em>et</em> exigez la réinitialisation depuis la fiche du membre.
          </Callout>
        </div>
      )}

      {onglet === 'conformite' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Règle 3-2-1"
              sousTitre="Trois copies des données, sur deux supports différents, dont une hors site. C’est le minimum au-delà duquel une sauvegarde cesse d’être une garantie."
            />
            <Regle321
              copies={CONFORMITE.every((c) => c.regle321.copies)}
              supports={CONFORMITE.every((c) => c.regle321.supports)}
              horsSite={CONFORMITE.every((c) => c.regle321.horsSite)}
            />
          </Card>

          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Conformité par ressource"
                sousTitre="Une ressource non conforme n’est pas nécessairement en danger — mais elle l’est plus qu’elle ne devrait."
                className="mb-0"
                actions={
                  <Badge tone={conformes === CONFORMITE.length ? 'ok' : 'warn'} size="sm">
                    {conformes} conformes sur {CONFORMITE.length}
                  </Badge>
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Ressource', 'Type', 'Copies', 'Supports', 'Hors site', 'Dernière sauvegarde', 'Conformité'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {CONFORMITE.map((c) => (
                    <tr key={c.ressourceId} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-[11.5px] font-semibold text-ink">
                        {c.ressourceNom}
                      </td>
                      <td className="px-3 py-2 text-[11.5px] text-g-700">{c.type}</td>
                      <td className="px-3 py-2">
                        <Badge tone={c.regle321.copies ? 'ok' : 'err'} size="sm">
                          {c.regle321.copies ? '3 copies' : 'Moins de 3'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={c.regle321.supports ? 'ok' : 'err'} size="sm">
                          {c.regle321.supports ? '2 supports' : 'Un seul'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={c.regle321.horsSite ? 'ok' : 'err'} size="sm">
                          {c.regle321.horsSite ? 'Oui' : 'Non'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[11.5px] text-g-500">
                        {c.dernierSucces ? relatif(c.dernierSucces, maintenant) : 'Jamais'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={conforme321(c) ? 'ok' : 'warn'} dot size="sm">
                          {conforme321(c) ? 'Conforme 3-2-1' : 'Non conforme'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {conformes < CONFORMITE.length && (
            <Callout ton="warn" titre="Ce qui manque, concrètement">
              <span className="inline-flex items-start gap-1.5">
                <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                <span>
                  Les ressources non conformes n’ont pas de copie hors site, ou n’ont qu’un seul
                  support. En cas d’incendie dans la salle où elles se trouvent, elles sont perdues.
                  Une copie hors site vers Grand-Bassam s’ajoute depuis le plan de sauvegarde, et
                  coûte le prix du stockage — soit une fraction de ce que coûterait la perte.
                </span>
              </span>
            </Callout>
          )}
        </div>
      )}

      {onglet === 'export' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Export du journal"
              sousTitre="Pour un audit, une certification, ou une remise à votre commissaire aux comptes."
            />
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Du">
                  <Input
                    type="date"
                    value={exportDepuis}
                    onChange={(e) => setExportDepuis(e.target.value)}
                  />
                </Field>
                <Field label="Au">
                  <Input
                    type="date"
                    value={exportJusqua}
                    onChange={(e) => setExportJusqua(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Format">
                <Select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
                >
                  <option value="csv">CSV — pour un tableur</option>
                  <option value="json">JSON — pour un traitement automatisé</option>
                  <option value="pdf" disabled={api}>
                    PDF signé — pour une remise formelle{api ? ' (indisponible : demandez un CSV ou un JSON)' : ''}
                  </option>
                  <option value="syslog" disabled={api}>
                    Syslog RFC 5424 — pour un collecteur{api ? ' (indisponible en mode API)' : ''}
                  </option>
                </Select>
              </Field>
              <Field label="Périmètre">
                <Select
                  value={exportPerimetre}
                  onChange={(e) => setExportPerimetre(e.target.value)}
                >
                  <option value="tout">Toutes les actions</option>
                  <option value="refus" disabled={api}>
                    Refus uniquement{api ? ' (indisponible en mode API)' : ''}
                  </option>
                  <option value="admin" disabled={api}>
                    Actions d’administration uniquement{api ? ' (indisponible en mode API)' : ''}
                  </option>
                  <option value="acces" disabled={api}>
                    Authentification et accès uniquement{api ? ' (indisponible en mode API)' : ''}
                  </option>
                </Select>
              </Field>
              <Switch
                checked={empreinteChainage}
                onChange={(v) =>
                  executer({
                    action: 'compliance.export',
                    ton: v ? 'ok' : 'warn',
                    titre: v ? 'Empreinte de chaînage incluse' : 'Empreinte de chaînage retirée',
                    detail: v
                      ? undefined
                      : 'Sans elle, un tiers ne peut pas vérifier que l’export n’a pas été retouché — la plupart des auditeurs la demandent.',
                    effet: () => setEmpreinteChainage(v),
                  })
                }
                label="Inclure l’empreinte de chaînage"
                description="Permet à un tiers de vérifier que l’export n’a pas été modifié après extraction. Attendu par la plupart des auditeurs."
              />
            </div>
            <GatedAction autorise={autorise('compliance.export')} message={refus('compliance.export')}>
              <BoutonAction
                className="mt-4"
                libelle="Générer l’export"
                icone={<FileCheck2 size={14} />}
                operation={{
                  action: 'compliance.export',
                  titre: 'Export généré',
                  // Le fichier est réellement produit et déposé côté serveur (`POST
                  // /audit/export`) : cet écran ne propose pas encore de le télécharger
                  // directement (gap documenté, pas simulé) — à distinguer de la
                  // maquette, où rien n'est jamais créé.
                  detail: api
                    ? 'Le fichier est déposé côté serveur. Le téléchargement direct depuis cet écran n’est pas encore câblé.'
                    : 'Démonstration — vous recevriez un lien de téléchargement par courriel dans quelques minutes. Le lien expire après 24 heures.',
                  appel: api
                    ? () =>
                        requete('/audit/export', {
                          methode: 'POST',
                          corps: {
                            depuis: `${exportDepuis}T00:00:00Z`,
                            jusqua: `${exportJusqua}T23:59:59Z`,
                            format: exportFormat === 'syslog' ? 'csv' : exportFormat,
                            signature: empreinteChainage,
                          },
                        })
                    : undefined,
                }}
              />
            </GatedAction>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader titre="Rétention" sousTitre="Ce que nous conservons, et pendant combien de temps." />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Journal d’audit', valeur: '24 mois en ligne, puis archivage froid 5 ans' },
                  { cle: 'Journaux d’authentification', valeur: '12 mois en ligne' },
                  { cle: 'Journaux applicatifs', valeur: '30 jours en ligne, extensible à 90 jours' },
                  { cle: 'Journaux de sauvegarde', valeur: 'Aussi longtemps que le point de reprise existe' },
                  { cle: 'Factures', valeur: '10 ans — obligation légale' },
                  { cle: 'Tickets de support', valeur: '36 mois' },
                ]}
              />
              <Callout ton="info" className="mt-4" titre="Rétention et effacement">
                Une demande d’effacement d’une donnée personnelle n’efface pas le journal d’audit :
                celui-ci relève d’une obligation de traçabilité, qui prime. En revanche, nous pouvons
                pseudonymiser un acteur dans les exports remis à des tiers.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Vérifier l’intégrité d’un export"
                sousTitre="À exécuter sur le poste de votre auditeur, sans nous faire confiance."
              />
              <CodeBlock
                langue="bash"
                code={`# Vérifier la chaîne d'empreintes d'un export
synelia-audit verify audit-org-dba-2026-07-19_2026-08-19.csv \\
  --empreinte-attendue 8f2a91c4d7b0e5443a17c96e2f0d8b41

# Sortie attendue
# 1 344 entrées vérifiées
# chaîne intacte du 2026-07-19T00:00:00Z au 2026-08-19T15:20:00Z
# aucune insertion, modification ni suppression détectée`}
              />
              <p className="mt-3 text-[11.5px] leading-relaxed text-g-500">
                L’outil de vérification est libre et son code est publié. Vous n’avez pas à nous croire
                sur parole : n’importe qui peut recalculer la chaîne à partir de l’export.
              </p>
            </Card>
          </div>
        </div>
      )}

      <Drawer
        open={evenement !== undefined}
        onClose={() => setDetail(null)}
        title="Détail de l’événement"
        size="md"
      >
        {evenement && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  evenement.result === 'ok'
                    ? 'ok'
                    : evenement.result === 'refuse'
                      ? 'warn'
                      : 'err'
                }
                dot
              >
                {evenement.result === 'ok'
                  ? 'Succès'
                  : evenement.result === 'refuse'
                    ? 'Refusé'
                    : 'Erreur'}
              </Badge>
              <Badge tone="neutral" size="sm">
                {evenement.id}
              </Badge>
            </div>

            <KeyValueList
              colonnes={1}
              items={[
                { cle: 'Horodatage', valeur: `${dateHeure(evenement.ts)} (${relatif(evenement.ts, maintenant)})` },
                { cle: 'Acteur', valeur: `${evenement.actor.nom} (${evenement.actor.email})` },
                {
                  cle: 'Rôle au moment de l’action',
                  valeur: ROLE_LABEL[evenement.role] ?? evenement.role,
                },
                { cle: 'Portée', valeur: evenement.scope.label },
                { cle: 'Action', valeur: evenement.action },
                { cle: 'Ressource visée', valeur: evenement.target },
                { cle: 'Adresse source', valeur: evenement.ip ?? '—' },
                { cle: 'Organisation', valeur: nomOrg },
                { cle: 'Motif', valeur: evenement.detail ?? '—' },
              ]}
            />

            {evenement.result === 'refuse' && (
              <Callout ton="warn" titre="Pourquoi cette action a été refusée">
                Le rôle de l’acteur n’autorisait pas cette action. Le portail affichait le bouton
                désactivé, avec une infobulle nommant le rôle requis — l’action a donc été tentée par
                un autre chemin, ou l’attribution de rôle a changé entre l’affichage et le clic. Dans
                les deux cas, l’action n’a eu aucun effet.
              </Callout>
            )}

            <div>
              <MicroLabel className="mb-2">Entrée brute du journal</MicroLabel>
              <CodeBlock
                langue="json"
                code={JSON.stringify(
                  {
                    id: evenement.id,
                    ts: evenement.ts,
                    org: organisationId,
                    acteur: evenement.actor,
                    role: evenement.role,
                    portee: evenement.scope,
                    action: evenement.action,
                    cible: evenement.target,
                    resultat: evenement.result,
                    ip: evenement.ip ?? null,
                    detail: evenement.detail ?? null,
                    empreinte_precedente: '8f2a91c4d7b0e544',
                    empreinte: '1b74e0aa93c04d2f',
                  },
                  null,
                  2,
                )}
              />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
