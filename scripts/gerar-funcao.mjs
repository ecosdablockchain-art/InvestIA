// Junta cabecalho.ts + logica.ts + servico.ts em supabase/functions/notificar/index.ts (um arquivo só, para colar no Supabase).
import { readFileSync, writeFileSync } from 'node:fs'
const pasta = 'supabase/functions/notificar'
const ler = (f) => readFileSync(`${pasta}/${f}`, 'utf8')
const saida = [ler('cabecalho.ts'), ler('logica.ts'), ler('servico.ts')].join('\n')
writeFileSync(`${pasta}/index.ts`, saida)
console.log(`gerado ${pasta}/index.ts (${saida.split('\n').length} linhas)`)
