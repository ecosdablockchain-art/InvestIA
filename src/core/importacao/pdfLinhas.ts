/** Pedaço de texto de uma página de PDF, com posição (origem no canto inferior esquerdo). */
export interface ItemTexto { str: string; x: number; y: number; largura: number; altura: number }

/**
 * Junta os pedaços de texto em linhas visuais: mesma altura (y) vira uma linha,
 * ordenada da esquerda para a direita. Espaços grandes viram um espaço.
 */
export function agruparLinhas(itens: ItemTexto[]): string[] {
  const validos = itens.filter((i) => i.str.trim() !== '')
  const ordenados = [...validos].sort((a, b) => b.y - a.y || a.x - b.x)
  const linhas: ItemTexto[][] = []
  for (const it of ordenados) {
    const atual = linhas[linhas.length - 1]
    const ref = atual?.[0]
    const tol = Math.max(2, (ref?.altura ?? it.altura) * 0.45)
    if (atual && ref && Math.abs(ref.y - it.y) <= tol) atual.push(it)
    else linhas.push([it])
  }
  return linhas.map((l) => {
    const pecas = [...l].sort((a, b) => a.x - b.x)
    let texto = ''
    let fim = -Infinity
    for (const p of pecas) {
      const gap = p.x - fim
      if (texto && gap > p.altura * 0.2 && !texto.endsWith(' ') && !p.str.startsWith(' ')) texto += ' '
      texto += p.str
      fim = p.x + p.largura
    }
    return texto.replace(/\s+/g, ' ').trim()
  }).filter(Boolean)
}
