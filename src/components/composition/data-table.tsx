'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download } from 'lucide-react'
import { telechargerCsv } from '@/lib/export'
import { cn } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/button'
import { SearchInput, SegmentedControl, Select } from '@/components/ui/field'
import { Pagination } from '@/components/ui/display'
import { Popover } from '@/components/ui/overlay'
import { EmptyState, SkeletonTable } from './states'

export interface Colonne<T> {
  id: string
  entete: string
  rendu: (ligne: T) => ReactNode
  /** Valeur de tri et de recherche textuelle. */
  cle?: (ligne: T) => string | number
  aligne?: 'left' | 'right' | 'center'
  largeur?: string
  /** Masquable depuis le sélecteur de colonnes. */
  masquable?: boolean
  masqueeParDefaut?: boolean
}

export interface FiltreTable {
  id: string
  libelle: string
  options: Array<{ value: string; label: string }>
}

/**
 * Tableau de données : tri, filtres, sélection multiple, actions groupées,
 * colonnes masquables, densité, état vide, état chargement (§1.4).
 */
export function DataTable<T extends { id: string }>({
  lignes,
  colonnes,
  recherche = true,
  placeholderRecherche = 'Rechercher…',
  filtres,
  selection,
  actionsGroupees,
  parPage = 12,
  chargement,
  vide,
  href,
  densiteInitiale = 'confortable',
  exportable,
  nomExport,
  className,
}: {
  lignes: T[]
  colonnes: Array<Colonne<T>>
  recherche?: boolean
  placeholderRecherche?: string
  filtres?: FiltreTable[]
  /** Prédicat appliqué pour chaque filtre actif. */
  selection?: (ligne: T, filtreId: string, valeur: string) => boolean
  actionsGroupees?: (ids: string[]) => ReactNode
  parPage?: number
  chargement?: boolean
  vide?: { titre: string; phrase: string; action?: { libelle: string; href?: string; onClick?: () => void } }
  /**
   * Lien de la ligne. La première colonne visible est alors enveloppée dans un
   * `<a>` : son `rendu` ne doit pas contenir de lien à son tour, deux ancres
   * imbriquées étant du HTML invalide que React refuse d'hydrater.
   */
  href?: (ligne: T) => string
  densiteInitiale?: 'compacte' | 'confortable'
  exportable?: boolean
  /** Nom du fichier produit par l'export, sans extension. */
  nomExport?: string
  className?: string
}) {
  const [q, setQ] = useState('')
  const [tri, setTri] = useState<{ id: string; sens: 'asc' | 'desc' } | null>(null)
  const [page, setPage] = useState(1)
  const [coches, setCoches] = useState<string[]>([])
  const [densite, setDensite] = useState(densiteInitiale)
  const [filtresActifs, setFiltresActifs] = useState<Record<string, string>>({})
  const [masquees, setMasquees] = useState<string[]>(
    colonnes.filter((c) => c.masqueeParDefaut).map((c) => c.id),
  )

  const visibles = colonnes.filter((c) => !masquees.includes(c.id))

  const filtrees = useMemo(() => {
    let out = lignes
    for (const [fid, val] of Object.entries(filtresActifs)) {
      if (!val || val === 'tous' || !selection) continue
      out = out.filter((l) => selection(l, fid, val))
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      out = out.filter((l) =>
        colonnes.some((c) => {
          const v = c.cle?.(l)
          return v !== undefined && String(v).toLowerCase().includes(needle)
        }),
      )
    }
    if (tri) {
      const col = colonnes.find((c) => c.id === tri.id)
      if (col?.cle) {
        out = [...out].sort((a, b) => {
          const va = col.cle!(a)
          const vb = col.cle!(b)
          const cmp =
            typeof va === 'number' && typeof vb === 'number'
              ? va - vb
              : String(va).localeCompare(String(vb), 'fr')
          return tri.sens === 'asc' ? cmp : -cmp
        })
      }
    }
    return out
  }, [lignes, colonnes, q, tri, filtresActifs, selection])

  const pagees = filtrees.slice((page - 1) * parPage, page * parPage)
  const cell = densite === 'compacte' ? 'px-3 py-1.5' : 'px-3 py-2.5'

  /**
   * Export réel des lignes filtrées et triées, telles qu'elles sont à l'écran.
   * Seules les colonnes qui déclarent une `cle` en sortent : le `rendu` est du
   * JSX, il n'a pas de représentation textuelle fiable.
   */
  const exporterCsv = () => {
    const colonnesExportables = visibles.filter((c) => c.cle)
    telechargerCsv(
      nomExport ?? 'export',
      colonnesExportables.map((c) => c.entete),
      filtrees.map((l) => colonnesExportables.map((c) => c.cle!(l))),
    )
  }

  if (chargement) return <SkeletonTable colonnes={visibles.length} />

  const barreOutils =
    recherche || filtres?.length || exportable || colonnes.some((c) => c.masquable) ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {recherche && (
            <SearchInput
              placeholder={placeholderRecherche}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className="w-full sm:w-64"
            />
          )}
          {filtres?.map((f) => (
            <Select
              key={f.id}
              aria-label={f.libelle}
              value={filtresActifs[f.id] ?? 'tous'}
              onChange={(e) => {
                setFiltresActifs((p) => ({ ...p, [f.id]: e.target.value }))
                setPage(1)
              }}
              className="w-auto min-w-36"
            >
              <option value="tous">{f.libelle} : tous</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            size="sm"
            value={densite}
            onChange={(v) => setDensite(v)}
            options={[
              { value: 'confortable', label: 'Confort' },
              { value: 'compacte', label: 'Compact' },
            ]}
          />
          {colonnes.some((c) => c.masquable) && (
            <Popover
              width="w-56"
              label="Choisir les colonnes affichées"
              trigger={() => (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-g-300 px-2.5 text-[12px] font-semibold text-g-700 hover:bg-g-050">
                  <Columns3 size={13} /> Colonnes
                </span>
              )}
            >
              <div className="p-2">
                {colonnes
                  .filter((c) => c.masquable)
                  .map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] hover:bg-g-050"
                    >
                      <input
                        type="checkbox"
                        checked={!masquees.includes(c.id)}
                        onChange={() =>
                          setMasquees((p) =>
                            p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id],
                          )
                        }
                        className="h-3.5 w-3.5 accent-[#4B2882]"
                      />
                      {c.entete}
                    </label>
                  ))}
              </div>
            </Popover>
          )}
          {exportable && (
            <IconButton
              label="Exporter en CSV"
              variant="secondary"
              size="sm"
              onClick={exporterCsv}
            >
              <Download size={13} />
            </IconButton>
          )}
        </div>
      </div>
    ) : null

  return (
    <div className={cn('space-y-3', className)}>
      {barreOutils}

      {actionsGroupees && coches.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-p-300 bg-p-050 px-3.5 py-2.5">
          <p className="tnum text-[13px] font-semibold text-p-700">
            {coches.length} élément{coches.length > 1 ? 's' : ''} sélectionné
            {coches.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {actionsGroupees(coches)}
            <Button variant="ghost" size="sm" onClick={() => setCoches([])}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {filtrees.length === 0 ? (
        <EmptyState
          titre={vide?.titre ?? 'Aucun résultat'}
          phrase={
            vide?.phrase ??
            'Aucune ligne ne correspond à votre recherche ou à vos filtres. Élargissez les critères pour retrouver vos ressources.'
          }
          action={vide?.action}
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-g-300 bg-white shadow-[0_1px_2px_rgba(43,27,77,.06)]">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-g-300 bg-g-050">
                {actionsGroupees && (
                  <th className="w-9 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={pagees.length > 0 && pagees.every((l) => coches.includes(l.id))}
                      onChange={(e) =>
                        setCoches(e.target.checked ? pagees.map((l) => l.id) : [])
                      }
                      className="h-3.5 w-3.5 accent-[#4B2882]"
                    />
                  </th>
                )}
                {visibles.map((c) => (
                  <th
                    key={c.id}
                    style={c.largeur ? { width: c.largeur } : undefined}
                    className={cn(
                      'type-micro whitespace-nowrap px-3 py-2 text-g-500',
                      c.aligne === 'right'
                        ? 'text-right'
                        : c.aligne === 'center'
                          ? 'text-center'
                          : 'text-left',
                    )}
                  >
                    {c.cle ? (
                      <button
                        type="button"
                        onClick={() =>
                          setTri((p) =>
                            p?.id === c.id
                              ? { id: c.id, sens: p.sens === 'asc' ? 'desc' : 'asc' }
                              : { id: c.id, sens: 'asc' },
                          )
                        }
                        className={cn(
                          // `uppercase` explicite : la feuille de style du navigateur pose
                          // `text-transform: none` sur un bouton, et rien ne la contredit —
                          // un en-tête triable perdait donc la casse de `type-micro`, si bien
                          // que « Plan » côtoyait « DESTINATIONS » dans la même ligne.
                          'inline-flex items-center gap-1 uppercase transition-colors hover:text-p-700',
                          c.aligne === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.entete}
                        {tri?.id === c.id ? (
                          tri.sens === 'asc' ? (
                            <ArrowUp size={11} />
                          ) : (
                            <ArrowDown size={11} />
                          )
                        ) : (
                          <ChevronsUpDown size={11} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.entete
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagees.map((l) => (
                <tr
                  key={l.id}
                  className={cn(
                    'border-b border-g-100 transition-colors last:border-0 hover:bg-p-050/60',
                    coches.includes(l.id) && 'bg-p-050',
                  )}
                >
                  {actionsGroupees && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Sélectionner la ligne"
                        checked={coches.includes(l.id)}
                        onChange={() =>
                          setCoches((p) =>
                            p.includes(l.id) ? p.filter((x) => x !== l.id) : [...p, l.id],
                          )
                        }
                        className="h-3.5 w-3.5 accent-[#4B2882]"
                      />
                    </td>
                  )}
                  {visibles.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        cell,
                        'text-[13px] text-ink align-middle',
                        c.aligne === 'right'
                          ? 'text-right tnum'
                          : c.aligne === 'center'
                            ? 'text-center'
                            : 'text-left',
                      )}
                    >
                      {href && c.id === visibles[0].id ? (
                        <a href={href(l)} className="block hover:text-p-700">
                          {c.rendu(l)}
                        </a>
                      ) : (
                        c.rendu(l)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtrees.length > parPage && (
        <Pagination page={page} total={filtrees.length} perPage={parPage} onChange={setPage} />
      )}
    </div>
  )
}
