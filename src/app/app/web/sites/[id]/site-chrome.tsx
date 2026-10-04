'use client'

import { usePathname } from 'next/navigation'
import { LinkTabs } from '@/components/ui/display'
import { hrefSite } from '@/lib/web/entrees'

export function SiteChrome({ siteId, children }: { siteId: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const base = hrefSite(siteId)
  const onglets = [
    { href: base, label: 'Vue d’ensemble' },
    { href: hrefSite(siteId, '/applications'), label: 'Applications' },
    { href: hrefSite(siteId, '/bases'), label: 'Bases' },
    { href: hrefSite(siteId, '/serveur'), label: 'Serveur' },
    { href: hrefSite(siteId, '/dns'), label: 'Zone DNS' },
  ]
  const actif =
    onglets
      .slice()
      .reverse()
      .find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? base

  return (
    <div className="space-y-5">
      <LinkTabs tabs={onglets} active={actif} />
      {children}
    </div>
  )
}
