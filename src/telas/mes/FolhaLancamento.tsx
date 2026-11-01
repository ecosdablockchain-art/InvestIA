import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { competenciaDaFatura } from '../../core/credito'
import { nomeCompetencia as nomeMes } from '../../core/datas'
import { db } from '../../db/banco'
import type { Lancamento, TipoLancamento } from '../../db/tipos'
import { apagarLancamento, restaurarLancamento, salvarLancamento } from '../../db/repositorio'
import { competenciaDe, dataNaCompetencia, hojeISO, type Competencia } from '../../core/datas'
import { CampoValor } from '../../ui/CampoValor'
import { Folha } from '../../ui/Folha'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, Campo, Interruptor, Segmentado } from '../../ui/componentes'
import type { DadosBase } from './comum'

export interface PedidoLancamento {
  lancamento?: Lancamento
  todoMes?: boolean
}

export function FolhaLancamento({ pedido, base, competencia, contextoPadrao, onFechar }: {
  pedido: PedidoLancamento | null; base: DadosBase; competencia: Competencia; contextoPadrao: string; onFechar: () => void
}) {
  const editando = pedido?.lancamento
  const [tipo, setTipo] = useState<TipoLancamento>('gasto')
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [contextoId, setContextoId] = useState(contextoPadrao)
  const [data, setData] = useState(hojeISO())
  const [todoMes, setTodoMes] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [cartaoId, setCartaoId] = useState<string | null>(null)
  const cartoes = useLiveQuery(() => db.cartoes.filter((c) => !c.arquivado).toArray(), [])
  const metas = useLiveQuery(() => db.metas.filter((m) => !m.concluida).toArray(), [])
  const [metaId, setMetaId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!pedido) return
    const l = pedido.lancamento
    const hoje = hojeISO()
    setTipo(l?.tipo ?? 'gasto')
    setValor(l?.valor ?? 0)
    setDescricao(l?.descricao ?? '')
    setCategoriaId(l?.categoriaId ?? null)
    setContextoId(l?.contextoId ?? contextoPadrao)
    setData(l?.data ?? (competenciaDe(hoje) === competencia ? hoje : dataNaCompetencia(competencia, 1)))
    setObservacao(l?.observacao ?? '')
    setCartaoId(l?.cartaoId ?? null)
    setMetaId(l?.metaId ?? null)
    setErro(null)
    if (l?.recorrenciaId) {
      void db.recorrencias.get(l.recorrenciaId).then((r) => setTodoMes(!!r && (r.fim === null || r.fim > l.competencia) && r.ativa))
    } else {
      setTodoMes(pedido.todoMes ?? false)
    }
  }, [pedido, contextoPadrao, competencia])

  const categorias = base.categorias.filter((c) => !c.arquivada && (c.tipo === tipo || c.tipo === 'ambos'))
  const contextos = base.contextos.filter((c) => !c.arquivado || c.id === contextoId)

  async function salvar() {
    try {
      await salvarLancamento(db, { tipo, valor, data, descricao, observacao, categoriaId, contextoId, todoMes, cartaoId: tipo === 'gasto' ? cartaoId : null, metaId }, editando)
      mostrarAviso(editando ? 'Lançamento atualizado' : tipo === 'gasto' ? 'Gasto lançado' : 'Entrada lançada')
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function apagar() {
    if (!editando) return
    const apagado = await apagarLancamento(db, editando.id)
    onFechar()
    if (apagado) mostrarAviso('Lançamento apagado', { rotulo: 'Desfazer', executar: () => void restaurarLancamento(db, apagado) })
  }

  return (
    <Folha aberta={!!pedido} titulo={editando ? 'Editar lançamento' : 'Novo lançamento'} onFechar={onFechar}
      acao={<button type="button" onClick={salvar} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <Segmentado rotulo="Tipo" valor={tipo} onMudar={(t) => { setTipo(t); setCategoriaId(null) }}
          opcoes={[{ valor: 'gasto', rotulo: 'Gasto' }, { valor: 'renda', rotulo: 'Entrada' }]} />
        <CampoValor rotulo="Valor" valor={valor} onMudar={setValor} grande foco={!editando} tom={tipo} />
        <Campo rotulo="Descrição" placeholder={tipo === 'gasto' ? 'Ex.: Mercado' : 'Ex.: Salário'} value={descricao}
          onChange={(e) => setDescricao(e.target.value)} enterKeyHint="done" />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Categoria</legend>
          <div role="radiogroup" aria-label="Categoria" className="grid grid-cols-3 gap-2">
            {categorias.map((c) => {
              const sel = c.id === categoriaId
              return (
                <button key={c.id} type="button" role="radio" aria-checked={sel} onClick={() => setCategoriaId(sel ? null : c.id)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center text-xs leading-tight ring-1 ${sel
                    ? 'bg-marca-600 text-white ring-marca-600'
                    : 'bg-white ring-slate-200 dark:bg-superficie-escuro dark:ring-borda-escuro'}`}>
                  <span className="text-xl" aria-hidden>{c.icone}</span>{c.nome}
                </button>
              )
            })}
          </div>
        </fieldset>

        {contextos.length > 1 && (
          <div>
            <p className="mb-1.5 text-sm font-medium" id="rotulo-conta">Conta</p>
            <Segmentado rotulo="Conta" valor={contextoId} onMudar={setContextoId} opcoes={contextos.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
          </div>
        )}

        <Campo rotulo="Data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />

        {tipo === 'gasto' && cartoes && cartoes.length > 0 && (() => {
          const cartao = cartoes.find((c) => c.id === cartaoId)
          return (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Pago com</span>
              <select value={cartaoId ?? ''} onChange={(e) => setCartaoId(e.target.value || null)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-borda-escuro dark:bg-slate-900">
                <option value="">Dinheiro, Pix ou débito</option>
                {cartoes.map((c) => <option key={c.id} value={c.id}>💳 {c.apelido}</option>)}
              </select>
              {cartao && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Entra na fatura de {nomeMes(competenciaDaFatura(data, cartao))}.</span>}
            </label>
          )
        })()}

        {metas && metas.length > 0 && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Guardar para meta (opcional)</span>
            <select value={metaId ?? ''} onChange={(e) => setMetaId(e.target.value || null)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-borda-escuro dark:bg-slate-900">
              <option value="">Nenhuma</option>
              {metas.map((m) => <option key={m.id} value={m.id}>{m.icone} {m.nome}</option>)}
            </select>
          </label>
        )}

        <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-2 ring-1 ring-slate-200 dark:bg-superficie-escuro dark:ring-borda-escuro">
          <div>
            <p className="font-medium">Todo mês</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Entra em "Contas que se repetem" e na previsão</p>
          </div>
          <Interruptor rotulo="Repetir todo mês" ligado={todoMes} onMudar={setTodoMes} />
        </div>

        <Campo rotulo="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />

        {erro && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        <Botao type="submit" className="w-full">{editando ? 'Salvar alterações' : tipo === 'gasto' ? 'Lançar gasto' : 'Lançar entrada'}</Botao>
        {editando && <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={apagar}>Apagar lançamento</Botao>}
      </form>
    </Folha>
  )
}
