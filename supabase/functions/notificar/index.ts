// Finanças 360 — serviço "notificar" (Supabase Edge Function).
// Cole este arquivo inteiro em: Edge Functions › Deploy a new function › Via Editor › nome "notificar".
// Desligue "Verify JWT" (o serviço confere o acesso por conta própria).
// Gerado a partir de logica.ts + servico.ts: não edite à mão.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

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

// Parte que só roda no Supabase (Deno). Junta-se a logica.ts para formar index.ts.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // chaves de envio: criadas na primeira vez e guardadas só no banco
  let { data: cfg } = await admin.from('config_push').select('publica, privada, segredo_cron').eq('id', 1).single()
  if (!cfg) return json({ erro: 'Rode supabase/migracao-notificacoes.sql antes.' }, 500)
  if (!cfg.publica || !cfg.privada) {
    const novas = webpush.generateVAPIDKeys()
    await admin.from('config_push').update({ publica: novas.publicKey, privada: novas.privateKey }).eq('id', 1)
    cfg = { ...cfg, publica: novas.publicKey, privada: novas.privateKey }
  }
  webpush.setVapidDetails('https://ecosdablockchain-art.github.io/InvestIA/', cfg.publica, cfg.privada)
  const enviar: Enviar = async (i, conteudo) => {
    try {
      const r = await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, conteudo, { TTL: 60 * 60 * 24, urgency: 'normal' })
      return r.statusCode
    } catch (e) { return (e as { statusCode?: number }).statusCode ?? 500 }
  }

  // 1) agendador (pg_cron), com o segredo guardado no banco
  if (req.headers.get('x-cron') && req.headers.get('x-cron') === cfg.segredo_cron) {
    const banco: Banco = {
      async pendentes(ate, limite) {
        const desde = new Date(Date.parse(ate) - 2 * 86_400_000).toISOString()
        await admin.from('notificacoes').update({ enviada_em: ate }).is('enviada_em', null).lt('quando', desde) // velhas demais: descarta
        const { data } = await admin.from('notificacoes').select('user_id, id, titulo, corpo, url').is('enviada_em', null).lte('quando', ate).order('quando').limit(limite)
        return (data ?? []) as Pendente[]
      },
      async inscricoes(usuarios) {
        const { data } = await admin.from('push_inscricoes').select('endpoint, user_id, p256dh, auth').in('user_id', usuarios)
        return (data ?? []) as Inscricao[]
      },
      async marcarEnviadas(itens) {
        const agora = new Date().toISOString()
        for (const i of itens) await admin.from('notificacoes').update({ enviada_em: agora }).eq('user_id', i.user_id).eq('id', i.id)
      },
      async apagarInscricao(endpoint) { await admin.from('push_inscricoes').delete().eq('endpoint', endpoint) },
    }
    return json(await processarPendentes(banco, enviar, new Date()))
  }

  // 2) pedidos do app, com o login da pessoa
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: usuario } = await admin.auth.getUser(token)
  if (!usuario?.user) return json({ erro: 'não autorizado' }, 401)
  const corpo = await req.json().catch(() => ({})) as { acao?: string }
  if (corpo.acao === 'chave') return json({ publica: cfg.publica })
  if (corpo.acao === 'teste') {
    const { data } = await admin.from('push_inscricoes').select('endpoint, user_id, p256dh, auth').eq('user_id', usuario.user.id)
    return json(await enviarTeste((data ?? []) as Inscricao[], enviar))
  }
  return json({ erro: 'ação desconhecida' }, 400)
})
