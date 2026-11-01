/**
 * OCR (leitura de texto em imagens) com Tesseract, rodando no próprio aparelho.
 * Os arquivos (≈ 5 MB) são baixados do próprio site no primeiro uso e ficam em cache.
 */
type Fonte = File | Blob | HTMLCanvasElement

const LADO_MAXIMO = 2400

/**
 * Converte a imagem para um canvas que o OCR sempre entende (inclusive fotos HEIC do iPhone,
 * que o Safari sabe abrir), reduzindo fotos muito grandes para não faltar memória.
 */
async function prepararImagem(f: Fonte): Promise<HTMLCanvasElement> {
  if (f instanceof HTMLCanvasElement) return f
  const url = URL.createObjectURL(f)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * escala)
    canvas.height = Math.round(img.naturalHeight * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas indisponível')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } catch (e) {
    throw new Error(`Não consegui abrir a imagem (${e instanceof Error ? e.message : 'formato não suportado'}).`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function reconhecerTexto(imagens: Fonte[], aoProgredir?: (fracao: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const base = new URL('ocr/', document.baseURI).href
  let atual = 0
  const worker = await createWorker('por', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') aoProgredir?.((atual + m.progress) / imagens.length)
    },
  })
  try {
    // mantém espaços entre colunas e trata a imagem como bloco de texto
    await worker.setParameters({ preserve_interword_spaces: '1' })
    const textos: string[] = []
    for (const [i, img] of imagens.entries()) {
      atual = i
      const { data } = await worker.recognize(await prepararImagem(img))
      textos.push(data.text)
    }
    aoProgredir?.(1)
    return textos.join('\n')
  } finally {
    await worker.terminate()
  }
}
