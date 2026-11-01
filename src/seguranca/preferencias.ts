import { useSyncExternalStore } from 'react'

export interface Preferencias {
  bloqueioAtivo: boolean
  credencialId: string | null // id da passkey (base64url) — não é segredo
  taxaRotativoMensal: number // fração, ex.: 0,15 = 15% a.m.
  tema: 'sistema' | 'claro' | 'escuro'
  visaoPainel: string // 'tudo' ou id do contexto
  perfil: 'conservador' | 'moderado' | 'arrojado'
  fonteCotacao: 'brapi' | 'alphavantage'
  /** Chave da API de cotações: fica só neste aparelho (não vai para a nuvem). */
  chaveCotacao: string
}

const CHAVE = 'financas360:preferencias'
const PADRAO: Preferencias = {
  bloqueioAtivo: false,
  credencialId: null,
  taxaRotativoMensal: 0.15,
  tema: 'sistema',
  visaoPainel: 'pessoal',
  perfil: 'moderado',
  fonteCotacao: 'brapi',
  chaveCotacao: '',
}

let atual: Preferencias = carregar()
const ouvintes = new Set<() => void>()

function carregar(): Preferencias {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? { ...PADRAO, ...(JSON.parse(bruto) as Partial<Preferencias>) } : PADRAO
  } catch {
    return PADRAO
  }
}

export function lerPreferencias(): Preferencias {
  return atual
}

export function salvarPreferencias(mudancas: Partial<Preferencias>): void {
  atual = { ...atual, ...mudancas }
  localStorage.setItem(CHAVE, JSON.stringify(atual))
  ouvintes.forEach((f) => f())
}

export function apagarPreferencias(): void {
  localStorage.removeItem(CHAVE)
  atual = PADRAO
  ouvintes.forEach((f) => f())
}

export function usePreferencias(): Preferencias {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f)
      return () => ouvintes.delete(f)
    },
    () => atual,
  )
}
