import { MARCA_REMOTO, type BancoFinancas } from '../db/banco'

/** Linha como fica guardada na nuvem: um registro de qualquer tabela, em JSON. */
export interface LinhaNuvem {
  tabela: string
  id: string
  dados: Record<string, unknown> | null
  apagado: boolean
  atualizado_em: string // carimbo do aparelho que alterou (última alteração vence)
}
/** servidor_em: microssegundos desde 1970, texto de 17 dígitos (compara como texto). */
export interface LinhaRecebida extends LinhaNuvem { servidor_em: string }

export function recuarCursor(cursor: string, ms: number): string {
  const v = BigInt(cursor) - BigInt(ms) * 1000n
  return (v < 0n ? 0n : v).toString().padStart(17, '0')
}

/** O que a sincronização precisa do servidor (Supabase em produção, memória nos testes). */
export interface Servidor {
  enviar(linhas: LinhaNuvem[]): Promise<void>
  /** Marca como apagados todos os registros da tabela alterados antes de `ate`. */
  apagarTabela(tabela: string, ate: string): Promise<void>
  /** Linhas gravadas no servidor depois de `desde`, em ordem, até `limite`. */
  receber(desde: string | null, limite: number): Promise<LinhaRecebida[]>
}

export interface ResultadoSinc { enviados: number; recebidos: number }

const LOTE = 500
const SOBREPOSICAO_MS = 5_000 // relê alguns segundos para não perder gravações simultâneas

async function lerMeta(banco: BancoFinancas, chave: string): Promise<string | null> {
  return (await banco._meta.get(chave))?.valor ?? null
}
async function gravarMeta(banco: BancoFinancas, chave: string, valor: string) {
  await banco._meta.put({ chave, valor })
}

/** Envia o que mudou aqui e recebe o que mudou em outros aparelhos. */
export async function sincronizar(banco: BancoFinancas, servidor: Servidor): Promise<ResultadoSinc> {
  const enviados = await enviar(banco, servidor)
  const recebidos = await receber(banco, servidor)
  return { enviados, recebidos }
}

async function enviar(banco: BancoFinancas, servidor: Servidor): Promise<number> {
  let total = 0
  const apagados = await banco._apagados.toArray()

  // 1) tabelas apagadas inteiras (Apagar tudo / Restaurar backup)
  for (const a of apagados.filter((x) => x.id === '*')) {
    await servidor.apagarTabela(a.tabela, a.em)
    await banco._apagados.where('chave').equals(a.chave).and((x) => x.em === a.em).delete()
    total++
  }

  // 2) registros apagados um a um
  const individuais = apagados.filter((x) => x.id !== '*')
  for (let i = 0; i < individuais.length; i += LOTE) {
    const lote = individuais.slice(i, i + LOTE)
    await servidor.enviar(lote.map((a) => ({ tabela: a.tabela, id: a.id, dados: null, apagado: true, atualizado_em: a.em })))
    for (const a of lote) await banco._apagados.where('chave').equals(a.chave).and((x) => x.em === a.em).delete()
    total += lote.length
  }

  // 3) registros criados ou alterados aqui e ainda não enviados
  for (const t of banco.tabelasDeDados) {
    const linhas = (await t.filter((r: Record<string, unknown>) =>
      typeof r._modificadoEm === 'string' && r._modificadoEm !== r._sincronizadoEm).toArray()) as Record<string, unknown>[]
    for (let i = 0; i < linhas.length; i += LOTE) {
      const lote = linhas.slice(i, i + LOTE)
      await servidor.enviar(lote.map((r) => {
        const { _modificadoEm, _sincronizadoEm: _, ...dados } = r
        return { tabela: t.name, id: String(r.id), dados, apagado: false, atualizado_em: _modificadoEm as string }
      }))
      await marcarSincronizados(banco, t.name, lote.map((r) => ({ id: String(r.id), em: r._modificadoEm as string })))
      total += lote.length
    }
  }
  return total
}

/** Anota que a versão enviada está na nuvem (se ninguém alterou o registro enquanto isso). */
async function marcarSincronizados(banco: BancoFinancas, tabela: string, itens: { id: string; em: string }[]) {
  const t = banco.table(tabela)
  await banco.transaction('rw', t, async (tx) => {
    ;(tx.idbtrans as unknown as Record<string, unknown>)[MARCA_REMOTO] = true
    for (const { id, em } of itens) {
      const r = (await t.get(id)) as Record<string, unknown> | undefined
      if (r && r._modificadoEm === em) await t.put({ ...r, _sincronizadoEm: em })
    }
  })
}

async function receber(banco: BancoFinancas, servidor: Servidor): Promise<number> {
  const nomes = new Set(banco.tabelasDeDados.map((t) => t.name))
  const cursor = await lerMeta(banco, 'cursorRecebido')
  // a primeira página relê alguns segundos; as seguintes continuam de onde a anterior parou
  let desde = cursor ? recuarCursor(cursor, SOBREPOSICAO_MS) : null
  let maior = cursor ?? ''
  let total = 0
  for (;;) {
    const linhas = await servidor.receber(desde, LOTE)
    if (linhas.length === 0) break
    total += await aplicar(banco, linhas.filter((l) => nomes.has(l.tabela)))
    const ultimo = linhas[linhas.length - 1]?.servidor_em ?? ''
    for (const l of linhas) if (l.servidor_em > maior) maior = l.servidor_em
    if (linhas.length < LOTE || ultimo === desde) break
    desde = ultimo
  }
  if (maior) await gravarMeta(banco, 'cursorRecebido', maior)
  return total
}

/** Aplica linhas da nuvem no banco local. Vence a alteração mais recente. */
async function aplicar(banco: BancoFinancas, linhas: LinhaRecebida[]): Promise<number> {
  if (linhas.length === 0) return 0
  const tabelas = [...new Set(linhas.map((l) => l.tabela))].map((n) => banco.table(n))
  let aplicadas = 0
  await banco.transaction('rw', [...tabelas, banco._apagados], async (tx) => {
    ;(tx.idbtrans as unknown as Record<string, unknown>)[MARCA_REMOTO] = true
    for (const l of linhas) {
      const tabela = banco.table(l.tabela)
      const local = (await tabela.get(l.id)) as Record<string, unknown> | undefined
      const carimboLocal = local?._modificadoEm as string | undefined
      if (carimboLocal && carimboLocal >= l.atualizado_em) continue // a versão daqui é igual ou mais nova
      const apagadoAqui = await banco._apagados.get(`${l.tabela}:${l.id}`)
      if (apagadoAqui && apagadoAqui.em >= l.atualizado_em) continue // apagado aqui depois
      const tabelaApagada = await banco._apagados.get(`${l.tabela}:*`)
      if (tabelaApagada && tabelaApagada.em >= l.atualizado_em) continue
      if (l.apagado) {
        if (local) { await tabela.delete(l.id); aplicadas++ }
      } else if (l.dados) {
        await tabela.put({ ...l.dados, id: l.id, _modificadoEm: l.atualizado_em, _sincronizadoEm: l.atualizado_em })
        aplicadas++
      }
    }
  })
  return aplicadas
}

/** Garante uma sincronização por vez. */
let emAndamento: Promise<ResultadoSinc> | null = null
export function sincronizarUmaVez(banco: BancoFinancas, servidor: Servidor): Promise<ResultadoSinc> {
  emAndamento ??= sincronizar(banco, servidor).finally(() => { emAndamento = null })
  return emAndamento
}

