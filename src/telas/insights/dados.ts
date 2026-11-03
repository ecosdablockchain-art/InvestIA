import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { compor, competenciaDaFatura, idFatura, parcelaNoMes, statusDaFatura } from '../../core/credito'
import { somarMeses } from '../../core/datas'
import { compararCategorias, historicoMensal } from '../../core/historico'
import { gerarInsights, type ResultadoInsights } from '../../core/insights'
import { gastosPorCategoria, type Visao } from '../../core/orcamento'
import { totalRecorrente } from '../../core/recorrencias'
import { usePatrimonio } from '../patrimonio/dados'
import { useAjustesConta } from '../../db/ajustesConta'

export const NOME_META_RESERVA = 'Reserva de emergência'

/** Insights e plano de ação, recalculados ao vivo a cada lançamento. */
export function useInsights(): ResultadoInsights | null {
  const pat = usePatrimonio()
  const ajustes = useAjustesConta()
  const comp = pat?.competencia ?? 0
  const dados = useLiveQuery(async () => {
    if (!comp) return null
    const [lancamentos, categorias, contextos, recorrencias, cartoes, faturas, parcelados] = await Promise.all([
      db.lancamentos.where('competencia').between(somarMeses(comp, -6), somarMeses(comp, 1), true, true).toArray(),
      db.categorias.filter((c) => !c.arquivada).toArray(), db.contextos.toArray(), db.recorrencias.toArray(),
      db.cartoes.filter((c) => !c.arquivado).toArray(), db.faturas.toArray(), db.parcelados.toArray(),
    ])
    return { lancamentos, categorias, contextos, recorrencias, cartoes, faturas, parcelados }
  }, [comp])
  if (!pat || !dados || !ajustes) return null
  const pf = ajustes.perfilFinanceiro

  const pessoal = dados.contextos.find((c) => c.tipo === 'pessoal')?.id
  const visao: Visao = pessoal ? { tipo: 'contexto', id: pessoal } : { tipo: 'tudo' }
  // aporte em meta é dinheiro guardado, não consumo
  const consumo = dados.lancamentos.filter((l) => !l.metaId)
  const ultimoCompleto = somarMeses(comp, -1)

  let faturasAbertas = 0
  for (const c of dados.cartoes) {
    const aberta = competenciaDaFatura(pat.hoje, c)
    for (const x of [somarMeses(aberta, -2), somarMeses(aberta, -1), aberta]) {
      const f = dados.faturas.find((y) => y.id === idFatura(c.id, x))
      if (statusDaFatura(x, c, f?.paga ?? false, pat.hoje) === 'paga') continue
      faturasAbertas += compor(c, x, dados.lancamentos, dados.parcelados, f?.valorInformado ?? null).valor
    }
  }
  // a meta "Reserva de emergência" (criada pelos Insights) também conta como reserva
  const metaReserva = pat.metas.find(({ meta }) => !meta.concluida && meta.nome === NOME_META_RESERVA)
  const reserva = Math.max(pat.reserva, metaReserva?.s.atual ?? 0)
  const negocios = dados.contextos.filter((c) => c.tipo === 'negocio' && !c.arquivado).map((c) => c.id)

  return gerarInsights({
    competencia: comp,
    meses: historicoMensal(consumo, ultimoCompleto, 6, visao),
    mesAtual: historicoMensal(consumo, comp, 1, visao)[0] ?? { competencia: comp, entradas: 0, gastos: 0, sobra: 0 },
    categorias: dados.categorias.map((c) => ({ id: c.id, nome: c.nome, limiteMensal: c.limiteMensal })),
    comparativo: compararCategorias(consumo, ultimoCompleto, visao),
    gastosMesAtual: gastosPorCategoria(consumo, comp, visao),
    gastosFixos: totalRecorrente(dados.recorrencias.filter((r) => !pessoal || r.contextoId === pessoal), comp).gastos,
    dividas: pat.dividas.filter((d) => d.saldo > 0).map((d) => ({ id: d.id, nome: d.nome, saldo: d.saldo, jurosMensal: d.jurosMensal, parcela: d.parcela, origem: d.origem })),
    faturasAbertas,
    parcelasProximoMes: dados.parcelados.reduce((a, p) => a + (parcelaNoMes(p, somarMeses(comp, 1))?.valor ?? 0), 0),
    reserva,
    temMetaReserva: !!metaReserva,
    estimativa: pf ? { renda: pf.rendaMensal, gasto: pf.gastoMensal, rendaVaria: pf.rendaVaria } : null,
    investido: pat.totalInvestido,
    perfil: pat.perfil,
    riscoAcimaDoPerfil: pat.risco?.acimaDoPerfil ?? false,
    temNegocio: dados.lancamentos.some((l) => negocios.includes(l.contextoId) && l.tipo === 'renda'),
    metas: pat.metas.map(({ meta, s }) => ({ nome: meta.nome, falta: s.falta, aporteNecessario: s.aporteNecessario, mediaAportes: s.mediaAportes, estado: s.estado })),
  })
}
