import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { marcarFaturaPaga } from '../../db/credito'
import type { Divida } from '../../db/tipos'
import { formatarBRL, type Centavos } from '../../core/dinheiro'
import { hojeISO } from '../../core/datas'
import { compararExtra, jurosAnual, ordenarAvalanche } from '../../core/dividas'
import { CampoValor } from '../../ui/CampoValor'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, Cartao as Caixa, EstadoVazio } from '../../ui/componentes'
import { FolhaDivida } from './Folhas'
import { pct } from './comum'

function tempo(meses: number): string {
  const a = Math.floor(meses / 12)
  const m = meses % 12
  return [a ? `${a} ${a === 1 ? 'ano' : 'anos'}` : '', m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : ''].filter(Boolean).join(' e ') || '0 meses'
}

export function Dividas() {
  const dividas = useLiveQuery(() => db.dividas.toArray(), [])
  const [folha, setFolha] = useState<{ d?: Divida } | null>(null)
  const [extra, setExtra] = useState<Centavos>(0)
  if (!dividas) return null
  const ordenadas = ordenarAvalanche(dividas)
  const quitadas = dividas.filter((d) => d.saldo <= 0)
  const total = ordenadas.reduce((a, d) => a + d.saldo, 0)
  const parcelas = ordenadas.reduce((a, d) => a + d.parcela, 0)
  const jurosMedio = total > 0 ? ordenadas.reduce((a, d) => a + d.saldo * d.jurosMensal, 0) / total : 0
  const sim = ordenadas.length ? compararExtra(ordenadas, extra) : null

  async function jaPaguei(d: Divida) {
    if (!d.faturaId) return
    const [, cartaoId, comp] = d.faturaId.split(':')
    if (!cartaoId || !comp) return
    await marcarFaturaPaga(db, cartaoId, Number(comp), true, hojeISO())
    mostrarAviso('Fatura marcada como paga e rotativo removido')
  }

  return (
    <>
      {ordenadas.length === 0 ? (
        <EstadoVazio icone="🎉" titulo={quitadas.length ? 'Nenhuma dívida em aberto' : 'Nenhuma dívida cadastrada'}
          texto="Cadastre empréstimos, financiamentos ou cheque especial com o saldo, os juros e a parcela. Faturas de cartão vencidas sem pagamento entram aqui sozinhas como rotativo.">
          <Botao onClick={() => setFolha({})}>Cadastrar dívida</Botao>
        </EstadoVazio>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Total devido</p><p className="numeros font-semibold text-negativo dark:text-negativo-escuro">{formatarBRL(total)}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Parcelas/mês</p><p className="numeros font-semibold">{formatarBRL(parcelas)}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Juros médio</p><p className="numeros font-semibold">{pct(jurosMedio)} a.m.</p></div>
          </div>

          <Caixa titulo="Ordem para quitar (maior juros primeiro)">
            <ol className="divide-y divide-slate-200 dark:divide-borda-escuro">
              {ordenadas.map((d, i) => (
                <li key={d.id} className="py-3">
                  <button type="button" onClick={() => setFolha({ d })} className="flex w-full items-start gap-3 text-left" aria-label={`Editar ${d.nome}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${i === 0 ? 'bg-marca-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2"><span className="font-medium">{d.nome}</span><span className="numeros font-semibold">{formatarBRL(d.saldo)}</span></span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {pct(d.jurosMensal)} ao mês · {pct(jurosAnual(d.jurosMensal), 0)} ao ano · parcela {d.parcela ? formatarBRL(d.parcela) : 'não definida'}
                        {d.parcelasRestantes ? ` · ${d.parcelasRestantes}x restantes` : ''}
                      </span>
                      {d.origem === 'rotativo' && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-950 dark:text-red-200">Rotativo do cartão</span>}
                    </span>
                  </button>
                  {d.origem === 'rotativo' && (
                    <div className="mt-2 flex gap-2 pl-10">
                      <button type="button" className="min-h-9 rounded-lg bg-slate-100 px-3 text-sm dark:bg-slate-800" onClick={() => void jaPaguei(d)}>Já paguei a fatura</button>
                      {d.parcela === 0 && <button type="button" className="min-h-9 px-2 text-sm text-marca-600 dark:text-marca-100" onClick={() => setFolha({ d })}>Definir parcela</button>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <Botao variante="secundario" className="mt-2 w-full" onClick={() => setFolha({})}>+ Dívida</Botao>
          </Caixa>

          {sim && (
            <Caixa titulo="Simulador de quitação">
              <p className="text-sm text-slate-600 dark:text-slate-400">E se você pagar um valor a mais por mês? O extra vai sempre para a dívida de maior juros.</p>
              <div className="mt-3"><CampoValor rotulo="Pagar a mais por mês" valor={extra} onMudar={setExtra} /></div>
              <table className="numeros mt-4 w-full text-sm">
                <thead><tr className="text-xs text-slate-500 dark:text-slate-400"><th className="pb-1 text-left font-medium"></th><th className="pb-1 text-right font-medium">Só as parcelas</th><th className="pb-1 text-right font-medium">Com {formatarBRL(extra)}</th></tr></thead>
                <tbody>
                  <tr className="border-t border-slate-200 dark:border-borda-escuro"><th className="py-2 text-left font-normal">Quita em</th>
                    <td className="py-2 text-right">{sim.base.quita ? tempo(sim.base.meses) : 'não quita'}</td><td className="py-2 text-right font-semibold">{sim.comExtra.quita ? tempo(sim.comExtra.meses) : 'não quita'}</td></tr>
                  <tr className="border-t border-slate-200 dark:border-borda-escuro"><th className="py-2 text-left font-normal">Juros pagos</th>
                    <td className="py-2 text-right">{sim.base.quita ? formatarBRL(sim.base.jurosTotal) : '—'}</td><td className="py-2 text-right font-semibold">{sim.comExtra.quita ? formatarBRL(sim.comExtra.jurosTotal) : '—'}</td></tr>
                </tbody>
              </table>
              {sim.economiaJuros !== null && extra > 0 && sim.economiaJuros > 0 && (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  Pagando {formatarBRL(extra)} a mais por mês, você termina <strong>{tempo(sim.mesesAMenos ?? 0)} antes</strong> e economiza <strong>{formatarBRL(sim.economiaJuros)}</strong> de juros.
                </p>
              )}
              {!sim.base.quita && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  Só com as parcelas atuais, as dívidas não terminam: os juros são maiores que o pagamento{ordenadas.some((d) => d.parcela === 0) ? ' (há dívida sem parcela definida)' : ''}.
                  {!sim.comExtra.quita ? ' Aumente o valor a mais para ver quando acaba.' : ''}
                </p>
              )}
              {sim.comExtra.quita && sim.comExtra.ordem.length > 1 && (
                <ol className="mt-3 space-y-1 text-sm">
                  {sim.comExtra.ordem.map((o) => <li key={o.id} className="flex justify-between"><span>{o.nome}</span><span className="text-slate-500 dark:text-slate-400">quitada em {tempo(o.mes)}</span></li>)}
                </ol>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Simulação com juros compostos mensais sobre o saldo. Valores reais podem variar com IOF, seguros e tarifas.</p>
            </Caixa>
          )}
        </>
      )}
      <FolhaDivida aberta={!!folha} divida={folha?.d} onFechar={() => setFolha(null)} />
    </>
  )
}
