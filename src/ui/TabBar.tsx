import type { ComponentType, SVGProps } from 'react'
import type { Aba } from '../rotas'
import { IconeAjustes, IconeCredito, IconeInsights, IconeMais, IconeMes, IconePainel, IconePatrimonio } from './Icones'

const ABAS: { id: Aba; rotulo: string; Icone: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'painel', rotulo: 'Painel', Icone: IconePainel },
  { id: 'mes', rotulo: 'Mês', Icone: IconeMes },
  { id: 'lancar', rotulo: 'Lançar', Icone: IconeMais },
  { id: 'insights', rotulo: 'Insights', Icone: IconeInsights },
  { id: 'credito', rotulo: 'Crédito', Icone: IconeCredito },
  { id: 'patrimonio', rotulo: 'Patrimônio', Icone: IconePatrimonio },
]

export function TabBar({ ativa }: { ativa: Aba | null }) {
  return (
    <nav aria-label="Seções" className="pb-seguro fixed inset-x-0 bottom-0 z-20 border-t lg:hidden border-slate-200 bg-white/90 backdrop-blur-xl dark:border-borda-escuro dark:bg-fundo-escuro/90">
      <ul className="mx-auto flex max-w-xl">
        {ABAS.map(({ id, rotulo, Icone }) => {
          const sel = id === ativa
          return (
            <li key={id} className="flex-1">
              {id === 'lancar' ? (
                <a href="#/mes/novo" aria-label="Novo lançamento" className="flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 pt-1 text-[0.68rem] font-semibold text-marca-600 dark:text-marca-100">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-marca-600 text-white shadow-md"><Icone width={22} height={22} strokeWidth={2.6} /></span>
                  {rotulo}
                </a>
              ) : (
              <a href={`#/${id}`} aria-current={sel ? 'page' : undefined}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 pt-1.5 text-[0.68rem] font-medium ${
                  sel ? 'text-marca-600 dark:text-marca-100' : 'text-slate-500 dark:text-slate-400'}`}>
                <Icone width={25} height={25} strokeWidth={sel ? 2.2 : 1.8} />
                {rotulo}
              </a>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Menu lateral fixo, no lugar da barra de baixo, em telas largas (computador). */
export function BarraLateral({ ativa, rota }: { ativa: Aba | null; rota: string }) {
  const ajustes = rota.startsWith('ajustes')
  const item = (sel: boolean) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium ${
    sel ? 'bg-marca-50 text-marca-700 dark:bg-slate-800 dark:text-marca-100' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'}`
  return (
    <nav aria-label="Seções" className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex dark:border-borda-escuro dark:bg-superficie-escuro">
      <a href="#/painel" className="mb-6 flex items-center gap-3 px-2">
        <img src="./icone.svg" alt="" className="h-10 w-10 rounded-xl" />
        <span className="text-lg font-bold">Finanças 360</span>
      </a>
      <a href="#/mes/novo" className="mb-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-marca-600 px-4 font-semibold text-white shadow-sm hover:bg-marca-700">
        <IconeMais width={20} height={20} strokeWidth={2.4} /> Novo lançamento
      </a>
      <ul className="space-y-1">
        {ABAS.filter((a) => a.id !== 'lancar').map(({ id, rotulo, Icone }) => {
          const sel = id === ativa && !ajustes
          return (
            <li key={id}>
              <a href={`#/${id}`} aria-current={sel ? 'page' : undefined} className={item(sel)}>
                <Icone width={22} height={22} strokeWidth={sel ? 2.2 : 1.8} /> {rotulo}
              </a>
            </li>
          )
        })}
      </ul>
      <a href="#/ajustes" aria-current={ajustes ? 'page' : undefined} className={`mt-auto ${item(ajustes)}`}>
        <IconeAjustes width={22} height={22} /> Ajustes
      </a>
    </nav>
  )
}
