// Lightweight client-side password gate, active only when there's no
// deployed sync backend yet (see api.ts's syncEnabled). This stops casual
// clicks on the public Admin link — it is NOT real security: the hash ships
// in the public JS bundle, so anyone who reads the source can attack it
// offline. It's superseded automatically by the real per-admin email/password
// system (server/) the moment VITE_SYNC_API_URL is set and the app rebuilds.
const LOCAL_HASH = import.meta.env.VITE_LOCAL_ADMIN_PASSWORD_HASH as string | undefined
const LOCAL_AUTHED_KEY = 'scw_local_authed'

export const localGateEnabled = Boolean(LOCAL_HASH)

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function isLocallyAuthed(): boolean {
  return localStorage.getItem(LOCAL_AUTHED_KEY) === '1'
}

export function clearLocalAuth() {
  localStorage.removeItem(LOCAL_AUTHED_KEY)
}

export async function localLogin(password: string): Promise<boolean> {
  if (!LOCAL_HASH) return false
  const hash = await sha256Hex(password)
  if (hash === LOCAL_HASH) {
    localStorage.setItem(LOCAL_AUTHED_KEY, '1')
    return true
  }
  return false
}
