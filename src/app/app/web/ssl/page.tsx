'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertTriangle, ShieldCheck, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAINTENANT, dateCourte, money } from '@/lib/format'
import {
  CERTIFICATS,
  OFFRES_CERTIFICAT,
  TYPE_CERTIFICAT_LABEL,
  joursAvant,
  type Certificat,
  type TypeCertificat,
} from '@/lib/mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Field, Input, Select } from '@/components/ui/field'
import { PageHeader, Card, CardHeader, Callout } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

export default function ListeCertificats() {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const collection = useCollection<Certificat>('certificats', CERTIFICATS)
  const [hote, setHote] = useState('')
  const [typeCert, setTypeCert] = useState<TypeCertificat>('letsencrypt')
  const payants = collection.items.filter((c) => c.prixAnnuel > 0)
  const sansAuto = collection.items.filter((c) => !c.renouvellementAuto && c.etat === 'actif')
  const proches = collection.items.filter((c) => joursAvant(c.expire) <= 30 && c.etat === 'actif')

  /** Commande d'un certificat : émission puis pose sur l'hôte visé. */
  const commander = (cible: string, type: TypeCertificat) => {
    const offre = OFFRES_CERTIFICAT.find((o) => o.type === type)
    const nouveau = collection.identifiant('cert')
    return {
      action: 'service.admin' as const,
      titre: `Certificat pour ${cible} commandé`,
      detail:
        offre && offre.prix > 0
          ? `${offre.nom} · ${money(offre.prix)} par an. La validation d’organisation demande des pièces justificatives.`
          : 'Émission immédiate, renouvellement automatique compris.',
      // `validationDomaine` est exigée par le contrat ; un joker ne se
      // valide que par DNS, le reste par HTTP.
      appel: () =>
        creerRessource('/web/ssl', {
          hote: cible,
          type,
          validationDomaine: type === 'wildcard' ? 'dns' : 'http',
          renouvellementAuto: true,
        }),
      effet: () =>
        collection.creer({
          id: nouveau,
          hote: cible,
          type,
          emetteur: type === 'letsencrypt' ? 'Let’s Encrypt' : 'Sectigo',
          emisLe: MAINTENANT.slice(0, 10),
          expire: type === 'letsencrypt' ? '2026-11-17' : '2027-08-19',
          renouvellementAuto: true,
          prixAnnuel: offre?.prix ?? 0,
          etat: 'en_emission',
          algorithme: 'ECDSA P-256',
          validationDomaine: type === 'letsencrypt' ? 'http' : 'dns',
        }),
      job: {
        type: 'certificat.order',
        label: `Émission du certificat · ${cible}`,
        etapes: [
          'Vérifier le contrôle du domaine',
          ...(offre && offre.prix > 0 ? ['Transmettre le dossier à l’autorité'] : []),
          'Récupérer le certificat',
          'Installer sur l’hôte',
        ],
        dureeEtapeMs: 1100,
      },
      effetFinal: () => {
        if (estActif()) {
          collection.recharger()
          return
        }
        collection.modifier(nouveau, { etat: 'actif' })
      },
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Web Cloud', href: '/app/web' },
          { label: 'SSL' },
        ]}
        titre="Certificats TLS"
        sousTitre="Let’s Encrypt est posé et renouvelé sans rien demander. Les certificats à validation d’organisation ou joker se commandent ici, et se posent sur les hôtes que vous désignez."
        actions={
          <BoutonFormulaire
            libelle="Commander un certificat"
            size="md"
            variant="primary"
            icone={<ShoppingCart size={14} />}
            action="service.admin"
            titre="Commander un certificat TLS"
            description="Le gratuit convient à presque tout. Les payants servent quand il faut une garantie financière, le nom de l’entreprise dans le certificat, ou tous les sous-domaines d’un coup."
            champs={[
              { id: 'hote', label: 'Hôte à couvrir', placeholder: 'boutique.dba.africa', obligatoire: true },
              {
                id: 'type',
                label: 'Type',
                type: 'select',
                options: OFFRES_CERTIFICAT.map((o) => ({
                  value: o.type,
                  label: `${o.nom} — ${o.prix === 0 ? 'inclus' : `${money(o.prix)} / an`}`,
                })),
              },
            ]}
            valeursDepart={{ type: 'letsencrypt' }}
            libelleValider="Commander"
            operation={(v) => commander(String(v.hote), v.type as TypeCertificat)}
          />
        }
      />

      {(sansAuto.length > 0 || proches.length > 0) && (
        <Callout
          ton={sansAuto.length > 0 ? 'err' : 'warn'}
          titre={
            sansAuto.length > 0
              ? `${sansAuto.length} certificat sans renouvellement automatique`
              : `${proches.length} certificat arrive à échéance`
          }
        >
          <ul className="mt-1 space-y-1">
            {[...sansAuto, ...proches.filter((c) => c.renouvellementAuto)].map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  <Link href={`/app/web/ssl/${c.id}`} className="font-mono font-semibold underline">
                    {c.hote}
                  </Link>
                  <span className="ml-1.5 text-g-700">
                    expire dans {joursAvant(c.expire)} jours
                    {c.renouvellementAuto ? '' : ' et ne se renouvellera pas seul'}.
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Certificats actifs"
          valeur={collection.items.filter((c) => c.etat === 'actif').length}
          detail={`${collection.items.filter((c) => c.etat === 'en_emission').length} en émission`}
        />
        <StatTile
          libelle="Gratuits"
          valeur={collection.items.filter((c) => c.prixAnnuel === 0).length}
          detail="Let’s Encrypt"
          ton="ok"
        />
        <StatTile
          libelle="Payants"
          valeur={payants.length}
          detail={`${money(payants.reduce((a, c) => a + c.prixAnnuel, 0))} / an`}
        />
        <StatTile
          libelle="Échéance la plus proche"
          valeur={`${Math.min(...collection.items.map((c) => joursAvant(c.expire)))} j`}
          ton="warn"
        />
      </div>

      <Card padding={false}>
        <div className="border-b border-g-100 px-4 py-3">
          <p className="text-[13px] font-bold text-ink">Certificats posés</p>
          <p className="mt-0.5 text-[12px] text-g-500">
            Choisissez-en un dans le panneau pour voir sa chaîne, ses hôtes et son historique.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-g-300 bg-g-050">
                {['Hôte', 'Type', 'Émetteur', 'Émis le', 'Expire le', 'Restant', 'Renouvellement', 'Coût', ''].map(
                  (c) => (
                    <th key={c} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                      {c}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {collection.items.map((c) => {
                const j = joursAvant(c.expire)
                return (
                  <tr key={c.id} className="border-b border-g-100 last:border-0">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/app/web/ssl/${c.id}`}
                        className="font-mono text-[13px] font-semibold text-ink hover:text-p-700"
                      >
                        {c.hote}
                      </Link>
                      {c.hotesSupplementaires && (
                        <span className="mt-0.5 block font-mono text-[11px] text-g-500">
                          + {c.hotesSupplementaires.join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={c.prixAnnuel === 0 ? 'ok' : 'violet'} size="sm">
                        {TYPE_CERTIFICAT_LABEL[c.type]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{c.emetteur}</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{dateCourte(c.emisLe)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-g-700">{dateCourte(c.expire)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'tnum text-[12px] font-bold',
                          j <= 14 ? 'text-err' : j <= 30 ? 'text-warn' : 'text-g-700',
                        )}
                      >
                        {j} j
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={c.renouvellementAuto ? 'ok' : 'err'} size="sm">
                        {c.renouvellementAuto ? 'Automatique' : 'Manuel'}
                      </Badge>
                    </td>
                    <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                      {c.prixAnnuel === 0 ? 'Inclus' : `${money(c.prixAnnuel)} / an`}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/app/web/ssl/${c.id}`}
                        className="text-[12px] font-semibold text-p-700 hover:underline"
                      >
                        Gérer →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          titre="Commander un certificat"
          sousTitre="Le gratuit convient à presque tout. Les payants servent quand il faut une garantie financière, le nom de l’entreprise dans le certificat, ou tous les sous-domaines d’un coup."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <Field label="Hôte à couvrir" className="min-w-0 sm:flex-1">
            <Input
              value={hote}
              onChange={(e) => setHote(e.target.value)}
              placeholder="boutique.dba.africa"
            />
          </Field>
          <Field label="Type" className="w-56">
            <Select
              value={typeCert}
              onChange={(e) => setTypeCert(e.target.value as TypeCertificat)}
            >
              {OFFRES_CERTIFICAT.map((o) => (
                <option key={o.type} value={o.type}>
                  {o.nom} — {o.prix === 0 ? 'inclus' : `${money(o.prix)} / an`}
                </option>
              ))}
            </Select>
          </Field>
          <Button disabled={!hote.trim()} onClick={() => executer(commander(hote.trim(), typeCert))}>
            Vérifier et commander
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OFFRES_CERTIFICAT.map((o) => (
            <div
              key={o.type}
              className={cn(
                'rounded-[8px] border p-3',
                o.prix === 0 ? 'border-ok bg-ok-bg' : 'border-g-300 bg-white',
              )}
            >
              <p className="flex items-center gap-1.5 text-p-700">
                <ShieldCheck size={14} />
                <span className="text-[13px] font-bold text-ink">{o.nom}</span>
              </p>
              <p className="tnum mt-1.5 text-[16px] font-bold text-ink">
                {o.prix === 0 ? 'Inclus' : `${money(o.prix)}`}
                {o.prix > 0 && <span className="text-[11px] font-semibold text-g-500"> / an</span>}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-g-700">{o.pour}</p>
              <dl className="mt-2 space-y-0.5 border-t border-g-100 pt-2 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-g-500">Délai</dt>
                  <dd className="text-right font-semibold text-ink">{o.delai}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-g-500">Garantie</dt>
                  <dd className="text-right font-semibold text-ink">{o.garantie}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <Callout ton="info" className="mt-3" titre="Un certificat payant ne chiffre pas mieux">
          Le chiffrement est identique. Ce que vous achetez, c’est une vérification d’identité par
          l’autorité et une garantie financière — utile pour une boutique, inutile pour un blog.
        </Callout>
      </Card>
    </div>
  )
}
