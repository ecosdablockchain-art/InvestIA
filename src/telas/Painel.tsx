import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/banco'
import { competenciaDe, hojeISO, nomeCompetencia } from '../core/datas'
import { patrimonioLiquido, resumirMes, type Visao } from '../core/orcamento'
import { salvarPreferencias, usePreferencias } from '../seguranca/preferencias'
import { CardValor, EstadoVazio, Segmentado, Tela } from '../ui/componentes'
import { IconeAjustes } from '../ui/Icones'

export function Painel() {
  const prefs = usePreferencias()
  const competencia = competenciaDe(hojeISO())
  const contextos = useLiveQuery(() => db.contextos.orderBy('ordem').filter((c) => !c.arquivado).toArray(), [])
  const lancamentos = useLiveQuery(() => db.lancamentos.where('competencia').equals(competencia).toArray(), [competencia])
  const investimentos = useLiveQuery(() => db.investimentos.toArray(), [])
  const dividas = useLiveQuery(() => db.dividas.toArray(), [])

  if (!contextos || !lancamentos || !investimentos || !dividas) return <Tela titulo="Painel"><p className="sr-only">Carregando…</p></Tela>

  const pessoal = contextos.find((c) => c.tipo === 'pessoal')
  const idVisao = prefs.visaoPainel === 'pessoal' ? pessoal?.id ?? 'tudo' : prefs.visaoPainel
  const valida = idVisao === 'tudo' || contextos.some((c) => c.id === idVisao)
  const visao: Visao = !valida || idVisao === 'tudo' ? { tipo: 'tudo' } : { tipo: 'contexto', id: idVisao }
  const resumo = resumirMes(lancamentos, competencia, visao)
  const pl = patrimonioLiquido(investimentos, dividas)

  const opcoes = [
    ...contextos.map((c) => ({ valor: c.id, rotulo: c.nome })),
    ...(contextos.length > 1 ? [{ valor: 'tudo', rotulo: 'Tudo' }] : []),
  ]

  return (
    <Tela
      titulo="Painel"
      subtitulo={nomeCompetencia(competencia)}
      acao={
        <a href="#/ajustes" aria-label="Ajustes" className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-superficie-escuro dark:text-slate-200 dark:ring-borda-escuro">
          <IconeAjustes width={22} height={22} />
        </a>
      }
    >
      {opcoes.length > 1 && (
        <Segmentado rotulo="Visão do painel" opcoes={opcoes} valor={visao.tipo === 'tudo' ? 'tudo' : visao.id}
          onMudar={(v) => salvarPreferencias({ visaoPainel: v === pessoal?.id ? 'pessoal' : v })} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <CardValor rotulo="Entradas do mês" valor={resumo.entradas} tom="positivo" />
        <CardValor rotulo="Gastos do mês" valor={resumo.gastos} tom="negativo" />
        <CardValor rotulo="Sobra" valor={resumo.sobra} tom="auto" legenda={resumo.sobra < 0 ? 'gastou mais do que entrou' : undefined} />
        <CardValor rotulo="Patrimônio líquido" valor={pl} legenda="investido − dívidas" />
      </div>

      {lancamentos.length === 0 && (
        <EstadoVazio icone="🧭" titulo="Tudo pronto para começar"
          texto="Lance seus gastos na aba Mês ou importe o extrato do banco. Os alertas, a previsão de 6 meses e o gráfico de categorias aparecem aqui assim que houver dados.">
          <a href="#/importar" className="inline-flex min-h-11 items-center rounded-xl bg-marca-600 px-4 font-semibold text-white">Importar extrato</a>
        </EstadoVazio>
      )}
    </Tela>
  )
}
