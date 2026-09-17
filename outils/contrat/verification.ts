/**
 * Assertions de types compilées par `tsc -p tsconfig.contrat.json` : la dérive
 * types.ts <-> contrat se lit dans les erreurs nommées, pas dans ce fichier.
 * Généré mécaniquement depuis `CORRESPONDANCES` (script à usage unique, voir
 * `docs/PLAN-ARCHITECTURE-SUITE.md` §2.3) — ne pas synchroniser à la main :
 * relancez le générateur si `correspondances.ts` change de paires.
 *
 * Niveau 1 (toujours actif) : aucune clé en trop ni manquante entre le type et
 * le schéma. Niveau 2 (derrière `--strict`/`CONTRAT_STRICT=1`, voir `derive.mjs`) :
 * assignabilité bidirectionnelle, plus bruyant sur les enums et les optionnels.
 */
import type * as T from "@/lib/types"
import { CHAMPS_MAQUETTE, type Schemas } from "./correspondances"

/** Échoue en nommant la clé : « Type 'foo' does not satisfy the constraint 'never' ». */
type Aucune<K extends never> = K
type EnTropDansTypes<A, S, Omis extends PropertyKey = never> = Exclude<keyof A, keyof S | Omis>
type ManqueDansTypes<A, S> = Exclude<keyof S, keyof A>
type Compatible<A, S> = [A] extends [S] ? ([S] extends [A] ? true : never) : never

// ─── AgentIA ↔ Schemas['AgentIA'] ──────────────────────────
type AgentIA_1 = Aucune<EnTropDansTypes<T.AgentIA, Schemas["AgentIA"], NonNullable<(typeof CHAMPS_MAQUETTE)["AgentIA"]>[number]>>
type AgentIA_2 = Aucune<ManqueDansTypes<T.AgentIA, Schemas["AgentIA"]>>
type AgentIA_3 = Aucune<Compatible<T.AgentIA, Schemas["AgentIA"]> extends true ? never : "incompatible">

// ─── Backend ↔ Schemas['Backend'] ──────────────────────────
type Backend_1 = Aucune<EnTropDansTypes<T.Backend, Schemas["Backend"]>>
type Backend_2 = Aucune<ManqueDansTypes<T.Backend, Schemas["Backend"]>>
type Backend_3 = Aucune<Compatible<T.Backend, Schemas["Backend"]> extends true ? never : "incompatible">

// ─── BaseConnaissance ↔ Schemas['BaseConnaissance'] ────────
type BaseConnaissance_1 = Aucune<EnTropDansTypes<T.BaseConnaissance, Schemas["BaseConnaissance"]>>
type BaseConnaissance_2 = Aucune<ManqueDansTypes<T.BaseConnaissance, Schemas["BaseConnaissance"]>>
type BaseConnaissance_3 = Aucune<Compatible<T.BaseConnaissance, Schemas["BaseConnaissance"]> extends true ? never : "incompatible">

// ─── BaseHebergement ↔ Schemas['BaseHebergement'] ──────────
type BaseHebergement_1 = Aucune<EnTropDansTypes<T.BaseHebergement, Schemas["BaseHebergement"]>>
type BaseHebergement_2 = Aucune<ManqueDansTypes<T.BaseHebergement, Schemas["BaseHebergement"]>>
type BaseHebergement_3 = Aucune<Compatible<T.BaseHebergement, Schemas["BaseHebergement"]> extends true ? never : "incompatible">

// ─── BrancheFlux ↔ Schemas['BrancheFlux'] ──────────────────
type BrancheFlux_1 = Aucune<EnTropDansTypes<T.BrancheFlux, Schemas["BrancheFlux"]>>
type BrancheFlux_2 = Aucune<ManqueDansTypes<T.BrancheFlux, Schemas["BrancheFlux"]>>
type BrancheFlux_3 = Aucune<Compatible<T.BrancheFlux, Schemas["BrancheFlux"]> extends true ? never : "incompatible">

// ─── Bucket ↔ Schemas['Bucket'] ────────────────────────────
type Bucket_1 = Aucune<EnTropDansTypes<T.Bucket, Schemas["Bucket"]>>
type Bucket_2 = Aucune<ManqueDansTypes<T.Bucket, Schemas["Bucket"]>>
type Bucket_3 = Aucune<Compatible<T.Bucket, Schemas["Bucket"]> extends true ? never : "incompatible">

