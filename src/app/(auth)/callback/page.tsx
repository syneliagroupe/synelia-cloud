'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/display'
import { ButtonLink } from '@/components/ui/button'

const ETAPES = [
  {
    titre: 'Vérification de votre adresse',
    detail: 'Votre adresse e-mail est associée à une session de démonstration locale.',
  },
  {
    titre: 'Création de la session',
    detail: 'Session applicative ouverte, revendications lues, second facteur vérifié.',
  },
  {
    titre: 'Résolution de vos organisations',
    detail: 'Vos appartenances et vos rôles sont chargés depuis l’annuaire.',
  },
]

export default function Callback() {
  const [avancement, setAvancement] = useState(0)

  useEffect(() => {
    const timers = ETAPES.map((_, i) =>
      setTimeout(() => setAvancement(i + 1), 500 + i * 700),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const termine = avancement >= ETAPES.length

  return (
    <div className="space-y-6 pt-8">
      <div>
        <h1 className="type-h1">Finalisation de votre connexion</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-g-500">
          Quelques secondes le temps d’établir votre session. Ne fermez pas cette fenêtre.
        </p>
      </div>

      <ol className="space-y-2.5">
        {ETAPES.map((e, i) => {
          const faite = avancement > i
          const encours = avancement === i
          return (
            <li
              key={e.titre}
              className={cn(
                'flex items-start gap-3 rounded-[10px] border px-4 py-3.5 transition-colors',
                faite
                  ? 'border-ok/25 bg-ok-bg'
                  : encours
                    ? 'border-p-300 bg-p-050'
                    : 'border-g-300 bg-white',
              )}
            >
              <span className="mt-0.5 shrink-0">
                {faite ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : encours ? (
                  <Spinner size={18} />
                ) : (
                  <span className="block h-5 w-5 rounded-full border-2 border-g-300" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    'block text-[13px] font-semibold',
                    faite || encours ? 'text-ink' : 'text-g-500',
                  )}
                >
                  {e.titre}
                </span>
                <span className="block text-[12px] leading-snug text-g-500">{e.detail}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {termine ? (
        <ButtonLink href="/select-organisation" fullWidth size="lg">
          Continuer
        </ButtonLink>
      ) : (
        <p className="text-center text-[12px] text-g-500">
          Cela prend plus de temps que prévu ?{' '}
          <Link
            href="/select-organisation"
            className="font-semibold text-p-700 hover:underline"
          >
            Continuer manuellement
          </Link>
        </p>
      )}

      <p className="border-t border-g-100 pt-4 text-[11px] leading-relaxed text-g-500">
        Démonstration locale — aucune session réelle n’est créée à l’issue de ce parcours fictif.
      </p>
    </div>
  )
}
