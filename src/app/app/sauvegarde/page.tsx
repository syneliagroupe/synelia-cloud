'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Download, FileDown, Plus, RotateCcw, Shield, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, dateHeure, dureeMin, goHumain, num, pct } from '@/lib/format'
import { SITE_COURT } from '@/lib/types'
import type { BackupPlan, ConformiteLigne, DRPlan, RestorePoint } from '@/lib/types'
import { BACKUP_PLANS, BUCKETS, CONFORMITE, DR_PLANS, RESTORE_POINTS, VMS } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { Checkbox, Field, Input, Radio, Select, Switch } from '@/components/ui/field'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Drawer } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { RpoRtoGauge } from '@/components/business/infra'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { Stepper } from '@/components/composition/flow'
import { Regle321 } from '@/components/business/infra'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource } from '@/lib/api/client'

/** Valeurs du formulaire de plan — le tiroir doit être contrôlé pour
 *  qu'« Enregistrer » ait quelque chose à enregistrer. */
interface FormulairePlan {
  nom: string
  scopeType: BackupPlan['scope']['type']
  scopeValeur: string
  frequence: BackupPlan['frequence']
  mode: BackupPlan['mode']
  retentionJours: number
  immutable: boolean
  local: boolean
  autreSite: boolean
  immuableCopie: boolean
  chiffrement: 'synelia' | 'byok'
  kmsRef: string
}

const PLAN_VIDE: FormulairePlan = {
  nom: '',
  scopeType: 'tag',
  scopeValeur: 'production',
  frequence: 'quotidien',
  mode: 'incrementale_complete_hebdo',
  retentionJours: 35,
  immutable: true,
  local: true,
  autreSite: true,
  immuableCopie: true,
  chiffrement: 'synelia',
  kmsRef: '',
}

function formulaireDepuis(plan: BackupPlan): FormulairePlan {
  return {
    nom: plan.nom,
    scopeType: plan.scope.type,
    scopeValeur: plan.scope.valeur,
    frequence: plan.frequence,
    mode: plan.mode,
    retentionJours: plan.retentionJours,
    immutable: plan.immutable,
    local: plan.destinations.some((d) => d.type === 'local'),
    autreSite: plan.destinations.some((d) => d.type === 'autre_site'),
    immuableCopie: plan.destinations.some((d) => d.type === 'immuable'),
    chiffrement: plan.chiffrement.mode,
    kmsRef: plan.chiffrement.kmsRef ?? '',
  }
}

const ONGLETS = [
  { id: 'plans', label: 'Plans' },
  { id: 'points', label: 'Points de restauration' },
  { id: 'restauration', label: 'Restauration' },
  { id: 'conformite', label: 'Conformité' },
  { id: 'reprise', label: 'Plans de reprise' },
]

/** `useCollection` exige un champ `id` ; la conformité s'identifie par ressource. */
type ConformiteAvecId = ConformiteLigne & { id: string }
const CONFORMITE_AVEC_ID: ConformiteAvecId[] = CONFORMITE.map((c) => ({ ...c, id: c.ressourceId }))

export default function Sauvegarde() {
  const [onglet, setOnglet] = useState('plans')
  const conformite = useCollection<ConformiteAvecId>('conformite-sauvegarde', CONFORMITE_AVEC_ID).items
  const plans = useCollection<BackupPlan>('plans-sauvegarde', BACKUP_PLANS).items
  const points = useCollection<RestorePoint>('points-restauration', RESTORE_POINTS).items
  const protegees = conformite.filter((c) => c.protection === 'protegee').length
  const echecs = conformite.filter((c) => c.protection === 'echec').length
  const nonProtegees = conformite.filter((c) => c.protection === 'non_protegee').length

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace client', href: '/app' }, { label: 'Sauvegardes' }]}
        titre="Sauvegardes"
        sousTitre="Des plans réutilisables applicables par étiquette, par Espace Cloud ou par ressource. L’immuabilité garantit qu’un point de restauration sous rétention ne peut être supprimé par personne — pas même par un attaquant ayant obtenu vos droits."
        meta={
          <>
            <Badge tone="ok">{protegees} ressources protégées</Badge>
            {echecs > 0 && <Badge tone="err">{echecs} en échec</Badge>}
            {nonProtegees > 0 && <Badge tone="warn">{nonProtegees} non protégées</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatTile libelle="Plans actifs" valeur={plans.length} />
        <StatTile libelle="Ressources protégées" valeur={protegees} ton="ok" detail={`sur ${conformite.length}`} />
        <StatTile
          libelle="Points de restauration"
          valeur={points.length}
          detail={`${points.filter((p) => p.immuableJusquau).length} immuables`}
        />
        <StatTile
          libelle="Volume protégé"
          valeur={goHumain(Math.round(points.reduce((a, p) => a + p.tailleGo, 0)))}
        />
        <StatTile
          libelle="Ressources en échec"
          valeur={echecs}
          ton={echecs > 0 ? 'err' : 'ok'}
          detail={echecs > 0 ? 'GED · Mayan' : 'Aucun échec'}
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'plans' && <OngletPlans />}
      {onglet === 'points' && <OngletPoints />}
      {onglet === 'restauration' && <AssistantRestauration />}
      {onglet === 'conformite' && <OngletConformite />}
      {onglet === 'reprise' && <OngletReprise />}
    </div>
  )
}

// ─── Plans ────────────────────────────────────────────────────────────

