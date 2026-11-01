import { useSyncExternalStore } from 'react'
import Dexie from 'dexie'
import type { BancoFinancas } from '../db/banco'
import { sincronizarUmaVez, type Servidor } from './sincronizacao'

export interface EstadoSinc {
  situacao: 'parado' | 'sincronizando' | 'ok' | 'offline' | 'erro'
  ultima: number | null
  erro: string | null
}

let estado: EstadoSinc = { situacao: 'parado', ultima: null, erro: null }
const ouvintes = new Set<() => void>()
const definir = (e: Partial<EstadoSinc>) => { estado = { ...estado, ...e }; ouvintes.forEach((f) => f()) }

export function useEstadoSinc(): EstadoSinc {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => estado)
}

let atual: { banco: BancoFinancas; servidor: Servidor } | null = null
let ignorarAte = 0

/** Sincroniza agora. Retorna false se não deu (sem internet ou erro). */
export async function sincronizarAgora(): Promise<boolean> {
  if (!atual) return false
  if (!navigator.onLine) { definir({ situacao: 'offline' }); return false }
  definir({ situacao: 'sincronizando' })
  try {
    await sincronizarUmaVez(atual.banco, atual.servidor)
    definir({ situacao: 'ok', ultima: Date.now(), erro: null })
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    definir({ situacao: navigator.onLine ? 'erro' : 'offline', erro: msg })
    return false
  } finally {
    ignorarAte = Date.now() + 1500 // as próprias gravações da sincronização não disparam outra
  }
}

/** Sincroniza ao abrir, a cada minuto, ao voltar ao app, ao reconectar e logo depois de cada alteração. */
export function iniciarSincronizacao(banco: BancoFinancas, servidor: Servidor): () => void {
  atual = { banco, servidor }
  let espera: ReturnType<typeof setTimeout> | undefined
  const agendar = (ms: number) => { clearTimeout(espera); espera = setTimeout(() => void sincronizarAgora(), ms) }
  const aoMudar = () => { if (Date.now() > ignorarAte && estado.situacao !== 'sincronizando') agendar(2500) }
  const aoVoltar = () => { if (document.visibilityState === 'visible') agendar(300) }
  const aoConectar = () => agendar(300)
  const intervalo = setInterval(() => { if (document.visibilityState === 'visible') void sincronizarAgora() }, 60_000)
  Dexie.on('storagemutated', aoMudar)
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('online', aoConectar)
  window.addEventListener('offline', () => definir({ situacao: 'offline' }))
  return () => {
    clearTimeout(espera); clearInterval(intervalo)
    Dexie.on('storagemutated').unsubscribe(aoMudar)
    document.removeEventListener('visibilitychange', aoVoltar)
    window.removeEventListener('online', aoConectar)
    atual = null
    definir({ situacao: 'parado', ultima: null, erro: null })
  }
}

/** Há algo neste aparelho que ainda não foi para a nuvem? */
export async function temPendencias(banco: BancoFinancas): Promise<boolean> {
  if ((await banco._apagados.count()) > 0) return true
  for (const t of banco.tabelasDeDados) {
    const n = await t.filter((r: Record<string, unknown>) => typeof r._modificadoEm === 'string' && r._modificadoEm !== r._sincronizadoEm).count()
    if (n > 0) return true
  }
  return false
}
