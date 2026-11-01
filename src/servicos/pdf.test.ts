import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lerPdf, SenhaPdfErro } from './pdf'
import { lerTexto } from '../core/importacao/texto'
import { analisar } from '../core/importacao/analisar'

const arquivo = (n: string) => new Uint8Array(readFileSync(join(__dirname, '../core/importacao/exemplos', n)))
const HOJE = '2026-11-20'

describe('PDF', () => {
  it('fatura: lê as linhas e cada compra vira gasto, crédito vira entrada', async () => {
    const pdf = await lerPdf(arquivo('fatura-cartao.pdf'))
    expect(pdf.temTexto).toBe(true)
    expect(pdf.linhas).toContain('05/10 IFOOD *RESTAURANTE EXEMPLO 45,90 0,00')
    const r = lerTexto(pdf.linhas.join('\n'), HOJE)
    expect(r.linhas.map((l) => [l.data, l.descricao, l.valor])).toEqual([
      ['2026-10-05', 'IFOOD *RESTAURANTE EXEMPLO', -4590],
      ['2026-10-07', 'MERCADOLIVRE*LOJA EXEMPLO 03/10', -19990],
      ['2026-10-10', 'PAGAMENTO DE FATURA', 235075],
      ['2026-10-12', 'NETFLIX.COM', -5590],
      ['2026-10-15', 'AMAZON AWS', -3012], // usa o valor em R$, não o US$
      ['2026-10-18', 'ESTORNO LOJA EXEMPLO', 1990],
      ['2026-10-20', 'AUTO POSTO EXEMPLO', -25000],
      ['2026-10-22', 'PADARIA PÃO QUENTE', -1850],
    ])
    // pagamento da fatura vem desmarcado na conferência
    const a = analisar(r.linhas, [], [])
    expect(a.find((l) => l.descricao === 'PAGAMENTO DE FATURA')?.selecionada).toBe(false)
  })

  it('pede senha e recusa senha errada', async () => {
    await expect(lerPdf(arquivo('fatura-cartao-senha.pdf'))).rejects.toMatchObject({ incorreta: false })
    await expect(lerPdf(arquivo('fatura-cartao-senha.pdf'), 'errada')).rejects.toBeInstanceOf(SenhaPdfErro)
    await expect(lerPdf(arquivo('fatura-cartao-senha.pdf'), 'errada')).rejects.toMatchObject({ incorreta: true })
    const pdf = await lerPdf(arquivo('fatura-cartao-senha.pdf'), '12345')
    expect(lerTexto(pdf.linhas.join('\n'), HOJE).linhas).toHaveLength(8)
  })

  it('extrato: usa o valor e ignora a coluna de saldo', async () => {
    const pdf = await lerPdf(arquivo('extrato-conta.pdf'))
    const r = lerTexto(pdf.linhas.join('\n'), HOJE)
    expect(r.linhas.map((l) => [l.descricao, l.valor])).toEqual([
      ['PIX ENVIADO JOAO EXEMPLO', -12000],
      ['TED RECEBIDA SALARIO', 650000],
      ['COMPRA CARTAO DEB PADARIA', -1850],
      ['CONTA DE LUZ ENEL', -21035],
    ])
  })

  it('PDF escaneado: avisa que precisa de OCR', async () => {
    const pdf = await lerPdf(arquivo('escaneado.pdf'))
    expect(pdf.temTexto).toBe(false)
  })
})
