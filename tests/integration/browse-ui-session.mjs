/**
 * One-off browser pass for dashboard UI changes (Playwright).
 * Usage: BASE=http://127.0.0.1:3113 node tests/integration/browse-ui-session.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3113'
const API =
  process.env.API_URL ??
  (BASE.includes('3113') ? 'http://127.0.0.1:4000/v1' : 'https://api.cloud.dev01.ovh.smile.ci/v1')
const OUT = process.env.OUT ?? '/tmp/synelia-ui-browser'
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium'
const EMAIL = process.env.SYNELIA_TEST_EMAIL ?? 'admin@synelia.cloud'
const MDP = process.env.SYNELIA_TEST_MDP ?? 'Synelia!2026'

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (err) => console.error('PAGE_ERROR', err.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('CONSOLE', msg.text())
})

const snap = async (name) => {
  const path = `${OUT}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  console.log('screenshot', path)
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60_000 })
  await snap('01-login')

  const loginRes = await fetch(`${API}/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, motDePasse: MDP }),
  })
  if (!loginRes.ok) throw new Error(`API login ${loginRes.status}: ${await loginRes.text()}`)
  const session = await loginRes.json()
  await page.evaluate((s) => {
    window.localStorage.setItem('synelia.session', JSON.stringify(s))
  }, session)
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 60_000 })
  await snap('02-after-login')

  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.getByText('Mes ressources').waitFor({ timeout: 30_000 })
  await snap('03-dashboard-mes-ressources')

  await page.getByText('Ressources développeur').scrollIntoViewIfNeeded()
  await snap('04-dashboard-dev-hub')

  await page.goto(`${BASE}/app/docs`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.getByRole('button', { name: 'API REST' }).click()
  await page.getByText('Contrat OpenAPI').waitFor({ timeout: 15_000 })
  await snap('05-docs-openapi')

  await page.goto(`${BASE}/app/lanceur`, { waitUntil: 'networkidle', timeout: 60_000 })
  await snap('06-lanceur')

  console.log('BROWSER_OK', page.url())
} catch (e) {
  await snap('error')
  console.error('BROWSER_FAIL', e)
  process.exitCode = 1
} finally {
  await browser.close()
}
