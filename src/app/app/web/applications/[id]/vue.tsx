'use client'

import { useState } from 'react'
import { ExternalLink, GitCompare, RotateCcw, Upload } from 'lucide-react'
import { cn, seededSeries, surfaceMarque } from '@/lib/utils'
import { MAINTENANT, dateCourte, num, relatif } from '@/lib/format'
import { SITE_LABEL } from '@/lib/types'
import { SITES_WEB, TYPE_SITE_LABEL, hebergementById, nomServi } from '@/lib/mock'
import type { SiteWeb } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Select, Switch } from '@/components/ui/field'
import { PageHeader, Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, requete } from '@/lib/api/client'

const ONGLETS = [
  { id: 'apercu', label: 'Vue d’ensemble' },
  { id: 'versions', label: 'Versions & extensions' },
  { id: 'preprod', label: 'Préproduction' },
  { id: 'securite', label: 'Sécurité' },
]

const TEINTE: Record<string, string> = {
  wordpress: '#21759B',
  prestashop: '#DF0067',
  php: '#777BB4',
  statique: '#4B2882',
}

export function VueApplication({ id }: { id: string }) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const sites = useCollection<SiteWeb>('sites-web', SITES_WEB)
  const [onglet, setOnglet] = useState('apercu')
  const [majAuto, setMajAuto] = useState(true)

  const s = sites.items.find((x) => x.id === id)
  if (!s) return null
  const h = hebergementById(s.hebergementId)
  const surface = surfaceMarque(TEINTE[s.type] ?? '#4B2882')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Applications', href: '/app/web/applications' },
          { label: s.hote },
        ]}
        titre={
          <span className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold"
              style={{ background: surface.fond, color: surface.texte }}
            >
              {TYPE_SITE_LABEL[s.type].slice(0, 2).toUpperCase()}
            </span>
            <span className="break-words font-mono">{s.hote}</span>
          </span>
        }
        sousTitre={`${TYPE_SITE_LABEL[s.type]}${s.version ? ` ${s.version}` : ''} installé dans ${s.racine}${h ? `, sur ${h.serveur.nom}` : ''}. Le contenu s’édite dans l’application.`}
        meta={
          <>
            <Badge tone={s.statut === 'en_ligne' ? 'ok' : 'neutral'} dot>
              {s.statut === 'en_ligne' ? 'En ligne' : 'Arrêté'}
            </Badge>
            <Badge tone="neutral">PHP {s.phpVersion}</Badge>
            {h && <Badge tone="violet">{SITE_LABEL[h.serveur.site]}</Badge>}
            {s.majEnAttente ? <Badge tone="warn">{s.majEnAttente} mises à jour</Badge> : null}
          </>
        }
        actions={
          <>
            {h && (
              <ButtonLink href={`/app/web/hebergement/${h.id}`} variant="secondary">
                Le serveur
              </ButtonLink>
            )}
            <ButtonLink
              href={`https://${s.hote}`}
              variant="accent"
              iconAfter={<ExternalLink size={13} />}
            >
              Ouvrir le site
            </ButtonLink>
          </>
        }
      />

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'apercu' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              libelle="Visites du mois"
              valeur={num(s.visitesMois)}
              serie={seededSeries(s.id, 14, 200, 1600)}
            />
            <StatTile
              libelle="Espace occupé"
              valeur={s.espaceMo >= 1024 ? `${(s.espaceMo / 1024).toFixed(1)} Go` : `${s.espaceMo} Mo`}
              detail="fichiers du site"
            />
            <StatTile
              libelle="Certificat"
              valeur={s.ssl.etat === 'actif' ? 'Actif' : 'À poser'}
              detail={s.ssl.expire ? `expire le ${dateCourte(s.ssl.expire)}` : undefined}
              ton={s.ssl.etat === 'actif' ? 'ok' : 'warn'}
            />
            <StatTile
              libelle="Mises à jour"
              valeur={s.majEnAttente ?? 0}
              detail="en attente"
              ton={s.majEnAttente ? 'warn' : 'ok'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                titre="Où vit cette application"
                sousTitre="Elle partage le serveur, PHP et le moteur de bases avec les autres applications du même domaine."
              />
              <KeyValueList
                items={[
                  { cle: 'Hôte servi', valeur: s.hote },
                  { cle: 'Racine sur le disque', valeur: s.racine },
                  { cle: 'Version de PHP', valeur: s.phpVersion },
                  { cle: 'Serveur', valeur: h?.serveur.nom ?? '—' },
                  { cle: 'Site physique', valeur: h ? SITE_LABEL[h.serveur.site] : '—' },
                  { cle: 'Base rattachée', valeur: s.baseId ?? 'aucune' },
                ]}
              />
              <Callout ton="info" className="mt-3" titre="Ce que le portail ne fait pas">
                Pas d’éditeur de contenu, pas de gestionnaire de médias, pas de réglage de thème.
                L’écosystème de {TYPE_SITE_LABEL[s.type]} fait cela incomparablement mieux que ce que
                nous pourrions reconstruire. Le portail règle le socle, et ouvre la porte.
              </Callout>
            </Card>

            <Card>
              <CardHeader titre="Accès à l’administration" />
              <div className="space-y-3">
                <div>
                  <MicroLabel>Adresse d’administration</MicroLabel>
                  <CopyField
                    value={
                      s.type === 'prestashop'
                        ? `https://${s.hote}/admin-synelia`
                        : `https://${s.hote}/wp-admin`
                    }
                    mono
                    className="mt-1"
                  />
                </div>
                <ButtonLink
                  href={
                    s.type === 'prestashop'
                      ? `https://${s.hote}/admin-synelia`
                      : `https://${s.hote}/wp-admin`
                  }
                  variant="accent"
                  size="sm"
                  fullWidth
                  iconAfter={<ExternalLink size={12} />}
                >
                  Ouvrir l’administration
                </ButtonLink>
                <p className="text-[11px] leading-snug text-g-500">
                  La connexion passe par votre identité Synelia : pas de mot de passe séparé à
                  gérer, et le retrait d’un membre coupe aussi son accès ici.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'versions' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Politique de mise à jour"
              sousTitre="Vous choisissez, sauf pour un correctif de sécurité du cœur : celui-là part sans attendre."
            />
            <div className="space-y-3">
              <Switch
                label="Appliquer automatiquement après sauvegarde"
                description="Une sauvegarde est prise juste avant, et un retour arrière reste possible sept jours."
                checked={majAuto}
                onChange={setMajAuto}
              />
              <Field label="Fenêtre de maintenance">
                <Select defaultValue="nuit">
                  <option value="nuit">Nuit — 02:00 à 05:00</option>
                  <option value="weekend">Week-end — dimanche 03:00</option>
                  <option value="manuel">À ma demande seulement</option>
                </Select>
              </Field>
            </div>
            <KeyValueList
              className="mt-4 border-t border-g-100 pt-4"
              items={[
                { cle: 'Cœur installé', valeur: s.version ?? '—' },
                { cle: 'Mises à jour en attente', valeur: String(s.majEnAttente ?? 0) },
                { cle: 'Retour arrière', valeur: 'Disponible 7 jours' },
              ]}
            />
          </Card>

          <Card>
            <CardHeader
              titre="En attente"
              sousTitre="Chaque ligne indique ce qui change et si la mise à jour touche la sécurité."
            />
            {s.majEnAttente ? (
              <ul className="divide-y divide-g-100">
                {[
                  { n: 'Cœur ' + (s.version ?? ''), v: '→ 6.7.2', s: true },
                  { n: 'Extension de cache', v: '→ 4.1.0', s: false },
                  { n: 'Extension de formulaire', v: '→ 3.9.4', s: true },
                ]
                  .slice(0, s.majEnAttente)
                  .map((m) => (
                    <li
                      key={m.n}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {m.n}
                        </span>
                        <span className="block font-mono text-[11px] text-g-500">{m.v}</span>
                      </span>
                      {m.s && (
                        <Badge tone="err" size="sm">
                          Sécurité
                        </Badge>
                      )}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-[13px] text-g-500">Tout est à jour.</p>
            )}
            <GatedAction autorise={autorise('service.admin')} message={refus('service.admin')}>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                iconBefore={<Upload size={13} />}
                onClick={() =>
                  executer({
                    action: 'service.admin',
                    titre: 'Mise à jour programmée',
                    detail: 'Sauvegarde prise, application dans la prochaine fenêtre de maintenance.',
                    appel: () =>
                      requete(`/web/sites/${encodeURIComponent(s.id)}/mise-a-jour`, {
                        methode: 'POST',
                        corps: { coeur: true, extensions: true, themes: true, instantaneAvant: true },
                      }),
                    job: { workflow: 'web.app.update', cible: s.hote },
                    effetFinal: () => {
                      if (estActif()) {
                        sites.recharger()
                        return
                      }
                      sites.modifier(s.id, { majEnAttente: 0 })
                    },
                  })
                }
              >
                Tout mettre à jour
              </Button>
            </GatedAction>
          </Card>
        </div>
      )}

      {onglet === 'preprod' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Préproduction"
              sousTitre="Un clone du site et de sa base, servi sur un sous-domaine séparé et exclu des moteurs de recherche."
            />
            {s.preproduction?.actif ? (
              <>
                <KeyValueList
                  items={[
                    { cle: 'Adresse', valeur: s.preproduction.hote },
                    {
                      cle: 'Dernière synchronisation',
                      valeur: s.preproduction.derniereSync
                        ? dateCourte(s.preproduction.derniereSync)
                        : '—',
                    },
                    { cle: 'Indexation', valeur: 'Bloquée par robots.txt et en-tête' },
                  ]}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <BoutonAction
                    libelle="Resynchroniser depuis la production"
                    icone={<RotateCcw size={13} />}
                    operation={{
                      action: 'service.admin',
                      ton: 'info',
                      titre: 'Resynchronisation lancée',
                      detail: 'La préproduction est écrasée par la production ; l’inverse n’arrive jamais tout seul.',
                      appel: () =>
                        requete(`/web/sites/${encodeURIComponent(s.id)}/preproduction`, {
                          methode: 'POST',
                          corps: { copierBase: true },
                        }),
                      job: {
                        type: 'site.staging.sync',
                        label: `Resynchronisation · ${s.preproduction?.hote ?? s.hote}`,
                        etapes: ['Copier les fichiers', 'Copier la base', 'Réécrire les URL'],
                        dureeEtapeMs: 1100,
                      },
                      effetFinal: () => {
                        if (estActif()) {
                          sites.recharger()
                          return
                        }
                        sites.modifier(s.id, (x) => ({
                          preproduction: x.preproduction
                            ? { ...x.preproduction, derniereSync: MAINTENANT.slice(0, 10) }
                            : undefined,
                        }))
                      },
                    }}
                  />
                  <BoutonAction
                    libelle="Comparer"
                    variant="ghost"
                    icone={<GitCompare size={13} />}
                    operation={{
                      ton: 'info',
                      titre: 'Comparatif préproduction / production',
                      detail:
                        'Fichiers et schéma de base comparés ; le contenu éditorial ne l’est pas — c’est au site de le dire.',
                    }}
                  />
                  <ButtonLink
                    href={`https://${s.preproduction.hote}`}
                    variant="ghost"
                    size="sm"
                    iconAfter={<ExternalLink size={12} />}
                  >
                    Ouvrir
                  </ButtonLink>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-g-700">
                  Aucune préproduction pour cette application. La créer clone les fichiers et la
                  base sur <span className="font-mono">{s.preproduction?.hote ?? `staging-${s.hote}`}</span>{' '}
                  sans toucher à la production.
                </p>
                <BoutonAction
                  libelle="Créer une préproduction"
                  className="mt-3"
                  operation={{
                    action: 'service.admin',
                    titre: 'Préproduction en création',
                    detail: 'Clone des fichiers et de la base, exclu des moteurs de recherche.',
                    appel: () =>
                      requete(`/web/sites/${encodeURIComponent(s.id)}/preproduction`, {
                        methode: 'POST',
                        corps: { copierBase: true },
                      }),
                    job: {
                      type: 'site.staging.create',
                      label: `Préproduction · ${s.hote}`,
                      etapes: [
                        'Cloner les fichiers',
                        'Cloner la base',
                        'Poser le certificat du sous-domaine',
                        'Bloquer l’indexation',
                      ],
                      dureeEtapeMs: 1100,
                    },
                    effetFinal: () => {
                      if (estActif()) {
                        sites.recharger()
                        return
                      }
                      sites.modifier(s.id, {
                        preproduction: {
                          actif: true,
                          hote: `staging-${s.hote}`,
                          derniereSync: MAINTENANT.slice(0, 10),
                        },
                      })
                    },
                  }}
                />
              </>
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Publier vers la production"
              sousTitre="La publication remplace les fichiers et, si vous le demandez, la base. Une sauvegarde est prise avant."
            />
            <Callout ton="warn" titre="Le piège de la base">
              Publier la base écrase les commandes et les commentaires arrivés en production depuis
              le clonage. Pour une boutique active, on publie les fichiers seuls et on rejoue les
              changements de configuration à la main.
            </Callout>
            <div className="mt-3 space-y-2">
              {[
                { l: 'Fichiers seulement', d: 'Thème, extensions, code. Le plus courant.' },
                { l: 'Fichiers et base', d: 'Pour une refonte, quand la production est gelée.' },
              ].map((x) => (
                <div key={x.l} className="rounded-[6px] border border-g-300 px-3 py-2">
                  <p className="text-[13px] font-semibold text-ink">{x.l}</p>
                  <p className="text-[12px] text-g-500">{x.d}</p>
                </div>
              ))}
            </div>
            <BoutonFormulaire
              libelle="Publier"
              className="mt-3"
              action="service.admin"
              titre={`Publier vers ${s.hote}`}
              description="Une sauvegarde est prise avant. Publier la base écrase ce qui est arrivé en production depuis le clonage."
              champs={[
                {
                  id: 'portee',
                  label: 'Ce qui est publié',
                  type: 'select',
                  options: [
                    { value: 'fichiers', label: 'Fichiers seulement — le plus courant' },
                    { value: 'tout', label: 'Fichiers et base — production gelée' },
                  ],
                },
              ]}
              valeursDepart={{ portee: 'fichiers' }}
              libelleValider="Publier"
              operation={(v) => ({
                ton: v.portee === 'tout' ? 'warn' : 'info',
                titre: 'Publication lancée',
                detail:
                  v.portee === 'tout'
                    ? 'La base de production sera écrasée : commandes et commentaires récents seront perdus.'
                    : 'Thème, extensions et code seulement. La base de production reste intacte.',
                // La mise en production écrase la production : le backend exige
                // la confirmation par le nom du site, saisie dans le dialogue.
                appel: () =>
                  requete(`/web/sites/${encodeURIComponent(s.id)}/mise-en-production`, {
                    methode: 'POST',
                    query: { confirmation: s.hote },
                    corps: { inclureBase: v.portee === 'tout' },
                  }),
                job: {
                  type: 'site.publish',
                  label: `Publication · ${s.hote}`,
                  etapes: [
                    'Prendre une sauvegarde de la production',
                    'Copier les fichiers',
                    ...(v.portee === 'tout' ? ['Remplacer la base'] : []),
                    'Vider les caches',
                    'Vérifier que le site répond',
                  ],
                },
                effetFinal: () => sites.recharger(),
              })}
            />
          </Card>
        </div>
      )}

      {onglet === 'securite' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              titre="Protections en place"
              sousTitre="Appliquées sur le serveur, en amont de l’application : elles tiennent même si une extension est vulnérable."
            />
            <div className="space-y-2">
              {[
                {
                  l: 'Pare-feu applicatif',
                  a: s.securite.waf,
                  d: 'Règles OWASP adaptées à ' + TYPE_SITE_LABEL[s.type],
                },
                {
                  l: 'Anti-force brute',
                  a: s.securite.bruteForce,
                  d: 'Sur la page de connexion et les points d’API',
                },
                {
                  l: 'Scan de malware',
                  a: s.securite.scanMalware,
                  d: 'Quotidien, avec mise en quarantaine des fichiers suspects',
                },
              ].map((x) => (
                <div
                  key={x.l}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{x.l}</span>
                    <span className="block text-[12px] leading-snug text-g-500">{x.d}</span>
                  </span>
                  <Badge tone={x.a ? 'ok' : 'warn'} size="sm">
                    {x.a ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              ))}
            </div>
            <BoutonAction
              libelle="Lancer une analyse de sécurité"
              className="mt-3"
              operation={{
                action: 'service.admin',
                ton: 'info',
                titre: 'Analyse de sécurité lancée',
                detail: 'Le rapport arrive dans les notifications et dans le centre de tâches.',
                appel: () =>
                  requete(`/web/sites/${encodeURIComponent(s.id)}/analyse-securite`, {
                    methode: 'POST',
                  }),
                effetFinal: () => sites.recharger(),
              }}
            />
          </Card>

          <Card>
            <CardHeader
              titre="Certificat"
              sousTitre="Un certificat par hôte, renouvelé automatiquement. L’alerte tombe 21 jours avant l’échéance."
            />
            <KeyValueList
              items={[
                { cle: 'État', valeur: s.ssl.etat === 'actif' ? 'Actif' : 'À poser' },
                { cle: 'Émetteur', valeur: s.ssl.emetteur ?? '—' },
                { cle: 'Expire le', valeur: s.ssl.expire ? dateCourte(s.ssl.expire) : '—' },
              ]}
            />
            <ButtonLink href="/app/web/ssl" variant="secondary" size="sm" className="mt-3">
              Gérer les certificats
            </ButtonLink>
            <Callout ton="info" className="mt-3" titre="Verrouillage des fichiers">
              Hors fenêtre de maintenance, le cœur de l’application est monté en lecture seule. Un
              code injecté par une faille d’extension ne peut donc pas s’y écrire.
            </Callout>
          </Card>
        </div>
      )}
    </div>
  )
}