// ─── CleIA ↔ Schemas['CleIA'] ──────────────────────────────
type CleIA_1 = Aucune<EnTropDansTypes<T.CleIA, Schemas["CleIA"]>>
type CleIA_2 = Aucune<ManqueDansTypes<T.CleIA, Schemas["CleIA"]>>
type CleIA_3 = Aucune<Compatible<T.CleIA, Schemas["CleIA"]> extends true ? never : "incompatible">

// ─── CompteFichiers ↔ Schemas['CompteFichiers'] ────────────
type CompteFichiers_1 = Aucune<EnTropDansTypes<T.CompteFichiers, Schemas["CompteFichiers"]>>
type CompteFichiers_2 = Aucune<ManqueDansTypes<T.CompteFichiers, Schemas["CompteFichiers"]>>
type CompteFichiers_3 = Aucune<Compatible<T.CompteFichiers, Schemas["CompteFichiers"]> extends true ? never : "incompatible">

// ─── Devis ↔ Schemas['Devis'] ──────────────────────────────
type Devis_1 = Aucune<EnTropDansTypes<T.Devis, Schemas["Devis"]>>
type Devis_2 = Aucune<ManqueDansTypes<T.Devis, Schemas["Devis"]>>
type Devis_3 = Aucune<Compatible<T.Devis, Schemas["Devis"]> extends true ? never : "incompatible">

// ─── Domaine ↔ Schemas['Domaine'] ──────────────────────────
type Domaine_1 = Aucune<EnTropDansTypes<T.Domaine, Schemas["Domaine"]>>
type Domaine_2 = Aucune<ManqueDansTypes<T.Domaine, Schemas["Domaine"]>>
type Domaine_3 = Aucune<Compatible<T.Domaine, Schemas["Domaine"]> extends true ? never : "incompatible">

// ─── DomaineApplicatif ↔ Schemas['DomaineApplicatif'] ──────
type DomaineApplicatif_1 = Aucune<EnTropDansTypes<T.DomaineApplicatif, Schemas["DomaineApplicatif"]>>
type DomaineApplicatif_2 = Aucune<ManqueDansTypes<T.DomaineApplicatif, Schemas["DomaineApplicatif"]>>
type DomaineApplicatif_3 = Aucune<Compatible<T.DomaineApplicatif, Schemas["DomaineApplicatif"]> extends true ? never : "incompatible">

// ─── EspaceCloud ↔ Schemas['EspaceCloud'] ──────────────────
type EspaceCloud_1 = Aucune<EnTropDansTypes<T.EspaceCloud, Schemas["EspaceCloud"]>>
type EspaceCloud_2 = Aucune<ManqueDansTypes<T.EspaceCloud, Schemas["EspaceCloud"]>>
type EspaceCloud_3 = Aucune<Compatible<T.EspaceCloud, Schemas["EspaceCloud"]> extends true ? never : "incompatible">

// ─── EtapeFlux ↔ Schemas['EtapeFlux'] ──────────────────────
type EtapeFlux_1 = Aucune<EnTropDansTypes<T.EtapeFlux, Schemas["EtapeFlux"]>>
type EtapeFlux_2 = Aucune<ManqueDansTypes<T.EtapeFlux, Schemas["EtapeFlux"]>>
type EtapeFlux_3 = Aucune<Compatible<T.EtapeFlux, Schemas["EtapeFlux"]> extends true ? never : "incompatible">

// ─── EvenementSupervision ↔ Schemas['EvenementSupervision'] 
type EvenementSupervision_1 = Aucune<EnTropDansTypes<T.EvenementSupervision, Schemas["EvenementSupervision"]>>
type EvenementSupervision_2 = Aucune<ManqueDansTypes<T.EvenementSupervision, Schemas["EvenementSupervision"]>>
type EvenementSupervision_3 = Aucune<Compatible<T.EvenementSupervision, Schemas["EvenementSupervision"]> extends true ? never : "incompatible">

