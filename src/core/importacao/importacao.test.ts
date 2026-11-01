import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodificar } from './decodificar'
import { lerOFX, pareceOFX } from './ofx'
import { aplicarMapeamento, detectarMapeamento, lerTabela, type MapeamentoCSV } from './csv'
import { lerTexto } from './texto'
import { lerData } from './datas'
import { categoriaPorPalavra, chaveDescricao, jaLancado, regraPara, tipoDaLinha } from './classificar'
import { analisar, inverterSinais } from './analisar'

const exemplo = (nome: string) => decodificar(new Uint8Array(readFileSync(join(__dirname, 'exemplos', nome))))

describe('datas de extrato', () => {
  it.each([
    ['05/11/2026', '2026-11-05'], ['5/11/26', '2026-11-05'], ['2026-11-05', '2026-11-05'],
    ['05-11-2026', '2026-11-05'], ['05.11.2026', '2026-11-05'], ['20261105120000[-3:BRT]', '2026-11-05'],
  ])('%s', (t, d) => expect(lerData(t)).toBe(d))
  it('sem ano usa o ano mais recente que não passa de hoje', () => {
    expect(lerData('05/11', '2026-11-20')).toBe('2026-11-05')
    expect(lerData('28/12', '2026-01-10')).toBe('2025-12-28')
  })
  it('recusa datas impossíveis', () => expect(lerData('31/02/2026')).toBeNull())
})

describe('OFX', () => {
  it('lê o OFX antigo (SGML, Windows-1252) no estilo Santander', () => {
    const texto = exemplo('santander-conta.ofx')
    expect(pareceOFX(texto)).toBe(true)
    const r = lerOFX(texto)
    expect(r.ehCartao).toBe(false)
    expect(r.linhas).toHaveLength(9)
    expect(r.linhas[0]).toEqual({ data: '2026-11-05', descricao: 'TED RECEBIDA PAGTO SALARIO EMPRESA EXEMPLO', valor: 650000, idExterno: '2026110501' })
    expect(r.linhas[1]?.descricao).toBe('COMPRA CARTAO DEB IFOOD *PÃO DE QUEIJO') // acento preservado
    expect(r.linhas[3]?.valor).toBe(-235075)
  })
  it('lê OFX 2 (XML) de cartão, com NAME + MEMO e entidades', () => {
    const r = lerOFX(exemplo('cartao-xml.ofx'))
    expect(r.ehCartao).toBe(true)
    expect(r.linhas.map((l) => l.valor)).toEqual([-12990, -3240, -25000, 235075, -8900])
    expect(r.linhas[2]?.descricao).toBe('SHELL AUTO POSTO EXEMPLO')
    expect(r.linhas[4]?.descricao).toBe('RESTAURANTE SABOR & ARTE')
  })
})

describe('CSV', () => {
  it('Santander: preâmbulo, colunas Crédito/Débito e linha de saldo', () => {
    const t = lerTabela(exemplo('santander-extrato.csv'))
    expect(t.separador).toBe(';')
    const m = detectarMapeamento(t)
    expect(m).toMatchObject({ linhaCabecalho: 2, data: 0, descricao: [1], valor: null, credito: 3, debito: 4 })
    const r = aplicarMapeamento(t, m as MapeamentoCSV)
    expect(r.linhas.map((l) => [l.descricao, l.valor])).toEqual([
      ['TED RECEBIDA PAGTO SALARIO', 650000],
      ['COMPRA CARTAO DEB MC DONALDS', -3890],
      ['PIX ENVIADO JOAO EXEMPLO', -12000],
      ['CONTA DE LUZ ENEL', -21035],
      ['PAGAMENTO CARTAO DE CREDITO', -235075],
    ])
    expect(r.avisos[0]).toContain('1 linha foi ignorada')
  })
  it('Nubank cartão: compras positivas viram gastos', () => {
    const t = lerTabela(exemplo('nubank-cartao.csv'))
    const m = detectarMapeamento(t)
    expect(t.separador).toBe(',')
    expect(m?.positivoEhGasto).toBe(true)
    const r = aplicarMapeamento(t, m as MapeamentoCSV)
    expect(r.ehCartao).toBe(true)
    expect(r.linhas.map((l) => l.valor)).toEqual([-5230, -2190, -19900, 85000, 1990])
  })
  it('Nubank conta: valor com sinal, ponto decimal', () => {
    const t = lerTabela(exemplo('nubank-conta.csv'))
    const r = aplicarMapeamento(t, detectarMapeamento(t) as MapeamentoCSV)
    expect(r.linhas.map((l) => l.valor)).toEqual([420000, -6000, -100000, -85000])
  })
  it('Inter: junta Histórico e Descrição', () => {
    const t = lerTabela(exemplo('inter.csv'))
    const r = aplicarMapeamento(t, detectarMapeamento(t) as MapeamentoCSV)
    expect(r.linhas[1]).toMatchObject({ descricao: 'Compra no debito · Supermercado Exemplo', valor: -31247 })
  })
  it('sem cabeçalho: não adivinha, mas aceita mapeamento manual', () => {
    const t = lerTabela(exemplo('itau-sem-cabecalho.csv'))
    expect(detectarMapeamento(t)).toBeNull()
    const r = aplicarMapeamento(t, { linhaCabecalho: -1, data: 0, descricao: [1], valor: 2, credito: null, debito: null, positivoEhGasto: false })
    expect(r.linhas.map((l) => l.valor)).toEqual([-18000, 500000, -4500])
  })
  it('aceita valores com D/C no fim', () => {
    const t = lerTabela('Data;Descrição;Valor\n01/11/2026;Compra;12,50 D\n02/11/2026;Depósito;100,00 C\n')
    const r = aplicarMapeamento(t, detectarMapeamento(t) as MapeamentoCSV)
    expect(r.linhas.map((l) => l.valor)).toEqual([-1250, 10000])
  })
})

