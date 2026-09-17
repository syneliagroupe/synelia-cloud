/**
 * T3 — clé de passerelle IA : préparer (login, un Espace Cloud dédié — le
 * plus ancien n'existe pas forcément sur une organisation qui vient d'être
 * nettoyée), agir depuis `/app/ia/parametres/passerelle` (créer, rotation,
 * révocation), vérifier au niveau API.
 */
import { champParLabel, creerEspaceDeTest, detruireEspaceDeTest, expect, test } from './fixtures'

let espace: Awaited<ReturnType<typeof creerEspaceDeTest>>

test.beforeAll(async ({ api, prefixe }) => {
  test.setTimeout(4 * 60_000)
  espace = await creerEspaceDeTest(api, prefixe, { suffixe: 'ia' })
})

test.afterAll(async ({ api }) => {
  test.setTimeout(4 * 60_000)
  await detruireEspaceDeTest(api, espace)
})

test('création, rotation, révocation confirmée par le nom', async ({ pageConnectee: page, api, prefixe }) => {
  const nom = `${prefixe}cle-ia`

  await page.goto('/app/ia/parametres/passerelle')
  await page.getByRole('button', { name: 'Créer une clé' }).click()
  const modaleCreation = page.getByRole('dialog')
  await champParLabel(modaleCreation, 'Nom').fill(nom)
  await modaleCreation.getByRole('button', { name: 'Créer la clé' }).click()

  await expect(page.getByText('Copiez ce secret maintenant')).toBeVisible({ timeout: 10_000 })
  const premierSecret = await page.locator('p.font-mono').first().innerText()
  await page.getByRole('button', { name: 'Je l’ai copié, masquer' }).click()

  await expect
    .poll(async () => {
      const r = await api.get<{ donnees: Array<{ nom: string }> }>('/ia/cles?parPage=200')
      return r.donnees.some((c) => c.nom === nom)
    }, { timeout: 10_000 })
    .toBe(true)

  // Rotation : un secret différent, `POST /ia/cles/{id}/rotation`.
  const ligne = page.locator('tr').filter({ hasText: nom })
  await ligne.getByLabel(`Faire tourner la clé ${nom}`).click()
  await expect(page.getByText('Copiez ce secret maintenant')).toBeVisible({ timeout: 10_000 })
  const secretTourne = await page.locator('p.font-mono').first().innerText()
  expect(secretTourne).not.toBe(premierSecret)
  await page.getByRole('button', { name: 'Je l’ai copié, masquer' }).click()

  // Révocation, confirmée par `cle.nom`.
  await ligne.getByLabel(`Révoquer la clé ${nom}`).click()
  const modaleRevoke = page.getByRole('dialog')
  await modaleRevoke.getByPlaceholder(nom).fill(nom)
  await modaleRevoke.getByRole('button', { name: 'Révoquer' }).click()

  await expect
    .poll(async () => {
      const r = await api.get<{ donnees: Array<{ nom: string; statut: string }> }>('/ia/cles?parPage=200')
      const c = r.donnees.find((x) => x.nom === nom)
      return c?.statut
    }, { timeout: 10_000 })
    .toBe('revoquee')
})

test.afterEach(async ({ api, prefixe }) => {
  const nom = `${prefixe}cle-ia`
  const r = await api.get<{ donnees: Array<{ id: string; nom: string; statut: string }> }>('/ia/cles?parPage=200')
  const reste = r.donnees.find((c) => c.nom === nom && c.statut !== 'revoquee')
  if (reste) await api.del(`/ia/cles/${reste.id}`, reste.nom)
})
