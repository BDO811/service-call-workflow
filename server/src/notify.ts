// Sends the auto-notify emails (to Jeff and the fixed tech address) the
// moment a new order is captured, via Gmail's SMTP relay (server/src/smtp.ts)
// authenticated with an account App Password — no third-party email API,
// just the sender's own Google account. Every recipient is optional at the
// config level: with no GMAIL_USER/GMAIL_APP_PASSWORD or no recipients set,
// this is a no-op that reports why it skipped, rather than throwing — a
// missing notify config must never stop an order from being captured in D1.
import type { ParsedOrder } from './parser.ts'
import { sendViaGmailSmtp } from './smtp.ts'

export interface NotifyEnv {
  GMAIL_USER?: string
  GMAIL_APP_PASSWORD?: string
  JEFF_EMAIL?: string
  TECH_EMAIL?: string
}

export interface NotifyResult {
  sentTo: string[]
  errors: string[]
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function summaryHtml(order: ParsedOrder, subject: string): string {
  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:2px 12px 2px 0;color:#666;white-space:nowrap;vertical-align:top;">${label}</td><td>${escapeHtml(value)}</td></tr>`
      : ''
  return `
    <div style="font-family:sans-serif;font-size:14px;line-height:1.4;">
      <p>${order.needsReview ? '<strong>Needs review</strong> — some fields were missing or unclear. ' : ''}New service call auto-imported from ${escapeHtml(order.vendorName || 'an unknown vendor')}.</p>
      <table cellspacing="0" cellpadding="0">
        ${row('Claim #', order.claimNumber)}
        ${row('Customer', order.customerName)}
        ${row('Phone', order.customerPhone)}
        ${row('Email', order.customerEmail)}
        ${row('Address', order.customerAddress)}
        ${row('Item', order.brand)}
        ${row('Problem', order.reportedProblem)}
        ${row('Appointment', order.appointmentPreference)}
        ${row('Authorization', order.authorizationLimit)}
        ${row('Repair rate', order.repairRate)}
        ${row('Notes', order.notes)}
      </table>
      <p style="color:#666;margin-top:16px;">Original subject: ${escapeHtml(subject)}</p>
    </div>
  `
}

async function sendEmail(env: NotifyEnv, to: string, subject: string, html: string): Promise<void> {
  await sendViaGmailSmtp(env.GMAIL_USER!, env.GMAIL_APP_PASSWORD!, { from: env.GMAIL_USER!, to, subject, html })
}

export async function notifyNewOrder(env: NotifyEnv, order: ParsedOrder, subject: string): Promise<NotifyResult> {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    return { sentTo: [], errors: ['Gmail sending not configured (GMAIL_USER/GMAIL_APP_PASSWORD unset) — skipped'] }
  }

  // Dedupe: Jeff and the tech are sometimes the same inbox, and that must
  // never mean sending the identical email to them twice.
  const recipients = [...new Set([env.JEFF_EMAIL, env.TECH_EMAIL].filter((r): r is string => Boolean(r)))]
  if (recipients.length === 0) {
    return { sentTo: [], errors: ['No recipients configured (JEFF_EMAIL/TECH_EMAIL unset) — skipped'] }
  }

  const sanitize = (s: string) => s.replace(/[\r\n]/g, ' ')
  const emailSubject = `New service call${order.claimNumber ? ` — Claim #${sanitize(order.claimNumber)}` : ''}${order.customerName ? ` — ${sanitize(order.customerName)}` : ''}`
  const html = summaryHtml(order, subject)

  const sentTo: string[] = []
  const errors: string[] = []
  for (const to of recipients) {
    try {
      await sendEmail(env, to, emailSubject, html)
      sentTo.push(to)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }
  return { sentTo, errors }
}
