import { useId, type ReactNode } from 'react'
import { formatarBRL, formatarBRLCompacto, type Centavos } from '../core/dinheiro'
import { nivelLimite } from '../core/orcamento'
import { IconeSeta, IconeVoltar } from './Icones'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Tela({ titulo, subtitulo, acao, voltar, children }: {
  titulo: string; subtitulo?: string; acao?: ReactNode; voltar?: { rotulo: string; href: string }; children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-seguro pb-28">
      {voltar && (
        <a href={voltar.href} className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-0.5 text-marca-600 dark:text-marca-100">
          <IconeVoltar width={20} height={20} /> {voltar.rotulo}
        </a>
      )}
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="text-sm text-slate-600 dark:text-slate-400">{subtitulo}</p>}
        </div>
        {acao}
      </header>
      <div className="space-y-4">{children}</div>
    </main>
  )
}

export function Cartao({ children, className, titulo }: { children: ReactNode; className?: string; titulo?: string }) {
  return (
    <section className={cx('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro', className)}>
      {titulo && <h2 className="mb-3 text-[0.95rem] font-semibold">{titulo}</h2>}
      {children}
    </section>
  )
}

export function CardValor({ rotulo, valor, tom = 'neutro', legenda }: {
  rotulo: string; valor: Centavos; tom?: 'neutro' | 'positivo' | 'negativo' | 'auto'; legenda?: string
}) {
  const t = tom === 'auto' ? (valor < 0 ? 'negativo' : valor > 0 ? 'positivo' : 'neutro') : tom
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro" aria-label={`${rotulo}: ${formatarBRL(valor)}`} role="group">
      <p className="text-[0.8rem] font-medium text-slate-600 dark:text-slate-400">{rotulo}</p>
      <p className={cx('numeros mt-1 text-[1.3rem] font-semibold tracking-tight',
        t === 'positivo' && 'text-positivo dark:text-positivo-escuro',
        t === 'negativo' && 'text-negativo dark:text-negativo-escuro')}>
        {formatarBRLCompacto(valor)}
      </p>
      {legenda && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{legenda}</p>}
    </div>
  )
}

export function BarraLimite({ rotulo, gasto, limite }: { rotulo: string; gasto: Centavos; limite: Centavos }) {
  const { nivel, percentual } = nivelLimite(gasto, limite)
  const cor = nivel === 'ok' ? 'bg-emerald-600' : nivel === 'atencao' ? 'bg-amber-500' : 'bg-red-600'
  const texto = nivel === 'ok' ? 'dentro do limite' : nivel === 'atencao' ? 'perto do limite' : 'acima do limite'
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{rotulo}</span>
        <span className="numeros text-slate-600 dark:text-slate-400">{formatarBRL(gasto)} de {formatarBRL(limite)}</span>
      </div>
      <div role="progressbar" aria-label={`${rotulo}: ${Math.round(percentual)}% do limite, ${texto}`}
        aria-valuenow={Math.round(percentual)} aria-valuemin={0} aria-valuemax={100}
        className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={cx('h-full rounded-full', cor)} style={{ width: `${Math.min(100, percentual)}%` }} />
      </div>
    </div>
  )
}

export function EstadoVazio({ icone, titulo, texto, children }: { icone: string; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-borda-escuro">
      <div className="text-4xl" aria-hidden>{icone}</div>
      <h2 className="mt-3 font-semibold">{titulo}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">{texto}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function Botao({ children, variante = 'primario', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'perigo'
}) {
  return (
    <button
      type="button"
      {...props}
      className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold disabled:opacity-50',
        variante === 'primario' && 'bg-marca-600 text-white active:bg-marca-700',
        variante === 'secundario' && 'bg-slate-200/80 text-slate-900 active:bg-slate-300 dark:bg-slate-700 dark:text-slate-100',
        variante === 'perigo' && 'bg-red-600 text-white active:bg-red-700',
        className)}
    >
      {children}
    </button>
  )
}

/** Grupo de linhas no estilo dos Ajustes do iPhone. */
export function Grupo({ titulo, rodape, children }: { titulo?: string; rodape?: string; children: ReactNode }) {
  return (
    <section>
      {titulo && <h2 className="mb-1.5 px-4 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{titulo}</h2>}
      <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 dark:divide-borda-escuro dark:bg-superficie-escuro dark:ring-borda-escuro">
        {children}
      </div>
      {rodape && <p className="mt-1.5 px-4 text-xs text-slate-500 dark:text-slate-400">{rodape}</p>}
    </section>
  )
}

export function Linha({ icone, titulo, detalhe, href, onClick, perigo, children }: {
  icone?: string; titulo: string; detalhe?: string; href?: string; onClick?: () => void; perigo?: boolean; children?: ReactNode
}) {
  const conteudo = (
    <>
      {icone && <span className="w-7 text-center text-lg" aria-hidden>{icone}</span>}
      <span className={cx('flex-1 text-left', perigo && 'text-red-600 dark:text-red-400')}>{titulo}</span>
      {detalhe && <span className="text-sm text-slate-500 dark:text-slate-400">{detalhe}</span>}
      {children}
      {(href || onClick) && !children && <IconeSeta className="text-slate-400" />}
    </>
  )
  const classe = 'flex min-h-12 w-full items-center gap-3 px-4 py-2.5'
  if (href) return <a href={href} className={cx(classe, 'active:bg-slate-100 dark:active:bg-slate-800')}>{conteudo}</a>
  if (onClick) return <button type="button" onClick={onClick} className={cx(classe, 'active:bg-slate-100 dark:active:bg-slate-800')}>{conteudo}</button>
  return <div className={classe}>{conteudo}</div>
}

export function Interruptor({ ligado, onMudar, rotulo, desabilitado }: {
  ligado: boolean; onMudar: (v: boolean) => void; rotulo: string; desabilitado?: boolean
}) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desabilitado}
      onClick={() => onMudar(!ligado)}
      className={cx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-50',
        ligado ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}>
      <span className={cx('absolute top-0.5 left-0.5 h-[27px] w-[27px] rounded-full bg-white shadow transition-transform',
        ligado && 'translate-x-5')} />
    </button>
  )
}

export function Segmentado<T extends string>({ opcoes, valor, onMudar, rotulo }: {
  opcoes: { valor: T; rotulo: string }[]; valor: T; onMudar: (v: T) => void; rotulo: string
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={o.valor === valor} onClick={() => onMudar(o.valor)}
          className={cx('min-h-9 flex-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap',
            o.valor === valor ? 'bg-white shadow-sm dark:bg-slate-600' : 'text-slate-600 dark:text-slate-300')}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Campo({ rotulo, dica, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{rotulo}</label>
      <input id={id} {...props}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-borda-escuro dark:bg-slate-900" />
      {dica && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dica}</p>}
    </div>
  )
}
