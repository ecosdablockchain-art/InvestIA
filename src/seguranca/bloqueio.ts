/**
 * Bloqueio com Face ID / Touch ID / código do aparelho, usando passkey (WebAuthn).
 * A passkey é criada só neste aparelho e pede verificação do usuário a cada abertura.
 *
 * Importante: é uma barreira de privacidade para quem pega o celular desbloqueado.
 * Os dados no navegador não ficam criptografados por isso.
 */

function bytesAleatorios(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

function paraBase64Url(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(t: string): Uint8Array<ArrayBuffer> {
  const b64 = t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function biometriaDisponivel(): Promise<boolean> {
  if (!window.PublicKeyCredential || !window.isSecureContext) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Cria a passkey local. Retorna o id para guardar nas preferências. */
export async function cadastrarBiometria(): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Finanças 360' },
      user: { id: bytesAleatorios(16), name: 'Finanças 360', displayName: 'Bloqueio do Finanças 360' },
      challenge: bytesAleatorios(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Cadastro cancelado.')
  return paraBase64Url(cred.rawId)
}

/** Pede Face ID / Touch ID / código. Resolve true se o usuário foi verificado. */
export async function verificarBiometria(credencialId: string): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: bytesAleatorios(32),
        allowCredentials: [{ type: 'public-key', id: deBase64Url(credencialId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    if (!cred) return false
    const resp = cred.response as AuthenticatorAssertionResponse
    // flags: bit 0 = usuário presente, bit 2 = usuário verificado (Face ID / código)
    const flags = new Uint8Array(resp.authenticatorData)[32] ?? 0
    return (flags & 0b100) !== 0
  } catch {
    return false
  }
}
