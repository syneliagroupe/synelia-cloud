'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, money } from '@/lib/format'
import type { Projet, ServiceProjet } from '@/lib/types'
import { PROJETS, SERVICES_PROJET, ZONE_APPLICATIVE } from '@/lib/mock'
import {
  CATEGORIES_MODELES,
  CATEGORIE_MODELE_LABEL,
  MODELES,
  modeleBySlug,
  type CategorieModele,
  type ModeleApplicatif,
} from '@/lib/mock/modeles'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyField, GatedAction } from '@/components/ui/display'
import { Field, Input, SearchInput, Textarea } from '@/components/ui/field'
import { Card, CardHeader, PageHeader } from '@/components/composition/card'
import { CostPreview } from '@/components/composition/flow'
import { EmptyState } from '@/components/composition/states'
import { ProjetIntrouvable } from '@/components/business/projets'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

/**
 * Créer un service depuis un modèle du catalogue — troisième choix de
 * « Créer un service », sur le patron du « Template » de Dokploy : une page
 * dédiée avec recherche et filtre par catégorie, pas un simple menu déroulant
 * noyé dans un tiroir. Cliquer une carte mène directement à un petit
 * formulaire nom + description ; le modèle porte déjà sa configuration, ses
 * variables et son plan de sauvegarde par défaut (§5, §6.1).
 */
