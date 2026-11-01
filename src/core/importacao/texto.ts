import { lerValor } from '../dinheiro'
import type { DataISO } from '../datas'
import { lerData } from './datas'
import type { LinhaImportada, ResultadoLeitura } from './tipos'

const VALOR_NO_FIM = /(-?\s*R?\$?\s*-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?|-?\s*R?\$?\s*-?\d+,\d{2}-?)\s*([DC])?\s*$/i

/**
 * Lê texto colado (do app do banco, e-mail ou fatura): cada linha com data no início e valor no fim.
 * Ex.: "05/11 IFOOD *RESTAURANTE 45,90" ou "05/11/2026 PIX RECEBIDO JOAO 1.200,00 C".
 * Sem sinal, o valor é tratado como gasto (padrão de faturas).
 */
export function lerTexto(texto: string, hoje: DataISO): ResultadoLeitura {
  const linhas: LinhaImportada[] = []
  let ignoradas = 0
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.replace(/\t/g, ' ').trim()
    if (!l) continue
    const mData = /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)\s+/.exec(l)
    const mValor = VALOR_NO_FIM.exec(l)
    const data = mData ? lerData(mData[1] ?? '', hoje) : null
    if (!mData || !mValor || !data) { ignoradas++; continue }
    const bruto = (mValor[1] ?? '').replace(/\s/g, '')
    const v = lerValor(bruto)
    if (v === null || v === 0) { ignoradas++; continue }
    const dc = mValor[2]?.toUpperCase()
    const comSinal = /^-|-$|^\(|^R\$-/.test(bruto)
    const descricao = l.slice(mData[0].length, l.length - mValor[0].length).replace(/\s+/g, ' ').trim() || 'Sem descrição'
    const pareceEntrada = /\b(recebid[oa]|credito|deposito|estorno|reembolso|salario)\b/i.test(descricao.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const valor = dc === 'C' ? Math.abs(v) : dc === 'D' ? -Math.abs(v) : comSinal ? v : pareceEntrada ? Math.abs(v) : -Math.abs(v)
    linhas.push({ data, descricao, valor, idExterno: null })
  }
  const avisos = ignoradas > 0 ? [`${ignoradas} ${ignoradas === 1 ? 'linha não foi reconhecida' : 'linhas não foram reconhecidas'} (precisa ter data no início e valor no fim).`] : []
  return { linhas, formato: 'texto', ehCartao: false, avisos }
}
