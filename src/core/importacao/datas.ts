import { ehDataISO, type DataISO } from '../datas'

/**
 * Lê datas comuns em extratos: 05/11/2026, 05/11/26, 2026-11-05, 05-11-2026, 05.11.2026,
 * 20261105 (OFX) e 05/11 (sem ano: usa o ano que deixa a data mais perto da referência, sem passar dela).
 */
export function lerData(texto: string, referencia?: DataISO): DataISO | null {
  const t = texto.trim()
  let m = /^(\d{4})(\d{2})(\d{2})/.exec(t) // OFX: 20261105120000[-3:BRT]
  if (m && !/[/.-]/.test(t.slice(0, 10))) return montar(m[1], m[2], m[3])
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) return montar(m[1], m[2], m[3])
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/.exec(t)
  if (m) {
    const ano = m[3]!.length === 2 ? `20${m[3]}` : m[3]
    return montar(ano, m[2], m[1])
  }
  m = /^(\d{1,2})\/(\d{1,2})\b/.exec(t)
  if (m && referencia) {
    const anoRef = Number(referencia.slice(0, 4))
    const candidata = montar(String(anoRef), m[2], m[1])
    if (candidata && candidata <= referencia) return candidata
    return montar(String(anoRef - 1), m[2], m[1])
  }
  return null
}

function montar(ano?: string, mes?: string, dia?: string): DataISO | null {
  if (!ano || !mes || !dia) return null
  const d = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  return ehDataISO(d) ? d : null
}
