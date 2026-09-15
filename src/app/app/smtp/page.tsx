'use client'

import { useEffect, useState } from 'react'
import { Key, Plus, ShieldCheck, Webhook } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateCourte, num, pct, relatif } from '@/lib/format'
import { SMTP } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { GaugeCircle, QuotaBar, StackedBar, StatTile } from '@/components/composition/metrics'
import { DegradedState } from '@/components/composition/states'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import {
  ApiError,
  creerRessource,
  estActif,
  estTravail,
  modifierRessource,
  requete,
  supprimerRessource,
  type PageDistante,
} from '@/lib/api/client'

type CleSmtp = (typeof SMTP.cles)[number]
type WebhookSmtp = (typeof SMTP.webhooks)[number]

const ONGLETS = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'cles', label: 'Clés d’envoi' },
  { id: 'authentification', label: 'Authentification' },
  { id: 'journal', label: 'Journal de livraison' },
  { id: 'webhooks', label: 'Webhooks' },
]

const TON_STATUT: Record<string, 'ok' | 'warn' | 'err'> = {
  delivre: 'ok',
  differe: 'warn',
  rebond: 'err',
  rejete: 'err',
  plainte: 'err',
}

const LIBELLE_STATUT: Record<string, string> = {
  delivre: 'Délivré',
  differe: 'Différé',
  rebond: 'Rebond',
  rejete: 'Rejeté',
  plainte: 'Plainte',
}

/**
 * Le contrat nomme `remis` ce que la maquette appelle `delivre` (et connaît
 * `rebond`, que la maquette ne montre pas) : on traduit à la frontière, les
 * libellés de l’écran restant inchangés. Sans cela chaque écriture échoue en
 * `422` (`evenements.0` invalide).
 */
const evenementVersBackend = (e: string) => (e === 'delivre' ? 'remis' : e)
const evenementVersUi = (e: string) => (e === 'remis' ? 'delivre' : e)

/** Formes distantes (`GET /web/smtp/cles`, `/webhooks`, `/messages`). */
interface CleSmtpDistante {
  id: string
  nom: string
  quotaJour: number
  utiliseJour?: number
  creeeLe: string
  derniereUtilisation?: string | null
  statut: 'active' | 'suspendue' | 'revoquee'
}

interface WebhookSmtpDistant {
  id: string
  url: string
  evenements: string[]
  actif: boolean
}

interface MessageSmtpDistant {
  id: string
  ts: string
  vers: string
  sujet?: string
  statut: string
  code?: string
  detail?: string
}

/** `GET /web/smtp` — le relais de l’organisation (hôte, quota, authentification). */
interface RelaisSmtpDistant {
  id: string
  hote: string
  ports: number[]
  identifiant: string
  domainesAutorises: string[]
  authentification: { spf: string; dkim: string; dmarc: string; selecteurDkim?: string }
  quota: { parJour: number; parHeure: number; utiliseJour: number }
  reputation: { tauxRemise: number; tauxRebond: number; plaintes: number; listeNoire: boolean }
  ipDediee?: string | null
  actif: boolean
}

/** `POST /web/smtp/identifiants` — renvoyés une seule fois. */
interface IdentifiantsSmtp {
  hote: string
  ports?: number[]
  identifiant: string
  motDePasse: string
}

