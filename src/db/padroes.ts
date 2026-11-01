import type { Categoria, Contexto, TipoCategoria } from './tipos'
import { criar, type BancoFinancas } from './banco'

export const CATEGORIAS_PADRAO: ReadonlyArray<{ nome: string; icone: string; tipo: TipoCategoria }> = [
  { nome: 'Moradia', icone: '🏠', tipo: 'gasto' },
  { nome: 'Alimentação', icone: '🍽️', tipo: 'gasto' },
  { nome: 'Transporte', icone: '🚗', tipo: 'gasto' },
  { nome: 'Saúde', icone: '🩺', tipo: 'gasto' },
  { nome: 'Educação', icone: '📚', tipo: 'gasto' },
  { nome: 'Lazer', icone: '🎬', tipo: 'gasto' },
  { nome: 'Assinaturas', icone: '🔁', tipo: 'gasto' },
  { nome: 'Compras', icone: '🛍️', tipo: 'gasto' },
  { nome: 'Dívidas e juros', icone: '💳', tipo: 'gasto' },
  { nome: 'Investimentos e trading', icone: '📈', tipo: 'ambos' },
  { nome: 'Família', icone: '👨‍👩‍👧', tipo: 'gasto' },
  { nome: 'Impostos e taxas', icone: '🧾', tipo: 'gasto' },
  { nome: 'Salário', icone: '💼', tipo: 'renda' },
  { nome: 'Renda extra', icone: '✨', tipo: 'renda' },
  { nome: 'Outros', icone: '📦', tipo: 'ambos' },
]

export const CORES_CONTEXTO = ['#2563eb', '#0d9488', '#9333ea', '#ea580c', '#db2777', '#65a30d']

/** Cria o contexto Pessoal e as categorias padrão na primeira abertura. Idempotente. */
export async function garantirDadosIniciais(banco: BancoFinancas): Promise<void> {
  await banco.transaction('rw', banco.contextos, banco.categorias, async () => {
    if ((await banco.contextos.count()) === 0) {
      await banco.contextos.add(
        criar<Contexto>({ nome: 'Pessoal', tipo: 'pessoal', icone: '🙂', cor: CORES_CONTEXTO[0] ?? '#2563eb', ordem: 0, arquivado: false }),
      )
    }
    if ((await banco.categorias.count()) === 0) {
      await banco.categorias.bulkAdd(
        CATEGORIAS_PADRAO.map((c, i) =>
          criar<Categoria>({ ...c, limiteMensal: null, ordem: i, padrao: true, arquivada: false }),
        ),
      )
    }
  })
}
