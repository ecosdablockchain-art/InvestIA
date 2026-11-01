import { describe, expect, it } from 'vitest'
import { gastosPorCategoria, sugerirLimite, type LancamentoResumo } from './orcamento'
import { situacaoDoMes, totalRecorrente, vigente, type RecorrenciaResumo } from './recorrencias'
import { agruparPorDia, filtrarLancamentos, normalizar } from './busca'

const l = (valor: number, competencia: number, categoriaId: string | null = 'ali', tipo: 'gasto' | 'renda' = 'gasto', contextoId = 'p'): LancamentoResumo =>
  ({ tipo, valor, competencia, contextoId, categoriaId })

describe('gastosPorCategoria', () => {
  it('soma só gastos do mês por categoria', () => {
    const m = gastosPorCategoria([l(1000, 202611), l(500, 202611), l(300, 202611, 'tra'), l(9999, 202610), l(5000, 202611, 'sal', 'renda'), l(200, 202611, null)], 202611, { tipo: 'tudo' })
    expect(m.get('ali')).toBe(1500)
    expect(m.get('tra')).toBe(300)
    expect(m.get(null)).toBe(200)
    expect(m.has('sal')).toBe(false)
  })
})

describe('sugerirLimite', () => {
  it('média dos 3 meses anteriores, arredondada para cima em reais', () => {
    const dados = [l(60000, 202608), l(45050, 202609), l(30000, 202610), l(99999, 202611), l(1, 202607)]
    // (600 + 450,50 + 300) / 3 = 450,1666… → R$ 451
    expect(sugerirLimite(dados, 'ali', 202611)).toBe(45100)
  })
  it('ignora meses sem nenhum lançamento', () => {
    const dados = [l(30000, 202610), l(1000, 202609, 'outra')]
    // set: 0 em ali, mas o mês teve dados → conta; ago: sem dados → ignora. (0 + 300) / 2 = 150
    expect(sugerirLimite(dados, 'ali', 202611)).toBe(15000)
  })
  it('sem histórico, sem sugestão', () => {
    expect(sugerirLimite([l(1000, 202611)], 'ali', 202611)).toBeNull()
  })
  it('atravessa a virada do ano', () => {
    expect(sugerirLimite([l(30000, 202612)], 'ali', 202702)).toBe(30000)
  })
})

describe('recorrências', () => {
  const r = (id: string, extra: Partial<RecorrenciaResumo> = {}): RecorrenciaResumo =>
    ({ id, tipo: 'gasto', valor: 10000, diaDoMes: 10, inicio: 202609, fim: null, ativa: true, ...extra })

  it('respeita início, fim e pausa', () => {
    expect(vigente(r('a'), 202608)).toBe(false)
    expect(vigente(r('a'), 202611)).toBe(true)
    expect(vigente(r('a', { fim: 202610 }), 202611)).toBe(false)
    expect(vigente(r('a', { ativa: false }), 202611)).toBe(false)
  })

  it('marca o que já foi lançado no mês e ordena por data', () => {
    const s = situacaoDoMes([r('aluguel', { diaDoMes: 31 }), r('net', { diaDoMes: 5 })], [{ recorrenciaId: 'net', competencia: 202611 }, { recorrenciaId: 'aluguel', competencia: 202610 }], 202611)
    expect(s.map((x) => [x.recorrencia.id, x.data, x.lancada])).toEqual([
      ['net', '2026-11-05', true],
      ['aluguel', '2026-11-30', false],
    ])
  })

  it('totaliza gastos e entradas vigentes', () => {
    expect(totalRecorrente([r('a'), r('b', { tipo: 'renda', valor: 500000 }), r('c', { ativa: false })], 202611)).toEqual({ gastos: 10000, entradas: 500000 })
  })
})

describe('busca', () => {
  const itens = [
    { id: 1, descricao: 'iFood Pão de Açúcar', observacao: '', categoriaId: 'ali', tipo: 'gasto' as const, data: '2026-11-02' },
    { id: 2, descricao: 'Uber', observacao: 'reunião', categoriaId: 'tra', tipo: 'gasto' as const, data: '2026-11-01' },
    { id: 3, descricao: 'Salário', observacao: '', categoriaId: 'sal', tipo: 'renda' as const, data: '2026-11-02' },
  ]
  it('ignora acentos e maiúsculas', () => {
    expect(normalizar('  Pão  de AÇÚCAR ')).toBe('pao de acucar')
    expect(filtrarLancamentos(itens, { texto: 'acucar', categoriaId: 'todas', tipo: 'todos' }).map((i) => i.id)).toEqual([1])
  })
  it('busca na observação e no nome da categoria', () => {
    expect(filtrarLancamentos(itens, { texto: 'reuniao', categoriaId: 'todas', tipo: 'todos' }).map((i) => i.id)).toEqual([2])
    expect(filtrarLancamentos(itens, { texto: 'transp', categoriaId: 'todas', tipo: 'todos' }, (id) => (id === 'tra' ? 'Transporte' : '')).map((i) => i.id)).toEqual([2])
  })
  it('filtra por tipo e categoria', () => {
    expect(filtrarLancamentos(itens, { texto: '', categoriaId: 'todas', tipo: 'renda' }).map((i) => i.id)).toEqual([3])
    expect(filtrarLancamentos(itens, { texto: '', categoriaId: 'tra', tipo: 'todos' }).map((i) => i.id)).toEqual([2])
  })
  it('agrupa por dia, mais recente primeiro', () => {
    expect(agruparPorDia(itens).map((g) => [g.data, g.itens.length])).toEqual([['2026-11-02', 2], ['2026-11-01', 1]])
  })
})
