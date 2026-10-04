'use client'

import { useEffect, useState } from 'react'
import { estActif, requete } from '@/lib/api/client'

export type ParametresEntreeWeb = {
  dnsEntreeA?: string | null
  dnsEntreeWildcardCname?: string | null
}

/** Repli build-time (docker / Vercel) quand l’API n’est pas joignable au SSR. */
export function dnsEntreeEnv(): ParametresEntreeWeb {
  return {
    dnsEntreeA: process.env.NEXT_PUBLIC_WEB_DNS_ENTREE_A ?? null,
    dnsEntreeWildcardCname: process.env.NEXT_PUBLIC_WEB_DNS_ENTREE_WILDCARD_CNAME ?? null,
  }
}

let cache: ParametresEntreeWeb | null | undefined

/** Valeurs plateforme pour pointer un DNS externe (alignées sur `SYNELIA_DOMAINE_DNS_*`). */
export async function lireParametresEntreeWeb(): Promise<ParametresEntreeWeb> {
  const repli = dnsEntreeEnv()
  if (!estActif()) {
    return {
      dnsEntreeA: repli.dnsEntreeA ?? '102.176.20.13',
      dnsEntreeWildcardCname: repli.dnsEntreeWildcardCname,
    }
  }
  if (cache !== undefined) return { ...repli, ...cache }
  try {
    cache = await requete<ParametresEntreeWeb>('/web/domaines/parametres-entree')
  } catch {
    cache = null
  }
  return {
    dnsEntreeA: cache?.dnsEntreeA ?? repli.dnsEntreeA ?? null,
    dnsEntreeWildcardCname: cache?.dnsEntreeWildcardCname ?? repli.dnsEntreeWildcardCname ?? null,
  }
}

/** Charge les paramètres une fois au montage (fiches domaine / éditeur DNS). */
export function useParametresEntreeWeb(): ParametresEntreeWeb {
  const [params, setParams] = useState<ParametresEntreeWeb>(() => dnsEntreeEnv())
  useEffect(() => {
    void lireParametresEntreeWeb().then(setParams)
  }, [])
  return params
}
