#!/usr/bin/env node
/**
 * Dérive `src/lib/types.ts` ↔ `docs/api/openapi.json` — sur le modèle
 * d'`outils/openapi/index.mjs` (Node, sans dépendance).
 *
 *     bun run api:derive              # informatif, sort toujours 0
 *     CONTRAT_STRICT=1 bun run api:derive   # ou `--strict` : sort 1 si le niveau 1 est > 0
 *
 * Pas un diff textuel — les noms de `types.ts` et des schémas OpenAPI
 * diffèrent (`VM`↔`Vm`, `K8sCluster`↔`ClusterK8s`…) — mais des assertions de
 * types compilées par `tsc` sur `outils/contrat/verification.ts`, une table
 * de correspondance écrite à la main (`correspondances.ts`).
 *
 * Cinq étapes : fraîcheur du contrat, génération des types depuis
 * `openapi.json`, complétude de la table (exports non classés, paires sans
 * assertion), compilation, résumé. Le niveau 1 (clés en trop/manquantes) est
 * bloquant sous `--strict` ; le niveau 2 (assignabilité bidirectionnelle,
 * plus bruyant) reste toujours informatif à ce stade.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = join(ICI, '..', '..')
const STRICT = process.argv.includes('--strict') || process.env.CONTRAT_STRICT === '1'

const chemin = (...p) => join(RACINE, ...p)

function etape(titre) {
  console.log(`\n── ${titre} ──`)
}

// ─── 1. Fraîcheur du contrat ────────────────────────────────────────
etape('Fraîcheur du contrat')
execFileSync('node', [chemin('outils/openapi/index.mjs')], { cwd: RACINE, stdio: 'inherit' })
try {
  execFileSync('git', ['diff', '--quiet', '--', 'docs/api/openapi.json'], { cwd: RACINE })
  console.log('docs/api/openapi.json à jour.')
} catch {
  console.warn(
    "⚠ docs/api/openapi.json n'était pas régénéré depuis le générateur (le fichier vient de " +
      'changer). Le fichier régénéré est le bon — laissez-le en place et commitez-le.',
  )
}

// ─── 2. Génération des types depuis le contrat ─────────────────────
etape('Génération (openapi-typescript@7.13.0)')
const GENERE = chemin('outils/contrat/contrat.genere.d.ts')
execFileSync(
  'bunx',
  ['openapi-typescript@7.13.0', chemin('docs/api/openapi.json'), '-o', GENERE],
  { cwd: RACINE, stdio: 'inherit' },
)

// ─── 3. Complétude de la table ──────────────────────────────────────
etape('Complétude de la table')
const srcTypes = readFileSync(chemin('src/lib/types.ts'), 'utf8')
const srcCorres = readFileSync(chemin('outils/contrat/correspondances.ts'), 'utf8')
const srcVerif = readFileSync(chemin('outils/contrat/verification.ts'), 'utf8')

const exportsTypes = [...srcTypes.matchAll(/^export (?:interface|type) ([A-Za-z0-9_]+)/gm)].map(
  (m) => m[1],
)
const corpsCorres = srcCorres.slice(
  srcCorres.indexOf('CORRESPONDANCES = {'),
  srcCorres.indexOf('} as const'),
)
const paires = [...corpsCorres.matchAll(/^\s*([A-Za-z0-9_]+):\s*(null|'([A-Za-z0-9_]+)')/gm)].map(
  (m) => [m[1], m[3] ?? null],
)
const clesCorres = new Set(paires.map(([k]) => k))
const nonClasses = exportsTypes.filter((e) => !clesCorres.has(e))

const pairesNonNulles = paires.filter(([, s]) => s !== null)
const assertionsPresentes = new Set(
  [...srcVerif.matchAll(/^type ([A-Za-z0-9_]+)_([123]) =/gm)].map((m) => `${m[1]}_${m[2]}`),
)
const assertionsManquantes = []
for (const [k] of pairesNonNulles) {
  for (const n of [1, 2, 3]) {
    if (!assertionsPresentes.has(`${k}_${n}`)) assertionsManquantes.push(`${k}_${n}`)
  }
}

if (nonClasses.length > 0) {
  console.log(`Non classés dans correspondances.ts (${nonClasses.length}) : ${nonClasses.join(', ')}`)
} else {
  console.log('Tous les exports de types.ts sont classés.')
}
if (assertionsManquantes.length > 0) {
  console.log(`Assertions manquantes dans verification.ts : ${assertionsManquantes.join(', ')}`)
} else {
  console.log('Chaque paire a ses trois lignes dans verification.ts.')
}

// ─── 4. Compilation ─────────────────────────────────────────────────
etape('Compilation (tsc -p tsconfig.contrat.json)')
let sortieTsc = ''
try {
  execFileSync('bunx', ['tsc', '-p', chemin('tsconfig.contrat.json'), '--pretty', 'false'], {
    cwd: RACINE,
  })
} catch (e) {
  sortieTsc = String(e.stdout ?? '')
}

// Ligne de verification.ts → { paire, niveau }.
const ligneVersPaire = new Map()
{
  const lignes = srcVerif.split('\n')
  lignes.forEach((ligne, i) => {
    const m = /^type ([A-Za-z0-9_]+)_([123]) =/.exec(ligne)
    if (m) ligneVersPaire.set(i + 1, { paire: m[1], niveau: m[2] === '3' ? 2 : 1 })
  })
}

const REGEX_ERREUR = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm
const lignesRapport = []
let m
while ((m = REGEX_ERREUR.exec(sortieTsc))) {
  const [, fichier, ligneStr, , code, message] = m
  const ligne = Number(ligneStr)
  const rel = fichier.replace(RACINE + '/', '')
  if (rel.endsWith('verification.ts')) {
    const info = ligneVersPaire.get(ligne)
    if (info) {
      lignesRapport.push({ paire: info.paire, niveau: info.niveau, detail: `${code}: ${message}` })
      continue
    }
  }
  // Erreur hors verification.ts (ex. contrat.genere.d.ts absent, faute de frappe dans
  // correspondances.ts) : on la garde, sans paire attribuée.
  lignesRapport.push({ paire: rel, niveau: 0, detail: `${code}: ${message}` })
}

const niveau1 = lignesRapport.filter((l) => l.niveau === 1)
const niveau2 = lignesRapport.filter((l) => l.niveau === 2)
const autres = lignesRapport.filter((l) => l.niveau === 0)

if (lignesRapport.length === 0) {
  console.log(`Aucune dérive : les ${pairesNonNulles.length * 3} assertions compilent.`)
} else {
  console.log('\npaire | niveau | détail')
  console.log('---|---|---')
  for (const l of [...autres, ...niveau1, ...niveau2]) {
    const niveauTxt = l.niveau === 0 ? '—' : l.niveau
    console.log(`${l.paire} | ${niveauTxt} | ${l.detail}`)
  }
}

// ─── 5. Résumé et sortie ─────────────────────────────────────────────
etape('Résumé')
const nPaires = pairesNonNulles.length
const resume = `${nPaires} paires · ${niveau1.length + autres.length} en dérive (niveau 1) · ${niveau2.length} incompatibles (niveau 2, informatif)`
console.log(resume)
if (niveau2.length > 0 && !STRICT) {
  console.log('(niveau 2 toujours informatif à ce stade, cf. docs/api/README.md)')
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `\n## Dérive du contrat\n\n${resume}\n\n${
      lignesRapport.length > 0
        ? `| paire | niveau | détail |\n|---|---|---|\n${lignesRapport
            .map((l) => `| ${l.paire} | ${l.niveau || '—'} | ${l.detail.replace(/\|/g, '\\|')} |`)
            .join('\n')}\n`
        : 'Aucune dérive.\n'
    }`,
  )
}

if (STRICT && niveau1.length + autres.length > 0) {
  console.error('\n--strict : dérive de niveau 1 présente, sortie 1.')
  process.exit(1)
}
process.exit(0)
