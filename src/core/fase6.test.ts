import { describe, expect, it } from 'vitest'
import { compor, competenciaDaFatura, datasDaFatura, diasParaVencer, parcelasDe, restanteDoParcelado, statusDaFatura } from './credito'
import { compararExtra, jurosAnual, ordenarAvalanche, simularQuitacao } from './dividas'

const cartao = { id: 'c', diaFechamento: 3, diaVencimento: 10 } // fecha dia 3, vence dia 10 do mesmo mês
const virada = { id: 'v', diaFechamento: 28, diaVencimento: 5 } // fecha dia 28, vence dia 5 do mês seguinte

describe('em qual fatura cai a compra', () => {
  it('antes do fechamento: fatura deste mês; no dia ou depois: próxima', () => {
    expect(competenciaDaFatura('2026-11-02', cartao)).toBe(202611)
    expect(competenciaDaFatura('2026-11-03', cartao)).toBe(202612)
    expect(competenciaDaFatura('2026-12-20', cartao)).toBe(202701)
  })
  it('cartão que fecha no fim do mês e vence no começo do seguinte', () => {
    expect(competenciaDaFatura('2026-11-27', virada)).toBe(202612)
    expect(competenciaDaFatura('2026-11-28', virada)).toBe(202701)
  })
  it('datas de fechamento e vencimento', () => {
    expect(datasDaFatura(202612, virada)).toEqual({ fechamento: '2026-11-28', vencimento: '2026-12-05' })
    expect(datasDaFatura(202702, { diaFechamento: 31, diaVencimento: 8 })).toEqual({ fechamento: '2027-01-31', vencimento: '2027-02-08' })
  })
})

describe('situação da fatura', () => {
  it.each([
    ['2026-11-20', 202611, false, 'vencida'],
    ['2026-11-20', 202611, true, 'paga'],
    ['2026-11-05', 202611, false, 'fechada'],
    ['2026-11-20', 202612, false, 'aberta'],
    ['2026-11-20', 202701, false, 'futura'],
    ['2026-11-02', 202611, false, 'aberta'],
  ] as const)('hoje %s, fatura %i (paga=%s) → %s', (hoje, comp, paga, st) => {
    expect(statusDaFatura(comp, cartao, paga, hoje)).toBe(st)
  })
  it('dias para vencer', () => expect(diasParaVencer(202611, cartao, '2026-11-07')).toBe(3))
})

describe('parcelados', () => {
  const p = { id: 'p', cartaoId: 'c', descricao: 'TV', valorTotal: 100000, numeroParcelas: 3, primeiraCompetencia: 202611 }
  it('divide sem perder centavos e projeta nos meses', () => {
    expect(parcelasDe(p).map((x) => [x.competencia, x.numero, x.valor])).toEqual([[202611, 1, 33334], [202612, 2, 33333], [202701, 3, 33333]])
  })
  it('quanto falta a partir de um mês', () => {
    expect(restanteDoParcelado(p, 202612)).toEqual({ valor: 66666, parcelas: 2 })
    expect(restanteDoParcelado(p, 202702)).toEqual({ valor: 0, parcelas: 0 })
  })
})

describe('valor da fatura', () => {
  const parcelados = [{ id: 'p', cartaoId: 'c', descricao: 'TV', valorTotal: 60000, numeroParcelas: 3, primeiraCompetencia: 202612 }]
  const compras = [
    { data: '2026-11-05', valor: 10000, cartaoId: 'c', tipo: 'gasto' as const },
    { data: '2026-11-20', valor: 2500, cartaoId: 'c', tipo: 'renda' as const }, // estorno
    { data: '2026-11-21', valor: 99999, cartaoId: 'outro', tipo: 'gasto' as const },
    { data: '2026-11-22', valor: 99999, cartaoId: null, tipo: 'gasto' as const },
    { data: '2026-11-02', valor: 4000, cartaoId: 'c', tipo: 'gasto' as const }, // fatura de novembro
  ]
  it('projeta compras do ciclo + parcelas', () => {
    expect(compor(cartao, 202612, compras, parcelados, null)).toEqual({ compras: 7500, parcelas: 20000, projetado: 27500, informado: null, valor: 27500 })
  })
  it('valor informado vence a projeção', () => {
    expect(compor(cartao, 202612, compras, parcelados, 30000).valor).toBe(30000)
  })
})

describe('dívidas', () => {
  it('juros ao ano compostos', () => {
    expect(jurosAnual(0.15)).toBeCloseTo(4.3503, 3)
    expect(jurosAnual(0.01)).toBeCloseTo(0.1268, 3)
  })
  it('avalanche: maior juros primeiro', () => {
    const d = ordenarAvalanche([
      { id: 'a', nome: 'Empréstimo', saldo: 500000, jurosMensal: 0.02, parcela: 30000 },
      { id: 'b', nome: 'Rotativo', saldo: 100000, jurosMensal: 0.15, parcela: 0 },
      { id: 'c', nome: 'Quitada', saldo: 0, jurosMensal: 0.2, parcela: 0 },
    ])
    expect(d.map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('sem juros: quita em saldo / parcela meses', () => {
    const r = simularQuitacao([{ id: 'a', nome: 'A', saldo: 100000, jurosMensal: 0, parcela: 25000 }])
    expect(r).toMatchObject({ quita: true, meses: 4, jurosTotal: 0, pagoTotal: 100000 })
  })
  it('juros maiores que a parcela: não quita', () => {
    const r = simularQuitacao([{ id: 'a', nome: 'A', saldo: 100000, jurosMensal: 0.15, parcela: 10000 }])
    expect(r.quita).toBe(false)
  })
  it('pagar a mais quita antes e economiza juros; extra vai para o maior juros', () => {
    const dividas = [
      { id: 'emp', nome: 'Empréstimo', saldo: 500000, jurosMensal: 0.02, parcela: 20000 },
      { id: 'cheque', nome: 'Cheque especial', saldo: 100000, jurosMensal: 0.08, parcela: 10000 },
    ]
    const c = compararExtra(dividas, 30000)
    expect(c.base.quita).toBe(true)
    expect(c.comExtra.meses).toBeLessThan(c.base.meses)
    expect(c.economiaJuros).toBeGreaterThan(0)
    expect(c.comExtra.ordem[0]?.id).toBe('cheque')
    // pagou exatamente o saldo + juros
    expect(c.comExtra.pagoTotal).toBe(600000 + c.comExtra.jurosTotal)
  })
  it('dívida quitada libera a parcela para a próxima', () => {
    const r = simularQuitacao([
      { id: 'a', nome: 'A', saldo: 10000, jurosMensal: 0, parcela: 10000 },
      { id: 'b', nome: 'B', saldo: 30000, jurosMensal: 0, parcela: 10000 },
    ])
    expect(r.meses).toBe(2) // mês 1: A quita e B paga 10k; mês 2: B recebe 20k
    expect(r.porMes).toEqual([20000, 20000])
  })
})
