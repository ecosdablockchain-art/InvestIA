import type { StatusFatura } from '../../core/credito'

export const STATUS: Record<StatusFatura, { nome: string; cor: string; icone: string; classe: string }> = {
  paga: { nome: 'Paga', cor: 'var(--st-paga)', icone: '✓', classe: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  vencida: { nome: 'Vencida', cor: 'var(--st-vencida)', icone: '!', classe: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' },
  fechada: { nome: 'A pagar', cor: 'var(--st-pagar)', icone: '⏰', classe: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  aberta: { nome: 'Mês atual', cor: 'var(--serie-1)', icone: '●', classe: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200' },
  futura: { nome: 'Futura', cor: 'var(--st-futura)', icone: '○', classe: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
}

export const CORES_CARTAO = ['#c8102e', '#1f2937', '#7c3aed', '#2563eb', '#ea580c', '#0d9488', '#db2777', '#ca8a04']

/** Percentual com vírgula: 0,0299 → "2,99%". */
export function pct(fracao: number, casas = 2): string {
  return `${(fracao * 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })}%`
}

/** "2,99" ou "2.99" → 0,0299. */
export function lerPct(texto: string): number | null {
  const n = Number(texto.replace('%', '').trim().replace(/\./g, '').replace(',', '.'))
  if (!texto.trim() || !Number.isFinite(n) || n < 0 || n > 100) return null
  return n / 100
}
