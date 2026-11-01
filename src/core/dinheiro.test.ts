import { describe, expect, it } from 'vitest'
import { formatarEixo, dividirEmPartes, dividirPorPesos, formatarBRL, lerValor, multiplicar, somar } from './dinheiro'

describe('lerValor', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1,234.56', 123456],
    ['R$ 12,30', 1230],
    ['-12,30', -1230],
    ['−12,30', -1230],
    ['(12,30)', -1230],
    ['12,30-', -1230],
    ['12,3', 1230],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['0,01', 1],
    ['50', 5000],
  ])('%s → %i', (texto, esperado) => {
    expect(lerValor(texto)).toBe(esperado)
  })

  it.each(['', 'abc', 'R$', '12a'])('rejeita %j', (t) => {
    expect(lerValor(t)).toBeNull()
  })
})

describe('formatarBRL', () => {
  it('formata em reais', () => {
    expect(formatarBRL(123456)).toBe('R$ 1.234,56')
    expect(formatarBRL(5)).toBe('R$ 0,05')
    expect(formatarBRL(-1230)).toBe('-R$ 12,30')
  })
})

describe('dividirEmPartes', () => {
  it('não perde centavos', () => {
    expect(dividirEmPartes(10000, 3)).toEqual([3334, 3333, 3333])
    expect(somar(dividirEmPartes(99999, 7))).toBe(99999)
    expect(dividirEmPartes(-100, 3)).toEqual([-34, -33, -33])
  })
  it('rejeita partes inválidas', () => {
    expect(() => dividirEmPartes(100, 0)).toThrow()
  })
})

describe('dividirPorPesos', () => {
  it('respeita os pesos e fecha o total', () => {
    expect(dividirPorPesos(10000, [60, 40])).toEqual([6000, 4000])
    const partes = dividirPorPesos(10001, [1, 1, 1])
    expect(somar(partes)).toBe(10001)
    expect(Math.max(...partes) - Math.min(...partes)).toBeLessThanOrEqual(1)
  })
  it('funciona com negativos', () => {
    expect(somar(dividirPorPesos(-10001, [50, 50]))).toBe(-10001)
  })
})

describe('multiplicar', () => {
  it('arredonda para o centavo', () => {
    expect(multiplicar(1000, 0.0299)).toBe(30)
    expect(multiplicar(-1005, 0.5)).toBe(-503)
  })
})

describe('formatarEixo', () => {
  it('encurta valores grandes', () => {
    expect(formatarEixo(0)).toBe('0')
    expect(formatarEixo(85000)).toBe('850')
    expect(formatarEixo(350000)).toBe('3,5 mil')
    expect(formatarEixo(120000000)).toBe('1,2 mi')
    expect(formatarEixo(-200000)).toBe('−2 mil')
  })
})
