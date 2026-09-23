'use client'

import { useEffect, useState } from 'react'
import { Building2, Globe, Palette, Terminal, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateCourte, money } from '@/lib/format'
import { ESPACES, ORG_COURANTE } from '@/lib/mock'
import { ROLE_LABEL, SITE_LABEL, type EspaceCloud, type Organisation, type Role } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, modifierRessource, requete } from '@/lib/api/client'

/** `GET/PUT /moi/preferences` — préférences du membre connecté, pas de l'organisation
 * (le sous-titre le dit : « chaque membre peut les surcharger dans son profil »). */
interface Preferences {
  langue?: 'fr' | 'en'
  fuseau?: string
  sitePrefere?: 'ABJ' | 'GBM'
  deviseAffichee?: 'XOF' | 'EUR' | 'USD'
  formatCompact?: boolean
}

interface Jeton {
  id: string
  nom: string
  role?: string
  portee?: string | string[]
  cree?: string
  creeLe?: string
  dernier?: string
  derniereUtilisation?: string | null
  /** Backend : préfixe public affiché à la place du secret. */
  prefixe?: string
  statut?: string
}

const JETONS: Jeton[] = [
  { id: 'tok-1', nom: 'terraform-production', role: 'Administrateur d’infrastructure', portee: 'EC-DBA-01', cree: '2025-09-14', dernier: 'il y a 2 h' },
  { id: 'tok-2', nom: 'ci-deploiement', role: 'Administrateur d’application', portee: 'Organisation', cree: '2026-02-08', dernier: 'il y a 28 min' },
  { id: 'tok-3', nom: 'export-facturation', role: 'Responsable facturation', portee: 'Organisation', cree: '2026-06-01', dernier: 'il y a 3 j' },
]

/**
 * Libellé du formulaire → identifiants d’actions RBAC acceptés par
 * `POST /securite/cles-api` (inclus dans les permissions d’un org admin).
 */
const PORTEE_JETON: Record<string, string[]> = {
  'Lecture seule': ['org.dashboard.view', 'invoice.view', 'audit.view'],
  'Administrateur d’application': [
    'app.deploy',
    'app.rollback',
    'component.restart',
    'marketplace.subscribe',
    'seat.assign',
    'service.open',
  ],
  'Administrateur d’infrastructure': [
    'vm.create_delete',
    'vm.power',
    'vm.hardware.update',
    'network.manage',
    'lb.create',
    'backup.plan.write',
    'backup.restore',
    'espace.create',
  ],
  'Responsable facturation': ['invoice.view', 'payment.update'],
}

const ONGLETS = [
  { id: 'organisation', label: 'Organisation' },
  { id: 'preferences', label: 'Préférences' },
  { id: 'api', label: 'Accès programmatique' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'fermeture', label: 'Réversibilité' },
]

