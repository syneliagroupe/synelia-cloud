import { redirect } from 'next/navigation'

/** Ancienne entrée « Sites » — le portefeuille vit sous Domaines. */
export default function PageSitesRedirect() {
  redirect('/app/web/domaines')
}
