import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/banco'
import { desfazerImportacao } from '../../db/importacoes'
import type { Importacao } from '../../db/tipos'
import { hojeISO } from '../../core/datas'
import { decodificar } from '../../core/importacao/decodificar'
import { lerOFX, pareceOFX } from '../../core/importacao/ofx'
import { aplicarMapeamento, detectarMapeamento, lerTabela, type MapeamentoCSV, type TabelaCSV } from '../../core/importacao/csv'
import { lerTexto } from '../../core/importacao/texto'
import type { ResultadoLeitura } from '../../core/importacao/tipos'
import { mostrarAviso } from '../../ui/Aviso'
import { Botao, Cartao, Grupo, Tela } from '../../ui/componentes'
import { Mapear } from './Mapear'
import type { SenhaPdfErro } from '../../servicos/pdf'
import { Conferir } from './Conferir'

export type Etapa =
  | { tipo: 'inicio' }
  | { tipo: 'mapear'; nome: string; tabela: TabelaCSV; mapeamento: MapeamentoCSV }
  | { tipo: 'conferir'; nome: string; leitura: ResultadoLeitura }
  | { tipo: 'pronto'; lancados: number; regras: number }

const fmtQuando = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

function descreverErro(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return String(e)
}

export function Importar() {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'inicio' })
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<{ mensagem: string; fracao?: number } | null>(null)
  const [pdfComSenha, setPdfComSenha] = useState<{ nome: string; bytes: Uint8Array; incorreta: boolean } | null>(null)
  const [senha, setSenha] = useState('')
  const arquivoRef = useRef<HTMLInputElement>(null)
  const ultimoArquivo = useRef('')
  const historico = useLiveQuery(() => db.importacoes.orderBy('data').reverse().limit(20).toArray(), [])

  /** Os arquivos são lidos em memória e descartados: só os lançamentos confirmados são salvos. */
  async function lerArquivos(arquivos: File[]) {
    setErro(null)
    setDetalhe(null)
    const lista = arquivos.map((f) => `${f.name} (${f.type || 'sem tipo'}, ${Math.round(f.size / 1024)} KB)`).join(', ')
    ultimoArquivo.current = lista
    const imagens = arquivos.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name))
    if (imagens.length > 0) {
      if (imagens.length !== arquivos.length) { setErro('Escolha só imagens, ou um arquivo de cada vez.'); return }
      await lerImagens(imagens)
      return
    }
    const arquivo = arquivos[0]
    if (!arquivo) return
    const nome = arquivo.name
    if (/\.(xlsx?|ods)$/i.test(nome)) {
      setErro('Planilhas do Excel ainda não são lidas. Abra o arquivo no Numbers ou no Google Planilhas e exporte como CSV.')
      return
    }
    if (arquivo.size > 15_000_000) { setErro('Arquivo grande demais (máximo 15 MB).'); return }
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    if (/\.pdf$/i.test(nome) || arquivo.type === 'application/pdf') {
      await lerPdfArquivo(nome, bytes)
      return
    }
    abrir(nome, decodificar(bytes))
  }

  async function lerPdfArquivo(nome: string, bytes: Uint8Array, senhaInformada?: string) {
    setErro(null)
    setProgresso({ mensagem: 'Abrindo o PDF…' })
    try {
      const { lerPdf, paginasComoImagens } = await import('../../servicos/pdf')
      const pdf = await lerPdf(bytes, senhaInformada)
      setPdfComSenha(null)
      setSenha('')
      let texto = pdf.linhas.join('\n')
      if (!pdf.temTexto) {
        setProgresso({ mensagem: 'PDF escaneado: lendo o texto das páginas…', fracao: 0 })
        const { reconhecerTexto } = await import('../../servicos/ocr')
        texto = await reconhecerTexto(await paginasComoImagens(pdf.documento), (fracao) => setProgresso({ mensagem: 'Lendo o texto das páginas…', fracao }))
      }
      await pdf.fechar()
      abrirTextoLido(nome, texto, pdf.temTexto ? 'pdf' : 'imagem')
    } catch (e) {
      if (e instanceof Error && e.name === 'SenhaPdfErro') {
        setPdfComSenha({ nome, bytes, incorreta: (e as SenhaPdfErro).incorreta })
      } else {
        setErro('Não consegui ler este PDF.')
        setDetalhe(descreverErro(e))
      }
    } finally {
      setProgresso(null)
    }
  }

  async function lerImagens(imagens: File[]) {
    setProgresso({ mensagem: 'Preparando a leitura da imagem…', fracao: 0 })
    try {
      const { reconhecerTexto } = await import('../../servicos/ocr')
      const texto = await reconhecerTexto(imagens, (fracao) => setProgresso({ mensagem: imagens.length > 1 ? `Lendo ${imagens.length} imagens…` : 'Lendo o texto da imagem…', fracao }))
      abrirTextoLido(imagens.length > 1 ? `${imagens.length} imagens` : imagens[0]?.name ?? 'Imagem', texto, 'imagem')
    } catch (e) {
      setErro('Não consegui ler a imagem. Na primeira vez é preciso internet para baixar o leitor de texto (cerca de 5 MB).')
      setDetalhe(descreverErro(e))
    } finally {
      setProgresso(null)
    }
  }

  /** Texto vindo de PDF ou OCR: tenta reconhecer; se nada sair, joga no campo de colar para ajuste. */
  function abrirTextoLido(nome: string, texto: string, formato: 'pdf' | 'imagem') {
    const leitura = lerTexto(texto, hojeISO())
    if (leitura.linhas.length > 0) {
      setEtapa({ tipo: 'conferir', nome, leitura: { ...leitura, formato } })
      return
    }
    setTexto(texto.trim())
    setColando(true)
    setErro('Não reconheci lançamentos nesse arquivo. Coloquei o texto lido no campo abaixo: ajuste as linhas (data no início, valor no fim) e toque em "Ler texto".')
  }

  function abrir(nome: string, conteudo: string) {
    if (pareceOFX(conteudo)) {
      const leitura = lerOFX(conteudo)
      if (leitura.linhas.length === 0) { setErro('Não encontrei transações neste OFX.'); return }
      setEtapa({ tipo: 'conferir', nome, leitura })
      return
    }
    const tabela = lerTabela(conteudo)
    const mapeamento = detectarMapeamento(tabela)
    if (mapeamento) {
      const leitura = aplicarMapeamento(tabela, mapeamento)
      if (leitura.linhas.length > 0) { setEtapa({ tipo: 'conferir', nome, leitura }); return }
    }
    const comoTexto = lerTexto(conteudo, hojeISO())
    if (comoTexto.linhas.length > 0 && (tabela.linhas[0]?.length ?? 0) < 3) { setEtapa({ tipo: 'conferir', nome, leitura: comoTexto }); return }
    if (tabela.linhas.length > 0 && (tabela.linhas[0]?.length ?? 0) >= 2) {
      setEtapa({ tipo: 'mapear', nome, tabela, mapeamento: mapeamento ?? { linhaCabecalho: -1, data: 0, descricao: [1], valor: 2, credito: null, debito: null, positivoEhGasto: false } })
      return
    }
    setErro('Não reconheci o formato. Use OFX, CSV ou cole linhas com data no início e valor no fim.')
  }

  function lerTextoColado() {
    const leitura = lerTexto(texto, hojeISO())
    if (leitura.linhas.length === 0) {
      const tabela = lerTabela(texto)
      if (detectarMapeamento(tabela) || (tabela.linhas[0]?.length ?? 0) >= 3) { abrir('Texto colado', texto); return }
      setErro('Nenhuma linha reconhecida. Cada linha precisa ter a data no início e o valor no fim, como "05/11 IFOOD 45,90".')
      return
    }
    setEtapa({ tipo: 'conferir', nome: 'Texto colado', leitura })
  }

  async function desfazer(imp: Importacao) {
    if (!window.confirm(`Desfazer a importação de "${imp.nomeArquivo}"? Os ${imp.lancamentosGerados} lançamentos criados por ela serão apagados.`)) return
    const n = await desfazerImportacao(db, imp.id)
    mostrarAviso(`Importação desfeita: ${n} ${n === 1 ? 'lançamento apagado' : 'lançamentos apagados'}`)
  }

  function recomecar() {
    setEtapa({ tipo: 'inicio' }); setTexto(''); setColando(false); setErro(null)
  }

  if (etapa.tipo === 'mapear') {
    return <Mapear nome={etapa.nome} tabela={etapa.tabela} inicial={etapa.mapeamento} onCancelar={recomecar}
      onConfirmar={(m) => setEtapa({ tipo: 'conferir', nome: etapa.nome, leitura: aplicarMapeamento(etapa.tabela, m) })} />
  }
  if (etapa.tipo === 'conferir') {
    return <Conferir nome={etapa.nome} leitura={etapa.leitura} onCancelar={recomecar}
      onLancado={(lancados, regras) => setEtapa({ tipo: 'pronto', lancados, regras })} />
  }

  return (
    <Tela titulo="Importar">
      {etapa.tipo === 'pronto' && (
        <div role="status" className="rounded-2xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-900">
          <p className="font-semibold">✓ {etapa.lancados} {etapa.lancados === 1 ? 'lançamento criado' : 'lançamentos criados'}</p>
          {etapa.regras > 0 && <p className="text-sm">{etapa.regras} {etapa.regras === 1 ? 'regra de categoria aprendida' : 'regras de categoria aprendidas'} para as próximas importações.</p>}
          <div className="mt-3 flex gap-2">
            <a href="#/mes" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 font-semibold text-white">Ver no Mês</a>
            <Botao variante="secundario" onClick={recomecar}>Importar outro</Botao>
          </div>
        </div>
      )}

      <Cartao>
        <p className="text-sm text-slate-600 dark:text-slate-400">Extrato da conta ou fatura do cartão em <strong>OFX, CSV, PDF</strong> ou <strong>prints/fotos</strong> (pode escolher várias imagens). Você confere tudo antes de lançar, e o arquivo não fica guardado.</p>
        <div className="mt-3 grid gap-2">
          <Botao onClick={() => arquivoRef.current?.click()} disabled={!!progresso}>Escolher arquivo</Botao>
          <Botao variante="secundario" onClick={() => setColando(!colando)} aria-expanded={colando}>Colar texto</Botao>
        </div>
        <input ref={arquivoRef} type="file" multiple className="hidden"
          accept=".ofx,.qfx,.csv,.txt,.pdf,.xls,.xlsx,text/csv,text/plain,application/pdf,application/x-ofx,image/*"
          onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) void lerArquivos(fs); e.target.value = '' }} />
        {progresso && (
          <div className="mt-3" role="status" aria-live="polite">
            <p className="text-sm">{progresso.mensagem}{progresso.fracao !== undefined ? ` ${Math.round(progresso.fracao * 100)}%` : ''}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className={`h-full rounded-full bg-marca-600 ${progresso.fracao === undefined ? 'w-1/3 animate-pulse' : ''}`}
                style={progresso.fracao !== undefined ? { width: `${Math.max(4, progresso.fracao * 100)}%` } : undefined} />
            </div>
          </div>
        )}
        {pdfComSenha && (
          <form className="mt-3 space-y-2 rounded-xl bg-slate-100 p-3 dark:bg-slate-800"
            onSubmit={(e) => { e.preventDefault(); const s = senha; setSenha(''); void lerPdfArquivo(pdfComSenha.nome, pdfComSenha.bytes, s) }}>
            <label htmlFor="senha-pdf" className="block text-sm font-medium">{pdfComSenha.incorreta ? 'Senha incorreta. Tente de novo:' : `"${pdfComSenha.nome}" tem senha`}</label>
            <input id="senha-pdf" type="password" autoComplete="off" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-borda-escuro dark:bg-slate-900" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Faturas costumam usar parte do CPF. A senha é usada só para abrir o arquivo agora e não fica guardada.</p>
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={() => { setPdfComSenha(null); setSenha('') }}>Cancelar</Botao>
              <Botao type="submit" className="flex-1" disabled={!senha}>Abrir PDF</Botao>
            </div>
          </form>
        )}
        {colando && (
          <div className="mt-3 space-y-2">
            <label htmlFor="texto-colado" className="block text-sm font-medium">Cole as linhas do extrato ou da fatura</label>
            <textarea id="texto-colado" rows={7} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={'05/11 IFOOD *RESTAURANTE 45,90\n06/11 UBER *TRIP 18,40\n07/11 PIX RECEBIDO JOAO 1.200,00 C'}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm dark:border-borda-escuro dark:bg-slate-900" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Sem sinal, o valor conta como gasto. Use "C" no fim ou "-" para indicar o contrário.</p>
            <Botao className="w-full" onClick={lerTextoColado} disabled={!texto.trim()}>Ler texto</Botao>
          </div>
        )}
        {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}
        {detalhe && (
          <details className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            <summary className="cursor-pointer py-1">Detalhe técnico (para me mandar)</summary>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-100 p-2 whitespace-pre-wrap dark:bg-slate-800">{`${detalhe}\nArquivo: ${ultimoArquivo.current}\nNavegador: ${navigator.userAgent}`}</pre>
          </details>
        )}
      </Cartao>

      <details className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        <summary className="cursor-pointer font-semibold">Como tirar o extrato do Santander</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>Entre no <strong>internet banking</strong> pelo navegador (o app costuma oferecer só PDF).</li>
          <li>Abra o <strong>extrato da conta corrente</strong> e escolha o período.</li>
          <li>Procure a opção de <strong>salvar/exportar</strong> e prefira <strong>OFX</strong> (às vezes aparece como "Money"). É o formato mais preciso.</li>
          <li>Se só houver Excel, abra no Numbers ou no Google Planilhas e exporte como <strong>CSV</strong>.</li>
          <li>Salve no app Arquivos do iPhone e escolha aqui.</li>
          <li><strong>Fatura do cartão:</strong> o PDF que chega por e-mail ou fica no app funciona direto. Se tiver senha, o app pede na hora.</li>
          <li><strong>Prints do app:</strong> escolha uma ou várias imagens do extrato. Confira bem: leitura de imagem pode errar.</li>
        </ol>
      </details>

      {historico && historico.length > 0 && (
        <Grupo titulo="Últimas importações" rodape="Desfazer apaga os lançamentos criados por aquela importação. As regras de categoria aprendidas continuam.">
          {historico.map((imp) => (
            <div key={imp.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{imp.nomeArquivo}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{fmtQuando.format(new Date(imp.data))} · {imp.lancamentosGerados} de {imp.linhasLidas} linhas lançadas</span>
              </span>
              <button type="button" onClick={() => void desfazer(imp)} className="min-h-11 px-2 text-sm font-medium text-red-600 dark:text-red-400" aria-label={`Desfazer importação ${imp.nomeArquivo}`}>Desfazer</button>
            </div>
          ))}
        </Grupo>
      )}
    </Tela>
  )
}
