const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export interface TokenIdentity {
  email: string
}

export async function issueToken(secret: string, email: string): Promise<string> {
  const expires = Date.now() + TOKEN_TTL_MS
  const payload = `${expires}.${encodeURIComponent(email)}`
  const sig = await hmac(secret, payload)
  return `${payload}.${sig}`
}

export async function verifyToken(secret: string, token: string | null): Promise<TokenIdentity | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [expiresStr, emailEnc, sig] = parts
  const expires = Number(expiresStr)
  if (!Number.isFinite(expires) || expires < Date.now()) return null
  const expectedSig = await hmac(secret, `${expiresStr}.${emailEnc}`)
  if (expectedSig !== sig) return null
  return { email: decodeURIComponent(emailEnc) }
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}
