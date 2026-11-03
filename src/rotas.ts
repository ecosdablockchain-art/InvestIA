import { useSyncExternalStore } from 'react'

export type Aba = 'painel' | 'mes' | 'lancar' | 'insights' | 'credito' | 'patrimonio'

function lerRota(): string {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === '' ? 'painel' : h
}

export function useRota(): string {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener('hashchange', f)
      return () => window.removeEventListener('hashchange', f)
    },
    lerRota,
  )
}

export function irPara(rota: string): void {
  window.location.hash = `#/${rota}`
}
