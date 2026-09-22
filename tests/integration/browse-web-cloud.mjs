/**
 * Web Cloud universe — API session + Playwright smoke (TEST-PLAN-UNIVERS §4).
 * Usage:
 *   BASE=http://127.0.0.1:3113 API_URL=http://127.0.0.1:4000/v1 node tests/integration/browse-web-cloud.mjs
 *   BASE=https://app.cloud.dev01.ovh.smile.ci node tests/integration/browse-web-cloud.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3113'
const API =
  process.env.API_URL ??
  (BASE.includes('3113') ? 'http://127.0.0.1:4000/v1' : 'https://api.cloud.dev01.ovh.smile.ci/v1')
const OUT = process.env.OUT ?? '/tmp/synelia-web-cloud-browser'
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium'
const EMAIL = process.env.SYNELIA_TEST_EMAIL ?? 'admin@synelia.cloud'
const MDP = process.env.SYNELIA_TEST_MDP ?? 'Synelia!2026'

const ROUTES = [
  { id: 'W-01', path: '/app/web', expect: /Web Cloud|Domaines|Hébergement/i },
  { id: 'W-10', path: '/app/web/domaines', expect: /Domaines|Ajouter|domaine/i },
  { id: 'W-20', path: '/app/web/hebergement', expect: /Hébergement|site|domaine/i },
  { id: 'W-30', path: '/app/web/bases', expect: /Bases|base de données/i },
  { id: 'W-40', path: '/app/web/emails', expect: /Messagerie|boîte|email/i },
  { id: 'W-50', path: '/app/web/drive', expect: /Drive|fichier/i },
  { id: 'W-60', path: '/app/web/applications', expect: /Application|catalogue/i },
  { id: 'W-70', path: '/app/web/ssl', expect: /SSL|certificat/i },
  { id: 'W-80', path: '/app/web/backup', expect: /Sauvegarde|backup/i },
  { id: 'W-90', path: '/app/smtp', expect: /SMTP|relais/i },
]

await mkdir(OUT, { recursive: true })

const loginRes = await fetch(`${API}/auth/connexion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, motDePasse: MDP }),
})
if (!loginRes.ok) {
  console.error('API_LOGIN_FAIL', loginRes.status, await loginRes.text())
  process.exit(1)
}
const session = await loginRes.json()
console.log('API_LOGIN_OK', session.organisationActive ?? '(no org)')

const apiChecks = []
for (const ep of ['/web/domaines', '/web/hebergements', '/web/emails', '/web/smtp']) {
  const r = await fetch(`${API}${ep}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, 'X-Organisation-Id': session.organisationActive ?? '' },
  })
  apiChecks.push({ ep, status: r.status, ok: r.status === 200 })
  console.log('API_GET', ep, r.status)
}
const apiFail = apiChecks.filter((c) => !c.ok)
if (apiFail.length) console.warn('API_WARN', apiFail)

const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (err) => console.error('PAGE_ERROR', err.message))

const results = []
try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate((s) => {
    window.localStorage.setItem('synelia.session', JSON.stringify(s))
  }, session)

  for (const { id, path, expect } of ROUTES) {
    const url = `${BASE}${path}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
    const body = await page.locator('body').innerText()
    const pass = expect.test(body)
    const shot = `${OUT}/${id}${path.replace(/\//g, '_')}.png`
    await page.screenshot({ path: shot, fullPage: true })
    results.push({ id, path, pass, shot })
    console.log(pass ? 'UI_PASS' : 'UI_FAIL', id, path)
    if (!pass) console.log('  snippet:', body.slice(0, 200).replace(/\s+/g, ' '))
  }

  await page.getByRole('button', { name: /Web Cloud/i }).click({ timeout: 15_000 }).catch(() => {})
  await page.screenshot({ path: `${OUT}/nav-web-cloud.png`, fullPage: true })

  const failed = results.filter((r) => !r.pass)
  if (failed.length) {
    console.error('BROWSER_PARTIAL', failed.map((f) => f.id))
    process.exitCode = 1
  } else {
    console.log('BROWSER_OK', 'web-cloud', results.length, 'sections')
  }
} catch (e) {
  console.error('BROWSER_FAIL', e)
  await page.screenshot({ path: `${OUT}/error.png`, fullPage: true })
  process.exitCode = 1
} finally {
  await browser.close()
}
