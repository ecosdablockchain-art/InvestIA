import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/banco'
import { apagarTudo, csvDeLinhas, exportarBackup, restaurarBackup } from '../db/backup'
import { garantirDadosIniciais } from '../db/padroes'
import { formatarData } from '../core/datas'
import { apagarPreferencias, salvarPreferencias, usePreferencias } from '../seguranca/preferencias'
import { biometriaDisponivel, cadastrarBiometria, verificarBiometria } from '../seguranca/bloqueio'
import { Botao, Campo, Grupo, Interruptor, Linha, Segmentado, Tela } from '../ui/componentes'
import Dexie from 'dexie'
import { supabase } from '../nuvem/cliente'
import { sincronizarAgora, temPendencias, useEstadoSinc } from '../nuvem/estado'
import { useSessao } from '../conta/sessao'
import { procurarAtualizacao } from '../ui/Atualizacao'
import { salvarAjustesConta, useAjustesConta } from '../db/ajustesConta'

const mostrarAvisoChave = () => { void import('../ui/Aviso').then((m) => m.mostrarAviso('Chave salva na sua conta')) }

const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/** Sai da conta e apaga a cópia local deste aparelho (os dados continuam na nuvem). */
async function sairDaConta(): Promise<boolean> {
  const ok = await sincronizarAgora()
  if (!ok && (await temPendencias(db)) && !window.confirm('Algumas alterações deste aparelho ainda não foram para a nuvem e serão perdidas. Sair mesmo assim?')) return false
  const nome = db.name
  db.close()
  await Dexie.delete(nome)
  apagarPreferencias()
  await supabase?.auth.signOut()
  window.location.hash = '#/'
  return true
}

function SecaoConta() {
  const sessao = useSessao()
  const sinc = useEstadoSinc()
  const email = sessao.tipo === 'logado' ? sessao.usuario.email : ''
  const situacao = {
    parado: 'Sincronização parada',
    sincronizando: 'Sincronizando…',
    ok: sinc.ultima ? `Sincronizado às ${fmtHora.format(new Date(sinc.ultima))}` : 'Sincronizado',
    offline: 'Sem internet: as alterações sobem quando reconectar',
    erro: 'Não foi possível sincronizar agora',
  }[sinc.situacao]
  return (
    <Grupo titulo="Conta" rodape={sinc.situacao === 'erro' && sinc.erro ? `Detalhe: ${sinc.erro}` : 'Seus dados ficam na sua conta e aparecem em qualquer aparelho em que você entrar. Este aparelho guarda uma cópia para funcionar sem internet.'}>
      <Linha icone="👤" titulo={email} />
      <Linha icone={sinc.situacao === 'ok' ? '✅' : sinc.situacao === 'sincronizando' ? '🔄' : sinc.situacao === 'offline' ? '📴' : '⚠️'} titulo={situacao}>
        <button type="button" className="min-h-11 px-2 text-sm font-medium text-marca-600 dark:text-marca-100" disabled={sinc.situacao === 'sincronizando'}
          onClick={() => void sincronizarAgora()}>Sincronizar</button>
      </Linha>
      <Linha icone="🚪" titulo="Sair" onClick={() => void sairDaConta()} />
    </Grupo>
  )
}

