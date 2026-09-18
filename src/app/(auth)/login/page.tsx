import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import { Callout } from '@/components/composition/card'
import { FormulaireConnexionApi } from './formulaire-connexion'
import { FormulaireConnexionMaquette } from './formulaire-maquette'

export const metadata: Metadata = { title: 'Se connecter' }

// Rendu côté serveur à partir de la même variable que `estActif()` : le
// premier HTML montre déjà le bon parcours, sans bascule à l’hydratation.
const API_ACTIVE = !!process.env.NEXT_PUBLIC_API_URL

export default function Connexion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-h1">Se connecter</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-g-500">
          Accédez à votre espace client ou à votre espace super admin.{' '}
          {API_ACTIVE
            ? 'Vos identifiants sont vérifiés par l’API Synelia Cloud sur une connexion chiffrée.'
            : 'Démonstration locale : aucun identifiant réel n’est vérifié.'}
        </p>
      </div>

      {API_ACTIVE ? (
        <FormulaireConnexionApi />
      ) : (
        <FormulaireConnexionMaquette />
      )}

      <Callout
        ton="violet"
        titre={
          <span className="flex items-center gap-1.5">
            <KeyRound size={13} />
            Authentification à plusieurs facteurs
          </span>
        }
      >
        Le second facteur (application d’authentification ou code de secours) et la durée de
        session suivent les règles de votre organisation. S’il est obligatoire, il vous sera
        demandé après la saisie de votre mot de passe.
      </Callout>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-g-100 pt-4 text-[13px]">
        <span className="text-g-500">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="font-semibold text-p-700 hover:text-m-600">
            Créer un compte
          </Link>
        </span>
        <Link href="/statut" className="text-g-500 hover:text-p-700">
          Besoin d’aide ? Voir l’état des services
        </Link>
      </div>
    </div>
  )
}
