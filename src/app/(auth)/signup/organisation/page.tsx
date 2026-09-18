'use client'

import { useState } from 'react'
import { ArrowRight, Building2, Check, X } from 'lucide-react'
import { cn, slugify } from '@/lib/utils'
import { TVA_PCT } from '@/lib/format'
import { PAYS, SECTEURS, TAILLES_ORG } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Checkbox, Field, Input, Select } from '@/components/ui/field'
import { Callout } from '@/components/composition/card'

const REGEX_DOMAINE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z]{2,})+$/

export default function CreationOrganisation() {
  const [nom, setNom] = useState('')
  const [pays, setPays] = useState(PAYS[0])
  const [secteur, setSecteur] = useState('')
  const [tva, setTva] = useState('')
  const [taille, setTaille] = useState('')
  const [domaine, setDomaine] = useState('')
  const [conditions, setConditions] = useState(false)

  const domaineValide = domaine === '' || REGEX_DOMAINE.test(domaine.trim().toLowerCase())
  const complet =
    nom.trim().length >= 2 && secteur !== '' && taille !== '' && domaineValide && conditions

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-h1">Créer votre organisation</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-g-500">
          C’est ici que naît votre tenant : l’enveloppe qui contiendra vos Espaces Cloud, vos
          applications, vos services et votre facturation.
        </p>
      </div>

      <div className="space-y-4 rounded-[10px] border border-g-300 bg-white p-5">
        <Field label="Nom de l’organisation" required>
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Digital Business Africa"
            iconBefore={<Building2 size={14} />}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pays" required>
            <Select value={pays} onChange={(e) => setPays(e.target.value)}>
              {PAYS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Secteur d’activité" required>
            <Select value={secteur} onChange={(e) => setSecteur(e.target.value)}>
              <option value="">Sélectionner…</option>
              {SECTEURS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Numéro de TVA" hint="facultatif">
            <Input
              value={tva}
              onChange={(e) => setTva(e.target.value)}
              placeholder="CI-2019-4472-B"
            />
          </Field>
          <Field label="Taille de l’organisation" required>
            <Select value={taille} onChange={(e) => setTaille(e.target.value)}>
              <option value="">Sélectionner…</option>
              {TAILLES_ORG.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Domaine principal"
          hint="facultatif — utilisé pour vos URL et vos e-mails"
          error={domaineValide ? undefined : 'Format attendu : mon-organisation.ci'}
        >
          <Input
            value={domaine}
            onChange={(e) => setDomaine(e.target.value.toLowerCase())}
            placeholder="mon-organisation.ci"
            suffix={
              domaine === '' ? undefined : domaineValide ? (
                <Check size={13} className="text-ok" />
              ) : (
                <X size={13} className="text-err" />
              )
            }
          />
        </Field>

        <div className="border-t border-g-100 pt-4">
          <Checkbox
            checked={conditions}
            onChange={(e) => setConditions(e.target.checked)}
            label="J’accepte les conditions générales de vente et la politique de confidentialité"
            description={`Montants hors taxes en FCFA, TVA ${TVA_PCT} % appliquée à la facturation. Aucun engagement en mensuel.`}
          />
        </div>
      </div>

      <div className="rounded-[10px] border border-p-300 bg-p-050 p-4">
        <MicroLabel className="text-p-700">Ce qui va être créé</MicroLabel>
        <dl className="mt-2.5 space-y-2">
          <Recap cle="Organisation" valeur={nom.trim() || '—'} />
          <Recap cle="Type de contrat" valeur="Direct avec Synelia Cloud" />
          <Recap
            cle="Identifiant technique"
            valeur={nom.trim() ? `org-${slugify(nom).slice(0, 18)}` : '—'}
            mono
          />
          <Recap cle="Votre rôle" valeur="Org Admin — tous les droits sur l’organisation" />
          <Recap cle="Zone de facturation" valeur={`${pays} · FCFA (XOF) · TVA ${TVA_PCT} %`} />
          <Recap cle="Résidence des données" valeur="Abidjan (Synertech Vallon) par défaut" />
        </dl>
      </div>

      {complet ? (
        <ButtonLink href="/app" size="lg" fullWidth iconAfter={<ArrowRight size={15} />}>
          Créer mon organisation
        </ButtonLink>
      ) : (
        <Button size="lg" fullWidth disabled iconAfter={<ArrowRight size={15} />}>
          Créer mon organisation
        </Button>
      )}

      <Callout ton="info" titre="Vous pourrez tout modifier ensuite">
        Le nom, le secteur, les coordonnées de facturation et la résidence par défaut se modifient
        depuis les paramètres de l’organisation. Le type de tenant, en revanche, nécessite
        l’intervention de nos équipes.
      </Callout>
    </div>
  )
}

function Recap({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-[12px] text-g-500">{cle}</dt>
      <dd
        className={cn(
          'min-w-0 text-right text-[12px] font-semibold text-ink',
          mono && 'font-mono text-[12px]',
        )}
      >
        {valeur}
      </dd>
    </div>
  )
}
