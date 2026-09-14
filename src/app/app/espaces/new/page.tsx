'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Check, Network, Server, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num, ventilationTva } from '@/lib/format'
import { MAINTENANT } from '@/lib/format'
import { SITE_LABEL, type EspaceCloud, type Site } from '@/lib/types'
import type { BackupPlan, Offer } from '@/lib/types'
import { BACKUP_PLANS, ESPACES, OFFRES } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { CostPreview, WizardShell } from '@/components/composition/flow'
import { BoutonPrepaiementPaystack } from '@/components/composition/paystack'
import { useApp } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

const ETAPES = [
  { numero: 1, titre: 'Offre' },
  { numero: 2, titre: 'Site' },
  { numero: 3, titre: 'Réseau' },
  { numero: 4, titre: 'Options' },
  { numero: 5, titre: 'Récapitulatif' },
]

const LATENCE: Record<Site, string> = {
  ABJ: '2 à 4 ms depuis Abidjan · 6 à 9 ms depuis Grand-Bassam',
  GBM: '4 à 6 ms depuis Abidjan · 1 à 3 ms depuis Grand-Bassam',
}

/** « 12 vCPU · 48 Go · 2 To » → quota exploitable. */
function quotaDepuisSpecs(specs: string) {
  const nombres = specs.match(/[\d.]+/g) ?? []
  return {
    vcpu: Number(nombres[0] ?? 12),
    ramGo: Number(nombres[1] ?? 48),
    stockageTo: Number(nombres[2] ?? 2),
  }
}