function OngletPlans() {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const plans = useCollection<BackupPlan>('plans-sauvegarde', BACKUP_PLANS)
  const [drawer, setDrawer] = useState<BackupPlan | 'nouveau' | null>(null)
  const [f, setF] = useState<FormulairePlan>(PLAN_VIDE)

  const ouvrir = (cible: BackupPlan | 'nouveau') => {
    setF(cible === 'nouveau' ? PLAN_VIDE : formulaireDepuis(cible))
    setDrawer(cible)
  }

  const poser = <K extends keyof FormulairePlan>(cle: K, valeur: FormulairePlan[K]) =>
    setF((p) => ({ ...p, [cle]: valeur }))

  const destinations = (): BackupPlan['destinations'] => [
    ...(f.local ? [{ type: 'local' as const, bucketId: BUCKETS[0]?.id }] : []),
    ...(f.autreSite ? [{ type: 'autre_site' as const, bucketId: BUCKETS[1]?.id }] : []),
    ...(f.immuableCopie ? [{ type: 'immuable' as const }] : []),
  ]

  const enregistrer = () => {
    const cible = drawer === 'nouveau' || drawer === null ? null : drawer
    executer({
      action: 'backup.plan.write',
      titre: cible ? `Plan « ${f.nom} » enregistré` : `Plan « ${f.nom} » créé`,
      detail: `Portée ${f.scopeType} · ${f.scopeValeur} · rétention ${f.retentionJours} jours${f.immutable ? ' · immuable' : ''}`,
      effet: () =>
        cible
          ? plans.modifier(cible.id, {
              nom: f.nom,
              scope: { type: f.scopeType, valeur: f.scopeValeur },
              frequence: f.frequence,
              mode: f.mode,
              retentionJours: f.retentionJours,
              immutable: f.immutable,
              destinations: destinations(),
              chiffrement: {
                mode: f.chiffrement,
                kmsRef: f.chiffrement === 'byok' ? f.kmsRef || 'kms-byok-dba' : undefined,
              },
            })
          : plans.creer({
              id: plans.identifiant('bp'),
              orgId: 'org-dba',
              nom: f.nom,
              scope: { type: f.scopeType, valeur: f.scopeValeur },
              frequence: f.frequence,
              mode: f.mode,
              retentionJours: f.retentionJours,
              immutable: f.immutable,
              destinations: destinations(),
              prochaineExecution: '2026-08-20T02:00:00Z',
              chiffrement: {
                mode: f.chiffrement,
                kmsRef: f.chiffrement === 'byok' ? f.kmsRef || 'kms-byok-dba' : undefined,
              },
              ressourcesProtegees: 0,
              dernierResultat: 'ok',
            }),
    })
    setDrawer(null)
  }

  const colonnes: Array<Colonne<BackupPlan>> = [
    {
      id: 'nom',
      entete: 'Plan',
      cle: (p) => p.nom,
      rendu: (p) => (
        <span className="block">
          <span className="block text-[13px] font-semibold text-ink">{p.nom}</span>
          <span className="block text-[11px] text-g-500">
            Portée {p.scope.type} · {p.scope.valeur}
          </span>
        </span>
      ),
    },
    { id: 'frequence', entete: 'Fréquence', cle: (p) => p.frequence, rendu: (p) => p.frequence },
    {
      id: 'mode',
      entete: 'Mode',
      cle: (p) => p.mode,
      rendu: (p) =>
        p.mode === 'complete' ? 'Complète' : 'Incrémentale + complète hebdo',
      masquable: true,
    },
    {
      id: 'retention',
      entete: 'Rétention',
      aligne: 'right',
      cle: (p) => p.retentionJours,
      rendu: (p) =>
        p.retentionJours >= 365 ? `${Math.round(p.retentionJours / 365)} ans` : `${p.retentionJours} j`,
    },
    {
      id: 'immutable',
      entete: 'Immuabilité',
      cle: (p) => (p.immutable ? 1 : 0),
      rendu: (p) => (
        <Badge tone={p.immutable ? 'ok' : 'warn'} size="sm">
          {p.immutable ? 'Activée' : 'Désactivée'}
        </Badge>
      ),
    },
    {
      id: 'destinations',
      entete: 'Destinations',
      rendu: (p) => (
        <span className="flex flex-wrap gap-1">
          {p.destinations.map((d, i) => (
            <Badge key={i} tone={d.type === 'immuable' ? 'violet' : 'neutral'} size="sm">
              {d.type === 'local' ? 'Local' : d.type === 'autre_site' ? 'Autre site' : 'Immuable'}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: 'ressources',
      entete: 'Ressources',
      aligne: 'right',
      cle: (p) => p.ressourcesProtegees,
      rendu: (p) => p.ressourcesProtegees,
    },
    {
      id: 'prochaine',
      entete: 'Prochaine exécution',
      cle: (p) => p.prochaineExecution,
      rendu: (p) => dateHeure(p.prochaineExecution),
      masquable: true,
    },
    {
      id: 'resultat',
      entete: 'Dernier résultat',
      cle: (p) => p.dernierResultat,
      rendu: (p) => (
        <Badge
          tone={p.dernierResultat === 'ok' ? 'ok' : p.dernierResultat === 'partiel' ? 'warn' : 'err'}
          dot
          size="sm"
        >
          {p.dernierResultat === 'ok' ? 'Succès' : p.dernierResultat === 'partiel' ? 'Partiel' : 'Échec'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (p) => (
        <GatedAction autorise={autorise('backup.plan.write')} message={refus('backup.plan.write')}>
          <Button size="sm" variant="ghost" onClick={() => ouvrir(p)}>
            Modifier
          </Button>
        </GatedAction>
      ),
    },
  ]

  const plan = drawer === 'nouveau' || drawer === null ? null : drawer

  return (
    <div className="space-y-4">
      <Card padding={false}>
        <div className="px-4 pt-4">
          <CardHeader
            titre="Plans de sauvegarde"
            sousTitre="Un plan par étiquette couvre automatiquement les ressources créées plus tard — c’est la façon la plus fiable de ne pas oublier une machine."
            actions={
              <GatedAction
                autorise={autorise('backup.plan.write')}
                message={refus('backup.plan.write')}
              >
                <Button size="sm" iconBefore={<Plus size={13} />} onClick={() => ouvrir('nouveau')}>
                  Nouveau plan
                </Button>
              </GatedAction>
            }
          />
        </div>
        <div className="px-4 pb-4">
          <DataTable
            lignes={plans.items}
            colonnes={colonnes}
            parPage={10}
            placeholderRecherche="Rechercher un plan…"
            vide={{
              titre: 'Aucun plan de sauvegarde',
              phrase:
                'Sans plan, aucune restauration n’est possible. Commencez par un plan quotidien immuable sur l’étiquette production, avec copie sur le second site.',
              action: { libelle: 'Créer un plan', onClick: () => ouvrir('nouveau') },
            }}
          />
        </div>
      </Card>

      <Callout ton="violet" titre="Pourquoi l’immuabilité change tout">
        Un point de restauration sous rétention WORM ne peut être supprimé ni raccourci par personne
        — ni par un attaquant ayant obtenu des droits d’administration, ni par nos propres équipes.
        C’est la seule protection qui résiste à une compromission de compte privilégié, et c’est ce
        qui distingue une sauvegarde d’une simple copie.
      </Callout>

      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={plan ? `Modifier « ${plan.nom} »` : 'Nouveau plan de sauvegarde'}
        description="Le plan s’applique à toutes les ressources correspondant à sa portée, y compris celles créées ultérieurement."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(null)}>
              Annuler
            </Button>
            <Button disabled={!f.nom.trim()} onClick={enregistrer}>
              {plan ? 'Enregistrer' : 'Créer le plan'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Nom du plan" required>
            <Input
              value={f.nom}
              onChange={(e) => poser('nom', e.target.value)}
              placeholder="Production · quotidien immuable"
            />
          </Field>

          <div>
            <MicroLabel className="mb-2">Portée</MicroLabel>
            <div className="space-y-2">
              {(
                [
                  ['tag', 'Par étiquette', 'Toute ressource portant l’étiquette, y compris créée plus tard. Le plus robuste.'],
                  ['espace', 'Par Espace Cloud', 'Toutes les ressources d’un espace donné.'],
                  ['ressource', 'Par ressource', 'Sélection explicite. À réserver aux cas particuliers.'],
                  ['service', 'Par service managé', 'Instances du marketplace.'],
                ] as const
              ).map(([v, l, d]) => (
                <Radio
                  key={v}
                  name="portee"
                  checked={f.scopeType === v}
                  onChange={() => poser('scopeType', v)}
                  label={l}
                  description={d}
                />
              ))}
            </div>
            <div className="mt-3">
              <Field label="Valeur de la portée">
                <Input
                  value={f.scopeValeur}
                  onChange={(e) => poser('scopeValeur', e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fréquence">
              <Select
                value={f.frequence}
                onChange={(e) => poser('frequence', e.target.value as BackupPlan['frequence'])}
              >
                <option value="horaire">Horaire</option>
                <option value="quotidien">Quotidienne</option>
                <option value="hebdo">Hebdomadaire</option>
                <option value="continu">Journalisation continue</option>
              </Select>
            </Field>
            <Field label="Mode">
              <Select
                value={f.mode}
                onChange={(e) => poser('mode', e.target.value as BackupPlan['mode'])}
              >
                <option value="incrementale_complete_hebdo">
                  Incrémentale avec complète hebdomadaire
                </option>
                <option value="complete">Complète à chaque exécution</option>
              </Select>
            </Field>
          </div>

          <Field label="Rétention" hint="en jours">
            <Input
              type="number"
              value={f.retentionJours}
              onChange={(e) => poser('retentionJours', Number(e.target.value))}
              min={1}
              suffix="jours"
            />
          </Field>

          <Switch
            checked={f.immutable}
            onChange={(v) => poser('immutable', v)}
            label="Immuabilité (WORM)"
            description="Interdit toute suppression d’un point de restauration pendant la durée de rétention. Fortement recommandé sur la production."
          />

          <div>
            <MicroLabel className="mb-2">Destinations</MicroLabel>
            <div className="space-y-2">
              <Checkbox
                checked={f.local}
                onChange={(e) => poser('local', e.target.checked)}
                label="Bucket local"
                description={BUCKETS[0].nom}
              />
              <Checkbox
                checked={f.autreSite}
                onChange={(e) => poser('autreSite', e.target.checked)}
                label="Bucket sur l’autre site"
                description={`${BUCKETS[1].nom} · satisfait la règle « une copie hors site »`}
              />
              <Checkbox
                checked={f.immuableCopie}
                onChange={(e) => poser('immuableCopie', e.target.checked)}
                label="Copie immuable"
                description="Verrouillage WORM sur la durée de rétention"
              />
            </div>
          </div>

          <div>
            <MicroLabel className="mb-2">Chiffrement</MicroLabel>
            <div className="space-y-2">
              <Radio
                name="chiffrement"
                checked={f.chiffrement === 'synelia'}
                onChange={() => poser('chiffrement', 'synelia')}
                label="Clés gérées par Synelia"
                description="Rotation automatique, aucune action de votre part."
              />
              <Radio
                name="chiffrement"
                checked={f.chiffrement === 'byok'}
                onChange={() => poser('chiffrement', 'byok')}
                label="Vos propres clés (BYOK)"
                description="Vous conservez la maîtrise des clés. En cas de perte, la restauration devient impossible — y compris pour nous."
              />
            </div>
            {f.chiffrement === 'byok' && (
              <div className="mt-3">
                <Field label="Référence KMS">
                  <Input
                    value={f.kmsRef}
                    onChange={(e) => poser('kmsRef', e.target.value)}
                    placeholder="kms-byok-dba"
                    className="font-mono"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  )
}

// ─── Points de restauration ───────────────────────────────────────────

function OngletPoints() {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const points = useCollection<RestorePoint>('points-restauration', RESTORE_POINTS)

  const colonnes: Array<Colonne<RestorePoint>> = [
    {
      id: 'ressource',
      entete: 'Ressource',
      cle: (p) => p.resourceNom,
      rendu: (p) => (
        <span className="block">
          <span className="block text-[13px] font-medium text-ink">{p.resourceNom}</span>
          <span className="block text-[11px] text-g-500">{p.resourceType}</span>
        </span>
      ),
    },
    { id: 'date', entete: 'Date', cle: (p) => p.date, rendu: (p) => dateHeure(p.date) },
    {
      id: 'type',
      entete: 'Type',
      cle: (p) => p.type,
      rendu: (p) => (
        <Badge tone="neutral" size="sm">
          {p.type}
        </Badge>
      ),
    },
    {
      id: 'taille',
      entete: 'Taille',
      aligne: 'right',
      cle: (p) => p.tailleGo,
      rendu: (p) => (p.tailleGo > 0 ? goHumain(p.tailleGo) : '—'),
    },
    {
      id: 'destination',
      entete: 'Destination',
      cle: (p) => p.destination,
      rendu: (p) => <span className="font-mono text-[11.5px]">{p.destination}</span>,
      masquable: true,
    },
    {
      id: 'immuable',
      entete: 'Immuabilité',
      cle: (p) => (p.immuableJusquau ? 1 : 0),
      rendu: (p) =>
        p.immuableJusquau ? (
          <Badge tone="ok" size="sm">
            Jusqu’au {dateCourte(p.immuableJusquau)}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            Non
          </Badge>
        ),
    },
    {
      id: 'expiration',
      entete: 'Expiration',
      cle: (p) => p.expiration,
      rendu: (p) => dateCourte(p.expiration),
      masquable: true,
    },
    {
      id: 'verifie',
      entete: 'Vérifié',
      cle: (p) => (p.verifie ? 1 : 0),
      rendu: (p) => (
        <Badge tone={p.verifie ? 'ok' : 'warn'} size="sm">
          {p.verifie ? 'Oui' : 'Non'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (p) => (
        <span className="flex justify-end gap-1">
          <BoutonAction
            libelle="Restaurer"
            variant="ghost"
            icone={<RotateCcw size={12} />}
            operation={{
              action: 'backup.restore',
              ton: 'info',
              titre: `Restauration de ${p.resourceNom}`,
              detail: `Point du ${dateHeure(p.date)} · ${goHumain(p.tailleGo)}`,
              appel: () =>
                // `granularite` est obligatoire côté contrat (`DemandeRestauration`) : sans
                // elle, le backend refusait déjà l'appel avec un 422 « Field required »,
                // vérifié en direct sur dev01 — ce bouton « réel » échouait donc à chaque
                // clic. `complete` est le bon défaut pour une restauration en un clic, sans
                // passer par l'assistant qui, lui, laisse choisir la granularité.
                creerRessource('/sauvegarde/restaurations', {
                  pointId: p.id,
                  cible: 'origine',
                  granularite: 'complete',
                }),
              job: { workflow: 'backup.restore', cible: `${p.resourceNom} · ${dateCourte(p.date)}` },
            }}
          />
          <IconButton
            label={`Télécharger le point du ${dateCourte(p.date)}`}
            size="sm"
            onClick={() =>
              executer({
                action: 'backup.restore',
                ton: 'info',
                titre: 'Téléchargement préparé',
                detail: `${goHumain(p.tailleGo)} · lien signé valable une heure`,
              })
            }
          >
            <Download size={13} />
          </IconButton>
          <IconButton
            label={
              p.immuableJusquau
                ? 'Suppression bloquée : point immuable sous rétention'
                : 'Supprimer le point'
            }
            size="sm"
            disabled={Boolean(p.immuableJusquau)}
            onClick={() =>
              executer({
                action: 'backup.plan.write',
                ton: 'warn',
                titre: `Point du ${dateCourte(p.date)} supprimé`,
                detail: `${goHumain(p.tailleGo)} libérés sur ${p.destination}`,
                effet: () => points.supprimer(p.id),
                effetFinal: () => points.recharger(),
              })
            }
          >
            <Trash2 size={13} className={p.immuableJusquau ? 'text-g-300' : 'text-err'} />
          </IconButton>
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <DataTable
        lignes={points.items}
        colonnes={colonnes}
        parPage={12}
        placeholderRecherche="Rechercher une ressource…"
        filtres={[
          {
            id: 'type',
            libelle: 'Type',
            options: [
              { value: 'complete', label: 'Complète' },
              { value: 'incrementale', label: 'Incrémentale' },
              { value: 'snapshot', label: 'Snapshot' },
            ],
          },
          {
            id: 'ressourceType',
            libelle: 'Nature',
            options: Array.from(new Set(RESTORE_POINTS.map((p) => p.resourceType))).map((t) => ({
              value: t,
              label: t,
            })),
          },
          {
            id: 'immuable',
            libelle: 'Immuabilité',
            options: [
              { value: 'oui', label: 'Immuable' },
              { value: 'non', label: 'Non immuable' },
            ],
          },
        ]}
        selection={(p, id, v) => {
          if (id === 'type') return p.type === v
          if (id === 'ressourceType') return p.resourceType === v
          return v === 'oui' ? Boolean(p.immuableJusquau) : !p.immuableJusquau
        }}
        exportable
        vide={{
          titre: 'Aucun point de restauration',
          phrase:
            'Les points apparaissent après la première exécution réussie d’un plan de sauvegarde.',
        }}
      />
      <Callout ton="info" titre="Suppression bloquée sur les points immuables">
        L’icône de suppression est désactivée sur les points sous rétention WORM. Ce n’est pas une
        limitation de l’interface : le verrouillage est appliqué au niveau du stockage objet, et
        personne — pas même nos administrateurs — ne peut le contourner avant l’expiration.
      </Callout>
    </div>
  )
}

// ─── Assistant de restauration ────────────────────────────────────────

const ETAPES_RESTAURATION = [
  { numero: 1, titre: 'Quoi' },
  { numero: 2, titre: 'Quand' },
  { numero: 3, titre: 'Où' },
  { numero: 4, titre: 'Récapitulatif' },
]

const GRANULARITES = [
  { id: 'machine', titre: 'Machine entière', detail: 'Restaure la machine complète, système et données, telle qu’elle était.' },
  { id: 'volume', titre: 'Volume', detail: 'Un disque de données seul, sans toucher au système.' },
  { id: 'fichiers', titre: 'Système de fichiers', detail: 'Arborescence parcourable — descendez jusqu’au fichier unique.' },
  { id: 'base', titre: 'Base de données', detail: 'Base managée, avec restauration à un instant précis (PITR).' },
  { id: 'boite', titre: 'Boîte aux lettres', detail: 'Une boîte, un dossier ou un message unique d’Email Pro.' },
  { id: 'dossier', titre: 'Dossier d’un service managé', detail: 'Un dossier ou un document de Drive Pro, de la GED, ou d’un autre service.' },
]

function AssistantRestauration() {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const [etape, setEtape] = useState(1)
  const [granularite, setGranularite] = useState('fichiers')
  const [ressource, setRessource] = useState('vm-web-01')
  const [chemin, setChemin] = useState('/srv/uploads/comptabilite/2026')
  const [pointId, setPointId] = useState(RESTORE_POINTS[0].id)
  const [pitr, setPitr] = useState('2026-08-19T14:00')
  const [destination, setDestination] = useState<'meme' | 'autre_espace' | 'autre_site' | 'local'>(
    'meme',
  )
  const [confirme, setConfirme] = useState(false)

  const point = RESTORE_POINTS.find((p) => p.id === pointId)!
  const gran = GRANULARITES.find((g) => g.id === granularite)!
  const dureeEstimee = Math.max(4, Math.round(point.tailleGo / 8))

  return (
    <div className="space-y-4">
      <Card>
        <Stepper etapes={ETAPES_RESTAURATION} courante={etape} onChange={setEtape} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <h2 className="type-h2">
            <span className="tnum mr-2 text-g-500">{etape}/4</span>
            {ETAPES_RESTAURATION[etape - 1].titre}
          </h2>

          {etape === 1 && (
            <div className="space-y-4">
              <p className="text-[13px] leading-relaxed text-g-700">
                Choisissez le niveau de granularité. C’est ici que se joue la valeur réelle du
                produit : restaurer une machine entière pour récupérer un seul fichier coûte des
                heures et perturbe la production.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {GRANULARITES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGranularite(g.id)}
                    className={cn(
                      'rounded-[8px] border-2 bg-white p-3.5 text-left transition-colors',
                      granularite === g.id
                        ? 'border-p-700 bg-p-050'
                        : 'border-g-300 hover:border-p-400',
                    )}
                  >
                    <span className="block text-[13px] font-semibold text-ink">{g.titre}</span>
                    <span className="mt-1 block text-[12px] leading-snug text-g-700">
                      {g.detail}
                    </span>
                  </button>
                ))}
              </div>
              <Field label="Ressource à restaurer">
                <Select value={ressource} onChange={(e) => setRessource(e.target.value)}>
                  {Array.from(new Set(RESTORE_POINTS.map((p) => p.resourceId))).map((rid) => {
                    const p = RESTORE_POINTS.find((x) => x.resourceId === rid)!
                    return (
                      <option key={rid} value={rid}>
                        {p.resourceNom} · {p.resourceType}
                      </option>
                    )
                  })}
                </Select>
              </Field>
              {granularite === 'fichiers' && (
                <Card className="bg-g-050">
                  <MicroLabel className="mb-2">Arborescence du point de restauration</MicroLabel>
                  <div className="rounded-[6px] border border-g-300 bg-white p-3 font-mono text-[12px] leading-relaxed">
                    <p className="text-g-500">/</p>
                    <p className="pl-3 text-g-500">srv/</p>
                    <p className="pl-6 text-g-500">uploads/</p>
                    <p className="pl-9 font-semibold text-p-700">comptabilite/ ← sélectionné</p>
                    <p className="pl-12 text-g-700">2026/ · 412 fichiers · 2,8 Go</p>
                    <p className="pl-12 text-g-700">2025/ · 1 284 fichiers · 9,1 Go</p>
                    <p className="pl-9 text-g-500">contrats/</p>
                    <p className="pl-9 text-g-500">exports/</p>
                    <p className="pl-3 text-g-500">var/</p>
                  </div>
                  <Field label="Chemin à restaurer" className="mt-3">
                    <Input
                      value={chemin}
                      onChange={(e) => setChemin(e.target.value)}
                      className="font-mono"
                    />
                  </Field>
                </Card>
              )}
            </div>
          )}

          {etape === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader
                  titre="Point de restauration"
                  sousTitre={`${RESTORE_POINTS.filter((p) => p.resourceId === ressource).length} point(s) disponible(s) pour cette ressource.`}
                />
                <div className="space-y-2">
                  {RESTORE_POINTS.filter((p) => p.resourceId === ressource).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPointId(p.id)}
                      className={cn(
                        'flex w-full flex-wrap items-center justify-between gap-3 rounded-[6px] border-2 px-3 py-2.5 text-left transition-colors',
                        pointId === p.id
                          ? 'border-p-700 bg-p-050'
                          : 'border-g-300 hover:border-p-400',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-ink">
                          {dateHeure(p.date)}
                        </span>
                        <span className="block text-[11px] text-g-500">
                          {p.type} · {goHumain(p.tailleGo)} · {p.destination}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1.5">
                        {p.immuableJusquau && (
                          <Badge tone="ok" size="sm">
                            Immuable
                          </Badge>
                        )}
                        <Badge tone={p.verifie ? 'ok' : 'warn'} size="sm">
                          {p.verifie ? 'Vérifié' : 'Non vérifié'}
                        </Badge>
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              {(granularite === 'base' || point.resourceType === 'Base managée') && (
                <Card>
                  <CardHeader
                    titre="Restauration à un instant précis"
                    sousTitre="La journalisation continue permet de choisir n’importe quel instant compris dans la fenêtre de rétention, à la seconde près."
                  />
                  <Field label="Instant cible" hint="heure GMT">
                    <Input
                      type="datetime-local"
                      value={pitr}
                      onChange={(e) => setPitr(e.target.value)}
                    />
                  </Field>
                  <p className="mt-2 text-[11.5px] text-g-500">
                    Fenêtre disponible : du {dateCourte('2026-08-05')} au {dateCourte('2026-08-19')}.
                    Utile pour revenir juste avant une suppression accidentelle sans perdre les
                    écritures qui l’ont précédée.
                  </p>
                </Card>
              )}
            </div>
          )}

          {etape === 3 && (
            <div className="space-y-3">
              {(
                [
                  ['meme', 'Même emplacement', 'Écrase les données actuelles. Le plus rapide, mais irréversible sur la ressource cible.'],
                  ['autre_espace', 'Autre Espace Cloud', 'Restaure dans un espace différent, sans toucher à la production. Recommandé pour vérifier avant de basculer.'],
                  ['autre_site', 'Autre site', 'Restaure sur le second site. Utile pour un test de reprise ou une migration.'],
                  ['local', 'Téléchargement local', 'Génère une archive téléchargeable, valable sept jours. Adapté à une extraction ponctuelle de fichiers.'],
                ] as const
              ).map(([v, l, d]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDestination(v)}
                  className={cn(
                    'w-full rounded-[8px] border-2 bg-white p-3.5 text-left transition-colors',
                    destination === v ? 'border-p-700 bg-p-050' : 'border-g-300 hover:border-p-400',
                  )}
                >
                  <span className="block text-[13px] font-semibold text-ink">{l}</span>
                  <span className="mt-1 block text-[12px] leading-snug text-g-700">{d}</span>
                </button>
              ))}
              {destination === 'meme' && (
                <Callout ton="warn" titre="Les données actuelles seront écrasées">
                  Une restauration sur le même emplacement remplace définitivement l’état courant.
                  Si vous n’êtes pas certain du contenu du point choisi, restaurez d’abord dans un
                  autre espace pour vérifier.
                </Callout>
              )}
            </div>
          )}

          {etape === 4 && (
            <div className="space-y-4">
              <Card>
                <CardHeader titre="Récapitulatif de la restauration" />
                <KeyValueList
                  colonnes={2}
                  items={[
                    { cle: 'Granularité', valeur: gran.titre },
                    { cle: 'Ressource', valeur: point.resourceNom },
                    ...(granularite === 'fichiers'
                      ? [{ cle: 'Chemin', valeur: <span className="font-mono text-[12px]">{chemin}</span> }]
                      : []),
                    { cle: 'Point de restauration', valeur: dateHeure(point.date) },
                    ...(granularite === 'base'
                      ? [{ cle: 'Instant cible (PITR)', valeur: pitr.replace('T', ' à ') }]
                      : []),
                    {
                      cle: 'Destination',
                      valeur: {
                        meme: 'Même emplacement (écrasement)',
                        autre_espace: 'Autre Espace Cloud',
                        autre_site: 'Autre site',
                        local: 'Téléchargement local',
                      }[destination],
                    },
                    { cle: 'Volume à transférer', valeur: goHumain(point.tailleGo) },
                    { cle: 'Durée estimée', valeur: dureeMin(dureeEstimee) },
                    {
                      cle: 'Impact sur la production',
                      valeur:
                        destination === 'meme'
                          ? 'Données actuelles remplacées'
                          : 'Aucun — restauration isolée',
                    },
                  ]}
                />
              </Card>
              <Card>
                <Checkbox
                  checked={confirme}
                  onChange={(e) => setConfirme(e.target.checked)}
                  label="Je confirme cette restauration"
                  description="L’opération est journalisée dans l’audit de l’organisation, avec l’acteur, le point choisi et la destination. Un job suivable est créé dans le centre de tâches."
                />
              </Card>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-g-100 pt-4">
            <Button variant="ghost" disabled={etape === 1} onClick={() => setEtape(etape - 1)}>
              Précédent
            </Button>
            {etape < 4 ? (
              <Button onClick={() => setEtape(etape + 1)}>Continuer</Button>
            ) : (
              <GatedAction autorise={autorise('backup.restore')} message={refus('backup.restore')}>
                <Button
                  disabled={!confirme}
                  onClick={() => {
                    executer({
                      action: 'backup.restore',
                      ton: 'info',
                      titre: 'Restauration lancée',
                      detail: `Durée estimée ${dureeMin(dureeEstimee)}. Suivi dans le centre de tâches.`,
                      job: {
                        type: 'backup.restore',
                        label: `Restauration ${point.resourceNom} · ${gran.titre.toLowerCase()}`,
                        etapes: [
                          'Monter le point de restauration',
                          granularite === 'fichiers'
                            ? 'Parcourir l’arborescence et extraire la sélection'
                            : 'Copier les données',
                          destination === 'meme'
                            ? 'Remplacer les données en place'
                            : 'Écrire sur la destination choisie',
                          'Vérifier l’intégrité du résultat',
                        ],
                      },
                    })
                    setEtape(1)
                    setConfirme(false)
                  }}
                >
                  Lancer la restauration
                </Button>
              </GatedAction>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <MicroLabel>Sélection</MicroLabel>
            <dl className="mt-2.5 space-y-1.5">
              <Petit cle="Granularité" valeur={gran.titre} />
              <Petit cle="Ressource" valeur={point.resourceNom} />
              <Petit cle="Point" valeur={dateCourte(point.date)} />
              <Petit cle="Volume" valeur={goHumain(point.tailleGo)} />
              <Petit cle="Durée estimée" valeur={dureeMin(dureeEstimee)} />
            </dl>
          </Card>
          <Callout ton="violet" titre="Un test de restauration mensuel">
            Nous restaurons chaque mois un échantillon de vos ressources et vérifions l’intégrité du
            résultat. Le rapport est daté et consultable dans l’onglet Conformité. Une sauvegarde qui
            n’a jamais été restaurée n’est qu’une hypothèse.
          </Callout>
        </aside>
      </div>
    </div>
  )
}

// ─── Conformité ───────────────────────────────────────────────────────

function OngletConformite() {
  const { autorise, refus } = useApp()
  const CONFORMITE_ITEMS = useCollection<ConformiteAvecId>('conformite-sauvegarde', CONFORMITE_AVEC_ID).items

  const colonnes: Array<Colonne<ConformiteLigne & { id: string }>> = [
    {
      id: 'ressource',
      entete: 'Ressource',
      cle: (c) => c.ressourceNom,
      rendu: (c) => (
        <span className="block">
          <span className="block text-[13px] font-medium text-ink">{c.ressourceNom}</span>
          <span className="block text-[11px] text-g-500">{c.type}</span>
        </span>
      ),
    },
    {
      id: 'protection',
      entete: 'État de protection',
      cle: (c) => c.protection,
      rendu: (c) => (
        <Badge
          tone={
            c.protection === 'protegee' ? 'ok' : c.protection === 'echec' ? 'err' : 'warn'
          }
          dot
          size="sm"
        >
          {c.protection === 'protegee'
            ? 'Protégée'
            : c.protection === 'echec'
              ? 'Échec'
              : 'Non protégée'}
        </Badge>
      ),
    },
    {
      id: 'succes',
      entete: 'Dernier succès',
      cle: (c) => c.dernierSucces ?? '',
      rendu: (c) => (c.dernierSucces ? dateHeure(c.dernierSucces) : '—'),
    },
    {
      id: 'rpo',
      entete: 'RPO constaté',
      aligne: 'right',
      cle: (c) => c.rpoConstateMin ?? 999999,
      rendu: (c) =>
        c.rpoConstateMin !== undefined ? (
          <span
            className={cn(
              'tnum font-semibold',
              c.rpoConstateMin > 1440 ? 'text-err' : c.rpoConstateMin > 60 ? 'text-warn' : 'text-ok',
            )}
          >
            {dureeMin(c.rpoConstateMin)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'regle321',
      entete: 'Règle 3-2-1',
      rendu: (c) => <Regle321 {...c.regle321} />,
    },
    {
      id: 'test',
      entete: 'Dernier test de restauration',
      cle: (c) => c.dernierTestRestauration?.date ?? '',
      rendu: (c) =>
        c.dernierTestRestauration ? (
          <span className="block">
            <span className="block text-[12px] text-ink">
              {dateCourte(c.dernierTestRestauration.date)}
            </span>
            <span className="block text-[11px]">
              <Badge tone={c.dernierTestRestauration.succes ? 'ok' : 'err'} size="sm">
                {c.dernierTestRestauration.succes
                  ? `réussi en ${dureeMin(c.dernierTestRestauration.dureeMin)}`
                  : 'échoué'}
              </Badge>
            </span>
          </span>
        ) : (
          <Badge tone="warn" size="sm">
            Jamais testé
          </Badge>
        ),
    },
  ]

  const lignes = CONFORMITE_ITEMS
  const conformes = CONFORMITE_ITEMS.filter(
    (c) => c.regle321.copies && c.regle321.supports && c.regle321.horsSite,
  ).length
  const testees = CONFORMITE_ITEMS.filter((c) => c.dernierTestRestauration?.succes).length
  const rpos = CONFORMITE_ITEMS.map((c) => c.rpoConstateMin).filter((v): v is number => v !== undefined).sort((a, b) => a - b)
  const rpoMedian = rpos.length ? rpos[Math.floor((rpos.length - 1) / 2)] : undefined

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          libelle="Conformes 3-2-1"
          valeur={`${conformes}/${CONFORMITE_ITEMS.length}`}
          ton={conformes === CONFORMITE_ITEMS.length ? 'ok' : 'warn'}
          detail={CONFORMITE_ITEMS.length ? pct(Math.round((conformes / CONFORMITE_ITEMS.length) * 100)) : undefined}
        />
        <StatTile
          libelle="Restauration testée avec succès"
          valeur={`${testees}/${CONFORMITE_ITEMS.length}`}
          ton="ok"
        />
        <StatTile
          libelle="RPO médian constaté"
          valeur={rpoMedian !== undefined ? dureeMin(rpoMedian) : '—'}
          detail="Toutes ressources protégées confondues"
        />
        <StatTile
          libelle="Ressources hors conformité"
          valeur={CONFORMITE_ITEMS.length - conformes}
          ton="warn"
        />
      </div>

      <Card padding={false}>
        <div className="px-4 pt-4">
          <CardHeader
            titre="Tableau de conformité"
            sousTitre="C’est cet écran que l’on montre à un auditeur : état de protection, RPO constaté, règle trois copies / deux supports / une hors site, et résultat du dernier test de restauration."
            actions={
              <BoutonAction
                libelle="Exporter le rapport de conformité"
                variant="primary"
                icone={<FileDown size={13} />}
                operation={{
                  action: 'compliance.export',
                  titre: 'Rapport de conformité exporté',
                  detail:
                    'PDF horodaté : état de protection, RPO constaté, règle 3-2-1 et dernier test de restauration par ressource.',
                  job: { workflow: 'export.plateforme', cible: 'conformité des sauvegardes' },
                }}
              />
            }
          />
        </div>
        <div className="px-4 pb-4">
          <DataTable
            lignes={lignes}
            colonnes={colonnes}
            parPage={14}
            placeholderRecherche="Rechercher une ressource…"
            filtres={[
              {
                id: 'protection',
                libelle: 'Protection',
                options: [
                  { value: 'protegee', label: 'Protégée' },
                  { value: 'non_protegee', label: 'Non protégée' },
                  { value: 'echec', label: 'Échec' },
                ],
              },
              {
                id: 'conformite',
                libelle: 'Règle 3-2-1',
                options: [
                  { value: 'oui', label: 'Conforme' },
                  { value: 'non', label: 'Non conforme' },
                ],
              },
            ]}
            selection={(c, id, v) => {
              if (id === 'protection') return c.protection === v
              const conforme = c.regle321.copies && c.regle321.supports && c.regle321.horsSite
              return v === 'oui' ? conforme : !conforme
            }}
            exportable
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout ton="err" titre="GED · Mayan : sauvegarde en échec">
          La dernière sauvegarde réussie remonte au 17 août, soit un RPO constaté de plus de 37
          heures pour une cible de 24 heures. L’instance est encore en provisioning, ce qui explique
          l’échec ; la protection deviendra effective à la fin du déploiement. Aucune action de votre
          part n’est requise.
        </Callout>
        <Callout ton="warn" titre="Deux ressources ne sont pas protégées du tout">
          <span className="font-mono text-[12px]">batch-worker-01</span> et{' '}
          <span className="font-mono text-[12px]">ci-runner-01</span> n’ont aucun plan appliqué. Pour
          des runners CI éphémères, c’est un choix défendable ; pour un worker de rapprochement
          bancaire, cela mérite une décision explicite et documentée.
        </Callout>
      </div>
    </div>
  )
}

function Petit({ cle, valeur }: { cle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[11.5px] text-g-500">{cle}</dt>
      <dd className="truncate text-right text-[11.5px] font-semibold text-ink">{valeur}</dd>
    </div>
  )
}

/**
 * Plans de reprise, en accès depuis les sauvegardes : les deux répondent à la
 * même question — que se passe-t-il quand on perd quelque chose — mais à deux
 * échelles, le fichier et le site.
 */
function OngletReprise() {
  const DR_PLANS_ITEMS = useCollection<DRPlan>('plans-pra', DR_PLANS).items
  return (
    <div className="space-y-4">
      <Callout ton="info" titre="Sauvegarde et reprise ne se remplacent pas">
        Une sauvegarde restaure un état passé, en quelques minutes à quelques heures. Un plan de
        reprise redémarre tout un périmètre sur l’autre site, dans un ordre défini, avec un
        engagement de délai. Le premier couvre l’erreur, le second couvre la perte du site.
      </Callout>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {DR_PLANS_ITEMS.map((p) => {
          const dernier = p.exercices[0]
          return (
            <Card key={p.id}>
              <CardHeader
                titre={
                  <span className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/app/pra/${p.id}`}
                      className="font-mono text-[14px] font-bold text-ink hover:text-p-700"
                    >
                      {p.nom}
                    </Link>
                    <Badge
                      tone={
                        p.statut === 'operationnel'
                          ? 'ok'
                          : p.statut === 'degrade'
                            ? 'warn'
                            : 'err'
                      }
                      size="sm"
                      dot
                    >
                      {p.statut === 'operationnel'
                        ? 'Opérationnel'
                        : p.statut === 'degrade'
                          ? 'Dégradé'
                          : 'Jamais testé'}
                    </Badge>
                  </span>
                }
                sousTitre={`${SITE_COURT[p.siteSource]} → ${SITE_COURT[p.siteRepli]} · ${p.groupes.length} groupes de démarrage · réplication ${p.replication.mode === 'continu' ? 'continue' : 'planifiée'}`}
                actions={
                  <ButtonLink href={`/app/pra/${p.id}`} variant="secondary" size="sm">
                    Ouvrir le plan
                  </ButtonLink>
                }
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RpoRtoGauge
                  libelle="RPO — perte de données admise"
                  cibleMin={p.rpoCibleMin}
                  constateMin={p.rpoConstateMin}
                />
                <RpoRtoGauge
                  libelle="RTO — délai de remise en service"
                  cibleMin={p.rtoCibleMin}
                  constateMin={p.rtoConstateMin}
                />
              </div>
              {dernier && (
                <p className="mt-3 border-t border-g-100 pt-2.5 text-[11.5px] text-g-500">
                  Dernier exercice {dernier.type === 'test' ? 'de test' : 'réel'} le {dernier.date} —{' '}
                  {dernier.succes ? 'réussi' : 'échoué'}, RTO constaté {dernier.rtoConstateMin} min.
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
