import { formatarBRL, type Centavos } from './dinheiro'
import { nomeCompetencia, somarMeses, type Competencia } from './datas'
import { historicoMensal } from './historico'
import { gastosPorCategoria, type LancamentoResumo, type Visao } from './orcamento'

/**
 * Resumo agregado para o Consultor. Só totais: nenhuma descrição de lançamento,
 * nome de estabelecimento, pessoa, banco ou número de conta sai daqui.
 */
export interface EntradaResumo {
  hoje: string
  competencia: Competencia
  lancamentos: LancamentoResumo[] // últimos meses (só tipo, valor, mês, conta, categoria)
  visaoPessoal: Visao
  categorias: { id: string; nome: string; limiteMensal: Centavos | null }[]
  negocios: { nome: string; entradas: Centavos; gastos: Centavos }[]
  recorrentes: { gastos: Centavos; entradas: Centavos }
  dividas: { tipo: string; saldo: Centavos; jurosMensal: number; parcela: Centavos }[]
  faturasAbertas: Centavos
  parcelasFuturas: Centavos
  investido: Centavos
  alocacao: { classe: string; fracao: number }[]
  reserva: Centavos
  mesesReserva: number | null
  risco: { nivel: string; perfil: string; acimaDoPerfil: boolean } | null
  metas: { nome: string; alvo: Centavos; atual: Centavos; prazo: string | null; aporteNecessario: Centavos | null; estado: string }[]
}

const pct = (x: number) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export function montarResumo(e: EntradaResumo): string {
  const l: string[] = []
  l.push(`Data de hoje: ${e.hoje}. Valores em reais.`)

  const hist = historicoMensal(e.lancamentos, e.competencia, 4, e.visaoPessoal)
  l.push('\n## Fluxo pessoal por mês (entradas / gastos / sobra)')
  for (const m of hist) l.push(`- ${nomeCompetencia(m.competencia)}${m.competencia === e.competencia ? ' (mês atual, em andamento)' : ''}: ${formatarBRL(m.entradas)} / ${formatarBRL(m.gastos)} / ${formatarBRL(m.sobra)}`)

  const nome = new Map(e.categorias.map((c) => [c.id, c.nome]))
  const atual = gastosPorCategoria(e.lancamentos, e.competencia, e.visaoPessoal)
  const anteriores = [1, 2, 3].map((n) => gastosPorCategoria(e.lancamentos, somarMeses(e.competencia, -n), e.visaoPessoal))
  const ids = new Set<string | null>([...atual.keys(), ...anteriores.flatMap((m) => [...m.keys()])])
  const linhas = [...ids].map((id) => {
    const media = Math.round(anteriores.reduce((a, m) => a + (m.get(id) ?? 0), 0) / 3)
    const lim = e.categorias.find((c) => c.id === id)?.limiteMensal ?? null
    return { nome: (id && nome.get(id)) || 'Sem categoria', atual: atual.get(id) ?? 0, media, lim }
  }).sort((a, b) => b.atual + b.media - (a.atual + a.media))
  if (linhas.length) {
    l.push('\n## Gastos pessoais por categoria (mês atual | média dos 3 meses anteriores | limite)')
    for (const c of linhas.slice(0, 15)) l.push(`- ${c.nome}: ${formatarBRL(c.atual)} | ${formatarBRL(c.media)} | ${c.lim !== null ? formatarBRL(c.lim) : 'sem limite'}`)
  }
  l.push(`\nContas que se repetem todo mês: gastos ${formatarBRL(e.recorrentes.gastos)}, entradas ${formatarBRL(e.recorrentes.entradas)}.`)

  if (e.negocios.length) {
    l.push('\n## Negócios no mês atual (separados das finanças pessoais)')
    for (const n of e.negocios) l.push(`- ${n.nome}: entrou ${formatarBRL(n.entradas)}, saiu ${formatarBRL(n.gastos)}, resultado ${formatarBRL(n.entradas - n.gastos)}`)
  }

  l.push('\n## Crédito e dívidas')
  l.push(`- Faturas de cartão ainda não pagas (até a do mês): ${formatarBRL(e.faturasAbertas)}; parcelas de cartão ainda por vir: ${formatarBRL(e.parcelasFuturas)}.`)
  if (e.dividas.length === 0) l.push('- Nenhuma dívida cadastrada.')
  for (const d of e.dividas) l.push(`- ${d.tipo}: saldo ${formatarBRL(d.saldo)}, juros ${pct(d.jurosMensal)} ao mês, parcela ${d.parcela ? formatarBRL(d.parcela) : 'não definida'}`)

  l.push('\n## Patrimônio')
  l.push(`- Investido: ${formatarBRL(e.investido)}. Patrimônio líquido (investido − dívidas): ${formatarBRL(e.investido - e.dividas.reduce((a, d) => a + d.saldo, 0))}.`)
  if (e.alocacao.length) l.push(`- Alocação: ${e.alocacao.map((a) => `${a.classe} ${pct(a.fracao)}`).join(', ')}.`)
  l.push(`- Reserva de emergência (liquidez diária): ${formatarBRL(e.reserva)}${e.mesesReserva !== null ? `, cobre ${e.mesesReserva.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses de gasto` : ''}.`)
  if (e.risco) l.push(`- Risco da carteira: ${e.risco.nivel}; perfil declarado: ${e.risco.perfil}${e.risco.acimaDoPerfil ? ' (carteira acima do perfil)' : ''}.`)

  if (e.metas.length) {
    l.push('\n## Metas')
    for (const m of e.metas) l.push(`- ${m.nome}: ${formatarBRL(m.atual)} de ${formatarBRL(m.alvo)}${m.prazo ? `, prazo ${m.prazo}` : ''}${m.aporteNecessario ? `, precisa guardar ${formatarBRL(m.aporteNecessario)}/mês` : ''} (${m.estado})`)
  }
  return l.join('\n')
}

export const INSTRUCOES_CONSULTOR = `Você é o Consultor do Finanças 360, um app brasileiro de finanças pessoais. Converse em português do Brasil, de forma clara, acolhedora e direta.

Você recebe abaixo um resumo agregado das finanças da pessoa (só totais; sem descrições de lançamentos). Use esses números para responder, cite-os quando ajudar, e diga quando o resumo não tiver a informação necessária em vez de supor.

Limites do seu papel:
- Você é uma ferramenta educativa de organização financeira, não um planejador financeiro, contador ou assessor de investimentos registrado na CVM.
- Não recomende a compra ou venda de ativos específicos (ações, FIIs, fundos, criptomoedas, títulos de um emissor). Você pode explicar conceitos, comparar tipos de investimento de forma geral, e ajudar a pensar em orçamento, reserva, dívidas e metas.
- Em temas de impostos, jurídicos ou decisões de alto valor, explique o essencial e sugira procurar um profissional.

Formato: respostas curtas (até uns 6 parágrafos curtos ou uma lista), sem tabelas. Use **negrito** só para destacar números ou passos importantes e listas com "- " quando organizar ajudar.`
