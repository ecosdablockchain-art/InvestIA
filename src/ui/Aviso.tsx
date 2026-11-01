import { useSyncExternalStore } from 'react'

interface AvisoAtual { id: number; texto: string; acao?: { rotulo: string; executar: () => void } }

let atual: AvisoAtual | null = null
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

/** Mostra um aviso no rodapé por alguns segundos, com ação opcional (ex.: Desfazer). */
export function mostrarAviso(texto: string, acao?: AvisoAtual['acao']): void {
  atual = { id: ++seq, texto, acao }
  clearTimeout(timer)
  timer = setTimeout(fecharAviso, acao ? 6000 : 3000)
  avisar()
}

export function fecharAviso(): void {
  atual = null
  avisar()
}

export function Aviso() {
  const a = useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => atual)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      {a && (
        <div key={a.id} role="status" className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-2 text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">
          <span className="flex-1 text-sm">{a.texto}</span>
          {a.acao && (
            <button type="button" className="min-h-10 px-2 font-semibold text-sky-300 dark:text-marca-700"
              onClick={() => { a.acao?.executar(); fecharAviso() }}>{a.acao.rotulo}</button>
          )}
        </div>
      )}
    </div>
  )
}
