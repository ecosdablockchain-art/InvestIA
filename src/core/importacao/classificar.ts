import type { Centavos } from '../dinheiro'
import { diasEntre, type DataISO } from '../datas'
import { normalizar } from '../busca'
import type { LinhaImportada } from './tipos'

export type TipoLinha = 'gasto' | 'entrada' | 'pagamento-fatura' | 'transferencia'

const PAGAMENTO_FATURA = /\b(pagamento|pagto|pgto|pag)\.?\s*(de\s+)?(fatura|cartao|cart)\b|\bfatura\s+(cartao|santander|nubank|itau|inter)\b|\bpagamento recebido\b|\bdeb(ito)?\s+aut(omatico)?\.?\s+(fatura|cartao)\b/
const TRANSFERENCIA_PROPRIA = /\b(mesma titularidade|entre contas|conta propria|transf(erencia)?\s+(entre|p\/?\s*conta propria)|aplicacao|resgate|aplic\.?|resg\.?|invest(imento)?\s+automatico|poupanca|cdb|tesouro direto|cofrinho|caixinha)\b/

/** Primeira classificação de uma linha, antes de olhar outras linhas. */
export function tipoDaLinha(l: LinhaImportada): TipoLinha {
  const d = normalizar(l.descricao)
  if (PAGAMENTO_FATURA.test(d)) return 'pagamento-fatura'
  if (TRANSFERENCIA_PROPRIA.test(d)) return 'transferencia'
  return l.valor < 0 ? 'gasto' : 'entrada'
}

/**
 * Marca como transferência pares do mesmo arquivo com mesmo valor e sinais opostos,
 * em até 1 dia de diferença (ex.: saiu da conta e entrou na poupança).
 */
export function marcarParesDeTransferencia(linhas: LinhaImportada[], tipos: TipoLinha[]): TipoLinha[] {
  const out = [...tipos]
  const usados = new Set<number>()
  for (let i = 0; i < linhas.length; i++) {
    if (usados.has(i)) continue
    const a = linhas[i]
    if (!a) continue
    for (let j = i + 1; j < linhas.length; j++) {
      const b = linhas[j]
      if (!b || usados.has(j)) continue
      if (a.valor === -b.valor && Math.abs(diasEntre(a.data, b.data)) <= 1 && pareceTransferencia(a, b)) {
        out[i] = 'transferencia'
        out[j] = 'transferencia'
        usados.add(i); usados.add(j)
        break
      }
    }
  }
  return out
}

function pareceTransferencia(a: LinhaImportada, b: LinhaImportada): boolean {
  const t = normalizar(`${a.descricao} ${b.descricao}`)
  return /\b(transf|ted|doc|pix|aplic|resg|poupanca|invest)/.test(t)
}

// ---------- chave para regras do usuário ----------

const RUIDO = /\b(compra|compras|cartao|credito|debito|deb|cred|pix|enviado|enviada|recebido|recebida|transf|transferencia|ted|doc|pagamento|pagto|pgto|pag|boleto|parcela|parc|com|de|da|do|em|no|na|para|p|elo|visa|master|mastercard|santander|br|sao paulo|sp|rj|ltda|me|eireli|sa)\b/g

