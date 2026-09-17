/**
 * Modèle de navigation à deux barres.
 *
 * Barre 1 : les univers — de grands domaines fonctionnels, stables, peu nombreux.
 * Barre 2 : les sections de l'univers courant.
 *
 * Ce découpage remplace la barre latérale unique qui alignait trente entrées :
 * un portail dont on ne voit que la moitié des entrées à la fois n'aide personne
 * à trouver la bonne. Chaque univers tient ici entre deux et huit sections.
 */

export interface SectionNav {
  nom: string
  href: string
  /**
   * Préfixes d'URL supplémentaires rattachés à cette section, pour les écrans
   * qui n'ont pas d'onglet propre — la zone DNS ouverte depuis un domaine, le
   * détail d'une tâche du centre de tâches. Sans cela, ces pages n'allumeraient
   * aucun onglet et le lecteur perdrait son repère.
   */
  aussi?: string[]
  /**
   * Préfixes de routes dont le `layout` monte un panneau listant les ressources
   * de la section — le patron de Web Cloud, une liste différente par onglet. Le
   * contenu y touche le bord de l'écran : c'est le panneau qui porte la marge.
   */
  panneau?: string[]
  /**
   * Exception au sélecteur d'Espace de l'univers : cette section ne le montre
   * pas. Réservé aux accueils, qui parlent de tout le parc à la fois et
   * n'auraient rien à faire choisir.
   */
  sansPanneau?: boolean
}

export interface UniversNav {
  id: string
  nom: string
  /**
   * L'univers occupe toute la largeur de l'écran. Réservé aux univers bâtis en
   * maître-détail : leurs panneaux doivent toucher le bord et leurs tableaux
   * ont besoin de la place. Les univers de lecture gardent une largeur bornée.
   */
  pleineLargeur?: boolean
  /**
   * L'univers porte un **sélecteur d'Espace Cloud unique**, le même sur toutes
   * ses sections : on choisit une fois où l'on travaille, et cela vaut pour
   * tous les onglets. C'est un contexte, pas une navigation — le panneau ne
   * change jamais de contenu d'un onglet à l'autre, contrairement aux panneaux
   * de ressources de Web Cloud. La barre supérieure masque alors son propre
   * sélecteur d'Espace : la même question posée à deux endroits.
   */
  panneauEspace?: boolean
  sections: SectionNav[]
}

/**
 * Les deux espaces authentifiés du portail, et il n'y en a que deux :
 * l'organisation cliente, et l'équipe Synelia qui exploite la plateforme.
 */
export type Portee = 'client' | 'super_admin'

