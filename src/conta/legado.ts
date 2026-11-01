import Dexie from 'dexie'
import { BancoFinancas } from '../db/banco'
import type { Categoria, Contexto } from '../db/tipos'

const NOME_LEGADO = 'financas360' // banco usado antes de existir login

export interface Legado { banco: BancoFinancas; lancamentos: number; outros: number }

/** Dados criados neste aparelho antes do login (se houver algo além dos padrões). */
export async function procurarLegado(): Promise<Legado | null> {
  if (!(await Dexie.exists(NOME_LEGADO))) return null
  const banco = new BancoFinancas(NOME_LEGADO)
  const lancamentos = await banco.lancamentos.count()
  const outros = (await Promise.all(['recorrencias', 'regras', 'cartoes', 'dividas', 'investimentos', 'operacoes', 'metas', 'casaDespesas']
    .map((t) => banco.table(t).count()))).reduce((a, b) => a + b, 0)
  if (lancamentos + outros === 0) { banco.close(); return null }
  return { banco, lancamentos, outros }
}

/**
 * Copia os dados antigos para o banco da conta. Se a conta já tiver contas/categorias
 * com o mesmo nome, reaproveita (sem duplicar "Pessoal" e as categorias padrão).
 */
export async function trazerLegado(origem: BancoFinancas, destino: BancoFinancas): Promise<number> {
  const norm = (s: string) => s.trim().toLowerCase()
  const ctxDestino = new Map((await destino.contextos.toArray()).map((c) => [norm(c.nome), c.id]))
  const catDestino = new Map((await destino.categorias.toArray()).map((c) => [norm(c.nome), c.id]))
  const mapaCtx = new Map<string, string>()
  const mapaCat = new Map<string, string>()
  let total = 0
  // lê tudo antes: uma transação do IndexedDB não pode esperar por outro banco
  const dadosOrigem = new Map<string, Record<string, unknown>[]>()
  for (const t of origem.tabelasDeDados) dadosOrigem.set(t.name, (await t.toArray()) as Record<string, unknown>[])
  const ctxOrigem = (dadosOrigem.get('contextos') ?? []) as unknown as Contexto[]
  const catOrigem = (dadosOrigem.get('categorias') ?? []) as unknown as Categoria[]

  await destino.transaction('rw', destino.tabelasDeDados, async () => {
    for (const c of ctxOrigem) {
      const existente = ctxDestino.get(norm(c.nome))
      if (existente) mapaCtx.set(c.id, existente)
      else { await destino.contextos.put(c); total++ }
    }
    for (const c of catOrigem) {
      const existente = catDestino.get(norm(c.nome))
      if (existente) {
        mapaCat.set(c.id, existente)
        // limite definido antes do login vale para a categoria da conta, se ela não tiver
        const alvo = await destino.categorias.get(existente)
        if (alvo && alvo.limiteMensal === null && c.limiteMensal !== null) await destino.categorias.put({ ...alvo, limiteMensal: c.limiteMensal })
      } else { await destino.categorias.put(c); total++ }
    }
    for (const [nome, linhas] of dadosOrigem) {
      if (nome === 'contextos' || nome === 'categorias') continue
      if (linhas.length === 0) continue
      const remapeadas = linhas.map((r) => {
        const { _modificadoEm: _, _sincronizadoEm: __, ...resto } = r
        const out: Record<string, unknown> = { ...resto }
        if (typeof out.contextoId === 'string') out.contextoId = mapaCtx.get(out.contextoId) ?? out.contextoId
        if (typeof out.categoriaId === 'string') out.categoriaId = mapaCat.get(out.categoriaId) ?? out.categoriaId
        return out
      })
      await destino.table(nome).bulkPut(remapeadas)
      total += remapeadas.length
    }
  })
  return total
}

const chave = (usuarioId: string) => `financas360:legado:${usuarioId}`
export const legadoJaResolvido = (usuarioId: string) => localStorage.getItem(chave(usuarioId)) !== null
export const marcarLegado = (usuarioId: string, como: 'trazido' | 'recusado') => localStorage.setItem(chave(usuarioId), como)
