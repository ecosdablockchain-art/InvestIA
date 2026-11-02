import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

let registro: ServiceWorkerRegistration | null = null
const ouvintes = new Set<() => void>()
let haNova = false

function avisarNova() { haNova = true; ouvintes.forEach((f) => f()) }

/** Espera um service worker novo terminar de instalar (ou falhar). */
function esperarInstalar(sw: ServiceWorker): Promise<boolean> {
  return new Promise((ok) => {
    if (sw.state === 'installed' || sw.state === 'activated') return ok(true)
    const fim = setTimeout(() => ok(false), 30_000)
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' || sw.state === 'activated') { clearTimeout(fim); ok(true) }
      if (sw.state === 'redundant') { clearTimeout(fim); ok(false) }
    })
  })
}

/** Registra o modo offline e procura versão nova ao abrir, ao voltar para o app e a cada 30 minutos. */
export function iniciarAtualizacoes() {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onNeedRefresh: avisarNova,
    onRegisteredSW(_url, r) {
      if (!r) return
      registro = r
      if (r.waiting && navigator.serviceWorker.controller) avisarNova()
      setInterval(() => void procurarAtualizacao(), 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void procurarAtualizacao() })
    },
  })
}

/** Procura versão nova agora. 'nova' também mostra a faixa azul no topo. */
export async function procurarAtualizacao(): Promise<'nova' | 'atual' | 'sem-conexao' | 'indisponivel'> {
  if (!registro) return 'indisponivel'
  try { await registro.update() } catch { return 'sem-conexao' }
  const novo = registro.waiting ?? registro.installing
  if (!novo || !navigator.serviceWorker.controller) return 'atual'
  if (await esperarInstalar(novo)) { avisarNova(); return 'nova' }
  return 'atual'
}

/**
 * Troca para a versão nova: pede ao service worker em espera para assumir e recarrega.
 * Se o aparelho não avisar a troca (acontece no iPhone), recarrega mesmo assim.
 */
export function aplicarAtualizacao() {
  let recarregou = false
  const recarregar = () => { if (!recarregou) { recarregou = true; window.location.reload() } }
  navigator.serviceWorker?.addEventListener('controllerchange', recarregar)
  const esperando = registro?.waiting
  if (esperando) esperando.postMessage({ type: 'SKIP_WAITING' })
  setTimeout(recarregar, esperando ? 3000 : 0)
}

/** Faixa no topo quando há versão nova do app. */
export function AvisoAtualizacao() {
  const [nova, setNova] = useState(haNova)
  const [aplicando, setAplicando] = useState(false)
  useEffect(() => { const f = () => setNova(haNova); ouvintes.add(f); return () => { ouvintes.delete(f) } }, [])
  if (!nova) return null
  return (
    <div role="status" className="pt-seguro fixed inset-x-0 top-0 z-50 bg-marca-600 px-4 pb-2 text-white shadow-lg">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <span className="flex-1 text-sm font-medium">{aplicando ? 'Atualizando…' : 'Nova versão do Finanças 360 disponível.'}</span>
        <button type="button" disabled={aplicando} className="min-h-10 rounded-lg bg-white px-3 text-sm font-semibold text-marca-700 disabled:opacity-60"
          onClick={() => { setAplicando(true); aplicarAtualizacao() }}>Atualizar</button>
      </div>
    </div>
  )
}
