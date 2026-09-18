'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, ShieldX } from 'lucide-react'
import { dateCourte } from '@/lib/format'
import { ROLE_LABEL, type Role } from '@/lib/types'
import { Avatar } from '@/components/ui/display'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Callout } from '@/components/composition/card'
import { ErrorState } from '@/components/composition/states'
import { Spinner } from '@/components/ui/display'
import { ApiError, ecrireSession, requete, type SessionApi } from '@/lib/api/client'

interface InvitationDistante {
  id: string
  email: string
  orgId: string
  orgNom: string | null
  role: string
  scopeType: string
  scopeId: string | null
  invitePar: string | null
  expire: string
  statut: 'en_attente' | 'acceptee' | 'expiree' | 'revoquee'
}

/**
 * Invitation réelle (`GET /auth/invitations/{jeton}` puis `POST`) : l’écran
 * reflète le jeton de l’URL — inconnue, expirée ou déjà utilisée — et
 * accepter ouvre une vraie session vers `/app`.
 */
export function InvitationReelle({ token }: { token: string }) {
  const router = useRouter()
  const [invitation, setInvitation] = useState<InvitationDistante | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [nom, setNom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<{ message: string; reference?: string } | null>(null)
  const [ignoree, setIgnoree] = useState(false)

  useEffect(() => {
    requete<InvitationDistante>(`/auth/invitations/${encodeURIComponent(token)}`)
      .then(setInvitation)
      .catch((e) => {
        if (e instanceof ApiError && e.statut === 404) setIntrouvable(true)
        else
          setErreur({
            message: 'Le backend ne répond pas. Vérifiez votre connexion puis réessayez.',
          })
      })
  }, [token])

  const accepter = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setChargement(true)
    setErreur(null)
    try {
      const session = await requete<SessionApi>(`/auth/invitations/${encodeURIComponent(token)}`, {
        methode: 'POST',
        corps: {
          ...(nom.trim() ? { nom: nom.trim() } : {}),
          ...(motDePasse ? { motDePasse } : {}),
        },
      })
      ecrireSession(session)
      router.push('/app')
    } catch (e) {
      setErreur(
        e instanceof ApiError
          ? { message: e.message, reference: e.correlationId }
          : { message: 'Le backend ne répond pas. Vérifiez votre connexion puis réessayez.' },
      )
    } finally {
      setChargement(false)
    }
  }

  if (introuvable) {
    return (
      <ErrorState
        titre="Invitation introuvable"
        cause="Ce lien ne correspond à aucune invitation : il a peut-être été révoqué, ou l’adresse est incomplète."
        reprise="Demandez à votre administrateur de vous renvoyer une invitation, ou connectez-vous si vous avez déjà un compte."
        seed={`invitation-${token.slice(0, 8)}`}
      />
    )
  }

  if (erreur && !invitation) {
    return (
      <div className="space-y-6">
        <h1 className="type-h1">Invitation à rejoindre une organisation</h1>
        <p role="alert" className="text-[12.5px] font-medium text-err">
          {erreur.message}
        </p>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="flex items-center gap-3 py-10">
        <Spinner size={20} />
        <p className="text-[13px] text-g-500">Chargement de l’invitation…</p>
      </div>
    )
  }

  if (invitation.statut !== 'en_attente') {
    const titre =
      invitation.statut === 'acceptee' ? 'Invitation déjà acceptée' : 'Invitation expirée'
    return (
      <ErrorState
        titre={titre}
        cause={
          invitation.statut === 'acceptee'
            ? 'Cette invitation a déjà été utilisée. Connectez-vous pour retrouver l’organisation.'
            : `Cette invitation a expiré le ${dateCourte(invitation.expire)}. Demandez à votre administrateur de la renvoyer.`
        }
        reprise="Si vous avez déjà un compte, la connexion suffit : vos organisations vous y attendent."
        seed={`invitation-${invitation.statut}`}
      />
    )
  }

  if (ignoree) {
    return (
      <Callout ton="info" titre="Invitation ignorée">
        <span className="inline-flex items-start gap-1.5">
          <ShieldX size={13} className="mt-0.5 shrink-0" />
          <span>
            Aucun accès n’a été créé et rien n’a été journalisé à votre nom. Le lien reste utilisable
            tant que {invitation.orgNom ?? 'l’organisation'} ne le révoque pas — vous pourrez
            accepter plus tard.
          </span>
        </span>
      </Callout>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar nom={invitation.orgNom ?? invitation.email} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold leading-snug [font-family:var(--font-display)] text-ink">
            Rejoignez <span className="text-p-700">{invitation.orgNom ?? 'cette organisation'}</span>{' '}
            en tant que{' '}
            <span className="text-m-600">
              {ROLE_LABEL[invitation.role as Role] ?? invitation.role}
            </span>
          </h1>
          <p className="mt-1 text-[12px] text-g-500">
            Invitation adressée à {invitation.email}
            {invitation.invitePar ? ` par ${invitation.invitePar}` : ''} · expire le{' '}
            {dateCourte(invitation.expire)}
          </p>
        </div>
      </div>

      <div className="rounded-[10px] border border-g-300 bg-white p-4">
        <MicroLabel>Portée de l’invitation</MicroLabel>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge tone="violet">{ROLE_LABEL[invitation.role as Role] ?? invitation.role}</Badge>
          <span className="text-g-500">sur</span>
          <Badge tone="neutral">
            {invitation.scopeType}
            {invitation.scopeId && (
              <>
                {' '}· <span className="font-mono">{invitation.scopeId}</span>
              </>
            )}
          </Badge>
        </div>
      </div>

      <form
        className="space-y-4 rounded-[10px] border border-g-300 bg-white p-5"
        onSubmit={accepter}
      >
        <Field
          label="Nom complet"
          hint="uniquement si vous n’avez pas encore de compte"
        >
          <Input
            autoComplete="name"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Awa Koffi"
          />
        </Field>
        <Field
          label="Mot de passe"
          hint="uniquement si vous n’avez pas encore de compte — 8 caractères minimum"
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="••••••••••"
          />
        </Field>
        {erreur && (
          <p role="alert" className="text-[12.5px] font-medium text-err">
            {erreur.message}
            {erreur.reference && (
              <span className="mt-1 block font-mono text-[11px] font-normal text-g-500">
                Référence {erreur.reference}
              </span>
            )}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={chargement}
            iconAfter={<ArrowRight size={15} />}
          >
            Accepter l’invitation
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => setIgnoree(true)}
          >
            Ignorer
          </Button>
        </div>
      </form>

      <p className="text-[12px] leading-relaxed text-g-500">
        L’acceptation de cette invitation est journalisée dans le journal d’audit de{' '}
        {invitation.orgNom ?? 'l’organisation'}, avec votre identité, l’horodatage et votre adresse
        IP.
      </p>

      <Callout ton="info" titre="Vous ne connaissez pas cette organisation ?">
        N’acceptez pas l’invitation. Signalez-la en réponse au message que vous avez reçu, ou depuis
        la{' '}
        <Link href="/statut" className="font-semibold text-p-700 hover:underline">
          page de contact
        </Link>
        .
      </Callout>
    </div>
  )
}
