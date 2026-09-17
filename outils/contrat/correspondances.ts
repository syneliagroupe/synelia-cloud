import type { components } from './contrat.genere'

export type Schemas = components['schemas']

/**
 * Un export de `src/lib/types.ts` → son schéma dans le contrat, ou `null` avec
 * la raison. Remplie le 2026-09-08 en comparant les champs des deux
 * définitions (pas seulement les noms) — voir le commentaire sur chaque
 * renommage non trivial.
 *
 * `as const satisfies Record<string, keyof Schemas | null>` valide les
 * **valeurs** : un nom de schéma qui n'existe plus au contrat casse
 * `bun run typecheck`. Il ne peut pas valider les **clés** (TypeScript ne
 * sait pas énumérer les exports de types d'un module) — `derive.mjs` compare
 * les clés de cette table aux `^export (interface|type)` de `types.ts` et
 * signale tout export absent comme « non classé ».
 */
export const CORRESPONDANCES = {
  // ─── Identique des deux côtés ──────────────────────────────────────
  AgentIA: 'AgentIA',
  Backend: 'Backend',
  BaseConnaissance: 'BaseConnaissance',
  BaseHebergement: 'BaseHebergement',
  BrancheFlux: 'BrancheFlux',
  Bucket: 'Bucket',
  CleIA: 'CleIA',
  CompteFichiers: 'CompteFichiers',
  Devis: 'Devis',
  Domaine: 'Domaine',
  DomaineApplicatif: 'DomaineApplicatif',
  EspaceCloud: 'EspaceCloud',
  EtapeFlux: 'EtapeFlux',
  EvenementSupervision: 'EvenementSupervision',
  FluxOrchestration: 'FluxOrchestration',
  Incident: 'Incident',
  LigneLog: 'LigneLog',
  LoadBalancer: 'LoadBalancer',
  ModeleIA: 'ModeleIA',
  Organisation: 'Organisation',
  Placement: 'Placement',
  Projet: 'Projet',
  Quota: 'Quota',
  ServicePartage: 'ServicePartage',
  ServiceProjet: 'ServiceProjet',
  SiteWeb: 'SiteWeb',
  StatutService: 'StatutService',
  TachePlanifieeWeb: 'TachePlanifieeWeb',
  Ticket: 'Ticket',
  VariableFlux: 'VariableFlux',
  Volume: 'Volume',
  ZoneApplicative: 'ZoneApplicative',

  // ─── Renommage évident, confirmé sur les champs ────────────────────
  VM: 'Vm',
  K8sCluster: 'ClusterK8s',
  Network: 'Reseau',
  PublicIP: 'IpPublique',
  SecurityGroup: 'GroupeSecurite',
  VpnTunnel: 'TunnelVpn',
  ManagedDatabase: 'BaseManagee',
  BackupPlan: 'PlanSauvegarde',
  RestorePoint: 'PointRestauration',
  DRPlan: 'PlanPra',
  ConformiteLigne: 'LigneConformite',
  User: 'Utilisateur',
  Application: 'ApplicationPaas',
  Environment: 'Environnement',
  Component: 'Composant',
  Deployment: 'Deploiement',
  WebHosting: 'Hebergement',
  DnsZone: 'ZoneDns',
  Offer: 'Offre',
  Subscription: 'Souscription',
  Invoice: 'Facture',
  AuditEvent: 'EvenementAudit',
  ProvisioningJob: 'TravailProvisioning',
  AlerteRegle: 'RegleAlerte',
  ManagedService: 'ServiceManage',

  // ─── Renommage confirmé après lecture des deux définitions ─────────
  // `Membership` (id, userId, orgId, role, scopeType, scopeId, scopeLabel)
  // recouvre `Membre` champ à champ ; `AppartenanceOrganisation` est une
  // notion différente (l'organisation vue depuis un utilisateur qui en fait
  // partie : orgId, nom, secteur, logoUrl, defaut — pas de userId).
  Membership: 'Membre',
  // `Seat` (id, managedServiceId, userId, statut, quotaUtilise, quotaTotal,
  // derniereActivite) recouvre `Siege` champ à champ ; `SiegeAttribution` est
  // le corps de la requête d'attribution, pas la ressource.
  Seat: 'Siege',
  // `CatalogService` (slug, nom, solutionOSS, categorie, icone, logoTeinte,
  // logoInitiales, description) recouvre `FicheCatalogue` (mêmes champs, plus
  // `pitch`/`modes`/`paliers` que la maquette ne montre pas encore).
  CatalogService: 'FicheCatalogue',

  // ─── Alias d'union — énumération inline côté contrat (niveau 3, hors périmètre) ──
  Site: null,
  Role: null,
  ScopeType: null,
  BackendType: null,
  Devise: null,
  TypeSiteWeb: null,
  TypeServiceProjet: null,
  MoteurBase: null,
  CategorieService: null,
  HebergementModele: null,
  FamilleModele: null,
  ClasseDonnees: null,
  TypeAgent: null,
  CategorieOutil: null,
  TypeCanal: null,
  TypeEtape: null,
  // `MoyenPaiement` (types.ts) est l'union des valeurs de paiement — même
  // nom qu'un schéma objet du contrat (ressource `/facturation/moyens-paiement` :
  // id/type/libelle/detail/defaut/statut), mais une notion différente : une
  // collision de nom, pas une correspondance. L'objet ressource n'a pas
  // d'export dans types.ts (interface locale `MoyenEnregistre`,
  // `src/app/app/facturation/page.tsx`), donc rien à classer côté objet ici.
  MoyenPaiement: null,

  // ─── Sans équivalent dans le contrat ────────────────────────────────
  DefinitionWorkflow: null, // écran seul — src/lib/mock/workflows.ts, jamais servi par le backend
  GardeFou: null, // écran seul — garde-fous d'un flux IA, pas modélisés côté backend (MVP)
  VariableAgent: null, // écran seul — variables d'un agent IA, pas modélisées côté backend (MVP)
  VersionAgent: null, // écran seul — historique de versions d'un agent, pas modélisé côté backend (MVP)
  OutilAgent: null, // écran seul — outils d'un agent, pas modélisés côté backend (MVP)
  CanalAgent: null, // écran seul — canaux (widget/WhatsApp/SMS/voix), hors MVP backend, aucun schéma "Canal*" au contrat
  // `RegleRoutage` (types.ts) est une règle de routage de modèle IA
  // (ordre/quand/cible/repli/residenceImposee), écran seul (§ Paramètres IA).
  // Le contrat a bien un schéma `RegleRoutage`, mais c'est une notion
  // différente : la table consolidée du routage HTTP applicatif
  // (hote/chemin/serviceId/portConteneur, `GET /routage`), pas rattachée à
  // une clé du registre aujourd'hui. Collision de nom, pas de correspondance.
  RegleRoutage: null,
} as const satisfies Record<string, keyof Schemas | null>

