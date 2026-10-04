'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRightLeft, Globe, Lock, ServerCog, ShieldCheck } from 'lucide-react'
import { dateCourte, moneyPerMonth } from '@/lib/format'
import { PALIERS_HEBERGEMENT } from '@/lib/tarifs'
import { SITES, SITE_COURT, SITE_LABEL } from '@/lib/types'
import { abonnementDeLEntree, assemblerEntrees, entreeWebCloudById, sitesDeLHebergement } from '@/lib/mock'
import { DOMAINES, DRIVES, HEBERGEMENTS, MESSAGERIES, SITES_WEB, ZONES_DNS } from '@/lib/mock'
import type { DriveDomaine, MessagerieDomaine } from '@/lib/mock'
import type { DnsZone, Domaine, SiteWeb, WebHosting } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { PageHeader, Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { CarteAbonnement } from '@/components/business/abonnement'
import { EditeurZone } from '@/components/business/editeur-zone'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { ResilierDomaine } from '@/components/business/resilier-domaine'
import { creerRessource, estActif, requete } from '@/lib/api/client'
import { useParametresEntreeWeb } from '@/lib/web/dns-entree'
import { hrefSite } from '@/lib/web/entrees'

/**
 * Fiche d'un domaine auquel aucun serveur n'est attaché.
 *
 * Deux onglets suffisent : l'état au registre, et la zone. Afficher les dix
 * onglets d'un hébergement en les grisant serait pire que de ne pas les
 * afficher — le client croirait avoir perdu quelque chose.
 */
export function VueDomaine({
  id,
  navigation = 'domaines',
  vue = 'complet',
}: {
  id: string
  navigation?: 'domaines' | 'sites'
  vue?: 'complet' | 'apercu' | 'dns'
}) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const dnsEntree = useParametresEntreeWeb()
  const [onglet, setOnglet] = useState(vue === 'dns' ? 'zone' : 'apercu')
  const section =
    navigation === 'sites'
      ? { label: 'Sites', href: '/app/web/sites' }
      : { label: 'Domaines', href: '/app/web/domaines' }
  const lienServeur = (hebergementId: string) =>
    navigation === 'sites' ? hrefSite(id, '/serveur') : `/app/web/hebergement/${hebergementId}`
  const lienApplications =
    navigation === 'sites' ? hrefSite(id, '/applications') : '/app/web/applications'
  const lienBases = navigation === 'sites' ? hrefSite(id, '/bases') : '/app/web/bases'
  const lienDns = navigation === 'sites' ? hrefSite(id, '/dns') : undefined
  const portefeuille = useCollection<Domaine>('domaines', DOMAINES)
  const parcHebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const zones = useCollection<DnsZone>('zones-dns', ZONES_DNS)
  const tousSites = useCollection<SiteWeb>('sites-web', SITES_WEB)
  const messageries = useCollection<MessagerieDomaine>('messageries', MESSAGERIES)
  const drives = useCollection<DriveDomaine>('drives', DRIVES)

  // Avec l’API, l’entrée est assemblée depuis les collections distantes (le
  // backend nomme les mêmes champs, `hebergementId` et `zoneId` compris) ; un
  // domaine né pendant la session n’existe pas dans le jeu figé.
  const entree = estActif()
    ? assemblerEntrees(portefeuille.items, parcHebergements.items, zones.items).find(
        (e) => e.id === id,
      )
    : entreeWebCloudById(id)
  if (!entree)
    return (
      <div className="space-y-5">
        <PageHeader
          fil={[
            { label: 'Espace client', href: '/app' },
            { label: 'Web Cloud', href: '/app/web' },
            section,
            { label: 'Introuvable' },
          ]}
          titre={navigation === 'sites' ? 'Site introuvable' : 'Domaine introuvable'}
        />
        <EmptyState
          titre="Ce domaine n’existe pas ou plus"
          phrase="Il a peut-être été supprimé, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: section.label, href: section.href }}
        />
      </div>
    )
  const d = entree.domaine
  const messagerie = messageries.items.find((m) => m.domaine === entree.nom)
  const drive = drives.items.find((x) => x.domaine === entree.nom)
  const h = entree.hebergement
  const abonnement = abonnementDeLEntree(entree)

  const onglets = [
    { id: 'apercu', label: 'Vue d’ensemble' },
    { id: 'zone', label: 'Zone DNS' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          section,
          { label: entree.nom },
        ]}
        titre={<span className="break-words font-mono">{entree.nom}</span>}
        sousTitre={
          h
            ? `Ce nom est servi par ${h.serveur.nom}, à ${SITE_LABEL[h.serveur.site]}. Les sites, les bases, la messagerie et les sauvegardes qui s’y rattachent ont chacun leur section.`
            : 'Ce nom vous appartient, mais aucun serveur ne lui est encore attaché. Vous pouvez lui en attacher un, ou laisser sa zone pointer ailleurs.'
        }
        meta={
          <>
            {d && <Badge tone="neutral">{extensionAffichee(d.extension)}</Badge>}
            {entree.provisoire ? (
              <Badge tone="warn">Nom provisoire</Badge>
            ) : (
              <Badge tone="ok">Enregistré</Badge>
            )}
            {h && <Badge tone="violet">{h.palier.charAt(0).toUpperCase() + h.palier.slice(1)}</Badge>}
            {entree.zone ? (
              <Badge tone="violet">Zone gérée chez nous</Badge>
            ) : (
              <Badge tone="warn">DNS externe</Badge>
            )}
            {d?.verrouTransfert && <Badge tone="neutral">Transfert verrouillé</Badge>}
          </>
        }
        actions={
          <>
            {h ? (
              <ButtonLink href={lienServeur(h.id)} iconBefore={<ServerCog size={14} />}>
                {navigation === 'sites' ? 'Gérer le serveur' : 'Gérer l’hébergement'}
              </ButtonLink>
            ) : (
              <BoutonFormulaire
                libelle="Attacher un hébergement"
                size="md"
                variant="primary"
                icone={<ServerCog size={14} />}
                action="service.admin"
                titre={`Attacher un hébergement à ${entree.nom}`}
                description="L’attachement crée le serveur, son Apache, son PHP et son serveur de bases, puis pointe la zone vers son adresse. Rien n’est perdu si vous détachez plus tard : la zone reste."
                champs={[
                  {
                    id: 'palier',
                    label: 'Palier',
                    type: 'select',
                    options: PALIERS_HEBERGEMENT.map((p) => ({
                      value: p.code,
                      label: `${p.nom} · ${p.vcpu} vCPU · ${p.ramGo} Go · ${moneyPerMonth(p.prixMois)}`,
                    })),
                  },
                  {
                    id: 'site',
                    label: 'Site physique',
                    type: 'select',
                    options: SITES.map((s) => ({ value: s, label: SITE_COURT[s] })),
                  },
                ]}
                valeursDepart={{ palier: 'starter', site: 'ABJ' }}
                libelleValider="Attacher"
                operation={(v) => ({
                  titre: `Hébergement ${v.palier} en cours de création`,
                  detail: `Serveur à ${SITE_COURT[v.site as 'ABJ' | 'GBM']}. La zone sera pointée vers son adresse.`,
                  appel: () =>
                    creerRessource('/web/hebergements', {
                      palier: String(v.palier),
                      site: v.site as 'ABJ' | 'GBM',
                      domaine: entree.nom,
                    }),
                  job: {
                    type: 'hebergement.create',
                    label: `Attachement d’un hébergement · ${entree.nom}`,
                    etapes: [
                      'Provisionner le serveur',
                      'Installer Apache et PHP',
                      'Démarrer le serveur de bases',
                      'Poser le certificat',
                      'Pointer les enregistrements A de la zone',
                    ],
                  },
                  effetFinal: () => parcHebergements.recharger(),
                })}
              />
            )}
            {d && !h && (
              <ResilierDomaine domaineId={d.id} nom={entree.nom} />
            )}
            <BoutonFormulaire
              libelle="Transférer"
              size="md"
              icone={<ArrowRightLeft size={14} />}
              action="network.manage"
              titre={`Transférer ${entree.nom}`}
              description="Le transfert sortant demande le déverrouillage puis un code d’autorisation, que nous vous remettons sans justification. Nous ne retenons pas un nom."
              champs={[
                {
                  id: 'sens',
                  label: 'Sens du transfert',
                  type: 'select',
                  options: [
                    { value: 'sortant', label: 'Vers un autre bureau d’enregistrement' },
                    // Le transfert interne n'a pas de route côté backend.
                    ...(estActif() ? [] : [{ value: 'interne', label: 'Vers une autre organisation Synelia' }]),
                  ],
                },
              ]}
              valeursDepart={{ sens: 'sortant' }}
              libelleValider="Demander le transfert"
              operation={(v) => {
                let codeAuth: string | undefined
                return {
                ton: 'info',
                titre:
                  v.sens === 'sortant'
                    ? `Code d’autorisation de ${entree.nom} envoyé`
                    : `Transfert interne de ${entree.nom} demandé`,
                detail:
                  v.sens === 'sortant'
                    ? estActif()
                      ? 'Le code d’autorisation s’affiche dans la notification suivante.'
                      : 'Le verrou de transfert est levé pour cinq jours. Le code est envoyé au contact titulaire.'
                    : 'L’organisation destinataire doit accepter le transfert depuis son espace.',
                // Le transfert sortant remet le code d’autorisation sans
                // friction ; le transfert interne n’a pas d’équivalent contrat.
                ...(v.sens === 'sortant'
                  ? {
                      appel: async () => {
                        const r = await requete<{ code?: string }>(
                          `/web/domaines/${encodeURIComponent(entree.id)}/code-auth`,
                          { methode: 'POST' },
                        )
                        codeAuth = r?.code
                        return r
                      },
                    }
                  : {}),
                effetFinal: () => {
                  portefeuille.recharger()
                  if (codeAuth)
                    executer({ ton: 'info', titre: `Code d’autorisation de ${entree.nom}`, detail: codeAuth, audit: false })
                },
                }
              }}
            />
          </>
        }
      />

      {vue === 'complet' && <Tabs tabs={onglets} active={onglet} onChange={setOnglet} />}

      {(vue === 'complet' ? onglet === 'apercu' : vue === 'apercu') && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader
                titre="État du nom de domaine"
                sousTitre="Trois états distincts, qui ne disent pas la même chose : l'un vient du registre, l'un de la résolution, l'un de la protection contre le vol de nom."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Etat
                  icone={<Globe size={14} />}
                  libelle="Statut au registre"
                  valeur="Enregistré"
                  ton="ok"
                  aide="Le nom est bien à vous auprès du registre de l’extension."
                />
                <Etat
                  icone={<ShieldCheck size={14} />}
                  libelle="État technique"
                  valeur={entree.zone ? 'Résolution active' : 'Servi ailleurs'}
                  ton={entree.zone ? 'ok' : 'warn'}
                  aide={
                    entree.zone
                      ? 'Nos serveurs de noms répondent pour ce domaine.'
                      : 'Les serveurs de noms d’un autre fournisseur répondent pour ce domaine.'
                  }
                />
                <Etat
                  icone={<Lock size={14} />}
                  libelle="Protection au transfert"
                  valeur={d?.verrouTransfert ? 'Verrouillé' : 'Déverrouillé'}
                  ton={d?.verrouTransfert ? 'ok' : 'warn'}
                  aide={
                    d?.verrouTransfert
                      ? 'Aucun transfert sortant ne peut aboutir sans que vous leviez le verrou.'
                      : 'Un transfert sortant peut être demandé. À reverrouiller après une opération.'
                  }
                />
              </div>

              <KeyValueList
                className="mt-4 border-t border-g-100 pt-4"
                items={[
                  { cle: 'Extension', valeur: d ? extensionAffichee(d.extension) : '—' },
                  { cle: 'Échéance', valeur: d ? dateCourte(d.expiration) : '—' },
                  {
                    cle: 'WHOIS',
                    valeur: d?.whoisProtege ? 'Coordonnées masquées' : 'Coordonnées publiques',
                  },
                  {
                    cle: 'Serveurs de noms',
                    valeur: entree.zone ? entree.zone.ns.join(' · ') : 'Fournisseur externe',
                  },
                ]}
              />
            </Card>

            {h ? (
            <Card>
              <CardHeader
                titre="Le serveur qui sert ce nom"
                sousTitre="Un domaine est attaché à un serveur et à un seul. Chaque sujet a sa section dans la barre du haut."
                actions={
                  <ButtonLink href={lienServeur(h.id)} variant="secondary" size="sm">
                    Ouvrir la fiche
                  </ButtonLink>
                }
              />
              <KeyValueList
                items={[
                  { cle: 'Serveur', valeur: h.serveur.nom },
                  { cle: 'Gabarit', valeur: `${h.serveur.vcpu} vCPU · ${h.serveur.ramGo} Go · ${h.serveur.diskGo} Go` },
                  { cle: 'Adresse IPv4', valeur: h.serveur.ip },
                  { cle: 'Site physique', valeur: SITE_LABEL[h.serveur.site] },
                  { cle: 'Serveur web', valeur: h.serveur.serveurWeb },
                  { cle: 'PHP par défaut', valeur: h.php.versionDefaut },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-2 border-t border-g-100 pt-3">
                {[
                  {
                    l: `${
                      estActif()
                        ? tousSites.items.filter((s) => s.hebergementId === h.id).length
                        : sitesDeLHebergement(h.id).length
                    } applications`,
                    href: lienApplications,
                  },
                  { l: 'Bases de données', href: lienBases },
                  { l: 'Messagerie', href: '/app/web/emails' },
                  { l: 'Drive', href: '/app/web/drive' },
                  { l: 'Certificats', href: '/app/web/ssl' },
                  { l: 'Sauvegardes', href: '/app/web/backup' },
                ].map((x) => (
                  <ButtonLink key={x.l} href={x.href} variant="ghost" size="sm">
                    {x.l}
                  </ButtonLink>
                ))}
              </div>
            </Card>
            ) : (
            <Card>
              <CardHeader
                titre="Lui attacher un hébergement"
                sousTitre="Un domaine est attaché à un serveur et à un seul. L’attacher crée le serveur, son Apache, son PHP et son serveur de bases."
              />
              <Callout ton="info" titre="Ce que l’attachement fait, concrètement">
                Nous créons le serveur, nous posons le certificat, nous configurons l’entrée DNS
                (A sur <span className="font-mono">@</span>
                {dnsEntree.dnsEntreeWildcardCname ? (
                  <>
                    {' '}
                    et CNAME <span className="font-mono">*</span> vers le vhost edge
                  </>
                ) : null}
                ), et vous pouvez installer vos sites sur autant de sous-domaines que vous voulez.
                Rien n’est perdu si vous détachez plus tard : la zone reste.
              </Callout>
              <div className="mt-3 space-y-2">
                <div>
                  <MicroLabel>Enregistrement A (@) — entrée IPv4</MicroLabel>
                  <CopyField
                    value={dnsEntree.dnsEntreeA ?? '—'}
                    mono
                    className="mt-1.5"
                  />
                </div>
                {dnsEntree.dnsEntreeWildcardCname ? (
                  <div>
                    <MicroLabel>Enregistrement CNAME (*) — sous-domaines</MicroLabel>
                    <CopyField
                      value={dnsEntree.dnsEntreeWildcardCname}
                      mono
                      className="mt-1.5"
                    />
                  </div>
                ) : null}
              </div>
              {navigation === 'sites' && (
                <ButtonLink href={section.href} variant="secondary" size="sm" className="mt-4">
                  Retour au portefeuille
                </ButtonLink>
              )}
            </Card>
            )}
          </div>

          <div className="space-y-4">
            {abonnement && (
              <CarteAbonnement
                offre={abonnement.offre}
                prixMensuel={abonnement.prixMensuel}
                debut={abonnement.debut}
                echeance={abonnement.echeance}
                joursRestants={abonnement.joursRestants}
                renouvellementAuto={abonnement.renouvellementAuto}
                frequence={abonnement.frequence}
              />
            )}

            <Card>
              <CardHeader
                titre="Services associés"
                sousTitre="Ce qui pourrait tourner sur ce nom."
              />
              <ul className="space-y-2.5 text-[13px]">
                <Associe
                  libelle="Hébergement"
                  etat={h ? `${h.palier} · ${h.serveur.nom}` : 'Aucun'}
                  action={h ? 'Gérer' : 'Attacher'}
                  href={h ? lienServeur(h.id) : undefined}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                />
                <Associe
                  libelle="Messagerie"
                  etat={
                    messagerie?.actif
                      ? `${messagerie.boites.length} boîte${messagerie.boites.length > 1 ? 's' : ''}`
                      : 'Non activée'
                  }
                  action="Ouvrir"
                  href="/app/web/emails"
                />
                <Associe
                  libelle="Drive"
                  etat={drive?.actif ? `${drive.sieges.attribues} / ${drive.sieges.souscrits} sièges` : 'Non activé'}
                  action="Ouvrir"
                  href="/app/web/drive"
                />
                <Associe
                  libelle="Zone DNS"
                  etat={entree.zone ? 'Gérée chez nous' : 'Externe'}
                  action={entree.zone ? 'Modifier' : 'Rapatrier'}
                  href={lienDns}
                  onClick={() => setOnglet('zone')}
                />
                <Associe libelle="Sauvegardes" etat="Voir la section" action="Ouvrir" href="/app/web/backup" />
              </ul>
            </Card>
          </div>
        </div>
      )}

      {(vue === 'complet' ? onglet === 'zone' : vue === 'dns') &&
        (entree.zone ? (
          <EditeurZone zoneId={entree.zone.id} />
        ) : (
          <EmptyState
            titre="La zone de ce domaine est servie ailleurs"
            phrase="Les serveurs de noms déclarés au registre appartiennent à un autre fournisseur. Rapatriez la zone pour l’éditer ici : nous la créons vide, vous y recopiez vos enregistrements, puis vous changez les serveurs de noms chez votre bureau d’enregistrement."
            action={{
              libelle: 'Rapatrier la zone',
              onClick: () =>
                executer({
                  action: 'network.manage',
                  titre: `Zone ${entree.nom} rapatriée`,
                  detail:
                    'La zone est créée vide de notre côté : recopiez vos enregistrements existants avant de changer les serveurs de noms chez votre bureau d’enregistrement.',
                  appel: () => creerRessource('/web/dns', { domaine: entree.nom }),
                  effet: () =>
                    zones.creer({
                      id: zones.identifiant('zone'),
                      orgId: 'org-dba',
                      domaine: entree.nom,
                      dnssec: false,
                      ns: ['ns1.synelia.cloud', 'ns2.synelia.cloud'],
                      enregistrements: [],
                    }),
                  effetFinal: () => zones.recharger(),
                }),
            }}
          />
        ))}
    </div>
  )
}

