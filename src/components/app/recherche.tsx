'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APPLICATIONS } from '@/lib/mock/paas'
import { ESPACES, VMS, K8S_CLUSTERS, LOAD_BALANCERS, BUCKETS } from '@/lib/mock/iaas'
import { SERVICES_PROJET, projetDeLApp } from '@/lib/mock/projets'
import { MODELES } from '@/lib/mock/modeles'
import { FACTURES, TICKETS_PLATEFORME } from '@/lib/mock/commerce'
import { ORGANISATIONS } from '@/lib/mock/orgs'
import { DOMAINES } from '@/lib/mock/web'
import { HEBERGEMENTS, SERVICES_PARTAGES, nomServi } from '@/lib/mock/hebergement'
import { BACKENDS } from '@/lib/mock/iaas'
import { estActif, requete } from '@/lib/api/client'
import type { Portee } from '@/lib/navigation'

interface Entree {
  id: string
  label: string
  categorie: string
  href: string
  meta?: string
}

function entreesClient(): Entree[] {
  return [
    ...ESPACES.map((e) => ({
      id: e.id,
      label: e.code,
      categorie: 'Espaces Cloud',
      href: `/app/espaces/${e.id}`,
      meta: `${e.offreNom} · ${e.site}`,
    })),
    ...VMS.map((v) => ({
      id: v.id,
      label: v.nom,
      categorie: 'Machines virtuelles',
      href: `/app/vms/${v.id}`,
      meta: `${v.os} · ${v.ips[0]?.adresse ?? ''}`,
    })),
    ...K8S_CLUSTERS.map((c) => ({
      id: c.id,
      label: c.nom,
      categorie: 'Kubernetes',
      href: `/app/kubernetes/${c.id}`,
      meta: `v${c.version}`,
    })),
    ...LOAD_BALANCERS.map((l) => ({
      id: l.id,
      label: l.nom,
      categorie: 'Load balancers',
      href: `/app/reseau/lb/${l.id}`,
      meta: `${l.layer.toUpperCase()} · ${l.vip}`,
    })),
    ...BUCKETS.map((b) => ({
      id: b.id,
      label: b.nom,
      categorie: 'Stockage objet',
      href: `/app/objet/${b.id}`,
      meta: b.region,
    })),
    ...SERVICES_PROJET.map((s) => ({
      id: s.id,
      label: s.nom,
      categorie: 'Services applicatifs',
      href: `/app/applications/projets/${s.projetId}/${s.id}`,
      meta: `${s.environnement} · ${s.emplacement.site}`,
    })),
    // Les modèles n'ont plus de fiche propre : ils se choisissent comme
    // source d'un service « Application », depuis un projet existant.
    ...MODELES.map((m) => ({
      id: m.slug,
      label: m.nom,
      categorie: 'Solutions à déployer',
      href: '/app/applications/projets',
      meta: `${m.solution} ${m.version}`,
    })),
    ...HEBERGEMENTS.map((h) => ({
      id: h.id,
      label: nomServi(h),
      categorie: 'Hébergements web',
      href: `/app/web/hebergement/${h.id}`,
      meta: `${h.serveur.nom} · ${h.palier}`,
    })),
    ...SERVICES_PARTAGES.map((sp) => ({
      id: sp.id,
      label: `${sp.nom} — ${sp.hote}`,
      categorie: 'Services partagés',
      href: `/app/web/${sp.hebergementId}`,
      meta: sp.solution,
    })),
    ...DOMAINES.map((d) => ({
      id: d.id,
      label: d.nom,
      categorie: 'Domaines',
      href: '/app/web',
      meta: `expire le ${d.expiration}`,
    })),
    ...FACTURES.map((f) => ({
      id: f.id,
      label: f.numero,
      categorie: 'Factures',
      href: '/app/facturation',
      meta: f.periode,
    })),
    ...TICKETS_PLATEFORME.filter((t) => t.orgId === 'org-dba').map((t) => ({
      id: t.id,
      label: `${t.numero} — ${t.sujet}`,
      categorie: 'Tickets',
      href: `/app/support/${t.id}`,
      meta: t.gravite,
    })),
  ]
}