// ─── FluxOrchestration ↔ Schemas['FluxOrchestration'] ──────
type FluxOrchestration_1 = Aucune<EnTropDansTypes<T.FluxOrchestration, Schemas["FluxOrchestration"]>>
type FluxOrchestration_2 = Aucune<ManqueDansTypes<T.FluxOrchestration, Schemas["FluxOrchestration"]>>
type FluxOrchestration_3 = Aucune<Compatible<T.FluxOrchestration, Schemas["FluxOrchestration"]> extends true ? never : "incompatible">

// ─── Incident ↔ Schemas['Incident'] ────────────────────────
type Incident_1 = Aucune<EnTropDansTypes<T.Incident, Schemas["Incident"]>>
type Incident_2 = Aucune<ManqueDansTypes<T.Incident, Schemas["Incident"]>>
type Incident_3 = Aucune<Compatible<T.Incident, Schemas["Incident"]> extends true ? never : "incompatible">

// ─── LigneLog ↔ Schemas['LigneLog'] ────────────────────────
type LigneLog_1 = Aucune<EnTropDansTypes<T.LigneLog, Schemas["LigneLog"]>>
type LigneLog_2 = Aucune<ManqueDansTypes<T.LigneLog, Schemas["LigneLog"]>>
type LigneLog_3 = Aucune<Compatible<T.LigneLog, Schemas["LigneLog"]> extends true ? never : "incompatible">

// ─── LoadBalancer ↔ Schemas['LoadBalancer'] ────────────────
type LoadBalancer_1 = Aucune<EnTropDansTypes<T.LoadBalancer, Schemas["LoadBalancer"]>>
type LoadBalancer_2 = Aucune<ManqueDansTypes<T.LoadBalancer, Schemas["LoadBalancer"]>>
type LoadBalancer_3 = Aucune<Compatible<T.LoadBalancer, Schemas["LoadBalancer"]> extends true ? never : "incompatible">

// ─── ModeleIA ↔ Schemas['ModeleIA'] ────────────────────────
type ModeleIA_1 = Aucune<EnTropDansTypes<T.ModeleIA, Schemas["ModeleIA"], NonNullable<(typeof CHAMPS_MAQUETTE)["ModeleIA"]>[number]>>
type ModeleIA_2 = Aucune<ManqueDansTypes<T.ModeleIA, Schemas["ModeleIA"]>>
type ModeleIA_3 = Aucune<Compatible<T.ModeleIA, Schemas["ModeleIA"]> extends true ? never : "incompatible">

// ─── Organisation ↔ Schemas['Organisation'] ────────────────
type Organisation_1 = Aucune<EnTropDansTypes<T.Organisation, Schemas["Organisation"], NonNullable<(typeof CHAMPS_MAQUETTE)["Organisation"]>[number]>>
type Organisation_2 = Aucune<ManqueDansTypes<T.Organisation, Schemas["Organisation"]>>
type Organisation_3 = Aucune<Compatible<T.Organisation, Schemas["Organisation"]> extends true ? never : "incompatible">

// ─── Placement ↔ Schemas['Placement'] ──────────────────────
type Placement_1 = Aucune<EnTropDansTypes<T.Placement, Schemas["Placement"]>>
type Placement_2 = Aucune<ManqueDansTypes<T.Placement, Schemas["Placement"]>>
type Placement_3 = Aucune<Compatible<T.Placement, Schemas["Placement"]> extends true ? never : "incompatible">

// ─── Projet ↔ Schemas['Projet'] ────────────────────────────
type Projet_1 = Aucune<EnTropDansTypes<T.Projet, Schemas["Projet"]>>
type Projet_2 = Aucune<ManqueDansTypes<T.Projet, Schemas["Projet"]>>
type Projet_3 = Aucune<Compatible<T.Projet, Schemas["Projet"]> extends true ? never : "incompatible">

// ─── Quota ↔ Schemas['Quota'] ──────────────────────────────
type Quota_1 = Aucune<EnTropDansTypes<T.Quota, Schemas["Quota"]>>
type Quota_2 = Aucune<ManqueDansTypes<T.Quota, Schemas["Quota"]>>
type Quota_3 = Aucune<Compatible<T.Quota, Schemas["Quota"]> extends true ? never : "incompatible">

// ─── ServicePartage ↔ Schemas['ServicePartage'] ────────────
type ServicePartage_1 = Aucune<EnTropDansTypes<T.ServicePartage, Schemas["ServicePartage"]>>
type ServicePartage_2 = Aucune<ManqueDansTypes<T.ServicePartage, Schemas["ServicePartage"]>>
type ServicePartage_3 = Aucune<Compatible<T.ServicePartage, Schemas["ServicePartage"]> extends true ? never : "incompatible">

