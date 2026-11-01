import type { Centavos } from '../core/dinheiro'
import { normalizarTicker } from '../core/carteira'

export type FonteCotacao = 'brapi' | 'alphavantage'

export interface ResultadoCotacoes {
  precos: Map<string, Centavos>
  falhas: { ticker: string; motivo: string }[]
}

type Buscar = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

const reais = (n: unknown): Centavos | null => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null)

/**
 * Busca a última cotação de cada ticker (B3). Um pedido por ativo, porque os planos
 * gratuitos costumam limitar a 1 ativo por requisição.
 */
export async function buscarCotacoes(tickers: string[], fonte: FonteCotacao, chave: string, buscar: Buscar = fetch as unknown as Buscar): Promise<ResultadoCotacoes> {
  const precos = new Map<string, Centavos>()
  const falhas: ResultadoCotacoes['falhas'] = []
  for (const bruto of [...new Set(tickers.map(normalizarTicker))]) {
    try {
      const preco = fonte === 'brapi' ? await brapi(bruto, chave, buscar) : await alphaVantage(bruto, chave, buscar)
      precos.set(bruto, preco)
    } catch (e) {
      falhas.push({ ticker: bruto, motivo: e instanceof Error ? e.message : 'erro' })
      if (e instanceof Error && /chave|limite/i.test(e.message)) {
        // sem chave válida ou limite atingido: não adianta tentar os outros
        for (const t of tickers.map(normalizarTicker)) if (!precos.has(t) && !falhas.some((f) => f.ticker === t)) falhas.push({ ticker: t, motivo: e.message })
        break
      }
    }
  }
  return { precos, falhas }
}

async function brapi(ticker: string, chave: string, buscar: Buscar): Promise<Centavos> {
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}${chave ? `?token=${encodeURIComponent(chave)}` : ''}`
  const r = await buscar(url)
  if (r.status === 401 || r.status === 403) throw new Error('chave inválida ou plano não permite este ativo')
  if (r.status === 429) throw new Error('limite de consultas atingido')
  if (!r.ok) throw new Error(r.status === 404 ? 'ativo não encontrado' : `erro ${r.status}`)
  const corpo = (await r.json()) as { results?: { symbol?: string; regularMarketPrice?: number }[] }
  const preco = reais(corpo.results?.[0]?.regularMarketPrice)
  if (preco === null) throw new Error('sem preço')
  return preco
}

async function alphaVantage(ticker: string, chave: string, buscar: Buscar): Promise<Centavos> {
  if (!chave) throw new Error('chave da Alpha Vantage não configurada')
  const simbolo = /^[A-Z]{4}\d{1,2}$/.test(ticker) ? `${ticker}.SA` : ticker
  const r = await buscar(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(simbolo)}&apikey=${encodeURIComponent(chave)}`)
  if (!r.ok) throw new Error(`erro ${r.status}`)
  const corpo = (await r.json()) as Record<string, unknown>
  if (corpo.Note || corpo.Information) throw new Error('limite de consultas atingido')
  if (corpo['Error Message']) throw new Error('ativo não encontrado')
  const q = corpo['Global Quote'] as Record<string, string> | undefined
  const preco = reais(Number(q?.['05. price']))
  if (preco === null) throw new Error('ativo não encontrado')
  return preco
}