function entreesSuperAdmin(): Entree[] {
  return [
    ...ORGANISATIONS.map((o) => ({
      id: o.id,
      label: o.nom,
      categorie: 'Organisations',
      href: `/admin/organisations/${o.id}`,
      meta: o.secteur,
    })),
    ...BACKENDS.map((b) => ({
      id: b.id,
      label: b.code,
      categorie: 'Backends',
      href: '/admin/capacite',
      meta: b.type,
    })),
    ...ESPACES.map((e) => ({
      id: e.id,
      label: e.code,
      categorie: 'Espaces Cloud',
      href: '/admin/capacite',
      meta: e.site,
    })),
    ...VMS.slice(0, 8).map((v) => ({
      id: v.id,
      label: v.nom,
      categorie: 'Machines virtuelles',
      href: `/app/vms/${v.id}`,
      meta: v.os,
    })),
    ...FACTURES.map((f) => ({
      id: f.id,
      label: f.numero,
      categorie: 'Factures',
      href: '/admin/facturation',
      meta: f.periode,
    })),
    ...TICKETS_PLATEFORME.map((t) => ({
      id: t.id,
      label: `${t.numero} — ${t.sujet}`,
      categorie: 'Tickets',
      href: '/admin/tickets',
      meta: t.gravite,
    })),
  ]
}

/** Recherche globale ⌘K (§1.6). */
export function RechercheGlobale({ portee = 'client' }: { portee?: Portee }) {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [q, setQ] = useState('')
  // En mode API la recherche part au backend, qui connaît les ressources
  // réelles (la maquette ne connaît que les siennes). À vide, on garde les
  // raccourcis locaux.
  const [distants, setDistants] = useState<Entree[] | null>(null)
  useEffect(() => {
    if (!estActif() || !ouvert || !q.trim()) {
      setDistants(null)
      return
    }
    let annule = false
    const minuteur = setTimeout(() => {
      requete<{ resultats?: Array<{ type: string; id: string; libelle: string; href: string; statut?: string }> }>(
        '/recherche',
        { query: { q: q.trim() } },
      ).then(
        (r) => {
          if (!annule)
            setDistants(
              (r.resultats ?? []).map((x) => ({
                id: x.id,
                label: x.libelle,
                categorie: x.type,
                href: x.href,
                meta: x.statut,
              })),
            )
        },
        () => {
          if (!annule) setDistants([])
        },
      )
    }, 250)
    return () => {
      annule = true
      clearTimeout(minuteur)
    }
  }, [q, ouvert])

  const entrees = useMemo(
    () => (portee === 'client' ? entreesClient() : entreesSuperAdmin()),
    [portee],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOuvert((v) => !v)
      }
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const resultats = useMemo(() => {
    if (distants) return distants.slice(0, 14)
    if (!q.trim()) return entrees.slice(0, 8)
    const needle = q.trim().toLowerCase()
    return entrees
      .filter(
        (e) =>
          e.label.toLowerCase().includes(needle) ||
          e.categorie.toLowerCase().includes(needle) ||
          (e.meta ?? '').toLowerCase().includes(needle),
      )
      .slice(0, 14)
  }, [q, entrees, distants])

  const groupes = useMemo(() => {
    const map = new Map<string, Entree[]>()
    for (const r of resultats) {
      const arr = map.get(r.categorie) ?? []
      arr.push(r)
      map.set(r.categorie, arr)
    }
    return Array.from(map.entries())
  }, [resultats])

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Rechercher (⌘K)"
        title="Rechercher — ⌘K"
        className={cn(
          // Bouton-loupe et non champ large : la barre supérieure porte déjà les
          // univers et le contexte. La palette s'ouvre au clic comme au ⌘K.
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] transition-colors',
          portee === 'client'
            ? 'text-p-300 hover:bg-white/10'
            : 'text-p-300 hover:bg-white/10',
        )}
      >
        <Search size={16} />
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <div
            className="fixed inset-0 bg-p-900/40 backdrop-blur-[2px]"
            onClick={() => setOuvert(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-[14px] bg-white shadow-[0_24px_64px_rgba(43,27,77,.24)]">
            <div className="flex items-center gap-2.5 border-b border-g-100 px-4 py-3">
              <Search size={15} className="shrink-0 text-g-500" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher…"
                className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-g-500"
              />
              <kbd className="shrink-0 rounded border border-g-300 bg-g-050 px-1.5 py-0.5 font-mono text-[11px] text-g-500">
                esc
              </kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto py-2">
              {groupes.length === 0 && (
                <p className="px-4 py-6 text-center text-[13px] text-g-500">
                  Aucun résultat pour « {q} ».
                </p>
              )}
              {groupes.map(([cat, items]) => (
                <div key={cat} className="mb-1">
                  <p className="type-micro px-4 py-1.5 text-g-500">{cat}</p>
                  {items.map((it) => (
                    <button
                      key={`${cat}-${it.id}`}
                      type="button"
                      onClick={() => {
                        setOuvert(false)
                        setQ('')
                        router.push(it.href)
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-p-050"
                    >
                      <span className="min-w-0 truncate text-[13px] text-ink">{it.label}</span>
                      {it.meta && (
                        <span className="shrink-0 truncate text-[12px] text-g-500">{it.meta}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
