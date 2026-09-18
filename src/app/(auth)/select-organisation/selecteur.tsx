'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import { dateCourte } from '@/lib/format'
import { ROLE_LABEL, type Role } from '@/lib/types'
import { MES_ORGANISATIONS } from '@/lib/mock'
import { Avatar } from '@/components/ui/display'
import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/composition/card'
import {
  ecrireSession,
  estActif,
  lireSession,
  requete,
  type SessionApi,
} from '@/lib/api/client'

interface OrgVisible {
  id: string
  nom: string
  role: string
  meta?: string
  membreDepuis?: string
}

/**
 * Choix d’organisation : en mode API on liste les appartenances réelles de
 * la session et le clic change vraiment l’organisation active (session
 * réécrite + `PUT /moi/organisation-active`), au lieu d’ouvrir `/app` en
 * ignorant le choix. En mode maquette on garde la liste fictive.
 */
export function SelecteurOrganisation() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgVisible[] | null>(null)
  const [bascule, setBascule] = useState<string | null>(null)

  useEffect(() => {
    if (!estActif()) {
      setOrgs(
        MES_ORGANISATIONS.map(({ org, role }) => ({
          id: org.id,
          nom: org.nom,
          role,
          meta: org.secteur ?? org.pays,
          membreDepuis: org.createdAt,
        })),
      )
      return
    }
    const session = lireSession()
    if (!session?.organisations?.length) {
      router.replace('/login')
      return
    }
    setOrgs(
      session.organisations.map((o) => ({ id: o.orgId, nom: o.nom, role: o.role })),
    )
  }, [router])

  const choisir = async (id: string, role: string) => {
    const session = lireSession()
    if (!session || session.organisationActive === id) {
      router.push('/app')
      return
    }
    setBascule(id)
    const prochaine: SessionApi = { ...session, organisationActive: id, roleActif: role }
    ecrireSession(prochaine)
    try {
      const neuve = await requete<SessionApi>('/moi/organisation-active', {
        methode: 'PUT',
        corps: { orgId: id },
      })
      ecrireSession(neuve)
    } catch {
      // L’en-tête `X-Organisation-Id` suffit pour les lectures : le backend
      // mémorisera l’organisation au prochain appel qui passe.
    }
    router.push('/app')
  }

  if (!orgs) return null

  return (
    <>
      <p className="mt-2 text-[14px] leading-relaxed text-g-500">
        {orgs.length > 1
          ? `Vous appartenez à ${orgs.length} organisations. Votre rôle et donc vos droits diffèrent selon celle que vous ouvrez.`
          : 'Votre rôle et donc vos droits dépendent de l’organisation que vous ouvrez.'}
      </p>

      <div className="mt-6 space-y-2.5">
        {orgs.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => choisir(o.id, o.role)}
            disabled={bascule !== null}
            className="group flex w-full items-center gap-4 rounded-[10px] border border-g-300 bg-white p-4 text-left transition-all hover:border-p-400 hover:shadow-[0_4px_16px_rgba(43,27,77,.1)] disabled:opacity-60"
          >
            <Avatar nom={o.nom} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-ink group-hover:text-p-700">
                {o.nom}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge tone="violet" size="sm">
                  {ROLE_LABEL[o.role as Role] ?? o.role}
                </Badge>
                {o.meta && <span className="text-[12px] text-g-500">{o.meta}</span>}
              </div>
              {o.membreDepuis && (
                <p className="mt-1 text-[11px] text-g-500">
                  Membre depuis {dateCourte(o.membreDepuis)}
                </p>
              )}
            </div>
            <ArrowRight
              size={16}
              className="shrink-0 text-g-300 transition-all group-hover:translate-x-0.5 group-hover:text-p-700"
            />
          </button>
        ))}

        <Link
          href="/signup/organisation"
          className="group flex items-center gap-4 rounded-[10px] border border-dashed border-g-300 bg-g-050 p-4 transition-colors hover:border-p-400 hover:bg-p-050"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-p-700 ring-1 ring-g-300">
            <Plus size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-ink group-hover:text-p-700">
              Créer une nouvelle organisation
            </p>
            <p className="mt-0.5 text-[12px] text-g-500">
              Vous en deviendrez Org Admin, avec sa propre facturation et ses propres Espaces Cloud.
            </p>
          </div>
        </Link>
      </div>

      <Callout ton="info" titre="Basculer plus tard" className="mt-6">
        Vous pourrez changer d’organisation à tout moment depuis le sélecteur de la barre supérieure,
        sans vous reconnecter. Votre rôle est recalculé à chaque bascule.
      </Callout>
    </>
  )
}