export default function Parametres() {
  const { autorise, refus, pousser, organisations, organisationId } = useApp()
  const orgActive = organisations.find((o) => o.id === organisationId) ?? organisations[0]
  // `organisations` (contexte) ne porte que `{ id, nom, role }`, tiré de la session : les
  // autres champs (pays, secteur, contribuable, domaine) venaient toujours de la graine
  // `ORG_COURANTE`, même en mode API. `GET /organisations/{id}` existe déjà (lecture ouverte
  // à `org.dashboard.view`, que porte déjà cette même page).
  const [orgDetail, setOrgDetail] = useState<Organisation | null>(null)
  useEffect(() => {
    if (!estActif() || !organisationId) return
    requete<Organisation>(`/organisations/${organisationId}`).then(setOrgDetail, () => {})
  }, [organisationId])
  const orgReelle: Organisation =
    orgDetail ?? (orgActive ? { ...ORG_COURANTE, id: orgActive.id, nom: orgActive.nom } : ORG_COURANTE)
  const executer = useOperation()
  const jetons = useCollection<Jeton>('jetons-api', JETONS)
  // Même collection que `/app/espaces` : le nombre d'Espaces Cloud affiché ici
  // doit suivre le backend, pas rester figé sur la graine.
  const espacesCol = useCollection<EspaceCloud>('espaces', ESPACES)
  // Formulaire d'identité : contrôlé pour pouvoir se resynchroniser quand `orgDetail`
  // arrive après le premier rendu (un `defaultValue` figerait la graine au montage).
  const [nomOrg, setNomOrg] = useState(orgReelle.nom)
  const [secteurOrg, setSecteurOrg] = useState(orgReelle.secteur ?? '')
  const [tvaOrg, setTvaOrg] = useState(orgReelle.tva ?? '')
  useEffect(() => {
    if (!orgDetail) return
    setNomOrg(orgDetail.nom)
    setSecteurOrg(orgDetail.secteur ?? '')
    setTvaOrg(orgDetail.tva ?? '')
  }, [orgDetail])

  /** Secret renvoyé une seule fois à la création — jamais réaffiché ensuite. */
  const [secretCree, setSecretCree] = useState<string | null>(null)
  const [onglet, setOnglet] = useState('organisation')
  const [fermeture, setFermeture] = useState(false)

  const [devise, setDevise] = useState('XOF')
  const [langue, setLangue] = useState('fr')
  const [fuseau, setFuseau] = useState('Africa/Abidjan')
  const [siteDefaut, setSiteDefaut] = useState('ABJ')
  const [horsTaxes, setHorsTaxes] = useState(true)
  const [densiteCompacte, setDensiteCompacte] = useState(false)

  // Les préférences existent réellement côté backend (`GET/PUT /moi/preferences`)
  // mais n'étaient jamais lues ni écrites depuis cet écran — la graine locale
  // s'affichait, le bouton « Enregistrer » ne faisait qu'un toast. Chargé une
  // fois au montage, en mode API seulement.
  useEffect(() => {
    if (!estActif()) return
    requete<Preferences>('/moi/preferences').then((p) => {
      if (p.langue) setLangue(p.langue)
      if (p.fuseau === 'Africa/Abidjan' || p.fuseau === 'Africa/Dakar' || p.fuseau === 'Africa/Lagos' || p.fuseau === 'Europe/Paris' || p.fuseau === 'UTC') {
        setFuseau(p.fuseau)
      }
      if (p.sitePrefere) setSiteDefaut(p.sitePrefere)
      if (p.deviseAffichee) setDevise(p.deviseAffichee)
      if (typeof p.formatCompact === 'boolean') setDensiteCompacte(p.formatCompact)
    }, () => {})
  }, [])

  const [mailTechnique, setMailTechnique] = useState('ops@dba.africa')
  const [mailFacturation, setMailFacturation] = useState('compta@dba.africa')
  const [smsCritique, setSmsCritique] = useState('+225 07 00 00 00 00')
  const [webhook, setWebhook] = useState('')
  /** Notifications désactivées par le client — les figées restent actives. */
  const [notifsCoupees, setNotifsCoupees] = useState<string[]>([])

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Paramètres' }]}
        titre="Paramètres de l’organisation"
        sousTitre="Identité de l’organisation, préférences d’affichage, accès programmatique, notifications, et les moyens de partir avec vos données si vous le décidez."
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {orgReelle.nom}
            </Badge>
            <Badge tone="neutral" size="sm">
              Cliente depuis {dateCourte(ORG_COURANTE.createdAt)} (démonstration)
            </Badge>
            <Badge tone={ORG_COURANTE.statut === 'active' ? 'ok' : 'warn'} dot size="sm">
              {ORG_COURANTE.statut === 'active' ? 'Active' : ORG_COURANTE.statut}
            </Badge>
          </>
        }
      />

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'organisation' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Identité"
              sousTitre="Ces informations figurent sur vos factures et vos contrats. Un changement de raison sociale exige un justificatif."
            />
            <div className="space-y-4">
              <Field label="Raison sociale">
                <Input value={nomOrg} onChange={(e) => setNomOrg(e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Pays">
                  <Select defaultValue={orgReelle.pays}>
                    <option value="Côte d’Ivoire">Côte d’Ivoire</option>
                    <option value="Sénégal">Sénégal</option>
                    <option value="Bénin">Bénin</option>
                    <option value="Togo">Togo</option>
                    <option value="Burkina Faso">Burkina Faso</option>
                    <option value="France">France</option>
                  </Select>
                </Field>
                <Field label="Secteur">
                  <Input value={secteurOrg} onChange={(e) => setSecteurOrg(e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Numéro de contribuable" hint="figure sur la facture, sert au régime de TVA">
                  <Input value={tvaOrg} onChange={(e) => setTvaOrg(e.target.value)} />
                </Field>
                <Field label="Domaine principal" hint="utilisé pour la découverte de la fédération d’identité">
                  <Input defaultValue={orgReelle.domaine ?? 'dba.africa'} />
                </Field>
              </div>
              <Field label="Adresse de facturation">
                <Textarea rows={3} defaultValue={'Plateau, Boulevard de la République\nImmeuble Alpha 2000, 8e étage\nAbidjan, Côte d’Ivoire'} />
              </Field>
            </div>
            {/* `PATCH /organisations/{id}` exige `org.manage` — réservé à l'équipe Synelia
             (`ligne('org.manage', …, '●—————————')` dans `rbac.ts` : aucun rôle d'organisation
             cliente ne l'a). Le bouton se désactive donc pour tout rôle client, avec l'infobulle
             qui nomme le rôle requis, plutôt que d'appeler un endpoint qui répondrait 403 — et
             plutôt que le faux succès d'avant, qui ne postait jamais rien. Seuls les champs que
             le contrat accepte (`nom`, `secteur`, `tva`) partent ; pays/domaine/adresse restent
             en lecture, faute d'équivalent côté backend. */}
            <GatedAction autorise={autorise('org.manage')} message={refus('org.manage')}>
              <BoutonAction
                libelle="Enregistrer"
                size="md"
                className="mt-4"
                operation={{
                  action: 'org.manage',
                  titre: 'Informations enregistrées',
                  detail: 'Elles seront reprises sur votre prochaine facture.',
                  appel: () =>
                    modifierRessource('/organisations', orgReelle.id, {
                      nom: nomOrg,
                      secteur: secteurOrg || undefined,
                      tva: tvaOrg || undefined,
                    }),
                  effetFinal: () =>
                    requete<Organisation>(`/organisations/${orgReelle.id}`).then(setOrgDetail, () => {}),
                }}
              />
            </GatedAction>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader titre="Situation contractuelle" />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Identifiant d’organisation', valeur: orgReelle.id },
                  { cle: 'Contrat', valeur: 'Direct avec Synelia Cloud' },
                  { cle: 'Plan de service', valeur: orgReelle.tenantPlan ?? 'Standard' },
                  { cle: 'Espaces Cloud', valeur: String(espacesCol.items.length) },
                  { cle: 'Cliente depuis (démonstration)', valeur: dateCourte(ORG_COURANTE.createdAt) },
                  {
                    cle: 'Dépense mensuelle',
                    valeur: ORG_COURANTE.caMensuel ? money(ORG_COURANTE.caMensuel) : '—',
                  },
                ]}
              />
              <Callout ton="info" className="mt-4" titre="Votre contrat est direct, sans intermédiaire">
                Synelia exploite la plateforme, vous facture et assure votre support : il n’y a pas de
                revendeur entre nous. Vous n’avez qu’un interlocuteur à saisir, et un seul contrat à
                lire.
              </Callout>
            </Card>

            <Card>
              <CardHeader titre="Organisations auxquelles vous appartenez" sousTitre="Basculez sans vous reconnecter." />
              <div className="space-y-2">
                {/* `organisations` (contexte) vient déjà de la session réelle en mode API
                 (`GET /moi`, mêmes appartenances) : la graine `MES_ORGANISATIONS` qui était
                 lue ici restait figée même en mode API, alors que `orgActive` juste au-dessus
                 s'en servait déjà pour la même carte. */}
                {organisations.map((org) => (
                  <div
                    key={org.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 rounded-[6px] border px-3 py-2.5',
                      org.id === orgReelle.id ? 'border-p-700 bg-p-050' : 'border-g-300',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 size={13} className="shrink-0 text-p-700" />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">
                          {org.nom}
                        </span>
                        <span className="block text-[11px] text-g-500">
                          {ROLE_LABEL[org.role as Role] ?? org.role}
                        </span>
                      </span>
                    </span>
                    {org.id === orgReelle.id ? (
                      <Badge tone="violet" size="sm">
                        Organisation active
                      </Badge>
                    ) : (
                      <ButtonLink size="sm" variant="ghost" href="/select-organisation">
                        Basculer
                      </ButtonLink>
                    )}
                  </div>
                ))}
              </div>
              <ButtonLink size="sm" variant="ghost" className="mt-3" href="/select-organisation">
                Voir le sélecteur complet
              </ButtonLink>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'preferences' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Affichage et régionalisation"
              sousTitre="Ces réglages s’appliquent à toute l’organisation. Chaque membre peut les surcharger dans son profil."
            />
            <div className="space-y-4">
              <Field label="Devise d’affichage" hint="la facturation reste dans la devise contractuelle">
                <Select value={devise} onChange={(e) => setDevise(e.target.value)}>
                  <option value="XOF">Franc CFA (FCFA) — devise contractuelle</option>
                  <option value="EUR">Euro (€) — conversion indicative</option>
                  <option value="USD">Dollar américain ($) — conversion indicative</option>
                </Select>
              </Field>
              <Field label="Langue">
                <Select value={langue} onChange={(e) => setLangue(e.target.value)}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label="Fuseau horaire" hint="tous les horodatages du portail y sont convertis">
                <Select value={fuseau} onChange={(e) => setFuseau(e.target.value)}>
                  <option value="Africa/Abidjan">Abidjan (GMT)</option>
                  <option value="Africa/Dakar">Dakar (GMT)</option>
                  <option value="Africa/Lagos">Lagos (GMT+1)</option>
                  <option value="Europe/Paris">Paris (GMT+1 / GMT+2)</option>
                  <option value="UTC">Temps universel coordonné</option>
                </Select>
              </Field>
              <Field label="Site physique par défaut" hint="proposé en premier à la création d’une ressource">
                <Select value={siteDefaut} onChange={(e) => setSiteDefaut(e.target.value)}>
                  <option value="ABJ">{SITE_LABEL['ABJ']}</option>
                  <option value="GBM">{SITE_LABEL['GBM']}</option>
                </Select>
              </Field>
              <div className="space-y-3">
                <Switch
                  checked
                  disabled
                  label="Afficher le site physique sur chaque ressource"
                  description="Non désactivable. Savoir où tourne une ressource fait partie de ce que nous vous devons."
                />
                <Switch
                  checked={horsTaxes}
                  onChange={setHorsTaxes}
                  label="Afficher les montants hors taxes"
                  description="La TVA de 18 % est détaillée séparément dans chaque aperçu de coût."
                />
                <Switch
                  checked={densiteCompacte}
                  onChange={setDensiteCompacte}
                  label="Densité compacte des tableaux par défaut"
                />
              </div>
            </div>
            <BoutonAction
              libelle="Enregistrer les préférences"
              size="md"
              className="mt-4"
              operation={{
                titre: 'Préférences enregistrées',
                detail: `${devise} · ${langue === 'fr' ? 'français' : 'anglais'} · ${fuseau} · site ${siteDefaut} par défaut`,
                appel: () =>
                  requete('/moi/preferences', {
                    methode: 'PUT',
                    corps: {
                      langue,
                      fuseau,
                      sitePrefere: siteDefaut,
                      deviseAffichee: devise,
                      formatCompact: densiteCompacte,
                    },
                  }),
              }}
            />
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Étiquettes de répartition"
                sousTitre="Les étiquettes servent à ventiler la dépense par service, projet ou client. Sans elles, la refacturation interne devient un exercice d’archéologie."
              />
              <div className="space-y-2">
                {[
                  { cle: 'centre-de-cout', valeurs: ['DSI', 'Marketing', 'Production', 'R&D'], obligatoire: true },
                  { cle: 'projet', valeurs: ['refonte-2026', 'boutique', 'analytics'], obligatoire: false },
                  { cle: 'environnement', valeurs: ['production', 'preproduction', 'developpement'], obligatoire: true },
                  { cle: 'responsable', valeurs: ['l.konan', 'k.toure', 'm.diallo'], obligatoire: false },
                ].map((t) => (
                  <div key={t.cle} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-ink">{t.cle}</span>
                      <span className="flex items-center gap-1.5">
                        {t.obligatoire && (
                          <Badge tone="violet" size="sm">
                            Obligatoire
                          </Badge>
                        )}
                        <BoutonFormulaire
                          libelle="Modifier"
                          variant="ghost"
                          titre={`Modifier l’étiquette ${t.cle}`}
                          description="Une étiquette obligatoire doit être renseignée à la création d’une ressource : c’est ce qui garantit que la refacturation interne reste possible."
                          champs={[
                            {
                              id: 'valeurs',
                              label: 'Valeurs autorisées',
                              placeholder: 'séparées par des virgules',
                            },
                            { id: 'obligatoire', label: 'Obligatoire', type: 'switch', placeholder: 'À la création' },
                          ]}
                          valeursDepart={{ valeurs: t.valeurs.join(', '), obligatoire: t.obligatoire }}
                          sansApi="Indisponible : le registre d’étiquettes n’est pas encore exposé par l’API."
                          operation={(v) => ({
                            titre: `Étiquette ${t.cle} modifiée`,
                            detail: `${String(v.valeurs).split(',').filter((x) => x.trim()).length} valeurs${v.obligatoire ? ' · obligatoire' : ''}`,
                          })}
                        />
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.valeurs.map((v) => (
                        <Badge key={v} tone="neutral" size="sm">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Callout ton="info" className="mt-4" titre="Rendre une étiquette obligatoire">
                Une étiquette obligatoire bloque la création d’une ressource qui ne la porte pas. C’est
                contraignant sur le moment, et c’est ce qui rend la ventilation de la facture
                exploitable six mois plus tard.
              </Callout>
              <ButtonLink size="sm" variant="ghost" className="mt-3" href="/app/facturation">
                Voir la ventilation de la dépense
              </ButtonLink>
            </Card>

            <Card>
              <CardHeader
                titre="Personnalisation visuelle"
                sousTitre="Logo et couleur affichés dans votre espace client."
                actions={<Palette size={15} className="text-p-700" />}
              />
              <div className="space-y-4">
                <Field label="Logo de l’organisation" hint="PNG ou SVG, fond transparent, 200 × 60 px minimum">
                  <Input type="file" />
                </Field>
                <Field label="Couleur d’accentuation" hint="utilisée dans l’en-tête de votre espace">
                  <Input type="color" defaultValue="#5C2D91" className="h-10 w-24" />
                </Field>
              </div>
              <Callout ton="info" className="mt-4" titre="Personnalisation limitée volontairement">
                Nous ne laissons pas repeindre tout le portail : quand un incident survient, il faut
                que nos équipes et les vôtres regardent le même écran et se comprennent immédiatement.
                Un thème radicalement différent par organisation rendrait le support beaucoup plus
                lent.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'api' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Jetons d’accès programmatique"
                sousTitre="Pour l’automatisation, l’infrastructure déclarative, l’intégration continue. Un jeton porte un rôle et une portée, comme un membre."
              />
              <div className="space-y-2">
                {jetons.items.map((j) => (
                  <div key={j.id} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-mono text-[12.5px] font-semibold text-ink">
                          {j.nom}
                          {j.prefixe && (
                            <span className="ml-1.5 font-normal text-g-500">{j.prefixe}…</span>
                          )}
                        </span>
                        <span className="block text-[11px] text-g-500">
                          {Array.isArray(j.portee) ? j.portee.join(' · ') : (j.role ? `${j.role} · ` : '') + (j.portee ?? '')}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge tone="neutral" size="sm">
                          {j.dernier ?? (j.derniereUtilisation ? `utilisé ${j.derniereUtilisation}` : 'jamais utilisé')}
                        </Badge>
                        <BoutonAction
                          libelle="Révoquer"
                          variant="ghost"
                          operation={{
                            action: 'secrets.update',
                            ton: 'warn',
                            titre: `Jeton ${j.nom} révoqué`,
                            detail: 'Toute automatisation qui l’utilise cessera de fonctionner immédiatement.',
                            appel: () =>
                              requete(`/securite/cles-api/${encodeURIComponent(j.id)}`, {
                                methode: 'DELETE',
                              }),
                            effet: () => jetons.supprimer(j.id),
                            effetFinal: () => jetons.recharger(),
                          }}
                          confirmation={{
                            ressource: j.nom,
                            titre: `Révoquer ${j.nom} ?`,
                            pertes: [
                              'Les appels qui utilisent ce jeton recevront un 401 dès la révocation',
                              `Portée concernée : ${j.portee}`,
                              'Le jeton ne peut pas être réactivé : il faudra en créer un autre',
                            ],
                            libelleAction: 'Révoquer le jeton',
                          }}
                        />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <BoutonFormulaire
                libelle="Créer un jeton"
                className="mt-3"
                action="secrets.update"
                titre="Créer un jeton d’accès programmatique"
                description="Un jeton porte un rôle et une portée, comme un membre — mais sans deuxième facteur. Donnez-lui le rôle le plus étroit possible."
                champs={[
                  { id: 'nom', label: 'Nom', placeholder: 'terraform-preproduction', obligatoire: true },
                  {
                    id: 'role',
                    label: 'Rôle',
                    type: 'select',
                    options: [
                      { value: 'Lecture seule', label: 'Lecture seule' },
                      { value: 'Administrateur d’application', label: 'Administrateur d’application' },
                      { value: 'Administrateur d’infrastructure', label: 'Administrateur d’infrastructure' },
                      { value: 'Responsable facturation', label: 'Responsable facturation' },
                    ],
                  },
                  {
                    id: 'portee',
                    label: 'Portée',
                    type: 'select',
                    options: [
                      { value: 'Organisation', label: 'Toute l’organisation' },
                      ...espacesCol.items.map((e) => ({ value: e.code, label: `Espace ${e.code}` })),
                    ],
                  },
                  { id: 'expiration', label: 'Expire dans', type: 'nombre', demi: true, min: 1, max: 730, suffixe: 'jours' },
                ]}
                valeursDepart={{ role: 'Lecture seule', portee: 'Organisation', expiration: 90 }}
                libelleValider="Créer le jeton"
                operation={(v) => ({
                  titre: `Jeton ${v.nom} créé`,
                  detail: 'La valeur du jeton est affichée une seule fois : copiez-la maintenant.',
                  // Le backend attend des identifiants d’actions RBAC, pas le
                  // libellé du rôle : la correspondance vit ici, au seul
                  // endroit où ce formulaire existe.
                  appel: () =>
                    creerRessource('/securite/cles-api', {
                      nom: String(v.nom),
                      portee: PORTEE_JETON[String(v.role)] ?? ['org.dashboard.view'],
                    }).then((reponse) => {
                      const secret = (reponse as { secret?: unknown } | null)?.secret
                      if (typeof secret === 'string') setSecretCree(secret)
                      return reponse
                    }),
                  effet: () =>
                    jetons.creer({
                      id: jetons.identifiant('tok'),
                      nom: String(v.nom),
                      role: String(v.role),
                      portee: String(v.portee),
                      cree: MAINTENANT.slice(0, 10),
                      dernier: 'jamais utilisé',
                    }),
                  effetFinal: () => jetons.recharger(),
                })}
              />
              <Callout ton="warn" className="mt-4" titre="Un jeton n’a pas de deuxième facteur">
                C’est un secret unique : quiconque le détient agit avec les droits qu’il porte. Donnez
                à chaque jeton le rôle le plus étroit possible, restreignez sa portée à un seul espace
                quand c’est faisable, et faites-les tourner. Un jeton d’administrateur d’organisation
                dans un fichier de configuration est un incident en attente.
              </Callout>
              {secretCree && (
                <div className="mt-4 rounded-[8px] border border-err/40 bg-err-bg px-3.5 py-3">
                  <p className="text-[12.5px] font-bold text-ink">
                    Copiez ce secret maintenant — il ne sera plus jamais affiché
                  </p>
                  <p className="mt-1 font-mono text-[12px] break-all text-ink">{secretCree}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => setSecretCree(null)}
                  >
                    Je l’ai copié, masquer
                  </Button>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                titre="Utiliser l’interface programmatique"
                sousTitre="API REST documentée, plus une interface en ligne de commande."
                actions={<Terminal size={15} className="text-p-700" />}
              />
              <div className="space-y-3">
                <CopyField label="Adresse de l’API" value="https://api.synelia.cloud/v1" />
                <CopyField label="Organisation" value={orgReelle.id} />
              </div>
              <MicroLabel className="mt-4 mb-2">Exemple</MicroLabel>
              <CodeBlock
                langue="bash"
                code={`export SYNELIA_TOKEN="syn_…"

# Lister les machines d'un espace
curl -sS https://api.synelia.cloud/v1/espaces/ec-dba-01/vms \\
  -H "Authorization: Bearer $SYNELIA_TOKEN" | jq '.[] | {nom, statut, site}'

# Créer une machine (l'aperçu de coût est renvoyé avant validation)
synelia vm create --espace EC-DBA-01 --gabarit c2.medium \\
  --site ABJ-1 --etiquette centre-de-cout=DSI --dry-run`}
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ButtonLink size="sm" variant="secondary" href="/app/docs">
                  Documentation de l’API
                </ButtonLink>
                <ButtonLink size="sm" variant="ghost" external href="https://registry.terraform.io">
                  Fournisseur Terraform
                </ButtonLink>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Limites d’appel"
              sousTitre="Les mêmes pour tous, quelle que soit la taille de l’organisation."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <StatTile libelle="Lectures" valeur="600" unite="/min" detail="Par jeton" />
              <StatTile libelle="Écritures" valeur="60" unite="/min" detail="Par jeton" />
              <StatTile libelle="Actions destructives" valeur="10" unite="/min" detail="Par organisation" ton="warn" />
              <StatTile
                libelle="Appels aujourd’hui"
                valeur="8 412"
                detail={`Sur ${jetons.items.length} jeton${jetons.items.length > 1 ? 's' : ''}`}
              />
            </div>
            <p className="mt-3.5 text-[11.5px] leading-relaxed text-g-500">
              Un dépassement renvoie un code 429 avec un en-tête indiquant le délai d’attente. Les
              actions destructives sont plus limitées que les autres : une boucle qui supprime est
              plus coûteuse à réparer qu’une boucle qui lit.
            </p>
          </Card>
        </div>
      )}

      {onglet === 'notifications' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Ce que nous vous envoyons"
              sousTitre="Nous préférons une alerte utile à dix notifications ignorées. Chaque catégorie est réglable séparément."
            />
            <div className="space-y-3.5">
              {[
                {
                  t: 'Incidents affectant vos ressources',
                  d: 'Uniquement quand une de vos ressources est concernée, pas à chaque incident de la plateforme.',
                  actif: true,
                  fige: true,
                },
                {
                  t: 'Sauvegarde en échec',
                  d: 'Dès le premier échec, pas après trois. Une sauvegarde qui échoue silencieusement est le pire des cas.',
                  actif: true,
                  fige: true,
                },
                {
                  t: 'Alertes de seuil',
                  d: 'Selon les règles que vous avez définies dans l’observabilité.',
                  actif: true,
                  fige: false,
                },
                {
                  t: 'Déploiement en échec',
                  d: 'Avec le diagnostic et le remède proposé, pas seulement la mention de l’échec.',
                  actif: true,
                  fige: false,
                },
                {
                  t: 'Facture disponible',
                  d: 'À l’émission, et un rappel trois jours avant l’échéance.',
                  actif: true,
                  fige: false,
                },
                {
                  t: 'Maintenance planifiée',
                  d: 'Sept jours avant, puis vingt-quatre heures avant.',
                  actif: true,
                  fige: true,
                },
                {
                  t: 'Mises à jour disponibles sur un service managé',
                  d: 'Avec le contenu de la mise à jour et la fenêtre proposée.',
                  actif: true,
                  fige: false,
                },
                {
                  t: 'Nouveautés produit',
                  d: 'Une fois par mois au maximum. Aucune relance commerciale.',
                  actif: false,
                  fige: false,
                },
              ].map((n) => (
                <Switch
                  key={n.t}
                  checked={n.fige || (n.actif && !notifsCoupees.includes(n.t))}
                  disabled={n.fige}
                  onChange={(v) =>
                    setNotifsCoupees((prev) =>
                      v ? prev.filter((x) => x !== n.t) : [...prev, n.t],
                    )
                  }
                  label={n.t + (n.fige ? ' (non désactivable)' : '')}
                  description={n.d}
                />
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader titre="Canaux" sousTitre="Où les notifications arrivent." />
              <div className="space-y-4">
                <Field label="Adresse de contact technique" hint="reçoit les alertes et les incidents">
                  <Input
                    type="email"
                    value={mailTechnique}
                    onChange={(e) => setMailTechnique(e.target.value)}
                  />
                </Field>
                <Field label="Adresse de contact facturation" hint="reçoit les factures et les échéances">
                  <Input
                    type="email"
                    value={mailFacturation}
                    onChange={(e) => setMailFacturation(e.target.value)}
                  />
                </Field>
                <Field label="Numéro pour les SMS critiques" hint="réservé aux incidents majeurs, jamais utilisé pour le reste">
                  <Input value={smsCritique} onChange={(e) => setSmsCritique(e.target.value)} />
                </Field>
                <Field label="Webhook d’équipe" hint="Slack, Teams, Mattermost, ou n’importe quel point d’entrée HTTP">
                  <Input
                    value={webhook}
                    onChange={(e) => setWebhook(e.target.value)}
                    placeholder="https://hooks.exemple.ci/synelia"
                  />
                </Field>
              </div>
              <BoutonAction
                libelle="Enregistrer les canaux"
                size="md"
                className="mt-4"
                operation={{
                  titre: 'Canaux de notification enregistrés',
                  detail: `${mailTechnique} · ${mailFacturation}${webhook ? ' · webhook d’équipe actif' : ''}${notifsCoupees.length ? ` · ${notifsCoupees.length} notification(s) coupée(s)` : ''}`,
                  sansApi:
                    'Indisponible : les canaux de notification ne sont pas encore enregistrés par l’API.',
                }}
              />
            </Card>

            <Card>
              <CardHeader
                titre="Fenêtres de maintenance"
                sousTitre="Nous planifions nos interventions dans la fenêtre que vous nous indiquez, sauf urgence de sécurité."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Jour préféré">
                  <Select defaultValue="dimanche">
                    <option value="samedi">Samedi</option>
                    <option value="dimanche">Dimanche</option>
                    <option value="nuit">N’importe quelle nuit</option>
                  </Select>
                </Field>
                <Field label="Heure de début" hint="heure locale d’Abidjan">
                  <Select defaultValue="02">
                    <option value="00">00 h 00</option>
                    <option value="02">02 h 00</option>
                    <option value="04">04 h 00</option>
                  </Select>
                </Field>
              </div>
              <Callout ton="warn" className="mt-4" titre="L’exception des correctifs de sécurité">
                Une vulnérabilité critique activement exploitée est corrigée dès que possible, sans
                attendre votre fenêtre. Nous vous prévenons, mais nous n’attendons pas : le risque
                d’exploitation dépasse celui d’une interruption brève.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'fermeture' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Réversibilité"
              sousTitre="Ce que vous pouvez récupérer, et par quel moyen. Nous préférons écrire cette page franchement plutôt que la rendre introuvable."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Donnée', 'Format de sortie', 'Moyen', 'Délai'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { d: 'Images de machines virtuelles', f: 'QCOW2 ou OVA', m: 'Export via l’API ou l’interface', t: 'Immédiat, selon la taille' },
                    { d: 'Volumes de bloc', f: 'Image brute', m: 'Export vers votre stockage objet', t: 'Immédiat' },
                    { d: 'Stockage objet', f: 'Protocole compatible S3', m: 'rclone, aws-cli, mc — vos outils habituels', t: 'Immédiat' },
                    { d: 'Bases managées', f: 'Vidage SQL natif', m: 'pg_dump, mysqldump, mongodump', t: 'Immédiat' },
                    { d: 'Configuration Kubernetes', f: 'Manifestes YAML', m: 'kubectl, avec votre fichier de configuration', t: 'Immédiat' },
                    { d: 'Zones DNS', f: 'Fichier de zone BIND', m: 'Export depuis l’éditeur de zone', t: 'Immédiat' },
                    { d: 'Domaines', f: 'Code d’autorisation de transfert', m: 'Disponible dans les réglages du domaine', t: 'Immédiat' },
                    { d: 'Données des services managés', f: 'Format natif de la solution', m: 'Outils d’export de la solution (Nextcloud, Odoo, GitLab…)', t: 'Immédiat' },
                    { d: 'Journal d’audit', f: 'CSV, JSON, PDF signé', m: 'Export depuis Sécurité & audit', t: 'Quelques minutes' },
                    { d: 'Factures', f: 'PDF et CSV', m: 'Export depuis Facturation', t: 'Immédiat' },
                    { d: 'Points de sauvegarde', f: 'Archive restaurable', m: 'Sur demande, accompagnée par nos équipes', t: '2 jours ouvrés' },
                  ].map((x) => (
                    <tr key={x.d} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2 text-[12px] font-semibold text-ink">{x.d}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-g-700">{x.f}</td>
                      <td className="px-3 py-2 text-[11.5px] text-g-700">{x.m}</td>
                      <td className="px-3 py-2 text-[11.5px] text-g-500">{x.t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout ton="violet" className="mt-4" titre="Aucun format propriétaire">
              Rien de ce que nous stockons pour vous n’est enfermé dans un format que nous serions
              seuls à savoir lire. C’est un choix d’architecture, pas une faveur : nous préférons vous
              garder parce que le service est bon, pas parce que partir serait coûteux.
            </Callout>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Export complet"
                sousTitre="Un export unique de tout ce qui vous appartient, préparé par nos équipes."
              />
              <div className="space-y-4">
                <Field label="Destination">
                  <Select defaultValue="objet">
                    <option value="objet">Un compartiment de votre stockage objet</option>
                    <option value="externe">Un stockage compatible S3 externe</option>
                    <option value="physique">Support physique remis en main propre à Abidjan</option>
                  </Select>
                </Field>
                <Field label="Périmètre">
                  <Select defaultValue="tout">
                    <option value="tout">Tout l’organisation</option>
                    <option value="espace">Un Espace Cloud</option>
                    <option value="services">Les services managés uniquement</option>
                  </Select>
                </Field>
              </div>
              <BoutonAction
                libelle="Demander un export complet"
                size="md"
                className="mt-4"
                icone={<Globe size={14} />}
                operation={{
                  action: 'compliance.export',
                  titre: 'Export complet demandé',
                  detail:
                    'Gratuit une fois par an et à la clôture. Vous recevrez un lien dès que l’archive est prête.',
                  job: { workflow: 'export.donnees', cible: 'données de l’organisation' },
                  sansApi:
                    'Indisponible : l’export complet multi-ressources n’est pas encore exposé par l’API.',
                }}
              />
              <p className="mt-3 text-[11.5px] leading-relaxed text-g-500">
                Un export complet est gratuit une fois par an, et à la clôture du contrat. Au-delà,
                seul le coût du transfert sortant est facturé, au tarif du catalogue.
              </p>
            </Card>

            <Card className="border-err/30">
              <CardHeader
                titre="Clôture de l’organisation"
                sousTitre="Vous pouvez partir. Voici exactement ce qui se passe si vous le décidez."
              />
              <div className="space-y-2">
                {[
                  { j: 'Jour 0', d: 'Votre demande est enregistrée. Rien n’est supprimé. Vos ressources continuent de tourner.' },
                  { j: 'Jours 0 à 30', d: 'Période de récupération. Tous vos exports restent disponibles, l’accès au portail est maintenu en lecture. Vous pouvez annuler à tout moment.' },
                  { j: 'Jour 30', d: 'Les ressources actives sont arrêtées. Les données restent, les facturations à l’usage cessent.' },
                  { j: 'Jours 30 à 60', d: 'Les données sont conservées, en lecture seule. Une reprise reste possible sur simple demande.' },
                  { j: 'Jour 60', d: 'Effacement définitif et irréversible, avec attestation de destruction remise par écrit.' },
                ].map((e) => (
                  <div key={e.j} className="rounded-[6px] border border-g-300 px-3 py-2">
                    <p className="text-[12px] font-bold text-ink">{e.j}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">{e.d}</p>
                  </div>
                ))}
              </div>
              <GatedAction autorise={autorise('payment.update')} message={refus('payment.update')}>
                <Button
                  className="mt-4"
                  variant="danger"
                  iconBefore={<Trash2 size={14} />}
                  onClick={() => setFermeture(true)}
                  disabled={estActif()}
                  title={
                    estActif()
                      ? 'Indisponible : la demande de clôture n’a pas encore de route backend équivalente.'
                      : undefined
                  }
                >
                  Demander la clôture
                </Button>
              </GatedAction>
              <p className="mt-3 text-[11.5px] leading-relaxed text-g-500">
                Aucune pénalité de sortie, aucun préavis contractuel au-delà du mois en cours. Le
                prorata du mois entamé reste dû, rien de plus.
              </p>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={fermeture}
        onClose={() => setFermeture(false)}
        titre="Demander la clôture de l’organisation"
        ressource={orgReelle.nom}
        libelleAction="Enregistrer la demande de clôture"
        pertes={[
          `${espacesCol.items.length} Espaces Cloud et toutes leurs ressources, arrêtés au jour 30`,
          'Toutes les données, effacées définitivement au jour 60',
          'Les accès de tous les membres de l’organisation',
          'Les domaines non transférés reviendront au registre à leur échéance',
        ]}
        onConfirm={() => {
          pousser({
            ton: 'info',
            titre: 'Demande de clôture enregistrée',
            detail: 'Rien n’est supprimé aujourd’hui. Vous avez 30 jours pour récupérer vos données et autant pour annuler.',
          })
          setFermeture(false)
        }}
      />
    </div>
  )
}
