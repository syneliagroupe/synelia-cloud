'use client'

import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/composition/card'
import { ApiError } from '@/lib/api/client'

/**
 * Formulaire de la vitrine — envoi simulé, mais réellement traité.
 *
 * La maquette n'a pas de serveur ; ce qu'elle peut faire honnêtement, c'est
 * exiger les champs obligatoires, accuser réception avec une référence, et dire
 * ce qui se passe ensuite. Un bouton d'envoi qui ne produit rien à l'écran est
 * la pire des deux options.
 */
let compteur = 0

export function FormulaireSite({
  children,
  libelle,
  titreSucces,
  phraseSucces,
  suite,
  complement,
  envoi,
}: {
  children: ReactNode
  libelle: string
  titreSucces: string
  phraseSucces: string
  /** Ce qui se passe ensuite, étape par étape. */
  suite: string[]
  /** Badges ou mentions affichés sous le bouton. */
  complement?: ReactNode
  /**
   * Envoi réel (`POST /public/contact|devis`) depuis le formulaire : renvoie
   * la référence d’accusé de réception. Absent = maquette (référence locale
   * et mention « aucun courriel ne part »).
   */
  envoi?: (formulaire: HTMLFormElement) => Promise<string>
}) {
  const [reference, setReference] = useState<string | null>(null)
  const [erreur, setErreur] = useState<{ message: string; reference?: string } | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)

  if (reference) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[8px] border border-ok/40 bg-ok-bg px-4 py-3.5">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" />
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-ink">{titreSucces}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-g-700">{phraseSucces}</p>
            <p className="mt-2 font-mono text-[12px] text-p-700">Référence {reference}</p>
          </div>
        </div>
        <ol className="space-y-1.5">
          {suite.map((x, i) => (
            <li key={x} className="flex items-start gap-2.5">
              <span className="tnum mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-g-100 text-[11px] font-bold text-g-700">
                {i + 1}
              </span>
              <span className="text-[12px] leading-snug text-g-700">{x}</span>
            </li>
          ))}
        </ol>
        {!envoi && (
          <Callout ton="info" titre="Cette maquette n’envoie aucun courriel">
            Le formulaire est fonctionnel à l’écran — champs obligatoires, accusé de réception,
            référence — mais aucune donnée ne quitte votre navigateur : il n’y a pas de serveur
            derrière cette démonstration.
          </Callout>
        )}
        <Button variant="secondary" fullWidth onClick={() => setReference(null)}>
          Remplir une autre demande
        </Button>
      </div>
    )
  }

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!envoi) {
      compteur += 1
      setReference(`SYN-2026-${String(4180 + compteur).padStart(4, '0')}`)
      return
    }
    setErreur(null)
    setEnvoiEnCours(true)
    envoi(e.currentTarget).then(
      (ref) => {
        setEnvoiEnCours(false)
        setReference(ref)
      },
      (err: unknown) => {
        setEnvoiEnCours(false)
        setErreur(
          err instanceof ApiError
            ? { message: err.message, reference: err.correlationId }
            : { message: 'Le serveur ne répond pas. Réessayez dans un moment.' },
        )
      },
    )
  }

  return (
    <form className="space-y-4" onSubmit={soumettre}>
      {children}
      {erreur && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-[6px] border border-err/40 bg-err-bg px-3 py-2 text-[12px] leading-relaxed text-ink"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-err" />
          <span>
            {erreur.message}
            {erreur.reference && (
              <span className="mt-1 block font-mono text-[11px] text-g-500">
                Référence {erreur.reference}
              </span>
            )}
          </span>
        </p>
      )}
      <Button type="submit" size="lg" fullWidth disabled={envoiEnCours}>
        {envoiEnCours ? 'Envoi en cours…' : libelle}
      </Button>
      {complement}
    </form>
  )
}
