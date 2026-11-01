import { lerValor } from '../dinheiro'
import { ehDataISO, type DataISO } from '../datas'
import { normalizar } from '../busca'
import { lerData } from './datas'
import type { LinhaImportada, ResultadoLeitura } from './tipos'

const NUM = String.raw`\(?[-+−]?\s*(?:R\$|US\$)?\s*[-+−]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s*-)?|\(?[-+−]?\s*(?:R\$|US\$)?\s*[-+−]?\s*\d+,\d{2}\)?(?:\s*-)?`
/** Um ou dois valores no fim da linha (ex.: valor + saldo, ou R$ + US$), com D/C opcional. */
const VALORES_NO_FIM = new RegExp(String.raw`(${NUM})\s*([DC])?(?:\s+(${NUM})\s*[DC]?)?\s*$`, 'i')

const MESES: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6,
  jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
}

/** Linhas de resumo que não são transações. */
const RESUMO = /^(saldo|total|subtotal|limite|pagamento minimo|valor (total|minimo|do documento)|fatura (atual|anterior|fechada|aberta)|vencimento|melhor data|encargos (rotativo|financiamento)|cet|iof (rotativo|financiamento)|juros (rotativo|financiamento))\b/

/**
 * "05 de novembro", "05 nov 2026", "ter, 05 nov", "hoje", "ontem" → data, quando a linha é só isso
 * (cabeçalho de dia em prints de app de banco).
 */
export function lerDataCabecalho(linha: string, hoje: DataISO): DataISO | null {
  const n = normalizar(linha).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (n === 'hoje') return hoje
  if (n === 'ontem') return deslocar(hoje, -1)
  const soData = lerData(n, hoje)
  if (soData && /^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$/.test(n)) return soData
  const m = /^(?:(?:seg|ter|qua|qui|sex|sab|dom)[a-z-]*\s+)?(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?$/.exec(n)
  if (!m) return null
  const mes = MESES[m[2] ?? '']
  if (!mes) return null
  const dia = Number(m[1])
  const montar = (ano: number) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  if (m[3]) { const d = montar(Number(m[3])); return ehDataISO(d) ? d : null }
  const anoHoje = Number(hoje.slice(0, 4))
  const d = montar(anoHoje)
  if (!ehDataISO(d)) return null
  return d <= hoje ? d : montar(anoHoje - 1)
}

function deslocar(d: DataISO, dias: number): DataISO {
  return new Date(Date.parse(`${d}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)
}

const SO_VALOR = new RegExp(String.raw`^(${NUM})\s*([DC])?$`, 'i')

/** Em prints de app, o valor às vezes cai na linha de baixo da descrição: junta as duas. */
export function juntarValorDaLinhaDeBaixo(texto: string): string[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < linhas.length; i++) {
    const atual = linhas[i] as string
    const prox = linhas[i + 1]
    if (prox && SO_VALOR.test(prox) && !VALORES_NO_FIM.test(atual) && /[a-z]/i.test(atual)) {
      out.push(`${atual} ${prox}`)
      i++
    } else out.push(atual)
  }
  return out
}

/**
 * Lê texto colado, de PDF ou de foto: cada linha com data no início e valor no fim.
 * Ex.: "05/11 IFOOD *RESTAURANTE 45,90" ou "05/11/2026 PIX RECEBIDO JOAO 1.200,00 C".
 * - Dois valores no fim (valor + saldo, ou R$ + US$): usa o primeiro.
 * - Linhas sem data usam o último cabeçalho de dia visto ("05 de novembro", "Hoje").
 * - Sem sinal, o valor é tratado como gasto, salvo palavras como "recebido" ou "estorno".
 */
export function lerTexto(texto: string, hoje: DataISO): ResultadoLeitura {
  interface Bruta { data: DataISO; descricao: string; abs: number; negativo: boolean; dc: 'D' | 'C' | null; mais: boolean }
  const brutas: Bruta[] = []
  let ignoradas = 0
  let dataAtual: DataISO | null = null
  for (const l of juntarValorDaLinhaDeBaixo(texto)) {
    const cabecalho = lerDataCabecalho(l, hoje)
    if (cabecalho) { dataAtual = cabecalho; continue }

    const mData = /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)\s+/.exec(l)
    const mValor = VALORES_NO_FIM.exec(l)
    const dataLinha = mData ? lerData(mData[1] ?? '', hoje) : null
    const data = dataLinha ?? dataAtual
    if (!mValor || !data) { ignoradas++; continue }
    const inicio = dataLinha && mData ? mData[0].length : 0
    const descricao = l.slice(inicio, l.length - mValor[0].length).replace(/\s+/g, ' ').replace(/[\s:–-]+$/, '').trim()
    if (!descricao || RESUMO.test(normalizar(descricao))) { ignoradas++; continue }

    const bruto = (mValor[1] ?? '').replace(/\s/g, '').replace(/US\$/i, '').replace(/−/g, '-')
    const mais = bruto.includes('+')
    const v = lerValor(bruto.replace('+', ''))
    if (v === null || v === 0) { ignoradas++; continue }
    const dc = (mValor[2]?.toUpperCase() ?? (mais ? 'C' : null)) as 'D' | 'C' | null
    brutas.push({ data, descricao, abs: Math.abs(v), negativo: v < 0, dc, mais })
  }

  // Fatura: a maioria vem sem sinal (compras) e o "-" marca crédito.
  // Extrato: a maioria vem com "-" (saídas) e sem sinal é entrada.
  const semSinal = brutas.filter((b) => !b.dc && !b.negativo).length
  const negativos = brutas.filter((b) => !b.dc && b.negativo).length
  // "+" explícito é coisa de app de banco: + entrada, − saída, sem sinal = saída
  const ehApp = brutas.some((b) => b.mais)
  const ehFatura = !ehApp && semSinal >= negativos
  const linhas: LinhaImportada[] = brutas.map((b) => {
    const pareceEntrada = /\b(recebid[oa]|credito|deposito|estorno|reembolso|salario|cashback)\b/.test(normalizar(b.descricao))
    let entrada: boolean
    if (b.dc) entrada = b.dc === 'C'
    else if (ehApp) entrada = !b.negativo && pareceEntrada
    else if (ehFatura) entrada = b.negativo || pareceEntrada
    else entrada = !b.negativo
    return { data: b.data, descricao: b.descricao, valor: entrada ? b.abs : -b.abs, idExterno: null }
  })
  const avisos = ignoradas > 0 ? [`${ignoradas} ${ignoradas === 1 ? 'linha não foi reconhecida' : 'linhas não foram reconhecidas'} como lançamento (cabeçalhos, totais ou sem data/valor).`] : []
  return { linhas, formato: 'texto', ehCartao: ehFatura && negativos > 0, avisos }
}
