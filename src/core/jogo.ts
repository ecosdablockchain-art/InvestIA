import type { Centavos } from './dinheiro'
import { competenciaDe, type Competencia, type DataISO } from './datas'

export interface EntradaJogo {
  hoje: DataISO
  lancamentos: { data: DataISO; competencia: Competencia; tipo: 'gasto' | 'renda'; valor: Centavos; categoriaId: string | null; metaId?: string | null; contextoId: string }[]
  pessoalId: string | null
  limites: { categoriaId: string; limite: Centavos }[]
  metasCriadas: number
  metasConcluidas: number
  dividasQuitadas: number
  faturasPagasEmDia: number
  mesesDeReserva: number | null
  investimentos: number // investimentos + operações cadastrados
}

export interface Conquista { id: string; nome: string; descricao: string; icone: string; obtida: boolean }
export interface Missao { id: string; nome: string; feita: boolean; detalhe: string; xp: string }
export interface Nivel { numero: number; nome: string; xp: number; xpDoNivel: number; xpDoProximo: number; progresso: number }
export interface ResultadoJogo {
  xp: number
  nivel: Nivel
  fontes: { nome: string; xp: number }[]
  semanasSeguidas: number
  missoes: Missao[]
  conquistas: Conquista[]
}

const NOMES = ['Iniciante', 'Organizado', 'Planejador', 'Poupador', 'Estrategista', 'Investidor', 'Mestre das Contas', 'Guardião do Patrimônio', 'Lenda Financeira']
const LIMIARES = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500]

export function nivelPorXP(xp: number): Nivel {
  const limiar = (n: number) => (n <= LIMIARES.length ? LIMIARES[n - 1] ?? 0 : (LIMIARES[LIMIARES.length - 1] ?? 0) + (n - LIMIARES.length) * 900)
  let n = 1
  while (limiar(n + 1) <= xp) n++
  const de = limiar(n)
  const ate = limiar(n + 1)
  const nome = n <= NOMES.length ? NOMES[n - 1] ?? '' : `${NOMES[NOMES.length - 1]} ${n - NOMES.length + 1}`
  return { numero: n, nome, xp, xpDoNivel: de, xpDoProximo: ate, progresso: (xp - de) / (ate - de) }
}

