/**
 * OCR (leitura de texto em imagens) com Tesseract, rodando no próprio aparelho.
 * Os arquivos (≈ 5 MB) são baixados do próprio site no primeiro uso e ficam em cache.
 */
type Fonte = File | Blob | HTMLCanvasElement

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
      const { data } = await worker.recognize(img)
      textos.push(data.text)
    }
    aoProgredir?.(1)
    return textos.join('\n')
  } finally {
    await worker.terminate()
  }
}
