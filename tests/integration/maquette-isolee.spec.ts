/**
 * T0 — le mode maquette ne parle jamais au réseau. Projet `maquette` : servi
 * par un build sans `NEXT_PUBLIC_API_URL` (voir l'en-tête de
 * `playwright.config.ts`). N'utilise pas les fixtures `api`/`prefixe` : ce
 * test ne dépend ni d'une session ni du laboratoire.
 */
import { expect, test } from 'playwright/test'

const ROUTES = ['/app', '/app/vms', '/app/web/domaines', '/app/ia']

for (const route of ROUTES) {
  test(`${route} : aucun appel réseau externe, aucune erreur console`, async ({ page, baseURL }) => {
    const requetesExternes: string[] = []
    const erreursConsole: string[] = []

    page.on('request', (r) => {
      const url = new URL(r.url())
      if (url.protocol === 'data:' || url.protocol === 'blob:') return
      if (baseURL && url.origin === new URL(baseURL).origin) return
      requetesExternes.push(r.url())
    })
    page.on('console', (msg) => {
      if (msg.type() === 'error') erreursConsole.push(msg.text())
    })
    page.on('pageerror', (err) => erreursConsole.push(String(err)))

    await page.goto(route)
    await page.waitForLoadState('networkidle')

    // Un bouton d'action quelconque, cliqué : même déclenché, aucune requête
    // ne doit partir en mode maquette (le clic reste local à l'atelier).
    const bouton = page.getByRole('button').first()
    if (await bouton.isVisible().catch(() => false)) {
      await bouton.click({ trial: false, timeout: 2000 }).catch(() => {})
    }
    await page.waitForTimeout(300)

    expect(requetesExternes, `requêtes externes depuis ${route}`).toEqual([])
    expect(erreursConsole, `erreurs console sur ${route}`).toEqual([])
  })
}
