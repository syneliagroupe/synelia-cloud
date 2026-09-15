'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { cn, seededSeries, surfaceMarque } from '@/lib/utils'
import { dateCourte, goHumain, money, num, pct } from '@/lib/format'
import { BASES_MANAGEES } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { HealthBadge, QuotaBar, StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { GrilleSparkCharts, LogPeek } from '@/components/business/observabilite'
import { useApp, useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, estActif, requete, supprimerRessource } from '@/lib/api/client'
import type { LigneLog, ManagedDatabase } from '@/lib/types'

// `id` reste le code attendu par le backend (`BaseManageeCreation.palier` :
// s1/s2/m1/m2/l1/xl1) — seul `label` est un texte d'affichage.
const PALIERS = [
  { id: 's1', label: 'Small · 2 vCPU · 8 Go' },
  { id: 'm1', label: 'Medium · 4 vCPU · 16 Go' },
  { id: 'l1', label: 'Large · 8 vCPU · 32 Go' },
  { id: 'xl1', label: 'XLarge · 16 vCPU · 64 Go' },
]

const MOTEURS: Record<string, { nom: string; teinte: string; port: number }> = {
  postgresql: { nom: 'PostgreSQL', teinte: '#336791', port: 5432 },
  mysql: { nom: 'MySQL', teinte: '#00758F', port: 3306 },
  mariadb: { nom: 'MariaDB', teinte: '#C0765A', port: 3306 },
  mongodb: { nom: 'MongoDB', teinte: '#47A248', port: 27017 },
  redis: { nom: 'Redis', teinte: '#DC382D', port: 6379 },
}

const ONGLETS = [
  { id: 'connexion', label: 'Connexion' },
  { id: 'replicas', label: 'Réplicas de lecture' },
  { id: 'sauvegardes', label: 'Sauvegardes & PITR' },
  { id: 'metriques', label: 'Métriques' },
  { id: 'version', label: 'Version' },
  { id: 'reseau', label: 'Restriction réseau' },
]

const REQUETES_LENTES: LigneLog[] = [
  { ts: '2026-08-19T15:14:02Z', niveau: 'WARN', source: 'slow-query', message: 'SELECT * FROM facture WHERE periode = $1 — 1 284 ms — index manquant sur (periode)' },
  { ts: '2026-08-19T14:52:41Z', niveau: 'WARN', source: 'slow-query', message: 'SELECT ... JOIN client ON ... — 942 ms — 48 200 lignes parcourues' },
  { ts: '2026-08-19T14:08:18Z', niveau: 'INFO', source: 'autovacuum', message: 'automatic vacuum of table "facture": 12 480 pages removed' },
  { ts: '2026-08-19T13:41:07Z', niveau: 'WARN', source: 'slow-query', message: 'UPDATE rapprochement SET statut = $1 WHERE lot_id = $2 — 812 ms' },
  { ts: '2026-08-19T12:22:55Z', niveau: 'ERROR', source: 'connection', message: 'FATAL: remaining connection slots reserved for superuser — pic à 298/300' },
  { ts: '2026-08-19T11:04:12Z', niveau: 'INFO', source: 'checkpoint', message: 'checkpoint complete: wrote 8 412 buffers in 4.2 s' },
]

export default function BasesManagees() {
  const espace = useEspace()
  const { autorise, refus } = useApp()
  const [motDePasseRegenere, setMotDePasseRegenere] = useState<string | null>(null)
  const collection = useCollection<ManagedDatabase>('bases-managees', BASES_MANAGEES)
  const bases = collection.items.filter((b) => b.espaceId === espace.id)
  const [selection, setSelection] = useState(bases[0]?.id ?? '')
  const [creationOuverte, setCreationOuverte] = useState(false)
  const [reseaux, setReseaux] = useState([
    '10.0.1.0/24 · prod-front',
    '10.0.4.0/24 · ci-cd',
    '10.99.0.0/24 · pool VPN',
  ])
  const [restreint, setRestreint] = useState(true)
  const [ipsExternes, setIpsExternes] = useState(false)
  const [instantPitr, setInstantPitr] = useState('2026-08-19T14:00')
  const [destinationPitr, setDestinationPitr] = useState('nouvelle')
  const [onglet, setOnglet] = useState('connexion')

  const base = bases.find((b) => b.id === selection)
  const moteur = base ? MOTEURS[base.moteur] : undefined

  // L'utilisateur réel (`synelia_postgresql`…) vient du backend, pas d'un
  // générique « app » : sans cet appel, la chaîne de connexion affichée
  // mentirait sur l'identifiant à utiliser. Silencieux hors mode API ou en
  // cas de refus (le rôle courant peut ne pas porter `secrets.update`).
  const [identifiants, setIdentifiants] = useState<{ utilisateur: string } | null>(null)
  const baseId = base?.id
  useEffect(() => {
    setIdentifiants(null)
    setMotDePasseRegenere(null)
    if (!estActif() || !baseId) return
    let annule = false
    requete<{ utilisateur: string }>(`/bases/${encodeURIComponent(baseId)}/identifiants`).then(
      (r) => {
        if (!annule) setIdentifiants(r)
      },
      () => {},
    )
    return () => {
      annule = true
    }
  }, [baseId])

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: espace.code, href: `/app/espaces/${espace.id}` },
          { label: 'Bases managées' },
        ]}
        titre="Bases de données managées"
        sousTitre="Nous exploitons le moteur : haute disponibilité, sauvegardes avec restauration à un instant précis, montées de version qualifiées. Vous gardez la main sur vos schémas et vos données."
        actions={
          <BoutonFormulaire
            libelle="Créer une base"
            size="md"
            variant="primary"
            icone={<Plus size={14} />}
            action="network.manage"
            titre="Créer une base de données managée"
            description="Nous exploitons le moteur : haute disponibilité, sauvegardes avec restauration à un instant précis, montées de version qualifiées."
            ouvert={creationOuverte}
            onOuvertChange={setCreationOuverte}
            champs={[
              { id: 'nom', label: 'Nom de l’instance', placeholder: 'pg-facturation', obligatoire: true },
              {
                id: 'moteur',
                label: 'Moteur',
                type: 'select',
                demi: true,
                options: Object.entries(MOTEURS).map(([id, m]) => ({ value: id, label: m.nom })),
              },
              {
                id: 'palier',
                label: 'Palier',
                type: 'select',
                demi: true,
                options: PALIERS.map((p) => ({ value: p.id, label: p.label })),
              },
              { id: 'taille', label: 'Stockage', type: 'nombre', demi: true, min: 10, max: 4000, suffixe: 'Go' },
              { id: 'ha', label: 'Haute disponibilité', type: 'switch', demi: true, placeholder: 'Deux nœuds' },
              { id: 'pitr', label: 'Restauration à un instant précis', type: 'switch', placeholder: 'Journalisation continue' },
            ]}
            valeursDepart={{ moteur: 'postgresql', palier: 'm1', taille: 100, ha: true, pitr: true }}
            libelleValider="Créer la base"
            operation={(v) => {
              const id = collection.identifiant('db')
              return {
                titre: `Création de ${v.nom} lancée`,
                detail: `${MOTEURS[String(v.moteur)]?.nom} · ${v.ha ? 'HA' : 'nœud unique'}`,
                appel: () =>
                  creerRessource('/bases', {
                    espaceId: espace.id,
                    nom: String(v.nom),
                    moteur: v.moteur,
                    version: { postgresql: '16.4', mysql: '8.4', mariadb: '11.4', mongodb: '7.0', redis: '7.4' }[
                      String(v.moteur)
                    ] ?? '1.0',
                    palier: String(v.palier),
                    ha: Boolean(v.ha),
                    tailleGo: Number(v.taille),
                    pitr: Boolean(v.pitr),
                  }),
                effet: () =>
                  collection.creer({
                    id,
                    espaceId: espace.id,
                    nom: String(v.nom),
                    moteur: v.moteur as ManagedDatabase['moteur'],
                    version: { postgresql: '16.4', mysql: '8.4', mariadb: '11.4', mongodb: '7.0', redis: '7.4' }[
                      String(v.moteur)
                    ] ?? '1.0',
                    palier: PALIERS.find((p) => p.id === v.palier)?.label ?? 'Medium',
                    ha: Boolean(v.ha),
                    tailleGo: Number(v.taille),
                    connexions: { actives: 0, max: 300 },
                    replicas: 0,
                    statut: 'maintenance',
                    pitr: Boolean(v.pitr),
                    host: `${String(v.nom)}.db.${espace.site.toLowerCase()}.synelia.cloud`,
                  }),
                job: {
                  type: 'db.create',
                  label: `Création de la base ${v.nom}`,
                  etapes: [
                    'Provisionner le stockage',
                    `Démarrer le moteur ${MOTEURS[String(v.moteur)]?.nom ?? ''}`,
                    ...(v.ha ? ['Établir la réplication synchrone'] : []),
                    ...(v.pitr ? ['Activer la journalisation continue'] : []),
                    'Restreindre l’accès aux réseaux privés',
                  ],
                },
                effetFinal: () => {
                  // En mode API la base réelle vient du backend, sous son propre
                  // identifiant : `id` n'est qu'un identifiant local de secours pour
                  // le mode maquette, PATCH dessus échouerait (base introuvable).
                  if (estActif()) {
                    collection.recharger()
                    return
                  }
                  collection.modifier(id, { statut: 'running' })
                  setSelection(id)
                },
              }
            }}
          />
        }
      />

      {bases.length === 0 ? (
        <EmptyState
          titre="Aucune base managée dans cet espace"
          phrase="Une base managée vous évite d’exploiter vous-même le moteur : nous gérons la haute disponibilité, les sauvegardes avec restauration à un instant précis, les montées de version et la supervision fine."
          action={{ libelle: 'Créer une base', onClick: () => setCreationOuverte(true) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile libelle="Bases" valeur={bases.length} />
            <StatTile
              libelle="En haute disponibilité"
              valeur={bases.filter((b) => b.ha).length}
              ton="ok"
              detail={`${bases.filter((b) => !b.ha).length} en instance simple`}
            />
            <StatTile
              libelle="Volume total"
              valeur={goHumain(bases.reduce((a, b) => a + b.tailleGo, 0))}
            />
            <StatTile
              libelle="Connexions actives"
              valeur={num(bases.reduce((a, b) => a + b.connexions.actives, 0))}
              detail={`sur ${num(bases.reduce((a, b) => a + b.connexions.max, 0))} autorisées`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bases.map((b) => {
              const m = MOTEURS[b.moteur]
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelection(b.id)}
                  className={cn(
                    'rounded-[10px] border-2 bg-white p-4 text-left transition-colors',
                    selection === b.id ? 'border-p-700' : 'border-g-300 hover:border-p-400',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[10px] font-bold"
                        style={{
                          background: surfaceMarque(m.teinte).fond,
                          color: surfaceMarque(m.teinte).texte,
                        }}
                      >
                        {m.nom.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[12.5px] font-semibold text-ink">
                          {b.nom}
                        </span>
                        <span className="block text-[11px] text-g-500">
                          {m.nom} {b.version}
                        </span>
                      </span>
                    </span>
                    <HealthBadge etat={b.statut} size="sm" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <QuotaBar
                      libelle="Connexions"
                      utilise={b.connexions.actives}
                      total={b.connexions.max}
                      compact
                      seuil={85}
                      formateur={(v) => num(v)}
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge tone="neutral" size="sm">
                      {b.palier}
                    </Badge>
                    {b.ha && (
                      <Badge tone="ok" size="sm">
                        HA
                      </Badge>
                    )}
                    {b.pitr && (
                      <Badge tone="violet" size="sm">
                        PITR
                      </Badge>
                    )}
                    {b.replicas > 0 && (
                      <Badge tone="neutral" size="sm">
                        {b.replicas} réplica{b.replicas > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {base && moteur && (
            <>
              <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

              {onglet === 'connexion' && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader
                      titre="Chaîne de connexion"
                      sousTitre="Ne codez jamais le mot de passe en dur : référencez le coffre de secrets."
                      actions={
                        <BoutonAction
                          libelle="Régénérer le mot de passe"
                          variant="ghost"
                          size="sm"
                          operation={{
                            action: 'secrets.update',
                            ton: 'warn',
                            titre: `Mot de passe de ${base.nom} régénéré`,
                            detail:
                              'Affiché une seule fois ci-dessous. Le moteur en cours d’exécution garde l’ancien mot de passe tant que la configuration applicative n’est pas mise à jour.',
                            appel: () =>
                              requete<{ motDePasse: string }>(
                                `/bases/${encodeURIComponent(base.id)}/identifiants/rotation`,
                                { methode: 'POST', corps: {} },
                              ).then((r) => {
                                setMotDePasseRegenere(r.motDePasse)
                                return r
                              }),
                          }}
                          confirmation={{
                            ressource: base.nom,
                            titre: `Régénérer le mot de passe de ${base.nom} ?`,
                            pertes: [
                              'Toute application qui utilise encore l’ancien mot de passe perdra sa connexion',
                            ],
                            libelleAction: 'Régénérer',
                          }}
                        />
                      }
                    />
                    <div className="space-y-3">
                      <CopyField label="Hôte" value={base.host} />
                      <CopyField label="Port" value={String(moteur.port)} />
                      <CopyField
                        label="Chaîne de connexion"
                        masque
                        value={
                          base.moteur === 'redis'
                            ? `rediss://${identifiants?.utilisateur ?? 'default'}:••••••••@${base.host}:${moteur.port}/0`
                            : base.moteur === 'postgresql'
                              ? `postgresql://${identifiants?.utilisateur ?? 'app'}:••••••••@${base.host}:${moteur.port}/${base.nom}?sslmode=require`
                              : `mysql://${identifiants?.utilisateur ?? 'app'}:••••••••@${base.host}:${moteur.port}/${base.nom}?ssl-mode=REQUIRED`
                        }
                      />
                      <CopyField
                        label="Référence au coffre de secrets"
                        value={`{{ vault:org-dba/db/${base.nom}#url }}`}
                      />
                    </div>
                    {motDePasseRegenere && (
                      <Callout ton="warn" className="mt-4" titre="Nouveau mot de passe — affiché une seule fois">
                        <CopyField className="mt-2" value={motDePasseRegenere} masque mono />
                      </Callout>
                    )}
                    <Callout ton="info" className="mt-4" titre="TLS obligatoire">
                      Les connexions non chiffrées sont refusées par le moteur. Le certificat serveur
                      est signé par notre autorité interne, dont le paquet racine est disponible dans
                      la documentation.
                    </Callout>
                  </Card>

                  <Card>
                    <CardHeader
                      titre="Caractéristiques"
                      actions={
                        <BoutonAction
                          libelle="Supprimer la base"
                          variant="ghost"
                          operation={{
                            action: 'vm.create_delete',
                            ton: 'warn',
                            titre: `Suppression de ${base.nom} lancée`,
                            detail: 'L’instance et son volume sont détruits ; les sauvegardes existantes ne sont pas affectées.',
                            appel: () => supprimerRessource('/bases', base.id, base.nom),
                            effet: () => collection.supprimer(base.id),
                            effetFinal: () => {
                              collection.recharger()
                              setSelection('')
                            },
                          }}
                          confirmation={{
                            ressource: base.nom,
                            titre: `Supprimer ${base.nom} ?`,
                            pertes: [
                              'L’instance et ses données sont détruites, sans retour possible',
                              'Les applications qui s’y connectent perdent immédiatement l’accès',
                            ],
                            libelleAction: 'Supprimer la base',
                          }}
                        />
                      }
                    />
                    <KeyValueList
                      colonnes={1}
                      items={[
                        { cle: 'Moteur', valeur: `${moteur.nom} ${base.version}` },
                        { cle: 'Palier', valeur: base.palier },
                        {
                          cle: 'Haute disponibilité',
                          valeur: base.ha
                            ? 'Active — bascule automatique sur le nœud secondaire'
                            : 'Instance simple — une interruption est possible lors d’une maintenance',
                        },
                        { cle: 'Volume', valeur: goHumain(base.tailleGo) },
                        {
                          cle: 'Connexions',
                          valeur: `${num(base.connexions.actives)} actives sur ${num(base.connexions.max)}`,
                        },
                        { cle: 'Réplicas de lecture', valeur: String(base.replicas) },
                        {
                          cle: 'Restauration à un instant précis',
                          valeur: base.pitr ? 'Disponible sur 14 jours' : 'Non disponible',
                        },
                      ]}
                    />
                  </Card>
                </div>
              )}

              {onglet === 'replicas' && (
                <Card>
                  <CardHeader
                    titre="Réplicas de lecture"
                    sousTitre="Un réplica soulage l’instance principale pour les requêtes de lecture et les rapports."
                    actions={
                      <BoutonAction
                        libelle="Ajouter un réplica"
                        icone={<Plus size={13} />}
                        operation={{
                          action: 'network.manage',
                          titre: `Réplica de lecture ajouté à ${base.nom}`,
                          detail: 'Le rattrapage initial dure quelques minutes selon la taille de la base.',
                          appel: () =>
                            requete(`/bases/${encodeURIComponent(base.id)}/replicas`, {
                              methode: 'POST',
                              corps: {},
                            }),
                          job: {
                            type: 'db.replica.create',
                            label: `Réplica de lecture · ${base.nom}`,
                            etapes: ['Cloner la base', 'Rattraper les journaux', 'Ouvrir les connexions en lecture'],
                            dureeEtapeMs: 1100,
                          },
                          effetFinal: () => {
                            collection.modifier(base.id, (b) => ({ replicas: b.replicas + 1 }))
                            collection.recharger()
                          },
                        }}
                      />
                    }
                  />
                  {base.replicas === 0 ? (
                    <EmptyState
                      titre="Aucun réplica de lecture"
                      phrase="Un réplica permet d’exécuter les rapports et les exports sans peser sur l’instance principale. Sur une base qui atteint régulièrement 80 % de ses connexions, c’est souvent le premier levier."
                    />
                  ) : (
                    <div className="space-y-2">
                      {Array.from({ length: base.replicas }, (_, i) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block font-mono text-[12.5px] font-semibold text-ink">
                              {base.nom}-replica-{i + 1}
                            </span>
                            <span className="block font-mono text-[11px] text-g-500">
                              {base.host.replace(base.nom, `${base.nom}-replica-${i + 1}`)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge tone="ok" dot size="sm">
                              Synchronisé
                            </Badge>
                            <span className="tnum text-[11.5px] text-g-500">retard 42 ms</span>
                            <BoutonAction
                              libelle="Promouvoir"
                              variant="ghost"
                              operation={{
                                action: 'network.manage',
                                ton: 'warn',
                                titre: `${base.nom}-replica-${i + 1} promu instance principale`,
                                detail:
                                  'L’ancienne instance principale passe en lecture seule : reconfigurez vos applications.',
                                job: {
                                  type: 'db.replica.promote',
                                  label: `Promotion de ${base.nom}-replica-${i + 1}`,
                                  etapes: [
                                    'Arrêter les écritures sur l’instance principale',
                                    'Attendre le rattrapage complet',
                                    'Promouvoir le réplica',
                                    'Basculer le nom d’hôte',
                                  ],
                                },
                                effetFinal: () =>
                                  collection.modifier(base.id, (b) => ({
                                    replicas: Math.max(0, b.replicas - 1),
                                  })),
                              }}
                              confirmation={{
                                ressource: `${base.nom}-replica-${i + 1}`,
                                titre: 'Promouvoir ce réplica ?',
                                pertes: [
                                  'L’instance principale actuelle devient un réplica en lecture seule',
                                  'Les écritures en vol pendant la bascule sont perdues',
                                  'Vos applications doivent être repointées sur le nouveau nom d’hôte',
                                ],
                                libelleAction: 'Promouvoir le réplica',
                              }}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Callout ton="info" className="mt-4" titre="Réplica en lecture seule">
                    Toute écriture sur un réplica est refusée par le moteur. Pointez vos rapports et
                    vos exports vers le réplica, et gardez l’instance principale pour les écritures.
                    La promotion d’un réplica en instance principale est une opération manuelle,
                    utilisée en cas de sinistre ou de migration.
                  </Callout>
                </Card>
              )}

              {onglet === 'sauvegardes' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <StatTile
                      libelle="Dernière sauvegarde complète"
                      valeur="il y a 13 h"
                      detail={dateCourte('2026-08-19')}
                      ton="ok"
                    />
                    <StatTile
                      libelle="Journalisation continue"
                      valeur={base.pitr ? 'Active' : 'Inactive'}
                      ton={base.pitr ? 'ok' : 'warn'}
                      detail={base.pitr ? 'RPO de quelques secondes' : 'RPO = dernière sauvegarde'}
                    />
                    <StatTile libelle="Fenêtre PITR" valeur="14 jours" />
                    <StatTile
                      libelle="Dernier test de restauration"
                      valeur="9 août"
                      ton="ok"
                      detail="Réussi en 26 min"
                    />
                  </div>
                  <Card>
                    <CardHeader
                      titre="Restauration à un instant précis"
                      sousTitre="La journalisation continue permet de revenir à n’importe quel instant de la fenêtre, à la seconde près."
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Instant cible" hint="heure GMT">
                        <Input
                          type="datetime-local"
                          value={instantPitr}
                          onChange={(e) => setInstantPitr(e.target.value)}
                        />
                      </Field>
                      <Field label="Destination">
                        <Select
                          value={destinationPitr}
                          onChange={(e) => setDestinationPitr(e.target.value)}
                        >
                          <option value="nouvelle">Nouvelle instance (recommandé)</option>
                          <option value="ecraser">Écraser l’instance actuelle</option>
                        </Select>
                      </Field>
                    </div>
                    <BoutonAction
                      libelle="Lancer la restauration"
                      variant="primary"
                      size="md"
                      className="mt-3.5"
                      operation={{
                        action: 'backup.restore',
                        ton: 'info',
                        titre: `Restauration de ${base.nom} au ${instantPitr.replace('T', ' à ')}`,
                        detail:
                          destinationPitr === 'nouvelle'
                            ? 'Une nouvelle instance est créée : l’actuelle continue de servir.'
                            : 'L’instance actuelle sera écrasée.',
                        appel: () =>
                          requete(`/bases/${encodeURIComponent(base.id)}/restauration`, {
                            methode: 'POST',
                            corps: {
                              instant: `${instantPitr.length === 16 ? `${instantPitr}:00Z` : instantPitr}`,
                              nomCible:
                                destinationPitr === 'nouvelle' ? `${base.nom}-restore` : base.nom,
                            },
                          }),
                        job: {
                          type: 'db.pitr',
                          label: `Restauration ${base.nom} · ${instantPitr}`,
                          etapes: [
                            'Monter la sauvegarde de base',
                            'Rejouer les journaux jusqu’à l’instant demandé',
                            destinationPitr === 'nouvelle'
                              ? 'Démarrer la nouvelle instance'
                              : 'Remplacer l’instance actuelle',
                            'Vérifier les connexions',
                          ],
                        },
                        effetFinal:
                          destinationPitr === 'nouvelle'
                            ? () => {
                                // En mode API l’instance restaurée vient du
                                // backend : la recréer localement la
                                // dupliquerait (la collection `POST` à nouveau).
                                if (estActif()) {
                                  collection.recharger()
                                  return
                                }
                                collection.creer({
                                  ...base,
                                  id: collection.identifiant('db'),
                                  nom: `${base.nom}-restore`,
                                  replicas: 0,
                                  host: base.host.replace(base.nom, `${base.nom}-restore`),
                                })
                              }
                            : () => collection.recharger(),
                      }}
                      confirmation={
                        destinationPitr === 'ecraser'
                          ? {
                              ressource: base.nom,
                              titre: `Écraser ${base.nom} ?`,
                              pertes: [
                                `Toutes les écritures postérieures au ${instantPitr.replace('T', ' ')} seront perdues`,
                                'L’instance sera indisponible pendant la restauration',
                              ],
                              libelleAction: 'Écraser et restaurer',
                            }
                          : undefined
                      }
                    />
                    <Callout ton="violet" className="mt-4" titre="Pourquoi une nouvelle instance">
                      Restaurer dans une nouvelle instance permet de vérifier le contenu avant de
                      basculer votre application, sans perdre l’état actuel. C’est la manœuvre à
                      privilégier après une suppression accidentelle : vous récupérez ce qui manque
                      sans annuler les écritures légitimes qui ont suivi.
                    </Callout>
                  </Card>
                </div>
              )}

              {onglet === 'metriques' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <StatTile
                      libelle="Connexions"
                      valeur={`${base.connexions.actives}/${base.connexions.max}`}
                      ton={base.connexions.actives / base.connexions.max > 0.85 ? 'warn' : 'ok'}
                      serie={seededSeries(`${base.id}-conn`, 24, base.connexions.actives * 0.6, base.connexions.max * 0.98)}
                    />
                    <StatTile
                      libelle="Requêtes lentes 24 h"
                      valeur={base.moteur === 'postgresql' ? 42 : 8}
                      ton="warn"
                      detail="Supérieures à 500 ms"
                      serie={seededSeries(`${base.id}-slow`, 24, 0, 8)}
                    />
                    <StatTile
                      libelle="Taux de cache"
                      valeur={pct(97.4, 1)}
                      ton="ok"
                      serie={seededSeries(`${base.id}-cache`, 24, 95, 99)}
                    />
                    <StatTile
                      libelle="Volume"
                      valeur={goHumain(base.tailleGo)}
                      detail="+2,1 % sur 30 jours"
                      serie={seededSeries(`${base.id}-size`, 24, base.tailleGo * 0.97, base.tailleGo)}
                    />
                  </div>

                  <GrilleSparkCharts
                    seed={`db-${base.id}`}
                    metriques={[
                      { titre: 'Connexions actives', unite: '', min: base.connexions.actives * 0.5, max: base.connexions.max * 0.98, seuil: base.connexions.max * 0.85 },
                      { titre: 'Requêtes par seconde', unite: 'req/s', min: 80, max: 640, couleur: 'var(--color-m-600)' },
                      { titre: 'Taux de cache', unite: '%', min: 94, max: 99.5 },
                      { titre: 'Latence de réplication', unite: 'ms', min: 8, max: 120, seuil: 500 },
                    ]}
                  />

                  <Card>
                    <CardHeader
                      titre="Journal du moteur"
                      sousTitre="Requêtes lentes, points de contrôle et saturations de connexions."
                    />
                    <LogPeek lignes={REQUETES_LENTES} max={20} titre="Événements du moteur" />
                  </Card>

                  {base.connexions.actives / base.connexions.max > 0.25 && base.moteur === 'postgresql' && (
                    <Callout ton="warn" titre="Un index manque sur la table facture">
                      La requête <span className="font-mono text-[12px]">SELECT * FROM facture WHERE periode = $1</span>{' '}
                      revient régulièrement au-delà de 1 200 ms, sans index sur la colonne{' '}
                      <span className="font-mono text-[12px]">periode</span>. Un index simple ramènerait
                      cette requête sous les 20 ms. Nous ne créons pas d’index de notre initiative :
                      votre schéma vous appartient. Ouvrez un ticket si vous souhaitez que nous
                      accompagnions l’analyse.
                    </Callout>
                  )}
                </div>
              )}

              {onglet === 'version' && (
                <Card>
                  <CardHeader
                    titre="Version du moteur"
                    sousTitre="Les montées de version majeures exigent une fenêtre de maintenance ; les correctifs mineurs s’appliquent à chaud sur les instances HA."
                  />
                  <div className="space-y-2">
                    {[
                      { v: base.version, courante: true, statut: 'Déployée' },
                      {
                        v: base.moteur === 'postgresql' ? '16.5' : base.moteur === 'mysql' ? '8.4.3' : '7.4',
                        courante: false,
                        statut: 'Correctif disponible — applicable à chaud',
                      },
                      {
                        v: base.moteur === 'postgresql' ? '17.2' : base.moteur === 'mysql' ? '9.0' : '8.0',
                        courante: false,
                        statut: 'Version majeure — fenêtre de maintenance requise',
                      },
                    ].map((x) => (
                      <div
                        key={x.v}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-3 rounded-[6px] border px-3 py-2.5',
                          x.courante ? 'border-p-700 bg-p-050' : 'border-g-300',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[13px] font-semibold text-ink">
                            {moteur.nom} {x.v}
                          </span>
                          <span className="block text-[11.5px] text-g-500">{x.statut}</span>
                        </span>
                        {x.courante ? (
                          <Badge tone="violet" size="sm">
                            Votre version
                          </Badge>
                        ) : (
                          <BoutonFormulaire
                            libelle="Planifier"
                            titre={`Planifier la montée vers ${moteur.nom} ${x.v}`}
                            description="Snapshot avant l’opération, application, vérification du démarrage et des connexions, retour arrière possible pendant sept jours."
                            action="network.manage"
                            champs={[
                              { id: 'fenetre', label: 'Fenêtre de maintenance', type: 'select', options: [
                                { value: 'prochaine-nuit', label: 'La prochaine nuit · 02h00–04h00' },
                                { value: 'week-end', label: 'Le prochain week-end · samedi 03h00' },
                                { value: 'immediat', label: 'Immédiatement' },
                              ] },
                            ]}
                            libelleValider="Planifier"
                            operation={(f) => ({
                              titre: `Montée vers ${x.v} planifiée`,
                              detail:
                                f.fenetre === 'immediat'
                                  ? 'Opération lancée maintenant.'
                                  : 'Vous recevrez un rappel 24 heures avant.',
                              ...(f.fenetre === 'immediat'
                                ? {
                                    job: {
                                      type: 'db.upgrade',
                                      label: `Montée de version ${base.nom} → ${x.v}`,
                                      etapes: [
                                        'Snapshot avant opération',
                                        'Appliquer la mise à jour',
                                        'Vérifier le démarrage et les connexions',
                                      ],
                                    },
                                    effetFinal: () =>
                                      // `PATCH /bases/{id}` reprend le schéma de création
                                      // (`espaceId`/`nom`/`moteur`/`palier` obligatoires) : un
                                      // correctif partiel (`{ version }` seul) échoue en 422
                                      // côté backend, avalé silencieusement par le
                                      // `.then(recharger, recharger)` de `collection.modifier`.
                                      collection.modifier(base.id, {
                                        espaceId: base.espaceId,
                                        nom: base.nom,
                                        moteur: base.moteur,
                                        palier: base.palier,
                                        version: x.v,
                                      }),
                                  }
                                : {}),
                            })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <Callout ton="info" className="mt-4" titre="Ce que nous prenons en charge">
                    Snapshot avant l’opération, application de la mise à jour, vérification du
                    démarrage et des connexions, retour arrière possible pendant sept jours. Sur une
                    instance HA, un correctif mineur s’applique nœud par nœud, sans interruption
                    perceptible.
                  </Callout>
                </Card>
              )}

              {onglet === 'reseau' && (
                <Card>
                  <CardHeader
                    titre="Restriction réseau"
                    sousTitre="Par défaut, la base n’est joignable que depuis les réseaux privés de son Espace Cloud."
                  />
                  <div className="space-y-3.5">
                    <Switch
                      checked={restreint}
                      onChange={setRestreint}
                      label="Restreindre aux réseaux privés de l’espace"
                      description={`Seules les ressources de ${espace.code} (${espace.cidr}) peuvent se connecter. Aucune exposition sur Internet.`}
                    />
                    <Switch
                      checked={ipsExternes}
                      onChange={setIpsExternes}
                      label="Autoriser des adresses IP externes"
                      description="À n’activer que temporairement, pour une migration ou un outil d’administration ponctuel. Chaque adresse autorisée élargit la surface d’attaque."
                    />
                  </div>
                  <div className="mt-4 border-t border-g-100 pt-4">
                    <MicroLabel className="mb-2">Réseaux autorisés</MicroLabel>
                    <div className="space-y-2">
                      {reseaux.map((r) => (
                        <div
                          key={r}
                          className="flex items-center justify-between gap-3 rounded-[6px] border border-g-300 px-3 py-2"
                        >
                          <span className="font-mono text-[12px] text-ink">{r}</span>
                          <span className="flex items-center gap-2">
                            <Badge tone="ok" size="sm">
                              Autorisé
                            </Badge>
                            <BoutonAction
                              libelle="Retirer"
                              variant="ghost"
                              operation={{
                                action: 'network.manage',
                                ton: 'warn',
                                titre: `${r.split(' · ')[0]} retiré des réseaux autorisés`,
                                effet: () => setReseaux((prev) => prev.filter((x) => x !== r)),
                              }}
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                    <BoutonFormulaire
                      libelle="Ajouter un réseau"
                      variant="ghost"
                      className="mt-2.5"
                      icone={<Plus size={12} />}
                      action="network.manage"
                      titre="Autoriser un réseau"
                      description="Une base mutualisée n’a pas à être joignable depuis Internet : n’autorisez que des plages privées, sauf migration ponctuelle."
                      champs={[
                        { id: 'cidr', label: 'Plage', placeholder: '10.0.5.0/24', obligatoire: true },
                        { id: 'libelle', label: 'À quoi elle sert', placeholder: 'outillage BI' },
                      ]}
                      libelleValider="Autoriser"
                      operation={(f) => ({
                        titre: `${f.cidr} autorisé`,
                        effet: () =>
                          setReseaux((prev) => [...prev, `${f.cidr}${f.libelle ? ` · ${f.libelle}` : ''}`]),
                      })}
                    />
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
