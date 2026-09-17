'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Link2, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateHeure, relatif } from '@/lib/format'
import { ESPACES, MEMBERSHIPS, ORG_COURANTE, SERVICES_MANAGES, userById } from '@/lib/mock'
import { ROLES_CLIENT } from '@/lib/rbac'
import { ROLE_LABEL, type Membership, type Role, type User } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, MonoTextarea, Select, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { Stepper, Timeline } from '@/components/composition/flow'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, requete } from '@/lib/api/client'

interface Correspondance {
  id: string
  groupe: string
  role: Role
  membres: number
  portee: string
}

const CORRESPONDANCES: Correspondance[] = [
  { id: 'cor-1', groupe: 'SYN-CLOUD-ADMINS', role: 'org_admin', membres: 2, portee: 'Organisation' },
  { id: 'cor-2', groupe: 'SYN-CLOUD-INFRA', role: 'espace_admin', membres: 4, portee: 'Organisation' },
  { id: 'cor-3', groupe: 'SYN-CLOUD-DEV-PROD', role: 'project_owner', membres: 8, portee: 'EC-DBA-01' },
  { id: 'cor-4', groupe: 'SYN-CLOUD-FINANCE', role: 'billing_manager', membres: 2, portee: 'Organisation' },
  { id: 'cor-5', groupe: 'Tout le personnel', role: 'read_only', membres: 142, portee: 'Organisation' },
]

const ONGLETS = [
  { id: 'etat', label: 'État de la fédération' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'correspondances', label: 'Correspondance des rôles' },
  { id: 'services', label: 'Services raccordés' },
  { id: 'journal', label: 'Journal des connexions' },
]

const PROTOCOLES = [
  {
    id: 'oidc',
    nom: 'OpenID Connect',
    detail: 'Le choix par défaut. Fonctionne avec Microsoft Entra ID, Google Workspace, Okta, Authentik.',
  },
  {
    id: 'saml',
    nom: 'SAML 2.0',
    detail: 'Pour les annuaires d’entreprise qui ne proposent que ce protocole, ou lorsque votre politique l’impose.',
  },
  {
    id: 'ldap',
    nom: 'LDAP / Active Directory',
    detail: 'Synchronisation d’un annuaire interne. Nécessite un tunnel vers votre réseau.',
  },
]

/** Configuration de fédération distante (`GET/PUT /securite/sso`). */
interface ConfigSsoDistante {
  actif: boolean
  protocole?: 'oidc' | 'saml' | 'ldap'
  emetteur?: string
  clientId?: string
  urlMetadonnees?: string
  domainesVerifies?: string[]
  provisioningJustInTime?: boolean
  secretDefini?: boolean
  correspondanceGroupes?: Array<{ groupe: string; role: Role; scopeId?: string }>
  dernierTest?: { date: string; succes: boolean; detail?: string } | null
}

interface ResultatTestSso {
  succes: boolean
  etapes: Array<{ nom: string; ok: boolean; detail?: string }>
}

