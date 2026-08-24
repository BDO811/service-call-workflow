// PBKDF2-SHA256 password hashing via Web Crypto (no native deps needed — works
// in both the Workers runtime and plain Node, so scripts/create-admin.mjs can
// share this exact algorithm without pulling in the Worker build).
const ITERATIONS = 100_000

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function deriveBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256)
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const bits = await deriveBits(password, saltBytes)
  return { hash: toHex(bits), salt: toHex(saltBytes) }
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const bits = await deriveBits(password, fromHex(salt))
  return toHex(bits) === hash
}
