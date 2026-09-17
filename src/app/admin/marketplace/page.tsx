'use client'

import { useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, PauseCircle, PlayCircle, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, dateHeure, MAINTENANT, num, pct, relatif } from '@/lib/format'
import {
  CAMPAGNES_MAJ,
  CATALOGUE,
  CONTRAT_INTEGRATION,
  PARC_INSTANCES,
  TACHES_PROVISIONING,
} from '@/lib/mock'
import { CATEGORIE_LABEL, SITE_COURT } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, SolutionLogo, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { ConfirmDialog, Drawer } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { HealthBadge, StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection, type Entite } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, requete } from '@/lib/api/client'
import type { CampagneMaj, InstanceParc } from '@/lib/mock'

const ONGLETS = [
  { id: 'catalogue', label: 'Catalogue de services' },
  { id: 'parc', label: 'Parc d’instances' },
  { id: 'campagnes', label: 'Campagnes de mise à jour' },
  { id: 'contrat', label: 'Contrat d’intégration' },
]

/**
 * Les certifications prononcées pendant la session. Le catalogue est indexé par
 * `slug` et n'a pas d'identifiant : plutôt que d'en faire une collection, on
 * garde à part les slugs certifiés depuis le portail — c'est la seule propriété
 * du catalogue que cet écran modifie.
 */
const CERTIFICATIONS: readonly Entite[] = []

/**
 * `PUT /admin/catalogue/services/{slug}` exige la fiche complète : on
 * renvoie la locale, certifiée, sans son pictogramme (propre à la vitrine).
 */
function certifierFiche(slug: string): Promise<unknown> {
  const fiche = CATALOGUE.find((c) => c.slug === slug)
  if (!fiche) return Promise.reject(new Error(`Solution ${slug} inconnue du catalogue.`))
  const corps: Record<string, unknown> = { ...fiche, certifie: true }
  delete corps.icone
  return requete(`/admin/catalogue/services/${encodeURIComponent(slug)}`, {
    methode: 'PUT',
    corps,
  })
}