/** Espace client (§4 à §9). */
export const UNIVERS_CLIENT: UniversNav[] = [
  {
    id: 'global',
    nom: 'Global',
    sections: [
      // Le lanceur n'a plus d'onglet : on y arrive par le menu du compte et par
      // la tuile du tableau de bord. Il reste rattaché ici pour que la barre
      // des sections ne se retrouve pas sans repère quand on l'ouvre.
      { nom: 'Tableau de bord', href: '/app', aussi: ['/app/taches', '/app/lanceur'] },
      { nom: 'Supervision', href: '/app/observabilite' },
      { nom: 'Facturation', href: '/app/facturation' },
      { nom: 'Support & SLA', href: '/app/support' },
      { nom: 'Documentation', href: '/app/docs' },
      { nom: 'Paramètres', href: '/app/parametres' },
    ],
  },
  {
    id: 'infrastructure',
    nom: 'Infrastructure',
    pleineLargeur: true,
    panneauEspace: true,
    sections: [
      // L'accueil est la seule section sans le sélecteur : il fait le tour de
      // tous les Espaces à la fois, c'est là qu'on choisit lequel ouvrir.
      { nom: 'Accueil', href: '/app/infrastructure', sansPanneau: true },
      { nom: 'Espaces Cloud', href: '/app/espaces' },
      { nom: 'Machines virtuelles', href: '/app/vms' },
      { nom: 'Kubernetes', href: '/app/kubernetes' },
      { nom: 'Load balancers', href: '/app/reseau/lb' },
      { nom: 'Réseau & VPN', href: '/app/reseau' },
      { nom: 'Stockage bloc', href: '/app/stockage' },
      { nom: 'Stockage objet S3', href: '/app/objet' },
      { nom: 'Bases managées', href: '/app/bases' },
      // Les sauvegardes se règlent aussi ressource par ressource ; cette
      // section porte les plans réutilisables, la restauration granulaire, la
      // reprise d'activité et le tableau de conformité qu'on montre à un auditeur.
      { nom: 'Sauvegardes & PRA', href: '/app/sauvegarde', aussi: ['/app/pra'] },
    ],
  },
  {
    id: 'applications',
    nom: 'Applications',
    pleineLargeur: true,
    // Pas de `panneauEspace` ici, contrairement à Infrastructure : un projet est
    // une unité de travail indépendante de son hébergement, et deux projets du
    // même Espace n'ont rien à se dire. La question à poser une fois pour toutes
    // n'est pas « où est-ce que je travaille ? » mais « de quel projet
    // parle-t-on ? » — d'où un panneau de projets, monté par chaque section.
    sections: [
      // Même patron maître-détail que Web Cloud, à une différence près : les
      // sections ne listent pas chacune leur ressource, elles partagent un seul
      // panneau — le projet. C'est la maille de cet univers : on choisit le
      // projet une fois, puis on change d'angle sans le reperdre.
      // « Accueil » n'a pas de panneau : c'est un tableau de bord, il ne porte
      // sur aucun projet en particulier.
      { nom: 'Accueil', href: '/app/applications' },
      {
        nom: 'Projets',
        href: '/app/applications/projets',
        // L'assistant de création n'a pas de panneau : il ne parle pas d'un
        // projet existant, il en fabrique un.
        aussi: ['/app/applications/nouveau'],
        panneau: ['/app/applications/projets'],
      },
      {
        nom: 'Déploiements',
        href: '/app/applications/deploiements',
        panneau: ['/app/applications/deploiements'],
      },
      {
        nom: 'Observabilité',
        href: '/app/applications/observabilite',
        panneau: ['/app/applications/observabilite'],
      },
      {
        nom: 'Sauvegardes',
        href: '/app/applications/backup',
        panneau: ['/app/applications/backup'],
      },
      {
        nom: 'Domaines & routage',
        href: '/app/applications/routage',
        panneau: ['/app/applications/routage'],
      },
      {
        nom: 'Variables & secrets',
        href: '/app/applications/variables',
        panneau: ['/app/applications/variables'],
      },
      {
        nom: 'Paramètres',
        href: '/app/applications/parametres',
        panneau: ['/app/applications/parametres'],
      },
    ],
  },
  {
    id: 'ia',
    nom: 'IA & Agents',
    pleineLargeur: true,
    // Même patron que Web Cloud : chaque section liste ses propres ressources
    // dans son panneau, monté par son `layout.tsx`. Pas de `panneauEspace` ici —
    // un agent n'appartient pas à un Espace Cloud, il appartient à l'organisation
    // qui l'exploite, et le déplacer d'un Espace à l'autre n'aurait aucun sens.
    sections: [
      // L'accueil et la consommation n'ont pas de panneau : ce sont des tableaux
      // de bord, ils ne portent sur aucune ressource en particulier.
      { nom: 'Accueil', href: '/app/ia' },
      {
        nom: 'Agents',
        href: '/app/ia/agents',
        // L'assistant de création vit hors du panneau : il ne parle d'aucun
        // agent existant, il en fabrique un.
        aussi: ['/app/ia/nouveau'],
        panneau: ['/app/ia/agents'],
      },
      {
        nom: 'Orchestration',
        href: '/app/ia/orchestration',
        panneau: ['/app/ia/orchestration'],
      },
      {
        nom: 'Connaissances',
        href: '/app/ia/connaissances',
        panneau: ['/app/ia/connaissances'],
      },
      {
        nom: 'Intégrations',
        href: '/app/ia/integrations',
        panneau: ['/app/ia/integrations'],
      },
      { nom: 'Modèles', href: '/app/ia/modeles', panneau: ['/app/ia/modeles'] },
      { nom: 'Consommation', href: '/app/ia/consommation' },
      // Les réglages transverses — passerelle, routage, garde-fous, résidence,
      // budget, coffre — étaient six sections dans la barre. Ils sont devenus
      // six entrées d'un panneau : on n'ouvre pas un réglage aussi souvent qu'un
      // agent, et la barre n'a pas à leur donner le même poids.
      { nom: 'Paramètres', href: '/app/ia/parametres', panneau: ['/app/ia/parametres'] },
    ],
  },
  {
    id: 'web',
    nom: 'Web Cloud',
    pleineLargeur: true,
    sections: [
      // « Accueil » est un tableau de bord : il ne porte pas sur une ressource
      // en particulier, donc pas de panneau. Toutes les autres sections, sauf
      // le relais SMTP qui est un service unique, suivent le maître-détail.
      { nom: 'Accueil', href: '/app/web' },
      { nom: 'Domaines', href: '/app/web/domaines', panneau: ['/app/web/domaines'] },
      { nom: 'Hébergement Web', href: '/app/web/hebergement', panneau: ['/app/web/hebergement'] },
      { nom: 'Bases de données', href: '/app/web/bases', panneau: ['/app/web/bases'] },
      { nom: 'Messagerie', href: '/app/web/emails', panneau: ['/app/web/emails'] },
      { nom: 'Drive', href: '/app/web/drive', panneau: ['/app/web/drive'] },
      { nom: 'Applications', href: '/app/web/applications', panneau: ['/app/web/applications'] },
      { nom: 'SSL', href: '/app/web/ssl', panneau: ['/app/web/ssl'] },
      { nom: 'Sauvegardes', href: '/app/web/backup', panneau: ['/app/web/backup'] },
      { nom: 'Relais SMTP', href: '/app/smtp' },
    ],
  },
  {
    id: 'iam',
    nom: 'IAM & sécurité',
    sections: [
      { nom: 'Membres & rôles', href: '/app/membres' },
      { nom: "Fédération d'identité", href: '/app/sso' },
      // « Mon compte » (double authentification personnelle) n'a pas d'onglet
      // propre, sur le patron du lanceur : on y arrive par le menu du compte.
      // Rattaché ici pour que la barre garde un repère quand on l'ouvre.
      { nom: 'Sécurité & audit', href: '/app/securite', aussi: ['/app/compte'] },
    ],
  },
]