export default function NouvelEspace() {
  const router = useRouter()
  const { pousser } = useApp()
  const espaces = useCollection<EspaceCloud>('espaces', ESPACES)
  // Même correctif que `offerId` un peu plus bas : la validation d'unicité du
  // code, la liste de peering et la plage CIDR affichée lisaient `ESPACES` (la
  // graine figée) au lieu du vrai parc — un code déjà pris côté API aurait pu
  // passer la validation locale et échouer seulement à l'appel.
  const espacesReels = espaces.items
  const plansSauvegarde = useCollection<BackupPlan>('plans-sauvegarde', BACKUP_PLANS)
  const { lancerJob } = useAtelier()
  // En mode API, les prix viennent du catalogue réel (`/admin/catalogue`) au
  // lieu de la graine figée : un tarif changé côté admin doit se refléter ici.
  const offresCollection = useCollection<Offer>('offres', OFFRES)
  const OFFRES_ESPACE = useMemo(
    () =>
      offresCollection.items.filter((o) => o.categorie === 'espace_cloud' && o.statut === 'publiee'),
    [offresCollection.items],
  )
  const executer = useOperation()

  const [etape, setEtape] = useState(1)
  const [offerId, setOfferId] = useState('')
  // `OFFRES_ESPACE` arrive après le premier rendu en mode API (`useCollection`
  // charge dans un effet) : un `offerId` par défaut figé sur un id de maquette
  // survivait jusqu'à la création si l'utilisateur ne cliquait pas une carte —
  // `offerId: "off-flex"` inconnu du vrai catalogue, la facture créée n'avait
  // alors aucun `offreNom` à afficher. On resynchronise dès que la vraie liste
  // arrive, tant que l'utilisateur n'a pas déjà choisi une offre qui y figure.
  useEffect(() => {
    if (OFFRES_ESPACE.length === 0) return
    if (!OFFRES_ESPACE.some((o) => o.id === offerId)) setOfferId(OFFRES_ESPACE[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [OFFRES_ESPACE])
  const [site, setSite] = useState<Site>('ABJ')
  const [code, setCode] = useState('EC-DBA-04')
  const [cidr, setCidr] = useState('10.6.0.0/22')
  const [dnsInterne, setDnsInterne] = useState(true)
  const [peering, setPeering] = useState('')
  const [planSauvegarde, setPlanSauvegarde] = useState('bp-prod-quotidien')
  const [supervision, setSupervision] = useState(true)
  const [pra, setPra] = useState(false)
  const [periodicite, setPeriodicite] = useState<'mensuelle' | 'annuelle'>('mensuelle')
  const [conditions, setConditions] = useState(false)

  // `offerId` reste vide le temps que l'effet ci-dessus synchronise sur la
  // liste réelle (un seul rendu, en mode API) : retomber sur la première
  // offre plutôt que planter sur un `find` vide.
  const offre = OFFRES_ESPACE.find((o) => o.id === offerId) ?? OFFRES_ESPACE[0]

  const lignes = useMemo(() => {
    const l = [
      {
        libelle: `${offre.nom} · ${offre.specs}`,
        detail: `Site ${site} · plage ${cidr}`,
        montant: offre.prix,
      },
    ]
    if (planSauvegarde !== 'aucun') {
      l.push({
        libelle: 'Sauvegarde incluse dans l’offre',
        detail: plansSauvegarde.items.find((p) => p.id === planSauvegarde)?.nom ?? '',
        montant: 0,
      })
    }
    if (pra) {
      l.push({
        libelle: 'Option PRA inter-site',
        detail: `Réplication vers ${site === 'ABJ' ? 'Grand-Bassam' : 'Abidjan'}`,
        montant: 96000,
      })
    }
    return l
  }, [offre, site, cidr, planSauvegarde, pra, plansSauvegarde.items])

  const montantTtc = useMemo(() => {
    const mensuelHt = lignes.reduce((a, l) => a + l.montant, 0)
    const remise = periodicite === 'annuelle' ? Math.round((mensuelHt * 15) / 100) : 0
    const { total } = ventilationTva(mensuelHt - remise)
    return total
  }, [lignes, periodicite])
  const [paye, setPaye] = useState(false)

  const codeValide = /^EC-[A-Z0-9]{2,6}-\d{2}$/.test(code) && !espacesReels.some((e) => e.code === code)
  const cidrValide = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}\/(2[0-4]|1[6-9])$/.test(cidr)

  const peutContinuer =
    etape === 3 ? codeValide && cidrValide : etape === 5 ? conditions : true

  // Catalogue réel pas encore chargé (mode API, premier rendu) : un état
  // d'attente plutôt qu'un plantage sur `offre.specs`/`offre.prix` undefined.
  if (!offre) {
    return (
      <div className="space-y-4">
        <PageHeader
          fil={[{ label: 'Espace client', href: '/app' }, { label: 'Espaces Cloud', href: '/app/espaces' }, { label: 'Nouvel Espace Cloud' }]}
          titre="Nouvel Espace Cloud"
        />
        <Card>
          <p className="text-[12.5px] text-g-500">Chargement du catalogue…</p>
        </Card>
      </div>
    )
  }

  return (
    <WizardShell
      etapes={ETAPES}
      courante={etape}
      onChange={setEtape}
      titre={ETAPES[etape - 1].titre}
      panneau={
        <>
          <Card>
            <MicroLabel>Configuration</MicroLabel>
            <dl className="mt-2.5 space-y-1.5">
              <Petit cle="Offre" valeur={offre.nom} />
              <Petit cle="Code" valeur={code} mono />
              <Petit cle="Site" valeur={site === 'ABJ' ? 'Abidjan' : 'Grand-Bassam'} />
              <Petit cle="Plage réseau" valeur={cidr} mono />
              <Petit cle="vCPU · Mémoire" valeur={offre.specs} />
              <Petit cle="PRA inter-site" valeur={pra ? 'Activé' : 'Non'} />
            </dl>
          </Card>
          <CostPreview lignes={lignes} periodicite={periodicite} />
        </>
      }
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => (etape === 1 ? router.push('/app/espaces') : setEtape(etape - 1))}
          >
            {etape === 1 ? 'Annuler' : 'Précédent'}
          </Button>
          {etape < 5 ? (
            <Button disabled={!peutContinuer} onClick={() => setEtape(etape + 1)}>
              Continuer
            </Button>
          ) : estActif() && !paye ? (
            conditions ? (
              <BoutonPrepaiementPaystack
                montant={montantTtc}
                libelle={`Espace Cloud ${code}`}
                onSuccess={() => setPaye(true)}
              />
            ) : (
              <Button disabled>Payer maintenant (carte / mobile money)</Button>
            )
          ) : (
            <Button
              disabled={!conditions}
              onClick={() => {
                // En mode API la création part au backend (`202` + travail
                // suivi dans le centre de tâches) ; sinon la maquette simule.
                if (estActif()) {
                  executer({
                    action: 'espace.create',
                    titre: `Création de ${code} lancée`,
                    detail:
                      'Le quota est réservé, la plage réseau allouée. Suivi dans le centre de tâches.',
                    appel: () =>
                      creerRessource('/espaces', {
                        code,
                        offerId,
                        site,
                        cidr,
                        quota: quotaDepuisSpecs(offre.specs),
                        dnsInterne: dnsInterne
                          ? `${code.toLowerCase()}.interne.synelia.cloud`
                          : undefined,
                      }),
                    effetFinal: () => espaces.recharger(),
                  })
                  router.push('/app/espaces')
                  return
                }
                const nouvel: EspaceCloud = {
                  id: espaces.identifiant('ec'),
                  orgId: 'org-dba',
                  code,
                  offerId,
                  offreNom: offre.nom,
                  site,
                  cidr,
                  quota: quotaDepuisSpecs(offre.specs),
                  usage: { vcpu: 0, ramGo: 0, stockageTo: 0 },
                  projets: 0,
                  statut: 'provisioning',
                  createdAt: MAINTENANT,
                  dnsInterne: dnsInterne
                    ? `${code.toLowerCase()}.interne.synelia.cloud`
                    : undefined,
                }
                espaces.creer(nouvel)
                pousser({
                  ton: 'info',
                  titre: `Création de ${code} lancée`,
                  detail: 'Le quota est réservé, la plage réseau allouée. Suivi dans le centre de tâches.',
                })
                lancerJob({
                  workflow: 'espace.create',
                  cible: code,
                  alFin: () => {
                    espaces.modifier(nouvel.id, { statut: 'active' })
                    pousser({
                      ton: 'ok',
                      titre: `${code} est prêt`,
                      detail: 'Vous pouvez y créer machines, clusters et volumes.',
                    })
                  },
                })
                router.push('/app/espaces')
              }}
            >
              Créer l’Espace Cloud
            </Button>
          )}
        </>
      }
    >
      {/* Étape 1 — Offre */}
      {etape === 1 && (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-g-700">
            L’offre détermine le quota de votre enveloppe. Elle se change à chaud, sans recréer quoi
            que ce soit, et le quota s’étend indépendamment de l’offre si nécessaire.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {OFFRES_ESPACE.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOfferId(o.id)}
                className={cn(
                  'flex flex-col rounded-[10px] border-2 bg-white p-4 text-left transition-colors',
                  offerId === o.id
                    ? 'border-p-700 shadow-[0_4px_16px_rgba(43,27,77,.1)]'
                    : 'border-g-300 hover:border-p-400',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="type-h3">{o.nom}</h3>
                  {o.populaire && (
                    <Badge tone="violet" size="sm">
                      Populaire
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-g-500">{o.specs}</p>
                <p className="tnum mt-3 text-[19px] font-bold [font-family:var(--font-display)] text-p-700">
                  {o.surDevis ? <span className="text-[15px]">Sur devis</span> : money(o.prix)}
                  {!o.surDevis && (
                    <span className="text-[11px] font-semibold text-g-500">/mois</span>
                  )}
                </p>
                <ul className="mt-3 flex-1 space-y-1 border-t border-g-100 pt-3">
                  {o.caracteristiques.map((c) => (
                    <li key={c} className="flex items-start gap-1.5 text-[12px] text-g-700">
                      <Check size={12} className="mt-0.5 shrink-0 text-ok" />
                      {c}
                    </li>
                  ))}
                </ul>
                {o.sla && (
                  <p className="mt-3 text-[11px] font-semibold text-g-500">SLA {o.sla}</p>
                )}
              </button>
            ))}
          </div>
          <Card className="bg-g-050">
            <Switch
              checked={periodicite === 'annuelle'}
              onChange={(v) => setPeriodicite(v ? 'annuelle' : 'mensuelle')}
              label="Facturation annuelle (−15 %)"
              description="Engagement de douze mois. Le mensuel reste sans engagement, résiliable en fin de mois."
            />
          </Card>
        </div>
      )}

      {/* Étape 2 — Site */}
      {etape === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(['ABJ', 'GBM'] as Site[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSite(s)}
                className={cn(
                  'rounded-[10px] border-2 bg-white p-5 text-left transition-colors',
                  site === s ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                )}
              >
                <span className="flex items-center gap-2">
                  <Server size={16} className="text-p-700" />
                  <span className="type-h3">{SITE_LABEL[s]}</span>
                </span>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-g-700">
                  {s === 'ABJ'
                    ? 'Site principal, 640 m² de salle blanche, 1,2 MW installés, quatre opérateurs. Capacité la plus importante et connectivité la plus dense. Recommandé pour la production.'
                    : 'Parc technologique VITIB en zone franche, 420 m², 800 kW installés. Site de repli PRA et destination des sauvegardes immuables. Recommandé pour séparer physiquement une charge de votre production.'}
                </p>
                <dl className="mt-3 space-y-1.5 border-t border-g-100 pt-3">
                  <Petit cle="Latence indicative" valeur={LATENCE[s]} />
                  <Petit cle="Résidence des données" valeur="Côte d’Ivoire" />
                </dl>
              </button>
            ))}
          </div>
          <Callout ton="violet" titre="Résidence des données">
            Quel que soit le site retenu, vos données restent en Côte d’Ivoire. Aucune réplication
            hors du territoire n’a lieu sans demande écrite de votre part, et une attestation de
            résidence est générable à tout moment depuis vos paramètres.
          </Callout>
          <Callout ton="info" titre="Le placement technique n’est pas exposé">
            Vous choisissez le site physique ; la répartition sur nos hyperviseurs est décidée côté
            fournisseur. Sur l’offre Cloud Souverain, ce placement est contractuellement limité aux
            socles open source.
          </Callout>
        </div>
      )}

      {/* Étape 3 — Réseau */}
      {etape === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre={
                <span className="flex items-center gap-2">
                  <Network size={15} className="text-p-700" />
                  Identité et adressage
                </span>
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Code de l’espace"
                hint="format EC-XXX-NN"
                required
                error={
                  code && !codeValide
                    ? espacesReels.some((e) => e.code === code)
                      ? 'Ce code est déjà utilisé.'
                      : 'Format attendu : EC-DBA-04'
                    : undefined
                }
              >
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </Field>
              <Field
                label="Plage CIDR"
                hint="proposée automatiquement, modifiable"
                required
                error={cidr && !cidrValide ? 'Plage privée attendue, /16 à /24 dans 10.0.0.0/8.' : undefined}
              >
                <Input
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-g-500">
              La plage proposée ne chevauche aucune de vos plages existantes (
              {espacesReels.map((e) => e.cidr).join(', ')}), ce qui rend le peering possible sans
              renumérotation. Un /22 offre 1 024 adresses, soit environ quatre réseaux privés de 254
              hôtes.
            </p>
          </Card>

          <Card>
            <CardHeader titre="Options réseau" />
            <div className="space-y-3.5">
              <Switch
                checked={dnsInterne}
                onChange={setDnsInterne}
                label="DNS interne"
                description={`Zone privée résolue depuis l’espace : ${code.toLowerCase()}.interne.synelia.cloud. Vos machines se joignent par nom sans configuration.`}
              />
              <Field
                label="Peering avec un autre Espace Cloud"
                hint="facultatif"
              >
                <Select value={peering} onChange={(e) => setPeering(e.target.value)}>
                  <option value="">Aucun peering</option>
                  {espacesReels.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code} · {e.cidr} · {e.site}
                    </option>
                  ))}
                </Select>
              </Field>
              {peering && (
                <Callout ton="info" titre="Routage inter-espaces">
                  Le trafic entre les deux plages sera routé sans passer par Internet. Le trafic
                  inter-site (Abidjan ↔ Grand-Bassam) n’est pas facturé.
                </Callout>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Étape 4 — Options */}
      {etape === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre={
                <span className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-p-700" />
                  Protection
                </span>
              }
              sousTitre="Un espace sans plan de sauvegarde n’offre aucune possibilité de restauration."
            />
            <Field label="Plan de sauvegarde par défaut">
              <Select value={planSauvegarde} onChange={(e) => setPlanSauvegarde(e.target.value)}>
                {plansSauvegarde.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} · rétention {p.retentionJours} j{p.immutable ? ' · immuable' : ''}
                  </option>
                ))}
                <option value="aucun">Aucun plan (déconseillé)</option>
              </Select>
            </Field>
            <p className="mt-2 text-[11.5px] leading-relaxed text-g-500">
              Le plan s’appliquera automatiquement à toute ressource créée dans cet espace portant
              l’étiquette correspondante. Vous pourrez le modifier à tout moment.
            </p>
          </Card>

          <Card>
            <CardHeader titre="Exploitation" />
            <div className="space-y-3.5">
              <Switch
                checked={supervision}
                onChange={setSupervision}
                label="Supervision incluse"
                description="Sondes posées automatiquement à la création de chaque ressource, avec remontée dans l’écran Supervision et dans Centreon. Incluse dans l’offre."
              />
              <Switch
                checked={pra}
                onChange={setPra}
                label={`Plan de reprise vers ${site === 'ABJ' ? 'Grand-Bassam' : 'Abidjan'}`}
                description="Réplication continue, ordre de démarrage avec dépendances, adressage de repli, exercices trimestriels avec rapport daté. Option facturée 96 000 FCFA par mois."
              />
            </div>
            {pra && (
              <Callout ton="ok" className="mt-3.5" titre="Ce que l’option PRA vous engage à faire">
                Un plan de reprise n’a de valeur que s’il est exercé. Nous planifions un premier
                exercice de bascule de test dans les trente jours suivant la mise en place — en
                réseau isolé, sans impact sur votre production — et vous remettons le rapport avec le
                temps de reprise réellement constaté.
              </Callout>
            )}
          </Card>
        </div>
      )}

      {/* Étape 5 — Récapitulatif */}
      {etape === 5 && (
        <div className="space-y-4">
          <Card>
            <CardHeader titre="Ce qui va être créé" />
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Code', valeur: <span className="font-mono">{code}</span> },
                { cle: 'Offre', valeur: `${offre.nom} — ${offre.specs}` },
                { cle: 'Site', valeur: SITE_LABEL[site] },
                { cle: 'Plage réseau', valeur: <span className="font-mono">{cidr}</span> },
                {
                  cle: 'Quota',
                  valeur: offre.surDevis
                    ? 'Défini au devis'
                    : offre.specs,
                },
                {
                  cle: 'DNS interne',
                  valeur: dnsInterne
                    ? `${code.toLowerCase()}.interne.synelia.cloud`
                    : 'Désactivé',
                },
                {
                  cle: 'Peering',
                  valeur: peering
                    ? espacesReels.find((e) => e.id === peering)?.code ?? '—'
                    : 'Aucun',
                },
                {
                  cle: 'Plan de sauvegarde',
                  valeur: plansSauvegarde.items.find((p) => p.id === planSauvegarde)?.nom ?? 'Aucun',
                },
                { cle: 'Supervision', valeur: supervision ? 'Incluse' : 'Désactivée' },
                { cle: 'PRA inter-site', valeur: pra ? 'Activé' : 'Non souscrit' },
                { cle: 'SLA', valeur: offre.sla ?? '—' },
                {
                  cle: 'Périodicité',
                  valeur: periodicite === 'annuelle' ? 'Annuelle (−15 %)' : 'Mensuelle',
                },
              ]}
            />
          </Card>

          <CostPreview lignes={lignes} periodicite={periodicite} />

          <Card>
            <Checkbox
              checked={conditions}
              onChange={(e) => setConditions(e.target.checked)}
              label="J’accepte les conditions générales de vente et l’annexe SLA"
              description={`Montants hors taxes en FCFA, TVA 18 % appliquée à la facturation. ${periodicite === 'annuelle' ? 'Engagement de douze mois, résiliable à l’échéance avec trente jours de préavis.' : 'Sans engagement, résiliable en fin de mois.'} ${estActif() ? 'Le paiement (Paystack, environnement de test) est exigé avant la création de l’espace — aucune carte réelle n’est débitée sur ce lab.' : 'Paiement simulé sur cet environnement de démonstration : aucun prélèvement réel n’est effectué.'}`}
            />
          </Card>

          <Callout ton="info" titre="Après validation">
            Le quota est réservé, la plage réseau allouée et le DNS interne créé. L’espace est
            utilisable en moins de deux minutes. Vous pourrez ensuite créer des machines, des
            clusters Kubernetes et des volumes dans cette enveloppe.
          </Callout>
        </div>
      )}
    </WizardShell>
  )
}

function Petit({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[11.5px] text-g-500">{cle}</dt>
      <dd
        className={cn(
          'min-w-0 text-right text-[11.5px] font-semibold text-ink',
          mono && 'font-mono',
        )}
      >
        {valeur}
      </dd>
    </div>
  )
}
