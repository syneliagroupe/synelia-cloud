'use client'

import { useState } from 'react'
import { ArrowRight, CalendarClock, MoveRight, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateCourte, dateHeure, dureeMin, money, num, pct } from '@/lib/format'
import { BACKENDS, TRAJECTOIRE_SORTIE, VMS } from '@/lib/mock'
import { BACKEND_LABEL, SITE_COURT, type Backend } from '@/lib/types'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { Timeline } from '@/components/composition/flow'
import { useApp } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, requete } from '@/lib/api/client'

const ONGLETS = [
  { id: 'trajectoire', label: 'Trajectoire de sortie' },
  { id: 'vagues', label: 'Vagues de migration' },
  { id: 'machines', label: 'Machines à migrer' },
  { id: 'methode', label: 'Méthode' },
]

interface Vague {
  id: string
  nom: string
  source: string
  cible: string
  machines: number
  organisations: string[]
  fenetre: string
  mode: 'chaud' | 'froid' | 'mixte'
  statut: 'terminee' | 'en_cours' | 'planifiee' | 'a_planifier'
  avancement: number
}

const VAGUES: Vague[] = [
  {
    id: 'v1',
    nom: 'Vague 1 — environnements hors production',
    source: 'HV-RBX-01',
    cible: 'OS-ABJ-01',
    machines: 34,
    organisations: ['Digital Business Africa', 'SOTRA', 'Ivoire Agro'],
    fenetre: '2026-04-11',
    mode: 'froid',
    statut: 'terminee',
    avancement: 100,
  },
  {
    id: 'v2',
    nom: 'Vague 2 — pré-production',
    source: 'HV-RBX-01',
    cible: 'OS-ABJ-01',
    machines: 28,
    organisations: ['Digital Business Africa', 'COFINA', 'AMUGA'],
    fenetre: '2026-07-18',
    mode: 'chaud',
    statut: 'terminee',
    avancement: 100,
  },
  {
    id: 'v3',
    nom: 'Vague 3 — production non critique',
    source: 'HV-RBX-01',
    cible: 'CS-ABJ-03',
    machines: 22,
    organisations: ['SOTRA', 'Ivoire Agro'],
    fenetre: '2026-09-12',
    mode: 'chaud',
    statut: 'en_cours',
    avancement: 41,
  },
  {
    id: 'v4',
    nom: 'Vague 4 — production critique Hyper-V',
    source: 'HV-RBX-01',
    cible: 'OS-ABJ-01',
    machines: 18,
    organisations: ['COFINA', 'ONECI'],
    fenetre: '2026-11-14',
    mode: 'mixte',
    statut: 'planifiee',
    avancement: 0,
  },
  {
    id: 'v5',
    nom: 'Vague 5 — vSphere hors production',
    source: 'CL-GRA-01',
    cible: 'OS-ABJ-01',
    machines: 46,
    organisations: ['Digital Business Africa', 'COFINA', 'AMUGA', 'ONECI'],
    fenetre: '2027-01-16',
    mode: 'froid',
    statut: 'planifiee',
    avancement: 0,
  },
  {
    id: 'v6',
    nom: 'Vague 6 — vSphere production',
    source: 'CL-GRA-01',
    cible: 'CS-ABJ-03',
    machines: 62,
    organisations: ['Toutes les organisations concernées'],
    fenetre: '2027-04-17',
    mode: 'mixte',
    statut: 'a_planifier',
    avancement: 0,
  },
]

const LIBELLE_STATUT: Record<Vague['statut'], string> = {
  terminee: 'Terminée',
  en_cours: 'En cours',
  planifiee: 'Planifiée',
  a_planifier: 'À planifier',
}

const TON_STATUT: Record<Vague['statut'], 'ok' | 'info' | 'neutral' | 'warn'> = {
  terminee: 'ok',
  en_cours: 'info',
  planifiee: 'neutral',
  a_planifier: 'warn',
}

