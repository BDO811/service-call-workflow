import { db } from './db'
import { fetchInboxOrders, ackInboxOrder, syncEnabled, getToken } from './api'

export async function syncInboxOrders(): Promise<number> {
  if (!syncEnabled || !getToken()) return 0

  const orders = await fetchInboxOrders()
  if (orders.length === 0) return 0

  for (const o of orders) {
    let customerId: number
    const existing = o.customer_email
      ? await db.customers.where('email').equalsIgnoreCase(o.customer_email).first()
      : o.customer_phone
        ? await db.customers.where('phone').equals(o.customer_phone).first()
        : undefined

    if (existing) {
      customerId = existing.id!
    } else {
      customerId = (await db.customers.add({
        name: o.customer_name || 'Unknown (from email)',
        phone: o.customer_phone,
        email: o.customer_email,
        address: o.customer_address,
        notes: '',
        createdAt: o.received_at,
      })) as number
    }

    const now = Date.now()
    await db.workOrders.add({
      claimNumber: o.claim_number,
      customerId,
      brand: o.brand,
      model: o.model,
      serial: o.serial,
      reportedProblem: o.reported_problem,
      appointmentPreference: o.appointment_preference,
      authorizationLimit: o.authorization_limit,
      repairRate: o.repair_rate,
      notes: o.notes,
      status: 'Pending Scheduling',
      technicianName: '',
      technicianContact: '',
      sentToTechnicianAt: null,
      createdAt: now,
      updatedAt: now,
      source: 'email',
      vendorName: o.vendor_name,
      vendorEmail: o.vendor_email,
      needsReview: Boolean(o.needs_review),
      rawEmailText: o.raw_text,
      activityLog: [
        { ts: now, note: `Imported from email (${o.vendor_name || 'unknown vendor'}).` },
      ],
    })

    await ackInboxOrder(o.id)
  }

  return orders.length
}
