import { useEffect, useState } from 'react'
import { db } from '../../db/banco'
import { encerrarRecorrencia, lancarRecorrencia, salvarRecorrencia } from '../../db/repositorio'
import type { Lancamento, Recorrencia } from '../../db/tipos'
import { formatarBRL } from '../../core/dinheiro'
import { formatarData, nomeCompetencia, type Competencia } from '../../core/datas'
import { filtrarVisao, type Visao } from '../../core/orcamento'
import { situacaoDoMes, totalRecorrente } from '../../core/recorrencias'
import { CampoValor } from '../../ui/CampoValor'
import { Folha } from '../../ui/Folha'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, Campo, EstadoVazio, Interruptor } from '../../ui/componentes'
import type { DadosBase } from './comum'

export function Recorrentes({ recorrencias, lancamentosMes, base, visao, competencia, onNova }: {
  recorrencias: Recorrencia[]; lancamentosMes: Lancamento[]; base: DadosBase; visao: Visao; competencia: Competencia; onNova: () => void
}) {
  const [editando, setEditando] = useState<Recorrencia | null>(null)
  const daVisao = filtrarVisao(recorrencias, visao)
  const situacao = situacaoDoMes(daVisao, lancamentosMes, competencia)
  const pendentes = situacao.filter((s) => !s.lancada)
  const totais = totalRecorrente(daVisao, competencia)
  const pausadas = daVisao.filter((r) => !r.ativa && (r.fim === null || r.fim >= competencia))

  async function lancar(r: Recorrencia, data: string) {
    const l = await lancarRecorrencia(db, r, data)
    if (l) mostrarAviso(`${r.descricao} lançado`)
  }

  async function lancarTodas() {
    for (const s of pendentes) await lancarRecorrencia(db, s.recorrencia, s.data)
    mostrarAviso(`${pendentes.length} ${pendentes.length === 1 ? 'conta lançada' : 'contas lançadas'}`)
  }

  if (situacao.length === 0 && pausadas.length === 0) {
    return (
      <EstadoVazio icone="🔁" titulo="Nenhuma conta que se repete" texto='Aluguel, internet, salário… Ao lançar, ligue "Todo mês". Elas aparecem aqui para lançar com um toque e entram na previsão de 6 meses.'>
        <Botao onClick={onNova}>Nova conta que se repete</Botao>
      </EstadoVazio>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        <div><p className="text-xs text-slate-500 dark:text-slate-400">Contas por mês</p><p className="numeros font-semibold text-negativo dark:text-negativo-escuro">{formatarBRL(totais.gastos)}</p></div>
        <div><p className="text-xs text-slate-500 dark:text-slate-400">Entradas por mês</p><p className="numeros font-semibold text-positivo dark:text-positivo-escuro">{formatarBRL(totais.entradas)}</p></div>
      </div>

      {pendentes.length > 1 && <Botao className="w-full" onClick={lancarTodas}>Lançar as {pendentes.length} pendentes de {nomeCompetencia(competencia).split(' ')[0]}</Botao>}

      <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 dark:divide-borda-escuro dark:bg-superficie-escuro dark:ring-borda-escuro">
        {situacao.map(({ recorrencia: r, data, lancada }) => {
          const cat = base.categoria(r.categoriaId)
          return (
            <div key={r.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <button type="button" onClick={() => setEditando(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Editar ${r.descricao}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-lg dark:bg-slate-800" aria-hidden>{cat?.icone ?? '🔁'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.descricao}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">dia {r.diaDoMes} · {r.tipo === 'gasto' ? '−' : '+'}{formatarBRL(r.valor)}</span>
                </span>
              </button>
              {lancada ? (
                <span className="text-sm font-medium text-positivo dark:text-positivo-escuro">✓ Lançado</span>
              ) : (
                <Botao variante="secundario" className="min-h-9 px-3 text-sm" onClick={() => void lancar(r, data)} aria-label={`Lançar ${r.descricao} em ${formatarData(data)}`}>Lançar</Botao>
              )}
            </div>
          )
        })}
        {pausadas.map((r) => (
          <button key={r.id} type="button" onClick={() => setEditando(r)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left opacity-60">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-lg dark:bg-slate-800" aria-hidden>⏸️</span>
            <span className="flex-1"><span className="block font-medium">{r.descricao}</span><span className="block text-xs">pausada</span></span>
          </button>
        ))}
      </div>
      <Botao variante="secundario" className="w-full" onClick={onNova}>Nova conta que se repete</Botao>

      <FolhaRecorrencia recorrencia={editando} competencia={competencia} onFechar={() => setEditando(null)} />
    </>
  )
}

function FolhaRecorrencia({ recorrencia, competencia, onFechar }: { recorrencia: Recorrencia | null; competencia: Competencia; onFechar: () => void }) {
  const [rascunho, setRascunho] = useState<Recorrencia | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { setRascunho(recorrencia); setErro(null) }, [recorrencia])

  async function salvar() {
    if (!rascunho) return
    try {
      await salvarRecorrencia(db, { ...rascunho, descricao: rascunho.descricao.trim() || 'Conta' })
      mostrarAviso('Conta atualizada. Vale para os próximos lançamentos.')
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function encerrar() {
    if (!rascunho) return
    await encerrarRecorrencia(db, rascunho.id, competencia)
    mostrarAviso(`${rascunho.descricao} não se repete mais a partir de ${nomeCompetencia(competencia)}`)
    onFechar()
  }

  return (
    <Folha aberta={!!rascunho} titulo="Conta que se repete" onFechar={onFechar}
      acao={<button type="button" onClick={salvar} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>}>
      {rascunho && (
        <div className="space-y-4">
          <CampoValor rotulo="Valor" valor={rascunho.valor} onMudar={(valor) => setRascunho({ ...rascunho, valor })} grande tom={rascunho.tipo} />
          <Campo rotulo="Descrição" value={rascunho.descricao} onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })} />
          <Campo rotulo="Dia do mês" inputMode="numeric" value={String(rascunho.diaDoMes)}
            dica="Se o mês for mais curto, usa o último dia."
            onChange={(e) => setRascunho({ ...rascunho, diaDoMes: Number(e.target.value.replace(/\D/g, '').slice(0, 2)) || 0 })} />
          <div className="flex items-center justify-between rounded-xl bg-white px-4 py-2 ring-1 ring-slate-200 dark:bg-superficie-escuro dark:ring-borda-escuro">
            <span className="font-medium">Ativa</span>
            <Interruptor rotulo="Recorrência ativa" ligado={rascunho.ativa} onMudar={(ativa) => setRascunho({ ...rascunho, ativa })} />
          </div>
          {erro && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          <Botao className="w-full" onClick={salvar}>Salvar</Botao>
          <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={encerrar}>
            Parar de repetir a partir de {nomeCompetencia(competencia).split(' ')[0]}
          </Botao>
          <p className="text-xs text-slate-500 dark:text-slate-400">Mudar o valor aqui não altera os meses já lançados.</p>
        </div>
      )}
    </Folha>
  )
}
