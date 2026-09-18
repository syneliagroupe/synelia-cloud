import type { Metadata } from 'next'
import { InvitationMaquette } from './invitation-maquette'
import { InvitationReelle } from './invitation-reelle'

export const metadata: Metadata = { title: 'Invitation à rejoindre une organisation' }

// Même bascule que `/login` : l’invitation lue est réelle quand l’API est
// configurée, fictive sinon — jamais l’inverse.
const API_ACTIVE = !!process.env.NEXT_PUBLIC_API_URL

export default async function PageInvitation({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return API_ACTIVE ? <InvitationReelle token={token} /> : <InvitationMaquette token={token} />
}
