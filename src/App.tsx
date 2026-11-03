import { useEffect, useRef, useState } from 'react'
import { useRota, type Aba } from './rotas'
import { usePreferencias } from './seguranca/preferencias'
import { TelaBloqueio } from './seguranca/TelaBloqueio'
import { BarraLateral, TabBar } from './ui/TabBar'
import { Painel } from './telas/Painel'
import { Credito } from './telas/credito/Credito'
import { Patrimonio } from './telas/patrimonio/Patrimonio'
import { Insights } from './telas/insights/Insights'
import { Jogo } from './telas/jogo/Jogo'
import { Mes } from './telas/mes/Mes'
import { Aviso } from './ui/Aviso'
import { Ajustes, ExcluirConta, Instalar } from './telas/Ajustes'
import { AjustesCategorias, AjustesContextos } from './telas/AjustesListas'
import { lerAjustesConta, salvarAjustesConta } from './db/ajustesConta'

/** Tempo fora do app antes de pedir Face ID de novo. */
const TOLERANCIA_MS = 30_000

export function useTema(tema: 'sistema' | 'claro' | 'escuro') {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => document.documentElement.classList.toggle('dark', tema === 'escuro' || (tema === 'sistema' && mq.matches))
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [tema])
}

export function App() {
  const prefs = usePreferencias()
  const rota = useRota()
  const bloqueioLigado = prefs.bloqueioAtivo && prefs.credencialId !== null
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [oculto, setOculto] = useState(false)
  const saiuEm = useRef<number | null>(null)

  // O Consultor (IA) saiu do app: apaga a chave do Claude que tenha ficado guardada na conta.
  useEffect(() => {
    void lerAjustesConta().then((a) => { if (a.chaveClaude) void salvarAjustesConta({ chaveClaude: '' }) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!bloqueioLigado) return
    const aoMudar = () => {
      if (document.visibilityState === 'hidden') {
        saiuEm.current = Date.now()
        setOculto(true)
      } else {
        setOculto(false)
        if (saiuEm.current !== null && Date.now() - saiuEm.current > TOLERANCIA_MS) setDesbloqueado(false)
        saiuEm.current = null
      }
    }
    document.addEventListener('visibilitychange', aoMudar)
    return () => document.removeEventListener('visibilitychange', aoMudar)
  }, [bloqueioLigado])

  if (bloqueioLigado && !desbloqueado && prefs.credencialId) {
    return <TelaBloqueio credencialId={prefs.credencialId} onDesbloquear={() => setDesbloqueado(true)} />
  }

  const [secao] = rota.split('/')
  const abas: Aba[] = ['painel', 'mes', 'insights', 'credito', 'patrimonio']
  const aba = abas.includes(secao as Aba) ? (secao as Aba) : secao === 'ajustes' ? 'painel' : null

  let tela
  switch (rota) {
    case 'mes': tela = <Mes key="mes" />; break
    case 'mes/limites': tela = <Mes key="limites" secaoInicial="limites" />; break
    case 'mes/repetem': tela = <Mes key="repetem" secaoInicial="recorrentes" />; break
    case 'mes/historico': tela = <Mes key="historico" secaoInicial="historico" />; break
    case 'mes/novo': tela = <Mes key="novo" abrirNovo />; break
    case 'credito': tela = <Credito key="cartoes" />; break
    case 'credito/dividas': tela = <Credito key="dividas" secaoInicial="dividas" />; break
    case 'patrimonio': tela = <Patrimonio key="resumo" />; break
    case 'patrimonio/metas': tela = <Patrimonio key="metas" secaoInicial="metas" />; break
    case 'ajustes': tela = <Ajustes />; break
    case 'ajustes/contextos': tela = <AjustesContextos />; break
    case 'ajustes/categorias': tela = <AjustesCategorias />; break
    case 'insights': tela = <Insights />; break
    case 'consultor': tela = <Insights />; break // link antigo
    case 'jogo': tela = <Jogo />; break
    case 'ajustes/excluir-conta': tela = <ExcluirConta />; break
    case 'ajustes/instalar': tela = <Instalar />; break
    default: tela = <Painel />
  }

  return (
    <>
      <div aria-hidden={oculto} className={`lg:pl-64 ${oculto ? 'blur-xl' : ''}`}>{tela}</div>
      <TabBar ativa={aba} />
      <BarraLateral ativa={aba} rota={rota} />
      <Aviso />
    </>
  )
}
