import type { Centavos } from '../dinheiro'
import type { DataISO } from '../datas'

/** Uma linha lida de extrato/fatura. Valor com sinal: negativo = saiu dinheiro. */
export interface LinhaImportada {
  data: DataISO
  descricao: string
  valor: Centavos
  idExterno: string | null // FITID do OFX, quando existir
}

export interface ResultadoLeitura {
  linhas: LinhaImportada[]
  formato: 'ofx' | 'csv' | 'texto' | 'pdf' | 'imagem'
  /** Fatura de cartão: os valores positivos costumam ser compras. */
  ehCartao: boolean
  avisos: string[]
}
