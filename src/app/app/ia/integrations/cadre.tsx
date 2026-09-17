'use client'

import { CANAUX_AGENT, OUTILS_AGENT } from '@/lib/mock'
import type { Tone } from '@/components/ui/badge'
import { CATEGORIE_OUTIL_LABEL, TYPE_CANAL_LABEL } from '@/lib/types'
import { CadreSection } from '@/components/app/cadre-section'

const TON_CANAL: Record<string, Tone> = {
  connecte: 'ok',
  a_configurer: 'warn',
  erreur: 'err',
  indisponible: 'neutral',
}

const ETAT_CANAL: Record<string, string> = {
  connecte: 'Connecté',
  a_configurer: 'À configurer',
  erreur: 'En erreur',
  indisponible: 'Indisponible',
}

/**
 * Panneau de la section — les canaux d'abord, les outils ensuite.
 *
 * Les deux cohabitent parce qu'ils répondent à la même question : par où la
 * plateforme touche le monde extérieur. Un canal fait entrer, un outil fait
 * sortir ; les confondre serait une erreur, les séparer en deux onglets
 * obligerait à savoir d'avance de quel côté se trouve ce qu'on cherche.
 */
export function CadreIntegrations({ children }: { children: React.ReactNode }) {
  const canaux = CANAUX_AGENT.map((c) => ({
    id: c.id,
    nom: TYPE_CANAL_LABEL[c.type],
    sousTitre: `Canal · ${c.fournisseur}`,
    etat: ETAT_CANAL[c.etat],
    ton: TON_CANAL[c.etat],
    href: `/app/ia/integrations/${c.id}`,
    motsCles: [c.identifiant, c.nom, 'canal', 'entrant'],
  }))

  const outils = OUTILS_AGENT.map((o) => ({
    id: o.id,
    nom: o.nom,
    sousTitre: `Outil · ${CATEGORIE_OUTIL_LABEL[o.categorie]}`,
    etat: o.statut === 'actif' ? 'Actif' : o.statut === 'erreur' ? 'En erreur' : 'Inactif',
    ton: (o.statut === 'actif' ? 'ok' : o.statut === 'erreur' ? 'err' : 'neutral') as Tone,
    href: `/app/ia/integrations/${o.id}`,
    motsCles: [o.fournisseur, o.categorie, 'outil', o.effet],
  }))

  return (
    <CadreSection
      titre="Intégrations"
      base="/app/ia/integrations"
      entrees={[...canaux, ...outils]}
      placeholderRecherche="WhatsApp, SIP, MCP, OpenAPI…"
      compteur={(visibles, total) =>
        visibles === total
          ? `${canaux.length} canaux · ${outils.length} outils`
          : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
