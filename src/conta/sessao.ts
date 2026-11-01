import { useSyncExternalStore } from 'react'
import { supabase } from '../nuvem/cliente'

export interface Usuario { id: string; email: string }
export type Sessao =
  | { tipo: 'carregando' }
  | { tipo: 'sem-conta' }
  | { tipo: 'logado'; usuario: Usuario }
  | { tipo: 'nova-senha'; usuario: Usuario } // veio do link "esqueci a senha"

let atual: Sessao = { tipo: 'carregando' }
const ouvintes = new Set<() => void>()
const definir = (s: Sessao) => { atual = s; ouvintes.forEach((f) => f()) }

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => {
    if (atual.tipo === 'carregando') {
      const u = data.session?.user
      definir(u ? { tipo: 'logado', usuario: { id: u.id, email: u.email ?? '' } } : { tipo: 'sem-conta' })
    }
  })
  supabase.auth.onAuthStateChange((evento, sessao) => {
    const u = sessao?.user
    if (!u) { definir({ tipo: 'sem-conta' }); return }
    const usuario = { id: u.id, email: u.email ?? '' }
    if (evento === 'PASSWORD_RECOVERY') definir({ tipo: 'nova-senha', usuario })
    else if (atual.tipo !== 'nova-senha' || evento === 'USER_UPDATED') {
      if (atual.tipo !== 'logado' || atual.usuario.id !== usuario.id) definir({ tipo: 'logado', usuario })
    }
  })
} else {
  atual = { tipo: 'sem-conta' }
}

export function useSessao(): Sessao {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => atual)
}

/** Endereço para onde os e-mails de confirmação e de nova senha mandam a pessoa. */
export function enderecoDoApp(): string {
  return `${window.location.origin}${window.location.pathname}`
}

/** Mensagens do Supabase em português. */
export function traduzirErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar: abra o link que enviamos.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Já existe uma conta com este e-mail. Tente entrar ou use "Esqueci a senha".'
  if (m.includes('password should be') || m.includes('weak password')) return 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.'
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'E-mail inválido.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.'
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da anterior.'
  return msg
}
