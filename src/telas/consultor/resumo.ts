import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { compor, competenciaDaFatura, idFatura, restanteDoParcelado, statusDaFatura } from '../../core/credito'
import { NOME_CLASSE } from '../../core/carteira'
import { somarMeses } from '../../core/datas'
import { resumirMes } from '../../core/orcamento'
import { totalRecorrente } from '../../core/recorrencias'
import { montarResumo } from '../../core/resumoConsultor'
import { usePatrimonio } from '../patrimonio/dados'

/** Resumo agregado das finanças para o Consultor (ao vivo). */
export function useResumoConsultor(): string | null {
  const pat = usePatrimonio()
  const comp = pat?.competencia ?? 0
  const dados = useLiveQuery(async () => {
    if (!comp) return null
    const [lancamentos, categorias, contextos, recorrencias, cartoes, faturas, parcelados] = await Promise.all([
      db.lancamentos.where('competencia').between(somarMeses(comp, -3), comp, true, true).toArray(),
      db.categorias.toArray(), db.contextos.toArray(), db.recorrencias.toArray(),
      db.cartoes.filter((c) => !c.arquivado).toArray(), db.faturas.toArray(), db.parcelados.toArray(),
    ])
    return { lancamentos, categorias, contextos, recorrencias, cartoes, faturas, parcelados }
  }, [comp])
  if (!pat || !dados) return null
  const pessoal = dados.contextos.find((c) => c.tipo === 'pessoal')?.id
  const visaoPessoal = pessoal ? { tipo: 'contexto' as const, id: pessoal } : { tipo: 'tudo' as const }
  let faturasAbertas = 0
  for (const c of dados.cartoes) {
    const aberta = competenciaDaFatura(pat.hoje, c)
    for (const x of [somarMeses(aberta, -2), somarMeses(aberta, -1), aberta]) {
      const f = dados.faturas.find((y) => y.id === idFatura(c.id, x))
      if (statusDaFatura(x, c, f?.paga ?? false, pat.hoje) === 'paga') continue
      faturasAbertas += compor(c, x, dados.lancamentos, dados.parcelados, f?.valorInformado ?? null).valor
    }
  }
  return montarResumo({
    hoje: pat.hoje, competencia: comp, lancamentos: dados.lancamentos, visaoPessoal, categorias: dados.categorias,
    negocios: dados.contextos.filter((c) => c.tipo === 'negocio' && !c.arquivado).map((n) => {
      const r = resumirMes(dados.lancamentos, comp, { tipo: 'contexto', id: n.id })
      return { nome: n.nome, entradas: r.entradas, gastos: r.gastos }
    }),
    recorrentes: totalRecorrente(dados.recorrencias.filter((r) => !pessoal || r.contextoId === pessoal), comp),
    dividas: pat.dividas.filter((d) => d.saldo > 0).map((d) => ({ tipo: d.origem === 'rotativo' ? 'Rotativo do cartão' : 'Dívida', saldo: d.saldo, jurosMensal: d.jurosMensal, parcela: d.parcela })),
    faturasAbertas,
    parcelasFuturas: dados.parcelados.reduce((a, p) => a + restanteDoParcelado(p, somarMeses(comp, 1)).valor, 0),
    investido: pat.totalInvestido,
    alocacao: pat.aloc.map((a) => ({ classe: NOME_CLASSE[a.classe], fracao: a.fracao })),
    reserva: pat.reserva, mesesReserva: pat.mesesReserva,
    risco: pat.risco ? { nivel: pat.risco.nivel, perfil: pat.perfil, acimaDoPerfil: pat.risco.acimaDoPerfil } : null,
    metas: pat.metas.map(({ meta, s }) => ({ nome: meta.nome, alvo: meta.valorAlvo, atual: s.atual, prazo: meta.prazo, aporteNecessario: s.aporteNecessario, estado: s.estado })),
  })
}
