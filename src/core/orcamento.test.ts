import { describe, expect, it } from 'vitest'
import { nivelLimite, patrimonioLiquido, resumirMes, type LancamentoResumo } from './orcamento'

const l = (tipo: 'gasto' | 'renda', valor: number, competencia = 202611, contextoId = 'p'): LancamentoResumo => ({
  tipo, valor, competencia, contextoId, categoriaId: null,
})

describe('resumirMes', () => {
  const dados = [l('renda', 500000), l('gasto', 120050), l('gasto', 30000, 202610), l('renda', 200000, 202611, 'mc'), l('gasto', 50000, 202611, 'mc')]

  it('soma só o mês e o contexto pedidos', () => {
    expect(resumirMes(dados, 202611, { tipo: 'contexto', id: 'p' })).toEqual({ entradas: 500000, gastos: 120050, sobra: 379950 })
  })
  it('visão tudo junta os contextos', () => {
    expect(resumirMes(dados, 202611, { tipo: 'tudo' })).toEqual({ entradas: 700000, gastos: 170050, sobra: 529950 })
  })
  it('sobra pode ser negativa', () => {
    expect(resumirMes([l('gasto', 100)], 202611, { tipo: 'tudo' }).sobra).toBe(-100)
  })
})

describe('patrimonioLiquido', () => {
  it('investido menos dívidas', () => {
    expect(patrimonioLiquido([{ valorAtual: 1000000 }, { valorAtual: 50000 }], [{ saldo: 300000 }])).toBe(750000)
  })
})

describe('nivelLimite', () => {
  it.each([
    [7900, 10000, 'ok'],
    [8000, 10000, 'atencao'],
    [10000, 10000, 'atencao'],
    [10001, 10000, 'estourado'],
    [0, 0, 'ok'],
    [1, 0, 'estourado'],
  ] as const)('%i de %i → %s', (gasto, limite, nivel) => {
    expect(nivelLimite(gasto, limite).nivel).toBe(nivel)
  })
})