/**
 * Champs marqués « Champs de démonstration côté super admin » dans
 * `types.ts` : un écran de démonstration les affiche, mais aucun écran en
 * mode API ne les lit depuis le contrat. Retirés d'`EnTropDansTypes` dans
 * `verification.ts` — un champ ici n'est pas une dérive.
 */
export const CHAMPS_MAQUETTE: Partial<Record<keyof typeof CORRESPONDANCES, readonly string[]>> = {
  Organisation: ['espaces', 'utilisateurs', 'caMensuel', 'consommationVcpu', 'tenantPlan', 'domaine'],
  // Le backend réel ne porte que dix champs sur `AgentIA` (id, nom, consigne,
  // espaceId, modele, temperature, topP, jetonsMax, statut, createdAt) — MVP
  // IA/Agents, cf. commentaire sur `AgentIA.createdAt` dans types.ts et la
  // mémoire `ia-agents-mvp-openrouter`. Le reste de l'écran (outils, mémoire,
  // versions, épreuves…) est la maquette du produit cible, pas encore servi.
  AgentIA: [
    'slug',
    'initiales',
    'teinte',
    'role',
    'description',
    'type',
    'strategie',
    'maxIterations',
    'sortieStructuree',
    'publieMcp',
    'variables',
    'outils',
    'connaissances',
    'memoire',
    'reprise',
    'humainDansLaBoucle',
    'classeDonnees',
    'budgetJour',
    'canaux',
    'versions',
    'metriques',
    'epreuves',
    'annotations',
  ],
  // Succession de modèle (remplaçant, fin de vie) : pas modélisée côté
  // backend (MVP IA/Agents).
  ModeleIA: ['remplacePar', 'finDeVie'],
  // `icone` est le nom d'un pictogramme local (`public/photos/pate-<icone>.webp`,
  // cf. commentaire sur `CatalogService.icone`) ; le contrat porte `logoUrl`
  // à la place (une URL). Deux approches du même emplacement visuel, pas
  // encore réconciliées — signalé pour décision humaine plutôt que tranché
  // ici (règle du plan : un renommage ne se décide pas seul).
  CatalogService: ['icone'],
}
