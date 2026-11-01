import { dividirEmPartes, type Centavos } from './dinheiro'
import { competenciaDe, dataNaCompetencia, diasEntre, somarMeses, type Competencia, type DataISO } from './datas'

export interface CartaoResumo { id: string; diaFechamento: number; diaVencimento: number }

/** Mês de vencimento da fatura em que cai uma compra feita no cartão nesta data. */
export function competenciaDaFatura(data: DataISO, c: { diaFechamento: number; diaVencimento: number }): Competencia {
  const mes = competenciaDe(data)
  const fechamentoNoMes = dataNaCompetencia(mes, c.diaFechamento)
  // comprou no dia do fechamento ou depois: vai para a próxima fatura
  const mesDoFechamento = data < fechamentoNoMes ? mes : somarMeses(mes, 1)
  return c.diaVencimento > c.diaFechamento ? mesDoFechamento : somarMeses(mesDoFechamento, 1)
}

/** Datas de fechamento e vencimento da fatura que vence no mês informado. */
export function datasDaFatura(competencia: Competencia, c: { diaFechamento: number; diaVencimento: number }): { fechamento: DataISO; vencimento: DataISO } {
  const vencimento = dataNaCompetencia(competencia, c.diaVencimento)
  const mesFechamento = c.diaVencimento > c.diaFechamento ? competencia : somarMeses(competencia, -1)
  return { fechamento: dataNaCompetencia(mesFechamento, c.diaFechamento), vencimento }
}

export type StatusFatura = 'paga' | 'vencida' | 'fechada' | 'aberta' | 'futura'

/**
 * paga · vencida (passou do vencimento sem pagar) · fechada (já fechou, aguardando pagamento)
 * aberta (ainda recebendo compras, é a "do mês") · futura (fecha depois da atual).
 */
export function statusDaFatura(competencia: Competencia, c: { diaFechamento: number; diaVencimento: number }, paga: boolean, hoje: DataISO): StatusFatura {
  if (paga) return 'paga'
  const { fechamento, vencimento } = datasDaFatura(competencia, c)
  if (hoje > vencimento) return 'vencida'
  if (hoje >= fechamento) return 'fechada'
  const anterior = datasDaFatura(somarMeses(competencia, -1), c)
  return hoje >= anterior.fechamento ? 'aberta' : 'futura'
}

export function diasParaVencer(competencia: Competencia, c: { diaFechamento: number; diaVencimento: number }, hoje: DataISO): number {
  return diasEntre(hoje, datasDaFatura(competencia, c).vencimento)
}

export interface ParceladoResumo { id: string; cartaoId: string; descricao: string; valorTotal: Centavos; numeroParcelas: number; primeiraCompetencia: Competencia }
export interface Parcela { competencia: Competencia; numero: number; de: number; valor: Centavos }

/** Parcelas de uma compra parcelada. A sobra de centavos fica na 1ª. */
export function parcelasDe(p: ParceladoResumo): Parcela[] {
  return dividirEmPartes(p.valorTotal, p.numeroParcelas).map((valor, i) => ({
    competencia: somarMeses(p.primeiraCompetencia, i), numero: i + 1, de: p.numeroParcelas, valor,
  }))
}

export function parcelaNoMes(p: ParceladoResumo, competencia: Competencia): Parcela | null {
  return parcelasDe(p).find((x) => x.competencia === competencia) ?? null
}

/** Quanto ainda falta pagar de uma compra parcelada, a partir do mês informado (inclusive). */
export function restanteDoParcelado(p: ParceladoResumo, aPartirDe: Competencia): { valor: Centavos; parcelas: number } {
  const futuras = parcelasDe(p).filter((x) => x.competencia >= aPartirDe)
  return { valor: futuras.reduce((a, x) => a + x.valor, 0), parcelas: futuras.length }
}

export interface ComposicaoFatura {
  compras: Centavos // lançamentos à vista feitos no cartão
  parcelas: Centavos
  projetado: Centavos
  informado: Centavos | null
  valor: Centavos // informado, se houver; senão o projetado
}

/** Valor da fatura: o informado pelo usuário vence a projeção (compras + parcelas). */
export function compor(
  cartao: CartaoResumo,
  competencia: Competencia,
  compras: { data: DataISO; valor: Centavos; cartaoId?: string | null; tipo: 'gasto' | 'renda' }[],
  parcelados: ParceladoResumo[],
  valorInformado: Centavos | null,
): ComposicaoFatura {
  let totalCompras = 0
  for (const l of compras) {
    if (l.cartaoId !== cartao.id) continue
    if (competenciaDaFatura(l.data, cartao) !== competencia) continue
    totalCompras += l.tipo === 'gasto' ? l.valor : -l.valor // estorno lançado como entrada no cartão abate
  }
  const totalParcelas = parcelados.filter((p) => p.cartaoId === cartao.id).reduce((a, p) => a + (parcelaNoMes(p, competencia)?.valor ?? 0), 0)
  const projetado = Math.max(0, totalCompras + totalParcelas)
  return { compras: totalCompras, parcelas: totalParcelas, projetado, informado: valorInformado, valor: valorInformado ?? projetado }
}

/** Id fixo da fatura (cartão + mês): dois aparelhos criando a mesma fatura não duplicam. */
export const idFatura = (cartaoId: string, competencia: Competencia) => `fatura:${cartaoId}:${competencia}`
export const idRotativo = (faturaId: string) => `rotativo:${faturaId}`
