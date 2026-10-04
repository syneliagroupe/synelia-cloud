import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Montserrat, Open_Sans } from 'next/font/google'
import './globals.css'
import { LIEUX_HEBERGEMENT, SITES } from '@/lib/types'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  weight: ['400', '600', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Synelia Cloud — Infrastructure cloud souveraine en Côte d’Ivoire',
    template: '%s · Synelia Cloud',
  },
  description:
    'Espaces Cloud, machines virtuelles, Kubernetes managé, sauvegarde immuable, plan de reprise et solutions open source opérées par Synelia. ' +
    (SITES.length > 1 ? 'Deux sites en Côte d’Ivoire : Abidjan et Grand-Bassam.' : 'Hébergé à Abidjan, en Côte d’Ivoire.'),
  applicationName: 'Synelia Cloud',
  authors: [{ name: 'Synelia Group Afrique', url: 'https://synelia.tech' }],
  keywords: [
    'cloud souverain',
    "Côte d'Ivoire",
    'Abidjan',
    'Kubernetes managé',
    'sauvegarde immuable',
    'PRA',
    'Nextcloud',
    'marketplace open source',
  ],
  /*
   * Sans `metadataBase`, Next émet une URL relative pour l'aperçu et la
   * plupart des robots la rejettent : le lien partagé restait sans vignette.
   *
   * L'URL suit le déploiement plutôt que d'être figée : le domaine définitif
   * n'est pas encore rattaché, et une vignette codée en dur sur
   * `cloud.synelia.tech` renverrait vers un domaine qui ne sert pas ce build —
   * donc un aperçu vide sur les liens de démonstration.
   */
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://cloud.synelia.tech',
  ),
  openGraph: {
    title: 'Synelia Cloud — Infrastructure cloud souveraine en Côte d’Ivoire',
    description:
      'Une plateforme de gestion de cloud multi-tenant : infrastructure, applications et solutions open source opérées, hébergées à ' + LIEUX_HEBERGEMENT + '.',
    type: 'website',
    locale: 'fr_CI',
    siteName: 'Synelia Cloud',
    // En JPEG, pas en WebP : tous les robots d'indexation ne le décodent pas.
    images: [
      {
        url: '/photos/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Allée froide d’une salle serveurs, aux voyants violets.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Synelia Cloud — Infrastructure cloud souveraine en Côte d’Ivoire',
    description:
      'Infrastructure, applications et solutions open source opérées, hébergées à ' + LIEUX_HEBERGEMENT + '.',
    images: ['/photos/og.jpg'],
  },
}

export const viewport: Viewport = {
  themeColor: '#4B2882',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${montserrat.variable} ${openSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
