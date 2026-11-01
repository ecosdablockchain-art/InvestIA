import { describe, expect, it } from 'vitest'
import { calcularJogo, inicioDaSemana, nivelPorXP, type EntradaJogo } from './jogo'

const l = (data: string, valor = 1000, extra: Partial<EntradaJogo['lancamentos'][number]> = {}) => ({
  data, competencia: Number(data.slice(0, 4)) * 100 + Number(data.slice(5, 7)), tipo: 'gasto' as const, valor, categoriaId: 'ali', metaId: null, contextoId: 'p', ...extra,
})
const base: EntradaJogo = { hoje: '2026-11-20', lancamentos: [], pessoalId: 'p', limites: [], metasCriadas: 0, metasConcluidas: 0, dividasQuitadas: 0, faturasPagasEmDia: 0, mesesDeReserva: null, investimentos: 0 }

describe('níveis', () => {
  it('limiares e nomes', () => {
    expect(nivelPorXP(0)).toMatchObject({ numero: 1, nome: 'Iniciante', xpDoProximo: 100 })
    expect(nivelPorXP(100)).toMatchObject({ numero: 2, nome: 'Organizado' })
    expect(nivelPorXP(300)).toMatchObject({ numero: 3, nome: 'Planejador', progresso: 0.25 })
    expect(nivelPorXP(3400)).toMatchObject({ numero: 10, nome: 'Lenda Financeira 2', xpDoNivel: 3400, xpDoProximo: 4300 })
  })
  it('semana começa na segunda', () => {
    expect(inicioDaSemana('2026-11-20')).toBe('2026-11-16') // sexta
    expect(inicioDaSemana('2026-11-22')).toBe('2026-11-16') // domingo
    expect(inicioDaSemana('2026-11-16')).toBe('2026-11-16')
  })
})

describe('XP e missões', () => {
  it('dias, semanas completas e sequência', () => {
    const lancs = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-18'].map((d) => l(d))
    const r = calcularJogo({ ...base, lancamentos: lancs })
    expect(r.fontes[0]?.xp).toBe(9 * 5) // 9 dias distintos
    expect(r.fontes[1]?.xp).toBe(3 * 30)
    expect(r.semanasSeguidas).toBe(3)
    expect(r.missoes[0]).toMatchObject({ feita: true, detalhe: '3 de 3 dias' })
    expect(r.conquistas.find((c) => c.id === 'semana')?.obtida).toBe(true)
    expect(r.conquistas.find((c) => c.id === 'sequencia')?.obtida).toBe(false)
  })
  it('lançamento no futuro não conta', () => {
    expect(calcularJogo({ ...base, lancamentos: [l('2026-12-25')] }).xp).toBe(0)
  })
  it('meses fechados dentro dos limites; o mês atual não conta ainda', () => {
    const lancs = [l('2026-09-05', 40000), l('2026-10-05', 90000), l('2026-11-05', 1000)]
    const r = calcularJogo({ ...base, lancamentos: lancs, limites: [{ categoriaId: 'ali', limite: 50000 }] })
    expect(r.fontes[2]?.xp).toBe(100) // só setembro
    expect(r.missoes[2]).toMatchObject({ feita: true, detalhe: 'tudo dentro' })
  })
  it('gastos do negócio não contam para os limites pessoais', () => {
    const r = calcularJogo({ ...base, lancamentos: [l('2026-10-05', 10000), l('2026-10-06', 999999, { contextoId: 'mc' })], limites: [{ categoriaId: 'ali', limite: 50000 }] })
    expect(r.fontes[2]?.xp).toBe(100)
  })
  it('aportes: 1 XP a cada R$ 10, no máximo 200 por mês; missão da semana', () => {
    const r = calcularJogo({ ...base, metasCriadas: 1, lancamentos: [l('2026-10-10', 500000, { metaId: 'm' }), l('2026-11-17', 5000, { metaId: 'm' })] })
    expect(r.fontes[3]?.xp).toBe(200 + 5)
    expect(r.missoes[1]?.feita).toBe(true)
  })
  it('conquistas de metas, dívidas, faturas, reserva e investimentos', () => {
    const r = calcularJogo({ ...base, metasCriadas: 2, metasConcluidas: 1, dividasQuitadas: 1, faturasPagasEmDia: 2, mesesDeReserva: 6.2, investimentos: 3 })
    expect(r.conquistas.filter((c) => c.obtida).map((c) => c.id).sort()).toEqual(['divida', 'fatura', 'investidor', 'meta', 'meta-feita', 'reserva3', 'reserva6'])
    expect(r.xp).toBe(300 + 300 + 40)
  })
})
