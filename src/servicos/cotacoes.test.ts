import { describe, expect, it } from 'vitest'
import { buscarCotacoes } from './cotacoes'

const resposta = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo })

describe('cotações', () => {
  it('brapi: um pedido por ativo, preço em centavos, token na URL', async () => {
    const urls: string[] = []
    const r = await buscarCotacoes(['petr4', 'VALE3', 'PETR4'], 'brapi', 'tk', async (url) => {
      urls.push(url)
      return resposta(200, { results: [{ regularMarketPrice: url.includes('PETR4') ? 38.125 : 61.4 }] })
    })
    expect(urls).toEqual(['https://brapi.dev/api/quote/PETR4?token=tk', 'https://brapi.dev/api/quote/VALE3?token=tk'])
    expect([...r.precos]).toEqual([['PETR4', 3813], ['VALE3', 6140]])
  })
  it('brapi: ativo inexistente vira falha e continua; chave inválida para tudo', async () => {
    const r = await buscarCotacoes(['XXXX3', 'VALE3'], 'brapi', '', async (url) => (url.includes('XXXX3') ? resposta(404, {}) : resposta(200, { results: [{ regularMarketPrice: 10 }] })))
    expect(r.falhas).toEqual([{ ticker: 'XXXX3', motivo: 'ativo não encontrado' }])
    expect(r.precos.get('VALE3')).toBe(1000)
    let chamadas = 0
    const r2 = await buscarCotacoes(['A', 'B', 'C'], 'brapi', 'ruim', async () => { chamadas++; return resposta(401, {}) })
    expect(chamadas).toBe(1)
    expect(r2.falhas.map((f) => f.ticker)).toEqual(['A', 'B', 'C'])
  })
  it('Alpha Vantage: sufixo .SA para B3 e limite diário', async () => {
    const urls: string[] = []
    const r = await buscarCotacoes(['ITSA4'], 'alphavantage', 'k', async (url) => { urls.push(url); return resposta(200, { 'Global Quote': { '05. price': '10.2300' } }) })
    expect(urls[0]).toContain('symbol=ITSA4.SA')
    expect(r.precos.get('ITSA4')).toBe(1023)
    const lim = await buscarCotacoes(['ITSA4'], 'alphavantage', 'k', async () => resposta(200, { Note: 'limit' }))
    expect(lim.falhas[0]?.motivo).toBe('limite de consultas atingido')
    const sem = await buscarCotacoes(['ITSA4'], 'alphavantage', '', async () => resposta(200, {}))
    expect(sem.falhas[0]?.motivo).toContain('chave')
  })
})
