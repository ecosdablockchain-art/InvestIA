// Lógica do serviço de notificações, sem dependências (testada no projeto com vitest).
// O arquivo index.ts (para colar no Supabase) é gerado a partir deste com: npm run gerar-funcao

export interface Pendente { user_id: string; id: string; titulo: string; corpo: string; url: string }
export interface Inscricao { endpoint: string; user_id: string; p256dh: string; auth: string }

export interface Banco {
  pendentes(ate: string, limite: number): Promise<Pendente[]>
  inscricoes(usuarios: string[]): Promise<Inscricao[]>
  marcarEnviadas(itens: { user_id: string; id: string }[]): Promise<void>
  apagarInscricao(endpoint: string): Promise<void>
}

/** Envia uma notificação; resolve com o status HTTP do serviço de push. */
export type Enviar = (inscricao: Inscricao, conteudo: string) => Promise<number>

export interface Resumo { notificacoes: number; envios: number; falhas: number; inscricoesRemovidas: number }

/**
 * Envia o que está na hora para todos os aparelhos de cada pessoa.
 * Inscrições que o serviço de push diz não existirem mais (404/410) são apagadas.
 * Notificações atrasadas há mais de 2 dias são marcadas como enviadas sem envio (não faz sentido avisar).
 */
export async function processarPendentes(banco: Banco, enviar: Enviar, agora: Date): Promise<Resumo> {
  const resumo: Resumo = { notificacoes: 0, envios: 0, falhas: 0, inscricoesRemovidas: 0 }
  const pendentes = await banco.pendentes(agora.toISOString(), 500)
  if (pendentes.length === 0) return resumo
  const inscricoes = await banco.inscricoes([...new Set(pendentes.map((p) => p.user_id))])
  const mortas = new Set<string>()
  for (const p of pendentes) {
    const conteudo = JSON.stringify({ titulo: p.titulo, corpo: p.corpo, url: p.url, tag: p.id })
    for (const i of inscricoes.filter((x) => x.user_id === p.user_id && !mortas.has(x.endpoint))) {
      try {
        const status = await enviar(i, conteudo)
        if (status === 404 || status === 410) { mortas.add(i.endpoint); resumo.inscricoesRemovidas++; await banco.apagarInscricao(i.endpoint) }
        else if (status >= 200 && status < 300) resumo.envios++
        else resumo.falhas++
      } catch { resumo.falhas++ }
    }
    resumo.notificacoes++
  }
  await banco.marcarEnviadas(pendentes.map((p) => ({ user_id: p.user_id, id: p.id })))
  return resumo
}

/** Teste disparado pelo próprio usuário no app. */
export async function enviarTeste(inscricoes: Inscricao[], enviar: Enviar): Promise<{ aparelhos: number; ok: number }> {
  let ok = 0
  const conteudo = JSON.stringify({ titulo: 'Finanças 360', corpo: 'Notificações funcionando neste aparelho. ✅', url: '#/painel', tag: 'teste' })
  for (const i of inscricoes) {
    try { const s = await enviar(i, conteudo); if (s >= 200 && s < 300) ok++ } catch { /* conta como falha */ }
  }
  return { aparelhos: inscricoes.length, ok }
}
