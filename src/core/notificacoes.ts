import type { Centavos } from './dinheiro'
import { formatarBRL } from './dinheiro'
import { competenciaDe, formatarData, nomeCompetencia, somarMeses, type DataISO } from './datas'
import { compor, competenciaDaFatura, datasDaFatura, idFatura, type CartaoResumo, type ParceladoResumo } from './credito'
import { nivelLimite } from './orcamento'

export interface Notificacao { id: string; quando: string; titulo: string; corpo: string; url: string }

export interface PreferenciasNotificacao { fatura: boolean; limite: boolean; semanal: boolean }

/** 9h e 19h em São Paulo (UTC−3, sem horário de verão desde 2019). */
const as9h = (d: DataISO) => `${d}T12:00:00.000Z`
const as19h = (d: DataISO) => `${d}T22:00:00.000Z`

function somarDias(d: DataISO, n: number): DataISO {
  return new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Lista das notificações que devem existir a partir de agora (o servidor envia na hora).
 * Ids fixos: a mesma notificação recalculada não é enviada duas vezes.
 */
export function planejarNotificacoes(p: {
  agora: string // ISO
  hoje: DataISO
  prefs: PreferenciasNotificacao
  cartoes: (CartaoResumo & { apelido: string })[]
  faturas: { id: string; paga: boolean; valorInformado: Centavos | null }[]
  compras: { data: DataISO; valor: Centavos; cartaoId?: string | null; tipo: 'gasto' | 'renda' }[]
  parcelados: ParceladoResumo[]
  categorias: { id: string; nome: string; limiteMensal: Centavos | null }[]
  gastosDoMes: Map<string | null, Centavos> // visão pessoal
}): Notificacao[] {
  const out: Notificacao[] = []
  const futuro = (quando: string) => quando > p.agora

  if (p.prefs.fatura) {
    for (const c of p.cartoes) {
      const aberta = competenciaDaFatura(p.hoje, c)
      for (const comp of [somarMeses(aberta, -1), aberta, somarMeses(aberta, 1)]) {
        const id = idFatura(c.id, comp)
        const f = p.faturas.find((x) => x.id === id)
        if (f?.paga) continue
        const valor = compor(c, comp, p.compras, p.parcelados, f?.valorInformado ?? null).valor
        if (valor <= 0) continue
        const { vencimento } = datasDaFatura(comp, c)
        const antes = { id: `fatura:${c.id}:${comp}:3d`, quando: as9h(somarDias(vencimento, -3)), titulo: `Fatura ${c.apelido} vence em 3 dias`, corpo: `${formatarBRL(valor)} · vencimento ${formatarData(vencimento)}`, url: '#/credito' }
        const noDia = { id: `fatura:${c.id}:${comp}:dia`, quando: as9h(vencimento), titulo: `Fatura ${c.apelido} vence hoje`, corpo: `${formatarBRL(valor)}. Já pagou? Marque como paga no app.`, url: '#/credito' }
        for (const n of [antes, noDia]) if (futuro(n.quando)) out.push(n)
      }
    }
  }

  if (p.prefs.limite) {
    const comp = competenciaDe(p.hoje)
    for (const cat of p.categorias) {
      if (cat.limiteMensal === null) continue
      const gasto = p.gastosDoMes.get(cat.id) ?? 0
      if (nivelLimite(gasto, cat.limiteMensal).nivel !== 'estourado') continue
      out.push({ id: `limite:${cat.id}:${comp}`, quando: p.agora, titulo: `${cat.nome} passou do limite`, corpo: `${formatarBRL(gasto)} de ${formatarBRL(cat.limiteMensal)} em ${nomeCompetencia(comp)}`, url: '#/mes/limites' })
    }
  }

  if (p.prefs.semanal) {
    const diaSemana = new Date(`${p.hoje}T12:00:00Z`).getUTCDay() // 0 = domingo
    let domingo = somarDias(p.hoje, (7 - diaSemana) % 7)
    for (let i = 0; i < 6; i++, domingo = somarDias(domingo, 7)) {
      const n = { id: `semanal:${domingo}`, quando: as19h(domingo), titulo: 'Hora de pôr as contas em dia', corpo: 'Lance os gastos da semana para o Finanças 360 continuar certinho.', url: '#/mes/novo' }
      if (futuro(n.quando)) out.push(n)
    }
  }
  return out.sort((a, b) => a.quando.localeCompare(b.quando))
}
