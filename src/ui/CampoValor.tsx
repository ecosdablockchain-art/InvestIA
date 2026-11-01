import { useEffect, useId, useRef } from 'react'
import { formatarBRL, lerValor, type Centavos } from '../core/dinheiro'

const MAXIMO = 99_999_999_999 // R$ 999.999.999,99

/** Próximo valor a partir de uma tecla, sem depender da posição do cursor. */
export function aplicarTecla(valor: Centavos, tipo: string, texto: string | null): Centavos {
  if (tipo.startsWith('delete')) return Math.floor(valor / 10)
  if (tipo === 'insertFromPaste' || tipo === 'insertReplacementText') {
    const lido = texto ? lerValor(texto) : null
    return lido === null ? valor : Math.min(MAXIMO, Math.abs(lido))
  }
  if (tipo.startsWith('insert') && texto) {
    let v = valor
    for (const ch of texto) {
      if (ch >= '0' && ch <= '9') v = v * 10 + Number(ch)
      if (v > MAXIMO) return valor
    }
    return v
  }
  return valor
}

/**
 * Campo de valor em que os dígitos entram pela direita, como nos apps de banco:
 * digitar 4 5 9 0 mostra R$ 45,90. Abre o teclado numérico.
 */
export function CampoValor({ valor, onMudar, rotulo, grande, foco, tom }: {
  valor: Centavos; onMudar: (v: Centavos) => void; rotulo: string; grande?: boolean; foco?: boolean; tom?: 'gasto' | 'renda'
}) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  const atual = useRef({ valor, onMudar })
  atual.current = { valor, onMudar }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const antesDeDigitar = (e: InputEvent) => {
      e.preventDefault()
      const { valor, onMudar } = atual.current
      const texto = e.data ?? e.dataTransfer?.getData('text/plain') ?? null
      const novo = aplicarTecla(valor, e.inputType, texto)
      // atualiza na hora: teclas rápidas podem chegar antes da próxima renderização
      atual.current = { valor: novo, onMudar }
      if (novo !== valor) onMudar(novo)
    }
    el.addEventListener('beforeinput', antesDeDigitar)
    return () => el.removeEventListener('beforeinput', antesDeDigitar)
  }, [])

  const cor = tom === 'gasto' ? 'text-negativo dark:text-negativo-escuro' : tom === 'renda' ? 'text-positivo dark:text-positivo-escuro' : ''
  const irParaOFim = () => {
    const el = ref.current
    if (el) requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
  }
  return (
    <div>
      <label htmlFor={id} className={grande ? 'sr-only' : 'mb-1 block text-sm font-medium'}>{rotulo}</label>
      <input
        ref={ref}
        id={id}
        data-foco={foco ? '' : undefined}
        inputMode="numeric"
        autoComplete="off"
        value={formatarBRL(valor)}
        // Reserva para navegadores sem "beforeinput": usa só os dígitos do texto.
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11)
          onMudar(digitos === '' ? 0 : Number(digitos))
        }}
        onFocus={irParaOFim}
        onClick={irParaOFim}
        className={grande
          ? `numeros w-full bg-transparent py-2 text-center text-[2.6rem] font-semibold tracking-tight outline-none ${cor}`
          : `numeros min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-borda-escuro dark:bg-slate-900 ${cor}`}
      />
    </div>
  )
}
