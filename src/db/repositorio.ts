import { competenciaDe, type Competencia, type DataISO } from '../core/datas'
import type { Centavos } from '../core/dinheiro'
import { criar, tocar, type BancoFinancas } from './banco'
import type { Lancamento, Recorrencia, TipoLancamento } from './tipos'

export interface DadosLancamento {
  tipo: TipoLancamento
  valor: Centavos
  data: DataISO
  descricao: string
  observacao: string
  categoriaId: string | null
  contextoId: string
  todoMes: boolean
  cartaoId?: string | null
}

export function validarLancamento(d: DadosLancamento): string | null {
  if (!Number.isSafeInteger(d.valor) || d.valor <= 0) return 'Informe um valor maior que zero.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return 'Informe uma data válida.'
  if (!d.contextoId) return 'Escolha a conta.'
  return null
}

/**
 * Cria ou atualiza um lançamento manual.
 * "Todo mês" ligado cria a recorrência a partir deste mês; desligado encerra a recorrência neste mês.
 */
export async function salvarLancamento(banco: BancoFinancas, dados: DadosLancamento, existente?: Lancamento): Promise<Lancamento> {
  const erro = validarLancamento(dados)
  if (erro) throw new Error(erro)
  const competencia = competenciaDe(dados.data)
  const descricao = dados.descricao.trim() || (await nomeCategoria(banco, dados.categoriaId)) || (dados.tipo === 'gasto' ? 'Gasto' : 'Entrada')

  return banco.transaction('rw', banco.lancamentos, banco.recorrencias, banco.categorias, async () => {
    let recorrenciaId = existente?.recorrenciaId ?? null

    if (dados.todoMes && !recorrenciaId) {
      const rec = criar<Recorrencia>({
        descricao, tipo: dados.tipo, valor: dados.valor, categoriaId: dados.categoriaId, contextoId: dados.contextoId,
        diaDoMes: Number(dados.data.slice(8, 10)), inicio: competencia, fim: null, ativa: true,
        cartaoId: dados.tipo === 'gasto' ? dados.cartaoId ?? null : null,
      })
      await banco.recorrencias.add(rec)
      recorrenciaId = rec.id
    } else if (!dados.todoMes && recorrenciaId) {
      const rec = await banco.recorrencias.get(recorrenciaId)
      if (rec && (rec.fim === null || rec.fim > competencia)) {
        await banco.recorrencias.put(tocar({ ...rec, fim: competencia }))
      }
    }

    const campos = {
      tipo: dados.tipo, valor: dados.valor, data: dados.data, competencia, descricao, observacao: dados.observacao.trim(),
      categoriaId: dados.categoriaId, contextoId: dados.contextoId, recorrenciaId,
      cartaoId: dados.tipo === 'gasto' ? dados.cartaoId ?? null : null,
    }
    const lanc: Lancamento = existente
      ? tocar({ ...existente, ...campos })
      : criar<Lancamento>({ ...campos, metaId: null, origem: 'manual', importacaoId: null })
    await banco.lancamentos.put(lanc)
    return lanc
  })
}

async function nomeCategoria(banco: BancoFinancas, id: string | null): Promise<string | null> {
  return id ? (await banco.categorias.get(id))?.nome ?? null : null
}

/** Apaga e devolve o registro, para permitir "Desfazer". */
export async function apagarLancamento(banco: BancoFinancas, id: string): Promise<Lancamento | null> {
  const l = await banco.lancamentos.get(id)
  if (!l) return null
  await banco.lancamentos.delete(id)
  return l
}

export async function restaurarLancamento(banco: BancoFinancas, l: Lancamento): Promise<void> {
  await banco.lancamentos.put(l)
}

/** Lança a conta recorrente no mês informado (se ainda não foi lançada). */
export async function lancarRecorrencia(banco: BancoFinancas, rec: Recorrencia, data: DataISO): Promise<Lancamento | null> {
  const competencia = competenciaDe(data)
  return banco.transaction('rw', banco.lancamentos, async () => {
    const ja = await banco.lancamentos.where('recorrenciaId').equals(rec.id).filter((l) => l.competencia === competencia).count()
    if (ja > 0) return null
    const lanc = criar<Lancamento>({
      tipo: rec.tipo, valor: rec.valor, data, competencia, descricao: rec.descricao, observacao: '',
      categoriaId: rec.categoriaId, contextoId: rec.contextoId, metaId: null, recorrenciaId: rec.id, origem: 'manual', importacaoId: null,
      cartaoId: rec.cartaoId ?? null,
    })
    await banco.lancamentos.add(lanc)
    return lanc
  })
}

export async function salvarRecorrencia(banco: BancoFinancas, rec: Recorrencia): Promise<void> {
  if (rec.valor <= 0) throw new Error('Informe um valor maior que zero.')
  if (rec.diaDoMes < 1 || rec.diaDoMes > 31) throw new Error('Dia do mês deve ser entre 1 e 31.')
  await banco.recorrencias.put(tocar(rec))
}

/** Encerra a recorrência a partir do mês informado (os lançamentos já feitos continuam). */
export async function encerrarRecorrencia(banco: BancoFinancas, id: string, aPartirDe: Competencia): Promise<void> {
  const rec = await banco.recorrencias.get(id)
  if (!rec) return
  const fim = aPartirDe - (aPartirDe % 100 === 1 ? 89 : 1) // mês anterior
  if (fim < rec.inicio) await banco.recorrencias.delete(id)
  else await banco.recorrencias.put(tocar({ ...rec, fim }))
}

export async function definirLimite(banco: BancoFinancas, categoriaId: string, limite: Centavos | null): Promise<void> {
  const c = await banco.categorias.get(categoriaId)
  if (!c) return
  if (limite !== null && limite <= 0) limite = null
  await banco.categorias.put(tocar({ ...c, limiteMensal: limite }))
}
