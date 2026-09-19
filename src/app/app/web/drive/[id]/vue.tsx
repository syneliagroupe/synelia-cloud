'use client'

import { useState } from 'react'
import { ExternalLink, Plus, Share2, Trash2 } from 'lucide-react'
import { money, relatif } from '@/lib/format'
import { DRIVES, USERS, type DriveDomaine } from '@/lib/mock'
import { configurationDuService } from '@/lib/configurations'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Select, Switch } from '@/components/ui/field'
import { PageHeader, Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { ConfigurationServicePanel } from '@/components/business/configuration-service'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, modifierRessource, requete, supprimerRessource } from '@/lib/api/client'

const ONGLETS = [
  { id: 'sieges', label: 'Sièges' },
  { id: 'partage', label: 'Partage' },
  { id: 'retention', label: 'Versions & corbeille' },
  { id: 'reglages', label: 'Réglages du service' },
]

export function VueDrive({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const { autorise, refus, pousser } = useApp()
  const executer = useOperation()
  const drives = useCollection<DriveDomaine>('drives', DRIVES)
  const [onglet, setOnglet] = useState('sieges')
  const [externe, setExterne] = useState(true)
  const [motDePasse, setMotDePasse] = useState(true)
  /** Sièges retirés dans la session : le jeu de données n'a pas de table. */
  const [retires, setRetires] = useState<string[]>([])

  const d = drives.items.find((x) => x.id === id)
  if (!d) return null

  // Contrairement au webmail (Zimbra `DelegateAuthRequest`), il n’y a pas de SSO applicatif
  // ici : `POST /web/drive/{id}/ouverture` renvoie l’URL de l’instance Nextcloud réelle,
  // sans jeton de connexion — l’utilisateur atterrit sur l’écran de connexion Nextcloud, pas
  // déjà authentifié. En maquette, le lien direct suffit pareillement.
  const ouvrirDrive = () => {
    if (!estActif()) {
      window.open(`https://${d.hote}`, '_blank', 'noopener')
      return
    }
    requete<{ url: string }>(`/web/drive/${encodeURIComponent(d.id)}/ouverture`, {
      methode: 'POST',
    }).then(
      (r) => window.open(r.url, '_blank', 'noopener'),
      (e: unknown) =>
        pousser({
          ton: 'err',
          titre: 'Ouverture du drive impossible',
          detail: e instanceof Error ? e.message : undefined,
        }),
    )
  }

  const reglerPartage = (patch: {
    externeAutorise?: boolean
    motDePasseObligatoire?: boolean
    expirationJours?: number
  }) => {
    const partage = {
      externeAutorise: patch.externeAutorise ?? externe,
      motDePasseObligatoire: patch.motDePasseObligatoire ?? motDePasse,
      expirationJours: patch.expirationJours ?? d.partage.expirationJours,
    }
    return (
    executer({
      action: 'service.admin',
      titre: 'Politique de partage mise à jour',
      detail: partage.externeAutorise
        ? 'Le partage vers l’extérieur reste autorisé.'
        : 'Les fichiers ne se partagent plus qu’entre titulaires de sièges.',
      appel: () =>
        modifierRessource('/web/drive', d.id, {
          partage,
        }),
      effet: () =>
        drives.modifier(d.id, (x) => ({ partage: { ...x.partage, ...partage } })),
      effetFinal: () => drives.recharger(),
    })
    )
  }
  const config = configurationDuService('drive-pro')
  const titulaires = USERS.slice(0, d.sieges.attribues).filter((u) => !retires.includes(u.id))

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Drive', href: '/app/web/drive' },
          { label: d.domaine },
        ]}
        titre={<span className="break-words font-mono">{d.domaine}</span>}
        sousTitre={`Drive ${d.solutionOSS} opéré par Synelia. Les sièges et la politique de partage se règlent ici, les fichiers se manipulent dans le Drive.`}
        meta={
          <>
            <Badge tone={d.actif ? 'ok' : 'neutral'} dot={d.actif}>
              {d.actif ? 'Actif' : 'À activer'}
            </Badge>
            <Badge tone="neutral">{d.palier}</Badge>
            {d.version && <Badge tone="neutral">{d.solutionOSS} {d.version}</Badge>}
            <Badge tone="violet">{money(d.prixSiege)} / siège / mois</Badge>
          </>
        }
        actions={
          d.actif ? (
            <>
              <GatedAction autorise={autorise('seat.assign')} message={refus('seat.assign')}>
                <BoutonFormulaire
                  libelle="Attribuer un siège"
                  size="md"
                  icone={<Plus size={14} />}
                  action="seat.assign"
                  titre="Attribuer un siège de drive"
                  description="Un siège attribué est facturé, qu’il soit utilisé ou non. Il s’agit d’un droit d’accès et d’une ligne de facturation : le portail ne crée pas encore de compte Nextcloud pour le titulaire, qui doit en recevoir un directement depuis l’administration Nextcloud."
                  champs={[
                    {
                      id: 'membre',
                      label: 'Membre',
                      type: 'select',
                      options: USERS.slice(0, 12).map((u) => ({ value: u.id, label: `${u.nom} · ${u.email}` })),
                    },
                  ]}
                  libelleValider="Attribuer"
                  operation={(v) => {
                    const membre = USERS.find((u) => u.id === v.membre)
                    return {
                      titre: `Siège attribué à ${membre?.nom ?? ''}`,
                      detail:
                        d.sieges.attribues + 1 > d.sieges.souscrits
                          ? 'Un siège supplémentaire est souscrit automatiquement, facturé au prorata.'
                          : `${d.sieges.attribues + 1} sièges attribués sur ${d.sieges.souscrits} souscrits.`,
                      // Le backend attend l’identifiant du membre (`userId`) ;
                      // les `USERS` de la maquette n’existent pas de son côté.
                      appel: () =>
                        creerRessource(`/web/drive/${encodeURIComponent(d.id)}/sieges`, {
                          userId: String(v.membre),
                        }),
                      effet: () => {
                        setRetires((prev) => prev.filter((x) => x !== v.membre))
                        drives.modifier(d.id, (x) => ({
                          sieges: {
                            attribues: x.sieges.attribues + 1,
                            souscrits: Math.max(x.sieges.souscrits, x.sieges.attribues + 1),
                          },
                        }))
                      },
                      effetFinal: () => drives.recharger(),
                    }
                  }}
                />
              </GatedAction>
              <Button variant="accent" iconAfter={<ExternalLink size={13} />} onClick={ouvrirDrive}>
                Ouvrir
              </Button>
              <GatedAction autorise={autorise('service.admin')} message={refus('service.admin')}>
                <BoutonAction
                  libelle="Désactiver"
                  variant="danger"
                  size="md"
                  icone={<Trash2 size={14} />}
                  operation={{
                    action: 'service.admin',
                    ton: 'err',
                    titre: `Drive de ${d.domaine} en cours de désactivation`,
                    detail: 'Le serveur Nextcloud est détruit ; les fichiers restent dans la sauvegarde le temps de la rétention.',
                    appel: () => supprimerRessource('/web/drive', d.id, d.domaine),
                    job: {
                      type: 'web.drive.desactiver',
                      label: `Désactivation du drive ${d.domaine}`,
                      etapes: ['Supprimer le serveur Nextcloud', 'Retirer la route du load balancer'],
                    },
                    effetFinal: () => {
                      if (estActif()) {
                        drives.recharger()
                        return
                      }
                      drives.modifier(d.id, { actif: false })
                    },
                  }}
                  confirmation={{
                    ressource: d.domaine,
                    titre: 'Désactiver ce drive ?',
                    pertes: [
                      'Le serveur Nextcloud sera détruit',
                      `Les ${d.sieges.attribues} siège(s) attribué(s) perdront l’accès`,
                      'Les fichiers restent dans la sauvegarde le temps de la rétention',
                    ],
                    libelleAction: 'Désactiver le drive',
                  }}
                />
              </GatedAction>
            </>
          ) : (
            <GatedAction autorise={autorise('service.admin')} message={refus('service.admin')}>
              <BoutonAction
                libelle="Activer le drive"
                variant="primary"
                size="md"
                icone={<Plus size={14} />}
                operation={{
                  action: 'service.admin',
                  titre: `Drive de ${d.domaine} en cours d’activation`,
                  detail: `${money(d.prixSiege)} par siège et par mois.`,
                  appel: () =>
                    creerRessource('/web/drive', {
                      domaine: d.domaine,
                      palier: d.palier,
                      sieges: d.sieges.souscrits,
                    }),
                  job: { workflow: 'web.drive.activate', cible: d.domaine },
                  effetFinal: () => {
                    if (estActif()) {
                      drives.recharger()
                      return
                    }
                    drives.modifier(d.id, { actif: true })
                  },
                }}
              />
            </GatedAction>
          )
        }
      />

      {!d.actif ? (
        <Card>
          <EmptyState
            titre="Le drive n’est pas activé sur ce domaine"
            phrase={`L’activation crée l’instance, pose le certificat sur ${d.hote}, déclare le client SSO et applique le plan de sauvegarde. Comptez ${money(d.prixSiege)} par siège et par mois.`}
            action={{ libelle: 'Retour aux drives', href: '/app/web/drive' }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              libelle="Sièges"
              valeur={`${d.sieges.attribues} / ${d.sieges.souscrits}`}
              detail="attribués sur souscrits"
            />
            <StatTile
              libelle="Espace"
              valeur={`${(d.quota.utiliseGo / 1024).toFixed(2)} To`}
              detail={`sur ${(d.quota.totalGo / 1024).toFixed(0)} To`}
              ton={d.quota.utiliseGo / d.quota.totalGo > 0.85 ? 'warn' : 'neutral'}
            />
            <StatTile
              libelle="Liens de partage"
              valeur={d.partage.liensActifs}
              detail={d.partage.externeAutorise ? 'externe autorisé' : 'interne seulement'}
              ton={d.partage.externeAutorise ? 'warn' : 'ok'}
            />
            <StatTile
              libelle="Dernière sauvegarde"
              valeur={d.derniereSauvegarde ? relatif(d.derniereSauvegarde, maintenant) : '—'}
              ton="ok"
            />
          </div>

          <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

          {onglet === 'sieges' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2" padding={false}>
                <div className="border-b border-g-100 px-4 py-3">
                  <p className="text-[13px] font-bold text-ink">Qui consomme quoi</p>
                  <p className="mt-0.5 text-[12px] text-g-500">
                    Un siège attribué est facturé, qu’il soit utilisé ou non.
                  </p>
                </div>
                <ul className="divide-y divide-g-100">
                  {titulaires.map((u, i) => (
                    <li
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">
                          {u.nom}
                        </span>
                        <span className="block truncate text-[11px] text-g-500">{u.email}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tnum text-[11.5px] text-g-700">
                          {(((d.quota.utiliseGo / Math.max(1, titulaires.length)) * (1 + (i % 3) * 0.4)) / 1).toFixed(0)} Go
                        </span>
                        <GatedAction
                          autorise={autorise('seat.assign') && !estActif()}
                          message={
                            estActif()
                              ? 'Indisponible : le retrait de siège Drive n’est pas encore exposé par l’API.'
                              : refus('seat.assign')
                          }
                        >
                          <IconButton
                            label={`Retirer le siège de ${u.nom}`}
                            size="sm"
                            onClick={() =>
                              executer({
                                action: 'seat.assign',
                                ton: 'warn',
                                titre: `Siège de ${u.nom} retiré`,
                                detail:
                                  'Ses fichiers personnels restent trente jours avant suppression ; les fichiers partagés restent au groupe.',
                                sansApi:
                                  'Indisponible : le retrait de siège Drive n’est pas encore exposé par l’API (seule l’attribution POST /web/drive/{id}/sieges l’est).',
                                effet: () => {
                                  setRetires((prev) => [...prev, u.id])
                                  drives.modifier(d.id, (x) => ({
                                    sieges: {
                                      ...x.sieges,
                                      attribues: Math.max(0, x.sieges.attribues - 1),
                                    },
                                  }))
                                },
                              })
                            }
                          >
                            <Trash2 size={13} className="text-err" />
                          </IconButton>
                        </GatedAction>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <CardHeader titre="Dimensionnement" />
                <div className="space-y-3">
                  <Field label="Sièges souscrits" hint="modifiable à chaud, facturé au prorata">
                    <Select
                      value={String(d.sieges.souscrits)}
                      disabled={estActif()}
                      title={
                        estActif()
                          ? 'Indisponible : la souscription de sièges Drive n’est pas encore exposée par l’API.'
                          : undefined
                      }
                      onChange={(e) =>
                        executer({
                          action: 'seat.assign',
                          titre: `${e.target.value} sièges souscrits`,
                          detail: 'Modification à chaud, facturée au prorata du mois en cours.',
                          sansApi:
                            'Indisponible : la souscription de sièges Drive n’est pas encore exposée par l’API (seule la création avec sieges initiaux l’est).',
                          effet: () =>
                            drives.modifier(d.id, (x) => ({
                              sieges: { ...x.sieges, souscrits: Number(e.target.value) },
                            })),
                        })
                      }
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n} sièges
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <KeyValueList
                    items={[
                      { cle: 'Prix unitaire', valeur: `${money(d.prixSiege)} / mois` },
                      {
                        cle: 'Coût actuel',
                        valeur: `${money(d.prixSiege * d.sieges.souscrits)} / mois`,
                      },
                      { cle: 'Suite bureautique', valeur: d.suiteBureautique },
                    ]}
                  />
                </div>
              </Card>
            </div>
          )}

          {onglet === 'partage' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Politique de partage"
                  sousTitre="S’applique à tout le drive. Les titulaires ne peuvent pas l’assouplir de leur côté."
                />
                <div className="space-y-3">
                  <Switch
                    label="Autoriser le partage vers l’extérieur"
                    description="Sans cela, un fichier ne se partage qu’entre titulaires de sièges."
                    checked={externe}
                    onChange={(v) => {
                      setExterne(v)
                      reglerPartage({ externeAutorise: v, motDePasseObligatoire: motDePasse })
                    }}
                  />
                  <Switch
                    label="Mot de passe obligatoire sur les liens publics"
                    description="Un lien transféré dans une conversation reste sinon ouvert à qui le reçoit."
                    checked={motDePasse}
                    onChange={(v) => {
                      setMotDePasse(v)
                      reglerPartage({ externeAutorise: externe, motDePasseObligatoire: v })
                    }}
                  />
                  <Field label="Expiration par défaut des liens">
                    <Select
                      defaultValue={String(d.partage.expirationJours)}
                      onChange={(e) => reglerPartage({ expirationJours: Number(e.target.value) })}
                    >
                      <option value="7">7 jours</option>
                      <option value="30">30 jours</option>
                      <option value="90">90 jours</option>
                      <option value="0">Sans expiration</option>
                    </Select>
                  </Field>
                </div>
              </Card>

              <Card>
                <CardHeader
                  titre={`${d.partage.liensActifs} liens actifs`}
                  sousTitre="Le détail se consulte dans le Drive, qui sait qui a ouvert quoi et quand."
                />
                <div className="space-y-2">
                  {[
                    { t: 'Publics sans mot de passe', n: 0, ton: 'ok' as const },
                    { t: 'Publics avec mot de passe', n: 41, ton: 'neutral' as const },
                    { t: 'Nominatifs externes', n: 23, ton: 'neutral' as const },
                    { t: 'Expirant sous 7 jours', n: 9, ton: 'warn' as const },
                  ].map((x) => (
                    <div
                      key={x.t}
                      className="flex items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2"
                    >
                      <span className="text-[12.5px] text-g-700">{x.t}</span>
                      <Badge tone={x.ton} size="sm">
                        {x.n}
                      </Badge>
                    </div>
                  ))}
                </div>
                <ButtonLink
                  href={`https://${d.hote}/settings/sharing`}
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  iconAfter={<ExternalLink size={12} />}
                >
                  Voir le détail dans le Drive
                </ButtonLink>
              </Card>
            </div>
          )}

          {onglet === 'retention' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Versions de fichiers"
                  sousTitre="Une version conservée est de l’espace occupé : c’est le compromis à régler."
                />
                <KeyValueList
                  items={[
                    { cle: 'Activé', valeur: d.versionsFichiers.actif ? 'Oui' : 'Non' },
                    { cle: 'Rétention', valeur: `${d.versionsFichiers.retentionJours} jours` },
                    { cle: 'Restauration', valeur: 'Par le titulaire, depuis le Drive' },
                  ]}
                />
                <Callout ton="info" className="mt-3" titre="Ce n’est pas une sauvegarde">
                  Les versions vivent dans le même Drive. Si l’instance est perdue, elles le sont
                  aussi. La sauvegarde, elle, est immuable et hors site.
                </Callout>
              </Card>

              <Card>
                <CardHeader
                  titre="Corbeille"
                  sousTitre="Le dernier filet avant la perte définitive d’un fichier supprimé par erreur."
                />
                <KeyValueList
                  items={[
                    { cle: 'Rétention', valeur: `${d.corbeille.retentionJours} jours` },
                    { cle: 'Volume actuel', valeur: `${d.corbeille.tailleGo} Go` },
                    { cle: 'Compté dans le quota', valeur: 'Oui' },
                  ]}
                />
                <div className="mt-3">
                  <MicroLabel>Adresse du drive</MicroLabel>
                  <CopyField value={`https://${d.hote}`} mono className="mt-1" />
                </div>
              </Card>
            </div>
          )}

          {onglet === 'reglages' && config && (
            <ConfigurationServicePanel
              config={config}
              autorise={autorise('service.admin')}
              messageRefus={refus('service.admin')}
            />
          )}
        </>
      )}
    </div>
  )
}
