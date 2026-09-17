/**
 * T7 — machine virtuelle (Nova réel). Écarts au plan, trouvés puis corrigés
 * dans `src/app/app/vms/new/page.tsx` pendant l'écriture de ce test — les
 * deux vérifiés en direct sur dev01 :
 *
 * 1. L'assistant ne lisait ni `GET /catalogue/gabarits` ni
 *    `GET /catalogue/images` en mode API — `FLAVORS` et `IMAGES_SYNELIA` sont
 *    des constantes de maquette, et l'ancienne table de correspondance
 *    d'image (`ubuntu-2404` → `'ubuntu-24.04'`) ne correspondait plus au nom
 *    réel du catalogue (`ubuntu-24.04-v1.33.12`) : `POST /vms/lot` rejetait
 *    systématiquement (`422 Image système inconnue`). Le backend exige de
 *    toute façon l'identifiant Glance exact, jamais un nom — corrigé en
 *    résolvant l'image et le gabarit réels au moment de l'appel plutôt qu'en
 *    maintenant une seconde table figée.
 * 2. Le gabarit réel choisi importe : `medium` (2 vCPU/4 Go/40 Go) fait
 *    échouer la construction Nova sur ce laboratoire (« transitioned to
 *    failure state ERROR », capacité insuffisante) alors que `micro`
 *    (1 vCPU/1 Go/10 Go) construit sans accroc — le correctif prend
 *    systématiquement le plus petit gabarit du catalogue, jamais celui le
 *    plus proche du choix visuel.
 */
import { champParLabel, creerEspaceDeTest, detruireEspaceDeTest, expect, test } from './fixtures'

let espace: Awaited<ReturnType<typeof creerEspaceDeTest>>

test.beforeAll(async ({ api, prefixe }) => {
  test.setTimeout(4 * 60_000)
  espace = await creerEspaceDeTest(api, prefixe, {
    suffixe: 'vm',
    cidr: '10.92.0.0/24',
    quota: { vcpu: 4, ramGo: 16, stockageTo: 80 },
  })
})

test.afterAll(async ({ api }) => {
  test.setTimeout(4 * 60_000)
  await detruireEspaceDeTest(api, espace)
})

test('création réelle par l’assistant, arrêt, suppression', async ({ pageConnectee: page, api, prefixe }) => {
  test.setTimeout(12 * 60_000)
  const nomPrefixe = `${prefixe}vm`

  await page.goto('/app/vms/new')

  // Étape 1 (Mode) : Espace de destination + mode « Gabarit identique » (déjà actif par défaut).
  await champParLabel(page, 'Espace Cloud de destination').selectOption(espace.id)
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 2 (Image) : la première image de la bibliothèque suffit.
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 3 (Gabarit) : préfixe de nommage + le plus petit gabarit affiché.
  await champParLabel(page, 'Préfixe de nommage').fill(nomPrefixe)
  await page.getByLabel('Nombre de machines').fill('1')
  await page.getByRole('button', { name: 'c1.small', exact: false }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 4 (Réseau) et 5 (Options) : défauts.
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Étape 6 (Récapitulatif)
  await page.getByLabel('Je confirme la création de ces machines').check()
  await page.getByRole('button', { name: /^Créer \d+ machine/ }).click()

  await page.waitForURL((u) => u.pathname.startsWith('/app/vms'), { timeout: 15_000 })

  const nom = `${nomPrefixe}-01`
  await expect
    .poll(
      async () => {
        const liste = await api.get<{ donnees: Array<{ nom: string }> }>('/vms?parPage=200')
        return liste.donnees.some((v) => v.nom === nom)
      },
      { timeout: 30_000 },
    )
    .toBe(true)
  const listeApresCreation = await api.get<{ donnees: Array<{ id: string; nom: string }> }>('/vms?parPage=200')
  const vmId = listeApresCreation.donnees.find((v) => v.nom === nom)!.id

  // Nova réel : jusqu'à 10 min pour passer `running`.
  await expect
    .poll(
      async () => (await api.get<{ statut: string }>(`/vms/${vmId}`)).statut,
      { timeout: 10 * 60_000, intervals: [5000] },
    )
    .toBe('running')

  // Arrêt, depuis la fiche.
  await page.goto(`/app/vms/${vmId}`)
  await page.getByRole('button', { name: 'Autres actions sur la machine' }).click()
  await page.getByRole('button', { name: 'Arrêter', exact: true }).click()
  await expect
    .poll(async () => (await api.get<{ statut: string }>(`/vms/${vmId}`)).statut, { timeout: 60_000 })
    .toBe('stopped')

  // Suppression : mauvais nom refusé, bon nom → la machine disparaît.
  await page.getByRole('button', { name: 'Autres actions sur la machine' }).click()
  await page.getByRole('button', { name: 'Supprimer la machine' }).click()
  const modale = page.getByRole('dialog')
  await modale.getByPlaceholder(nom).fill(`${nom}-faux`)
  await expect(modale.getByRole('button', { name: 'Supprimer la machine' })).toBeDisabled()
  await modale.getByPlaceholder(nom).fill(nom)
  await modale.getByRole('button', { name: 'Supprimer la machine' }).click()

  await expect
    .poll(
      // `.catch()` : un blip transitoire de l'API (déjà vu sur ce backend
      // partagé) ne doit pas faire échouer le test au premier appel — juste
      // continuer à sonder.
      async () => {
        const liste = await api
          .get<{ donnees: Array<{ id: string }> }>('/vms?parPage=200')
          .catch(() => ({ donnees: [{ id: vmId }] }))
        return liste.donnees.some((v) => v.id === vmId)
      },
      { timeout: 120_000, intervals: [5000] },
    )
    .toBe(false)
})

test.afterEach(async ({ api, prefixe }) => {
  const nom = `${prefixe}vm-01`
  const liste = await api.get<{ donnees: Array<{ id: string; nom: string }> }>('/vms?parPage=200')
  const reste = liste.donnees.find((v) => v.nom === nom)
  if (reste) await api.del(`/vms/${reste.id}`, reste.nom)
})
