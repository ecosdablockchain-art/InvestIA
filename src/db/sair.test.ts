import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { abrirBancoDoUsuario, apagarBancoDoUsuario } from './banco'
import * as banco from './banco'

describe('sair e entrar de novo na mesma conta', () => {
  it('reabre o banco depois de sair, vazio e utilizável', async () => {
    abrirBancoDoUsuario('u1')
    await banco.db.categorias.put({ id: 'c1', nome: 'Teste' } as never)
    expect(await banco.db.categorias.count()).toBe(1)
    await apagarBancoDoUsuario()
    expect(banco.db.name).toBe('financas360-sem-conta')
    abrirBancoDoUsuario('u1')
    expect(banco.db.name).toBe('financas360-u1')
    expect(await banco.db.categorias.count()).toBe(0)
    await banco.db.categorias.put({ id: 'c2', nome: 'De novo' } as never)
    expect(await banco.db.categorias.count()).toBe(1)
  })
})
