import type { Centavos } from './dinheiro'
import { somarMeses, type Competencia } from './datas'
import { vigente, type RecorrenciaResumo } from './recorrencias'
import type { ResumoMes } from './orcamento'

/** Saída futura já comprometida: parcela de cartão, parcela de dívida etc. (fase 6). */
export interface SaidaPrevista {
  competencia: Competencia
  valor: Centavos
  origem: 'cartao' | 'divida'
}

export interface MesPrevisto {
  competencia: Competencia
  entradas: Centavos
  saidas: Centavos
  saldo: Centavos
  /** O mês atual mistura o que já aconteceu com o que ainda falta. */
  inclui: { realizado: boolean; recorrentes: Centavos; cartao: Centavos; divida: Centavos }
}

/**
 * Previsão de entradas e saídas para os próximos meses.
 * Mês atual: o que já foi lançado + recorrências ainda não lançadas + parcelas.
 * Meses seguintes: recorrências vigentes + parcelas.
 */
export function preverMeses(params: {
  inicio: Competencia
  meses: number
  recorrencias: RecorrenciaResumo[]
  lancadasNoInicio: ReadonlySet<string> // ids de recorrências já lançadas no mês atual
  realizadoInicio: ResumoMes
  saidasPrevistas: SaidaPrevista[]
}): MesPrevisto[] {
  const { inicio, meses, recorrencias, lancadasNoInicio, realizadoInicio, saidasPrevistas } = params
  return Array.from({ length: meses }, (_, i) => {
    const c = somarMeses(inicio, i)
    const atual = i === 0
    let entradas = atual ? realizadoInicio.entradas : 0
    let saidas = atual ? realizadoInicio.gastos : 0
    let recorrentes = 0
    for (const r of recorrencias) {
      if (!vigente(r, c) || (atual && lancadasNoInicio.has(r.id))) continue
      if (r.tipo === 'renda') entradas += r.valor
      else {
        saidas += r.valor
        recorrentes += r.valor
      }
    }
    let cartao = 0
    let divida = 0
    for (const s of saidasPrevistas) {
      if (s.competencia !== c) continue
      if (s.origem === 'cartao') cartao += s.valor
      else divida += s.valor
    }
    saidas += cartao + divida
    return { competencia: c, entradas, saidas, saldo: entradas - saidas, inclui: { realizado: atual, recorrentes, cartao, divida } }
  })
}
