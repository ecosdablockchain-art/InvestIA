import { useEffect, useState } from 'react'
import { db } from '../../db/banco'
import { apagarCartao, informarValorFatura, salvarCartao, salvarDivida, salvarParcelado, type DadosCartao } from '../../db/credito'
import type { Cartao, CompraParcelada, Divida } from '../../db/tipos'
import { competenciaDaFatura, parcelasDe } from '../../core/credito'
import { formatarBRL, type Centavos } from '../../core/dinheiro'
import { hojeISO, nomeCompetencia, somarMeses, type Competencia } from '../../core/datas'
import { jurosAnual } from '../../core/dividas'
import { CampoValor } from '../../ui/CampoValor'
import { Folha } from '../../ui/Folha'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, Campo } from '../../ui/componentes'
import { CORES_CARTAO, lerPct, pct } from './comum'

const Erro = ({ texto }: { texto: string | null }) => (texto ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{texto}</p> : null)
const dia = (t: string) => Number(t.replace(/\D/g, '').slice(0, 2)) || 0

export function FolhaCartao({ aberta, cartao, onFechar, onSalvo }: { aberta: boolean; cartao?: Cartao; onFechar: () => void; onSalvo: (c: Cartao) => void }) {
  const vazio: DadosCartao = { apelido: '', banco: '', limite: 0, diaFechamento: 0, diaVencimento: 0, cor: CORES_CARTAO[0] ?? '#c8102e' }
  const [d, setD] = useState<DadosCartao>(vazio)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (aberta) { setD(cartao ? { apelido: cartao.apelido, banco: cartao.banco, limite: cartao.limite, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento, cor: cartao.cor } : vazio); setErro(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, cartao])
  async function salvar() {
    try { const c = await salvarCartao(db, d, cartao); mostrarAviso(cartao ? 'Cartão atualizado' : 'Cartão cadastrado'); onSalvo(c); onFechar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') }
  }
  async function apagar() {
    if (!cartao || !window.confirm(`Apagar o cartão ${cartao.apelido}? As compras parceladas e as faturas dele somem; os lançamentos continuam, sem o cartão.`)) return
    await apagarCartao(db, cartao.id); mostrarAviso('Cartão apagado'); onFechar()
  }
  return (
    <Folha aberta={aberta} titulo={cartao ? 'Editar cartão' : 'Novo cartão'} onFechar={onFechar}
      acao={<button type="button" onClick={salvar} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <Campo rotulo="Apelido" placeholder="Ex.: Santander Platinum" value={d.apelido} onChange={(e) => setD({ ...d, apelido: e.target.value })} data-foco="" />
        <Campo rotulo="Banco" placeholder="Ex.: Santander" value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })} />
        <CampoValor rotulo="Limite" valor={d.limite} onMudar={(limite) => setD({ ...d, limite })} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia do fechamento" inputMode="numeric" value={d.diaFechamento || ''} onChange={(e) => setD({ ...d, diaFechamento: dia(e.target.value) })} />
          <Campo rotulo="Dia do vencimento" inputMode="numeric" value={d.diaVencimento || ''} onChange={(e) => setD({ ...d, diaVencimento: dia(e.target.value) })} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Compras a partir do dia do fechamento entram na fatura seguinte. Não guardamos número do cartão nem CVV.</p>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Cor</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor do cartão">
            {CORES_CARTAO.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={d.cor === c} aria-label={`Cor ${c}`} onClick={() => setD({ ...d, cor: c })}
                className={`h-10 w-10 rounded-full ring-offset-2 ${d.cor === c ? 'ring-2 ring-marca-600' : ''}`} style={{ background: c }} />
            ))}
          </div>
        </fieldset>
        <Erro texto={erro} />
        <Botao type="submit" className="w-full">Salvar cartão</Botao>
        {cartao && <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={() => void apagar()}>Apagar cartão</Botao>}
      </form>
    </Folha>
  )
}

