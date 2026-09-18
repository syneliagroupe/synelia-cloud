'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { ApiError, ecrireSession, requete, type SessionApi } from '@/lib/api/client'
import { urlVerification } from '@/lib/auth/verification'

/**
 * Connexion réelle au backend (`POST /auth/connexion`, puis `/auth/mfa` si le
 * backend exige un second facteur). Rendu uniquement quand l’API est active ;
 * en mode maquette la page garde son parcours fictif vers `/callback`.
 */
export function FormulaireConnexionApi() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [defiMfa, setDefiMfa] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<{ message: string; reference?: string } | null>(null)

  const ouvrir = (session: SessionApi) => {
    ecrireSession(session)
    router.push('/app')
  }

  /**
   * Message d’erreur actionnable pour l’utilisateur ; la référence technique
   * (correlationId) reste affichée en discret pour le support, jamais en
   * première lecture.
   */
  const presenterErreur = (e: unknown): { message: string; reference?: string } => {
    if (e instanceof ApiError) {
      if (e.code === 'non_authentifie') {
        return {
          message: 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.',
          reference: e.correlationId,
        }
      }
      return { message: e.message, reference: e.correlationId }
    }
    // `fetch` ne rejette pas sur une réponse HTTP, seulement sur un échec
    // réseau : DNS, TLS, ou blocage CORS. Dans les deux derniers cas le
    // message « vérifiez votre connexion » envoie l’utilisateur sur une fausse
    // piste — on nomme les deux causes possibles.
    return {
      message:
        'Impossible de joindre l’API de connexion. Vérifiez votre connexion, ou réessayez plus tard : le service est peut-être momentanément indisponible.',
    }
  }

  const connecter = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    setChargement(true)
    setErreur(null)
    try {
      const session = await requete<SessionApi>('/auth/connexion', {
        methode: 'POST',
        corps: { email, motDePasse },
      })
      if (session.mfaRequis && !session.accessToken) {
        setDefiMfa(session.defiMfa ?? '')
      } else {
        ouvrir(session)
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'email_non_verifie') {
        router.push(urlVerification(email))
        return
      }
      setErreur(presenterErreur(e))
    } finally {
      setChargement(false)
    }
  }

  const validerMfa = async () => {
    if (!defiMfa) return
    setChargement(true)
    setErreur(null)
    try {
      ouvrir(
        await requete<SessionApi>('/auth/mfa', {
          methode: 'POST',
          corps: { defiMfa, code },
        }),
      )
    } catch (e) {
      setErreur(presenterErreur(e))
    } finally {
      setChargement(false)
    }
  }

  const alerteErreur = erreur && (
    <p role="alert" className="text-[12.5px] font-medium text-err">
      {erreur.message}
      {erreur.reference && (
        <span className="mt-1 block font-mono text-[11px] font-normal text-g-500">
          Référence {erreur.reference}
        </span>
      )}
    </p>
  )

  return (
    <div className="rounded-[10px] border border-g-300 bg-white p-5">
      <div className="flex items-center gap-2">
        {defiMfa ? <KeyRound size={15} className="text-p-700" /> : <Mail size={15} className="text-p-700" />}
        <h2 className="type-h3">{defiMfa ? 'Second facteur requis' : 'Se connecter'}</h2>
      </div>
      {defiMfa ? (
        <div className="mt-3.5 space-y-3.5">
          <Field label="Code à usage unique">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          {alerteErreur}
          <Button fullWidth loading={chargement} disabled={code.trim().length === 0} onClick={validerMfa} iconAfter={<ArrowRight size={14} />}>
            Vérifier
          </Button>
        </div>
      ) : (
        <form className="mt-3.5 space-y-3.5" onSubmit={connecter}>
          <Field label="Adresse e-mail professionnelle">
            <Input
              type="email"
              autoComplete="email"
              placeholder="prenom.nom@votre-organisation.ci"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Mot de passe">
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </Field>
          {alerteErreur}
          <Button
            type="submit"
            fullWidth
            loading={chargement}
            disabled={email.trim().length === 0 || motDePasse.length === 0}
            iconAfter={<ArrowRight size={14} />}
          >
            Se connecter
          </Button>
          <p className="text-[11.5px] leading-relaxed text-g-500">
            Session ouverte auprès de l’API configurée, sur une connexion chiffrée.
          </p>
        </form>
      )}
    </div>
  )
}
