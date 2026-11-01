import { calcularPosicoes } from '../core/carteira'
import { db, type BancoFinancas } from '../db/banco'
import { lerAjustesConta } from '../db/ajustesConta'
import { buscarCotacoes, type ResultadoCotacoes } from './cotacoes'

const IDADE_MAXIMA_MS = 60 * 60 * 1000 // 1 hora
let emAndamento: Promise<ResultadoCotacoes | null> | null = null
let ultimaTentativa = 0

/**
 * Busca as cotações das posições abertas e grava na conta (vão para todos os aparelhos).
 * `forcar = false`: só se a última cotação tiver mais de 1 hora e não houver tentativa recente.
 */
export function atualizarCotacoes(forcar: boolean, banco: BancoFinancas = db): Promise<ResultadoCotacoes | null> {
  emAndamento ??= (async () => {
    try {
      const tickers = calcularPosicoes(await banco.operacoes.toArray()).filter((p) => p.quantidade > 0).map((p) => p.ticker)
      if (tickers.length === 0) return null
      if (!forcar) {
        if (Date.now() - ultimaTentativa < 10 * 60 * 1000 || !navigator.onLine) return null
        const cotacoes = await banco.cotacoes.toArray()
        const maisVelha = tickers.map((t) => cotacoes.find((c) => c.id === t)?.atualizadaEm ?? '').sort()[0] ?? ''
        if (maisVelha && Date.now() - Date.parse(maisVelha) < IDADE_MAXIMA_MS) return null
      }
      ultimaTentativa = Date.now()
      const { fonteCotacao, chaveCotacao } = await lerAjustesConta(banco)
      if (fonteCotacao === 'alphavantage' && !chaveCotacao) return forcar ? { precos: new Map(), falhas: tickers.map((ticker) => ({ ticker, motivo: 'chave da Alpha Vantage não configurada' })) } : null
      const r = await buscarCotacoes(tickers, fonteCotacao, chaveCotacao)
      const agora = new Date().toISOString()
      if (r.precos.size) await banco.cotacoes.bulkPut([...r.precos].map(([id, preco]) => ({ id, preco, atualizadaEm: agora, fonte: fonteCotacao })))
      return r
    } finally {
      emAndamento = null
    }
  })()
  return emAndamento
}
