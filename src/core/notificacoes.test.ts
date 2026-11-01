import { describe, expect, it } from 'vitest'
import { planejarNotificacoes } from './notificacoes'

const base = {
  agora: '2026-11-04T15:00:00.000Z', hoje: '2026-11-04',
  prefs: { fatura: true, limite: true, semanal: true },
  cartoes: [{ id: 'c', apelido: 'Santander', diaFechamento: 3, diaVencimento: 10 }],
  faturas: [] as { id: string; paga: boolean; valorInformado: number | null }[],
  compras: [{ data: '2026-11-03', valor: 25000, cartaoId: 'c', tipo: 'gasto' as const }, { data: '2026-10-20', valor: 10000, cartaoId: 'c', tipo: 'gasto' as const }],
  parcelados: [],
  categorias: [{ id: 'ali', nome: 'Alimentação', limiteMensal: 50000 }, { id: 'laz', nome: 'Lazer', limiteMensal: 50000 }],
  gastosDoMes: new Map<string | null, number>([['ali', 60000], ['laz', 1000]]),
}

describe('agenda de notificações', () => {
  it('fatura: 3 dias antes e no dia, às 9h de Brasília, só no futuro', () => {
    const n = planejarNotificacoes(base).filter((x) => x.id.startsWith('fatura'))
    expect(n.map((x) => [x.id, x.quando])).toEqual([
      ['fatura:c:202611:3d', '2026-11-07T12:00:00.000Z'],
      ['fatura:c:202611:dia', '2026-11-10T12:00:00.000Z'],
      ['fatura:c:202612:3d', '2026-12-07T12:00:00.000Z'],
      ['fatura:c:202612:dia', '2026-12-10T12:00:00.000Z'],
    ])
    expect(n[0]?.corpo).toBe('R$ 100,00 · vencimento 10/11/2026')
  })
  it('fatura paga ou zerada não avisa', () => {
    const n = planejarNotificacoes({ ...base, faturas: [{ id: 'fatura:c:202611', paga: true, valorInformado: null }], compras: [] })
    expect(n.filter((x) => x.id.startsWith('fatura'))).toEqual([])
  })
  it('limite estourado avisa agora, uma vez por mês e categoria', () => {
    const n = planejarNotificacoes(base).filter((x) => x.id.startsWith('limite'))
    expect(n).toEqual([{ id: 'limite:ali:202611', quando: base.agora, titulo: 'Alimentação passou do limite', corpo: 'R$ 600,00 de R$ 500,00 em novembro de 2026', url: '#/mes/limites' }])
  })
  it('lembrete semanal aos domingos 19h (6 semanas)', () => {
    const n = planejarNotificacoes(base).filter((x) => x.id.startsWith('semanal'))
    expect(n.map((x) => x.quando)).toEqual(['2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06', '2026-12-13'].map((d) => `${d}T22:00:00.000Z`))
  })
  it('domingo depois das 19h pula para o próximo', () => {
    const n = planejarNotificacoes({ ...base, hoje: '2026-11-08', agora: '2026-11-08T23:00:00.000Z' }).filter((x) => x.id.startsWith('semanal'))
    expect(n[0]?.id).toBe('semanal:2026-11-15')
  })
  it('respeita as preferências', () => {
    expect(planejarNotificacoes({ ...base, prefs: { fatura: false, limite: false, semanal: false } })).toEqual([])
  })
})
