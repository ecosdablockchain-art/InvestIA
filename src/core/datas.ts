/**
 * Datas do app: sempre "AAAA-MM-DD" (data sem hora) no fuso America/Sao_Paulo.
 * Competência: inteiro AAAAMM (ex.: 202611), usado para agrupar por mês.
 */
export type DataISO = string
export type Competencia = number

export const FUSO = 'America/Sao_Paulo'

const partesFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data de hoje (ou do instante informado) no fuso de São Paulo. */
export function hojeISO(agora: Date = new Date()): DataISO {
  return partesFmt.format(agora) // en-CA formata como AAAA-MM-DD
}

export function ehDataISO(t: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  const [a, m, d] = t.split('-').map(Number) as [number, number, number]
  return m >= 1 && m <= 12 && d >= 1 && d <= diasNoMes(a, m)
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

export function competenciaDe(data: DataISO): Competencia {
  return Number(data.slice(0, 4)) * 100 + Number(data.slice(5, 7))
}

export function anoMes(c: Competencia): { ano: number; mes: number } {
  return { ano: Math.floor(c / 100), mes: c % 100 }
}

export function competencia(ano: number, mes: number): Competencia {
  return ano * 100 + mes
}

export function somarMeses(c: Competencia, n: number): Competencia {
  const { ano, mes } = anoMes(c)
  const total = ano * 12 + (mes - 1) + n
  return competencia(Math.floor(total / 12), (total % 12) + 1)
}

export function diferencaMeses(de: Competencia, ate: Competencia): number {
  const a = anoMes(de)
  const b = anoMes(ate)
  return (b.ano - a.ano) * 12 + (b.mes - a.mes)
}

/** Data com o dia ajustado ao tamanho do mês (dia 31 em fevereiro vira 28/29). */
export function dataNaCompetencia(c: Competencia, dia: number): DataISO {
  const { ano, mes } = anoMes(c)
  const d = Math.min(Math.max(1, dia), diasNoMes(ano, mes))
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  const ms = Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "novembro de 2026" */
export function nomeCompetencia(c: Competencia): string {
  const { ano, mes } = anoMes(c)
  return `${MESES[mes - 1]} de ${ano}`
}

/** "nov/26" */
export function nomeCompetenciaCurto(c: Competencia): string {
  const { ano, mes } = anoMes(c)
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`
}

/** "01/11/2026" */
export function formatarData(d: DataISO): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}
