import https from 'node:https'
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import webpush from 'web-push'
import { enviarTeste, processarPendentes, type Banco, type Inscricao, type Pendente } from './logica'

function bancoFalso(pendentes: Pendente[], inscricoes: Inscricao[]) {
  const marcadas: string[] = []
  const apagadas: string[] = []
  const banco: Banco = {
    async pendentes() { return pendentes },
    async inscricoes(us) { return inscricoes.filter((i) => us.includes(i.user_id)) },
    async marcarEnviadas(itens) { marcadas.push(...itens.map((i) => `${i.user_id}/${i.id}`)) },
    async apagarInscricao(e) { apagadas.push(e) },
  }
  return { banco, marcadas, apagadas }
}
const insc = (user_id: string, endpoint: string): Inscricao => ({ user_id, endpoint, p256dh: 'p', auth: 'a' })

describe('serviço de notificações', () => {
  it('envia para todos os aparelhos de cada pessoa e marca como enviadas', async () => {
    const { banco, marcadas } = bancoFalso(
      [{ user_id: 'u1', id: 'fatura:x', titulo: 'T', corpo: 'C', url: '#/credito' }, { user_id: 'u2', id: 'semanal:y', titulo: 'T2', corpo: 'C2', url: '#/' }],
      [insc('u1', 'https://p/1'), insc('u1', 'https://p/2'), insc('u2', 'https://p/3'), insc('u3', 'https://p/4')],
    )
    const enviados: string[] = []
    const r = await processarPendentes(banco, async (i, conteudo) => { enviados.push(`${i.endpoint} ${JSON.parse(conteudo).tag}`); return 201 }, new Date())
    expect(enviados).toEqual(['https://p/1 fatura:x', 'https://p/2 fatura:x', 'https://p/3 semanal:y'])
    expect(r).toEqual({ notificacoes: 2, envios: 3, falhas: 0, inscricoesRemovidas: 0 })
    expect(marcadas).toEqual(['u1/fatura:x', 'u2/semanal:y'])
  })
  it('aparelho que saiu (410) é removido e não recebe mais', async () => {
    const { banco, apagadas } = bancoFalso(
      [{ user_id: 'u1', id: 'a', titulo: '', corpo: '', url: '' }, { user_id: 'u1', id: 'b', titulo: '', corpo: '', url: '' }],
      [insc('u1', 'https://morto'), insc('u1', 'https://vivo')],
    )
    let tentativasMorto = 0
    const r = await processarPendentes(banco, async (i) => (i.endpoint === 'https://morto' ? (tentativasMorto++, 410) : 201), new Date())
    expect(apagadas).toEqual(['https://morto'])
    expect(tentativasMorto).toBe(1)
    expect(r).toMatchObject({ envios: 2, inscricoesRemovidas: 1 })
  })
  it('falha de rede conta como falha e não impede as outras', async () => {
    const { banco, marcadas } = bancoFalso([{ user_id: 'u1', id: 'a', titulo: '', corpo: '', url: '' }], [insc('u1', 'https://x'), insc('u1', 'https://y')])
    const r = await processarPendentes(banco, async (i) => { if (i.endpoint === 'https://x') throw new Error('rede'); return 201 }, new Date())
    expect(r).toMatchObject({ envios: 1, falhas: 1 })
    expect(marcadas).toHaveLength(1)
  })
  it('teste do usuário', async () => {
    expect(await enviarTeste([insc('u', 'https://a'), insc('u', 'https://b')], async (i) => (i.endpoint === 'https://a' ? 201 : 500))).toEqual({ aparelhos: 2, ok: 1 })
  })
})

describe('criptografia real (web-push) contra um serviço de push local', () => {
  it('envia com VAPID e conteúdo criptografado', async () => {
    const vapid = webpush.generateVAPIDKeys()
    const cliente = crypto.createECDH('prime256v1'); cliente.generateKeys()
    const pasta = mkdtempSync(join(tmpdir(), 'push-'))
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${pasta}/k.pem -out ${pasta}/c.pem -days 1 -subj /CN=localhost`, { stdio: 'ignore' })
    const recebido: { headers: import('node:http').IncomingHttpHeaders; corpo: Buffer }[] = []
    const servidor = https.createServer({ key: readFileSync(`${pasta}/k.pem`), cert: readFileSync(`${pasta}/c.pem`) }, (req, res) => {
      const partes: Buffer[] = []
      req.on('data', (c) => partes.push(c)); req.on('end', () => { recebido.push({ headers: req.headers, corpo: Buffer.concat(partes) }); res.writeHead(req.url === '/sumiu' ? 410 : 201); res.end() })
    })
    await new Promise<void>((r) => servidor.listen(0, r))
    const porta = (servidor.address() as { port: number }).port
    webpush.setVapidDetails('https://ecosdablockchain-art.github.io/InvestIA/', vapid.publicKey, vapid.privateKey)
    const agente = new https.Agent({ rejectUnauthorized: false }) // certificado de teste
    const inscricao = (caminho: string) => ({ endpoint: `https://localhost:${porta}${caminho}`, keys: { p256dh: cliente.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') } })
    const r = await webpush.sendNotification(inscricao('/ok'), JSON.stringify({ titulo: 'Fatura', corpo: 'R$ 100,00' }), { TTL: 3600, agent: agente })
    expect(r.statusCode).toBe(201)
    expect(recebido[0]?.headers['content-encoding']).toBe('aes128gcm')
    expect(String(recebido[0]?.headers.authorization)).toMatch(/^vapid t=.+, k=/)
    expect(recebido[0]?.corpo.toString()).not.toContain('Fatura') // conteúdo vai criptografado
    await expect(webpush.sendNotification(inscricao('/sumiu'), 'x', { agent: agente })).rejects.toMatchObject({ statusCode: 410 })
    servidor.close()
  })
})

describe('segurança do serviço', async () => {
  const { endpointOficial, segredoConfere } = await import('./logica')
  it('só aceita endereços dos serviços de push oficiais', () => {
    expect(endpointOficial('https://web.push.apple.com/QWERTY')).toBe(true)
    expect(endpointOficial('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(endpointOficial('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true)
    expect(endpointOficial('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true)
    expect(endpointOficial('https://169.254.169.254/latest')).toBe(false)
    expect(endpointOficial('https://alvo.exemplo.com/fcm.googleapis.com/')).toBe(false)
    expect(endpointOficial('https://fcm.googleapis.com.evil.com/x')).toBe(false)
    expect(endpointOficial('https://evilpush.apple.com.attacker.io/')).toBe(false)
    expect(endpointOficial('http://fcm.googleapis.com/x')).toBe(false)
  })
  it('confere o segredo do agendador', () => {
    expect(segredoConfere('abc123', 'abc123')).toBe(true)
    expect(segredoConfere('abc124', 'abc123')).toBe(false)
    expect(segredoConfere('abc', 'abc123')).toBe(false)
    expect(segredoConfere(null, 'abc123')).toBe(false)
    expect(segredoConfere('', '')).toBe(false)
  })
})
