import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BancoFinancas } from './banco'
import type { AjustesConta, PerfilFinanceiro } from './tipos'

export const ID_AJUSTES = 'conta'
export type ValoresAjustes = Pick<AjustesConta, 'perfil' | 'fonteCotacao' | 'chaveCotacao' | 'taxaRotativoMensal'> & { notificacoes: { fatura: boolean; limite: boolean; semanal: boolean }; chaveClaude: string; jogoAtivo: boolean; perfilFinanceiro: PerfilFinanceiro | null; boasVindasVistas: boolean }
export const AJUSTES_PADRAO: ValoresAjustes = { perfil: 'moderado', fonteCotacao: 'brapi', chaveCotacao: '', taxaRotativoMensal: 0.15, notificacoes: { fatura: true, limite: true, semanal: true }, chaveClaude: '', jogoAtivo: true, perfilFinanceiro: null, boasVindasVistas: false }

export async function lerAjustesConta(banco: BancoFinancas = db): Promise<ValoresAjustes> {
  const a = await banco.ajustesConta.get(ID_AJUSTES)
  return { ...AJUSTES_PADRAO, ...(a ? { perfil: a.perfil, fonteCotacao: a.fonteCotacao, chaveCotacao: a.chaveCotacao, taxaRotativoMensal: a.taxaRotativoMensal, notificacoes: { ...AJUSTES_PADRAO.notificacoes, ...a.notificacoes }, chaveClaude: a.chaveClaude ?? '', jogoAtivo: a.jogoAtivo ?? true, perfilFinanceiro: a.perfilFinanceiro ?? null, boasVindasVistas: a.boasVindasVistas ?? false } : {}) }
}

export async function salvarAjustesConta(mudancas: Partial<ValoresAjustes>, banco: BancoFinancas = db): Promise<void> {
  const atual = await banco.ajustesConta.get(ID_AJUSTES)
  const agora = new Date().toISOString()
  await banco.ajustesConta.put({ ...AJUSTES_PADRAO, ...atual, ...mudancas, id: ID_AJUSTES, criadoEm: atual?.criadoEm ?? agora, atualizadoEm: agora })
}

/** Ajustes da conta, ao vivo (mudou em outro aparelho, muda aqui). */
export function useAjustesConta(): ValoresAjustes | undefined {
  return useLiveQuery(() => lerAjustesConta(), [])
}

/**
 * Antes, perfil, cotações e taxa do rotativo ficavam só no aparelho. Leva para a conta
 * o que estiver configurado aqui, se a conta ainda não tiver.
 */
export async function trazerAjustesDoAparelho(banco: BancoFinancas): Promise<void> {
  if (await banco.ajustesConta.get(ID_AJUSTES)) return
  let locais: Partial<ValoresAjustes> = {}
  try { locais = JSON.parse(localStorage.getItem('financas360:preferencias') ?? '{}') as Partial<ValoresAjustes> } catch { /* nada */ }
  const vindos: Partial<ValoresAjustes> = {}
  if (locais.perfil && locais.perfil !== AJUSTES_PADRAO.perfil) vindos.perfil = locais.perfil
  if (locais.fonteCotacao && locais.fonteCotacao !== AJUSTES_PADRAO.fonteCotacao) vindos.fonteCotacao = locais.fonteCotacao
  if (locais.chaveCotacao) vindos.chaveCotacao = locais.chaveCotacao
  if (typeof locais.taxaRotativoMensal === 'number' && locais.taxaRotativoMensal !== AJUSTES_PADRAO.taxaRotativoMensal) vindos.taxaRotativoMensal = locais.taxaRotativoMensal
  if (Object.keys(vindos).length) await salvarAjustesConta(vindos, banco)
}
