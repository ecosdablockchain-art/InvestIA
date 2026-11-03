import { formatarBRL, type Centavos } from './dinheiro'
import { nomeCompetencia, type Competencia } from './datas'
import { compararExtra, jurosAnual, ordenarAvalanche, simularQuitacao, type DividaResumo } from './dividas'
import type { ComparativoCategoria, MesHistorico } from './historico'
import type { Perfil } from './carteira'

/**
 * Insights e plano de ação calculados só a partir dos dados do app (sem IA).
 * Segue a ordem clássica: gastar menos do que ganha → mini-reserva → dívidas caras →
 * reserva completa → investir e metas.
 */

/** Acima disto ao mês, a dívida é "cara": custa mais do que qualquer investimento seguro rende. */
export const JUROS_CARO = 0.015 // 1,5% a.m. ≈ 19,6% a.a.

export interface DividaInsight extends DividaResumo { origem: string }

export interface EntradaInsights {
  competencia: Competencia // mês atual
  /** Meses completos mais recentes (pessoal, sem aportes em metas), em ordem cronológica. */
  meses: MesHistorico[]
  /** Mês atual até hoje (pessoal, sem aportes). Usado só se ainda não houver mês completo. */
  mesAtual: MesHistorico
  categorias: { id: string; nome: string; limiteMensal: Centavos | null }[]
  /** Último mês completo × média dos 3 anteriores, por categoria. */
  comparativo: ComparativoCategoria[]
  /** Gastos do mês atual por categoria (para limites). */
  gastosMesAtual: Map<string | null, Centavos>
  gastosFixos: Centavos // contas que se repetem
  dividas: DividaInsight[]
  faturasAbertas: Centavos
  parcelasProximoMes: Centavos
  reserva: Centavos
  investido: Centavos
  perfil: Perfil
  riscoAcimaDoPerfil: boolean
  temNegocio: boolean
  metas: { nome: string; falta: Centavos; aporteNecessario: Centavos | null; mediaAportes: Centavos; estado: string }[]
}

export type Tom = 'critico' | 'atencao' | 'positivo' | 'info'
export interface Acao { rotulo: string; href: string }
export interface Insight { id: string; tom: Tom; titulo: string; texto: string; destaque?: string; acao?: Acao }
export interface Passo { id: string; titulo: string; texto: string; estado: 'feito' | 'agora' | 'depois'; destaque?: string; acao?: Acao }

export interface Numeros {
  mesesAnalisados: number
  parcial: boolean // só o mês atual, ainda em andamento
  renda: Centavos // média mensal
  gasto: Centavos // média mensal
  sobra: Centavos // média mensal
  taxaPoupanca: number | null // sobra / renda
  rendaVariavel: boolean
  reservaAlvoMeses: number
  reservaAlvo: Centavos
  mesesDeReserva: number | null
}

export interface ResultadoInsights { numeros: Numeros; plano: Passo[]; insights: Insight[] }

