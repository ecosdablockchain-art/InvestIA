import type { Centavos } from '../core/dinheiro'
import { competenciaDe, type DataISO } from '../core/datas'
import { criar, tocar, type BancoFinancas } from './banco'
import type { FormatoImportacao, Importacao, Lancamento, RegraCategoria, TipoLancamento } from './tipos'

export interface ItemParaLancar {
  data: DataISO
  descricao: string
  valor: Centavos // positivo
  tipo: TipoLancamento
  categoriaId: string | null
  contextoId: string
  idExterno: string | null
}

export interface RegraAprendida { padrao: string; categoriaId: string; contextoId: string | null }

/** Grava a importação, os lançamentos e as regras aprendidas de uma vez (tudo ou nada). */
export async function lancarImportacao(banco: BancoFinancas, dados: {
  nomeArquivo: string; formato: FormatoImportacao; linhasLidas: number; itens: ItemParaLancar[]; regras: RegraAprendida[]
}): Promise<Importacao> {
  if (dados.itens.length === 0) throw new Error('Nenhum item selecionado.')
  return banco.transaction('rw', banco.importacoes, banco.lancamentos, banco.regras, async () => {
    const imp = criar<Importacao>({
      data: new Date().toISOString(), nomeArquivo: dados.nomeArquivo, formato: dados.formato,
      linhasLidas: dados.linhasLidas, lancamentosGerados: dados.itens.length,
    })
    await banco.importacoes.add(imp)
    await banco.lancamentos.bulkAdd(dados.itens.map((i) => criar<Lancamento>({
      tipo: i.tipo, valor: Math.abs(i.valor), data: i.data, competencia: competenciaDe(i.data), descricao: i.descricao.trim() || 'Sem descrição',
      observacao: '', categoriaId: i.categoriaId, contextoId: i.contextoId, metaId: null, recorrenciaId: null,
      origem: 'importacao', importacaoId: imp.id, idExterno: i.idExterno,
    })))
    for (const r of dados.regras) await aprenderRegra(banco, r)
    return imp
  })
}

/** Cria ou atualiza a regra "texto do estabelecimento → categoria". */
export async function aprenderRegra(banco: BancoFinancas, r: RegraAprendida): Promise<void> {
  if (!r.padrao) return
  const existente = await banco.regras.where('padrao').equals(r.padrao).first()
  if (existente) {
    await banco.regras.put(tocar({ ...existente, categoriaId: r.categoriaId, contextoId: r.contextoId, vezesUsada: existente.vezesUsada + 1 }))
  } else {
    await banco.regras.add(criar<RegraCategoria>({ padrao: r.padrao, categoriaId: r.categoriaId, contextoId: r.contextoId, vezesUsada: 1 }))
  }
}

/** Apaga a importação e todos os lançamentos que ela criou. Retorna quantos foram apagados. */
export async function desfazerImportacao(banco: BancoFinancas, id: string): Promise<number> {
  return banco.transaction('rw', banco.importacoes, banco.lancamentos, async () => {
    const n = await banco.lancamentos.where('importacaoId').equals(id).delete()
    await banco.importacoes.delete(id)
    return n
  })
}
