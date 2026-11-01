import { describe, expect, it } from 'vitest'
import { aplicarTecla } from './CampoValor'

describe('aplicarTecla', () => {
  it('dígitos entram pela direita', () => {
    let v = 0
    for (const d of '4590') v = aplicarTecla(v, 'insertText', d)
    expect(v).toBe(4590)
  })
  it('apagar remove o último dígito', () => {
    expect(aplicarTecla(4590, 'deleteContentBackward', null)).toBe(459)
    expect(aplicarTecla(5, 'deleteContentBackward', null)).toBe(0)
  })
  it('ignora letras e símbolos', () => {
    expect(aplicarTecla(12, 'insertText', ',')).toBe(12)
    expect(aplicarTecla(12, 'insertText', 'a')).toBe(12)
  })
  it('colar entende formato brasileiro', () => {
    expect(aplicarTecla(0, 'insertFromPaste', 'R$ 1.234,56')).toBe(123456)
    expect(aplicarTecla(99, 'insertFromPaste', 'abc')).toBe(99)
  })
  it('não passa do máximo', () => {
    expect(aplicarTecla(99_999_999_999, 'insertText', '9')).toBe(99_999_999_999)
  })
})
