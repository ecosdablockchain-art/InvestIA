import type { Centavos } from './dinheiro'
import { somarMeses, type Competencia } from './datas'
import { filtrarVisao, type LancamentoResumo, type ResumoMes, type Visao } from './orcamento'

export interface MesHistorico extends ResumoMes {
  competencia: Competencia
}

/** Entradas, gastos e sobra dos últimos `meses` meses, terminando em `ate` (ordem cronológica). */
export function historicoMensal(lancamentos: LancamentoResumo[], ate: Competencia, meses: number, visao: Visao): MesHistorico[] {
  const lista = Array.from({ length: meses }, (_, i) => somarMeses(ate, i - meses + 1))
  const mapa = new Map(lista.map((c) => [c, { competencia: c, entradas: 0, gastos: 0, sobra: 0 }]))
  for (const l of filtrarVisao(lancamentos, visao)) {
    const m = mapa.get(l.competencia)
    if (!m) continue
    if (l.tipo === 'renda') m.entradas += l.valor
    else m.gastos += l.valor
  }
  for (const m of mapa.values()) m.sobra = m.entradas - m.gastos
  return lista.map((c) => mapa.get(c) as MesHistorico)
}

export interface ComparativoCategoria {
  categoriaId: string | null
  esteMes: Centavos
  mesPassado: Centavos
  media3: Centavos | null // média dos 3 meses anteriores com algum lançamento
}

/** Este mês × mês passado × média dos 3 meses anteriores, por categoria (só gastos). */
export function compararCategorias(lancamentos: LancamentoResumo[], c: Competencia, visao: Visao): ComparativoCategoria[] {
  const doFiltro = filtrarVisao(lancamentos, visao)
  const anteriores = [1, 2, 3].map((n) => somarMeses(c, -n))
  const comDados = anteriores.filter((m) => doFiltro.some((l) => l.competencia === m))
  const passado = somarMeses(c, -1)
  const linhas = new Map<string | null, { esteMes: Centavos; mesPassado: Centavos; soma3: Centavos }>()
  for (const l of doFiltro) {
    if (l.tipo !== 'gasto') continue
    const relevante = l.competencia === c || comDados.includes(l.competencia)
    if (!relevante) continue
    const r = linhas.get(l.categoriaId) ?? { esteMes: 0, mesPassado: 0, soma3: 0 }
    if (l.competencia === c) r.esteMes += l.valor
    else r.soma3 += l.valor
    if (l.competencia === passado) r.mesPassado += l.valor
    linhas.set(l.categoriaId, r)
  }
  return [...linhas.entries()]
    .map(([categoriaId, r]) => ({
      categoriaId,
      esteMes: r.esteMes,
      mesPassado: r.mesPassado,
      media3: comDados.length ? Math.round(r.soma3 / comDados.length) : null,
    }))
    .sort((a, b) => b.esteMes - a.esteMes || (b.media3 ?? 0) - (a.media3 ?? 0))
}

/** Gastos do mês por categoria, do maior para o menor, juntando a cauda em "outras". */
export function rankingCategorias(gastos: Map<string | null, Centavos>, maximo: number): { categoriaId: string | null | 'outras'; valor: Centavos }[] {
  const ordenado = [...gastos.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  if (ordenado.length <= maximo) return ordenado.map(([categoriaId, valor]) => ({ categoriaId, valor }))
  const topo = ordenado.slice(0, maximo - 1).map(([categoriaId, valor]) => ({ categoriaId: categoriaId as string | null | 'outras', valor }))
  const resto = ordenado.slice(maximo - 1).reduce((a, [, v]) => a + v, 0)
  return [...topo, { categoriaId: 'outras', valor: resto }]
}
