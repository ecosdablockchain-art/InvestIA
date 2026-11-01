import { useEffect, useState } from 'react'
import { db } from '../../db/banco'
import { processarFaturasVencidas } from '../../db/credito'
import { hojeISO } from '../../core/datas'
import { lerPreferencias } from '../../seguranca/preferencias'
import { Segmentado, Tela } from '../../ui/componentes'
import { Cartoes } from './Cartoes'
import { Dividas } from './Dividas'

export function Credito({ secaoInicial = 'cartoes' }: { secaoInicial?: 'cartoes' | 'dividas' }) {
  const [secao, setSecao] = useState(secaoInicial)
  useEffect(() => { void processarFaturasVencidas(db, hojeISO(), lerPreferencias().taxaRotativoMensal) }, [])
  return (
    <Tela titulo="Crédito">
      <Segmentado rotulo="Seção" valor={secao} onMudar={setSecao} opcoes={[{ valor: 'cartoes', rotulo: 'Cartões' }, { valor: 'dividas', rotulo: 'Dívidas' }]} />
      {secao === 'cartoes' ? <Cartoes /> : <Dividas />}
    </Tela>
  )
}
