'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { money } from '@/lib/format'
import { ESPACES, PROJETS, SERVICES_PROJET } from '@/lib/mock'
import type { EspaceCloud, Projet, ServiceProjet } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/field'
import { Card, CardHeader } from '@/components/composition/card'
import { ConfirmDialog } from '@/components/ui/overlay'
import { EnteteProjet, ProjetIntrouvable } from '@/components/business/projets'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { useServicesProjet } from '@/lib/api/services-projet'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { estActif, modifierRessource, requete, supprimerRessource } from '@/lib/api/client'

export function VueParametres({ id }: { id: string }) {
  const router = useRouter()
  const lesProjets = useCollection<Projet>('projets', PROJETS)
  const lesServices = useCollection<ServiceProjet>('services-projet', SERVICES_PROJET)
  const espacesCol = useCollection<EspaceCloud>('espaces', ESPACES)
  const executer = useOperation()
  const { autorise, refus } = useApp()

  const projet = lesProjets.items.find((p) => p.id === id)
  // Avec l’API, la liste vient de `GET /projets/{id}/services` (route nichée,
  // hors registre) ; en maquette, du filtre local.
  const { distants: servicesDistants } = useServicesProjet(id)
  const services = useMemo(
    () => servicesDistants ?? lesServices.items.filter((x) => x.projetId === id),
    [servicesDistants, lesServices.items, id],
  )
  const [suppression, setSuppression] = useState(false)
  const [nom, setNom] = useState(projet?.nom ?? '')
  const [description, setDescription] = useState(projet?.description ?? '')
  const [espaceId, setEspaceId] = useState(projet?.espaceId ?? '')
  // Une approbation exigée sur un environnement : réglage de la session, il ne
  // change aucun service en marche.
  const [approbations, setApprobations] = useState<Record<string, boolean>>({})

  if (!projet) return <ProjetIntrouvable section="Paramètres" />

  return (
    <div className="space-y-5">
      <EnteteProjet
        projet={projet}
        section="Paramètres"
        titre="Paramètres du projet"
        sousTitre="L’identité du projet, ses environnements et son rattachement à un Espace Cloud. Ces réglages ne touchent aucun service en marche — sauf la suppression, qui les détruit tous."
        meta={
          <>
            <Badge tone="neutral">
              {services.length} service{services.length > 1 ? 's' : ''}
            </Badge>
            <Badge tone="neutral">
              Espace <span className="font-mono">{projet.espaceId.toUpperCase()}</span>
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre="Identité du projet"
            sousTitre="Le nom apparaît dans les journaux, la facturation et le showback."
          />
          <div className="space-y-3.5">
            <Field label="Nom" required>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field
              label="Espace Cloud de rattachement"
              hint="Détermine le quota consommé et le site physique par défaut des services."
            >
              <Select value={espaceId} onChange={(e) => setEspaceId(e.target.value)}>
                {espacesCol.items.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} — {e.offreNom}
                  </option>
                ))}
              </Select>
            </Field>
            {espaceId !== projet.espaceId && (
              <p className="text-[12px] leading-relaxed text-warn">
                Changer d’Espace Cloud déplace le quota consommé par ce projet, mais ne déplace
                aucune machine : les services en marche restent sur leur socle jusqu’à leur prochain
                redéploiement.
              </p>
            )}
          </div>
          <BoutonAction
            libelle="Enregistrer"
            className="mt-4"
            desactive={
              nom.trim().length === 0 ||
              (nom === projet.nom &&
                description === projet.description &&
                espaceId === projet.espaceId)
            }
            operation={{
              action: 'app.deploy',
              titre: `Paramètres de ${nom.trim()} enregistrés`,
              detail: 'Aucun service n’a été redémarré : ces réglages sont de l’identité, pas de la configuration d’exécution.',
              appel: () =>
                modifierRessource('/projets', projet.id, {
                  nom: nom.trim(),
                  description: description.trim(),
                  espaceId,
                  environnements: projet.environnements,
                }),
              effet: () =>
                lesProjets.modifier(projet.id, {
                  nom: nom.trim(),
                  description: description.trim(),
                  espaceId,
                }),
              effetFinal: () => lesProjets.recharger(),
            }}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Environnements"
              sousTitre="Ajouter un environnement ne déploie rien : il naît vide."
            />
            <div className="space-y-2">
              {projet.environnements.map((e) => (
                <div
                  key={e}
                  className="flex items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{e}</span>
                    <span className="block text-[11px] text-g-500">
                      {services.filter((s) => s.environnement === e).length} service(s) ·{' '}
                      {money(
                        services
                          .filter((s) => s.environnement === e)
                          .reduce((a, s) => a + s.coutMensuel, 0),
                      )}
                      /mois
                    </span>
                  </span>
                  {e === 'Production' ? (
                    <Badge tone="violet" size="sm">
                      Protégé
                    </Badge>
                  ) : (
                    <Switch
                      checked={Boolean(approbations[e])}
                      onChange={(v) => setApprobations((p) => ({ ...p, [e]: v }))}
                      label="Approbation requise"
                    />
                  )}
                </div>
              ))}
            </div>
            <BoutonFormulaire
              libelle="Ajouter un environnement"
              variant="secondary"
              className="mt-3"
              icone={<Plus size={13} />}
              action="app.deploy"
              titre={`Ajouter un environnement à ${projet.nom}`}
              description="Il naît vide : aucun service n’est copié depuis un autre environnement, et rien n’est facturé tant que vous n’y déployez pas."
              libelleValider="Ajouter"
              champs={[
                {
                  id: 'nom',
                  label: 'Nom de l’environnement',
                  obligatoire: true,
                  placeholder: 'Recette',
                  hint: 'apparaît dans les adresses offertes des services qu’il portera',
                },
              ]}
              operation={(v) => ({
                titre: `Environnement « ${v.nom} » ajouté`,
                detail: 'Il est vide : déployez-y un service pour qu’il commence à exister.',
                appel: () =>
                  modifierRessource('/projets', projet.id, {
                    nom: projet.nom,
                    espaceId: projet.espaceId,
                    environnements: [...projet.environnements, String(v.nom).trim()],
                  }),
                effet: () =>
                  lesProjets.modifier(projet.id, (p) => ({
                    environnements: [...p.environnements, String(v.nom).trim()],
                  })),
                effetFinal: () => lesProjets.recharger(),
              })}
            />
          </Card>

          <Card className="border-err/40">
            <CardHeader
              titre="Supprimer le projet"
              sousTitre="Irréversible. Les services, leurs volumes et leurs sauvegardes sont détruits."
            />
            <ul className="mb-3 space-y-1 text-[12px] text-g-700">
              <li>
                {services.length} service{services.length > 1 ? 's' : ''} arrêté
                {services.length > 1 ? 's' : ''} puis supprimé{services.length > 1 ? 's' : ''}
              </li>
              <li>
                {services.filter((s) => s.type === 'base').length} base(s) de données et leurs
                volumes
              </li>
              <li>Les domaines rattachés cessent de répondre immédiatement</li>
            </ul>
            <GatedAction autorise={autorise('app.deploy')} message={refus('app.deploy')}>
              <Button
                variant="danger"
                size="sm"
                iconBefore={<Trash2 size={13} />}
                onClick={() => setSuppression(true)}
              >
                Supprimer ce projet
              </Button>
            </GatedAction>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={suppression}
        onClose={() => setSuppression(false)}
        onConfirm={() => {
          // DELETE /projets/{id} refuse un projet non vide (`409`) : les
          // services partent d’abord, un par un, puis le projet. `202` suivi.
          const viderPuisSupprimer = async () => {
            for (const s of services) {
              await requete(
                `/projets/${encodeURIComponent(projet.id)}/services/${encodeURIComponent(s.id)}`,
                { methode: 'DELETE', query: { confirmation: s.nom } },
              )
            }
            return supprimerRessource('/projets', projet.id, projet.nom)
          }
          executer({
            action: 'app.deploy',
            ton: 'warn',
            titre: `Projet ${projet.nom} supprimé`,
            detail: `${services.length} service(s) arrêté(s) puis détruit(s). Les sauvegardes suivent leur rétention légale, puis disparaissent.`,
            ...(estActif() ? { appel: viderPuisSupprimer } : {}),
            effet: () => {
              lesServices.supprimer(services.map((x) => x.id))
              lesProjets.supprimer(projet.id)
            },
            effetFinal: () => {
              lesProjets.recharger()
              router.push('/app/applications/projets')
            },
          })
          setSuppression(false)
        }}
        titre="Supprimer le projet"
        ressource={projet.nom}
        pertes={[
          `${services.length} service(s) en cours d’exécution`,
          `${services.filter((s) => s.type === 'base').length} base(s) de données et leurs volumes`,
          'Les sauvegardes associées, au-delà de la rétention légale',
          'Les domaines rattachés, qui cesseront de répondre',
        ]}
        libelleAction="Supprimer définitivement"
      />
    </div>
  )
}