// ─── ServiceProjet ↔ Schemas['ServiceProjet'] ──────────────
type ServiceProjet_1 = Aucune<EnTropDansTypes<T.ServiceProjet, Schemas["ServiceProjet"]>>
type ServiceProjet_2 = Aucune<ManqueDansTypes<T.ServiceProjet, Schemas["ServiceProjet"]>>
type ServiceProjet_3 = Aucune<Compatible<T.ServiceProjet, Schemas["ServiceProjet"]> extends true ? never : "incompatible">

// ─── SiteWeb ↔ Schemas['SiteWeb'] ──────────────────────────
type SiteWeb_1 = Aucune<EnTropDansTypes<T.SiteWeb, Schemas["SiteWeb"]>>
type SiteWeb_2 = Aucune<ManqueDansTypes<T.SiteWeb, Schemas["SiteWeb"]>>
type SiteWeb_3 = Aucune<Compatible<T.SiteWeb, Schemas["SiteWeb"]> extends true ? never : "incompatible">

// ─── StatutService ↔ Schemas['StatutService'] ──────────────
type StatutService_1 = Aucune<EnTropDansTypes<T.StatutService, Schemas["StatutService"]>>
type StatutService_2 = Aucune<ManqueDansTypes<T.StatutService, Schemas["StatutService"]>>
type StatutService_3 = Aucune<Compatible<T.StatutService, Schemas["StatutService"]> extends true ? never : "incompatible">

// ─── TachePlanifieeWeb ↔ Schemas['TachePlanifieeWeb'] ──────
type TachePlanifieeWeb_1 = Aucune<EnTropDansTypes<T.TachePlanifieeWeb, Schemas["TachePlanifieeWeb"]>>
type TachePlanifieeWeb_2 = Aucune<ManqueDansTypes<T.TachePlanifieeWeb, Schemas["TachePlanifieeWeb"]>>
type TachePlanifieeWeb_3 = Aucune<Compatible<T.TachePlanifieeWeb, Schemas["TachePlanifieeWeb"]> extends true ? never : "incompatible">

// ─── Ticket ↔ Schemas['Ticket'] ────────────────────────────
type Ticket_1 = Aucune<EnTropDansTypes<T.Ticket, Schemas["Ticket"]>>
type Ticket_2 = Aucune<ManqueDansTypes<T.Ticket, Schemas["Ticket"]>>
type Ticket_3 = Aucune<Compatible<T.Ticket, Schemas["Ticket"]> extends true ? never : "incompatible">

// ─── VariableFlux ↔ Schemas['VariableFlux'] ────────────────
type VariableFlux_1 = Aucune<EnTropDansTypes<T.VariableFlux, Schemas["VariableFlux"]>>
type VariableFlux_2 = Aucune<ManqueDansTypes<T.VariableFlux, Schemas["VariableFlux"]>>
type VariableFlux_3 = Aucune<Compatible<T.VariableFlux, Schemas["VariableFlux"]> extends true ? never : "incompatible">

// ─── Volume ↔ Schemas['Volume'] ────────────────────────────
type Volume_1 = Aucune<EnTropDansTypes<T.Volume, Schemas["Volume"]>>
type Volume_2 = Aucune<ManqueDansTypes<T.Volume, Schemas["Volume"]>>
type Volume_3 = Aucune<Compatible<T.Volume, Schemas["Volume"]> extends true ? never : "incompatible">

// ─── ZoneApplicative ↔ Schemas['ZoneApplicative'] ──────────
type ZoneApplicative_1 = Aucune<EnTropDansTypes<T.ZoneApplicative, Schemas["ZoneApplicative"]>>
type ZoneApplicative_2 = Aucune<ManqueDansTypes<T.ZoneApplicative, Schemas["ZoneApplicative"]>>
type ZoneApplicative_3 = Aucune<Compatible<T.ZoneApplicative, Schemas["ZoneApplicative"]> extends true ? never : "incompatible">

