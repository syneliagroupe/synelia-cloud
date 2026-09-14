'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num, pct } from '@/lib/format'
import type { LoadBalancer, PublicIP, VM } from '@/lib/types'
import { LOAD_BALANCERS, PUBLIC_IPS, VMS } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GatedAction } from '@/components/ui/display'
import { Checkbox, Field, Input, Select, Slider, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { CostPreview, WizardShell } from '@/components/composition/flow'
import { useApp, useEspace } from '@/components/app/contexte'
import { useAtelier, useCollection } from '@/components/app/atelier'
import { useOperation } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

export default function LoadBalancers() {
  const espace = useEspace()
  const { autorise, refus } = useApp()
  const [assistant, setAssistant] = useState(false)
  const collection = useCollection<LoadBalancer>('load-balancers', LOAD_BALANCERS)
  const lbs = collection.items.filter((l) => l.espaceId === espace.id)

  if (assistant) return <AssistantLb onFermer={() => setAssistant(false)} />

  const colonnes: Array<Colonne<LoadBalancer>> = [
    {
      id: 'nom',
      entete: 'Nom',
      cle: (l) => l.nom,
      rendu: (l) => (
        <span className="block">
          <span className="block font-mono text-[12.5px] font-semibold text-ink">{l.nom}</span>
          <span className="block text-[11px] text-g-500">
            {l.exposure === 'public' ? 'Exposé sur Internet' : 'Interne'}
          </span>
        </span>
      ),
    },
    {
      id: 'layer',
      entete: 'Couche',
      cle: (l) => l.layer,
      rendu: (l) => (
        <Badge tone={l.layer === 'l7' ? 'violet' : 'neutral'} size="sm">
          {l.layer.toUpperCase()} · {l.layer === 'l7' ? 'HTTP/HTTPS' : 'TCP/UDP'}
        </Badge>
      ),
    },
    {
      id: 'vip',
      entete: 'VIP',
      cle: (l) => l.vip,
      rendu: (l) => <span className="font-mono text-[12px]">{l.vip}</span>,
    },
    {
      id: 'algo',
      entete: 'Algorithme',
      cle: (l) => l.algo,
      rendu: (l) =>
        ({
          round_robin: 'Round-robin',
          least_conn: 'Moindre connexion',
          source_hash: 'Hash IP source',
          weighted: 'Pondéré',
        })[l.algo],
      masquable: true,
    },
    {
      id: 'backends',
      entete: 'Backends',
      aligne: 'right',
      cle: (l) => l.pool.length,
      rendu: (l) => l.pool.length,
    },
    {
      id: 'sante',
      entete: 'Santé agrégée',
      cle: (l) => l.pool.filter((p) => p.sante === 'ok').length / Math.max(1, l.pool.length),
      rendu: (l) => {
        const ok = l.pool.filter((p) => p.sante === 'ok').length
        const drain = l.pool.filter((p) => p.sante === 'drain').length
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={ok === l.pool.length ? 'ok' : ok === 0 ? 'err' : 'warn'} dot size="sm">
              {ok}/{l.pool.length} sains
            </Badge>
            {drain > 0 && (
              <Badge tone="info" size="sm">
                {drain} en drain
              </Badge>
            )}
          </span>
        )
      },
    },
    {
      id: 'rps',
      entete: 'Requêtes/s',
      aligne: 'right',
      cle: (l) => l.metriques.rps,
      rendu: (l) => num(l.metriques.rps),
    },
    {
      id: 'waf',
      entete: 'WAF',
      cle: (l) => (l.waf?.actif ? 1 : 0),
      rendu: (l) =>
        l.waf?.actif ? (
          <Badge tone="ok" size="sm">
            {l.waf.ruleset}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            Inactif
          </Badge>
        ),
      masquable: true,
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (l) => (
        <Link
          href={`/app/reseau/lb/${l.id}`}
          className="text-[12px] font-semibold text-p-700 hover:text-m-600"
        >
          Ouvrir →
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace.code, href: `/app/espaces/${espace.id}` },
          { label: 'Load balancers' },
        ]}
        titre="Load balancers"
        sousTitre="Répartition de charge en couche 4 ou 7, publique ou interne, avec terminaison TLS automatique, règles de routage, pare-feu applicatif OWASP et limitation de débit."
        actions={
          <GatedAction autorise={autorise('lb.create')} message={refus('lb.create')}>
            <Button iconBefore={<Plus size={14} />} onClick={() => setAssistant(true)}>
              Créer un load balancer
            </Button>
          </GatedAction>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile libelle="Load balancers" valeur={lbs.length} />
        <StatTile
          libelle="Requêtes par seconde"
          valeur={num(lbs.reduce((a, l) => a + l.metriques.rps, 0))}
          ton="violet"
        />
        <StatTile
          libelle="Backends sains"
          valeur={`${lbs.reduce((a, l) => a + l.pool.filter((p) => p.sante === 'ok').length, 0)}/${lbs.reduce((a, l) => a + l.pool.length, 0)}`}
          ton="ok"
        />
        <StatTile
          libelle="WAF actifs"
          valeur={lbs.filter((l) => l.waf?.actif).length}
          detail="Jeu de règles OWASP CRS 4.3"
        />
      </div>

      <DataTable
        lignes={lbs}
        colonnes={colonnes}
        placeholderRecherche="Rechercher par nom ou VIP…"
        filtres={[
          {
            id: 'layer',
            libelle: 'Couche',
            options: [
              { value: 'l4', label: 'L4 (TCP/UDP)' },
              { value: 'l7', label: 'L7 (HTTP/HTTPS)' },
            ],
          },
          {
            id: 'exposure',
            libelle: 'Exposition',
            options: [
              { value: 'public', label: 'Public' },
              { value: 'interne', label: 'Interne' },
            ],
          },
        ]}
        selection={(l, id, v) => (id === 'layer' ? l.layer === v : l.exposure === v)}
        href={(l) => `/app/reseau/lb/${l.id}`}
        vide={{
          titre: 'Aucun load balancer',
          phrase:
            'Un load balancer répartit le trafic entre plusieurs cibles, termine le TLS et applique un pare-feu applicatif. C’est la brique qui rend une application réellement redondante.',
          action: { libelle: 'Créer un load balancer', onClick: () => setAssistant(true) },
        }}
      />

      <Callout ton="violet" titre="Le mode drain, sous-estimé et essentiel">
        Retirer brutalement une cible du pool coupe les connexions en cours. Le mode drain arrête de
        lui envoyer de nouvelles requêtes tout en laissant finir celles en cours : c’est ce qui rend
        un déploiement réellement sans coupure. Vous le trouverez sur chaque cible, dans l’onglet
        Backends du détail d’un load balancer.
      </Callout>
    </div>
  )
}

