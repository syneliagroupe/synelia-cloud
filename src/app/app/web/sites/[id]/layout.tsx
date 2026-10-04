import { SiteChrome } from './site-chrome'

export default async function LayoutSiteDetail({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const siteId = decodeURIComponent(id)
  return <SiteChrome siteId={siteId}>{children}</SiteChrome>
}
