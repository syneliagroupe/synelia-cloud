/**
 * Pose `SYNELIA_TEST_PREFIX` une fois pour tout le run (avant que Playwright ne
 * lance les workers, qui héritent de `process.env`) : toutes les specs d'un
 * même run doivent partager le même préfixe pour que `globalTeardown` (dans
 * `fixtures.ts`) retrouve tout ce qui a pu être mal nettoyé.
 */
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export default function globalSetup(): void {
  if (process.env.SYNELIA_TEST_PREFIX) return
  const d = new Date()
  process.env.SYNELIA_TEST_PREFIX = `t${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}-`
}
