import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { somarMeses, nomeCompetenciaCurto, type Competencia } from '../../core/datas'
import { formatarBRL, type Centavos } from '../../core/dinheiro'

/** Valor sem o "R$", para tabelas estreitas (o cabeçalho avisa que é em reais). */
const semMoeda = (v: Centavos) => (v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
import { compararCategorias, historicoMensal } from '../../core/historico'
import type { Visao } from '../../core/orcamento'
import { Cartao, Segmentado } from '../../ui/componentes'
import { COR_ENTRADAS, COR_SAIDAS, GraficoColunas, GraficoLinha } from '../../ui/graficos'
import type { DadosBase } from './comum'

export function Historico({ base, visao, competencia }: { base: DadosBase; visao: Visao; competencia: Competencia }) {
  const [meses, setMeses] = useState<'6' | '12'>('6')
  const n = Number(meses)
  const lancamentos = useLiveQuery(
    () => db.lancamentos.where('competencia').between(somarMeses(competencia, -Math.max(n, 4) + 1), competencia, true, true).toArray(),
    [competencia, n],
  )
  const patrimonio = useLiveQuery(() => db.patrimonio.orderBy('competencia').toArray(), [])
  if (!lancamentos || !patrimonio) return null

  const hist = historicoMensal(lancamentos, competencia, n, visao)
  const comparativo = compararCategorias(lancamentos, competencia, visao)
  const pl = patrimonio.filter((p) => p.competencia <= competencia).slice(-12)
  const comDados = hist.filter((m) => m.entradas || m.gastos).length

  return (
    <>
      <Segmentado rotulo="Período" valor={meses} onMudar={setMeses}
        opcoes={[{ valor: '6', rotulo: 'Últimos 6 meses' }, { valor: '12', rotulo: 'Últimos 12 meses' }]} />

      <Cartao titulo="Entradas e gastos mês a mês">
        {comDados === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há lançamentos neste período.</p>
        ) : (
          <GraficoColunas
            key={`${competencia}-${n}`}
            titulo={`Entradas e gastos dos últimos ${n} meses`}
            rotulos={hist.map((m) => nomeCompetenciaCurto(m.competencia))}
            series={[
              { nome: 'Entradas', cor: COR_ENTRADAS, valores: hist.map((m) => m.entradas) },
              { nome: 'Gastos', cor: COR_SAIDAS, valores: hist.map((m) => m.gastos) },
            ]}
            destaqueInicial={hist.length - 1}
            notaDoMes={(i) => { const s = hist[i]?.sobra ?? 0; return `sobra ${formatarBRL(s)}` }}
          />
        )}
      </Cartao>

      <Cartao titulo="Patrimônio líquido">
        {pl.length < 2 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A linha do patrimônio aparece quando houver pelo menos 2 meses registrados. O registro mensal (investido − dívidas) chega na fase 7.
          </p>
        ) : (
          <GraficoLinha titulo="Patrimônio líquido mês a mês" nome="Patrimônio líquido"
            rotulos={pl.map((p) => nomeCompetenciaCurto(p.competencia))} valores={pl.map((p) => p.totalInvestido - p.totalDividas)} />
        )}
      </Cartao>

      <Cartao titulo="Gastos por categoria">
        {comparativo.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Sem gastos para comparar.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="numeros w-full text-right text-sm whitespace-nowrap">
              <caption className="sr-only">Gastos por categoria: este mês, mês passado e média dos 3 meses anteriores</caption>
              <thead>
                <tr className="text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-1 pb-2 text-left font-medium">Em R$</th>
                  <th className="px-1 pb-2 font-medium">Este mês</th>
                  <th className="px-1 pb-2 font-medium">Passado</th>
                  <th className="px-1 pb-2 font-medium">Média 3m</th>
                </tr>
              </thead>
              <tbody>
                {comparativo.map((r) => {
                  const cat = base.categoria(r.categoriaId)
                  const ref = r.media3 ?? 0
                  const variacao = ref > 0 ? (r.esteMes - ref) / ref : null
                  return (
                    <tr key={String(r.categoriaId)} className="border-t border-slate-200 dark:border-borda-escuro">
                      <th className="max-w-32 truncate px-1 py-2 text-left font-normal"><span aria-hidden>{cat?.icone ?? '•'} </span>{cat?.nome ?? 'Sem categoria'}</th>
                      <td className="px-1 py-2 font-medium">
                        {semMoeda(r.esteMes)}
                        {variacao !== null && r.esteMes > 0 && Math.abs(variacao) >= 0.15 && (
                          <span className={`block text-[0.7rem] font-normal ${variacao > 0 ? 'text-negativo dark:text-negativo-escuro' : 'text-positivo dark:text-positivo-escuro'}`}>
                            <span aria-hidden>{variacao > 0 ? '▲' : '▼'} </span>{Math.round(Math.abs(variacao) * 100)}%<span className="sr-only"> {variacao > 0 ? 'acima' : 'abaixo'} da média</span>
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-2 text-slate-600 dark:text-slate-400">{semMoeda(r.mesPassado)}</td>
                      <td className="px-1 py-2 text-slate-600 dark:text-slate-400">{r.media3 === null ? '—' : semMoeda(r.media3)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">▲▼ comparam este mês com a média. A média considera só os meses anteriores em que houve lançamentos.</p>
      </Cartao>
    </>
  )
}
