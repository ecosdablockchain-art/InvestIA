import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BancoFinancas } from './banco'
import { garantirDadosIniciais } from './padroes'
import {
  apagarLancamento, definirLimite, encerrarRecorrencia, lancarRecorrencia, restaurarLancamento, salvarLancamento,
  type DadosLancamento,
} from './repositorio'

let banco: BancoFinancas
let ctx: string
let alimentacao: string

beforeEach(async () => {
  banco = new BancoFinancas(`teste-${crypto.randomUUID()}`)
  await garantirDadosIniciais(banco)
  ctx = (await banco.contextos.toCollection().first())?.id ?? ''
  alimentacao = (await banco.categorias.filter((c) => c.nome === 'Alimentação').first())?.id ?? ''
})

const dados = (extra: Partial<DadosLancamento> = {}): DadosLancamento => ({
  tipo: 'gasto', valor: 4590, data: '2026-11-03', descricao: 'Padaria', observacao: '',
  categoriaId: alimentacao, contextoId: ctx, todoMes: false, ...extra,
})

describe('salvarLancamento', () => {
  it('cria com competência e origem manual', async () => {
    const l = await salvarLancamento(banco, dados())
    expect(l.competencia).toBe(202611)
    expect(l.origem).toBe('manual')
    expect(await banco.lancamentos.count()).toBe(1)
  })

  it('usa o nome da categoria quando a descrição está vazia', async () => {
    const l = await salvarLancamento(banco, dados({ descricao: '  ' }))
    expect(l.descricao).toBe('Alimentação')
  })

  it('recusa valor zero ou negativo', async () => {
    await expect(salvarLancamento(banco, dados({ valor: 0 }))).rejects.toThrow('maior que zero')
    await expect(salvarLancamento(banco, dados({ valor: -10 }))).rejects.toThrow()
  })

  it('"todo mês" cria a recorrência; desligar encerra neste mês', async () => {
    const l = await salvarLancamento(banco, dados({ descricao: 'Aluguel', valor: 150000, data: '2026-11-05', todoMes: true }))
    const rec = await banco.recorrencias.get(l.recorrenciaId ?? '')
    expect(rec).toMatchObject({ descricao: 'Aluguel', valor: 150000, diaDoMes: 5, inicio: 202611, fim: null })

    await salvarLancamento(banco, { ...dados({ descricao: 'Aluguel', valor: 150000, data: '2026-11-05' }), todoMes: false }, l)
    expect((await banco.recorrencias.get(l.recorrenciaId ?? ''))?.fim).toBe(202611)
  })

  it('editar mantém o id', async () => {
    const l = await salvarLancamento(banco, dados())
    const editado = await salvarLancamento(banco, dados({ valor: 5000, data: '2026-12-01' }), l)
    expect(editado.id).toBe(l.id)
    expect(editado.competencia).toBe(202612)
    expect(await banco.lancamentos.count()).toBe(1)
  })
})

describe('apagar e desfazer', () => {
  it('restaura exatamente o que foi apagado', async () => {
    const l = await salvarLancamento(banco, dados())
    const apagado = await apagarLancamento(banco, l.id)
    expect(await banco.lancamentos.count()).toBe(0)
    if (apagado) await restaurarLancamento(banco, apagado)
    expect(await banco.lancamentos.get(l.id)).toEqual(l)
  })
})

describe('recorrências', () => {
  it('lança uma vez por mês', async () => {
    const l = await salvarLancamento(banco, dados({ descricao: 'Internet', valor: 9990, data: '2026-11-10', todoMes: true }))
    const rec = await banco.recorrencias.get(l.recorrenciaId ?? '')
    if (!rec) throw new Error('sem recorrência')
    expect(await lancarRecorrencia(banco, rec, '2026-11-10')).toBeNull() // já lançada em novembro
    const dez = await lancarRecorrencia(banco, rec, '2026-12-10')
    expect(dez?.competencia).toBe(202612)
    expect(await lancarRecorrencia(banco, rec, '2026-12-10')).toBeNull()
  })

  it('encerrar a partir de janeiro fecha em dezembro do ano anterior', async () => {
    const l = await salvarLancamento(banco, dados({ todoMes: true }))
    await encerrarRecorrencia(banco, l.recorrenciaId ?? '', 202701)
    expect((await banco.recorrencias.get(l.recorrenciaId ?? ''))?.fim).toBe(202612)
  })

  it('encerrar no mês de início apaga a recorrência', async () => {
    const l = await salvarLancamento(banco, dados({ todoMes: true }))
    await encerrarRecorrencia(banco, l.recorrenciaId ?? '', 202611)
    expect(await banco.recorrencias.count()).toBe(0)
  })
})

describe('limites', () => {
  it('define e remove', async () => {
    await definirLimite(banco, alimentacao, 80000)
    expect((await banco.categorias.get(alimentacao))?.limiteMensal).toBe(80000)
    await definirLimite(banco, alimentacao, 0)
    expect((await banco.categorias.get(alimentacao))?.limiteMensal).toBeNull()
  })
})
