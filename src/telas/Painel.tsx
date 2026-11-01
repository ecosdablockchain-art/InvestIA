import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { compor, competenciaDaFatura, datasDaFatura, diasParaVencer, idFatura, parcelaNoMes, statusDaFatura } from '../core/credito'
import { simularQuitacao } from '../core/dividas'
import { somarMeses } from '../core/datas'
import { processarFaturasVencidas } from '../db/credito'
import { lerAjustesConta } from '../db/ajustesConta'
import type { SaidaPrevista } from '../core/previsao'
import { usePatrimonio } from './patrimonio/dados'
import { db } from '../db/banco'
import { competenciaDe, formatarData, hojeISO, nomeCompetencia, nomeCompetenciaCurto } from '../core/datas'
import { formatarBRL } from '../core/dinheiro'
import { filtrarVisao, gastosPorCategoria, resumirMes, type Visao } from '../core/orcamento'
import { situacaoDoMes } from '../core/recorrencias'
import { preverMeses } from '../core/previsao'
import { alertasDeContasAtrasadas, alertasDeLimite, ordenarAlertas, type Alerta } from '../core/alertas'
import { rankingCategorias } from '../core/historico'
import { salvarPreferencias, usePreferencias } from '../seguranca/preferencias'
import { CardValor, Cartao, EstadoVazio, Segmentado, Tela } from '../ui/componentes'
import { BarrasHorizontais, COR_ENTRADAS, COR_SAIDAS, GraficoColunas } from '../ui/graficos'
import { IconeAjustes, IconeSeta } from '../ui/Icones'
import { useDadosBase, type DadosBase } from './mes/comum'

const MESES_PREVISAO = 6

