import type { Centavos } from './dinheiro'

export interface DividaResumo { id: string; nome: string; saldo: Centavos; jurosMensal: number; parcela: Centavos }

/** Juros ao ano equivalentes (composto): (1 + i)^12 − 1. */
export function jurosAnual(mensal: number): number {
  return (1 + mensal) ** 12 - 1
}

/** Avalanche: maior juros primeiro; empate, menor saldo primeiro. */
export function ordenarAvalanche<T extends DividaResumo>(dividas: T[]): T[] {
  return [...dividas].filter((d) => d.saldo > 0).sort((a, b) => b.jurosMensal - a.jurosMensal || a.saldo - b.saldo)
}

export interface ResultadoQuitacao {
  quita: boolean // false = com esses pagamentos a dívida não termina (ou passa de 50 anos)
  meses: number
  jurosTotal: Centavos
  pagoTotal: Centavos
  ordem: { id: string; nome: string; mes: number }[] // em que mês cada dívida termina
  /** Pagamento total em cada mês (para a previsão). */
  porMes: Centavos[]
}

const LIMITE_MESES = 600

/**
 * Simula a quitação pelo método avalanche: todo mês os juros entram, cada dívida recebe a sua
 * parcela, e o dinheiro extra (mais as parcelas de dívidas já quitadas) vai para a de maior juros.
 */
export function simularQuitacao(dividas: DividaResumo[], extraMensal: Centavos = 0): ResultadoQuitacao {
  const ativas = ordenarAvalanche(dividas).map((d) => ({ ...d }))
  const orcamento = ativas.reduce((a, d) => a + d.parcela, 0) + Math.max(0, extraMensal)
  const ordem: ResultadoQuitacao['ordem'] = []
  const porMes: Centavos[] = []
  let juros = 0
  let pago = 0
  let mes = 0
  while (ativas.some((d) => d.saldo > 0)) {
    mes++
    if (mes > LIMITE_MESES) return { quita: false, meses: mes - 1, jurosTotal: juros, pagoTotal: pago, ordem, porMes }
    for (const d of ativas) {
      if (d.saldo <= 0) continue
      const j = Math.round(d.saldo * d.jurosMensal)
      d.saldo += j
      juros += j
    }
    let disponivel = orcamento
    // 1) parcela mínima de cada uma
    for (const d of ativas) {
      if (d.saldo <= 0) continue
      const p = Math.min(d.parcela, d.saldo, disponivel)
      d.saldo -= p; disponivel -= p; pago += p
    }
    // 2) o que sobra vai para a de maior juros (ordem avalanche)
    for (const d of ativas) {
      if (disponivel <= 0) break
      if (d.saldo <= 0) continue
      const p = Math.min(d.saldo, disponivel)
      d.saldo -= p; disponivel -= p; pago += p
    }
    porMes.push(orcamento - disponivel)
    for (const d of ativas) if (d.saldo <= 0 && !ordem.some((o) => o.id === d.id)) ordem.push({ id: d.id, nome: d.nome, mes })
    // sem progresso possível: juros maiores que o pagamento
    if (orcamento === 0) return { quita: false, meses: mes, jurosTotal: juros, pagoTotal: pago, ordem, porMes }
  }
  return { quita: true, meses: mes, jurosTotal: juros, pagoTotal: pago, ordem, porMes }
}

/** Compara pagar só as parcelas com pagar um valor a mais por mês. */
export function compararExtra(dividas: DividaResumo[], extraMensal: Centavos) {
  const base = simularQuitacao(dividas, 0)
  const comExtra = simularQuitacao(dividas, extraMensal)
  return {
    base,
    comExtra,
    mesesAMenos: base.quita && comExtra.quita ? base.meses - comExtra.meses : null,
    economiaJuros: base.quita && comExtra.quita ? base.jurosTotal - comExtra.jurosTotal : null,
  }
}
