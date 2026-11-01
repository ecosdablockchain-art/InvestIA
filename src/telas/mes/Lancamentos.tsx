import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Lancamento } from '../../db/tipos'
import { db } from '../../db/banco'
import { apagarLancamento, restaurarLancamento } from '../../db/repositorio'
import { agruparPorDia, filtrarLancamentos, type FiltroLancamentos } from '../../core/busca'
import { formatarBRL } from '../../core/dinheiro'
import { resumirMes, type Visao } from '../../core/orcamento'
import type { Competencia } from '../../core/datas'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, EstadoVazio, Segmentado } from '../../ui/componentes'
import { LinhaDeslizante } from '../../ui/LinhaDeslizante'
import { nomeDia, type DadosBase } from './comum'

export function Lancamentos({ lancamentos, base, visao, competencia, onEditar, onNovo }: {
  lancamentos: Lancamento[]; base: DadosBase; visao: Visao; competencia: Competencia
  onEditar: (l: Lancamento) => void; onNovo: () => void
}) {
  const cartoes = useLiveQuery(() => db.cartoes.toArray(), [])
  const nomeCartao = (id?: string | null) => (id ? cartoes?.find((c) => c.id === id)?.apelido : undefined)
  const [filtro, setFiltro] = useState<FiltroLancamentos>({ texto: '', categoriaId: 'todas', tipo: 'todos' })
  const resumo = resumirMes(lancamentos, competencia, visao)
  const visiveis = filtrarLancamentos(lancamentos, filtro, (id) => base.categoria(id)?.nome ?? '')
  const grupos = agruparPorDia(visiveis)
  const filtrando = filtro.texto !== '' || filtro.categoriaId !== 'todas' || filtro.tipo !== 'todos'

  async function apagar(l: Lancamento) {
    const apagado = await apagarLancamento(db, l.id)
    if (apagado) mostrarAviso('Lançamento apagado', { rotulo: 'Desfazer', executar: () => void restaurarLancamento(db, apagado) })
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        {[
          { r: 'Entradas', v: resumo.entradas, c: 'text-positivo dark:text-positivo-escuro' },
          { r: 'Gastos', v: resumo.gastos, c: 'text-negativo dark:text-negativo-escuro' },
          { r: 'Sobra', v: resumo.sobra, c: resumo.sobra < 0 ? 'text-negativo dark:text-negativo-escuro' : '' },
        ].map((x) => (
          <div key={x.r}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{x.r}</p>
            <p className={`numeros text-[0.95rem] font-semibold ${x.c}`}>{formatarBRL(x.v)}</p>
          </div>
        ))}
      </div>

      {lancamentos.length > 0 && (
        <div className="space-y-2">
          <input type="search" placeholder="Buscar lançamentos" aria-label="Buscar lançamentos" value={filtro.texto}
            onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
            className="min-h-11 w-full rounded-xl border-0 bg-slate-200/70 px-4 text-base placeholder:text-slate-500 dark:bg-slate-800" />
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Segmentado rotulo="Filtrar por tipo" valor={filtro.tipo} onMudar={(tipo) => setFiltro({ ...filtro, tipo })}
                opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'gasto', rotulo: 'Gastos' }, { valor: 'renda', rotulo: 'Entradas' }]} />
            </div>
            <select aria-label="Filtrar por categoria" value={filtro.categoriaId} onChange={(e) => setFiltro({ ...filtro, categoriaId: e.target.value })}
              className="min-h-11 w-28 shrink-0 rounded-xl bg-slate-200/70 px-2 text-sm dark:bg-slate-800">
              <option value="todas">Categoria</option>
              {base.categorias.filter((c) => !c.arquivada).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
            </select>
          </div>
        </div>
      )}

      {lancamentos.length === 0 ? (
        <EstadoVazio icone="🧾" titulo="Nenhum lançamento neste mês" texto="Toque em Lançar, na barra de baixo, ou no + para registrar um gasto ou uma entrada.">
          <Botao onClick={onNovo}>Adicionar lançamento</Botao>
        </EstadoVazio>
      ) : grupos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nada encontrado com esses filtros.</p>
      ) : (
        grupos.map((g) => {
          const totalDia = g.itens.reduce((a, l) => a + (l.tipo === 'gasto' ? -l.valor : l.valor), 0)
          return (
            <section key={g.data} aria-label={nomeDia(g.data)}>
              <div className="mb-1 flex justify-between px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                <h3>{nomeDia(g.data)}</h3>
                <span className="numeros">{formatarBRL(totalDia)}</span>
              </div>
              <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl ring-1 ring-slate-200/70 dark:divide-borda-escuro dark:ring-borda-escuro">
                {g.itens.map((l) => {
                  const cat = base.categoria(l.categoriaId)
                  const ctx = visao.tipo === 'tudo' ? base.contexto(l.contextoId)?.nome : undefined
                  const valor = `${l.tipo === 'gasto' ? '−' : '+'}${formatarBRL(l.valor)}`
                  return (
                    <LinhaDeslizante key={l.id} onTocar={() => onEditar(l)} onEditar={() => onEditar(l)} onApagar={() => void apagar(l)}
                      rotulo={`${l.descricao}, ${cat?.nome ?? 'sem categoria'}, ${l.tipo === 'gasto' ? 'gasto' : 'entrada'} de ${formatarBRL(l.valor)}${l.recorrenciaId ? ', todo mês' : ''}. Toque para editar.`}>
                      <div className="flex min-h-14 items-center gap-3 px-3 py-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-lg dark:bg-slate-800" aria-hidden>{cat?.icone ?? '•'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{l.descricao}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {[cat?.nome ?? 'Sem categoria', ctx, nomeCartao(l.cartaoId) ? `💳 ${nomeCartao(l.cartaoId)}` : null, l.recorrenciaId ? '🔁 todo mês' : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className={`numeros shrink-0 font-semibold ${l.tipo === 'gasto' ? '' : 'text-positivo dark:text-positivo-escuro'}`}>{valor}</span>
                      </div>
                    </LinhaDeslizante>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
      {filtrando && visiveis.length > 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">{visiveis.length} de {lancamentos.length} lançamentos</p>
      )}
    </>
  )
}