export default function MarketplaceAdmin() {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const parc = useCollection<InstanceParc>('parc-instances', PARC_INSTANCES)
  const campagnes = useCollection<CampagneMaj>('campagnes-maj', CAMPAGNES_MAJ)
  const certifications = useCollection('certifications-catalogue', CERTIFICATIONS)
  const executer = useOperation()
  const [onglet, setOnglet] = useState('catalogue')
  const [arretId, setArretId] = useState<string | null>(null)
  const [ficheSlug, setFicheSlug] = useState<string | null>(null)

  const arret = campagnes.items.find((c) => c.id === arretId) ?? null
  const fiche = CATALOGUE.find((c) => c.slug === ficheSlug) ?? null

  const estCertifie = (slug: string) =>
    CATALOGUE.find((c) => c.slug === slug)?.certifie === true ||
    certifications.items.some((x) => x.id === slug)

  const certifies = CATALOGUE.filter((c) => estCertifie(c.slug))
  const aCertifier = CATALOGUE.filter((c) => !estCertifie(c.slug))
  const enRetard = parc.items.filter((i) => i.derniereMaj < '2026-05-01')
  const degrades = parc.items.filter((i) => i.sante !== 'ok')
  const campagnesActives = campagnes.items.filter((c) => c.statut === 'en_cours')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Marketplace' }]}
        titre="Marketplace"
        sousTitre="Ces solutions sont des logiciels libres tiers, et le resteront. Nous les provisionnons, dimensionnons, sauvegardons, supervisons, mettons à jour et facturons — nous ne réimplémentons aucun de leurs écrans, et nous n’en modifions pas le code."
        actions={
          <BoutonFormulaire
            libelle="Certifier une solution"
            size="md"
            icone={<Rocket size={14} />}
            action="catalog.edit"
            titre="Certifier une solution du catalogue"
            description="Certifier, c’est s’engager à exploiter la solution : provisionnement, dimensionnement, sauvegarde, supervision, montée de version et export testé. Les neuf capacités du contrat d’intégration doivent être vérifiées avant."
            libelleValider="Lancer la certification"
            taille="md"
            champs={[
              {
                id: 'slug',
                label: 'Solution',
                type: 'select',
                options:
                  aCertifier.length > 0
                    ? aCertifier.map((c) => ({ value: c.slug, label: `${c.nom} — ${c.solutionOSS}` }))
                    : [{ value: '', label: 'Tout le catalogue est déjà certifié' }],
              },
              {
                id: 'version',
                label: 'Version de référence',
                demi: true,
                placeholder: '2026.02.1',
                hint: 'la version que nous nous engageons à exploiter',
              },
              {
                id: 'reimport',
                label: 'Réimport de l’export réellement testé',
                type: 'switch',
                demi: true,
                placeholder: 'Test de réimport concluant',
              },
            ]}
            complement={(v) =>
              v.reimport ? null : (
                <Callout ton="warn" titre="Sans test de réimport, la réversibilité n’est pas acquise">
                  La solution peut être certifiée, mais sa fiche indiquera « réimport non testé » —
                  c’est ce que voit le client. Un export dont on n’a jamais vérifié qu’il se réimporte
                  n’est pas une garantie de sortie.
                </Callout>
              )
            }
            operation={(v) => ({
              titre: `Certification de ${CATALOGUE.find((c) => c.slug === v.slug)?.nom ?? 'la solution'} lancée`,
              detail: 'Les neuf capacités du contrat d’intégration sont vérifiées une à une.',
              appel: () => certifierFiche(String(v.slug)),
              job: {
                type: 'catalog.certify',
                label: `Certification · ${CATALOGUE.find((c) => c.slug === v.slug)?.nom ?? 'solution'}`,
                etapes: [
                  'Provisionnement d’une instance de recette',
                  'Vérification des neuf capacités',
                  'Test de sauvegarde et de restauration granulaire',
                  'Test d’export et de réimport',
                  'Publication au catalogue',
                ],
              },
              effetFinal: () => {
                if (v.slug) certifications.creer({ id: String(v.slug) })
              },
            })}
          />
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {CATALOGUE.length} solutions au catalogue
            </Badge>
            <Badge tone="ok" size="sm">
              {certifies.length} certifiées
            </Badge>
            <Badge tone="neutral" size="sm">
              {parc.items.length} instances exploitées
            </Badge>
          </>
        }
      />

      {enRetard.length > 0 && (
        <Callout ton="warn" titre={`${enRetard.length} instances ont plus de trois mois de retard de version`}>
          {enRetard
            .slice(0, 3)
            .map((i) => `${i.serviceNom} chez ${i.orgNom} (${i.version})`)
            .join(' · ')}
          {enRetard.length > 3 ? ` et ${enRetard.length - 3} autres` : ''}. Une version en retard
          accumule les correctifs de sécurité non appliqués. Une campagne de rattrapage par vagues, avec
          point d’arrêt, est la manœuvre la moins risquée.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile libelle="Solutions certifiées" valeur={certifies.length} ton="ok" detail={`sur ${CATALOGUE.length} au catalogue`} />
        <StatTile libelle="Instances exploitées" valeur={parc.items.length} />
        <StatTile
          libelle="Instances dégradées"
          valeur={degrades.length}
          ton={degrades.length > 0 ? 'warn' : 'ok'}
        />
        <StatTile
          libelle="Retard de version"
          valeur={enRetard.length}
          ton={enRetard.length > 0 ? 'warn' : 'ok'}
          detail="Plus de 3 mois"
        />
        <StatTile
          libelle="Campagnes en cours"
          valeur={campagnesActives.length}
          ton={campagnesActives.length > 0 ? 'info' : 'ok'}
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'catalogue' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Ce que « certifiée » veut dire chez nous">
            La solution est déployable en un clic, sauvegardée par une politique éprouvée, supervisée
            par des sondes que nous avons écrites, raccordée à l’authentification unique, montée de
            version par vagues avec point d’arrêt, et exportable dans un format documenté que nous
            avons testé. Sans ces six points, une solution reste au catalogue en tant que
            « disponible », pas « certifiée ».
          </Callout>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {CATALOGUE.map((c) => {
              const instances = parc.items.filter((i) => i.catalogSlug === c.slug)
              return (
                <Card key={c.slug} className="flex flex-col" hover>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <SolutionLogo initiales={c.logoInitiales} teinte={c.logoTeinte} icone={c.icone} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-ink">{c.nom}</span>
                        <span className="block truncate text-[11px] text-g-500">{c.solutionOSS}</span>
                      </span>
                    </span>
                    {estCertifie(c.slug) ? (
                      <Badge tone="ok" size="sm">
                        Certifiée
                      </Badge>
                    ) : (
                      <Badge tone="warn" size="sm">
                        Disponible
                      </Badge>
                    )}
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-g-700">
                    {c.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    <Badge tone="violet" size="sm">
                      {CATEGORIE_LABEL[c.categorie]}
                    </Badge>
                    {c.modes.map((m) => (
                      <Badge key={m} tone="neutral" size="sm">
                        {m === 'dedie' ? 'Dédié' : 'Mutualisé'}
                      </Badge>
                    ))}
                    <Badge tone="neutral" size="sm">
                      {c.paliers.length} paliers
                    </Badge>
                  </div>

                  <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-g-100 pt-3">
                    <div>
                      <dt className="type-micro text-g-500">Instances</dt>
                      <dd className="tnum mt-0.5 text-[12px] font-semibold text-ink">
                        {instances.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="type-micro text-g-500">Engagement</dt>
                      <dd className="mt-0.5 text-[12px] text-ink">{c.sla}</dd>
                    </div>
                    <div>
                      <dt className="type-micro text-g-500">Versions suivies</dt>
                      <dd className="mt-0.5 truncate font-mono text-[11px] text-ink">
                        {c.versionsSupportees.join(', ')}
                      </dd>
                    </div>
                    <div>
                      <dt className="type-micro text-g-500">Réversibilité</dt>
                      <dd className="mt-0.5 truncate text-[11.5px] text-ink">
                        {c.reversibilite.formats[0]}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-g-100 pt-3.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      iconBefore={<FileText size={12} />}
                      onClick={() => setFicheSlug(c.slug)}
                    >
                      Fiche technique
                    </Button>
                    <ButtonLink
                      size="sm"
                      variant="ghost"
                      external
                      href={c.urlDemo}
                      iconAfter={<ExternalLink size={11} />}
                    >
                      Projet amont
                    </ButtonLink>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {onglet === 'parc' && (
        <Card padding={false}>
          <div className="p-4">
            <DataTable<InstanceParc>
              lignes={parc.items}
              exportable
              parPage={12}
              densiteInitiale="compacte"
              placeholderRecherche="Rechercher une instance, une organisation, un service…"
              filtres={[
                {
                  id: 'service',
                  libelle: 'Service',
                  options: [
                    { value: 'tous', label: 'Tous les services' },
                    ...[...new Set(parc.items.map((i) => i.catalogSlug))].map((s) => ({
                      value: s,
                      label: CATALOGUE.find((c) => c.slug === s)?.nom ?? s,
                    })),
                  ],
                },
                {
                  id: 'sante',
                  libelle: 'Santé',
                  options: [
                    { value: 'tous', label: 'Toutes' },
                    { value: 'ok', label: 'Saine' },
                    { value: 'degrade', label: 'Dégradée' },
                    { value: 'maintenance', label: 'En maintenance' },
                    { value: 'erreur', label: 'En erreur' },
                  ],
                },
                {
                  id: 'mode',
                  libelle: 'Mode',
                  options: [
                    { value: 'tous', label: 'Tous les modes' },
                    { value: 'dedie', label: 'Dédié' },
                    { value: 'mutualise', label: 'Mutualisé' },
                  ],
                },
              ]}
              selection={(l, fid, val) =>
                fid === 'service'
                  ? l.catalogSlug === val
                  : fid === 'sante'
                    ? l.sante === val
                    : fid === 'mode'
                      ? l.mode === val
                      : true
              }
              colonnes={[
                {
                  id: 'service',
                  entete: 'Instance',
                  cle: (i) => `${i.serviceNom} ${i.orgNom}`,
                  rendu: (i) => {
                    const c = CATALOGUE.find((x) => x.slug === i.catalogSlug)
                    return (
                      <span className="flex items-center gap-2">
                        {c && (
                          <SolutionLogo initiales={c.logoInitiales} teinte={c.logoTeinte} icone={c.icone} size="sm" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-ink">
                            {i.serviceNom}
                          </span>
                          <span className="block truncate text-[10.5px] text-g-500">{i.orgNom}</span>
                        </span>
                      </span>
                    )
                  },
                },
                {
                  id: 'mode',
                  entete: 'Mode',
                  cle: (i) => i.mode,
                  rendu: (i) => (
                    <Badge tone={i.mode === 'dedie' ? 'violet' : 'neutral'} size="sm">
                      {i.mode === 'dedie' ? 'Dédié' : 'Mutualisé'}
                    </Badge>
                  ),
                },
                {
                  id: 'site',
                  entete: 'Site',
                  cle: (i) => i.site,
                  rendu: (i) => (
                    <span className="text-[11.5px] text-g-700">{SITE_COURT[i.site]}</span>
                  ),
                },
                {
                  id: 'version',
                  entete: 'Version',
                  cle: (i) => i.version,
                  rendu: (i) => (
                    <span className="font-mono text-[11.5px] text-ink">{i.version}</span>
                  ),
                },
                {
                  id: 'sieges',
                  entete: 'Sièges',
                  aligne: 'right',
                  cle: (i) => i.sieges,
                  rendu: (i) => <span className="tnum text-[11.5px] text-g-700">{i.sieges}</span>,
                },
                {
                  id: 'sauvegarde',
                  entete: 'Dernière sauvegarde',
                  cle: (i) => i.derniereSauvegarde,
                  rendu: (i) => (
                    <span className="text-[11.5px] text-g-500">
                      {relatif(i.derniereSauvegarde, maintenant)}
                    </span>
                  ),
                },
                {
                  id: 'maj',
                  entete: 'Dernière mise à jour',
                  cle: (i) => i.derniereMaj,
                  rendu: (i) => (
                    <span
                      className={cn(
                        'text-[11.5px]',
                        i.derniereMaj < '2026-05-01' ? 'font-semibold text-warn' : 'text-g-500',
                      )}
                    >
                      {dateCourte(i.derniereMaj)}
                    </span>
                  ),
                },
                {
                  id: 'sante',
                  entete: 'Santé',
                  cle: (i) => i.sante,
                  rendu: (i) => (
                    <HealthBadge etat={i.sante === 'erreur' ? 'erreur' : i.sante} size="sm" />
                  ),
                },
                {
                  id: 'actions',
                  entete: '',
                  aligne: 'right',
                  rendu: (i) => (
                    <span className="flex items-center justify-end gap-1.5">
                      <ButtonLink
                        size="sm"
                        variant="ghost"
                        href={`/admin/organisations/${i.orgId}`}
                      >
                        Organisation
                      </ButtonLink>
                      {i.derniereMaj < '2026-05-01' && (
                        <BoutonFormulaire
                          libelle="Planifier la mise à jour"
                          action="catalog.edit"
                          titre={`Mettre à jour ${i.serviceNom} — ${i.orgNom}`}
                          description="Un snapshot est pris avant l’opération et le retour arrière reste possible pendant sept jours. Le client est prévenu de la fenêtre choisie."
                          libelleValider="Planifier"
                          champs={[
                            {
                              id: 'version',
                              label: 'Version cible',
                              demi: true,
                              placeholder: CATALOGUE.find((c) => c.slug === i.catalogSlug)
                                ?.versionsSupportees[0],
                            },
                            {
                              id: 'fenetre',
                              label: 'Fenêtre',
                              type: 'select',
                              demi: true,
                              options: [
                                { value: 'nuit', label: 'Nuit prochaine · 22:00 → 04:00 GMT' },
                                { value: 'weekend', label: 'Week-end · samedi 22:00 → dimanche 06:00' },
                                { value: 'immediat', label: 'Immédiatement — interruption assumée' },
                              ],
                            },
                            {
                              id: 'prevenir',
                              label: 'Prévenir le client par courriel',
                              type: 'switch',
                              placeholder: 'Envoyer l’avis de maintenance',
                            },
                          ]}
                          valeursDepart={{
                            version:
                              CATALOGUE.find((c) => c.slug === i.catalogSlug)
                                ?.versionsSupportees[0] ?? i.version,
                            fenetre: 'nuit',
                            prevenir: true,
                          }}
                          operation={(v) => ({
                            titre: `Mise à jour de ${i.serviceNom} planifiée`,
                            detail: `Version ${v.version}${v.prevenir ? ' · le client est prévenu par courriel' : ' · aucun avis envoyé au client'}.`,
                            // Une instance isolée se met à jour par une campagne
                            // d’une instance (`instances: [id]`), à lancer ensuite
                            // depuis l’onglet Campagnes.
                            appel: () =>
                              creerRessource('/admin/marketplace/campagnes', {
                                nom: `${i.serviceNom} — ${i.orgNom}`,
                                catalogSlug: i.catalogSlug,
                                versionCible: String(v.version),
                                fenetre: String(v.fenetre),
                                strategie: 'immediate',
                                instances: [i.id],
                                notesVersion: v.prevenir
                                  ? 'Avis de maintenance envoyé au client.'
                                  : undefined,
                              }),
                            job: {
                              type: 'service.upgrade',
                              label: `Montée de version · ${i.serviceNom} (${i.orgNom})`,
                              etapes: [
                                'Snapshot avant opération',
                                'Arrêt propre du service',
                                `Montée en ${v.version}`,
                                'Vérification post-migration',
                                'Remise en service',
                              ],
                            },
                            effetFinal: () => {
                              // Pas de `PATCH` sur le parc côté API : c’est la
                              // campagne créée qui portera la mise à jour.
                              if (estActif()) {
                                campagnes.recharger()
                                return
                              }
                              parc.modifier(i.id, {
                                version: String(v.version),
                                derniereMaj: MAINTENANT.slice(0, 10),
                                sante: 'ok',
                              })
                            },
                          })}
                        />
                      )}
                    </span>
                  ),
                },
              ]}
              vide={{
                titre: 'Aucune instance',
                phrase: 'Le parc se remplit dès la première souscription à un service managé.',
              }}
            />
          </div>
        </Card>
      )}

      {onglet === 'campagnes' && (
        <div className="space-y-4">
          <Callout ton="violet" titre="Une mise à jour par vagues, avec point d’arrêt">
            Nous ne mettons jamais à jour tout le parc d’un coup. Une instance pilote d’abord, un
            palier intermédiaire ensuite, le reste en dernier. Entre chaque vague, un point d’arrêt :
            si la vague précédente a produit une anomalie, la campagne s’arrête d’elle-même et rien de
            plus n’est touché.
          </Callout>

          {campagnes.items.map((c) => {
            const solution = CATALOGUE.find((x) => x.slug === c.catalogSlug)
            // En mode API le backend renvoie des campagnes sans `vagues`
            // (instances/faites agrégés) : on affiche l’avancement global.
            const vagues = c.vagues ?? []
            return (
              <Card
                key={c.id}
                className={cn(
                  c.statut === 'en_cours'
                    ? 'border-info/40'
                    : c.statut === 'arretee' || (c.statut as string) === 'echec'
                      ? 'border-err/40'
                      : (c.statut as string) === 'suspendue'
                        ? 'border-warn/40'
                        : '',
                )}
              >
                <CardHeader
                  titre={
                    <span className="flex flex-wrap items-center gap-2">
                      {solution && (
                        <SolutionLogo initiales={solution.logoInitiales} teinte={solution.logoTeinte} icone={solution.icone} size="sm" />
                      )}
                      <span>{c.nom}</span>
                    </span>
                  }
                  sousTitre={`Version cible ${c.versionCible} · fenêtre ${c.fenetre} · ${c.instances} instances`}
                  actions={
                    <span className="flex flex-wrap items-center gap-1.5">
                      {c.pointArret && (
                        <Badge tone="violet" size="sm">
                          Point d’arrêt entre vagues
                        </Badge>
                      )}
                      <Badge
                        tone={
                          c.statut === 'terminee'
                            ? 'ok'
                            : c.statut === 'en_cours'
                              ? 'info'
                              : c.statut === 'arretee' || (c.statut as string) === 'echec'
                                ? 'err'
                                : (c.statut as string) === 'suspendue'
                                  ? 'warn'
                                  : 'neutral'
                        }
                        dot
                        size="sm"
                      >
                        {c.statut === 'terminee'
                          ? 'Terminée'
                          : c.statut === 'en_cours'
                            ? 'En cours'
                            : c.statut === 'arretee'
                              ? 'Arrêtée'
                              : (c.statut as string) === 'suspendue'
                                ? 'Suspendue'
                                : (c.statut as string) === 'echec'
                                  ? 'Échec'
                                  : 'Planifiée'}
                      </Badge>
                    </span>
                  }
                />

                {vagues.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {vagues.map((v) => (
                    <div
                      key={v.numero}
                      className={cn(
                        'rounded-[8px] border px-3.5 py-3',
                        v.statut === 'terminee'
                          ? 'border-ok/40 bg-ok-bg'
                          : v.statut === 'en_cours'
                            ? 'border-info/40 bg-info-bg'
                            : v.statut === 'arretee'
                              ? 'border-err/40 bg-err-bg'
                              : 'border-g-300',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-bold text-ink">Vague {v.numero}</span>
                        {v.statut === 'terminee' ? (
                          <CheckCircle2 size={14} className="shrink-0 text-ok" />
                        ) : v.statut === 'en_cours' ? (
                          <PlayCircle size={14} className="shrink-0 text-info" />
                        ) : v.statut === 'arretee' ? (
                          <PauseCircle size={14} className="shrink-0 text-err" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11.5px] text-g-700">
                        {v.instances} instance{v.instances > 1 ? 's' : ''}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-g-500">
                        {v.statut === 'terminee'
                          ? 'Appliquée et vérifiée'
                          : v.statut === 'en_cours'
                            ? 'En cours d’application'
                            : v.statut === 'arretee'
                              ? 'Arrêtée par le point de contrôle'
                              : 'En attente de la vague précédente'}
                      </p>
                    </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-semibold text-g-700">Avancement</span>
                      <span className="tnum text-[12px] font-bold text-ink">
                        {(c as CampagneMaj & { faites?: number }).faites ?? 0} / {c.instances}{' '}
                        instances
                      </span>
                    </div>
                    <span className="block h-2.5 overflow-hidden rounded-full bg-g-100">
                      <span
                        className="block h-full rounded-full bg-p-600"
                        style={{
                          width: `${Math.max(2, Math.round((((c as CampagneMaj & { faites?: number }).faites ?? 0) / Math.max(1, c.instances)) * 100))}%`,
                        }}
                      />
                    </span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-g-100 pt-4">
                  {c.statut === 'planifiee' && (
                    <BoutonAction
                      libelle="Démarrer la campagne"
                      icone={<PlayCircle size={13} />}
                      operation={{
                        action: 'catalog.edit',
                        ton: 'info',
                        titre: `${c.nom} démarrée`,
                        detail:
                          'La vague 1 démarre. Un snapshot est pris avant chaque instance, et le point d’arrêt bloquera la suite en cas d’anomalie.',
                        appel: () =>
                          requete(
                            `/admin/marketplace/campagnes/${encodeURIComponent(c.id)}/lancement`,
                            { methode: 'POST' },
                          ),
                        effet: () =>
                          campagnes.modifier(c.id, (camp) => ({
                            statut: 'en_cours',
                            vagues: (camp.vagues ?? []).map((v) =>
                              v.numero === 1 ? { ...v, statut: 'en_cours' } : v,
                            ),
                          })),
                        effetFinal: () => campagnes.recharger(),
                      }}
                    />
                  )}
                  {c.statut === 'en_cours' && (
                    <>
                      {vagues.length > 0 && (
                        <BoutonAction
                          libelle={
                            vagues.every((v) => v.statut === 'terminee')
                              ? 'Clôturer la campagne'
                              : 'Lever le point d’arrêt'
                          }
                          operation={{
                            action: 'catalog.edit',
                            titre: vagues.every((v) => v.statut === 'terminee')
                              ? `${c.nom} terminée`
                              : 'Vague suivante autorisée',
                            detail: vagues.every((v) => v.statut === 'terminee')
                              ? 'Tout le parc concerné est sur la version cible.'
                              : 'Le point d’arrêt est levé. La vague suivante démarre à la prochaine fenêtre.',
                            // Une vague terminée, la suivante démarre : c'est
                            // exactement ce que le point d'arrêt autorise.
                            // Sans équivalent côté API (pas de `PATCH`
                            // campagnes) : maquette uniquement.
                            effet: () =>
                              campagnes.modifier(c.id, (camp) => {
                                const suivantes = (camp.vagues ?? []).map((v) =>
                                  v.statut === 'en_cours'
                                    ? { ...v, statut: 'terminee' as const }
                                    : v,
                                )
                                const suivante = suivantes.find((v) => v.statut === 'planifiee')
                                return {
                                  statut: suivante ? 'en_cours' : 'terminee',
                                  vagues: suivante
                                    ? suivantes.map((v) =>
                                        v.numero === suivante.numero
                                          ? { ...v, statut: 'en_cours' as const }
                                          : v,
                                      )
                                    : suivantes,
                                }
                              }),
                          }}
                        />
                      )}
                      <GatedAction
                        autorise={autorise('catalog.edit')}
                        message={refus('catalog.edit')}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          iconBefore={<PauseCircle size={13} />}
                          onClick={() => setArretId(c.id)}
                        >
                          Arrêter la campagne
                        </Button>
                      </GatedAction>
                    </>
                  )}
                  {(c.statut === 'arretee' || (c.statut as string) === 'suspendue') && (
                    <Callout
                      ton="err"
                      titre={
                        c.statut === 'arretee'
                          ? 'Campagne arrêtée par le point de contrôle'
                          : 'Campagne suspendue'
                      }
                    >
                      Une anomalie a été détectée sur la vague en cours. Les instances déjà mises à
                      jour peuvent être ramenées à leur version antérieure depuis le snapshot pris
                      avant l’opération. Les instances non encore touchées ne l’ont pas été.
                    </Callout>
                  )}
                  <span className="text-[11.5px] text-g-500">
                    Un snapshot est pris avant chaque instance ; le retour arrière reste possible
                    pendant sept jours.
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {onglet === 'contrat' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Contrat d’intégration"
              sousTitre="Les neuf capacités qu’une solution doit exposer pour être certifiée. Chacune correspond à un écran du portail — et à rien d’autre : nous n’ajoutons jamais un dixième écran qui refait l’interface de la solution."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['#', 'Capacité', 'Écran du portail', 'Couverture du parc'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CONTRAT_INTEGRATION.map((c) => {
                    const couverture = [100, 100, 100, 92, 100, 100, 100, 85, 77][c.num - 1]
                    return (
                      <tr key={c.num} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-p-050 text-[11px] font-bold text-p-700">
                            {c.num}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12.5px] text-ink">{c.capacite}</td>
                        <td className="px-3 py-2.5 text-[11.5px] text-g-700">{c.ecran}</td>
                        <td className="w-48 px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="relative block h-2 flex-1 overflow-hidden rounded-full bg-g-100">
                              <span
                                className={cn(
                                  'absolute inset-y-0 left-0 rounded-full',
                                  couverture === 100 ? 'bg-ok' : 'bg-warn',
                                )}
                                style={{ width: `${couverture}%` }}
                              />
                            </span>
                            <span
                              className={cn(
                                'tnum shrink-0 text-[11.5px] font-semibold',
                                couverture === 100 ? 'text-ok' : 'text-warn',
                              )}
                            >
                              {pct(couverture)}
                            </span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Callout ton="warn" className="mt-4" titre="Deux capacités ne sont pas encore couvertes partout">
              La réversibilité testée n’atteint que 77 % du catalogue : sur trois solutions, l’export
              existe mais nous ne l’avons pas encore validé par un test de réimport complet. Tant que
              ce test n’est pas fait, nous ne présentons pas la réversibilité comme acquise pour ces
              solutions. La montée de version par vagues plafonne à 85 % pour la même raison.
            </Callout>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Orchestrateur de provisioning"
                sousTitre="Les sept tâches exécutées à chaque souscription, dans cet ordre. Une tâche en échec arrête la séquence et déclenche le nettoyage des ressources déjà créées."
              />
              <ol className="space-y-2">
                {TACHES_PROVISIONING.map((t, i) => (
                  <li
                    key={t}
                    className="flex items-center gap-3 rounded-[6px] border border-g-300 px-3 py-2"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-p-050 text-[11px] font-bold text-p-700">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-[12.5px] text-ink">{t}</span>
                    <Badge tone="ok" size="sm" className="ml-auto shrink-0">
                      Idempotente
                    </Badge>
                  </li>
                ))}
              </ol>
              <Callout ton="info" className="mt-4" titre="Idempotente veut dire rejouable">
                Une tâche rejouée sur un système déjà dans l’état attendu ne fait rien et ne casse
                rien. C’est ce qui permet de reprendre un provisionnement à l’étape échouée plutôt que
                de tout recommencer, et de ne jamais créer deux fois la même ressource.
              </Callout>
            </Card>

            <Card>
              <CardHeader
                titre="Ce que nous ne faisons pas"
                sousTitre="La limite est aussi importante que la capacité."
              />
              <div className="space-y-2">
                {[
                  {
                    t: 'Nous ne modifions pas le code des solutions',
                    d: 'Aucun correctif maison, aucune extension propriétaire. Une solution modifiée devient impossible à mettre à jour, et son export cesse d’être compatible avec le projet amont.',
                  },
                  {
                    t: 'Nous ne réimplémentons aucun de leurs écrans',
                    d: 'Pas d’explorateur de fichiers, pas de webmail, pas d’écran métier d’ERP, pas d’éditeur de contenu. Le bouton « Ouvrir » mène à l’interface de la solution, en session déjà ouverte.',
                  },
                  {
                    t: 'Nous n’accédons pas au contenu des données',
                    d: 'Les fichiers, les courriels, les écritures comptables ne sont pas lisibles depuis le portail super admin. Une intervention exige une élévation nominative, autorisée par le client.',
                  },
                  {
                    t: 'Nous ne verrouillons pas la sortie',
                    d: 'Chaque solution certifiée dispose d’un export dans son format natif, documenté, testé par un réimport réel. Partir doit rester techniquement simple.',
                  },
                ].map((x) => (
                  <div key={x.t} className="rounded-[6px] border border-p-300 bg-p-050 px-3 py-2.5">
                    <p className="text-[12.5px] font-semibold text-ink">{x.t}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">{x.d}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              titre="Réversibilité par solution"
              sousTitre="Format d’export, délai de mise à disposition, et si le réimport a été réellement testé."
            />
            <div className="overflow-x-auto rounded-[8px] border border-g-300">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Solution', 'Formats de sortie', 'Délai', 'Réimport testé'].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CATALOGUE.map((c, i) => (
                    <tr key={c.slug} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <SolutionLogo initiales={c.logoInitiales} teinte={c.logoTeinte} icone={c.icone} size="sm" />
                          <span className="min-w-0">
                            <span className="block text-[12px] font-semibold text-ink">{c.nom}</span>
                            <span className="block text-[10.5px] text-g-500">{c.solutionOSS}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {c.reversibilite.formats.map((f) => (
                            <Badge key={f} tone="neutral" size="sm">
                              {f}
                            </Badge>
                          ))}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-g-700">
                        {c.reversibilite.delaiJours} jour{c.reversibilite.delaiJours > 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={i % 6 === 5 ? 'warn' : 'ok'} size="sm">
                          {i % 6 === 5 ? 'Non testé' : 'Testé'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <Drawer
        open={fiche !== null}
        onClose={() => setFicheSlug(null)}
        title={fiche ? `Fiche technique — ${fiche.nom}` : ''}
        description="Ce que nous nous engageons à exploiter, et ce que le client obtient s’il part. La fiche décrit notre exploitation de la solution ; elle ne documente pas son usage, qui reste celui du projet amont."
        size="lg"
      >
        {fiche && (
          <div className="space-y-4">
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Solution amont', valeur: fiche.solutionOSS },
                { cle: 'Catégorie', valeur: CATEGORIE_LABEL[fiche.categorie] },
                { cle: 'Certification', valeur: estCertifie(fiche.slug) ? 'Certifiée' : 'Disponible' },
                { cle: 'Engagement', valeur: fiche.sla },
                { cle: 'Versions suivies', valeur: fiche.versionsSupportees.join(', ') },
                {
                  cle: 'Modes',
                  valeur: fiche.modes.map((m) => (m === 'dedie' ? 'Dédié' : 'Mutualisé')).join(' · '),
                },
                { cle: 'Politique de sauvegarde', valeur: fiche.backupPolicyDefault },
                {
                  cle: 'Instances exploitées',
                  valeur: String(parc.items.filter((i) => i.catalogSlug === fiche.slug).length),
                },
              ]}
            />

            <div>
              <MicroLabel className="mb-2">Paliers vendus</MicroLabel>
              <div className="space-y-2">
                {fiche.paliers.map((pa) => (
                  <div key={pa.code} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-ink">
                        {pa.nom}
                        {pa.recommande && (
                          <Badge tone="violet" size="sm" className="ml-1.5">
                            Recommandé
                          </Badge>
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-g-500">{pa.code}</span>
                    </span>
                    <p className="mt-0.5 text-[11.5px] text-g-700">{pa.specs}</p>
                    <p className="mt-0.5 text-[11px] text-g-500">{pa.limites.join(' · ')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <MicroLabel className="mb-2">Réversibilité</MicroLabel>
              <div className="rounded-[6px] border border-p-300 bg-p-050 px-3 py-2.5">
                <p className="text-[12px] text-ink">
                  Export dans {fiche.reversibilite.formats.join(', ')}, mis à disposition en{' '}
                  {fiche.reversibilite.delaiJours} jour
                  {fiche.reversibilite.delaiJours > 1 ? 's' : ''}.
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-g-700">
                  Granularité de restauration : {fiche.granulariteRestauration.join(', ')}. Migration
                  entrante depuis {fiche.migrationEntrante.join(', ')}
                  {fiche.migrationDelais ? ` (${fiche.migrationDelais})` : ''}.
                </p>
              </div>
            </div>

            <div>
              <MicroLabel className="mb-2">Réglages propres à cette solution</MicroLabel>
              <div className="space-y-1.5">
                {fiche.parametresSpecifiques.map((x) => (
                  <div key={x.titre} className="rounded-[6px] border border-g-300 px-3 py-2">
                    <p className="text-[12px] font-semibold text-ink">{x.titre}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-g-700">{x.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <Callout ton="violet" titre="Ce que la fiche ne contient pas">
              Aucun écran de la solution n’est décrit ici, et aucun ne sera reconstruit dans le
              portail. La documentation d’usage reste celle du projet amont, à laquelle le bouton{' '}
              <span className="font-semibold">Projet amont</span> renvoie directement.
            </Callout>

            <div className="flex flex-wrap gap-1.5 border-t border-g-100 pt-4">
              {!estCertifie(fiche.slug) && (
                <BoutonAction
                  libelle="Certifier cette solution"
                  icone={<Rocket size={12} />}
                  operation={{
                    action: 'catalog.edit',
                    titre: `Certification de ${fiche.nom} lancée`,
                    detail: 'Les neuf capacités du contrat d’intégration sont vérifiées une à une.',
                    appel: () => certifierFiche(fiche.slug),
                    job: {
                      type: 'catalog.certify',
                      label: `Certification · ${fiche.nom}`,
                      etapes: [
                        'Provisionnement d’une instance de recette',
                        'Vérification des neuf capacités',
                        'Test de sauvegarde et de restauration granulaire',
                        'Test d’export et de réimport',
                        'Publication au catalogue',
                      ],
                    },
                    effetFinal: () => certifications.creer({ id: fiche.slug }),
                  }}
                />
              )}
              <ButtonLink
                size="sm"
                variant="ghost"
                external
                href={fiche.urlDemo}
                iconAfter={<ExternalLink size={11} />}
              >
                Projet amont
              </ButtonLink>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={arret !== null}
        onClose={() => setArretId(null)}
        titre="Arrêter une campagne de mise à jour"
        ressource={arret?.nom ?? ''}
        libelleAction="Arrêter la campagne"
        pertes={[
          'Les vagues non démarrées ne seront pas exécutées',
          'Les instances déjà mises à jour restent sur la nouvelle version',
          'Le parc se retrouve avec deux versions en production, ce qui complique le support',
        ]}
        onConfirm={() => {
          if (!arret) return
          executer({
            action: 'catalog.edit',
            ton: 'warn',
            titre: `${arret.nom} arrêtée`,
            detail:
              'Les instances déjà traitées peuvent être ramenées à leur version antérieure depuis leur snapshot, pendant sept jours.',
            appel: () =>
              requete(
                `/admin/marketplace/campagnes/${encodeURIComponent(arret.id)}/suspension`,
                { methode: 'POST' },
              ),
            effet: () =>
              campagnes.modifier(arret.id, (camp) => ({
                statut: 'arretee',
                vagues: (camp.vagues ?? []).map((v) =>
                  v.statut === 'en_cours' || v.statut === 'planifiee'
                    ? { ...v, statut: 'arretee' as const }
                    : v,
                ),
              })),
            effetFinal: () => campagnes.recharger(),
          })
          setArretId(null)
        }}
      />
    </div>
  )
}