/** Forme distante d’une campagne (`GET /admin/migration/campagnes`). */
interface CampagneMigrationDistante {
  id: string
  nom: string
  backendSource: string
  backendCible: string
  ressources: number
  migrees: number
  fenetre: string
  statut: 'planifiee' | 'en_cours' | 'terminee' | 'suspendue' | 'echec'
}

/**
 * Ramène une campagne du backend à la forme locale d’une vague : mêmes
 * champs, mêmes statuts affichables. Une campagne suspendue redevient à
 * planifier-explicite (`planifiee`), un échec reste à replanifier.
 */
function normaliserCampagne(v: Vague): Vague {
  const distante = v as unknown as Partial<CampagneMigrationDistante>
  if (!distante.backendSource) return v
  const ressources = distante.ressources ?? 0
  return {
    id: v.id,
    nom: distante.nom ?? v.nom,
    source: distante.backendSource,
    cible: distante.backendCible ?? v.cible,
    machines: ressources,
    organisations: [],
    fenetre: distante.fenetre ?? v.fenetre,
    mode: 'mixte',
    statut:
      distante.statut === 'en_cours'
        ? 'en_cours'
        : distante.statut === 'terminee'
          ? 'terminee'
          : distante.statut === 'echec'
            ? 'a_planifier'
            : 'planifiee',
    avancement: ressources > 0 ? Math.round(((distante.migrees ?? 0) / ressources) * 100) : 0,
  }
}

