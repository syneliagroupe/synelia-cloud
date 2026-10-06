'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { BoutonAction, BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, estActif, requete } from '@/lib/api/client'

interface CleSsh {
  id: string
  nom: string
  publique: string
  empreinte: string
  type?: string
  ajouteeLe?: string
}

/** Clés publiques du compte : la plateforme les injecte dans le cloud-init de chaque VM créée. */
export function ClesSshCompte() {
  const [cles, setCles] = useState<CleSsh[] | null>(null)
  const recharger = useCallback(() => {
    requete<CleSsh[]>('/moi/cles-ssh').then(setCles, () => setCles([]))
  }, [])
  useEffect(() => {
    if (estActif()) recharger()
  }, [recharger])

  if (!estActif()) {
    return (
      <Callout ton="info" titre="Clés SSH du compte">
        Disponibles quand le portail est branché sur l’API : les clés sont enregistrées sur votre compte.
      </Callout>
    )
  }

  return (
    <Card>
      <CardHeader
        titre="Clés SSH du compte"
        sousTitre="Chaque nouvelle machine reçoit ces clés pour la connexion, via le cloud-init de la plateforme. Vous pouvez le désactiver à la création."
        actions={
          <BoutonFormulaire
            libelle="Ajouter une clé"
            icone={<KeyRound size={13} />}
            titre="Ajouter une clé SSH"
            libelleValider="Ajouter"
            champs={[
              { id: 'nom', label: 'Nom', obligatoire: true, placeholder: 'portable-jean' },
              {
                id: 'publique',
                label: 'Clé publique',
                type: 'mono',
                obligatoire: true,
                placeholder: 'ssh-ed25519 AAAA… commentaire',
                hint: 'Contenu de ~/.ssh/id_ed25519.pub — jamais la clé privée.',
              },
            ]}
            operation={(v) => ({
              titre: `Clé « ${String(v.nom)} » ajoutée`,
              audit: false,
              appel: () => creerRessource('/moi/cles-ssh', { nom: String(v.nom), publique: String(v.publique) }),
              effetFinal: recharger,
            })}
          />
        }
      />
      {cles && cles.length === 0 && (
        <p className="px-1 py-6 text-center text-[12.5px] text-g-500">
          Aucune clé. Sans clé, une machine créée n’a aucun accès SSH par clé — sauf si votre cloud-init en ajoute.
        </p>
      )}
      <ul className="divide-y divide-g-100">
        {(cles ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">
                {c.nom} {c.type && <Badge size="sm">{c.type}</Badge>}
              </p>
              <p className="tnum truncate font-mono text-[11.5px] text-g-500">{c.empreinte}</p>
            </div>
            <BoutonAction
              libelle={<Trash2 size={13} />}
              nomAccessible={`Retirer la clé ${c.nom}`}
              variant="ghost"
              operation={{
                titre: `Clé « ${c.nom} » retirée`,
                detail: 'Les machines déjà créées la conservent ; seules les prochaines ne la recevront plus.',
                audit: false,
                appel: () => requete<void>(`/moi/cles-ssh/${encodeURIComponent(c.id)}`, { methode: 'DELETE' }),
                effetFinal: recharger,
              }}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}
