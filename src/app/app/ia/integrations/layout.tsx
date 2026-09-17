import type { Metadata } from 'next'
import { CadreIntegrations } from './cadre'

export const metadata: Metadata = {
  title: {
    absolute: 'Intégrations · Espace client Synelia Cloud',
    template: '%s · Espace client Synelia Cloud',
  },
  description:
    'Canaux par où les gens atteignent un agent — WhatsApp, SMS, voix, SIP, REST — et outils qu’un agent peut appeler.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CadreIntegrations>{children}</CadreIntegrations>
}