export function VueNouveauService({ projetId }: { projetId: string }) {
  const router = useRouter()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const { autorise, refus } = useApp()
  const executer = useOperation()

  const projet = lesProjets.items.find((p) => p.id === projetId)

  const [q, setQ] = useState('')
  const [categorie, setCategorie] = useState<CategorieModele | 'toutes'>('toutes')
  const [slug, setSlug] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')

  const resultats = useMemo(
    () =>
      MODELES.filter((m) => {
        if (categorie !== 'toutes' && m.categorie !== categorie) return false
        if (!q.trim()) return true
        const n = q.trim().toLowerCase()
        return (
          m.nom.toLowerCase().includes(n) ||
          m.solution.toLowerCase().includes(n) ||
          m.phrase.toLowerCase().includes(n)
        )
      }),
    [q, categorie],
  )

  if (!projet) return <ProjetIntrouvable section="Créer un service" />

  const env = projet.environnements[0]
  const modeleChoisi = slug ? modeleBySlug(slug) : undefined

  const choisir = (s: string) => {
    const m = modeleBySlug(s)!
    setSlug(s)
    setNom(m.sousDomaine)
    setDescription(m.phrase)
  }

  const creerService = () => {
    if (!modeleChoisi) return
    const idService = lesServices.identifiant('svc')
    const port = modeleChoisi.ports[0]?.conteneur ?? 80
    const nomFinal = nom.trim()

    executer({
      action: 'app.deploy',
      titre: `${modeleChoisi.nom} « ${nomFinal} » en création`,
      detail: `Instance ${modeleChoisi.solution} ${modeleChoisi.version}, provisionnée avec son plan de sauvegarde.`,
      appel: () =>
        creerRessource(`/projets/${encodeURIComponent(projet.id)}/services`, {
          nom: nomFinal,
          description: description.trim() || undefined,
          type: 'application',
          environnement: env,
          ressources: modeleChoisi.ressources,
          modeleSlug: modeleChoisi.slug,
          source: { type: 'image', ref: modeleChoisi.chart },
          portConteneur: port,
        }),
      effet: () =>
        lesServices.creer({
          id: idService,
          projetId: projet.id,
          nom: nomFinal,
          description: description.trim() || undefined,
          type: 'application',
          environnement: env,
          statut: 'building',
          ressources: modeleChoisi.ressources,
          emplacement: {
            site: 'ABJ',
            backend: 'os-abj-01',
            namespace: `${projet.id}-${env.toLowerCase()}`,
          },
          derniereMaj: MAINTENANT,
          coutMensuel: modeleChoisi.prixIndicatif,
          appId: nomFinal,
          modeleSlug: modeleChoisi.slug,
          source: { type: 'image', ref: modeleChoisi.chart },
          portConteneur: port,
        }),
      job: {
        type: 'service.application.create',
        label: `Création de ${nomFinal} · ${projet.nom} · ${env}`,
        etapes: [
          'Provisionner les ressources',
          'Injecter les variables du projet',
          'Démarrer le service',
          'Publier l’adresse offerte',
        ],
      },
      effetFinal: () => {
        if (estActif()) return
        lesServices.modifier(idService, { statut: 'running' })
      },
    })
    router.push(`/app/applications/projets/${projet.id}`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Applications', href: '/app/applications' },
          { label: 'Projets', href: '/app/applications/projets' },
          { label: projet.nom, href: `/app/applications/projets/${projet.id}` },
          { label: 'Créer un service' },
        ]}
        titre={modeleChoisi ? `Créer « ${modeleChoisi.nom} »` : 'Choisir un modèle applicatif'}
        sousTitre={
          modeleChoisi
            ? `${modeleChoisi.solution} ${modeleChoisi.version} · ${CATEGORIE_MODELE_LABEL[modeleChoisi.categorie]} — provisionné dans ${projet.nom} · ${env}.`
            : `Une instance dédiée, provisionnée dans ${projet.nom} · ${env}. Le portail provisionne, sauvegarde et met à jour ; la configuration métier se fait dans la solution elle-même.`
        }
        actions={
          modeleChoisi ? (
            <Button variant="ghost" iconBefore={<ArrowLeft size={14} />} onClick={() => setSlug(null)}>
              Changer de modèle
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => router.push(`/app/applications/projets/${projet.id}`)}>
              Annuler
            </Button>
          )
        }
      />

      {!modeleChoisi ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              placeholder="Rechercher un modèle ou une solution…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:w-72"
            />
            <p className="tnum text-[12.5px] text-g-500">
              {resultats.length} modèle{resultats.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <ChipCategorie
              label="Toutes les catégories"
              active={categorie === 'toutes'}
              compte={MODELES.length}
              onClick={() => setCategorie('toutes')}
            />
            {CATEGORIES_MODELES.map((c) => (
              <ChipCategorie
                key={c}
                label={CATEGORIE_MODELE_LABEL[c]}
                active={categorie === c}
                compte={MODELES.filter((m) => m.categorie === c).length}
                onClick={() => setCategorie(c)}
              />
            ))}
          </div>

          {resultats.length === 0 ? (
            <EmptyState
              titre="Aucun modèle ne correspond"
              phrase="Élargissez la recherche, ou choisissez une autre catégorie."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {resultats.map((m) => (
                <CarteModele key={m.slug} modele={m} onClick={() => choisir(m.slug)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader
                titre="Nom et description"
                sousTitre="Le reste — variables, sauvegarde, sièges — est déjà réglé par le modèle."
              />
              <div className="space-y-4">
                <Field
                  label="Nom du service"
                  required
                  hint="Sert de nom d’hôte interne et de préfixe d’adresse."
                >
                  <Input value={nom} onChange={(e) => setNom(e.target.value)} className="font-mono" />
                </Field>
                <Field label="Description" hint="Une phrase suffit.">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </Field>
              </div>
            </Card>

            <div className="rounded-[8px] border border-g-300 bg-g-050 p-3">
              <MicroLabel>Adresse attribuée automatiquement</MicroLabel>
              <CopyField
                value={`${nom.trim() || modeleChoisi.sousDomaine}-${env.toLowerCase().slice(0, 7)}.${ZONE_APPLICATIVE.zone}`}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader titre={modeleChoisi.nom} sousTitre={modeleChoisi.phrase} />
              <p className="text-[12.5px] leading-relaxed text-g-700">{modeleChoisi.description}</p>
              <p className="mt-3 text-[11px] leading-relaxed text-g-500">
                Ce que le portail ne fait pas : {modeleChoisi.horsPerimetre}
              </p>
            </Card>

            <CostPreview
              lignes={[
                {
                  libelle: `${modeleChoisi.solution} ${modeleChoisi.version}`,
                  detail: 'Instance dédiée, plan de sauvegarde inclus',
                  montant: modeleChoisi.prixIndicatif,
                },
              ]}
            />

            <GatedAction autorise={autorise('app.deploy')} message={refus('app.deploy')}>
              <Button
                variant="primary"
                className="w-full"
                disabled={nom.trim().length === 0}
                onClick={creerService}
              >
                Créer le service
              </Button>
            </GatedAction>
          </div>
        </div>
      )}
    </div>
  )
}

function ChipCategorie({
  label,
  active,
  compte,
  onClick,
}: {
  label: string
  active: boolean
  compte: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
        active
          ? 'border-p-700 bg-p-700 text-white'
          : 'border-g-300 bg-white text-g-700 hover:border-p-400',
      )}
    >
      {label}
      <span className="ml-1.5 text-[10px] opacity-70">{compte}</span>
    </button>
  )
}

function CarteModele({ modele: m, onClick }: { modele: ModeleApplicatif; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2.5 rounded-[10px] border border-g-300 bg-white p-4 text-left transition-colors hover:border-p-400 hover:bg-p-050"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold text-white"
          style={{ background: m.logoTeinte }}
        >
          {m.logoInitiales}
        </span>
        {m.populaire && (
          <Badge tone="violet" size="sm">
            Populaire
          </Badge>
        )}
      </div>
      <div className="min-w-0">
        <span className="block truncate text-[13.5px] font-bold text-ink">{m.nom}</span>
        <span className="block truncate text-[11px] text-g-500">
          {m.solution} {m.version}
        </span>
      </div>
      <p className="text-[12px] leading-snug text-g-700">{m.phrase}</p>
      <div className="mt-auto flex w-full flex-wrap items-center gap-1.5 pt-1">
        <Badge tone="neutral" size="sm">
          {CATEGORIE_MODELE_LABEL[m.categorie]}
        </Badge>
        {m.certifie && (
          <Badge tone="ok" size="sm">
            Certifié
          </Badge>
        )}
        <span className="ml-auto tnum text-[11.5px] font-semibold text-ink">
          {money(m.prixIndicatif)}/mois
        </span>
      </div>
    </button>
  )
}
