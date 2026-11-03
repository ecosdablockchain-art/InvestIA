import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatarBRL, type Centavos } from '../core/dinheiro'
import { db } from '../db/banco'
import { lerAjustesConta, salvarAjustesConta } from '../db/ajustesConta'
import { salvarDivida } from '../db/credito'
import { salvarInvestimento } from '../db/patrimonio'
import { CampoValor } from '../ui/CampoValor'
import { Botao, Campo, Cartao, Segmentado, Tela } from '../ui/componentes'
import { mostrarAviso } from '../ui/Aviso'

const PARTES = [
  { id: 'moradia', rotulo: 'Moradia (aluguel, condomínio, financiamento)' },
  { id: 'casa', rotulo: 'Contas da casa (luz, água, internet, celular)' },
  { id: 'mercado', rotulo: 'Mercado e alimentação' },
  { id: 'transporte', rotulo: 'Transporte (combustível, app, ônibus)' },
  { id: 'saude', rotulo: 'Saúde e educação' },
  { id: 'outros', rotulo: 'Lazer, compras e outros' },
] as const
type IdParte = (typeof PARTES)[number]['id']

interface DividaRascunho { nome: string; saldo: Centavos; juros: string; parcela: Centavos }
const dividaVazia = (): DividaRascunho => ({ nome: '', saldo: 0, juros: '', parcela: 0 })
const lerJuros = (t: string) => { const n = Number(t.replace('%', '').replace(',', '.').trim()); return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : null }

