'use client'

import { money, pct } from '@/lib/format'
import {
  BUDGET_IA,
  CLES_IA,
  COFFRE_CLES_FOURNISSEURS,
  GARDE_FOUS,
  REGLES_ROUTAGE,
} from '@/lib/mock'
import type { Tone } from '@/components/ui/badge'
import { CadreSection } from '@/components/app/cadre-section'
import { estActif } from '@/lib/api/client'
import { useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import type { CleIA } from '@/lib/types'

/**
 * Panneau de la section — les réglages de l'univers.
 *
 * La liste est fixe, contrairement aux autres panneaux : ce ne sont pas des
 * ressources qu'on crée, ce sont les six endroits où l'on règle la passerelle.
 * L'ordre suit la chaîne d'un appel : par où il entre, avec quelle clé chez le
 * fournisseur, vers quel modèle il part, ce qui le filtre, où il a le droit
 * d'être traité, et ce qu'il coûte.
 */
export function CadreParametres({ children }: { children: React.ReactNode }) {
  const espace = useEspace()
  const clesCol = useCollection<CleIA>('cles-ia', CLES_IA)
  const nbCles = clesCol.items.filter((c) => c.espaceId === espace.id).length
  const api = estActif()
  const actives = REGLES_ROUTAGE.filter((r) => r.actif).length
  const gardesActifs = GARDE_FOUS.filter((g) => g.actif).length
  const partBudget = (BUDGET_IA.consomme / BUDGET_IA.plafondMensuel) * 100

  const entrees: Array<{
    id: string
    nom: string
    sousTitre: string
    etat: string
    ton: Tone
    href: string
    motsCles: string[]
  }> = [
    {
      id: 'passerelle',
      nom: 'Passerelle & clés',
      sousTitre: 'Point d’entrée, clés d’accès, quotas par clé',
      etat: `${nbCles} clé${nbCles > 1 ? 's' : ''}`,
      ton: 'ok',
      href: '/app/ia/parametres/passerelle',
      motsCles: ['api', 'openai', 'jeton', 'quota', 'endpoint'],
    },
    {
      id: 'coffre',
      nom: 'Coffre-fort fournisseurs',
      sousTitre: 'Les clés éditeurs détenues par Synelia',
      etat: estActif() ? '1 entrée' : `${COFFRE_CLES_FOURNISSEURS.length} entrées`,
      ton: 'neutral',
      href: '/app/ia/parametres/coffre',
      motsCles: ['openbao', 'secret', 'rotation', 'fournisseur'],
    },
    {
      id: 'routage',
      nom: 'Règles de routage',
      sousTitre: 'Quel modèle répond, et vers quoi basculer',
      etat: api ? 'Exemple' : `${actives} actives`,
      ton: 'ok',
      href: '/app/ia/parametres/routage',
      motsCles: ['litellm', 'repli', 'fallback', 'priorite'],
    },
    {
      id: 'garde-fous',
      nom: 'Garde-fous',
      sousTitre: 'Ce qui filtre avant et après l’appel au modèle',
      etat: api ? 'Exemple' : `${gardesActifs} sur ${GARDE_FOUS.length}`,
      ton: gardesActifs === GARDE_FOUS.length ? 'ok' : 'warn',
      href: '/app/ia/parametres/garde-fous',
      motsCles: ['presidio', 'filtre', 'injection', 'anonymisation'],
    },
    {
      id: 'residence',
      nom: 'Résidence des données',
      sousTitre: 'Où chaque classe a le droit d’être traitée',
      etat: api ? 'Politique' : 'Validée',
      ton: 'violet',
      href: '/app/ia/parametres/residence',
      motsCles: ['souverain', 'territoire', 'classe', 'reglementee'],
    },
    {
      id: 'budget',
      nom: 'Budget & alertes',
      sousTitre: 'Plafond, quotas par direction, seuils',
      etat: api ? 'Exemple' : pct(partBudget),
      ton: partBudget > BUDGET_IA.seuilAlertePct ? 'warn' : 'ok',
      href: '/app/ia/parametres/budget',
      motsCles: ['plafond', 'quota', 'alerte', money(BUDGET_IA.plafondMensuel)],
    },
  ]

  return (
    <CadreSection
      titre="Paramètres"
      base="/app/ia/parametres"
      entrees={entrees}
      placeholderRecherche="Rechercher un réglage…"
      compteur={(visibles, total) =>
        visibles === total ? `${total} réglages` : `${visibles} sur ${total}`
      }
    >
      {children}
    </CadreSection>
  )
}
