import { useState } from 'react'
import { db } from '../../db/banco'
import type { Investimento, Meta, OperacaoBolsa } from '../../db/tipos'
import { NOME_CLASSE } from '../../core/carteira'
import { formatarBRL } from '../../core/dinheiro'
import { formatarData, nomeCompetencia, nomeCompetenciaCurto } from '../../core/datas'
import { buscarCotacoes } from '../../servicos/cotacoes'
import { lerPreferencias } from '../../seguranca/preferencias'
import { mostrarAviso } from '../../ui/Aviso'
import { BarrasHorizontais, GraficoLinha } from '../../ui/graficos'
import { Botao, CardValor, Cartao as Caixa, EstadoVazio, Segmentado, Tela } from '../../ui/componentes'
import { useLiveQuery } from 'dexie-react-hooks'
import { usePatrimonio, type DadosPatrimonio } from './dados'
import { CLASSES_INVESTIMENTO, FolhaAporte, FolhaInvestimento, FolhaMeta, FolhaOperacao } from './Folhas'
import { pct } from '../credito/comum'

type Secao = 'resumo' | 'investimentos' | 'metas'
const fmtHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export function Patrimonio({ secaoInicial = 'resumo' }: { secaoInicial?: Secao }) {
  const [secao, setSecao] = useState<Secao>(secaoInicial)
  const d = usePatrimonio()
  return (
    <Tela titulo="Patrimônio">
      <Segmentado rotulo="Seção" valor={secao} onMudar={setSecao}
        opcoes={[{ valor: 'resumo', rotulo: 'Resumo' }, { valor: 'investimentos', rotulo: 'Investimentos' }, { valor: 'metas', rotulo: 'Metas' }]} />
      {!d ? <p className="sr-only">Carregando…</p> : secao === 'resumo' ? <Resumo d={d} irPara={setSecao} /> : secao === 'investimentos' ? <Investimentos d={d} /> : <Metas d={d} />}
    </Tela>
  )
}

