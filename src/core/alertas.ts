import type { Centavos } from './dinheiro'
import { diasEntre, type DataISO } from './datas'
import { nivelLimite } from './orcamento'

export type Gravidade = 'critico' | 'atencao'

export type Alerta =
  | { tipo: 'limite-estourado'; gravidade: Gravidade; categoriaId: string; gasto: Centavos; limite: Centavos }
  | { tipo: 'conta-atrasada'; gravidade: Gravidade; recorrenciaId: string; descricao: string; data: DataISO; valor: Centavos }
  | { tipo: 'fatura-vencendo'; gravidade: Gravidade; faturaId: string; cartao: string; vencimento: DataISO; valor: Centavos }
  | { tipo: 'fatura-vencida'; gravidade: Gravidade; faturaId: string; cartao: string; vencimento: DataISO; valor: Centavos }
  | { tipo: 'meta-atrasada'; gravidade: Gravidade; metaId: string; nome: string }

/** Categorias que passaram do limite no mês. */
export function alertasDeLimite(gastos: Map<string | null, Centavos>, categorias: { id: string; limiteMensal: Centavos | null }[]): Alerta[] {
  const out: Alerta[] = []
  for (const c of categorias) {
    if (c.limiteMensal === null) continue
    const gasto = gastos.get(c.id) ?? 0
    if (nivelLimite(gasto, c.limiteMensal).nivel === 'estourado') {
      out.push({ tipo: 'limite-estourado', gravidade: 'critico', categoriaId: c.id, gasto, limite: c.limiteMensal })
    }
  }
  return out
}

/** Contas que se repetem com data já passada e ainda não lançadas no mês. */
export function alertasDeContasAtrasadas(
  situacao: { recorrencia: { id: string; descricao: string; tipo: 'gasto' | 'renda'; valor: Centavos }; data: DataISO; lancada: boolean }[],
  hoje: DataISO,
): Alerta[] {
  return situacao
    .filter((s) => !s.lancada && s.recorrencia.tipo === 'gasto' && diasEntre(s.data, hoje) > 0)
    .map((s) => ({ tipo: 'conta-atrasada', gravidade: 'atencao', recorrenciaId: s.recorrencia.id, descricao: s.recorrencia.descricao, data: s.data, valor: s.recorrencia.valor }))
}

/** Críticos primeiro; dentro da mesma gravidade, mantém a ordem de entrada. */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  const peso = (a: Alerta) => (a.gravidade === 'critico' ? 0 : 1)
  return alertas.map((a, i) => ({ a, i })).sort((x, y) => peso(x.a) - peso(y.a) || x.i - y.i).map((x) => x.a)
}
