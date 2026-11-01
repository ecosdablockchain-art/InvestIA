import { useEffect, useState } from 'react'
import { Botao } from '../ui/componentes'
import { IconeCadeado } from '../ui/Icones'
import { verificarBiometria } from './bloqueio'

export function TelaBloqueio({ credencialId, onDesbloquear }: { credencialId: string; onDesbloquear: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [ajuda, setAjuda] = useState(false)

  useEffect(() => {
    document.title = 'Finanças 360 — bloqueado'
    return () => { document.title = 'Finanças 360' }
  }, [])

  async function desbloquear() {
    setErro(null)
    setVerificando(true)
    const ok = await verificarBiometria(credencialId)
    setVerificando(false)
    if (ok) onDesbloquear()
    else setErro('Não deu certo. Tente de novo.')
  }

  return (
    <main className="pt-seguro pb-seguro flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-marca-600 text-white shadow-lg">
        <IconeCadeado width={40} height={40} />
      </div>
      <div>
        <h1 className="text-2xl font-bold">Finanças 360</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Seus dados estão protegidos.</p>
      </div>
      <Botao onClick={desbloquear} disabled={verificando} className="w-full max-w-xs">
        {verificando ? 'Verificando…' : 'Desbloquear com Face ID'}
      </Botao>
      <p role="alert" className="min-h-5 text-sm text-red-600 dark:text-red-400">{erro}</p>
      <button type="button" className="text-sm text-marca-600 underline dark:text-marca-100" onClick={() => setAjuda(!ajuda)} aria-expanded={ajuda}>
        Não consigo desbloquear
      </button>
      {ajuda && (
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-400">
          O bloqueio usa uma chave guardada só neste aparelho. Se ela foi apagada, a única saída é apagar os dados deste site
          (Ajustes do iPhone › Apps › Safari › Avançado › Dados dos Sites) e restaurar seu último backup.
        </p>
      )}
    </main>
  )
}
