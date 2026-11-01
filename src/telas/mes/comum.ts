import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import type { Categoria, Contexto } from '../../db/tipos'
import type { Visao } from '../../core/orcamento'

export interface DadosBase {
  contextos: Contexto[]
  categorias: Categoria[]
  categoria: (id: string | null) => Categoria | undefined
  contexto: (id: string) => Contexto | undefined
  pessoalId: string | undefined
}

export function useDadosBase(): DadosBase | undefined {
  const contextos = useLiveQuery(() => db.contextos.orderBy('ordem').toArray(), [])
  const categorias = useLiveQuery(() => db.categorias.orderBy('ordem').toArray(), [])
  if (!contextos || !categorias) return undefined
  const mapaCat = new Map(categorias.map((c) => [c.id, c]))
  const mapaCtx = new Map(contextos.map((c) => [c.id, c]))
  return {
    contextos,
    categorias,
    categoria: (id) => (id ? mapaCat.get(id) : undefined),
    contexto: (id) => mapaCtx.get(id),
    pessoalId: contextos.find((c) => c.tipo === 'pessoal')?.id,
  }
}

export function visaoDe(id: string): Visao {
  return id === 'tudo' ? { tipo: 'tudo' } : { tipo: 'contexto', id }
}

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
/** "seg., 3 de nov." */
export function nomeDia(data: string): string {
  return fmtDia.format(new Date(`${data}T12:00:00Z`))
}