/** Le backend stocke l’extension sans point (« com »), la graine avec (« .ci »). */
const extensionAffichee = (e: string) => (e.startsWith('.') ? e : `.${e}`)

function Etat({
  icone,
  libelle,
  valeur,
  ton,
  aide,
}: {
  icone: React.ReactNode
  libelle: string
  valeur: string
  ton: 'ok' | 'warn'
  aide: string
}) {
  return (
    <div className="rounded-[8px] border border-g-300 bg-g-050 p-3">
      <p className="flex items-center gap-1.5">
        <span className="text-p-700">{icone}</span>
        <span className="type-micro text-g-500">{libelle}</span>
      </p>
      <p className="mt-1.5">
        <Badge tone={ton}>{valeur}</Badge>
      </p>
      <p className="mt-2 text-[12px] leading-snug text-g-700">{aide}</p>
    </div>
  )
}

function Associe({
  libelle,
  etat,
  action,
  href,
  onClick,
}: {
  libelle: string
  etat: string
  action: string
  href?: string
  onClick?: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-g-100 pb-2 last:border-0 last:pb-0">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{libelle}</span>
        <span className="block text-[12px] text-g-500">{etat}</span>
      </span>
      {href ? (
        <Link href={href} className="shrink-0 text-[12px] font-semibold text-p-700 hover:underline">
          {action} →
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className="shrink-0 text-[12px] font-semibold text-p-700 hover:underline">
          {action} →
        </button>
      ) : (
        <span className="shrink-0 text-[12px] font-semibold text-g-500">{action}</span>
      )}
    </li>
  )
}