// ─── VM ↔ Schemas['Vm'] ────────────────────────────────────
type VM_1 = Aucune<EnTropDansTypes<T.VM, Schemas["Vm"]>>
type VM_2 = Aucune<ManqueDansTypes<T.VM, Schemas["Vm"]>>
type VM_3 = Aucune<Compatible<T.VM, Schemas["Vm"]> extends true ? never : "incompatible">

// ─── K8sCluster ↔ Schemas['ClusterK8s'] ────────────────────
type K8sCluster_1 = Aucune<EnTropDansTypes<T.K8sCluster, Schemas["ClusterK8s"]>>
type K8sCluster_2 = Aucune<ManqueDansTypes<T.K8sCluster, Schemas["ClusterK8s"]>>
type K8sCluster_3 = Aucune<Compatible<T.K8sCluster, Schemas["ClusterK8s"]> extends true ? never : "incompatible">

// ─── Network ↔ Schemas['Reseau'] ───────────────────────────
type Network_1 = Aucune<EnTropDansTypes<T.Network, Schemas["Reseau"]>>
type Network_2 = Aucune<ManqueDansTypes<T.Network, Schemas["Reseau"]>>
type Network_3 = Aucune<Compatible<T.Network, Schemas["Reseau"]> extends true ? never : "incompatible">

// ─── PublicIP ↔ Schemas['IpPublique'] ──────────────────────
type PublicIP_1 = Aucune<EnTropDansTypes<T.PublicIP, Schemas["IpPublique"]>>
type PublicIP_2 = Aucune<ManqueDansTypes<T.PublicIP, Schemas["IpPublique"]>>
type PublicIP_3 = Aucune<Compatible<T.PublicIP, Schemas["IpPublique"]> extends true ? never : "incompatible">

// ─── SecurityGroup ↔ Schemas['GroupeSecurite'] ─────────────
type SecurityGroup_1 = Aucune<EnTropDansTypes<T.SecurityGroup, Schemas["GroupeSecurite"]>>
type SecurityGroup_2 = Aucune<ManqueDansTypes<T.SecurityGroup, Schemas["GroupeSecurite"]>>
type SecurityGroup_3 = Aucune<Compatible<T.SecurityGroup, Schemas["GroupeSecurite"]> extends true ? never : "incompatible">

// ─── VpnTunnel ↔ Schemas['TunnelVpn'] ──────────────────────
type VpnTunnel_1 = Aucune<EnTropDansTypes<T.VpnTunnel, Schemas["TunnelVpn"]>>
type VpnTunnel_2 = Aucune<ManqueDansTypes<T.VpnTunnel, Schemas["TunnelVpn"]>>
type VpnTunnel_3 = Aucune<Compatible<T.VpnTunnel, Schemas["TunnelVpn"]> extends true ? never : "incompatible">

// ─── ManagedDatabase ↔ Schemas['BaseManagee'] ──────────────
type ManagedDatabase_1 = Aucune<EnTropDansTypes<T.ManagedDatabase, Schemas["BaseManagee"]>>
type ManagedDatabase_2 = Aucune<ManqueDansTypes<T.ManagedDatabase, Schemas["BaseManagee"]>>
type ManagedDatabase_3 = Aucune<Compatible<T.ManagedDatabase, Schemas["BaseManagee"]> extends true ? never : "incompatible">

// ─── BackupPlan ↔ Schemas['PlanSauvegarde'] ────────────────
type BackupPlan_1 = Aucune<EnTropDansTypes<T.BackupPlan, Schemas["PlanSauvegarde"]>>
type BackupPlan_2 = Aucune<ManqueDansTypes<T.BackupPlan, Schemas["PlanSauvegarde"]>>
type BackupPlan_3 = Aucune<Compatible<T.BackupPlan, Schemas["PlanSauvegarde"]> extends true ? never : "incompatible">

// ─── RestorePoint ↔ Schemas['PointRestauration'] ───────────
type RestorePoint_1 = Aucune<EnTropDansTypes<T.RestorePoint, Schemas["PointRestauration"]>>
type RestorePoint_2 = Aucune<ManqueDansTypes<T.RestorePoint, Schemas["PointRestauration"]>>
type RestorePoint_3 = Aucune<Compatible<T.RestorePoint, Schemas["PointRestauration"]> extends true ? never : "incompatible">

