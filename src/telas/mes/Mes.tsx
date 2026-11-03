import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import type { Lancamento } from '../../db/tipos'
import { competenciaDe, hojeISO, nomeCompetencia, somarMeses } from '../../core/datas'
import { Segmentado, Tela } from '../../ui/componentes'
import { IconeMais, IconeSeta, IconeVoltar } from '../../ui/Icones'
import { useDadosBase, visaoDe } from './comum'
import { FolhaLancamento, type PedidoLancamento } from './FolhaLancamento'
import { Lancamentos } from './Lancamentos'
import { Limites } from './Limites'
import { Recorrentes } from './Recorrentes'
import { Historico } from './Historico'

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export type Secao = 'lancamentos' | 'limites' | 'recorrentes' | 'historico'

export function Mes({ secaoInicial = 'lancamentos', abrirNovo = false }: { secaoInicial?: Secao; abrirNovo?: boolean }) {
  const hoje = competenciaDe(hojeISO())
  const [competencia, setCompetencia] = useState(hoje)
  const [secao, setSecao] = useState<Secao>(secaoInicial)
  const [idVisao, setIdVisao] = useState<string | null>(null)
  const [pedido, setPedido] = useState<PedidoLancamento | null>(abrirNovo ? {} : null)
  const base = useDadosBase()

  const lancamentosMes = useLiveQuery(() => db.lancamentos.where('competencia').equals(competencia).toArray(), [competencia])
  const historico = useLiveQuery(
    () => db.lancamentos.where('competencia').between(somarMeses(competencia, -3), competencia).toArray(),
    [competencia],
  )
  const recorrencias = useLiveQuery(() => db.recorrencias.toArray(), [])

  if (!base || !lancamentosMes || !historico || !recorrencias) return <Tela titulo="Mês"><p className="sr-only">Carregando…</p></Tela>

  const ativos = base.contextos.filter((c) => !c.arquivado)
  const visaoId = idVisao ?? base.pessoalId ?? 'tudo'
  const visao = visaoDe(visaoId)
  const doMes = visao.tipo === 'tudo' ? lancamentosMes : lancamentosMes.filter((l) => l.contextoId === visao.id)
  const contextoPadrao = visao.tipo === 'contexto' ? visao.id : base.pessoalId ?? ativos[0]?.id ?? ''

  return (
    <Tela titulo="Mês">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setCompetencia(somarMeses(competencia, -1))} aria-label="Mês anterior"
          className="grid h-11 w-11 place-items-center rounded-full text-marca-600 dark:text-marca-100"><IconeVoltar /></button>
        <div className="text-center">
          <p className="font-semibold" aria-live="polite">{maiuscula(nomeCompetencia(competencia))}</p>
          {competencia !== hoje && (
            <button type="button" onClick={() => setCompetencia(hoje)} className="text-xs text-marca-600 dark:text-marca-100">voltar para o mês atual</button>
          )}
        </div>
        <button type="button" onClick={() => setCompetencia(somarMeses(competencia, 1))} aria-label="Próximo mês"
          className="grid h-11 w-11 place-items-center rounded-full text-marca-600 dark:text-marca-100"><IconeSeta width={24} height={24} /></button>
      </div>

      {ativos.length > 1 && (
        <Segmentado rotulo="Conta" valor={visaoId} onMudar={setIdVisao}
          opcoes={[...ativos.map((c) => ({ valor: c.id, rotulo: c.nome })), { valor: 'tudo', rotulo: 'Tudo' }]} />
      )}

      <Segmentado rotulo="Seção" valor={secao} onMudar={setSecao}
        opcoes={[{ valor: 'lancamentos', rotulo: 'Lançamentos' }, { valor: 'limites', rotulo: 'Limites' }, { valor: 'recorrentes', rotulo: 'Repetem' }, { valor: 'historico', rotulo: 'Histórico' }]} />

      {secao === 'lancamentos' && (
        <Lancamentos lancamentos={doMes} base={base} visao={visao} competencia={competencia}
          onEditar={(l: Lancamento) => setPedido({ lancamento: l })} onNovo={() => setPedido({})} />
      )}
      {secao === 'limites' && <Limites lancamentosMes={lancamentosMes} historico={historico} base={base} visao={visao} competencia={competencia} />}
      {secao === 'recorrentes' && (
        <Recorrentes recorrencias={recorrencias} lancamentosMes={lancamentosMes} base={base} visao={visao} competencia={competencia}
          onNova={() => setPedido({ todoMes: true })} />
      )}

      {secao === 'historico' && <Historico base={base} visao={visao} competencia={competencia} />}

      {secao !== 'historico' && (
      <button type="button" onClick={() => setPedido({})} aria-label="Novo lançamento"
        className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 lg:hidden grid h-14 w-14 place-items-center rounded-full bg-marca-600 text-white shadow-lg active:bg-marca-700">
        <IconeMais width={28} height={28} strokeWidth={2.4} />
      </button>
      )}

      <FolhaLancamento pedido={pedido} base={base} competencia={competencia} contextoPadrao={contextoPadrao} onFechar={() => { setPedido(null); if (window.location.hash === '#/mes/novo') window.location.hash = '#/mes' }} />
    </Tela>
  )
}
