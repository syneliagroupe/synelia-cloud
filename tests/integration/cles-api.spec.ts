/**
 * T2 — clé API : préparer (login), agir depuis `/app/parametres` (onglet
 * « Accès programmatique »), vérifier au niveau API (secret jamais relisté),
 * détruire par la vraie modale de confirmation (`ConfirmDialog`, saisie du
 * nom exact — testée d'abord avec un mauvais nom).
 */
import { champParLabel, expect, test } from './fixtures'

test('création, secret affiché une fois, révocation confirmée par le nom', async ({
  pageConnectee: page,
  api,
  prefixe,
}) => {
  const nom = `${prefixe}cle-api`

  await page.goto('/app/parametres')
  // `Tabs` (src/components/ui/display.tsx) rend de simples `<button>`, pas
  // de `role="tab"`.
  await page.getByRole('button', { name: 'Accès programmatique' }).click()

  await page.getByRole('button', { name: 'Créer un jeton' }).click()
  const modaleCreation = page.getByRole('dialog')
  await champParLabel(modaleCreation, 'Nom').fill(nom)
  await modaleCreation.getByRole('button', { name: 'Créer le jeton' }).click()

  // Le secret ne s'affiche qu'une fois : présent, puis absent du DOM après
  // « Je l'ai copié, masquer ».
  await expect(page.getByText('Copiez ce secret maintenant')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Je l’ai copié, masquer' }).click()
  await expect(page.getByText('Copiez ce secret maintenant')).toHaveCount(0)

  // Vérité par l'API : la clé existe, sans le champ secret.
  await expect
    .poll(
      async () => {
        const r = await api.get<{ donnees: Array<{ nom: string }> }>('/securite/cles-api?parPage=200')
        return r.donnees.some((c) => c.nom === nom)
      },
      { timeout: 10_000 },
    )
    .toBe(true)
  const liste = await api.get<{ donnees: Array<{ nom: string; secret?: string }> }>('/securite/cles-api?parPage=200')
  const cle = liste.donnees.find((c) => c.nom === nom)
  expect(cle).toBeDefined()
  expect(cle?.secret).toBeUndefined()

  // Révocation : mauvais nom d'abord — bouton désactivé, la clé est toujours là.
  const ligne = page.locator('div').filter({ hasText: nom }).last()
  await ligne.getByRole('button', { name: 'Révoquer' }).click()
  const modaleRevoke = page.getByRole('dialog')
  await modaleRevoke.getByPlaceholder(nom).fill(`${nom}-faux`)
  await expect(modaleRevoke.getByRole('button', { name: 'Révoquer le jeton' })).toBeDisabled()
  await modaleRevoke.getByPlaceholder(nom).fill(nom)
  await expect(modaleRevoke.getByRole('button', { name: 'Révoquer le jeton' })).toBeEnabled()
  await modaleRevoke.getByRole('button', { name: 'Révoquer le jeton' }).click()

  // `DELETE /securite/cles-api/{id}` est une révocation logique
  // (`c.revoquee_le = maintenant()`, `securite/router.py`) : la clé reste
  // listée, `statut` passe à `revoquee` — elle ne disparaît pas de la liste
  // (à la différence de `/vms` ou `/espaces`, qui suppriment réellement).
  await expect
    .poll(async () => {
      const r = await api.get<{ donnees: Array<{ nom: string; statut: string }> }>('/securite/cles-api?parPage=200')
      return r.donnees.find((c) => c.nom === nom)?.statut
    }, { timeout: 10_000 })
    .toBe('revoquee')
})

test.afterEach(async ({ api, prefixe }) => {
  const nom = `${prefixe}cle-api`
  const r = await api.get<{ donnees: Array<{ id: string; nom: string; statut: string }> }>(
    '/securite/cles-api?parPage=200',
  )
  const reste = r.donnees.find((c) => c.nom === nom && c.statut !== 'revoquee')
  if (reste) await api.del(`/securite/cles-api/${reste.id}`, reste.nom)
})
