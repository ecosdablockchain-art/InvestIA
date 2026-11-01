import { useState } from 'react'
import { db } from '../../db/banco'
import { definirLimite } from '../../db/repositorio'
import type { Categoria, Lancamento } from '../../db/tipos'
import { formatarBRL, type Centavos } from '../../core/dinheiro'
import { gastosPorCategoria, sugerirLimite, type Visao } from '../../core/orcamento'
import type { Competencia } from '../../core/datas'
import { CampoValor } from '../../ui/CampoValor'
import { Folha } from '../../ui/Folha'
import { mostrarAviso } from '../../ui/Aviso'
import { BarraLimite, Botao, EstadoVazio, Grupo } from '../../ui/componentes'
import type { DadosBase } from './comum'

export function Limites({ lancamentosMes, historico, base, visao, competencia }: {
  lancamentosMes: Lancamento[]; historico: Lancamento[]; base: DadosBase; visao: Visao; competencia: Competencia
}) {
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [valor, setValor] = useState<Centavos>(0)
  const gastos = gastosPorCategoria(lancamentosMes, competencia, visao)
  const doHistorico = visao.tipo === 'tudo' ? historico : historico.filter((l) => l.contextoId === visao.id)
  const ativas = base.categorias.filter((c) => !c.arquivada && c.tipo !== 'renda')
  const comLimite = ativas.filter((c) => c.limiteMensal !== null)
  const semLimite = ativas.filter((c) => c.limiteMensal === null)
  const totalLimites = comLimite.reduce((a, c) => a + (c.limiteMensal ?? 0), 0)
  const totalGastoComLimite = comLimite.reduce((a, c) => a + (gastos.get(c.id) ?? 0), 0)
  const sugestao = editando ? sugerirLimite(doHistorico, editando.id, competencia) : null

  function abrir(c: Categoria) {
    setEditando(c)
    setValor(c.limiteMensal ?? sugerirLimite(doHistorico, c.id, competencia) ?? 0)
  }

  async function salvar(v: Centavos | null) {
    if (!editando) return
    await definirLimite(db, editando.id, v)
    mostrarAviso(v ? `Limite de ${editando.nome}: ${formatarBRL(v)}` : `Limite de ${editando.nome} removido`)
    setEditando(null)
  }

  return (
    <>
      {comLimite.length === 0 ? (
        <EstadoVazio icone="🎯" titulo="Defina limites por categoria"
          texto="Escolha uma categoria abaixo. A barra fica amarela a partir de 80% e vermelha quando passa do limite. Quando houver histórico, sugerimos a média dos últimos 3 meses." />
      ) : (
        <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
          <BarraLimite rotulo="Total com limite" gasto={totalGastoComLimite} limite={totalLimites} />
          <hr className="border-slate-200 dark:border-borda-escuro" />
          {comLimite.map((c) => (
            <button key={c.id} type="button" onClick={() => abrir(c)} className="block w-full text-left" aria-label={`Editar limite de ${c.nome}`}>
              <BarraLimite rotulo={`${c.icone} ${c.nome}`} gasto={gastos.get(c.id) ?? 0} limite={c.limiteMensal ?? 0} />
            </button>
          ))}
        </section>
      )}

      {semLimite.length > 0 && (
        <Grupo titulo="Sem limite">
          {semLimite.map((c) => {
            const g = gastos.get(c.id) ?? 0
            return (
              <button key={c.id} type="button" onClick={() => abrir(c)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-slate-100 dark:active:bg-slate-800">
                <span className="w-7 text-center text-lg" aria-hidden>{c.icone}</span>
                <span className="flex-1">{c.nome}</span>
                {g > 0 && <span className="numeros text-sm text-slate-500 dark:text-slate-400">{formatarBRL(g)}</span>}
                <span className="text-sm font-medium text-marca-600 dark:text-marca-100">Definir</span>
              </button>
            )
          })}
        </Grupo>
      )}

      <Folha aberta={!!editando} titulo={editando ? `Limite: ${editando.nome}` : ''} onFechar={() => setEditando(null)}
        acao={<button type="button" onClick={() => void salvar(valor)} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>}>
        <div className="space-y-4">
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">Quanto você quer gastar no máximo por mês?</p>
          <CampoValor rotulo="Limite mensal" valor={valor} onMudar={setValor} grande foco />
          {sugestao !== null ? (
            <Botao variante="secundario" className="w-full" onClick={() => setValor(sugestao)}>
              Usar média dos últimos 3 meses: {formatarBRL(sugestao)}
            </Botao>
          ) : (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">Sem histórico ainda para sugerir um valor.</p>
          )}
          <Botao className="w-full" onClick={() => void salvar(valor)} disabled={valor <= 0}>Salvar limite</Botao>
          {editando?.limiteMensal !== null && (
            <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={() => void salvar(null)}>Remover limite</Botao>
          )}
        </div>
      </Folha>
    </>
  )
}
