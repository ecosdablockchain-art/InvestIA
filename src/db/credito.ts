import type { Centavos } from '../core/dinheiro'
import { competenciaDe, nomeCompetenciaCurto, somarMeses, type Competencia, type DataISO } from '../core/datas'
import { compor, datasDaFatura, idFatura, idRotativo, statusDaFatura } from '../core/credito'
import { criar, tocar, type BancoFinancas } from './banco'
import type { Cartao, CompraParcelada, Divida, Fatura } from './tipos'
import type { NovoRegistro } from './banco'

export type DadosCartao = Omit<NovoRegistro<Cartao>, 'arquivado'>

export function validarCartao(d: DadosCartao): string | null {
  if (!d.apelido.trim()) return 'Dê um nome ao cartão.'
  if (!(d.diaFechamento >= 1 && d.diaFechamento <= 31)) return 'Dia de fechamento deve ser entre 1 e 31.'
  if (!(d.diaVencimento >= 1 && d.diaVencimento <= 31)) return 'Dia de vencimento deve ser entre 1 e 31.'
  if (d.diaFechamento === d.diaVencimento) return 'Fechamento e vencimento não podem ser no mesmo dia.'
  if (d.limite < 0) return 'Limite inválido.'
  return null
}

export async function salvarCartao(banco: BancoFinancas, d: DadosCartao, existente?: Cartao): Promise<Cartao> {
  const erro = validarCartao(d)
  if (erro) throw new Error(erro)
  const c = existente ? tocar({ ...existente, ...d, apelido: d.apelido.trim(), banco: d.banco.trim() }) : criar<Cartao>({ ...d, apelido: d.apelido.trim(), banco: d.banco.trim(), arquivado: false })
  await banco.cartoes.put(c)
  return c
}

/** Apaga o cartão, os parcelados e as faturas dele. Os lançamentos ficam, sem o cartão. */
export async function apagarCartao(banco: BancoFinancas, id: string): Promise<void> {
  await banco.transaction('rw', [banco.cartoes, banco.parcelados, banco.faturas, banco.lancamentos, banco.recorrencias], async () => {
    await banco.parcelados.where('cartaoId').equals(id).delete()
    await banco.faturas.where('cartaoId').equals(id).delete()
    await banco.lancamentos.filter((l) => l.cartaoId === id).modify({ cartaoId: null })
    await banco.recorrencias.filter((r) => r.cartaoId === id).modify({ cartaoId: null })
    await banco.cartoes.delete(id)
  })
}

export type DadosParcelado = NovoRegistro<CompraParcelada>

export function validarParcelado(d: DadosParcelado): string | null {
  if (!d.descricao.trim()) return 'Descreva a compra.'
  if (!Number.isSafeInteger(d.valorTotal) || d.valorTotal <= 0) return 'Informe o valor total.'
  if (!Number.isInteger(d.numeroParcelas) || d.numeroParcelas < 2 || d.numeroParcelas > 72) return 'Número de parcelas entre 2 e 72.'
  if (d.valorTotal < d.numeroParcelas) return 'Valor pequeno demais para tantas parcelas.'
  return null
}

export async function salvarParcelado(banco: BancoFinancas, d: DadosParcelado, existente?: CompraParcelada): Promise<CompraParcelada> {
  const erro = validarParcelado(d)
  if (erro) throw new Error(erro)
  const p = existente ? tocar({ ...existente, ...d, descricao: d.descricao.trim() }) : criar<CompraParcelada>({ ...d, descricao: d.descricao.trim() })
  await banco.parcelados.put(p)
  return p
}

async function faturaOuNova(banco: BancoFinancas, cartaoId: string, competencia: Competencia): Promise<Fatura> {
  const id = idFatura(cartaoId, competencia)
  const f = await banco.faturas.get(id)
  if (f) return f
  const agora = new Date().toISOString()
  return { id, criadoEm: agora, atualizadoEm: agora, cartaoId, competencia, valorInformado: null, paga: false, pagaEm: null }
}

