'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, ShieldAlert, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, MAINTENANT, money, num, relatif } from '@/lib/format'
import { ELEVATIONS, EQUIPE_SYNELIA, IMPAYES, libellePlan, ORGANISATIONS, USERS } from '@/lib/mock'
import type { Elevation, Impaye } from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable } from '@/components/composition/data-table'
import { CostPreview } from '@/components/composition/flow'
import { useApp } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { BoutonFormulaire, useOperation } from '@/components/app/actions'
import type { Organisation } from '@/lib/types'
import { creerRessource, requete } from '@/lib/api/client'

export default function Organisations() {
  const { autorise, refus, pousser } = useApp()
  const orgs = useCollection<Organisation>('organisations', ORGANISATIONS)
  const impayes = useCollection<Impaye>('impayes', IMPAYES)
  const atelier = useAtelier()
  const executer = useOperation()

  // La collection d'élévations est propre à chaque organisation : la fiche de
  // l'organisation lit exactement la même, sous le même nom.
  const creerElevation = (orgId: string, e: Elevation) =>
    atelier.creer(`elevations-${orgId}`, ELEVATIONS, e)
  const [creation, setCreation] = useState(false)
  const [nom, setNom] = useState('')
  const [pays, setPays] = useState('Côte d’Ivoire')
  const [secteur, setSecteur] = useState('')
  const [plan, setPlan] = useState('standard')
  const [tva, setTva] = useState('')
  const [adminCourriel, setAdminCourriel] = useState('')
  const [royaume, setRoyaume] = useState(true)
  const [mfa, setMfa] = useState(true)
  const [espaceEvaluation, setEspaceEvaluation] = useState(false)

  const creer = () => {
    executer({
      action: 'org.manage',
      titre: `${nom.trim()} créée`,
      detail: `Le royaume d’identité est provisionné et l’invitation de ${
        adminCourriel.trim() || 'l’administrateur'
      } est envoyée.`,
      job: { workflow: 'org.create', cible: nom.trim() },
      appel: () =>
        creerRessource('/organisations', {
          nom: nom.trim(),
          pays,
          secteur: secteur.trim() || undefined,
          tva: tva.trim() || undefined,
          tenantPlan: plan,
          administrateur: adminCourriel.trim()
            ? { email: adminCourriel.trim(), nom: adminCourriel.trim().split('@')[0] }
            : undefined,
        }),
      effetFinal: () => orgs.recharger(),
      effet: () =>
        orgs.creer({
          id: orgs.identifiant('org'),
          nom: nom.trim(),
          pays,
          secteur: secteur.trim() || undefined,
          tva: tva.trim() || undefined,
          statut: 'active',
          createdAt: MAINTENANT,
          espaces: espaceEvaluation ? 1 : 0,
          utilisateurs: 1,
          caMensuel: 0,
          tenantPlan: plan === 'standard' ? 'Standard' : plan === 'avance' ? 'Avancé' : 'Entreprise',
        }),
    })
    setNom('')
    setSecteur('')
    setTva('')
    setAdminCourriel('')
    setCreation(false)
  }

  const actives = orgs.items.filter((o) => o.statut === 'active')
  const suspendues = orgs.items.filter((o) => o.statut === 'suspendue')
  const caTotal = orgs.items.reduce((a, o) => a + (o.caMensuel ?? 0), 0)
  const orgsImpayees = new Set(impayes.items.map((i) => i.org))

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Organisations' }]}
        titre="Organisations"
        sousTitre="Chaque organisation est un cloisonnement complet : ses espaces, ses membres, ses données et sa facturation. Aucune donnée ne traverse la frontière entre deux organisations, y compris pour nos propres équipes."
        actions={
          <GatedAction autorise={autorise('org.manage')} message={refus('org.manage')}>
            <Button iconBefore={<Plus size={14} />} onClick={() => setCreation(true)}>
              Créer une organisation
            </Button>
          </GatedAction>
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {orgs.items.length} organisations
            </Badge>
            {suspendues.length > 0 && (
              <Badge tone="warn" dot size="sm">
                {suspendues.length} suspendue
              </Badge>
            )}
          </>
        }
      />

      {orgsImpayees.size > 0 && (
        <Callout ton="warn" titre={`${orgsImpayees.size} organisations en situation d’impayé`}>
          {[...orgsImpayees].join(', ')}. Notre politique interdit la suspension automatique : un
          impayé déclenche une relance écrite, puis un appel, puis une proposition d’échelonnement.
          La suspension est une décision humaine, prise en dernier recours et journalisée.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile libelle="Organisations actives" valeur={actives.length} ton="ok" />
        <StatTile
          libelle="Secteurs représentés"
          valeur={new Set(orgs.items.map((o) => o.secteur ?? o.pays)).size}
          ton="violet"
          detail={`sur ${orgs.items.length} organisations`}
        />
        <StatTile
          libelle="Suspendues"
          valeur={suspendues.length}
          ton={suspendues.length > 0 ? 'warn' : 'ok'}
          detail={suspendues.length > 0 ? suspendues.map((o) => o.nom).join(', ') : 'Aucune'}
        />
        <StatTile
          libelle="Chiffre d’affaires mensuel"
          valeur={money(caTotal)}
          detail="Toutes organisations confondues"
        />
        <StatTile
          libelle="Utilisateurs"
          valeur={num(orgs.items.reduce((a, o) => a + (o.utilisateurs ?? 0), 0))}
          detail={`${USERS.length} identités connues`}
        />
      </div>

      <Card padding={false}>
        <div className="p-4">
          <DataTable<Organisation>
            lignes={orgs.items}
            exportable
            parPage={12}
            placeholderRecherche="Rechercher une organisation, un pays, un secteur…"
            filtres={[
              {
                id: 'statut',
                libelle: 'Statut',
                options: [
                  { value: 'tous', label: 'Tous les statuts' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspendue', label: 'Suspendue' },
                  { value: 'fermee', label: 'Fermée' },
                ],
              },
              {
                id: 'secteur',
                libelle: 'Secteur',
                options: [
                  { value: 'tous', label: 'Tous les secteurs' },
                  ...[...new Set(orgs.items.map((o) => o.secteur).filter(Boolean))].map(
                    (sect) => ({ value: sect as string, label: sect as string }),
                  ),
                ],
              },
              {
                id: 'pays',
                libelle: 'Pays',
                options: [
                  { value: 'tous', label: 'Tous les pays' },
                  ...[...new Set(orgs.items.map((o) => o.pays))].map((p) => ({
                    value: p,
                    label: p,
                  })),
                ],
              },
            ]}
            selection={(l, fid, val) =>
              fid === 'statut'
                ? l.statut === val
                : fid === 'secteur'
                  ? l.secteur === val
                  : fid === 'pays'
                    ? l.pays === val
                    : true
            }
            href={(o) => `/admin/organisations/${o.id}`}
            colonnes={[
              {
                id: 'nom',
                entete: 'Organisation',
                cle: (o) => `${o.nom} ${o.pays} ${o.secteur ?? ''}`,
                rendu: (o) => (
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-p-050 text-p-700">
                      <Building2 size={13} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">
                        {o.nom}
                      </span>
                      <span className="block truncate text-[11px] text-g-500">
                        {o.pays}
                        {o.secteur ? ` · ${o.secteur}` : ''}
                      </span>
                    </span>
                  </span>
                ),
              },
              {
                id: 'secteur',
                entete: 'Secteur',
                cle: (o) => o.secteur ?? '',
                rendu: (o) => (
                  <span className="text-[11.5px] text-g-700">{o.secteur ?? '—'}</span>
                ),
              },
              {
                id: 'plan',
                entete: 'Plan',
                cle: (o) => o.tenantPlan ?? '',
                masquable: true,
                rendu: (o) => (
                  <span className="text-[11.5px] text-g-700">{libellePlan(o.tenantPlan)}</span>
                ),
              },
              {
                id: 'espaces',
                entete: 'Espaces',
                aligne: 'right',
                cle: (o) => o.espaces ?? 0,
                rendu: (o) => <span className="tnum text-[12px] text-g-700">{o.espaces ?? 0}</span>,
              },
              {
                id: 'utilisateurs',
                entete: 'Utilisateurs',
                aligne: 'right',
                cle: (o) => o.utilisateurs ?? 0,
                rendu: (o) => (
                  <span className="tnum text-[12px] text-g-700">{o.utilisateurs ?? 0}</span>
                ),
              },
              {
                id: 'vcpu',
                entete: 'vCPU alloué',
                aligne: 'right',
                cle: (o) => o.consommationVcpu ?? 0,
                rendu: (o) => (
                  <span className="tnum text-[12px] font-semibold text-ink">
                    {num(o.consommationVcpu ?? 0)}
                  </span>
                ),
              },
              {
                id: 'ca',
                entete: 'CA mensuel',
                aligne: 'right',
                cle: (o) => o.caMensuel ?? 0,
                rendu: (o) => (
                  <span className="tnum text-[12px] font-semibold text-ink">
                    {o.caMensuel ? money(o.caMensuel) : '—'}
                  </span>
                ),
              },
              {
                id: 'statut',
                entete: 'Statut',
                cle: (o) => o.statut,
                rendu: (o) => (
                  <span className="flex flex-col items-start gap-1">
                    <Badge
                      tone={
                        o.statut === 'active' ? 'ok' : o.statut === 'suspendue' ? 'warn' : 'neutral'
                      }
                      dot
                      size="sm"
                    >
                      {o.statut === 'active'
                        ? 'Active'
                        : o.statut === 'suspendue'
                          ? 'Suspendue'
                          : 'Fermée'}
                    </Badge>
                    {orgsImpayees.has(o.nom) && (
                      <Badge tone="err" size="sm">
                        Impayé
                      </Badge>
                    )}
                  </span>
                ),
              },
              {
                id: 'depuis',
                entete: 'Cliente depuis',
                aligne: 'right',
                cle: (o) => o.createdAt,
                masquable: true,
                masqueeParDefaut: true,
                rendu: (o) => (
                  <span className="text-[11.5px] text-g-500">{dateCourte(o.createdAt)}</span>
                ),
              },
              {
                id: 'actions',
                entete: '',
                aligne: 'right',
                rendu: (o) => (
                  <span className="flex items-center justify-end gap-1.5">
                    <ButtonLink size="sm" variant="ghost" href={`/admin/organisations/${o.id}`}>
                      Ouvrir
                    </ButtonLink>
                    <BoutonFormulaire
                      libelle="Élévation"
                      variant="ghost"
                      icone={<UserCog size={12} />}
                      action="org.manage"
                      titre={`Demander une élévation sur ${o.nom}`}
                      description="L’accès expire de lui-même. Le client voit la demande dans son propre journal d’audit — votre nom, le motif, la durée, le périmètre — et chaque action faite pendant l’élévation y est consignée individuellement."
                      libelleValider="Demander l’accès"
                      champs={[
                        {
                          id: 'motif',
                          label: 'Motif',
                          type: 'zone',
                          obligatoire: true,
                          placeholder:
                            'Ticket SYN-8814 — diagnostic de la latence signalée sur app-metier, lecture des métriques et des journaux de production.',
                        },
                        {
                          id: 'duree',
                          label: 'Durée',
                          type: 'select',
                          demi: true,
                          options: [
                            { value: '1', label: '1 heure' },
                            { value: '4', label: '4 heures' },
                            { value: '8', label: '8 heures' },
                          ],
                        },
                        {
                          id: 'perimetre',
                          label: 'Périmètre',
                          type: 'select',
                          demi: true,
                          options: [
                            { value: 'lecture', label: 'Lecture des métadonnées et métriques' },
                            { value: 'logs', label: 'Lecture, journaux applicatifs inclus' },
                            { value: 'intervention', label: 'Intervention sur les ressources' },
                          ],
                        },
                      ]}
                      valeursDepart={{ duree: '4', perimetre: 'lecture' }}
                      operation={(v) => ({
                        ton: 'warn',
                        titre: `Élévation de ${v.duree} h demandée sur ${o.nom}`,
                        detail:
                          'Une entrée apparaît immédiatement dans le journal d’audit du client, avec votre nom et le motif.',
                        // Même appel réel que le bouton équivalent de la fiche organisation
                        // (`[id]/vue.tsx`) : sans `appel`, ce bouton se contentait d'écrire dans
                        // l'atelier local (mode maquette) même en mode API — aucune ligne
                        // `sessions_auth` ni entrée d'audit ne partait réellement côté backend.
                        appel: () =>
                          requete(`/organisations/${encodeURIComponent(o.id)}/emprunt-identite`, {
                            methode: 'POST',
                            corps: {
                              motif: String(v.motif),
                              ecriture: v.perimetre === 'intervention',
                              dureeMin: Number(v.duree) * 60,
                            },
                          }),
                        effet: () =>
                          creerElevation(o.id, {
                            id: `elv-${o.id}-${v.duree}`,
                            qui: EQUIPE_SYNELIA[0].nom,
                            quand: MAINTENANT,
                            duree: `${v.duree} h`,
                            motif: String(v.motif),
                            actif: true,
                          }),
                      })}
                    />
                  </span>
                ),
              },
            ]}
            vide={{
              titre: 'Aucune organisation',
              phrase: 'Créez une organisation ou attendez la première souscription en ligne.',
            }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="violet" titre="Le cloisonnement s’applique aussi à nous">
          Un membre de nos équipes ne voit pas les données d’une organisation sans élévation
          nominative, bornée dans le temps, et visible dans le journal d’audit du client. Ce n’est pas
          une politique interne que nous vous demandons de croire : c’est le mécanisme technique, et
          le client le constate lui-même dans son propre journal.
        </Callout>
        <Callout ton="info" titre="Suspendre n’est jamais automatique">
          Aucun impayé, aucun dépassement de quota, aucun signalement d’abus ne suspend une
          organisation sans décision humaine. Couper le service d’une entreprise, c’est arrêter son
          activité : cela mérite un nom, une date et un motif consignés, pas un traitement par lot
          nocturne.
        </Callout>
      </div>

      <Modal
        open={creation}
        onClose={() => setCreation(false)}
        title="Créer une organisation"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreation(false)}>
              Annuler
            </Button>
            <Button disabled={nom.trim().length === 0} onClick={creer}>
              Créer et inviter l’administrateur
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Raison sociale" required>
            <Input
              placeholder="Nom de l’entreprise"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Pays">
              <Select value={pays} onChange={(e) => setPays(e.target.value)}>
                <option value="Côte d’Ivoire">Côte d’Ivoire</option>
                <option value="Sénégal">Sénégal</option>
                <option value="Bénin">Bénin</option>
                <option value="Togo">Togo</option>
                <option value="Burkina Faso">Burkina Faso</option>
                <option value="Mali">Mali</option>
                <option value="France">France</option>
              </Select>
            </Field>
            <Field label="Secteur">
              <Input
                placeholder="Banque, industrie, administration…"
                value={secteur}
                onChange={(e) => setSecteur(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Plan de service">
              <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="standard">Standard</option>
                <option value="avance">Avancé — support prioritaire</option>
                <option value="entreprise">Entreprise — interlocuteur dédié</option>
              </Select>
            </Field>
            <Field label="Numéro de contribuable" hint="détermine le régime de TVA">
              <Input
                placeholder="CI-ABJ-2024-B-00000"
                value={tva}
                onChange={(e) => setTva(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Adresse de l’administrateur"
            hint="recevra l’invitation — aucun mot de passe n’est transmis par courriel"
          >
            <Input
              type="email"
              placeholder="admin@entreprise.ci"
              value={adminCourriel}
              onChange={(e) => setAdminCourriel(e.target.value)}
            />
          </Field>
          <div className="space-y-3">
            <Switch
              checked={royaume}
              onChange={setRoyaume}
              label="Provisionner un royaume d’identité dédié"
              description="Cloisonnement complet des identités. La fédération avec l’annuaire du client se configure ensuite depuis son propre espace."
            />
            <Switch
              checked={mfa}
              onChange={setMfa}
              label="Exiger le deuxième facteur d’authentification"
              description="Appliqué à tous les membres dès la première connexion."
            />
            <Switch
              checked={espaceEvaluation}
              onChange={setEspaceEvaluation}
              label="Créer un Espace Cloud d’évaluation"
              description="4 vCPU, 8 Go, 100 Go de disque, gratuit pendant 30 jours puis supprimé automatiquement après avertissement."
            />
          </div>
          <CostPreview
            lignes={[
              {
                libelle: `Plan de service ${
                  plan === 'standard' ? 'Standard' : plan === 'avance' ? 'Avancé' : 'Entreprise'
                }`,
                detail:
                  plan === 'standard'
                    ? 'Inclus, sans surcoût'
                    : plan === 'avance'
                      ? 'Support prioritaire, engagement de première réponse réduit'
                      : 'Interlocuteur dédié et revue trimestrielle',
                montant: 0,
              },
              ...(espaceEvaluation
                ? [
                    {
                      libelle: 'Espace Cloud d’évaluation',
                      detail: '30 jours offerts, puis facturation ou suppression',
                      montant: 0,
                    },
                  ]
                : []),
            ]}
          />
          <Callout ton="info" titre="Ce que la création déclenche">
            Un royaume d’identité isolé, une organisation dans le portail, un compte de facturation,
            et une invitation pour l’administrateur désigné. Aucune ressource technique n’est créée
            avant que le client ne souscrive lui-même une offre.
          </Callout>
        </div>
      </Modal>
    </div>
  )
}