describe('texto colado', () => {
  it('lê linhas com data no início e valor no fim', () => {
    const r = lerTexto(exemplo('texto-colado.txt'), '2026-11-20')
    expect(r.linhas.map((l) => [l.data, l.descricao, l.valor])).toEqual([
      ['2026-11-02', 'IFOOD *RESTAURANTE EXEMPLO', -4590],
      ['2026-11-03', 'UBER *TRIP', -1840],
      ['2026-11-05', 'PIX RECEBIDO JOAO', 120000],
      ['2026-11-06', 'ESTORNO LOJA X', 3000],
    ])
    expect(r.avisos[0]).toContain('2 linhas não foram reconhecidas')
  })
})

const linha = (descricao: string, valor: number, data = '2026-11-05') => ({ data, descricao, valor, idExterno: null })

describe('classificação', () => {
  it.each([
    ['PAGAMENTO DE FATURA CARTAO SANTANDER', -100, 'pagamento-fatura'],
    ['PAGAMENTO CARTAO DE CREDITO', -100, 'pagamento-fatura'],
    ['Pagamento de fatura', -100, 'pagamento-fatura'],
    ['PAGAMENTO RECEBIDO', 100, 'pagamento-fatura'],
    ['APLICACAO POUPANCA', -100, 'transferencia'],
    ['RESGATE CDB', 100, 'transferencia'],
    ['TRANSF ENTRE CONTAS MESMA TITULARIDADE', -100, 'transferencia'],
    ['PIX ENVIADO JOAO', -100, 'gasto'],
    ['TED RECEBIDA PAGTO SALARIO', 100, 'entrada'],
  ])('%s → %s', (d, v, tipo) => expect(tipoDaLinha(linha(d, v))).toBe(tipo))

  it.each([
    ['COMPRA CARTAO DEB IFOOD *PÃO DE QUEIJO', 'Alimentação'],
    ['UBER *TRIP HELP.UBER.COM', 'Transporte'],
    ['DEBITO AUTOMATICO NETFLIX.COM', 'Assinaturas'],
    ['COMPRA CARTAO DEB DROGASIL 1234', 'Saúde'],
    ['CONTA DE LUZ ENEL', 'Moradia'],
    ['TARIFA CESTA DE SERVICOS', 'Impostos e taxas'],
    ['Mercadolivre*Loja Exemplo', 'Compras'],
    ['99 POP *CORRIDA', 'Transporte'],
    ['PIX ENVIADO JOAO EXEMPLO', null],
  ])('%s → %s', (d, cat) => expect(categoriaPorPalavra(d, 'gasto')).toBe(cat))

  it('palavras curtas só casam inteiras', () => {
    expect(categoriaPorPalavra('BARBEARIA EXEMPLO', 'gasto')).toBeNull() // não é "bar"
    expect(categoriaPorPalavra('BAR DO ZE', 'gasto')).toBe('Lazer')
  })
  it('entrada não vira categoria de gasto', () => {
    expect(categoriaPorPalavra('TED RECEBIDA PAGTO SALARIO', 'entrada')).toBe('Salário')
    expect(categoriaPorPalavra('ESTORNO IFOOD', 'entrada')).toBe('Renda extra')
  })
})

