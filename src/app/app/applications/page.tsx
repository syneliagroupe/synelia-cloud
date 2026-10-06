'use client'

import Link from 'next/link'
import {
  Boxes,
  Activity,
  GitBranch,
  Globe,
  HardDrive,
  KeyRound,
  Rocket,
  SlidersHorizontal,
} from 'lucide-react'
import { money, num, relatif } from '@/lib/format'
import type { Deployment, DomaineApplicatif, Projet, ServiceProjet } from '@/lib/types'
import {
  DEPLOIEMENTS,
  DOMAINES_APPLICATIFS,
  PROJETS,
  SERVICES_PROJET,
  ZONE_APPLICATIVE,
  appById,
  syntheseDeServices,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { useCollection } from '@/components/app/atelier'
import { estActif } from '@/lib/api/client'
import { useLectureDegradable } from '@/lib/api/degradable'
import { useMaintenant } from '@/components/app/contexte'

/**
 * `GET /projets/synthese` : agrégats calculés côté backend sur l'organisation
 * entière — exactement les chiffres que ce tableau de bord affiche. La liste
 * détaillée des services, elle, reste sur la graine : le backend n'expose que
 * `/projets/{id}/services` (par projet), pas de liste globale « tous
 * services confondus » à interroger en une fois.
 */
interface SyntheseProjets {
  projets: number
  services: number
  enEchec: number
  domaines: number
  domainesAVerifier: number
  coutMensuel: number
}

export default function AccueilApplications() {
  const maintenant = useMaintenant()
  // Le tableau de bord lit l'état de la session : un service créé ou arrêté
  // ailleurs doit se compter ici aussi.
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const lesDeploiements = useCollection<Deployment>('deploiements', DEPLOIEMENTS)
  const lesDomaines = useCollection<DomaineApplicatif>('domaines-applicatifs', DOMAINES_APPLICATIFS)
  const { donnees: syntheseDistante } = useLectureDegradable<SyntheseProjets>('/projets/synthese')

  // Les agrégats figés du jeu de données seraient faux dès la première
  // création : `/projets/synthese` en sert la version réelle quand l'API est
  // active ; sinon, calcul local à partir de la graine.
  const synthese = {
    projets: syntheseDistante?.projets ?? lesProjets.items.length,
    services: syntheseDistante?.services ?? lesServices.items.length,
    coutMensuel: syntheseDistante?.coutMensuel ?? lesServices.items.reduce((a, s) => a + s.coutMensuel, 0),
  }

  const sauvegardes = lesServices.items.filter((s) => s.sauvegarde)
  const enEchec = lesServices.items.filter((s) => s.statut === 'failed')
  const degrades = lesServices.items.filter((s) => s.statut === 'degraded')
  const domainesAVerifier = lesDomaines.items.filter(
    (d) => d.verification && d.verification.etat !== 'ok',
  )
  const secrets = lesProjets.items.flatMap((p) => p.variables.filter((v) => v.secret))

  const sections = [
    {
      nom: 'Projets',
      href: '/app/applications/projets',
      icone: <Boxes size={16} />,
      valeur: synthese.projets,
      detail: `${synthese.services} services au total`,
    },
    {
      nom: 'Déploiements',
      href: '/app/applications/deploiements',
      icone: <Rocket size={16} />,
      valeur: lesDeploiements.items.length,
      detail: `${lesDeploiements.items.filter((d) => d.statut === 'live').length} en ligne`,
    },
    {
      nom: 'Observabilité',
      href: '/app/applications/observabilite',
      icone: <Activity size={16} />,
      valeur: enEchec.length + degrades.length,
      detail: 'services hors de leurs seuils',
    },
    {
      nom: 'Sauvegardes',
      href: '/app/applications/backup',
      icone: <HardDrive size={16} />,
      valeur: sauvegardes.length,
      detail: `sur ${lesServices.items.length} services`,
    },
    {
      nom: 'Domaines & routage',
      href: '/app/applications/routage',
      icone: <Globe size={16} />,
      valeur: lesDomaines.items.length,
      detail: `${domainesAVerifier.length} à vérifier`,
    },
    {
      nom: 'Variables & secrets',
      href: '/app/applications/variables',
      icone: <KeyRound size={16} />,
      valeur: lesProjets.items.reduce((a, p) => a + p.variables.length, 0),
      detail: `dont ${secrets.length} secrets`,
    },
    {
      nom: 'Paramètres',
      href: '/app/applications/parametres',
      icone: <SlidersHorizontal size={16} />,
      valeur: lesProjets.items.reduce((a, p) => a + p.environnements.length, 0),
      detail: 'environnements déclarés',
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Applications' }]}
        titre="Applications"
        sousTitre="Vos projets applicatifs et tout ce qui tourne dedans. Chaque section pose une question différente sur le même objet — le projet — et le panneau de gauche sert à le choisir une fois pour toutes."
        actions={
          <ButtonLink href="/app/applications/nouveau" iconBefore={<GitBranch size={14} />}>
            Nouveau projet
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Projets"
          valeur={synthese.projets}
          detail={`${synthese.services} services`}
        />
        <StatTile
          libelle="Services en marche"
          valeur={lesServices.items.filter((s) => s.statut === 'running').length}
          detail={`sur ${lesServices.items.length}`}
          ton={enEchec.length > 0 ? 'err' : degrades.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Services sauvegardés"
          valeur={sauvegardes.length}
          detail={`${lesServices.items.length - sauvegardes.length} sans plan`}
          ton={sauvegardes.length === lesServices.items.length ? 'ok' : 'warn'}
        />
        <StatTile
          libelle="Coût mensuel"
          valeur={money(synthese.coutMensuel)}
          detail="tous projets confondus"
        />
      </div>

      <div>
        <p className="type-micro mb-2.5 text-g-500">Les sections d’Applications</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((s) => (
            <Link
              key={s.nom}
              href={s.href}
              className="group rounded-[10px] border border-g-300 bg-white p-4 transition-all hover:border-p-400 hover:shadow-[0_4px_16px_rgba(43,27,77,.1)]"
            >
              <span className="flex items-center gap-2 text-p-700">
                {s.icone}
                <span className="text-[13px] font-bold text-ink group-hover:text-p-700">
                  {s.nom}
                </span>
              </span>
              <p className="tnum mt-2 text-[24px] font-bold leading-none [font-family:var(--font-display)] text-ink">
                {num(s.valeur)}
              </p>
              <p className="mt-1 text-[12px] text-g-500">{s.detail}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            titre="Vos projets"
            sousTitre="Un projet regroupe ce qui casse ensemble. Ouvrez-en un pour retrouver le même choix dans toutes les sections."
          />
          <div className="space-y-3">
            {lesProjets.items.length === 0 && (
              <EmptyState
                className="py-8"
                titre="Aucun projet pour l’instant"
                phrase="Un projet regroupe vos services, leurs environnements, domaines et variables. Créez-en un depuis un dépôt Git, une image Docker ou un modèle."
                action={{ libelle: 'Nouveau projet', href: '/app/applications/nouveau' }}
              />
            )}
            {lesProjets.items.map((p) => {
              const s = syntheseDeServices(lesServices.items.filter((x) => x.projetId === p.id))
              const services = lesServices.items.filter((x) => x.projetId === p.id)
              const proteges = services.filter((x) => x.sauvegarde).length
              return (
                <div key={p.id} className="rounded-[8px] border border-g-300 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <Link
                        href={`/app/applications/projets/${p.id}`}
                        className="block truncate text-[14px] font-bold text-ink hover:text-p-700"
                      >
                        {p.nom}
                      </Link>
                      <span className="block text-[12px] text-g-500">
                        {s.services} service{s.services > 1 ? 's' : ''} ·{' '}
                        {p.environnements.join(', ')} · {money(s.coutMensuel)}/mois
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {s.enEchec > 0 && (
                        <Badge tone="err" size="sm" dot>
                          {s.enEchec} en échec
                        </Badge>
                      )}
                      {s.degrades > 0 && (
                        <Badge tone="warn" size="sm" dot>
                          {s.degrades} dégradé{s.degrades > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {s.enEchec === 0 && s.degrades === 0 && (
                        <Badge tone="ok" size="sm" dot>
                          Sain
                        </Badge>
                      )}
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <QuotaBar
                      libelle="Services sauvegardés"
                      utilise={proteges}
                      total={Math.max(1, services.length)}
                      compact
                      formateur={(v) => `${v}`}
                    />
                    <QuotaBar
                      libelle="Processeur réservé"
                      utilise={services.reduce((a, x) => a + x.ressources.cpu, 0)}
                      total={64}
                      compact
                      formateur={(v) => `${v} vCPU`}
                    />
                    <QuotaBar
                      libelle="Mémoire réservée"
                      utilise={services.reduce((a, x) => a + x.ressources.ramMo, 0) / 1024}
                      total={128}
                      compact
                      formateur={(v) => `${v.toFixed(0)} Gio`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            titre="Ce qui bouge en ce moment"
            sousTitre="Les cinq derniers déploiements, tous projets confondus."
          />
          <ul className="divide-y divide-g-100">
            {[...lesDeploiements.items]
              .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
              .slice(0, 5)
              .map((d) => (
                <li key={d.id} className="py-2.5 first:pt-0">
                  <Link
                    href="/app/applications/deploiements"
                    className="flex items-start justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[12px] font-semibold text-ink">
                        {appById(d.appId)?.nom ?? d.appId} {d.version}
                      </span>
                      <span className="block text-[11px] text-g-500">
                        {relatif(d.startedAt, maintenant)} · {d.auteur}
                      </span>
                    </span>
                    <Badge
                      tone={
                        d.statut === 'live'
                          ? 'ok'
                          : d.statut === 'failed'
                            ? 'err'
                            : d.statut === 'rolled_back'
                              ? 'warn'
                              : 'info'
                      }
                      size="sm"
                    >
                      {d.statut === 'live'
                        ? 'En ligne'
                        : d.statut === 'failed'
                          ? 'Échec'
                          : d.statut === 'rolled_back'
                            ? 'Annulé'
                            : 'En cours'}
                    </Badge>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="violet" titre="Une URL qui marche avant d’acheter un domaine">
          Chaque déploiement reçoit une adresse sur{' '}
          <span className="font-mono text-[12px]">{ZONE_APPLICATIVE.wildcard}</span>, certificat
          compris. Vous branchez votre propre nom quand vous êtes prêt, sans redéployer —{' '}
          {estActif() ? lesDomaines.items.length : ZONE_APPLICATIVE.quotaDomaines.utilises} sur {ZONE_APPLICATIVE.quotaDomaines.total}{' '}
          domaines personnalisés sont utilisés.
        </Callout>
        <Callout ton="info" titre="Ce que cet univers ne fait pas">
          Le portail provisionne, dimensionne, sauvegarde, supervise et ouvre la porte. Il
          n’héberge ni éditeur de code, ni explorateur de journaux, ni écran métier : ceux-là
          restent chez le produit amont, et les liens de sortie y mènent en un clic.
        </Callout>
      </div>
    </div>
  )
}
