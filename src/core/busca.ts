import type { DataISO } from './datas'

/** Minúsculas e sem acento, para busca e comparação de textos. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface FiltroLancamentos {
  texto: string
  categoriaId: string | 'todas'
  tipo: 'todos' | 'gasto' | 'renda'
}

export function filtrarLancamentos<T extends { descricao: string; observacao: string; categoriaId: string | null; tipo: 'gasto' | 'renda' }>(
  itens: T[],
  filtro: FiltroLancamentos,
  nomeCategoria: (id: string | null) => string = () => '',
): T[] {
  const termos = normalizar(filtro.texto).split(' ').filter(Boolean)
  return itens.filter((l) => {
    if (filtro.tipo !== 'todos' && l.tipo !== filtro.tipo) return false
    if (filtro.categoriaId !== 'todas' && l.categoriaId !== filtro.categoriaId) return false
    if (termos.length === 0) return true
    const alvo = normalizar(`${l.descricao} ${l.observacao} ${nomeCategoria(l.categoriaId)}`)
    return termos.every((t) => alvo.includes(t))
  })
}

/** Agrupa por data, do dia mais recente para o mais antigo. */
export function agruparPorDia<T extends { data: DataISO }>(itens: T[]): { data: DataISO; itens: T[] }[] {
  const mapa = new Map<DataISO, T[]>()
  for (const i of itens) mapa.set(i.data, [...(mapa.get(i.data) ?? []), i])
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([data, itens]) => ({ data, itens }))
}
