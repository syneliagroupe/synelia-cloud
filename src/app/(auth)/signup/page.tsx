import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { MicroLabel } from '@/components/ui/badge'
import { Callout } from '@/components/composition/card'
import { FormulaireInscriptionApi } from './formulaire-inscription'

export const metadata: Metadata = { title: 'Créer un compte' }

// Même bascule que `/login` : un seul appel réel remplace les deux étapes
// du parcours maquette (identité chez un IdP externe, puis organisation).
const API_ACTIVE = !!process.env.NEXT_PUBLIC_API_URL

const ETAPES = [
  {
    titre: 'Créer votre identité',
    detail:
      'Chez notre fournisseur d’identité. C’est là que vit votre mot de passe et votre second facteur — jamais dans ce portail.',
  },
  {
    titre: 'Créer votre organisation',
    detail:
      'Nom, pays, secteur, numéro de TVA. C’est ici que naît votre tenant, et vous en devenez Org Admin.',
  },
  {
    titre: 'Votre premier Espace Cloud ou service',
    detail:
      'Une enveloppe de capacité pour vos machines, ou un service prêt à l’emploi du marketplace. Les deux chemins sont proposés.',
  },
]

const AVANTAGES = [
  'Un portail unique pour l’infrastructure, les applications et les outils de travail',
  'Facturation en FCFA, mobile money accepté au même niveau que la carte et le virement',
  'Aucun engagement en mensuel — résiliable à la fin du mois en cours',
]

export default function Inscription() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-h1">Créer un compte</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-g-500">
          {API_ACTIVE
            ? 'Votre identité et votre organisation en une fois. Comptez deux minutes.'
            : 'Trois étapes, dont une seule se passe chez nous. Comptez cinq minutes.'}
        </p>
      </div>

      {API_ACTIVE ? (
        <FormulaireInscriptionApi />
      ) : (
        <>
          <ol className="space-y-3">
            {ETAPES.map((e, i) => (
              <li
                key={e.titre}
                className="flex gap-3.5 rounded-[10px] border border-g-300 bg-white p-4"
              >
                <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-p-100 text-[12px] font-bold text-p-700">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-ink">{e.titre}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-g-700">{e.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <ButtonLink href="/signup/organisation" size="lg" fullWidth iconAfter={<ArrowRight size={15} />}>
            Créer mon identité
          </ButtonLink>
          <p className="-mt-3 text-center text-[11.5px] text-g-500">
            Vous serez redirigé vers notre fournisseur d’identité, puis reviendrez ici pour créer votre
            organisation.
          </p>
        </>
      )}

      <div className="rounded-[10px] border border-p-300 bg-p-050 p-4">
        <MicroLabel className="text-p-700">Ce que vous obtenez tout de suite</MicroLabel>
        <ul className="mt-2.5 space-y-2">
          {AVANTAGES.map((a) => (
            <li key={a} className="flex items-start gap-2.5">
              <Check size={14} className="mt-[3px] shrink-0 text-ok" />
              <span className="text-[12.5px] leading-relaxed text-g-700">{a}</span>
            </li>
          ))}
        </ul>
      </div>

      <Callout ton="info" titre="Prix et taxes">
        Les tarifs affichés sont hors taxes, en francs CFA. La TVA au taux en vigueur de 18 %
        s’ajoute au montant hors taxes. Toute ressource créée ou supprimée en cours de mois est
        facturée au prorata journalier.
      </Callout>

      <p className="border-t border-g-100 pt-4 text-[12.5px] text-g-500">
        Vous avez déjà un compte ?{' '}
        <Link href="/login" className="font-semibold text-p-700 hover:text-m-600">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
