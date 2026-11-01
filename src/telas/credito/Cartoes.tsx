import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { marcarFaturaPaga } from '../../db/credito'
import type { Cartao, CompraParcelada } from '../../db/tipos'
import { compor, competenciaDaFatura, datasDaFatura, idFatura, parcelaNoMes, restanteDoParcelado, statusDaFatura } from '../../core/credito'
import { formatarBRL } from '../../core/dinheiro'
import { formatarData, hojeISO, nomeCompetencia, nomeCompetenciaCurto, somarMeses, type Competencia } from '../../core/datas'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, Cartao as Caixa, EstadoVazio } from '../../ui/componentes'
import { GraficoStatus } from '../../ui/graficos'
import { IconeSeta, IconeVoltar } from '../../ui/Icones'
import { FolhaCartao, FolhaParcelado, FolhaValorFatura } from './Folhas'
import { STATUS } from './comum'

export function Cartoes() {
  const hoje = hojeISO()
  const cartoes = useLiveQuery(() => db.cartoes.filter((c) => !c.arquivado).toArray(), [])
  const [selId, setSelId] = useState<string | null>(null)
  const [folhaCartao, setFolhaCartao] = useState<{ cartao?: Cartao } | null>(null)
  if (!cartoes) return null
  const sel = cartoes.find((c) => c.id === selId) ?? cartoes[0]

  return (
    <>
      {cartoes.length === 0 ? (
        <EstadoVazio icone="💳" titulo="Nenhum cartão cadastrado"
          texto="Cadastre seus cartões com o dia de fechamento e de vencimento. Ao lançar um gasto, escolha o cartão em “Pago com” e ele entra na fatura certa.">
          <Botao onClick={() => setFolhaCartao({})}>Cadastrar cartão</Botao>
        </EstadoVazio>
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Cartões">
            {cartoes.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={c.id === sel?.id} onClick={() => setSelId(c.id)}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ${c.id === sel?.id ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white ring-slate-200 dark:bg-superficie-escuro dark:ring-borda-escuro'}`}>
                <span className="h-3 w-3 rounded-full" style={{ background: c.cor }} aria-hidden />{c.apelido}
              </button>
            ))}
            <button type="button" onClick={() => setFolhaCartao({})} className="min-h-10 shrink-0 rounded-full px-4 text-sm font-medium text-marca-600 ring-1 ring-slate-200 dark:text-marca-100 dark:ring-borda-escuro">+ Cartão</button>
          </div>
          {sel && <DetalheCartao key={sel.id} cartao={sel} hoje={hoje} onEditar={() => setFolhaCartao({ cartao: sel })} />}
        </>
      )}
      <FolhaCartao aberta={!!folhaCartao} cartao={folhaCartao?.cartao} onFechar={() => setFolhaCartao(null)} onSalvo={(c) => setSelId(c.id)} />
    </>
  )
}

