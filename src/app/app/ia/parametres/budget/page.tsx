'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { dateCourte, jetons, money, num, pct } from '@/lib/format'
import {
  ALERTES_IA,
  BUDGET_IA,
  CLES_IA,
  COMPARAISON_SOUVERAIN,
  CONSOMMATION_IA_JOURS,
  CONSOMMATION_PAR_CLE,
  CONSOMMATION_PAR_MODELE,
  QUOTAS_DEPARTEMENT,
  modeleParSlug,
} from '@/lib/mock'
import type { AlerteRegle } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Slider, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { QuotaBar, StackedBar, StatTile } from '@/components/composition/metrics'
import { PermissionDenied } from '@/components/composition/states'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire } from '@/components/app/actions'
import { creerRessource } from '@/lib/api/client'

/** Mêmes champs que le formulaire d'alerte d'Observabilité (`/observabilite/alertes`) :
 * une alerte de budget IA est une règle d'alerte comme une autre, seule sa cible diffère. */
const CHAMPS_ALERTE_BUDGET = [
  { id: 'metrique', label: 'Métrique', placeholder: 'Dépense mensuelle IA', obligatoire: true },
  { id: 'cible', label: 'Portée', placeholder: 'Organisation, une clé, un agent…', obligatoire: true },
  { id: 'seuil', label: 'Seuil', placeholder: '80 % du plafond', demi: true, obligatoire: true },
  {
    id: 'plage',
    label: 'Plage horaire',
    type: 'select' as const,
    demi: true,
    options: [
      { value: '24 h / 24', label: '24 h / 24' },
      { value: 'Heures ouvrées', label: 'Heures ouvrées' },
    ],
  },
  {
    id: 'canal',
    label: 'Canal de notification',
    type: 'select' as const,
    options: [
      { value: 'email', label: 'Courriel' },
      { value: 'sms', label: 'SMS' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'webhook', label: 'Webhook' },
    ],
  },
  { id: 'actif', label: 'Active', type: 'switch' as const, placeholder: 'Alerte armée' },
]

interface LigneJour {
  id: string
  date: string
  jetonsEntree: number
  jetonsSortie: number
  jetonsExternes: number
  requetes: number
  montant: number
}

const JOURS: LigneJour[] = CONSOMMATION_IA_JOURS.map((j) => ({ id: j.date, ...j }))

