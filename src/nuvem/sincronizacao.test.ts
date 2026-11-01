import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BancoFinancas } from '../db/banco'
import { garantirDadosIniciais } from '../db/padroes'
import { apagarLancamento, salvarLancamento, type DadosLancamento } from '../db/repositorio'
import { apagarTudo } from '../db/backup'
import { sincronizar } from './sincronizacao'
import { ServidorMemoria } from './servidorMemoria'

let servidor: ServidorMemoria
let a: BancoFinancas
let b: BancoFinancas
const esperar = () => new Promise((r) => setTimeout(r, 15)) // deixa os carimbos de tempo andarem

beforeEach(async () => {
  servidor = new ServidorMemoria()
  a = new BancoFinancas(`a-${crypto.randomUUID()}`)
  b = new BancoFinancas(`b-${crypto.randomUUID()}`)
  await garantirDadosIniciais(a)
  await sincronizar(a, servidor)
  await sincronizar(b, servidor)
})

async function dados(banco: BancoFinancas, extra: Partial<DadosLancamento> = {}): Promise<DadosLancamento> {
  const ctx = (await banco.contextos.toCollection().first())?.id ?? ''
  return { tipo: 'gasto', valor: 4590, data: '2026-11-05', descricao: 'Padaria', observacao: '', categoriaId: null, contextoId: ctx, todoMes: false, ...extra }
}

describe('sincronização entre aparelhos', () => {
  it('o segundo aparelho recebe contextos e categorias do primeiro', async () => {
    expect(await b.contextos.count()).toBe(1)
    expect(await b.categorias.count()).toBe(15)
  })

  it('criar, editar e apagar chegam no outro aparelho', async () => {
    const l = await salvarLancamento(a, await dados(a))
    await sincronizar(a, servidor); await sincronizar(b, servidor)
    expect((await b.lancamentos.get(l.id))?.descricao).toBe('Padaria')

    await esperar()
    const doB = await b.lancamentos.get(l.id)
    await salvarLancamento(b, await dados(b, { descricao: 'Padaria do bairro', valor: 5000 }), doB)
    await sincronizar(b, servidor); await sincronizar(a, servidor)
    expect(await a.lancamentos.get(l.id)).toMatchObject({ descricao: 'Padaria do bairro', valor: 5000 })

    await esperar()
    await apagarLancamento(a, l.id)
    await esperar() // o registro do apagado é gravado depois da transação
    await sincronizar(a, servidor); await sincronizar(b, servidor)
    expect(await b.lancamentos.get(l.id)).toBeUndefined()
  })

  it('não fica mandando de volta o que recebeu (sem eco)', async () => {
    await salvarLancamento(a, await dados(a))
    await sincronizar(a, servidor)
    await sincronizar(b, servidor)
    expect((await sincronizar(b, servidor)).enviados).toBe(0)
    expect((await sincronizar(a, servidor)).enviados).toBe(0)
    expect(await b._apagados.count()).toBe(0)
  })

  it('conflito: vence a alteração mais recente', async () => {
    const l = await salvarLancamento(a, await dados(a))
    await sincronizar(a, servidor); await sincronizar(b, servidor)
    await esperar()
    await salvarLancamento(a, await dados(a, { descricao: 'versão A' }), await a.lancamentos.get(l.id))
    await esperar()
    await salvarLancamento(b, await dados(b, { descricao: 'versão B (mais nova)' }), await b.lancamentos.get(l.id))
    await sincronizar(b, servidor) // B envia primeiro
    await sincronizar(a, servidor) // A tenta enviar a versão mais velha e recebe a de B
    await sincronizar(b, servidor)
    expect((await a.lancamentos.get(l.id))?.descricao).toBe('versão B (mais nova)')
    expect((await b.lancamentos.get(l.id))?.descricao).toBe('versão B (mais nova)')
  })

  it('apagar tudo num aparelho apaga no outro, e o que for criado depois continua', async () => {
    await salvarLancamento(a, await dados(a))
    await sincronizar(a, servidor); await sincronizar(b, servidor)
    await esperar()
    await apagarTudo(a)
    await esperar()
    await garantirDadosIniciais(a)
    await sincronizar(a, servidor); await sincronizar(b, servidor)
    expect(await b.lancamentos.count()).toBe(0)
    expect(await b.contextos.count()).toBe(1) // recriado depois do apagar
    expect(await a.contextos.count()).toBe(1)
  })

  it('apagado aqui não volta com uma versão mais velha da nuvem', async () => {
    const l = await salvarLancamento(a, await dados(a))
    await sincronizar(a, servidor); await sincronizar(b, servidor)
    await esperar()
    await apagarLancamento(b, l.id)
    await esperar()
    await sincronizar(b, servidor)
    expect(await b.lancamentos.get(l.id)).toBeUndefined()
    await sincronizar(a, servidor)
    expect(await a.lancamentos.get(l.id)).toBeUndefined()
  })

  it('muitos registros vão em lotes', async () => {
    const ctx = (await a.contextos.toCollection().first())?.id ?? ''
    await a.lancamentos.bulkAdd(Array.from({ length: 1200 }, (_, i) => ({
      id: `l${i}`, criadoEm: '', atualizadoEm: '', tipo: 'gasto' as const, valor: i + 1, data: '2026-11-05', competencia: 202611,
      descricao: `item ${i}`, observacao: '', categoriaId: null, contextoId: ctx, metaId: null, recorrenciaId: null, origem: 'manual' as const, importacaoId: null,
    })))
    await sincronizar(a, servidor)
    await sincronizar(b, servidor)
    expect(await b.lancamentos.count()).toBe(1200)
  })
})