export default function Sso() {
  const { autorise, refus, pousser, organisations, organisationId } = useApp()
  const orgActive = organisations.find((o) => o.id === organisationId) ?? organisations[0]
  const nomOrg = orgActive?.nom ?? ORG_COURANTE.nom
  const executer = useOperation()
  const correspondances = useCollection<Correspondance>('correspondances-sso', CORRESPONDANCES)
  const adhesions = useCollection<Membership>('memberships', MEMBERSHIPS)
  const [onglet, setOnglet] = useState('etat')
  const [emailSimule, setEmailSimule] = useState('k.toure@dba.africa')
  const [groupesSimules, setGroupesSimules] = useState('SYN-CLOUD-DEV-PROD\nTout le personnel')
  const [resultatSimulation, setResultatSimulation] = useState<Correspondance | null>(null)
  const [creationAuto, setCreationAuto] = useState(true)
  const [desactivationAuto, setDesactivationAuto] = useState(true)
  const [comptesLocaux, setComptesLocaux] = useState(false)
  const [envoiContinu, setEnvoiContinu] = useState(false)
  const [protocole, setProtocole] = useState('oidc')
  const [etape, setEtape] = useState(1)
  const api = estActif()
  /** Paramètres publiés dans `PUT /securite/sso` — préremplis depuis `GET`. */
  const [emetteur, setEmetteur] = useState(
    'https://login.microsoftonline.com/8f2a91c4-d7b0-e544-3a17-c96e2f0d8b41/v2.0/.well-known/openid-configuration',
  )
  const [clientId, setClientId] = useState('4d91a7c2-8b0e-4413-9c6e-2f0d8b41a17c')
  const [urlMetadonnees, setUrlMetadonnees] = useState('')
  const [domainesVerifies, setDomainesVerifies] = useState('dba.africa, digitalbusinessafrica.ci')
  /** Erreurs de champs renvoyées par le backend (`422`), affichées sous les champs de l’étape 2. */
  const [erreursSso, setErreursSso] = useState<Record<string, string>>({})
  /** Correspondances telles que le backend les connaît (mode API) ; la graine locale sinon. */
  const [correspondancesDistantes, setCorrespondancesDistantes] = useState<Correspondance[]>([])
  /** Fédération connue du backend — `null` avant le premier retour. */
  const [configSso, setConfigSso] = useState<ConfigSsoDistante | null>(null)
  const [ssoActif, setSsoActif] = useState(false)
  /** Dernier test réel (`POST /securite/sso/test`), affiché à l’étape 3. */
  const [resultatTest, setResultatTest] = useState<ResultatTestSso | null>(null)

  /** Reporte la configuration lue (`GET /securite/sso`) dans les champs de l’écran. */
  const appliquerConfig = useCallback((c: ConfigSsoDistante) => {
    setConfigSso(c)
    setSsoActif(c.actif)
    if (c.protocole) setProtocole(c.protocole)
    if (typeof c.provisioningJustInTime === 'boolean') setCreationAuto(c.provisioningJustInTime)
    if (c.emetteur) setEmetteur(c.emetteur)
    if (c.clientId) setClientId(c.clientId)
    if (c.urlMetadonnees) setUrlMetadonnees(c.urlMetadonnees)
    if (c.domainesVerifies) setDomainesVerifies(c.domainesVerifies.join(', '))
    setCorrespondancesDistantes(
      (c.correspondanceGroupes ?? []).map((g, i) => ({
        id: `cor-distante-${i}`,
        groupe: g.groupe,
        role: g.role,
        membres: 0,
        portee: g.scopeId ?? 'Organisation',
      })),
    )
  }, [])

  useEffect(() => {
    if (!estActif()) return
    requete<ConfigSsoDistante>('/securite/sso').then(appliquerConfig, () => {})
  }, [appliquerConfig])

  const relireSso = () => {
    if (!estActif()) return
    requete<ConfigSsoDistante>('/securite/sso').then(appliquerConfig, () => {})
  }

  const listeCorrespondances = api ? correspondancesDistantes : correspondances.items

  /**
   * `PUT /securite/sso` — le contrat ne connaît pas de sous-ressource pour
   * les correspondances : chaque ajout, modification ou retrait republie la
   * configuration entière, portée `Organisation` devenant absence de
   * `scopeId`. La désactivation automatique et les comptes locaux n’ont pas
   * d’équivalent contrat et restent des réglages d’écran.
   */
  const publierSso = (
    actif: boolean,
    groupes: Correspondance[],
    complement: { provisioningJustInTime?: boolean } = {},
  ) =>
    requete('/securite/sso', {
      methode: 'PUT',
      corps: {
        actif,
        protocole,
        // Le contrat ne porte pas le secret client : il reste à saisir hors
        // écran (`secretDefini` dit seulement s’il existe).
        ...(protocole === 'saml'
          ? urlMetadonnees.trim()
            ? { urlMetadonnees: urlMetadonnees.trim() }
            : {}
          : emetteur.trim()
            ? { emetteur: emetteur.trim() }
            : {}),
        ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
        domainesVerifies: domainesVerifies
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        provisioningJustInTime: creationAuto,
        ...complement,
        correspondanceGroupes: groupes.map((c) => ({
          groupe: c.groupe,
          role: c.role,
          ...(c.portee !== 'Organisation' ? { scopeId: c.portee } : {}),
        })),
      },
    })

  /** Test réel de la fédération, sans toucher à la configuration active. */
  const testerSso = () => {
    if (!estActif()) {
      executer({
        action: 'sso.configure',
        titre: 'Connexion au fournisseur d’identité vérifiée',
        detail:
          'Point de découverte joignable, certificat de signature valide, revendications attendues présentes.',
        job: {
          type: 'sso.test',
          label: 'Test de la fédération d’identité',
          etapes: [
            'Récupérer le point de découverte',
            'Vérifier le certificat de signature',
            'Contrôler les revendications reçues',
          ],
          dureeEtapeMs: 900,
        },
      })
      return
    }
    requete<ResultatTestSso>('/securite/sso/test', { methode: 'POST', corps: {} }).then(
      (r) => {
        setResultatTest(r)
        setOnglet('configuration')
        setEtape(3)
        pousser({
          ton: r.succes ? 'ok' : 'warn',
          titre: r.succes ? 'Fédération vérifiée' : 'Fédération en défaut',
          detail: r.etapes
            .filter((e) => !e.ok)
            .map((e) => `${e.nom} : ${e.detail ?? 'échec'}`)
            .join(' · '),
        })
      },
      (e: unknown) =>
        pousser({
          ton: 'err',
          titre: 'Test de la fédération impossible',
          detail: e instanceof Error ? e.message : undefined,
        }),
    )
  }

  // En mode API, les membres arrivent embarqués sous `utilisateur` (`GET /membres`) :
  // les identifiants du backend sont inconnus de `userById`, lecture mock seule. Même
  // repli que `/app/membres` (`userById(m.userId) ?? m.utilisateur`).
  const membresConnus = adhesions.items
    .map((m) => userById(m.userId) ?? (m as unknown as { utilisateur?: User }).utilisateur)
    .flatMap((u) => (u ? [u] : []))
  const federes = membresConnus.filter((u) => u.idpSource !== 'local').length
  const servicesSso = SERVICES_MANAGES.filter((s) => s.sso.actif).length

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Authentification unique' }]}
        titre={
          <span>
            Authentification <span className="text-m-600">unique</span>
          </span>
        }
        sousTitre="Vos collaborateurs se connectent avec l’identité de votre entreprise, et cette identité les suit dans tous les services managés — messagerie, partage de fichiers, ERP — sans aucun mot de passe supplémentaire à retenir ni à distribuer."
        meta={
          <>
            <Badge tone={api ? (ssoActif ? 'ok' : 'neutral') : 'ok'} dot={!api || ssoActif} size="sm">
              {api ? (configSso ? (ssoActif ? 'Fédération active' : 'Fédération inactive') : 'Fédération…') : 'Fédération active'}
            </Badge>
            <Badge tone="accent" size="sm">
              {servicesSso} services raccordés
            </Badge>
            <Badge tone="neutral" size="sm">
              {nomOrg}
            </Badge>
          </>
        }
        actions={
          <GatedAction autorise={autorise('sso.configure')} message={refus('sso.configure')}>
            <Button size="md" iconBefore={<RefreshCw size={14} />} onClick={testerSso}>
              Tester la connexion
            </Button>
          </GatedAction>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Comptes fédérés"
          valeur={federes}
          detail={`sur ${membresConnus.length} membres`}
          ton="ok"
        />
        <StatTile
          libelle="Services raccordés"
          valeur={servicesSso}
          detail={`sur ${SERVICES_MANAGES.length} services managés`}
          ton="accent"
        />
        <StatTile
          libelle="Connexions 24 h"
          valeur={184}
          detail="Dont 12 refusées"
        />
        <StatTile
          libelle="Deuxième facteur"
          valeur="Délégué"
          detail="Appliqué par votre annuaire"
          ton="ok"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'etat' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Le trajet d’une connexion"
              sousTitre="Où se trouve le mot de passe, et ce que le portail en voit."
            />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              {[
                {
                  n: 1,
                  t: 'Votre annuaire',
                  d: 'Microsoft Entra ID. C’est là que réside l’identité de vos collaborateurs, et nulle part ailleurs.',
                  accent: false,
                },
                {
                  n: 2,
                  t: 'Notre fournisseur d’identité',
                  d: 'Keycloak, à Abidjan. Il fait confiance à votre annuaire et délivre un jeton pour la session. Il ne stocke aucun mot de passe de vos collaborateurs.',
                  accent: true,
                },
                {
                  n: 3,
                  t: 'Ce portail',
                  d: 'Reçoit le jeton, en lit les rôles, affiche ce à quoi ils donnent droit. Aucun champ de mot de passe n’existe dans ce portail.',
                  accent: false,
                },
                {
                  n: 4,
                  t: 'Les services managés',
                  d: 'Nextcloud, Grommunio, Odoo. Ils acceptent le même jeton. Un clic sur « Ouvrir » et la session est déjà ouverte.',
                  accent: true,
                },
              ].map((e, i, arr) => (
                <div key={e.n} className="relative">
                  <div
                    className={cn(
                      'h-full rounded-[8px] border px-3.5 py-3',
                      e.accent ? 'border-m-600/40 bg-m-050' : 'border-g-300',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                        e.accent ? 'bg-m-600 text-white' : 'bg-p-050 text-p-700',
                      )}
                    >
                      {e.n}
                    </span>
                    <p className="mt-2 text-[13px] font-bold text-ink">{e.t}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-g-700">{e.d}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight
                      size={14}
                      className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-g-300 lg:block"
                    />
                  )}
                </div>
              ))}
            </div>
            <Callout ton="violet" className="mt-4" titre="Ce portail ne stocke aucun mot de passe">
              Il n’en affiche même pas le champ. Une réinitialisation, une politique de complexité, une
              expiration : tout cela se règle dans votre annuaire, qui reste seul maître de l’identité.
              Si vous coupez la fédération, l’accès de vos collaborateurs cesse immédiatement — sans que
              nous ayons à intervenir.
            </Callout>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Fédération configurée"
                sousTitre={
                  api
                    ? `${PROTOCOLES.find((p) => p.id === protocole)?.nom ?? protocole}${configSso?.emetteur ? ` · ${configSso.emetteur}` : ''}`
                    : 'Microsoft Entra ID · OpenID Connect'
                }
                actions={
                  <Badge tone={!api || ssoActif ? 'ok' : 'neutral'} dot={!api || ssoActif} size="sm">
                    {!api || ssoActif ? 'Opérationnelle' : 'Inactive'}
                  </Badge>
                }
              />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Protocole', valeur: 'OpenID Connect (autorisation par code, avec PKCE)' },
                  { cle: 'Fournisseur', valeur: 'Microsoft Entra ID' },
                  {
                    cle: 'Domaine de découverte',
                    valeur: 'dba.africa — une adresse de ce domaine est redirigée automatiquement',
                  },
                  { cle: 'Deuxième facteur', valeur: 'Délégué à Entra ID (conditionnel par emplacement)' },
                  { cle: 'Provisionnement', valeur: 'À la première connexion, sur correspondance de groupe' },
                  { cle: 'Dernière synchronisation', valeur: relatif('2026-08-19T15:04:00Z') },
                  { cle: 'Certificat de signature', valeur: 'Valide jusqu’au 14 février 2027' },
                ]}
              />
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-g-100 pt-4">
                <GatedAction autorise={autorise('sso.configure')} message={refus('sso.configure')}>
                  <Button size="sm" variant="secondary" onClick={() => setOnglet('configuration')}>
                    Modifier la configuration
                  </Button>
                </GatedAction>
                <BoutonAction
                  libelle="Forcer une synchronisation"
                  variant="ghost"
                  icone={<RefreshCw size={12} />}
                  operation={{
                    action: 'sso.configure',
                    ton: 'info',
                    titre: 'Synchronisation de l’annuaire lancée',
                    detail: 'Les mouvements d’équipe de votre annuaire sont rejoués sur les rôles.',
                    job: {
                      type: 'sso.sync',
                      label: 'Synchronisation de l’annuaire',
                      etapes: [
                        'Lire les groupes de l’annuaire',
                        'Appliquer les correspondances',
                        'Retirer les accès des membres partis',
                      ],
                      dureeEtapeMs: 1100,
                    },
                  }}
                />
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Vérifications automatiques"
                sousTitre="Contrôlées toutes les cinq minutes."
              />
              <div className="space-y-2">
                {[
                  { t: 'Point de découverte joignable', ok: true, d: 'La configuration OpenID de votre annuaire répond en 84 ms.' },
                  { t: 'Certificat de signature valide', ok: true, d: 'Expire dans 179 jours. Nous vous préviendrons 30 jours avant.' },
                  { t: 'Correspondance des groupes', ok: true, d: 'Les cinq groupes déclarés existent dans votre annuaire.' },
                  { t: 'Horloges synchronisées', ok: true, d: 'Un décalage supérieur à cinq minutes invaliderait les jetons.' },
                  { t: 'Réclamation de courriel présente', ok: true, d: 'Indispensable : c’est l’identifiant de rattachement.' },
                  { t: 'Déconnexion propagée', ok: false, d: 'La déconnexion depuis un service ne ferme pas la session dans votre annuaire. À activer côté Entra ID.' },
                ].map((v) => (
                  <div
                    key={v.t}
                    className={cn(
                      'rounded-[6px] border px-3 py-2.5',
                      v.ok ? 'border-g-300' : 'border-warn/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        {v.ok && <CheckCircle2 size={12} className="shrink-0 text-ok" />}
                        {v.t}
                      </span>
                      <Badge tone={v.ok ? 'ok' : 'warn'} size="sm">
                        {v.ok ? 'Conforme' : 'À corriger'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-g-500">{v.d}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'configuration' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Protocole"
              sousTitre="Un seul protocole à la fois. Changer de protocole exige de reconfigurer la fédération de bout en bout."
            />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {PROTOCOLES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProtocole(p.id)}
                  className={cn(
                    'rounded-[8px] border-2 px-3.5 py-3 text-left transition-colors',
                    protocole === p.id ? 'border-p-700 bg-p-050' : 'border-g-300 hover:border-p-400',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">{p.nom}</span>
                    {protocole === p.id && <CheckCircle2 size={14} className="shrink-0 text-p-700" />}
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-g-700">
                    {p.detail}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <Stepper
              etapes={[
                { numero: 1, titre: 'Déclarer l’application chez vous' },
                { numero: 2, titre: 'Renseigner les paramètres ici' },
                { numero: 3, titre: 'Tester puis activer' },
              ]}
              courante={etape}
              onChange={setEtape}
              className="mb-4"
            />

            {etape === 1 && (
              <div className="space-y-4">
                <CardHeader
                  titre="Déclarer Synelia Cloud dans votre annuaire"
                  sousTitre="Copiez ces valeurs dans la déclaration d’application de votre annuaire. Elles ne changeront pas."
                  className="mb-0"
                />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <CopyField
                    label="URL de redirection"
                    value="https://identite.synelia.cloud/realms/org-dba/broker/entra/endpoint"
                  />
                  <CopyField
                    label="URL de déconnexion"
                    value="https://identite.synelia.cloud/realms/org-dba/protocol/openid-connect/logout"
                  />
                  <CopyField label="Identifiant de l’entité" value="synelia-cloud-org-dba" />
                  <CopyField
                    label="Réclamations attendues"
                    value="email, given_name, family_name, groups"
                  />
                </div>
                <Callout ton="info" titre="La réclamation de groupes est indispensable">
                  Sans elle, nous ne pouvons pas déduire le rôle d’un collaborateur, et toute connexion
                  aboutirait au rôle le plus restreint. Dans Entra ID, il faut l’ajouter explicitement
                  dans la configuration du jeton — elle n’y est pas par défaut.
                </Callout>
                <Button onClick={() => setEtape(2)}>Continuer</Button>
              </div>
            )}

            {etape === 2 && (
              <div className="space-y-4">
                <CardHeader
                  titre="Paramètres de votre annuaire"
                  sousTitre="Le secret est chiffré au repos et n’est jamais réaffiché après enregistrement."
                  className="mb-0"
                />
                {protocole === 'oidc' && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Field
                      label="URL de découverte"
                      hint="se termine par /.well-known/openid-configuration"
                      error={erreursSso.emetteur}
                    >
                      <Input value={emetteur} onChange={(e) => setEmetteur(e.target.value)} />
                    </Field>
                    <Field label="Identifiant client" error={erreursSso.clientId}>
                      <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
                    </Field>
                    <Field label="Secret client" hint="chiffré au repos, jamais réaffiché">
                      <Input type="password" defaultValue="••••••••••••••••••••••••" />
                    </Field>
                    <Field label="Portées demandées">
                      <Input defaultValue="openid profile email groups" />
                    </Field>
                    <Field
                      label="Domaines de découverte"
                      hint="une adresse de ces domaines est redirigée automatiquement vers votre annuaire"
                      error={erreursSso.domainesVerifies}
                    >
                      <Input
                        value={domainesVerifies}
                        onChange={(e) => setDomainesVerifies(e.target.value)}
                      />
                    </Field>
                    <Field label="Réclamation portant les groupes">
                      <Input defaultValue="groups" />
                    </Field>
                  </div>
                )}
                {protocole === 'saml' && (
                  <div className="space-y-4">
                    <Field
                      label="URL des métadonnées du fournisseur d’identité"
                      error={erreursSso.urlMetadonnees}
                    >
                      <Input
                        value={urlMetadonnees}
                        onChange={(e) => setUrlMetadonnees(e.target.value)}
                        placeholder="https://sso.exemple.ci/FederationMetadata.xml"
                      />
                    </Field>
                    <Field
                      label="ou métadonnées collées"
                      hint="XML — utile si vos métadonnées ne sont pas exposées publiquement"
                    >
                      <MonoTextarea rows={6} placeholder="<EntityDescriptor …>" />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Format de l’identifiant">
                        <Select defaultValue="email">
                          <option value="email">Adresse électronique</option>
                          <option value="persistent">Identifiant persistant</option>
                          <option value="transient">Identifiant transitoire</option>
                        </Select>
                      </Field>
                      <Field label="Attribut portant les groupes">
                        <Input defaultValue="http://schemas.xmlsoap.org/claims/Group" />
                      </Field>
                    </div>
                  </div>
                )}
                {protocole === 'ldap' && (
                  <div className="space-y-4">
                    <Callout ton="warn" titre="LDAP exige une connectivité réseau vers votre annuaire">
                      Nous ne joignons pas votre contrôleur de domaine depuis Internet. Il faut un
                      tunnel IPsec ou une interconnexion depuis un de vos Espaces Cloud. Comptez une
                      demi-journée de mise en place avec nos équipes.
                    </Callout>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Serveur" hint="joignable depuis un de vos espaces">
                        <Input placeholder="ldaps://dc01.interne.dba.africa:636" />
                      </Field>
                      <Field label="Base de recherche">
                        <Input placeholder="OU=Utilisateurs,DC=dba,DC=africa" />
                      </Field>
                      <Field label="Compte de liaison">
                        <Input placeholder="CN=svc-synelia,OU=Services,DC=dba,DC=africa" />
                      </Field>
                      <Field label="Mot de passe du compte de liaison">
                        <Input type="password" />
                      </Field>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setEtape(1)}>
                    Retour
                  </Button>
                  {api && (
                    <GatedAction autorise={autorise('sso.configure')} message={refus('sso.configure')}>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          executer({
                            action: 'sso.configure',
                            titre: 'Paramètres de fédération enregistrés',
                            detail:
                              'La fédération garde son état actuel : testez-la, puis activez-la à l’étape suivante.',
                            appel: () => publierSso(ssoActif, listeCorrespondances),
                            onErreur: (e) => setErreursSso(e.champs ?? {}),
                            effetFinal: () => {
                              setErreursSso({})
                              relireSso()
                              setEtape(3)
                            },
                          })
                        }
                      >
                        Enregistrer les paramètres
                      </Button>
                    </GatedAction>
                  )}
                  <Button onClick={() => setEtape(3)}>Continuer</Button>
                </div>
              </div>
            )}

            {etape === 3 && (
              <div className="space-y-4">
                <CardHeader
                  titre="Tester avant d’activer"
                  sousTitre="Le test ouvre une fenêtre de connexion réelle, sans modifier la configuration active. Vous verrez exactement le jeton reçu et les rôles qui en découlent."
                  className="mb-0"
                />
                <div className="rounded-[8px] border border-g-300 bg-g-050 p-4">
                  <MicroLabel className="mb-2">Résultat du dernier test</MicroLabel>
                  {resultatTest ? (
                    <div className="space-y-1.5">
                      {resultatTest.etapes.map((r) => (
                        <div key={r.nom} className="flex items-start gap-2">
                          <CheckCircle2
                            size={13}
                            className={cn('mt-0.5 shrink-0', r.ok ? 'text-ok' : 'text-err')}
                          />
                          <span className="text-[12px] text-ink">
                            {r.nom}
                            {r.detail && (
                              <span className="block text-[11px] text-g-500">{r.detail}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {[
                          { t: 'Redirection vers votre annuaire', ok: true },
                          { t: 'Authentification acceptée', ok: true },
                          { t: 'Jeton reçu et signature vérifiée', ok: true },
                          { t: 'Réclamation email présente', ok: true },
                          { t: 'Réclamation groups présente — 3 groupes', ok: true },
                          { t: 'Correspondance de rôle trouvée : Administrateur d’organisation', ok: true },
                        ].map((r) => (
                          <div key={r.t} className="flex items-center gap-2">
                            <CheckCircle2 size={13} className="shrink-0 text-ok" />
                            <span className="text-[12px] text-ink">{r.t}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] text-g-500">
                        {api && configSso?.dernierTest ? (
                          <>
                            Dernier test connu du backend :{' '}
                            {configSso.dernierTest.succes ? 'réussi' : 'en échec'} le{' '}
                            {dateHeure(configSso.dernierTest.date)}
                            {configSso.dernierTest.detail
                              ? ` — ${configSso.dernierTest.detail}`
                              : ''}
                            . Lancez « Tester la connexion » pour un résultat détaillé.
                          </>
                        ) : (
                          <>Test exécuté par Léa Konan le {dateHeure('2026-08-19T14:12:00Z')}</>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="space-y-3">
                  <Switch
                    checked={creationAuto}
                    onChange={(v) =>
                      executer({
                        action: 'sso.configure',
                        titre: v
                          ? 'Création automatique activée'
                          : 'Création automatique désactivée',
                        detail: v
                          ? undefined
                          : 'Chaque arrivée exigera désormais une invitation manuelle.',
                        appel: api
                          ? () =>
                              publierSso(ssoActif, listeCorrespondances, {
                                provisioningJustInTime: v,
                              })
                          : undefined,
                        effet: () => setCreationAuto(v),
                        effetFinal: () => {
                          if (api) {
                            setCreationAuto(v)
                            relireSso()
                          }
                        },
                      })
                    }
                    label="Créer automatiquement les comptes à la première connexion"
                    description="Un collaborateur d’un groupe reconnu obtient son accès sans invitation préalable. Sans cela, chaque arrivée exige une invitation manuelle."
                  />
                  <Switch
                    checked={desactivationAuto}
                    onChange={(v) =>
                      executer({
                        action: 'sso.configure',
                        ton: v ? 'ok' : 'warn',
                        titre: v
                          ? 'Désactivation automatique activée'
                          : 'Désactivation automatique coupée',
                        detail: v
                          ? undefined
                          : 'Un départ dans votre annuaire ne coupera plus l’accès ici : il faudra le faire à la main.',
                        effet: () => setDesactivationAuto(v),
                      })
                    }
                    label="Désactiver les comptes disparus de l’annuaire"
                    description="À la synchronisation, un compte absent de votre annuaire est désactivé ici. C’est ce qui garantit qu’un départ coupe réellement les accès."
                  />
                  <Switch
                    checked={comptesLocaux}
                    onChange={(v) =>
                      executer({
                        action: 'sso.configure',
                        ton: v ? 'warn' : 'ok',
                        titre: v ? 'Comptes locaux autorisés' : 'Comptes locaux interdits',
                        detail: v
                          ? 'Chaque compte local est une exception à surveiller : il survit à un départ de votre annuaire.'
                          : undefined,
                        effet: () => setComptesLocaux(v),
                      })
                    }
                    label="Autoriser les comptes locaux en parallèle"
                    description="Utile pour un prestataire externe qui n’est pas dans votre annuaire. Chaque compte local est une exception à surveiller."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setEtape(2)}>
                    Retour
                  </Button>
                  <GatedAction autorise={autorise('sso.configure')} message={refus('sso.configure')}>
                    <Button
                      onClick={() =>
                        executer({
                          action: 'sso.configure',
                          titre: 'Fédération enregistrée',
                          detail:
                            'Les prochaines connexions passeront par votre annuaire. Votre session actuelle reste valide.',
                          appel: api
                            ? () => publierSso(true, listeCorrespondances)
                            : undefined,
                          // Un `422` renvoie à l’étape 2, où les champs en
                          // cause portent le message du backend.
                          onErreur: (e) => {
                            setErreursSso(e.champs ?? {})
                            if (e.champs) setEtape(2)
                          },
                          effetFinal: () => {
                            if (api) {
                              setErreursSso({})
                              setSsoActif(true)
                              relireSso()
                            }
                          },
                        })
                      }
                    >
                      Activer la fédération
                    </Button>
                  </GatedAction>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {onglet === 'correspondances' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Correspondance groupes → rôles"
              sousTitre="Un groupe de votre annuaire donne un rôle chez nous. C’est ce qui permet de gérer les accès depuis votre annuaire, sans repasser par ce portail à chaque mouvement d’équipe."
            />
            <div className="space-y-2">
              {listeCorrespondances.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[12px] font-semibold text-ink">
                      {c.groupe}
                    </span>
                    <span className="block text-[11px] text-g-500">
                      {c.membres} membres dans votre annuaire
                    </span>
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-g-300" />
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Badge tone="violet" size="sm">
                      {ROLE_LABEL[c.role]}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {c.portee}
                    </Badge>
                  </span>
                  <span className="flex items-center gap-1">
                    <BoutonFormulaire
                      libelle="Modifier"
                      variant="ghost"
                      action="sso.configure"
                      titre={`Correspondance ${c.groupe}`}
                      description="Les correspondances sont évaluées de haut en bas : la première qui s’applique gagne."
                      champs={[
                        {
                          id: 'role',
                          label: 'Rôle attribué',
                          type: 'select',
                          options: ROLES_CLIENT.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
                        },
                        {
                          id: 'portee',
                          label: 'Portée',
                          type: 'select',
                          options: [
                            { value: 'Organisation', label: 'Toute l’organisation' },
                            ...ESPACES.map((e) => ({ value: e.code, label: `Espace ${e.code}` })),
                          ],
                        },
                      ]}
                      valeursDepart={{ role: c.role, portee: c.portee }}
                      operation={(v) => {
                        const apres = listeCorrespondances.map((x) =>
                          x.id === c.id
                            ? { ...x, role: v.role as Role, portee: String(v.portee) }
                            : x,
                        )
                        return {
                          titre: `Correspondance ${c.groupe} modifiée`,
                          detail: `${ROLE_LABEL[v.role as Role]} · ${v.portee}`,
                          appel: api ? () => publierSso(ssoActif, apres) : undefined,
                          effet: () =>
                            correspondances.modifier(c.id, {
                              role: v.role as Role,
                              portee: String(v.portee),
                            }),
                          // En mode API la liste affichée vient du backend :
                          // on la relit après publication.
                          effetFinal: () => {
                            if (api) relireSso()
                          },
                        }
                      }}
                    />
                    <BoutonAction
                      libelle="Retirer"
                      variant="ghost"
                      operation={{
                        action: 'sso.configure',
                        ton: 'warn',
                        titre: `Correspondance ${c.groupe} retirée`,
                        detail: `${c.membres} membre(s) perdront le rôle ${ROLE_LABEL[c.role]} à leur prochaine connexion.`,
                        appel: api
                          ? () =>
                              publierSso(
                                ssoActif,
                                listeCorrespondances.filter((x) => x.id !== c.id),
                              )
                          : undefined,
                        effet: () => correspondances.supprimer(c.id),
                        effetFinal: () => {
                          if (api) relireSso()
                        },
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
            <BoutonFormulaire
              libelle="Ajouter une correspondance"
              className="mt-3"
              icone={<Link2 size={12} />}
              action="sso.configure"
              titre="Ajouter une correspondance"
              description="Un groupe de votre annuaire donne un rôle chez nous. Placez les groupes larges en dernier, sinon ils gagnent sur les autres."
              champs={[
                { id: 'groupe', label: 'Groupe de l’annuaire', placeholder: 'SYN-CLOUD-SUPPORT', obligatoire: true },
                {
                  id: 'role',
                  label: 'Rôle attribué',
                  type: 'select',
                  options: ROLES_CLIENT.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
                },
                {
                  id: 'portee',
                  label: 'Portée',
                  type: 'select',
                  options: [
                    { value: 'Organisation', label: 'Toute l’organisation' },
                    ...ESPACES.map((e) => ({ value: e.code, label: `Espace ${e.code}` })),
                  ],
                },
              ]}
              valeursDepart={{ role: 'read_only', portee: 'Organisation' }}
              libelleValider="Ajouter"
              operation={(v) => {
                const ajout: Correspondance = {
                  id: correspondances.identifiant('cor'),
                  groupe: String(v.groupe),
                  role: v.role as Role,
                  membres: 0,
                  portee: String(v.portee),
                }
                return {
                  titre: `Correspondance ${v.groupe} ajoutée`,
                  detail: 'Évaluée en dernier : déplacez-la si elle doit primer.',
                  appel: api
                    ? () => publierSso(ssoActif, [...listeCorrespondances, ajout])
                    : undefined,
                  effet: () => correspondances.creer(ajout, 'fin'),
                  effetFinal: () => {
                    if (api) relireSso()
                  },
                }
              }}
            />
            <Callout ton="warn" className="mt-4" titre="L’ordre compte">
              Les correspondances sont évaluées de haut en bas, et la première qui s’applique gagne.
              Placez « Tout le personnel » en dernier : sinon, tout le monde obtiendrait le rôle de
              consultation, y compris vos administrateurs.
            </Callout>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Sans correspondance"
                sousTitre="Ce qui arrive à quelqu’un qui s’authentifie sans appartenir à aucun groupe reconnu."
              />
              <div className="space-y-3">
                <Field label="Comportement par défaut">
                  <Select defaultValue="refus">
                    <option value="refus">Refuser la connexion (recommandé)</option>
                    <option value="lecture">Attribuer le rôle de consultation</option>
                    <option value="attente">Créer le compte en attente de validation</option>
                  </Select>
                </Field>
                <Callout ton="info" titre="Refus par défaut ou rôle de consultation">
                  Le rôle de consultation donne accès à la topologie de votre infrastructure, aux noms
                  de vos machines et à vos métriques. Si votre annuaire contient des comptes externes,
                  le refus par défaut est le réglage prudent.
                </Callout>
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Simuler une connexion"
                sousTitre="Voir quel rôle obtiendrait une personne, sans qu’elle ait à se connecter."
              />
              <div className="space-y-4">
                <Field label="Adresse électronique">
                  <Input value={emailSimule} onChange={(e) => setEmailSimule(e.target.value)} />
                </Field>
                <Field label="Groupes de l’annuaire" hint="un par ligne">
                  <MonoTextarea
                    rows={3}
                    value={groupesSimules}
                    onChange={(e) => setGroupesSimules(e.target.value)}
                  />
                </Field>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const groupes = groupesSimules
                      .split('\n')
                      .map((g) => g.trim())
                      .filter(Boolean)
                    // La première correspondance qui s'applique gagne, dans
                    // l'ordre de la liste : c'est ce que dit l'écran.
                    const retenue =
                      listeCorrespondances.find((c) => groupes.includes(c.groupe)) ?? null
                    setResultatSimulation(retenue)
                    executer({
                      ton: retenue ? 'ok' : 'warn',
                      titre: retenue
                        ? `${emailSimule} obtiendrait ${ROLE_LABEL[retenue.role]}`
                        : `${emailSimule} n’obtiendrait aucun accès`,
                      detail: retenue
                        ? `Correspondance retenue : ${retenue.groupe} · portée ${retenue.portee}`
                        : 'Aucun de ces groupes ne correspond à une règle. La connexion serait refusée.',
                    })
                  }}
                >
                  Simuler
                </Button>
                <div
                  className={cn(
                    'rounded-[6px] border px-3 py-2.5',
                    resultatSimulation === null
                      ? 'border-g-300 bg-g-050'
                      : 'border-ok/40 bg-ok-bg',
                  )}
                >
                  {resultatSimulation ? (
                    <>
                      <p className="text-[12px] font-semibold text-ink">
                        Résultat : {ROLE_LABEL[resultatSimulation.role]}, portée{' '}
                        {resultatSimulation.portee}
                      </p>
                      <p className="mt-0.5 text-[12px] text-g-700">
                        Correspondance retenue : {resultatSimulation.groupe}, évaluée avant les
                        suivantes.
                      </p>
                    </>
                  ) : (
                    <p className="text-[12px] text-g-700">
                      Renseignez les groupes puis lancez la simulation : le résultat indique la
                      correspondance retenue, pas seulement le rôle obtenu.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'services' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Services raccordés à l’authentification unique"
              sousTitre="Un clic sur « Ouvrir » depuis le portail, et la session est déjà ouverte dans le service. Aucun mot de passe distinct, aucune ressaisie."
            />
            <div className="space-y-2">
              {SERVICES_MANAGES.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{s.nom}</span>
                    <span className="block font-mono text-[11px] text-g-500">{s.domaine}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {s.sso.actif ? (
                      <Badge tone="accent" size="sm">
                        Authentification unique
                      </Badge>
                    ) : (
                      <Badge tone="warn" size="sm">
                        Mot de passe distinct
                      </Badge>
                    )}
                    <ButtonLink size="sm" variant="ghost" href="/app/web/emails">
                      Administrer
                    </ButtonLink>
                  </span>
                </div>
              ))}
            </div>
            {SERVICES_MANAGES.some((s) => !s.sso.actif) && (
              <Callout ton="warn" className="mt-4" titre="Un service n’est pas encore raccordé">
                Tant qu’un service utilise ses propres mots de passe, le départ d’un collaborateur
                n’en coupe pas l’accès automatiquement. C’est le trou dans la raquette qui explique la
                plupart des accès résiduels après un départ. Le raccordement se fait depuis
                l’administration du service et prend quelques minutes.
              </Callout>
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Ce que le raccordement change concrètement"
              sousTitre="Sur un départ, sur une arrivée, sur un audit."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  t: 'Une arrivée',
                  sans: 'Créer un compte dans chaque service, transmettre chaque mot de passe, espérer qu’ils soient changés.',
                  avec: 'Ajouter la personne au bon groupe de votre annuaire. Les accès s’ouvrent seuls, avec le bon rôle.',
                },
                {
                  t: 'Un départ',
                  sans: 'Désactiver le compte dans chaque service, un par un, et découvrir six mois plus tard celui qu’on avait oublié.',
                  avec: 'Désactiver le compte dans votre annuaire. Tous les accès cessent, y compris ceux dont vous ne vous souvenez plus.',
                },
                {
                  t: 'Un audit',
                  sans: 'Extraire la liste des comptes de chaque service et les rapprocher à la main.',
                  avec: 'Une seule source de vérité : votre annuaire. Le rapprochement est immédiat.',
                },
              ].map((x) => (
                <div key={x.t} className="rounded-[8px] border border-g-300 p-3.5">
                  <p className="text-[13px] font-bold text-ink">{x.t}</p>
                  <div className="mt-2.5">
                    <MicroLabel className="text-g-500">Sans authentification unique</MicroLabel>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-g-700">{x.sans}</p>
                  </div>
                  <div className="mt-2.5">
                    <MicroLabel className="text-m-600">Avec</MicroLabel>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink">{x.avec}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {onglet === 'journal' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Connexions récentes"
              sousTitre="Y compris les refus : c’est là que se voient les tentatives d’accès après un départ."
            />
            <Timeline
              evenements={[
                {
                  id: '1',
                  titre: 'Connexion réussie — Léa Konan',
                  detail: 'Via Entra ID · deuxième facteur validé · Abidjan (102.176.x.x)',
                  horodatage: dateHeure('2026-08-19T15:18:00Z'),
                  ton: 'ok',
                },
                {
                  id: '2',
                  titre: 'Connexion réussie — Kouassi Touré',
                  detail: 'Via Entra ID · rôle Administrateur d’application sur EC-DBA-01',
                  horodatage: dateHeure('2026-08-19T14:52:00Z'),
                  ton: 'ok',
                },
                {
                  id: '3',
                  titre: 'Connexion refusée — ancien.collaborateur@dba.africa',
                  detail: 'Compte désactivé dans votre annuaire le 12 août. Aucun accès accordé.',
                  horodatage: dateHeure('2026-08-19T11:04:00Z'),
                  ton: 'err',
                },
                {
                  id: '4',
                  titre: 'Connexion refusée — prestataire@externe.com',
                  detail: 'Aucun groupe reconnu. Comportement par défaut : refus.',
                  horodatage: dateHeure('2026-08-19T09:38:00Z'),
                  ton: 'warn',
                },
                {
                  id: '5',
                  titre: 'Ouverture de session Nextcloud — Mariam Diallo',
                  detail: 'Session propagée depuis le portail, sans ressaisie.',
                  horodatage: dateHeure('2026-08-19T08:22:00Z'),
                  ton: 'info',
                },
                {
                  id: '6',
                  titre: 'Synchronisation d’annuaire',
                  detail: '142 comptes examinés · 1 désactivé · 0 créé',
                  horodatage: dateHeure('2026-08-19T06:00:00Z'),
                  ton: 'neutral',
                },
              ]}
            />
            <ButtonLink size="sm" variant="ghost" className="mt-4" href="/app/securite">
              Voir le journal d’audit complet
            </ButtonLink>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader titre="Points d’attention" />
              <div className="space-y-2.5">
                <div className="rounded-[6px] border border-err/40 px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">
                    Une tentative depuis un compte désactivé
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-g-700">
                    Le compte d’un collaborateur parti le 12 août a tenté de se connecter ce matin. La
                    fédération a fait son travail : accès refusé. Mais la tentative mérite un coup de
                    téléphone — soit la personne ignore qu’elle n’a plus accès, soit quelqu’un utilise
                    ses identifiants.
                  </p>
                </div>
                <div className="rounded-[6px] border border-warn/40 px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">
                    La déconnexion n’est pas propagée
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-g-700">
                    Se déconnecter du portail ne ferme pas la session dans votre annuaire. Sur un poste
                    partagé, la personne suivante peut donc se reconnecter sans ressaisir ses
                    identifiants. Le réglage se trouve côté Entra ID.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader titre="Journal exportable" sousTitre="Pour votre outil de corrélation ou votre commissaire aux comptes." />
              <div className="space-y-3">
                <Field label="Période">
                  <Select defaultValue="30">
                    <option value="7">7 derniers jours</option>
                    <option value="30">30 derniers jours</option>
                    <option value="90">90 derniers jours</option>
                    <option value="365">12 derniers mois</option>
                  </Select>
                </Field>
                <Field label="Format">
                  <Select defaultValue="csv">
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="syslog">Syslog (RFC 5424)</option>
                  </Select>
                </Field>
                <Switch
                  checked={envoiContinu}
                  onChange={(v) =>
                    executer({
                      action: 'compliance.export',
                      titre: v ? 'Envoi continu activé' : 'Envoi continu coupé',
                      detail: v
                        ? 'Chaque événement d’authentification part vers votre collecteur en temps réel.'
                        : undefined,
                      effet: () => setEnvoiContinu(v),
                    })
                  }
                  label="Envoi continu vers votre collecteur"
                  description="Nous poussons chaque événement d’authentification vers votre outil de corrélation, en temps réel, plutôt que par exports ponctuels."
                />
              </div>
              <BoutonAction
                libelle="Exporter"
                className="mt-3.5"
                icone={<ShieldCheck size={12} />}
                operation={{
                  action: 'compliance.export',
                  titre: 'Export des événements d’authentification préparé',
                  detail: 'Le lien de téléchargement arrive par courriel et expire après 24 heures.',
                }}
              />
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          titre="Détails techniques"
          sousTitre="Pour votre équipe sécurité, ou pour l’annexe technique d’un appel d’offres."
        />
        <CodeBlock
          langue="json"
          code={`{
  "fournisseur_identite": "Keycloak 26.x, hébergé à Abidjan (ABJ-1)",
  "royaume": "org-dba",
  "protocole": "OpenID Connect 1.0, flux d'autorisation par code avec PKCE",
  "duree_jeton_acces": "5 minutes",
  "duree_jeton_rafraichissement": "8 heures, révocable",
  "algorithme_signature": "RS256, rotation de clé trimestrielle",
  "deuxieme_facteur": "délégué au fournisseur d'identité de l'organisation",
  "stockage_mot_de_passe": "aucun — le portail n'affiche ni ne stocke de mot de passe",
  "propagation_deconnexion": "OIDC RP-Initiated Logout, back-channel disponible",
  "services_raccordes": ["Nextcloud", "Grommunio", "Jitsi", "Odoo", "Metabase", "GitLab"]
}`}
        />
      </Card>
    </div>
  )
}
