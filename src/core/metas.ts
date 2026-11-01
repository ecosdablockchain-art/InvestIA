import type { Centavos } from './dinheiro'
import { competenciaDe, diferencaMeses, somarMeses, type Competencia, type DataISO } from './datas'

export interface MetaResumo { id: string; valorAlvo: Centavos; valorInicial: Centavos; prazo: DataISO | null; concluida: boolean }
export interface Aporte { metaId: string | null; valor: Centavos; competencia: Competencia; tipo: 'gasto' | 'renda' }

export interface SituacaoMeta {
  atual: Centavos
  falta: Centavos
  progresso: number // 0 a 1
  mesesRestantes: number | null // até o prazo, contando o mês atual
  aporteNecessario: Centavos | null // por mês, para chegar no prazo
  mediaAportes: Centavos // média dos últimos 3 meses
  estado: 'concluida' | 'atrasada' | 'em-risco' | 'em-dia' | 'sem-prazo'
}

/**
 * Valor atual = inicial + aportes (lançamentos de gasto ligados à meta; retiradas como entrada abatem).
 * Atrasada: prazo passou e não chegou. Em risco: a média de aportes dos últimos 3 meses
 * não alcança o aporte necessário.
 */
export function situacaoMeta(m: MetaResumo, aportes: Aporte[], hoje: DataISO): SituacaoMeta {
  const meus = aportes.filter((a) => a.metaId === m.id)
  const somaAportes = meus.reduce((s, a) => s + (a.tipo === 'gasto' ? a.valor : -a.valor), 0)
  const atual = Math.max(0, m.valorInicial + somaAportes)
  const falta = Math.max(0, m.valorAlvo - atual)
  const progresso = m.valorAlvo > 0 ? Math.min(1, atual / m.valorAlvo) : 0
  const agora = competenciaDe(hoje)
  const ultimos = [1, 2, 3].map((n) => somarMeses(agora, -n))
  const mediaAportes = Math.round(meus.filter((a) => ultimos.includes(a.competencia)).reduce((s, a) => s + (a.tipo === 'gasto' ? a.valor : -a.valor), 0) / 3)

  if (m.concluida || falta === 0) return { atual, falta: 0, progresso: 1, mesesRestantes: 0, aporteNecessario: 0, mediaAportes, estado: 'concluida' }
  if (!m.prazo) return { atual, falta, progresso, mesesRestantes: null, aporteNecessario: null, mediaAportes, estado: 'sem-prazo' }
  if (m.prazo < hoje) return { atual, falta, progresso, mesesRestantes: 0, aporteNecessario: falta, mediaAportes, estado: 'atrasada' }
  const mesesRestantes = diferencaMeses(agora, competenciaDe(m.prazo)) + 1
  const aporteNecessario = Math.ceil(falta / mesesRestantes)
  return { atual, falta, progresso, mesesRestantes, aporteNecessario, mediaAportes, estado: mediaAportes >= aporteNecessario ? 'em-dia' : 'em-risco' }
}