// ─── DRPlan ↔ Schemas['PlanPra'] ───────────────────────────
type DRPlan_1 = Aucune<EnTropDansTypes<T.DRPlan, Schemas["PlanPra"]>>
type DRPlan_2 = Aucune<ManqueDansTypes<T.DRPlan, Schemas["PlanPra"]>>
type DRPlan_3 = Aucune<Compatible<T.DRPlan, Schemas["PlanPra"]> extends true ? never : "incompatible">

// ─── ConformiteLigne ↔ Schemas['LigneConformite'] ──────────
type ConformiteLigne_1 = Aucune<EnTropDansTypes<T.ConformiteLigne, Schemas["LigneConformite"]>>
type ConformiteLigne_2 = Aucune<ManqueDansTypes<T.ConformiteLigne, Schemas["LigneConformite"]>>
type ConformiteLigne_3 = Aucune<Compatible<T.ConformiteLigne, Schemas["LigneConformite"]> extends true ? never : "incompatible">

// ─── User ↔ Schemas['Utilisateur'] ─────────────────────────
type User_1 = Aucune<EnTropDansTypes<T.User, Schemas["Utilisateur"]>>
type User_2 = Aucune<ManqueDansTypes<T.User, Schemas["Utilisateur"]>>
type User_3 = Aucune<Compatible<T.User, Schemas["Utilisateur"]> extends true ? never : "incompatible">

// ─── Application ↔ Schemas['ApplicationPaas'] ──────────────
type Application_1 = Aucune<EnTropDansTypes<T.Application, Schemas["ApplicationPaas"]>>
type Application_2 = Aucune<ManqueDansTypes<T.Application, Schemas["ApplicationPaas"]>>
type Application_3 = Aucune<Compatible<T.Application, Schemas["ApplicationPaas"]> extends true ? never : "incompatible">

// ─── Environment ↔ Schemas['Environnement'] ────────────────
type Environment_1 = Aucune<EnTropDansTypes<T.Environment, Schemas["Environnement"]>>
type Environment_2 = Aucune<ManqueDansTypes<T.Environment, Schemas["Environnement"]>>
type Environment_3 = Aucune<Compatible<T.Environment, Schemas["Environnement"]> extends true ? never : "incompatible">

// ─── Component ↔ Schemas['Composant'] ──────────────────────
type Component_1 = Aucune<EnTropDansTypes<T.Component, Schemas["Composant"]>>
type Component_2 = Aucune<ManqueDansTypes<T.Component, Schemas["Composant"]>>
type Component_3 = Aucune<Compatible<T.Component, Schemas["Composant"]> extends true ? never : "incompatible">

// ─── Deployment ↔ Schemas['Deploiement'] ───────────────────
type Deployment_1 = Aucune<EnTropDansTypes<T.Deployment, Schemas["Deploiement"]>>
type Deployment_2 = Aucune<ManqueDansTypes<T.Deployment, Schemas["Deploiement"]>>
type Deployment_3 = Aucune<Compatible<T.Deployment, Schemas["Deploiement"]> extends true ? never : "incompatible">

// ─── WebHosting ↔ Schemas['Hebergement'] ───────────────────
type WebHosting_1 = Aucune<EnTropDansTypes<T.WebHosting, Schemas["Hebergement"]>>
type WebHosting_2 = Aucune<ManqueDansTypes<T.WebHosting, Schemas["Hebergement"]>>
type WebHosting_3 = Aucune<Compatible<T.WebHosting, Schemas["Hebergement"]> extends true ? never : "incompatible">

// ─── DnsZone ↔ Schemas['ZoneDns'] ──────────────────────────
type DnsZone_1 = Aucune<EnTropDansTypes<T.DnsZone, Schemas["ZoneDns"]>>
type DnsZone_2 = Aucune<ManqueDansTypes<T.DnsZone, Schemas["ZoneDns"]>>
type DnsZone_3 = Aucune<Compatible<T.DnsZone, Schemas["ZoneDns"]> extends true ? never : "incompatible">

// ─── Offer ↔ Schemas['Offre'] ──────────────────────────────
type Offer_1 = Aucune<EnTropDansTypes<T.Offer, Schemas["Offre"]>>
type Offer_2 = Aucune<ManqueDansTypes<T.Offer, Schemas["Offre"]>>
type Offer_3 = Aucune<Compatible<T.Offer, Schemas["Offre"]> extends true ? never : "incompatible">

