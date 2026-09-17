/**
 * Captures d'écran pour le guide utilisateur (docs/GUIDE-UTILISATEUR.md).
 * Ouvre une sélection de routes représentatives de chaque écran distinct et
 * enregistre un PNG par route dans docs/guide-utilisateur/captures/.
 *
 * Réutilise le patron de outils/audit.mjs (lancement de Chromium, base de
 * routes). Contrairement à l'audit, celui-ci ne couvre pas les 191 routes :
 * seulement un représentant par type d'écran, tel que demandé pour le guide.
 */
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const DOSSIER = fileURLToPath(new URL('../docs/guide-utilisateur/captures/', import.meta.url))
mkdirSync(DOSSIER, { recursive: true })

const BASE = process.env.BASE || 'http://127.0.0.1:3111'
const LARGEUR = 1440
const HAUTEUR = 900

// [route, nom-de-fichier-sans-extension]
const CIBLES = [
  // Vitrine publique
  ['/', 'vitrine-accueil'],
  ['/tarifs', 'vitrine-tarifs'],
  ['/marketplace', 'vitrine-marketplace'],
  ['/simulateur', 'vitrine-simulateur'],

  // Global — tableau de bord, tâches
  ['/app', 'app-dashboard'],
  ['/app/taches', 'app-taches'],

  // Infrastructure — Espaces Cloud
  ['/app/espaces', 'espaces-liste'],
  ['/app/espaces/new', 'espaces-creation'],
  ['/app/espaces/ec-dba-01', 'espaces-detail'],

  // Infrastructure — Machines virtuelles
  ['/app/vms', 'vms-liste'],
  ['/app/vms/new', 'vms-creation'],
  ['/app/vms/vm-web-01', 'vms-detail'],
  ['/app/vms/composer', 'vms-composer'],

  // Infrastructure — Kubernetes
  ['/app/kubernetes', 'k8s-liste'],
  ['/app/kubernetes/new', 'k8s-creation'],
  ['/app/kubernetes/k8s-prod', 'k8s-detail'],

  // Infrastructure — Réseau & Load balancers
  ['/app/reseau', 'reseau-ip'],
  ['/app/reseau/lb', 'reseau-lb-liste'],
  ['/app/reseau/lb/lb-1', 'reseau-lb-detail'],

  // Infrastructure — Stockage
  ['/app/stockage', 'stockage-volumes'],
  ['/app/objet', 'stockage-objet-liste'],
  ['/app/objet/bkt-1', 'stockage-objet-detail'],

  // Infrastructure — Bases managées
  ['/app/bases', 'bases-managees'],

  // Infrastructure — Sauvegarde & PRA
  ['/app/sauvegarde', 'sauvegarde'],
  ['/app/pra', 'pra-liste'],
  ['/app/pra/pra-dba-prod', 'pra-detail'],

  // Applications / Projets
  ['/app/applications', 'applications-accueil'],
  ['/app/applications/projets', 'applications-projets-liste'],
  ['/app/applications/projets/prj-metier', 'applications-projet-detail'],
  ['/app/applications/projets/prj-metier/svc-metier-api', 'applications-service-detail'],
  ['/app/applications/deploiements/prj-metier', 'applications-deploiements'],
  ['/app/applications/observabilite/prj-metier', 'applications-observabilite'],
  ['/app/applications/routage/prj-metier', 'applications-routage'],
  ['/app/applications/variables/prj-metier', 'applications-variables'],
  ['/app/applications/parametres/prj-metier', 'applications-parametres'],

  // Web Cloud
  ['/app/web', 'web-accueil'],
  ['/app/web/domaines', 'web-domaines'],
  ['/app/web/hebergement', 'web-hebergement'],
  ['/app/web/bases', 'web-bases'],
  ['/app/web/emails', 'web-emails'],
  ['/app/web/drive', 'web-drive'],
  ['/app/web/applications', 'web-applications'],
  ['/app/web/ssl', 'web-ssl'],
  ['/app/web/backup', 'web-backup'],

  // IA & Agents
  ['/app/ia', 'ia-accueil'],
  ['/app/ia/agents', 'ia-agents-liste'],
  ['/app/ia/agents/ag-support', 'ia-agent-detail'],
  ['/app/ia/orchestration/fx-reclamation', 'ia-orchestration-detail'],
  ['/app/ia/connaissances/kb-procedures', 'ia-connaissance-detail'],
  ['/app/ia/integrations/cx-widget', 'ia-integration-detail'],
  ['/app/ia/modeles/m-llama-70b', 'ia-modele-detail'],
  ['/app/ia/consommation', 'ia-consommation'],
  ['/app/ia/parametres', 'ia-parametres-liste'],
  ['/app/ia/parametres/routage', 'ia-parametre-routage'],

  // IAM & sécurité + reste du Global
  ['/app/membres', 'membres'],
  ['/app/sso', 'sso'],
  ['/app/securite', 'securite'],
  ['/app/parametres', 'parametres-organisation'],
  ['/app/facturation', 'facturation'],
  ['/app/support', 'support-liste'],
  ['/app/support/tck-4471', 'support-ticket-detail'],
  ['/app/docs', 'app-docs'],

  // Super admin
  ['/admin', 'admin-pilotage'],
  ['/admin/organisations', 'admin-organisations-liste'],
  ['/admin/organisations/org-dba', 'admin-organisation-detail'],
  ['/admin/capacite', 'admin-infrastructure-capacite'],
  ['/admin/facturation', 'admin-facturation'],
  ['/admin/tickets', 'admin-tickets'],
  ['/admin/equipe', 'admin-equipe'],
]

;(async () => {
  const b = await chromium.launch()
  // reducedMotion: la vitrine anime l'entrée des sections au scroll (classe
  // .revele, animation-timeline: view()) ; sans cette option, une capture
  // pleine page fige la plupart des sections à opacity:0 (bandes vides).
  const ctx = await b.newContext({
    viewport: { width: LARGEUR, height: HAUTEUR },
    reducedMotion: 'reduce',
  })
  const p = await ctx.newPage()

  const echecs = []
  for (const [route, nom] of CIBLES) {
    try {
      await p.goto(BASE + route, { waitUntil: 'load', timeout: 45000 })
      await p.waitForLoadState('networkidle').catch(() => {})
      await p.waitForTimeout(500)
      await p.screenshot({ path: DOSSIER + nom + '.png', fullPage: true })
      console.log('OK  ', route, '->', nom + '.png')
    } catch (e) {
      echecs.push([route, e.message.slice(0, 160)])
      console.log('FAIL', route, '-', e.message.slice(0, 160))
    }
  }

  await b.close()

  console.log('\n=== ' + CIBLES.length + ' cibles, ' + echecs.length + ' échecs ===')
  if (echecs.length) console.log(JSON.stringify(echecs, null, 2))
})()
