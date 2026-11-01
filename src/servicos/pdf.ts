import { agruparLinhas, type ItemTexto } from '../core/importacao/pdfLinhas'

/** O PDF tem senha. `incorreta` = a senha informada não confere. */
export class SenhaPdfErro extends Error {
  constructor(readonly incorreta: boolean) {
    super(incorreta ? 'Senha incorreta.' : 'Este PDF tem senha.')
    this.name = 'SenhaPdfErro'
  }
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type Documento = Awaited<ReturnType<PdfJs['getDocument']>['promise']>
let carregado: Promise<PdfJs> | null = null

/** Carrega o pdf.js só quando precisa (não pesa na abertura do app). */
function pdfjs(): Promise<PdfJs> {
  carregado ??= (async () => {
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    if (typeof window !== 'undefined') {
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
      lib.GlobalWorkerOptions.workerSrc = worker.default
    }
    return lib
  })()
  return carregado
}

export interface PdfLido {
  linhas: string[]
  paginas: number
  /** false = PDF escaneado (só imagem): precisa de OCR */
  temTexto: boolean
  documento: Documento
  /** Libera a memória do PDF. */
  fechar: () => Promise<void>
}

/**
 * Abre o PDF em memória e extrai as linhas de texto. A senha é usada só aqui e não é guardada.
 */
export async function lerPdf(bytes: Uint8Array, senha?: string): Promise<PdfLido> {
  const lib = await pdfjs()
  const tarefa = lib.getDocument({ data: bytes.slice(), password: senha, useSystemFonts: true })
  let documento: Documento
  try {
    documento = await tarefa.promise
  } catch (e) {
    void tarefa.destroy()
    const err = e as { name?: string; code?: number }
    if (err?.name === 'PasswordException') throw new SenhaPdfErro(err.code === 2)
    throw new Error('Não consegui abrir este PDF.')
  }
  const linhas: string[] = []
  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n)
    const conteudo = await pagina.getTextContent()
    const itens: ItemTexto[] = []
    for (const it of conteudo.items) {
      if (!('str' in it)) continue
      const [, , c, d, x, y] = it.transform as number[]
      itens.push({ str: it.str, x: x ?? 0, y: y ?? 0, largura: it.width, altura: it.height || Math.hypot(c ?? 0, d ?? 0) || 10 })
    }
    linhas.push(...agruparLinhas(itens))
  }
  const caracteres = linhas.join('').replace(/\s/g, '').length
  return { linhas, paginas: documento.numPages, temTexto: caracteres >= 20, documento, fechar: () => tarefa.destroy() }
}

/** Desenha as páginas em imagens (para OCR de PDF escaneado). Só no navegador. */
export async function paginasComoImagens(documento: Documento, maxPaginas = 6): Promise<HTMLCanvasElement[]> {
  const out: HTMLCanvasElement[] = []
  for (let n = 1; n <= Math.min(documento.numPages, maxPaginas); n++) {
    const pagina = await documento.getPage(n)
    const viewport = pagina.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await pagina.render({ canvas, viewport }).promise
    out.push(canvas)
  }
  return out
}