// ─── Subscription ↔ Schemas['Souscription'] ────────────────
type Subscription_1 = Aucune<EnTropDansTypes<T.Subscription, Schemas["Souscription"]>>
type Subscription_2 = Aucune<ManqueDansTypes<T.Subscription, Schemas["Souscription"]>>
type Subscription_3 = Aucune<Compatible<T.Subscription, Schemas["Souscription"]> extends true ? never : "incompatible">

// ─── Invoice ↔ Schemas['Facture'] ──────────────────────────
type Invoice_1 = Aucune<EnTropDansTypes<T.Invoice, Schemas["Facture"]>>
type Invoice_2 = Aucune<ManqueDansTypes<T.Invoice, Schemas["Facture"]>>
type Invoice_3 = Aucune<Compatible<T.Invoice, Schemas["Facture"]> extends true ? never : "incompatible">

// ─── AuditEvent ↔ Schemas['EvenementAudit'] ────────────────
type AuditEvent_1 = Aucune<EnTropDansTypes<T.AuditEvent, Schemas["EvenementAudit"]>>
type AuditEvent_2 = Aucune<ManqueDansTypes<T.AuditEvent, Schemas["EvenementAudit"]>>
type AuditEvent_3 = Aucune<Compatible<T.AuditEvent, Schemas["EvenementAudit"]> extends true ? never : "incompatible">

// ─── ProvisioningJob ↔ Schemas['TravailProvisioning'] ──────
type ProvisioningJob_1 = Aucune<EnTropDansTypes<T.ProvisioningJob, Schemas["TravailProvisioning"]>>
type ProvisioningJob_2 = Aucune<ManqueDansTypes<T.ProvisioningJob, Schemas["TravailProvisioning"]>>
type ProvisioningJob_3 = Aucune<Compatible<T.ProvisioningJob, Schemas["TravailProvisioning"]> extends true ? never : "incompatible">

// ─── AlerteRegle ↔ Schemas['RegleAlerte'] ──────────────────
type AlerteRegle_1 = Aucune<EnTropDansTypes<T.AlerteRegle, Schemas["RegleAlerte"]>>
type AlerteRegle_2 = Aucune<ManqueDansTypes<T.AlerteRegle, Schemas["RegleAlerte"]>>
type AlerteRegle_3 = Aucune<Compatible<T.AlerteRegle, Schemas["RegleAlerte"]> extends true ? never : "incompatible">

// ─── ManagedService ↔ Schemas['ServiceManage'] ─────────────
type ManagedService_1 = Aucune<EnTropDansTypes<T.ManagedService, Schemas["ServiceManage"]>>
type ManagedService_2 = Aucune<ManqueDansTypes<T.ManagedService, Schemas["ServiceManage"]>>
type ManagedService_3 = Aucune<Compatible<T.ManagedService, Schemas["ServiceManage"]> extends true ? never : "incompatible">

// ─── Membership ↔ Schemas['Membre'] ────────────────────────
type Membership_1 = Aucune<EnTropDansTypes<T.Membership, Schemas["Membre"]>>
type Membership_2 = Aucune<ManqueDansTypes<T.Membership, Schemas["Membre"]>>
type Membership_3 = Aucune<Compatible<T.Membership, Schemas["Membre"]> extends true ? never : "incompatible">

// ─── Seat ↔ Schemas['Siege'] ───────────────────────────────
type Seat_1 = Aucune<EnTropDansTypes<T.Seat, Schemas["Siege"]>>
type Seat_2 = Aucune<ManqueDansTypes<T.Seat, Schemas["Siege"]>>
type Seat_3 = Aucune<Compatible<T.Seat, Schemas["Siege"]> extends true ? never : "incompatible">

// ─── CatalogService ↔ Schemas['FicheCatalogue'] ────────────
type CatalogService_1 = Aucune<EnTropDansTypes<T.CatalogService, Schemas["FicheCatalogue"], NonNullable<(typeof CHAMPS_MAQUETTE)["CatalogService"]>[number]>>
type CatalogService_2 = Aucune<ManqueDansTypes<T.CatalogService, Schemas["FicheCatalogue"]>>
type CatalogService_3 = Aucune<Compatible<T.CatalogService, Schemas["FicheCatalogue"]> extends true ? never : "incompatible">

