import { describe, expect, it } from 'vitest'
import { preverMeses } from './previsao'
import { alertasDeContasAtrasadas, alertasDeLimite, ordenarAlertas, type Alerta } from './alertas'
import { compararCategorias, historicoMensal, rankingCategorias } from './historico'
import type { LancamentoResumo } from './orcamento'
import type { RecorrenciaResumo } from './recorrencias'

const rec = (id: string, tipo: 'gasto' | 'renda', valor: number, extra: Partial<RecorrenciaResumo> = {}): RecorrenciaResumo =>
  ({ id, tipo, valor, diaDoMes: 5, inicio: 202601, fim: null, ativa: true, ...extra })

describe('preverMeses', () => {
  const recorrencias = [rec('sal', 'renda', 650000), rec('alu', 'gasto', 180000), rec('net', 'gasto', 5590, { fim: 202612 })]

  it('mês atual soma realizado + recorrências ainda não lançadas', () => {
    const [atual] = preverMeses({
      inicio: 202611, meses: 1, recorrencias, lancadasNoInicio: new Set(['sal', 'alu']),
      realizadoInicio: { entradas: 650000, gastos: 250000, sobra: 400000 }, saidasPrevistas: [],
    })
    expect(atual).toMatchObject({ entradas: 650000, saidas: 255590, saldo: 394410 })
  })

  it('meses seguintes usam recorrências vigentes e parcelas', () => {
    const p = preverMeses({
      inicio: 202611, meses: 3, recorrencias, lancadasNoInicio: new Set(),
      realizadoInicio: { entradas: 0, gastos: 0, sobra: 0 },
      saidasPrevistas: [{ competencia: 202701, valor: 30000, origem: 'cartao' }, { competencia: 202701, valor: 10000, origem: 'divida' }],
    })
    expect(p.map((m) => m.competencia)).toEqual([202611, 202612, 202701])
    expect(p[1]).toMatchObject({ entradas: 650000, saidas: 185590 })
    // janeiro: Netflix acabou, entram as parcelas
    expect(p[2]).toMatchObject({ entradas: 650000, saidas: 220000, inclui: { cartao: 30000, divida: 10000, recorrentes: 180000 } })
  })
})

describe('alertas', () => {
  it('limite estourado só acima de 100%', () => {
    const gastos = new Map<string | null, number>([['a', 10001], ['b', 9000], ['c', 50000]])
    const a = alertasDeLimite(gastos, [{ id: 'a', limiteMensal: 10000 }, { id: 'b', limiteMensal: 10000 }, { id: 'c', limiteMensal: null }])
    expect(a.map((x) => x.tipo === 'limite-estourado' && x.categoriaId)).toEqual(['a'])
  })

  it('conta atrasada: gasto com data passada e não lançado', () => {
    const s = [
      { recorrencia: { id: '1', descricao: 'Aluguel', tipo: 'gasto' as const, valor: 1 }, data: '2026-11-05', lancada: false },
      { recorrencia: { id: '2', descricao: 'Luz', tipo: 'gasto' as const, valor: 1 }, data: '2026-11-05', lancada: true },
      { recorrencia: { id: '3', descricao: 'Net', tipo: 'gasto' as const, valor: 1 }, data: '2026-11-10', lancada: false },
      { recorrencia: { id: '4', descricao: 'Salário', tipo: 'renda' as const, valor: 1 }, data: '2026-11-05', lancada: false },
    ]
    expect(alertasDeContasAtrasadas(s, '2026-11-10').map((a) => a.tipo === 'conta-atrasada' && a.descricao)).toEqual(['Aluguel'])
  })

  it('críticos primeiro', () => {
    const a: Alerta[] = [
      { tipo: 'meta-atrasada', gravidade: 'atencao', metaId: 'm', nome: 'Viagem' },
      { tipo: 'limite-estourado', gravidade: 'critico', categoriaId: 'x', gasto: 2, limite: 1 },
    ]
    expect(ordenarAlertas(a).map((x) => x.tipo)).toEqual(['limite-estourado', 'meta-atrasada'])
  })
})

const l = (valor: number, competencia: number, categoriaId: string | null = 'ali', tipo: 'gasto' | 'renda' = 'gasto'): LancamentoResumo =>
  ({ tipo, valor, competencia, contextoId: 'p', categoriaId })

describe('histórico', () => {
  it('meses em ordem, incluindo meses vazios', () => {
    const h = historicoMensal([l(100, 202611), l(500, 202611, null, 'renda'), l(50, 202609)], 202611, 3, { tipo: 'tudo' })
    expect(h).toEqual([
      { competencia: 202609, entradas: 0, gastos: 50, sobra: -50 },
      { competencia: 202610, entradas: 0, gastos: 0, sobra: 0 },
      { competencia: 202611, entradas: 500, gastos: 100, sobra: 400 },
    ])
  })

  it('comparativo: este mês, mês passado e média dos meses com dados', () => {
    const dados = [l(1000, 202611), l(600, 202610), l(300, 202609), l(200, 202610, 'tra'), l(9999, 202607)]
    const c = compararCategorias(dados, 202611, { tipo: 'tudo' })
    expect(c).toEqual([
      { categoriaId: 'ali', esteMes: 1000, mesPassado: 600, media3: 450 }, // (600 + 300) / 2 meses com dados
      { categoriaId: 'tra', esteMes: 0, mesPassado: 200, media3: 100 },
    ])
  })

  it('ranking junta a cauda em "outras"', () => {
    const g = new Map<string | null, number>([['a', 500], ['b', 400], ['c', 300], ['d', 200], ['e', 0]])
    expect(rankingCategorias(g, 3)).toEqual([{ categoriaId: 'a', valor: 500 }, { categoriaId: 'b', valor: 400 }, { categoriaId: 'outras', valor: 500 }])
    expect(rankingCategorias(g, 4)).toHaveLength(4)
  })
})
