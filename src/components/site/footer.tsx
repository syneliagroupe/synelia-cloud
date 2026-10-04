import Link from 'next/link'
import { Globe } from 'lucide-react'
import { SITES } from '@/lib/types'
import { estActif } from '@/lib/api/client'
import { Logo } from '@/components/brand/logo'

const COLONNES = [
  {
    titre: 'Produits',
    liens: [
      { nom: 'Espace Cloud (VDC)', href: '/offres/espace-cloud' },
      { nom: 'Machines virtuelles', href: '/offres/machines-virtuelles' },
      { nom: 'Kubernetes managé', href: '/offres/kubernetes' },
      { nom: 'Load balancer', href: '/offres/load-balancer' },
      { nom: 'Stockage objet S3', href: '/offres/stockage-objet' },
      { nom: 'Cloud Backup', href: '/offres/cloud-backup' },
      { nom: 'PRA / DRaaS', href: '/offres/pra' },
      { nom: 'WordPress managé', href: '/offres/wordpress' },
    ],
  },
  {
    titre: 'Marketplace',
    liens: [
      { nom: 'Tout le catalogue', href: '/marketplace' },
      { nom: 'Drive Pro', href: '/marketplace/drive-pro' },
      { nom: 'Email Pro', href: '/marketplace/email-pro' },
      { nom: 'Visio & Chat', href: '/marketplace/visio' },
      { nom: 'GED', href: '/marketplace/ged' },
      { nom: 'ERP', href: '/marketplace/erp' },
      { nom: 'CRM', href: '/marketplace/crm' },
      { nom: 'Forge logicielle', href: '/marketplace/forge' },
    ],
  },
  {
    titre: 'Société',
    liens: [
      ...(estActif()
        ? []
        : [
            { nom: 'Notre histoire', href: '/histoire' },
            { nom: 'L’équipe', href: '/equipe' },
            { nom: 'Témoignages', href: '/temoignages' },
            { nom: 'Écosystème', href: '/communaute' },
          ]),
      { nom: 'Entreprises', href: '/entreprises' },
      { nom: 'Souveraineté', href: '/souverainete' },
      { nom: 'Datacenters', href: '/datacenters' },
    ],
  },
  {
    titre: 'Ressources',
    liens: [
      ...(estActif() ? [] : [{ nom: 'Livres blancs & guides', href: '/ressources' }]),
      { nom: 'Documentation', href: '/docs' },
      { nom: 'État des services', href: '/statut' },
      { nom: 'Tarifs', href: '/tarifs' },
      { nom: 'Simulateur', href: '/simulateur' },
      { nom: 'Espace client', href: '/app' },
      // L'espace d'administration n'est pas une page publique : lien réservé à la démonstration.
      ...(estActif() ? [] : [{ nom: 'Espace super admin', href: '/admin' }]),
    ],
  },
  {
    titre: 'Légal',
    liens: [
      { nom: 'Mentions légales', href: '/legal/mentions-legales' },
      { nom: 'Conditions générales', href: '/legal/cgv' },
      { nom: 'Confidentialité', href: '/legal/confidentialite' },
      { nom: 'Annexe SLA', href: '/legal/sla' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-g-300 bg-creme-2">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-g-500">
              Plateforme de gestion de cloud multi-tenant opérée par Synelia Group Afrique.{' '}
              {SITES.length > 1 ? 'Deux sites en Côte d’Ivoire' : 'Un site en Côte d’Ivoire'}, une équipe à
              Abidjan, une supervision 24/7.
            </p>
            <p className="mt-3 text-[12px] text-g-500">
              <a href="mailto:avs@synelia.tech" className="font-semibold text-p-700 hover:underline">
                avs@synelia.tech
              </a>
              {' · '}
              <a
                href="https://synelia.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-p-700"
              >
                synelia.tech
              </a>
            </p>
          </div>

          {COLONNES.map((c) => (
            <div key={c.titre}>
              <p className="type-micro mb-3 text-g-500">{c.titre}</p>
              <ul className="space-y-1.5">
                {c.liens.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-g-700 transition-colors hover:text-p-700"
                    >
                      {l.nom}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-g-300 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-g-500">
            © 2026 Synelia Group Afrique · Cocody, Abidjan, Côte d’Ivoire · Données hébergées à{' '}
            {SITES.length > 1 ? 'Abidjan (Synertech Vallon) et Grand-Bassam (VITIB)' : 'Abidjan'} · TVA 18 % · Prix en FCFA (XOF)
            <br />
            <span className="text-g-500">
              {SITES.length > 1
                ? 'Maquette de démonstration — organisations, ressources, factures et incidents entièrement fictifs.'
                : 'Prix, site et état des services : données en direct de la plateforme.'}
            </span>
          </p>
          {/* Une seule langue : un sélecteur qui proposerait « English » sans rien traduire serait inerte. */}
          <div className="flex shrink-0 items-center gap-2 rounded-[6px] border border-g-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-g-700">
            <Globe size={13} className="text-g-500" />
            Français
          </div>
        </div>
      </div>
    </footer>
  )
}
