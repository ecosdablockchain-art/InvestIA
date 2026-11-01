import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BancoFinancas } from '../db/banco'
import { garantirDadosIniciais } from '../db/padroes'
import { salvarLancamento } from '../db/repositorio'
import { procurarLegado, trazerLegado } from './legado'

describe('dados de antes do login', () => {
  it('não oferece nada se só houver os padrões', async () => {
    const legado = new BancoFinancas('financas360')
    await garantirDadosIniciais(legado)
    legado.close()
    expect(await procurarLegado()).toBeNull()
  })

  it('traz para uma conta que já tem os padrões, sem duplicar e religando categorias', async () => {
    const legado = new BancoFinancas('financas360')
    await garantirDadosIniciais(legado)
    const ctx = (await legado.contextos.toArray())[0]!
    const ali = (await legado.categorias.filter((c) => c.nome === 'Alimentação').first())!
    await legado.categorias.put({ ...ali, limiteMensal: 60000 })
    await salvarLancamento(legado, { tipo: 'gasto', valor: 4590, data: '2026-11-05', descricao: 'Padaria', observacao: '', categoriaId: ali.id, contextoId: ctx.id, todoMes: true })
    legado.close()

    const achado = await procurarLegado()
    expect(achado).toMatchObject({ lancamentos: 1, outros: 1 })

    const conta = new BancoFinancas(`conta-${crypto.randomUUID()}`)
    await garantirDadosIniciais(conta)
    await trazerLegado(achado!.banco, conta)
    expect(await conta.contextos.count()).toBe(1)
    expect(await conta.categorias.count()).toBe(15)
    const l = (await conta.lancamentos.toArray())[0]!
    const aliConta = (await conta.categorias.filter((c) => c.nome === 'Alimentação').first())!
    expect(l.categoriaId).toBe(aliConta.id)
    expect(l.contextoId).toBe((await conta.contextos.toArray())[0]!.id)
    expect(aliConta.limiteMensal).toBe(60000)
    expect((await conta.recorrencias.toArray())[0]?.categoriaId).toBe(aliConta.id)
    // tudo marcado para subir para a nuvem
    expect(typeof (l as unknown as { _modificadoEm?: string })._modificadoEm).toBe('string')
  })
})
