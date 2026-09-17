'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MicroLabel } from '@/components/ui/badge'
import { estActif, requete } from '@/lib/api/client'

/** Panneau de progression persistant après première connexion (§3.3). */
const JALONS = [
  {
    id: 'premier',
    titre: 'Créer votre premier Espace Cloud ou souscrire votre premier service',
    detail:
      'Deux chemins possibles selon votre besoin : une enveloppe de capacité pour vos machines, ou un service prêt à l’emploi.',
    fait: true,
    actions: [
      { libelle: 'Créer un Espace Cloud', href: '/app/espaces/new' },
      { libelle: 'Nouveau projet', href: '/app/applications/nouveau' },
    ],
  },
  {
    id: 'equipe',
    titre: 'Inviter votre équipe',
    detail:
      'Ajoutez vos collaborateurs avec le rôle et la portée adaptés. Les invitations expirent au bout de sept jours.',
    fait: true,
    actions: [{ libelle: 'Inviter des membres', href: '/app/membres' }],
  },
  {
    id: 'domaine',
    titre: 'Configurer votre domaine',
    detail:
      'Assistant DNS guidé : nous affichons les enregistrements exacts à créer et vérifions la propagation pour vous.',
    fait: false,
    actions: [{ libelle: 'Configurer un domaine', href: '/app/web' }],
  },
  {
    id: 'sauvegardes',
    titre: 'Activer les sauvegardes',
    detail:
      'Un plan par défaut quotidien, immuable, avec copie sur le second site — applicable en un clic à toutes vos ressources étiquetées production.',
    fait: false,
    actions: [{ libelle: 'Activer le plan par défaut', href: '/app/sauvegarde' }],
  },
]

export function PanneauOnboarding() {
  const [ferme, setFerme] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>('domaine')
  // En mode API le backend sait si le guide est terminé ou masqué : on ne
  // l’affiche pas quand il dit de ne pas le faire. Les jalons eux-mêmes
  // restent décrits ici, au seul endroit où ce parcours existe.
  const [masqueDistant, setMasqueDistant] = useState(false)
  useEffect(() => {
    if (!estActif()) return
    requete<{ termine?: boolean; masque?: boolean }>('/onboarding').then(
      (o) => {
        if (o.termine || o.masque) setMasqueDistant(true)
      },
      () => {},
    )
  }, [])
  const faits = JALONS.filter((j) => j.fait).length

  const masquer = () => {
    setFerme(true)
    if (estActif()) requete('/onboarding', { methode: 'PATCH', corps: { masque: true } }).catch(() => {})
  }

  if (ferme || masqueDistant || faits === JALONS.length) return null

  return (
    <section className="overflow-hidden rounded-[10px] border border-p-300 bg-p-050">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <MicroLabel className="text-p-700">Prise en main</MicroLabel>
          <div className="flex items-center gap-1.5">
            {JALONS.map((j) => (
              <span
                key={j.id}
                className={cn('h-1.5 w-8 rounded-full', j.fait ? 'bg-p-700' : 'bg-p-300')}
              />
            ))}
          </div>
          <span className="tnum text-[12px] font-semibold text-p-700">
            {faits} sur {JALONS.length}
          </span>
        </div>
        <button
          type="button"
          onClick={masquer}
          className="flex items-center gap-1 text-[11.5px] font-semibold text-g-500 transition-colors hover:text-p-700"
        >
          Ne plus afficher
          <X size={12} />
        </button>
      </div>

      <ul className="divide-y divide-p-300/50 border-t border-p-300/50">
        {JALONS.map((j) => (
          <li key={j.id}>
            <button
              type="button"
              onClick={() => setOuvert(ouvert === j.id ? null : j.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/60"
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                  j.fait ? 'bg-ok text-white' : 'border-2 border-p-300 bg-white',
                )}
              >
                {j.fait && <Check size={11} strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 text-[13px]',
                  j.fait ? 'text-g-500 line-through decoration-g-300' : 'font-semibold text-ink',
                )}
              >
                {j.titre}
              </span>
              <ChevronRight
                size={14}
                className={cn(
                  'shrink-0 text-g-500 transition-transform',
                  ouvert === j.id && 'rotate-90',
                )}
              />
            </button>
            {ouvert === j.id && (
              <div className="px-4 pb-3.5 pl-12">
                <p className="max-w-2xl text-[12.5px] leading-relaxed text-g-700">{j.detail}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {j.actions.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="rounded-[6px] border border-p-700 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-p-700 transition-colors hover:bg-p-100"
                    >
                      {a.libelle}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
