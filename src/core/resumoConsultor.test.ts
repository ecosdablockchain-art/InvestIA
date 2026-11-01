import { describe, expect, it } from 'vitest'
import { montarResumo, type EntradaResumo } from './resumoConsultor'

const base: EntradaResumo = {
  hoje: '2026-11-20', competencia: 202611,
  lancamentos: [
    { tipo: 'renda', valor: 650000, competencia: 202611, contextoId: 'p', categoriaId: 'sal' },
    { tipo: 'gasto', valor: 90000, competencia: 202611, contextoId: 'p', categoriaId: 'ali' },
    { tipo: 'gasto', valor: 60000, competencia: 202610, contextoId: 'p', categoriaId: 'ali' },
    { tipo: 'gasto', valor: 99999, competencia: 202611, contextoId: 'mc', categoriaId: 'ali' }, // negócio: fora do pessoal
  ],
  visaoPessoal: { tipo: 'contexto', id: 'p' },
  categorias: [{ id: 'ali', nome: 'Alimentação', limiteMensal: 80000 }, { id: 'sal', nome: 'Salário', limiteMensal: null }],
  negocios: [{ nome: 'Machine Clean', entradas: 420000, gastos: 260000 }],
  recorrentes: { gastos: 185590, entradas: 650000 },
  dividas: [{ tipo: 'Empréstimo', saldo: 500000, jurosMensal: 0.025, parcela: 30000 }],
  faturasAbertas: 37000, parcelasFuturas: 108000, investido: 1410000,
  alocacao: [{ classe: 'Reserva', fracao: 0.64 }, { classe: 'Ações', fracao: 0.36 }],
  reserva: 900000, mesesReserva: 3, risco: { nivel: 'Baixo', perfil: 'moderado', acimaDoPerfil: false },
  metas: [{ nome: 'Viagem', alvo: 1000000, atual: 50000, prazo: '2027-04-30', aporteNecessario: 158334, estado: 'em-risco' }],
}

describe('resumo para o Consultor', () => {
  const r = montarResumo(base)
  it('traz os totais principais', () => {
    expect(r).toContain('novembro de 2026 (mês atual, em andamento): R$ 6.500,00 / R$ 900,00 / R$ 5.600,00')
    expect(r).toContain('- Alimentação: R$ 900,00 | R$ 200,00 | R$ 800,00')
    expect(r).toContain('Empréstimo: saldo R$ 5.000,00, juros 2,5% ao mês')
    expect(r).toContain('Patrimônio líquido (investido − dívidas): R$ 9.100,00')
    expect(r).toContain('cobre 3 meses')
    expect(r).toContain('Viagem: R$ 500,00 de R$ 10.000,00')
    expect(r).toContain('Machine Clean: entrou R$ 4.200,00, saiu R$ 2.600,00')
  })
  it('gasto do negócio não entra no pessoal', () => {
    expect(r).not.toContain('999,99')
  })
})
