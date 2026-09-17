/**
 * T1 — connexion réelle, `POST /auth/connexion` depuis le vrai formulaire.
 * Pas de `login: true` (pas de fixture `pageConnectee`) : c'est justement ce
 * parcours-là que ce test exerce.
 */
import { champParLabel, expect, test } from './fixtures'

test('formulaire de connexion : identifiants valides ouvrent une session', async ({ page }) => {
  const email = process.env.SYNELIA_TEST_EMAIL
  const motDePasse = process.env.SYNELIA_TEST_MDP
  if (!email || !motDePasse) throw new Error('SYNELIA_TEST_EMAIL/SYNELIA_TEST_MDP requis.')

  await page.goto('/login')
  await champParLabel(page, 'Adresse e-mail professionnelle').fill(email)
  await champParLabel(page, 'Mot de passe').fill(motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // Jamais une regex `/\/app/` : le nom d'hôte du bac à sable la satisferait
  // déjà (`app.synelia.dev01…`). `startsWith('/app')` sur le chemin seul.
  await page.waitForURL((u) => u.pathname.startsWith('/app'), { timeout: 15_000 })

  const session = await page.evaluate(() => window.localStorage.getItem('synelia.session'))
  expect(session).not.toBeNull()
  const parsed = JSON.parse(session!)
  expect(typeof parsed.accessToken).toBe('string')
  expect(parsed.accessToken.length).toBeGreaterThan(0)
})

test('sans session, /app/vms redirige vers /login (GardeAuth)', async ({ browser, baseURL }) => {
  const contexte = await browser.newContext({ baseURL })
  const page = await contexte.newPage()
  await page.goto('/app/vms')
  await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 10_000 })
  await contexte.close()
})

test('mauvais mot de passe : message d’erreur, pas de session', async ({ page }) => {
  const email = process.env.SYNELIA_TEST_EMAIL
  if (!email) throw new Error('SYNELIA_TEST_EMAIL requis.')

  await page.goto('/login')
  await champParLabel(page, 'Adresse e-mail professionnelle').fill(email)
  await champParLabel(page, 'Mot de passe').fill('mot-de-passe-definitivement-faux')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page.getByText(/répondu|invalide|incorrect|échoué/i)).toBeVisible({ timeout: 10_000 })
  expect(page.url()).toContain('/login')
  const session = await page.evaluate(() => window.localStorage.getItem('synelia.session'))
  expect(session).toBeNull()
})
