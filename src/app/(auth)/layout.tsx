import Link from 'next/link'
import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { INDICATEURS_HERO } from '@/lib/mock/vitrine'

export const metadata: Metadata = {
  title: { default: 'Connexion', template: '%s · Synelia Cloud' },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-[1fr_44%]">
      <div className="flex flex-col">
        <header className="flex h-[72px] shrink-0 items-center px-6">
          <Link href="/">
            <Logo />
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="shrink-0 border-t border-g-100 px-6 py-4">
          <p className="text-[12px] text-g-500">
            Synelia Group Afrique · Abidjan, Côte d’Ivoire ·{' '}
            <Link href="/legal/confidentialite" className="hover:text-p-700">
              Confidentialité
            </Link>
            {' · '}
            <Link href="/legal/cgv" className="hover:text-p-700">
              Conditions
            </Link>
          </p>
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-p-900 lg:block">
        <span className="absolute inset-0 bg-grid-light opacity-60" aria-hidden />
        <span
          className="absolute -right-32 top-1/4 h-80 w-80 rounded-full bg-m-600/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div>
            <p className="type-micro text-p-300">Connexion sécurisée</p>
            <h2 className="mt-3 max-w-sm text-[26px] font-bold leading-tight [font-family:var(--font-display)] text-white">
              Vos identifiants sont vérifiés par l’API, jamais stockés ici.
            </h2>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-p-300">
              Le mot de passe transite en HTTPS vers l’API Synelia Cloud, qui ne conserve qu’une
              empreinte chiffrée. La session ouverte est courte et renouvelée par jeton.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-[8px] border border-p-400/40 bg-white/5 px-3.5 py-2.5">
              <ShieldCheck size={16} className="shrink-0 text-p-300" />
              <p className="text-[12px] leading-snug text-white/85">
                MFA, politique de mot de passe et durée de session suivent les règles
                de votre organisation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {INDICATEURS_HERO.map((i) => (
              <div key={i.libelle}>
                <p className="tnum text-[19px] font-bold leading-none [font-family:var(--font-display)] text-white">
                  {i.valeur}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-p-300">{i.libelle}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