/** Segunda-feira da semana (AAAA-MM-DD). */
export function inicioDaSemana(d: DataISO): DataISO {
  const t = Date.parse(`${d}T12:00:00Z`)
  const dia = (new Date(t).getUTCDay() + 6) % 7 // segunda = 0
  return new Date(t - dia * 86_400_000).toISOString().slice(0, 10)
}
const semanaAnterior = (s: DataISO) => new Date(Date.parse(`${s}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)

export function calcularJogo(e: EntradaJogo): ResultadoJogo {
  const ate = e.lancamentos.filter((l) => l.data <= e.hoje)
  const dias = new Set(ate.map((l) => l.data))
  const semanaAtual = inicioDaSemana(e.hoje)
  const compAtual = competenciaDe(e.hoje)

  // dias lançados por semana
  const porSemana = new Map<DataISO, Set<DataISO>>()
  for (const d of dias) { const s = inicioDaSemana(d); porSemana.set(s, (porSemana.get(s) ?? new Set()).add(d)) }
  const semanaCompleta = (s: DataISO) => (porSemana.get(s)?.size ?? 0) >= 3
  const semanasCompletas = [...porSemana.keys()].filter(semanaCompleta)

  // sequência de semanas completas: termina nesta semana ou na passada (a atual ainda pode completar)
  let semanasSeguidas = 0
  let s = semanaCompleta(semanaAtual) ? semanaAtual : semanaAnterior(semanaAtual)
  while (semanaCompleta(s)) { semanasSeguidas++; s = semanaAnterior(s) }
  let maiorSequencia = 0
  for (const inicio of semanasCompletas) {
    let n = 0; let x = inicio
    while (semanaCompleta(x)) { n++; x = semanaAnterior(x) }
    maiorSequencia = Math.max(maiorSequencia, n)
  }

  // meses fechados dentro de todos os limites (pessoal)
  const pessoais = ate.filter((l) => !e.pessoalId || l.contextoId === e.pessoalId)
  const mesesComDados = [...new Set(pessoais.map((l) => l.competencia))].filter((c) => c < compAtual)
  const mesesNoLimite = e.limites.length === 0 ? [] : mesesComDados.filter((c) => e.limites.every(({ categoriaId, limite }) =>
    pessoais.filter((l) => l.competencia === c && l.tipo === 'gasto' && l.categoriaId === categoriaId).reduce((a, l) => a + l.valor, 0) <= limite))

  // aportes em metas: 1 XP a cada R$ 10, até 200 por mês
  const aportePorMes = new Map<Competencia, Centavos>()
  for (const l of ate) if (l.metaId && l.tipo === 'gasto') aportePorMes.set(l.competencia, (aportePorMes.get(l.competencia) ?? 0) + l.valor)
  const xpAportes = [...aportePorMes.values()].reduce((a, v) => a + Math.min(200, Math.floor(v / 1000)), 0)

  const fontes = [
    { nome: 'Dias com lançamentos (5 XP cada)', xp: dias.size * 5 },
    { nome: 'Semanas com 3+ dias lançados (30 XP cada)', xp: semanasCompletas.length * 30 },
    { nome: 'Meses dentro dos limites (100 XP cada)', xp: mesesNoLimite.length * 100 },
    { nome: 'Dinheiro guardado em metas (1 XP a cada R$ 10)', xp: xpAportes },
    { nome: 'Faturas pagas em dia (20 XP cada)', xp: e.faturasPagasEmDia * 20 },
    { nome: 'Metas concluídas (300 XP cada)', xp: e.metasConcluidas * 300 },
    { nome: 'Dívidas quitadas (300 XP cada)', xp: e.dividasQuitadas * 300 },
  ]
  const xp = fontes.reduce((a, f) => a + f.xp, 0)

  // missões da semana
  const diasSemana = porSemana.get(semanaAtual)?.size ?? 0
  const guardouNaSemana = ate.some((l) => l.metaId && l.tipo === 'gasto' && inicioDaSemana(l.data) === semanaAtual)
  const estouros = e.limites.filter(({ categoriaId, limite }) =>
    pessoais.filter((l) => l.competencia === compAtual && l.tipo === 'gasto' && l.categoriaId === categoriaId).reduce((a, l) => a + l.valor, 0) > limite).length
  const missoes: Missao[] = [
    { id: 'lancar', nome: 'Lançar gastos em 3 dias da semana', feita: diasSemana >= 3, detalhe: `${Math.min(diasSemana, 3)} de 3 dias`, xp: '+30 XP' },
    { id: 'guardar', nome: 'Guardar algum valor para uma meta', feita: guardouNaSemana, detalhe: e.metasCriadas ? (guardouNaSemana ? 'feito' : 'use o botão Guardar na meta') : 'crie uma meta primeiro', xp: '+1 XP a cada R$ 10' },
    { id: 'limites', nome: 'Manter as categorias dentro do limite', feita: e.limites.length > 0 && estouros === 0, detalhe: e.limites.length === 0 ? 'defina limites em Mês › Limites' : estouros ? `${estouros} ${estouros === 1 ? 'categoria passou' : 'categorias passaram'}` : 'tudo dentro', xp: '+100 XP no fim do mês' },
  ]

  const conquistas: Conquista[] = [
    { id: 'primeiro', nome: 'Primeiro passo', descricao: 'Fez o primeiro lançamento', icone: 'moeda', obtida: ate.length >= 1 },
    { id: 'semana', nome: 'Semana redonda', descricao: 'Lançou em 3 dias da mesma semana', icone: 'calendario', obtida: semanasCompletas.length >= 1 },
    { id: 'sequencia', nome: 'Em chamas', descricao: '4 semanas seguidas lançando', icone: 'chama', obtida: maiorSequencia >= 4 },
    { id: 'cem', nome: 'Centenário', descricao: '100 lançamentos', icone: 'coroa', obtida: ate.length >= 100 },
    { id: 'limite', nome: 'Na linha', descricao: 'Fechou um mês dentro de todos os limites', icone: 'escudo', obtida: mesesNoLimite.length >= 1 },
    { id: 'meta', nome: 'Sonho no papel', descricao: 'Criou a primeira meta', icone: 'alvo', obtida: e.metasCriadas >= 1 },
    { id: 'meta-feita', nome: 'Missão cumprida', descricao: 'Concluiu uma meta', icone: 'trofeu', obtida: e.metasConcluidas >= 1 },
    { id: 'reserva3', nome: 'Colchão', descricao: 'Reserva de 3 meses de gasto', icone: 'cofre', obtida: (e.mesesDeReserva ?? 0) >= 3 },
    { id: 'reserva6', nome: 'Porto seguro', descricao: 'Reserva de 6 meses de gasto', icone: 'estrela', obtida: (e.mesesDeReserva ?? 0) >= 6 },
    { id: 'fatura', nome: 'Em dia', descricao: 'Pagou uma fatura até o vencimento', icone: 'cartao', obtida: e.faturasPagasEmDia >= 1 },
    { id: 'divida', nome: 'Corrente quebrada', descricao: 'Quitou uma dívida', icone: 'corrente', obtida: e.dividasQuitadas >= 1 },
    { id: 'investidor', nome: 'Investidor', descricao: 'Cadastrou o primeiro investimento', icone: 'grafico', obtida: e.investimentos >= 1 },
  ]
  return { xp, nivel: nivelPorXP(xp), fontes, semanasSeguidas, missoes, conquistas }
}
