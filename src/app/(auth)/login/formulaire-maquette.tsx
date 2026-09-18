'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

/**
 * Parcours fictif de démonstration (aucune API configurée) : l’e-mail est
 * validé localement avant de poursuivre vers `/callback`. Le bouton reste
 * inactif tant que l’adresse n’est pas plausible, au lieu de laisser passer
 * un champ vide.
 */
export function FormulaireConnexionMaquette() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const continuer = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (!emailValide) {
      setErreur('Saisissez une adresse e-mail valide pour continuer la démonstration.')
      return
    }
    setErreur(null)
    router.push('/callback')
  }

  return (
    <div className="rounded-[10px] border border-g-300 bg-white p-5">
      <div className="flex items-center gap-2">
        <Mail size={15} className="text-p-700" />
        <h2 className="type-h3">Continuer par e-mail</h2>
      </div>
      <form className="mt-3.5" onSubmit={continuer}>
        <Field label="Adresse e-mail professionnelle">
          <Input
            type="email"
            placeholder="prenom.nom@votre-organisation.ci"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (erreur) setErreur(null)
            }}
          />
        </Field>
        {erreur && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-err">
            {erreur}
          </p>
        )}
        <Button
          type="submit"
          fullWidth
          className="mt-3.5"
          disabled={!emailValide}
          iconAfter={<ArrowRight size={14} />}
        >
          Continuer
        </Button>
      </form>
      <p className="mt-2.5 text-[12px] leading-relaxed text-g-500">
        Démonstration locale : aucun identifiant n’est vérifié, vous serez redirigé vers un
        parcours fictif. Ce portail n’affiche jamais de champ de mot de passe dans ce mode.
      </p>
    </div>
  )
}
