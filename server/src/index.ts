import PostalMime from 'postal-mime'
import { parseServiceOrderEmail } from './parser.ts'
import { insertInboxOrder, listUnpulledInboxOrders, markPulled } from './inboxDb.ts'
import { findUserByEmail } from './usersDb.ts'
import { verifyPassword } from './passwords.ts'
import { issueToken, verifyToken, extractBearerToken, type TokenIdentity } from './auth.ts'

export interface Env {
  DB: D1Database
  SESSION_SECRET: string
  ALLOWED_ORIGINS?: string
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://bdo811.github.io',
  'http://localhost:5183',
  'http://localhost:5173',
]

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : DEFAULT_ALLOWED_ORIGINS).map((o) =>
    o.trim(),
  )
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    Vary: 'Origin',
  }
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

async function requireAuth(request: Request, env: Env): Promise<TokenIdentity | null> {
  const token = extractBearerToken(request)
  return verifyToken(env.SESSION_SECRET, token)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const url = new URL(request.url)
    const respond = (r: Response) => {
      for (const [k, v] of Object.entries(cors)) r.headers.set(k, v)
      return r
    }

    try {
      if (url.pathname === '/api/login' && request.method === 'POST') {
        const body = (await request.json()) as { email?: string; password?: string }
        if (!body.email || !body.password) {
          return respond(json({ error: 'Email and password are required' }, { status: 400 }))
        }
        const user = await findUserByEmail(env.DB, body.email)
        if (!user || !(await verifyPassword(body.password, user.password_hash, user.password_salt))) {
          return respond(json({ error: 'Invalid email or password' }, { status: 401 }))
        }
        const token = await issueToken(env.SESSION_SECRET, user.email)
        return respond(json({ token }))
      }

      if (url.pathname === '/api/inbox-orders' && request.method === 'GET') {
        if (!(await requireAuth(request, env))) return respond(json({ error: 'Unauthorized' }, { status: 401 }))
        const rows = await listUnpulledInboxOrders(env.DB)
        return respond(json({ orders: rows }))
      }

      const ackMatch = url.pathname.match(/^\/api\/inbox-orders\/([^/]+)\/ack$/)
      if (ackMatch && request.method === 'POST') {
        if (!(await requireAuth(request, env))) return respond(json({ error: 'Unauthorized' }, { status: 401 }))
        await markPulled(env.DB, ackMatch[1])
        return respond(json({ ok: true }))
      }

      if (url.pathname === '/api/ingest-email' && request.method === 'POST') {
        if (!(await requireAuth(request, env))) return respond(json({ error: 'Unauthorized' }, { status: 401 }))
        const body = (await request.json()) as { fromHeader?: string; subject?: string; text?: string }
        if (!body.fromHeader || !body.text) {
          return respond(json({ error: 'fromHeader and text are required' }, { status: 400 }))
        }
        const parsed = parseServiceOrderEmail({
          fromHeader: body.fromHeader,
          subject: body.subject ?? '',
          text: body.text,
        })
        const id = await insertInboxOrder(env.DB, parsed, {
          subject: body.subject ?? '',
          rawText: body.text,
          receivedAt: Date.now(),
        })
        return respond(json({ id, parsed }))
      }

      return respond(json({ error: 'Not found' }, { status: 404 }))
    } catch (err) {
      return respond(json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 }))
    }
  },

  // Native Cloudflare Email Routing trigger. Wire this up by adding a
  // "Route to Worker" rule for the address you want vendors/forwards to hit —
  // see server/README.md.
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const parsedMime = await PostalMime.parse(message.raw)
    const fromHeader = message.headers.get('from') ?? parsedMime.from?.address ?? message.from
    const subject = parsedMime.subject ?? ''
    const text = parsedMime.text ?? parsedMime.html ?? ''

    const parsed = parseServiceOrderEmail({ fromHeader, subject, text })
    await insertInboxOrder(env.DB, parsed, { subject, rawText: text, receivedAt: Date.now() })
  },
}
