'use client'

import Link from 'next/link'
import { Link2 } from 'lucide-react'
import { num, pct } from '@/lib/format'
import {
  CATEGORIE_OUTIL_LABEL,
  TYPE_CANAL_LABEL,
  type CanalAgent,
  type OutilAgent,
} from '@/lib/types'
import { AGENTS_IA, CANAUX_AGENT, OUTILS_AGENT, ROUTEUR_OMNICANAL } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/display'
import { Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'

const TON_ETAT = {
  connecte: 'ok',
  a_configurer: 'warn',
  erreur: 'err',
  indisponible: 'neutral',
} as const

const LIBELLE_ETAT = {
  connecte: 'Connecté',
  a_configurer: 'À configurer',
  erreur: 'En erreur',
  indisponible: 'Indisponible',
} as const

/** Ce que chaque canal impose à la réponse, et qui ne se contourne pas. */
const CONTRAINTE: Partial<Record<CanalAgent['type'], string>> = {
  sms: '160 caractères par segment, trois segments au plus. Au-delà, l’agent renvoie un lien plutôt qu’un roman découpé.',
  whatsapp:
    'Tout message sortant hors fenêtre de 24 h passe par un modèle validé par Meta. Comptez 48 h de validation.',
  voix: 'La réponse est lue à voix haute : pas de liste à puces, pas de référence de document, des phrases courtes.',
  ivr: 'Le plan de numérotation décide de ce qui arrive à l’agent et de ce qui part au menu à touches.',
  websocket:
    'Une connexion ouverte compte dans le quota de débit, pas dans celui des requêtes. Mille connexions inactives coûtent quand même.',
}

function VueCanal({ canal }: { canal: CanalAgent }) {
  const agents = AGENTS_IA.filter((a) => canal.agents.includes(a.id))
  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Intégrations', href: '/app/ia/integrations' },
          { label: TYPE_CANAL_LABEL[canal.type] },
        ]}
        titre={TYPE_CANAL_LABEL[canal.type]}
        sousTitre={canal.note}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              Canal entrant
            </Badge>
            <Badge tone={TON_ETAT[canal.etat]} dot size="sm">
              {LIBELLE_ETAT[canal.etat]}
            </Badge>
            {canal.contexteOmnicanal && (
              <Badge tone="violet" size="sm">
                <Link2 size={10} className="mr-1 inline" aria-hidden />
                Contexte partagé
              </Badge>
            )}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Messages 24 h"
          valeur={canal.messages24h > 0 ? num(canal.messages24h) : '—'}
          detail={canal.etat === 'connecte' ? 'Trafic réel' : 'Canal non ouvert'}
        />
        <StatTile
          libelle="Latence"
          valeur={canal.latenceMs > 0 ? `${num(canal.latenceMs)} ms` : '—'}
          detail="Aller-retour du canal, hors modèle"
        />
        <StatTile libelle="Agents branchés" valeur={agents.length} />
        <StatTile
          libelle="Reprise de contexte"
          valeur={canal.contexteOmnicanal ? 'Active' : 'Aucune'}
          ton={canal.contexteOmnicanal ? 'ok' : undefined}
          detail={canal.contexteOmnicanal ? `Fenêtre de ${ROUTEUR_OMNICANAL.fenetreHeures} h` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader titre="Raccordement" />
          <KeyValueList
            colonnes={1}
            items={[
              { cle: 'Fournisseur', valeur: canal.fournisseur },
              {
                cle: 'Identifiant',
                valeur: <span className="break-all font-mono text-[12px]">{canal.identifiant}</span>,
              },
              { cle: 'État', valeur: LIBELLE_ETAT[canal.etat] },
              {
                cle: 'Routeur omnicanal',
                valeur: canal.contexteOmnicanal
                  ? `Oui — clé : ${ROUTEUR_OMNICANAL.cle.toLowerCase()}`
                  : 'Non — chaque échange repart de zéro',
              },
            ]}
          />
          {CONTRAINTE[canal.type] && (
            <Callout ton="warn" className="mt-4" titre="Ce que ce canal impose">
              {CONTRAINTE[canal.type]}
            </Callout>
          )}
          {canal.etat === 'a_configurer' && (
            <Callout ton="info" className="mt-4" titre="Raccordement ouvert, rien ne passe encore">
              Le canal reste listé tant qu’il est incomplet, avec l’étape qui manque.
            </Callout>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Agents branchés"
              sousTitre="Un canal sans agent est un numéro qui sonne dans le vide."
            />
            {agents.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-g-500">
                Aucun agent n’écoute ce canal.
              </p>
            ) : (
              <div className="space-y-2">
                {agents.map((a) => (
                  <Link
                    key={a.id}
                    href={`/app/ia/agents/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5 transition-colors hover:border-p-400"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {a.nom}
                      </span>
                      <span className="block truncate text-[11px] text-g-500">{a.role}</span>
                    </span>
                    <Badge tone={a.statut === 'publie' ? 'ok' : 'neutral'} dot size="sm">
                      {a.statut === 'publie' ? 'Publié' : 'Brouillon'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader titre="Réglages du canal" />
            <div className="space-y-3.5">
              <Switch
                checked={canal.contexteOmnicanal}
                label="Reprendre le contexte des autres canaux"
                description={`Une conversation commencée ailleurs se poursuit ici, sur ${ROUTEUR_OMNICANAL.cle.toLowerCase()}, dans une fenêtre de ${ROUTEUR_OMNICANAL.fenetreHeures} heures. Aucune donnée de classe réglementée n’est reprise d’un canal à l’autre.`}
              />
              <Switch
                checked
                label="Journaliser les échanges"
                description="Trois mois consultables, puis archives. Le contenu avant masquage n’est jamais écrit."
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function VueOutil({ outil }: { outil: OutilAgent }) {
  const agents = AGENTS_IA.filter((a) => a.outils.includes(outil.id))

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Intégrations', href: '/app/ia/integrations' },
          { label: outil.nom },
        ]}
        titre={outil.nom}
        sousTitre={outil.description}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              {CATEGORIE_OUTIL_LABEL[outil.categorie]}
            </Badge>
            <Badge tone={outil.effet === 'ecriture' ? 'warn' : 'neutral'} size="sm">
              {outil.effet === 'ecriture' ? 'Écrit' : 'Lit seulement'}
            </Badge>
            {outil.confirmationRequise && (
              <Badge tone="violet" size="sm">
                Confirmation humaine
              </Badge>
            )}
            <Badge
              tone={outil.statut === 'actif' ? 'ok' : outil.statut === 'erreur' ? 'err' : 'neutral'}
              dot
              size="sm"
            >
              {outil.statut === 'actif' ? 'Actif' : outil.statut === 'erreur' ? 'En erreur' : 'Inactif'}
            </Badge>
          </span>
        }
        actions={
          <Button size="sm" variant="secondary" disabled title="La modification d’une déclaration d’outil n’a pas encore de contrepartie côté backend — seule la déclaration à la création (« Déclarer un outil ») existe.">
            Modifier la déclaration — bientôt
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Appels 24 h" valeur={num(outil.appels24h)} />
        <StatTile
          libelle="Taux d’erreur"
          valeur={pct(outil.tauxErreurPct, 1)}
          ton={outil.tauxErreurPct > 5 ? 'warn' : 'ok'}
        />
        <StatTile libelle="Latence médiane" valeur={`${num(outil.latenceP50Ms)} ms`} />
        <StatTile libelle="Agents autorisés" valeur={agents.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader titre="Signature" sousTitre="Ce que le modèle voit, et rien de plus." />
          <CodeBlock langue="ts" code={outil.signature} />
          <div className="mt-4">
            <KeyValueList
              colonnes={1}
              items={[
                { cle: 'Fournisseur', valeur: outil.fournisseur },
                { cle: 'Origine', valeur: CATEGORIE_OUTIL_LABEL[outil.categorie] },
                { cle: 'Authentification', valeur: outil.authentification },
                {
                  cle: 'Confirmation humaine',
                  valeur: outil.confirmationRequise
                    ? 'Exigée avant chaque appel'
                    : 'Non exigée — l’appel part directement',
                },
              ]}
            />
          </div>
          <Callout ton="violet" className="mt-4" titre="La portée se vérifie côté API">
            Écrire dans la consigne « ne consulte que le dossier du client appelant » ne protège
            rien. Ce qui protège, c’est un jeton dont la portée ne permet pas d’en lire un autre.
            C’est pour cela que le mode d’authentification figure ici : le cloisonnement se joue là,
            pas dans le texte de la consigne.
          </Callout>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Agents qui l’appellent"
              sousTitre="Un outil déclaré n’est pas accessible pour autant : il faut encore l’attribuer."
            />
            {agents.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-g-500">
                Aucun agent n’a cet outil dans sa liste. Il est déclaré, donc prêt, mais personne ne
                peut l’appeler.
              </p>
            ) : (
              <div className="space-y-2">
                {agents.map((a) => (
                  <Link
                    key={a.id}
                    href={`/app/ia/agents/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-g-300 px-3 py-2.5 transition-colors hover:border-p-400"
                  >
                    <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                      {a.nom}
                    </span>
                    <span className="tnum shrink-0 text-[11px] text-g-500">
                      {pct(a.metriques.tauxEchecOutilPct, 1)} d’échecs d’outils
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {outil.note && (
            <Callout
              ton={outil.statut === 'erreur' ? 'err' : 'info'}
              titre={
                outil.statut === 'erreur'
                  ? 'Cet outil échoue, et l’agent n’en dit rien'
                  : outil.statut === 'inactif'
                    ? 'Désactivé sur cet espace'
                    : 'Ce qu’il faut savoir'
              }
            >
              {outil.note}
            </Callout>
          )}

          {outil.tauxErreurPct > 5 && (
            <Callout ton="warn" titre="Le taux d’erreur pèse sur toute la chaîne">
              {pct(outil.tauxErreurPct, 1)} des appels échouent, soit environ{' '}
              {num(Math.round((outil.appels24h * outil.tauxErreurPct) / 100))} par jour. La reprise
              automatique en rattrape la majorité ; le reste produit une réponse plus pauvre, sans
              que personne ne le remarque.
            </Callout>
          )}
        </div>
      </div>
    </div>
  )
}

export function VueIntegration({ id }: { id: string }) {
  const canal = CANAUX_AGENT.find((c) => c.id === id)
  const outil = OUTILS_AGENT.find((o) => o.id === id)

  if (canal) return <VueCanal canal={canal} />
  if (outil) return <VueOutil outil={outil} />

  return (
    <EmptyState
      titre="Intégration introuvable"
      phrase="Ni canal, ni outil de ce nom. Le panneau de gauche liste les intégrations déclarées : les canaux d’abord, les outils ensuite."
      action={{ libelle: 'Voir les intégrations', href: '/app/ia/integrations' }}
    />
  )
}