/** Espace super admin (§11) — l'équipe Synelia qui exploite la plateforme. */
export const UNIVERS_SUPER_ADMIN: UniversNav[] = [
  {
    id: 'pilotage',
    nom: 'Pilotage',
    sections: [
      { nom: 'Vue plateforme', href: '/admin' },
      { nom: 'Santé du parc', href: '/admin/sante' },
    ],
  },
  {
    id: 'clients',
    nom: 'Clients',
    // Une seule section : toutes les organisations sont clientes en direct.
    // La navigation entre elles se fait dans le panneau monté par le layout de
    // la section, pas par un onglet de plus. Un exploitant saute d'un client à
    // l'autre toute la journée ; sans panneau persistant, chaque saut repasse
    // par la liste.
    pleineLargeur: true,
    sections: [
      { nom: 'Organisations', href: '/admin/organisations', panneau: ['/admin/organisations'] },
    ],
  },
  {
    id: 'infrastructure',
    nom: 'Infrastructure',
    sections: [
      { nom: 'Capacité & backends', href: '/admin/capacite' },
      // Pas de parc GPU sur cette plateforme (§ décision « Inférence dédiée »
      // dans CLAUDE.md) : cette section reste une vue d'usage IA — modèles
      // appelés, agents et orchestration par organisation — pas de matériel.
      { nom: 'IA & Agents', href: '/admin/ia' },
      { nom: 'Sites & zones', href: '/admin/sites' },
      { nom: 'Migration inter-backend', href: '/admin/migration' },
    ],
  },
  {
    id: 'produit',
    nom: 'Produit',
    sections: [
      { nom: "Catalogue d'offres", href: '/admin/catalogue' },
      { nom: 'Marketplace', href: '/admin/marketplace' },
    ],
  },
  {
    id: 'finance',
    nom: 'Finance',
    sections: [{ nom: 'Facturation & marge', href: '/admin/facturation' }],
  },
  {
    id: 'exploitation',
    nom: 'Exploitation',
    sections: [
      { nom: 'Tickets', href: '/admin/tickets' },
      { nom: 'Audit', href: '/admin/audit' },
      { nom: 'Conformité', href: '/admin/conformite' },
      { nom: 'Équipe & rôles', href: '/admin/equipe' },
    ],
  },
]

