/**
 * Converte os bytes do arquivo em texto. Bancos brasileiros ainda usam muito
 * Windows-1252 (ISO-8859-1); se o arquivo não for UTF-8 válido, cai para ele.
 */
export function decodificar(bytes: Uint8Array): string {
  const cabecalho = new TextDecoder('ascii').decode(bytes.slice(0, 400))
  const declarado = /CHARSET:\s*(1252|8859)/i.test(cabecalho) || /encoding="(windows-1252|iso-8859-1)"/i.test(cabecalho)
  if (!declarado) {
    try {
      return tirarBOM(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      /* não é UTF-8 */
    }
  }
  return tirarBOM(new TextDecoder('windows-1252').decode(bytes))
}

function tirarBOM(t: string): string {
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t
}