export default function Smtp() {
  const maintenant = useMaintenant()
  const { autorise, refus, pousser } = useApp()
  const executer = useOperation()
  const cles = useCollection<CleSmtp>('cles-smtp', SMTP.cles)
  const webhooks = useCollection<WebhookSmtp>('webhooks-smtp', SMTP.webhooks)
  const [onglet, setOnglet] = useState('apercu')
  const [nouvelleCle, setNouvelleCle] = useState(false)
  const [nomCle, setNomCle] = useState('')
  const [quotaCle, setQuotaCle] = useState(5000)
  const [expediteur, setExpediteur] = useState('facturation@dba.africa')
  const [refuserHorsDomaine, setRefuserHorsDomaine] = useState(true)
  const [purgeErreurs, setPurgeErreurs] = useState(true)
  const [desabonnement, setDesabonnement] = useState(false)
  /** Mot de passe renvoyé une seule fois à la création d’une clé (mode API). */
  const [secretCree, setSecretCree] = useState<{
    nom: string
    motDePasse: string
    hote: string
  } | null>(null)
  const [erreursCles, setErreursCles] = useState<Record<string, string>>({})
  /** Relais distant et ses réglages éditables (`PATCH /web/smtp`). */
  const [relais, setRelais] = useState<RelaisSmtpDistant | null>(null)
  const [domainesRelais, setDomainesRelais] = useState('')
  const [quotaRelais, setQuotaRelais] = useState(5000)
  const [erreursRelais, setErreursRelais] = useState<Record<string, string>>({})
  const [identifiantsRegeneres, setIdentifiantsRegeneres] = useState<IdentifiantsSmtp | null>(null)
  const [destinataireTest, setDestinataireTest] = useState('')

  /**
   * `GET /web/smtp/cles` et `/webhooks` renvoient des tableaux nus, pas
   * l’enveloppe `{ donnees, pagination }` du chargeur générique : la lecture
   * se fait ici, dans la page, et les collections de l’atelier ne servent
   * qu’au mode maquette. Écart backend noté dans `docs/BRANCHEMENT-API.md`.
   */
  const [clesDistantes, setClesDistantes] = useState<CleSmtpDistante[] | null>(null)
  const [webhooksDistants, setWebhooksDistants] = useState<WebhookSmtpDistant[] | null>(null)
  const [messagesDistants, setMessagesDistants] = useState<MessageSmtpDistant[] | null>(null)
  const [journalDegrade, setJournalDegrade] = useState<{
    integration?: string
    dateDonnees?: string
  } | null>(null)
  const [actualisation, setActualisation] = useState(0)
  const reactualiser = () => setActualisation((n) => n + 1)

  useEffect(() => {
    if (!estActif()) return
    requete<RelaisSmtpDistant>('/web/smtp').then(
      (r) => {
        setRelais(r)
        setDomainesRelais(r.domainesAutorises.join(', '))
        setQuotaRelais(r.quota.parJour)
      },
      () => setRelais(null),
    )
    requete<CleSmtpDistante[]>('/web/smtp/cles').then(
      (l) => setClesDistantes(l),
      () => setClesDistantes([]),
    )
    requete<WebhookSmtpDistant[]>('/web/smtp/webhooks').then(
      (l) => setWebhooksDistants(l),
      () => setWebhooksDistants([]),
    )
    requete<PageDistante<MessageSmtpDistant>>('/web/smtp/messages', {
      query: { parPage: 50 },
    }).then(
      (p) => {
        setMessagesDistants(p.donnees)
        setJournalDegrade(null)
      },
      (e: unknown) => {
        // `424` : le journal du relais dépend d’une intégration amont — on
        // le dit avec son nom plutôt qu’avec un « ne répond pas » générique.
        if (e instanceof ApiError && e.statut === 424) {
          setJournalDegrade({ integration: e.integration, dateDonnees: e.dateDonnees })
          return
        }
        setMessagesDistants([])
      },
    )
  }, [actualisation])

  const api = estActif()
  const ouvrirCreationCle = () => {
    setSecretCree(null)
    setErreursCles({})
    setNouvelleCle(true)
  }
  /** Création d’une clé : le mot de passe n’est renvoyé qu’une seule fois. */
  const creerCle = () => {
    if (!nomCle.trim()) return
    if (!estActif()) {
      executer({
        action: 'secrets.update',
        titre: `Clé « ${nomCle} » créée`,
        detail:
          'Copiez-la maintenant : elle ne sera plus affichée en clair après la fermeture de cette fenêtre.',
        effet: () =>
          cles.creer({
            id: cles.identifiant('sk'),
            nom: nomCle,
            creee: MAINTENANT.slice(0, 10),
            derniereUtilisation: MAINTENANT,
            quotaJour: quotaCle,
            envoyesJour: 0,
          }),
      })
      setNomCle('')
      setNouvelleCle(false)
      return
    }
    setErreursCles({})
    const domaineExpediteur = expediteur.startsWith('*@')
      ? expediteur.slice(2)
      : (expediteur.split('@')[1] ?? '')
    creerRessource<{ cle: { id: string; nom: string }; hote: string; motDePasse: string }>(
      '/web/smtp/cles',
      {
        nom: nomCle.trim(),
        quotaJour: quotaCle,
        ...(domaineExpediteur ? { domainesAutorises: [domaineExpediteur] } : {}),
      },
    ).then(
      (r) => {
        // `201` renvoie le secret, un éventuel `202` un travail à suivre.
        if (estTravail(r)) {
          reactualiser()
          pousser({
            ton: 'ok',
            titre: `Clé « ${nomCle.trim()} » en cours de création`,
            detail: 'Suivi dans le centre de tâches.',
          })
          return
        }
        setSecretCree({ nom: nomCle.trim(), motDePasse: r.motDePasse, hote: r.hote })
        reactualiser()
        pousser({
          ton: 'ok',
          titre: `Clé « ${nomCle.trim()} » créée`,
          detail: 'Copiez le mot de passe maintenant : il ne sera plus affiché.',
        })
      },
      (e: unknown) => {
        if (e instanceof ApiError && e.champs) setErreursCles(e.champs)
        pousser({
          ton: 'err',
          titre: 'Création de la clé impossible',
          detail: e instanceof Error ? e.message : undefined,
        })
      },
    )
  }
  const clesAffichees = api
    ? (clesDistantes ?? []).map((c) => ({
        id: c.id,
        nom: c.nom,
        creee: c.creeeLe.slice(0, 10),
        derniereUtilisation: c.derniereUtilisation ?? undefined,
        quotaJour: c.quotaJour,
        envoyesJour: c.utiliseJour ?? 0,
        statut: c.statut,
      }))
    : cles.items.map((c) => ({ ...c, statut: 'active' as const }))
  const webhooksAffiches = api
    ? (webhooksDistants ?? []).map((w) => ({
        id: w.id,
        url: w.url,
        evenements: w.evenements.map(evenementVersUi),
        actif: w.actif,
      }))
    : webhooks.items
  const journal = api
    ? (messagesDistants ?? []).map((m) => ({
        id: m.id,
        ts: m.ts,
        destinataire: m.vers,
        sujet: m.sujet ?? '—',
        statut: evenementVersUi(m.statut),
        detail: [m.code, m.detail].filter(Boolean).join(' · ') || '—',
      }))
    : SMTP.journal.map((j) => ({ id: j.ts, ...j }))

  const tauxLivraison = api
    ? (relais?.reputation.tauxRemise ?? 0)
    : (SMTP.livraison.find((l) => l.statut === 'delivre')?.pct ?? 0)
  const quotaJour = api ? (relais?.quota.parJour ?? 0) : SMTP.quotas.parJour
  const envoyesJour = api ? (relais?.quota.utiliseJour ?? 0) : SMTP.quotas.envoyesJour
  const parHeure = api ? (relais?.quota.parHeure ?? 0) : SMTP.quotas.parHeure
  const relaisActif = api ? relais?.actif === true : true

  /**
   * Répartition des statuts de livraison : en mode API, comptée sur le
   * journal réellement chargé (`/web/smtp/messages`, jusqu’à 50 messages).
   * Affichait auparavant `SMTP.livraison` sans condition — les mêmes
   * 4 964/172/88/18 messages fictifs pour toute organisation, même une
   * qui vient d’envoyer deux courriels.
   */
  const repartition = api
    ? (() => {
        const comptes = new Map<string, number>()
        journal.forEach((j) => comptes.set(j.statut, (comptes.get(j.statut) ?? 0) + 1))
        const total = journal.length
        return Array.from(comptes.entries()).map(([statut, nombre]) => ({
          statut,
          nombre,
          pct: total > 0 ? (nombre / total) * 100 : 0,
        }))
      })()
    : SMTP.livraison

  /** `POST /web/smtp/test` — un message d’essai part réellement par le relais. */
  const envoyerTest = () => {
    const destinataire = destinataireTest.trim()
    if (!destinataire) return
    if (!estActif()) {
      pousser({
        ton: 'ok',
        titre: `Message d’essai remis à ${destinataire}`,
        detail: 'Code 250 — le relais accepte vos envois.',
      })
      return
    }
    requete<{ envoye: boolean; code?: string; detail?: string }>('/web/smtp/test', {
      methode: 'POST',
      corps: { destinataire },
    }).then(
      (r) =>
        pousser({
          ton: r.envoye ? 'ok' : 'warn',
          titre: r.envoye
            ? `Message d’essai remis à ${destinataire}`
            : `Message d’essai refusé pour ${destinataire}`,
          detail: [r.code, r.detail].filter(Boolean).join(' · ') || undefined,
        }),
      (e: unknown) =>
        pousser({
          ton: 'err',
          titre: 'Envoi du message d’essai impossible',
          detail: e instanceof Error ? e.message : undefined,
        }),
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Relais SMTP' }]}
        titre="Relais SMTP"
        sousTitre="Un relais pour les courriels transactionnels de vos applications : factures, confirmations de commande, réinitialisations de mot de passe. Adresse IP dédiée, SPF, DKIM et DMARC configurés, réputation surveillée."
        actions={
          <GatedAction autorise={autorise('secrets.update')} message={refus('secrets.update')}>
            <Button iconBefore={<Plus size={14} />} onClick={() => ouvrirCreationCle()}>
              Nouvelle clé d’envoi
            </Button>
          </GatedAction>
        }
        meta={
          <>
            <Badge tone={relaisActif ? 'ok' : 'warn'} dot size="sm">
              {relaisActif ? 'Relais opérationnel' : 'Relais à activer'}
            </Badge>
            <Badge tone="neutral" size="sm">
              {api ? relais?.hote || 'Relais non provisionné' : `IP dédiée ${SMTP.reputation.ip}`}
            </Badge>
            <Badge tone="neutral" size="sm">
              {(api ? relais?.reputation.listeNoire === true : SMTP.reputation.listesNoires > 0)
                ? 'Présent dans une liste noire'
                : 'Aucune liste noire'}
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Envoyés aujourd’hui"
          valeur={num(envoyesJour)}
          detail={`sur ${num(quotaJour)} autorisés`}
          ton={quotaJour > 0 && envoyesJour / quotaJour > 0.8 ? 'warn' : 'violet'}
        />
        <StatTile
          libelle="Taux de livraison"
          valeur={pct(tauxLivraison, 1)}
          ton={tauxLivraison > 95 ? 'ok' : 'warn'}
          detail="Sur les dernières 24 heures"
        />
        {api ? (
          <StatTile
            libelle="Réputation"
            valeur={relais?.reputation.listeNoire ? 'Listée' : 'Saine'}
            ton={relais?.reputation.listeNoire ? 'err' : 'ok'}
            detail={`Rebonds ${pct(relais?.reputation.tauxRebond ?? 0, 1)} · plaintes ${pct(relais?.reputation.plaintes ?? 0, 2)}`}
          />
        ) : (
          <StatTile
            libelle="Score de réputation"
            valeur={SMTP.reputation.score}
            unite="/100"
            ton={SMTP.reputation.score > 90 ? 'ok' : 'warn'}
            detail="Mesuré auprès des grands fournisseurs"
          />
        )}
        <StatTile
          libelle="Clés d’envoi actives"
          valeur={api ? (clesDistantes ?? []).length : cles.items.length}
          detail="Révocables indépendamment"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'apercu' && (
        <div className="space-y-4">
          {api && relais && !relais.actif && (
            <Card>
              <CardHeader
                titre="Le relais n’est pas encore activé"
                sousTitre="Déclarez vos domaines expéditeurs : le relais est provisionné, SPF, DKIM et DMARC posés, puis le mode d’essai levé."
                actions={
                  <BoutonFormulaire
                    libelle="Activer le relais"
                    variant="primary"
                    icone={<Plus size={13} />}
                    action="secrets.update"
                    titre="Activer le relais SMTP"
                    description="Les domaines déclarés sont les seuls acceptés en expéditeur. Le quota se règle ensuite."
                    champs={[
                      { id: 'domaines', label: 'Domaines autorisés', placeholder: 'dba.africa, digitalbusinessafrica.ci', obligatoire: true },
                      { id: 'quotaJour', label: 'Quota journalier', type: 'nombre', min: 100, demi: true },
                      { id: 'ipDediee', label: 'Adresse IP dédiée', type: 'switch', placeholder: 'Réputation isolée', demi: true },
                    ]}
                    valeursDepart={{ quotaJour: 5000, ipDediee: false }}
                    libelleValider="Activer"
                    operation={(v) => ({
                      titre: 'Activation du relais lancée',
                      detail:
                        'Provisionnement, authentification du domaine puis levée du mode d’essai : suivi dans le centre de tâches.',
                      // `POST /web/smtp` → `202`, travail suivi par `useOperation`.
                      appel: () =>
                        creerRessource('/web/smtp', {
                          domainesAutorises: String(v.domaines)
                            .split(',')
                            .map((d) => d.trim())
                            .filter(Boolean),
                          quotaJour: Number(v.quotaJour),
                          ipDediee: Boolean(v.ipDediee),
                        }),
                      effetFinal: reactualiser,
                    })}
                  />
                }
              />
            </Card>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader titre="Quotas" sousTitre="Trois limites, pour trois types d’abus différents." />
              <div className="space-y-3.5">
                <QuotaBar
                  libelle="Par jour"
                  utilise={envoyesJour}
                  total={quotaJour}
                  seuil={80}
                  formateur={(v) => num(v)}
                />
                {api ? (
                  <p className="text-[12px] leading-relaxed text-g-700">
                    Par heure : <span className="font-semibold text-ink">{num(parHeure)}</span>{' '}
                    autorisés — le compteur horaire n’est pas exposé par l’API.
                  </p>
                ) : (
                  <>
                    <QuotaBar
                      libelle="Par heure"
                      utilise={1142}
                      total={parHeure}
                      seuil={80}
                      formateur={(v) => num(v)}
                    />
                    <QuotaBar
                      libelle="Par minute"
                      utilise={38}
                      total={SMTP.quotas.parMinute}
                      seuil={80}
                      formateur={(v) => num(v)}
                    />
                  </>
                )}
              </div>
              <Callout ton="info" className="mt-4" titre="Pourquoi une limite par minute">
                Une boucle de code qui part en vrille peut envoyer dix mille courriels en quelques
                secondes et brûler la réputation de votre adresse IP pour des semaines. La limite par
                minute est le garde-fou qui vous laisse le temps de vous en apercevoir.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Répartition des livraisons"
                sousTitre="Dernières 24 heures."
              />
              {api && repartition.length === 0 ? (
                <p className="text-[12px] text-g-500">Aucun message dans le journal chargé.</p>
              ) : (
                <>
                  <StackedBar
                    segments={repartition.map((l) => ({
                      label: LIBELLE_STATUT[l.statut] ?? l.statut,
                      valeur: l.nombre,
                      couleur:
                        l.statut === 'delivre'
                          ? 'var(--color-ok)'
                          : l.statut === 'differe'
                            ? 'var(--color-warn)'
                            : l.statut === 'rejete'
                              ? 'var(--color-err)'
                              : 'var(--color-m-600)',
                    }))}
                  />
                  <div className="mt-4 space-y-1.5 border-t border-g-100 pt-3.5">
                    {repartition.map((l) => (
                      <div key={l.statut} className="flex items-baseline justify-between gap-3">
                        <span className="text-[12px] text-g-700">
                          {LIBELLE_STATUT[l.statut] ?? l.statut}
                        </span>
                        <span className="tnum shrink-0 text-[12px]">
                          <span className="font-semibold text-ink">{num(l.nombre)}</span>
                          <span className="ml-1.5 text-g-500">{pct(l.pct, 1)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!api && (
                <Callout ton="warn" className="mt-4" titre="1,7 % de rejets, dont la cause est connue">
                  88 rejets viennent d’adresses qui n’existent plus, toutes issues d’une liste
                  d’abonnés importée en 2023. Nettoyer cette liste ferait passer le taux de livraison
                  de 94,7 % à plus de 98 %, et améliorerait votre réputation auprès des fournisseurs.
                </Callout>
              )}
            </Card>

            <Card>
              <CardHeader titre="Réputation" sousTitre="Ce que les fournisseurs pensent de votre adresse IP." />
              <div className="flex justify-center py-2">
                <GaugeCircle
                  valeur={api ? (relais?.reputation.tauxRemise ?? 0) : SMTP.reputation.score}
                  min={0}
                  max={100}
                  cible={85}
                  libelle={api ? 'Taux de remise' : 'Score global'}
                />
              </div>
              <KeyValueList
                className="mt-2"
                colonnes={1}
                items={
                  api
                    ? [
                        {
                          cle: 'Adresse IP d’envoi',
                          valeur: relais?.ipDediee
                            ? `${relais.ipDediee} — dédiée à votre organisation`
                            : 'Partagée — non exposée par l’API',
                        },
                        {
                          cle: 'Listes noires',
                          valeur: relais?.reputation.listeNoire
                            ? 'Présente dans au moins une liste'
                            : 'Aucune liste noire détectée',
                        },
                        {
                          cle: 'Rebonds · plaintes',
                          valeur: `${pct(relais?.reputation.tauxRebond ?? 0, 1)} · ${pct(relais?.reputation.plaintes ?? 0, 2)}`,
                        },
                        {
                          cle: 'Enregistrement PTR, boucle Microsoft, Google Postmaster',
                          valeur: 'non exposés par l’API',
                        },
                      ]
                    : [
                        {
                          cle: 'Adresse IP d’envoi',
                          valeur: `${SMTP.reputation.ip}${SMTP.reputation.dediee ? ' — dédiée à votre organisation' : ' — partagée'}`,
                        },
                        {
                          cle: 'Listes noires',
                          valeur:
                            SMTP.reputation.listesNoires === 0
                              ? 'Absente des 42 listes surveillées'
                              : `Présente dans ${SMTP.reputation.listesNoires} liste(s)`,
                        },
                        { cle: 'Enregistrement PTR', valeur: 'mail-dba.synelia.cloud — cohérent' },
                        { cle: 'Boucle de retour Microsoft', valeur: 'Inscrite — plaintes remontées en temps réel' },
                        { cle: 'Google Postmaster', valeur: 'Domaine vérifié · réputation « élevée »' },
                      ]
                }
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Connexion au relais"
              sousTitre="Chiffrement obligatoire. Le port 25 est fermé : il ne sert qu’aux échanges entre serveurs de courrier et attire les abus."
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <CopyField label="Hôte" value={api ? relais?.hote || '—' : 'smtp.synelia.cloud'} />
                {api ? (
                  <CopyField label="Ports" value={(relais?.ports ?? []).join(', ') || '—'} />
                ) : (
                  <>
                    <CopyField label="Port (STARTTLS)" value="587" />
                    <CopyField label="Port (TLS implicite)" value="465" />
                  </>
                )}
                <CopyField
                  label="Nom d’utilisateur"
                  value={api ? relais?.identifiant || '—' : 'org-dba'}
                />
                <CopyField label="Mot de passe" masque value="Utilisez une clé d’envoi, jamais ce mot de passe" />
                {identifiantsRegeneres && (
                  <Callout ton="warn" titre="Nouveaux identifiants — affichés une seule fois">
                    <div className="mt-2 space-y-2">
                      <CopyField label="Identifiant" value={identifiantsRegeneres.identifiant} />
                      <CopyField label="Mot de passe" value={identifiantsRegeneres.motDePasse} masque />
                    </div>
                  </Callout>
                )}
                <div className="flex flex-wrap items-end gap-2 border-t border-g-100 pt-3">
                  <Field
                    label="Courriel de test"
                    hint="un message d’essai part réellement par le relais"
                    className="min-w-0 flex-1"
                  >
                    <Input
                      value={destinataireTest}
                      onChange={(e) => setDestinataireTest(e.target.value)}
                      placeholder="vous@dba.africa"
                    />
                  </Field>
                  <GatedAction autorise={autorise('secrets.update')} message={refus('secrets.update')}>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!destinataireTest.trim()}
                      onClick={envoyerTest}
                    >
                      Envoyer
                    </Button>
                  </GatedAction>
                  {api && (
                    <BoutonAction
                      libelle="Régénérer les identifiants"
                      variant="ghost"
                      operation={{
                        action: 'secrets.update',
                        ton: 'warn',
                        titre: 'Identifiants du relais régénérés',
                        detail:
                          'L’ancien mot de passe cesse de fonctionner immédiatement. Le nouveau est affiché une seule fois.',
                        // Le backend attend le mot « regenerer » en confirmation
                        // (relevé du `422` : « Attendu : regenerer »).
                        appel: () =>
                          requete<IdentifiantsSmtp>('/web/smtp/identifiants', {
                            methode: 'POST',
                            corps: { confirmation: 'regenerer' },
                          }).then((r) => {
                            setIdentifiantsRegeneres(r)
                            return r
                          }),
                        effetFinal: reactualiser,
                      }}
                      confirmation={{
                        ressource: 'regenerer',
                        titre: 'Régénérer les identifiants du relais ?',
                        pertes: [
                          'Les applications qui utilisent le mot de passe actuel cesseront d’envoyer',
                          'Les clés d’envoi ne sont pas concernées',
                        ],
                        libelleAction: 'Régénérer',
                      }}
                    />
                  )}
                </div>
              </div>
              <div>
                <MicroLabel className="mb-2">Exemple d’envoi</MicroLabel>
                <CodeBlock
                  langue="python"
                  code={`import smtplib, os
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = "facturation@dba.africa"
msg["To"] = "client@exemple.ci"
msg["Subject"] = "Votre facture INV-2091"
msg.set_content("Bonjour, votre facture est disponible.")

with smtplib.SMTP("smtp.synelia.cloud", 587) as s:
    s.starttls()
    s.login("org-dba", os.environ["SYNELIA_SMTP_KEY"])
    s.send_message(msg)`}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {onglet === 'cles' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Clés d’envoi"
              sousTitre="Une clé par application. Révoquer une clé coupe les envois de cette application seule, sans toucher aux autres."
              actions={
                <GatedAction autorise={autorise('secrets.update')} message={refus('secrets.update')}>
                  <Button size="sm" variant="secondary" iconBefore={<Plus size={13} />} onClick={() => ouvrirCreationCle()}>
                    Créer une clé
                  </Button>
                </GatedAction>
              }
            />
            <div className="space-y-2">
              {clesAffichees.map((c) => (
                <div key={c.id} className="rounded-[6px] border border-g-300 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-p-050 text-p-700">
                        <Key size={13} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-ink">{c.nom}</span>
                        <span className="block text-[11px] text-g-500">
                          Créée le {dateCourte(c.creee)} · dernier envoi{' '}
                          {c.derniereUtilisation ? relatif(c.derniereUtilisation, maintenant) : 'jamais'}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <BoutonAction
                        libelle={api ? 'Remettre en service' : 'Réinitialiser'}
                        variant="ghost"
                        desactive={api && c.statut === 'active'}
                        operation={{
                          action: 'secrets.update',
                          titre: api
                            ? `Clé « ${c.nom} » remise en service`
                            : `Clé « ${c.nom} » réinitialisée`,
                          detail: api
                            ? 'La clé est de nouveau acceptée par le relais.'
                            : 'La nouvelle valeur est affichée une seule fois. L’ancienne cesse immédiatement de fonctionner.',
                          // Le contrat ne connaît pas la rotation d’une clé :
                          // la remise en service réactive une clé suspendue
                          // (`PATCH … { statut }`), le compteur journalier
                          // restant calculé côté backend.
                          appel: api
                            ? () =>
                                modifierRessource('/web/smtp/cles', c.id, {
                                  statut: 'active',
                                })
                            : undefined,
                          effet: () => cles.modifier(c.id, { envoyesJour: 0 }),
                          effetFinal: () => {
                            if (api) reactualiser()
                          },
                        }}
                      />
                      <BoutonAction
                        libelle="Révoquer"
                        variant="ghost"
                        operation={{
                          action: 'secrets.update',
                          ton: 'warn',
                          titre: `Clé « ${c.nom} » révoquée`,
                          detail: 'Les envois de cette application seront refusés dès maintenant.',
                          // `DELETE` confirmé par le nom exact, comme l’exige
                          // le backend (`422` sans lui).
                          appel: () => supprimerRessource('/web/smtp/cles', c.id, c.nom),
                          effet: () => cles.supprimer(c.id),
                          effetFinal: () => {
                            if (api) reactualiser()
                          },
                        }}
                        confirmation={{
                          ressource: c.nom,
                          titre: `Révoquer « ${c.nom} » ?`,
                          pertes: [
                            'Les envois de l’application qui l’utilise seront refusés immédiatement',
                            `Quota journalier libéré : ${c.quotaJour} messages`,
                            'La clé ne peut pas être restaurée : il faudra en créer une autre',
                          ],
                          libelleAction: 'Révoquer la clé',
                        }}
                      />
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <QuotaBar
                      libelle="Quota journalier de cette clé"
                      utilise={c.envoyesJour}
                      total={c.quotaJour}
                      compact
                      seuil={80}
                      formateur={(v) => num(v)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Callout ton="violet" className="mt-4" titre="Un quota par clé, pas seulement global">
              Si la clé de votre boutique se met à envoyer en boucle, elle atteint son propre quota et
              s’arrête. Vos factures et vos réinitialisations de mot de passe continuent de partir.
              C’est la raison d’être des clés séparées.
            </Callout>
          </Card>
        </div>
      )}

      {onglet === 'authentification' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Authentification du domaine"
              sousTitre="Ces trois mécanismes prouvent que vos courriels viennent bien de vous. Sans eux, ils finissent en indésirables — ou sont utilisés pour usurper votre identité."
            />
            <div className="space-y-2">
              {[
                {
                  nom: 'SPF',
                  etat: api ? (relais?.authentification.spf ?? 'absent') : SMTP.authentification.spf,
                  quoi: 'Déclare quels serveurs sont autorisés à envoyer pour votre domaine.',
                  valeur: 'v=spf1 include:spf.synelia.cloud -all',
                },
                {
                  nom: 'DKIM',
                  etat: api ? (relais?.authentification.dkim ?? 'absent') : SMTP.authentification.dkim,
                  quoi: 'Signe chaque courriel avec une clé privée ; le destinataire vérifie la signature via votre DNS.',
                  valeur: 'synelia._domainkey · RSA 2048 bits',
                },
                {
                  nom: 'DMARC',
                  etat: api ? relais?.authentification.dmarc || 'absent' : SMTP.authentification.dmarc,
                  quoi: 'Indique au destinataire quoi faire d’un courriel qui échoue SPF et DKIM, et vous envoie des rapports.',
                  valeur: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@dba.africa',
                },
              ].map((a) => (
                <div key={a.nom} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-bold text-ink">{a.nom}</span>
                      <Badge tone={a.etat === 'valide' ? 'ok' : 'violet'} size="sm">
                        {a.etat === 'valide' ? 'Valide' : a.etat}
                      </Badge>
                    </span>
                    <ButtonLink size="sm" variant="ghost" href="/app/web">
                      Voir dans la zone DNS
                    </ButtonLink>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-g-500">{a.quoi}</p>
                  <p className="mt-1.5 break-all rounded-[4px] bg-g-050 px-2 py-1 font-mono text-[10.5px] text-ink">
                    {a.valeur}
                  </p>
                </div>
              ))}
            </div>
            <Callout ton="warn" className="mt-4" titre="DMARC est en quarantaine, pas en rejet">
              Avec <span className="font-mono text-[12px]">p=quarantine</span>, un courriel usurpant
              votre domaine part en indésirables plutôt que d’être refusé. C’est la bonne étape
              intermédiaire : passez à <span className="font-mono text-[12px]">p=reject</span> quand
              vos rapports montrent que tous vos envois légitimes passent — sinon vous bloqueriez
              aussi vos propres courriels partis d’un outil oublié.
            </Callout>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Rapports DMARC"
                sousTitre="Reçus quotidiennement des grands fournisseurs, agrégés ici."
              />
              <div className="space-y-1.5">
                {[
                  { src: 'google.com', envois: 3842, conformes: 3842, pct: 100 },
                  { src: 'outlook.com', envois: 1204, conformes: 1198, pct: 99.5 },
                  { src: 'yahoo.com', envois: 412, conformes: 412, pct: 100 },
                  { src: 'orange.ci', envois: 288, conformes: 288, pct: 100 },
                  { src: '41.207.x.x (inconnu)', envois: 24, conformes: 0, pct: 0 },
                ].map((r) => (
                  <div key={r.src} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate font-mono text-[11.5px] text-ink">
                      {r.src}
                    </span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-g-100">
                      <span
                        className={cn(
                          'absolute inset-y-0 left-0 rounded-full',
                          r.pct === 100 ? 'bg-ok' : r.pct > 50 ? 'bg-warn' : 'bg-err',
                        )}
                        style={{ width: `${Math.max(3, r.pct)}%` }}
                      />
                    </span>
                    <span className="tnum w-12 shrink-0 text-right text-[11.5px] text-g-700">
                      {num(r.envois)}
                    </span>
                    <span
                      className={cn(
                        'tnum w-14 shrink-0 text-right text-[11.5px] font-semibold',
                        r.pct === 100 ? 'text-ok' : r.pct > 50 ? 'text-warn' : 'text-err',
                      )}
                    >
                      {pct(r.pct, 1)}
                    </span>
                  </div>
                ))}
              </div>
              <Callout ton="err" className="mt-4" titre="24 tentatives d’usurpation détectées">
                Une adresse au Nigéria a envoyé 24 courriels prétendant venir de{' '}
                <span className="font-mono text-[12px]">dba.africa</span> sans passer par notre
                relais. Ils ont tous échoué SPF et DKIM, et ont donc été mis en quarantaine chez les
                destinataires. C’est exactement ce que DMARC est censé faire.
              </Callout>
            </Card>

            <Card>
              <CardHeader titre="Réglages d’envoi" />
              <div className="space-y-3.5">
                <Switch
                  checked
                  disabled
                  label="Signer tous les courriels avec DKIM"
                  description="Non désactivable : un courriel non signé est massivement filtré."
                />
                <Switch
                  checked={refuserHorsDomaine}
                  onChange={setRefuserHorsDomaine}
                  label="Refuser les adresses d’expéditeur hors de vos domaines"
                  description="Empêche une application compromise d’envoyer au nom d’un autre domaine que les vôtres."
                />
                <Switch
                  checked={purgeErreurs}
                  onChange={setPurgeErreurs}
                  label="Supprimer automatiquement les adresses en erreur permanente"
                  description="Une adresse qui rejette trois fois de suite en 5.1.1 est retirée de vos envois. Continuer à écrire à des adresses mortes dégrade votre réputation."
                />
                <Switch
                  checked={desabonnement}
                  onChange={setDesabonnement}
                  label="Ajouter un en-tête de désabonnement en un clic"
                  description="Obligatoire pour les envois de masse chez Gmail et Yahoo. Inutile pour les courriels transactionnels."
                />
              </div>
              {api && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-g-100 pt-4 sm:grid-cols-2">
                  <Field
                    label="Domaines autorisés en expéditeur"
                    hint="séparés par des virgules"
                    error={erreursRelais.domainesAutorises}
                    className="sm:col-span-2"
                  >
                    <Input
                      value={domainesRelais}
                      onChange={(e) => setDomainesRelais(e.target.value)}
                      placeholder="dba.africa, digitalbusinessafrica.ci"
                    />
                  </Field>
                  <Field label="Quota journalier" error={erreursRelais.quotaJour}>
                    <Input
                      type="number"
                      value={quotaRelais}
                      onChange={(e) => setQuotaRelais(Number(e.target.value))}
                    />
                  </Field>
                </div>
              )}
              <BoutonAction
                libelle="Enregistrer"
                size="md"
                className="mt-4"
                operation={{
                  action: 'secrets.update',
                  titre: 'Réglages d’envoi enregistrés',
                  detail: [
                    refuserHorsDomaine ? 'expéditeurs hors domaine refusés' : 'expéditeurs libres',
                    purgeErreurs ? 'adresses mortes purgées' : 'adresses mortes conservées',
                    desabonnement ? 'en-tête de désabonnement ajouté' : 'aucun en-tête de désabonnement',
                  ].join(' · '),
                  // Les trois interrupteurs n’ont pas d’équivalent contrat :
                  // seuls domaines autorisés et quota partent dans `PATCH /web/smtp`.
                  appel: api
                    ? () =>
                        requete('/web/smtp', {
                          methode: 'PATCH',
                          corps: {
                            domainesAutorises: domainesRelais
                              .split(',')
                              .map((d) => d.trim())
                              .filter(Boolean),
                            quotaJour: quotaRelais,
                          },
                        })
                    : undefined,
                  onErreur: (e) => setErreursRelais(e.champs ?? {}),
                  effetFinal: () => {
                    if (api) {
                      setErreursRelais({})
                      reactualiser()
                    }
                  },
                }}
              />
            </Card>
          </div>
        </div>
      )}

      {onglet === 'journal' && (
        <Card padding={false}>
          <div className="border-b border-g-100 px-4 py-3.5">
            <CardHeader
              titre="Journal de livraison"
              sousTitre="Six dernières minutes. Le journal complet, avec recherche par destinataire et par code de réponse, est dans le moteur de recherche."
              className="mb-0"
              actions={
                <ButtonLink
                  size="sm"
                  variant="ghost"
                  external
                  href="https://logs.synelia.cloud/select/vmui"
                >
                  Journal complet
                </ButtonLink>
              }
            />
          </div>
          {journalDegrade && (
            <div className="px-4 pt-3">
              <DegradedState
                source="journal du relais"
                hauteur="h-28"
                integration={journalDegrade.integration}
                dateDonnees={journalDegrade.dateDonnees}
              />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  {['Horodatage', 'Destinataire', 'Sujet', 'Statut', 'Réponse du serveur'].map((h) => (
                    <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {journal.map((j) => (
                  <tr key={j.id} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-[11px] text-g-500">
                      {j.ts.slice(11, 19)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-ink">{j.destinataire}</td>
                    <td className="max-w-[28ch] truncate px-3 py-2 text-[12px] text-g-700">
                      {j.sujet}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={TON_STATUT[j.statut]} dot size="sm">
                        {LIBELLE_STATUT[j.statut]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-g-500">{j.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-g-100 px-4 py-3">
            <p className="text-[11.5px] leading-relaxed text-g-500">
              Un <span className="font-mono">451 4.7.1</span> est un différé, pas un échec : le
              serveur destinataire vous demande de réessayer plus tard, et nous le faisons
              automatiquement pendant 48 heures. Un <span className="font-mono">550 5.1.1</span> est
              définitif — l’adresse n’existe pas.
            </p>
          </div>
        </Card>
      )}

      {onglet === 'webhooks' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Webhooks"
              sousTitre="Nous appelons votre application dès qu’un courriel change d’état. Vous gardez ainsi la trace des rejets sans interroger notre journal."
              actions={
                <BoutonFormulaire
                  libelle="Ajouter"
                  icone={<Plus size={13} />}
                  action="secrets.update"
                  titre="Ajouter un webhook"
                  description="Nous appelons votre application dès qu’un courriel change d’état. Sans webhook, il faut interroger le journal."
                  champs={[
                    { id: 'url', label: 'URL appelée', placeholder: 'https://api.dba.africa/hooks/smtp', obligatoire: true },
                    {
                      id: 'evenements',
                      label: 'Événements',
                      type: 'select',
                      options: [
                        { value: 'rejete', label: 'Rejets seulement' },
                        { value: 'rejete,plainte', label: 'Rejets et plaintes' },
                        { value: 'delivre,rejete,plainte', label: 'Remises, rejets et plaintes' },
                      ],
                    },
                  ]}
                  valeursDepart={{ evenements: 'rejete,plainte' }}
                  libelleValider="Ajouter"
                  operation={(v) => ({
                    titre: 'Webhook ajouté',
                    detail: 'Un appel de test est envoyé immédiatement.',
                    // Les erreurs de champs (`422`, par exemple un
                    // événement inconnu) restent affichées dans la modale.
                    appel: () =>
                      creerRessource('/web/smtp/webhooks', {
                        url: String(v.url),
                        evenements: String(v.evenements)
                          .split(',')
                          .map((e) => evenementVersBackend(e.trim()))
                          .filter(Boolean),
                        actif: true,
                      }),
                    effet: () =>
                      webhooks.creer({
                        id: webhooks.identifiant('wh'),
                        url: String(v.url),
                        evenements: String(v.evenements).split(','),
                        actif: true,
                      }),
                    effetFinal: () => {
                      if (api) reactualiser()
                    },
                  })}
                />
              }
            />
            <div className="space-y-2">
              {webhooksAffiches.map((w) => (
                <div key={w.id} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span className="flex min-w-0 items-start gap-2">
                      <Webhook size={13} className="mt-0.5 shrink-0 text-p-700" />
                      <span className="min-w-0 break-all font-mono text-[11.5px] text-ink">
                        {w.url}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={w.actif ? 'ok' : 'neutral'} dot size="sm">
                        {w.actif ? 'Actif' : 'Désactivé'}
                      </Badge>
                      <BoutonAction
                        libelle="Tester"
                        variant="ghost"
                        operation={{
                          action: 'secrets.update',
                          ton: 'info',
                          titre: 'Appel de test envoyé',
                          detail: `${w.url} — un 2xx est attendu dans les cinq secondes, sinon nous réessayons trois fois.`,
                        }}
                      />
                      <BoutonAction
                        libelle={w.actif ? 'Désactiver' : 'Activer'}
                        variant="ghost"
                        operation={{
                          action: 'secrets.update',
                          ton: w.actif ? 'warn' : 'ok',
                          titre: w.actif ? 'Webhook désactivé' : 'Webhook réactivé',
                          appel: api
                            ? () =>
                                modifierRessource('/web/smtp/webhooks', w.id, {
                                  url: w.url,
                                  evenements: w.evenements.map(evenementVersBackend),
                                  actif: !w.actif,
                                })
                            : undefined,
                          effet: () => webhooks.modifier(w.id, { actif: !w.actif }),
                          effetFinal: () => {
                            if (api) reactualiser()
                          },
                        }}
                      />
                      <BoutonAction
                        libelle="Supprimer"
                        variant="ghost"
                        operation={{
                          action: 'secrets.update',
                          ton: 'warn',
                          titre: 'Webhook supprimé',
                          detail: `${w.url} ne sera plus appelé.`,
                          // `DELETE /web/smtp/webhooks/{id}` — sans confirmation côté
                          // backend ; l’écran garde la sienne, comme toute suppression.
                          appel: api ? () => supprimerRessource('/web/smtp/webhooks', w.id) : undefined,
                          effet: () => webhooks.supprimer(w.id),
                          effetFinal: () => {
                            if (api) reactualiser()
                          },
                        }}
                        confirmation={{
                          ressource: w.url,
                          titre: 'Supprimer ce webhook ?',
                          pertes: [
                            'Votre application ne sera plus prévenue des changements d’état',
                            'Le secret de signature associé est invalidé',
                          ],
                          libelleAction: 'Supprimer le webhook',
                        }}
                      />
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.evenements.map((e) => (
                      <Badge key={e} tone="neutral" size="sm">
                        {LIBELLE_STATUT[e] ?? e}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="Charge signée">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Chaque appel porte un en-tête{' '}
                <span className="font-mono text-[12px]">X-Synelia-Signature</span> calculé en HMAC
                SHA-256 sur le corps de la requête. Vérifiez-le : sans cela, n’importe qui connaissant
                votre URL peut vous envoyer de faux événements.
              </span>
            </Callout>
          </Card>

          <Card>
            <CardHeader titre="Format de la charge" sousTitre="JSON, un événement par appel." />
            <CodeBlock
              langue="json"
              code={`{
  "evenement": "rejete",
  "horodatage": "2026-08-19T15:16:44Z",
  "message_id": "<8f2a91c4@dba.africa>",
  "cle": "sk-2",
  "destinataire": "ancienne-adresse@yahoo.fr",
  "sujet": "Newsletter août",
  "code": "550",
  "code_etendu": "5.1.1",
  "detail": "User unknown",
  "definitif": true
}`}
            />
            <div className="mt-4 space-y-3 border-t border-g-100 pt-4">
              <Field label="Secret de signature" hint="à comparer côté application">
                <Input type="password" defaultValue="whsec_8f2a91c4d7b0e5443a17c96e2f0d8b41" readOnly />
              </Field>
              <Field label="Tentatives en cas d’échec" hint="délais croissants — 1 min, 5 min, 30 min, 2 h, 6 h">
                <Select defaultValue="5">
                  <option value="0">Aucune</option>
                  <option value="3">3 tentatives</option>
                  <option value="5">5 tentatives (recommandé)</option>
                </Select>
              </Field>
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={nouvelleCle}
        onClose={() => setNouvelleCle(false)}
        title={secretCree ? `Clé « ${secretCree.nom} » créée` : 'Nouvelle clé d’envoi'}
        size="md"
        footer={
          secretCree ? (
            <Button
              onClick={() => {
                setSecretCree(null)
                setNomCle('')
                setNouvelleCle(false)
              }}
            >
              Fermer
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setNouvelleCle(false)}>
                Annuler
              </Button>
              <Button disabled={!nomCle.trim()} onClick={creerCle}>
                Créer la clé
              </Button>
            </>
          )
        }
      >
        {secretCree ? (
          <div className="space-y-4">
            <CopyField label="Hôte" value={secretCree.hote} />
            <CopyField label="Mot de passe" value={secretCree.motDePasse} masque />
            <Callout ton="warn" titre="Le mot de passe n’est affiché qu’une seule fois">
              Nous ne le stockons pas en clair : personne chez nous ne peut le retrouver, pas même
              le support. Si vous le perdez, révoquez la clé et créez-en une autre.
            </Callout>
          </div>
        ) : (
          <div className="space-y-4">
            <Field
              label="Nom"
              hint="décrivez l’application qui utilisera cette clé"
              error={erreursCles.nom}
            >
              <Input
                value={nomCle}
                onChange={(e) => setNomCle(e.target.value)}
                placeholder="app-metier · notifications"
              />
            </Field>
            {erreursCles.quotaJour && (
              <p className="text-[12px] font-semibold text-err">{erreursCles.quotaJour}</p>
            )}
            <Field
              label="Quota journalier"
              hint="au-delà, les envois de cette clé sont refusés — les autres clés continuent"
            >
              <Input
                type="number"
                value={quotaCle}
                onChange={(e) => setQuotaCle(Number(e.target.value))}
              />
            </Field>
            <Field label="Adresse d’expéditeur autorisée" hint="doit appartenir à un de vos domaines">
              <Select value={expediteur} onChange={(e) => setExpediteur(e.target.value)}>
                <option value="facturation@dba.africa">facturation@dba.africa</option>
                <option value="noreply@dba.africa">noreply@dba.africa</option>
                <option value="contact@dba.africa">contact@dba.africa</option>
                <option value="*@dba.africa">Toute adresse de dba.africa</option>
              </Select>
            </Field>
            <Callout ton="warn" titre="La clé n’est affichée qu’une seule fois">
              Nous ne la stockons pas en clair : personne chez nous ne peut la retrouver, pas même
              le support. Si vous la perdez, réinitialisez-la — l’ancienne cesse alors immédiatement
              de fonctionner.
            </Callout>
          </div>
        )}
      </Modal>
    </div>
  )
}
