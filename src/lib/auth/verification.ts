/**
 * Décisions pures du flux de vérification d’email (inscription) — testées en
 * `verification.test.ts`, utilisées par `formulaire-inscription.tsx` et
 * `signup/verifier/page.tsx`.
 */

export interface EtatVerification {
  email: string
  expire: string
  essaisRestants: number
}

/** La réponse d’inscription est un état de vérification (202), pas une session. */
export function estEtatVerification(reponse: unknown): reponse is EtatVerification {
  return (
    typeof reponse === 'object' &&
    reponse !== null &&
    typeof (reponse as Record<string, unknown>).essaisRestants === 'number'
  )
}

/** N ne garde que 6 chiffres : ce que l’utilisateur peut saisir dans le champ code. */
export function nettoyerCode(saisie: string): string {
  return saisie.replace(/[^0-9]/g, '').slice(0, 6)
}

/** URL de l’étape de vérification après une inscription non vérifiée. */
export function urlVerification(email: string): string {
  return `/signup/verifier?email=${encodeURIComponent(email)}`
}
