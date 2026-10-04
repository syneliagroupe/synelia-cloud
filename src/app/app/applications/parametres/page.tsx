'use client'

import Link from 'next/link'
import { dateCourte, money } from '@/lib/format'
import { PROJETS, SERVICES_PROJET, syntheseDeServices } from '@/lib/mock'
import type { Projet, ServiceProjet } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useCollection } from '@/components/app/atelier'

export default function ParametresTousProjets() {
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const environnements = lesProjets.items.reduce((a, p) => a + p.environnements.length, 0)
  const espaces = new Set(lesProjets.items.map((p) => p.espaceId))
  const coutTotal = lesProjets.items.reduce((a, p) => a + syntheseDeServices(lesServices.items.filter((x) => x.projetId === p.id)).coutMensuel, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Applications', href: '/app/applications' },
          { label: 'Paramètres' },
        ]}
        titre="Paramètres des projets"
        sousTitre="Nom, description, environnements, Espace Cloud de rattachement et suppression. Ces réglages se modifient projet par projet : choisissez-en un dans le panneau de gauche."
        actions={
          <ButtonLink href="/app/applications/nouveau" variant="secondary">
            Nouveau projet
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Projets" valeur={lesProjets.items.length} />
        <StatTile
          libelle="Environnements déclarés"
          valeur={environnements}
          detail="tous projets confondus"
        />
        <StatTile
          libelle="Espaces Cloud utilisés"
          valeur={espaces.size}
          detail="ils portent le quota"
        />
        <StatTile libelle="Coût mensuel" valeur={money(coutTotal)} detail="somme des services" />
      </div>

      <Card padding={false}>
        <div className="border-b border-g-100 px-4 py-3.5">
          <CardHeader
            titre="Vos projets"
            sousTitre="Le rattachement à un Espace Cloud décide du quota consommé et du site physique par défaut."
            className="mb-0"
          />
        </div>
        <div className="no-scrollbar overflow-x-auto p-4">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-g-300 bg-g-050">
                {['Projet', 'Espace Cloud', 'Environnements', 'Services', 'Créé', 'Coût'].map(
                  (h) => (
                    <th
                      key={h}
                      className="type-micro px-3 py-2 text-left font-semibold text-g-500"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lesProjets.items.map((p) => {
                const services = lesServices.items.filter((x) => x.projetId === p.id)
                return (
                  <tr key={p.id} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/app/applications/parametres/${p.id}`}
                        className="block max-w-[32ch] truncate text-[13px] font-semibold text-ink hover:text-p-700"
                      >
                        {p.nom}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-[12px] text-g-700">
                        {p.espaceId.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {p.environnements.map((e) => (
                          <Badge key={e} tone={e === 'Production' ? 'violet' : 'neutral'} size="sm">
                            {e}
                          </Badge>
                        ))}
                      </span>
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">{services.length}</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{dateCourte(p.cree)}</td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                      {money(syntheseDeServices(lesServices.items.filter((x) => x.projetId === p.id)).coutMensuel)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout ton="info" titre="Un environnement ajouté naît vide">
        Déclarer « Recette » ne duplique rien et ne facture rien : l’environnement existe, sans
        service. C’est délibéré — copier une production dans un environnement de test recopie aussi
        ses données réelles, ce que la plupart des organisations n’ont pas le droit de faire.
      </Callout>
    </div>
  )
}
