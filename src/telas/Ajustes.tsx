import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/banco'
import { apagarTudo, csvDeLinhas, exportarBackup, restaurarBackup } from '../db/backup'
import { garantirDadosIniciais } from '../db/padroes'
import { formatarData } from '../core/datas'
import { apagarPreferencias, salvarPreferencias, usePreferencias } from '../seguranca/preferencias'
import { biometriaDisponivel, cadastrarBiometria, verificarBiometria } from '../seguranca/bloqueio'
import { Botao, Campo, Grupo, Interruptor, Linha, Segmentado, Tela } from '../ui/componentes'

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Ajustes() {
  const prefs = usePreferencias()
  const [temBiometria, setTemBiometria] = useState<boolean | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [textoApagar, setTextoApagar] = useState('')
  const [taxa, setTaxa] = useState(() => (prefs.taxaRotativoMensal * 100).toLocaleString('pt-BR'))
  const arquivoRef = useRef<HTMLInputElement>(null)
  const nContextos = useLiveQuery(() => db.contextos.filter((c) => !c.arquivado).count(), [])
  const nCategorias = useLiveQuery(() => db.categorias.filter((c) => !c.arquivada).count(), [])

  useEffect(() => { void biometriaDisponivel().then(setTemBiometria) }, [])

  async function alternarBloqueio(ligar: boolean) {
    setMensagem(null)
    try {
      if (ligar) {
        const id = await cadastrarBiometria()
        salvarPreferencias({ bloqueioAtivo: true, credencialId: id })
        setMensagem({ tipo: 'ok', texto: 'Bloqueio ativado. O app vai pedir Face ID ao abrir.' })
      } else {
        if (prefs.credencialId && !(await verificarBiometria(prefs.credencialId))) {
          setMensagem({ tipo: 'erro', texto: 'Confirme com Face ID para desligar o bloqueio.' })
          return
        }
        salvarPreferencias({ bloqueioAtivo: false, credencialId: null })
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível ativar o Face ID neste aparelho.' })
    }
  }

  function salvarTaxa() {
    const n = Number(taxa.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setMensagem({ tipo: 'erro', texto: 'Informe uma taxa entre 0 e 100% ao mês.' })
      return
    }
    salvarPreferencias({ taxaRotativoMensal: n / 100 })
    setMensagem({ tipo: 'ok', texto: 'Taxa do rotativo salva.' })
  }

  async function exportarJSON() {
    const backup = await exportarBackup(db)
    baixar(`financas360-backup-${backup.exportadoEm.slice(0, 10)}.json`, JSON.stringify(backup, null, 1), 'application/json')
  }

  async function exportarCSV() {
    const [lancs, cats, ctxs] = await Promise.all([db.lancamentos.orderBy('data').toArray(), db.categorias.toArray(), db.contextos.toArray()])
    const nomeCat = new Map(cats.map((c) => [c.id, c.nome]))
    const nomeCtx = new Map(ctxs.map((c) => [c.id, c.nome]))
    const csv = csvDeLinhas(
      ['Data', 'Tipo', 'Descrição', 'Valor', 'Categoria', 'Conta', 'Origem'],
      lancs.map((l) => [formatarData(l.data), l.tipo === 'gasto' ? 'Gasto' : 'Entrada', l.descricao,
        (l.valor / 100).toFixed(2).replace('.', ','), nomeCat.get(l.categoriaId ?? '') ?? '', nomeCtx.get(l.contextoId) ?? '', l.origem]),
    )
    baixar('financas360-lancamentos.csv', csv, 'text/csv;charset=utf-8')
  }

  async function importarBackup(arquivo: File) {
    setMensagem(null)
    try {
      const total = await restaurarBackup(db, JSON.parse(await arquivo.text()))
      await garantirDadosIniciais(db)
      setMensagem({ tipo: 'ok', texto: `Backup restaurado: ${total} registros.` })
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Arquivo inválido.' })
    }
  }

  async function apagar() {
    await apagarTudo(db)
    apagarPreferencias()
    await garantirDadosIniciais(db)
    setConfirmarApagar(false)
    setTextoApagar('')
    setMensagem({ tipo: 'ok', texto: 'Todos os dados foram apagados.' })
  }

  return (
    <Tela titulo="Ajustes" voltar={{ rotulo: 'Painel', href: '#/painel' }}>
      {mensagem && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${mensagem.tipo === 'ok'
          ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
          : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200'}`}>{mensagem.texto}</p>
      )}

      <Grupo titulo="Segurança" rodape={temBiometria === false
        ? 'Este navegador não oferece Face ID para sites. No iPhone, abra pelo Safari ou pelo ícone na tela inicial.'
        : 'Pede Face ID, Touch ID ou o código do aparelho ao abrir e ao voltar para o app depois de 30 segundos.'}>
        <Linha icone="🔒" titulo="Bloquear com Face ID">
          <Interruptor rotulo="Bloquear com Face ID" ligado={prefs.bloqueioAtivo} desabilitado={!temBiometria} onMudar={alternarBloqueio} />
        </Linha>
      </Grupo>

      <Grupo titulo="Organização">
        <Linha icone="🗂️" titulo="Contas e negócios" detalhe={nContextos?.toString()} href="#/ajustes/contextos" />
        <Linha icone="🏷️" titulo="Categorias" detalhe={nCategorias?.toString()} href="#/ajustes/categorias" />
      </Grupo>

      <Grupo titulo="Crédito" rodape="Usada quando uma fatura vence sem pagamento e vira dívida no rotativo.">
        <div className="flex items-end gap-2 p-4">
          <div className="flex-1">
            <Campo rotulo="Taxa do rotativo (% ao mês)" inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
          </div>
          <Botao variante="secundario" onClick={salvarTaxa}>Salvar</Botao>
        </div>
      </Grupo>

      <Grupo titulo="Aparência">
        <div className="p-3">
          <Segmentado rotulo="Tema" valor={prefs.tema} onMudar={(tema) => salvarPreferencias({ tema })}
            opcoes={[{ valor: 'sistema', rotulo: 'Automático' }, { valor: 'claro', rotulo: 'Claro' }, { valor: 'escuro', rotulo: 'Escuro' }]} />
        </div>
      </Grupo>

      <Grupo titulo="Seus dados" rodape="Tudo fica só neste aparelho. Faça backup de vez em quando e guarde no iCloud Drive ou no Google Drive.">
        <Linha icone="💾" titulo="Exportar backup (JSON)" onClick={exportarJSON} />
        <Linha icone="📄" titulo="Exportar lançamentos (CSV)" onClick={exportarCSV} />
        <Linha icone="♻️" titulo="Restaurar backup" onClick={() => arquivoRef.current?.click()} />
        <Linha icone="🗑️" titulo="Apagar todos os dados" perigo onClick={() => setConfirmarApagar(true)} />
      </Grupo>
      <input ref={arquivoRef} type="file" accept="application/json,.json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void importarBackup(f); e.target.value = '' }} />

      {confirmarApagar && (
        <div role="alertdialog" aria-labelledby="titulo-apagar" className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200 dark:bg-red-950/60 dark:ring-red-900">
          <h2 id="titulo-apagar" className="font-semibold text-red-900 dark:text-red-200">Apagar tudo?</h2>
          <p className="mt-1 text-sm text-red-900 dark:text-red-200">Lançamentos, cartões, investimentos, metas e ajustes somem deste aparelho. Não dá para desfazer sem um backup.</p>
          <div className="mt-3">
            <Campo rotulo='Digite APAGAR para confirmar' value={textoApagar} onChange={(e) => setTextoApagar(e.target.value)} autoCapitalize="characters" />
          </div>
          <div className="mt-3 flex gap-2">
            <Botao variante="secundario" onClick={() => { setConfirmarApagar(false); setTextoApagar('') }}>Cancelar</Botao>
            <Botao variante="perigo" disabled={textoApagar.trim().toUpperCase() !== 'APAGAR'} onClick={apagar}>Apagar tudo</Botao>
          </div>
        </div>
      )}

      <Grupo titulo="Sobre">
        <Linha icone="📱" titulo="Instalar no iPhone" href="#/ajustes/instalar" />
        <Linha icone="ℹ️" titulo="Versão" detalhe={__VERSAO__} />
      </Grupo>
    </Tela>
  )
}

export function Instalar() {
  return (
    <Tela titulo="Instalar no iPhone" voltar={{ rotulo: 'Ajustes', href: '#/ajustes' }}>
      <ol className="list-decimal space-y-3 rounded-2xl bg-white p-5 pl-9 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        <li>Abra este site no <strong>Safari</strong>.</li>
        <li>Toque no botão <strong>Compartilhar</strong> (quadrado com seta para cima).</li>
        <li>Escolha <strong>Adicionar à Tela de Início</strong> e toque em <strong>Adicionar</strong>.</li>
        <li>Abra o Finanças 360 pelo ícone. Ele roda em tela cheia e funciona sem internet.</li>
      </ol>
      <p className="px-1 text-sm text-slate-600 dark:text-slate-400">
        Use sempre pelo ícone: assim o iPhone mantém seus dados guardados. Abrindo só pelo Safari, o sistema pode apagar dados de sites que ficam muitos dias sem uso.
      </p>
    </Tela>
  )
}
