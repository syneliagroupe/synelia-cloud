import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, KeyRound, Mail } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Callout } from '@/components/composition/card'
import { FormulaireConnexionApi } from './formulaire-connexion'

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
          Accédez à votre espace client ou à votre espace super admin. L’authentification est
          déléguée à notre fournisseur d’identité.
        </p>
      </div>

      {API_ACTIVE ? (
        <FormulaireConnexionApi />
      ) : (
      <div className="rounded-[10px] border border-g-300 bg-white p-5">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-p-700" />
          <h2 className="type-h3">Continuer par e-mail</h2>
        </div>
        <div className="mt-3.5">
          <Field label="Adresse e-mail professionnelle">
            <Input type="email" placeholder="prenom.nom@votre-organisation.ci" autoComplete="email" />
          </Field>
        </div>
        <ButtonLink href="/callback" fullWidth className="mt-3.5" iconAfter={<ArrowRight size={14} />}>
          Continuer
        </ButtonLink>
        <p className="mt-2.5 text-[12px] leading-relaxed text-g-500">
          Vous serez redirigé vers notre fournisseur d’identité pour saisir votre mot de passe. Ce
          portail n’affiche jamais de champ de mot de passe et n’en conserve aucun.
        </p>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-g-500">
          Vous serez redirigé vers notre fournisseur d’identité pour saisir votre mot de passe. Ce
          portail n’affiche jamais de champ de mot de passe et n’en conserve aucun.
        </p>
      </div>
      )}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-g-300" />
        <span className="text-[12px] font-semibold uppercase tracking-wider text-g-500">ou</span>
        <span className="h-px flex-1 bg-g-300" />
      </div>

      <Link
        href="/login/sso"
        className="group flex items-center gap-3.5 rounded-[10px] border border-g-300 bg-white p-4 transition-all hover:border-m-600 hover:shadow-[0_4px_16px_rgba(43,27,77,.1)]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-m-050 text-m-600">
          <Building2 size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-m-600">
            Se connecter avec le SSO de mon entreprise
          </span>
          <span className="block text-[12px] leading-snug text-g-500">
            Fédération OIDC ou SAML depuis votre annuaire. Vos groupes déterminent vos rôles.
          </span>
        </span>
        <ArrowRight
          size={15}
          className="shrink-0 text-g-300 transition-all group-hover:translate-x-0.5 group-hover:text-m-600"
        />
      </Link>

      <Callout
        ton="violet"
        titre={
          <span className="flex items-center gap-1.5">
            <KeyRound size={13} />
            Authentification à plusieurs facteurs
          </span>
        }
      >
        Le MFA, la politique de mot de passe et la durée de session sont administrés dans Keycloak,
        au niveau de votre organisation. Si votre administrateur l’a rendu obligatoire, il vous sera
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
