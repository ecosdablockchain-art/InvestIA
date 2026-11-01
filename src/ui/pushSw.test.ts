import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Carrega public/push-sw.js com um "self" falso e devolve os tratadores registrados. */
function carregar(janelas: { url: string; focus: () => Promise<void>; navigate: (u: string) => Promise<void> }[] = []) {
  const tratadores: Record<string, (e: unknown) => void> = {}
  const mostradas: { titulo: string; opcoes: Record<string, unknown> }[] = []
  const abertas: string[] = []
  const self = {
    addEventListener: (tipo: string, f: (e: unknown) => void) => { tratadores[tipo] = f },
    registration: { scope: 'https://exemplo.github.io/InvestIA/', showNotification: async (titulo: string, opcoes: Record<string, unknown>) => { mostradas.push({ titulo, opcoes }) } },
    clients: { matchAll: async () => janelas, openWindow: async (u: string) => { abertas.push(u) } },
  }
  new Function('self', readFileSync(join(__dirname, '../../public/push-sw.js'), 'utf8'))(self)
  return { tratadores, mostradas, abertas }
}

const evento = (extra: Record<string, unknown>) => {
  const promessas: Promise<unknown>[] = []
  return { ...extra, waitUntil: (p: Promise<unknown>) => promessas.push(p), esperar: () => Promise.all(promessas) }
}

describe('service worker de notificações', () => {
  it('mostra a notificação com título, texto e destino', async () => {
    const { tratadores, mostradas } = carregar()
    const e = evento({ data: { json: () => ({ titulo: 'Fatura Santander vence hoje', corpo: 'R$ 100,00', url: '#/credito', tag: 'fatura:x' }), text: () => '' } })
    tratadores.push?.(e); await e.esperar()
    expect(mostradas).toEqual([{ titulo: 'Fatura Santander vence hoje', opcoes: expect.objectContaining({ body: 'R$ 100,00', tag: 'fatura:x', data: { url: '#/credito' } }) }])
  })
  it('conteúdo que não é JSON vira o texto da notificação', async () => {
    const { tratadores, mostradas } = carregar()
    const e = evento({ data: { json: () => { throw new Error('x') }, text: () => 'olá' } })
    tratadores.push?.(e); await e.esperar()
    expect(mostradas[0]).toMatchObject({ titulo: 'Finanças 360', opcoes: { body: 'olá' } })
  })
  it('tocar abre a tela certa: reaproveita a janela aberta ou abre uma nova', async () => {
    const navegadas: string[] = []
    const aberta = { url: 'https://exemplo.github.io/InvestIA/#/painel', focus: async () => {}, navigate: async (u: string) => { navegadas.push(u) } }
    const comJanela = carregar([aberta])
    let fechada = false
    const clique = evento({ notification: { close: () => { fechada = true }, data: { url: '#/credito' } } })
    comJanela.tratadores.notificationclick?.(clique); await clique.esperar()
    expect(fechada).toBe(true)
    expect(navegadas).toEqual(['https://exemplo.github.io/InvestIA/#/credito'])

    const semJanela = carregar([])
    const clique2 = evento({ notification: { close: () => {}, data: { url: '#/mes/novo' } } })
    semJanela.tratadores.notificationclick?.(clique2); await clique2.esperar()
    expect(semJanela.abertas).toEqual(['https://exemplo.github.io/InvestIA/#/mes/novo'])
  })
})
