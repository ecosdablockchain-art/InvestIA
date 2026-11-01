import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BancoFinancas } from './banco'
import { garantirDadosIniciais } from './padroes'
import { salvarLancamento, lancarRecorrencia } from './repositorio'
import { apagarCartao, informarValorFatura, marcarFaturaPaga, processarFaturasVencidas, salvarCartao, salvarDivida, salvarParcelado } from './credito'
import { idFatura, idRotativo } from '../core/credito'

let banco: BancoFinancas
let ctx: string
beforeEach(async () => {
  banco = new BancoFinancas(`teste-${crypto.randomUUID()}`)
  await garantirDadosIniciais(banco)
  ctx = (await banco.contextos.toCollection().first())?.id ?? ''
})

async function novoCartao(criadoEm = '2026-09-01T00:00:00.000Z') {
  const c = await salvarCartao(banco, { apelido: 'Santander', banco: 'Santander', limite: 500000, diaFechamento: 3, diaVencimento: 10, cor: '#c00' })
  await banco.cartoes.put({ ...c, criadoEm })
  return { ...c, criadoEm }
}
const gasto = (valor: number, data: string, cartaoId: string | null, todoMes = false) =>
  salvarLancamento(banco, { tipo: 'gasto', valor, data, descricao: 'x', observacao: '', categoriaId: null, contextoId: ctx, todoMes, cartaoId })

describe('cartões', () => {
  it('valida dias e nome', async () => {
    await expect(salvarCartao(banco, { apelido: ' ', banco: '', limite: 0, diaFechamento: 3, diaVencimento: 10, cor: '' })).rejects.toThrow('nome')
    await expect(salvarCartao(banco, { apelido: 'A', banco: '', limite: 0, diaFechamento: 10, diaVencimento: 10, cor: '' })).rejects.toThrow('mesmo dia')
  })

  it('lançamento guarda o cartão; entrada nunca tem cartão; recorrência leva o cartão', async () => {
    const c = await novoCartao()
    const l = await gasto(5590, '2026-11-15', c.id, true)
    expect(l.cartaoId).toBe(c.id)
    const rec = await banco.recorrencias.get(l.recorrenciaId ?? '')
    expect(rec?.cartaoId).toBe(c.id)
    const dez = await lancarRecorrencia(banco, rec!, '2026-12-15')
    expect(dez?.cartaoId).toBe(c.id)
    const e = await salvarLancamento(banco, { tipo: 'renda', valor: 1, data: '2026-11-15', descricao: 'x', observacao: '', categoriaId: null, contextoId: ctx, todoMes: false, cartaoId: c.id })
    expect(e.cartaoId).toBeNull()
  })

  it('apagar o cartão mantém os lançamentos, sem o cartão', async () => {
    const c = await novoCartao()
    const l = await gasto(1000, '2026-11-05', c.id)
    await salvarParcelado(banco, { cartaoId: c.id, descricao: 'TV', valorTotal: 100000, numeroParcelas: 10, primeiraCompetencia: 202612 })
    await apagarCartao(banco, c.id)
    expect(await banco.cartoes.count()).toBe(0)
    expect(await banco.parcelados.count()).toBe(0)
    expect((await banco.lancamentos.get(l.id))?.cartaoId).toBeNull()
  })
})

describe('faturas', () => {
  it('marcar como paga cria a fatura com id fixo e informar valor guarda o valor', async () => {
    const c = await novoCartao()
    await informarValorFatura(banco, c.id, 202611, 123456)
    await marcarFaturaPaga(banco, c.id, 202611, true, '2026-11-09')
    const f = await banco.faturas.get(idFatura(c.id, 202611))
    expect(f).toMatchObject({ valorInformado: 123456, paga: true, pagaEm: '2026-11-09' })
    expect(await banco.faturas.count()).toBe(1)
  })
})

describe('rotativo automático', () => {
  it('fatura vencida e não paga vira dívida uma vez só; pagar remove', async () => {
    const c = await novoCartao()
    await gasto(30000, '2026-10-05', c.id) // fatura de novembro (vence 10/11)
    await salvarParcelado(banco, { cartaoId: c.id, descricao: 'TV', valorTotal: 30000, numeroParcelas: 3, primeiraCompetencia: 202611 })
    expect(await processarFaturasVencidas(banco, '2026-11-20', 0.15)).toBe(1)
    const d = await banco.dividas.get(idRotativo(idFatura(c.id, 202611)))
    expect(d).toMatchObject({ saldo: 40000, jurosMensal: 0.15, origem: 'rotativo' })
    expect(await processarFaturasVencidas(banco, '2026-11-21', 0.15)).toBe(0) // não duplica

    await banco.dividas.delete(d!.id) // usuário apagou: não volta
    expect(await processarFaturasVencidas(banco, '2026-11-22', 0.15)).toBe(0)
  })

  it('pagar a fatura apaga o rotativo', async () => {
    const c = await novoCartao()
    await gasto(30000, '2026-10-05', c.id)
    await processarFaturasVencidas(banco, '2026-11-20', 0.15)
    await marcarFaturaPaga(banco, c.id, 202611, true, '2026-11-20')
    expect(await banco.dividas.count()).toBe(0)
  })

  it('ignora faturas que venceram antes de o cartão ser cadastrado, e faturas zeradas', async () => {
    const c = await novoCartao('2026-11-15T00:00:00.000Z')
    await gasto(30000, '2026-10-05', c.id)
    expect(await processarFaturasVencidas(banco, '2026-11-20', 0.15)).toBe(0)
    const c2 = await novoCartao()
    expect(await processarFaturasVencidas(banco, '2026-11-20', 0.15)).toBe(0)
    void c2
  })
})

describe('dívidas', () => {
  it('valida e salva', async () => {
    await expect(salvarDivida(banco, { nome: 'X', saldo: 100, jurosMensal: 2, parcela: 0, parcelasRestantes: null })).rejects.toThrow('Juros')
    const d = await salvarDivida(banco, { nome: ' Empréstimo ', saldo: 500000, jurosMensal: 0.02, parcela: 30000, parcelasRestantes: 20 })
    expect(d).toMatchObject({ nome: 'Empréstimo', origem: 'manual', faturaId: null })
  })
})
