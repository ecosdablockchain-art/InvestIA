import { useState } from 'react'
import { formatarBRL, formatarEixo, type Centavos } from '../core/dinheiro'

export interface Serie { nome: string; cor: string; valores: Centavos[] }

/** Escala "bonita" para o eixo: 0 até um teto arredondado. */
function teto(max: number): number {
  if (max <= 0) return 100
  const pot = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pot >= max) return m * pot
  return 10 * pot
}

/** Retângulo com só o topo arredondado (a base fica presa ao eixo). */
function barra(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

function Legenda({ series }: { series: { nome: string; cor: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
      {series.map((s) => (
        <li key={s.nome} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} aria-hidden /> {s.nome}
        </li>
      ))}
    </ul>
  )
}

function TabelaDados({ rotulos, series, titulo }: { rotulos: string[]; series: Serie[]; titulo: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="min-h-9 cursor-pointer py-2 text-marca-600 dark:text-marca-100">Ver em tabela</summary>
      <div className="overflow-x-auto">
        <table className="numeros w-full text-right">
          <caption className="sr-only">{titulo}</caption>
          <thead><tr className="text-xs text-slate-500 dark:text-slate-400"><th className="py-1 text-left font-medium">Mês</th>{series.map((s) => <th key={s.nome} className="py-1 font-medium">{s.nome}</th>)}</tr></thead>
          <tbody>
            {rotulos.map((r, i) => (
              <tr key={r} className="border-t border-slate-200 dark:border-borda-escuro">
                <th className="py-1.5 text-left font-normal">{r}</th>
                {series.map((s) => <td key={s.nome} className="py-1.5">{formatarBRL(s.valores[i] ?? 0)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/**
 * Colunas agrupadas por mês (até 3 séries, mesma escala).
 * Toque numa coluna para ver os valores daquele mês no topo.
 */
export function GraficoColunas({ titulo, rotulos, series, destaqueInicial = 0, notaDoMes }: {
  titulo: string; rotulos: string[]; series: Serie[]; destaqueInicial?: number; notaDoMes?: (i: number) => string | undefined
}) {
  const [sel, setSel] = useState(destaqueInicial)
  const L = 340, A = 170, esq = 40, dir = 4, topo = 8, base = 22
  const largura = L - esq - dir
  const altura = A - topo - base
  const max = teto(Math.max(0, ...series.flatMap((s) => s.valores)))
  const grupo = largura / rotulos.length
  const gap = 2
  const larguraBarra = Math.min(18, (grupo * 0.7 - gap * (series.length - 1)) / series.length)
  const larguraGrupo = larguraBarra * series.length + gap * (series.length - 1)
  const y = (v: number) => topo + altura - (v / max) * altura
  const nota = notaDoMes?.(sel)

  return (
    <figure>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" aria-live="polite">
        <span className="text-sm font-semibold">{rotulos[sel]}</span>
        <span className="flex gap-3 text-sm">
          {series.map((s) => (
            <span key={s.nome} className="numeros flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} aria-hidden />
              <span className="sr-only">{s.nome}:</span>{formatarBRL(s.valores[sel] ?? 0)}
            </span>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label={`${titulo}. Toque numa coluna para ver os valores do mês.`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={esq} x2={L - dir} y1={y(max * f)} y2={y(max * f)} stroke="var(--grade)" strokeWidth={1} />
            <text x={esq - 6} y={y(max * f) + 3.5} textAnchor="end" fontSize={10} fill="var(--eixo-texto)">{formatarEixo(Math.round(max * f))}</text>
          </g>
        ))}
        {rotulos.map((r, i) => {
          const x0 = esq + grupo * i + (grupo - larguraGrupo) / 2
          const ativo = i === sel
          return (
            <g key={r} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              {ativo && <rect x={esq + grupo * i + 1} y={topo} width={grupo - 2} height={altura} rx={6} fill="var(--grade)" opacity={0.55} />}
              {series.map((s, k) => {
                const v = s.valores[i] ?? 0
                const h = (v / max) * altura
                return <path key={s.nome} d={barra(x0 + k * (larguraBarra + gap), y(v), larguraBarra, h, 4)} fill={s.cor} opacity={ativo ? 1 : 0.85} />
              })}
              <text x={esq + grupo * i + grupo / 2} y={A - 6} textAnchor="middle" fontSize={10.5} fontWeight={ativo ? 600 : 400} fill="var(--eixo-texto)">{r}</text>
              <rect x={esq + grupo * i} y={0} width={grupo} height={A} fill="transparent">
                <title>{`${r}: ${series.map((s) => `${s.nome} ${formatarBRL(s.valores[i] ?? 0)}`).join(', ')}`}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between gap-2">
        <Legenda series={series} />
        {nota && <span className="text-xs text-slate-500 dark:text-slate-400">{nota}</span>}
      </div>
      <TabelaDados rotulos={rotulos} series={series} titulo={titulo} />
    </figure>
  )
}

/** Barras horizontais de uma série só, com o valor escrito em cada linha. */
export function BarrasHorizontais({ itens, titulo }: { itens: { id: string; rotulo: string; icone?: string; valor: Centavos; detalhe?: string }[]; titulo: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor))
  const total = itens.reduce((a, i) => a + i.valor, 0)
  return (
    <ul className="space-y-3" aria-label={titulo}>
      {itens.map((i) => (
        <li key={i.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate"><span aria-hidden>{i.icone} </span>{i.rotulo}</span>
            <span className="numeros shrink-0 font-medium">
              {formatarBRL(i.valor)} <span className="font-normal text-slate-500 dark:text-slate-400">· {Math.round((i.valor / (total || 1)) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (i.valor / max) * 100)}%`, background: 'var(--serie-1)' }} />
          </div>
          {i.detalhe && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{i.detalhe}</p>}
        </li>
      ))}
    </ul>
  )
}

/** Linha de uma série (ex.: patrimônio líquido). Aceita valores negativos. */
export function GraficoLinha({ titulo, rotulos, valores, nome }: { titulo: string; rotulos: string[]; valores: Centavos[]; nome: string }) {
  const [sel, setSel] = useState(valores.length - 1)
  const L = 340, A = 150, esq = 44, dir = 10, topo = 10, base = 22
  const minV = Math.min(0, ...valores)
  const maxV = Math.max(0, ...valores)
  const amplitude = teto(Math.max(1, maxV - minV))
  const lo = minV < 0 ? -teto(-minV) : 0
  const hi = lo + Math.max(amplitude, maxV - lo)
  const x = (i: number) => esq + (valores.length === 1 ? (L - esq - dir) / 2 : (i / (valores.length - 1)) * (L - esq - dir))
  const y = (v: number) => topo + (A - topo - base) * (1 - (v - lo) / (hi - lo || 1))
  const pontos = valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <figure>
      <div className="mb-2 flex justify-between text-sm" aria-live="polite">
        <span className="font-semibold">{rotulos[sel]}</span>
        <span className="numeros">{formatarBRL(valores[sel] ?? 0)}</span>
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label={`${titulo}. Toque num ponto para ver o valor.`}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={esq} x2={L - dir} y1={y(v)} y2={y(v)} stroke="var(--grade)" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={esq - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--eixo-texto)">{formatarEixo(Math.round(v))}</text>
          </g>
        ))}
        <polyline points={pontos} fill="none" stroke="var(--serie-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {valores.map((v, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(v)} r={i === sel ? 5 : 4} fill="var(--serie-1)" stroke="var(--color-fundo)" strokeWidth={2} />
            <text x={x(i)} y={A - 6} textAnchor={valores.length > 1 && i === 0 ? 'start' : valores.length > 1 && i === valores.length - 1 ? 'end' : 'middle'} fontSize={10.5} fill="var(--eixo-texto)" fontWeight={i === sel ? 600 : 400}>{rotulos[i]}</text>
            <rect x={x(i) - 18} y={0} width={36} height={A} fill="transparent"><title>{`${rotulos[i]}: ${formatarBRL(v)}`}</title></rect>
          </g>
        ))}
      </svg>
      <TabelaDados rotulos={rotulos} series={[{ nome, cor: 'var(--serie-1)', valores }]} titulo={titulo} />
    </figure>
  )
}

export const COR_ENTRADAS = 'var(--serie-1)'
export const COR_SAIDAS = 'var(--serie-2)'
