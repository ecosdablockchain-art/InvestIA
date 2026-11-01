import type { BancoFinancas } from './banco'

export const VERSAO_BACKUP = 1

export interface Backup {
  app: 'financas-360'
  versao: number
  exportadoEm: string
  tabelas: Record<string, unknown[]>
}

function semCamposInternos(r: unknown): unknown {
  if (!r || typeof r !== 'object') return r
  const { _modificadoEm: _, _sincronizadoEm: __, ...resto } = r as Record<string, unknown>
  return resto
}

export async function exportarBackup(banco: BancoFinancas): Promise<Backup> {
  const tabelas: Record<string, unknown[]> = {}
  for (const t of banco.tabelasDeDados) tabelas[t.name] = (await t.toArray()).map(semCamposInternos)
  // a chave da API de cotações não vai para o arquivo de backup
  tabelas.ajustesConta = (tabelas.ajustesConta ?? []).map((a) => ({ ...(a as object), chaveCotacao: '', chaveClaude: '' }))
  return { app: 'financas-360', versao: VERSAO_BACKUP, exportadoEm: new Date().toISOString(), tabelas }
}

export function validarBackup(dados: unknown): Backup {
  const b = dados as Partial<Backup> | null
  if (!b || b.app !== 'financas-360' || typeof b.versao !== 'number' || typeof b.tabelas !== 'object' || b.tabelas === null) {
    throw new Error('Este arquivo não é um backup do Finanças 360.')
  }
  if (b.versao > VERSAO_BACKUP) throw new Error('Backup de uma versão mais nova do app. Atualize a página e tente de novo.')
  for (const [nome, linhas] of Object.entries(b.tabelas)) {
    if (!Array.isArray(linhas)) throw new Error(`Tabela "${nome}" inválida no backup.`)
  }
  return b as Backup
}

/** Substitui todos os dados pelos do backup, numa única transação. */
export async function restaurarBackup(banco: BancoFinancas, dados: unknown): Promise<number> {
  const backup = validarBackup(dados)
  let total = 0
  await banco.transaction('rw', banco.tabelasDeDados, async () => {
    for (const t of banco.tabelasDeDados) {
      await t.clear()
      const linhas = backup.tabelas[t.name] ?? []
      await t.bulkAdd(linhas)
      total += linhas.length
    }
  })
  return total
}

export async function apagarTudo(banco: BancoFinancas): Promise<void> {
  await banco.transaction('rw', banco.tabelasDeDados, async () => {
    for (const t of banco.tabelasDeDados) await t.clear()
  })
}

/** Lista de todos os dados em CSV (lançamentos), para abrir em planilha. */
export function csvDeLinhas(cabecalho: string[], linhas: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\n')
}
