import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { criar, db, tocar } from '../db/banco'
import { CORES_CONTEXTO } from '../db/padroes'
import type { Categoria, Contexto, TipoCategoria } from '../db/tipos'
import { Botao, Campo, Grupo, Linha, Segmentado, Tela } from '../ui/componentes'

export function AjustesContextos() {
  const contextos = useLiveQuery(() => db.contextos.orderBy('ordem').toArray(), [])
  const [nome, setNome] = useState('')
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null)

  async function adicionar() {
    const n = nome.trim()
    if (!n || !contextos) return
    await db.contextos.add(criar<Contexto>({
      nome: n, tipo: 'negocio', icone: '🏢', cor: CORES_CONTEXTO[contextos.length % CORES_CONTEXTO.length] ?? '#2563eb',
      ordem: contextos.length, arquivado: false,
    }))
    setNome('')
  }

  async function salvarNome() {
    if (!editando || !editando.nome.trim()) return
    const c = await db.contextos.get(editando.id)
    if (c) await db.contextos.put(tocar({ ...c, nome: editando.nome.trim() }))
    setEditando(null)
  }

  async function alternarArquivo(c: Contexto) {
    await db.contextos.put(tocar({ ...c, arquivado: !c.arquivado }))
  }

  return (
    <Tela titulo="Contas e negócios" voltar={{ rotulo: 'Ajustes', href: '#/ajustes' }}>
      <Grupo rodape="Cada lançamento pertence a uma destas contas. O resultado de cada negócio aparece separado da sua sobra pessoal.">
        {contextos?.map((c) => (
          <div key={c.id}>
            {editando?.id === c.id ? (
              <div className="flex items-end gap-2 p-3">
                <div className="flex-1"><Campo rotulo="Nome" value={editando.nome} autoFocus onChange={(e) => setEditando({ id: c.id, nome: e.target.value })} /></div>
                <Botao onClick={salvarNome}>Salvar</Botao>
              </div>
            ) : (
              <Linha icone={c.icone} titulo={c.arquivado ? `${c.nome} (arquivada)` : c.nome} detalhe={c.tipo === 'pessoal' ? 'Pessoal' : 'Negócio'}>
                <div className="flex gap-1">
                  <button type="button" className="min-h-11 px-2 text-sm text-marca-600 dark:text-marca-100" onClick={() => setEditando({ id: c.id, nome: c.nome })} aria-label={`Renomear ${c.nome}`}>Renomear</button>
                  {c.tipo !== 'pessoal' && (
                    <button type="button" className="min-h-11 px-2 text-sm text-slate-600 dark:text-slate-300" onClick={() => alternarArquivo(c)}>
                      {c.arquivado ? 'Reativar' : 'Arquivar'}
                    </button>
                  )}
                </div>
              </Linha>
            )}
          </div>
        ))}
      </Grupo>
      <Grupo titulo="Novo negócio">
        <form className="flex items-end gap-2 p-3" onSubmit={(e) => { e.preventDefault(); void adicionar() }}>
          <div className="flex-1"><Campo rotulo="Nome" placeholder="Ex.: Machine Clean" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <Botao type="submit" disabled={!nome.trim()}>Adicionar</Botao>
        </form>
      </Grupo>
    </Tela>
  )
}

const TIPOS: { valor: TipoCategoria; rotulo: string }[] = [
  { valor: 'gasto', rotulo: 'Gasto' }, { valor: 'renda', rotulo: 'Entrada' }, { valor: 'ambos', rotulo: 'Ambos' },
]

export function AjustesCategorias() {
  const categorias = useLiveQuery(() => db.categorias.orderBy('ordem').toArray(), [])
  const [nova, setNova] = useState({ nome: '', icone: '🏷️', tipo: 'gasto' as TipoCategoria })

  async function adicionar() {
    if (!nova.nome.trim() || !categorias) return
    await db.categorias.add(criar<Categoria>({
      nome: nova.nome.trim(), icone: nova.icone.trim() || '🏷️', tipo: nova.tipo, limiteMensal: null,
      ordem: categorias.length, padrao: false, arquivada: false,
    }))
    setNova({ nome: '', icone: '🏷️', tipo: 'gasto' })
  }

  async function alternarArquivo(c: Categoria) {
    await db.categorias.put(tocar({ ...c, arquivada: !c.arquivada }))
  }

  return (
    <Tela titulo="Categorias" voltar={{ rotulo: 'Ajustes', href: '#/ajustes' }}>
      <Grupo rodape="Os limites mensais ficam na aba Mês › Limites. Categorias arquivadas somem das listas, mas os lançamentos antigos continuam com elas.">
        {categorias?.map((c) => (
          <Linha key={c.id} icone={c.icone} titulo={c.arquivada ? `${c.nome} (arquivada)` : c.nome}
            detalhe={TIPOS.find((t) => t.valor === c.tipo)?.rotulo}>
            <button type="button" className="min-h-11 px-2 text-sm text-slate-600 dark:text-slate-300" onClick={() => alternarArquivo(c)}
              aria-label={`${c.arquivada ? 'Reativar' : 'Arquivar'} ${c.nome}`}>
              {c.arquivada ? 'Reativar' : 'Arquivar'}
            </button>
          </Linha>
        ))}
      </Grupo>
      <Grupo titulo="Nova categoria">
        <form className="space-y-3 p-3" onSubmit={(e) => { e.preventDefault(); void adicionar() }}>
          <div className="flex gap-2">
            <div className="w-20"><Campo rotulo="Ícone" value={nova.icone} maxLength={4} onChange={(e) => setNova({ ...nova, icone: e.target.value })} /></div>
            <div className="flex-1"><Campo rotulo="Nome" placeholder="Ex.: Pets" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></div>
          </div>
          <Segmentado rotulo="Tipo da categoria" opcoes={TIPOS} valor={nova.tipo} onMudar={(tipo) => setNova({ ...nova, tipo })} />
          <Botao type="submit" className="w-full" disabled={!nova.nome.trim()}>Adicionar categoria</Botao>
        </form>
      </Grupo>
    </Tela>
  )
}
