import { useEffect, useState } from 'react'
import { db } from '../../db/banco'
import { apagarMeta, registrarAporte, salvarInvestimento, salvarMeta, salvarOperacao } from '../../db/patrimonio'
import type { Investimento, Meta, OperacaoBolsa } from '../../db/tipos'
import type { ClasseInvestimento, Liquidez, TipoAtivo } from '../../db/tipos'
import { formatarBRL, type Centavos } from '../../core/dinheiro'
import { hojeISO } from '../../core/datas'
import { CampoValor } from '../../ui/CampoValor'
import { Folha } from '../../ui/Folha'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, Campo, Segmentado } from '../../ui/componentes'
import { useDadosBase } from '../mes/comum'

const Erro = ({ texto }: { texto: string | null }) => (texto ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{texto}</p> : null)
const Selecao = <T extends string>({ rotulo, valor, onMudar, opcoes }: { rotulo: string; valor: T; onMudar: (v: T) => void; opcoes: { valor: T; rotulo: string }[] }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium">{rotulo}</span>
    <select value={valor} onChange={(e) => onMudar(e.target.value as T)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-borda-escuro dark:bg-slate-900">
      {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  </label>
)
const SalvarTopo = ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>

export function FolhaOperacao({ aberta, operacao, tickerInicial, onFechar }: { aberta: boolean; operacao?: OperacaoBolsa; tickerInicial?: string; onFechar: () => void }) {
  const [ticker, setTicker] = useState('')
  const [tipoAtivo, setTipoAtivo] = useState<TipoAtivo>('acao')
  const [lado, setLado] = useState<'compra' | 'venda'>('compra')
  const [quantidade, setQuantidade] = useState('')
  const [preco, setPreco] = useState<Centavos>(0)
  const [custos, setCustos] = useState<Centavos>(0)
  const [data, setData] = useState(hojeISO())
  const [corretora, setCorretora] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (!aberta) return
    const o = operacao
    setTicker(o?.ticker ?? tickerInicial ?? ''); setTipoAtivo(o?.tipoAtivo ?? (/11$/.test(tickerInicial ?? '') ? 'fii' : 'acao')); setLado(o?.lado ?? 'compra')
    setQuantidade(o ? String(o.quantidade) : ''); setPreco(o?.preco ?? 0); setCustos(o?.custos ?? 0); setData(o?.data ?? hojeISO()); setCorretora(o?.corretora ?? ''); setErro(null)
  }, [aberta, operacao, tickerInicial])
  async function salvar() {
    try {
      await salvarOperacao(db, { ticker, tipoAtivo, lado, quantidade: Number(quantidade), preco, custos, data, corretora }, operacao)
      mostrarAviso(operacao ? 'Operação atualizada' : lado === 'compra' ? 'Compra registrada' : 'Venda registrada'); onFechar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') }
  }
  async function apagar() {
    if (!operacao || !window.confirm('Apagar esta operação?')) return
    await db.operacoes.delete(operacao.id); mostrarAviso('Operação apagada'); onFechar()
  }
  const qtd = Number(quantidade) || 0
  return (
    <Folha aberta={aberta} titulo={operacao ? 'Editar operação' : 'Nova operação'} onFechar={onFechar} acao={<SalvarTopo onClick={() => void salvar()} />}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <Segmentado rotulo="Compra ou venda" valor={lado} onMudar={setLado} opcoes={[{ valor: 'compra', rotulo: 'Compra' }, { valor: 'venda', rotulo: 'Venda' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Código" placeholder="PETR4" autoCapitalize="characters" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} data-foco="" />
          <Selecao rotulo="Tipo" valor={tipoAtivo} onMudar={setTipoAtivo} opcoes={[{ valor: 'acao', rotulo: 'Ação' }, { valor: 'fii', rotulo: 'FII' }, { valor: 'etf', rotulo: 'ETF' }, { valor: 'bdr', rotulo: 'BDR' }]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quantidade" inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, '').slice(0, 9))} />
          <CampoValor rotulo="Preço por unidade" valor={preco} onMudar={setPreco} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CampoValor rotulo="Taxas (opcional)" valor={custos} onMudar={setCustos} />
          <Campo rotulo="Data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        </div>
        <Campo rotulo="Corretora (opcional)" value={corretora} onChange={(e) => setCorretora(e.target.value)} />
        {qtd > 0 && preco > 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Total: <strong className="numeros">{formatarBRL(qtd * preco + (lado === 'compra' ? custos : -custos))}</strong></p>}
        <Erro texto={erro} />
        <Botao type="submit" className="w-full">Salvar</Botao>
        {operacao && <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={() => void apagar()}>Apagar operação</Botao>}
      </form>
    </Folha>
  )
}

export const CLASSES_INVESTIMENTO: { valor: ClasseInvestimento; rotulo: string }[] = [
  { valor: 'reserva', rotulo: 'Reserva de emergência' }, { valor: 'rendaFixa', rotulo: 'Renda fixa (CDB, Tesouro, LCI…)' },
  { valor: 'previdencia', rotulo: 'Previdência' }, { valor: 'exterior', rotulo: 'Exterior' }, { valor: 'cripto', rotulo: 'Cripto' },
  { valor: 'contaOpcoes', rotulo: 'Conta de opções' }, { valor: 'mesaProprietaria', rotulo: 'Desafio de mesa proprietária' }, { valor: 'outros', rotulo: 'Outros' },
]

export function FolhaInvestimento({ aberta, investimento, onFechar }: { aberta: boolean; investimento?: Investimento; onFechar: () => void }) {
  const [nome, setNome] = useState('')
  const [classe, setClasse] = useState<ClasseInvestimento>('rendaFixa')
  const [instituicao, setInstituicao] = useState('')
  const [aplicado, setAplicado] = useState<Centavos>(0)
  const [valorAtual, setValorAtual] = useState<Centavos>(0)
  const [liquidez, setLiquidez] = useState<Liquidez>('diaria')
  const [vencimento, setVencimento] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (!aberta) return
    const i = investimento
    setNome(i?.nome ?? ''); setClasse(i?.classe ?? 'rendaFixa'); setInstituicao(i?.instituicao ?? ''); setAplicado(i?.aplicado ?? 0)
    setValorAtual(i?.valorAtual ?? 0); setLiquidez(i?.liquidez ?? 'diaria'); setVencimento(i?.vencimento ?? ''); setErro(null)
  }, [aberta, investimento])
  async function salvar() {
    try {
      await salvarInvestimento(db, { nome, classe, instituicao: instituicao.trim(), aplicado, valorAtual: valorAtual || aplicado, liquidez, diasParaResgate: null, vencimento: vencimento || null }, investimento)
      mostrarAviso(investimento ? 'Investimento atualizado' : 'Investimento cadastrado'); onFechar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') }
  }
  async function apagar() {
    if (!investimento || !window.confirm(`Apagar "${investimento.nome}"?`)) return
    await db.investimentos.delete(investimento.id); mostrarAviso('Investimento apagado'); onFechar()
  }
  return (
    <Folha aberta={aberta} titulo={investimento ? 'Editar investimento' : 'Novo investimento'} onFechar={onFechar} acao={<SalvarTopo onClick={() => void salvar()} />}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <Campo rotulo="Nome" placeholder="Ex.: CDB 110% CDI" value={nome} onChange={(e) => setNome(e.target.value)} data-foco="" />
        <Selecao rotulo="Tipo" valor={classe} onMudar={setClasse} opcoes={CLASSES_INVESTIMENTO} />
        <Campo rotulo="Onde está (opcional)" placeholder="Ex.: Santander, XP" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <CampoValor rotulo="Quanto aplicou" valor={aplicado} onMudar={setAplicado} />
          <CampoValor rotulo="Valor hoje" valor={valorAtual} onMudar={setValorAtual} />
        </div>
        <Selecao rotulo="Quando pode resgatar" valor={liquidez} onMudar={setLiquidez}
          opcoes={[{ valor: 'diaria', rotulo: 'A qualquer dia (liquidez diária)' }, { valor: 'dMais', rotulo: 'Alguns dias depois de pedir' }, { valor: 'noVencimento', rotulo: 'Só no vencimento' }]} />
        {liquidez === 'noVencimento' && <Campo rotulo="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />}
        <p className="text-xs text-slate-500 dark:text-slate-400">Atualize o “valor hoje” de vez em quando, olhando o app do banco ou da corretora.</p>
        <Erro texto={erro} />
        <Botao type="submit" className="w-full">Salvar</Botao>
        {investimento && <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={() => void apagar()}>Apagar investimento</Botao>}
      </form>
    </Folha>
  )
}

const ICONES_META = ['🎯', '✈️', '🏠', '🚗', '🛟', '🎓', '💍', '👶', '💻', '🏖️']

export function FolhaMeta({ aberta, meta, onFechar }: { aberta: boolean; meta?: Meta; onFechar: () => void }) {
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('🎯')
  const [alvo, setAlvo] = useState<Centavos>(0)
  const [inicial, setInicial] = useState<Centavos>(0)
  const [prazo, setPrazo] = useState('')
  const [prioridade, setPrioridade] = useState<'1' | '2' | '3'>('2')
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (!aberta) return
    setNome(meta?.nome ?? ''); setIcone(meta?.icone ?? '🎯'); setAlvo(meta?.valorAlvo ?? 0); setInicial(meta?.valorInicial ?? 0)
    setPrazo(meta?.prazo ?? ''); setPrioridade(String(meta?.prioridade ?? 2) as '1' | '2' | '3'); setErro(null)
  }, [aberta, meta])
  async function salvar() {
    try {
      await salvarMeta(db, { nome, icone, valorAlvo: alvo, valorInicial: inicial, prazo: prazo || null, prioridade: Number(prioridade) as 1 | 2 | 3, concluida: meta?.concluida ?? false }, meta)
      mostrarAviso(meta ? 'Meta atualizada' : 'Meta criada'); onFechar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') }
  }
  async function apagar() {
    if (!meta || !window.confirm(`Apagar a meta "${meta.nome}"? Os aportes continuam como lançamentos.`)) return
    await apagarMeta(db, meta.id); mostrarAviso('Meta apagada'); onFechar()
  }
  return (
    <Folha aberta={aberta} titulo={meta ? 'Editar meta' : 'Nova meta'} onFechar={onFechar} acao={<SalvarTopo onClick={() => void salvar()} />}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div role="radiogroup" aria-label="Ícone" className="flex flex-wrap gap-2">
          {ICONES_META.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={icone === i} aria-label={`Ícone ${i}`} onClick={() => setIcone(i)}
              className={`grid h-11 w-11 place-items-center rounded-xl text-xl ring-1 ${icone === i ? 'bg-marca-600 ring-marca-600' : 'bg-white ring-slate-200 dark:bg-superficie-escuro dark:ring-borda-escuro'}`}>{i}</button>
          ))}
        </div>
        <Campo rotulo="Nome" placeholder="Ex.: Viagem para o Chile" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <CampoValor rotulo="Quero juntar" valor={alvo} onMudar={setAlvo} />
          <CampoValor rotulo="Já tenho" valor={inicial} onMudar={setInicial} />
        </div>
        <Campo rotulo="Até quando (opcional)" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        <div>
          <p className="mb-1.5 text-sm font-medium">Prioridade</p>
          <Segmentado rotulo="Prioridade" valor={prioridade} onMudar={setPrioridade} opcoes={[{ valor: '1', rotulo: 'Alta' }, { valor: '2', rotulo: 'Média' }, { valor: '3', rotulo: 'Baixa' }]} />
        </div>
        <Erro texto={erro} />
        <Botao type="submit" className="w-full">Salvar</Botao>
        {meta && <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={() => void apagar()}>Apagar meta</Botao>}
      </form>
    </Folha>
  )
}

export function FolhaAporte({ meta, onFechar }: { meta: Meta | null; onFechar: () => void }) {
  const base = useDadosBase()
  const [valor, setValor] = useState<Centavos>(0)
  const [data, setData] = useState(hojeISO())
  const [retirada, setRetirada] = useState<'aporte' | 'retirada'>('aporte')
  useEffect(() => { if (meta) { setValor(0); setData(hojeISO()); setRetirada('aporte') } }, [meta])
  async function salvar() {
    if (!meta || valor <= 0 || !base?.pessoalId) return
    await registrarAporte(db, meta, valor, data, base.pessoalId, retirada === 'retirada')
    mostrarAviso(retirada === 'aporte' ? `Aporte de ${formatarBRL(valor)} em ${meta.nome}` : `Retirada de ${formatarBRL(valor)} de ${meta.nome}`); onFechar()
  }
  return (
    <Folha aberta={!!meta} titulo={meta ? `${meta.icone} ${meta.nome}` : ''} onFechar={onFechar} acao={<SalvarTopo onClick={() => void salvar()} />}>
      <div className="space-y-3">
        <Segmentado rotulo="Tipo" valor={retirada} onMudar={setRetirada} opcoes={[{ valor: 'aporte', rotulo: 'Guardar' }, { valor: 'retirada', rotulo: 'Retirar' }]} />
        <CampoValor rotulo="Valor" valor={valor} onMudar={setValor} grande foco tom={retirada === 'aporte' ? 'gasto' : 'renda'} />
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        <p className="text-xs text-slate-500 dark:text-slate-400">Vira um lançamento em “Investimentos e trading” na sua conta Pessoal, ligado a esta meta.</p>
        <Botao className="w-full" disabled={valor <= 0} onClick={() => void salvar()}>{retirada === 'aporte' ? 'Guardar' : 'Retirar'}</Botao>
      </div>
    </Folha>
  )
}