const R = (v: Centavos) => formatarBRL(v)
const pct = (x: number) => `${Math.round(x * 100)}%`
const arredondar = (v: Centavos, passo = 1000) => Math.ceil(v / passo) * passo // múltiplos de R$ 10
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`

export function calcularNumeros(e: EntradaInsights): Numeros {
  const comDados = e.meses.filter((m) => m.entradas > 0 || m.gastos > 0)
  const parcial = comDados.length === 0 && (e.mesAtual.entradas > 0 || e.mesAtual.gastos > 0)
  const base = parcial ? [e.mesAtual] : comDados
  const renda = Math.round(media(base.map((m) => m.entradas)))
  const gasto = Math.round(media(base.map((m) => m.gastos)))
  const rendas = base.map((m) => m.entradas)
  const desvio = Math.sqrt(media(rendas.map((r) => (r - renda) ** 2)))
  const rendaVariavel = e.temNegocio || (base.length >= 3 && renda > 0 && desvio / renda > 0.25)
  const reservaAlvoMeses = rendaVariavel ? 12 : 6
  return {
    mesesAnalisados: base.length, parcial, renda, gasto, sobra: renda - gasto,
    taxaPoupanca: renda > 0 ? (renda - gasto) / renda : null,
    rendaVariavel, reservaAlvoMeses, reservaAlvo: gasto * reservaAlvoMeses,
    mesesDeReserva: gasto > 0 ? e.reserva / gasto : null,
  }
}

export function gerarInsights(e: EntradaInsights): ResultadoInsights {
  const n = calcularNumeros(e)
  if (n.mesesAnalisados === 0) {
    return {
      numeros: n,
      plano: [],
      insights: [{
        id: 'sem-dados', tom: 'info', titulo: 'Comece lançando suas entradas e gastos',
        texto: 'Os insights são calculados a partir dos seus lançamentos. Registre o que entra e o que sai por pelo menos um mês para ver quanto guardar, como montar a reserva e o que priorizar.',
        acao: { rotulo: 'Fazer um lançamento', href: '#/mes/novo' },
      }],
    }
  }

  const dividasAtivas = e.dividas.filter((d) => d.saldo > 0)
  const caras = ordenarAvalanche(dividasAtivas.filter((d) => d.jurosMensal >= JUROS_CARO))
  const baratas = dividasAtivas.filter((d) => d.jurosMensal < JUROS_CARO)
  const miniReserva = n.gasto // 1 mês de gastos
  const sobra = Math.max(0, n.sobra)

  // ---------- plano ----------
  const plano: Passo[] = []

  // 1) gastar menos do que ganha
  const metaPoupanca = Math.round(n.renda * 0.1)
  if (n.sobra <= 0) {
    const corte = arredondar(metaPoupanca - n.sobra)
    plano.push({
      id: 'equilibrar', estado: 'agora', titulo: 'Gastar menos do que ganha',
      texto: n.sobra < 0
        ? `Em média você gasta ${R(-n.sobra)} a mais do que recebe por mês. Antes de qualquer outra coisa, corte cerca de ${R(corte)} por mês para fechar no azul e sobrar 10% da renda. Comece pelas categorias que mais cresceram (veja abaixo).`
        : `Você está gastando tudo o que ganha. Tente cortar cerca de ${R(corte)} por mês para guardar 10% da renda.`,
      destaque: n.sobra < 0 ? `−${R(-n.sobra)}/mês` : 'R$ 0/mês',
      acao: { rotulo: 'Ver gastos por categoria', href: '#/mes/historico' },
    })
  } else {
    plano.push({
      id: 'equilibrar', estado: 'feito', titulo: 'Gastar menos do que ganha',
      texto: `Sobram em média ${R(n.sobra)} por mês (${pct(n.taxaPoupanca ?? 0)} da renda). É esse dinheiro que vai para os próximos passos.`,
      destaque: `+${R(n.sobra)}/mês`,
    })
  }

  // 2) mini-reserva (só faz sentido separar quando há dívida cara)
  if (caras.length && e.reserva < miniReserva) {
    const falta = miniReserva - e.reserva
    const mesesMini = sobra > 0 ? Math.ceil(falta / sobra) : null
    plano.push({
      id: 'mini-reserva', estado: 'depois', titulo: 'Mini-reserva de 1 mês',
      texto: `Antes de atacar as dívidas, guarde ${R(miniReserva)} (um mês de gastos) para não precisar de mais crédito num imprevisto. Faltam ${R(falta)}${mesesMini ? `: com a sua sobra, ${meses(mesesMini)}` : ''}.`,
      destaque: R(falta),
      acao: { rotulo: 'Registrar reserva', href: '#/patrimonio' },
    })
  }

  // 3) dívidas caras
  if (caras.length) {
    const totalCaro = caras.reduce((a, d) => a + d.saldo, 0)
    const ordem = caras.map((d) => `${d.nome} (${(d.jurosMensal * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.m.)`).join(', ')
    let texto = `Você tem ${R(totalCaro)} em dívidas com juros acima de ${(JUROS_CARO * 100).toLocaleString('pt-BR')}% ao mês. Nenhum investimento seguro rende isso: quitar é o melhor “investimento” agora. Pague primeiro a de maior juros: ${ordem}.`
    if (sobra > 0) {
      const c = compararExtra(dividasAtivas, sobra)
      if (c.mesesAMenos !== null && c.economiaJuros !== null && c.mesesAMenos > 0) {
        texto += ` Colocando a sobra de ${R(sobra)}/mês nelas, você quita tudo em ${meses(c.comExtra.meses)} (em vez de ${c.base.meses}) e economiza ${R(c.economiaJuros)} em juros.`
      } else if (!c.base.quita && c.comExtra.quita) {
        texto += ` Só com as parcelas ela não acaba nunca; colocando a sobra de ${R(sobra)}/mês, você quita em ${meses(c.comExtra.meses)}.`
      }
    } else {
      const sem = simularQuitacao(dividasAtivas, 0)
      if (!sem.quita) texto += ' Com os pagamentos de hoje ela não termina: os juros crescem mais rápido. Procure renegociar (troque por um empréstimo mais barato, como consignado) e corte gastos.'
    }
    plano.push({ id: 'dividas', estado: 'depois', titulo: 'Quitar as dívidas caras', texto, destaque: R(totalCaro), acao: { rotulo: 'Ver dívidas', href: '#/credito/dividas' } })
  } else if (dividasAtivas.length) {
    plano.push({
      id: 'dividas', estado: 'feito', titulo: 'Sem dívidas caras',
      texto: 'Suas dívidas têm juros baixos. Mantenha as parcelas em dia; antecipar só vale a pena se o juro for maior do que o seu investimento rende.',
    })
  }

  // 4) reserva completa
  const faltaReserva = Math.max(0, n.reservaAlvo - e.reserva)
  const porque = n.rendaVariavel ? 'sua renda varia bastante (ou vem de um negócio), então o ideal é 12 meses' : 'o recomendado para renda estável é 6 meses'
  if (faltaReserva > 0) {
    const aporte = sobra > 0 ? arredondar(sobra) : null
    const quando = aporte ? Math.ceil(faltaReserva / aporte) : null
    plano.push({
      id: 'reserva', estado: 'depois', titulo: `Reserva de emergência de ${n.reservaAlvoMeses} meses`,
      texto: `Sua reserva ideal é ${R(n.reservaAlvo)}: ${n.reservaAlvoMeses} × ${R(n.gasto)} de gasto médio, porque ${porque}. Hoje você tem ${R(e.reserva)}${n.mesesDeReserva !== null ? ` (${n.mesesDeReserva.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses)` : ''}, faltam ${R(faltaReserva)}.${aporte && quando ? ` Guardando ${R(aporte)} por mês, você chega lá em ${quando > 120 ? 'mais de 10 anos' : meses(quando)}.` : ''} Deixe em renda fixa de baixo risco com resgate no mesmo dia (por exemplo, Tesouro Selic ou CDB de liquidez diária).`,
      destaque: R(faltaReserva),
      acao: { rotulo: 'Atualizar reserva', href: '#/patrimonio' },
    })
  } else {
    plano.push({
      id: 'reserva', estado: 'feito', titulo: 'Reserva de emergência completa',
      texto: `Você tem ${R(e.reserva)}, o suficiente para ${n.reservaAlvoMeses} meses de gastos. A partir daqui, o que sobrar pode ir para investimentos de prazo mais longo.`,
    })
  }

  // 5) investir e metas
  const metasAbertas = e.metas.filter((m) => m.estado !== 'concluida' && m.falta > 0)
  const precisaMetas = metasAbertas.reduce((a, m) => a + (m.aporteNecessario ?? 0), 0)
  const textoInvestir = sobra > 0
    ? `Com a reserva pronta e sem dívidas caras, invista a sobra de ${R(sobra)} por mês de acordo com o seu perfil ${e.perfil}.${precisaMetas > 0 ? ` Suas metas com prazo pedem ${R(precisaMetas)} por mês${precisaMetas > sobra ? ', mais do que sobra hoje: ajuste prazos ou valores' : ''}.` : ''}`
    : 'Quando sobrar dinheiro todo mês, ele vai para investimentos e metas.'
  plano.push({ id: 'investir', estado: 'depois', titulo: 'Investir e cumprir metas', texto: textoInvestir, destaque: sobra > 0 ? `${R(sobra)}/mês` : undefined, acao: { rotulo: 'Ver metas', href: '#/patrimonio/metas' } })

  // o primeiro passo não feito é o "agora"
  const primeiro = plano.find((p) => p.estado !== 'feito')
  if (primeiro) primeiro.estado = 'agora'

  // ---------- insights ----------
  const insights: Insight[] = []
  const nomeCat = (id: string | null) => (id && e.categorias.find((c) => c.id === id)?.nome) || 'Sem categoria'

  if (n.parcial) {
    insights.push({ id: 'parcial', tom: 'info', titulo: 'Análise do mês em andamento', texto: 'Por enquanto só há lançamentos deste mês, então os números ainda são parciais. Os insights ficam mais certeiros depois do primeiro mês completo.' })
  }

  // taxa de poupança
  if (n.taxaPoupanca !== null && n.sobra > 0) {
    if (n.taxaPoupanca >= 0.2) insights.push({ id: 'poupanca', tom: 'positivo', titulo: `Você guarda ${pct(n.taxaPoupanca)} da renda`, texto: 'Acima dos 20% recomendados. Continue assim.', destaque: pct(n.taxaPoupanca) })
    else if (n.taxaPoupanca < 0.1) insights.push({ id: 'poupanca', tom: 'atencao', titulo: `Você guarda só ${pct(n.taxaPoupanca)} da renda`, texto: `O ideal é pelo menos 10% a 20%. Para chegar a 15%, a sobra precisaria ser ${R(Math.round(n.renda * 0.15))} por mês, ${R(Math.round(n.renda * 0.15) - n.sobra)} a mais que hoje.`, destaque: pct(n.taxaPoupanca) })
  }

  // categorias que cresceram (último mês completo × média dos 3 anteriores)
  const ultimo = e.meses.at(-1)?.competencia
  const subiram = e.comparativo
    .filter((c) => c.media3 !== null && c.media3 > 0 && c.esteMes > c.media3 * 1.25 && c.esteMes - c.media3 >= 10000)
    .sort((a, b) => (b.esteMes - (b.media3 ?? 0)) - (a.esteMes - (a.media3 ?? 0)))
    .slice(0, 3)
  for (const c of subiram) {
    const dif = c.esteMes - (c.media3 ?? 0)
    insights.push({
      id: `subiu:${c.categoriaId}`, tom: 'atencao', titulo: `${nomeCat(c.categoriaId)} subiu ${pct(dif / (c.media3 ?? 1))}`,
      texto: `Em ${ultimo ? nomeCompetencia(ultimo) : 'último mês'} foram ${R(c.esteMes)}, contra ${R(c.media3 ?? 0)} na média dos 3 meses anteriores. Voltar à média libera ${R(dif)} por mês.`,
      destaque: `+${R(dif)}`, acao: { rotulo: 'Definir limite', href: '#/mes/limites' },
    })
  }

  // maior categoria sem limite
  const semLimite = e.comparativo
    .filter((c) => c.categoriaId && c.media3 && c.media3 >= 20000 && !e.categorias.find((x) => x.id === c.categoriaId)?.limiteMensal)
    .sort((a, b) => (b.media3 ?? 0) - (a.media3 ?? 0))[0]
  if (semLimite) {
    insights.push({
      id: 'sem-limite', tom: 'info', titulo: `Coloque um limite em ${nomeCat(semLimite.categoriaId)}`,
      texto: `É um dos seus maiores gastos (média de ${R(semLimite.media3 ?? 0)} por mês) e ainda não tem limite. Com um limite, o app avisa antes de passar.`,
      acao: { rotulo: 'Definir limite', href: '#/mes/limites' },
    })
  }

  // limites estourados no mês atual
  for (const c of e.categorias) {
    if (!c.limiteMensal) continue
    const g = e.gastosMesAtual.get(c.id) ?? 0
    if (g > c.limiteMensal) insights.push({ id: `limite:${c.id}`, tom: 'critico', titulo: `${c.nome} passou do limite`, texto: `${R(g)} gastos de ${R(c.limiteMensal)} neste mês.`, destaque: `+${R(g - c.limiteMensal)}`, acao: { rotulo: 'Ver limites', href: '#/mes/limites' } })
  }

  // comprometimento com dívidas
  const parcelas = dividasAtivas.reduce((a, d) => a + d.parcela, 0)
  if (n.renda > 0 && parcelas / n.renda > 0.3) {
    insights.push({ id: 'comprometimento', tom: 'critico', titulo: `${pct(parcelas / n.renda)} da renda vai para parcelas de dívidas`, texto: `São ${R(parcelas)} por mês. Acima de 30% o orçamento fica frágil: evite novas dívidas e parcelamentos até baixar.`, destaque: pct(parcelas / n.renda) })
  }
  const rotativo = dividasAtivas.filter((d) => d.origem === 'rotativo')
  if (rotativo.length) {
    const total = rotativo.reduce((a, d) => a + d.saldo, 0)
    const j = Math.max(...rotativo.map((d) => d.jurosMensal))
    insights.push({ id: 'rotativo', tom: 'critico', titulo: 'Fatura no rotativo', texto: `${R(total)} no rotativo do cartão, a cerca de ${pct(jurosAnual(j))} ao ano. É a dívida mais cara que existe: prioridade máxima. Se não der para quitar, troque por um parcelamento ou empréstimo com juros menores.`, destaque: R(total), acao: { rotulo: 'Ver dívidas', href: '#/credito/dividas' } })
  }

  // cartão
  if (n.renda > 0 && e.parcelasProximoMes / n.renda > 0.2) {
    insights.push({ id: 'parcelas', tom: 'atencao', titulo: 'Parcelas do cartão pesando', texto: `No próximo mês já há ${R(e.parcelasProximoMes)} em parcelas (${pct(e.parcelasProximoMes / n.renda)} da renda). Evite novos parcelamentos por enquanto.`, destaque: R(e.parcelasProximoMes), acao: { rotulo: 'Ver cartões', href: '#/credito' } })
  }
  if (n.renda > 0 && e.faturasAbertas > n.renda * 0.5) {
    insights.push({ id: 'faturas', tom: 'atencao', titulo: 'Faturas altas em relação à renda', texto: `As faturas em aberto somam ${R(e.faturasAbertas)}, mais da metade da sua renda média. Confira se cabem no mês para não cair no rotativo.`, destaque: R(e.faturasAbertas), acao: { rotulo: 'Ver cartões', href: '#/credito' } })
  }

  // custos fixos
  if (n.renda > 0 && e.gastosFixos / n.renda > 0.5) {
    insights.push({ id: 'fixos', tom: 'atencao', titulo: `Contas fixas levam ${pct(e.gastosFixos / n.renda)} da renda`, texto: `${R(e.gastosFixos)} por mês em contas que se repetem. Acima de 50% sobra pouca margem: vale revisar planos, assinaturas e contratos.`, destaque: R(e.gastosFixos), acao: { rotulo: 'Ver contas fixas', href: '#/mes/repetem' } })
  }

  // renda variável
  if (n.rendaVariavel && !e.temNegocio) {
    insights.push({ id: 'renda-variavel', tom: 'info', titulo: 'Sua renda varia bastante', texto: 'Por isso a reserva ideal sugerida é de 12 meses. Nos meses bons, guarde o excedente; planeje os gastos pela média dos meses mais fracos.' })
  }

  // investimentos
  if (e.riscoAcimaDoPerfil) {
    insights.push({ id: 'risco', tom: 'atencao', titulo: 'Carteira mais arriscada que o seu perfil', texto: `Seu perfil é ${e.perfil}, mas a carteira está com risco acima dele. Ao fazer novos aportes, direcione para classes mais conservadoras até reequilibrar.`, acao: { rotulo: 'Ver carteira', href: '#/patrimonio' } })
  }
  if (caras.length && e.investido > e.reserva + 100000) {
    insights.push({ id: 'investe-com-divida', tom: 'atencao', titulo: 'Investindo enquanto paga juros altos', texto: `Você tem ${R(e.investido - e.reserva)} investidos fora da reserva e dívidas acima de ${(JUROS_CARO * 100).toLocaleString('pt-BR')}% ao mês. Quase sempre compensa resgatar parte para quitar a dívida cara.` })
  }

  // metas em risco
  for (const m of metasAbertas.filter((x) => x.estado === 'em-risco' || x.estado === 'atrasada').slice(0, 3)) {
    insights.push({
      id: `meta:${m.nome}`, tom: m.estado === 'atrasada' ? 'critico' : 'atencao', titulo: `Meta “${m.nome}” ${m.estado === 'atrasada' ? 'atrasada' : 'em risco'}`,
      texto: m.aporteNecessario ? `Para chegar no prazo, guarde ${R(m.aporteNecessario)} por mês (hoje a média é ${R(m.mediaAportes)}). Faltam ${R(m.falta)}.` : `Faltam ${R(m.falta)}. Revise o prazo ou o valor.`,
      acao: { rotulo: 'Ver metas', href: '#/patrimonio/metas' },
    })
  }

  // dívidas baratas
  if (!caras.length && baratas.length && faltaReserva === 0 && sobra > 0) {
    insights.push({ id: 'baratas', tom: 'info', titulo: 'Antecipar dívidas baratas?', texto: 'Suas dívidas têm juros baixos. Só antecipe se o juro delas for maior do que o seu investimento rende depois do imposto; senão, invista a sobra.' })
  }

  const ordemTom: Record<Tom, number> = { critico: 0, atencao: 1, info: 2, positivo: 3 }
  insights.sort((a, b) => ordemTom[a.tom] - ordemTom[b.tom])
  return { numeros: n, plano, insights }
}
