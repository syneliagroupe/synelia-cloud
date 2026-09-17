'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/components/app/contexte'
import { requete } from '@/lib/api/client'

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

let scriptCharge: Promise<void> | undefined

/** Charge Inline.js une seule fois, quel que soit le nombre de boutons montés. */
function chargerPaystack(): Promise<void> {
  if (scriptCharge) return scriptCharge
  scriptCharge = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v2/inline.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Impossible de charger Paystack.'))
    document.head.appendChild(script)
  })
  return scriptCharge
}

interface InitiationPaystack {
  reference: string
  clePublique: string
  montantMineur: number
  devise: string
  email: string
  canaux: string[]
}

/**
 * Bouton « Payer par carte / mobile money » — carte, Orange Money, MTN MoMo via le
 * popup Paystack (sandbox). La confirmation ne se fait jamais sur la seule réponse du
 * popup : `onSuccess` appelle `GET /paystack/verifier/{reference}` côté serveur, qui
 * revérifie auprès de Paystack avant de créditer (voir `paystack.py` côté backend).
 */
export function BoutonPaiementPaystack({
  factureId,
  onSuccess,
}: {
  factureId: string
  onSuccess: () => void
}) {
  const { pousser } = useApp()
  const [enCours, setEnCours] = useState(false)

  const payer = async () => {
    setEnCours(true)
    try {
      const init = await requete<InitiationPaystack>(
        `/facturation/factures/${encodeURIComponent(factureId)}/paystack/initier`,
        { methode: 'POST' },
      )
      if (!init.clePublique) {
        pousser({
          ton: 'err',
          titre: 'Paystack non configuré',
          detail: 'Aucune clé publique côté serveur (PAYSTACK_PUBLIC_KEY).',
        })
        return
      }
      await chargerPaystack()
      window.PaystackPop!.setup({
        key: init.clePublique,
        email: init.email,
        amount: init.montantMineur,
        currency: init.devise,
        ref: init.reference,
        channels: init.canaux,
        callback: (resp: { reference: string }) => {
          requete(`/facturation/paystack/verifier/${encodeURIComponent(resp.reference)}`)
            .then(() => {
              pousser({ ton: 'ok', titre: 'Paiement confirmé', detail: 'La facture est réglée.' })
              onSuccess()
            })
            .catch(() =>
              pousser({
                ton: 'err',
                titre: 'Paiement reçu, vérification en cours',
                detail: 'Rechargez dans quelques secondes si la facture ne se met pas à jour.',
              }),
            )
        },
        onClose: () => setEnCours(false),
      }).openIframe()
    } catch {
      pousser({ ton: 'err', titre: 'Impossible d’initier le paiement Paystack' })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Button size="sm" variant="secondary" iconBefore={<CreditCard size={13} />} onClick={payer} disabled={enCours}>
      Payer (carte / mobile money)
    </Button>
  )
}

/**
 * Version promesse du prépaiement, pour les formulaires à une étape (`BoutonFormulaire`)
 * où il n'y a pas de deuxième écran pour poser un bouton dédié : l'appel s'insère
 * directement dans `appel: async () => { await payerAvantDeCreer(...); return creerRessource(...) }`.
 * Rejette si le popup est fermé sans payer — `useOperation()` affiche alors l'échec au lieu
 * de créer une ressource jamais payée.
 */
export function payerAvantDeCreer(montant: number): Promise<void> {
  return new Promise((resolve, reject) => {
    requete<InitiationPaystack>('/facturation/paystack/prepayer', {
      methode: 'POST',
      corps: { montant },
    })
      .then(async (init) => {
        if (!init.clePublique) {
          reject(new Error('Paystack non configuré (PAYSTACK_PUBLIC_KEY absente côté serveur).'))
          return
        }
        await chargerPaystack()
        let ferme_sans_payer = true
        window.PaystackPop!.setup({
          key: init.clePublique,
          email: init.email,
          amount: init.montantMineur,
          currency: init.devise,
          ref: init.reference,
          channels: init.canaux,
          callback: (resp: { reference: string }) => {
            ferme_sans_payer = false
            requete(`/facturation/paystack/verifier/${encodeURIComponent(resp.reference)}`)
              .then(() => resolve())
              .catch(() => reject(new Error('Paiement reçu mais non confirmé — réessayez.')))
          },
          onClose: () => {
            if (ferme_sans_payer) reject(new Error('Paiement annulé.'))
          },
        }).openIframe()
      })
      .catch(() => reject(new Error('Impossible d’initier le paiement Paystack.')))
  })
}

/**
 * Bouton « Payer maintenant » pour un achat qui n'a pas encore de facture — souscription
 * d'un Espace Cloud, enregistrement d'un domaine — donc pas de `factureId` à référencer
 * (voir `/paystack/prepayer` côté backend). Le paiement doit réussir avant que
 * `onSuccess` ne déclenche la création réelle de la ressource : c'est l'appelant qui
 * décide de ne créer qu'après confirmation, ce composant ne fait qu'attester le paiement.
 */
export function BoutonPrepaiementPaystack({
  montant,
  libelle,
  onSuccess,
}: {
  montant: number
  libelle: string
  onSuccess: () => void
}) {
  const { pousser } = useApp()
  const [enCours, setEnCours] = useState(false)
  const [paye, setPaye] = useState(false)

  const payer = async () => {
    setEnCours(true)
    try {
      const init = await requete<InitiationPaystack>('/facturation/paystack/prepayer', {
        methode: 'POST',
        corps: { montant },
      })
      if (!init.clePublique) {
        pousser({
          ton: 'err',
          titre: 'Paystack non configuré',
          detail: 'Aucune clé publique côté serveur (PAYSTACK_PUBLIC_KEY).',
        })
        return
      }
      await chargerPaystack()
      window.PaystackPop!.setup({
        key: init.clePublique,
        email: init.email,
        amount: init.montantMineur,
        currency: init.devise,
        ref: init.reference,
        channels: init.canaux,
        callback: (resp: { reference: string }) => {
          requete(`/facturation/paystack/verifier/${encodeURIComponent(resp.reference)}`)
            .then(() => {
              setPaye(true)
              pousser({ ton: 'ok', titre: 'Paiement confirmé', detail: libelle })
              onSuccess()
            })
            .catch(() =>
              pousser({
                ton: 'err',
                titre: 'Paiement reçu, vérification en cours',
                detail: 'Réessayez dans quelques secondes si rien ne se passe.',
              }),
            )
        },
        onClose: () => setEnCours(false),
      }).openIframe()
    } catch {
      pousser({ ton: 'err', titre: 'Impossible d’initier le paiement Paystack' })
    } finally {
      setEnCours(false)
    }
  }

  if (paye) {
    return (
      <Button size="md" variant="primary" iconBefore={<CreditCard size={14} />} disabled>
        Payé — {libelle}
      </Button>
    )
  }

  return (
    <Button size="md" variant="primary" iconBefore={<CreditCard size={14} />} onClick={payer} disabled={enCours}>
      Payer maintenant (carte / mobile money)
    </Button>
  )
}
