/**
 * T4 — zone DNS réelle (Designate). Écart au plan, noté ici : l'éditeur de
 * zone (`EditeurZone`, `src/components/business/editeur-zone.tsx`) n'est
 * monté qu'à `/app/web/domaines/[id]`, derrière un `Domaine` créé par
 * `POST /web/domaines` — un module **sans** `DELETE` (vérifié dans
 * `apps/synelia/synelia/modules/web_domaines/router.py` : aucune route
 * destructive). Créer ce `Domaine` pour piloter l'UI laisserait une
 * ressource impossible à nettoyer, ce qu'aucun test de cette suite ne doit
 * faire. Ce test exerce donc directement `POST/DELETE /web/dns` (les mêmes
 * appels que ferait `EditeurZone`) via l'API, à la place du clic — la partie
 * réelle testée (Designate) est identique, seule la couche navigateur manque.
 */
import { expect, test } from './fixtures'

test('création de zone, ajout puis suppression d’un enregistrement A (Designate réel)', async ({
  api,
  prefixe,
}) => {
  const domaine = `${prefixe}synelia-test.ci`

  const zone = await api.post<{ id: string; domaine: string }>('/web/dns', { domaine })
  expect(zone.domaine).toBe(domaine)

  try {
    // `POST .../enregistrements` rend la **zone** entière mise à jour
    // (`response_model=m.ZoneDns`, `web_dns/router.py`), pas l'enregistrement
    // seul — son `id` est celui de la zone. L'enregistrement créé se retrouve
    // dans `enregistrements`.
    const zoneAvecEnreg = await api.post<{
      enregistrements: Array<{ id: string; type: string; valeur: string }>
    }>(`/web/dns/${zone.id}/enregistrements`, {
      type: 'A',
      nom: '@',
      valeur: '192.0.2.10',
      ttl: 300,
    })
    const enreg = zoneAvecEnreg.enregistrements.find((e) => e.type === 'A' && e.valeur === '192.0.2.10')
    expect(enreg).toBeDefined()
    const enregId = enreg!.id

    await expect
      .poll(
        async () => {
          const z = await api.get<{ enregistrements: Array<{ id: string; valeur: string }> }>(
            `/web/dns/${zone.id}`,
          )
          return z.enregistrements.some((e) => e.id === enregId && e.valeur === '192.0.2.10')
        },
        { timeout: 15_000 },
      )
      .toBe(true)

    await api.del(`/web/dns/${zone.id}/enregistrements/${enregId}`)

    await expect
      .poll(
        async () => {
          const z = await api.get<{ enregistrements: Array<{ id: string }> }>(`/web/dns/${zone.id}`)
          return z.enregistrements.some((e) => e.id === enregId)
        },
        { timeout: 15_000 },
      )
      .toBe(false)
  } finally {
    await api.del(`/web/dns/${zone.id}`, domaine)
  }
})

test.afterEach(async ({ api, prefixe }) => {
  const domaine = `${prefixe}synelia-test.ci`
  const r = await api.get<{ donnees: Array<{ id: string; domaine: string }> }>('/web/dns?parPage=200')
  const reste = r.donnees.find((z) => z.domaine === domaine)
  if (reste) await api.del(`/web/dns/${reste.id}`, reste.domaine)
})
