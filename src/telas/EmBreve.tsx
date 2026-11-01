import { EstadoVazio, Tela } from '../ui/componentes'

const CONTEUDO = {
  mes: { titulo: 'Mês', icone: '🗓️', fase: 2, texto: 'Lançamentos do mês, limites por categoria, contas que se repetem e histórico.' },
  importar: { titulo: 'Importar', icone: '📥', fase: 4, texto: 'Extratos e faturas em OFX, CSV, PDF, foto ou texto colado, com conferência antes de lançar.' },
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
