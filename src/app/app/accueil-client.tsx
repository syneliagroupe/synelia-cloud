'use client'

import { useApp } from '@/components/app/contexte'
import type { Role } from '@/lib/types'
import TableauDeBord from './tableau-de-bord'
import Lanceur from './lanceur/vue'

/** Profils qui voient le Lanceur en premier — parcours SMB / services managés (PLAN-UX §2). */
const ACCUEIL_LANCEUR: Role[] = ['service_admin']

export default function AccueilClient() {
  const { api, role } = useApp()
  if (api && ACCUEIL_LANCEUR.includes(role)) {
    return <Lanceur />
  }
  return <TableauDeBord />
}