function DetalheCartao({ cartao, hoje, onEditar }: { cartao: Cartao; hoje: string; onEditar: () => void }) {
  const atual = competenciaDaFatura(hoje, cartao) // fatura aberta, recebendo compras
  const [comp, setComp] = useState<Competencia>(atual)
  const [folhaValor, setFolhaValor] = useState(false)
  const [folhaParcelado, setFolhaParcelado] = useState<{ p?: CompraParcelada } | null>(null)
  const janela = Array.from({ length: 6 }, (_, i) => somarMeses(atual, i - 2))
  const faturas = useLiveQuery(() => db.faturas.where('cartaoId').equals(cartao.id).toArray(), [cartao.id])
  const parcelados = useLiveQuery(() => db.parcelados.where('cartaoId').equals(cartao.id).toArray(), [cartao.id])
  const compras = useLiveQuery(
    () => db.lancamentos.where('competencia').between(somarMeses(atual, -8), somarMeses(atual, 4), true, true).filter((l) => l.cartaoId === cartao.id).toArray(),
    [cartao.id, atual],
  )
  if (!faturas || !parcelados || !compras) return null

  const fatura = (c: Competencia) => faturas.find((f) => f.id === idFatura(cartao.id, c))
  const info = (c: Competencia) => {
    const f = fatura(c)
    const composicao = compor(cartao, c, compras, parcelados, f?.valorInformado ?? null)
    return { f, composicao, status: statusDaFatura(c, cartao, f?.paga ?? false, hoje) }
  }
  const sel = info(comp)
  const { fechamento, vencimento } = datasDaFatura(comp, cartao)
  const st = STATUS[sel.status]
  const comprasDoMes = compras.filter((l) => competenciaDaFatura(l.data, cartao) === comp).sort((a, b) => b.data.localeCompare(a.data))
  const parcelasDoMes = parcelados.map((p) => ({ p, parcela: parcelaNoMes(p, comp) })).filter((x) => x.parcela)
  // limite usado: faturas ainda não pagas (até a aberta) + parcelas que ainda vão cair
  const naoPagas = janela.filter((c) => c <= atual).map(info).filter((x) => x.status !== 'paga').reduce((a, x) => a + x.composicao.valor, 0)
  const parcelasFuturas = parcelados.reduce((a, p) => a + restanteDoParcelado(p, somarMeses(atual, 1)).valor, 0)
  const usado = naoPagas + parcelasFuturas

  async function alternarPaga() {
    await marcarFaturaPaga(db, cartao.id, comp, !sel.f?.paga, hoje)
    mostrarAviso(sel.f?.paga ? 'Fatura marcada como não paga' : 'Fatura marcada como paga')
  }

  return (
    <>
      <section className="rounded-2xl p-4 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${cartao.cor}, #111827)` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{cartao.apelido}</p>
            <p className="text-sm opacity-80">{cartao.banco || 'Cartão de crédito'} · fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</p>
          </div>
          <button type="button" onClick={onEditar} className="min-h-10 rounded-lg bg-white/15 px-3 text-sm font-medium">Editar</button>
        </div>
        {cartao.limite > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm"><span>Limite usado</span><span className="numeros">{formatarBRL(usado)} de {formatarBRL(cartao.limite)}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label={`Limite usado: ${Math.round((usado / cartao.limite) * 100)}%`} aria-valuenow={Math.round((usado / cartao.limite) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (usado / cartao.limite) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs opacity-80">Disponível: {formatarBRL(Math.max(0, cartao.limite - usado))}</p>
          </div>
        )}
      </section>

      <Caixa titulo="Faturas">
        <GraficoStatus titulo={`Faturas do cartão ${cartao.apelido}`} selecionada={janela.indexOf(comp)} onSelecionar={(i) => setComp(janela[i] ?? atual)}
          barras={janela.map((c) => { const x = info(c); return { rotulo: nomeCompetenciaCurto(c), valor: x.composicao.valor, cor: STATUS[x.status].cor, status: STATUS[x.status].nome } })}
          legenda={(['paga', 'vencida', 'fechada', 'aberta', 'futura'] as const).map((s) => ({ nome: STATUS[s].nome, cor: STATUS[s].cor }))} />
      </Caixa>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro" aria-label={`Fatura de ${nomeCompetencia(comp)}`}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setComp(somarMeses(comp, -1))} aria-label="Fatura anterior" className="grid h-11 w-11 place-items-center text-marca-600 dark:text-marca-100"><IconeVoltar /></button>
          <div className="text-center">
            <p className="font-semibold">Fatura de {nomeCompetencia(comp)}</p>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.classe}`}><span aria-hidden>{st.icone}</span>{st.nome}</span>
          </div>
          <button type="button" onClick={() => setComp(somarMeses(comp, 1))} aria-label="Próxima fatura" className="grid h-11 w-11 place-items-center text-marca-600 dark:text-marca-100"><IconeSeta width={24} height={24} /></button>
        </div>
        <p className="numeros mt-3 text-center text-3xl font-semibold tracking-tight">{formatarBRL(sel.composicao.valor)}</p>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          {sel.composicao.informado !== null ? `valor informado (projeção: ${formatarBRL(sel.composicao.projetado)})` : 'projeção pelas compras e parcelas'}
        </p>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">Fecha em {formatarData(fechamento)} · vence em {formatarData(vencimento)}
          {sel.f?.paga && sel.f.pagaEm ? ` · paga em ${formatarData(sel.f.pagaEm)}` : ''}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Botao variante={sel.f?.paga ? 'secundario' : 'primario'} onClick={() => void alternarPaga()}>{sel.f?.paga ? 'Desmarcar paga' : 'Marcar paga'}</Botao>
          <Botao variante="secundario" onClick={() => setFolhaValor(true)}>Informar valor</Botao>
        </div>
        {sel.status === 'vencida' && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
            Esta fatura venceu sem estar marcada como paga, então ela entra em Dívidas como rotativo. Se já pagou, toque em “Marcar paga”.
          </p>
        )}

        <h3 className="mt-5 mb-1 text-sm font-semibold">Compras neste ciclo</h3>
        {comprasDoMes.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma compra lançada com este cartão.</p> : (
          <ul className="divide-y divide-slate-200 text-sm dark:divide-borda-escuro">
            {comprasDoMes.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-2"><span className="truncate">{formatarData(l.data).slice(0, 5)} · {l.descricao}</span>
                <span className="numeros shrink-0">{l.tipo === 'renda' ? '−' : ''}{formatarBRL(l.valor)}</span></li>
            ))}
          </ul>
        )}
        {parcelasDoMes.length > 0 && (
          <>
            <h3 className="mt-4 mb-1 text-sm font-semibold">Parcelas</h3>
            <ul className="divide-y divide-slate-200 text-sm dark:divide-borda-escuro">
              {parcelasDoMes.map(({ p, parcela }) => (
                <li key={p.id} className="flex justify-between gap-2 py-2"><span className="truncate">{p.descricao} · {parcela!.numero}/{parcela!.de}</span>
                  <span className="numeros shrink-0">{formatarBRL(parcela!.valor)}</span></li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Caixa titulo="Compras parceladas">
        {parcelados.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Cadastre uma compra parcelada e as parcelas aparecem sozinhas nas próximas faturas.</p> : (
          <ul className="divide-y divide-slate-200 dark:divide-borda-escuro">
            {parcelados.map((p) => {
              const falta = restanteDoParcelado(p, atual)
              const pagas = p.numeroParcelas - falta.parcelas
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setFolhaParcelado({ p })} className="w-full py-2.5 text-left" aria-label={`Editar ${p.descricao}`}>
                    <span className="flex justify-between gap-2"><span className="font-medium">{p.descricao}</span><span className="numeros">{formatarBRL(p.valorTotal)}</span></span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {falta.parcelas === 0 ? `Quitada · ${p.numeroParcelas}x` : `${pagas} de ${p.numeroParcelas} pagas · faltam ${formatarBRL(falta.valor)}`}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${(pagas / p.numeroParcelas) * 100}%`, background: 'var(--serie-1)' }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <Botao variante="secundario" className="mt-3 w-full" onClick={() => setFolhaParcelado({})}>+ Compra parcelada</Botao>
      </Caixa>

      <FolhaValorFatura aberta={folhaValor} cartao={cartao} competencia={comp} projetado={sel.composicao.projetado} informado={sel.composicao.informado} onFechar={() => setFolhaValor(false)} />
      <FolhaParcelado aberta={!!folhaParcelado} cartao={cartao} parcelado={folhaParcelado?.p} onFechar={() => setFolhaParcelado(null)} />
    </>
  )
}
