'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { ApiError, ecrireSession, requete, type SessionApi } from '@/lib/api/client'

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
  const [erreur, setErreur] = useState<string | null>(null)

  const ouvrir = (session: SessionApi) => {
    ecrireSession(session)
    router.push('/app')
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
      setErreur(
        e instanceof ApiError
          ? `${e.message}${e.correlationId ? ` Référence ${e.correlationId}.` : ''}`
          : 'Le backend ne répond pas.',
      )
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
      setErreur(
        e instanceof ApiError
          ? `${e.message}${e.correlationId ? ` Référence ${e.correlationId}.` : ''}`
          : 'Le backend ne répond pas.',
      )
    } finally {
      setChargement(false)
    }
  }

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
          {erreur && <p className="text-[12.5px] font-medium text-err">{erreur}</p>}
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
          {erreur && <p className="text-[12.5px] font-medium text-err">{erreur}</p>}
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
            Session ouverte auprès de l’API configurée. En démonstration locale, utilisez le compte
            <span className="font-mono text-[11px]"> admin@synelia.cloud</span>.
          </p>
        </form>
      )}
    </div>
  )
}
