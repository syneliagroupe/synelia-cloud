'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  Database,
  FolderOpen,
  Globe,
  HardDrive,
  Mail,
  Plus,
  Server,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, num, relatif } from '@/lib/format'
import { estActif } from '@/lib/api/client'
import type { DnsZone, Domaine, SiteWeb, WebHosting } from '@/lib/types'
import type {
  Certificat,
  DriveDomaine,
  MessagerieDomaine,
  SauvegardeWeb,
  ServeurBases,
} from '@/lib/mock'
import {
  CERTIFICATS,
  DOMAINES,
  HEBERGEMENTS,
  MESSAGERIES,
  DRIVES,
  ORG_COURANTE,
  SAUVEGARDES_WEB,
  SERVEURS_BASES,
  SITES_WEB,
  ZONES_DNS,
  assemblerEntrees,
  drivesDeLOrg,
  entreesWebCloud,
  joursAvant,
  messageriesDeLOrg,
  sauvegardesWebDeLOrg,
  serveursBasesDeLOrg,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { useCollection } from '@/components/app/atelier'
import { useMaintenant } from '@/components/app/contexte'

export default function AccueilWebCloud() {
  const maintenant = useMaintenant()
  // Domaines, hébergements, sites, bases, messageries, drives et certificats
  // ont chacun un vrai backend (`/web/domaines`, `/web/hebergements`,
  // `/web/sites`, `/web/bases`, `/web/emails`, `/web/drive`, `/web/ssl`,
  // `/web/dns`) : `useCollection` en sert les données réelles quand l'API est
  // active, et retombe sur la graine sinon.
  const domainesCol = useCollection<Domaine>('domaines', DOMAINES)
  const hebergementsCol = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const sitesWebCol = useCollection<SiteWeb>('sites-web', SITES_WEB)
  const messageriesCol = useCollection<MessagerieDomaine>('messageries', MESSAGERIES)
  const drivesCol = useCollection<DriveDomaine>('drives', DRIVES)
  const certificatsCol = useCollection<Certificat>('certificats', CERTIFICATS)
  const serveursBasesCol = useCollection<ServeurBases>('serveurs-bases', SERVEURS_BASES)
  const zonesDnsCol = useCollection<DnsZone>('zones-dns', ZONES_DNS)
  const sauvegardesCol = useCollection<SauvegardeWeb>('sauvegardes-web', SAUVEGARDES_WEB)

  // En mode API, le backend filtre déjà par organisation (et les identifiants
  // du jeu local lui sont inconnus) : la maquette seule restreint au
  // périmètre fictif, via les sélecteurs de `lib/mock`.
  const entrees = estActif()
    ? assemblerEntrees(domainesCol.items, hebergementsCol.items, zonesDnsCol.items)
    : entreesWebCloud()
  const heberges = estActif()
    ? hebergementsCol.items
    : hebergementsCol.items.filter((h) => h.orgId === ORG_COURANTE.id)
  const miens = new Set(heberges.map((h) => h.id))
  const sites = sitesWebCol.items.filter((s) => miens.has(s.hebergementId))
  const perimetreMoteurs = new Set(serveursBasesDeLOrg().map((m) => m.id))
  const moteurs = estActif()
    ? serveursBasesCol.items
    : serveursBasesCol.items.filter((m) => perimetreMoteurs.has(m.id))
  const perimetreMessageries = new Set(messageriesDeLOrg().map((m) => m.id))
  const messageries = estActif()
    ? messageriesCol.items
    : messageriesCol.items.filter((m) => perimetreMessageries.has(m.id))
  const perimetreDrives = new Set(drivesDeLOrg().map((d) => d.id))
  const drives = estActif()
    ? drivesCol.items
    : drivesCol.items.filter((d) => perimetreDrives.has(d.id))
  const certificats = certificatsCol.items
  const plans = estActif() ? sauvegardesCol.items : sauvegardesWebDeLOrg()

  const boites = messageries.reduce((a, m) => a + m.boites.length, 0)
  const majEnAttente = sites.reduce((a, s) => a + (s.majEnAttente ?? 0), 0)

  // Ce qui demande une décision, rassemblé une fois pour toutes.
  const aSurveiller = [
    ...entrees
      .filter((e) => e.domaine && !e.domaine.renouvellementAuto)
      .map((e) => ({
        quoi: `${e.nom} — renouvellement manuel`,
        detail: `Échéance dans ${joursAvant(e.domaine!.expiration)} jours. À l’échéance, le nom retourne au registre.`,
        href: `/app/web/domaines/${encodeURIComponent(e.id)}`,
        jours: joursAvant(e.domaine!.expiration),
      })),
    ...certificats.filter((c) => !c.renouvellementAuto && c.etat === 'actif').map((c) => ({
      quoi: `${c.hote} — certificat non renouvelé`,
      detail: `Expire dans ${joursAvant(c.expire)} jours et le renouvellement automatique est coupé.`,
      href: `/app/web/ssl/${c.id}`,
      jours: joursAvant(c.expire),
    })),
    ...(majEnAttente > 0
      ? [
          {
            quoi: `${majEnAttente} mises à jour d’application en attente`,
            detail: 'Cœur ou extensions. Chaque mise à jour est précédée d’une sauvegarde.',
            href: '/app/web/applications',
            jours: 999,
          },
        ]
      : []),
  ].sort((a, b) => a.jours - b.jours)

  const sections = [
    {
      nom: 'Domaines',
      href: '/app/web/domaines',
      icone: <Globe size={16} />,
      valeur: entrees.length,
      detail: `${heberges.length} avec hébergement`,
    },
    {
      nom: 'Hébergement Web',
      href: '/app/web/hebergement',
      icone: <Server size={16} />,
      valeur: heberges.length,
      detail: `${sites.length} sites installés`,
    },
    {
      nom: 'Bases de données',
      href: '/app/web/bases',
      icone: <Database size={16} />,
      valeur: moteurs.filter((m) => m.actif).length,
      detail: `${moteurs.length - moteurs.filter((m) => m.actif).length} à activer`,
    },
    {
      nom: 'Messagerie',
      href: '/app/web/emails',
      icone: <Mail size={16} />,
      valeur: boites,
      detail: `sur ${messageries.filter((m) => m.actif).length} domaines`,
    },
    {
      nom: 'Drive',
      href: '/app/web/drive',
      icone: <FolderOpen size={16} />,
      valeur: drives.filter((d) => d.actif).reduce((a, d) => a + d.sieges.attribues, 0),
      detail: 'sièges attribués',
    },
    {
      nom: 'Applications',
      href: '/app/web/applications',
      icone: <Globe size={16} />,
      valeur: sites.length,
      detail: `${sites.filter((s) => s.statut === 'en_ligne').length} en ligne`,
    },
    {
      nom: 'SSL',
      href: '/app/web/ssl',
      icone: <ShieldCheck size={16} />,
      valeur: certificats.filter((c) => c.etat === 'actif').length,
      detail: `${certificats.filter((c) => c.etat === 'en_emission').length} en émission`,
    },
    {
      nom: 'Sauvegardes',
      href: '/app/web/backup',
      icone: <HardDrive size={16} />,
      valeur: plans.length,
      detail: `${plans.reduce((a, p) => a + p.espaceOccupeGo, 0).toFixed(0)} Go conservés`,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Web Cloud' }]}
        titre="Web Cloud"
        sousTitre="Vos noms de domaine et ce qui tourne dessus : hébergement mutualisé, bases, messagerie, drive, applications, certificats et sauvegardes. Chaque section a sa liste dans le panneau de gauche."
      />

      <Card>
        <CardHeader titre="Commander" sousTitre="Les actions les plus fréquentes, sans chercher dans les sections." />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/app/web/domaines" iconBefore={<Plus size={13} />}>
            Nouveau domaine
          </ButtonLink>
          <ButtonLink href="/app/web/hebergement" variant="secondary" iconBefore={<Server size={13} />}>
            Nouvel hébergement
          </ButtonLink>
          <ButtonLink href="/app/web/applications" variant="secondary">
            Installer une application
          </ButtonLink>
        </div>
      </Card>

      {aSurveiller.length > 0 && (
        <Callout
          ton="warn"
          titre={`${aSurveiller.length} point${aSurveiller.length > 1 ? 's' : ''} à surveiller`}
        >
          <ul className="mt-1 space-y-1.5">
            {aSurveiller.map((a) => (
              <li key={a.quoi} className="flex items-start gap-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />
                <span>
                  <Link href={a.href} className="font-semibold underline">
                    {a.quoi}
                  </Link>
                  <span className="ml-1.5 text-g-700">{a.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Domaines"
          valeur={entrees.length}
          detail={`${heberges.length} avec serveur`}
        />
        <StatTile
          libelle="Sites en ligne"
          valeur={sites.filter((s) => s.statut === 'en_ligne').length}
          detail={`sur ${sites.length} installés`}
          ton={majEnAttente > 0 ? 'warn' : 'neutral'}
        />
        <StatTile libelle="Boîtes aux lettres" valeur={boites} detail="toutes messageries" />
        <StatTile
          libelle="Espace sauvegardé"
          valeur={`${plans.reduce((a, p) => a + p.espaceOccupeGo, 0).toFixed(0)} Go`}
          detail="immuable, hors site"
          ton="ok"
        />
      </div>

      <div>
        <p className="type-micro mb-2.5 text-g-500">Les sections de Web Cloud</p>
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
            titre="Occupation de vos serveurs"
            sousTitre="Un domaine est attaché à un serveur et à un seul. Tout ce qui est installé dessus partage son processeur, sa mémoire et son disque."
          />
          <div className="space-y-4">
            {heberges.map((h) => {
              const sitesDuServeur = sites.filter((s) => s.hebergementId === h.id)
              return (
                <div key={h.id} className="rounded-[8px] border border-g-300 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <Link
                        href={`/app/web/hebergement/${h.id}`}
                        className="block truncate font-mono text-[13px] font-bold text-ink hover:text-p-700"
                      >
                        {h.domaine ?? h.domaineProvisoire}
                      </Link>
                      <span className="block text-[12px] text-g-500">
                        {h.palier} · {h.serveur.nom} · {sitesDuServeur.length} site
                        {sitesDuServeur.length > 1 ? 's' : ''}
                      </span>
                    </span>
                    <Badge tone={h.statut === 'en_ligne' ? 'ok' : 'warn'} size="sm" dot>
                      {h.statut === 'en_ligne' ? 'En ligne' : 'Maintenance'}
                    </Badge>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {h.serveur.chargeCpuPct != null && (
                      <QuotaBar
                        libelle="Processeur"
                        utilise={h.serveur.chargeCpuPct}
                        total={100}
                        compact
                        formateur={(v) => `${v} %`}
                      />
                    )}
                    {h.serveur.ramUtiliseePct != null && (
                      <QuotaBar
                        libelle="Mémoire"
                        utilise={h.serveur.ramUtiliseePct}
                        total={100}
                        compact
                        formateur={(v) => `${v} %`}
                      />
                    )}
                    <QuotaBar
                      libelle="Disque"
                      utilise={h.espaceUtiliseGo}
                      total={h.espaceTotalGo}
                      compact
                      formateur={(v) => `${v.toFixed(0)} Go`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            titre="Dernières sauvegardes"
            sousTitre="Immuables : ni nous ni vous ne pouvons les altérer avant la fin de leur rétention."
          />
          <ul className="divide-y divide-g-100">
            {plans.map((p) => {
              const d = p.executions[0]
              return (
                <li key={p.id} className="py-2.5 first:pt-0">
                  <Link
                    href={`/app/web/backup/${p.id}`}
                    className="flex items-start justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[12px] font-semibold text-ink">
                        {p.nomServi}
                      </span>
                      <span className="block text-[11px] text-g-500">
                        {d ? `${relatif(d.ts, maintenant)} · ${d.taille}` : 'Aucune exécution'}
                      </span>
                    </span>
                    <Badge
                      tone={
                        d?.statut === 'ok' ? 'ok' : d?.statut === 'partielle' ? 'warn' : 'err'
                      }
                      size="sm"
                    >
                      {d?.statut === 'ok' ? 'OK' : d?.statut === 'partielle' ? 'Partielle' : '—'}
                    </Badge>
                  </Link>
                </li>
              )
            })}
          </ul>

          <CardHeader
            className="mt-4 border-t border-g-100 pt-4"
            titre="Certificats les plus proches"
            sousTitre="Échéance technique, tous hôtes confondus."
          />
          <ul className="divide-y divide-g-100">
            {[...certificats]
              .sort((a, b) => joursAvant(a.expire) - joursAvant(b.expire))
              .slice(0, 4)
              .map((c) => {
                const j = joursAvant(c.expire)
                return (
                  <li key={c.id} className="py-2 first:pt-0">
                    <Link
                      href={`/app/web/ssl/${c.id}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[12px] font-semibold text-ink">
                          {c.hote}
                        </span>
                        <span className="block text-[11px] text-g-500">
                          {dateCourte(c.expire)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'tnum shrink-0 text-[12px] font-bold',
                          j <= 14 ? 'text-err' : j <= 30 ? 'text-warn' : 'text-g-700',
                        )}
                      >
                        {j} j
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </Card>
      </div>
    </div>
  )
}
