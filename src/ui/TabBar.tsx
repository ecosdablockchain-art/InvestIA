import type { ComponentType, SVGProps } from 'react'
import type { Aba } from '../rotas'
import { IconeCredito, IconeImportar, IconeMes, IconePainel, IconePatrimonio } from './Icones'

const ABAS: { id: Aba; rotulo: string; Icone: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'painel', rotulo: 'Painel', Icone: IconePainel },
  { id: 'mes', rotulo: 'Mês', Icone: IconeMes },
  { id: 'importar', rotulo: 'Importar', Icone: IconeImportar },
  { id: 'credito', rotulo: 'Crédito', Icone: IconeCredito },
  { id: 'patrimonio', rotulo: 'Patrimônio', Icone: IconePatrimonio },
]

export function TabBar({ ativa }: { ativa: Aba | null }) {
  return (
    <nav aria-label="Seções" className="pb-seguro fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur-xl dark:border-borda-escuro dark:bg-fundo-escuro/90">
      <ul className="mx-auto flex max-w-xl">
        {ABAS.map(({ id, rotulo, Icone }) => {
          const sel = id === ativa
          return (
            <li key={id} className="flex-1">
              <a href={`#/${id}`} aria-current={sel ? 'page' : undefined}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 pt-1.5 text-[0.68rem] font-medium ${
                  sel ? 'text-marca-600 dark:text-marca-100' : 'text-slate-500 dark:text-slate-400'}`}>
                <Icone width={25} height={25} strokeWidth={sel ? 2.2 : 1.8} />
                {rotulo}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
