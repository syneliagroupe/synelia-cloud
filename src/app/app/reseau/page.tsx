'use client'

import { useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateHeure, num } from '@/lib/format'
import { NETWORKS, PUBLIC_IPS, SECURITY_GROUPS, VMS, VPN_TUNNELS } from '@/lib/mock'
import type { Network, PublicIP, SecurityGroup, VM, VpnTunnel } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import {
  creerRessource,
  estActif,
  modifierRessource,
  requete,
  supprimerRessource,
} from '@/lib/api/client'

const ONGLETS = [
  { id: 'prives', label: 'Réseaux privés' },
  { id: 'ips', label: 'IP publiques' },
  { id: 'sg', label: 'Groupes de sécurité' },
  { id: 'vpn', label: 'VPN' },
]

export default function Reseau() {
  const espace = useEspace()
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const [onglet, setOnglet] = useState('prives')
  const [creationReseauOuverte, setCreationReseauOuverte] = useState(false)

  const lesReseaux = useCollection<Network>('reseaux', NETWORKS)
  const lesIps = useCollection<PublicIP>('ips', PUBLIC_IPS)
  const lesGroupes = useCollection<SecurityGroup>('groupes-securite', SECURITY_GROUPS)
  const lesTunnels = useCollection<VpnTunnel>('tunnels', VPN_TUNNELS)
  const parc = useCollection<VM>('vms', VMS)

  const reseaux = lesReseaux.items.filter((n) => n.espaceId === espace.id)
  const ips = lesIps.items.filter((i) => i.espaceId === espace.id)
  const groupes = lesGroupes.items.filter((s) => s.espaceId === espace.id)
  const tunnels = lesTunnels.items.filter((v) => v.espaceId === espace.id)
  const machines = parc.items.filter((v) => v.espaceId === espace.id)

  const champsReseau = [
    { id: 'nom', label: 'Nom du réseau', placeholder: 'prod-cache', obligatoire: true },
    { id: 'cidr', label: 'Plage', placeholder: '10.0.4.0/24', obligatoire: true },
    { id: 'vlan', label: 'VLAN', type: 'nombre' as const, demi: true, min: 1, max: 4094 },
    { id: 'dns', label: 'DNS interne', type: 'switch' as const, demi: true, placeholder: 'Activé' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace.code, href: `/app/espaces/${espace.id}` },
          { label: 'Réseau & VPN' },
        ]}
        titre="Réseau et adressage"
        sousTitre={`Plage allouée à ${espace.code} : ${espace.cidr}. Les réseaux privés découpent cette plage ; les groupes de sécurité filtrent le trafic.`}
        meta={
          <>
            <Badge tone="neutral">{espace.cidr}</Badge>
            <Badge tone="violet">{reseaux.length} réseaux privés</Badge>
            <Badge tone="ok">
              {ips.filter((i) => !i.attachedTo).length} IP disponibles sur {ips.length}
            </Badge>
          </>
        }
      />

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {/* Réseaux privés */}
      {onglet === 'prives' && (
        <Card>
          <CardHeader
            titre="Réseaux privés"
            sousTitre="Un réseau par usage permet d’appliquer des groupes de sécurité distincts et de limiter la portée d’une compromission."
            actions={
              <BoutonFormulaire
                libelle="Créer un réseau"
                variant="primary"
                icone={<Plus size={13} />}
                action="network.manage"
                titre="Créer un réseau privé"
                description={`Le réseau découpe la plage ${espace.cidr} de l’espace. Le routage entre réseaux privés d’un même espace est automatique ; le filtrage se fait par groupe de sécurité.`}
                ouvert={creationReseauOuverte}
                onOuvertChange={setCreationReseauOuverte}
                champs={champsReseau}
                valeursDepart={{ vlan: 100 + reseaux.length, dns: true }}
                libelleValider="Créer le réseau"
                operation={(v) => ({
                  titre: `Réseau ${v.nom} créé`,
                  detail: `Plage ${v.cidr} · VLAN ${v.vlan}`,
                  appel: () =>
                    creerRessource('/reseaux', {
                      nom: String(v.nom),
                      cidr: String(v.cidr),
                      espaceId: espace.id,
                      dnsInterne: Boolean(v.dns),
                      vlan: Number(v.vlan),
                    }),
                  effet: () =>
                    lesReseaux.creer({
                      id: lesReseaux.identifiant('net'),
                      espaceId: espace.id,
                      nom: String(v.nom),
                      cidr: String(v.cidr),
                      dnsInterne: Boolean(v.dns),
                      workloads: 0,
                      vlan: Number(v.vlan),
                    }),
                  effetFinal: () => lesReseaux.recharger(),
                })}
              />
            }
          />
          {reseaux.length === 0 ? (
            <EmptyState
              titre="Aucun réseau privé"
              phrase={`Découpez la plage ${espace.cidr} en sous-réseaux par usage — front, données, cache — pour appliquer des politiques de filtrage distinctes.`}
              action={{ libelle: 'Créer un réseau', onClick: () => setCreationReseauOuverte(true) }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Nom', 'Plage', 'VLAN', 'DNS interne', 'Workloads rattachés', ''].map((h) => (
                      <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reseaux.map((r) => (
                    <tr key={r.id} className="border-b border-g-100 last:border-0 hover:bg-p-050/60">
                      <td className="px-3 py-2.5 text-[13px] font-medium text-ink">{r.nom}</td>
                      <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{r.cidr}</td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">{r.vlan}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={r.dnsInterne ? 'ok' : 'neutral'} size="sm">
                          {r.dnsInterne ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </td>
                      <td className="tnum px-3 py-2.5 text-[12.5px] text-g-700">{r.workloads}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <BoutonFormulaire
                            libelle="Modifier"
                            variant="ghost"
                            action="network.manage"
                            titre={`Modifier ${r.nom}`}
                            champs={champsReseau}
                            valeursDepart={{
                              nom: r.nom,
                              cidr: r.cidr,
                              vlan: r.vlan ?? 100,
                              dns: r.dnsInterne,
                            }}
                            operation={(v) => ({
                              titre: `Réseau ${v.nom} modifié`,
                              appel: () =>
                                modifierRessource('/reseaux', r.id, {
                                  nom: String(v.nom),
                                  cidr: String(v.cidr),
                                  espaceId: espace.id,
                                  dnsInterne: Boolean(v.dns),
                                  vlan: Number(v.vlan),
                                }),
                              effet: () =>
                                lesReseaux.modifier(r.id, {
                                  nom: String(v.nom),
                                  cidr: String(v.cidr),
                                  vlan: Number(v.vlan),
                                  dnsInterne: Boolean(v.dns),
                                }),
                              effetFinal: () => lesReseaux.recharger(),
                            })}
                          />
                          <BoutonAction
                            libelle="Supprimer"
                            variant="ghost"
                            desactive={r.workloads > 0}
                            operation={{
                              action: 'network.manage',
                              ton: 'warn',
                              titre: `Réseau ${r.nom} supprimé`,
                              appel: () => supprimerRessource('/reseaux', r.id, r.nom),
                              effet: () => lesReseaux.supprimer(r.id),
                              effetFinal: () => lesReseaux.recharger(),
                            }}
                            confirmation={{
                              ressource: r.nom,
                              pertes: [
                                `La plage ${r.cidr} retourne au pool de l’espace`,
                                'Les règles de filtrage qui la désignent nommément deviendront sans objet',
                              ],
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 border-t border-g-100 pt-3 text-[11.5px] leading-relaxed text-g-500">
            Plage totale {espace.cidr} · {num(reseaux.length * 254)} adresses actuellement découpées
            sur les 1 024 disponibles. Le routage entre réseaux privés d’un même espace est
            automatique ; le filtrage se fait par groupe de sécurité.
          </p>
        </Card>
      )}

      {/* IP publiques */}
      {onglet === 'ips' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile libelle="IP réservées" valeur={ips.length} />
            <StatTile
              libelle="Attachées"
              valeur={ips.filter((i) => i.attachedTo).length}
              ton="ok"
            />
            <StatTile
              libelle="Disponibles"
              valeur={ips.filter((i) => !i.attachedTo).length}
              detail="Facturées même détachées"
            />
            <StatTile
              libelle="Protégées anti-DDoS"
              valeur={ips.filter((i) => i.antiDdos).length}
              ton="ok"
            />
          </div>

          <Card>
            <CardHeader
              titre="IP publiques"
              actions={
                <BoutonFormulaire
                  libelle="Commander une IP"
                  variant="primary"
                  icone={<Plus size={13} />}
                  action="network.manage"
                  titre="Commander une IP publique"
                  description="Une IP publique est facturée 3 500 FCFA par mois, attachée ou non. La protection anti-DDoS est incluse sur demande."
                  champs={[
                    { id: 'ptr', label: 'Reverse DNS (PTR)', placeholder: 'mail.dba.africa' },
                    { id: 'ddos', label: 'Protection anti-DDoS', type: 'switch', placeholder: 'Activée' },
                  ]}
                  valeursDepart={{ ddos: true }}
                  libelleValider="Commander"
                  operation={(v) => ({
                    titre: 'IP publique attribuée',
                    detail: 'Facturée au prorata du mois en cours.',
                    appel: () =>
                      creerRessource('/ips', {
                        espaceId: espace.id,
                        site: espace.site,
                        antiDdos: Boolean(v.ddos),
                        ...(String(v.ptr) ? { ptr: String(v.ptr) } : {}),
                      }),
                    job: {
                      type: 'network.ip.order',
                      label: `Attribution d’une IP publique · ${espace.code}`,
                      etapes: ['Réserver l’adresse dans le pool', 'Annoncer la route', 'Configurer le PTR'],
                      dureeEtapeMs: 900,
                    },
                    effetFinal: () => {
                      if (estActif()) {
                        lesIps.recharger()
                        return
                      }
                      lesIps.creer({
                        id: lesIps.identifiant('ip'),
                        espaceId: espace.id,
                        adresse: `102.176.20.${200 + ips.length}`,
                        ptr: String(v.ptr) || undefined,
                        antiDdos: Boolean(v.ddos),
                      })
                    },
                  })}
                />
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Adresse', 'Reverse DNS (PTR)', 'Ressource attachée', 'Anti-DDoS', 'Actions'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ips.map((ip) => (
                    <tr key={ip.id} className="border-b border-g-100 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-[12.5px] font-semibold text-ink">
                        {ip.adresse}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-g-700">
                        {ip.ptr ?? <span className="text-g-500">non configuré</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {ip.attachedLabel ? (
                          <Badge tone="violet" size="sm">
                            {ip.attachedLabel}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" size="sm">
                            Disponible
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={ip.antiDdos ? 'ok' : 'neutral'} size="sm">
                          {ip.antiDdos ? 'Actif' : 'Non'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1.5">
                          {ip.attachedTo ? (
                            <BoutonAction
                              libelle="Détacher"
                              variant="ghost"
                            operation={{
                              action: 'network.manage',
                              ton: 'warn',
                              titre: `${ip.adresse} détachée`,
                              detail: 'L’adresse reste réservée et facturée.',
                              appel: () =>
                                requete(`/ips/${encodeURIComponent(ip.id)}/attachement`, {
                                  methode: 'DELETE',
                                }),
                              effet: () =>
                                lesIps.modifier(ip.id, {
                                  attachedTo: undefined,
                                  attachedLabel: undefined,
                                }),
                              effetFinal: () => {
                                parc.recharger()
                                lesIps.recharger()
                              },
                            }}
                            />
                          ) : (
                            <BoutonFormulaire
                              libelle="Attacher"
                              variant="ghost"
                              action="network.manage"
                              titre={`Attacher ${ip.adresse}`}
                              champs={[
                                {
                                  id: 'machine',
                                  label: 'Machine de destination',
                                  type: 'select',
                                  options: machines.map((m) => ({ value: m.id, label: m.nom })),
                                },
                              ]}
                              libelleValider="Attacher"
                              operation={(v) => {
                                const cible = machines.find((m) => m.id === v.machine)
                                return {
                                  titre: `${ip.adresse} attachée à ${cible?.nom ?? ''}`,
                                  appel: () =>
                                    requete(`/ips/${encodeURIComponent(ip.id)}/attachement`, {
                                      methode: 'PUT',
                                      corps: { cibleId: String(v.machine) },
                                    }),
                                  effet: () => {
                                    lesIps.modifier(ip.id, {
                                      attachedTo: cible?.id,
                                      attachedLabel: cible?.nom,
                                    })
                                    if (cible)
                                      parc.modifier(cible.id, (m) => ({
                                        ips: [
                                          ...m.ips,
                                          { adresse: ip.adresse, type: 'publique' as const, ptr: ip.ptr },
                                        ],
                                      }))
                                  },
                                  effetFinal: () => {
                                    parc.recharger()
                                    lesIps.recharger()
                                  },
                                }
                              }}
                            />
                          )}
                          <BoutonFormulaire
                            libelle="Configurer le PTR"
                            variant="ghost"
                            action="network.manage"
                            titre={`Reverse DNS de ${ip.adresse}`}
                            description="Un PTR correct est indispensable si la machine envoie du courrier : sans lui, une bonne partie des serveurs de réception rejettent les messages."
                            champs={[
                              { id: 'ptr', label: 'Enregistrement PTR', placeholder: 'mail.dba.africa' },
                            ]}
                            valeursDepart={{ ptr: ip.ptr ?? '' }}
                            operation={(v) => ({
                              titre: `PTR de ${ip.adresse} enregistré`,
                              detail: String(v.ptr),
                              appel: () =>
                                modifierRessource('/ips', ip.id, {
                                  espaceId: ip.espaceId,
                                  site: espace.site,
                                  antiDdos: ip.antiDdos ?? false,
                                  ...(String(v.ptr) ? { ptr: String(v.ptr) } : {}),
                                }),
                              effet: () => lesIps.modifier(ip.id, { ptr: String(v.ptr) || undefined }),
                              effetFinal: () => lesIps.recharger(),
                            })}
                          />
                          <IconButton
                            label={
                              ip.attachedTo
                                ? 'Détachez l’IP avant de la libérer'
                                : 'Libérer l’IP'
                            }
                            size="sm"
                            disabled={Boolean(ip.attachedTo)}
                            onClick={() =>
                              executer({
                                action: 'network.manage',
                                ton: 'warn',
                                titre: `${ip.adresse} libérée`,
                                detail: 'L’adresse retourne au pool et n’est plus facturée. Elle ne pourra pas être reprise.',
                                appel: () => supprimerRessource('/ips', ip.id, ip.adresse),
                                effet: () => lesIps.supprimer(ip.id),
                                effetFinal: () => lesIps.recharger(),
                              })
                            }
                          >
                            <Trash2
                              size={13}
                              className={ip.attachedTo ? 'text-g-300' : 'text-err'}
                            />
                          </IconButton>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout ton="info" className="mt-4" titre="Reverse DNS et réputation">
              Un enregistrement PTR correct est indispensable si la machine envoie du courrier :
              sans lui, la plupart des serveurs destinataires rejettent ou classent en indésirable.
              Pour l’envoi transactionnel, préférez le relais SMTP, dont la réputation est gérée par
              nos équipes.
            </Callout>
          </Card>
        </div>
      )}

      {/* Groupes de sécurité */}
      {onglet === 'sg' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-[13px] leading-relaxed text-g-700">
              Un groupe de sécurité est nommé par usage, pas par machine. La politique par défaut est
              affichée explicitement : c’est ce qui évite les surprises lors d’un audit.
            </p>
            <BoutonFormulaire
              libelle="Créer un groupe"
              variant="primary"
              icone={<Plus size={13} />}
              action="network.manage"
              titre="Créer un groupe de sécurité"
              description="Un groupe est nommé par usage, pas par machine : c’est ce qui permet de le réutiliser et de le relire lors d’un audit."
              champs={[
                { id: 'nom', label: 'Nom du groupe', placeholder: 'sg-cache', obligatoire: true },
                { id: 'description', label: 'Usage', placeholder: 'Accès Redis depuis le front applicatif' },
                {
                  id: 'entree',
                  label: 'Politique par défaut en entrée',
                  type: 'select',
                  demi: true,
                  options: [
                    { value: 'deny', label: 'Refus (recommandé)' },
                    { value: 'allow', label: 'Autorisation' },
                  ],
                },
                {
                  id: 'sortie',
                  label: 'Politique par défaut en sortie',
                  type: 'select',
                  demi: true,
                  options: [
                    { value: 'allow', label: 'Autorisation' },
                    { value: 'deny', label: 'Refus' },
                  ],
                },
              ]}
              libelleValider="Créer le groupe"
              operation={(v) => ({
                titre: `Groupe ${v.nom} créé`,
                detail: 'Aucune ressource ne lui est encore attachée.',
                appel: () =>
                  creerRessource('/groupes-securite', {
                    espaceId: espace.id,
                    nom: String(v.nom),
                    ...(String(v.description) ? { description: String(v.description) } : {}),
                    defaultPolicy: {
                      ingress: v.entree as 'deny' | 'allow',
                      egress: v.sortie as 'deny' | 'allow',
                    },
                  }),
                effet: () =>
                  lesGroupes.creer({
                    id: lesGroupes.identifiant('sg'),
                    espaceId: espace.id,
                    nom: String(v.nom),
                    description: String(v.description) || undefined,
                    defaultPolicy: {
                      ingress: v.entree as 'deny' | 'allow',
                      egress: v.sortie as 'deny' | 'allow',
                    },
                    rules: [],
                    attaches: 0,
                  }),
                effetFinal: () => lesGroupes.recharger(),
              })}
            />
          </div>

          {groupes.map((sg) => (
            <Card key={sg.id}>
              <CardHeader
                titre={sg.nom}
                sousTitre={sg.description}
                actions={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral" size="sm">
                      {sg.attaches} ressource(s) attachée(s)
                    </Badge>
                    <Badge
                      tone={sg.defaultPolicy.ingress === 'deny' ? 'ok' : 'warn'}
                      size="sm"
                    >
                      {sg.defaultPolicy.ingress === 'deny' ? 'Refus' : 'Autorisation'} par défaut en
                      entrée
                    </Badge>
                    <Badge
                      tone={sg.defaultPolicy.egress === 'allow' ? 'neutral' : 'warn'}
                      size="sm"
                    >
                      Sortie {sg.defaultPolicy.egress === 'allow' ? 'autorisée' : 'refusée'}
                    </Badge>
                  </div>
                }
              />
              <div className="overflow-x-auto rounded-[6px] border border-g-300">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Direction', 'Protocole', 'Ports', 'Source / destination', 'Description', ''].map(
                        (h) => (
                          <th key={h} className="type-micro px-3 py-1.5 text-left text-g-500">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sg.rules.map((r) => (
                      <tr key={r.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-1.5">
                          <Badge tone={r.direction === 'in' ? 'info' : 'neutral'} size="sm">
                            {r.direction === 'in' ? 'Entrée' : 'Sortie'}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11.5px] uppercase text-ink">
                          {r.protocole}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11.5px] text-ink">
                          {r.ports ?? 'tous'}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11.5px] text-g-700">{r.cible}</td>
                        <td className="px-3 py-1.5 text-[11.5px] text-g-700">
                          {r.description ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <GatedAction
                            autorise={autorise('network.manage')}
                            message={refus('network.manage')}
                          >
                            <IconButton
                              label="Supprimer la règle"
                              size="sm"
                              onClick={() =>
                                executer({
                                  action: 'network.manage',
                                  ton: 'warn',
                                  titre: 'Règle supprimée',
                                  detail: `${sg.nom} · ${r.protocole.toUpperCase()} ${r.ports ?? ''} ${r.cible}`,
                                  appel: () =>
                                    requete(
                                      `/groupes-securite/${encodeURIComponent(sg.id)}/regles/${encodeURIComponent(r.id)}`,
                                      { methode: 'DELETE' },
                                    ),
                                  effet: () =>
                                    lesGroupes.modifier(sg.id, (g) => ({
                                      rules: g.rules.filter((x) => x.id !== r.id),
                                    })),
                                  effetFinal: () => lesGroupes.recharger(),
                                })
                              }
                            >
                              <Trash2 size={12} className="text-err" />
                            </IconButton>
                          </GatedAction>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <GatedAction autorise={autorise('network.manage')} message={refus('network.manage')}>
                <BoutonFormulaire
                  libelle="Ajouter une règle"
                  variant="ghost"
                  className="mt-2.5"
                  icone={<Plus size={12} />}
                  action="network.manage"
                  titre={`Ajouter une règle à ${sg.nom}`}
                  champs={[
                    {
                      id: 'direction',
                      label: 'Direction',
                      type: 'select',
                      demi: true,
                      options: [
                        { value: 'in', label: 'Entrée' },
                        { value: 'out', label: 'Sortie' },
                      ],
                    },
                    {
                      id: 'protocole',
                      label: 'Protocole',
                      type: 'select',
                      demi: true,
                      options: [
                        { value: 'tcp', label: 'TCP' },
                        { value: 'udp', label: 'UDP' },
                        { value: 'icmp', label: 'ICMP' },
                        { value: 'any', label: 'Tous' },
                      ],
                    },
                    { id: 'ports', label: 'Ports', placeholder: '443 ou 5432 ou 30000-32767', demi: true },
                    { id: 'cible', label: 'Source ou destination', placeholder: '0.0.0.0/0 ou sg-front', demi: true, obligatoire: true },
                    { id: 'description', label: 'Pourquoi cette règle existe', placeholder: 'HTTPS public' },
                  ]}
                  valeursDepart={{ direction: 'in', protocole: 'tcp' }}
                  libelleValider="Ajouter la règle"
                  operation={(v) => {
                    const idRegle = lesGroupes.identifiant('rule')
                    return {
                      titre: 'Règle ajoutée',
                      detail: `${sg.nom} · ${String(v.protocole).toUpperCase()} ${v.ports} ${v.cible}`,
                      appel: () =>
                        creerRessource(`/groupes-securite/${encodeURIComponent(sg.id)}/regles`, {
                          id: idRegle,
                          direction: v.direction as 'in' | 'out',
                          protocole: v.protocole as 'tcp' | 'udp' | 'icmp' | 'any',
                          ...(String(v.ports) ? { ports: String(v.ports) } : {}),
                          cible: String(v.cible),
                          ...(String(v.description)
                            ? { description: String(v.description) }
                            : {}),
                        }),
                      effet: () =>
                        lesGroupes.modifier(sg.id, (g) => ({
                          rules: [
                            ...g.rules,
                            {
                              id: idRegle,
                              direction: v.direction as 'in' | 'out',
                              protocole: v.protocole as 'tcp' | 'udp' | 'icmp' | 'any',
                              ports: String(v.ports) || undefined,
                              cible: String(v.cible),
                              description: String(v.description) || undefined,
                            },
                          ],
                        })),
                      effetFinal: () => lesGroupes.recharger(),
                    }
                  }}
                />
              </GatedAction>
            </Card>
          ))}
        </div>
      )}

      {/* VPN */}
      {onglet === 'vpn' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Tunnels site-à-site IPsec"
              sousTitre="Interconnexion entre vos sites physiques et votre Espace Cloud."
              actions={
                <BoutonFormulaire
                  libelle="Nouveau tunnel"
                  variant="primary"
                  icone={<Plus size={13} />}
                  action="network.manage"
                  titre="Nouveau tunnel IPsec"
                  description="Le tunnel relie votre site à la plage de l’espace. Les paramètres de chiffrement sont imposés : IKEv2, AES-256-GCM, PFS."
                  champs={[
                    { id: 'nom', label: 'Nom du tunnel', placeholder: 'siege-abidjan', obligatoire: true },
                    { id: 'passerelle', label: 'Passerelle distante', placeholder: '41.207.x.x', obligatoire: true },
                    { id: 'reseaux', label: 'Réseaux annoncés', placeholder: '192.168.10.0/24, 192.168.20.0/24' },
                  ]}
                  libelleValider="Créer le tunnel"
                  operation={(v) => ({
                    titre: `Tunnel ${v.nom} créé`,
                    detail: 'La négociation démarre dès que la passerelle distante répond.',
                    appel: () =>
                      creerRessource('/vpn', {
                        espaceId: espace.id,
                        nom: String(v.nom),
                        type: 'ipsec',
                        passerelleDistante: String(v.passerelle),
                        reseauxAnnonces: String(v.reseaux)
                          .split(',')
                          .map((r) => r.trim())
                          .filter(Boolean),
                      }),
                    job: {
                      type: 'network.vpn.create',
                      label: `Tunnel IPsec · ${v.nom}`,
                      etapes: ['Créer la politique IKEv2', 'Ouvrir le tunnel', 'Vérifier la phase 2'],
                      dureeEtapeMs: 1100,
                    },
                    effet: () =>
                      lesTunnels.creer({
                        id: lesTunnels.identifiant('vpn'),
                        espaceId: espace.id,
                        nom: String(v.nom),
                        type: 'ipsec',
                        passerelleDistante: String(v.passerelle),
                        reseauxAnnonces: String(v.reseaux)
                          .split(',')
                          .map((r) => r.trim())
                          .filter(Boolean),
                        statut: 'negociation',
                      }),
                    effetFinal: () => {
                      if (estActif()) {
                        lesTunnels.recharger()
                        return
                      }
                      lesTunnels.modifier(
                        lesTunnels.items.find((t) => t.nom === String(v.nom))?.id ?? '',
                        { statut: 'up', derniereNegociation: MAINTENANT },
                      )
                    },
                  })}
                />
              }
            />
            {tunnels.filter((t) => t.type === 'ipsec').length === 0 ? (
              <EmptyState
                titre="Aucun tunnel IPsec"
                phrase="Un tunnel site-à-site relie votre réseau local à votre Espace Cloud, sans exposer de service sur Internet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {['Tunnel', 'Passerelle distante', 'Réseaux annoncés', 'État', 'Dernière négociation'].map(
                        (h) => (
                          <th key={h} className="type-micro px-3 py-2 text-left text-g-500">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {tunnels
                      .filter((t) => t.type === 'ipsec')
                      .map((t) => (
                        <tr key={t.id} className="border-b border-g-100 last:border-0">
                          <td className="px-3 py-2.5 text-[13px] font-medium text-ink">{t.nom}</td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-g-700">
                            {t.passerelleDistante}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex flex-wrap gap-1">
                              {(t.reseauxAnnonces ?? []).map((r) => (
                                <Badge key={r} tone="neutral" size="sm">
                                  {r}
                                </Badge>
                              ))}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              tone={
                                t.statut === 'up' ? 'ok' : t.statut === 'negociation' ? 'warn' : 'err'
                              }
                              dot
                              size="sm"
                            >
                              {t.statut === 'up'
                                ? 'Établi'
                                : t.statut === 'negociation'
                                  ? 'Négociation'
                                  : 'Rompu'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-g-700">
                            {t.derniereNegociation ? dateHeure(t.derniereNegociation) : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {tunnels.some((t) => t.statut === 'negociation') && (
              <Callout ton="warn" className="mt-4" titre="Un tunnel est en cours de négociation">
                Le tunnel vers l’agence de Yamoussoukro renégocie sa phase 2 depuis plusieurs
                minutes. Vérifiez que les paramètres de chiffrement et les réseaux annoncés
                correspondent de part et d’autre — un désaccord sur les sélecteurs de trafic est la
                cause la plus fréquente.
              </Callout>
            )}
          </Card>

          <Card>
            <CardHeader
              titre="Accès client SSL / OpenVPN"
              sousTitre="Profils nominatifs pour les postes de travail. Chaque profil est révocable individuellement."
              actions={
                <BoutonFormulaire
                  libelle="Générer un profil"
                  variant="primary"
                  icone={<Plus size={13} />}
                  action="network.manage"
                  titre="Générer un profil d’accès nomade"
                  description="Un profil est nominatif : il porte un certificat client révocable individuellement. Il n’y a pas de profil partagé."
                  champs={[
                    { id: 'nom', label: 'Nom du profil', placeholder: 'poste-portable-ak', obligatoire: true },
                    { id: 'utilisateur', label: 'Utilisateur', placeholder: 'a.kone@dba.africa', obligatoire: true },
                  ]}
                  libelleValider="Générer"
                  operation={(v) => ({
                    titre: `Profil ${v.nom} généré`,
                    detail: 'Le fichier .ovpn est disponible pendant 24 heures.',
                    appel: () => {
                      const ssl = tunnels.find((t) => t.type === 'ssl')
                      return creerRessource(
                        `/vpn/${encodeURIComponent(ssl?.id ?? 'ssl')}/profils`,
                        { nom: String(v.nom), utilisateur: String(v.utilisateur) },
                      )
                    },
                    effet: () =>
                      lesTunnels.modifier(
                        tunnels.find((t) => t.type === 'ssl')?.id ?? '',
                        (t) => ({
                          profils: [
                            ...(t.profils ?? []),
                            {
                              nom: String(v.nom),
                              utilisateur: String(v.utilisateur),
                              cree: MAINTENANT,
                            },
                          ],
                        }),
                      ),
                    effetFinal: () => lesTunnels.recharger(),
                  })}
                />
              }
            />
            {tunnels
              .filter((t) => t.type === 'ssl')
              .map((t) => (
                <div key={t.id}>
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">{t.nom}</span>
                    <Badge tone={t.statut === 'up' ? 'ok' : 'err'} dot size="sm">
                      {t.statut === 'up' ? 'Service actif' : 'Service arrêté'}
                    </Badge>
                    <span className="text-[11.5px] text-g-500">
                      Pool d’adresses clientes : 10.99.0.0/24
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(t.profils ?? []).map((p) => (
                      <div
                        key={p.nom}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-3 rounded-[6px] border px-3 py-2',
                          p.revoque ? 'border-g-300 bg-g-050 opacity-70' : 'border-g-300',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[12.5px] font-semibold text-ink">
                            {p.nom}
                          </span>
                          <span className="block text-[11px] text-g-500">
                            {p.utilisateur} · créé le {p.cree}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {p.revoque ? (
                            <Badge tone="err" size="sm">
                              Révoqué
                            </Badge>
                          ) : (
                            <>
                              <BoutonAction
                                libelle="Télécharger le .ovpn"
                                variant="ghost"
                                icone={<Download size={12} />}
                                operation={{
                                  ton: 'info',
                                  titre: `Profil ${p.nom} téléchargé`,
                                  detail: 'Le certificat client n’est téléchargeable qu’une fois : conservez-le.',
                                }}
                              />
                              <BoutonAction
                                libelle="Révoquer"
                                variant="ghost"
                                operation={{
                                  action: 'network.manage',
                                  ton: 'warn',
                                  titre: `Profil ${p.nom} révoqué`,
                                  detail: 'La révocation est immédiate : la session en cours est coupée.',
                                  appel: () =>
                                    requete(
                                      `/vpn/${encodeURIComponent(t.id)}/profils/${encodeURIComponent(p.nom)}`,
                                      { methode: 'DELETE' },
                                    ),
                                  effet: () =>
                                    lesTunnels.modifier(t.id, (x) => ({
                                      profils: (x.profils ?? []).map((pr) =>
                                        pr.nom === p.nom ? { ...pr, revoque: true } : pr,
                                      ),
                                    })),
                                  effetFinal: () => lesTunnels.recharger(),
                                }}
                                confirmation={{
                                  ressource: p.nom,
                                  titre: `Révoquer le profil ${p.nom} ?`,
                                  pertes: [
                                    `${p.utilisateur} perdra immédiatement l’accès nomade`,
                                    'Le certificat client ne pourra pas être réactivé : il faudra en générer un autre',
                                  ],
                                  libelleAction: 'Révoquer le profil',
                                }}
                              />
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            <p className="mt-3 border-t border-g-100 pt-3 text-[11.5px] leading-relaxed text-g-500">
              La révocation est immédiate : le certificat client est ajouté à la liste de révocation
              et la session en cours est coupée. C’est la procédure à appliquer au départ d’un
              collaborateur ou à la fin d’une mission de prestataire.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
