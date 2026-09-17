import type { Metadata } from 'next'
import { AppProvider, GardeAuth } from '@/components/app/contexte'
import { TopBar } from '@/components/app/topbar'
import { ToastHost } from '@/components/app/toasts'
import { ConteneurAdmin } from '@/components/app/conteneur'

export const metadata: Metadata = {
  // `default` ne s'applique plus qu'à /admin lui-même : chaque sous-segment
  // nomme son propre onglet, la page cliente racine ne pouvant pas le faire.
  title: { default: 'Vue plateforme · Espace super admin', template: '%s · Espace super admin Synelia Cloud' },
  description:
    'Pilotage de la plateforme : organisations clientes, capacité et backends, catalogue, marketplace, finance, audit et conformité.',
}

export default function EspaceSuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // `AppProvider` monte déjà l'atelier : un second fournisseur ici créerait
    // un état parallèle, invisible depuis les écrans montés au-dessus.
    <AppProvider roleInitial="super_admin">
      <GardeAuth />
      <div className="min-h-screen bg-white">
        <TopBar portee="super_admin" />
        <main className="bg-g-050">
          <ConteneurAdmin>{children}</ConteneurAdmin>
        </main>
        <ToastHost />
      </div>
    </AppProvider>
  )
}
