/**
 * T5 — messagerie (Zimbra réel). Préparer : activer le domaine par l'API
 * (`POST /web/emails` → `202`, Zimbra compte ~1–2 min). Agir : créer puis
 * supprimer une boîte depuis la vraie fiche (`/app/web/emails/[id]`) — la
 * suppression d'une boîte n'a pas de modale de confirmation côté écran, la
 * confirmation (`?confirmation=<adresse>`) est passée automatiquement par le
 * code (`vue.tsx`, commentaire « Le backend exige la confirmation par
 * l'adresse exacte, passée ici explicitement »).
 */
import { attendreTravail, expect, test } from './fixtures'

test('activation réelle du domaine, création puis suppression d’une boîte', async ({
  pageConnectee: page,
  api,
  prefixe,
}) => {
  test.setTimeout(6 * 60_000)
  const domaine = `${prefixe}synelia-test.ci`

  const travail = await api.post<{ id: string }>('/web/emails', {
    domaine,
    palier: 'starter',
    boites: 1,
  })
  await attendreTravail(api, travail.id, { echeanceS: 180 })

  const liste = await api.get<{ donnees: Array<{ id: string; domaine: string }> }>('/web/emails?parPage=200')
  const messagerie = liste.donnees.find((m) => m.domaine === domaine)
  expect(messagerie).toBeDefined()
  const messagerieId = messagerie!.id

  await page.goto(`/app/web/emails/${messagerieId}`)
  await page.getByRole('button', { name: 'Créer une boîte' }).click()
  await page.getByPlaceholder('prenom.nom').fill('t-boite')
  await page.getByRole('button', { name: 'Créer la boîte' }).click()

  const adresse = `t-boite@${domaine}`
  await expect(page.getByRole('cell', { name: adresse, exact: true })).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(async () => {
      const m = await api.get<{ boites: Array<{ adresse: string }> }>(`/web/emails/${messagerieId}`)
      return m.boites.some((b) => b.adresse === adresse)
    }, { timeout: 15_000 })
    .toBe(true)

  await page.getByLabel(`Supprimer ${adresse}`).click()
  await expect(page.getByRole('cell', { name: adresse, exact: true })).toHaveCount(0, { timeout: 15_000 })
  await expect
    .poll(async () => {
      const m = await api.get<{ boites: Array<{ adresse: string }> }>(`/web/emails/${messagerieId}`)
      return m.boites.some((b) => b.adresse === adresse)
    }, { timeout: 15_000 })
    .toBe(false)
})

test.afterEach(async ({ api, prefixe }) => {
  const domaine = `${prefixe}synelia-test.ci`
  const r = await api.get<{ donnees: Array<{ id: string; domaine: string }> }>('/web/emails?parPage=200')
  const reste = r.donnees.find((m) => m.domaine === domaine)
  if (!reste) return
  const del = await api.del(`/web/emails/${reste.id}`, reste.domaine)
  const travail = del.corps as { id?: string } | undefined
  if (travail?.id) await attendreTravail(api, travail.id, { echeanceS: 180 }).catch(() => {})
})
