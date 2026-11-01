import type { Centavos } from './dinheiro'
import { dataNaCompetencia, type Competencia, type DataISO } from './datas'

export interface RecorrenciaResumo {
  id: string
  tipo: 'gasto' | 'renda'
  valor: Centavos
  diaDoMes: number
  inicio: Competencia
  fim: Competencia | null
  ativa: boolean
}

/** A recorrência vale neste mês? */
export function vigente(r: RecorrenciaResumo, c: Competencia): boolean {
  return r.ativa && c >= r.inicio && (r.fim === null || c <= r.fim)
}

export interface SituacaoRecorrencia<R> {
  recorrencia: R
  data: DataISO
  lancada: boolean
}

/** Para cada recorrência vigente no mês: a data prevista e se já foi lançada. */
export function situacaoDoMes<R extends RecorrenciaResumo>(
  recorrencias: R[],
  lancamentos: { recorrenciaId: string | null; competencia: Competencia }[],
  c: Competencia,
): SituacaoRecorrencia<R>[] {
  const lancadas = new Set(lancamentos.filter((l) => l.competencia === c && l.recorrenciaId).map((l) => l.recorrenciaId))
  return recorrencias
    .filter((r) => vigente(r, c))
    .map((r) => ({ recorrencia: r, data: dataNaCompetencia(c, r.diaDoMes), lancada: lancadas.has(r.id) }))
    .sort((a, b) => a.data.localeCompare(b.data))
}

/** Total mensal das recorrências vigentes, separado em gastos e entradas. */
export function totalRecorrente(recorrencias: RecorrenciaResumo[], c: Competencia): { gastos: Centavos; entradas: Centavos } {
  let gastos = 0
  let entradas = 0
  for (const r of recorrencias) {
    if (!vigente(r, c)) continue
    if (r.tipo === 'gasto') gastos += r.valor
    else entradas += r.valor
  }
  return { gastos, entradas }
}