export function ExcluirConta() {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  async function excluir() {
    if (!supabase) return
    setExcluindo(true); setErro(null)
    const { error } = await supabase.rpc('excluir_minha_conta')
    if (error) { setErro(`Não foi possível excluir agora (${error.message}). Verifique a internet e tente de novo.`); setExcluindo(false); return }
    const nome = db.name
    db.close()
    await Dexie.delete(nome)
    apagarPreferencias()
    await supabase.auth.signOut()
    window.location.hash = '#/'
  }
  return (
    <Tela titulo="Excluir conta" voltar={{ rotulo: 'Ajustes', href: '#/ajustes' }}>
      <div className="space-y-3 rounded-2xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-100 dark:ring-red-900">
        <p className="font-semibold">Isto apaga sua conta e todos os seus dados, em todos os aparelhos. Não dá para desfazer.</p>
        <p className="text-sm">Se quiser guardar uma cópia, volte e use "Exportar backup" antes.</p>
        <Campo rotulo="Digite EXCLUIR para confirmar" value={texto} onChange={(e) => setTexto(e.target.value)} autoCapitalize="characters" />
        {erro && <p role="alert" className="text-sm">{erro}</p>}
        <Botao variante="perigo" className="w-full" disabled={texto.trim().toUpperCase() !== 'EXCLUIR' || excluindo} onClick={() => void excluir()}>
          {excluindo ? 'Excluindo…' : 'Excluir minha conta e meus dados'}
        </Botao>
      </div>
    </Tela>
  )
}

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
  const ajustes = useAjustesConta()
  const [chave, setChave] = useState<string | null>(null)
  const [taxa, setTaxa] = useState<string | null>(null)
  const chaveMostrada = chave ?? ajustes?.chaveCotacao ?? ''
  const taxaMostrada = taxa ?? (ajustes ? (ajustes.taxaRotativoMensal * 100).toLocaleString('pt-BR') : '')
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
    const n = Number(taxaMostrada.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setMensagem({ tipo: 'erro', texto: 'Informe uma taxa entre 0 e 100% ao mês.' })
      return
    }
    void salvarAjustesConta({ taxaRotativoMensal: n / 100 }); setTaxa(null)
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

      <SecaoConta />

      <Grupo titulo="Segurança" rodape={temBiometria === false
        ? 'Este navegador não oferece desbloqueio por biometria para sites.'
        : 'Pede Face ID, digital, Windows Hello ou o código do aparelho ao abrir e ao voltar para o app depois de 30 segundos. Vale só para este aparelho.'}>
        <Linha icone="🔒" titulo="Bloquear com biometria">
          <Interruptor rotulo="Bloquear com biometria" ligado={prefs.bloqueioAtivo} desabilitado={!temBiometria} onMudar={alternarBloqueio} />
        </Linha>
      </Grupo>

      <Grupo titulo="Organização">
        <Linha icone="🗂️" titulo="Contas e negócios" detalhe={nContextos?.toString()} href="#/ajustes/contextos" />
        <Linha icone="🏷️" titulo="Categorias" detalhe={nCategorias?.toString()} href="#/ajustes/categorias" />
      </Grupo>

      <Grupo titulo="Crédito" rodape="Usada quando uma fatura vence sem pagamento e vira dívida no rotativo.">
        <div className="flex items-end gap-2 p-4">
          <div className="flex-1">
            <Campo rotulo="Taxa do rotativo (% ao mês)" inputMode="decimal" value={taxaMostrada} onChange={(e) => setTaxa(e.target.value)} />
          </div>
          <Botao variante="secundario" onClick={salvarTaxa}>Salvar</Botao>
        </div>
      </Grupo>

      {ajustes && <Grupo titulo="Investimentos" rodape={ajustes.fonteCotacao === 'brapi'
        ? 'brapi.dev: crie uma conta grátis e copie o token em brapi.dev/dashboard. Sem token, só alguns ativos de teste funcionam.'
        : 'Alpha Vantage: peça uma chave grátis em alphavantage.co (limite de 25 consultas por dia).'} >
        <div className="space-y-3 p-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Seu perfil de investidor</p>
            <Segmentado rotulo="Perfil" valor={ajustes.perfil} onMudar={(perfil) => void salvarAjustesConta({ perfil })}
              opcoes={[{ valor: 'conservador', rotulo: 'Conservador' }, { valor: 'moderado', rotulo: 'Moderado' }, { valor: 'arrojado', rotulo: 'Arrojado' }]} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Fonte das cotações</p>
            <Segmentado rotulo="Fonte das cotações" valor={ajustes.fonteCotacao} onMudar={(fonteCotacao) => void salvarAjustesConta({ fonteCotacao })}
              opcoes={[{ valor: 'brapi', rotulo: 'brapi.dev' }, { valor: 'alphavantage', rotulo: 'Alpha Vantage' }]} />
          </div>
          <Campo rotulo="Chave da API de cotações" type="password" autoComplete="off" value={chaveMostrada} onChange={(e) => setChave(e.target.value)}
            onBlur={() => { if (chave !== null) { void salvarAjustesConta({ chaveCotacao: chave.trim() }); setChave(null); mostrarAvisoChave() } }}
            dica="Fica na sua conta: vale em todos os aparelhos em que você entrar." />
        </div>
      </Grupo>}

      <Grupo titulo="Aparência">
        <div className="p-3">
          <Segmentado rotulo="Tema" valor={prefs.tema} onMudar={(tema) => salvarPreferencias({ tema })}
            opcoes={[{ valor: 'sistema', rotulo: 'Automático' }, { valor: 'claro', rotulo: 'Claro' }, { valor: 'escuro', rotulo: 'Escuro' }]} />
        </div>
      </Grupo>

      <Grupo titulo="Seus dados" rodape="O backup é um arquivo com todos os seus dados, para guardar onde quiser. Apagar tudo vale para a conta inteira, em todos os aparelhos.">
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
          <p className="mt-1 text-sm text-red-900 dark:text-red-200">Lançamentos, cartões, investimentos e metas somem da sua conta, em todos os aparelhos. A conta continua existindo. Não dá para desfazer sem um backup.</p>
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
        <Linha icone="📱" titulo="Instalar no celular" href="#/ajustes/instalar" />
        <Linha icone="🔒" titulo="Privacidade" href="#/privacidade" />
        <Linha icone="📄" titulo="Termos de uso" href="#/termos" />
        <Linha icone="🗑️" titulo="Excluir minha conta" perigo href="#/ajustes/excluir-conta" />
        <Linha icone="ℹ️" titulo="Versão" detalhe={__VERSAO__} />
        <Linha icone="🔄" titulo="Procurar atualização" onClick={() => { procurarAtualizacao(); setMensagem({ tipo: 'ok', texto: 'Procurando… se houver versão nova, aparece um aviso azul no topo.' }) }} />
      </Grupo>
    </Tela>
  )
}

export function Instalar() {
  return (
    <Tela titulo="Instalar no celular" voltar={{ rotulo: 'Ajustes', href: '#/ajustes' }}>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        <h2 className="font-semibold">iPhone</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Abra este site no <strong>Safari</strong>.</li>
          <li>Toque em <strong>Compartilhar</strong> (quadrado com seta) › <strong>Adicionar à Tela de Início</strong>.</li>
        </ol>
      </section>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        <h2 className="font-semibold">Android</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Abra este site no <strong>Chrome</strong>.</li>
          <li>Toque no menu <strong>⋮</strong> › <strong>Instalar app</strong> (ou "Adicionar à tela inicial").</li>
        </ol>
      </section>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 dark:bg-superficie-escuro dark:ring-borda-escuro">
        <h2 className="font-semibold">Computador</h2>
        <p className="mt-2">Funciona em qualquer navegador. No Chrome ou Edge, o ícone de instalar aparece na barra de endereço.</p>
      </section>
      <p className="px-1 text-sm text-slate-600 dark:text-slate-400">Entrando com o mesmo e-mail, seus dados aparecem em todos os aparelhos.</p>
    </Tela>
  )
}
