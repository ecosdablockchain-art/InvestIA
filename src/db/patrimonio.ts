import type { Centavos } from '../core/dinheiro'
import type { Competencia, DataISO } from '../core/datas'
import { normalizarTicker } from '../core/carteira'
import { criar, tocar, type BancoFinancas, type NovoRegistro } from './banco'
import { salvarLancamento } from './repositorio'
import type { Investimento, Meta, OperacaoBolsa } from './tipos'

export type DadosOperacao = NovoRegistro<OperacaoBolsa>

export function validarOperacao(d: DadosOperacao): string | null {
  const t = normalizarTicker(d.ticker)
  if (!/^[A-Z0-9]{4,6}[0-9]{0,2}F?$/.test(t)) return 'Código do ativo inválido (ex.: PETR4, HGLG11, IVVB11).'
  if (!Number.isInteger(d.quantidade) || d.quantidade <= 0) return 'Quantidade deve ser um número inteiro maior que zero.'
  if (!Number.isSafeInteger(d.preco) || d.preco <= 0) return 'Informe o preço por unidade.'
  if (!Number.isSafeInteger(d.custos) || d.custos < 0) return 'Taxas inválidas.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return 'Informe a data.'
  return null
}

export async function salvarOperacao(banco: BancoFinancas, d: DadosOperacao, existente?: OperacaoBolsa): Promise<OperacaoBolsa> {
  const erro = validarOperacao(d)
  if (erro) throw new Error(erro)
  const dados = { ...d, ticker: normalizarTicker(d.ticker).replace(/F$/, ''), corretora: d.corretora.trim() }
  const o = existente ? tocar({ ...existente, ...dados }) : criar<OperacaoBolsa>(dados)
  await banco.operacoes.put(o)
  return o
}

export type DadosInvestimento = NovoRegistro<Investimento>

export async function salvarInvestimento(banco: BancoFinancas, d: DadosInvestimento, existente?: Investimento): Promise<Investimento> {
  if (!d.nome.trim()) throw new Error('Dê um nome ao investimento.')
  if (d.aplicado < 0 || d.valorAtual < 0) throw new Error('Valores inválidos.')
  const i = existente ? tocar({ ...existente, ...d, nome: d.nome.trim() }) : criar<Investimento>({ ...d, nome: d.nome.trim() })
  await banco.investimentos.put(i)
  return i
}

export type DadosMeta = NovoRegistro<Meta>

export async function salvarMeta(banco: BancoFinancas, d: DadosMeta, existente?: Meta): Promise<Meta> {
  if (!d.nome.trim()) throw new Error('Dê um nome à meta.')
  if (!Number.isSafeInteger(d.valorAlvo) || d.valorAlvo <= 0) throw new Error('Informe o valor que quer juntar.')
  if (d.valorInicial < 0) throw new Error('Valor inicial inválido.')
  const m = existente ? tocar({ ...existente, ...d, nome: d.nome.trim() }) : criar<Meta>({ ...d, nome: d.nome.trim() })
  await banco.metas.put(m)
  return m
}

/** Apaga a meta; os aportes continuam como lançamentos, sem a meta. */
export async function apagarMeta(banco: BancoFinancas, id: string): Promise<void> {
  await banco.transaction('rw', banco.metas, banco.lancamentos, async () => {
    await banco.lancamentos.where('metaId').equals(id).modify({ metaId: null })
    await banco.metas.delete(id)
  })
}

/** Aporte em meta = lançamento de gasto em "Investimentos e trading" ligado à meta. */
export async function registrarAporte(banco: BancoFinancas, meta: Meta, valor: Centavos, data: DataISO, contextoId: string, retirada = false) {
  const cat = await banco.categorias.filter((c) => c.nome === 'Investimentos e trading').first()
  return salvarLancamento(banco, {
    tipo: retirada ? 'renda' : 'gasto', valor, data, descricao: `${retirada ? 'Retirada' : 'Aporte'}: ${meta.nome}`, observacao: '',
    categoriaId: cat?.id ?? null, contextoId, todoMes: false, metaId: meta.id,
  })
}

/** Guarda a foto do patrimônio do mês (id fixo: uma por mês, sem duplicar entre aparelhos). Só grava se mudou. */
export async function registrarPatrimonioDoMes(banco: BancoFinancas, competencia: Competencia, totalInvestido: Centavos, totalDividas: Centavos): Promise<boolean> {
  const id = `patrimonio:${competencia}`
  const atual = await banco.patrimonio.get(id)
  if (atual && atual.totalInvestido === totalInvestido && atual.totalDividas === totalDividas) return false
  const agora = new Date().toISOString()
  await banco.patrimonio.put(atual ? { ...atual, totalInvestido, totalDividas, atualizadoEm: agora } : { id, criadoEm: agora, atualizadoEm: agora, competencia, totalInvestido, totalDividas })
  return true
}