export function FolhaParcelado({ aberta, cartao, parcelado, onFechar }: { aberta: boolean; cartao: Cartao | undefined; parcelado?: CompraParcelada; onFechar: () => void }) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<Centavos>(0)
  const [n, setN] = useState('10')
  const [primeira, setPrimeira] = useState<Competencia>(0)
  const [erro, setErro] = useState<string | null>(null)
  const sugestao = cartao ? competenciaDaFatura(hojeISO(), cartao) : 0
  useEffect(() => {
    if (!aberta) return
    setDescricao(parcelado?.descricao ?? ''); setValor(parcelado?.valorTotal ?? 0)
    setN(String(parcelado?.numeroParcelas ?? 10)); setPrimeira(parcelado?.primeiraCompetencia ?? sugestao); setErro(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, parcelado])
  if (!cartao) return null
  const numero = Number(n) || 0
  const parcelas = numero >= 2 && valor > 0 ? parcelasDe({ id: '', cartaoId: '', descricao: '', valorTotal: valor, numeroParcelas: numero, primeiraCompetencia: primeira }) : []
  async function salvar() {
    try {
      await salvarParcelado(db, { cartaoId: cartao!.id, descricao, valorTotal: valor, numeroParcelas: numero, primeiraCompetencia: primeira }, parcelado)
      mostrarAviso(parcelado ? 'Compra atualizada' : 'Compra parcelada cadastrada'); onFechar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') }
  }
  async function apagar() {
    if (!parcelado || !window.confirm(`Apagar "${parcelado.descricao}"? As parcelas saem das faturas.`)) return
    await db.parcelados.delete(parcelado.id); mostrarAviso('Compra parcelada apagada'); onFechar()
  }
  const meses = Array.from({ length: 18 }, (_, i) => somarMeses(sugestao, i - 6))
  return (
    <Folha aberta={aberta} titulo={parcelado ? 'Editar compra parcelada' : 'Compra parcelada'} onFechar={onFechar}
      acao={<button type="button" onClick={salvar} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <CampoValor rotulo="Valor total da compra" valor={valor} onMudar={setValor} grande foco={!parcelado} tom="gasto" />
        <Campo rotulo="Descrição" placeholder="Ex.: Geladeira" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Parcelas" inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium">1ª parcela na fatura de</span>
            <select value={primeira} onChange={(e) => setPrimeira(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-borda-escuro dark:bg-slate-900">
              {meses.map((m) => <option key={m} value={m}>{nomeCompetencia(m)}</option>)}
            </select>
          </label>
        </div>
        {parcelas.length > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {parcelas.length}× de <strong className="numeros">{formatarBRL(parcelas[parcelas.length - 1]!.valor)}</strong>
            {parcelas[0]!.valor !== parcelas[parcelas.length - 1]!.valor ? ` (a 1ª de ${formatarBRL(parcelas[0]!.valor)})` : ''}, até {nomeCompetencia(parcelas[parcelas.length - 1]!.competencia)}.
          </p>
        )}
        <Erro texto={erro} />
        <Botao type="submit" className="w-full">Salvar</Botao>
        {parcelado && <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={() => void apagar()}>Apagar compra parcelada</Botao>}
      </form>
    </Folha>
  )
}

export function FolhaValorFatura({ aberta, cartao, competencia, projetado, informado, onFechar }: {
  aberta: boolean; cartao: Cartao | undefined; competencia: Competencia; projetado: Centavos; informado: Centavos | null; onFechar: () => void
}) {
  const [valor, setValor] = useState<Centavos>(0)
  useEffect(() => { if (aberta) setValor(informado ?? projetado) }, [aberta, informado, projetado])
  if (!cartao) return null
  async function salvar(v: Centavos | null) {
    await informarValorFatura(db, cartao!.id, competencia, v)
    mostrarAviso(v === null ? 'Voltou a usar a projeção' : 'Valor da fatura salvo'); onFechar()
  }
  return (
    <Folha aberta={aberta} titulo={`Fatura de ${nomeCompetencia(competencia)}`} onFechar={onFechar}
      acao={<button type="button" onClick={() => void salvar(valor)} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>}>
      <div className="space-y-3">
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">Qual o valor fechado da fatura, como está no app do banco?</p>
        <CampoValor rotulo="Valor da fatura" valor={valor} onMudar={setValor} grande foco />
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">Projeção pelas suas compras e parcelas: {formatarBRL(projetado)}</p>
        <Botao className="w-full" onClick={() => void salvar(valor)}>Salvar valor</Botao>
        {informado !== null && <Botao variante="secundario" className="w-full" onClick={() => void salvar(null)}>Usar a projeção</Botao>}
      </div>
    </Folha>
  )
}

export function FolhaDivida({ aberta, divida, onFechar }: { aberta: boolean; divida?: Divida; onFechar: () => void }) {
  const [nome, setNome] = useState('')
  const [saldo, setSaldo] = useState<Centavos>(0)
  const [juros, setJuros] = useState('')
  const [parcela, setParcela] = useState<Centavos>(0)
  const [restantes, setRestantes] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (!aberta) return
    setNome(divida?.nome ?? ''); setSaldo(divida?.saldo ?? 0)
    setJuros(divida ? (divida.jurosMensal * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '')
    setParcela(divida?.parcela ?? 0); setRestantes(divida?.parcelasRestantes ? String(divida.parcelasRestantes) : ''); setErro(null)
  }, [aberta, divida])
  const j = lerPct(juros)
  async function salvar() {
    if (j === null) { setErro('Informe os juros ao mês (ex.: 2,99).'); return }
    try {
      await salvarDivida(db, { nome, saldo, jurosMensal: j, parcela, parcelasRestantes: Number(restantes) || null }, divida)
      mostrarAviso(divida ? 'Dívida atualizada' : 'Dívida cadastrada'); onFechar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') }
  }
  async function apagar() {
    if (!divida || !window.confirm(`Apagar "${divida.nome}"?`)) return
    await db.dividas.delete(divida.id); mostrarAviso('Dívida apagada'); onFechar()
  }
  return (
    <Folha aberta={aberta} titulo={divida ? 'Editar dívida' : 'Nova dívida'} onFechar={onFechar}
      acao={<button type="button" onClick={salvar} className="min-h-11 px-1 font-semibold text-marca-600 dark:text-marca-100">Salvar</button>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <Campo rotulo="Nome" placeholder="Ex.: Empréstimo pessoal" value={nome} onChange={(e) => setNome(e.target.value)} data-foco="" />
        <CampoValor rotulo="Quanto falta pagar (saldo devedor)" valor={saldo} onMudar={setSaldo} />
        <Campo rotulo="Juros ao mês (%)" inputMode="decimal" placeholder="Ex.: 2,99" value={juros} onChange={(e) => setJuros(e.target.value)}
          dica={j !== null && j > 0 ? `Equivale a ${pct(jurosAnual(j), 1)} ao ano.` : 'Está no contrato ou no app do banco (taxa mensal).'} />
        <CampoValor rotulo="Parcela por mês" valor={parcela} onMudar={setParcela} />
        <Campo rotulo="Parcelas restantes (opcional)" inputMode="numeric" value={restantes} onChange={(e) => setRestantes(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        <Erro texto={erro} />
        <Botao type="submit" className="w-full">Salvar</Botao>
        {divida && <Botao variante="secundario" className="w-full text-red-600 dark:text-red-400" onClick={() => void apagar()}>Apagar dívida</Botao>}
      </form>
    </Folha>
  )
}
