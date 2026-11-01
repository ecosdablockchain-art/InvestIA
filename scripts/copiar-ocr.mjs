// Copia os arquivos do OCR (Tesseract) para public/ocr, para o site servir tudo
// sozinho: nenhuma imagem ou código passa por servidores de terceiros.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const destino = join(process.cwd(), 'public', 'ocr')
mkdirSync(destino, { recursive: true })

const pasta = (pacote) => dirname(require.resolve(`${pacote}/package.json`))
const arquivos = [
  [join(pasta('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']
    .map((f) => [join(pasta('tesseract.js-core'), f), f]),
  [join(pasta('@tesseract.js-data/por'), '4.0.0_best_int', 'por.traineddata.gz'), 'por.traineddata.gz'],
]
for (const [de, para] of arquivos) {
  if (!existsSync(de)) throw new Error(`Arquivo do OCR não encontrado: ${de}`)
  copyFileSync(de, join(destino, para))
}
console.log(`OCR: ${arquivos.length} arquivos copiados para public/ocr`)
