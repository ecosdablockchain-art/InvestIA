import type { Centavos } from './dinheiro'
import type { Competencia } from './datas'

export interface LancamentoResumo {
  tipo: 'gasto' | 'renda'
  valor: Centavos
  competencia: Competencia
  contextoId: string
  categoriaId: string | null
}

export interface ResumoMes {
  entradas: Centavos
  gastos: Centavos
  sobra: Centavos
}

/** Filtro de visão do painel: um contexto específico ou todos. */
export type Visao = { tipo: 'tudo' } | { tipo: 'contexto'; id: string }

export function filtrarVisao<T extends { contextoId: string }>(itens: T[], visao: Visao): T[] {
  return visao.tipo === 'tudo' ? itens : itens.filter((i) => i.contextoId === visao.id)
}

export function resumirMes(lancamentos: LancamentoResumo[], c: Competencia, visao: Visao): ResumoMes {
  let entradas = 0
  let gastos = 0
  for (const l of filtrarVisao(lancamentos, visao)) {
    if (l.competencia !== c) continue
    if (l.tipo === 'renda') entradas += l.valor
    else gastos += l.valor
  }
  return { entradas, gastos, sobra: entradas - gastos }
}

export function patrimonioLiquido(investimentos: { valorAtual: Centavos }[], dividas: { saldo: Centavos }[]): Centavos {
  const ativos = investimentos.reduce((a, i) => a + i.valorAtual, 0)
  const passivos = dividas.reduce((a, d) => a + d.saldo, 0)
  return ativos - passivos
}

export type NivelLimite = 'ok' | 'atencao' | 'estourado'

/** Verde até 80%, amarelo de 80% a 100%, vermelho acima de 100%. */
export function nivelLimite(gasto: Centavos, limite: Centavos): { nivel: NivelLimite; percentual: number } {
  if (limite <= 0) return { nivel: gasto > 0 ? 'estourado' : 'ok', percentual: gasto > 0 ? 100 : 0 }
  const percentual = (gasto / limite) * 100
  const nivel: NivelLimite = percentual > 100 ? 'estourado' : percentual >= 80 ? 'atencao' : 'ok'
  return { nivel, percentual }
}
