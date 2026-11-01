import type { SupabaseClient } from '@supabase/supabase-js'
import type { LinhaNuvem, LinhaRecebida, Servidor } from './sincronizacao'

/** Servidor de sincronização usando as funções do arquivo supabase/migracao.sql. */
export function servidorSupabase(cliente: SupabaseClient): Servidor {
  return {
    async enviar(linhas: LinhaNuvem[]) {
      const { error } = await cliente.rpc('sincronizar_enviar', { linhas })
      if (error) throw new Error(`Falha ao enviar: ${error.message}`)
    },
    async apagarTabela(tabela: string, ate: string) {
      const { error } = await cliente.rpc('sincronizar_apagar_tabela', { p_tabela: tabela, p_ate: ate })
      if (error) throw new Error(`Falha ao apagar: ${error.message}`)
    },
    async receber(desde: string | null, limite: number) {
      const { data, error } = await cliente.rpc('sincronizar_receber', { p_desde: desde, p_limite: limite })
      if (error) throw new Error(`Falha ao receber: ${error.message}`)
      return (data ?? []) as LinhaRecebida[]
    },
  }
}
