import { useEffect, useState } from 'react'
import { abrirBancoDoUsuario, db } from '../db/banco'
import { garantirDadosIniciais } from '../db/padroes'
import { trazerAjustesDoAparelho } from '../db/ajustesConta'
import { useRota } from '../rotas'
import { nuvemConfigurada, supabase } from '../nuvem/cliente'
import { servidorSupabase } from '../nuvem/supabaseServidor'
import { iniciarSincronizacao } from '../nuvem/estado'
import { sincronizar } from '../nuvem/sincronizacao'
import { App, useTema } from '../App'
import { usePreferencias } from '../seguranca/preferencias'
import { Botao } from '../ui/componentes'
import { AvisoAtualizacao } from '../ui/Atualizacao'
import { useSessao, type Usuario } from './sessao'
import { TelaConta, TelaNovaSenha } from './TelaConta'
import { Privacidade, Termos } from './Legal'
import { legadoJaResolvido, marcarLegado, procurarLegado, trazerLegado, type Legado } from './legado'

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="pt-seguro mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">{children}</main>
}

/** Porta de entrada: páginas públicas, login, e só depois o app com o banco de quem entrou. */
export function Entrada() {
  return <><AvisoAtualizacao /><Conteudo /></>
}

function Conteudo() {
  const prefs = usePreferencias()
  useTema(prefs.tema)
  const rota = useRota()
  const sessao = useSessao()
  if (rota === 'termos') return <Termos />
  if (rota === 'privacidade') return <Privacidade />
  if (!nuvemConfigurada) {
    return (
      <Centro>
        <h1 className="text-xl font-bold">Finanças 360</h1>
        <p className="text-slate-600 dark:text-slate-400">O servidor de contas ainda não foi configurado nesta versão do site.</p>
      </Centro>
    )
  }
  if (sessao.tipo === 'carregando') return <Centro><p className="text-slate-500">Carregando…</p></Centro>
  if (sessao.tipo === 'sem-conta') return <TelaConta />
  if (sessao.tipo === 'nova-senha') return <TelaNovaSenha onConcluir={() => { window.location.hash = '#/painel' }} />
  return <AreaLogada key={sessao.usuario.id} usuario={sessao.usuario} />
}

type Preparo = { tipo: 'abrindo' } | { tipo: 'sem-internet' } | { tipo: 'legado'; legado: Legado } | { tipo: 'pronto' }

function AreaLogada({ usuario }: { usuario: Usuario }) {
  const [preparo, setPreparo] = useState<Preparo>({ tipo: 'abrindo' })
  const [tentativa, setTentativa] = useState(0)
  const [trazendo, setTrazendo] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let parar: (() => void) | null = null
    let ativo = true
    const banco = abrirBancoDoUsuario(usuario.id)
    const servidor = servidorSupabase(supabase)
    void (async () => {
      // Aparelho novo para esta conta: primeiro baixa o que já existe na nuvem.
      const jaTemDados = (await banco._meta.get('cursorRecebido')) || (await banco.contextos.count()) > 0
      if (!jaTemDados) {
        try { await sincronizar(banco, servidor) } catch {
          if (ativo) setPreparo({ tipo: 'sem-internet' })
          return
        }
      }
      if (!legadoJaResolvido(usuario.id)) {
        const legado = await procurarLegado()
        if (legado) { if (ativo) setPreparo({ tipo: 'legado', legado }); return }
      }
      await garantirDadosIniciais(banco)
      await trazerAjustesDoAparelho(banco)
      if (!ativo) return
      parar = iniciarSincronizacao(banco, servidor)
      setPreparo({ tipo: 'pronto' })
    })()
    return () => { ativo = false; parar?.() }
  }, [usuario.id, tentativa])

  if (preparo.tipo === 'abrindo') return <Centro><p className="text-slate-500">Abrindo seus dados…</p></Centro>
  if (preparo.tipo === 'sem-internet') {
    return (
      <Centro>
        <h1 className="text-xl font-bold">Conecte-se à internet</h1>
        <p className="text-slate-600 dark:text-slate-400">É a primeira vez que você entra neste aparelho. Precisamos de internet para baixar seus dados. Depois disso, o app também funciona offline.</p>
        <Botao onClick={() => { setPreparo({ tipo: 'abrindo' }); setTentativa((t) => t + 1) }}>Tentar de novo</Botao>
      </Centro>
    )
  }
  if (preparo.tipo === 'legado') {
    const { legado } = preparo
    const continuar = async (trazer: boolean) => {
      setTrazendo(true)
      if (trazer) await trazerLegado(legado.banco, db)
      legado.banco.close()
      marcarLegado(usuario.id, trazer ? 'trazido' : 'recusado')
      setTrazendo(false)
      setPreparo({ tipo: 'abrindo' }); setTentativa((t) => t + 1)
    }
    return (
      <Centro>
        <h1 className="text-xl font-bold">Trazer seus dados para a conta?</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Encontramos dados salvos neste aparelho de antes de existir login: <strong>{legado.lancamentos} lançamentos</strong>
          {legado.outros > 0 ? ` e ${legado.outros} outros registros` : ''}. Trazendo, eles passam a ficar na conta <strong>{usuario.email}</strong> e aparecem em qualquer aparelho.
        </p>
        <Botao className="w-full" disabled={trazendo} onClick={() => void continuar(true)}>{trazendo ? 'Trazendo…' : 'Trazer para minha conta'}</Botao>
        <Botao variante="secundario" className="w-full" disabled={trazendo} onClick={() => void continuar(false)}>Agora não</Botao>
        <p className="text-xs text-slate-500 dark:text-slate-400">"Agora não" mantém os dados antigos guardados neste aparelho, sem apagar.</p>
      </Centro>
    )
  }
  return <App />
}
