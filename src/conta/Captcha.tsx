import { useCallback, useEffect, useRef, useState } from 'react'
import { PROJETO } from '../nuvem/projeto'

/**
 * Verificação anti-robô (Cloudflare Turnstile) para entrar, criar conta e trocar senha.
 * Quase sempre invisível: só aparece um desafio se a Cloudflare desconfiar do acesso.
 * Desligada enquanto PROJETO.chaveCaptcha estiver vazia.
 */

interface Turnstile {
  render(el: HTMLElement, opcoes: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}
declare global { interface Window { turnstile?: Turnstile } }

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let carregando: Promise<Turnstile> | null = null

function carregarTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  carregando ??= new Promise<Turnstile>((ok, falha) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => (window.turnstile ? ok(window.turnstile) : falha(new Error('captcha indisponível')))
    s.onerror = () => { carregando = null; falha(new Error('captcha indisponível')) }
    document.head.appendChild(s)
  })
  return carregando
}

export const captchaLigado = () => PROJETO.chaveCaptcha !== ''

export function useCaptcha() {
  const caixa = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const token = useRef<string | null>(null)
  const esperando = useRef<((t: string | null) => void)[]>([])
  const [falhou, setFalhou] = useState(false)
  const falhouRef = useRef(false)
  const marcarFalha = (f: boolean) => { falhouRef.current = f; setFalhou(f) }

  const entregar = (t: string | null) => { token.current = t; esperando.current.splice(0).forEach((f) => f(t)) }

  useEffect(() => {
    if (!captchaLigado() || !caixa.current) return
    let ativo = true
    carregarTurnstile().then((ts) => {
      if (!ativo || !caixa.current) return
      widget.current = ts.render(caixa.current, {
        sitekey: PROJETO.chaveCaptcha,
        appearance: 'interaction-only',
        language: 'pt-br',
        theme: 'auto',
        callback: (t: string) => { marcarFalha(false); entregar(t) },
        'expired-callback': () => { token.current = null },
        'error-callback': () => { marcarFalha(true); entregar(null); return true },
      })
    }).catch(() => { if (ativo) { marcarFalha(true); entregar(null) } })
    return () => { ativo = false; if (widget.current) window.turnstile?.remove(widget.current); widget.current = null }
  }, [])

  /** Token para mandar ao Supabase (undefined se o CAPTCHA estiver desligado). Espera até 30 s. */
  const pegarToken = useCallback(async (): Promise<string | undefined> => {
    if (!captchaLigado()) return undefined
    if (token.current) return token.current
    if (falhouRef.current) throw new Error('captcha: verificação anti-robô indisponível')
    const t = await new Promise<string | null>((ok) => {
      esperando.current.push(ok)
      setTimeout(() => ok(null), 30_000)
    })
    if (!t) throw new Error('captcha: verificação anti-robô não concluída')
    return t
  }, [])

  /** Cada token vale uma vez: depois de usar, pede outro. */
  const renovar = useCallback(() => {
    token.current = null
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [])

  const elemento = captchaLigado()
    ? <div>
        <div ref={caixa} className="flex justify-center empty:hidden" />
        {falhou && <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">Não foi possível carregar a verificação anti-robô. Confira a internet ou desative bloqueadores de anúncio.</p>}
      </div>
    : null

  return { elemento, pegarToken, renovar }
}
