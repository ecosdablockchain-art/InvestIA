import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BancoFinancas, criar } from './banco'
import { garantirDadosIniciais } from './padroes'
import { apagarTudo, csvDeLinhas, exportarBackup, restaurarBackup } from './backup'
import type { Lancamento } from './tipos'

let banco: BancoFinancas
beforeEach(async () => {
  banco = new BancoFinancas(`teste-${crypto.randomUUID()}`)
  await banco.open()
})

describe('dados iniciais', () => {
  it('cria Pessoal e 15 categorias só uma vez', async () => {
    await garantirDadosIniciais(banco)
    await garantirDadosIniciais(banco)
    expect(await banco.contextos.count()).toBe(1)
    expect(await banco.categorias.count()).toBe(15)
  })
})

describe('backup', () => {
  it('exporta e restaura tudo', async () => {
    await garantirDadosIniciais(banco)
    const ctx = await banco.contextos.toCollection().first()
    await banco.lancamentos.add(
      criar<Lancamento>({
        tipo: 'gasto', valor: 4590, data: '2026-11-01', competencia: 202611, descricao: 'Padaria', observacao: '',
        categoriaId: null, contextoId: ctx?.id ?? '', metaId: null, recorrenciaId: null, origem: 'manual', importacaoId: null,
      }),
    )
    const backup = JSON.parse(JSON.stringify(await exportarBackup(banco)))
    await apagarTudo(banco)
    expect(await banco.lancamentos.count()).toBe(0)
    const total = await restaurarBackup(banco, backup)
    expect(total).toBe(17)
    expect((await banco.lancamentos.toArray())[0]?.valor).toBe(4590)
  })

  it('recusa arquivo que não é backup', async () => {
    await expect(restaurarBackup(banco, { qualquer: 1 })).rejects.toThrow('não é um backup')
  })
})

describe('csv', () => {
  it('escapa ponto e vírgula e aspas', () => {
    expect(csvDeLinhas(['a', 'b'], [['x;y', 'diz "oi"']])).toBe('﻿a;b\n"x;y";"diz ""oi"""')
  })
})