describe('regras do usuário', () => {
  it('chave curta ignora números, prefixos e ruído', () => {
    expect(chaveDescricao('COMPRA CARTAO DEB IFOOD *RESTAURANTE X 12/03')).toBe('ifood restaurante')
    expect(chaveDescricao('PIX ENVIADO JOAO EXEMPLO')).toBe('joao exemplo')
  })
  it('a regra mais específica vence', () => {
    const regras = [{ padrao: 'joao', categoriaId: 'familia', contextoId: null }, { padrao: 'joao exemplo', categoriaId: 'aluguel', contextoId: 'mc' }]
    expect(regraPara('PIX ENVIADO JOAO EXEMPLO 1234', regras)?.categoriaId).toBe('aluguel')
    expect(regraPara('PIX ENVIADO JOAO SILVA', regras)?.categoriaId).toBe('familia')
    expect(regraPara('PIX ENVIADO JOAOZINHO', regras)).toBeNull()
  })
})

describe('duplicados', () => {
  const existentes = [
    { data: '2026-11-06', valor: 4590, tipo: 'gasto' as const, descricao: 'IFOOD PAO DE QUEIJO' },
    { data: '2026-11-01', valor: 5000, tipo: 'gasto' as const, descricao: 'X', idExterno: 'abc' },
  ]
  it('mesmo valor, data ±1 dia e descrição parecida', () => {
    expect(jaLancado(linha('COMPRA CARTAO DEB IFOOD *PÃO DE QUEIJO', -4590, '2026-11-07'), existentes)).toBe(true)
    expect(jaLancado(linha('COMPRA CARTAO DEB IFOOD *PÃO DE QUEIJO', -4590, '2026-11-09'), existentes)).toBe(false)
    expect(jaLancado(linha('UBER', -4590, '2026-11-06'), existentes)).toBe(false)
    expect(jaLancado(linha('IFOOD PAO DE QUEIJO', 4590, '2026-11-06'), existentes)).toBe(false) // sinal oposto
  })
  it('mesmo identificador do banco', () => {
    expect(jaLancado({ ...linha('qualquer', -1), idExterno: 'abc' }, existentes)).toBe(true)
  })
})

describe('análise completa do OFX Santander', () => {
  it('pagamento de fatura e aplicação vêm desmarcados; duplicado também', () => {
    const r = lerOFX(exemplo('santander-conta.ofx'))
    const existentes = [{ data: '2026-11-15', valor: 5590, tipo: 'gasto' as const, descricao: 'Netflix' }]
    const a = analisar(r.linhas, [{ padrao: 'imobiliaria exemplo', categoriaId: 'cat-moradia', contextoId: null }], existentes)
    const resumo = a.map((l) => [l.descricao.slice(0, 22), l.tipo, l.selecionada, l.categoriaIdRegra ?? l.categoriaNomeSugerida])
    expect(resumo).toEqual([
      ['TED RECEBIDA PAGTO SAL', 'entrada', true, 'Salário'],
      ['COMPRA CARTAO DEB IFOO', 'gasto', true, 'Alimentação'],
      ['PIX ENVIADO IMOBILIARI', 'gasto', true, 'cat-moradia'],
      ['PAGAMENTO DE FATURA CA', 'pagamento-fatura', false, null],
      ['APLICACAO POUPANCA', 'transferencia', false, null],
      ['COMPRA CARTAO DEB DROG', 'gasto', true, 'Saúde'],
      ['DEBITO AUTOMATICO NETF', 'gasto', false, 'Assinaturas'], // já lançado à mão
      ['TARIFA CESTA DE SERVIC', 'gasto', true, 'Impostos e taxas'],
      ['PIX RECEBIDO MARIA EXE', 'entrada', true, null],
    ])
    expect(a[6]?.duplicado).toBe(true)
  })
  it('pares de transferência no mesmo arquivo', () => {
    const a = analisar([linha('PIX ENVIADO CONTA POUPANCA', -50000), linha('PIX RECEBIDO RAFAEL', 50000, '2026-11-06'), linha('IFOOD', -50000)], [], [])
    expect(a.map((l) => l.tipo)).toEqual(['transferencia', 'transferencia', 'gasto'])
  })
  it('inverter sinais', () => {
    expect(inverterSinais([linha('a', 100)])[0]?.valor).toBe(-100)
  })
})
