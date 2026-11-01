import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

let aplicar: ((recarregar?: boolean) => Promise<void>) | null = null
let verificar: (() => void) | null = null
const ouvintes = new Set<() => void>()
let haNova = false

/** Registra o modo offline e procura versão nova ao abrir, ao voltar para o app e a cada 30 minutos. */
export function iniciarAtualizacoes() {
  if (!('serviceWorker' in navigator)) return
  aplicar = registerSW({
    immediate: true,
    onNeedRefresh() { haNova = true; ouvintes.forEach((f) => f()) },
    onRegisteredSW(_url, registro) {
      if (!registro) return
      verificar = () => { void registro.update() }
      setInterval(verificar, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verificar?.() })
    },
  })
}

export function procurarAtualizacao() { verificar?.() }

/** Faixa no topo quando há versão nova do app. */
export function AvisoAtualizacao() {
  const [nova, setNova] = useState(haNova)
  useEffect(() => { const f = () => setNova(haNova); ouvintes.add(f); return () => { ouvintes.delete(f) } }, [])
  if (!nova) return null
  return (
    <div role="status" className="pt-seguro fixed inset-x-0 top-0 z-50 bg-marca-600 px-4 pb-2 text-white shadow-lg">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <span className="flex-1 text-sm font-medium">Nova versão do Finanças 360 disponível.</span>
        <button type="button" className="min-h-10 rounded-lg bg-white px-3 text-sm font-semibold text-marca-700" onClick={() => void aplicar?.(true)}>Atualizar</button>
      </div>
    </div>
  )
}
