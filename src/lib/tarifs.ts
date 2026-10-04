/** Grille unique des prix mensuels (FCFA HT) — miroir de `facturation/metrologie.py` côté backend. */
export const PRIX = {
  vcpuMois: 6500,
  ramGoMois: 1400,
  stockageGoMois: 5.4,
  ipPubliqueMois: 3500,
  lbMois: 18000,
  k8sControleMois: 18000,
  k8sControleHaMois: 62000,
}

export const prixMachine = (vcpu: number, ramGo: number, diskGo = 0) =>
  Math.round(vcpu * PRIX.vcpuMois + ramGo * PRIX.ramGoMois + diskGo * PRIX.stockageGoMois)

export const prixControlPlane = (ha: boolean) => (ha ? PRIX.k8sControleHaMois : PRIX.k8sControleMois)

/** Paliers d'hébergement web (vCPU, RAM Go, disque Go) — miroir de `SPECS_PALIER_WEB` côté backend. */
export const PALIERS_HEBERGEMENT = [
  { code: 'starter', nom: 'Starter', vcpu: 1, ramGo: 2, diskGo: 40 },
  { code: 'pro', nom: 'Pro', vcpu: 2, ramGo: 4, diskGo: 80 },
  { code: 'business', nom: 'Business', vcpu: 4, ramGo: 8, diskGo: 160 },
  { code: 'enterprise', nom: 'Enterprise', vcpu: 8, ramGo: 16, diskGo: 320 },
].map((p) => ({ ...p, prixMois: prixMachine(p.vcpu, p.ramGo, p.diskGo) }))
