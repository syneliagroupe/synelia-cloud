'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRightLeft, Globe, Lock, ServerCog, ShieldCheck } from 'lucide-react'
import { dateCourte } from '@/lib/format'
import { SITE_LABEL } from '@/lib/types'
import { abonnementDeLEntree, assemblerEntrees, entreeWebCloudById, sitesDeLHebergement } from '@/lib/mock'
import { DOMAINES, HEBERGEMENTS, ZONES_DNS } from '@/lib/mock'
import type { DnsZone, Domaine, WebHosting } from '@/lib/types'
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
import { creerRessource, estActif, requete } from '@/lib/api/client'

/**
 * Fiche d'un domaine auquel aucun serveur n'est attaché.
 *
 * Deux onglets suffisent : l'état au registre, et la zone. Afficher les dix
 * onglets d'un hébergement en les grisant serait pire que de ne pas les
 * afficher — le client croirait avoir perdu quelque chose.
 */
export function VueDomaine({ id }: { id: string }) {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const [onglet, setOnglet] = useState('apercu')
  const portefeuille = useCollection<Domaine>('domaines', DOMAINES)
  const parcHebergements = useCollection<WebHosting>('hebergements', HEBERGEMENTS)
  const zones = useCollection<DnsZone>('zones-dns', ZONES_DNS)

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
            { label: 'Domaines', href: '/app/web/domaines' },
            { label: 'Introuvable' },
          ]}
          titre="Domaine introuvable"
        />
        <EmptyState
          titre="Ce domaine n’existe pas ou plus"
          phrase="Il a peut-être été supprimé, ou vous avez suivi un lien vers une autre organisation."
          action={{ libelle: 'Retour aux domaines', href: '/app/web/domaines' }}
        />
      </div>
    )
  const d = entree.domaine
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
          { label: 'Domaines', href: '/app/web/domaines' },
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
            {d && <Badge tone="neutral">{d.extension}</Badge>}
            {entree.provisoire ? (
              <Badge tone="warn">Nom provisoire</Badge>
            ) : (
              <Badge tone="ok">Enregistré</Badge>
            )}
            {h && <Badge tone="violet">{h.palier}</Badge>}
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
              <ButtonLink href={`/app/web/hebergement/${h.id}`} iconBefore={<ServerCog size={14} />}>
                Gérer l’hébergement
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
                    options: [
                      { value: 'Démarrage', label: 'Démarrage · 2 vCPU · 4 Go' },
                      { value: 'Pro', label: 'Pro · 4 vCPU · 8 Go' },
                      { value: 'Agence', label: 'Agence · 8 vCPU · 16 Go' },
                    ],
                  },
                  {
                    id: 'site',
                    label: 'Site physique',
                    type: 'select',
                    options: [
                      { value: 'ABJ', label: 'Abidjan' },
                      { value: 'GBM', label: 'Grand-Bassam' },
                    ],
                  },
                ]}
                valeursDepart={{ palier: 'Pro', site: 'ABJ' }}
                libelleValider="Attacher"
                operation={(v) => ({
                  titre: `Hébergement ${v.palier} en cours de création`,
                  detail: `Serveur à ${v.site === 'ABJ' ? 'Abidjan' : 'Grand-Bassam'}. La zone sera pointée vers son adresse.`,
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
                    { value: 'interne', label: 'Vers une autre organisation Synelia' },
                  ],
                },
                { id: 'destinataire', label: 'Destinataire', placeholder: 'organisation ou bureau d’enregistrement' },
              ]}
              valeursDepart={{ sens: 'sortant' }}
              libelleValider="Demander le transfert"
              operation={(v) => ({
                ton: 'info',
                titre:
                  v.sens === 'sortant'
                    ? `Code d’autorisation de ${entree.nom} envoyé`
                    : `Transfert interne de ${entree.nom} demandé`,
                detail:
                  v.sens === 'sortant'
                    ? 'Le verrou de transfert est levé pour cinq jours. Le code est envoyé au contact titulaire.'
                    : 'L’organisation destinataire doit accepter le transfert depuis son espace.',
                // Le transfert sortant remet le code d’autorisation sans
                // friction ; le transfert interne n’a pas d’équivalent contrat.
                ...(v.sens === 'sortant'
                  ? {
                      appel: () =>
                        requete(`/web/domaines/${encodeURIComponent(entree.id)}/code-auth`, {
                          methode: 'POST',
                        }),
                    }
                  : {}),
                effetFinal: () => portefeuille.recharger(),
              })}
            />
          </>
        }
      />

      <Tabs tabs={onglets} active={onglet} onChange={setOnglet} />

      {onglet === 'apercu' && (
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
                  { cle: 'Extension', valeur: d?.extension ?? '—' },
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
                  <ButtonLink href={`/app/web/hebergement/${h.id}`} variant="secondary" size="sm">
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
                  { l: `${sitesDeLHebergement(h.id).length} applications`, href: '/app/web/applications' },
                  { l: 'Bases de données', href: '/app/web/bases' },
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
                Nous créons le serveur, nous posons le certificat, nous ajoutons les
                enregistrements <span className="font-mono">A</span> de la zone vers son adresse, et
                vous pouvez installer vos sites sur autant de sous-domaines que vous voulez. Rien
                n’est perdu si vous détachez plus tard : la zone reste.
              </Callout>
              <div className="mt-3">
                <MicroLabel>Adresse à viser depuis un DNS externe</MicroLabel>
                <CopyField value="102.176.20.13" mono className="mt-1.5" />
              </div>
              <ButtonLink href="/app/web/hebergement" variant="secondary" size="sm" className="mt-4">
                Comparer les paliers d’hébergement
              </ButtonLink>
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
                  href={h ? `/app/web/hebergement/${h.id}` : '/app/web/hebergement'}
                />
                <Associe libelle="Messagerie" etat="Voir la section" action="Ouvrir" href="/app/web/emails" />
                <Associe libelle="Drive" etat="Voir la section" action="Ouvrir" href="/app/web/drive" />
                <Associe
                  libelle="Zone DNS"
                  etat={entree.zone ? 'Gérée chez nous' : 'Externe'}
                  action={entree.zone ? 'Modifier' : 'Rapatrier'}
                />
                <Associe libelle="Sauvegardes" etat="Voir la section" action="Ouvrir" href="/app/web/backup" />
              </ul>
            </Card>
          </div>
        </div>
      )}

      {onglet === 'zone' &&
        (entree.zone ? (
          <EditeurZone zoneId={entree.zone.id} />
        ) : (
          <EmptyState
            titre="La zone de ce domaine est servie ailleurs"
            phrase="Les serveurs de noms déclarés au registre appartiennent à un autre fournisseur. Rapatriez la zone pour l’éditer ici : nous la recopions, vous vérifiez, puis vous changez les serveurs de noms."
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
}: {
  libelle: string
  etat: string
  action: string
  href?: string
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
      ) : (
        <span className="shrink-0 text-[12px] font-semibold text-g-500">{action}</span>
      )}
    </li>
  )
}
