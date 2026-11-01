import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/banco'
import { EstadoVazio, Grupo, Tela } from '../ui/componentes'
import { mostrarAviso } from '../ui/Aviso'
import { useDadosBase } from './mes/comum'

export function AjustesRegras() {
  const base = useDadosBase()
  const regras = useLiveQuery(() => db.regras.orderBy('padrao').toArray(), [])
  if (!base || !regras) return <Tela titulo="Regras de categoria"><p className="sr-only">Carregando…</p></Tela>
  return (
    <Tela titulo="Regras de categoria" voltar={{ rotulo: 'Ajustes', href: '#/ajustes' }}>
      {regras.length === 0 ? (
        <EstadoVazio icone="🧠" titulo="Nenhuma regra ainda"
          texto="Quando você corrige a categoria de um item ao importar um extrato, o app guarda a regra aqui e acerta sozinho da próxima vez." />
      ) : (
        <Grupo rodape="O texto é a parte principal da descrição do banco, sem números nem palavras como PIX ou COMPRA.">
          {regras.map((r) => {
            const c = base.categoria(r.categoriaId)
            const ctx = r.contextoId ? base.contexto(r.contextoId)?.nome : null
            return (
              <div key={r.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm">“{r.padrao}”</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">→ {c ? `${c.icone} ${c.nome}` : 'categoria apagada'}{ctx ? ` · ${ctx}` : ''} · usada {r.vezesUsada}×</span>
                </span>
                <button type="button" className="min-h-11 px-2 text-sm text-red-600 dark:text-red-400" aria-label={`Apagar regra ${r.padrao}`}
                  onClick={async () => { await db.regras.delete(r.id); mostrarAviso('Regra apagada') }}>Apagar</button>
              </div>
            )
          })}
        </Grupo>
      )}
    </Tela>
  )
}
