import type { LinhaNuvem, LinhaRecebida, Servidor } from './sincronizacao'

/** Servidor em memória com as mesmas regras do SQL do Supabase (para testes). */
export class ServidorMemoria implements Servidor {
  linhas = new Map<string, LinhaRecebida>()
  private relogio = BigInt(Date.parse('2026-01-01T00:00:00Z')) * 1000n
  /** microssegundos, 17 dígitos — como a função sincronizar_receber do Supabase */
  private agora() { this.relogio += 1n; return this.relogio.toString().padStart(17, '0') }

  async enviar(linhas: LinhaNuvem[]) {
    for (const l of linhas) {
      const chave = `${l.tabela}:${l.id}`
      const atual = this.linhas.get(chave)
      if (atual && atual.atualizado_em > l.atualizado_em) continue // a do servidor é mais nova
      this.linhas.set(chave, { ...l, servidor_em: this.agora() })
    }
  }
  async apagarTabela(tabela: string, ate: string) {
    for (const [k, l] of this.linhas) {
      if (l.tabela === tabela && !l.apagado && l.atualizado_em < ate) {
        this.linhas.set(k, { ...l, apagado: true, dados: null, atualizado_em: ate, servidor_em: this.agora() })
      }
    }
  }
  async receber(desde: string | null, limite: number) {
    return [...this.linhas.values()].filter((l) => !desde || l.servidor_em > desde)
      .sort((a, b) => a.servidor_em.localeCompare(b.servidor_em)).slice(0, limite)
  }
}
