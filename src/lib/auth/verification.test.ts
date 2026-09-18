import { describe, expect, test } from 'bun:test'

import {
  estEtatVerification,
  nettoyerCode,
  urlVerification,
} from './verification'

describe('vérification email', () => {
  test('état vs session', () => {
    expect(estEtatVerification({ email: 'a@b.ci', expire: 'x', essaisRestants: 5 })).toBe(true)
    expect(estEtatVerification({ accessToken: 'jwt', utilisateur: {} })).toBe(false)
    expect(estEtatVerification({})).toBe(false)
  })

  test('nettoyage du code', () => {
    expect(nettoyerCode('123402')).toBe('123402')
    expect(nettoyerCode('12 34-02ab')).toBe('123402')
    expect(nettoyerCode('123456789')).toBe('123456')
    expect(nettoyerCode('')).toBe('')
  })

  test('URL de vérification', () => {
    expect(urlVerification('a@b.ci')).toBe('/signup/verifier?email=a%40b.ci')
  })
})
