import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BancoFinancas } from './banco'
import { garantirDadosIniciais } from './padroes'
import { aprenderRegra, desfazerImportacao, lancarImportacao, type ItemParaLancar } from './importacoes'
import { salvarLancamento } from './repositorio'

let banco: BancoFinancas
let ctx: string
beforeEach(async () => {
  banco = new BancoFinancas(`teste-${crypto.randomUUID()}`)
  await garantirDadosIniciais(banco)
  ctx = (await banco.contextos.toCollection().first())?.id ?? ''
})

const item = (descricao: string, valor: number, extra: Partial<ItemParaLancar> = {}): ItemParaLancar =>
  ({ data: '2026-11-05', descricao, valor, tipo: 'gasto', categoriaId: null, contextoId: ctx, idExterno: null, ...extra })

describe('lançar importação', () => {
  it('cria importação, lançamentos e regras', async () => {
    const imp = await lancarImportacao(banco, {
      nomeArquivo: 'extrato.ofx', formato: 'ofx', linhasLidas: 3,
      itens: [item('IFOOD', 4590, { idExterno: 'f1' }), item('SALARIO', 650000, { tipo: 'renda', data: '2026-12-05' })],
      regras: [{ padrao: 'ifood', categoriaId: 'cat-a', contextoId: null }],
    })
    const ls = await banco.lancamentos.where('importacaoId').equals(imp.id).toArray()
    expect(ls).toHaveLength(2)
    expect(ls.find((l) => l.descricao === 'SALARIO')).toMatchObject({ origem: 'importacao', competencia: 202612, tipo: 'renda' })
    expect(ls.find((l) => l.descricao === 'IFOOD')?.idExterno).toBe('f1')
    expect(imp.lancamentosGerados).toBe(2)
    expect(await banco.regras.count()).toBe(1)
  })

  it('recusa importação vazia', async () => {
    await expect(lancarImportacao(banco, { nomeArquivo: 'x', formato: 'csv', linhasLidas: 0, itens: [], regras: [] })).rejects.toThrow()
  })

  it('regra existente é atualizada, não duplicada', async () => {
    await aprenderRegra(banco, { padrao: 'joao exemplo', categoriaId: 'a', contextoId: null })
    await aprenderRegra(banco, { padrao: 'joao exemplo', categoriaId: 'b', contextoId: 'mc' })
    const r = await banco.regras.toArray()
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ categoriaId: 'b', contextoId: 'mc', vezesUsada: 2 })
  })
})

describe('desfazer', () => {
  it('apaga só os lançamentos daquela importação', async () => {
    await salvarLancamento(banco, { tipo: 'gasto', valor: 100, data: '2026-11-01', descricao: 'manual', observacao: '', categoriaId: null, contextoId: ctx, todoMes: false })
    const a = await lancarImportacao(banco, { nomeArquivo: 'a', formato: 'csv', linhasLidas: 2, itens: [item('A1', 1), item('A2', 2)], regras: [] })
    await lancarImportacao(banco, { nomeArquivo: 'b', formato: 'csv', linhasLidas: 1, itens: [item('B1', 3)], regras: [] })
    expect(await desfazerImportacao(banco, a.id)).toBe(2)
    expect((await banco.lancamentos.toArray()).map((l) => l.descricao).sort()).toEqual(['B1', 'manual'])
    expect(await banco.importacoes.count()).toBe(1)
  })
})
