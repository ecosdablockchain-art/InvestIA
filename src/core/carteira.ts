import type { Centavos } from './dinheiro'
import type { DataISO } from './datas'

export type TipoAtivo = 'fii' | 'acao' | 'etf' | 'bdr'

export interface OperacaoResumo {
  id: string; ticker: string; tipoAtivo: TipoAtivo; lado: 'compra' | 'venda'
  quantidade: number; preco: Centavos; custos: Centavos; data: DataISO; criadoEm?: string
}

export interface Posicao {
  ticker: string
  tipoAtivo: TipoAtivo
  quantidade: number
  custoTotal: Centavos // quanto custou o que ainda tenho (com taxas)
  precoMedio: Centavos // por unidade, arredondado
  resultadoRealizado: Centavos // lucro/prejuízo das vendas
  /** venda maior que a posição em alguma data (dado incoerente) */
  vendaDescoberta: boolean
}

/**
 * Posições a partir das operações. Compra soma ao custo (preço × qtd + taxas);
 * venda tira a quantidade pelo preço médio e realiza o resultado (preço − PM) × qtd − taxas.
 * O preço médio não muda na venda e zera quando a posição zera.
 */
export function calcularPosicoes(operacoes: OperacaoResumo[]): Posicao[] {
  const ordenadas = [...operacoes].sort((a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? '').localeCompare(b.criadoEm ?? ''))
  const mapa = new Map<string, { tipoAtivo: TipoAtivo; qtd: number; custo: number; realizado: number; descoberta: boolean }>()
  for (const o of ordenadas) {
    const t = normalizarTicker(o.ticker)
    const p = mapa.get(t) ?? { tipoAtivo: o.tipoAtivo, qtd: 0, custo: 0, realizado: 0, descoberta: false }
    p.tipoAtivo = o.tipoAtivo
    if (o.lado === 'compra') {
      p.qtd += o.quantidade
      p.custo += o.preco * o.quantidade + o.custos
    } else {
      const vendida = Math.min(o.quantidade, p.qtd)
      if (o.quantidade > p.qtd) p.descoberta = true
      const custoSaida = p.qtd > 0 ? Math.round((p.custo * vendida) / p.qtd) : 0
      p.realizado += o.preco * vendida - custoSaida - o.custos
      p.custo -= custoSaida
      p.qtd -= vendida
      if (p.qtd === 0) p.custo = 0
    }
    mapa.set(t, p)
  }
  return [...mapa.entries()].map(([ticker, p]) => ({
    ticker, tipoAtivo: p.tipoAtivo, quantidade: p.qtd, custoTotal: p.custo,
    precoMedio: p.qtd > 0 ? Math.round(p.custo / p.qtd) : 0,
    resultadoRealizado: p.realizado, vendaDescoberta: p.descoberta,
  })).sort((a, b) => a.ticker.localeCompare(b.ticker))
}

export function normalizarTicker(t: string): string {
  return t.trim().toUpperCase().replace(/\.SA$/, '')
}

export interface PosicaoAvaliada extends Posicao {
  cotacao: Centavos | null
  valorAtual: Centavos // qtd × cotação (ou o custo, sem cotação)
  resultado: Centavos
  resultadoPct: number | null
  peso: number // fração da carteira de bolsa
}

export function avaliarPosicoes(posicoes: Posicao[], cotacoes: Map<string, Centavos>): PosicaoAvaliada[] {
  const abertas = posicoes.filter((p) => p.quantidade > 0)
  const avaliadas = abertas.map((p) => {
    const cotacao = cotacoes.get(p.ticker) ?? null
    const valorAtual = cotacao !== null ? cotacao * p.quantidade : p.custoTotal
    const resultado = valorAtual - p.custoTotal
    return { ...p, cotacao, valorAtual, resultado, resultadoPct: cotacao !== null && p.custoTotal > 0 ? resultado / p.custoTotal : null, peso: 0 }
  })
  const total = avaliadas.reduce((a, p) => a + p.valorAtual, 0)
  return avaliadas.map((p) => ({ ...p, peso: total > 0 ? p.valorAtual / total : 0 })).sort((a, b) => b.valorAtual - a.valorAtual)
}

// ---------- alocação, risco e perfil ----------

export type Classe =
  | 'reserva' | 'rendaFixa' | 'previdencia' | 'fii' | 'acao' | 'etf' | 'bdr'
  | 'exterior' | 'cripto' | 'contaOpcoes' | 'mesaProprietaria' | 'outros'

export const NOME_CLASSE: Record<Classe, string> = {
  reserva: 'Reserva', rendaFixa: 'Renda fixa', previdencia: 'Previdência', fii: 'FIIs', acao: 'Ações', etf: 'ETFs',
  bdr: 'BDRs', exterior: 'Exterior', cripto: 'Cripto', contaOpcoes: 'Conta de opções', mesaProprietaria: 'Mesa proprietária', outros: 'Outros',
}

/** Risco de 1 (baixo) a 5 (muito alto), uma régua simples por classe. */
export const RISCO_CLASSE: Record<Classe, number> = {
  reserva: 1, rendaFixa: 1.5, previdencia: 2, fii: 3, etf: 3.5, exterior: 3.5, outros: 3, acao: 4, bdr: 4, cripto: 5, contaOpcoes: 5, mesaProprietaria: 5,
}

export function alocacao(itens: { classe: Classe; valor: Centavos }[]): { classe: Classe; valor: Centavos; fracao: number }[] {
  const mapa = new Map<Classe, Centavos>()
  for (const i of itens) if (i.valor > 0) mapa.set(i.classe, (mapa.get(i.classe) ?? 0) + i.valor)
  const total = [...mapa.values()].reduce((a, b) => a + b, 0)
  return [...mapa.entries()].map(([classe, valor]) => ({ classe, valor, fracao: total ? valor / total : 0 })).sort((a, b) => b.valor - a.valor)
}

export type Perfil = 'conservador' | 'moderado' | 'arrojado'
const TETO_PERFIL: Record<Perfil, number> = { conservador: 2, moderado: 3.2, arrojado: 5 }

/** Média do risco ponderada pelo valor, e se combina com o perfil escolhido. */
export function riscoDaCarteira(aloc: { classe: Classe; fracao: number }[], perfil: Perfil) {
  if (aloc.length === 0) return null
  const nota = aloc.reduce((a, x) => a + RISCO_CLASSE[x.classe] * x.fracao, 0)
  const nivel = nota <= 2 ? 'Baixo' : nota <= 3.2 ? 'Moderado' : nota <= 4 ? 'Alto' : 'Muito alto'
  const ordem: Perfil[] = ['conservador', 'moderado', 'arrojado']
  const sugerido = ordem.find((p) => nota <= TETO_PERFIL[p]) ?? 'arrojado'
  return { nota, nivel, perfilDaCarteira: sugerido, acimaDoPerfil: nota > TETO_PERFIL[perfil] }
}

// ---------- reserva de emergência ----------

/** Quantos meses de gasto a reserva (liquidez diária) cobre. */
export function mesesDeReserva(reserva: Centavos, gastoMensalMedio: Centavos): number | null {
  if (gastoMensalMedio <= 0) return null
  return reserva / gastoMensalMedio
}

export function situacaoReserva(meses: number | null): 'sem-dados' | 'baixa' | 'ok' | 'otima' {
  if (meses === null) return 'sem-dados'
  return meses < 3 ? 'baixa' : meses < 6 ? 'ok' : 'otima'
}
