import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAjustesConta } from '../../db/ajustesConta'
import { conversar, explicarErro, type Conversa, type MensagemChat } from '../../servicos/consultor'
import { Botao, EstadoVazio, Tela } from '../../ui/componentes'
import { useResumoConsultor } from './resumo'

const SUGESTOES = ['Como estão minhas finanças este mês?', 'Onde dá para cortar gastos?', 'Qual dívida vale quitar primeiro?', 'Estou no caminho das minhas metas?', 'Minha reserva de emergência está boa?']

/** Markdown bem simples: parágrafos, listas com "- " e **negrito**. */
function Texto({ texto }: { texto: string }) {
  const negrito = (t: string): ReactNode[] => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p))
  const blocos: ReactNode[] = []
  let lista: string[] = []
  const fecharLista = () => { if (lista.length) { blocos.push(<ul key={blocos.length} className="ml-5 list-disc space-y-1">{lista.map((x, i) => <li key={i}>{negrito(x)}</li>)}</ul>); lista = [] } }
  for (const linha of texto.split('\n')) {
    const m = /^\s*[-•*]\s+(.*)$/.exec(linha) ?? /^\s*\d+[.)]\s+(.*)$/.exec(linha)
    if (m) { lista.push(m[1] ?? ''); continue }
    fecharLista()
    if (linha.trim()) blocos.push(<p key={blocos.length}>{negrito(linha.replace(/^#+\s*/, ''))}</p>)
  }
  fecharLista()
  return <div className="space-y-2">{blocos}</div>
}

export function Consultor() {
  const ajustes = useAjustesConta()
  const resumo = useResumoConsultor()
  const [historico, setHistorico] = useState<MensagemChat[]>([])
  const [escrevendo, setEscrevendo] = useState<string | null>(null)
  const [pergunta, setPergunta] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [resumoDaConversa, setResumoDaConversa] = useState<string | null>(null)
  const atual = useRef<Conversa | null>(null)
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [historico, escrevendo])
  useEffect(() => () => atual.current?.parar(), [])

  if (!ajustes) return <Tela titulo="Consultor"><p className="sr-only">Carregando…</p></Tela>
  const aviso = (
    <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      🤖 Respostas geradas por IA (Claude), a partir de um resumo dos seus números. Pode errar. Não substitui planejador financeiro, contador ou assessor de investimentos credenciado na CVM, e não recomenda ativos específicos.
    </p>
  )
  if (!ajustes.chaveClaude) {
    return (
      <Tela titulo="Consultor" voltar={{ rotulo: 'Painel', href: '#/painel' }}>
        {aviso}
        <EstadoVazio icone="💬" titulo="Converse sobre as suas finanças" texto="O Consultor usa a IA Claude, da Anthropic, com a sua própria chave da API. Crie uma chave em console.anthropic.com (o uso é cobrado pela Anthropic na sua conta) e cole em Ajustes › Consultor.">
          <a href="#/ajustes" className="inline-flex min-h-11 items-center rounded-xl bg-marca-600 px-4 font-semibold text-white">Abrir Ajustes</a>
        </EstadoVazio>
      </Tela>
    )
  }

  function enviar(texto: string) {
    const t = texto.trim()
    if (!t || escrevendo !== null || !resumo) return
    setErro(null)
    const resumoUsado = resumoDaConversa ?? resumo // o mesmo resumo na conversa toda
    setResumoDaConversa(resumoUsado)
    const novo: MensagemChat[] = [...historico, { role: 'user', content: t }]
    setHistorico(novo)
    setPergunta('')
    setEscrevendo('')
    const c = conversar({ chave: ajustes!.chaveClaude, resumo: resumoUsado, historico: novo, aoEscrever: setEscrevendo })
    atual.current = c
    c.resposta.then(({ texto: r, recusou, cortada }) => {
      const final = recusou ? 'Não consigo ajudar com essa pergunta. Tente perguntar de outro jeito, focando em orçamento, dívidas, reserva ou metas.' : r + (cortada ? '\n\n(resposta interrompida por ser longa demais)' : '')
      setHistorico([...novo, { role: 'assistant', content: final }])
    }).catch((e: unknown) => {
      const msg = explicarErro(e)
      setHistorico(msg ? historico : [...novo, { role: 'assistant', content: '(resposta interrompida)' }])
      if (msg) { setErro(msg); setPergunta(t) }
    }).finally(() => { setEscrevendo(null); atual.current = null })
  }

  function parar() {
    const parcial = escrevendo
    atual.current?.parar()
    if (parcial) setHistorico((h) => [...h, { role: 'assistant', content: `${parcial}\n\n(interrompido)` }])
  }

  function novaConversa() { atual.current?.parar(); setHistorico([]); setEscrevendo(null); setErro(null); setResumoDaConversa(null) }

  return (
    <Tela titulo="Consultor" voltar={{ rotulo: 'Painel', href: '#/painel' }}
      acao={historico.length > 0 ? <Botao variante="secundario" className="min-h-10 px-3 text-sm" onClick={novaConversa}>Nova conversa</Botao> : undefined}>
      {aviso}
      {historico.length === 0 && escrevendo === null && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">Pergunte qualquer coisa sobre o seu dinheiro. Algumas ideias:</p>
          <div className="flex flex-wrap gap-2">
            {SUGESTOES.map((s) => <button key={s} type="button" disabled={!resumo} onClick={() => enviar(s)} className="min-h-10 rounded-full bg-white px-3 text-left text-sm ring-1 ring-slate-200 active:bg-slate-100 dark:bg-superficie-escuro dark:ring-borda-escuro">{s}</button>)}
          </div>
        </div>
      )}
      <div className="space-y-3" aria-live="polite">
        {historico.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-10 rounded-2xl rounded-br-md bg-marca-600 px-4 py-2.5 text-white' : 'mr-4 rounded-2xl rounded-bl-md bg-white px-4 py-3 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro'}>
            {m.role === 'user' ? <p className="whitespace-pre-wrap">{m.content as string}</p> : <Texto texto={m.content as string} />}
          </div>
        ))}
        {escrevendo !== null && (
          <div className="mr-4 rounded-2xl rounded-bl-md bg-white px-4 py-3 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
            {escrevendo ? <Texto texto={escrevendo} /> : <p className="animate-pulse text-slate-500">Pensando…</p>}
          </div>
        )}
        <div ref={fim} />
      </div>
      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}
      <div className="h-24" aria-hidden />
      <form className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-borda-escuro dark:bg-fundo-escuro/95"
        onSubmit={(e) => { e.preventDefault(); enviar(pergunta) }}>
        <div className="mx-auto flex max-w-xl items-end gap-2">
          <label htmlFor="pergunta" className="sr-only">Sua pergunta</label>
          <textarea id="pergunta" rows={1} value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Escreva sua pergunta…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(pergunta) } }}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base dark:border-borda-escuro dark:bg-slate-900" />
          {escrevendo !== null
            ? <Botao variante="secundario" onClick={parar}>Parar</Botao>
            : <Botao type="submit" disabled={!pergunta.trim() || !resumo}>Enviar</Botao>}
        </div>
      </form>
      {resumo && (
        <details className="text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer py-2">Ver o que é enviado para a IA</summary>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-100 p-2 whitespace-pre-wrap dark:bg-slate-800">{resumoDaConversa ?? resumo}</pre>
        </details>
      )}
    </Tela>
  )
}
