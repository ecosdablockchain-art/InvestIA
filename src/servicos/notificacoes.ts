import { supabase } from '../nuvem/cliente'
import { db } from '../db/banco'
import { lerAjustesConta } from '../db/ajustesConta'
import { planejarNotificacoes } from '../core/notificacoes'
import { competenciaDe, hojeISO, somarMeses } from '../core/datas'
import { gastosPorCategoria } from '../core/orcamento'

export type SuporteNotificacoes = 'ok' | 'instalar-no-iphone' | 'navegador-sem-suporte'

export function suporte(): SuporteNotificacoes {
  const temApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  if (ios && !instalado) return 'instalar-no-iphone'
  return temApi ? 'ok' : 'navegador-sem-suporte'
}

function base64UrlParaBytes(t: string): Uint8Array<ArrayBuffer> {
  const b64 = t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function chavePublica(): Promise<string> {
  if (!supabase) throw new Error('Servidor não configurado.')
  const { data } = await supabase.rpc('push_chave_publica')
  if (typeof data === 'string' && data) return data
  // primeira vez: o serviço cria as chaves
  const { data: r, error } = await supabase.functions.invoke('notificar', { body: { acao: 'chave' } })
  if (error || !r?.publica) throw new Error('O serviço de notificações ainda não foi configurado no Supabase.')
  return r.publica as string
}

/** Este aparelho está recebendo notificações? */
export async function inscritoAqui(): Promise<boolean> {
  if (suporte() !== 'ok' || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

function nomeDoAparelho(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Navegador'
}

/** Pede permissão, inscreve o aparelho e guarda a inscrição na conta. */
export async function ativarNesteAparelho(): Promise<void> {
  if (!supabase) throw new Error('Servidor não configurado.')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão negada. Para ativar depois, libere as notificações deste site nos ajustes do navegador ou do celular.')
  const reg = await navigator.serviceWorker.ready
  const chave = await chavePublica()
  let insc = await reg.pushManager.getSubscription()
  if (!insc) insc = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(chave) })
  const j = insc.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_inscricoes').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, aparelho: nomeDoAparelho().slice(0, 80) })
  if (error) throw new Error(/limite de 10/.test(error.message)
    ? 'Sua conta já tem 10 aparelhos com notificações. Desative em um aparelho antigo e tente de novo.'
    : `Não foi possível salvar a inscrição (${error.message}).`)
  await agendarNotificacoes(true)
}

export async function desativarNesteAparelho(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const insc = await reg?.pushManager.getSubscription()
  if (insc) {
    await supabase?.from('push_inscricoes').delete().eq('endpoint', insc.endpoint)
    await insc.unsubscribe()
  }
}

export async function enviarTeste(): Promise<{ aparelhos: number; ok: number }> {
  if (!supabase) throw new Error('Servidor não configurado.')
  const { data, error } = await supabase.functions.invoke('notificar', { body: { acao: 'teste' } })
  if (error) {
    const status = (error as { context?: Response }).context?.status
    throw new Error(status === 429 ? 'Aguarde alguns segundos antes de testar de novo.' : 'O serviço de notificações ainda não foi configurado no Supabase.')
  }
  return data as { aparelhos: number; ok: number }
}

let ultimaAgenda = ''

/** Recalcula a agenda a partir dos dados e manda para o servidor (só se mudou). */
export async function agendarNotificacoes(forcar = false): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const hoje = hojeISO()
  const comp = competenciaDe(hoje)
  const [ajustes, cartoes, faturas, parcelados, categorias, contextos, lancs] = await Promise.all([
    lerAjustesConta(), db.cartoes.filter((c) => !c.arquivado).toArray(), db.faturas.toArray(), db.parcelados.toArray(),
    db.categorias.filter((c) => !c.arquivada).toArray(), db.contextos.toArray(),
    db.lancamentos.where('competencia').between(somarMeses(comp, -3), somarMeses(comp, 2), true, true).toArray(),
  ])
  const pessoal = contextos.find((c) => c.tipo === 'pessoal')?.id
  const itens = planejarNotificacoes({
    agora: new Date().toISOString(), hoje, prefs: ajustes.notificacoes, cartoes, faturas, parcelados, categorias,
    compras: lancs.filter((l) => !!l.cartaoId),
    gastosDoMes: gastosPorCategoria(lancs, comp, pessoal ? { tipo: 'contexto', id: pessoal } : { tipo: 'tudo' }),
  })
  // a assinatura ignora o "agora" das notificações imediatas, para não reenviar a cada sincronização
  const assinatura = JSON.stringify(itens.map((i) => [i.id, i.id.startsWith('limite') ? '' : i.quando, i.titulo, i.corpo]))
  if (!forcar && assinatura === ultimaAgenda) return
  const { error } = await supabase.rpc('notificacoes_definir', { itens })
  if (!error) ultimaAgenda = assinatura
}