export default function Migration() {
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const vaguesBrutes = useCollection<Vague>('vagues-migration', VAGUES)
  // En mode API le backend renvoie des campagnes de migration, pas des
  // vagues : on les ramène à la forme locale pour l’affichage.
  const vagues = {
    ...vaguesBrutes,
    items: estActif() ? vaguesBrutes.items.map(normaliserCampagne) : vaguesBrutes.items,
  }
  // Les socles en sortie aussi : les codes backend sont inconnus du jeu local.
  const socles = useCollection<Backend>('backends', BACKENDS)
  const SOCLES = estActif() ? socles.items : BACKENDS
  const [onglet, setOnglet] = useState('trajectoire')
  const [lancement, setLancement] = useState<Vague | null>(null)

  const enSortie = SOCLES.filter((b) => b.enSortie?.actif)
  const migrees = vagues.items
    .filter((v) => v.statut === 'terminee')
    .reduce((a, v) => a + v.machines, 0)
  const total = vagues.items.reduce((a, v) => a + v.machines, 0)
  const enCours = vagues.items.find((v) => v.statut === 'en_cours')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[{ label: 'Espace super admin', href: '/admin' }, { label: 'Migration entre socles' }]}
        titre="Migration entre socles"
        sousTitre="Nous exploitons encore des hyperviseurs propriétaires, et nous le disons. Voici le calendrier de sortie, son avancement réel, et ce qui reste à faire. Cette page a son équivalent public : nous ne communiquons pas un chiffre différent à l’extérieur."
        actions={
          <>
            <BoutonFormulaire
              libelle="Nouvelle campagne"
              size="md"
              icone={<CalendarClock size={14} />}
              action="capacity.manage"
              titre="Planifier une campagne de migration"
              description="Une campagne déplace les ressources d’un socle en sortie vers un socle libre, dans une fenêtre annoncée aux organisations concernées sept jours avant. Le retour arrière reste possible sept jours."
              libelleValider="Planifier"
              champs={[
                {
                  id: 'nom',
                  label: 'Nom',
                  placeholder: 'Vague 7 — bases de données restantes',
                  obligatoire: true,
                },
                {
                  id: 'backendSource',
                  label: 'Socle source',
                  type: 'select',
                  demi: true,
                  options: (enSortie.length > 0 ? enSortie : SOCLES).map((b) => ({
                    value: b.code,
                    label: `${b.code} · ${SITE_COURT[b.site]}`,
                  })),
                },
                {
                  id: 'backendCible',
                  label: 'Socle cible',
                  type: 'select',
                  demi: true,
                  options: SOCLES.filter((b) => !b.enSortie?.actif).map((b) => ({
                    value: b.code,
                    label: `${b.code} · ${SITE_COURT[b.site]}`,
                  })),
                },
                {
                  id: 'fenetre',
                  label: 'Fenêtre',
                  type: 'select',
                  options: [
                    { value: 'Samedi 22h00 – 02h00', label: 'Samedi 22h00 – 02h00' },
                    { value: 'Dimanche 02h00 – 06h00', label: 'Dimanche 02h00 – 06h00' },
                    { value: 'Nuit de semaine 23h00 – 04h00', label: 'Nuit de semaine 23h00 – 04h00' },
                  ],
                },
                {
                  id: 'notifierClients',
                  label: 'Prévenir les organisations concernées',
                  type: 'switch',
                  placeholder: 'Avis envoyé sept jours avant',
                },
              ]}
              valeursDepart={{ notifierClients: true }}
              operation={(v) => ({
                titre: `${v.nom} planifiée`,
                detail: `${v.backendSource} → ${v.backendCible} · ${v.fenetre}.`,
                appel: () =>
                  creerRessource('/admin/migration/campagnes', {
                    nom: String(v.nom).trim(),
                    backendSource: String(v.backendSource),
                    backendCible: String(v.backendCible),
                    fenetre: String(v.fenetre),
                    notifierClients: Boolean(v.notifierClients),
                  }),
                effet: () =>
                  vaguesBrutes.creer({
                    id: vaguesBrutes.identifiant('v'),
                    nom: String(v.nom).trim(),
                    source: String(v.backendSource),
                    cible: String(v.backendCible),
                    machines: 0,
                    organisations: [],
                    fenetre: String(v.fenetre),
                    mode: 'mixte',
                    statut: 'planifiee',
                    avancement: 0,
                  }),
                effetFinal: () => vaguesBrutes.recharger(),
              })}
            />
            <ButtonLink variant="secondary" external href="/souverainete">
              Voir la page publique
            </ButtonLink>
          </>
        }
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {enSortie.length} socles en sortie
            </Badge>
            <Badge tone="neutral" size="sm">
              {migrees} / {total} machines migrées
            </Badge>
            <Badge tone="info" size="sm">
              Fin de trajectoire : juin 2027
            </Badge>
          </>
        }
      />

      <Callout ton="violet" titre="Trajectoire publiée, trimestre par trimestre">
        50 % de la capacité est déjà sur des socles libres, le reste sort d’ici juin 2027, et
        l’avancement est publié côté vitrine. Un client sous contrainte réglementaire stricte peut
        demander dès aujourd’hui un placement exclusivement souverain.
      </Callout>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          libelle="Capacité déjà libre"
          valeur={pct(50)}
          ton="ok"
          detail="OpenStack, Proxmox, CloudStack"
        />
        <StatTile
          libelle="Machines migrées"
          valeur={migrees}
          detail={`sur ${total} à migrer`}
          ton="ok"
        />
        <StatTile
          libelle="Vagues terminées"
          valeur={`${vagues.items.filter((v) => v.statut === 'terminee').length}/${vagues.items.length}`}
        />
        <StatTile
          libelle="Interruptions constatées"
          valeur="0"
          ton="ok"
          detail="Sur 62 machines migrées à ce jour"
        />
        <StatTile
          libelle="Licences économisées"
          valeur={money(28_800_000)}
          ton="ok"
          detail="Par an, à la fin de la trajectoire"
        />
      </div>

      <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

      {onglet === 'trajectoire' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Où nous en sommes"
              sousTitre="Part de la capacité installée, par nature de socle. Ces chiffres sont ceux publiés sur la page publique."
            />
            <div className="space-y-4">
              {TRAJECTOIRE_SORTIE.map((t) => (
                <div key={t.backend}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-ink">{t.backend}</span>
                      <span className="block text-[12px] text-g-500">{t.part}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={t.avancement === 100 ? 'ok' : 'warn'} size="sm">
                        {t.cible}
                      </Badge>
                      <span
                        className={cn(
                          'tnum text-[13px] font-bold',
                          t.avancement === 100 ? 'text-ok' : 'text-ink',
                        )}
                      >
                        {pct(t.avancement)}
                      </span>
                    </span>
                  </div>
                  <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-g-100">
                    <span
                      className={cn(
                        'block h-full rounded-full transition-[width] duration-500',
                        t.avancement === 100 ? 'bg-ok' : 'bg-p-600',
                      )}
                      style={{ width: `${t.avancement}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {enSortie.map((b) => (
              <Card key={b.id} className="border-warn/30">
                <CardHeader
                  titre={
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono">{b.code}</span>
                      <span className="text-[12px] font-normal text-g-500">
                        {BACKEND_LABEL[b.type]}
                      </span>
                    </span>
                  }
                  sousTitre={`${SITE_COURT[b.site]} · ${b.hosts} hôtes · ${num(b.capacite.vcpu)} vCPU installés`}
                  actions={
                    <Badge tone="warn" dot size="sm">
                      En sortie
                    </Badge>
                  }
                />
                <KeyValueList
                  colonnes={1}
                  items={[
                    { cle: 'Socle cible', valeur: b.enSortie!.cibleMigration },
                    {
                      cle: 'Machines à migrer',
                      valeur: String(
                        vagues.items.filter((v) => v.source === b.code).reduce(
                          (a, v) => a + v.machines,
                          0,
                        ),
                      ),
                    },
                    {
                      cle: 'Vagues restantes',
                      valeur: String(
                        vagues.items.filter((v) => v.source === b.code && v.statut !== 'terminee').length,
                      ),
                    },
                    { cle: 'Allocation actuelle', valeur: pct(b.usage.vcpuPct) },
                    {
                      cle: 'Nouvelle création',
                      valeur: 'Refusée — le socle n’est plus dans le pool de placement',
                    },
                  ]}
                />
                <MicroLabel className="mt-4 mb-2">Raison de la sortie</MicroLabel>
                <p className="text-[12px] leading-relaxed text-g-700">
                  {b.type === 'vsphere'
                    ? 'Coût de licence multiplié par 2,8 après le changement de propriétaire de l’éditeur, sans contrepartie fonctionnelle. Marge du socle tombée à 31 %, contre 55 % sur nos socles libres. La décision est autant économique que stratégique.'
                    : 'Licences par cœur difficilement prévisibles, et dépendance à un éditeur unique pour la couche de virtualisation. Marge de 24 %, la plus faible de nos socles.'}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              titre="Calendrier"
              sousTitre="Les dates sont fermes pour les vagues planifiées, indicatives pour celles à planifier."
            />
            <Timeline
              evenements={vagues.items.map((v) => ({
                id: v.id,
                titre: (
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{v.nom}</span>
                    <Badge tone={TON_STATUT[v.statut]} size="sm">
                      {LIBELLE_STATUT[v.statut]}
                    </Badge>
                  </span>
                ),
                detail: `${v.machines} machines · ${v.source} → ${v.cible} · migration ${v.mode === 'chaud' ? 'à chaud' : v.mode === 'froid' ? 'à froid' : 'mixte'}`,
                horodatage: dateCourte(v.fenetre),
                ton:
                  v.statut === 'terminee'
                    ? 'ok'
                    : v.statut === 'en_cours'
                      ? 'info'
                      : v.statut === 'a_planifier'
                        ? 'warn'
                        : 'neutral',
              }))}
            />
          </Card>
        </div>
      )}

      {onglet === 'vagues' && (
        <div className="space-y-4">
          {enCours && (
            <Callout ton="info" titre={`${enCours.nom} est en cours`}>
              {Math.round((enCours.avancement / 100) * enCours.machines)} machines sur{' '}
              {enCours.machines} déjà déplacées de {enCours.source} vers {enCours.cible}, sans
              interruption constatée. Prochaine fenêtre de reprise : cette nuit à 2 h GMT.
            </Callout>
          )}

          {vagues.items.map((v) => (
            <Card
              key={v.id}
              className={cn(
                v.statut === 'en_cours' ? 'border-info/40' : v.statut === 'a_planifier' ? 'border-warn/30' : '',
              )}
            >
              <CardHeader
                titre={v.nom}
                sousTitre={`Fenêtre : ${dateCourte(v.fenetre)} · ${v.organisations.join(', ')}`}
                actions={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={v.mode === 'chaud' ? 'ok' : v.mode === 'froid' ? 'warn' : 'info'}
                      size="sm"
                    >
                      {v.mode === 'chaud'
                        ? 'À chaud'
                        : v.mode === 'froid'
                          ? 'À froid'
                          : 'Mixte'}
                    </Badge>
                    <Badge tone={TON_STATUT[v.statut]} dot size="sm">
                      {LIBELLE_STATUT[v.statut]}
                    </Badge>
                  </span>
                }
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-g-300 px-3.5 py-3">
                    <span className="font-mono text-[13px] font-bold text-ink">{v.source}</span>
                    <MoveRight size={16} className="shrink-0 text-p-700" />
                    <span className="font-mono text-[13px] font-bold text-ok">{v.cible}</span>
                    <span className="ml-auto text-[12px] text-g-700">
                      {v.machines} machines · {v.organisations.length} organisation
                      {v.organisations.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-semibold text-g-700">Avancement</span>
                      <span className="tnum text-[12px] font-bold text-ink">
                        {Math.round((v.avancement / 100) * v.machines)} / {v.machines} machines
                      </span>
                    </div>
                    <span className="block h-2.5 overflow-hidden rounded-full bg-g-100">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          v.avancement === 100 ? 'bg-ok' : 'bg-p-600',
                        )}
                        style={{ width: `${Math.max(2, v.avancement)}%` }}
                      />
                    </span>
                  </div>

                  {v.mode !== 'chaud' && v.statut !== 'terminee' && (
                    <Callout ton="warn" className="mt-3.5" titre="Cette vague comporte une interruption">
                      Les machines en migration à froid s’arrêtent le temps du transfert — entre 4 et
                      20 minutes selon la taille du disque. Les clients concernés doivent être prévenus
                      au moins sept jours avant, avec la fenêtre exacte et la durée estimée pour
                      chacune de leurs machines.
                    </Callout>
                  )}
                </div>

                <div className="space-y-2">
                  <KeyValueList
                    colonnes={1}
                    items={[
                      { cle: 'Machines', valeur: String(v.machines) },
                      {
                        cle: 'Mode',
                        valeur:
                          v.mode === 'chaud'
                            ? 'À chaud — sans interruption'
                            : v.mode === 'froid'
                              ? 'À froid — arrêt requis'
                              : 'Mixte selon la machine',
                      },
                      { cle: 'Fenêtre', valeur: dateCourte(v.fenetre) },
                      {
                        cle: 'Durée estimée',
                        valeur: dureeMin(v.machines * (v.mode === 'chaud' ? 8 : 14)),
                      },
                      {
                        cle: 'Retour arrière',
                        valeur: 'Possible pendant 7 jours — le disque source est conservé',
                      },
                    ]}
                  />
                  {v.statut === 'planifiee' && (
                    <GatedAction
                      autorise={autorise('capacity.manage')}
                      message={refus('capacity.manage')}
                    >
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        iconBefore={<PlayCircle size={13} />}
                        onClick={() => setLancement(v)}
                      >
                        Lancer la vague
                      </Button>
                    </GatedAction>
                  )}
                  {v.statut === 'a_planifier' && (
                    <GatedAction
                      autorise={autorise('capacity.manage')}
                      message={refus('capacity.manage')}
                    >
                      <BoutonFormulaire
                        libelle="Planifier une fenêtre"
                        variant="ghost"
                        fullWidth
                        action="capacity.manage"
                        titre={`Planifier ${v.nom}`}
                        description="La fenêtre est annoncée aux organisations concernées sept jours avant. Une migration à froid demande leur accord explicite."
                        champs={[
                          {
                            id: 'fenetre',
                            label: 'Fenêtre',
                            type: 'select',
                            options: [
                              { value: 'Samedi 22h00 – 02h00', label: 'Samedi 22h00 – 02h00' },
                              { value: 'Dimanche 02h00 – 06h00', label: 'Dimanche 02h00 – 06h00' },
                              { value: 'Nuit de semaine 23h00 – 04h00', label: 'Nuit de semaine 23h00 – 04h00' },
                            ],
                          },
                        ]}
                        libelleValider="Planifier"
                        operation={(f) => ({
                          titre: `${v.nom} planifiée`,
                          detail: `${f.fenetre} · ${v.organisations.length} organisation(s) prévenue(s).`,
                          effet: () =>
                            vagues.modifier(v.id, {
                              statut: 'planifiee',
                              fenetre: String(f.fenetre),
                            }),
                        })}
                      />
                    </GatedAction>
                  )}
                  {(v.statut === 'en_cours' || v.statut === 'terminee') && (
                    <BoutonAction
                      libelle="Revenir en arrière"
                      variant="ghost"
                      fullWidth
                      confirmation={{
                        ressource: v.nom,
                        titre: `Revenir en arrière sur ${v.nom} ?`,
                        pertes: [
                          'Les machines déjà migrées repassent sur le socle source',
                          'Les données écrites depuis la migration sont conservées',
                          'La vague repasse à planifier, à relancer dans une nouvelle fenêtre',
                        ],
                        libelleAction: 'Revenir en arrière',
                      }}
                      operation={{
                        action: 'capacity.manage',
                        ton: 'warn',
                        titre: `${v.nom} : retour arrière lancé`,
                        detail:
                          'Le disque source a été conservé : les machines repassent dessus, sans transfert.',
                        appel: () =>
                          requete(
                            `/admin/migration/campagnes/${encodeURIComponent(v.id)}/rollback`,
                            { methode: 'POST' },
                          ),
                        effet: () => vagues.modifier(v.id, { statut: 'planifiee', avancement: 0 }),
                        effetFinal: () => vagues.recharger(),
                      }}
                    />
                  )}
                  {v.statut === 'en_cours' && (
                    <BoutonAction
                      libelle="Suspendre la vague"
                      variant="ghost"
                      fullWidth
                      operation={{
                        action: 'capacity.manage',
                        ton: 'warn',
                        titre: `${v.nom} suspendue`,
                        detail:
                          'Les machines déjà migrées restent sur le socle cible ; les suivantes attendent une reprise explicite.',
                        appel: () =>
                          requete(
                            `/admin/migration/campagnes/${encodeURIComponent(v.id)}/suspension`,
                            { methode: 'POST' },
                          ),
                        effet: () => vagues.modifier(v.id, { statut: 'planifiee' }),
                        effetFinal: () => vagues.recharger(),
                      }}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {onglet === 'machines' && (
        <div className="space-y-4">
          <Card padding={false}>
            <div className="border-b border-g-100 px-4 py-3.5">
              <CardHeader
                titre="Machines concernées"
                sousTitre="Le mode de migration disponible dépend du socle source, du socle cible et de la configuration matérielle de la machine."
                className="mb-0"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="border-b border-g-300 bg-g-050">
                    {['Machine', 'Système', 'Ressources', 'Socle actuel', 'Socle cible', 'Mode possible', 'Vague', 'Interruption'].map(
                      (h) => (
                        <th key={h} className="type-micro px-3 py-2 text-left font-semibold text-g-500">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {VMS.slice(0, 12).map((v, i) => {
                    const chaud = i % 3 !== 2
                    const vague = VAGUES[Math.min(VAGUES.length - 1, 2 + (i % 3))]
                    return (
                      <tr key={v.id} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-ink">
                          {v.nom}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-g-700">{v.os}</td>
                        <td className="px-3 py-2.5 text-[12px] text-g-700">
                          {v.vcpu} vCPU / {v.ramGo} Go / {v.diskGo} Go
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-warn">
                          {i % 2 === 0 ? 'HV-RBX-01' : 'CL-GRA-01'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-ok">
                          {i % 2 === 0 ? 'OS-ABJ-01' : 'CS-ABJ-03'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={chaud ? 'ok' : 'warn'} size="sm">
                            {chaud ? 'À chaud' : 'À froid'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-g-500">{vague.nom.split('—')[0].trim()}</td>
                        <td className="px-3 py-2.5">
                          {chaud ? (
                            <span className="text-[12px] font-semibold text-ok">Aucune</span>
                          ) : (
                            <span className="tnum text-[12px] font-semibold text-warn">
                              ~{Math.max(4, Math.round(v.diskGo / 12))} min
                            </span>
                          )}
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
              titre="Pourquoi certaines machines ne migrent pas à chaud"
              sousTitre="Les raisons techniques réelles, pas une limitation arbitraire."
            />
            <div className="space-y-2">
              {[
                {
                  r: 'Périphérique matériel attaché',
                  d: 'Un jeton de sécurité ou une clé matérielle branchée sur un hôte précis ne peut pas suivre la machine. Le déplacement exige un arrêt, et le rebranchement physique sur le nouvel hôte.',
                },
                {
                  r: 'Module de plateforme sécurisée virtuel',
                  d: 'Les clés de chiffrement liées au module doivent être réémises par le socle cible. La machine s’arrête, les clés sont regénérées, elle redémarre.',
                },
                {
                  r: 'Format de disque incompatible',
                  d: 'Le passage d’un format propriétaire vers un format ouvert exige une conversion, qui se fait disque au repos. C’est le cas le plus fréquent.',
                },
                {
                  r: 'Jeu d’instructions processeur différent',
                  d: 'Une machine qui utilise des instructions absentes du processeur cible ne peut pas être déplacée à chaud sans risquer une erreur d’exécution immédiate.',
                },
              ].map((x) => (
                <div key={x.r} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">{x.r}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-g-700">{x.d}</p>
                </div>
              ))}
            </div>
            <Callout ton="info" className="mt-4" titre="Nous préférons annoncer 20 minutes et en prendre 6">
              L’estimation d’interruption communiquée au client est volontairement pessimiste. Sur les
              62 machines déjà migrées, la durée réelle a toujours été inférieure à l’estimation. Un
              client qui a réservé une fenêtre de 20 minutes et qui récupère son service en 6 est
              satisfait ; l’inverse produit un incident.
            </Callout>
          </Card>
        </div>
      )}

      {onglet === 'methode' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Déroulé d’une migration"
              sousTitre="La même séquence pour chaque machine, quelle que soit la vague."
            />
            <ol className="space-y-3">
              {[
                {
                  t: 'Inventaire et qualification',
                  d: 'Configuration matérielle, format de disque, périphériques attachés, dépendances réseau. La machine est classée « à chaud » ou « à froid » à ce moment, pas au dernier moment.',
                },
                {
                  t: 'Snapshot de sécurité',
                  d: 'Un point de restauration complet est pris avant toute opération, sur le socle source. Il est conservé sept jours après la migration.',
                },
                {
                  t: 'Notification du client',
                  d: 'Sept jours avant pour une migration à froid, avec la fenêtre exacte et la durée estimée. Vingt-quatre heures avant pour une migration à chaud, à titre d’information.',
                },
                {
                  t: 'Copie du disque',
                  d: 'Transfert incrémental pendant que la machine tourne. Sur une migration à froid, une dernière passe se fait machine arrêtée, ce qui limite l’interruption au delta restant.',
                },
                {
                  t: 'Bascule',
                  d: 'La machine démarre sur le socle cible. Son adresse privée, son adresse publique et ses règles de pare-feu sont conservées à l’identique.',
                },
                {
                  t: 'Vérification',
                  d: 'Démarrage du système, réponse des services exposés, cohérence des points de montage, connectivité vers les autres composants. Un échec sur l’un de ces points déclenche un retour arrière immédiat.',
                },
                {
                  t: 'Conservation du disque source',
                  d: 'Le disque d’origine est conservé sept jours, éteint. Un retour arrière reste possible pendant toute cette période, sans transfert.',
                },
              ].map((x, i) => (
                <li key={x.t} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-p-050 text-[12px] font-bold text-p-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{x.t}</span>
                    <span className="block text-[12px] leading-relaxed text-g-700">{x.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                titre="Ce que le client conserve"
                sousTitre="Une migration réussie est une migration qu’il ne remarque pas."
              />
              <div className="space-y-1.5">
                {[
                  'Adresse IP privée et publique, à l’identique',
                  'Règles de pare-feu et groupes de sécurité',
                  'Points de montage et volumes attachés',
                  'Plan de sauvegarde et historique des points de restauration',
                  'Nom de la machine et étiquettes de répartition',
                  'Enregistrements DNS internes',
                  'Fenêtre de maintenance déclarée',
                ].map((x) => (
                  <div key={x} className="flex items-start gap-2">
                    <ArrowRight size={11} className="mt-1 shrink-0 text-ok" />
                    <span className="text-[12px] text-ink">{x}</span>
                  </div>
                ))}
              </div>
              <MicroLabel className="mt-4 mb-1.5">Ce qui change, et que nous signalons</MicroLabel>
              <div className="space-y-1.5">
                {[
                  'Le nom du socle affiché sur la fiche de la machine',
                  'L’identifiant de l’hôte physique d’exécution',
                  'Le mode de migration désormais disponible — souvent meilleur qu’avant',
                ].map((x) => (
                  <div key={x} className="flex items-start gap-2">
                    <ArrowRight size={11} className="mt-1 shrink-0 text-warn" />
                    <span className="text-[12px] text-g-700">{x}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                titre="Bilan des migrations déjà faites"
                sousTitre="62 machines, deux vagues terminées."
              />
              <KeyValueList
                colonnes={1}
                items={[
                  { cle: 'Machines migrées', valeur: '62' },
                  { cle: 'Interruptions non planifiées', valeur: '0' },
                  { cle: 'Retours arrière déclenchés', valeur: '1 — incompatibilité de pilote réseau' },
                  { cle: 'Durée d’interruption la plus longue', valeur: '11 minutes, pour 20 annoncées' },
                  { cle: 'Tickets ouverts par les clients', valeur: '3 — tous des demandes d’information' },
                  { cle: 'Écart au calendrier', valeur: 'Vague 2 avancée de 3 semaines' },
                ]}
              />
              <Callout ton="ok" className="mt-4" titre="Le retour arrière a servi une fois">
                Sur la vague 2, une machine n’a pas retrouvé son réseau après bascule — un pilote
                spécifique au socle source. Retour arrière en quatre minutes, migration réussie deux
                semaines plus tard après mise à jour du pilote.
              </Callout>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={lancement !== null}
        onClose={() => setLancement(null)}
        titre="Lancer une vague de migration"
        ressource={lancement?.nom ?? ''}
        libelleAction="Lancer la vague"
        pertes={[
          `${lancement?.machines ?? 0} machines seront déplacées de ${lancement?.source} vers ${lancement?.cible}`,
          lancement?.mode === 'chaud'
            ? 'Aucune interruption attendue — migration à chaud'
            : 'Certaines machines subiront une interruption de 4 à 20 minutes',
          `${lancement?.organisations.length ?? 0} organisations sont concernées et doivent avoir été prévenues`,
          'Le retour arrière reste possible pendant sept jours, machine par machine',
        ]}
        onConfirm={() => {
          const cible = lancement
          if (cible) {
            executer({
              action: 'capacity.manage',
              ton: 'info',
              titre: `${cible.nom} lancée`,
              appel: () =>
                requete(
                  `/admin/migration/campagnes/${encodeURIComponent(cible.id)}/lancement`,
                  { methode: 'POST' },
                ),
              effet: () => vagues.modifier(cible.id, { statut: 'en_cours', avancement: 4 }),
              job: { workflow: 'migration.lot', cible: cible.nom },
              effetFinal: () => {
                // En maquette, le job simulé se termine ici ; en mode API,
                // c’est le rechargement qui rapporte l’état réel.
                if (!estActif())
                  vagues.modifier(cible.id, { statut: 'terminee', avancement: 100 })
                vagues.recharger()
              },
            })
          }
          setLancement(null)
        }}
      />
    </div>
  )
}
