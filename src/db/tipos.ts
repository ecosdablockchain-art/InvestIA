import type { Centavos } from '../core/dinheiro'
import type { Competencia, DataISO } from '../core/datas'

/** Campos comuns. IDs são UUID para permitir sincronização no futuro. */
export interface Base {
  id: string
  criadoEm: string // ISO com hora (UTC)
  atualizadoEm: string
}

export type TipoContexto = 'pessoal' | 'negocio'
/** Pessoal ou um negócio (ex.: Machine Clean). Todo lançamento pertence a um contexto. */
export interface Contexto extends Base {
  nome: string
  tipo: TipoContexto
  icone: string
  cor: string
  ordem: number
  arquivado: boolean
}

export type TipoCategoria = 'gasto' | 'renda' | 'ambos'
export interface Categoria extends Base {
  nome: string
  icone: string
  tipo: TipoCategoria
  limiteMensal: Centavos | null
  ordem: number
  padrao: boolean
  arquivada: boolean
}

export type TipoLancamento = 'gasto' | 'renda'
export type OrigemLancamento = 'manual' | 'importacao' | 'casa' | 'mesa'
export interface Lancamento extends Base {
  tipo: TipoLancamento
  valor: Centavos // sempre positivo; o tipo define o sinal
  data: DataISO
  competencia: Competencia
  descricao: string
  observacao: string
  categoriaId: string | null
  contextoId: string
  metaId: string | null // aporte em meta
  recorrenciaId: string | null
  origem: OrigemLancamento
  importacaoId: string | null
  idExterno?: string | null
  /** Compra feita no cartão (entra na fatura). null = dinheiro, Pix ou débito. */
  cartaoId?: string | null
}

/** Molde do que se repete todo mês. Alimenta "contas que se repetem" e a previsão. */
export interface Recorrencia extends Base {
  descricao: string
  tipo: TipoLancamento
  valor: Centavos
  categoriaId: string | null
  contextoId: string
  diaDoMes: number
  inicio: Competencia
  fim: Competencia | null
  ativa: boolean
  cartaoId?: string | null
}

export interface RegraCategoria extends Base {
  padrao: string // texto normalizado do estabelecimento
  categoriaId: string
  contextoId: string | null
  vezesUsada: number
}

export type FormatoImportacao = 'ofx' | 'csv' | 'pdf' | 'imagem' | 'texto' | 'backup'
export interface Importacao extends Base {
  data: string
  nomeArquivo: string
  formato: FormatoImportacao
  linhasLidas: number
  lancamentosGerados: number
}

export interface Cartao extends Base {
  apelido: string
  banco: string
  limite: Centavos
  diaFechamento: number
  diaVencimento: number
  cor: string
  arquivado: boolean
}

export interface Fatura extends Base {
  cartaoId: string
  competencia: Competencia // mês de vencimento
  valorInformado: Centavos | null // null = usar projeção das parcelas
  paga: boolean
  pagaEm: DataISO | null
  /** O rotativo desta fatura já foi criado uma vez (não recriar se o usuário apagar). */
  rotativoGerado?: boolean
}

export interface CompraParcelada extends Base {
  cartaoId: string
  descricao: string
  valorTotal: Centavos
  numeroParcelas: number
  primeiraCompetencia: Competencia
}

export type OrigemDivida = 'manual' | 'rotativo'
export interface Divida extends Base {
  nome: string
  saldo: Centavos
  jurosMensal: number // fração: 0,0299 = 2,99% a.m.
  parcela: Centavos
  parcelasRestantes: number | null
  origem: OrigemDivida
  faturaId: string | null
}

export type ClasseInvestimento =
  | 'rendaFixa' | 'reserva' | 'previdencia' | 'exterior' | 'cripto'
  | 'contaOpcoes' | 'mesaProprietaria' | 'outros'
export type Liquidez = 'diaria' | 'dMais' | 'noVencimento'
export interface Investimento extends Base {
  nome: string
  classe: ClasseInvestimento
  instituicao: string
  aplicado: Centavos
  valorAtual: Centavos
  liquidez: Liquidez
  diasParaResgate: number | null // para D+N
  vencimento: DataISO | null
}

export type TipoAtivo = 'fii' | 'acao' | 'etf' | 'bdr'
export interface OperacaoBolsa extends Base {
  ticker: string
  tipoAtivo: TipoAtivo
  lado: 'compra' | 'venda'
  quantidade: number // inteiro de cotas/ações
  preco: Centavos // por unidade
  custos: Centavos // taxas e emolumentos
  data: DataISO
  corretora: string
}

/** Cache da última cotação, para funcionar offline. id = ticker. */
export interface Cotacao {
  id: string
  preco: Centavos
  atualizadaEm: string
  fonte: string
}

export interface Meta extends Base {
  nome: string
  icone: string
  valorAlvo: Centavos
  valorInicial: Centavos // o valor atual = inicial + aportes vinculados
  prazo: DataISO | null
  prioridade: 1 | 2 | 3
  concluida: boolean
}

export interface PatrimonioMensal extends Base {
  competencia: Competencia
  totalInvestido: Centavos
  totalDividas: Centavos
}

/** Ajustes da conta: valem em todos os aparelhos (vão para a nuvem). id fixo 'conta'. */
export interface AjustesConta extends Base {
  perfil: 'conservador' | 'moderado' | 'arrojado'
  fonteCotacao: 'brapi' | 'alphavantage'
  chaveCotacao: string
  taxaRotativoMensal: number
  notificacoes?: { fatura: boolean; limite: boolean; semanal: boolean }
  /** Chave da API do Claude (Consultor). */
  chaveClaude?: string
  /** Mostrar nível, missões e conquistas. */
  jogoAtivo?: boolean
}

export interface CasaMembro extends Base {
  nome: string
  percentual: number // 0 a 100
  souEu: boolean
}

export interface CasaDespesa extends Base {
  descricao: string
  valor: Centavos
  data: DataISO
  competencia: Competencia
  categoriaId: string | null
  pagoPorId: string | null
  lancamentoPessoalId: string | null
}

export interface CasaAcerto extends Base {
  competencia: Competencia
  deId: string
  paraId: string
  valor: Centavos
  data: DataISO
}
