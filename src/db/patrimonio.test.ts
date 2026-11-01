import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BancoFinancas } from './banco'
import { garantirDadosIniciais } from './padroes'
import { apagarMeta, registrarAporte, registrarPatrimonioDoMes, salvarMeta, salvarOperacao } from './patrimonio'

let banco: BancoFinancas
let ctx: string
beforeEach(async () => {
  banco = new BancoFinancas(`teste-${crypto.randomUUID()}`)
  await garantirDadosIniciais(banco)
  ctx = (await banco.contextos.toCollection().first())?.id ?? ''
})

describe('operações', () => {
  it('normaliza o ticker e valida', async () => {
    const o = await salvarOperacao(banco, { ticker: ' petr4f ', tipoAtivo: 'acao', lado: 'compra', quantidade: 7, preco: 3800, custos: 0, data: '2026-11-05', corretora: ' XP ' })
    expect(o).toMatchObject({ ticker: 'PETR4', corretora: 'XP' })
    await expect(salvarOperacao(banco, { ticker: 'PETR4', tipoAtivo: 'acao', lado: 'compra', quantidade: 1.5, preco: 3800, custos: 0, data: '2026-11-05', corretora: '' })).rejects.toThrow('inteiro')
    await expect(salvarOperacao(banco, { ticker: 'X', tipoAtivo: 'acao', lado: 'compra', quantidade: 1, preco: 1, custos: 0, data: '2026-11-05', corretora: '' })).rejects.toThrow('Código')
  })
})

describe('metas e aportes', () => {
  it('aporte vira lançamento de investimento ligado à meta; apagar a meta solta os aportes', async () => {
    const m = await salvarMeta(banco, { nome: 'Viagem', icone: '✈️', valorAlvo: 1000000, valorInicial: 0, prazo: '2027-06-30', prioridade: 1, concluida: false })
    const l = await registrarAporte(banco, m, 50000, '2026-11-20', ctx)
    const cat = await banco.categorias.get(l.categoriaId ?? '')
    expect(l).toMatchObject({ tipo: 'gasto', metaId: m.id, descricao: 'Aporte: Viagem' })
    expect(cat?.nome).toBe('Investimentos e trading')
    const r = await registrarAporte(banco, m, 10000, '2026-11-21', ctx, true)
    expect(r.tipo).toBe('renda')
    await apagarMeta(banco, m.id)
    expect(await banco.metas.count()).toBe(0)
    expect((await banco.lancamentos.get(l.id))?.metaId).toBeNull()
  })
})

describe('patrimônio do mês', () => {
  it('uma foto por mês, atualizada só quando muda', async () => {
    expect(await registrarPatrimonioDoMes(banco, 202611, 1000, 200)).toBe(true)
    expect(await registrarPatrimonioDoMes(banco, 202611, 1000, 200)).toBe(false)
    expect(await registrarPatrimonioDoMes(banco, 202611, 1500, 200)).toBe(true)
    expect(await banco.patrimonio.count()).toBe(1)
    expect((await banco.patrimonio.get('patrimonio:202611'))?.totalInvestido).toBe(1500)
  })
})
