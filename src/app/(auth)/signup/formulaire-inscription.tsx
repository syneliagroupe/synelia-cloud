'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input } from '@/components/ui/field'
import { TVA_PCT } from '@/lib/format'
import { ApiError, ecrireSession, requete, type SessionApi } from '@/lib/api/client'

// Pays, secteur et TVA se règlent ensuite depuis les paramètres de l’organisation
// (cf. `/signup/organisation` en mode maquette) : à l’inscription, le nom suffit.
// `organisations.pays` est requis côté backend (varchar(2), code ISO) — "CI" par
// défaut, ajustable plus tard.
const PAYS_DEFAUT = 'CI'

/**
 * Inscription réelle (`POST /auth/inscription`) : un seul appel crée le
 * compte et, si `nomOrg` est renseigné, l’organisation dans la foulée — le
 * backend ne connaît pas d’étape « fournisseur d’identité » séparée.
 */
export function FormulaireInscriptionApi() {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [nomOrg, setNomOrg] = useState('')
  const [conditions, setConditions] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const complet =
    nom.trim().length >= 2 && email.trim().length > 0 && motDePasse.length >= 8 && conditions

  const inscrire = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    if (!complet) return
    setChargement(true)
    setErreur(null)
    try {
      const session = await requete<SessionApi>('/auth/inscription', {
        methode: 'POST',
        corps: {
          email,
          nom,
          motDePasse,
          accepteConditions: conditions,
          ...(nomOrg.trim() ? { organisation: { nom: nomOrg, pays: PAYS_DEFAUT } } : {}),
        },
      })
      ecrireSession(session)
      router.push('/app')
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
    <form className="space-y-4 rounded-[10px] border border-g-300 bg-white p-5" onSubmit={inscrire}>
      <div className="flex items-center gap-2">
        <User size={15} className="text-p-700" />
        <h2 className="type-h3">Votre identité</h2>
      </div>
      <Field label="Nom complet" required>
        <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Awa Koffi" autoFocus />
      </Field>
      <Field label="Adresse e-mail professionnelle" required>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@votre-organisation.ci"
        />
      </Field>
      <Field label="Mot de passe" required hint="8 caractères minimum">
        <Input
          type="password"
          autoComplete="new-password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          placeholder="••••••••••"
        />
      </Field>

      <div className="flex items-center gap-2 border-t border-g-100 pt-4">
        <Building2 size={15} className="text-p-700" />
        <h2 className="type-h3">Votre organisation</h2>
        <span className="text-[11.5px] font-normal text-g-500">— facultatif</span>
      </div>
      <Field label="Nom de l’organisation" hint="pays, secteur et TVA se règlent ensuite dans les paramètres">
        <Input
          value={nomOrg}
          onChange={(e) => setNomOrg(e.target.value)}
          placeholder="Digital Business Africa"
        />
      </Field>

      <div className="border-t border-g-100 pt-4">
        <Checkbox
          checked={conditions}
          onChange={(e) => setConditions(e.target.checked)}
          label="J’accepte les conditions générales de vente et la politique de confidentialité"
          description={`Montants hors taxes en FCFA, TVA ${TVA_PCT} % appliquée à la facturation. Aucun engagement en mensuel.`}
        />
      </div>

      {erreur && <p className="text-[12.5px] font-medium text-err">{erreur}</p>}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={chargement}
        disabled={!complet}
        iconAfter={<ArrowRight size={15} />}
      >
        Créer mon compte
      </Button>
    </form>
  )
}
