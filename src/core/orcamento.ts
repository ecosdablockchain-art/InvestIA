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

/** Total gasto por categoria no mês (só gastos). Chave null = sem categoria. */
export function gastosPorCategoria(lancamentos: LancamentoResumo[], c: Competencia, visao: Visao): Map<string | null, Centavos> {
  const mapa = new Map<string | null, Centavos>()
  for (const l of filtrarVisao(lancamentos, visao)) {
    if (l.competencia !== c || l.tipo !== 'gasto') continue
    mapa.set(l.categoriaId, (mapa.get(l.categoriaId) ?? 0) + l.valor)
  }
  return mapa
}

/**
 * Sugestão de limite: média dos gastos da categoria nos 3 meses anteriores.
 * Só conta meses em que houve algum lançamento (para não puxar a média para baixo
 * nos primeiros meses de uso). Arredonda para cima, em reais inteiros.
 * Retorna null se não houver histórico.
 */
export function sugerirLimite(lancamentos: LancamentoResumo[], categoriaId: string, c: Competencia): Centavos | null {
  const meses = [1, 2, 3].map((n) => anterior(c, n))
  const comDados = meses.filter((m) => lancamentos.some((l) => l.competencia === m))
  if (comDados.length === 0) return null
  let total = 0
  for (const l of lancamentos) {
    if (l.tipo === 'gasto' && l.categoriaId === categoriaId && comDados.includes(l.competencia)) total += l.valor
  }
  if (total === 0) return null
  return Math.ceil(total / comDados.length / 100) * 100
}

function anterior(c: Competencia, n: number): Competencia {
  const total = Math.floor(c / 100) * 12 + (c % 100) - 1 - n
  return Math.floor(total / 12) * 100 + (total % 12) + 1
}
