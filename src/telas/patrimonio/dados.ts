import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { registrarPatrimonioDoMes } from '../../db/patrimonio'
import { alocacao, avaliarPosicoes, calcularPosicoes, mesesDeReserva, riscoDaCarteira, situacaoReserva, type Classe } from '../../core/carteira'
import { competenciaDe, hojeISO, somarMeses } from '../../core/datas'
import { historicoMensal } from '../../core/historico'
import { situacaoMeta } from '../../core/metas'
import { usePreferencias } from '../../seguranca/preferencias'

/** Tudo o que o patrimônio precisa, calculado num lugar só (usado no Painel e na aba Patrimônio). */
export function usePatrimonio() {
  const prefs = usePreferencias()
  const hoje = hojeISO()
  const competencia = competenciaDe(hoje)
  const operacoes = useLiveQuery(() => db.operacoes.toArray(), [])
  const cotacoes = useLiveQuery(() => db.cotacoes.toArray(), [])
  const investimentos = useLiveQuery(() => db.investimentos.toArray(), [])
  const dividas = useLiveQuery(() => db.dividas.toArray(), [])
  const metas = useLiveQuery(() => db.metas.toArray(), [])
  const aportes = useLiveQuery(() => db.lancamentos.filter((l) => !!l.metaId).toArray(), [])
  const contextos = useLiveQuery(() => db.contextos.toArray(), [])
  const recentes = useLiveQuery(() => db.lancamentos.where('competencia').between(somarMeses(competencia, -3), somarMeses(competencia, -1), true, true).toArray(), [competencia])
  const snapshots = useLiveQuery(() => db.patrimonio.orderBy('competencia').toArray(), [])

  const pronto = operacoes && cotacoes && investimentos && dividas && metas && aportes && contextos && recentes && snapshots
  const posicoes = pronto ? avaliarPosicoes(calcularPosicoes(operacoes), new Map(cotacoes.map((c) => [c.id, c.preco]))) : []
  const totalBolsa = posicoes.reduce((a, p) => a + p.valorAtual, 0)
  const totalOutros = investimentos?.reduce((a, i) => a + i.valorAtual, 0) ?? 0
  const totalInvestido = totalBolsa + totalOutros
  const totalDividas = dividas?.reduce((a, d) => a + Math.max(0, d.saldo), 0) ?? 0

  useEffect(() => {
    if (pronto) void registrarPatrimonioDoMes(db, competencia, totalInvestido, totalDividas)
  }, [pronto, competencia, totalInvestido, totalDividas])

  if (!pronto) return null

  const aloc = alocacao([
    ...posicoes.map((p) => ({ classe: p.tipoAtivo as Classe, valor: p.valorAtual })),
    ...investimentos.map((i) => ({ classe: i.classe as Classe, valor: i.valorAtual })),
  ])
  const risco = riscoDaCarteira(aloc, prefs.perfil)

  // reserva: liquidez diária em reserva ou renda fixa; gasto médio pessoal dos últimos 3 meses com dados (sem aportes)
  const reserva = investimentos.filter((i) => i.classe === 'reserva' || (i.classe === 'rendaFixa' && i.liquidez === 'diaria')).reduce((a, i) => a + i.valorAtual, 0)
  const pessoal = contextos.find((c) => c.tipo === 'pessoal')?.id
  const semAportes = recentes.filter((l) => !l.metaId)
  const meses = historicoMensal(semAportes, somarMeses(competencia, -1), 3, pessoal ? { tipo: 'contexto', id: pessoal } : { tipo: 'tudo' }).filter((m) => m.gastos > 0)
  const gastoMedio = meses.length ? Math.round(meses.reduce((a, m) => a + m.gastos, 0) / meses.length) : 0
  const mesesReserva = mesesDeReserva(reserva, gastoMedio)

  const metasComSituacao = metas
    .map((m) => ({ meta: m, s: situacaoMeta(m, aportes, hoje) }))
    .sort((a, b) => Number(a.s.estado === 'concluida') - Number(b.s.estado === 'concluida') || a.meta.prioridade - b.meta.prioridade)

  return {
    hoje, competencia, posicoes, investimentos, dividas, totalBolsa, totalOutros, totalInvestido, totalDividas,
    liquido: totalInvestido - totalDividas, aloc, risco, perfil: prefs.perfil,
    reserva, gastoMedio, mesesReserva, situacaoReserva: situacaoReserva(mesesReserva),
    metas: metasComSituacao, snapshots, cotacoes,
  }
}
export type DadosPatrimonio = NonNullable<ReturnType<typeof usePatrimonio>>