export default function BudgetEtAlertes() {
  const { autorise, refus, pousser } = useApp()
  const [plafond, setPlafond] = useState(BUDGET_IA.plafondMensuel)
  const [bloquer, setBloquer] = useState(BUDGET_IA.bloquerAuPlafond)
  const peutBudgeter = autorise('ia.budget.update')
  const alertes = useCollection<AlerteRegle>('regles-alertes', ALERTES_IA)

  const controlesBudget = (
    <>
      <QuotaBar
        libelle="Dépense du mois"
        utilise={BUDGET_IA.consomme}
        total={plafond}
        seuil={BUDGET_IA.seuilAlertePct}
        formateur={(v) => money(v)}
      />
      <Slider
        label="Plafond mensuel"
        value={plafond}
        onChange={setPlafond}
        min={100_000}
        max={1_500_000}
        step={50_000}
        unite="FCFA"
      />
      <Switch
        checked={bloquer}
        onChange={setBloquer}
        label="Couper les appels au plafond"
        description="Au plafond, la passerelle répond 402 sur toutes les clés. Sans cette coupure, la dépense continue et la facture arrive à la fin du mois."
      />
    </>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Paramètres', href: '/app/ia/parametres' },
          { label: 'Budget & alertes' },
        ]}
        titre="Budget, alertes et quotas"
        sousTitre="Le plafond porte sur l’ensemble de l’organisation ; chaque clé et chaque direction garde en plus le sien. C’est le seul de ces réglages qui coupe réellement le service — les autres se contentent d’alerter."
      />

      <Card>
        <CardHeader
          titre="Plafond de dépense"
          sousTitre="Le plafond porte sur l’ensemble de l’organisation ; chaque clé garde en plus le sien."
          actions={
            <GatedAction autorise={peutBudgeter} message={refus('ia.budget.update')}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  pousser({ ton: 'ok', titre: 'Plafond enregistré', detail: money(plafond) })
                }
              >
                Enregistrer
              </Button>
            </GatedAction>
          }
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Le plafond est un réglage, pas un bouton : le griser au moyen de
              l'état « droits insuffisants » dit mieux la raison qu'une infobulle
              sur chaque curseur. */}
          {peutBudgeter ? (
            <div className="space-y-4">{controlesBudget}</div>
          ) : (
            <PermissionDenied message={refus('ia.budget.update')}>
              <div className="space-y-4">{controlesBudget}</div>
            </PermissionDenied>
          )}
          <div className="space-y-3">
            <Callout
              ton={BUDGET_IA.prevision > plafond ? 'warn' : 'ok'}
              titre={
                BUDGET_IA.prevision > plafond
                  ? 'La prévision dépasse le plafond'
                  : 'La prévision tient dans le plafond'
              }
            >
              À ce rythme, le mois se terminera à {money(BUDGET_IA.prevision)}, soit{' '}
              {pct((BUDGET_IA.prevision / plafond) * 100)} du plafond.{' '}
              {bloquer
                ? 'La coupure étant active, les appels s’arrêteront avant la fin du mois si le rythme se maintient.'
                : 'Aucune coupure n’est prévue : le dépassement passera en facturation.'}
            </Callout>
            <Callout ton="violet" titre="Trois leviers, dans l’ordre d’efficacité">
              Router davantage de trafic vers un modèle souverain, réduire la taille des consignes
              renvoyées à chaque appel, puis activer la mise en cache des consignes système — elle
              retire déjà 2 840 jetons non refacturés par appel sur la clé de production.
            </Callout>
          </div>
        </div>
      </Card>


      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre="Quotas par direction"
            sousTitre="Le plafond de l’organisation se répartit entre les directions métier. Une direction qui atteint le sien n’entame pas celui des autres."
          />
          <div className="space-y-3.5">
            {QUOTAS_DEPARTEMENT.map((d) => (
              <div key={d.departement}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{d.departement}</span>
                  <span className="tnum text-[11px] text-g-500">
                    {d.utilisateurs} utilisateurs · {d.cles} clé{d.cles > 1 ? 's' : ''}
                  </span>
                </div>
                <QuotaBar
                  utilise={d.consomme}
                  total={d.quotaMensuel}
                  compact
                  seuil={85}
                  formateur={(v) => money(v)}
                  className="mt-1.5"
                />
              </div>
            ))}
          </div>
          <Callout ton="info" className="mt-4" titre="Le commerce consomme 10 % de son quota">
            Son agent est encore en brouillon : le quota a été posé avant que l’usage existe. Un
            quota inutilisé n’est pas gratuit — il immobilise une part du plafond que les autres
            directions ne peuvent pas prendre.
          </Callout>
        </Card>

        <Card padding={false}>
          <div className="border-b border-g-100 px-4 py-3">
            <CardHeader
              titre="Alertes de seuil"
              sousTitre="Ce qui déclenche une notification, et vers qui."
              className="mb-0"
            />
          </div>
          <div className="divide-y divide-g-100">
            {alertes.items.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{a.metrique}</span>
                    <span className="block text-[12px] text-g-500">
                      {a.cible} · seuil : {a.seuil}
                    </span>
                  </span>
                  <Badge tone={a.actif ? 'ok' : 'neutral'} dot size="sm">
                    {a.actif ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {a.canaux.map((c) => (
                    <Badge key={c} tone="neutral" size="sm">
                      {c === 'email'
                        ? 'E-mail'
                        : c === 'sms'
                          ? 'SMS'
                          : c === 'whatsapp'
                            ? 'WhatsApp'
                            : 'Webhook'}
                    </Badge>
                  ))}
                  <span className="text-[11px] text-g-500">· {a.plage}</span>
                </div>
                {a.escalade && (
                  <p className="mt-1.5 text-[12px] text-g-500">Escalade : {a.escalade}</p>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-g-100 px-4 py-3">
            <BoutonFormulaire
              libelle="Ajouter une alerte"
              size="sm"
              variant="secondary"
              action="ia.budget.update"
              titre="Ajouter une alerte de seuil"
              description="Une règle d’alerte comme les autres — la même mécanique que celle utilisée par Observabilité, ici appliquée à un seuil de dépense ou de quota IA."
              champs={CHAMPS_ALERTE_BUDGET}
              valeursDepart={{ plage: '24 h / 24', canal: 'email', actif: true }}
              libelleValider="Ajouter"
              operation={(v) => {
                const idAlerte = alertes.identifiant('alerte')
                return {
                  titre: `Alerte « ${v.metrique} » ajoutée`,
                  detail: `${v.seuil} · ${v.canal}`,
                  appel: () =>
                    creerRessource('/observabilite/alertes', {
                      cible: String(v.cible),
                      metrique: String(v.metrique),
                      seuil: String(v.seuil),
                      canaux: [v.canal as AlerteRegle['canaux'][number]],
                      plage: String(v.plage),
                      actif: Boolean(v.actif),
                    }),
                  effet: () =>
                    alertes.creer({
                      id: idAlerte,
                      cible: String(v.cible),
                      metrique: String(v.metrique),
                      seuil: String(v.seuil),
                      canaux: [v.canal as AlerteRegle['canaux'][number]],
                      plage: String(v.plage),
                      actif: Boolean(v.actif),
                    }),
                  effetFinal: () => alertes.recharger(),
                }
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
