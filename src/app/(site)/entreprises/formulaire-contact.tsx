'use client'

import type { ReactNode } from 'react'
import { FormulaireSite } from '@/components/site/formulaire'
import { estActif, requete } from '@/lib/api/client'

interface AccuseReception {
  reference: string
  message: string
  delaiReponseHeures?: number
}

/**
 * Formulaire de contact de la vitrine : en mode API, la demande part en
 * `POST /public/contact` (`{ nom, email, message, sujet }` requis) et la
 * référence affichée est celle du backend. Sans API, `FormulaireSite`
 * garde son accusé local avec la mention « aucun courriel ne part ».
 */
export function FormulaireContact({
  children,
  ...props
}: {
  children: ReactNode
  libelle: string
  titreSucces: string
  phraseSucces: string
  suite: string[]
  complement?: ReactNode
}) {
  return (
    <FormulaireSite
      {...props}
      envoi={
        estActif()
          ? async (formulaire) => {
              const champs = new FormData(formulaire)
              const texte = (cle: string) => String(champs.get(cle) ?? '').trim()
              const accuse = await requete<AccuseReception>('/public/contact', {
                methode: 'POST',
                corps: {
                  nom: texte('nom'),
                  email: texte('email'),
                  telephone: texte('tel') || undefined,
                  organisation: texte('organisation') || undefined,
                  taille: texte('taille') || undefined,
                  secteur: texte('secteur') || undefined,
                  sujet: 'commercial',
                  message: [
                    texte('besoin'),
                    `— ${texte('fonction')}${texte('organisation') ? `, ${texte('organisation')}` : ''}${texte('pays') ? ` (${texte('pays')})` : ''}`,
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
                },
              })
              return accuse.reference
            }
          : undefined
      }
    >
      {children}
    </FormulaireSite>
  )
}
