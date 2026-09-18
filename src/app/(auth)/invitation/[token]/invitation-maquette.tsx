import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { dateCourte } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/types'
import { MATRICE_RBAC } from '@/lib/rbac'
import { Avatar } from '@/components/ui/display'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Callout } from '@/components/composition/card'
import { ActionsInvitation } from './actions'

/**
 * Parcours fictif de démonstration (aucune API configurée) : l’invitation
 * affichée est un exemple figé, quel que soit le jeton de l’URL.
 */
export function InvitationMaquette({ token }: { token: string }) {
  const invitation = {
    invitantNom: 'Léa Konan',
    invitantRole: 'espace_admin' as const,
    organisation: 'Digital Business Africa',
    role: 'project_owner' as const,
    porteeType: 'Application',
    porteeLabel: 'app-metier',
    expiration: '2026-08-26',
    envoyeeLe: '2026-08-19',
  }

  const autorisees = MATRICE_RBAC.filter((a) => a.perms[invitation.role] === 'full').slice(0, 6)
  const interdites = MATRICE_RBAC.filter((a) => a.perms[invitation.role] === 'none').slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar nom={invitation.invitantNom} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold leading-snug [font-family:var(--font-display)] text-ink">
            <span className="text-p-700">{invitation.invitantNom}</span> vous invite à rejoindre{' '}
            <span className="text-p-700">{invitation.organisation}</span> en tant que{' '}
            <span className="text-m-600">{ROLE_LABEL[invitation.role]}</span>
          </h1>
          <p className="mt-1 text-[12px] text-g-500">
            Invitation envoyée le {dateCourte(invitation.envoyeeLe)} par un{' '}
            {ROLE_LABEL[invitation.invitantRole]}
          </p>
        </div>
      </div>

      <div className="rounded-[10px] border border-g-300 bg-white p-4">
        <MicroLabel>Portée de l’invitation</MicroLabel>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge tone="violet">{ROLE_LABEL[invitation.role]}</Badge>
          <span className="text-g-500">sur</span>
          <Badge tone="neutral">
            {invitation.porteeType} · <span className="font-mono">{invitation.porteeLabel}</span>
          </Badge>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-g-700">
          Votre rôle s’applique à cette portée uniquement. Vous ne verrez ni les autres applications
          de l’organisation, ni sa facturation, ni son journal d’audit complet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[10px] border border-ok/25 bg-ok-bg p-4">
          <MicroLabel className="text-ok">Ce que vous pourrez faire</MicroLabel>
          <ul className="mt-2.5 space-y-1.5">
            {autorisees.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <Check size={13} className="mt-0.5 shrink-0 text-ok" />
                <span className="text-[13px] leading-snug text-g-700">{a.libelle}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[10px] border border-g-300 bg-g-050 p-4">
          <MicroLabel>Ce qui vous restera fermé</MicroLabel>
          <ul className="mt-2.5 space-y-1.5">
            {interdites.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <Minus size={13} className="mt-0.5 shrink-0 text-g-500" />
                <span className="text-[13px] leading-snug text-g-500">{a.libelle}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] leading-relaxed text-g-500">
            Ces actions resteront visibles mais désactivées, avec le rôle requis en infobulle. Rien
            n’est masqué : c’est ce qui rend le modèle de droits compréhensible.
          </p>
        </div>
      </div>

      <ActionsInvitation
        organisation={invitation.organisation}
        invitantNom={invitation.invitantNom}
      />

      <p className="text-[12px] leading-relaxed text-g-500">
        Démonstration locale : cette invitation est un exemple figé, accepter ou refuser ne crée ni
        ne journalise rien. Cette invitation expire le {dateCourte(invitation.expiration)}.
      </p>

      <Callout ton="info" titre="Vous ne connaissez pas cette organisation ?">
        N’acceptez pas l’invitation. Signalez-la en réponse au message que vous avez reçu, ou depuis
        la{' '}
        <Link href="/statut" className="font-semibold text-p-700 hover:underline">
          page de contact
        </Link>
        . Le jeton de cette invitation est{' '}
        <span className="font-mono text-[11px]">{token.slice(0, 12)}…</span>
      </Callout>
    </div>
  )
}
