import type { ParsedOrder } from './parser.ts'

export interface InboxOrderRow {
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

export async function insertInboxOrder(
  db: D1Database,
  parsed: ParsedOrder,
  meta: { subject: string; rawText: string; receivedAt: number },
): Promise<string> {
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO inbox_orders (
        id, received_at, vendor_name, vendor_email, subject, raw_text,
        claim_number, customer_name, customer_phone, customer_email, customer_address,
        brand, model, serial, reported_problem, appointment_preference,
        authorization_limit, repair_rate, notes, needs_review, missing_fields, pulled
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    )
    .bind(
      id,
      meta.receivedAt,
      parsed.vendorName,
      parsed.vendorEmail,
      meta.subject,
      meta.rawText,
      parsed.claimNumber,
      parsed.customerName,
      parsed.customerPhone,
      parsed.customerEmail,
      parsed.customerAddress,
      parsed.brand,
      parsed.model,
      parsed.serial,
      parsed.reportedProblem,
      parsed.appointmentPreference,
      parsed.authorizationLimit,
      parsed.repairRate,
      parsed.notes,
      parsed.needsReview ? 1 : 0,
      JSON.stringify(parsed.missingFields),
    )
    .run()
  return id
}

export async function listUnpulledInboxOrders(db: D1Database, limit = 100): Promise<InboxOrderRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM inbox_orders WHERE pulled = 0 ORDER BY received_at ASC LIMIT ?`)
    .bind(limit)
    .all<InboxOrderRow>()
  return results
}

export async function markPulled(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE inbox_orders SET pulled = 1, pulled_at = ? WHERE id = ?`).bind(Date.now(), id).run()
}
