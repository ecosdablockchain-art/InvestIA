import { lerValor } from '../dinheiro'
import { lerData } from './datas'
import type { LinhaImportada, ResultadoLeitura } from './tipos'

/** Lê OFX 1.x (SGML, sem tags de fechamento) e 2.x (XML). Conta corrente e cartão. */
export function lerOFX(texto: string): ResultadoLeitura {
  const avisos: string[] = []
  const ehCartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto)
  const blocos = texto.split(/<STMTTRN>/i).slice(1)
  const linhas: LinhaImportada[] = []
  for (const bruto of blocos) {
    const bloco = bruto.split(/<\/STMTTRN>/i)[0] ?? ''
    const data = lerData(campo(bloco, 'DTPOSTED') ?? '')
    const valorTxt = (campo(bloco, 'TRNAMT') ?? '').replace(',', '.')
    const valor = /^-?\d+(\.\d+)?$/.test(valorTxt) ? Math.round(Number(valorTxt) * 100) : lerValor(valorTxt)
    const memo = campo(bloco, 'MEMO')
    const nome = campo(bloco, 'NAME')
    const descricao = limpar(memo && nome && !memo.includes(nome) ? `${nome} ${memo}` : memo || nome || 'Sem descrição')
    if (!data || valor === null) {
      avisos.push(`Uma transação foi ignorada por não ter data ou valor legível.`)
      continue
    }
    linhas.push({ data, descricao, valor, idExterno: campo(bloco, 'FITID') })
  }
  if (blocos.length === 0) avisos.push('Nenhuma transação encontrada no arquivo OFX.')
  return { linhas, formato: 'ofx', ehCartao, avisos }
}

/** Valor de <TAG>…, terminando no fim da linha, na próxima tag ou em </TAG>. */
function campo(bloco: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(bloco)
  const v = m?.[1]?.trim()
  return v ? decodificarEntidades(v) : null
}

function decodificarEntidades(t: string): string {
  return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

function limpar(t: string): string {
  return t.replace(/\s+/g, ' ').trim()
}

export function pareceOFX(texto: string): boolean {
  return /OFXHEADER|<OFX>/i.test(texto.slice(0, 2000))
}
