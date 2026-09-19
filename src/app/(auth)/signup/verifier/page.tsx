'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, KeyRound, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { ApiError, ecrireSession, requete, type SessionApi } from '@/lib/api/client'
import { nettoyerCode, urlVerification } from '@/lib/auth/verification'

interface ErreurVerification {
  message: string
  reference?: string
  versLogin?: boolean
}

/**
 * Vérification d’email après inscription (`POST /auth/verification-email`) :
 * le code à 6 chiffres reçu par email active le compte et ouvre la session.
 */
function FormulaireVerification() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [chargement, setChargement] = useState(false)
  const [renvoi, setRenvoi] = useState(false)
  const [attenteRenvoi, setAttenteRenvoi] = useState(0)
  const [erreur, setErreur] = useState<ErreurVerification | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (attenteRenvoi === 0) return
    const minuteur = window.setInterval(
      () => setAttenteRenvoi((secondes) => Math.max(0, secondes - 1)),
      1000,
    )
    return () => window.clearInterval(minuteur)
  }, [attenteRenvoi])

  const messageErreur = (e: unknown): ErreurVerification => {
    if (!(e instanceof ApiError)) {
      return { message: 'Le backend ne répond pas. Vérifiez votre connexion puis réessayez.' }
    }
    // Compte déjà actif : on reste sur place avec un lien, plutôt que de
    // naviguer vers /login en jetant le message (erreur invisible).
    if (e.code === 'email_deja_verifie') {
      return { message: 'Email déjà vérifié : vous pouvez vous connecter.', versLogin: true }
    }
    return { message: e.message, reference: e.correlationId }
  }

  const verifier = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    if (code.trim().length === 0) return
    setChargement(true)
    setErreur(null)
    setInfo(null)
    try {
      const session = await requete<SessionApi>('/auth/verification-email', {
        methode: 'POST',
        corps: { email, code: code.trim() },
      })
      ecrireSession(session)
      router.push('/app')
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setChargement(false)
    }
  }

  const renvoyer = async () => {
    setRenvoi(true)
    setErreur(null)
    setInfo(null)
    try {
      await requete('/auth/verification-email/renvoi', { methode: 'POST', corps: { email } })
      setAttenteRenvoi(60)
      setInfo('Un nouveau code vient de vous être envoyé (valable 15 minutes).')
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setRenvoi(false)
    }
  }

  return (
    <form
      className="space-y-4 rounded-[10px] border border-g-300 bg-white p-5"
      onSubmit={verifier}
    >
      <div className="flex items-center gap-2">
        <MailCheck size={15} className="text-p-700" />
        <h2 className="type-h3">Vérifiez votre email</h2>
      </div>
      <p className="text-[12.5px] leading-relaxed text-g-500">
        Nous avons envoyé un code à 6 chiffres à votre adresse. Saisissez-le ci-dessous pour
        activer votre compte.
      </p>
      <Field label="Adresse e-mail" required>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@votre-organisation.ci"
        />
      </Field>
      <Field label="Code de vérification" required hint="Valable 15 minutes, 5 essais maximum">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(nettoyerCode(e.target.value))}
          placeholder="123456"
          autoFocus
        />
      </Field>
      {erreur && (
        <p role="alert" className="text-[12.5px] font-medium text-err">
          {erreur.message}
          {erreur.versLogin && (
            <span className="mt-1 block">
              <Link href="/login" className="font-semibold underline hover:text-m-600">
                Se connecter
              </Link>
            </span>
          )}
          {erreur.reference && (
            <span className="mt-1 block font-mono text-[11px] font-normal text-g-500">
              Référence {erreur.reference}
            </span>
          )}
        </p>
      )}
      {info && (
        <p role="status" className="text-[12.5px] font-medium text-ok">
          {info}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={chargement}
        disabled={email.trim().length === 0 || code.trim().length === 0}
        iconAfter={<ArrowRight size={15} />}
      >
        Activer mon compte
      </Button>
      <button
        type="button"
        onClick={renvoyer}
        disabled={renvoi || attenteRenvoi > 0 || email.trim().length === 0}
        className="flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold text-p-700 hover:text-m-600 disabled:opacity-50"
      >
        <KeyRound size={13} />
        {renvoi
          ? 'Envoi en cours…'
          : attenteRenvoi > 0
            ? `Renvoyer dans ${attenteRenvoi} s`
            : 'Renvoyer un code'}
      </button>
    </form>
  )
}

export default function VerifierEmail() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-h1">Vérifiez votre email</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-g-500">
          Dernière étape avant d’accéder à votre espace.
        </p>
      </div>
      <Suspense>
        <FormulaireVerification />
      </Suspense>
    </div>
  )
}
