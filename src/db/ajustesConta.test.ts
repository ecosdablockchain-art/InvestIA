import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BancoFinancas } from './banco'
import { exportarBackup } from './backup'
import { lerAjustesConta, salvarAjustesConta } from './ajustesConta'
import { sincronizar } from '../nuvem/sincronizacao'
import { ServidorMemoria } from '../nuvem/servidorMemoria'

describe('ajustes da conta', () => {
  it('padrões, salvar e valer no outro aparelho', async () => {
    const servidor = new ServidorMemoria()
    const a = new BancoFinancas(`a-${crypto.randomUUID()}`)
    const b = new BancoFinancas(`b-${crypto.randomUUID()}`)
    expect(await lerAjustesConta(a)).toEqual({ perfil: 'moderado', fonteCotacao: 'brapi', chaveCotacao: '', taxaRotativoMensal: 0.15 })
    await salvarAjustesConta({ chaveCotacao: 'tk-123', perfil: 'arrojado' }, a)
    await salvarAjustesConta({ taxaRotativoMensal: 0.12 }, a)
    await sincronizar(a, servidor)
    await sincronizar(b, servidor)
    expect(await lerAjustesConta(b)).toEqual({ perfil: 'arrojado', fonteCotacao: 'brapi', chaveCotacao: 'tk-123', taxaRotativoMensal: 0.12 })
  })
  it('a chave não vai para o backup', async () => {
    const a = new BancoFinancas(`a-${crypto.randomUUID()}`)
    await salvarAjustesConta({ chaveCotacao: 'segredo' }, a)
    const b = await exportarBackup(a)
    expect(JSON.stringify(b)).not.toContain('segredo')
    expect((b.tabelas.ajustesConta?.[0] as { perfil: string }).perfil).toBe('moderado')
  })
})