export function Painel() {
  const prefs = usePreferencias()
  const hoje = hojeISO()
  const competencia = competenciaDe(hoje)
  const base = useDadosBase()
  const lancamentos = useLiveQuery(() => db.lancamentos.where('competencia').equals(competencia).toArray(), [competencia])
  const recorrencias = useLiveQuery(() => db.recorrencias.toArray(), [])
  const dividas = useLiveQuery(() => db.dividas.toArray(), [])
  const cartoes = useLiveQuery(() => db.cartoes.filter((c) => !c.arquivado).toArray(), [])
  const parcelados = useLiveQuery(() => db.parcelados.toArray(), [])
  const faturas = useLiveQuery(() => db.faturas.toArray(), [])
  const patrimonio = usePatrimonio()
  const comprasCartao = useLiveQuery(
    () => db.lancamentos.where('competencia').between(somarMeses(competencia, -3), somarMeses(competencia, 2), true, true).filter((l) => !!l.cartaoId).toArray(),
    [competencia],
  )
  useEffect(() => { void lerAjustesConta().then((a) => processarFaturasVencidas(db, hoje, a.taxaRotativoMensal)) }, [hoje])

  if (!base || !lancamentos || !recorrencias || !dividas || !cartoes || !parcelados || !faturas || !comprasCartao || !patrimonio) return <Tela titulo="Painel"><p className="sr-only">Carregando…</p></Tela>

  const ativos = base.contextos.filter((c) => !c.arquivado)
  const idVisao = prefs.visaoPainel === 'pessoal' ? base.pessoalId ?? 'tudo' : prefs.visaoPainel
  const valida = idVisao === 'tudo' || ativos.some((c) => c.id === idVisao)
  const visao: Visao = !valida || idVisao === 'tudo' ? { tipo: 'tudo' } : { tipo: 'contexto', id: idVisao }

  const resumo = resumirMes(lancamentos, competencia, visao)
  const pl = patrimonio.liquido
  const gastos = gastosPorCategoria(lancamentos, competencia, visao)
  const recsVisao = filtrarVisao(recorrencias, visao)
  const situacao = situacaoDoMes(recsVisao, lancamentos, competencia)

  // faturas: vencida (não paga) e vencendo em até 3 dias
  const alertasFatura: Alerta[] = []
  for (const c of cartoes) {
    const aberta = competenciaDaFatura(hoje, c)
    for (const comp of [somarMeses(aberta, -2), somarMeses(aberta, -1), aberta]) {
      const f = faturas.find((x) => x.id === idFatura(c.id, comp))
      const st = statusDaFatura(comp, c, f?.paga ?? false, hoje)
      const valor = compor(c, comp, comprasCartao, parcelados, f?.valorInformado ?? null).valor
      if (valor <= 0) continue
      const vencimento = datasDaFatura(comp, c).vencimento
      if (st === 'vencida' && vencimento > c.criadoEm.slice(0, 10)) alertasFatura.push({ tipo: 'fatura-vencida', gravidade: 'critico', faturaId: idFatura(c.id, comp), cartao: c.apelido, vencimento, valor })
      else if ((st === 'fechada' || st === 'aberta') && diasParaVencer(comp, c, hoje) <= 3) alertasFatura.push({ tipo: 'fatura-vencendo', gravidade: 'atencao', faturaId: idFatura(c.id, comp), cartao: c.apelido, vencimento, valor })
    }
  }
  const alertasMetas: Alerta[] = patrimonio.metas.filter((m) => m.s.estado === 'atrasada').map((m) => ({ tipo: 'meta-atrasada', gravidade: 'atencao', metaId: m.meta.id, nome: m.meta.nome }))
  const alertas = ordenarAlertas([
    ...alertasFatura,
    ...alertasMetas,
    ...alertasDeLimite(gastos, base.categorias.filter((c) => !c.arquivada)),
    ...alertasDeContasAtrasadas(situacao, hoje),
  ])

  // previsão: a partir do próximo mês, parcelas de cartão e das dívidas (o mês atual usa o que já foi lançado)
  const saidasPrevistas: SaidaPrevista[] = []
  if (visao.tipo === 'tudo' || visao.id === base.pessoalId) {
    for (let i = 1; i < MESES_PREVISAO; i++) {
      const comp = somarMeses(competencia, i)
      const parcelas = parcelados.reduce((a, p) => a + (parcelaNoMes(p, comp)?.valor ?? 0), 0)
      if (parcelas) saidasPrevistas.push({ competencia: comp, valor: parcelas, origem: 'cartao' })
    }
    const quitacao = simularQuitacao(dividas)
    quitacao.porMes.slice(0, MESES_PREVISAO - 1).forEach((valor, i) => { if (valor) saidasPrevistas.push({ competencia: somarMeses(competencia, i + 1), valor, origem: 'divida' }) })
  }

  const previsao = preverMeses({
    inicio: competencia, meses: MESES_PREVISAO, recorrencias: recsVisao,
    lancadasNoInicio: new Set(situacao.filter((s) => s.lancada).map((s) => s.recorrencia.id)),
    realizadoInicio: resumo, saidasPrevistas,
  })
  const sobraPrevista = previsao.reduce((a, m) => a + m.saldo, 0)
  const ranking = rankingCategorias(gastos, 6)
  const negocios = visao.tipo === 'contexto' && visao.id !== base.pessoalId ? [] : ativos.filter((c) => c.tipo === 'negocio')
  const vazio = lancamentos.length === 0 && recorrencias.length === 0

  const opcoes = [
    ...ativos.map((c) => ({ valor: c.id, rotulo: c.nome })),
    ...(ativos.length > 1 ? [{ valor: 'tudo', rotulo: 'Tudo' }] : []),
  ]

  return (
    <Tela
      titulo="Painel"
      subtitulo={nomeCompetencia(competencia)}
      acao={
        <a href="#/ajustes" aria-label="Ajustes" className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-superficie-escuro dark:text-slate-200 dark:ring-borda-escuro">
          <IconeAjustes width={22} height={22} />
        </a>
      }
    >
      {opcoes.length > 1 && (
        <Segmentado rotulo="Visão do painel" opcoes={opcoes} valor={visao.tipo === 'tudo' ? 'tudo' : visao.id}
          onMudar={(v) => salvarPreferencias({ visaoPainel: v === base.pessoalId ? 'pessoal' : v })} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <CardValor rotulo="Entradas do mês" valor={resumo.entradas} tom="positivo" />
        <CardValor rotulo="Gastos do mês" valor={resumo.gastos} tom="negativo" />
        <CardValor rotulo="Sobra" valor={resumo.sobra} tom="auto" legenda={resumo.sobra < 0 ? 'gastou mais do que entrou' : undefined} />
        <CardValor rotulo="Patrimônio líquido" valor={pl} legenda="investido − dívidas" />
      </div>

      {alertas.length > 0 && <ListaAlertas alertas={alertas} base={base} />}

      {vazio ? (
        <EstadoVazio icone="🧭" titulo="Tudo pronto para começar"
          texto="Toque em Lançar, na barra de baixo, para registrar seus gastos e entradas. A previsão de 6 meses, os alertas e o gráfico de categorias aparecem aqui assim que houver dados.">
          <a href="#/mes/novo" className="inline-flex min-h-11 items-center rounded-xl bg-marca-600 px-4 font-semibold text-white">Lançar o primeiro gasto</a>
        </EstadoVazio>
      ) : (
        <>
          <Cartao titulo="Próximos 6 meses">
            <GraficoColunas
              titulo="Entradas e saídas previstas para os próximos 6 meses"
              rotulos={previsao.map((m) => nomeCompetenciaCurto(m.competencia))}
              series={[
                { nome: 'Entradas', cor: COR_ENTRADAS, valores: previsao.map((m) => m.entradas) },
                { nome: 'Saídas', cor: COR_SAIDAS, valores: previsao.map((m) => m.saidas) },
              ]}
              notaDoMes={(i) => (i === 0 ? 'lançado + o que falta' : 'repetem + parcelas + dívidas')}
            />
            <p className="mt-3 border-t border-slate-200 pt-3 text-sm dark:border-borda-escuro">
              Sobra prevista no período: <strong className={`numeros ${sobraPrevista < 0 ? 'text-negativo dark:text-negativo-escuro' : ''}`}>{formatarBRL(sobraPrevista)}</strong>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saídas futuras: contas que se repetem, parcelas de compras no cartão e parcelas das dívidas.</p>
          </Cartao>

          <Cartao titulo="Para onde foi o dinheiro">
            {ranking.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum gasto lançado neste mês ainda.</p>
            ) : (
              <BarrasHorizontais titulo="Gastos do mês por categoria" itens={ranking.map((r) => {
                const cat = r.categoriaId === 'outras' ? undefined : base.categoria(r.categoriaId)
                const limite = cat?.limiteMensal
                return {
                  id: String(r.categoriaId),
                  rotulo: r.categoriaId === 'outras' ? 'Outras categorias' : cat?.nome ?? 'Sem categoria',
                  icone: r.categoriaId === 'outras' ? '➕' : cat?.icone ?? '•',
                  valor: r.valor,
                  detalhe: limite ? `limite ${formatarBRL(limite)}` : undefined,
                }
              })} />
            )}
          </Cartao>

          {patrimonio.metas.some((m) => m.s.estado !== 'concluida') && (
            <Cartao titulo="Metas">
              <ul className="space-y-3">
                {patrimonio.metas.filter((m) => m.s.estado !== 'concluida').slice(0, 3).map(({ meta, s }) => (
                  <li key={meta.id}>
                    <a href="#/patrimonio/metas" className="block">
                      <span className="mb-1 flex justify-between gap-2 text-sm"><span><span aria-hidden>{meta.icone} </span>{meta.nome}</span>
                        <span className="numeros text-slate-600 dark:text-slate-400">{Math.round(s.progresso * 100)}%</span></span>
                      <span className="block h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden><span className="block h-full rounded-full" style={{ width: `${s.progresso * 100}%`, background: 'var(--serie-1)' }} /></span>
                      {s.aporteNecessario ? <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">guardar {formatarBRL(s.aporteNecessario)}/mês{s.estado === 'em-risco' ? ' · aportes abaixo do necessário' : ''}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          {negocios.length > 0 && (
            <Cartao titulo="Resultado dos negócios no mês">
              <ul className="divide-y divide-slate-200 dark:divide-borda-escuro">
                {negocios.map((n) => {
                  const r = resumirMes(lancamentos, competencia, { tipo: 'contexto', id: n.id })
                  return (
                    <li key={n.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span><span aria-hidden>{n.icone} </span>{n.nome}
                        <span className="block text-xs text-slate-500 dark:text-slate-400">entrou {formatarBRL(r.entradas)} · saiu {formatarBRL(r.gastos)}</span>
                      </span>
                      <span className={`numeros font-semibold ${r.sobra < 0 ? 'text-negativo dark:text-negativo-escuro' : r.sobra > 0 ? 'text-positivo dark:text-positivo-escuro' : ''}`}>{formatarBRL(r.sobra)}</span>
                    </li>
                  )
                })}
              </ul>
              {visao.tipo === 'contexto' && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fora da sua sobra pessoal.</p>}
            </Cartao>
          )}
        </>
      )}
    </Tela>
  )
}

function ListaAlertas({ alertas, base }: { alertas: Alerta[]; base: DadosBase }) {
  return (
    <section aria-label="Alertas" className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
      <h2 className="sr-only">Alertas</h2>
      <ul className="divide-y divide-slate-200 dark:divide-borda-escuro">
        {alertas.map((a, i) => {
          const { icone, titulo, texto, href } = descrever(a, base)
          return (
            <li key={i}>
              <a href={href} className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-slate-100 dark:active:bg-slate-800">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${a.gravidade === 'critico' ? 'bg-red-600' : 'bg-amber-500'}`} aria-hidden>{icone}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    <span className="sr-only">{a.gravidade === 'critico' ? 'Crítico: ' : 'Atenção: '}</span>{titulo}
                  </span>
                  <span className="block text-xs text-slate-600 dark:text-slate-400">{texto}</span>
                </span>
                <IconeSeta className="text-slate-400" />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function descrever(a: Alerta, base: DadosBase): { icone: string; titulo: string; texto: string; href: string } {
  switch (a.tipo) {
    case 'limite-estourado': {
      const c = base.categoria(a.categoriaId)
      return { icone: '!', titulo: `${c?.nome ?? 'Categoria'} passou do limite`, texto: `${formatarBRL(a.gasto)} de ${formatarBRL(a.limite)} (+${formatarBRL(a.gasto - a.limite)})`, href: '#/mes/limites' }
    }
    case 'conta-atrasada':
      return { icone: '⏰', titulo: `${a.descricao} ainda não foi lançado`, texto: `previsto para ${formatarData(a.data)} · ${formatarBRL(a.valor)}`, href: '#/mes/repetem' }
    case 'fatura-vencendo':
      return { icone: '⏰', titulo: `Fatura ${a.cartao} vence em breve`, texto: `${formatarData(a.vencimento)} · ${formatarBRL(a.valor)}`, href: '#/credito' }
    case 'fatura-vencida':
      return { icone: '!', titulo: `Fatura ${a.cartao} vencida sem pagamento`, texto: `venceu em ${formatarData(a.vencimento)} · ${formatarBRL(a.valor)} · entrou em Dívidas como rotativo`, href: '#/credito/dividas' }
    case 'meta-atrasada':
      return { icone: '⏰', titulo: `Meta ${a.nome}: o prazo passou`, texto: 'ajuste o prazo ou o valor, ou continue guardando', href: '#/patrimonio/metas' }
  }
}
