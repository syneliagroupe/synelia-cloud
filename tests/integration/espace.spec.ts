/**
 * T6 — Espace Cloud (Keystone + Neutron réels). Écart au plan noté ici :
 * `/app/espaces/[id]/vue.tsx` n'a aucune action de suppression — aucun
 * `BoutonAction` ni appel à `espacesCol.supprimer()` sur cette fiche
 * (vérifié : zéro occurrence). Il n'y a donc pas de « mauvais code refusé »
 * à tester depuis l'interface pour la destruction : ce test crée l'Espace
 * par le vrai assistant (`/app/espaces/new`), vérifie le travail et la
 * fiche, puis détruit par l'API (même route que l'interface appellerait si
 * le bouton existait).
 */
import { attendreTravail, champParLabel, expect, test } from './fixtures'

test('création réelle par l’assistant, travail suivi, suppression', async ({ pageConnectee: page, api, prefixe }) => {
  test.setTimeout(12 * 60_000)

  const chiffres = prefixe.replace(/\D/g, '') // hhmmss
  const code = `EC-${chiffres.slice(0, 4)}-${chiffres.slice(4, 6)}`
  const cidr = '10.91.0.0/24'

  await page.goto('/app/espaces/new')

  // Étape 1 (Offre) et 2 (Site) : les valeurs par défaut suffisent.
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 3 (Réseau)
  await champParLabel(page, 'Code de l’espace').fill(code)
  await champParLabel(page, 'Plage CIDR').fill(cidr)
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 4 (Options) : défauts.
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 5 (Récapitulatif)
  await page.getByLabel(/conditions générales/).check()
  await page.getByRole('button', { name: 'Créer l’Espace Cloud' }).click()

  await page.waitForURL((u) => u.pathname.startsWith('/app/espaces'), { timeout: 15_000 })

  // Vérité par l'API — le travail termine `done` (Keystone + Neutron réels).
  await expect
    .poll(
      async () => {
        const liste = await api.get<{ donnees: Array<{ code: string }> }>('/espaces?parPage=200')
        return liste.donnees.some((e) => e.code === code)
      },
      { timeout: 30_000 },
    )
    .toBe(true)
  const listeApresCreation = await api.get<{ donnees: Array<{ id: string; code: string }> }>('/espaces?parPage=200')
  const espaceId = listeApresCreation.donnees.find((e) => e.code === code)!.id

  await expect
    .poll(
      async () => {
        const e = await api.get<{ statut: string }>(`/espaces/${espaceId}`)
        return e.statut
      },
      { timeout: 10 * 60_000, intervals: [5000] },
    )
    .toBe('active')

  // La fiche le montre aussi, une fois `useCollection` réactualisé.
  await page.goto(`/app/espaces/${espaceId}`)
  await expect(page.getByText(code).first()).toBeVisible({ timeout: 15_000 })
})

test.afterEach(async ({ api, prefixe }) => {
  const chiffres = prefixe.replace(/\D/g, '')
  const code = `EC-${chiffres.slice(0, 4)}-${chiffres.slice(4, 6)}`
  const liste = await api.get<{ donnees: Array<{ id: string; code: string }> }>('/espaces?parPage=200')
  const reste = liste.donnees.find((e) => e.code === code)
  if (!reste) return
  const del = await api.del(`/espaces/${reste.id}`, reste.code)
  const travail = del.corps as { id?: string } | undefined
  if (travail?.id) await attendreTravail(api, travail.id, { echeanceS: 180 }).catch(() => {})
})
