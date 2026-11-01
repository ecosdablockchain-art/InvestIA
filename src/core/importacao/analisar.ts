import type { DataISO } from '../datas'
import { categoriaPorPalavra, jaLancado, marcarParesDeTransferencia, regraPara, tipoDaLinha, type Existente, type Regra, type TipoLinha } from './classificar'
import type { LinhaImportada } from './tipos'

export interface LinhaAnalisada extends LinhaImportada {
  tipo: TipoLinha
  duplicado: boolean
  selecionada: boolean
  /** id da categoria vinda de regra do usuário, ou null */
  categoriaIdRegra: string | null
  contextoIdRegra: string | null
  /** nome de categoria padrão sugerido por palavra-chave, ou null */
  categoriaNomeSugerida: string | null
}

/** Classifica todas as linhas de um arquivo e decide o que vem marcado. */
export function analisar(linhas: LinhaImportada[], regras: Regra[], existentes: Existente[]): LinhaAnalisada[] {
  const tipos = marcarParesDeTransferencia(linhas, linhas.map(tipoDaLinha))
  return linhas.map((l, i) => {
    const tipo = tipos[i] ?? 'gasto'
    const duplicado = jaLancado(l, existentes)
    const regra = regraPara(l.descricao, regras)
    return {
      ...l,
      tipo,
      duplicado,
      selecionada: !duplicado && (tipo === 'gasto' || tipo === 'entrada'),
      categoriaIdRegra: regra?.categoriaId ?? null,
      contextoIdRegra: regra?.contextoId ?? null,
      categoriaNomeSugerida: regra ? null : categoriaPorPalavra(l.descricao, tipo),
    }
  })
}

/** Inverte o sinal de tudo (fatura de cartão em CSV com compras positivas) e reclassifica. */
export function inverterSinais(linhas: LinhaImportada[]): LinhaImportada[] {
  return linhas.map((l) => ({ ...l, valor: -l.valor }))
}

export function periodo(linhas: { data: DataISO }[]): { de: DataISO; ate: DataISO } | null {
  if (linhas.length === 0) return null
  const ds = linhas.map((l) => l.data).sort()
  return { de: ds[0] as DataISO, ate: ds[ds.length - 1] as DataISO }
}