function Resumo({ d, irPara }: { d: DadosPatrimonio; irPara: (s: Secao) => void }) {
  const vazio = d.totalInvestido === 0 && d.totalDividas === 0
  const pl = d.snapshots.slice(-12)
  const corReserva = { 'sem-dados': '', baixa: 'text-negativo dark:text-negativo-escuro', ok: '', otima: 'text-positivo dark:text-positivo-escuro' }[d.situacaoReserva]
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><CardValor rotulo="Patrimônio líquido" valor={d.liquido} tom="auto" legenda="tudo o que você tem investido, menos as dívidas" /></div>
        <CardValor rotulo="Investido" valor={d.totalInvestido} />
        <CardValor rotulo="Dívidas" valor={d.totalDividas} tom={d.totalDividas ? 'negativo' : 'neutro'} />
      </div>
      {vazio ? (
        <EstadoVazio icone="🌱" titulo="Comece pelos seus investimentos" texto="Cadastre a reserva de emergência, renda fixa, previdência e as operações de bolsa. O app calcula o patrimônio, a alocação e acompanha a evolução mês a mês.">
          <Botao onClick={() => irPara('investimentos')}>Cadastrar investimentos</Botao>
        </EstadoVazio>
      ) : (
        <>
          <Caixa titulo="Reserva de emergência">
            {d.mesesReserva === null ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Para calcular quantos meses a reserva cobre, lance seus gastos por pelo menos um mês. Reserva atual: <strong className="numeros">{formatarBRL(d.reserva)}</strong>.</p>
            ) : (
              <>
                <p className={`numeros text-2xl font-semibold ${corReserva}`}>{d.mesesReserva.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {formatarBRL(d.reserva)} com resgate a qualquer dia, para um gasto médio de {formatarBRL(d.gastoMedio)} por mês.{' '}
                  {d.situacaoReserva === 'baixa' ? 'O recomendado é ter de 3 a 6 meses.' : d.situacaoReserva === 'ok' ? 'Bom! O ideal é chegar a 6 meses.' : 'Excelente: 6 meses ou mais.'}
                </p>
              </>
            )}
          </Caixa>

          {d.aloc.length > 0 && (
            <Caixa titulo="Onde está o dinheiro">
              <BarrasHorizontais titulo="Alocação por classe" itens={d.aloc.map((a) => ({ id: a.classe, rotulo: NOME_CLASSE[a.classe], valor: a.valor }))} />
              {d.risco && (
                <div className={`mt-4 rounded-xl px-3 py-2 text-sm ${d.risco.acimaDoPerfil ? 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  Risco da carteira: <strong>{d.risco.nivel}</strong> ({d.risco.nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de 5).{' '}
                  {d.risco.acimaDoPerfil
                    ? `Está acima do seu perfil (${d.perfil}). Isso não é recomendação: só um sinal para revisar se faz sentido para você.`
                    : `Compatível com o seu perfil (${d.perfil}).`}
                  <span className="mt-1 block text-xs opacity-80">Régua simples por tipo de investimento. Perfil em Ajustes. Não é recomendação de investimento.</span>
                </div>
              )}
            </Caixa>
          )}

          <Caixa titulo="Evolução do patrimônio líquido">
            {pl.length < 2 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">O app guarda o valor de cada mês sozinho. A linha aparece a partir do 2º mês ({nomeCompetencia(d.competencia)} já está registrado).</p>
            ) : (
              <GraficoLinha titulo="Patrimônio líquido mês a mês" nome="Patrimônio líquido" rotulos={pl.map((p) => nomeCompetenciaCurto(p.competencia))} valores={pl.map((p) => p.totalInvestido - p.totalDividas)} />
            )}
          </Caixa>
        </>
      )}
    </>
  )
}

function Investimentos({ d }: { d: DadosPatrimonio }) {
  const [folhaOp, setFolhaOp] = useState<{ op?: OperacaoBolsa; ticker?: string } | null>(null)
  const [folhaInv, setFolhaInv] = useState<{ inv?: Investimento } | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [falhas, setFalhas] = useState<string | null>(null)
  const operacoes = useLiveQuery(() => db.operacoes.orderBy('data').reverse().toArray(), [])
  const ultimaCotacao = d.cotacoes.reduce((m, c) => (c.atualizadaEm > m ? c.atualizadaEm : m), '')

  async function atualizar() {
    const { fonteCotacao, chaveCotacao } = lerPreferencias()
    setAtualizando(true); setFalhas(null)
    try {
      const r = await buscarCotacoes(d.posicoes.map((p) => p.ticker), fonteCotacao, chaveCotacao)
      const agora = new Date().toISOString()
      await db.cotacoes.bulkPut([...r.precos].map(([id, preco]) => ({ id, preco, atualizadaEm: agora, fonte: fonteCotacao })))
      if (r.falhas.length) setFalhas(`Sem cotação para ${r.falhas.map((f) => `${f.ticker} (${f.motivo})`).join(', ')}.${!chaveCotacao ? ' Cadastre sua chave em Ajustes › Investimentos.' : ''}`)
      if (r.precos.size) mostrarAviso(`${r.precos.size} ${r.precos.size === 1 ? 'cotação atualizada' : 'cotações atualizadas'}`)
    } catch {
      setFalhas('Não foi possível buscar as cotações. Verifique a internet.')
    } finally { setAtualizando(false) }
  }

  return (
    <>
      <Caixa titulo="Bolsa">
        {d.posicoes.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Registre suas compras e vendas de ações, FIIs, ETFs e BDRs. O app calcula a posição, o preço médio e o resultado.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="numeros text-xl font-semibold">{formatarBRL(d.totalBolsa)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ultimaCotacao ? `cotações de ${fmtHora.format(new Date(ultimaCotacao))}` : 'sem cotações: valores pelo custo'}</p>
              </div>
              <Botao variante="secundario" className="min-h-10 px-3 text-sm" disabled={atualizando} onClick={() => void atualizar()}>{atualizando ? 'Buscando…' : 'Atualizar cotações'}</Botao>
            </div>
            {falhas && <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">{falhas}</p>}
            <ul className="divide-y divide-slate-200 dark:divide-borda-escuro">
              {d.posicoes.map((p) => {
                const ops = operacoes?.filter((o) => o.ticker === p.ticker) ?? []
                const cor = p.resultado > 0 ? 'text-positivo dark:text-positivo-escuro' : p.resultado < 0 ? 'text-negativo dark:text-negativo-escuro' : ''
                return (
                  <li key={p.ticker} className="py-2.5">
                    <button type="button" className="w-full text-left" aria-expanded={aberto === p.ticker} onClick={() => setAberto(aberto === p.ticker ? null : p.ticker)}>
                      <span className="flex justify-between gap-2">
                        <span className="font-semibold">{p.ticker} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{NOME_CLASSE[p.tipoAtivo]} · {pct(p.peso, 0)}</span></span>
                        <span className="numeros font-semibold">{formatarBRL(p.valorAtual)}</span>
                      </span>
                      <span className="numeros flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{p.quantidade} × PM {formatarBRL(p.precoMedio)}{p.cotacao !== null ? ` · cotação ${formatarBRL(p.cotacao)}` : ''}</span>
                        <span className={cor}>{p.cotacao !== null ? `${p.resultado >= 0 ? '+' : ''}${formatarBRL(p.resultado)} (${p.resultadoPct !== null ? pct(p.resultadoPct, 1) : '—'})` : ''}</span>
                      </span>
                    </button>
                    {aberto === p.ticker && (
                      <div className="mt-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-900/50">
                        {p.resultadoRealizado !== 0 && <p className="px-1 pb-1 text-xs">Resultado já realizado em vendas: <strong className="numeros">{formatarBRL(p.resultadoRealizado)}</strong></p>}
                        <ul className="text-sm">
                          {ops.map((o) => (
                            <li key={o.id}>
                              <button type="button" className="flex min-h-10 w-full justify-between gap-2 px-1 text-left" onClick={() => setFolhaOp({ op: o })} aria-label={`Editar operação de ${formatarData(o.data)}`}>
                                <span>{formatarData(o.data)} · {o.lado === 'compra' ? 'Compra' : 'Venda'} {o.quantidade}</span>
                                <span className="numeros">{formatarBRL(o.preco)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button type="button" className="mt-1 min-h-10 px-1 text-sm font-medium text-marca-600 dark:text-marca-100" onClick={() => setFolhaOp({ ticker: p.ticker })}>+ Operação de {p.ticker}</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <Botao variante="secundario" className="mt-3 w-full" onClick={() => setFolhaOp({})}>+ Compra ou venda</Botao>
      </Caixa>

      <Caixa titulo="Renda fixa, reserva e outros">
        {d.investimentos.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Reserva, CDB, Tesouro, previdência, cripto, conta de opções… Cadastre com o valor de hoje e atualize de vez em quando.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-borda-escuro">
            {[...d.investimentos].sort((a, b) => b.valorAtual - a.valorAtual).map((i) => {
              const rend = i.valorAtual - i.aplicado
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => setFolhaInv({ inv: i })} className="w-full py-2.5 text-left" aria-label={`Editar ${i.nome}`}>
                    <span className="flex justify-between gap-2"><span className="font-medium">{i.nome}</span><span className="numeros font-semibold">{formatarBRL(i.valorAtual)}</span></span>
                    <span className="flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{CLASSES_INVESTIMENTO.find((c) => c.valor === i.classe)?.rotulo.split(' (')[0]}{i.instituicao ? ` · ${i.instituicao}` : ''}{i.liquidez === 'diaria' ? ' · liquidez diária' : i.vencimento ? ` · vence ${formatarData(i.vencimento)}` : ''}</span>
                      {i.aplicado > 0 && <span className={`numeros ${rend > 0 ? 'text-positivo dark:text-positivo-escuro' : rend < 0 ? 'text-negativo dark:text-negativo-escuro' : ''}`}>{rend >= 0 ? '+' : ''}{formatarBRL(rend)}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <Botao variante="secundario" className="mt-3 w-full" onClick={() => setFolhaInv({})}>+ Investimento</Botao>
      </Caixa>
      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">O Finanças 360 acompanha o que você já investe. Não recomenda compra ou venda de ativos.</p>

      <FolhaOperacao aberta={!!folhaOp} operacao={folhaOp?.op} tickerInicial={folhaOp?.ticker} onFechar={() => setFolhaOp(null)} />
      <FolhaInvestimento aberta={!!folhaInv} investimento={folhaInv?.inv} onFechar={() => setFolhaInv(null)} />
    </>
  )
}

const ESTADO_META = {
  concluida: { texto: 'Concluída', classe: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  'em-dia': { texto: 'Em dia', classe: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  'em-risco': { texto: 'Aportes abaixo do necessário', classe: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  atrasada: { texto: 'Prazo passou', classe: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' },
  'sem-prazo': { texto: 'Sem prazo', classe: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
} as const

function Metas({ d }: { d: DadosPatrimonio }) {
  const [folha, setFolha] = useState<{ meta?: Meta } | null>(null)
  const [aporte, setAporte] = useState<Meta | null>(null)
  return (
    <>
      {d.metas.length === 0 ? (
        <EstadoVazio icone="🎯" titulo="Nenhuma meta ainda" texto="Viagem, carro, reserva, entrada do apartamento… Defina quanto quer juntar e até quando: o app calcula quanto guardar por mês.">
          <Botao onClick={() => setFolha({})}>Criar meta</Botao>
        </EstadoVazio>
      ) : (
        <>
          {d.metas.map(({ meta, s }) => (
            <section key={meta.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro" aria-label={`Meta ${meta.nome}`}>
              <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setFolha({ meta })} aria-label={`Editar meta ${meta.nome}`}>
                <span className="text-3xl" aria-hidden>{meta.icone}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{meta.nome}</span>
                  <span className="numeros block text-sm text-slate-600 dark:text-slate-400">{formatarBRL(s.atual)} de {formatarBRL(meta.valorAlvo)}{meta.prazo ? ` · até ${formatarData(meta.prazo)}` : ''}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_META[s.estado].classe}`}>{ESTADO_META[s.estado].texto}</span>
              </button>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label={`${meta.nome}: ${Math.round(s.progresso * 100)}%`} aria-valuenow={Math.round(s.progresso * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full" style={{ width: `${s.progresso * 100}%`, background: 'var(--serie-1)' }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {s.estado === 'concluida' ? 'Parabéns! 🎉' : s.aporteNecessario ? <>Guarde <strong className="numeros text-slate-900 dark:text-slate-100">{formatarBRL(s.aporteNecessario)}</strong>{s.mesesRestantes ? ` por mês (${s.mesesRestantes} ${s.mesesRestantes === 1 ? 'mês' : 'meses'})` : ' para fechar'}</> : `Faltam ${formatarBRL(s.falta)}`}
                </span>
                {s.estado !== 'concluida' && <Botao className="min-h-9 px-3 text-sm" onClick={() => setAporte(meta)}>Guardar</Botao>}
              </div>
              {s.mediaAportes > 0 && s.estado !== 'concluida' && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Média dos últimos 3 meses: {formatarBRL(s.mediaAportes)} por mês</p>}
            </section>
          ))}
          <Botao variante="secundario" className="w-full" onClick={() => setFolha({})}>+ Meta</Botao>
        </>
      )}
      <FolhaMeta aberta={!!folha} meta={folha?.meta} onFechar={() => setFolha(null)} />
      <FolhaAporte meta={aporte} onFechar={() => setAporte(null)} />
    </>
  )
}
