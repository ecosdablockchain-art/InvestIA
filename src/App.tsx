import { useEffect, useRef, useState } from 'react'
import { useRota, type Aba } from './rotas'
import { usePreferencias } from './seguranca/preferencias'
import { TelaBloqueio } from './seguranca/TelaBloqueio'
import { TabBar } from './ui/TabBar'
import { Painel } from './telas/Painel'
import { EmBreve } from './telas/EmBreve'
import { Mes } from './telas/mes/Mes'
import { Aviso } from './ui/Aviso'
import { Ajustes, Instalar } from './telas/Ajustes'
import { AjustesCategorias, AjustesContextos } from './telas/AjustesListas'

/** Tempo fora do app antes de pedir Face ID de novo. */
const TOLERANCIA_MS = 30_000

function useTema(tema: 'sistema' | 'claro' | 'escuro') {
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
  useTema(prefs.tema)

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
  const abas: Aba[] = ['painel', 'mes', 'importar', 'credito', 'patrimonio']
  const aba = abas.includes(secao as Aba) ? (secao as Aba) : secao === 'ajustes' ? 'painel' : null

  let tela
  switch (rota) {
    case 'mes': tela = <Mes />; break
    case 'importar': case 'credito': case 'patrimonio': tela = <EmBreve aba={rota} />; break
    case 'ajustes': tela = <Ajustes />; break
    case 'ajustes/contextos': tela = <AjustesContextos />; break
    case 'ajustes/categorias': tela = <AjustesCategorias />; break
    case 'ajustes/instalar': tela = <Instalar />; break
    default: tela = <Painel />
  }

  return (
    <>
      <div aria-hidden={oculto} className={oculto ? 'blur-xl' : undefined}>{tela}</div>
      <TabBar ativa={aba} />
      <Aviso />
    </>
  )
}
