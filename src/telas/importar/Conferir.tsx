import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { lancarImportacao, type ItemParaLancar, type RegraAprendida } from '../../db/importacoes'
import type { FormatoImportacao } from '../../db/tipos'
import { formatarBRL } from '../../core/dinheiro'
import { competenciaDe, formatarData, somarMeses } from '../../core/datas'
import { analisar, inverterSinais, periodo, type LinhaAnalisada } from '../../core/importacao/analisar'
import { chaveDescricao, type TipoLinha } from '../../core/importacao/classificar'
import type { ResultadoLeitura } from '../../core/importacao/tipos'
import { Botao, Interruptor, Segmentado, Tela } from '../../ui/componentes'
import { useDadosBase } from '../mes/comum'

interface Escolha { selecionada: boolean; categoriaId: string | null; contextoId: string }

const SELO: Record<TipoLinha, string | null> = {
  gasto: null,
  entrada: null,
  'pagamento-fatura': 'Pagamento de fatura',
  transferencia: 'Transferência',
}

export function Conferir({ nome, leitura, onCancelar, onLancado }: {
  nome: string; leitura: ResultadoLeitura; onCancelar: () => void; onLancado: (lancados: number, regras: number) => void
}) {
  const base = useDadosBase()
  const [invertido, setInvertido] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'marcadas' | 'desmarcadas'>('todas')
  const [contextoPadrao, setContextoPadrao] = useState<string | null>(null)
  const [escolhas, setEscolhas] = useState<Escolha[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const linhas = useMemo(() => (invertido ? inverterSinais(leitura.linhas) : leitura.linhas), [leitura, invertido])
  const per = periodo(linhas)
  const regras = useLiveQuery(() => db.regras.toArray(), [])
  const existentes = useLiveQuery(async () => {
    if (!per) return []
    const de = somarMeses(competenciaDe(per.de), -1)
    const ate = somarMeses(competenciaDe(per.ate), 1)
    return db.lancamentos.where('competencia').between(de, ate, true, true).toArray()
  }, [per?.de, per?.ate])

  const analisadas = useMemo<LinhaAnalisada[] | null>(
    () => (regras && existentes ? analisar(linhas, regras, existentes) : null),
    // reanalisa ao inverter sinais; regras/existentes só na primeira carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, regras === undefined, existentes === undefined],
  )

  const ctxPadrao = contextoPadrao ?? base?.pessoalId ?? base?.contextos[0]?.id ?? ''
  const idPorNome = useMemo(() => new Map(base?.categorias.filter((c) => !c.arquivada).map((c) => [c.nome, c.id]) ?? []), [base])
  const sugerida = (l: LinhaAnalisada) => l.categoriaIdRegra ?? (l.categoriaNomeSugerida ? idPorNome.get(l.categoriaNomeSugerida) ?? null : null)

  useEffect(() => {
    if (!analisadas || !base) return
    setEscolhas(analisadas.map((l) => ({ selecionada: l.selecionada, categoriaId: sugerida(l), contextoId: l.contextoIdRegra ?? ctxPadrao })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analisadas, base === undefined])

  if (!base || !analisadas || !escolhas) return <Tela titulo="Conferir"><p className="sr-only">Carregando…</p></Tela>

  const contextos = base.contextos.filter((c) => !c.arquivado)
  const mudar = (i: number, e: Partial<Escolha>) => setEscolhas(escolhas.map((x, j) => (j === i ? { ...x, ...e } : x)))
  const marcadas = escolhas.filter((e) => e.selecionada).length
  const totais = analisadas.reduce((t, l, i) => {
    if (!escolhas[i]?.selecionada) return t
    if (l.valor < 0) t.saidas += -l.valor
    else t.entradas += l.valor
    return t
  }, { entradas: 0, saidas: 0 })
  const desmarcadasAuto = {
    fatura: analisadas.filter((l) => l.tipo === 'pagamento-fatura').length,
    transf: analisadas.filter((l) => l.tipo === 'transferencia').length,
    dup: analisadas.filter((l) => l.duplicado).length,
  }
  const indices = analisadas.map((_, i) => i).filter((i) =>
    filtro === 'todas' ? true : filtro === 'marcadas' ? escolhas[i]?.selecionada : !escolhas[i]?.selecionada)

  function mudarContextoPadrao(id: string) {
    // linhas que estavam no padrão antigo acompanham a troca
    setEscolhas(escolhas!.map((e) => (e.contextoId === ctxPadrao ? { ...e, contextoId: id } : e)))
    setContextoPadrao(id)
  }

  async function lancar() {
    setErro(null)
    setSalvando(true)
    const itens: ItemParaLancar[] = []
    const novasRegras = new Map<string, RegraAprendida>()
    analisadas!.forEach((l, i) => {
      const e = escolhas![i]
      if (!e?.selecionada) return
      itens.push({
        data: l.data, descricao: l.descricao, valor: Math.abs(l.valor), tipo: l.valor < 0 ? 'gasto' : 'renda',
        categoriaId: e.categoriaId, contextoId: e.contextoId, idExterno: l.idExterno,
      })
      const mudouCategoria = e.categoriaId !== null && e.categoriaId !== sugerida(l)
      const mudouConta = e.contextoId !== (l.contextoIdRegra ?? ctxPadrao)
      const padrao = chaveDescricao(l.descricao)
      if (padrao && e.categoriaId && (mudouCategoria || mudouConta)) {
        novasRegras.set(padrao, { padrao, categoriaId: e.categoriaId, contextoId: e.contextoId !== ctxPadrao ? e.contextoId : null })
      }
    })
    try {
      const formato: FormatoImportacao = leitura.formato
      await lancarImportacao(db, { nomeArquivo: nome, formato, linhasLidas: analisadas!.length, itens, regras: [...novasRegras.values()] })
      onLancado(itens.length, novasRegras.size)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível lançar.')
      setSalvando(false)
    }
  }

  return (
    <Tela titulo="Conferir" subtitulo={`${nome}${per ? ` · ${formatarData(per.de)} a ${formatarData(per.ate)}` : ''}`}>
      {leitura.avisos.map((a) => <p key={a} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{a}</p>)}

      {(desmarcadasAuto.fatura + desmarcadasAuto.transf + desmarcadasAuto.dup) > 0 && (
        <p className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
          Vieram <strong>desmarcados</strong> para não contar em dobro:{' '}
          {[
            desmarcadasAuto.fatura && `${desmarcadasAuto.fatura} ${desmarcadasAuto.fatura === 1 ? 'pagamento de fatura' : 'pagamentos de fatura'}`,
            desmarcadasAuto.transf && `${desmarcadasAuto.transf} ${desmarcadasAuto.transf === 1 ? 'transferência entre contas suas' : 'transferências entre contas suas'}`,
            desmarcadasAuto.dup && `${desmarcadasAuto.dup} já ${desmarcadasAuto.dup === 1 ? 'lançado' : 'lançados'} antes`,
          ].filter(Boolean).join(', ')}.
        </p>
      )}

      <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        {contextos.length > 1 && (
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Lançar em</span>
            <select value={ctxPadrao} onChange={(e) => mudarContextoPadrao(e.target.value)} className="min-h-10 rounded-lg bg-slate-100 px-2 dark:bg-slate-800">
              {contextos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm"><span className="font-medium">Inverter sinais</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Use se as compras aparecerem como entradas (algumas faturas de cartão)</span></span>
          <Interruptor rotulo="Inverter sinais" ligado={invertido} onMudar={(v) => { setInvertido(v); setEscolhas(null) }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmentado rotulo="Mostrar" valor={filtro} onMudar={setFiltro}
            opcoes={[{ valor: 'todas', rotulo: `Todas (${analisadas.length})` }, { valor: 'marcadas', rotulo: `Marcadas (${marcadas})` }, { valor: 'desmarcadas', rotulo: 'Fora' }]} />
        </div>
      </div>
      <div className="flex justify-end gap-4 text-sm">
        <button type="button" className="min-h-9 text-marca-600 dark:text-marca-100" onClick={() => setEscolhas(escolhas.map((e) => ({ ...e, selecionada: true })))}>Marcar todas</button>
        <button type="button" className="min-h-9 text-marca-600 dark:text-marca-100" onClick={() => setEscolhas(escolhas.map((e) => ({ ...e, selecionada: false })))}>Desmarcar todas</button>
      </div>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 dark:divide-borda-escuro dark:bg-superficie-escuro dark:ring-borda-escuro">
        {indices.map((i) => {
          const l = analisadas[i] as LinhaAnalisada
          const e = escolhas[i] as Escolha
          const selo = l.duplicado ? 'Já lançado' : SELO[l.tipo]
          const cats = base.categorias.filter((c) => !c.arquivada && (c.tipo === 'ambos' || c.tipo === (l.valor < 0 ? 'gasto' : 'renda')))
          return (
            <li key={i} className={`px-3 py-3 ${e.selecionada ? '' : 'bg-slate-50 dark:bg-slate-900/40'}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={e.selecionada} onChange={(ev) => mudar(i, { selecionada: ev.target.checked })}
                  className="mt-0.5 h-6 w-6 shrink-0 accent-marca-600" aria-label={`Lançar ${l.descricao}, ${formatarBRL(l.valor)}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[0.95rem] leading-snug font-medium break-words ${e.selecionada ? '' : 'text-slate-500 dark:text-slate-400'}`}>{l.descricao}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatarData(l.data)}
                    {selo && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{selo}</span>}
                  </span>
                </span>
                <span className={`numeros shrink-0 font-semibold ${l.valor > 0 ? 'text-positivo dark:text-positivo-escuro' : ''} ${e.selecionada ? '' : 'opacity-60'}`}>
                  {l.valor < 0 ? '−' : '+'}{formatarBRL(Math.abs(l.valor))}
                </span>
              </label>
              {e.selecionada && (
                <div className="mt-2 flex gap-2 pl-9">
                  <select aria-label={`Categoria de ${l.descricao}`} value={e.categoriaId ?? ''} onChange={(ev) => mudar(i, { categoriaId: ev.target.value || null })}
                    className={`min-h-10 min-w-0 flex-1 rounded-lg px-2 text-sm ${e.categoriaId ? 'bg-slate-100 dark:bg-slate-800' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800'}`}>
                    <option value="">Escolher categoria…</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                  {contextos.length > 1 && (
                    <select aria-label={`Conta de ${l.descricao}`} value={e.contextoId} onChange={(ev) => mudar(i, { contextoId: ev.target.value })}
                      className="min-h-10 w-28 shrink-0 rounded-lg bg-slate-100 px-2 text-sm dark:bg-slate-800">
                      {contextos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                </div>
              )}
            </li>
          )
        })}
        {indices.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nada aqui.</li>}
      </ul>
      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">Ao trocar a categoria de um item, o app aprende e sugere a mesma da próxima vez.</p>
      <div className="h-20" aria-hidden />

      <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-borda-escuro dark:bg-fundo-escuro/95">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Botao variante="secundario" onClick={onCancelar} disabled={salvando}>Cancelar</Botao>
          <Botao className="flex-1" onClick={() => void lancar()} disabled={marcadas === 0 || salvando}>
            {salvando ? 'Lançando…' : `Lançar ${marcadas} ${marcadas === 1 ? 'item' : 'itens'}`}
          </Botao>
        </div>
        <p className="numeros mx-auto mt-1 max-w-xl text-center text-xs text-slate-500 dark:text-slate-400">
          saídas {formatarBRL(totais.saidas)} · entradas {formatarBRL(totais.entradas)}
        </p>
        {erro && <p role="alert" className="mx-auto mt-1 max-w-xl text-center text-sm text-red-600 dark:text-red-400">{erro}</p>}
      </div>
    </Tela>
  )
}
