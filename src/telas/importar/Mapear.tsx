import { useState } from 'react'
import { aplicarMapeamento, type MapeamentoCSV, type TabelaCSV } from '../../core/importacao/csv'
import { formatarBRL } from '../../core/dinheiro'
import { formatarData } from '../../core/datas'
import { Botao, Cartao, Interruptor, Segmentado, Tela } from '../../ui/componentes'

/** Quando o CSV não é reconhecido sozinho: o usuário diz qual coluna é qual. */
export function Mapear({ nome, tabela, inicial, onConfirmar, onCancelar }: {
  nome: string; tabela: TabelaCSV; inicial: MapeamentoCSV; onConfirmar: (m: MapeamentoCSV) => void; onCancelar: () => void
}) {
  const [m, setM] = useState<MapeamentoCSV>(inicial)
  const [modo, setModo] = useState<'valor' | 'separado'>(inicial.valor === null ? 'separado' : 'valor')
  const ncol = Math.max(...tabela.linhas.slice(0, 30).map((l) => l.length))
  const cab = m.linhaCabecalho >= 0 ? tabela.linhas[m.linhaCabecalho] : undefined
  const nomeCol = (j: number) => `Coluna ${j + 1}${cab?.[j] ? ` — ${cab[j]}` : ''}`
  const final: MapeamentoCSV = modo === 'valor' ? { ...m, credito: null, debito: null, valor: m.valor ?? 2 } : { ...m, valor: null, credito: m.credito ?? 2, debito: m.debito ?? 3 }
  const previa = aplicarMapeamento(tabela, final)

  const Seletor = ({ rotulo, valor, onMudar }: { rotulo: string; valor: number | null; onMudar: (n: number) => void }) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{rotulo}</span>
      <select value={valor ?? ''} onChange={(e) => onMudar(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-borda-escuro dark:bg-slate-900">
        {Array.from({ length: ncol }, (_, j) => <option key={j} value={j}>{nomeCol(j)}</option>)}
      </select>
    </label>
  )

  return (
    <Tela titulo="Qual coluna é qual?" subtitulo={nome}>
      <Cartao titulo="Primeiras linhas do arquivo">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {tabela.linhas.slice(0, 6).map((l, i) => (
                <tr key={i} className={`border-t border-slate-200 dark:border-borda-escuro ${i === m.linhaCabecalho ? 'font-semibold' : ''}`}>
                  {l.map((c, j) => <td key={j} className="max-w-32 truncate px-1 py-1.5 whitespace-nowrap">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Linha de cabeçalho</span>
            <select value={m.linhaCabecalho} onChange={(e) => setM({ ...m, linhaCabecalho: Number(e.target.value) })} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-borda-escuro dark:bg-slate-900">
              <option value={-1}>Sem cabeçalho</option>
              {tabela.linhas.slice(0, 10).map((l, i) => <option key={i} value={i}>Linha {i + 1}: {l.join(' | ').slice(0, 40)}</option>)}
            </select>
          </label>
          <Seletor rotulo="Data" valor={m.data} onMudar={(data) => setM({ ...m, data })} />
          <Seletor rotulo="Descrição" valor={m.descricao[0] ?? 1} onMudar={(d) => setM({ ...m, descricao: [d] })} />
          <Segmentado rotulo="Formato do valor" valor={modo} onMudar={setModo}
            opcoes={[{ valor: 'valor', rotulo: 'Uma coluna de valor' }, { valor: 'separado', rotulo: 'Crédito e débito' }]} />
          {modo === 'valor'
            ? <Seletor rotulo="Valor" valor={final.valor} onMudar={(valor) => setM({ ...m, valor })} />
            : <><Seletor rotulo="Crédito (entradas)" valor={final.credito} onMudar={(credito) => setM({ ...m, credito })} />
               <Seletor rotulo="Débito (saídas)" valor={final.debito} onMudar={(debito) => setM({ ...m, debito })} /></>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm"><span className="font-medium">Valores positivos são gastos</span><span className="block text-xs text-slate-500 dark:text-slate-400">Comum em faturas de cartão</span></span>
            <Interruptor rotulo="Valores positivos são gastos" ligado={m.positivoEhGasto} onMudar={(positivoEhGasto) => setM({ ...m, positivoEhGasto })} />
          </div>
        </div>
      </Cartao>

      <Cartao titulo={`Prévia: ${previa.linhas.length} ${previa.linhas.length === 1 ? 'linha reconhecida' : 'linhas reconhecidas'}`}>
        {previa.linhas.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma linha com data e valor válidos com essa escolha.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {previa.linhas.slice(0, 4).map((l, i) => (
              <li key={i} className="flex justify-between gap-2"><span className="truncate">{formatarData(l.data)} · {l.descricao}</span><span className="numeros shrink-0">{formatarBRL(l.valor)}</span></li>
            ))}
          </ul>
        )}
      </Cartao>

      <div className="flex gap-2">
        <Botao variante="secundario" onClick={onCancelar}>Cancelar</Botao>
        <Botao className="flex-1" disabled={previa.linhas.length === 0} onClick={() => onConfirmar(final)}>Continuar</Botao>
      </div>
    </Tela>
  )
}