/** Chave curta da descrição: as duas primeiras palavras relevantes. "IFOOD *RESTAURANTE X 12/03" → "ifood restaurante". */
export function chaveDescricao(descricao: string): string {
  const limpa = normalizar(descricao)
    .replace(/[*#/\\._-]/g, ' ')
    .replace(/\b\d+[\d/:.-]*\b/g, ' ')
    .replace(RUIDO, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return limpa.split(' ').filter((p) => p.length >= 2).slice(0, 2).join(' ')
}

export interface Regra { padrao: string; categoriaId: string; contextoId: string | null }

/** Regra do usuário que vale para a descrição: a mais longa contida na chave. */
export function regraPara(descricao: string, regras: Regra[]): Regra | null {
  const chave = chaveDescricao(descricao)
  if (!chave) return null
  let melhor: Regra | null = null
  for (const r of regras) {
    if (!r.padrao) continue
    const casa = chave === r.padrao || ` ${chave} `.includes(` ${r.padrao} `)
    if (casa && (!melhor || r.padrao.length > melhor.padrao.length)) melhor = r
  }
  return melhor
}

// ---------- palavras-chave padrão ----------

/** Nome da categoria padrão → termos (já sem acento). Termos curtos casam só como palavra inteira. */
const PALAVRAS: Record<string, string[]> = {
  'Alimentação': ['ifood', 'rappi', 'ze delivery', 'restaurante', 'padaria', 'panificadora', 'mercado', 'supermercado', 'supermercados', 'carrefour', 'assai', 'atacadao', 'pao de acucar', 'hortifruti', 'sacolao', 'lanchonete', 'burger', 'mcdonalds', 'mc donalds', 'bk', 'subway', 'pizzaria', 'pizza', 'acougue', 'sams club', 'oxxo', 'dia brasil', 'big bompreco', 'zaffari', 'guanabara', 'mambo', 'sonda', 'st marche', 'oba', 'cafe', 'cafeteria', 'starbucks', 'sorveteria', 'doceria', 'hamburgueria', 'churrascaria', 'bar e restaurante', 'aiqfome', 'quitanda', 'emporio'],
  'Transporte': ['uber', '99app', '99 pop', '99pop', '99 taxi', 'cabify', 'posto', 'auto posto', 'shell', 'ipiranga', 'petrobras', 'br mania', 'combustivel', 'gasolina', 'estacionamento', 'estapar', 'sem parar', 'conectcar', 'veloe', 'metro', 'cptm', 'bilhete unico', 'top', 'pedagio', 'taxi', 'buser', 'clickbus', 'blablacar', 'localiza', 'movida', 'unidas', 'oficina', 'autopecas', 'lavagem', 'lava rapido'],
  'Assinaturas': ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo', 'max com', 'globoplay', 'youtube premium', 'youtube', 'apple com bill', 'apple com', 'icloud', 'google one', 'google storage', 'deezer', 'paramount', 'openai', 'chatgpt', 'anthropic', 'claude ai', 'microsoft', 'adobe', 'canva', 'crunchyroll', 'star plus', 'twitch', 'patreon', 'duolingo', 'gympass', 'wellhub', 'totalpass', 'smart fit', 'smartfit'],
  'Saúde': ['drogasil', 'droga raia', 'raia', 'pague menos', 'farmacia', 'drogaria', 'drogarias', 'unimed', 'amil', 'hapvida', 'notredame', 'sulamerica saude', 'bradesco saude', 'laboratorio', 'clinica', 'hospital', 'odonto', 'odontologia', 'dentista', 'fleury', 'dasa', 'lavoisier', 'psicolog', 'fisioterapia', 'otica', 'panvel', 'drogao', 'ultrafarma'],
  'Moradia': ['aluguel', 'condominio', 'enel', 'light', 'cemig', 'copel', 'coelba', 'celpe', 'cosern', 'energisa', 'equatorial', 'celesc', 'sabesp', 'cedae', 'copasa', 'sanepar', 'embasa', 'comgas', 'naturgy', 'iptu', 'vivo', 'claro', 'tim', 'oi fibra', 'net servicos', 'sky', 'leroy merlin', 'telhanorte', 'c c', 'tok stok', 'quinto andar', 'quintoandar', 'imobiliaria'],
  'Educação': ['escola', 'colegio', 'faculdade', 'universidade', 'curso', 'cursos', 'udemy', 'alura', 'coursera', 'hotmart', 'livraria', 'saraiva', 'mensalidade escolar', 'material escolar', 'kumon', 'wizard', 'ccaa', 'fisk', 'cultura inglesa'],
  'Lazer': ['cinema', 'cinemark', 'kinoplex', 'ingresso', 'ingressos', 'sympla', 'eventim', 'ticketmaster', 'steam', 'playstation', 'psn', 'xbox', 'nintendo', 'bar', 'boteco', 'pub', 'show', 'teatro', 'hotel', 'pousada', 'airbnb', 'booking', 'decolar', 'latam', 'gol linhas', 'azul linhas', 'azul', 'cvc', 'parque', 'museu', 'clube'],
  'Compras': ['amazon', 'mercado livre', 'mercadolivre', 'mercadolibre', 'shopee', 'aliexpress', 'shein', 'magalu', 'magazine luiza', 'americanas', 'casas bahia', 'ponto frio', 'renner', 'c&a', 'cea', 'riachuelo', 'zara', 'centauro', 'netshoes', 'kabum', 'fast shop', 'havan', 'decathlon', 'pernambucanas', 'marisa', 'hering', 'natura', 'boticario', 'sephora', 'leroy', 'ikea', 'temu', 'dafiti', 'nike', 'adidas'],
  'Impostos e taxas': ['iof', 'tarifa', 'tarifas', 'anuidade', 'imposto', 'darf', 'das simples', 'das mei', 'ipva', 'licenciamento', 'detran', 'multa', 'cesta de servicos', 'taxa', 'cartorio', 'receita federal', 'inss', 'gru'],
  'Dívidas e juros': ['juros', 'encargos', 'rotativo', 'emprestimo', 'financiamento', 'mora', 'multa atraso', 'parcelamento fatura', 'cheque especial', 'adiantamento a depositante'],
  'Investimentos e trading': ['corretora', 'xp investimentos', 'rico investimentos', 'clear corretora', 'btg', 'nuinvest', 'easynvest', 'modal', 'avenue', 'binance', 'mercado bitcoin', 'foxbit', 'b3'],
  'Família': ['pensao', 'mesada', 'creche', 'baba', 'petshop', 'pet shop', 'petz', 'cobasi', 'veterinario', 'veterinaria'],
  'Salário': ['salario', 'folha de pagamento', 'pagto salario', 'proventos', 'remuneracao', 'pro labore', 'prolabore', 'adiantamento salarial', '13o salario', 'ferias'],
  'Renda extra': ['rendimento', 'rendimentos', 'dividendos', 'juros sobre capital', 'cashback', 'reembolso', 'estorno'],
}

const REGEX_PALAVRAS: { categoria: string; re: RegExp }[] = Object.entries(PALAVRAS).flatMap(([categoria, termos]) =>
  termos.map((t) => ({ categoria, re: new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\&]/g, (c) => (c === '&' ? '&' : `\\${c}`))}($|[^a-z0-9])`) })),
)

/** Categoria padrão sugerida por palavra-chave (nome da categoria), ou null. */
export function categoriaPorPalavra(descricao: string, tipo: TipoLinha): string | null {
  const d = normalizar(descricao).replace(/[*#/\\._-]/g, ' ')
  for (const { categoria, re } of REGEX_PALAVRAS) {
    if (!re.test(d)) continue
    // entradas só caem em categorias de renda (e estornos), gastos nunca em Salário
    const deRenda = categoria === 'Salário' || categoria === 'Renda extra'
    if (tipo === 'entrada' ? deRenda || categoria === 'Investimentos e trading' : !deRenda) return categoria
  }
  return null
}

// ---------- duplicados ----------

export interface Existente { data: DataISO; valor: Centavos; tipo: 'gasto' | 'renda'; descricao: string; idExterno?: string | null }

/** Semelhança entre descrições (palavras em comum). */
function parecidas(a: string, b: string): boolean {
  const pa = new Set(normalizar(a).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((p) => p.length >= 3))
  const pb = new Set(normalizar(b).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((p) => p.length >= 3))
  if (pa.size === 0 || pb.size === 0) return false
  let comum = 0
  for (const p of pa) if (pb.has(p)) comum++
  return comum / Math.min(pa.size, pb.size) >= 0.5
}

/**
 * A linha já existe no app? Mesmo identificador do banco, ou mesmo valor e tipo
 * com data até 1 dia de diferença e descrição parecida.
 */
export function jaLancado(l: LinhaImportada, existentes: Existente[]): boolean {
  const tipo = l.valor < 0 ? 'gasto' : 'renda'
  const valor = Math.abs(l.valor)
  return existentes.some((e) =>
    (l.idExterno && e.idExterno === l.idExterno) ||
    (e.valor === valor && e.tipo === tipo && Math.abs(diasEntre(e.data, l.data)) <= 1 && parecidas(e.descricao, l.descricao)),
  )
}
