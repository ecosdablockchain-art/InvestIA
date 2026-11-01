import Dexie, { type EntityTable } from 'dexie'
import type {
  Base, CasaAcerto, CasaDespesa, CasaMembro, Cartao, Categoria, CompraParcelada, Contexto, Cotacao,
  Divida, Fatura, Importacao, Investimento, Lancamento, Meta, OperacaoBolsa, PatrimonioMensal,
  Recorrencia, RegraCategoria,
} from './tipos'

export class BancoFinancas extends Dexie {
  contextos!: EntityTable<Contexto, 'id'>
  categorias!: EntityTable<Categoria, 'id'>
  lancamentos!: EntityTable<Lancamento, 'id'>
  recorrencias!: EntityTable<Recorrencia, 'id'>
  regras!: EntityTable<RegraCategoria, 'id'>
  importacoes!: EntityTable<Importacao, 'id'>
  cartoes!: EntityTable<Cartao, 'id'>
  faturas!: EntityTable<Fatura, 'id'>
  parcelados!: EntityTable<CompraParcelada, 'id'>
  dividas!: EntityTable<Divida, 'id'>
  investimentos!: EntityTable<Investimento, 'id'>
  operacoes!: EntityTable<OperacaoBolsa, 'id'>
  cotacoes!: EntityTable<Cotacao, 'id'>
  metas!: EntityTable<Meta, 'id'>
  patrimonio!: EntityTable<PatrimonioMensal, 'id'>
  casaMembros!: EntityTable<CasaMembro, 'id'>
  casaDespesas!: EntityTable<CasaDespesa, 'id'>
  casaAcertos!: EntityTable<CasaAcerto, 'id'>

  constructor(nome = 'financas360') {
    super(nome)
    // Só campos indexados aparecem aqui; os demais são guardados normalmente.
    this.version(1).stores({
      contextos: 'id, ordem',
      categorias: 'id, ordem',
      lancamentos: 'id, competencia, data, contextoId, categoriaId, metaId, recorrenciaId, importacaoId, [contextoId+competencia]',
      recorrencias: 'id, contextoId',
      regras: 'id, &padrao',
      importacoes: 'id, data',
      cartoes: 'id',
      faturas: 'id, cartaoId, competencia, [cartaoId+competencia]',
      parcelados: 'id, cartaoId',
      dividas: 'id, faturaId',
      investimentos: 'id, classe',
      operacoes: 'id, ticker, data',
      cotacoes: 'id',
      metas: 'id',
      patrimonio: 'id, &competencia',
      casaMembros: 'id',
      casaDespesas: 'id, competencia',
      casaAcertos: 'id, competencia',
    })
  }
}

export const db = new BancoFinancas()

export type NovoRegistro<T extends Base> = Omit<T, keyof Base>

export function novoId(): string {
  return crypto.randomUUID()
}

/** Preenche id e datas de criação/atualização. */
export function criar<T extends Base>(dados: NovoRegistro<T>): T {
  const agora = new Date().toISOString()
  return { ...dados, id: novoId(), criadoEm: agora, atualizadoEm: agora } as T
}

export function tocar<T extends Base>(registro: T): T {
  return { ...registro, atualizadoEm: new Date().toISOString() }
}