/** Questionário de boas-vindas: 4 perguntas para os Insights funcionarem desde o primeiro dia. */
export function BoasVindas() {
  const [passo, setPasso] = useState(0)
  const [renda, setRenda] = useState<Centavos>(0)
  const [rendaVaria, setRendaVaria] = useState<'fixa' | 'varia'>('fixa')
  const [partes, setPartes] = useState<Record<IdParte, Centavos>>({ moradia: 0, casa: 0, mercado: 0, transporte: 0, saude: 0, outros: 0 })
  const [temDivida, setTemDivida] = useState<'nao' | 'sim'>('nao')
  const [dividas, setDividas] = useState<DividaRascunho[]>([dividaVazia()])
  const [reserva, setReserva] = useState<Centavos>(0)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const existentes = useLiveQuery(() => db.dividas.filter((d) => d.saldo > 0).toArray(), [])
  const reservasExistentes = useLiveQuery(() => db.investimentos.filter((i) => i.classe === 'reserva').toArray(), [])

  // revisitando: traz as respostas anteriores
  useEffect(() => {
    void lerAjustesConta().then((a) => {
      const pf = a.perfilFinanceiro
      if (!pf) return
      setRenda(pf.rendaMensal)
      setRendaVaria(pf.rendaVaria ? 'varia' : 'fixa')
      setPartes((p) => ({ ...p, ...(pf.partesGasto ?? { outros: pf.gastoMensal }) }))
    })
  }, [])

  const gasto = Object.values(partes).reduce((a, b) => a + b, 0)
  const reservaJaRegistrada = (reservasExistentes?.length ?? 0) > 0
  const totalReservaRegistrada = reservasExistentes?.reduce((a, i) => a + i.valorAtual, 0) ?? 0

  function validar(): string | null {
    if (passo === 0 && renda <= 0) return 'Informe quanto você recebe por mês (um valor aproximado já ajuda).'
    if (passo === 1 && gasto <= 0) return 'Preencha pelo menos um dos gastos.'
    if (passo === 2 && temDivida === 'sim') {
      for (const d of dividas) {
        const vazia = !d.nome.trim() && !d.saldo && !d.juros && !d.parcela
        if (vazia) continue
        if (!d.nome.trim()) return 'Dê um nome a cada dívida (ex.: Empréstimo do banco).'
        if (d.saldo <= 0) return `Informe quanto falta pagar de "${d.nome}".`
        if (lerJuros(d.juros) === null) return `Informe os juros ao mês de "${d.nome}" (ex.: 3,5). Se não souber, use 3.`
      }
    }
    return null
  }

  function avancar() {
    const e = validar()
    setErro(e)
    if (!e) setPasso((p) => p + 1)
  }

  async function concluir() {
    const e = validar()
    if (e) { setErro(e); return }
    setSalvando(true)
    try {
      await salvarAjustesConta({
        perfilFinanceiro: { rendaMensal: renda, rendaVaria: rendaVaria === 'varia', gastoMensal: gasto, partesGasto: partes, respondidoEm: new Date().toISOString() },
        boasVindasVistas: true,
      })
      if (temDivida === 'sim') {
        for (const d of dividas) {
          if (!d.nome.trim() || d.saldo <= 0) continue
          await salvarDivida(db, { nome: d.nome, saldo: d.saldo, jurosMensal: lerJuros(d.juros) ?? 0, parcela: d.parcela, parcelasRestantes: null })
        }
      }
      if (!reservaJaRegistrada && reserva > 0) {
        await salvarInvestimento(db, { nome: 'Reserva de emergência', classe: 'reserva', instituicao: '', aplicado: reserva, valorAtual: reserva, liquidez: 'diaria', diasParaResgate: null, vencimento: null })
      }
      mostrarAviso('Pronto! Seu plano está nos Insights.')
      window.location.hash = '#/insights'
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar agora.')
    } finally {
      setSalvando(false)
    }
  }

  async function pular() {
    await salvarAjustesConta({ boasVindasVistas: true })
    window.location.hash = '#/painel'
  }

  const titulos = ['Quanto você recebe?', 'Quanto você gasta?', 'Você tem dívidas?', 'Quanto você já tem guardado?']

  return (
    <Tela titulo="Vamos começar" subtitulo="4 perguntas rápidas para montar o seu plano. Valores aproximados já ajudam.">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>Passo {passo + 1} de 4</span>
          <button type="button" onClick={() => void pular()} className="min-h-8 text-marca-600 dark:text-marca-100">Pular por enquanto</button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Progresso" aria-valuemin={1} aria-valuemax={4} aria-valuenow={passo + 1}>
          <div className="h-full rounded-full bg-marca-600 transition-[width]" style={{ width: `${((passo + 1) / 4) * 100}%` }} />
        </div>
      </div>

      <Cartao titulo={titulos[passo]}>
        <div className="space-y-4">
          {passo === 0 && (
            <>
              <CampoValor rotulo="Quanto entra por mês, já descontado (líquido)" valor={renda} onMudar={setRenda} foco tom="renda" />
              <div>
                <p className="mb-1.5 text-sm font-medium">Sua renda é</p>
                <Segmentado rotulo="Tipo de renda" valor={rendaVaria} onMudar={setRendaVaria}
                  opcoes={[{ valor: 'fixa', rotulo: 'Fixa (salário)' }, { valor: 'varia', rotulo: 'Varia (autônomo, comissão)' }]} />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Com renda que varia, o ideal é uma reserva maior (12 meses em vez de 6).</p>
              </div>
            </>
          )}

          {passo === 1 && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">Preencha só o que tiver. Uma média mensal aproximada é suficiente.</p>
              {PARTES.map((p) => (
                <CampoValor key={p.id} rotulo={p.rotulo} valor={partes[p.id]} onMudar={(v) => setPartes((x) => ({ ...x, [p.id]: v }))} />
              ))}
              <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 dark:border-borda-escuro">
                <span className="font-medium">Total por mês</span>
                <span className="numeros text-lg font-semibold">{formatarBRL(gasto)}</span>
              </div>
              {renda > 0 && gasto > 0 && (
                <p className={`text-sm ${renda - gasto < 0 ? 'text-negativo dark:text-negativo-escuro' : 'text-slate-600 dark:text-slate-400'}`}>
                  {renda - gasto >= 0 ? `Sobram cerca de ${formatarBRL(renda - gasto)} por mês.` : `Faltam cerca de ${formatarBRL(gasto - renda)} por mês.`}
                </p>
              )}
            </>
          )}

          {passo === 2 && (
            <>
              {existentes && existentes.length > 0 && (
                <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                  Já cadastradas: {existentes.map((d) => `${d.nome} (${formatarBRL(d.saldo)})`).join(', ')}. Adicione aqui só as que faltarem.
                </p>
              )}
              <Segmentado rotulo="Tem dívidas?" valor={temDivida} onMudar={setTemDivida}
                opcoes={[{ valor: 'nao', rotulo: existentes?.length ? 'Nenhuma outra' : 'Não tenho' }, { valor: 'sim', rotulo: 'Sim, tenho' }]} />
              {temDivida === 'sim' && (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Empréstimos, financiamentos, cartão parcelado ou no rotativo, cheque especial. Os juros aparecem no app ou no contrato do banco.</p>
                  {dividas.map((d, k) => {
                    const mudar = (m: Partial<DividaRascunho>) => setDividas((l) => l.map((x, j) => (j === k ? { ...x, ...m } : x)))
                    return (
                      <fieldset key={k} className="space-y-3 rounded-2xl p-3 ring-1 ring-slate-200 dark:ring-borda-escuro">
                        <legend className="px-1 text-sm font-semibold">Dívida {k + 1}</legend>
                        <Campo rotulo="Nome" placeholder="Ex.: Empréstimo do banco" value={d.nome} onChange={(e) => mudar({ nome: e.target.value })} />
                        <CampoValor rotulo="Quanto falta pagar" valor={d.saldo} onMudar={(saldo) => mudar({ saldo })} />
                        <div className="grid grid-cols-2 gap-3">
                          <Campo rotulo="Juros ao mês (%)" inputMode="decimal" placeholder="Ex.: 3,5" value={d.juros} onChange={(e) => mudar({ juros: e.target.value })} />
                          <CampoValor rotulo="Parcela por mês" valor={d.parcela} onMudar={(parcela) => mudar({ parcela })} />
                        </div>
                        {dividas.length > 1 && (
                          <button type="button" className="min-h-9 text-sm text-red-600 dark:text-red-400" onClick={() => setDividas((l) => l.filter((_, j) => j !== k))}>Remover</button>
                        )}
                      </fieldset>
                    )
                  })}
                  {dividas.length < 5 && (
                    <Botao variante="secundario" className="w-full" onClick={() => setDividas((l) => [...l, dividaVazia()])}>+ Adicionar outra dívida</Botao>
                  )}
                </>
              )}
            </>
          )}

          {passo === 3 && (
            reservaJaRegistrada ? (
              <p className="text-sm">Sua reserva já está registrada no Patrimônio: <strong className="numeros">{formatarBRL(totalReservaRegistrada)}</strong>. Para mudar, edite por lá.</p>
            ) : (
              <>
                <CampoValor rotulo="Guardado com resgate imediato" valor={reserva} onMudar={setReserva} foco />
                <p className="text-xs text-slate-500 dark:text-slate-400">Poupança, conta remunerada, CDB de liquidez diária ou Tesouro Selic. Não conte ações, previdência ou dinheiro que você não pode sacar hoje. Se não tiver, deixe zerado.</p>
              </>
            )
          )}

          {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}

          <div className="flex gap-3 pt-1">
            {passo > 0 && <Botao variante="secundario" className="flex-1" onClick={() => { setErro(null); setPasso((p) => p - 1) }}>Voltar</Botao>}
            {passo < 3
              ? <Botao className="flex-1" onClick={avancar}>Continuar</Botao>
              : <Botao className="flex-1" disabled={salvando} onClick={() => void concluir()}>{salvando ? 'Salvando…' : 'Ver meu plano'}</Botao>}
          </div>
        </div>
      </Cartao>
    </Tela>
  )
}
