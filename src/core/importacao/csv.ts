import { lerValor, type Centavos } from '../dinheiro'
import { normalizar } from '../busca'
import { lerData } from './datas'
import type { LinhaImportada, ResultadoLeitura } from './tipos'

export interface MapeamentoCSV {
  linhaCabecalho: number // índice da linha de cabeçalho (-1 = sem cabeçalho)
  data: number
  descricao: number[] // uma ou mais colunas, juntadas
  valor: number | null // coluna única com sinal
  credito: number | null // ou colunas separadas
  debito: number | null
  positivoEhGasto: boolean // faturas de cartão
}

export interface TabelaCSV {
  separador: string
  linhas: string[][]
}

export function lerTabela(texto: string): TabelaCSV {
  const separador = detectarSeparador(texto)
  const linhas = dividirLinhas(texto, separador).filter((l) => l.some((c) => c.trim() !== ''))
  return { separador, linhas }
}

function detectarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 15)
  let melhor = ';'
  let pontos = -1
  for (const sep of [';', ',', '\t', '|']) {
    const contagens = amostra.map((l) => contarForaDeAspas(l, sep)).filter((n) => n > 0)
    if (contagens.length === 0) continue
    // separador bom: aparece em muitas linhas, sempre a mesma quantidade
    const moda = maisFrequente(contagens)
    const consistencia = contagens.filter((n) => n === moda).length
    const p = consistencia * 10 + moda
    if (p > pontos) { pontos = p; melhor = sep }
  }
  return melhor
}

function contarForaDeAspas(linha: string, sep: string): number {
  let n = 0
  let aspas = false
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas
    else if (ch === sep && !aspas) n++
  }
  return n
}

function maisFrequente(ns: number[]): number {
  const c = new Map<number, number>()
  for (const n of ns) c.set(n, (c.get(n) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0
}

function dividirLinhas(texto: string, sep: string): string[][] {
  const out: string[][] = []
  let linha: string[] = []
  let celula = ''
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { celula += '"'; i++ }
      else if (ch === '"') aspas = false
      else celula += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(celula.trim()); celula = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(celula.trim()); out.push(linha); linha = []; celula = ''
    } else celula += ch
  }
  if (celula !== '' || linha.length) { linha.push(celula.trim()); out.push(linha) }
  return out
}

const CHAVES = {
  data: ['data', 'date', 'dt', 'data lancamento', 'data da compra', 'data movimento'],
  descricao: ['descricao', 'historico', 'lancamento', 'title', 'estabelecimento', 'memo', 'detalhes', 'identificacao'],
  valor: ['valor', 'amount', 'valor r$', 'valor (r$)', 'quantia', 'valor em r$'],
  credito: ['credito', 'credito (r$)', 'entrada', 'entradas'],
  debito: ['debito', 'debito (r$)', 'saida', 'saidas'],
} as const

function casa(cabecalho: string, chaves: readonly string[]): boolean {
  const c = normalizar(cabecalho).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  return chaves.some((k) => c === k || c.startsWith(`${k} `) || c.endsWith(` ${k}`))
}

/** Tenta descobrir as colunas sozinho. Retorna null se não reconhecer. */
export function detectarMapeamento(tabela: TabelaCSV): MapeamentoCSV | null {
  for (let i = 0; i < Math.min(tabela.linhas.length, 20); i++) {
    const cab = tabela.linhas[i] ?? []
    const idx = (chaves: readonly string[], excluir: number[] = []) => cab.findIndex((c, j) => !excluir.includes(j) && casa(c, chaves))
    const data = idx(CHAVES.data)
    if (data < 0) continue
    const credito = idx(CHAVES.credito)
    const debito = idx(CHAVES.debito)
    const valor = idx(CHAVES.valor, [credito, debito])
    const descricao = cab.map((c, j) => (j !== data && casa(c, CHAVES.descricao) ? j : -1)).filter((j) => j >= 0)
    if (descricao.length === 0) continue
    if (valor < 0 && (credito < 0 || debito < 0)) continue
    const nomes = cab.map((c) => normalizar(c))
    // Nubank cartão: date,title,amount — positivo = compra
    const positivoEhGasto = nomes.join(',') === 'date,title,amount'
    return {
      linhaCabecalho: i, data, descricao,
      valor: valor >= 0 && (credito < 0 || debito < 0) ? valor : null,
      credito: valor >= 0 && (credito < 0 || debito < 0) ? null : credito,
      debito: valor >= 0 && (credito < 0 || debito < 0) ? null : debito,
      positivoEhGasto,
    }
  }
  return null
}

/** Valor de célula, aceitando também "1.234,56 D" / "C". */
function valorCelula(t: string | undefined): Centavos | null {
  if (!t) return null
  const m = /^(.*?)\s*([DC])$/i.exec(t.trim())
  if (m) {
    const v = lerValor(m[1] ?? '')
    if (v === null) return null
    return m[2]?.toUpperCase() === 'D' ? -Math.abs(v) : Math.abs(v)
  }
  return lerValor(t)
}

export function aplicarMapeamento(tabela: TabelaCSV, map: MapeamentoCSV): ResultadoLeitura {
  const linhas: LinhaImportada[] = []
  let ignoradas = 0
  for (const cel of tabela.linhas.slice(map.linhaCabecalho + 1)) {
    const data = lerData(cel[map.data] ?? '')
    const descricao = map.descricao.map((j) => cel[j] ?? '').filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim()
    let valor: Centavos | null
    if (map.valor !== null) {
      valor = valorCelula(cel[map.valor])
    } else {
      const c = map.credito !== null ? valorCelula(cel[map.credito]) : null
      const d = map.debito !== null ? valorCelula(cel[map.debito]) : null
      valor = c || d ? Math.abs(c ?? 0) - Math.abs(d ?? 0) : null
    }
    if (!data || valor === null || valor === 0) {
      if (cel.some((c) => c.trim())) ignoradas++
      continue
    }
    if (/^saldo\b|^s ?a ?l ?d ?o/i.test(normalizar(descricao))) { ignoradas++; continue }
    linhas.push({ data, descricao: descricao || 'Sem descrição', valor: map.positivoEhGasto ? -valor : valor, idExterno: null })
  }
  const avisos = ignoradas > 0 ? [`${ignoradas} ${ignoradas === 1 ? 'linha foi ignorada' : 'linhas foram ignoradas'} (saldo, totais ou sem data/valor).`] : []
  return { linhas, formato: 'csv', ehCartao: map.positivoEhGasto, avisos }
}