// ─── Assistant de création ────────────────────────────────────────────

const ETAPES = [
  { numero: 1, titre: 'Type' },
  { numero: 2, titre: 'VIP' },
  { numero: 3, titre: 'Écouteurs' },
  { numero: 4, titre: 'Pool de backends' },
  { numero: 5, titre: 'Health check' },
]

function AssistantLb({ onFermer }: { onFermer: () => void }) {
  const espace = useEspace()
  const { pousser } = useApp()
  const executer = useOperation()
  const collection = useCollection<LoadBalancer>('load-balancers', LOAD_BALANCERS)
  const { lancerJob } = useAtelier()
  const [etape, setEtape] = useState(1)

  const [nom, setNom] = useState('lb-nouveau')
  const [layer, setLayer] = useState<'l4' | 'l7'>('l7')
  const [exposure, setExposure] = useState<'public' | 'interne'>('public')
  const [vipMode, setVipMode] = useState<'existante' | 'nouvelle'>('existante')
  const [vip, setVip] = useState('')
  const [portHttps, setPortHttps] = useState(443)
  const [tlsMin, setTlsMin] = useState('TLS 1.2')
  const [certAuto, setCertAuto] = useState(true)
  const [redirection, setRedirection] = useState(true)
  const [algo, setAlgo] = useState<LoadBalancer['algo']>('least_conn')
  const [sticky, setSticky] = useState(true)
  const [cibles, setCibles] = useState<string[]>([])
  const [waf, setWaf] = useState(true)
  const [rateLimit, setRateLimit] = useState(1200)
  const [hcChemin, setHcChemin] = useState('/healthz')
  const [hcIntervalle, setHcIntervalle] = useState(10)
  const [hcSeuilKo, setHcSeuilKo] = useState(3)
  const [hcSeuilOk, setHcSeuilOk] = useState(2)
  const [conditions, setConditions] = useState(false)
  /** Erreurs de champs du backend (`422`) : l’assistant reste ouvert et les affiche. */
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  // `ips` et `vms` ont chacun un vrai backend (`/ips`, `/vms`) : lire les
  // graines `PUBLIC_IPS`/`VMS` directement ici renvoyait toujours des IP et des
  // VM de démonstration (`vm-web-01`…) même en mode API, où l'Espace réel a
  // d'autres identifiants — même défaut que `offerId`/`reseauId` sur
  // `/app/vms/new`, corrigé au même patron : état vide au montage, resynchronisé
  // par effet dès que la vraie liste charge.
  const ipsCol = useCollection<PublicIP>('ips', PUBLIC_IPS)
  const ipsLibres = ipsCol.items.filter((i) => i.espaceId === espace.id && !i.attachedTo)
  useEffect(() => {
    if (!vip && ipsLibres.length > 0) setVip(ipsLibres[0].adresse)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ipsLibres.length])

  const vmsCol = useCollection<VM>('vms', VMS)
  const vmsEspace = vmsCol.items.filter((v) => v.espaceId === espace.id)

  const lignesCout = [
    { libelle: `Load balancer ${layer.toUpperCase()}`, detail: nom, montant: 18000 },
    ...(vipMode === 'nouvelle' && exposure === 'public'
      ? [{ libelle: 'IP publique supplémentaire', detail: 'Commande immédiate', montant: 3500 }]
      : []),
    ...(waf ? [{ libelle: 'Pare-feu applicatif (WAF)', detail: 'OWASP CRS 4.3', montant: 12000 }] : []),
  ]

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
              <Petit cle="Nom" valeur={nom} mono />
              <Petit cle="Couche" valeur={layer.toUpperCase()} />
              <Petit cle="Exposition" valeur={exposure === 'public' ? 'Publique' : 'Interne'} />
              <Petit cle="VIP" valeur={vip || 'à commander'} mono />
              <Petit cle="Algorithme" valeur={algo} />
              <Petit cle="Cibles" valeur={String(cibles.length)} />
              <Petit cle="WAF" valeur={waf ? 'Actif' : 'Inactif'} />
            </dl>
          </Card>
          <CostPreview lignes={lignesCout} />
        </>
      }
      actions={
        <>
          <Button variant="ghost" onClick={() => (etape === 1 ? onFermer() : setEtape(etape - 1))}>
            {etape === 1 ? 'Annuler' : 'Précédent'}
          </Button>
          {etape < 5 ? (
            <Button onClick={() => setEtape(etape + 1)}>Continuer</Button>
          ) : (
            <Button
              disabled={!conditions}
              onClick={() => {
                const nouveau: LoadBalancer = {
                  id: collection.identifiant('lb'),
                  espaceId: espace.id,
                  nom,
                  layer,
                  exposure,
                  vip: vip || `102.176.20.${190 + collection.items.length}`,
                  algo,
                  sticky: sticky ? 'cookie' : undefined,
                  listeners: [
                    { protocole: 'HTTPS', port: portHttps, certId: certAuto ? 'cert-auto' : undefined, tlsMin },
                    ...(redirection ? [{ protocole: 'HTTP', port: 80 }] : []),
                  ],
                  pool: cibles.map((cible) => ({
                    targetId: cible,
                    targetLabel: vmsEspace.find((v) => v.id === cible)?.nom ?? cible,
                    poids: 10,
                    sante: 'drain' as const,
                  })),
                  healthCheck: {
                    protocole: layer === 'l7' ? 'HTTP' : 'TCP',
                    chemin: layer === 'l7' ? hcChemin : undefined,
                    codeAttendu: layer === 'l7' ? 200 : undefined,
                    intervalleS: hcIntervalle,
                    seuilKo: hcSeuilKo,
                    seuilOk: hcSeuilOk,
                  },
                  waf: waf ? { actif: true, ruleset: 'OWASP CRS 4.3' } : undefined,
                  rateLimit: { requetesParMin: rateLimit },
                  metriques: {
                    rps: 0,
                    p50: 0,
                    p95: 0,
                    p99: 0,
                    taux4xx: 0,
                    taux5xx: 0,
                    connexions: 0,
                  },
                }
                // POST /load-balancers — le backend refuse `waf` et `rateLimit`
                // à la création (501) : ils restent locaux, hors de l’appel.
                if (estActif()) {
                  setErreurs({})
                  executer({
                    action: 'lb.create',
                    titre: `Création de ${nom} lancée`,
                    detail: 'La VIP est réservée, les health checks démarrent dans une minute.',
                    onErreur: (e) => setErreurs(e.champs ?? {}),
                    // L’assistant se ferme dès que le `202` est accepté ; sur
                    // refus il reste ouvert avec les champs en cause.
                    appel: () =>
                      creerRessource('/load-balancers', {
                        espaceId: espace.id,
                        nom,
                        layer,
                        exposure,
                        algo,
                        ...(sticky ? { sticky: 'cookie' } : {}),
                        listeners: [
                          {
                            protocole: 'HTTPS',
                            port: portHttps,
                            ...(certAuto ? { certId: 'cert-auto' } : {}),
                            tlsMin,
                          },
                          ...(redirection ? [{ protocole: 'HTTP', port: 80 }] : []),
                        ],
                        cibles: cibles.map((cible) => ({ targetId: cible, poids: 10 })),
                        healthCheck: {
                          protocole: layer === 'l7' ? 'HTTP' : 'TCP',
                          ...(layer === 'l7' ? { chemin: hcChemin, codeAttendu: 200 } : {}),
                          intervalleS: hcIntervalle,
                          seuilKo: hcSeuilKo,
                          seuilOk: hcSeuilOk,
                        },
                      }).then((r) => {
                        onFermer()
                        return r
                      }),
                    effetFinal: () => collection.recharger(),
                  })
                  return
                }
                collection.creer(nouveau)
                pousser({
                  ton: 'info',
                  titre: `Création de ${nom} lancée`,
                  detail: 'La VIP est réservée, les health checks démarrent dans une minute.',
                })
                lancerJob({
                  workflow: 'lb.create',
                  cible: nom,
                  alFin: () => {
                    collection.modifier(nouveau.id, (l) => ({
                      pool: l.pool.map((x) => ({ ...x, sante: 'ok' as const })),
                    }))
                    pousser({
                      ton: 'ok',
                      titre: `${nom} répartit le trafic`,
                      detail: `${cibles.length} cible(s) saine(s) dans le pool.`,
                    })
                  },
                })
                onFermer()
              }}
            >
              Créer le load balancer
            </Button>
          )}
        </>
      }
    >
      {/* Étape 1 — Type */}
      {etape === 1 && (
        <div className="space-y-4">
          <Field label="Nom du load balancer" required>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} className="font-mono" />
          </Field>

          <div>
            <MicroLabel className="mb-2">Couche de répartition</MicroLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ['l4', 'Couche 4 — TCP / UDP', 'Répartition au niveau transport, sans lecture du contenu. Adaptée aux bases de données, aux protocoles non HTTP et aux besoins de latence minimale.'],
                  ['l7', 'Couche 7 — HTTP / HTTPS', 'Répartition applicative : routage par hôte, chemin et en-tête, terminaison TLS, WAF, réécriture d’URL. Le choix par défaut pour une application web ou une API.'],
                ] as const
              ).map(([v, t, d]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLayer(v)}
                  className={cn(
                    'rounded-[10px] border-2 bg-white p-4 text-left transition-colors',
                    layer === v ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                  )}
                >
                  <span className="type-h3 block">{t}</span>
                  <span className="mt-1.5 block text-[12.5px] leading-relaxed text-g-700">{d}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <MicroLabel className="mb-2">Exposition</MicroLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ['public', 'Public', 'Joignable depuis Internet via une IP publique. Le groupe de sécurité et le WAF filtrent le trafic entrant.'],
                  ['interne', 'Interne', 'Joignable uniquement depuis vos réseaux privés. Adapté à la répartition entre services internes, comme un pool de bases de données.'],
                ] as const
              ).map(([v, t, d]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setExposure(v)}
                  className={cn(
                    'rounded-[10px] border-2 bg-white p-4 text-left transition-colors',
                    exposure === v ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                  )}
                >
                  <span className="type-h3 block">{t}</span>
                  <span className="mt-1.5 block text-[12.5px] leading-relaxed text-g-700">{d}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Étape 2 — VIP */}
      {etape === 2 && (
        <div className="space-y-4">
          {exposure === 'interne' ? (
            <Card>
              <CardHeader
                titre="Adresse virtuelle interne"
                sousTitre="Attribuée automatiquement dans la plage de l’espace."
              />
              <Field label="Adresse proposée">
                <Input value="10.0.2.100" readOnly className="font-mono" />
              </Field>
              <p className="mt-2 text-[11.5px] text-g-500">
                L’adresse est réservée dans {espace.cidr} et résolvable par le DNS interne sous{' '}
                <span className="font-mono">{nom}.{espace.code.toLowerCase()}.interne.synelia.cloud</span>.
                Aucune IP publique n’est consommée.
              </p>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setVipMode('existante')}
                  className={cn(
                    'w-full rounded-[8px] border-2 bg-white p-3.5 text-left transition-colors',
                    vipMode === 'existante' ? 'border-p-700 bg-p-050' : 'border-g-300',
                  )}
                >
                  <span className="block text-[13px] font-semibold text-ink">
                    Réutiliser une IP publique libre
                  </span>
                  <span className="mt-0.5 block text-[12px] text-g-700">
                    {ipsLibres.length} IP déjà réservée(s) et facturée(s), actuellement inutilisée(s).
                    Aucun coût supplémentaire.
                  </span>
                </button>
                {vipMode === 'existante' && ipsLibres.length > 0 && (
                  <div className="ml-4">
                    <Field label="IP à utiliser">
                      <Select value={vip} onChange={(e) => setVip(e.target.value)}>
                        {ipsLibres.map((i) => (
                          <option key={i.id} value={i.adresse}>
                            {i.adresse}
                            {i.antiDdos ? ' · anti-DDoS actif' : ''}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setVipMode('nouvelle')}
                  className={cn(
                    'w-full rounded-[8px] border-2 bg-white p-3.5 text-left transition-colors',
                    vipMode === 'nouvelle' ? 'border-p-700 bg-p-050' : 'border-g-300',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="block text-[13px] font-semibold text-ink">
                      Commander une nouvelle IP publique
                    </span>
                    <Badge tone="warn" size="sm">
                      +{money(3500)}/mois
                    </Badge>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-g-700">
                    Attribution immédiate. L’impact tarifaire est ajouté à l’aperçu de coût.
                  </span>
                </button>
              </div>
              {ipsLibres.length === 0 && vipMode === 'existante' && (
                <Callout ton="warn" titre="Aucune IP libre">
                  Toutes vos IP publiques sont attachées. Commandez une nouvelle IP, ou détachez-en
                  une depuis l’onglet IP publiques.
                </Callout>
              )}
            </>
          )}
        </div>
      )}

      {/* Étape 3 — Écouteurs */}
      {etape === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader titre="Écouteurs" sousTitre="Protocole, port et terminaison TLS." />
            <div className="space-y-4">
              {layer === 'l7' ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Port HTTPS">
                      <Input
                        type="number"
                        value={portHttps}
                        onChange={(e) => setPortHttps(Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Version TLS minimale">
                      <Select value={tlsMin} onChange={(e) => setTlsMin(e.target.value)}>
                        <option value="TLS 1.2">TLS 1.2 (recommandé)</option>
                        <option value="TLS 1.3">TLS 1.3 (le plus strict)</option>
                      </Select>
                    </Field>
                  </div>
                  <Switch
                    checked={certAuto}
                    onChange={setCertAuto}
                    label="Certificat Let’s Encrypt automatique"
                    description="Émission et renouvellement automatiques, trente jours avant expiration. Vous pouvez aussi téléverser votre propre certificat après création."
                  />
                  <Switch
                    checked={redirection}
                    onChange={setRedirection}
                    label="Rediriger HTTP vers HTTPS"
                    description="Un écouteur sur le port 80 renvoie une redirection 301 permanente vers HTTPS."
                  />
                </>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Protocole">
                    <Select defaultValue="TCP">
                      <option value="TCP">TCP</option>
                      <option value="UDP">UDP</option>
                    </Select>
                  </Field>
                  <Field label="Port">
                    <Input type="number" defaultValue={5432} />
                  </Field>
                </div>
              )}
            </div>
          </Card>
          {layer === 'l7' && certAuto && (
            <Callout ton="info" titre="Le piège du challenge ACME">
              L’émission automatique passe par un challenge HTTP sur{' '}
              <span className="font-mono text-[12px]">/.well-known/acme-challenge</span>. Si vous
              ajoutez plus tard une règle L7 qui bloque ce chemin, le renouvellement échouera
              silencieusement — c’est exactement l’incident survenu sur api.dba.africa le 19 août.
              Nous posons une exception par défaut sur ce chemin.
            </Callout>
          )}
        </div>
      )}

      {/* Étape 4 — Pool */}
      {etape === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Cibles du pool"
              sousTitre="Machines virtuelles ou workloads Kubernetes. Le mélange est possible — utile pendant une migration."
            />
            {vmsEspace.length === 0 && (
              <p className="rounded-[6px] border border-dashed border-g-300 bg-g-050 px-3 py-4 text-center text-[12.5px] text-g-500">
                Aucune machine virtuelle dans cet Espace pour l’instant — le load balancer se crée
                sans cible, à compléter depuis sa fiche une fois une VM disponible.
              </p>
            )}
            <div className="space-y-2">
              {vmsEspace.map((v) => (
                <label
                  key={v.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-2 transition-colors',
                    cibles.includes(v.id) ? 'border-p-300 bg-p-050' : 'border-g-300 hover:bg-g-050',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={cibles.includes(v.id)}
                    onChange={() =>
                      setCibles((p) =>
                        p.includes(v.id) ? p.filter((x) => x !== v.id) : [...p, v.id],
                      )
                    }
                    className="h-3.5 w-3.5 accent-[#4B2882]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[12.5px] font-medium text-ink">
                      {v.nom}
                    </span>
                    <span className="block text-[11px] text-g-500">
                      {v.ips.find((i) => i.type === 'privee')?.adresse} · {v.os}
                    </span>
                  </span>
                  {cibles.includes(v.id) && (
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-g-500">Poids</span>
                      <Input
                        type="number"
                        defaultValue={Math.round(100 / cibles.length)}
                        className="w-16"
                        aria-label="Poids"
                      />
                    </span>
                  )}
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader titre="Répartition" />
            <div className="space-y-4">
              <Field label="Algorithme">
                <Select value={algo} onChange={(e) => setAlgo(e.target.value as LoadBalancer['algo'])}>
                  <option value="round_robin">Round-robin — répartition égale, simple</option>
                  <option value="least_conn">
                    Moindre connexion — envoie vers la cible la moins chargée
                  </option>
                  <option value="source_hash">
                    Hash IP source — même client, même cible, sans cookie
                  </option>
                  <option value="weighted">Pondéré — selon le poids de chaque cible</option>
                </Select>
              </Field>
              <Switch
                checked={sticky}
                onChange={setSticky}
                label="Sessions persistantes"
                description={
                  layer === 'l7'
                    ? 'Par cookie inséré par le load balancer. Nécessaire si votre application stocke la session en mémoire locale.'
                    : 'Par IP source. Moins fiable derrière un NAT partagé.'
                }
              />
            </div>
          </Card>

          {layer === 'l7' && (
            <Card>
              <CardHeader titre="Protection applicative" />
              <div className="space-y-4">
                <Switch
                  checked={waf}
                  onChange={setWaf}
                  label="Pare-feu applicatif (WAF) — OWASP CRS 4.3"
                  description="Démarre en mode détection : les requêtes suspectes sont journalisées sans être bloquées. Passez en blocage après avoir posé vos exceptions."
                />
                {waf && (
                  <Slider
                    label="Limitation de débit par IP"
                    value={rateLimit}
                    onChange={setRateLimit}
                    min={60}
                    max={6000}
                    step={60}
                    unite="req/min"
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Étape 5 — Health check */}
      {etape === 5 && (
        <div className="space-y-4">
          {Object.keys(erreurs).length > 0 && (
            <Callout ton="err" titre="Le backend a refusé la demande">
              <ul className="mt-1 space-y-0.5">
                {Object.entries(erreurs).map(([champ, message]) => (
                  <li key={champ}>
                    <span className="font-mono text-[12px]">{champ}</span> : {message}
                  </li>
                ))}
              </ul>
            </Callout>
          )}
          <Card>
            <CardHeader
              titre="Health check"
              sousTitre="Détermine quand une cible est retirée du pool, et quand elle y revient."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Protocole">
                <Select defaultValue={layer === 'l7' ? 'HTTPS' : 'TCP'}>
                  {layer === 'l7' ? (
                    <>
                      <option value="HTTPS">HTTPS</option>
                      <option value="HTTP">HTTP</option>
                    </>
                  ) : (
                    <option value="TCP">TCP</option>
                  )}
                </Select>
              </Field>
              {layer === 'l7' && (
                <>
                  <Field label="Chemin de sonde">
                    <Input
                      value={hcChemin}
                      onChange={(e) => setHcChemin(e.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field label="Code attendu">
                    <Input type="number" defaultValue={200} />
                  </Field>
                </>
              )}
              <Field label="Intervalle" hint="en secondes">
                <Input
                  type="number"
                  value={hcIntervalle}
                  onChange={(e) => setHcIntervalle(Number(e.target.value))}
                  suffix="s"
                />
              </Field>
              <Field label="Seuil de bascule" hint="échecs consécutifs avant retrait">
                <Input
                  type="number"
                  value={hcSeuilKo}
                  onChange={(e) => setHcSeuilKo(Number(e.target.value))}
                />
              </Field>
              <Field label="Seuil de rétablissement" hint="succès consécutifs avant réintégration">
                <Input
                  type="number"
                  value={hcSeuilOk}
                  onChange={(e) => setHcSeuilOk(Number(e.target.value))}
                />
              </Field>
            </div>
            <Callout ton="info" className="mt-4" titre="Ce que ces seuils impliquent">
              Avec un intervalle de {hcIntervalle} s et un seuil de {hcSeuilKo} échecs, une cible
              défaillante est retirée du pool en {hcIntervalle * hcSeuilKo} secondes au pire. Un
              seuil trop bas provoque des retraits sur un simple pic de latence ; un seuil trop haut
              laisse partir du trafic vers une cible morte.
            </Callout>
          </Card>

          <Card>
            <CardHeader titre="Récapitulatif" />
            <KeyValueList
              colonnes={2}
              items={[
                { cle: 'Nom', valeur: <span className="font-mono">{nom}</span> },
                { cle: 'Couche', valeur: layer === 'l7' ? 'L7 — HTTP/HTTPS' : 'L4 — TCP/UDP' },
                { cle: 'Exposition', valeur: exposure === 'public' ? 'Publique' : 'Interne' },
                { cle: 'VIP', valeur: <span className="font-mono">{vip || '10.0.2.100'}</span> },
                {
                  cle: 'Écouteur',
                  valeur:
                    layer === 'l7'
                      ? `HTTPS ${portHttps} · ${tlsMin}${redirection ? ' · HTTP → HTTPS' : ''}`
                      : 'TCP 5432',
                },
                { cle: 'Certificat', valeur: certAuto ? 'Let’s Encrypt automatique' : 'Téléversé' },
                { cle: 'Algorithme', valeur: algo },
                { cle: 'Sessions persistantes', valeur: sticky ? 'Activées' : 'Désactivées' },
                { cle: 'Cibles', valeur: `${cibles.length} machine(s)` },
                {
                  cle: 'WAF',
                  valeur: waf ? `OWASP CRS 4.3 · ${num(rateLimit)} req/min par IP` : 'Inactif',
                },
                {
                  cle: 'Health check',
                  valeur:
                    layer === 'l7'
                      ? `${hcChemin} toutes les ${hcIntervalle} s`
                      : `TCP toutes les ${hcIntervalle} s`,
                },
                { cle: 'Seuils', valeur: `${hcSeuilKo} échecs / ${hcSeuilOk} succès` },
              ]}
            />
          </Card>

          <CostPreview lignes={lignesCout} />

          <Card>
            <Checkbox
              checked={conditions}
              onChange={(e) => setConditions(e.target.checked)}
              label="Je confirme la création de ce load balancer"
              description="Montants hors taxes, TVA 18 % appliquée à la facturation. La VIP est réservée dès la validation et facturée au prorata journalier."
            />
          </Card>
        </div>
      )}
    </WizardShell>
  )
}

function Petit({ cle, valeur, mono }: { cle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[11.5px] text-g-500">{cle}</dt>
      <dd
        className={cn('truncate text-right text-[11.5px] font-semibold text-ink', mono && 'font-mono')}
      >
        {valeur}
      </dd>
    </div>
  )
}
