import { describe, expect, it } from 'vitest'
import { gerarInsights, type EntradaInsights } from './insights'

const mes = (competencia: number, entradas: number, gastos: number) => ({ competencia, entradas, gastos, sobra: entradas - gastos })
const tres = (entradas: number, gastos: number) => [mes(202608, entradas, gastos), mes(202609, entradas, gastos), mes(202610, entradas, gastos)]

function base(p: Partial<EntradaInsights> = {}): EntradaInsights {
  return {
    competencia: 202611, meses: tres(600000, 500000), mesAtual: mes(202611, 0, 0),
    categorias: [], comparativo: [], gastosMesAtual: new Map(), gastosFixos: 0,
    dividas: [], faturasAbertas: 0, parcelasProximoMes: 0, reserva: 0, investido: 0,
    perfil: 'moderado', riscoAcimaDoPerfil: false, temNegocio: false, metas: [], ...p,
  }
}
const passo = (r: ReturnType<typeof gerarInsights>, id: string) => r.plano.find((p) => p.id === id)

describe('insights', () => {
  it('sem lançamentos: pede para começar a lançar', () => {
    const r = gerarInsights(base({ meses: tres(0, 0) }))
    expect(r.plano).toEqual([])
    expect(r.insights[0]?.id).toBe('sem-dados')
  })

  it('usa o mês atual quando ainda não há mês completo, avisando que é parcial', () => {
    const r = gerarInsights(base({ meses: tres(0, 0), mesAtual: mes(202611, 300000, 100000) }))
    expect(r.numeros.parcial).toBe(true)
    expect(r.numeros.sobra).toBe(200000)
    expect(r.insights.some((i) => i.id === 'parcial')).toBe(true)
  })

  it('gastando mais do que ganha: primeiro passo é equilibrar, com o corte necessário', () => {
    const r = gerarInsights(base({ meses: tres(500000, 550000) }))
    const p = passo(r, 'equilibrar')!
    expect(p.estado).toBe('agora')
    expect(p.texto).toContain('R$ 500,00 a mais')
    expect(p.texto).toContain('R$ 1.000,00') // 500 de déficit + 10% de 5.000
    expect(r.plano.filter((x) => x.estado === 'agora')).toHaveLength(1)
  })

  it('dívida cara sem reserva: mini-reserva agora, depois avalanche com economia de juros', () => {
    const r = gerarInsights(base({
      dividas: [
        { id: 'a', nome: 'Empréstimo', saldo: 1000000, jurosMensal: 0.03, parcela: 50000, origem: 'manual' },
        { id: 'b', nome: 'Financiamento', saldo: 5000000, jurosMensal: 0.008, parcela: 100000, origem: 'manual' },
      ],
    }))
    expect(passo(r, 'equilibrar')!.estado).toBe('feito')
    expect(passo(r, 'mini-reserva')!.estado).toBe('agora')
    expect(passo(r, 'mini-reserva')!.texto).toContain('R$ 5.000,00')
    const d = passo(r, 'dividas')!
    expect(d.estado).toBe('depois')
    expect(d.texto).toMatch(/^Você tem R\$ 10\.000,00 em dívidas/)
    expect(d.texto).toContain('Empréstimo (3% a.m.)')
    expect(d.texto).not.toContain('Financiamento (')
    expect(d.texto).toMatch(/economiza R\$ [\d.]+,\d\d em juros/)
  })

  it('tudo em ordem: reserva feita, próximo passo é investir; elogia a taxa de poupança', () => {
    const r = gerarInsights(base({ meses: tres(1000000, 700000), reserva: 700000 * 6 }))
    expect(passo(r, 'reserva')!.estado).toBe('feito')
    expect(passo(r, 'investir')!.estado).toBe('agora')
    expect(r.insights.find((i) => i.id === 'poupanca')?.tom).toBe('positivo')
  })

  it('reserva: alvo de 6 meses, quanto falta e em quantos meses chega', () => {
    const r = gerarInsights(base({ reserva: 1000000 }))
    expect(r.numeros.reservaAlvo).toBe(3000000)
    const p = passo(r, 'reserva')!
    expect(p.estado).toBe('agora')
    expect(p.texto).toContain('faltam R$ 20.000,00')
    expect(p.texto).toContain('R$ 1.000,00 por mês')
    expect(p.texto).toContain('20 meses')
  })

  it('renda variável ou negócio próprio: reserva de 12 meses', () => {
    const variavel = gerarInsights(base({ meses: [mes(202608, 300000, 400000), mes(202609, 900000, 400000), mes(202610, 600000, 400000)] }))
    expect(variavel.numeros.rendaVariavel).toBe(true)
    expect(variavel.numeros.reservaAlvoMeses).toBe(12)
    expect(gerarInsights(base({ temNegocio: true })).numeros.reservaAlvoMeses).toBe(12)
    expect(gerarInsights(base()).numeros.reservaAlvoMeses).toBe(6)
  })

  it('aponta a categoria que mais cresceu e sugere limite', () => {
    const r = gerarInsights(base({
      categorias: [{ id: 'd', nome: 'Delivery', limiteMensal: null }, { id: 'm', nome: 'Mercado', limiteMensal: null }],
      comparativo: [
        { categoriaId: 'd', esteMes: 90000, mesPassado: 90000, media3: 50000 },
        { categoriaId: 'm', esteMes: 105000, mesPassado: 105000, media3: 100000 },
      ],
    }))
    const i = r.insights.find((x) => x.id === 'subiu:d')!
    expect(i.titulo).toBe('Delivery subiu 80%')
    expect(i.texto).toContain('libera R$ 400,00')
    expect(r.insights.some((x) => x.id === 'subiu:m')).toBe(false) // só 5%
    expect(r.insights.find((x) => x.id === 'sem-limite')?.titulo).toContain('Mercado')
  })

  it('rotativo e limite estourado aparecem primeiro, como críticos', () => {
    const r = gerarInsights(base({
      categorias: [{ id: 'l', nome: 'Lazer', limiteMensal: 30000 }],
      gastosMesAtual: new Map([['l', 45000]]),
      dividas: [{ id: 'r', nome: 'Rotativo', saldo: 200000, jurosMensal: 0.14, parcela: 0, origem: 'rotativo' }],
    }))
    expect(r.insights[0]?.tom).toBe('critico')
    expect(r.insights.map((i) => i.id)).toEqual(expect.arrayContaining(['rotativo', 'limite:l']))
  })

  it('parcelas acima de 30% da renda: alerta de comprometimento', () => {
    const r = gerarInsights(base({ dividas: [{ id: 'f', nome: 'Carro', saldo: 3000000, jurosMensal: 0.01, parcela: 200000, origem: 'manual' }] }))
    expect(r.insights.find((i) => i.id === 'comprometimento')?.titulo).toBe('33% da renda vai para parcelas de dívidas')
    expect(passo(r, 'dividas')!.estado).toBe('feito') // dívida barata
  })
})
