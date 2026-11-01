import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
})

export const IconePainel = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="7.5" height="9" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="5" rx="1.8" /><rect x="13.5" y="11" width="7.5" height="10" rx="1.8" /><rect x="3" y="15" width="7.5" height="6" rx="1.8" /></svg>
)
export const IconeMes = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4.5" width="18" height="16.5" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 14h3M13.5 14h3M7.5 17.5h3" /></svg>
)
export const IconeImportar = (p: P) => (
  <svg {...base(p)}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" /></svg>
)
export const IconeCredito = (p: P) => (
  <svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></svg>
)
export const IconePatrimonio = (p: P) => (
  <svg {...base(p)}><path d="M3 20.5h18M5 17V11M9.5 17V7M14 17v-5M18.5 17V4" /></svg>
)
export const IconeAjustes = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const IconeCadeado = (p: P) => (
  <svg {...base(p)}><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
)
export const IconeVoltar = (p: P) => (
  <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
)
export const IconeSeta = (p: P) => (
  <svg {...base({ width: 16, height: 16, ...p })}><path d="M9 6l6 6-6 6" /></svg>
)
export const IconeMais = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
