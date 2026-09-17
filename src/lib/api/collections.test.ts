import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REGISTRE_COLLECTIONS, champConfirmation, endpointDe } from './collections'

describe('endpointDe', () => {
  test('clé directe du registre', () => {
    expect(endpointDe('vms')).toBe('/vms')
  })

  test('motif snapshots-<vmId>, avec encodage', () => {
    expect(endpointDe('snapshots-vm 1')).toBe('/vms/vm%201/instantanes')
  })

  test('services-projet (littéral) reste local — pas un identifiant de projet', () => {
    expect(endpointDe('services-projet')).toBeUndefined()
  })

  test('motifs à suffixe nichés', () => {
    expect(endpointDe('services-p1')).toBe('/projets/p1/services')
    expect(endpointDe('variables-p1')).toBe('/projets/p1/variables')
    expect(endpointDe('elevations-u1')).toBe('/admin/equipe/u1/elevation')
  })

  test('clé sans endpoint (motif inconnu ou collection non branchée)', () => {
    expect(endpointDe('objets-x')).toBeUndefined()
    expect(endpointDe('inconnue')).toBeUndefined()
  })
})

describe('champConfirmation', () => {
  test('exceptions relevées des exiger_confirmation() du backend', () => {
    expect(champConfirmation('espaces')).toBe('code')
    expect(champConfirmation('ips')).toBe('adresse')
    expect(champConfirmation('regles-alertes')).toBe('cible')
    expect(champConfirmation('points-restauration')).toBe('resourceNom')
  })

  test('défaut : nom', () => {
    expect(champConfirmation('vms')).toBe('nom')
    expect(champConfirmation('inconnue')).toBe('nom')
  })
})

// ─── Registre ↔ contrat ─────────────────────────────────────────────
//
// Une entrée du registre qui pointe sur une route absente du contrat est une
// collection qui restera silencieusement en graine même en mode API — le
// bug le plus facile à introduire en ajoutant une collection sans vérifier
// à la main que le backend la sert déjà.

interface Contrat {
  paths: Record<string, Record<string, unknown>>
}

const contrat: Contrat = JSON.parse(
  readFileSync(join(import.meta.dir, '..', '..', '..', 'docs', 'api', 'openapi.json'), 'utf8'),
)
const cheminsAvecGet = Object.keys(contrat.paths).filter((c) => 'get' in contrat.paths[c])

describe('registre ↔ contrat', () => {
  test.each(Object.entries(REGISTRE_COLLECTIONS))('%s → %s a un GET dans le contrat', (_nom, endpoint) => {
    const trouve = cheminsAvecGet.some((chemin) => chemin === endpoint || chemin.startsWith(`${endpoint}/`))
    expect(trouve).toBe(true)
  })
})
