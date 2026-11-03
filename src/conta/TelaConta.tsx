import { useState } from 'react'
import { supabase } from '../nuvem/cliente'
import { Botao, Campo, Segmentado } from '../ui/componentes'
import { enderecoDoApp, traduzirErro } from './sessao'
import { useCaptcha } from './Captcha'

type Modo = 'entrar' | 'criar' | 'esqueci'

export function TelaConta() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const captcha = useCaptcha()

  async function enviar() {
    if (!supabase) return
    setErro(null); setAviso(null)
    const e = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setErro('Informe um e-mail válido.'); return }
    if (modo !== 'esqueci' && senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (modo === 'criar' && !aceite) { setErro('Para criar a conta, aceite os Termos de uso e a Política de privacidade.'); return }
    setEnviando(true)
    try {
      const captchaToken = await captcha.pegarToken()
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password: senha, options: { captchaToken } })
        if (error) throw error
      } else if (modo === 'criar') {
        const { data, error } = await supabase.auth.signUp({
          email: e, password: senha,
          options: { captchaToken, emailRedirectTo: enderecoDoApp(), data: { aceite_termos_em: new Date().toISOString(), versao_termos: '2026-11' } },
        })
        if (error) throw error
        if (!data.session) {
          setAviso(`Enviamos um link de confirmação para ${e}. Abra o e-mail (veja também o spam) e toque no link para ativar a conta.`)
          setSenha('')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(e, { captchaToken, redirectTo: enderecoDoApp() })
        if (error) throw error
        setAviso(`Se existir uma conta com ${e}, você vai receber um link para criar uma nova senha.`)
      }
    } catch (err) {
      setErro(traduzirErro(err instanceof Error ? err.message : String(err)))
    } finally {
      captcha.renovar()
      setEnviando(false)
    }
  }

  return (
    <main className="pt-seguro pb-seguro mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        <img src="./icone.svg" alt="" className="h-14 w-14 rounded-2xl" />
        <div>
          <h1 className="text-2xl font-bold">Finanças 360</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Suas finanças em um só lugar, em qualquer aparelho.</p>
        </div>
      </div>

      {modo !== 'esqueci' && (
        <Segmentado rotulo="Entrar ou criar conta" valor={modo} onMudar={(m) => { setModo(m); setErro(null); setAviso(null) }}
          opcoes={[{ valor: 'entrar', rotulo: 'Entrar' }, { valor: 'criar', rotulo: 'Criar conta' }]} />
      )}
      {modo === 'esqueci' && <h2 className="text-lg font-semibold">Criar uma nova senha</h2>}

      <form className="mt-4 space-y-3" onSubmit={(ev) => { ev.preventDefault(); void enviar() }}>
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(ev) => setEmail(ev.target.value)} />
        {modo !== 'esqueci' && (
          <Campo rotulo="Senha" type="password" autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} value={senha}
            onChange={(ev) => setSenha(ev.target.value)} dica={modo === 'criar' ? 'Pelo menos 8 caracteres.' : undefined} />
        )}
        {modo === 'criar' && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={aceite} onChange={(ev) => setAceite(ev.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-marca-600" />
            <span>Li e aceito os <a href="#/termos" className="text-marca-600 underline dark:text-marca-100">Termos de uso</a> e a{' '}
              <a href="#/privacidade" className="text-marca-600 underline dark:text-marca-100">Política de privacidade</a>.</span>
          </label>
        )}
        {captcha.elemento}
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}
        {aviso && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{aviso}</p>}
        <Botao type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
        </Botao>
      </form>

      <div className="mt-4 text-center text-sm">
        {modo === 'esqueci'
          ? <button type="button" className="min-h-11 text-marca-600 dark:text-marca-100" onClick={() => { setModo('entrar'); setErro(null); setAviso(null) }}>Voltar para entrar</button>
          : <button type="button" className="min-h-11 text-marca-600 dark:text-marca-100" onClick={() => { setModo('esqueci'); setErro(null); setAviso(null) }}>Esqueci a senha</button>}
      </div>
      <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Seus dados ficam na sua conta e só você tem acesso. <a href="#/privacidade" className="underline">Privacidade</a> · <a href="#/termos" className="underline">Termos</a>
      </p>
    </main>
  )
}

export function TelaNovaSenha({ onConcluir }: { onConcluir: () => void }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  async function salvar() {
    if (!supabase) return
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) setErro(traduzirErro(error.message))
    else onConcluir()
  }
  return (
    <main className="pt-seguro mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <h1 className="text-2xl font-bold">Nova senha</h1>
      <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} dica="Pelo menos 8 caracteres." />
        {erro && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        <Botao type="submit" className="w-full" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</Botao>
      </form>
    </main>
  )
}
