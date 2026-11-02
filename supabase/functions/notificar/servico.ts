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
    if (!endpointOficial(i.endpoint)) return 410 // endereço estranho: trata como inscrição morta (é apagada)
    try {
      const r = await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, conteudo, { TTL: 60 * 60 * 24, urgency: 'normal' })
      return r.statusCode
    } catch (e) { return (e as { statusCode?: number }).statusCode ?? 500 }
  }

  // 1) agendador (pg_cron), com o segredo guardado no banco
  if (segredoConfere(req.headers.get('x-cron'), cfg.segredo_cron)) {
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
    const { data: lim } = await admin.from('push_limites').select('ultimo_teste').eq('user_id', usuario.user.id).maybeSingle()
    if (lim && Date.now() - Date.parse(lim.ultimo_teste) < INTERVALO_TESTE_MS) return json({ erro: 'Aguarde alguns segundos antes de testar de novo.' }, 429)
    await admin.from('push_limites').upsert({ user_id: usuario.user.id, ultimo_teste: new Date().toISOString() })
    const { data } = await admin.from('push_inscricoes').select('endpoint, user_id, p256dh, auth').eq('user_id', usuario.user.id)
    return json(await enviarTeste((data ?? []) as Inscricao[], enviar))
  }
  return json({ erro: 'ação desconhecida' }, 400)
})
