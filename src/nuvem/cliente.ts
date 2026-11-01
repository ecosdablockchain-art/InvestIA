import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PROJETO } from './projeto'

/** URL e chave pública do projeto Supabase (a chave "anon" é pública por natureza; a segurança vem das regras do banco). */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || PROJETO.url
const chave = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || PROJETO.chavePublica

export const nuvemConfigurada = Boolean(url && chave)

export const supabase: SupabaseClient | null = nuvemConfigurada
  ? createClient(url, chave, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'financas360-sessao' },
    })
  : null
