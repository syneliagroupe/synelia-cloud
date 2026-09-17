'use client'

import { useState } from 'react'
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { PROJETS } from '@/lib/mock'
import type { Projet } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EnteteProjet, ProjetIntrouvable } from '@/components/business/projets'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, ModaleFormulaire, useOperation } from '@/components/app/actions'
import { requete } from '@/lib/api/client'

export function VueVariables({ id }: { id: string }) {
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const executer = useOperation()
  const { autorise, refus } = useApp()
  const [reveles, setReveles] = useState<Record<string, boolean>>({})
  const [edition, setEdition] = useState<number | null>(null)

  const projet = lesProjets.items.find((p) => p.id === id)
  if (!projet) return <ProjetIntrouvable section="Variables & secrets" />

  const secrets = projet.variables.filter((v) => v.secret)
  const build = projet.variables.filter((v) => v.portee === 'build')

  const champsVariable = (defaut?: Projet['variables'][number]) => [
    {
      id: 'cle',
      label: 'Clé',
      obligatoire: true,
      placeholder: 'DATABASE_URL',
      hint: 'majuscules et tirets bas, comme la convention des variables d’environnement',
    },
    {
      id: 'valeur',
      label: 'Valeur',
      type: 'zone' as const,
      obligatoire: true,
      placeholder: defaut?.secret ? 'nouvelle valeur — l’ancienne n’est pas relisible' : 'postgres://…',
    },
    {
      id: 'portee',
      label: 'Portée',
      type: 'select' as const,
      demi: true,
      options: [
        { value: 'runtime', label: 'Exécution — relue à chaque démarrage' },
        { value: 'build', label: 'Construction — figée dans l’artefact' },
      ],
    },
    {
      id: 'secret',
      label: 'Secret',
      type: 'switch' as const,
      demi: true,
      placeholder: 'Stocker dans le coffre, ne jamais afficher',
    },
    {
      id: 'environnements',
      label: 'Environnements',
      type: 'select' as const,
      options: [
        { value: 'tous', label: `Tous (${projet.environnements.join(', ')})` },
        ...projet.environnements.map((e) => ({ value: e, label: e })),
      ],
    },
  ]

  const versVariable = (v: Record<string, string | number | boolean>) => ({
    cle: String(v.cle).trim(),
    valeur: v.secret ? undefined : String(v.valeur),
    secret: Boolean(v.secret),
    portee: v.portee as 'build' | 'runtime',
    environnements:
      v.environnements === 'tous' ? [...projet.environnements] : [String(v.environnements)],
  })

  /**
   * PUT /projets/{id}/variables — remplacement complet de la liste, dans la
   * forme du contrat (`valeur` absente pour un secret). L’écran recalcule la
   * liste visée puis la publie ; la maquette applique le même calcul en local.
   */
  const appelVariables = (variables: Projet['variables']) => () =>
    requete(`/projets/${encodeURIComponent(projet.id)}/variables`, {
      methode: 'PUT',
      corps: {
        variables: variables.map((x) => ({
          cle: x.cle,
          ...(x.valeur !== undefined ? { valeur: x.valeur } : {}),
          secret: x.secret,
          portee: x.portee,
          environnements: x.environnements,
        })),
      },
    })

  const enCours = edition !== null ? projet.variables[edition] : null

  return (
    <div className="space-y-5">
      <EnteteProjet
        projet={projet}
        section="Variables & secrets"
        titre="Variables & secrets"
        sousTitre="Ce que les services de ce projet reçoivent au démarrage, ou pendant leur construction. Ni le portail ni l’image ne conservent une valeur secrète en clair."
        meta={
          <>
            <Badge tone="neutral">{projet.variables.length} variables</Badge>
            <Badge tone="violet">{secrets.length} secrets</Badge>
            <Badge tone="neutral">{projet.environnements.length} environnements</Badge>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile libelle="Variables du projet" valeur={projet.variables.length} />
        <StatTile
          libelle="Secrets"
          valeur={secrets.length}
          detail="stockés dans le coffre"
          ton={secrets.length > 0 ? 'info' : 'neutral'}
        />
        <StatTile
          libelle="Portée construction"
          valeur={build.length}
          detail="figées dans l’artefact"
        />
        <StatTile
          libelle="Portée exécution"
          valeur={projet.variables.length - build.length}
          detail="relues à chaque démarrage"
        />
      </div>

      <Callout ton="violet" titre="Héritées par tous les services du projet">
        Une variable définie ici est injectée dans chaque service de l’environnement concerné. Un
        service peut la redéfinir pour lui seul ; la valeur du service gagne toujours.
      </Callout>

      <Card>
        <CardHeader
          titre="Variables et secrets du projet"
          sousTitre="Les valeurs secrètes ne sont jamais affichées par défaut, et leur révélation est journalisée."
          actions={
            <BoutonFormulaire
              libelle="Ajouter une variable"
              icone={<Plus size={13} />}
              action="app.deploy"
              titre={`Ajouter une variable à ${projet.nom}`}
              description="Elle est injectée dans chaque service de l’environnement concerné. Un service peut la redéfinir pour lui seul ; la valeur du service gagne toujours."
              libelleValider="Ajouter"
              champs={champsVariable()}
              valeursDepart={{ portee: 'runtime', environnements: 'tous' }}
              complement={(v) =>
                v.secret ? (
                  <Callout ton="violet" titre="Un secret ne se relit pas">
                    La valeur part au coffre de l’organisation. Le portail ne l’affichera plus :
                    pour la changer, il faudra en saisir une nouvelle, jamais la corriger à partir
                    de l’ancienne.
                  </Callout>
                ) : null
              }
              operation={(v) => ({
                titre: `Variable ${String(v.cle).trim()} ajoutée`,
                detail:
                  v.portee === 'build'
                    ? 'Portée construction : elle prendra effet au prochain build.'
                    : 'Portée exécution : redéployez les services concernés pour qu’ils la relisent.',
                appel: appelVariables([...projet.variables, versVariable(v)]),
                effet: () =>
                  lesProjets.modifier(projet.id, (p) => ({
                    variables: [...p.variables, versVariable(v)],
                  })),
                effetFinal: () => lesProjets.recharger(),
              })}
            />
          }
        />
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-g-300 bg-g-050">
                {['Clé', 'Valeur', 'Portée', 'Environnements', ''].map((h) => (
                  <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projet.variables.map((v, i) => (
                <tr key={`${v.cle}-${i}`} className="border-b border-g-100 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[12.5px] font-semibold text-ink">{v.cle}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {v.secret ? (
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-g-700">
                          {reveles[`${v.cle}-${i}`] ? 'postgresql://app_metier:…' : '••••••••••••'}
                        </span>
                        <IconButton
                          label={
                            reveles[`${v.cle}-${i}`] ? 'Masquer la valeur' : 'Révéler la valeur'
                          }
                          size="sm"
                          onClick={() => {
                            const cle = `${v.cle}-${i}`
                            if (!reveles[cle]) {
                              executer({
                                ton: 'info',
                                titre: `Révélation de ${v.cle} journalisée`,
                                detail:
                                  'Votre nom, l’heure et la variable concernée figurent désormais dans le journal d’audit de l’organisation.',
                              })
                            }
                            setReveles((r) => ({ ...r, [cle]: !r[cle] }))
                          }}
                        >
                          {reveles[`${v.cle}-${i}`] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </IconButton>
                      </span>
                    ) : (
                      <span className="font-mono text-[12px] text-g-700">{v.valeur}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={v.portee === 'build' ? 'info' : 'neutral'} size="sm">
                      {v.portee === 'build' ? 'Build' : 'Exécution'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {v.environnements.map((e) => (
                        <Badge key={e} tone="neutral" size="sm">
                          {e}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="text-[11.5px] text-g-500">
                        {v.secret ? 'coffre de secrets' : 'clair'}
                      </span>
                      <GatedAction
                        autorise={autorise('app.deploy')}
                        message={refus('app.deploy')}
                      >
                        <IconButton
                          label={`Modifier ${v.cle}`}
                          size="sm"
                          onClick={() => setEdition(i)}
                        >
                          <Pencil size={13} />
                        </IconButton>
                      </GatedAction>
                      <BoutonAction
                        libelle={<Trash2 size={13} />}
                        nomAccessible={`Retirer la variable ${v.cle}`}
                        variant="ghost"
                        className="px-2"
                        operation={{
                          action: 'app.deploy',
                          ton: 'warn',
                          titre: `Variable ${v.cle} retirée`,
                          detail:
                            'Les services qui la lisaient ne la recevront plus à leur prochain démarrage. Vérifiez qu’aucun n’en dépend avant de redéployer.',
                          appel: appelVariables(projet.variables.filter((_, j) => j !== i)),
                          effet: () =>
                            lesProjets.modifier(projet.id, (p) => ({
                              variables: p.variables.filter((_, j) => j !== i),
                            })),
                          effetFinal: () => lesProjets.recharger(),
                        }}
                        confirmation={{
                          ressource: v.cle,
                          titre: `Retirer la variable ${v.cle} ?`,
                          pertes: [
                            `Les services de ${v.environnements.join(', ')} ne la recevront plus`,
                            v.secret
                              ? 'La valeur au coffre est détruite : elle n’est pas récupérable'
                              : 'La valeur est perdue, mais elle était en clair ici',
                            'Un service qui l’attend démarrera peut-être en erreur',
                          ],
                          libelleAction: 'Retirer la variable',
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ModaleFormulaire
        ouvert={enCours !== null}
        onFermer={() => setEdition(null)}
        titre={enCours ? `Modifier ${enCours.cle}` : ''}
        description="Changer une valeur ne redémarre rien : les services concernés la reliront à leur prochain déploiement, et le portail le rappelle."
        champs={champsVariable(enCours ?? undefined)}
        valeursDepart={
          enCours
            ? {
                cle: enCours.cle,
                valeur: enCours.secret ? '' : (enCours.valeur ?? ''),
                portee: enCours.portee,
                secret: enCours.secret,
                environnements:
                  enCours.environnements.length === projet.environnements.length
                    ? 'tous'
                    : enCours.environnements[0],
              }
            : undefined
        }
        libelleValider="Enregistrer"
        onValider={(v) => {
          const index = edition
          if (index === null) return
          executer({
            action: 'app.deploy',
            titre: `Variable ${String(v.cle).trim()} enregistrée`,
            detail: 'Redéployez les services concernés pour qu’ils prennent la nouvelle valeur.',
            appel: appelVariables(
              projet.variables.map((x, j) => (j === index ? versVariable(v) : x)),
            ),
            effet: () =>
              lesProjets.modifier(projet.id, (p) => ({
                variables: p.variables.map((x, j) => (j === index ? versVariable(v) : x)),
              })),
            effetFinal: () => lesProjets.recharger(),
          })
          setEdition(null)
        }}
      />

      <Card>
        <CardHeader
          titre="Où vivent les secrets"
          sousTitre="Ce que le portail garantit, et ce qu’il ne fait pas."
        />
        <KeyValueList
          colonnes={2}
          items={[
            {
              cle: 'Stockage',
              valeur:
                'Chiffré au repos dans le coffre de l’organisation, jamais dans l’image construite.',
            },
            {
              cle: 'Injection',
              valeur:
                'Au démarrage du conteneur pour la portée exécution, au moment du build sinon.',
            },
            {
              cle: 'Révélation',
              valeur: 'Journalisée dans l’audit avec l’auteur, l’heure et la variable concernée.',
            },
            {
              cle: 'Rotation',
              valeur:
                'Changer une valeur exige un redéploiement pour prendre effet — le portail le propose.',
            },
          ]}
        />
      </Card>
    </div>
  )
}
