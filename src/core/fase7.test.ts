import { describe, expect, it } from 'vitest'
import { alocacao, avaliarPosicoes, calcularPosicoes, mesesDeReserva, riscoDaCarteira, situacaoReserva, type OperacaoResumo } from './carteira'
import { situacaoMeta, type Aporte } from './metas'

const op = (ticker: string, lado: 'compra' | 'venda', quantidade: number, preco: number, data: string, custos = 0, tipoAtivo: OperacaoResumo['tipoAtivo'] = 'acao'): OperacaoResumo =>
  ({ id: `${ticker}${data}${lado}`, ticker, tipoAtivo, lado, quantidade, preco, custos, data })

describe('carteira', () => {
  it('preço médio com taxas e resultado realizado na venda', () => {
    const [p] = calcularPosicoes([
      op('PETR4', 'compra', 100, 3000, '2026-01-10', 500), // 3.000,00 + 5,00
      op('petr4', 'compra', 100, 4000, '2026-02-10', 500), // 4.000,00 + 5,00
      op('PETR4', 'venda', 50, 4500, '2026-03-10', 300),
    ])
    // custo 7.010,00 / 200 = 35,05; vende 50: custo saída 1.752,50; recebe 2.250,00 − 3,00 → +494,50
    expect(p).toMatchObject({ ticker: 'PETR4', quantidade: 150, custoTotal: 525750, precoMedio: 3505, resultadoRealizado: 49450 })
  })
  it('zera o preço médio quando vende tudo e recomeça', () => {
    const [p] = calcularPosicoes([op('X', 'compra', 10, 1000, '2026-01-01'), op('X', 'venda', 10, 1200, '2026-01-02'), op('X', 'compra', 10, 2000, '2026-01-03')])
    expect(p).toMatchObject({ quantidade: 10, precoMedio: 2000, resultadoRealizado: 2000 })
  })
  it('venda maior que a posição é sinalizada', () => {
    expect(calcularPosicoes([op('X', 'venda', 5, 100, '2026-01-01')])[0]?.vendaDescoberta).toBe(true)
  })
  it('avalia com cotação, resultado e peso; sem cotação usa o custo', () => {
    const pos = calcularPosicoes([op('A', 'compra', 10, 1000, '2026-01-01'), op('B', 'compra', 10, 3000, '2026-01-01', 0, 'fii')])
    const av = avaliarPosicoes(pos, new Map([['A', 1500]]))
    expect(av.map((p) => [p.ticker, p.valorAtual, p.resultado, p.resultadoPct, Math.round(p.peso * 100)])).toEqual([
      ['B', 30000, 0, null, 67],
      ['A', 15000, 5000, 0.5, 33],
    ])
  })
})

describe('alocação e risco', () => {
  it('agrupa por classe e calcula o risco ponderado', () => {
    const a = alocacao([{ classe: 'reserva', valor: 60000 }, { classe: 'acao', valor: 20000 }, { classe: 'reserva', valor: 20000 }, { classe: 'cripto', valor: 0 }])
    expect(a.map((x) => [x.classe, x.fracao])).toEqual([['reserva', 0.8], ['acao', 0.2]])
    const r = riscoDaCarteira(a, 'conservador')
    expect(r?.nota).toBeCloseTo(1.6)
    expect(r).toMatchObject({ nivel: 'Baixo', perfilDaCarteira: 'conservador', acimaDoPerfil: false })
    expect(riscoDaCarteira([{ classe: 'cripto', fracao: 1 }], 'moderado')).toMatchObject({ nivel: 'Muito alto', acimaDoPerfil: true })
  })
})

describe('reserva', () => {
  it('meses cobertos e situação', () => {
    expect(mesesDeReserva(1800000, 600000)).toBe(3)
    expect(situacaoReserva(mesesDeReserva(1000000, 600000))).toBe('baixa')
    expect(situacaoReserva(6.5)).toBe('otima')
    expect(mesesDeReserva(100, 0)).toBeNull()
  })
})

describe('metas', () => {
  const meta = { id: 'm', valorAlvo: 1200000, valorInicial: 200000, prazo: '2027-04-30', concluida: false }
  it('aporte necessário até o prazo, contando o mês atual', () => {
    const s = situacaoMeta(meta, [], '2026-11-20')
    // faltam 10.000,00 em 6 meses (nov a abr) → 1.666,67
    expect(s).toMatchObject({ atual: 200000, falta: 1000000, mesesRestantes: 6, aporteNecessario: 166667, estado: 'em-risco' })
  })
  it('aportes contam e retiradas abatem; média dos últimos 3 meses define "em dia"', () => {
    const aportes: Aporte[] = [202608, 202609, 202610].map((competencia) => ({ metaId: 'm', valor: 200000, competencia, tipo: 'gasto' as const }))
    aportes.push({ metaId: 'm', valor: 50000, competencia: 202611, tipo: 'renda' })
    aportes.push({ metaId: 'outra', valor: 999999, competencia: 202610, tipo: 'gasto' })
    const s = situacaoMeta(meta, aportes, '2026-11-20')
    expect(s.atual).toBe(200000 + 600000 - 50000)
    expect(s.estado).toBe('em-dia')
  })
  it('atrasada, concluída e sem prazo', () => {
    expect(situacaoMeta(meta, [], '2027-05-01').estado).toBe('atrasada')
    expect(situacaoMeta({ ...meta, valorInicial: 1200000 }, [], '2026-11-20')).toMatchObject({ estado: 'concluida', progresso: 1 })
    expect(situacaoMeta({ ...meta, prazo: null }, [], '2026-11-20').estado).toBe('sem-prazo')
  })
})