/** Marca a fatura como paga (ou desfaz). Pagar remove o rotativo que ela tinha gerado. */
export async function marcarFaturaPaga(banco: BancoFinancas, cartaoId: string, competencia: Competencia, paga: boolean, hoje: DataISO): Promise<void> {
  await banco.transaction('rw', banco.faturas, banco.dividas, async () => {
    const f = await faturaOuNova(banco, cartaoId, competencia)
    await banco.faturas.put(tocar({ ...f, paga, pagaEm: paga ? hoje : null }))
    if (paga) await banco.dividas.delete(idRotativo(f.id))
  })
}

/** Valor fechado da fatura (substitui a projeção). null volta a usar a projeção. */
export async function informarValorFatura(banco: BancoFinancas, cartaoId: string, competencia: Competencia, valor: Centavos | null): Promise<void> {
  const f = await faturaOuNova(banco, cartaoId, competencia)
  await banco.faturas.put(tocar({ ...f, valorInformado: valor !== null && valor >= 0 ? valor : null }))
}

export type DadosDivida = Omit<NovoRegistro<Divida>, 'origem' | 'faturaId'>

export function validarDivida(d: DadosDivida): string | null {
  if (!d.nome.trim()) return 'Dê um nome à dívida.'
  if (!Number.isSafeInteger(d.saldo) || d.saldo < 0) return 'Saldo inválido.'
  if (!(d.jurosMensal >= 0 && d.jurosMensal <= 1)) return 'Juros ao mês entre 0% e 100%.'
  if (!Number.isSafeInteger(d.parcela) || d.parcela < 0) return 'Parcela inválida.'
  return null
}

export async function salvarDivida(banco: BancoFinancas, d: DadosDivida, existente?: Divida): Promise<Divida> {
  const erro = validarDivida(d)
  if (erro) throw new Error(erro)
  const div = existente
    ? tocar({ ...existente, ...d, nome: d.nome.trim() })
    : criar<Divida>({ ...d, nome: d.nome.trim(), origem: 'manual', faturaId: null })
  await banco.dividas.put(div)
  return div
}

/**
 * Fatura que venceu sem pagamento vira dívida no rotativo (uma vez só por fatura).
 * Olha os últimos 6 meses e só faturas que venceram depois que o cartão foi cadastrado.
 */
export async function processarFaturasVencidas(banco: BancoFinancas, hoje: DataISO, taxaMensal: number): Promise<number> {
  const cartoes = await banco.cartoes.filter((c) => !c.arquivado).toArray()
  if (cartoes.length === 0) return 0
  const parcelados = await banco.parcelados.toArray()
  const atual = competenciaDe(hoje)
  const compras = await banco.lancamentos.where('competencia').between(somarMeses(atual, -8), atual, true, true).filter((l) => !!l.cartaoId).toArray()
  let criadas = 0
  for (const c of cartoes) {
    const cadastro = c.criadoEm.slice(0, 10)
    for (let comp = somarMeses(atual, -6); comp <= atual; comp = somarMeses(comp, 1)) {
      const id = idFatura(c.id, comp)
      const f = await banco.faturas.get(id)
      if (f?.paga || f?.rotativoGerado) continue
      if (statusDaFatura(comp, c, false, hoje) !== 'vencida') continue
      const { vencimento } = datasDaFatura(comp, c)
      if (vencimento <= cadastro) continue
      const valor = compor(c, comp, compras, parcelados, f?.valorInformado ?? null).valor
      if (valor <= 0) continue
      await banco.transaction('rw', banco.faturas, banco.dividas, async () => {
        const fatura = f ?? (await faturaOuNova(banco, c.id, comp))
        await banco.faturas.put(tocar({ ...fatura, rotativoGerado: true }))
        const agora = new Date().toISOString()
        await banco.dividas.put({
          id: idRotativo(id), criadoEm: agora, atualizadoEm: agora,
          nome: `Rotativo ${c.apelido} (${nomeCompetenciaCurto(comp)})`, saldo: valor, jurosMensal: taxaMensal,
          parcela: 0, parcelasRestantes: null, origem: 'rotativo', faturaId: id,
        })
      })
      criadas++
    }
  }
  return criadas
}
