// A minimal SMTP client over Cloudflare's raw TCP sockets, used to send mail
// through Gmail's SMTP relay with an account App Password. No third-party
// email API (Resend, SendGrid, etc.) and no OAuth app to register — just the
// sender's own Google account, which is free within Gmail's normal sending
// limits (500/day for a personal account, 2,000/day for Workspace — far more
// than this app's volume).
import { connect } from 'cloudflare:sockets'

export interface SmtpMessage {
  from: string
  to: string
  subject: string
  html: string
}

class SmtpError extends Error {}

function toBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

// Strips CR/LF from a value that goes into a raw header line, so data pulled
// from a parsed vendor email (claim number, customer name) can never inject
// extra SMTP/MIME headers.
function sanitizeHeaderValue(s: string): string {
  return s.replace(/[\r\n]+/g, ' ')
}

// RFC 5321 "dot-stuffing": a line starting with "." inside the message body
// must be escaped as ".." or the SMTP server treats it as the DATA
// terminator ("\r\n.\r\n") and truncates the message.
function dotStuff(body: string): string {
  return body
    .split(/\r\n|\n/)
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n')
}

async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) throw new SmtpError(`Connection closed while waiting for an SMTP response (got so far: ${buf.trim()})`)
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\r\n').filter(Boolean)
    const last = lines[lines.length - 1]
    // A multi-line reply uses "250-..." continuation lines and ends with
    // "250 ..." (space, not dash) on the final line.
    if (last && /^\d{3} /.test(last)) return buf
  }
}

function expectCode(response: string, code: string): void {
  if (!response.split('\r\n').some((line) => line.startsWith(code))) {
    throw new SmtpError(`Expected SMTP ${code}, got: ${response.trim()}`)
  }
}

export async function sendViaGmailSmtp(user: string, appPassword: string, msg: SmtpMessage): Promise<void> {
  const socket = connect({ hostname: 'smtp.gmail.com', port: 465 }, { secureTransport: 'on', allowHalfOpen: false })
  const writer = socket.writable.getWriter()
  const reader = socket.readable.getReader()
  const encoder = new TextEncoder()

  const write = (line: string) => writer.write(encoder.encode(`${line}\r\n`))

  try {
    expectCode(await readResponse(reader), '220')

    await write('EHLO workers.dev')
    expectCode(await readResponse(reader), '250')

    await write(`AUTH PLAIN ${toBase64(`\0${user}\0${appPassword}`)}`)
    expectCode(await readResponse(reader), '235')

    await write(`MAIL FROM:<${msg.from}>`)
    expectCode(await readResponse(reader), '250')

    await write(`RCPT TO:<${msg.to}>`)
    expectCode(await readResponse(reader), '250')

    await write('DATA')
    expectCode(await readResponse(reader), '354')

    const headers = [
      `From: ${sanitizeHeaderValue(msg.from)}`,
      `To: ${sanitizeHeaderValue(msg.to)}`,
      `Subject: ${sanitizeHeaderValue(msg.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
    ].join('\r\n')
    const fullMessage = `${headers}\r\n\r\n${dotStuff(msg.html)}\r\n.\r\n`
    await writer.write(encoder.encode(fullMessage))
    expectCode(await readResponse(reader), '250')

    await write('QUIT')
  } finally {
    await reader.cancel().catch(() => {})
    await writer.close().catch(() => {})
    await socket.close().catch(() => {})
  }
}
