import { useAjustesConta } from '../../db/ajustesConta'
import { Cartao, Tela } from '../../ui/componentes'
import { PixelArte } from '../../ui/PixelArte'
import { useJogo } from './dados'
import type { ResultadoJogo } from '../../core/jogo'

function BarraNivel({ j }: { j: ResultadoJogo }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar"
      aria-label={`Nível ${j.nivel.numero}: ${j.xp} de ${j.nivel.xpDoProximo} XP`} aria-valuenow={Math.round(j.nivel.progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(3, j.nivel.progresso * 100)}%`, background: 'var(--serie-1)' }} />
    </div>
  )
}

/** Cartão discreto para o Painel. */
export function CartaoJogo() {
  const ajustes = useAjustesConta()
  const j = useJogo()
  if (!ajustes?.jogoAtivo || !j) return null
  const feitas = j.missoes.filter((m) => m.feita).length
  return (
    <a href="#/jogo" className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 active:bg-slate-50 dark:bg-superficie-escuro dark:ring-borda-escuro" aria-label={`Nível ${j.nivel.numero}, ${j.nivel.nome}. ${feitas} de ${j.missoes.length} missões da semana. Ver detalhes.`}>
      <div className="mb-2 flex items-center gap-3">
        <PixelArte nome="estrela" tamanho={32} rotulo="" />
        <div className="flex-1">
          <p className="font-semibold">Nível {j.nivel.numero} · {j.nivel.nome}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{j.xp} XP · faltam {j.nivel.xpDoProximo - j.xp} para o próximo</p>
        </div>
        <span className="text-right text-xs text-slate-600 dark:text-slate-300">{j.semanasSeguidas > 0 && <span className="block">🔥 {j.semanasSeguidas} {j.semanasSeguidas === 1 ? 'semana' : 'semanas'}</span>}{feitas}/{j.missoes.length} missões</span>
      </div>
      <BarraNivel j={j} />
    </a>
  )
}

export function Jogo() {
  const j = useJogo()
  if (!j) return <Tela titulo="Conquistas"><p className="sr-only">Carregando…</p></Tela>
  const obtidas = j.conquistas.filter((c) => c.obtida).length
  return (
    <Tela titulo="Conquistas" voltar={{ rotulo: 'Painel', href: '#/painel' }}>
      <Cartao>
        <div className="mb-3 flex items-center gap-4">
          <PixelArte nome="estrela" tamanho={56} rotulo="" />
          <div>
            <p className="text-xl font-bold">Nível {j.nivel.numero}</p>
            <p className="text-slate-600 dark:text-slate-400">{j.nivel.nome}</p>
          </div>
          <p className="numeros ml-auto text-right text-sm"><strong className="block text-lg">{j.xp} XP</strong>próximo: {j.nivel.xpDoProximo}</p>
        </div>
        <BarraNivel j={j} />
        {j.semanasSeguidas > 0 && <p className="mt-3 text-sm">🔥 <strong>{j.semanasSeguidas} {j.semanasSeguidas === 1 ? 'semana seguida' : 'semanas seguidas'}</strong> lançando em pelo menos 3 dias.</p>}
      </Cartao>

      <Cartao titulo="Missões da semana">
        <ul className="space-y-3">
          {j.missoes.map((m) => (
            <li key={m.id} className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold ${m.feita ? 'bg-emerald-600 text-white' : 'ring-2 ring-slate-300 dark:ring-slate-600'}`} aria-hidden>{m.feita ? '✓' : ''}</span>
              <span className="flex-1">
                <span className="block font-medium"><span className="sr-only">{m.feita ? 'Feita: ' : 'A fazer: '}</span>{m.nome}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{m.detalhe} · {m.xp}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">A semana começa na segunda-feira.</p>
      </Cartao>

      <Cartao titulo={`Conquistas (${obtidas} de ${j.conquistas.length})`}>
        <ul className="grid grid-cols-3 gap-3">
          {j.conquistas.map((c) => (
            <li key={c.id} className="flex flex-col items-center gap-1 text-center">
              <PixelArte nome={c.icone} tamanho={44} apagado={!c.obtida} rotulo={`${c.nome}${c.obtida ? '' : ' (bloqueada)'}`} />
              <span className={`text-xs font-semibold ${c.obtida ? '' : 'text-slate-400 dark:text-slate-500'}`}>{c.nome}</span>
              <span className="text-[0.7rem] leading-tight text-slate-500 dark:text-slate-400">{c.descricao}</span>
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao titulo="Como ganhar XP">
        <ul className="divide-y divide-slate-200 text-sm dark:divide-borda-escuro">
          {j.fontes.map((f) => (
            <li key={f.nome} className="flex justify-between gap-3 py-2"><span>{f.nome}</span><span className="numeros shrink-0 font-semibold">{f.xp} XP</span></li>
          ))}
        </ul>
      </Cartao>
      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">Para esconder o nível e as missões, vá em Ajustes › Plano e jogo.</p>
    </Tela>
  )
}
