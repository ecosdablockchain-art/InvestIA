import { useRef, useState, type ReactNode } from 'react'

const LARGURA_ACOES = 152

/**
 * Linha de lista que desliza para a esquerda revelando "Editar" e "Apagar".
 * Toque simples chama onTocar (abre a edição). Leitores de tela usam o toque simples.
 */
export function LinhaDeslizante({ children, onTocar, onEditar, onApagar, rotulo }: {
  children: ReactNode; onTocar: () => void; onEditar: () => void; onApagar: () => void; rotulo: string
}) {
  const [x, setX] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const inicio = useRef<{ px: number; py: number; x: number; horizontal: boolean | null } | null>(null)
  const arrastou = useRef(false)
  const aberta = x <= -LARGURA_ACOES / 2

  function fechar() { setX(0) }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: LARGURA_ACOES }} aria-hidden={!aberta}>
        <button type="button" tabIndex={aberta ? 0 : -1} onClick={() => { fechar(); onEditar() }}
          className="flex-1 bg-slate-500 text-sm font-semibold text-white">Editar</button>
        <button type="button" tabIndex={aberta ? 0 : -1} onClick={() => { fechar(); onApagar() }}
          className="flex-1 bg-red-600 text-sm font-semibold text-white">Apagar</button>
      </div>
      <button
        type="button"
        aria-label={rotulo}
        className="relative block w-full bg-white text-left active:bg-slate-50 dark:bg-superficie-escuro dark:active:bg-slate-800"
        style={{ transform: `translateX(${x}px)`, transition: arrastando ? 'none' : 'transform .2s ease', touchAction: 'pan-y' }}
        onPointerDown={(e) => { arrastou.current = false; inicio.current = { px: e.clientX, py: e.clientY, x, horizontal: null } }}
        onPointerMove={(e) => {
          const i = inicio.current
          if (!i) return
          const dx = e.clientX - i.px
          const dy = e.clientY - i.py
          if (i.horizontal === null && Math.abs(dx) + Math.abs(dy) > 8) i.horizontal = Math.abs(dx) > Math.abs(dy)
          if (!i.horizontal) return
          setArrastando(true)
          setX(Math.max(-LARGURA_ACOES - 20, Math.min(0, i.x + dx)))
        }}
        onPointerUp={() => {
          const i = inicio.current
          inicio.current = null
          if (i?.horizontal) {
            arrastou.current = true
            setArrastando(false)
            setX((v) => (v < -LARGURA_ACOES / 2 ? -LARGURA_ACOES : 0))
          }
        }}
        onPointerCancel={() => { inicio.current = null; setArrastando(false); setX(0) }}
        onClick={(e) => {
          if (arrastou.current) { arrastou.current = false; e.preventDefault(); return }
          if (x !== 0) { fechar(); return }
          onTocar()
        }}
      >
        {children}
      </button>
    </div>
  )
}
