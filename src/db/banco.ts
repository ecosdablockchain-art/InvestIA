import Dexie, { type DBCore, type DBCoreMutateRequest, type EntityTable } from 'dexie'
import type {
  AjustesConta, Base, CasaAcerto, CasaDespesa, CasaMembro, Cartao, Categoria, CompraParcelada, Contexto, Cotacao,
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
  /** Registros apagados ainda não enviados à nuvem. id '*' = tabela inteira. */
  _apagados!: EntityTable<Apagado, 'chave'>
  /** Cursores da sincronização. */
  _meta!: EntityTable<{ chave: string; valor: string }, 'chave'>
  ajustesConta!: EntityTable<AjustesConta, 'id'>

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
    // v2: sincronização com a nuvem. Sem índices únicos (dois aparelhos podem criar o mesmo valor).
    this.version(2).stores({
      regras: 'id, padrao',
      patrimonio: 'id, competencia',
      _apagados: 'chave, tabela',
      _meta: 'chave',
    })
    // v3: ajustes da conta (sincronizados)
    this.version(3).stores({ ajustesConta: 'id' })
    this.use({ stack: 'dbcore', name: 'marcar-alteracoes', create: (down) => marcarAlteracoes(down, this) })
  }

  /** Tabelas de dados (sem as internas, que começam com "_"). */
  get tabelasDeDados() {
    return this.tables.filter((t) => !t.name.startsWith('_'))
  }
}

export interface Apagado { chave: string; tabela: string; id: string; em: string }

/** Transação que aplica dados vindos da nuvem: não marca alteração nem apagado (evita eco). */
export const MARCA_REMOTO = '__financas360Remoto'

/**
 * Toda gravação local recebe `_modificadoEm`; todo apagamento local vira um registro em `_apagados`.
 * Assim a sincronização sabe o que enviar, sem depender de cada tela lembrar disso.
 */
function marcarAlteracoes(down: DBCore, banco: BancoFinancas): DBCore {
  return {
    ...down,
    table(nome) {
      const tabela = down.table(nome)
      if (nome.startsWith('_')) return tabela
      return {
        ...tabela,
        mutate(req: DBCoreMutateRequest) {
          const remoto = (req.trans as unknown as Record<string, unknown>)[MARCA_REMOTO] === true
          if (remoto) return tabela.mutate(req)
          if (req.type === 'add' || req.type === 'put') {
            const agora = new Date().toISOString()
            req = { ...req, values: req.values.map((v) => ({ ...(v as object), _modificadoEm: agora })) }
          }
          const ids: string[] | null = req.type === 'delete' ? (req.keys as string[]) : req.type === 'deleteRange' ? ['*'] : null
          if (ids && ids.length > 0) {
            const em = new Date().toISOString()
            const trans = req.trans as unknown as IDBTransaction
            const registrar = () => {
              void Dexie.ignoreTransaction(() =>
                banco._apagados.bulkPut(ids.map((id) => ({ chave: `${nome}:${id}`, tabela: nome, id, em }))))
            }
            // só depois que a transação confirmar (se ela falhar, nada foi apagado)
            if (typeof trans?.addEventListener === 'function') trans.addEventListener('complete', registrar, { once: true })
            else registrar()
          }
          return tabela.mutate(req)
        },
      }
    },
  }
}

/**
 * Banco do usuário logado. Cada conta tem o seu banco no aparelho.
 * `db` é uma ligação viva: depois de `abrirBancoDoUsuario`, todos os módulos enxergam o novo.
 */
export let db = new BancoFinancas('financas360-sem-conta')

export function abrirBancoDoUsuario(usuarioId: string): BancoFinancas {
  if (db.name !== `financas360-${usuarioId}`) {
    db.close()
    db = new BancoFinancas(`financas360-${usuarioId}`)
  }
  return db
}

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
