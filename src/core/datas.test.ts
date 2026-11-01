import { describe, expect, it } from 'vitest'
import {
  competenciaDe, dataNaCompetencia, diasEntre, diferencaMeses, ehDataISO, formatarData,
  hojeISO, nomeCompetencia, nomeCompetenciaCurto, somarMeses,
} from './datas'

describe('hojeISO', () => {
  it('usa o fuso de São Paulo', () => {
    // 01/11/2026 02:30 UTC ainda é 31/10 às 23:30 em São Paulo
    expect(hojeISO(new Date('2026-11-01T02:30:00Z'))).toBe('2026-10-31')
    expect(hojeISO(new Date('2026-11-01T03:30:00Z'))).toBe('2026-11-01')
  })
})

describe('competência', () => {
  it('converte e soma meses atravessando o ano', () => {
    expect(competenciaDe('2026-11-15')).toBe(202611)
    expect(somarMeses(202611, 2)).toBe(202701)
    expect(somarMeses(202601, -1)).toBe(202512)
    expect(diferencaMeses(202611, 202704)).toBe(5)
  })
  it('ajusta o dia ao tamanho do mês', () => {
    expect(dataNaCompetencia(202702, 31)).toBe('2027-02-28')
    expect(dataNaCompetencia(202802, 31)).toBe('2028-02-29')
    expect(dataNaCompetencia(202611, 5)).toBe('2026-11-05')
  })
  it('dá nomes em português', () => {
    expect(nomeCompetencia(202603)).toBe('março de 2026')
    expect(nomeCompetenciaCurto(202611)).toBe('nov/26')
  })
})

describe('utilidades', () => {
  it('valida datas', () => {
    expect(ehDataISO('2026-02-29')).toBe(false)
    expect(ehDataISO('2028-02-29')).toBe(true)
    expect(ehDataISO('2026-13-01')).toBe(false)
  })
  it('conta dias e formata', () => {
    expect(diasEntre('2026-10-30', '2026-11-02')).toBe(3)
    expect(formatarData('2026-11-01')).toBe('01/11/2026')
  })
})
