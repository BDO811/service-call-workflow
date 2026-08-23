import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function NewOrder() {
  const navigate = useNavigate()
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new')
  const [existingCustomerId, setExistingCustomerId] = useState<string>('')

  const [form, setForm] = useState({
    claimNumber: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    brand: '',
    model: '',
    serial: '',
    reportedProblem: '',
    appointmentPreference: '',
    authorizationLimit: '',
    repairRate: '',
    notes: '',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    let customerId: number
    if (customerMode === 'existing') {
      if (!existingCustomerId) {
        alert('Please select a customer.')
        return
      }
      customerId = Number(existingCustomerId)
    } else {
      if (!form.name.trim()) {
        alert('Customer name is required.')
        return
      }
      customerId = (await db.customers.add({
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        notes: '',
        createdAt: Date.now(),
      })) as number
    }

    const now = Date.now()
    const orderId = await db.workOrders.add({
      claimNumber: form.claimNumber,
      customerId,
      brand: form.brand,
      model: form.model,
      serial: form.serial,
      reportedProblem: form.reportedProblem,
      appointmentPreference: form.appointmentPreference,
      authorizationLimit: form.authorizationLimit,
      repairRate: form.repairRate,
      notes: form.notes,
      status: 'Pending Scheduling',
      technicianName: '',
      technicianContact: '',
      sentToTechnicianAt: null,
      createdAt: now,
      updatedAt: now,
      activityLog: [{ ts: now, note: 'Service order created.' }],
      source: 'manual',
      vendorName: '',
      vendorEmail: '',
      needsReview: false,
      rawEmailText: '',
    })

    navigate(`/orders/${orderId}`)
  }

  return (
    <div>
      <div className="page-header">
        <h1>New Service Order</h1>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <section className="form-section">
          <h2>Service Order Information</h2>
          <div className="field">
            <label>Claim #</label>
            <input value={form.claimNumber} onChange={set('claimNumber')} />
          </div>
        </section>

        <section className="form-section">
          <h2>Customer</h2>
          <div className="radio-row">
            <label>
              <input
                type="radio"
                checked={customerMode === 'new'}
                onChange={() => setCustomerMode('new')}
              />
              New customer
            </label>
            <label>
              <input
                type="radio"
                checked={customerMode === 'existing'}
                onChange={() => setCustomerMode('existing')}
              />
              Existing customer
            </label>
          </div>

          {customerMode === 'existing' ? (
            <div className="field">
              <label>Customer</label>
              <select value={existingCustomerId} onChange={(e) => setExistingCustomerId(e.target.value)}>
                <option value="">Select a customer…</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Customer Name</label>
                <input value={form.name} onChange={set('name')} required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Phone</label>
                  <input value={form.phone} onChange={set('phone')} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={set('email')} />
                </div>
              </div>
              <div className="field">
                <label>Address</label>
                <input value={form.address} onChange={set('address')} />
              </div>
            </>
          )}
        </section>

        <section className="form-section">
          <h2>Covered Item</h2>
          <div className="field-row">
            <div className="field">
              <label>Brand</label>
              <input value={form.brand} onChange={set('brand')} />
            </div>
            <div className="field">
              <label>Model</label>
              <input value={form.model} onChange={set('model')} />
            </div>
            <div className="field">
              <label>Serial</label>
              <input value={form.serial} onChange={set('serial')} />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Job Details</h2>
          <div className="field">
            <label>Reported Problem</label>
            <textarea value={form.reportedProblem} onChange={set('reportedProblem')} rows={3} />
          </div>
          <div className="field">
            <label>Appointment Preferences</label>
            <input value={form.appointmentPreference} onChange={set('appointmentPreference')} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Authorization Limit</label>
              <input value={form.authorizationLimit} onChange={set('authorizationLimit')} placeholder="$" />
            </div>
            <div className="field">
              <label>Repair Rate</label>
              <input value={form.repairRate} onChange={set('repairRate')} placeholder="$" />
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} />
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Create Service Order
          </button>
        </div>
      </form>
    </div>
  )
}