/** Racine de l'espace — `/app` ou `/admin`, jamais préfixe d'une section. */
function racine(univers: UniversNav[]): string {
  return univers[0].sections[0].href
}

function correspond(chemin: string, href: string, base: string): boolean {
  // La racine de l'espace ne s'active qu'en correspondance exacte : sinon elle
  // serait préfixe de toutes les autres routes et gagnerait toujours.
  if (href === base) return chemin === base
  return chemin === href || chemin.startsWith(`${href}/`)
}

/**
 * Section active pour un chemin donné, au préfixe le plus long : `/app/reseau/lb`
 * doit désigner les load balancers, pas le réseau.
 */
export function sectionActive(
  univers: UniversNav[],
  chemin: string,
): { univers: UniversNav; section: SectionNav } | null {
  const base = racine(univers)
  let meilleur: { univers: UniversNav; section: SectionNav; longueur: number } | null = null

  for (const u of univers) {
    for (const s of u.sections) {
      for (const href of [s.href, ...(s.aussi ?? [])]) {
        if (!correspond(chemin, href, base)) continue
        if (!meilleur || href.length > meilleur.longueur) {
          meilleur = { univers: u, section: s, longueur: href.length }
        }
      }
    }
  }
  return meilleur ? { univers: meilleur.univers, section: meilleur.section } : null
}

/** Univers actif, avec repli sur le premier — jamais de barre 2 vide. */
export function universActif(univers: UniversNav[], chemin: string): UniversNav {
  return sectionActive(univers, chemin)?.univers ?? univers[0]
}

/**
 * Gabarit de contenu d'une route.
 *
 * `plein` — la section monte un panneau de sélection : il doit toucher le bord
 * de l'écran, et c'est lui qui porte la marge du contenu.
 * `large` — univers en pleine largeur, écran sans panneau : les tableaux
 * respirent jusqu'à 1600 px.
 * `borne` — tout le reste, borné à 1400 px. Un paragraphe de 1900 px ne se lit
 * pas, et la moitié des écrans de l'espace client sont faits de phrases.
 */
export type Gabarit = 'borne' | 'large' | 'plein'

export function gabarit(univers: UniversNav[], chemin: string): Gabarit {
  const trouve = sectionActive(univers, chemin)
  if (!trouve?.univers.pleineLargeur) return 'borne'
  return avecPanneau(trouve.univers, trouve.section, chemin) ? 'plein' : 'large'
}

/** Vrai si un panneau est monté sur cette route — de section ou d'univers. */
export function avecPanneau(
  univers: UniversNav,
  section: SectionNav,
  chemin: string,
): boolean {
  if (univers.panneauEspace) return !section.sansPanneau
  return (section.panneau ?? []).some(
    (base) => chemin === base || chemin.startsWith(`${base}/`),
  )
}

/** Sélecteur d'Espace à monter pour cette route, s'il y en a un. */
export function panneauEspaceActif(univers: UniversNav[], chemin: string): boolean {
  const trouve = sectionActive(univers, chemin)
  return Boolean(trouve?.univers.panneauEspace && !trouve.section.sansPanneau)
}
