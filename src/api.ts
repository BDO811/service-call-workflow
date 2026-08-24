const API_BASE = (import.meta.env.VITE_SYNC_API_URL as string | undefined)?.replace(/\/$/, '')

export const syncEnabled = Boolean(API_BASE)

const TOKEN_KEY = 'scw_auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export async function login(email: string, password: string): Promise<boolean> {
  if (!API_BASE) return false
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return false
  const { token } = (await res.json()) as { token: string }
  setToken(token)
  return true
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  if (!API_BASE) return null
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) clearToken()
  return res
}

export interface InboxOrder {
  id: string
  received_at: number
  vendor_name: string
  vendor_email: string
  subject: string
  raw_text: string
  claim_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_address: string
  brand: string
  model: string
  serial: string
  reported_problem: string
  appointment_preference: string
  authorization_limit: string
  repair_rate: string
  notes: string
  needs_review: number
  missing_fields: string
  pulled: number
  pulled_at: number | null
}

export async function fetchInboxOrders(): Promise<InboxOrder[]> {
  const res = await authedFetch('/api/inbox-orders')
  if (!res || !res.ok) return []
  const data = (await res.json()) as { orders: InboxOrder[] }
  return data.orders
}

export async function ackInboxOrder(id: string): Promise<void> {
  await authedFetch(`/api/inbox-orders/${id}/ack`, { method: 'POST' })
}

export async function ingestTestEmail(
  fromHeader: string,
  subject: string,
  text: string,
): Promise<{ id: string } | null> {
  const res = await authedFetch('/api/ingest-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromHeader, subject, text }),
  })
  if (!res || !res.ok) return null
  return res.json()
}
