'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Blocks, Plus, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, MAINTENANT, money, relatif } from '@/lib/format'
import type { MoteurBase, Projet, ServiceProjet } from '@/lib/types'
import {
  MOTEURS_DISPONIBLES,
  MOTEUR_LABEL,
  PROJETS,
  SERVICES_PROJET,
  TYPE_SERVICE_LABEL,
  ZONE_APPLICATIVE,
  syntheseDeServices,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyField, GatedAction } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { Drawer, Popover } from '@/components/ui/overlay'
import { CostPreview } from '@/components/composition/flow'
import {
  CarteService,
  EnteteProjet,
  ICONE_TYPE,
  ProjetIntrouvable,
} from '@/components/business/projets'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'
import { useServicesProjet } from '@/lib/api/services-projet'

/**
 * Fiche d'un projet — ses services, environnement par environnement.
 *
 * Les variables, les domaines et les paramètres ne sont plus des onglets d'ici :
 * ce sont des sections de la barre, au même titre que les déploiements ou les
 * sauvegardes. Un onglet dans un onglet oblige à retenir deux niveaux de
 * position ; la barre en tient un seul, et le panneau garde le projet.
 */
export function VueProjet({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const { autorise, refus } = useApp()

  // Relu dans la collection : un service créé ici doit apparaître sans quitter
  // l'écran, et un projet né pendant la session n'existe pas dans le jeu figé.
  // Avec l’API, la liste vient de `GET /projets/{id}/services` (route nichée,
  // hors registre) ; en maquette, du filtre local.
  const projet = lesProjets.items.find((p) => p.id === id)
  const { distants: servicesDistants, rechargerServices } = useServicesProjet(id)
  const services = useMemo(
    () => servicesDistants ?? lesServices.items.filter((x) => x.projetId === id),
    [servicesDistants, lesServices.items, id],
  )
  const synthese = syntheseDeServices(services)

  const [env, setEnv] = useState(projet?.environnements[0] ?? '')
  const [creation, setCreation] = useState<'application' | 'base' | null>(null)

  const servicesEnv = useMemo(
    () => services.filter((s) => s.environnement === env),
    [services, env],
  )

  if (!projet) return <ProjetIntrouvable />

  return (
    <div className="space-y-5">
      <EnteteProjet
        projet={projet}
        sousTitre={projet.description}
        meta={
          <>
            <Badge tone="neutral">
              {synthese.services} service{synthese.services > 1 ? 's' : ''}
            </Badge>
            <Badge tone="violet">{money(synthese.coutMensuel)}/mois</Badge>
            <Badge tone="neutral">
              Espace <span className="font-mono">{projet.espaceId.toUpperCase()}</span>
            </Badge>
            <span className="text-[11.5px] text-g-500">
              créé le {dateCourte(projet.cree)} · dernière activité {relatif(synthese.derniereMaj, maintenant)}
            </span>
          </>
        }
        actions={
          <>
            <NouveauService
              autorise={autorise('app.deploy')}
              message={refus('app.deploy')}
              projetId={projet.id}
              onChoix={setCreation}
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <MicroLabel className="mr-1">Environnement</MicroLabel>
          {projet.environnements.map((e) => {
            const compte = services.filter((s) => s.environnement === e).length
            return (
              <button
                key={e}
                type="button"
                onClick={() => setEnv(e)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                  e === env
                    ? 'border-p-700 bg-p-700 text-white'
                    : 'border-g-300 text-g-700 hover:border-p-400 hover:bg-p-050',
                )}
              >
                {e}
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 text-[10.5px]',
                    e === env ? 'bg-white/20' : 'bg-g-100 text-g-700',
                  )}
                >
                  {compte}
                </span>
              </button>
            )
          })}
        </div>
        <span className="text-[11.5px] text-g-500">
          Chaque environnement porte ses propres services et ses propres variables.
        </span>
      </div>

      {servicesEnv.length === 0 ? (
        <EmptyState
          titre={`Aucun service en ${env}`}
          phrase="Un environnement vide ne facture rien. Déployez une application, une base ou une tâche planifiée pour le peupler."
          icone={<Rocket size={22} />}
          action={{ libelle: 'Déployer une application', onClick: () => setCreation('application') }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {servicesEnv.map((s) => (
            <CarteService key={s.id} service={s} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatTile
          libelle="Services de cet environnement"
          valeur={servicesEnv.length}
          detail={`sur ${synthese.services} au total`}
        />
        <StatTile
          libelle="Coût de cet environnement"
          valeur={money(servicesEnv.reduce((a, s) => a + s.coutMensuel, 0)).replace(
            ' FCFA',
            '',
          )}
          unite="FCFA"
          detail="par mois"
        />
        <StatTile
          libelle="Services en échec"
          valeur={servicesEnv.filter((s) => s.statut === 'failed').length}
          ton={servicesEnv.some((s) => s.statut === 'failed') ? 'err' : 'ok'}
        />
      </div>

      <TiroirCreation
        type={creation}
        projet={projet}
        env={env}
        onClose={() => setCreation(null)}
        onCree={rechargerServices}
      />
    </div>
  )
}

/** Port d'écoute d'usage de chaque moteur, pour l'URI interne affichée. */
const PORT_MOTEUR: Record<MoteurBase, number> = {
  postgresql: 5432,
  mysql: 3306,
  mariadb: 3306,
  mongodb: 27017,
  redis: 6379,
  clickhouse: 9000,
}

// ─── Créer un service ─────────────────────────────────────────────────
//
// Trois choix, à plat, sur le patron de Dokploy : Application, Base de
// données, Modèle du catalogue (« Template »). Chacun ne demande, à la
// création, que ce qui est indispensable pour faire exister la coquille —
// le reste (source Git ou image, port, domaine…) se règle ensuite dans la
// fiche du service. Les anciens types « statique », « cron » et « worker »
// restent affichables (des services déjà déployés en portent) mais ne sont
// plus proposés à la création : Dokploy lui-même n'en distingue pas.

type ChoixCreation = 'application' | 'base'

function NouveauService({
  autorise,
  message,
  projetId,
  onChoix,
}: {
  autorise: boolean
  message: string
  projetId: string
  onChoix: (t: ChoixCreation) => void
}) {
  const router = useRouter()
  const CHOIX: Array<{ type: ChoixCreation; phrase: string }> = [
    { type: 'application', phrase: 'Une coquille vide ; la source se branche ensuite' },
    { type: 'base', phrase: 'PostgreSQL, MySQL, Redis, MongoDB…' },
  ]

  if (!autorise) {
    return (
      <GatedAction autorise={false} message={message}>
        <Button iconBefore={<Plus size={14} />}>Créer un service</Button>
      </GatedAction>
    )
  }

  return (
    <Popover
      width="w-80"
      label="Créer un service dans ce projet"
      trigger={() => (
        <span className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-p-700 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-p-800">
          <Plus size={14} />
          Créer un service
        </span>
      )}
    >
      {(close) => (
        <div className="p-2">
          <p className="type-micro px-2 py-1.5 text-g-500">Type de service</p>
          {CHOIX.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                onChoix(t.type)
                close()
              }}
              className="flex w-full items-start gap-2.5 rounded-[6px] px-2 py-2 text-left transition-colors hover:bg-p-050"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-p-050 text-p-700">
                {ICONE_TYPE[t.type]}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink">
                  {TYPE_SERVICE_LABEL[t.type]}
                </span>
                <span className="block text-[11px] leading-snug text-g-500">{t.phrase}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              close()
              router.push(`/app/applications/projets/${encodeURIComponent(projetId)}/nouveau-service`)
            }}
            className="flex w-full items-start gap-2.5 rounded-[6px] px-2 py-2 text-left transition-colors hover:bg-p-050"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-p-050 text-p-700">
              <Blocks size={13} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-ink">
                Modèle du catalogue
              </span>
              <span className="block text-[11px] leading-snug text-g-500">
                Odoo, Zimbra, Nextcloud… — choix du modèle sur une page dédiée
              </span>
            </span>
          </button>
        </div>
      )}
    </Popover>
  )
}

function TiroirCreation({
  type,
  projet,
  env,
  onClose,
  onCree,
}: {
  type: ChoixCreation | null
  projet: Projet
  env: string
  onClose: () => void
  onCree?: () => void
}) {
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const executer = useOperation()
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [moteur, setMoteur] = useState<MoteurBase>('postgresql')
  const [version, setVersion] = useState('')
  const choix = MOTEURS_DISPONIBLES.find((m) => m.moteur === moteur)!

  if (!type) return null

  const peutCreer = nom.trim().length > 0

  /** Un service naît en construction, puis passe en marche à la fin du job — sauf
   * une application sans source : rien à démarrer tant qu'elle n'est pas
   * configurée, la coquille reste donc arrêtée. */
  const creerService = () => {
    const idService = lesServices.identifiant('svc')
    const ressources =
      type === 'base' ? { cpu: 2, ramMo: 4096, diskGo: 100 } : { cpu: 1, ramMo: 2048, diskGo: 10 }
    const cout = type === 'base' ? 24800 : 9400
    // Même dérivation que `utilisateur_base()` côté backend (`modules/projets/service.py`) :
    // jamais préfixé `pg_`, que PostgreSQL refuse pour un rôle. Le mot de passe, lui, est
    // toujours généré côté serveur (`_mot_de_passe()`, `secrets`, pas `random`) — l'API
    // n'accepte aucun couple identifiant/mot de passe fourni à la création (vérifié en
    // direct : un `POST` qui en envoie un voit sa valeur silencieusement ignorée), donc ce
    // formulaire ne les demande plus. Ils se consultent ensuite depuis l'onglet Connexion de
    // la fiche du service (`GET .../identifiants`).
    const brut = `${nom.trim().replace(/-/g, '_')}_user`
    const utilisateurBase = brut.startsWith('pg_') ? `u_${brut}` : brut

    executer({
      action: 'app.deploy',
      titre: `${TYPE_SERVICE_LABEL[type]} « ${nom.trim()} » en création`,
      detail:
        type === 'base'
          ? `${MOTEUR_LABEL[moteur]} ${version || choix.versions[0]}, joint au réseau privé du projet — aucun port ouvert sur Internet. Identifiant et mot de passe générés automatiquement, consultables ensuite depuis l’onglet Connexion.`
          : `Coquille créée dans ${env}. Branchez un dépôt Git ou une image depuis sa fiche pour la déployer.`,
      appel: () =>
        creerRessource(`/projets/${encodeURIComponent(projet.id)}/services`, {
          nom: nom.trim(),
          description: description.trim() || undefined,
          type,
          environnement: env,
          ressources,
          ...(type === 'base' ? { moteur, version: version || choix.versions[0] } : {}),
        }),
      effet: () =>
        lesServices.creer({
          id: idService,
          projetId: projet.id,
          nom: nom.trim(),
          description: description.trim() || undefined,
          type,
          environnement: env,
          statut: 'building',
          ressources,
          emplacement: { site: 'ABJ', backend: 'os-abj-01', namespace: `${projet.id}-${env.toLowerCase()}` },
          derniereMaj: MAINTENANT,
          coutMensuel: cout,
          ...(type === 'application' ? { appId: nom.trim() } : {}),
          ...(type === 'base'
            ? {
                moteur,
                version: version || choix.versions[0],
                base: {
                  nom: nom.trim().replace(/-/g, '_'),
                  utilisateur: utilisateurBase,
                  motDePasse: `demo-${idService.slice(-8)}`,
                  hoteInterne: `${nom.trim()}.${projet.id}.interne`,
                  port: PORT_MOTEUR[moteur],
                },
              }
            : {}),
        }),
      job: {
        type: `service.${type}.create`,
        label: `Création de ${nom.trim()} · ${projet.nom} · ${env}`,
        etapes:
          type === 'base'
            ? [
                'Réserver le volume',
                `Installer ${MOTEUR_LABEL[moteur]}`,
                'Joindre le réseau privé du projet',
                'Appliquer le plan de sauvegarde',
              ]
            : ['Réserver le service', 'Créer l’espace de noms', 'Publier l’adresse offerte'],
      },
      effetFinal: () => {
        if (estActif()) {
          onCree?.()
          return
        }
        // Sans source, une application n'a rien à exécuter : elle reste
        // arrêtée jusqu'à sa configuration, plutôt que d'afficher un service
        // « en marche » qui ne fait rien.
        lesServices.modifier(idService, { statut: type === 'base' ? 'running' : 'stopped' })
      },
    })
    onClose()
  }

  const sousDomaine = `${nom || '<service>'}-${env.toLowerCase().slice(0, 7)}.${ZONE_APPLICATIVE.zone}`

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${TYPE_SERVICE_LABEL[type]} · ${projet.nom} · ${env}`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!peutCreer} onClick={creerService}>
            Créer le service
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field
          label="Nom du service"
          hint="Sert de nom d’hôte interne et de préfixe d’adresse. Minuscules, chiffres et tirets."
        >
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={type === 'base' ? 'postgres' : 'api'}
          />
        </Field>

        <Field
          label="Description"
          hint="Une phrase pour dire à quoi sert ce service. Facultatif."
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>

        {type === 'application' && (
          <Callout ton="info" titre="Une coquille, pas encore un déploiement">
            Aucune source n’est demandée ici. Une fois le service créé, branchez un dépôt Git ou
            une image Docker depuis sa fiche pour le déployer réellement.
          </Callout>
        )}

        {type === 'base' && (
          <>
            <Field label="Moteur" hint={choix.usage}>
              <Select value={moteur} onChange={(e) => setMoteur(e.target.value as MoteurBase)}>
                {MOTEURS_DISPONIBLES.map((m) => (
                  <option key={m.moteur} value={m.moteur}>
                    {MOTEUR_LABEL[m.moteur]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Version" hint="Les versions mineures sont appliquées en fenêtre annoncée.">
              <Select
                value={version || choix.versions[0]}
                onChange={(e) => setVersion(e.target.value)}
              >
                {choix.versions.map((v) => (
                  <option key={v} value={v}>
                    {MOTEUR_LABEL[moteur]} {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Callout ton="violet" titre="Accessible depuis le projet uniquement">
              La base est jointe au réseau privé du projet. Aucun port n’est ouvert sur Internet
              tant que vous ne l’exposez pas explicitement, et cette exposition demande une liste
              d’adresses autorisées. Identifiant et mot de passe sont générés automatiquement à la
              création ; consultez-les ensuite depuis l’onglet Connexion de la fiche du service.
            </Callout>
          </>
        )}

        {type === 'application' && (
          <div className="rounded-[8px] border border-g-300 bg-g-050 p-3">
            <MicroLabel>Adresse attribuée automatiquement</MicroLabel>
            <CopyField value={sousDomaine} className="mt-1.5" />
            <p className="mt-2 text-[11.5px] leading-relaxed text-g-500">
              Certificat émis dès le premier déploiement. Vous pourrez brancher votre propre domaine
              ensuite, sans changer cette adresse.
            </p>
          </div>
        )}

        <CostPreview
          lignes={
            type === 'base'
              ? [
                  { libelle: `${MOTEUR_LABEL[moteur]} — 2 vCPU · 4 Go`, montant: 14800 },
                  { libelle: 'Volume 100 Go NVMe', montant: 70000 / 10 },
                  { libelle: 'Plan de sauvegarde quotidien', montant: 2800 },
                ]
              : [{ libelle: '1 vCPU · 2 Go, extensible à chaud', montant: 9400 }]
          }
        />
      </div>
    </Drawer>
  )
}

