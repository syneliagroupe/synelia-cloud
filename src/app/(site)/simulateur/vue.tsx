'use client'

import { useMemo, useState } from 'react'
import { Calculator, Info, Save, Scale, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, num, pct, TVA_PCT, ventilationTva } from '@/lib/format'
import { telechargerCsv } from '@/lib/export'
import {
  HYPOTHESES_COMPARATEUR,
  REFERENCES_COMPARATEUR,
  TARIFS_UNITAIRES as T,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Field, Input, SegmentedControl, Select, Slider, Switch, Textarea } from '@/components/ui/field'
import { Tabs } from '@/components/ui/display'
import { Modal } from '@/components/ui/overlay'
import { estActif, requete } from '@/lib/api/client'
import { Callout, Card, CardHeader } from '@/components/composition/card'
import { Container, HeroCourt, SiteSection, AppelFinal } from '@/components/site/blocs'

type Ligne = { libelle: string; detail?: string; montant: number }

export function VueSimulateur() {
  const [onglet, setOnglet] = useState('configurateur')

  return (
    <>
      <HeroCourt
        surtitre="Simulateur"
        titre={
          <>
            Combien cela vous coûterait,
            <br />
            et combien vous économiseriez.
          </>
        }
        chapeau="Deux outils : un configurateur qui chiffre votre besoin ligne par ligne, et un comparateur qui met votre facture actuelle en face de son équivalent Synelia — avec les hypothèses de calcul affichées, parce qu’un comparateur sans hypothèses ne vaut rien."
      />

      <SiteSection>
        <Container>
          <Tabs
            tabs={[
              { id: 'configurateur', label: 'Configurateur' },
              { id: 'comparateur', label: 'Comparer ma facture actuelle' },
            ]}
            active={onglet}
            onChange={setOnglet}
          />
          <div className="mt-6">
            {onglet === 'configurateur' ? <Configurateur /> : <Comparateur />}
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Une estimation, ce n’est pas un dimensionnement"
        chapeau="Le simulateur donne un ordre de grandeur. Un architecte reprend vos charges réelles, votre plan de reprise et vos contraintes de conformité, puis produit un chiffrage engageant."
        primaire={{ libelle: 'Demander un devis', href: '/entreprises#contact' }}
        secondaire={{ libelle: 'Créer un compte', href: '/signup' }}
      />
    </>
  )
}

// ─── Configurateur ────────────────────────────────────────────────────

