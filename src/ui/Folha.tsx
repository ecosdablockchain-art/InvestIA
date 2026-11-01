import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Folha que sobe de baixo, no estilo do iOS. Fecha com Esc, no X ou tocando fora. */
export function Folha({ aberta, titulo, onFechar, children, acao }: {
  aberta: boolean; titulo: string; onFechar: () => void; children: ReactNode; acao?: ReactNode
}) {
  const id = useId()
  const painel = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar)
  fechar.current = onFechar

  useEffect(() => {
    if (!aberta) return
    const anterior = document.activeElement as HTMLElement | null
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar.current() }
    document.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    // foca o primeiro campo marcado com data-foco, ou o próprio painel
    requestAnimationFrame(() => (painel.current?.querySelector<HTMLElement>('[data-foco]') ?? painel.current)?.focus())
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
      anterior?.focus?.()
    }
  }, [aberta]) // só ao abrir/fechar: não rouba o foco a cada tecla

  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onFechar} aria-hidden />
      <div ref={painel} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
        className="pb-seguro absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-3xl bg-fundo shadow-2xl outline-none dark:bg-fundo-escuro">
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <button type="button" onClick={onFechar} className="min-h-11 px-1 text-marca-600 dark:text-marca-100">Cancelar</button>
          <h2 id={id} className="font-semibold">{titulo}</h2>
          <div className="min-w-16 text-right">{acao}</div>
        </div>
        <div className="overflow-y-auto px-4 pb-6">{children}</div>
      </div>
    </div>
  )
}
