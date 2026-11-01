import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { datasDaFatura } from '../../core/credito'
import { calcularJogo, type ResultadoJogo } from '../../core/jogo'
import { usePatrimonio } from '../patrimonio/dados'

/** Nível, missões e conquistas, calculados a partir dos dados (nada novo é guardado). */
export function useJogo(): ResultadoJogo | null {
  const pat = usePatrimonio()
  const dados = useLiveQuery(async () => {
    const [lancamentos, categorias, contextos, faturas, cartoes, operacoes] = await Promise.all([
      db.lancamentos.toArray(), db.categorias.filter((c) => !c.arquivada && c.limiteMensal !== null).toArray(), db.contextos.toArray(),
      db.faturas.filter((f) => f.paga).toArray(), db.cartoes.toArray(), db.operacoes.count(),
    ])
    return { lancamentos, categorias, contextos, faturas, cartoes, operacoes }
  }, [])
  if (!pat || !dados) return null
  const emDia = dados.faturas.filter((f) => {
    const c = dados.cartoes.find((x) => x.id === f.cartaoId)
    return c && f.pagaEm && f.pagaEm <= datasDaFatura(f.competencia, c).vencimento
  }).length
  return calcularJogo({
    hoje: pat.hoje,
    lancamentos: dados.lancamentos,
    pessoalId: dados.contextos.find((c) => c.tipo === 'pessoal')?.id ?? null,
    limites: dados.categorias.map((c) => ({ categoriaId: c.id, limite: c.limiteMensal ?? 0 })),
    metasCriadas: pat.metas.length,
    metasConcluidas: pat.metas.filter((m) => m.s.estado === 'concluida').length,
    dividasQuitadas: pat.dividas.filter((d) => d.saldo <= 0 && d.origem === 'manual').length,
    faturasPagasEmDia: emDia,
    mesesDeReserva: pat.mesesReserva,
    investimentos: pat.investimentos.length + dados.operacoes,
  })
}