function Configurateur() {
  const [volet, setVolet] = useState<'espace' | 'marketplace' | 'web'>('espace')
  const [annuel, setAnnuel] = useState(false)

  // Espace Cloud
  const [vcpu, setVcpu] = useState(48)
  const [ram, setRam] = useState(192)
  const [stockage, setStockage] = useState(6000)
  const [nvme, setNvme] = useState(true)
  const [ips, setIps] = useState(4)
  const [antiDdos, setAntiDdos] = useState(true)
  const [lbs, setLbs] = useState(1)
  const [sauvegarde, setSauvegarde] = useState(4000)
  const [objet, setObjet] = useState(4000)
  const [k8s, setK8s] = useState<'aucun' | 'single' | 'ha'>('ha')

  // Marketplace
  const [dedie, setDedie] = useState(true)
  const [drive, setDrive] = useState(20)
  const [mail, setMail] = useState(20)
  const [visio, setVisio] = useState(25)
  const [coffre, setCoffre] = useState(25)
  const [erp, setErp] = useState(10)

  // Web
  const [webMut, setWebMut] = useState(0)
  const [webWp, setWebWp] = useState(1)
  const [webPresta, setWebPresta] = useState(1)

  const lignesEspace = useMemo<Ligne[]>(() => {
    const l: Ligne[] = [
      { libelle: 'vCPU', detail: `${vcpu} × ${money(T.vcpu)}`, montant: vcpu * T.vcpu },
      { libelle: 'Mémoire', detail: `${ram} Go × ${money(T.ramGo)}`, montant: ram * T.ramGo },
      {
        libelle: `Stockage ${nvme ? 'NVMe' : 'SSD'}`,
        detail: `${num(stockage)} Go × ${money(nvme ? T.stockageGoNvme : T.stockageGoSsd)}`,
        montant: Math.round(stockage * (nvme ? T.stockageGoNvme : T.stockageGoSsd)),
      },
    ]
    if (ips > 0)
      l.push({
        libelle: 'IP publiques',
        detail: `${ips} × ${money(T.ipPublique)}`,
        montant: ips * T.ipPublique,
      })
    if (antiDdos && ips > 0)
      l.push({
        libelle: 'Anti-DDoS',
        detail: `${ips} IP protégées`,
        montant: ips * T.antiDdos,
      })
    if (lbs > 0)
      l.push({
        libelle: 'Load balancers',
        detail: `${lbs} × ${money(T.loadBalancer)}`,
        montant: lbs * T.loadBalancer,
      })
    if (sauvegarde > 0)
      l.push({
        libelle: 'Sauvegarde immuable',
        detail: `${num(sauvegarde)} Go × ${money(T.sauvegardeGo)}`,
        montant: Math.round(sauvegarde * T.sauvegardeGo),
      })
    if (objet > 0)
      l.push({
        libelle: 'Stockage objet (chaud)',
        detail: `${num(objet)} Go × ${money(T.objetGoChaud)}`,
        montant: Math.round(objet * T.objetGoChaud),
      })
    if (k8s !== 'aucun')
      l.push({
        libelle: `Control plane Kubernetes ${k8s === 'ha' ? 'HA (3 masters)' : 'mono-master'}`,
        montant: k8s === 'ha' ? T.k8sControlPlaneHa : T.k8sControlPlaneSingle,
      })
    return l
  }, [vcpu, ram, stockage, nvme, ips, antiDdos, lbs, sauvegarde, objet, k8s])

  const lignesMarketplace = useMemo<Ligne[]>(() => {
    const maj = dedie ? T.majorationDedie : 1
    const services: Array<[string, number, number]> = [
      ['Drive Pro', drive, T.siegeDrive],
      ['Email Pro', mail, T.siegeMail],
      ['Visio & Chat', visio, T.siegeVisio],
      ['Coffre de mots de passe', coffre, T.siegeCoffre],
      ['ERP', erp, T.siegeErp],
    ]
    return services
      .filter(([, n]) => n > 0)
      .map(([nom, n, prix]) => ({
        libelle: `${nom} · ${dedie ? 'dédié' : 'mutualisé'}`,
        detail: `${n} sièges × ${money(prix)}${dedie ? ' + 20 %' : ''}`,
        montant: Math.round(n * prix * maj),
      }))
  }, [dedie, drive, mail, visio, coffre, erp])

  const lignesWeb = useMemo<Ligne[]>(() => {
    const l: Ligne[] = []
    if (webMut > 0)
      l.push({
        libelle: 'Hébergement mutualisé',
        detail: `${webMut} × ${money(T.webMutualise)}`,
        montant: webMut * T.webMutualise,
      })
    if (webWp > 0)
      l.push({
        libelle: 'WordPress managé',
        detail: `${webWp} × ${money(T.webWordpress)}`,
        montant: webWp * T.webWordpress,
      })
    if (webPresta > 0)
      l.push({
        libelle: 'PrestaShop managé',
        detail: `${webPresta} × ${money(T.webPrestashop)}`,
        montant: webPresta * T.webPrestashop,
      })
    return l
  }, [webMut, webWp, webPresta])

  const toutes = [...lignesEspace, ...lignesMarketplace, ...lignesWeb]
  const sousTotal = toutes.reduce((a, l) => a + l.montant, 0)
  const reduction = annuel ? Math.round(sousTotal * T.remiseAnnuelle) : 0
  const { tva, total } = ventilationTva(sousTotal - reduction)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-5">
        <SegmentedControl
          value={volet}
          onChange={setVolet}
          options={[
            { value: 'espace', label: 'Espace Cloud' },
            { value: 'marketplace', label: 'Marketplace' },
            { value: 'web', label: 'Web' },
          ]}
        />

        {volet === 'espace' && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                titre="Calcul et mémoire"
                sousTitre="Le quota de votre Espace Cloud. Extensible à chaud."
              />
              <div className="space-y-5">
                <Slider label="vCPU" value={vcpu} onChange={setVcpu} min={2} max={128} step={2} unite="vCPU" />
                <Slider label="Mémoire" value={ram} onChange={setRam} min={4} max={512} step={4} unite="Go" />
              </div>
            </Card>

            <Card>
              <CardHeader titre="Stockage" />
              <div className="space-y-5">
                <Slider
                  label="Stockage bloc"
                  value={stockage}
                  onChange={setStockage}
                  min={100}
                  max={20000}
                  step={100}
                  unite="Go"
                />
                <Switch
                  checked={nvme}
                  onChange={setNvme}
                  label="Classe NVMe (12 000 IOPS garantis)"
                  description={`${money(T.stockageGoNvme)} par Go au lieu de ${money(T.stockageGoSsd)} en SSD (6 000 IOPS).`}
                />
                <Slider
                  label="Stockage objet S3 (classe chaude)"
                  value={objet}
                  onChange={setObjet}
                  min={0}
                  max={20000}
                  step={500}
                  unite="Go"
                />
                <Slider
                  label="Sauvegarde immuable"
                  value={sauvegarde}
                  onChange={setSauvegarde}
                  min={0}
                  max={20000}
                  step={500}
                  unite="Go"
                />
              </div>
            </Card>

            <Card>
              <CardHeader titre="Réseau et exposition" />
              <div className="space-y-5">
                <Slider label="IP publiques" value={ips} onChange={setIps} min={0} max={8} unite="IP" />
                <Switch
                  checked={antiDdos}
                  onChange={setAntiDdos}
                  label="Protection anti-DDoS volumétrique"
                  description={`${money(T.antiDdos)} par IP et par mois.`}
                />
                <Slider label="Load balancers" value={lbs} onChange={setLbs} min={0} max={4} unite="LB" />
              </div>
            </Card>

            <Card>
              <CardHeader titre="Kubernetes managé" />
              <SegmentedControl
                value={k8s}
                onChange={setK8s}
                options={[
                  { value: 'aucun', label: 'Aucun' },
                  { value: 'single', label: 'Mono-master' },
                  { value: 'ha', label: 'HA (3 masters)' },
                ]}
              />
              <p className="mt-2.5 text-[12px] leading-relaxed text-g-500">
                Le control plane est facturé à part ; les nœuds workers consomment le quota vCPU et
                mémoire de l’Espace Cloud défini ci-dessus.
              </p>
            </Card>
          </div>
        )}

        {volet === 'marketplace' && (
          <div className="space-y-4">
            <Card>
              <Switch
                checked={dedie}
                onChange={setDedie}
                label="Mode dédié (instances isolées)"
                description="Majoration de 20 % sur le prix du siège. En mutualisé, vos comptes vivent sur une instance partagée entre plusieurs organisations, cloisonnée logiquement."
              />
            </Card>
            <Card>
              <CardHeader
                titre="Sièges par service"
                sousTitre="Palier Business. Le siège est l’unité de facturation."
              />
              <div className="space-y-5">
                <Slider label="Drive Pro" value={drive} onChange={setDrive} min={0} max={200} step={5} unite="sièges" />
                <Slider label="Email Pro" value={mail} onChange={setMail} min={0} max={200} step={5} unite="sièges" />
                <Slider label="Visio & Chat" value={visio} onChange={setVisio} min={0} max={200} step={5} unite="sièges" />
                <Slider label="Coffre de mots de passe" value={coffre} onChange={setCoffre} min={0} max={200} step={5} unite="sièges" />
                <Slider label="ERP" value={erp} onChange={setErp} min={0} max={100} step={5} unite="sièges" />
              </div>
            </Card>
          </div>
        )}

        {volet === 'web' && (
          <Card>
            <CardHeader
              titre="Hébergement web"
              sousTitre="Le contenu s’édite dans WordPress ou PrestaShop ; nous opérons le socle."
            />
            <div className="space-y-5">
              <Slider label="Hébergements mutualisés" value={webMut} onChange={setWebMut} min={0} max={10} unite="offres" />
              <Slider label="WordPress managé" value={webWp} onChange={setWebWp} min={0} max={10} unite="offres" />
              <Slider label="PrestaShop managé" value={webPresta} onChange={setWebPresta} min={0} max={5} unite="offres" />
            </div>
          </Card>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="border-p-300" padding={false}>
          <div className="border-b border-p-300/60 bg-p-050 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <MicroLabel className="text-p-700">Estimation mensuelle</MicroLabel>
              <SegmentedControl
                size="sm"
                value={annuel ? 'annuel' : 'mensuel'}
                onChange={(v) => setAnnuel(v === 'annuel')}
                options={[
                  { value: 'mensuel', label: 'Mensuel' },
                  { value: 'annuel', label: '−15 %' },
                ]}
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto px-4 py-3">
            {toutes.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-g-500">
                Ajustez les curseurs pour construire votre configuration.
              </p>
            ) : (
              <ul className="space-y-2">
                {toutes.map((l) => (
                  <li key={l.libelle} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[13px] text-g-700">{l.libelle}</span>
                      {l.detail && <span className="block text-[11px] text-g-500">{l.detail}</span>}
                    </span>
                    <span className="tnum shrink-0 text-[13px] font-semibold text-ink">
                      {money(l.montant)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1.5 border-t border-g-100 px-4 py-3">
            <TotalLigne libelle="Sous-total hors taxes" valeur={money(sousTotal)} />
            {reduction > 0 && (
              <TotalLigne libelle="Remise annuelle (−15 %)" valeur={`− ${money(reduction)}`} ton="ok" />
            )}
            <TotalLigne libelle={`TVA ${TVA_PCT} %`} valeur={money(tva)} />
            <div className="flex items-baseline justify-between gap-3 border-t border-g-100 pt-2">
              <span className="text-[13px] font-bold text-ink">Total mensuel TTC</span>
              <span className="tnum text-[19px] font-bold [font-family:var(--font-display)] text-p-700">
                {money(total)}
              </span>
            </div>
            <p className="tnum pt-1 text-[11px] text-g-500">
              Soit {money(total * 12)} par an{reduction > 0 ? ', engagement de douze mois' : ''}.
            </p>
          </div>
        </Card>

        <div className="space-y-2">
          <Button
            variant="secondary"
            fullWidth
            iconBefore={<Save size={14} />}
            disabled={toutes.length === 0}
            onClick={() =>
              telechargerCsv(
                'estimation-synelia',
                ['Ligne', 'Détail', 'Montant FCFA'],
                [
                  ...toutes.map((l) => [l.libelle, l.detail ?? '', l.montant]),
                  ['Sous-total hors taxes', '', sousTotal],
                  ...(reduction > 0
                    ? [['Remise annuelle', '−15 %, engagement de douze mois', -reduction]]
                    : []),
                  [`TVA ${TVA_PCT} %`, '', tva],
                  ['Total mensuel TTC', '', total],
                  ['Total annuel TTC', '', total * 12],
                ],
              )
            }
          >
            Enregistrer cette configuration
          </Button>
          <p className="text-[11px] leading-relaxed text-g-500">
            La configuration part dans un fichier CSV lisible par un tableur : de quoi la joindre à
            une demande de devis ou la comparer à une offre concurrente, ligne par ligne.
          </p>
          <ButtonLink href="/entreprises#contact" variant="secondary" fullWidth>
            Contacter un architecte
          </ButtonLink>
          <DemandeDevis total={total} lignes={toutes} annuel={annuel} />
          <ButtonLink href="/signup" fullWidth size="lg">
            Créer mon compte
          </ButtonLink>
        </div>

        <Callout ton="info" titre="Ce que l’estimation ne couvre pas">
          Le trafic sortant au-delà des quotas inclus, les licences Windows Server, les prestations
          de migration et les développements spécifiques font l’objet de lignes distinctes.
        </Callout>
      </aside>
    </div>
  )
}

// ─── Demande de devis ───────────────────────────────────────────────

/**
 * Envoie la configuration chiffrée en demande de devis (`POST /public/devis`,
 * `{ contact: { nom, email, sujet, message }, besoin }` requis). Le besoin
 * reprend les lignes du configurateur : le commercial chiffre ce qui est
 * affiché, pas une reformulation. Sans API, accusé local — aucun courriel ne
 * part d’une maquette.
 */
function DemandeDevis({ total, lignes, annuel }: { total: number; lignes: Ligne[]; annuel: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [telephone, setTelephone] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  const besoin = useMemo(
    () =>
      [
        `Configuration du simulateur — ${money(total)}/mois TTC${annuel ? ', engagement annuel −15 %' : ''} :`,
        ...lignes.map((l) => `· ${l.libelle}${l.detail ? ` (${l.detail})` : ''} : ${money(l.montant)}/mois`),
      ].join('\n'),
    [total, lignes, annuel],
  )

  const valide = nom.trim().length > 1 && /.+@.+\..+/.test(email.trim())

  const envoyer = async () => {
    if (!valide || envoi) return
    if (!estActif()) {
      setReference('maquette — aucun courriel ne part')
      return
    }
    setEnvoi(true)
    setErreur(null)
    try {
      const accuse = await requete<{ reference: string }>('/public/devis', {
        methode: 'POST',
        corps: {
          contact: {
            nom: nom.trim(),
            email: email.trim(),
            ...(telephone.trim() ? { telephone: telephone.trim() } : {}),
            ...(organisation.trim() ? { organisation: organisation.trim() } : {}),
            sujet: 'commercial',
            message: `Demande de devis depuis le simulateur (${organisation.trim() || 'organisation non renseignée'}).`,
          },
          besoin,
        },
      })
      setReference(accuse.reference)
    } catch {
      setErreur('La demande n’est pas partie. Réessayez, ou écrivez-nous depuis la page entreprises.')
    } finally {
      setEnvoi(false)
    }
  }

  const fermer = () => {
    setOuvert(false)
    setErreur(null)
  }

  return (
    <>
      <Button variant="secondary" fullWidth disabled={lignes.length === 0} onClick={() => { setReference(null); setOuvert(true) }}>
        Demander un devis
      </Button>
      <Modal
        open={ouvert}
        onClose={fermer}
        title="Demander un devis"
        description="Un commercial reprend votre configuration et vous engage un prix. Le simulateur donne un ordre de grandeur ; le devis engage."
        footer={
          reference ? (
            <Button onClick={fermer}>Fermer</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={fermer}>
                Annuler
              </Button>
              <Button disabled={!valide || envoi} onClick={envoyer}>
                {envoi ? 'Envoi…' : 'Envoyer la demande'}
              </Button>
            </>
          )
        }
      >
        {reference ? (
          <Callout ton="ok" titre={`Demande enregistrée — ${reference}`}>
            Un architecte basé à Abidjan vous rappelle sous un jour ouvré, avec votre configuration
            sous les yeux. Référence à citer en cas de relance.
          </Callout>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nom complet" required>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Awa Diallo" />
              </Field>
              <Field label="Courriel professionnel" required>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="awa@entreprise.ci" />
              </Field>
              <Field label="Organisation">
                <Input value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Entreprise CI" />
              </Field>
              <Field label="Téléphone">
                <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+225 …" />
              </Field>
            </div>
            <Field label="Votre configuration, jointe à la demande">
              <Textarea value={besoin} rows={6} readOnly />
            </Field>
            {erreur && (
              <Callout ton="err" titre="Envoi impossible">
                {erreur}
              </Callout>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

function TotalLigne({  libelle,
  valeur,
  ton,
}: {
  libelle: string
  valeur: string
  ton?: 'ok'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-g-700">{libelle}</span>
      <span className={cn('tnum text-[13px] font-semibold', ton === 'ok' ? 'text-ok' : 'text-ink')}>
        {valeur}
      </span>
    </div>
  )
}

// ─── Comparateur ──────────────────────────────────────────────────────

/** Équivalent Synelia par unité de la référence comparée. */
const EQUIVALENT_SYNELIA: Record<string, number> = {
  vmware: 88000,
  aws: 9600,
  m365: 3900,
  azure: 10200,
}

function Comparateur() {
  const [refId, setRefId] = useState(REFERENCES_COMPARATEUR[0].id)
  const [quantite, setQuantite] = useState(32)
  const [montantActuel, setMontantActuel] = useState(7_520_000)

  const reference = REFERENCES_COMPARATEUR.find((r) => r.id === refId)!
  const equivalent = Math.round(quantite * (EQUIVALENT_SYNELIA[refId] ?? 10000))
  const ecart = montantActuel - equivalent
  const ecartPct = montantActuel > 0 ? Math.round((ecart / montantActuel) * 100) : 0
  const favorable = ecart > 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader
            titre={
              <span className="flex items-center gap-2">
                <Calculator size={15} className="text-p-700" />
                Votre situation actuelle
              </span>
            }
          />
          <div className="space-y-4">
            <Field label="Référence à comparer">
              <Select
                value={refId}
                onChange={(e) => {
                  setRefId(e.target.value)
                  const r = REFERENCES_COMPARATEUR.find((x) => x.id === e.target.value)
                  if (r) setMontantActuel(quantite * r.prixUnitaireIndicatif)
                }}
              >
                {REFERENCES_COMPARATEUR.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nom}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="rounded-[6px] bg-g-050 px-3 py-2 text-[12px] leading-relaxed text-g-700">
              {reference.note}
            </p>
            <Field label={`Nombre de ${reference.unite}`}>
              <Input
                type="number"
                min={1}
                value={quantite}
                onChange={(e) => {
                  const q = Math.max(1, Number(e.target.value) || 1)
                  setQuantite(q)
                  setMontantActuel(q * reference.prixUnitaireIndicatif)
                }}
              />
            </Field>
            <Field
              label="Votre facture mensuelle actuelle"
              hint="en FCFA, hors taxes"
            >
              <Input
                type="number"
                min={0}
                step={10000}
                value={montantActuel}
                onChange={(e) => setMontantActuel(Math.max(0, Number(e.target.value) || 0))}
                suffix="FCFA"
              />
            </Field>
            <p className="text-[12px] leading-relaxed text-g-500">
              Le montant est prérempli à partir d’un tarif public indicatif de{' '}
              {money(reference.prixUnitaireIndicatif)} par {reference.unite.replace(/s$/, '')} et par
              mois. Remplacez-le par votre montant réel pour une comparaison fidèle.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="border-g-300">
              <MicroLabel>{reference.nom}</MicroLabel>
              <p className="tnum mt-2 text-[26px] font-bold leading-none [font-family:var(--font-display)] text-g-700">
                {money(montantActuel)}
              </p>
              <p className="mt-1.5 text-[12px] text-g-500">par mois, hors taxes</p>
              <dl className="mt-4 space-y-1.5 border-t border-g-100 pt-3">
                <Comp cle="Sur 12 mois" valeur={money(montantActuel * 12)} />
                <Comp cle="Sur 36 mois" valeur={money(montantActuel * 36)} />
                <Comp cle={`Par ${reference.unite.replace(/s$/, '')}`} valeur={money(Math.round(montantActuel / quantite))} />
              </dl>
            </Card>

            <Card className="border-p-700 bg-p-050">
              <MicroLabel className="text-p-700">Équivalent Synelia Cloud</MicroLabel>
              <p className="tnum mt-2 text-[26px] font-bold leading-none [font-family:var(--font-display)] text-p-700">
                {money(equivalent)}
              </p>
              <p className="mt-1.5 text-[12px] text-g-700">par mois, hors taxes</p>
              <dl className="mt-4 space-y-1.5 border-t border-p-300/60 pt-3">
                <Comp cle="Sur 12 mois" valeur={money(equivalent * 12)} />
                <Comp cle="Sur 36 mois" valeur={money(equivalent * 36)} />
                <Comp cle={`Par ${reference.unite.replace(/s$/, '')}`} valeur={money(Math.round(equivalent / quantite))} />
              </dl>
            </Card>
          </div>

          <Card
            className={cn(
              favorable ? 'border-ok/25 bg-ok-bg' : 'border-warn/25 bg-warn-bg',
            )}
          >
            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white',
                  favorable ? 'text-ok' : 'text-warn',
                )}
              >
                {favorable ? <TrendingDown size={19} /> : <Scale size={19} />}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-ink">
                  {favorable
                    ? `Écart favorable de ${money(Math.abs(ecart))} par mois`
                    : `Écart défavorable de ${money(Math.abs(ecart))} par mois`}
                </p>
                <p className="tnum mt-1 text-[13px] text-g-700">
                  Soit {pct(Math.abs(ecartPct))} {favorable ? "d'économie" : 'de surcoût'} · {' '}
                  <span className="font-semibold">{money(Math.abs(ecart) * 36)}</span> sur trois ans.
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-g-700">
                  {favorable
                    ? 'Cet écart s’explique principalement par l’absence de licence propriétaire, par la localisation du calcul en Côte d’Ivoire — qui supprime les coûts de transit international — et par des quotas de trafic sortant inclus plutôt que facturés à l’usage.'
                    : 'Sur ce dimensionnement, la comparaison n’est pas à notre avantage. C’est souvent le cas sur les très petites configurations, où l’effet d’échelle joue contre nous. Un architecte peut affiner : le socle, le plan de sauvegarde et le niveau de service ne sont pas comparables à l’identique.'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-info/25 bg-info-bg">
            <div className="flex items-start gap-3">
              <Info size={16} className="mt-0.5 shrink-0 text-info" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink">
                  Hypothèses de calcul — à lire avant de conclure
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-g-700">
                  Un comparateur qui cache ses hypothèses est un argument de vente, pas un outil de
                  décision. Voici exactement ce que nous supposons.
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {HYPOTHESES_COMPARATEUR.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-info" />
                      <span className="text-[12px] leading-relaxed text-g-700">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/entreprises#contact">
              Faire vérifier cette comparaison par un architecte
            </ButtonLink>
            <Badge tone="neutral">Atelier de cadrage sans frais</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

function Comp({ cle, valeur }: { cle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[12px] text-g-500">{cle}</dt>
      <dd className="tnum text-[12px] font-semibold text-ink">{valeur}</dd>
    </div>
  )
}
