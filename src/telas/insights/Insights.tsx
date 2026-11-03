import { formatarBRL } from '../../core/dinheiro'
import type { Insight, Passo, Tom } from '../../core/insights'
import { CardValor, Cartao, Tela } from '../../ui/componentes'
import { IconeSeta } from '../../ui/Icones'
import { useInsights } from './dados'

const ESTILO_TOM: Record<Tom, { rotulo: string; faixa: string; selo: string }> = {
  critico: { rotulo: 'Urgente', faixa: 'bg-red-600', selo: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' },
  atencao: { rotulo: 'Atenção', faixa: 'bg-amber-500', selo: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100' },
  info: { rotulo: 'Dica', faixa: 'bg-marca-500', selo: 'bg-marca-50 text-marca-700 dark:bg-slate-800 dark:text-marca-100' },
  positivo: { rotulo: 'Muito bem', faixa: 'bg-emerald-600', selo: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
}

function LinkAcao({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <a href={href} className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-marca-600 dark:text-marca-100">
      {rotulo} <IconeSeta />
    </a>
  )
}

function EtapaPlano({ p, n, ultimo }: { p: Passo; n: number; ultimo: boolean }) {
  const agora = p.estado === 'agora'
  const feito = p.estado === 'feito'
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!ultimo && <span aria-hidden className="absolute top-8 bottom-0 left-[0.95rem] w-px bg-slate-200 dark:bg-borda-escuro" />}
      <span aria-hidden className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
        feito ? 'bg-emerald-600 text-white' : agora ? 'bg-marca-600 text-white ring-4 ring-marca-100 dark:ring-marca-700/40' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
        {feito ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className={`font-semibold ${feito ? 'text-slate-500 dark:text-slate-400' : ''}`}>
            {p.titulo}
            <span className="sr-only">{feito ? ' (concluído)' : agora ? ' (próximo passo)' : ' (depois)'}</span>
          </h3>
          {p.destaque && !feito && <span className="numeros text-sm font-semibold">{p.destaque}</span>}
        </div>
        {agora && <p className="mt-0.5 text-xs font-semibold tracking-wide text-marca-600 uppercase dark:text-marca-100">Faça agora</p>}
        <p className={`mt-1 text-sm leading-relaxed ${feito ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{p.texto}</p>
        {p.acao && !feito && <LinkAcao {...p.acao} />}
      </div>
    </li>
  )
}

function CartaoInsight({ i }: { i: Insight }) {
  const e = ESTILO_TOM[i.tom]
  return (
    <li className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
      <span aria-hidden className={`w-1.5 shrink-0 ${e.faixa}`} />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${e.selo}`}>{e.rotulo}</span>
          {i.destaque && <span className="numeros text-sm font-semibold">{i.destaque}</span>}
        </div>
        <h3 className="mt-2 font-semibold">{i.titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{i.texto}</p>
        {i.acao && <LinkAcao {...i.acao} />}
      </div>
    </li>
  )
}

export function Insights() {
  const r = useInsights()
  if (!r) return <Tela titulo="Insights"><p className="sr-only">Carregando…</p></Tela>
  const { numeros: n, plano, insights } = r
  const periodo = n.parcial ? 'este mês, até hoje' : `média dos últimos ${n.mesesAnalisados === 1 ? 'mês' : `${n.mesesAnalisados} meses`}`
  return (
    <Tela mural titulo="Insights" subtitulo="O que fazer com o seu dinheiro, a partir dos seus lançamentos">
      {n.mesesAnalisados > 0 && (
        <>
          <div className="col-total grid grid-cols-3 gap-2 lg:gap-3">
            <CardValor rotulo="Renda" valor={n.renda} legenda="por mês" />
            <CardValor rotulo="Gastos" valor={n.gasto} legenda="por mês" />
            <CardValor rotulo="Sobra" valor={n.sobra} tom="auto" legenda={n.taxaPoupanca !== null ? `${Math.round(n.taxaPoupanca * 100)}% da renda` : 'por mês'} />
          </div>
          <p className="col-total -mt-2 px-1 text-xs text-slate-500 lg:mt-0 dark:text-slate-400">Pessoal, {periodo}. Aportes em metas contam como dinheiro guardado.</p>

          <Cartao titulo="Seu plano, passo a passo">
            <ol>
              {plano.map((p, k) => <EtapaPlano key={p.id} p={p} n={k + 1} ultimo={k === plano.length - 1} />)}
            </ol>
          </Cartao>

          {n.gasto > 0 && (
            <Cartao titulo="Reserva de emergência">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Ideal ({n.reservaAlvoMeses} meses de gastos)</span>
                <span className="numeros font-semibold">{formatarBRL(n.reservaAlvo)}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Reserva de emergência"
                aria-valuemin={0} aria-valuemax={n.reservaAlvoMeses} aria-valuenow={Math.min(n.reservaAlvoMeses, n.mesesDeReserva ?? 0)}
                aria-valuetext={`${(n.mesesDeReserva ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de ${n.reservaAlvoMeses} meses`}>
                <div className="h-full rounded-full bg-marca-600" style={{ width: `${Math.min(100, ((n.mesesDeReserva ?? 0) / n.reservaAlvoMeses) * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Hoje cobre {(n.mesesDeReserva ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de {n.reservaAlvoMeses} meses.
                {n.rendaVariavel ? ' 12 meses porque sua renda varia.' : ''}
              </p>
            </Cartao>
          )}
        </>
      )}

      {insights.length > 0 && (
        <section aria-labelledby="notamos">
          <h2 id="notamos" className="mb-2 px-1 text-[0.95rem] font-semibold">{n.mesesAnalisados > 0 ? 'O que notamos' : 'Para começar'}</h2>
          <ul className="space-y-3">{insights.map((i) => <CartaoInsight key={i.id} i={i} />)}</ul>
        </section>
      )}

      <p className="col-total px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Sugestões automáticas e educativas, calculadas no seu aparelho a partir dos seus lançamentos. Não são recomendação de investimento.
        Quanto mais completos os lançamentos, mais certeiras ficam.
      </p>
    </Tela>
  )
}
