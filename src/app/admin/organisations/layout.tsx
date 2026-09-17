import type { Metadata } from 'next'
import { CadreOrganisations } from './cadre'

export const metadata: Metadata = {
  // La fiche `[id]/page.tsx` est un niveau plus bas : un titre simple ici ne
  // lui transmettrait pas le gabarit de `/admin/layout.tsx` (§ piège Next.js
  // — le gabarit ne se reprend que d'un parent direct), d'où ce gabarit
  // redéfini, identique à celui de l'espace super admin.
  title: {
    absolute: 'Organisations · Espace super admin Synelia Cloud',
    template: '%s · Espace super admin Synelia Cloud',
  },
  description:
    'Les organisations clientes de la plateforme : consommation, ressources, facturation, tickets et audit.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreOrganisations>{children}</CadreOrganisations>
}
