import Anthropic from '@anthropic-ai/sdk'
import { INSTRUCOES_CONSULTOR } from '../core/resumoConsultor'

export type MensagemChat = Anthropic.Beta.BetaMessageParam

export interface Conversa {
  /** Para a resposta no meio (botão "Parar"). */
  parar: () => void
  /** Resolve com o texto final da resposta. */
  resposta: Promise<{ texto: string; recusou: boolean; cortada: boolean }>
}

/**
 * Pergunta ao Claude com o resumo agregado e o histórico da conversa.
 * Chamada direta do navegador com a chave da própria pessoa (guardada na conta dela).
 */
export function conversar(p: { chave: string; resumo: string; historico: MensagemChat[]; aoEscrever: (textoAteAgora: string) => void }): Conversa {
  const cliente = new Anthropic({ apiKey: p.chave, dangerouslyAllowBrowser: true, maxRetries: 2 })
  const fluxo = cliente.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    // se o modelo recusar por engano, o servidor tenta o modelo recomendado para o caso
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: INSTRUCOES_CONSULTOR },
      { type: 'text', text: `Resumo das finanças da pessoa:\n\n${p.resumo}`, cache_control: { type: 'ephemeral' } },
    ],
    messages: p.historico,
  })
  fluxo.on('text', (_delta, ate) => p.aoEscrever(ate))
  const resposta = fluxo.finalMessage().then((m) => ({
    texto: m.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join(''),
    recusou: m.stop_reason === 'refusal',
    cortada: m.stop_reason === 'max_tokens',
  }))
  return { parar: () => fluxo.abort(), resposta }
}

/** Mensagem amigável para os erros da API. */
export function explicarErro(e: unknown): string {
  if (e instanceof Anthropic.APIUserAbortError) return ''
  if (e instanceof Anthropic.AuthenticationError) return 'A chave da API do Claude não foi aceita. Confira em Ajustes › Consultor.'
  if (e instanceof Anthropic.PermissionDeniedError) return 'Esta chave não tem permissão para usar o modelo. Confira sua conta no console da Anthropic.'
  if (e instanceof Anthropic.RateLimitError) return 'Muitas perguntas seguidas ou limite da conta atingido. Espere um pouco e tente de novo.'
  if (e instanceof Anthropic.BadRequestError) return `O pedido foi recusado pela API (${e.message}).`
  if (e instanceof Anthropic.APIConnectionError) return 'Sem conexão com a API do Claude. Verifique a internet.'
  if (e instanceof Anthropic.APIError) return `A API do Claude respondeu com erro ${e.status}. Tente de novo em instantes.`
  return 'Não foi possível falar com o Consultor agora.'
}
