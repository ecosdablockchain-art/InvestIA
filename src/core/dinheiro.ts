/**
 * Dinheiro sempre em centavos inteiros. Nunca use número quebrado para valores.
 */
export type Centavos = number

const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function ehCentavos(valor: number): boolean {
  return Number.isSafeInteger(valor)
}

/** R$ 1.234,56 */
export function formatarBRL(valor: Centavos): string {
  return formatadorBRL.format(valor / 100).replace(/ /g, ' ')
}

/** R$ 1,2 mil / R$ 3,4 mi — para cards pequenos. */
export function formatarBRLCompacto(valor: Centavos): string {
  const reais = Math.abs(valor) / 100
  const sinal = valor < 0 ? '−' : ''
  if (reais >= 1_000_000) return `${sinal}R$ ${(reais / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (reais >= 10_000) return `${sinal}R$ ${(reais / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return formatarBRL(valor).replace('-', '−')
}

/**
 * Converte texto digitado ou importado em centavos.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ -12,30", "(12,30)", "12,3".
 * Retorna null se não reconhecer.
 */
export function lerValor(texto: string): Centavos | null {
  let t = texto.trim().replace(/\s|R\$| /g, '')
  if (t === '') return null
  let negativo = false
  if (/^\(.*\)$/.test(t)) {
    negativo = true
    t = t.slice(1, -1)
  }
  if (t.startsWith('-') || t.startsWith('−')) {
    negativo = true
    t = t.slice(1)
  } else if (t.endsWith('-')) {
    negativo = true
    t = t.slice(0, -1)
  }
  if (!/^[\d.,]+$/.test(t)) return null

  const ultimaVirgula = t.lastIndexOf(',')
  const ultimoPonto = t.lastIndexOf('.')
  let inteiro: string
  let fracao = ''
  const sep = Math.max(ultimaVirgula, ultimoPonto)
  const casasDepois = sep >= 0 ? t.length - sep - 1 : 0
  // Separador decimal: o último, se tiver 1 ou 2 dígitos depois. "1.234" é milhar.
  if (sep >= 0 && casasDepois > 0 && casasDepois <= 2) {
    inteiro = t.slice(0, sep).replace(/[.,]/g, '')
    fracao = t.slice(sep + 1)
  } else {
    inteiro = t.replace(/[.,]/g, '')
  }
  if (inteiro === '' && fracao === '') return null
  const centavos = Number(inteiro || '0') * 100 + Number(fracao.padEnd(2, '0'))
  if (!Number.isSafeInteger(centavos)) return null
  return negativo ? -centavos : centavos
}

/** Arredonda meio para longe do zero. */
function arredondar(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x)
}

/** valor × fração (ex.: percentual 0,35). Resultado em centavos inteiros. */
export function multiplicar(valor: Centavos, fator: number): Centavos {
  return arredondar(valor * fator)
}

/**
 * Divide um valor em partes iguais sem perder centavos.
 * A sobra vai para as primeiras partes. Ex.: 100,00 em 3 → 33,34 + 33,33 + 33,33.
 */
export function dividirEmPartes(total: Centavos, partes: number): Centavos[] {
  if (!Number.isInteger(partes) || partes <= 0) throw new Error('Número de partes inválido')
  const sinal = total < 0 ? -1 : 1
  const abs = Math.abs(total)
  const base = Math.floor(abs / partes)
  const sobra = abs - base * partes
  return Array.from({ length: partes }, (_, i) => sinal * (base + (i < sobra ? 1 : 0)))
}

/** Divide por pesos (ex.: 60% / 40%) sem perder centavos. */
export function dividirPorPesos(total: Centavos, pesos: number[]): Centavos[] {
  const soma = pesos.reduce((a, b) => a + b, 0)
  if (soma <= 0) throw new Error('Pesos inválidos')
  const brutos = pesos.map((p) => (total * p) / soma)
  const partes = brutos.map((b) => (total < 0 ? Math.ceil(b) : Math.floor(b)))
  let resto = total - partes.reduce((a, b) => a + b, 0)
  // distribui o resto pelas maiores frações
  const ordem = brutos
    .map((b, i) => ({ i, frac: Math.abs(b - (partes[i] ?? 0)) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of ordem) {
    if (resto === 0) break
    const passo = resto > 0 ? 1 : -1
    partes[i] = (partes[i] ?? 0) + passo
    resto -= passo
  }
  return partes
}

export function somar(valores: Centavos[]): Centavos {
  return valores.reduce((a, b) => a + b, 0)
}
