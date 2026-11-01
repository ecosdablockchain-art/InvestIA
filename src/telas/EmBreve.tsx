import { EstadoVazio, Tela } from '../ui/componentes'

const CONTEUDO = {
  credito: { titulo: 'Crédito', icone: '💳', fase: 6, texto: 'Cartões, faturas, compras parceladas, dívidas pelo método avalanche e simulador de quitação.' },
  patrimonio: { titulo: 'Patrimônio', icone: '📊', fase: 7, texto: 'Carteira de bolsa, renda fixa, reserva de emergência, metas e a casa compartilhada.' },
} as const

export function EmBreve({ aba }: { aba: keyof typeof CONTEUDO }) {
  const c = CONTEUDO[aba]
  return (
    <Tela titulo={c.titulo}>
      <EstadoVazio icone={c.icone} titulo={`Chega na fase ${c.fase}`} texto={c.texto} />
    </Tela>
  )
}
